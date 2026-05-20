import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemText
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import {
  fetchMyKpiWorksheet,
  fetchKpiWorksheetHistory,
  updateKpiWorksheet,
  fetchTeamKpiWorksheets,
  fetchEmployeeKpiWorksheet
} from '../../../services/kpiWorksheetService';

const MONTHS = [
  { v: 1, label: 'January' },
  { v: 2, label: 'February' },
  { v: 3, label: 'March' },
  { v: 4, label: 'April' },
  { v: 5, label: 'May' },
  { v: 6, label: 'June' },
  { v: 7, label: 'July' },
  { v: 8, label: 'August' },
  { v: 9, label: 'September' },
  { v: 10, label: 'October' },
  { v: 11, label: 'November' },
  { v: 12, label: 'December' }
];

const HR_ADMIN_ROLES = ['super_admin', 'admin', 'developer', 'hr_manager', 'higher_management'];

function emptyRow() {
  return {
    kpiArea: '',
    weight: 0,
    employeeAchieved: 0,
    employeeTotalAssigned: 0,
    managerAchieved: 0,
    managerTotalAssigned: 0,
    achievementPercent: 0,
    score1to5: 1,
    finalWeightage: 0
  };
}

function scoringFromRow(row) {
  const legacyA = Math.max(0, Number(row.achieved) || 0);
  const legacyT = Math.max(0, Number(row.totalAssigned) || 0);
  let eA = Math.max(0, Number(row.employeeAchieved) || 0);
  let eT = Math.max(0, Number(row.employeeTotalAssigned) || 0);
  if (eA === 0 && eT === 0 && (legacyA > 0 || legacyT > 0)) {
    eA = legacyA;
    eT = legacyT;
  }
  const mA = Math.max(0, Number(row.managerAchieved) || 0);
  const mT = Math.max(0, Number(row.managerTotalAssigned) || 0);
  const useManager = mT > 0;
  const ach = useManager ? mA : eA;
  const tgt = useManager ? mT : eT;
  let achievementPercent = 0;
  if (tgt > 0) {
    achievementPercent = Math.min(100, Math.round(((ach / tgt) * 100 + Number.EPSILON) * 100) / 100);
  }
  let score1to5 = 1;
  if (achievementPercent >= 100) score1to5 = 5;
  else if (achievementPercent >= 90) score1to5 = 4;
  else if (achievementPercent >= 75) score1to5 = 3;
  else if (achievementPercent >= 50) score1to5 = 2;
  else if (achievementPercent > 0) score1to5 = 1;
  const w = Math.max(0, Math.min(100, Number(row.weight) || 0));
  const finalWeightage = Math.round(((w / 100) * score1to5 + Number.EPSILON) * 1000) / 1000;
  return {
    employeeAchieved: eA,
    employeeTotalAssigned: eT,
    managerAchieved: mA,
    managerTotalAssigned: mT,
    achievementPercent,
    score1to5,
    finalWeightage,
    scoringSource: useManager ? 'manager' : 'employee'
  };
}

function recomputeLocal(list) {
  return list.map((row) => {
    const s = scoringFromRow({ ...row, weight: row.weight });
    return {
      ...row,
      employeeAchieved: s.employeeAchieved,
      employeeTotalAssigned: s.employeeTotalAssigned,
      managerAchieved: s.managerAchieved,
      managerTotalAssigned: s.managerTotalAssigned,
      achievementPercent: s.achievementPercent,
      score1to5: s.score1to5,
      finalWeightage: s.finalWeightage,
      scoringSource: s.scoringSource
    };
  });
}

const defaultFlags = {
  canEditStructure: true,
  canEditEmployeeCols: true,
  // Safer before GET returns; reporting-line columns are not for the sheet owner (except HR tooling).
  canEditManagerCols: false
};

