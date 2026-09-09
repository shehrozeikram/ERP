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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Save as SaveIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import DownloadIcon from '@mui/icons-material/Download';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import KPITabNavigation from '../../../components/HR/KPITabNavigation';
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
  canEditManagerCols: false,
  canDeleteRowsAsReportingLine: false
};

/** Employee locked the row once total assigned > 0 (achieved may be 0). */
const employeeHasEnteredMarks = (row) => (Number(row?.employeeTotalAssigned) || 0) > 0;

const canDeleteKpiRow = (row, editFlags, isHrAdminUser) => {
  if (isHrAdminUser) return true;
  if (editFlags.canDeleteRowsAsReportingLine && employeeHasEnteredMarks(row)) return true;
  if (editFlags.canEditStructure && !employeeHasEnteredMarks(row)) return true;
  return false;
};

const canEditKpiRow = (editFlags, isHrAdminUser) => {
  if (isHrAdminUser) return true;
  if (editFlags.canEditStructure || editFlags.canEditEmployeeCols || editFlags.canEditManagerCols) return true;
  return false;
};

/** Rows for multiline KPI area from content (stays tall after you finish typing). */
function kpiAreaRowCount(text, whileTyping = false) {
  const t = String(text || '');
  const lineBreaks = (t.match(/\n/g) || []).length + 1;
  const wrapped = Math.ceil(t.length / 36) || 1;
  const base = Math.max(lineBreaks, wrapped, t.trim() ? 2 : 1);
  const rows = whileTyping ? Math.max(base, 3) : base;
  return Math.min(10, rows);
}

function kpiAreaChipLabel(text) {
  const t = String(text || '').trim();
  if (!t) return 'View';
  const oneLine = t.replace(/\s+/g, ' ');
  if (oneLine.length <= 18) return oneLine;
  return `${oneLine.slice(0, 16)}…`;
}

/** Expands while typing; keeps height after blur; chip opens full text. */
function KpiAreaField({ value, onChange, disabled, label }) {
  const [focused, setFocused] = useState(false);
  const [fullTextAnchor, setFullTextAnchor] = useState(null);
  const text = value || '';
  const rows = kpiAreaRowCount(text, focused);
  const showChip = text.trim().length > 0;

  return (
    <Box sx={{ minWidth: 200, maxWidth: 320 }}>
      <TextField
        fullWidth
        multiline
        minRows={rows}
        maxRows={12}
        size="small"
        label={label}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        placeholder="e.g. Interview preparation"
        sx={{
          '& .MuiInputBase-root': { alignItems: 'flex-start', py: 0.75 },
          '& textarea': { lineHeight: 1.45 }
        }}
      />
      {showChip && (
        <Tooltip title="Click to view full KPI area text">
          <Chip
            size="small"
            variant="outlined"
            color="primary"
            label={kpiAreaChipLabel(text)}
            onClick={(e) => {
              e.stopPropagation();
              setFullTextAnchor(e.currentTarget);
            }}
            sx={{ mt: 0.75, height: 22, maxWidth: '100%', '& .MuiChip-label': { px: 1 } }}
          />
        </Tooltip>
      )}
      <Popover
        open={Boolean(fullTextAnchor)}
        anchorEl={fullTextAnchor}
        onClose={() => setFullTextAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { maxWidth: 420 } } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            KPI area (full text)
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {text.trim() || '—'}
          </Typography>
        </Box>
      </Popover>
    </Box>
  );
}

