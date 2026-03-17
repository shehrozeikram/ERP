import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { AssignmentInd as AssignmentIcon, Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Rule as RuleIcon, TaskAlt as TaskIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  fetchRecoveryTaskRules,
  createRecoveryTaskRule,
  deleteRecoveryTaskRule,
  fetchSlabTargetCount
} from '../../../services/recoveryTaskAssignmentRuleService';
import {
  fetchRecoveryTasks,
  createRecoveryTask,
  updateRecoveryTask,
  deleteRecoveryTask
} from '../../../services/recoveryTaskService';
import { fetchRecoveryMembers } from '../../../services/recoveryMemberService';
import { fetchRecoveryAssignmentStats } from '../../../services/recoveryAssignmentService';

const formatAmount = (n) => {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
  return String(num);
};

const getMemberName = (rule) => {
  const emp = rule.assignedTo?.employee;
  if (!emp) return '—';
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || emp.employeeId || '—';
};

const getTaskMemberName = (task) => getMemberName(task);

const getCreatedByName = (doc) => {
  const u = doc.createdBy;
  if (!u) return '—';
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.employeeId || '—';
};

const formatAssignedDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTaskScope = (task) => {
  if (task.scopeType === 'sector') return task.sector ? `Sector: ${task.sector}` : '—';
  const min = formatAmount(task.minAmount);
  const max = task.maxAmount != null ? formatAmount(task.maxAmount) : 'above';
  return `${min} – ${max} PKR${task.sector ? ` (${task.sector})` : ''}`;
};

const formatTaskPeriod = (task) => {
  if (!task.startDate || !task.endDate) return '—';
  const s = new Date(task.startDate).toLocaleDateString();
  const e = new Date(task.endDate).toLocaleDateString();
  return `${s} – ${e}`;
};

