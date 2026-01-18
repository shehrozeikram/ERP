import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, CircularProgress,
  Avatar, useTheme, alpha, Chip, Grid, Divider
} from '@mui/material';
import {
  ExitToApp as IssueIcon, Add as AddIcon, Visibility as ViewIcon,
  Search as SearchIcon, Refresh as RefreshIcon, Close as CloseIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const GoodsIssue = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [issues, setIssues] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [formDialog, setFormDialog] = useState({ open: false });
  const [formData, setFormData] = useState({
    issueDate: new Date().toISOString().split('T')[0],
    department: 'general',
    departmentName: 'General',
    costCenter: '',
    costCenterCode: '',
    costCenterName: '',
    requestedBy: '',
    requestedByName: '',
    items: [{ inventoryItem: '', quantity: 1, notes: '' }],
    purpose: '',
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
    loadIssues();
    loadInventory();
    loadCostCenters();
  }, [page, rowsPerPage, search, departmentFilter]);

  const loadIssues = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: page + 1, limit: rowsPerPage, search, department: departmentFilter };
      const response = await api.get('/procurement/goods-issue', { params });
      if (response.data.success) {
        setIssues(response.data.data.issues);
        setTotalItems(response.data.data.pagination.totalItems);
      }
    } catch (err) {
      setError('Failed to load goods issue records');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, departmentFilter]);

  const loadInventory = async () => {
    try {
      const response = await api.get('/procurement/inventory', { params: { limit: 1000, status: 'In Stock' } });
      if (response.data.success) {
        setInventory(response.data.data.items || []);
      }
    } catch (err) {
      console.error('Error loading inventory:', err);
    }
  };

  const loadCostCenters = async () => {
    try {
      const response = await api.get('/procurement/cost-centers', { params: { limit: 1000, isActive: 'true' } });
      if (response.data.success) {
        setCostCenters(response.data.data.costCenters || []);
      }
    } catch (err) {
      console.error('Error loading cost centers:', err);
    }
  };

  const handleCreate = () => {
    setFormData({
      issueDate: new Date().toISOString().split('T')[0],
      department: 'general',
      departmentName: 'General',
      costCenter: '',
      costCenterCode: '',
      costCenterName: '',
      requestedBy: '',
      requestedByName: '',
      items: [{ inventoryItem: '', quantity: 1, notes: '' }],
      purpose: '',
      notes: ''
    });
    setFormDialog({ open: true });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await api.post('/procurement/goods-issue', formData);
      setSuccess('Goods issued successfully and inventory updated');
      setFormDialog({ open: false });
      loadIssues();
      loadInventory();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to issue goods');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { inventoryItem: '', quantity: 1, notes: '' }]
    });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const getAvailableStock = (itemId) => {
    const item = inventory.find(inv => inv._id === itemId);
    return item ? item.quantity : 0;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.error.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.warning.main, width: 56, height: 56 }}>
              <IssueIcon fontSize="large" />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.warning.main }}>
                Goods Issue
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Issue goods to departments and update inventory automatically
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadIssues}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              Issue Goods
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
            placeholder="Search by issue number, department..."
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
                <TableCell>Issue #</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Cost Center</TableCell>
                <TableCell>Requested By</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Total Qty</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} align="center"><CircularProgress /></TableCell></TableRow>
              ) : issues.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center">No records found</TableCell></TableRow>
              ) : (
                issues.map((issue) => (
                  <TableRow key={issue._id} hover>
                    <TableCell><Typography variant="body2" fontWeight="bold">{issue.issueNumber}</Typography></TableCell>
                    <TableCell>{formatDate(issue.issueDate)}</TableCell>
                    <TableCell>{issue.departmentName || departments.find(d => d.value === issue.department)?.label || issue.department}</TableCell>
                    <TableCell>{issue.costCenterName || issue.costCenter?.name || issue.costCenterCode || '-'}</TableCell>
                    <TableCell>{issue.requestedByName || issue.requestedBy?.firstName || '-'}</TableCell>
                    <TableCell>{issue.totalItems || 0}</TableCell>
                    <TableCell>{issue.totalQuantity || 0}</TableCell>
                    <TableCell><Chip label={issue.status} size="small" color={issue.status === 'Issued' ? 'success' : 'default'} /></TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => setViewDialog({ open: true, data: issue })}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
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

      {/* Create Dialog */}
      <Dialog open={formDialog.open} onClose={() => setFormDialog({ open: false })} maxWidth="md" fullWidth>
        <DialogTitle>Issue Goods</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Issue Date" type="date" value={formData.issueDate} onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Department" value={formData.department} onChange={(e) => {
                const dept = departments.find(d => d.value === e.target.value);
                setFormData({ ...formData, department: e.target.value, departmentName: dept?.label || '' });
              }}>
                {departments.map((dept) => <MenuItem key={dept.value} value={dept.value}>{dept.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Cost Center" value={formData.costCenter} onChange={(e) => {
                const cc = costCenters.find(c => c._id === e.target.value);
                setFormData({ ...formData, costCenter: e.target.value, costCenterCode: cc?.code || '', costCenterName: cc?.name || '' });
              }}>
                <MenuItem value="">Select Cost Center</MenuItem>
                {costCenters.map((cc) => <MenuItem key={cc._id} value={cc._id}>{cc.code} - {cc.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Requested By" value={formData.requestedByName} onChange={(e) => setFormData({ ...formData, requestedByName: e.target.value })} placeholder="Name of requester" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Purpose" value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} placeholder="Purpose of issue" />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">Items</Typography>
                <Button size="small" onClick={addItem}>Add Item</Button>
              </Box>
              {formData.items.map((item, index) => (
                <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={5}>
                    <TextField fullWidth select label="Inventory Item" value={item.inventoryItem} onChange={(e) => updateItem(index, 'inventoryItem', e.target.value)}>
                      <MenuItem value="">Select Item</MenuItem>
                      {inventory.map((inv) => <MenuItem key={inv._id} value={inv._id}>{inv.itemCode} - {inv.name} (Stock: {inv.quantity})</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Quantity"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      inputProps={{ min: 1, max: getAvailableStock(item.inventoryItem) }}
                      helperText={item.inventoryItem ? `Available: ${getAvailableStock(item.inventoryItem)}` : ''}
                      error={item.inventoryItem && item.quantity > getAvailableStock(item.inventoryItem)}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField fullWidth label="Notes" value={item.notes} onChange={(e) => updateItem(index, 'notes', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <IconButton onClick={() => removeItem(index)} color="error"><CloseIcon /></IconButton>
                  </Grid>
                </Grid>
              ))}
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={3} label="Notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormDialog({ open: false })}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={loading || !formData.items.some(i => i.inventoryItem)}>
            Issue Goods
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, data: null })} maxWidth="md" fullWidth>
        <DialogTitle>Goods Issue Details - {viewDialog.data?.issueNumber}</DialogTitle>
        <DialogContent>
          {viewDialog.data && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Issue Number</Typography><Typography variant="body1" fontWeight="bold">{viewDialog.data.issueNumber}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Date</Typography><Typography variant="body1">{formatDate(viewDialog.data.issueDate)}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Department</Typography><Typography variant="body1">{viewDialog.data.departmentName || departments.find(d => d.value === viewDialog.data.department)?.label || viewDialog.data.department}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Cost Center</Typography><Typography variant="body1">{viewDialog.data.costCenterName || viewDialog.data.costCenter?.name || viewDialog.data.costCenterCode || '-'}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Requested By</Typography><Typography variant="body1">{viewDialog.data.requestedByName || viewDialog.data.requestedBy?.firstName || '-'}</Typography></Grid>
              {viewDialog.data.purpose && <Grid item xs={12}><Typography variant="body2" color="textSecondary">Purpose</Typography><Typography variant="body1">{viewDialog.data.purpose}</Typography></Grid>}
              <Grid item xs={12}><Divider sx={{ my: 1 }} /><Typography variant="subtitle1" fontWeight="bold">Items ({viewDialog.data.totalItems})</Typography></Grid>
              {viewDialog.data.items?.map((item, idx) => (
                <Grid container spacing={2} key={idx} sx={{ mb: 1 }}>
                  <Grid item xs={4}><Typography variant="body2">{item.itemCode} - {item.itemName}</Typography></Grid>
                  <Grid item xs={2}><Typography variant="body2">Qty: {item.quantity} {item.unit}</Typography></Grid>
                  {item.notes && <Grid item xs={6}><Typography variant="body2" color="textSecondary">{item.notes}</Typography></Grid>}
                </Grid>
              ))}
              {viewDialog.data.notes && <Grid item xs={12}><Typography variant="body2" color="textSecondary">Notes: {viewDialog.data.notes}</Typography></Grid>}
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default GoodsIssue;
