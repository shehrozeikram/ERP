import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, CircularProgress,
  Avatar, useTheme, alpha, Chip, Grid, Card, CardContent, Divider
} from '@mui/material';
import {
  LocalShipping as ReceiveIcon, Add as AddIcon, Visibility as ViewIcon,
  Search as SearchIcon, Refresh as RefreshIcon, Close as CloseIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const GoodsReceive = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [receives, setReceives] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [formDialog, setFormDialog] = useState({ open: false });
  const [formData, setFormData] = useState({
    receiveDate: new Date().toISOString().split('T')[0],
    supplier: '',
    supplierName: '',
    purchaseOrder: '',
    poNumber: '',
    items: [{ inventoryItem: '', quantity: 1, notes: '' }],
    notes: ''
  });

  useEffect(() => {
    loadReceives();
    loadInventory();
    loadSuppliers();
  }, [page, rowsPerPage, search]);

  const loadReceives = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page: page + 1, limit: rowsPerPage, search };
      const response = await api.get('/procurement/goods-receive', { params });
      if (response.data.success) {
        setReceives(response.data.data.receives);
        setTotalItems(response.data.data.pagination.totalItems);
      }
    } catch (err) {
      setError('Failed to load goods receive records');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  const loadInventory = async () => {
    try {
      const response = await api.get('/procurement/inventory', { params: { limit: 1000 } });
      if (response.data.success) {
        setInventory(response.data.data.items || []);
      }
    } catch (err) {
      console.error('Error loading inventory:', err);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await api.get('/procurement/vendors', { params: { limit: 1000 } });
      if (response.data.success) {
        setSuppliers(response.data.data.vendors || []);
      }
    } catch (err) {
      console.error('Error loading suppliers:', err);
    }
  };

  const handleCreate = () => {
    setFormData({
      receiveDate: new Date().toISOString().split('T')[0],
      supplier: '',
      supplierName: '',
      purchaseOrder: '',
      poNumber: '',
      items: [{ inventoryItem: '', quantity: 1, notes: '' }],
      notes: ''
    });
    setFormDialog({ open: true });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await api.post('/procurement/goods-receive', formData);
      setSuccess('Goods received successfully and inventory updated');
      setFormDialog({ open: false });
      loadReceives();
      loadInventory();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to receive goods');
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

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.success.main, width: 56, height: 56 }}>
              <ReceiveIcon fontSize="large" />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                Goods Receive
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Record received goods and update inventory automatically
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadReceives}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              Receive Goods
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
            placeholder="Search by receive number, supplier, PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ flexGrow: 1 }}
          />
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Receive #</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>PO Number</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Total Qty</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} align="center"><CircularProgress /></TableCell></TableRow>
              ) : receives.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center">No records found</TableCell></TableRow>
              ) : (
                receives.map((receive) => (
                  <TableRow key={receive._id} hover>
                    <TableCell><Typography variant="body2" fontWeight="bold">{receive.receiveNumber}</Typography></TableCell>
                    <TableCell>{formatDate(receive.receiveDate)}</TableCell>
                    <TableCell>{receive.supplierName || receive.supplier?.name || '-'}</TableCell>
                    <TableCell>{receive.poNumber || receive.purchaseOrder?.orderNumber || '-'}</TableCell>
                    <TableCell>{receive.totalItems || 0}</TableCell>
                    <TableCell>{receive.totalQuantity || 0}</TableCell>
                    <TableCell><Chip label={receive.status} size="small" color={receive.status === 'Received' ? 'success' : 'default'} /></TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => setViewDialog({ open: true, data: receive })}>
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
        <DialogTitle>Receive Goods</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Receive Date" type="date" value={formData.receiveDate} onChange={(e) => setFormData({ ...formData, receiveDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Supplier" value={formData.supplier} onChange={(e) => {
                const supplier = suppliers.find(s => s._id === e.target.value);
                setFormData({ ...formData, supplier: e.target.value, supplierName: supplier?.name || '' });
              }}>
                <MenuItem value="">None</MenuItem>
                {suppliers.map((s) => <MenuItem key={s._id} value={s._id}>{s.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="PO Number" value={formData.poNumber} onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })} placeholder="Optional" />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">Items</Typography>
                <Button size="small" onClick={addItem}>Add Item</Button>
              </Box>
              {formData.items.map((item, index) => (
                <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth select label="Inventory Item" value={item.inventoryItem} onChange={(e) => updateItem(index, 'inventoryItem', e.target.value)}>
                      <MenuItem value="">Select Item</MenuItem>
                      {inventory.map((inv) => <MenuItem key={inv._id} value={inv._id}>{inv.itemCode} - {inv.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField fullWidth type="number" label="Quantity" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} inputProps={{ min: 1 }} />
                  </Grid>
                  <Grid item xs={12} md={5}>
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
            Receive Goods
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, data: null })} maxWidth="md" fullWidth>
        <DialogTitle>Goods Receive Details - {viewDialog.data?.receiveNumber}</DialogTitle>
        <DialogContent>
          {viewDialog.data && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Receive Number</Typography><Typography variant="body1" fontWeight="bold">{viewDialog.data.receiveNumber}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Date</Typography><Typography variant="body1">{formatDate(viewDialog.data.receiveDate)}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">Supplier</Typography><Typography variant="body1">{viewDialog.data.supplierName || viewDialog.data.supplier?.name || '-'}</Typography></Grid>
              <Grid item xs={12} md={6}><Typography variant="body2" color="textSecondary">PO Number</Typography><Typography variant="body1">{viewDialog.data.poNumber || viewDialog.data.purchaseOrder?.orderNumber || '-'}</Typography></Grid>
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

export default GoodsReceive;