const KPIMonthlySheet = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isHrPage = location.pathname.startsWith('/hr/kpi/sheet');
  const isTeamReviewPage = location.pathname.startsWith('/profile/team-kpi-reviews');
  const isHrAdmin = HR_ADMIN_ROLES.includes(user?.role);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState([]);
  const [editFlags, setEditFlags] = useState(defaultFlags);
  const [history, setHistory] = useState([]);
  const [team, setTeam] = useState([]);
  const [teamMemberId, setTeamMemberId] = useState('');
  const [hrEmployeeId, setHrEmployeeId] = useState(() => searchParams.get('employeeId') || '');
  const [hrEmployees, setHrEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const targetEmployeeId = useMemo(() => {
    if (isHrPage && isHrAdmin && hrEmployeeId) return hrEmployeeId;
    if (isTeamReviewPage) return teamMemberId || null;
    if (!isHrPage && teamMemberId) return teamMemberId;
    return null;
  }, [isHrPage, isHrAdmin, hrEmployeeId, teamMemberId, isTeamReviewPage]);

  /** On your own sheet you only edit Employee columns; reporting line fills the other two (or HR picks you in the HR KPI sheet). */
  const canEditReportingLineFields = useMemo(() => {
    if (!targetEmployeeId) return false;
    return editFlags.canEditManagerCols;
  }, [targetEmployeeId, editFlags.canEditManagerCols]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetchKpiWorksheetHistory();
      setHistory(res.data?.data || []);
    } catch {
      setHistory([]);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    if (isHrPage) return;
    try {
      const res = await fetchTeamKpiWorksheets({ year, month });
      setTeam(res.data?.data || []);
    } catch {
      setTeam([]);
    }
  }, [isHrPage, year, month]);

  const loadHrEmployees = useCallback(async () => {
    if (!isHrPage || !isHrAdmin) return;
    try {
      const res = await api.get('/hr/employees?limit=500&active=true');
      const list = res.data?.data || res.data?.employees || res.data || [];
      setHrEmployees(Array.isArray(list) ? list : []);
    } catch {
      setHrEmployees([]);
    }
  }, [isHrPage, isHrAdmin]);

  const loadSheet = useCallback(async () => {
    if (isTeamReviewPage && !teamMemberId) {
      setSheet(null);
      setRows([]);
      setEditFlags(defaultFlags);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let res;
      if (targetEmployeeId) {
        res = await fetchEmployeeKpiWorksheet(targetEmployeeId, { year, month });
      } else {
        res = await fetchMyKpiWorksheet({ year, month });
      }
      const data = res.data?.data;
      const flags = res.data?.editFlags || defaultFlags;
      setEditFlags(flags);
      setSheet(data);
      const r = (data?.rows || []).map((x) => {
        const base = {
          ...x,
          kpiArea: x.kpiArea || '',
          weight: Number(x.weight) || 0,
          employeeAchieved: Number(x.employeeAchieved) || 0,
          employeeTotalAssigned: Number(x.employeeTotalAssigned) || 0,
          managerAchieved: Number(x.managerAchieved) || 0,
          managerTotalAssigned: Number(x.managerTotalAssigned) || 0,
          achieved: Number(x.achieved) || 0,
          totalAssigned: Number(x.totalAssigned) || 0
        };
        const s = scoringFromRow(base);
        return { ...base, ...s };
      });
      setRows(r.length ? r : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load KPI sheet');
      setSheet(null);
      setRows([]);
      setEditFlags(defaultFlags);
    } finally {
      setLoading(false);
    }
  }, [year, month, targetEmployeeId, isTeamReviewPage, teamMemberId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    if (isTeamReviewPage && team.length > 0 && !teamMemberId) {
      setTeamMemberId(team[0].employee._id);
    }
  }, [isTeamReviewPage, team, teamMemberId]);

  useEffect(() => {
    loadHrEmployees();
  }, [loadHrEmployees]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  useEffect(() => {
    const id = searchParams.get('employeeId');
    if (id && isHrPage) setHrEmployeeId(id);
  }, [searchParams, isHrPage]);

  const totalWeight = useMemo(() => rows.reduce((s, r) => s + (Number(r.weight) || 0), 0), [rows]);
  const totalKpi = useMemo(
    () => Math.round(rows.reduce((s, r) => s + (Number(r.finalWeightage) || 0), 0) * 1000) / 1000,
    [rows]
  );
  const pendingReviews = useMemo(
    () => team.filter((t) => !t.worksheet || !t.worksheet.managerScored).length,
    [team]
  );

  const handleCell = (index, field, value) => {
    const next = [...rows];
    const raw = field === 'kpiArea' ? value : value === '' ? 0 : Number(value);
    next[index] = { ...next[index], [field]: field === 'kpiArea' ? String(value) : raw };
    setRows(recomputeLocal(next));
  };

  const addRow = () => setRows((r) => recomputeLocal([...r, emptyRow()]));

  const removeRow = (index) => {
    setRows((r) => recomputeLocal(r.filter((_, i) => i !== index)));
  };

  const handleSave = async () => {
    if (!sheet?._id) return;
    if (rows.length > 0 && Math.abs(totalWeight - 100) > 0.01) {
      toast.error(`Weights must total 100%. Current: ${totalWeight}%`);
      return;
    }
    const payload = {
      rows: rows.map((r) => ({
        kpiArea: r.kpiArea,
        weight: r.weight,
        employeeAchieved: r.employeeAchieved,
        employeeTotalAssigned: r.employeeTotalAssigned,
        managerAchieved: r.managerAchieved,
        managerTotalAssigned: r.managerTotalAssigned
      }))
    };
    setSaving(true);
    try {
      const res = await updateKpiWorksheet(sheet._id, payload);
      setSheet(res.data?.data);
      setEditFlags(res.data?.editFlags || defaultFlags);
      const d = res.data?.data;
      const mapped = (d?.rows || []).map((x) => {
        const base = {
          ...x,
          kpiArea: x.kpiArea || '',
          weight: Number(x.weight) || 0,
          employeeAchieved: Number(x.employeeAchieved) || 0,
          employeeTotalAssigned: Number(x.employeeTotalAssigned) || 0,
          managerAchieved: Number(x.managerAchieved) || 0,
          managerTotalAssigned: Number(x.managerTotalAssigned) || 0,
          achieved: Number(x.achieved) || 0,
          totalAssigned: Number(x.totalAssigned) || 0
        };
        return { ...base, ...scoringFromRow(base) };
      });
      setRows(mapped.length ? mapped : []);
      toast.success('KPI sheet saved');
      loadHistory();
      loadTeam();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const empName = sheet?.employee
    ? [sheet.employee.firstName, sheet.employee.lastName].filter(Boolean).join(' ') ||
      sheet.employee.employeeId
    : '';

  const title = isHrPage
    ? 'Monthly KPI sheet (HR)'
    : isTeamReviewPage
      ? 'Team KPI reviews (Reporting line)'
      : 'My monthly KPI sheet';
  const { canEditStructure, canEditEmployeeCols } = editFlags;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      {isTeamReviewPage && (
        <Alert severity={pendingReviews > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
          Pending reviews this month: <strong>{pendingReviews}</strong>
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Employees define <strong>KPI areas</strong> and <strong>weights</strong> (total 100%). Use separate columns for{' '}
        <strong>employee</strong> vs <strong>reporting line</strong> counts. Achievement %, score, and final weightage use{' '}
        <strong>reporting line</strong> numbers when reporting line &quot;Total assigned&quot; &gt; 0; otherwise they use the employee row
        (same idea as linking your two Excel sheets).
        {!targetEmployeeId && (
          <>
            {' '}
            On <strong>your</strong> sheet, fill only the <strong>Employee</strong> achieved / total assigned; the{' '}
            <strong>Reporting line</strong> pair is disabled and is entered by your reporting line (e.g.{' '}
            <strong>Team KPI reviews</strong>). HR may edit reporting-line values when your employee is selected in{' '}
            <strong>HR → Monthly KPI sheet</strong>.
          </>
        )}
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>Where saved sheets appear:</strong> this page — choose <strong>Month</strong> and <strong>Year</strong> to
        switch periods. Profile: <strong>User Profile → Monthly KPI sheet</strong> (<code>/profile/kpi-sheet</code>). HR
        menu: <strong>KPI Management → Monthly KPI sheet</strong> (<code>/hr/kpi/sheet</code>) to open any employee.
      </Alert>

      {!isHrPage && team.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              My team
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Select a direct report to enter <strong>reporting line</strong> achieved / total assigned.
            </Typography>
            <List dense disablePadding>
              {team.map((t) => (
                <ListItemButton
                  key={t.employee._id}
                  selected={teamMemberId === t.employee._id}
                  onClick={() => setTeamMemberId(t.employee._id === teamMemberId ? '' : t.employee._id)}
                >
                  <ListItemText
                    primary={`${t.employee.firstName || ''} ${t.employee.lastName || ''}`.trim() || t.employee.employeeId}
                    secondary={
                      t.worksheet
                        ? `Total KPI score: ${t.worksheet.totalKPIScore ?? '—'}`
                        : 'No sheet yet — will open on first load'
                    }
                  />
                </ListItemButton>
              ))}
            </List>
            {teamMemberId && (
              <Button size="small" onClick={() => setTeamMemberId('')} sx={{ mt: 1 }}>
                {isTeamReviewPage ? 'Unselect employee' : 'Back to my sheet'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isHrPage && team.length === 0 && isTeamReviewPage && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No employees are assigned under your reporting line yet.
        </Alert>
      )}

      {isHrPage && isHrAdmin && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <TextField
              select
              fullWidth
              label="Employee (HR view)"
              value={hrEmployeeId}
              onChange={(e) => {
                const v = e.target.value;
                setHrEmployeeId(v);
                if (v) setSearchParams({ employeeId: v });
                else setSearchParams({});
              }}
              size="small"
            >
              <MenuItem value="">— My own sheet —</MenuItem>
              {hrEmployees.map((e) => (
                <MenuItem key={e._id} value={e._id}>
                  {[e.firstName, e.lastName].filter(Boolean).join(' ') || e.employeeId} ({e.employeeId})
                </MenuItem>
              ))}
            </TextField>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField select label="Month" size="small" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ minWidth: 140 }}>
            {MONTHS.map((m) => (
              <MenuItem key={m.v} value={m.v}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Year" size="small" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 100 }}>
            {[0, 1, 2].map((d) => {
              const y = now.getFullYear() - d;
              return (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              );
            })}
          </TextField>
          {history.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {history.length} saved month(s) — pick month/year above to view any period.
            </Typography>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {empName && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Employee: <strong>{empName}</strong>
              {sheet?.lastSavedAt && (
                <>
                  {' '}
                  · Last saved: {new Date(sheet.lastSavedAt).toLocaleString()}
                </>
              )}
            </Alert>
          )}

          <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell rowSpan={2}>KPI area</TableCell>
                  <TableCell rowSpan={2} align="right">
                    Weight %
                  </TableCell>
                  <TableCell colSpan={2} align="center">
                    Employee
                  </TableCell>
                  <TableCell colSpan={2} align="center">
                    Reporting line
                  </TableCell>
                  <TableCell rowSpan={2} align="right">
                    Achievement %
                  </TableCell>
                  <TableCell rowSpan={2} align="right">
                    Score (1–5)
                  </TableCell>
                  <TableCell rowSpan={2} align="right">
                    Final weightage
                  </TableCell>
                  <TableCell rowSpan={2} width={48} />
                </TableRow>
                <TableRow>
                  <TableCell align="right">Achieved</TableCell>
                  <TableCell align="right">Total assigned</TableCell>
                  <TableCell align="right">Achieved</TableCell>
                  <TableCell align="right">Total assigned</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row._id || index}>
                    <TableCell sx={{ minWidth: 160 }}>
                      <TextField
                        fullWidth
                        size="small"
                        value={row.kpiArea}
                        onChange={(e) => handleCell(index, 'kpiArea', e.target.value)}
                        placeholder="e.g. Interview preparation"
                        disabled={!canEditStructure}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ maxWidth: 88 }}>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, max: 100, step: 1 }}
                        value={row.weight || ''}
                        onChange={(e) => handleCell(index, 'weight', e.target.value)}
                        disabled={!canEditStructure}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ maxWidth: 88 }}>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, step: 1 }}
                        value={row.employeeAchieved === 0 ? '' : row.employeeAchieved}
                        onChange={(e) => handleCell(index, 'employeeAchieved', e.target.value)}
                        disabled={!canEditEmployeeCols}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ maxWidth: 88 }}>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, step: 1 }}
                        value={row.employeeTotalAssigned === 0 ? '' : row.employeeTotalAssigned}
                        onChange={(e) => handleCell(index, 'employeeTotalAssigned', e.target.value)}
                        disabled={!canEditEmployeeCols}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ maxWidth: 88 }}>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, step: 1 }}
                        value={row.managerAchieved === 0 ? '' : row.managerAchieved}
                        onChange={(e) => handleCell(index, 'managerAchieved', e.target.value)}
                        disabled={!canEditReportingLineFields}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ maxWidth: 88 }}>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ min: 0, step: 1 }}
                        value={row.managerTotalAssigned === 0 ? '' : row.managerTotalAssigned}
                        onChange={(e) => handleCell(index, 'managerTotalAssigned', e.target.value)}
                        disabled={!canEditReportingLineFields}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {row.achievementPercent}%
                      <Typography variant="caption" display="block" color="text.secondary">
                        via {row.scoringSource === 'manager' ? 'reporting line' : 'employee'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{row.score1to5}</TableCell>
                    <TableCell align="right">{row.finalWeightage}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeRow(index)}
                        aria-label="Remove row"
                        disabled={!canEditStructure}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2}>
                    <strong>Total weight: {totalWeight}%</strong>
                  </TableCell>
                  <TableCell colSpan={4} />
                  <TableCell />
                  <TableCell align="right">
                    <strong>Total KPI score</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{totalKpi}</strong>
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={addRow} disabled={!canEditStructure || (isTeamReviewPage && !sheet?._id)}>
              Add KPI row
            </Button>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || !sheet?._id}>
              {saving ? <CircularProgress size={22} /> : 'Save'}
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

export default KPIMonthlySheet;
