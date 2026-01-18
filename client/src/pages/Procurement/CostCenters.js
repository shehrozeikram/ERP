import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, CircularProgress,
  Avatar, useTheme, alpha, Chip, Grid, Divider
} from '@mui/material';
import {
  AccountTree as CostCenterIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Visibility as ViewIcon, Search as SearchIcon, Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';

const CostCenters = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [costCenters, setCostCenters] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    department: 'general',
    departmentName: 'General',
    location: '',
    manager: '',
    managerName: '',
    budget: 0,
    budgetPeriod: 'Annual',
    isActive: true,
    notes: ''
  });

  const departments = [
    { value: 'hr', label: 'HR' },
    { value: 'admin', label: 'Admin' },
    { value: 'procurement', label: 'Procurement' },
    { value: 'sales', label: 'Sales' },
    { value: 'finance', label: 'Finance' },
    { value: 'audit', label: 'Audit' },
    { value: 'general', label: 'General' },
    { value: 'it', label: 'IT' }
  ];

  useEffect(() => {
    loadCostCenters();
  }, [page, rowsPerPage, search, departmentFilter]);

  const loadCostCenters = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: page + 1, limit: rowsPerPage, search, department: departmentFilter };
      const response = await api.get('/procurement/cost-centers', { params });
      if (response.data.success) {
        setCostCenters(response.data.data.costCenters);
        setTotalItems(response.data.data.pagination.totalItems);
      }
    } catch (err) {
      setError('Failed to load cost centers');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, departmentFilter]);

  const handleCreate = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      department: 'general',
      departmentName: 'General',
      location: '',
      manager: '',
      managerName: '',
      budget: 0,
      budgetPeriod: 'Annual',
      isActive: true,
      notes: ''
    });
    setFormDialog({ open: true, mode: 'create', data: null });
  };

  const handleEdit = (cc) => {
    setFormData({
      code: cc.code,
      name: cc.name,
      description: cc.description || '',
      department: cc.department,
      departmentName: cc.departmentName || departments.find(d => d.value === cc.department)?.label || 'General',
      location: cc.location || '',
      manager: cc.manager?._id || '',
      managerName: cc.managerName || '',
      budget: cc.budget || 0,
      budgetPeriod: cc.budgetPeriod || 'Annual',
      isActive: cc.isActive !== undefined ? cc.isActive : true,
      notes: cc.notes || ''
    });
    setFormDialog({ open: true, mode: 'edit', data: cc });
  };

  const handleView = (cc) => {
    setViewDialog({ open: true, data: cc });
  };

  const handleDelete = (id) => {
    setDeleteDialog({ open: true, id });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      if (formDialog.mode === 'create') {
        await api.post('/procurement/cost-centers', formData);
        setSuccess('Cost center created successfully');
      } else {
        await api.put(`/procurement/cost-centers/${formDialog.data._id}`, formData);
        setSuccess('Cost center updated successfully');
      }
      setFormDialog({ open: false, mode: 'create', data: null });
      loadCostCenters();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save cost center');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/procurement/cost-centers/${deleteDialog.id}`);
      setSuccess('Cost center deleted successfully');
      setDeleteDialog({ open: false, id: null });
      loadCostCenters();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete cost center');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.info.main, width: 56, height: 56 }}>
              <CostCenterIcon fontSize="large" />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                Cost Centers
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Manage cost centers for tracking goods usage by departments
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadCostCenters}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              Add Cost Center
            </Button>
          </Box>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper>
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search by code, name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ flexGrow: 1 }}
          />
          <TextField
            size="small"
            select
            label="Department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            {departments.map((dept) => <MenuItem key={dept.value} value={dept.value}>{dept.label}</MenuItem>)}
          </TextField>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Budget</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center"><CircularProgress /></TableCell></TableRow>
              ) : costCenters.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center">No records found</TableCell></TableRow>
              ) : (
                costCenters.map((cc) => (
                  <TableRow key={cc._id} hover>
                    <TableCell><Typography variant="body2" fontWeight="bold">{cc.code}</Typography></TableCell>
                    <TableCell>{cc.name}</TableCell>
                    <TableCell>{cc.departmentName || departments.find(d => d.value === cc.department)?.label || cc.department}</TableCell>
                    <TableCell>{cc.location || '-'}</TableCell>
                    <TableCell>{cc.budget ? formatPKR(cc.budget) : '-'}</TableCell>
                    <TableCell><Chip label={cc.isActive ? 'Active' : 'Inactive'} size="small" color={cc.isActive ? 'success' : 'default'} /></TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleView(cc)}><ViewIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => handleEdit(cc)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" onClick={() => handleDelete(cc._id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      {/* Form Dialog */}
      <Dialog open={formDialog.open} onClose={() => setFormDialog({ open: false, mode: 'create', data: null })} maxWidth="md" fullWidth>
        <DialogTitle>{formDialog.mode === 'create' ? 'Create Cost Center' : 'Edit Cost Center'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Code *" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} required disabled={formDialog.mode === 'edit'} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Department *" value={formData.department} onChange={(e) => {
                const dept = departments.find(d => d.value === e.target.value);
                setFormData({ ...formData, department: e.target.value, departmentName: dept?.label || '' });
              }}>
                {departments.map((dept) => <MenuItem key={dept.value} value={dept.value}>{dept.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth type="number" label="Budget" value={formData.budget} onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })} inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Budget Period" value={formData.budgetPeriod} onChange={(e) => setFormData({ ...formData, budgetPeriod: e.target.value })}>
                <MenuItem value="Monthly">Monthly</MenuItem>
                <MenuItem value="Quarterly">Quarterly</MenuItem>
                <MenuItem value="Annual">Annual</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Status" value={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}>
                <MenuItem value={true}>Active</MenuItem>
                <MenuItem value={false}>Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={3} label="Notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormDialog({ open: false, mode: 'create', data: null })}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={loading || !formData.code || !formData.name}>
            {formDialog.mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, data: null })} maxWidth="md" fullWidth>
        <DialogTitle>Cost Center Details - {viewDialog.data?.code}</DialogTitle>
        <DialogContent>
          {viewDialog.data && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Code</Typography><Typography variant="body1" fontWeight="bold">{viewDialog.data.code}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Name</Typography><Typography variant="body1">{viewDialog.data.name}</Typography></Grid>
              {viewDialog.data.description && <Grid item xs={12}><Typography variant="body2" color="textSecondary">Description</Typography><Typography variant="body1">{viewDialog.data.description}</Typography></Grid>}
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Department</Typography><Typography variant="body1">{viewDialog.data.departmentName || departments.find(d => d.value === viewDialog.data.department)?.label || viewDialog.data.department}</Typography></Grid>
              {viewDialog.data.location && <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Location</Typography><Typography variant="body1">{viewDialog.data.location}</Typography></Grid>}
              {viewDialog.data.budget > 0 && <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Budget ({viewDialog.data.budgetPeriod})</Typography><Typography variant="body1">{formatPKR(viewDialog.data.budget)}</Typography></Grid>}
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Status</Typography><Chip label={viewDialog.data.isActive ? 'Active' : 'Inactive'} size="small" color={viewDialog.data.isActive ? 'success' : 'default'} /></Grid>
              {viewDialog.data.notes && <Grid item xs={12}><Typography variant="body2" color="textSecondary">Notes</Typography><Typography variant="body1">{viewDialog.data.notes}</Typography></Grid>}
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button></DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null })}>
        <DialogTitle>Delete Cost Center</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this cost center? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, id: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CostCenters;
