import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, CircularProgress,
  Avatar, useTheme, alpha, Chip, Grid, Stack, Tooltip,
  ToggleButton, ToggleButtonGroup, Divider
} from '@mui/material';
import {
  AccountTree as CostCenterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FormatListBulleted as ListIcon,
  AccountTreeOutlined as TreeIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowRight as CollapseIcon,
  Business as CompanyIcon,
  LocationCity as ProjectIcon
} from '@mui/icons-material';
import api from '../../../services/api';
import { formatPKR } from '../../../utils/currency';

export default function GeneralCostCenters() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [costCenters, setCostCenters] = useState([]);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'table'
  const [expandedNodes, setExpandedNodes] = useState({});

  // Pagination for flat table
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Dropdown reference lists
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Dialog states
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', data: null, parentId: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, data: null });

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    parent: '',
    company: '',
    project: '',
    department: '',
    departmentName: '',
    location: '',
    manager: '',
    managerName: '',
    budget: 0,
    budgetPeriod: 'Annual',
    isActive: true,
    description: '',
    notes: ''
  });

  // Load Reference Data (Companies, Projects, Departments)
  const loadReferences = useCallback(async () => {
    try {
      const [compRes, projRes, deptRes] = await Promise.allSettled([
        api.get('/hr/companies'),
        api.get('/hr/projects'),
        api.get('/hr/departments')
      ]);

      if (compRes.status === 'fulfilled' && compRes.value?.data?.success) {
        setCompanies(compRes.value.data.data || []);
      }
      if (projRes.status === 'fulfilled' && projRes.value?.data?.success) {
        setProjects(projRes.value.data.data || []);
      }
      if (deptRes.status === 'fulfilled' && deptRes.value?.data?.success) {
        setDepartments(deptRes.value.data.data || []);
      }
    } catch (err) {
      console.error('Error loading reference lists:', err);
    }
  }, []);

  // Load Cost Centers
  const loadCostCenters = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        tree: 'true',
        limit: 'all',
        search: search.trim() || undefined,
        company: companyFilter || undefined,
        project: projectFilter || undefined,
        department: departmentFilter || undefined
      };

      const res = await api.get('/procurement/cost-centers', { params });
      if (res.data.success) {
        const list = res.data.data?.costCenters || [];
        setCostCenters(list);
        setTotalItems(list.length);

        // Auto-expand all top-level parents on first load
        const initExpanded = {};
        list.forEach((cc) => {
          if (!cc.parent) initExpanded[cc._id] = true;
        });
        setExpandedNodes((prev) => (Object.keys(prev).length === 0 ? initExpanded : prev));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load cost centers');
    } finally {
      setLoading(false);
    }
  }, [search, companyFilter, projectFilter, departmentFilter]);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    loadCostCenters();
  }, [loadCostCenters]);

  // Build Hierarchical Tree structure from flat costCenters list
  const costCenterTree = useMemo(() => {
    const map = {};
    const roots = [];

    costCenters.forEach((cc) => {
      map[cc._id] = { ...cc, children: [] };
    });

    costCenters.forEach((cc) => {
      const parentId = cc.parent?._id || cc.parent;
      if (parentId && map[parentId]) {
        map[parentId].children.push(map[cc._id]);
      } else {
        roots.push(map[cc._id]);
      }
    });

    return roots;
  }, [costCenters]);

  const toggleNode = (id) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all = {};
    costCenters.forEach((c) => { all[c._id] = true; });
    setExpandedNodes(all);
  };

  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Auto-fetch next incremental code
  const fetchNextCode = async (parentId = '') => {
    try {
      const res = await api.get('/procurement/cost-centers/next-code', {
        params: { parentId: parentId || undefined }
      });
      if (res.data?.success && res.data?.data?.code) {
        return res.data.data.code;
      }
    } catch (err) {
      console.error('Error generating next code:', err);
    }
    return '';
  };

  // Open Create Dialog (optionally pre-fill parent)
  const handleOpenCreate = async (parentCostCenter = null) => {
    const parentId = parentCostCenter ? (parentCostCenter._id || parentCostCenter) : '';
    const nextCode = await fetchNextCode(parentId);

    setFormData({
      code: nextCode || '',
      name: '',
      parent: parentId,
      company: parentCostCenter?.company?._id || parentCostCenter?.company || '',
      project: parentCostCenter?.project?._id || parentCostCenter?.project || '',
      department: parentCostCenter?.department?._id || parentCostCenter?.department || '',
      departmentName: parentCostCenter?.departmentName || '',
      location: parentCostCenter?.location || '',
      manager: parentCostCenter?.manager?._id || parentCostCenter?.manager || '',
      managerName: parentCostCenter?.managerName || '',
      budget: 0,
      budgetPeriod: 'Annual',
      isActive: true,
      description: '',
      notes: ''
    });
    setFormDialog({
      open: true,
      mode: 'create',
      data: null,
      parentId: parentId || null
    });
  };

  // Handle Parent Selection in Form (auto updates code if create mode)
  const handleParentSelectChange = async (selectedParentId) => {
    let nextCode = formData.code;
    const parentCC = costCenters.find((c) => String(c._id) === String(selectedParentId));
    
    if (formDialog.mode === 'create') {
      nextCode = await fetchNextCode(selectedParentId);
    }

    setFormData((prev) => ({
      ...prev,
      parent: selectedParentId,
      code: nextCode || prev.code,
      company: parentCC?.company?._id || parentCC?.company || prev.company,
      project: parentCC?.project?._id || parentCC?.project || prev.project,
      department: parentCC?.department?._id || parentCC?.department || prev.department,
      departmentName: parentCC?.departmentName || prev.departmentName,
      location: parentCC?.location || prev.location
    }));
  };

  // Open Edit Dialog
  const handleOpenEdit = (cc) => {
    setFormData({
      code: cc.code,
      name: cc.name,
      parent: cc.parent?._id || cc.parent || '',
      company: cc.company?._id || cc.company || '',
      project: cc.project?._id || cc.project || '',
      department: cc.department?._id || cc.department || '',
      departmentName: cc.department?.name || cc.departmentName || '',
      location: cc.location || '',
      manager: cc.manager?._id || cc.manager || '',
      managerName: cc.managerName || '',
      budget: cc.budget || 0,
      budgetPeriod: cc.budgetPeriod || 'Annual',
      isActive: cc.isActive !== undefined ? cc.isActive : true,
      description: cc.description || '',
      notes: cc.notes || ''
    });
    setFormDialog({ open: true, mode: 'edit', data: cc });
  };

  // Form Submit
  const handleFormSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      if (formDialog.mode === 'create') {
        await api.post('/procurement/cost-centers', formData);
        setSuccess('Cost center created successfully');
      } else {
        await api.put(`/procurement/cost-centers/${formDialog.data._id}`, formData);
        setSuccess('Cost center updated successfully');
      }
      setFormDialog({ open: false, mode: 'create', data: null, parentId: null });
      loadCostCenters();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save cost center');
    } finally {
      setLoading(false);
    }
  };

  // Delete Confirm
  const handleConfirmDelete = async () => {
    if (!deleteDialog.data) return;
    try {
      setLoading(true);
      setError('');
      await api.delete(`/procurement/cost-centers/${deleteDialog.data._id}`);
      setSuccess('Cost center deleted successfully');
      setDeleteDialog({ open: false, data: null });
      loadCostCenters();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete cost center');
    } finally {
      setLoading(false);
    }
  };

  // Render Tree Row Recursively
  const renderTreeRows = (nodes, depth = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes[node._id] !== false;

      return (
        <React.Fragment key={node._id}>
          <TableRow
            hover
            sx={{
              bgcolor: depth === 0 ? 'background.paper' : depth === 1 ? alpha(theme.palette.action.hover, 0.4) : alpha(theme.palette.action.hover, 0.8),
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) }
            }}
          >
            {/* Code */}
            <TableCell sx={{ width: '15%', fontFamily: 'monospace', fontWeight: depth === 0 ? 800 : 600 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', pl: depth * 3.5 }}>
                {hasChildren ? (
                  <IconButton size="small" onClick={() => toggleNode(node._id)} sx={{ mr: 0.5, p: 0.25 }}>
                    {isExpanded ? <ExpandIcon fontSize="small" /> : <CollapseIcon fontSize="small" />}
                  </IconButton>
                ) : (
                  <Box sx={{ width: 24, mr: 0.5, display: 'inline-block', textAlign: 'center', color: 'text.disabled' }}>
                    {depth > 0 ? '↳' : '•'}
                  </Box>
                )}
                {node.code}
              </Box>
            </TableCell>

            {/* Name & Path */}
            <TableCell sx={{ width: '28%' }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: depth === 0 ? 700 : 500, color: 'text.primary' }}>
                  {node.name}
                </Typography>
                {node.path && depth > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem' }}>
                    {node.path}
                  </Typography>
                )}
              </Box>
            </TableCell>

            {/* Company / Project */}
            <TableCell sx={{ width: '18%' }}>
              <Stack spacing={0.3}>
                {node.company && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.78rem', color: 'text.secondary' }}>
                    <CompanyIcon sx={{ fontSize: 13, color: 'info.main' }} />
                    <span>{node.company.name || node.company.companyCode}</span>
                  </Box>
                )}
                {node.project && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.78rem', color: 'text.secondary' }}>
                    <ProjectIcon sx={{ fontSize: 13, color: 'warning.main' }} />
                    <span>{node.project.name}</span>
                  </Box>
                )}
                {!node.company && !node.project && (
                  <Typography variant="caption" color="text.disabled">—</Typography>
                )}
              </Stack>
            </TableCell>

            {/* Department */}
            <TableCell sx={{ width: '14%' }}>
              <Typography variant="body2" color="text.secondary">
                {node.department?.name || node.departmentName || '—'}
              </Typography>
            </TableCell>

            {/* Budget */}
            <TableCell align="right" sx={{ width: '12%', fontWeight: 600 }}>
              {node.budget ? formatPKR(node.budget) : '—'}
            </TableCell>

            {/* Status */}
            <TableCell sx={{ width: '8%' }}>
              <Chip
                label={node.isActive ? 'Active' : 'Inactive'}
                size="small"
                color={node.isActive ? 'success' : 'default'}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </TableCell>

            {/* Actions */}
            <TableCell align="right" sx={{ width: '15%' }}>
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Tooltip title="Add Sub-Cost Center">
                  <IconButton size="small" color="primary" onClick={() => handleOpenCreate(node)}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="View Details">
                  <IconButton size="small" onClick={() => setViewDialog({ open: true, data: node })}>
                    <ViewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton size="small" color="info" onClick={() => handleOpenEdit(node)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, data: node })}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </TableCell>
          </TableRow>

          {/* Render Children if expanded */}
          {hasChildren && isExpanded && renderTreeRows(node.children, depth + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header Banner */}
      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.info.main, 0.12)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 48, height: 48, borderRadius: 2 }}>
              <CostCenterIcon fontSize="medium" />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: -0.3 }}>
                Cost Centers
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage organizational cost centers, projects, and multi-tier sub-structures (e.g. Taj Villas → Villa No 5)
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <ToggleButtonGroup
              size="small"
              value={viewMode}
              exclusive
              onChange={(_, val) => val && setViewMode(val)}
              sx={{ bgcolor: 'background.paper' }}
            >
              <ToggleButton value="tree" sx={{ px: 1.5 }}>
                <TreeIcon fontSize="small" sx={{ mr: 0.5 }} /> Tree View
              </ToggleButton>
              <ToggleButton value="table" sx={{ px: 1.5 }}>
                <ListIcon fontSize="small" sx={{ mr: 0.5 }} /> Flat List
              </ToggleButton>
            </ToggleButtonGroup>

            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadCostCenters} size="small" sx={{ bgcolor: 'background.paper' }}>
              Refresh
            </Button>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenCreate(null)} size="small">
              New Cost Center
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Alerts */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Filter Toolbar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2, bgcolor: '#ffffff' }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={6} md={3.5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search code, name, or path..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2.5}>
            <TextField
              fullWidth
              select
              size="small"
              label="Company"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <MenuItem value="">All Companies</MenuItem>
              {companies.map((c) => (
                <MenuItem key={c._id} value={c._id}>{c.name} {c.code ? `(${c.code})` : ''}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2.5}>
            <TextField
              fullWidth
              select
              size="small"
              label="Project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <MenuItem value="">All Projects</MenuItem>
              {projects.map((p) => (
                <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2.5}>
            <TextField
              fullWidth
              select
              size="small"
              label="Department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <MenuItem value="">All Departments</MenuItem>
              {departments.map((d) => (
                <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={1} sx={{ textAlign: 'right' }}>
            {viewMode === 'tree' && (
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                <Tooltip title="Expand All">
                  <Button size="small" variant="text" onClick={expandAll} sx={{ minWidth: 'auto', p: 0.5, fontSize: '0.75rem' }}>
                    Expand
                  </Button>
                </Tooltip>
                <Tooltip title="Collapse All">
                  <Button size="small" variant="text" onClick={collapseAll} sx={{ minWidth: 'auto', p: 0.5, fontSize: '0.75rem' }}>
                    Collapse
                  </Button>
                </Tooltip>
              </Stack>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content: Tree View or Flat Table View */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell sx={{ fontWeight: 700, width: '15%' }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '28%' }}>Cost Center Name / Hierarchy</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '18%' }}>Company / Project</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '14%' }}>Department</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: '12%' }}>Budget (PKR)</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '8%' }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: '15%' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Loading cost centers...</Typography>
                </TableCell>
              </TableRow>
            ) : costCenters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography variant="subtitle1" fontWeight={600} color="text.secondary">No cost centers found</Typography>
                  <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                    Click "New Cost Center" above to create your first top-level or sub-cost center.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : viewMode === 'tree' ? (
              renderTreeRows(costCenterTree)
            ) : (
              costCenters.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((cc) => (
                <TableRow key={cc._id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{cc.code}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{cc.name}</Typography>
                    {cc.path && <Typography variant="caption" color="text.secondary">{cc.path}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.2}>
                      {cc.company && <Typography variant="caption" color="text.secondary">{cc.company.name}</Typography>}
                      {cc.project && <Typography variant="caption" color="text.secondary">{cc.project.name}</Typography>}
                      {!cc.company && !cc.project && '—'}
                    </Stack>
                  </TableCell>
                  <TableCell>{cc.department?.name || cc.departmentName || '—'}</TableCell>
                  <TableCell align="right">{cc.budget ? formatPKR(cc.budget) : '—'}</TableCell>
                  <TableCell>
                    <Chip label={cc.isActive ? 'Active' : 'Inactive'} size="small" color={cc.isActive ? 'success' : 'default'} sx={{ height: 20, fontSize: '0.7rem' }} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Tooltip title="Add Sub-Cost Center">
                        <IconButton size="small" color="primary" onClick={() => handleOpenCreate(cc)}><AddIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => setViewDialog({ open: true, data: cc })}><ViewIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" color="info" onClick={() => handleOpenEdit(cc)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, data: cc })}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {viewMode === 'table' && (
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      )}

      {/* CREATE / EDIT DIALOG */}
      <Dialog
        open={formDialog.open}
        onClose={() => setFormDialog({ open: false, mode: 'create', data: null, parentId: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #e5e7eb' }}>
          {formDialog.mode === 'create'
            ? (formData.parent ? 'Add Sub-Cost Center' : 'Create Cost Center')
            : `Edit Cost Center (${formDialog.data?.code})`}
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Grid container spacing={2}>
            {/* Code */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Code *"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                disabled={formDialog.mode === 'edit'}
                placeholder="e.g. TV-001 or VILLA-5"
                required
              />
            </Grid>

            {/* Name */}
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                size="small"
                label="Cost Center Name *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Taj Villas or Villa No 5"
                required
              />
            </Grid>

            {/* Parent Cost Center */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                size="small"
                label="Parent Cost Center (Optional for Sub-centers)"
                value={formData.parent}
                onChange={(e) => handleParentSelectChange(e.target.value)}
                helperText="Select a parent cost center to nest under it (e.g. Taj Villas → Villa No 5)"
              >
                <MenuItem value="">None (Top-Level Head / Root Cost Center)</MenuItem>
                {costCenters
                  .filter((c) => formDialog.mode !== 'edit' || c._id !== formDialog.data?._id)
                  .map((c) => (
                    <MenuItem key={c._id} value={c._id}>
                      {c.level > 0 ? ' '.repeat(c.level * 3) + '↳ ' : ''}{c.code} — {c.name}
                    </MenuItem>
                  ))}
              </TextField>
            </Grid>

            {/* Company & Project */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                size="small"
                label="Company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {companies.map((comp) => (
                  <MenuItem key={comp._id} value={comp._id}>
                    {comp.name} {comp.code ? `(${comp.code})` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                size="small"
                label="Project"
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {projects.map((proj) => (
                  <MenuItem key={proj._id} value={proj._id}>
                    {proj.name} {proj.code ? `(${proj.code})` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Department & Location */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                size="small"
                label="Department"
                value={formData.department}
                onChange={(e) => {
                  const dept = departments.find((d) => (d._id || d.id) === e.target.value);
                  setFormData({ ...formData, department: e.target.value, departmentName: dept?.name || '' });
                }}
              >
                <MenuItem value="">None</MenuItem>
                {departments.map((dept) => (
                  <MenuItem key={dept._id || dept.id} value={dept._id || dept.id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Sector A, Floor 2"
              />
            </Grid>

            {/* Budget & Status */}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                size="small"
                label="Budget (PKR)"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                inputProps={{ min: 0 }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                size="small"
                label="Budget Period"
                value={formData.budgetPeriod}
                onChange={(e) => setFormData({ ...formData, budgetPeriod: e.target.value })}
              >
                <MenuItem value="Monthly">Monthly</MenuItem>
                <MenuItem value="Quarterly">Quarterly</MenuItem>
                <MenuItem value="Annual">Annual</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                size="small"
                label="Status"
                value={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' || e.target.value === true })}
              >
                <MenuItem value={true}>Active</MenuItem>
                <MenuItem value={false}>Inactive</MenuItem>
              </TextField>
            </Grid>

            {/* Description & Notes */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                size="small"
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                size="small"
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e5e7eb' }}>
          <Button onClick={() => setFormDialog({ open: false, mode: 'create', data: null, parentId: null })}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSubmit} disabled={loading || !formData.code || !formData.name}>
            {formDialog.mode === 'create' ? 'Create Cost Center' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* VIEW DIALOG */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, data: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Cost Center Details</DialogTitle>
        <DialogContent dividers>
          {viewDialog.data && (
            <Stack spacing={1.5}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Code:</Typography>
                <Typography variant="body2" fontWeight={700}>{viewDialog.data.code}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Name:</Typography>
                <Typography variant="body2" fontWeight={700}>{viewDialog.data.name}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Hierarchy Path:</Typography>
                <Typography variant="body2" color="primary.main" fontWeight={600}>{viewDialog.data.path || viewDialog.data.name}</Typography>
              </Box>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Company:</Typography>
                <Typography variant="body2">{viewDialog.data.company?.name || '—'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Project:</Typography>
                <Typography variant="body2">{viewDialog.data.project?.name || '—'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Department:</Typography>
                <Typography variant="body2">{viewDialog.data.department?.name || viewDialog.data.departmentName || '—'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Location:</Typography>
                <Typography variant="body2">{viewDialog.data.location || '—'}</Typography>
              </Box>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Budget:</Typography>
                <Typography variant="body2" fontWeight={600}>{viewDialog.data.budget ? `${formatPKR(viewDialog.data.budget)} (${viewDialog.data.budgetPeriod})` : '—'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Status:</Typography>
                <Chip label={viewDialog.data.isActive ? 'Active' : 'Inactive'} size="small" color={viewDialog.data.isActive ? 'success' : 'default'} />
              </Box>
              {viewDialog.data.description && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Description:</Typography>
                  <Typography variant="body2">{viewDialog.data.description}</Typography>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* DELETE CONFIRM DIALOG */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, data: null })}>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete Cost Center</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <b>{deleteDialog.data?.code} — {deleteDialog.data?.name}</b>?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Note: If this cost center has sub-cost centers or transactions attached, deletion will be prevented.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, data: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