const STATUS_LABELS = { pending: 'Pending', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' };
const ACTION_LABELS = { whatsapp: 'WhatsApp message', call: 'Call', both: 'Both' };

const getMonthYearKey = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatMonthYearLabel = (key) => {
  if (!key) return '—';
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
};

const RecoveryTaskAssignment = () => {
  const [rules, setRules] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState('rule'); // 'rule' | 'task'
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const [form, setForm] = useState({
    type: 'sector',
    assignedTo: '',
    sector: '',
    minAmount: '',
    maxAmount: '',
    action: 'both'
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    assignedTo: '',
    scopeType: 'sector',
    sector: '',
    minAmount: '',
    maxAmount: '',
    startDate: '',
    endDate: '',
    targetCount: '',
    notes: '',
    action: 'both'
  });

  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [progressForm, setProgressForm] = useState({ completedCount: '', progressPercent: '', status: '' });
  const [autoCountLoading, setAutoCountLoading] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetchRecoveryTaskRules();
      setRules(res.data?.data || []);
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to load rules', severity: 'error' });
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetchRecoveryMembers({});
      setMembers(res.data?.data || []);
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load recovery members', severity: 'error' });
    }
  }, []);

  const loadSectors = useCallback(async () => {
    try {
      const res = await fetchRecoveryAssignmentStats();
      setSectors(res.data?.data?.sectors || []);
    } catch (err) {
      setSectors([]);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetchRecoveryTasks();
      setTasks(res.data?.data || []);
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to load tasks', severity: 'error' });
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadRules(), loadMembers(), loadSectors(), loadTasks()]).finally(() => setLoading(false));
  }, [loadRules, loadMembers, loadSectors, loadTasks]);

  const handleOpenAddDialog = () => {
    const today = new Date().toISOString().slice(0, 10);
    setAddMode('rule');
    setForm({ type: 'sector', assignedTo: '', sector: '', minAmount: '', maxAmount: '', action: 'both' });
    setTaskForm({
      title: '', assignedTo: '', scopeType: 'sector', sector: '', minAmount: '', maxAmount: '',
      startDate: today, endDate: today, targetCount: '', notes: '', action: 'both'
    });
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => setAddDialogOpen(false);

  const handleSubmit = async () => {
    if (!form.assignedTo) {
      setSnackbar({ open: true, message: 'Select a recovery member', severity: 'warning' });
      return;
    }
    if (form.type === 'sector' && !form.sector?.trim()) {
      setSnackbar({ open: true, message: 'Select a sector for sector-wide assignment', severity: 'warning' });
      return;
    }
    if (form.type === 'slab') {
      const min = Number(form.minAmount);
      if (isNaN(min) || min < 0) {
        setSnackbar({ open: true, message: 'Enter a valid minimum amount (0 or more)', severity: 'warning' });
        return;
      }
    }

    try {
      setSaving(true);
      await createRecoveryTaskRule({
        type: form.type,
        assignedTo: form.assignedTo,
        sector: form.type === 'sector' ? form.sector : (form.sector || ''),
        minAmount: form.type === 'slab' ? Number(form.minAmount) : 0,
        maxAmount: form.type === 'slab' && form.maxAmount !== '' ? Number(form.maxAmount) : null,
        action: form.action || 'both'
      });
      setSnackbar({ open: true, message: 'Assignment rule added', severity: 'success' });
      handleCloseAddDialog();
      loadRules();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to add rule', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this assignment rule?')) return;
    try {
      await deleteRecoveryTaskRule(id);
      setSnackbar({ open: true, message: 'Rule removed', severity: 'success' });
      loadRules();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to remove rule', severity: 'error' });
    }
  };


  const handleSubmitTask = async () => {
    if (!taskForm.assignedTo) {
      setSnackbar({ open: true, message: 'Select a recovery member', severity: 'warning' });
      return;
    }
    if (!taskForm.startDate || !taskForm.endDate) {
      setSnackbar({ open: true, message: 'Start and end dates are required', severity: 'warning' });
      return;
    }
    if (taskForm.scopeType === 'sector' && !taskForm.sector?.trim()) {
      setSnackbar({ open: true, message: 'Select a sector for task scope', severity: 'warning' });
      return;
    }
    const start = new Date(taskForm.startDate);
    const end = new Date(taskForm.endDate);
    if (end < start) {
      setSnackbar({ open: true, message: 'End date must be on or after start date', severity: 'warning' });
      return;
    }
    try {
      setSaving(true);
      await createRecoveryTask({
        title: taskForm.title?.trim() || undefined,
        assignedTo: taskForm.assignedTo,
        scopeType: taskForm.scopeType,
        sector: taskForm.scopeType === 'sector' ? taskForm.sector : (taskForm.sector || ''),
        minAmount: taskForm.scopeType === 'slab' ? Number(taskForm.minAmount) || 0 : 0,
        maxAmount: taskForm.scopeType === 'slab' && taskForm.maxAmount !== '' ? Number(taskForm.maxAmount) : null,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        targetCount: taskForm.targetCount !== '' ? Number(taskForm.targetCount) : null,
        notes: taskForm.notes?.trim() || undefined,
        action: taskForm.action || 'both'
      });
      setSnackbar({ open: true, message: 'Task created', severity: 'success' });
      handleCloseAddDialog();
      loadTasks();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to create task', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenProgressDialog = (task) => {
    setSelectedTask(task);
    setProgressForm({
      completedCount: task.targetCount != null ? String(task.completedCount ?? 0) : '',
      progressPercent: task.targetCount == null ? String(task.progressPercent ?? 0) : '',
      status: task.status || 'pending'
    });
    setProgressDialogOpen(true);
  };

  const handleCloseProgressDialog = () => {
    setProgressDialogOpen(false);
    setSelectedTask(null);
  };

  const handleSubmitProgress = async () => {
    if (!selectedTask) return;
    const payload = { status: progressForm.status };
    if (selectedTask.targetCount != null && selectedTask.targetCount > 0) {
      const n = parseInt(progressForm.completedCount, 10);
      if (!isNaN(n) && n >= 0) payload.completedCount = n;
    } else {
      const p = parseInt(progressForm.progressPercent, 10);
      if (!isNaN(p) && p >= 0 && p <= 100) payload.progressPercent = p;
    }
    try {
      setProgressSaving(true);
      await updateRecoveryTask(selectedTask._id, payload);
      setSnackbar({ open: true, message: 'Progress updated', severity: 'success' });
      handleCloseProgressDialog();
      loadTasks();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to update progress', severity: 'error' });
    } finally {
      setProgressSaving(false);
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteRecoveryTask(id);
      setSnackbar({ open: true, message: 'Task deleted', severity: 'success' });
      loadTasks();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to delete task', severity: 'error' });
    }
  };

  const sectorRules = rules.filter((r) => r.type === 'sector');
  const slabRules = rules.filter((r) => r.type === 'slab');

  // Build a set of scope keys for tasks so we can hide
  // auto-created rules that exactly match a time-bound task's scope.
  const taskScopeKeys = new Set(
    tasks.map((t) => {
      const scopeType = t.scopeType || 'sector';
      const assignedToId = t.assignedTo?._id || t.assignedTo || '';
      const sectorVal = t.sector || '';
      const min = scopeType === 'slab' ? (t.minAmount ?? 0) : '';
      const max = scopeType === 'slab' ? (t.maxAmount ?? null) : '';
      return `${scopeType}|${assignedToId}|${sectorVal}|${min}|${max}`;
    })
  );
  const combinedRows = [
    ...sectorRules
      .filter((r) => {
        const assignedToId = r.assignedTo?._id || r.assignedTo || '';
        const key = `sector|${assignedToId}|${r.sector || ''}|||`;
        return !taskScopeKeys.has(key);
      })
      .map((r) => ({
        kind: 'rule',
        id: r._id,
        typeLabel: 'Rule (sector)',
        scope: r.sector || '—',
        member: getMemberName(r),
        action: r.action || 'both',
        period: '—',
        progress: '—',
        status: null,
        rule: r,
        monthYear: getMonthYearKey(r.createdAt) || '—',
        assignedBy: getCreatedByName(r),
        assignedDate: formatAssignedDate(r.createdAt)
      })),
    ...slabRules
      .filter((r) => {
        const assignedToId = r.assignedTo?._id || r.assignedTo || '';
        const min = r.minAmount ?? 0;
        const max = r.maxAmount ?? null;
        const key = `slab|${assignedToId}|${r.sector || ''}|${min}|${max}`;
        return !taskScopeKeys.has(key);
      })
      .map((r) => ({
        kind: 'rule',
        id: r._id,
        typeLabel: 'Rule (slab)',
        scope: `${formatAmount(r.minAmount)} – ${r.maxAmount != null ? formatAmount(r.maxAmount) : 'above'}${r.sector ? ` · ${r.sector}` : ''}`,
        member: getMemberName(r),
        action: r.action || 'both',
        period: '—',
        progress: '—',
        status: null,
        rule: r,
        monthYear: getMonthYearKey(r.createdAt) || '—',
        assignedBy: getCreatedByName(r),
        assignedDate: formatAssignedDate(r.createdAt)
      })),
    ...tasks.map((t) => ({
      kind: 'task',
      id: t._id,
      typeLabel: 'Task',
      scope: t.title ? `${t.title}${formatTaskScope(t) !== '—' ? ` · ${formatTaskScope(t)}` : ''}` : formatTaskScope(t),
      member: getTaskMemberName(t),
      action: t.action || 'both',
      period: formatTaskPeriod(t),
      progress:
        t.targetCount != null && t.targetCount > 0
          ? `${t.completedCount ?? 0}/${t.targetCount} (${t.progress ?? 0}%)`
          : `${t.progress ?? 0}%`,
      status: t.status,
      task: t,
      monthYear: getMonthYearKey(t.startDate) || '—',
      assignedBy: getCreatedByName(t),
      assignedDate: formatAssignedDate(t.createdAt)
    }))
  ];

  const rowsByMonthYear = combinedRows.reduce((acc, row) => {
    const key = row.monthYear && row.monthYear !== '—' ? row.monthYear : '_other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
  const monthYearKeys = Object.keys(rowsByMonthYear).sort((a, b) => {
    if (a === '_other') return 1;
    if (b === '_other') return -1;
    return b.localeCompare(a);
  });

  const handleAddSubmit = () => (addMode === 'rule' ? handleSubmit() : handleSubmitTask());

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" fontWeight={600}>
            Task Assignment
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddDialog} disabled={loading}>
          Add
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Manage everything here: <strong>rules</strong> (who gets which sector or balance slab — sets “Assigned to” on recovery list) and <strong>time-bound tasks</strong> (assign work for a period and track progress).
      </Alert>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Rules & tasks by month
            </Typography>
            {combinedRows.length === 0 ? (
              <Typography color="text.secondary">Nothing yet. Click <strong>Add</strong> to create an assignment rule (sector/slab → member) or a time-bound task (member + scope + dates + progress).</Typography>
            ) : (
              <Box sx={{ mt: 1 }}>
                {monthYearKeys.map((key) => {
                  const rows = rowsByMonthYear[key];
                  const label = key === '_other' ? 'Other' : formatMonthYearLabel(key);
                  const count = rows.length;
                  return (
                    <Accordion key={key} defaultExpanded={monthYearKeys.indexOf(key) === 0} disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 0, border: '1px solid', borderColor: 'divider', '& + &': { mt: 0.5 } }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'grey.50', minHeight: 48 }}>
                        <Typography fontWeight={600}>{label}</Typography>
                        <Chip size="small" label={`${count} item${count !== 1 ? 's' : ''}`} sx={{ ml: 2 }} variant="outlined" />
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 0 }}>
                        <TableContainer component={Paper} variant="outlined" square>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell><strong>Type</strong></TableCell>
                                <TableCell><strong>Scope</strong></TableCell>
                                <TableCell><strong>Assigned to</strong></TableCell>
                                <TableCell><strong>Assigned By</strong></TableCell>
                                <TableCell><strong>Assigned date</strong></TableCell>
                                <TableCell><strong>Action</strong></TableCell>
                                <TableCell><strong>Period</strong></TableCell>
                                <TableCell><strong>Target count</strong></TableCell>
                                <TableCell><strong>Progress</strong></TableCell>
                                <TableCell><strong>Status</strong></TableCell>
                                <TableCell align="right"><strong>Actions</strong></TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {rows.map((row) => (
                                <TableRow key={row.kind + row.id}>
                                  <TableCell><Chip size="small" label={row.typeLabel} variant="outlined" color={row.kind === 'task' ? 'primary' : 'default'} /></TableCell>
                                  <TableCell>{row.scope}</TableCell>
                                  <TableCell>{row.member}</TableCell>
                                  <TableCell>{row.assignedBy || '—'}</TableCell>
                                  <TableCell>{row.assignedDate || '—'}</TableCell>
                                  <TableCell>{ACTION_LABELS[row.action] || row.action || '—'}</TableCell>
                                  <TableCell>{row.period}</TableCell>
                                  <TableCell>
                                    {row.kind === 'task' && row.task?.targetCount != null
                                      ? row.task.targetCount
                                      : '—'}
                                  </TableCell>
                                  <TableCell>{row.progress}</TableCell>
                                  <TableCell>
                                    {row.kind === 'task' && row.status ? (
                                      <Chip size="small" label={STATUS_LABELS[row.status] || row.status} variant={row.status === 'completed' ? 'filled' : 'outlined'} color={row.status === 'completed' ? 'success' : 'default'} />
                                    ) : '—'}
                                  </TableCell>
                                  <TableCell align="right">
                                    {row.kind === 'task' && (
                                      <IconButton size="small" onClick={() => handleOpenProgressDialog(row.task)} title="Update progress">
                                        <EditIcon />
                                      </IconButton>
                                    )}
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => row.kind === 'rule' ? handleDelete(row.id) : handleDeleteTask(row.id)}
                                      title={row.kind === 'rule' ? 'Remove rule' : 'Delete task'}
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={addDialogOpen} onClose={handleCloseAddDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add rule or task</DialogTitle>
        <DialogContent>
          <ToggleButtonGroup
            value={addMode}
            exclusive
            onChange={(_, v) => v && setAddMode(v)}
            size="small"
            sx={{ mb: 2, mt: 1 }}
            fullWidth
          >
            <ToggleButton value="rule"><RuleIcon sx={{ mr: 0.5 }} /> Assignment rule</ToggleButton>
            <ToggleButton value="task"><TaskIcon sx={{ mr: 0.5 }} /> Time-bound task</ToggleButton>
          </ToggleButtonGroup>

          {addMode === 'rule' ? (
            <>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Type</InputLabel>
                <Select value={form.type} label="Type" onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <MenuItem value="sector">Sector-wide (full sector)</MenuItem>
                  <MenuItem value="slab">Balance slab (by due amount)</MenuItem>
                </Select>
              </FormControl>
              {form.type === 'sector' && (
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Sector</InputLabel>
                  <Select value={form.sector} label="Sector" onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}>
                    <MenuItem value="">Select sector</MenuItem>
                    {sectors.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {form.type === 'slab' && (
                <>
                  <TextField fullWidth size="small" label="Min amount (PKR)" type="number" value={form.minAmount} onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))} inputProps={{ min: 0 }} sx={{ mb: 2 }} placeholder="e.g. 0" />
                  <TextField fullWidth size="small" label="Max amount (PKR) — optional" type="number" value={form.maxAmount} onChange={(e) => setForm((f) => ({ ...f, maxAmount: e.target.value }))} inputProps={{ min: 0 }} sx={{ mb: 2 }} placeholder="e.g. 1000000" />
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Sector (optional)</InputLabel>
                    <Select value={form.sector} label="Sector (optional)" onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}>
                      <MenuItem value="">All sectors</MenuItem>
                      {sectors.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </>
              )}
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Assigned to</InputLabel>
                <Select value={form.assignedTo} label="Assigned to" onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                  <MenuItem value="">Select recovery member</MenuItem>
                  {members.filter((m) => m.isActive !== false).map((m) => (
                    <MenuItem key={m._id} value={m._id}>{m.employee ? [m.employee.firstName, m.employee.lastName].filter(Boolean).join(' ') : m.employee?.employeeId || m._id}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Action</InputLabel>
                <Select value={form.action} label="Action" onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}>
                  <MenuItem value="whatsapp">WhatsApp message</MenuItem>
                  <MenuItem value="call">Call</MenuItem>
                  <MenuItem value="both">Both</MenuItem>
                </Select>
              </FormControl>
            </>
          ) : (
            <>
              <TextField fullWidth size="small" label="Title (optional)" value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} sx={{ mb: 2 }} placeholder="e.g. Marigold 3-day drive" />
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Assigned to</InputLabel>
                <Select value={taskForm.assignedTo} label="Assigned to" onChange={(e) => setTaskForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                  <MenuItem value="">Select recovery member</MenuItem>
                  {members.filter((m) => m.isActive !== false).map((m) => (
                    <MenuItem key={m._id} value={m._id}>{m.employee ? [m.employee.firstName, m.employee.lastName].filter(Boolean).join(' ') : m.employee?.employeeId || m._id}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Scope</InputLabel>
                <Select value={taskForm.scopeType} label="Scope" onChange={(e) => setTaskForm((f) => ({ ...f, scopeType: e.target.value }))}>
                  <MenuItem value="sector">By sector</MenuItem>
                  <MenuItem value="slab">By balance slab</MenuItem>
                </Select>
              </FormControl>
              {taskForm.scopeType === 'sector' && (
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Sector</InputLabel>
                  <Select value={taskForm.sector} label="Sector" onChange={(e) => setTaskForm((f) => ({ ...f, sector: e.target.value }))}>
                    <MenuItem value="">Select sector</MenuItem>
                    {sectors.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {taskForm.scopeType === 'slab' && (
                <>
                  <TextField fullWidth size="small" label="Min amount (PKR)" type="number" value={taskForm.minAmount} onChange={(e) => setTaskForm((f) => ({ ...f, minAmount: e.target.value }))} inputProps={{ min: 0 }} sx={{ mb: 2 }} />
                  <TextField fullWidth size="small" label="Max amount (PKR) — optional" type="number" value={taskForm.maxAmount} onChange={(e) => setTaskForm((f) => ({ ...f, maxAmount: e.target.value }))} inputProps={{ min: 0 }} sx={{ mb: 2 }} />
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Sector (optional)</InputLabel>
                    <Select value={taskForm.sector} label="Sector (optional)" onChange={(e) => setTaskForm((f) => ({ ...f, sector: e.target.value }))}>
                      <MenuItem value="">All sectors</MenuItem>
                      {sectors.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </>
              )}
              <TextField fullWidth size="small" label="Start date" type="date" value={taskForm.startDate} onChange={(e) => setTaskForm((f) => ({ ...f, startDate: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
              <TextField fullWidth size="small" label="End date" type="date" value={taskForm.endDate} onChange={(e) => setTaskForm((f) => ({ ...f, endDate: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Target count (optional)"
                  type="number"
                  value={taskForm.targetCount}
                  onChange={(e) => setTaskForm((f) => ({ ...f, targetCount: e.target.value }))}
                  inputProps={{ min: 0 }}
                  placeholder="e.g. 50 contacts"
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={async () => {
                    if (taskForm.scopeType !== 'slab') return;
                    const min = Number(taskForm.minAmount);
                    if (isNaN(min) || min < 0) {
                      setSnackbar({ open: true, message: 'Enter a valid minimum amount first', severity: 'warning' });
                      return;
                    }
                    setAutoCountLoading(true);
                    try {
                      const res = await fetchSlabTargetCount({
                        sector: taskForm.sector || undefined,
                        minAmount: taskForm.minAmount,
                        maxAmount: taskForm.maxAmount
                      });
                      const count = res.data?.data?.count ?? 0;
                      setTaskForm((f) => ({ ...f, targetCount: String(count) }));
                      setSnackbar({
                        open: true,
                        message: `Target count set from Recovery Assignments: ${count}`,
                        severity: 'info'
                      });
                    } catch (err) {
                      setSnackbar({
                        open: true,
                        message: err.response?.data?.message || 'Failed to fetch target count',
                        severity: 'error'
                      });
                    } finally {
                      setAutoCountLoading(false);
                    }
                  }}
                  disabled={autoCountLoading || taskForm.scopeType !== 'slab'}
                >
                  {autoCountLoading ? <CircularProgress size={18} /> : 'Auto count'}
                </Button>
              </Box>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Action</InputLabel>
                <Select value={taskForm.action} label="Action" onChange={(e) => setTaskForm((f) => ({ ...f, action: e.target.value }))}>
                  <MenuItem value="whatsapp">WhatsApp message</MenuItem>
                  <MenuItem value="call">Call</MenuItem>
                  <MenuItem value="both">Both</MenuItem>
                </Select>
              </FormControl>
              <TextField fullWidth size="small" label="Notes (optional)" value={taskForm.notes} onChange={(e) => setTaskForm((f) => ({ ...f, notes: e.target.value }))} multiline rows={2} sx={{ mb: 1 }} />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleAddSubmit} disabled={saving}>
            {saving ? <CircularProgress size={24} /> : addMode === 'rule' ? 'Add rule' : 'Create task'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={progressDialogOpen} onClose={handleCloseProgressDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Update progress</DialogTitle>
        <DialogContent>
          {selectedTask && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {selectedTask.title || formatTaskScope(selectedTask)} · {getTaskMemberName(selectedTask)}
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select value={progressForm.status} label="Status" onChange={(e) => setProgressForm((f) => ({ ...f, status: e.target.value }))}>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
              {selectedTask.targetCount != null && selectedTask.targetCount > 0 ? (
                <TextField fullWidth size="small" label="Completed count" type="number" value={progressForm.completedCount} onChange={(e) => setProgressForm((f) => ({ ...f, completedCount: e.target.value }))} inputProps={{ min: 0, max: selectedTask.targetCount }} />
              ) : (
                <TextField fullWidth size="small" label="Progress %" type="number" value={progressForm.progressPercent} onChange={(e) => setProgressForm((f) => ({ ...f, progressPercent: e.target.value }))} inputProps={{ min: 0, max: 100 }} />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseProgressDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitProgress} disabled={progressSaving}>{progressSaving ? <CircularProgress size={24} /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RecoveryTaskAssignment;
