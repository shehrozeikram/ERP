import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { fetchKpiSubmissions } from '../../../services/kpiWorksheetService';

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

const STATUS_META = {
  submitted: { label: 'Submitted', color: 'success' },
  manager_reviewed: { label: 'Manager reviewed', color: 'primary' },
  draft: { label: 'Draft', color: 'warning' },
  not_started: { label: 'Not started', color: 'default' }
};

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
};

const employeeName = (employee) =>
  [employee?.firstName, employee?.lastName].filter(Boolean).join(' ').trim() ||
  employee?.employeeId ||
  '—';

const KPISubmissionsOverview = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [projectId, setProjectId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [submittedOnly, setSubmittedOnly] = useState(true);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const now = new Date();
        const res = await fetchKpiSubmissions({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          submittedOnly: false
        });
        const filterOptions = res.data?.data?.filterOptions || {};
        setProjects(Array.isArray(filterOptions.projects) ? filterOptions.projects : []);
        setDepartments(Array.isArray(filterOptions.departments) ? filterOptions.departments : []);
      } catch {
        setProjects([]);
        setDepartments([]);
      }
    };
    loadFilters();
  }, []);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchKpiSubmissions({
        year,
        month,
        projectId: projectId || undefined,
        departmentId: departmentId || undefined,
        submittedOnly,
        search: search.trim() || undefined
      });
      setSummary(res.data?.data?.summary || null);
      setGroups(res.data?.data?.groups || []);
    } catch (err) {
      setSummary(null);
      setGroups([]);
      setError(err.response?.data?.message || 'Failed to load KPI submissions');
    } finally {
      setLoading(false);
    }
  }, [year, month, projectId, departmentId, submittedOnly, search]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const totalShown = useMemo(
    () => groups.reduce(
      (sum, group) => sum + group.departments.reduce((deptSum, dept) => deptSum + dept.employees.length, 0),
      0
    ),
    [groups]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        KPI Submissions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        View employees who have submitted monthly KPI sheets, grouped by project and department.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
            <TextField
              select
              label="Month"
              size="small"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              sx={{ minWidth: 140 }}
            >
              {MONTHS.map((item) => (
                <MenuItem key={item.v} value={item.v}>{item.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Year"
              size="small"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              sx={{ minWidth: 110 }}
            >
              {[0, 1, 2].map((offset) => {
                const y = now.getFullYear() - offset;
                return <MenuItem key={y} value={y}>{y}</MenuItem>;
              })}
            </TextField>
            <TextField
              select
              label="Project"
              size="small"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">All projects</MenuItem>
              {projects.map((project) => (
                <MenuItem key={project._id} value={project._id}>
                  {project.name || project.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Department"
              size="small"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">All departments</MenuItem>
              {departments.map((department) => (
                <MenuItem key={department._id} value={department._id}>
                  {department.name || department.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Search"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Employee, project, department"
              sx={{ minWidth: 240, flex: 1 }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={submittedOnly}
                  onChange={(e) => setSubmittedOnly(e.target.checked)}
                />
              }
              label="Show submitted only"
            />
            {summary && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Submitted: ${summary.submitted}`} color="success" variant="outlined" />
                <Chip size="small" label={`Manager reviewed: ${summary.managerReviewed}`} color="primary" variant="outlined" />
                <Chip size="small" label={`Draft: ${summary.draft}`} color="warning" variant="outlined" />
                <Chip size="small" label={`Not started: ${summary.notStarted}`} variant="outlined" />
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : totalShown === 0 ? (
        <Alert severity="info">
          No KPI records found for the selected period and filters.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {groups.map((group) => (
            <Accordion key={group.project?._id || group.project?.name} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
                  <Typography fontWeight={700}>{group.project?.name || 'Unassigned project'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {group.departments.reduce((sum, dept) => sum + dept.employees.length, 0)} employee(s)
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Stack spacing={2}>
                  {group.departments.map((dept) => (
                    <Box key={dept.department?._id || dept.department?.name}>
                      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                        {dept.department?.name || 'Unassigned department'}
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          ({dept.employees.length})
                        </Typography>
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Employee</TableCell>
                              <TableCell>Employee ID</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell align="right">Total KPI score</TableCell>
                              <TableCell align="right">Weight %</TableCell>
                              <TableCell>Last saved</TableCell>
                              <TableCell align="right">Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {dept.employees.map((row) => {
                              const statusMeta = STATUS_META[row.status] || STATUS_META.not_started;
                              return (
                                <TableRow key={row.employee?._id}>
                                  <TableCell>{employeeName(row.employee)}</TableCell>
                                  <TableCell>{row.employee?.employeeId || '—'}</TableCell>
                                  <TableCell>
                                    <Chip size="small" label={statusMeta.label} color={statusMeta.color} variant="outlined" />
                                  </TableCell>
                                  <TableCell align="right">
                                    {row.totalKPIScore != null ? Number(row.totalKPIScore).toFixed(2) : '—'}
                                  </TableCell>
                                  <TableCell align="right">
                                    {row.totalWeight != null ? Number(row.totalWeight).toFixed(0) : '—'}
                                  </TableCell>
                                  <TableCell>{formatDateTime(row.lastSavedAt)}</TableCell>
                                  <TableCell align="right">
                                    <Button
                                      component={RouterLink}
                                      to={`/hr/kpi/sheet?employeeId=${row.employee?._id}`}
                                      size="small"
                                      endIcon={<OpenInNewIcon />}
                                    >
                                      Open sheet
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default KPISubmissionsOverview;