const KPIMonthlySheet = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isHrPage = location.pathname.startsWith('/hr/kpi/sheet');
  const isTeamReviewPage = location.pathname.startsWith('/profile/team-kpi-reviews');
  const isHrAdmin = HR_ADMIN_ROLES.includes(user?.role);

  const now = new Date();
  const [year, setYear] = useState(() => {
    const y = parseInt(searchParams.get('year'), 10);
    return Number.isFinite(y) ? y : now.getFullYear();
  });
  const [month, setMonth] = useState(() => {
    const m = parseInt(searchParams.get('month'), 10);
    return Number.isFinite(m) ? m : now.getMonth() + 1;
  });
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
  const [loadError, setLoadError] = useState(null);
  const [editRowIndex, setEditRowIndex] = useState(null);
  const [editRowDraft, setEditRowDraft] = useState(null);

  const targetEmployeeId = useMemo(() => {
    if (isHrPage && hrEmployeeId) return hrEmployeeId;
    if (isTeamReviewPage) return teamMemberId || null;
    if (!isHrPage && teamMemberId) return teamMemberId;
    return null;
  }, [isHrPage, hrEmployeeId, teamMemberId, isTeamReviewPage]);

  /** On your own sheet you only edit Employee columns; reporting line fills the other two (or HR picks you in the HR KPI sheet). */
  const canEditReportingLineFields = useMemo(() => {
    if (!targetEmployeeId) return false;
    return editFlags.canEditManagerCols;
  }, [targetEmployeeId, editFlags.canEditManagerCols]);

  const isOwnSheet = !targetEmployeeId;

  const canSaveSheet = useMemo(() => {
    if (saving) return false;
    if (sheet?._id) return true;
    return isOwnSheet && editFlags.canEditStructure;
  }, [saving, sheet?._id, isOwnSheet, editFlags.canEditStructure]);

  const loadHistory = useCallback(async () => {
    if (isHrPage && !hrEmployeeId) {
      setHistory([]);
      return;
    }
    try {
      const res = await fetchKpiWorksheetHistory();
      setHistory(res.data?.data || []);
    } catch {
      setHistory([]);
    }
  }, [isHrPage, hrEmployeeId]);

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
      setLoadError(null);
      setLoading(false);
      return;
    }
    if (isHrPage && !hrEmployeeId) {
      setSheet(null);
      setRows([]);
      setEditFlags(defaultFlags);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
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
      const msg = err.response?.data?.message || 'Failed to load KPI sheet';
      setLoadError(msg);
      toast.error(msg);
      setSheet(null);
      setRows([]);
      setEditFlags(defaultFlags);
    } finally {
      setLoading(false);
    }
  }, [year, month, targetEmployeeId, isTeamReviewPage, teamMemberId, isHrPage, hrEmployeeId]);

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
    const y = parseInt(searchParams.get('year'), 10);
    const m = parseInt(searchParams.get('month'), 10);
    if (Number.isFinite(y)) setYear(y);
    if (Number.isFinite(m)) setMonth(m);
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

  const groupedTeam = useMemo(() => {
    const projMap = new Map();
    (team || []).forEach((t) => {
      const projName = t.project?.name || 'Unassigned Project';
      const deptName = t.department?.name || 'Unassigned Department';

      if (!projMap.has(projName)) {
        projMap.set(projName, new Map());
      }
      const deptMap = projMap.get(projName);
      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, []);
      }
      deptMap.get(deptName).push(t);
    });

    const result = [];
    for (const [projName, deptMap] of projMap.entries()) {
      const depts = [];
      for (const [deptName, members] of deptMap.entries()) {
        // Sort members by level then name
        members.sort((a, b) => (a.level || 1) - (b.level || 1));
        depts.push({ deptName, members });
      }
      result.push({ projName, depts });
    }
    return result;
  }, [team]);

  const handleCell = (index, field, value) => {
    const next = [...rows];
    const raw = field === 'kpiArea' ? value : value === '' ? 0 : Number(value);
    next[index] = { ...next[index], [field]: field === 'kpiArea' ? String(value) : raw };
    setRows(recomputeLocal(next));
  };

  const addRow = () => setRows((r) => recomputeLocal([...r, emptyRow()]));

  const removeRow = (index) => {
    const row = rows[index];
    if (!canDeleteKpiRow(row, editFlags, isHrAdmin)) {
      if (employeeHasEnteredMarks(row)) {
        toast.error('You cannot delete this KPI after entering achieved and total assigned. Your reporting line can remove it.');
      } else {
        toast.error('Only your reporting line can remove KPI rows before you enter achieved and total assigned.');
      }
      return;
    }
    if (editRowIndex === index) {
      setEditRowIndex(null);
      setEditRowDraft(null);
    }
    setRows((r) => recomputeLocal(r.filter((_, i) => i !== index)));
  };

  const openEditRow = (index) => {
    if (!canEditKpiRow(editFlags, isHrAdmin)) {
      toast.error('You do not have permission to edit KPI rows on this sheet.');
      return;
    }
    setEditRowIndex(index);
    setEditRowDraft({ ...rows[index] });
  };

  const closeEditRow = () => {
    setEditRowIndex(null);
    setEditRowDraft(null);
  };

  const handleEditDraftField = (field, value) => {
    if (!editRowDraft) return;
    const raw = field === 'kpiArea' ? value : value === '' ? 0 : Number(value);
    const next = {
      ...editRowDraft,
      [field]: field === 'kpiArea' ? String(value) : raw
    };
    setEditRowDraft(recomputeLocal([next])[0]);
  };

  const applyEditRow = () => {
    if (editRowIndex == null || editRowDraft == null) return;
    const next = [...rows];
    next[editRowIndex] = { ...editRowDraft };
    setRows(recomputeLocal(next));
    closeEditRow();
    toast.success('KPI row updated. Click Save to store your sheet.');
  };

  const ensureSheetId = async () => {
    if (sheet?._id) return sheet._id;
    if (isHrPage && !hrEmployeeId) {
      toast.error('Select an employee before saving a KPI sheet.');
      return null;
    }
    try {
      let res;
      if (targetEmployeeId) {
        res = await fetchEmployeeKpiWorksheet(targetEmployeeId, { year, month });
      } else {
        res = await fetchMyKpiWorksheet({ year, month });
      }
      const data = res.data?.data;
      const flags = res.data?.editFlags || defaultFlags;
      if (data?._id) {
        setSheet(data);
        setEditFlags(flags);
        return data._id;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create KPI sheet for this month');
    }
    return null;
  };

  const handleSave = async () => {
    const sheetId = sheet?._id || (await ensureSheetId());
    if (!sheetId) return;
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
      const res = await updateKpiWorksheet(sheetId, payload);
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

  const handleExportPDF = async () => {
    if (!rows || rows.length === 0) {
      toast.error('No KPI rows available to export.');
      return;
    }
    const input = document.getElementById('kpi-sheet-pdf-content');
    if (!input) return;

    try {
      const actionCells = input.querySelectorAll('.actions-col');
      actionCells.forEach((cell) => {
        cell.style.display = 'none';
      });

      const canvas = await html2canvas(input, { scale: 2, useCORS: true });

      actionCells.forEach((cell) => {
        cell.style.display = '';
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
      pdf.save(`KPI_Sheet_${year}_${month}.pdf`);
    } catch (err) {
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {isHrPage && <KPITabNavigation />}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" fontWeight={600}>
          {title}
        </Typography>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExportPDF}
          disabled={!rows || rows.length === 0}
        >
          Export to PDF
        </Button>
      </Box>
      {isTeamReviewPage && (
        <Alert severity={pendingReviews > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
          Pending reviews this month: <strong>{pendingReviews}</strong>
        </Alert>
      )}

      {!isHrPage && team.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  My Reporting Line Hierarchy ({team.length} subordinate{team.length > 1 ? 's' : ''})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Select a team member to review and enter <strong>reporting line</strong> scores.
                </Typography>
              </Box>
              {teamMemberId && (
                <Button size="small" variant="outlined" onClick={() => setTeamMemberId('')}>
                  {isTeamReviewPage ? 'Unselect employee' : 'Back to my sheet'}
                </Button>
              )}
            </Box>

            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {groupedTeam.map((projGroup) => (
                <Accordion key={projGroup.projName} defaultExpanded sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight={700} variant="subtitle2" color="primary.main">
                      Project: {projGroup.projName}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <Stack spacing={2}>
                      {projGroup.depts.map((deptGroup) => (
                        <Box key={deptGroup.deptName}>
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Department: {deptGroup.deptName} ({deptGroup.members.length})
                          </Typography>
                          <List dense disablePadding sx={{ mt: 0.5 }}>
                            {deptGroup.members.map((t) => {
                              const empNameStr = `${t.employee.firstName || ''} ${t.employee.lastName || ''}`.trim() || t.employee.employeeId;
                              const isSelected = teamMemberId === t.employee._id;
                              const levelText = t.level === 1 ? 'Direct Report' : `Level ${t.level} (via ${t.employee.reportingLine || 'Manager'})`;
                              const levelColor = t.level === 1 ? 'primary' : 'secondary';

                              return (
                                <ListItemButton
                                  key={t.employee._id}
                                  selected={isSelected}
                                  onClick={() => setTeamMemberId(isSelected ? '' : t.employee._id)}
                                  sx={{
                                    ml: Math.max(0, (t.level - 1) * 2),
                                    borderRadius: 1,
                                    mb: 0.5,
                                    borderLeft: isSelected ? '4px solid' : '1px solid transparent',
                                    borderColor: 'primary.main'
                                  }}
                                >
                                  <ListItemText
                                    primary={
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" fontWeight={600}>
                                          {empNameStr} ({t.employee.employeeId || '—'})
                                        </Typography>
                                        <Chip size="small" label={levelText} color={levelColor} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                      </Box>
                                    }
                                    secondary={
                                      <Typography variant="caption" color="text.secondary">
                                        Designation: {t.employee.designation || '—'} | {t.worksheet ? `Total KPI Score: ${t.worksheet.totalKPIScore ?? '—'}` : 'No sheet saved yet'}
                                      </Typography>
                                    }
                                  />
                                </ListItemButton>
                              );
                            })}
                          </List>
                        </Box>
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
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
              <MenuItem value="">Select employee…</MenuItem>
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

      {isHrPage && !hrEmployeeId && !loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {isHrAdmin
            ? 'Select an employee above to open their monthly KPI sheet.'
            : 'Open an employee from KPI Submissions, or pick one above if you have access to the employee list.'}
        </Alert>
      )}

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {!loading && targetEmployeeId && isHrPage && !canEditStructure && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Viewing <strong>{empName || 'employee'}</strong>&apos;s KPI sheet (read-only).
        </Alert>
      )}

      {!loading && targetEmployeeId && !isHrPage && !canEditStructure && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You are viewing a team member&apos;s sheet. Use <strong>Back to my sheet</strong> to add KPI areas and weights on
          your own monthly sheet. As reporting line, you can remove a KPI row only after the employee has entered achieved
          and total assigned on that row.
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <Box id="kpi-sheet-pdf-content" sx={{ p: 1 }}>
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
                  <TableCell rowSpan={2} width={88} align="center" className="actions-col">
                    Actions
                  </TableCell>
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
                    <TableCell sx={{ minWidth: 220, verticalAlign: 'top' }}>
                      <KpiAreaField
                        value={row.kpiArea}
                        onChange={(v) => handleCell(index, 'kpiArea', v)}
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
                    <TableCell align="center" className="actions-col">
                      <Box sx={{ display: 'inline-flex', gap: 0.25 }}>
                        <Tooltip title="Edit KPI row">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => openEditRow(index)}
                              aria-label="Edit row"
                              disabled={!canEditKpiRow(editFlags, isHrAdmin)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete KPI row">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeRow(index)}
                              aria-label="Remove row"
                              disabled={!canDeleteKpiRow(row, editFlags, isHrAdmin)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
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
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addRow}
              disabled={!canEditStructure || loadError || (isTeamReviewPage && !sheet?._id && !isOwnSheet)}
            >
              Add KPI row
            </Button>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={!canSaveSheet || loadError}>
              {saving ? <CircularProgress size={22} /> : 'Save'}
            </Button>
            {canEditStructure && rows.length > 0 && Math.abs(totalWeight - 100) > 0.01 && (
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                Weights must total 100% before save (current: {totalWeight}%)
              </Typography>
            )}
          </Box>

          <Dialog open={editRowIndex != null} onClose={closeEditRow} maxWidth="sm" fullWidth>
            <DialogTitle>Edit KPI row</DialogTitle>
            <DialogContent dividers>
              {editRowDraft && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
                  <KpiAreaField
                    label="KPI area"
                    value={editRowDraft.kpiArea}
                    onChange={(v) => handleEditDraftField('kpiArea', v)}
                    disabled={!editFlags.canEditStructure && !isHrAdmin}
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label="Weight %"
                    inputProps={{ min: 0, max: 100, step: 1 }}
                    value={editRowDraft.weight || ''}
                    onChange={(e) => handleEditDraftField('weight', e.target.value)}
                    disabled={!editFlags.canEditStructure && !isHrAdmin}
                  />
                  <Typography variant="subtitle2" color="text.secondary">
                    Employee
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Achieved"
                      inputProps={{ min: 0, step: 1 }}
                      value={editRowDraft.employeeAchieved === 0 ? '' : editRowDraft.employeeAchieved}
                      onChange={(e) => handleEditDraftField('employeeAchieved', e.target.value)}
                      disabled={!canEditEmployeeCols && !isHrAdmin}
                    />
                    <TextField
                      fullWidth
                      type="number"
                      label="Total assigned"
                      inputProps={{ min: 0, step: 1 }}
                      value={editRowDraft.employeeTotalAssigned === 0 ? '' : editRowDraft.employeeTotalAssigned}
                      onChange={(e) => handleEditDraftField('employeeTotalAssigned', e.target.value)}
                      disabled={!canEditEmployeeCols && !isHrAdmin}
                    />
                  </Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Reporting line
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Achieved"
                      inputProps={{ min: 0, step: 1 }}
                      value={editRowDraft.managerAchieved === 0 ? '' : editRowDraft.managerAchieved}
                      onChange={(e) => handleEditDraftField('managerAchieved', e.target.value)}
                      disabled={!canEditReportingLineFields && !isHrAdmin}
                    />
                    <TextField
                      fullWidth
                      type="number"
                      label="Total assigned"
                      inputProps={{ min: 0, step: 1 }}
                      value={editRowDraft.managerTotalAssigned === 0 ? '' : editRowDraft.managerTotalAssigned}
                      onChange={(e) => handleEditDraftField('managerTotalAssigned', e.target.value)}
                      disabled={!canEditReportingLineFields && !isHrAdmin}
                    />
                  </Box>
                  <Alert severity="info" icon={false}>
                    Achievement: {editRowDraft.achievementPercent}% · Score: {editRowDraft.score1to5} · Final weightage:{' '}
                    {editRowDraft.finalWeightage} (via{' '}
                    {editRowDraft.scoringSource === 'manager' ? 'reporting line' : 'employee'})
                  </Alert>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={closeEditRow}>Cancel</Button>
              <Button variant="contained" onClick={applyEditRow}>
                Apply
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  );
};

export default KPIMonthlySheet;
