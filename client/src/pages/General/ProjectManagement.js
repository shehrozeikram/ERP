import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControl, Grid,
  IconButton, InputLabel, LinearProgress, MenuItem, Paper, Select,
  Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import {
  Add as AddIcon, Cancel as CancelIcon, CheckCircle as CheckIcon,
  Construction as ConstructionIcon, Delete as DeleteIcon,
  Edit as EditIcon, OpenInNew as OpenIcon, Refresh as RefreshIcon,
  TrendingUp as TrendingIcon, Visibility as ViewIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { usePagination } from '../../hooks/usePagination';
import TablePaginationWrapper from '../../components/TablePaginationWrapper';
import {
  getProjects, getProjectStats, createProject, updateProject, cancelProject, updateBudgetStatus
} from '../../services/projectManagementService';

// ─── Constants ────────────────────────────────────────────────────────────────
const BUDGET_CATEGORIES = [
  'Civil Works', 'Finishes', 'Electrical', 'Plumbing',
  'Labor', 'Consultancy', 'Materials', 'Contingency', 'Miscellaneous'
];

const PROJECT_TYPES = ['Villa', 'Apartment', 'Commercial Building', 'Infrastructure', 'Renovation', 'Other'];
const PROJECT_STATUSES = ['Draft', 'Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'];

const STATUS_COLOR = {
  Draft: 'default', Planning: 'info', Active: 'success',
  'On Hold': 'warning', Completed: 'primary', Cancelled: 'error'
};

const defaultBudgetCategories = () =>
  BUDGET_CATEGORIES.map(c => ({ category: c, estimatedAmount: 0, approvedAmount: 0 }));

const defaultForm = {
  name: '', projectType: 'Villa', description: '', society: '', sector: '',
  plotNumber: '', address: '', clientName: '', clientContact: '',
  contractValue: '',
  startDate: '', expectedEndDate: '', notes: '',
  budgetCategories: defaultBudgetCategories()
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(v || 0));

const StatCard = ({ label, value, color = 'primary.main', subtitle }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="body2" color="text.secondary" gutterBottom>{label}</Typography>
      <Typography variant="h5" fontWeight={700} color={color}>{value}</Typography>
      {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
    </CardContent>
  </Card>
);

// ─── Create / Edit Dialog ────────────────────────────────────────────────────
const ProjectFormDialog = ({ open, onClose, onSaved, editing }) => {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name || '',
          projectType: editing.projectType || 'Villa',
          description: editing.description || '',
          society: editing.society || '',
          sector: editing.sector || '',
          plotNumber: editing.plotNumber || '',
          address: editing.address || '',
          clientName: editing.clientName || '',
          clientContact: editing.clientContact || '',
          contractValue: editing.contractValue || '',
          startDate: editing.startDate ? dayjs(editing.startDate).format('YYYY-MM-DD') : '',
          expectedEndDate: editing.expectedEndDate ? dayjs(editing.expectedEndDate).format('YYYY-MM-DD') : '',
          notes: editing.notes || '',
          status: editing.status || 'Draft',
          budgetCategories: editing.budgetCategories?.length
            ? editing.budgetCategories
            : defaultBudgetCategories()
        });
      } else {
        setForm(defaultForm);
      }
      setError('');
    }
  }, [open, editing]);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const setBudget = (idx, field) => (e) => {
    setForm(prev => {
      const cats = [...prev.budgetCategories];
      cats[idx] = { ...cats[idx], [field]: Number(e.target.value) || 0 };
      return { ...prev, budgetCategories: cats };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Project name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        startDate: form.startDate || undefined,
        expectedEndDate: form.expectedEndDate || undefined
      };
      if (editing) {
        await updateProject(editing._id, payload);
      } else {
        await createProject(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const totalEstimated = form.budgetCategories.reduce((s, c) => s + (c.estimatedAmount || 0), 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <ConstructionIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            {editing ? 'Edit Project' : 'Create New Project'}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={2}>
          {/* Basic Info */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary" fontWeight={600} gutterBottom>
              Project Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} md={8}>
            <TextField fullWidth required label="Project Name" value={form.name} onChange={set('name')} />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Project Type</InputLabel>
              <Select value={form.projectType} label="Project Type" onChange={set('projectType')}>
                {PROJECT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          {editing && (
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={form.status || 'Draft'} label="Status" onChange={set('status')}>
                  {PROJECT_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Society / Project Name" value={form.society} onChange={set('society')} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Sector / Block" value={form.sector} onChange={set('sector')} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Plot Number" value={form.plotNumber} onChange={set('plotNumber')} />
          </Grid>

          <Grid item xs={12}>
            <TextField fullWidth label="Address" value={form.address} onChange={set('address')} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Client / Owner Name" value={form.clientName} onChange={set('clientName')} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Client Contact" value={form.clientContact} onChange={set('clientContact')} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth label="Contract Value (PKR)" type="number"
              value={form.contractValue} onChange={set('contractValue')}
              inputProps={{ min: 0 }}
              helperText="Total amount client pays — used for milestone billing"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Start Date" type="date" value={form.startDate}
              onChange={set('startDate')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Expected End Date" type="date" value={form.expectedEndDate}
              onChange={set('expectedEndDate')} InputLabelProps={{ shrink: true }} />
          </Grid>

          <Grid item xs={12}>
            <TextField fullWidth multiline rows={2} label="Description / Scope" value={form.description}
              onChange={set('description')} />
          </Grid>

          {/* Budget */}
          <Grid item xs={12} sx={{ mt: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" color="primary" fontWeight={600}>
                Budget Estimation by Category
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Estimated: <strong>{fmt(totalEstimated)}</strong>
              </Typography>
            </Stack>
            <Divider sx={{ mt: 1, mb: 2 }} />
          </Grid>

          {form.budgetCategories.map((cat, idx) => (
            <Grid item xs={12} sm={6} md={4} key={cat.category}>
              <TextField
                fullWidth
                label={cat.category}
                type="number"
                value={cat.estimatedAmount || ''}
                onChange={setBudget(idx, 'estimatedAmount')}
                InputProps={{ inputProps: { min: 0 } }}
                size="small"
              />
            </Grid>
          ))}

          <Grid item xs={12}>
            <TextField fullWidth multiline rows={2} label="Notes" value={form.notes} onChange={set('notes')} />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : null}>
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ProjectManagement = () => {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const pagination = usePagination({
    defaultRowsPerPage: 20,
    resetDependencies: [search, statusFilter, typeFilter]
  });

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const params = pagination.getApiParams();
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.projectType = typeFilter;
      const res = await getProjects(params);
      setProjects(res.data?.data?.projects || []);
      if (res.data?.data?.pagination) pagination.setTotal(res.data.data.pagination.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.rowsPerPage, search, statusFilter, typeFilter]);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await getProjectStats();
      setStats(res.data?.data || null);
    } catch {
      // stats are non-critical
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await cancelProject(deleteConfirm._id);
      setSuccess('Project cancelled successfully');
      setDeleteConfirm(null);
      loadProjects();
      loadStats();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel project');
    } finally {
      setDeleting(false);
    }
  };

  const handleApproveBudget = async (project) => {
    try {
      await updateBudgetStatus(project._id, 'approve');
      setSuccess('Budget approved');
      loadProjects();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve budget');
    }
  };

  const progressColor = (pct) => pct >= 80 ? 'success' : pct >= 40 ? 'warning' : 'error';

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <ConstructionIcon sx={{ fontSize: 36, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight={700}>Project Management</Typography>
            <Typography variant="body2" color="text.secondary">
              Plan, track and manage construction projects end-to-end
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => { loadProjects(); loadStats(); }} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingProject(null); setDialogOpen(true); }}>
            New Project
          </Button>
        </Stack>
      </Stack>

      {/* Alerts */}
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statsLoading ? (
          [0, 1, 2, 3].map(i => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card><CardContent><Skeleton height={80} /></CardContent></Card>
            </Grid>
          ))
        ) : stats && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard label="Total Projects" value={stats.totalProjects} color="primary.main"
                subtitle={`${stats.planning || 0} planning`} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard label="Active Projects" value={stats.active || 0} color="success.main"
                subtitle={`${stats.onHold || 0} on hold`} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard label="Completed" value={stats.completed || 0} color="info.main"
                subtitle={`${stats.draft || 0} in draft`} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard label="Total Budget" value={fmt(stats.totalBudget)}
                subtitle={`Spent: ${fmt(stats.totalSpent)}`} color="warning.main" />
            </Grid>
          </>
        )}
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <TextField fullWidth size="small" placeholder="Search by name, client, society, sector…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                  <MenuItem value="">All Statuses</MenuItem>
                  {PROJECT_STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
                  <MenuItem value="">All Types</MenuItem>
                  {PROJECT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={1}>
              <Button fullWidth size="small" variant="outlined"
                onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); }}>
                Clear
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><strong>#</strong></TableCell>
                  <TableCell><strong>Project</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Progress</strong></TableCell>
                  <TableCell><strong>Budget</strong></TableCell>
                  <TableCell><strong>Spent</strong></TableCell>
                  <TableCell><strong>Timeline</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <TableCell key={j}><Skeleton /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                      <TrendingIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1, display: 'block', mx: 'auto' }} />
                      <Typography color="text.secondary">No projects found</Typography>
                      <Button variant="outlined" startIcon={<AddIcon />} sx={{ mt: 2 }}
                        onClick={() => { setEditingProject(null); setDialogOpen(true); }}>
                        Create your first project
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => {
                    const pct = project.overallProgress || 0;
                    const budgetUsed = project.totalApprovedBudget
                      ? Math.round((project.totalActualSpent / project.totalApprovedBudget) * 100)
                      : 0;

                    return (
                      <TableRow key={project._id} hover>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                            {project.projectNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{project.name}</Typography>
                          {project.clientName && (
                            <Typography variant="caption" color="text.secondary">{project.clientName}</Typography>
                          )}
                          {project.sector && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {project.society ? `${project.society} — ` : ''}{project.sector}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{project.projectType}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={project.status} size="small" color={STATUS_COLOR[project.status] || 'default'} />
                        </TableCell>
                        <TableCell sx={{ minWidth: 130 }}>
                          <Stack spacing={0.5}>
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="caption">{pct}%</Typography>
                              {project.budgetStatus === 'Approved' && (
                                <Tooltip title={`Budget ${budgetUsed}% used`}>
                                  <Typography variant="caption" color={budgetUsed > 90 ? 'error.main' : 'text.secondary'}>
                                    💰 {budgetUsed}%
                                  </Typography>
                                </Tooltip>
                              )}
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              color={progressColor(pct)}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack>
                            <Typography variant="body2">{fmt(project.totalApprovedBudget || project.totalEstimatedCost)}</Typography>
                            <Chip
                              size="small"
                              label={project.budgetStatus}
                              color={project.budgetStatus === 'Approved' ? 'success' : project.budgetStatus === 'Submitted' ? 'warning' : 'default'}
                              sx={{ fontSize: '0.65rem', height: 18 }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color={budgetUsed > 100 ? 'error.main' : 'text.primary'}>
                            {fmt(project.totalActualSpent)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 110 }}>
                          {project.startDate && (
                            <Typography variant="caption" display="block">
                              Start: {dayjs(project.startDate).format('DD MMM YY')}
                            </Typography>
                          )}
                          {project.expectedEndDate && (
                            <Typography variant="caption" display="block" color={
                              dayjs(project.expectedEndDate).isBefore(dayjs()) && project.status === 'Active'
                                ? 'error.main' : 'text.secondary'
                            }>
                              End: {dayjs(project.expectedEndDate).format('DD MMM YY')}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="View Detail">
                              <IconButton size="small" color="primary"
                                onClick={() => navigate(`/general/project-management/${project._id}`)}>
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small"
                                onClick={() => { setEditingProject(project); setDialogOpen(true); }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {project.budgetStatus === 'Submitted' && (
                              <Tooltip title="Approve Budget">
                                <IconButton size="small" color="success"
                                  onClick={() => handleApproveBudget(project)}>
                                  <CheckIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {project.status !== 'Cancelled' && (
                              <Tooltip title="Cancel Project">
                                <IconButton size="small" color="error"
                                  onClick={() => setDeleteConfirm(project)}>
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {!loading && projects.length > 0 && (
            <TablePaginationWrapper
              page={pagination.page}
              rowsPerPage={pagination.rowsPerPage}
              total={pagination.total}
              onPageChange={pagination.handleChangePage}
              onRowsPerPageChange={pagination.handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 20, 50]}
            />
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <ProjectFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { loadProjects(); loadStats(); setSuccess(editingProject ? 'Project updated' : 'Project created'); }}
        editing={editingProject}
      />

      {/* Cancel Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel Project?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to cancel <strong>{deleteConfirm?.name}</strong>?
            This will mark the project as Cancelled and cannot be undone easily.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} disabled={deleting}>Keep Project</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}>
            {deleting ? 'Cancelling…' : 'Yes, Cancel Project'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectManagement;
