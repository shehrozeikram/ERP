import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Alert, CircularProgress,
  Avatar, useTheme, alpha, Chip, Grid, Divider, Checkbox, FormControlLabel, Radio, RadioGroup, Tooltip,
  Collapse, Stack
} from '@mui/material';
import {
  LocalShipping as ReceiveIcon, Add as AddIcon, Visibility as ViewIcon,
  Search as SearchIcon, Refresh as RefreshIcon, Close as CloseIcon, Print as PrintIcon,
  Inventory as InventoryIcon, QrCode as QrCodeIcon, LocationOn as LocationIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import api from '../../services/api';
import storeService from '../../services/storeService';
import { formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import BarcodeScanner from '../../components/Procurement/Store/BarcodeScanner';
import BarcodePrintLabel from '../../components/Procurement/Store/BarcodePrintLabel';
import LocationSelector from '../../components/Procurement/Store/LocationSelector';

const makeEmptyItem = () => ({
  inventoryItem: '', itemCode: '', itemName: '', unit: '',
  quantity: 1, quantityOrdered: null, unitPrice: '', notes: '',
  selected: true, subStore: '', location: { rack: '', shelf: '', bin: '' }
});

const formatGRNDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const days = String(x.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days}-${months[x.getMonth()]}-${x.getFullYear()}`;
};

const formatNumber = (n) => (n == null || n === '') ? '' : Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GoodsReceive = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [receives, setReceives] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [viewLoading, setViewLoading] = useState(false);
  const [formDialog, setFormDialog] = useState({ open: false });
  const [qaPassedPOs, setQaPassedPOs] = useState([]);
  const [qaPassedPOsLoading, setQaPassedPOsLoading] = useState(false);
  const [mainStores, setMainStores] = useState([]);
  const [barcodePrintOpen, setBarcodePrintOpen] = useState(false);
  const [barcodePrintItems, setBarcodePrintItems] = useState([]);
  const [savedGrnId, setSavedGrnId] = useState(null);
  const [formData, setFormData] = useState({
    receiveDate: new Date().toISOString().split('T')[0],
    supplier: '',
    supplierName: '',
    supplierAddress: '',
    purchaseOrder: '',
    poNumber: '',
    narration: '',
    prNumber: '',
    store: '',
    project: '',
    gatePassNo: '',
    currency: 'Rupees',
    discount: 0,
    otherCharges: 0,
    observation: '',
    distributionBasis: 'Quantity',
    serviceCharges: 0,
    packingCharges: 0,
    loadingCharges: 0,
    items: [{ inventoryItem: '', itemCode: '', itemName: '', unit: '', quantity: 1, quantityOrdered: null, unitPrice: '', notes: '', selected: true, subStore: '', location: { rack: '', shelf: '', bin: '' } }],
    notes: ''
  });

  useEffect(() => {
    loadReceives();
    loadInventory();
    loadSuppliers();
    loadProjects();
    loadMainStores();
  }, [page, rowsPerPage, search]);

  const loadMainStores = async () => {
    try {
      const res = await storeService.getStores({ type: 'main', activeOnly: 'true' });
      setMainStores(res.data || []);
    } catch (_) { }
  };

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
      setError('Failed to load GRN records');
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

  const loadProjects = async () => {
    try {
      const response = await api.get('/hr/projects', { params: { limit: 1000, status: 'Active' } });
      if (response.data.success) {
        setProjects(response.data.data.projects || response.data.data || []);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  };

  const prefillFormFromPO = useCallback((po) => {
    const vendor = (po.vendor && typeof po.vendor === 'object') ? po.vendor : { _id: po.vendor, name: '', address: '' };
    const addr = vendor.address || (po.shippingAddress && [po.shippingAddress.street, po.shippingAddress.city, po.shippingAddress?.country].filter(Boolean).join(', ')) || '';
    setFormData({
      receiveDate: new Date().toISOString().split('T')[0],
      supplier: vendor._id || po.vendor,
      supplierName: vendor.name || '',
      supplierAddress: addr,
      purchaseOrder: po._id,
      poNumber: po.orderNumber || '',
      narration: po.indent?.title || po.indent?.indentNumber || '',
      prNumber: '',
      store: '',        // will be selected by user as ObjectId
      gatePassNo: '',
      currency: 'Rupees',
      discount: 0,
      otherCharges: 0,
      observation: '',
      distributionBasis: 'Quantity',
      serviceCharges: 0,
      packingCharges: 0,
      loadingCharges: 0,
      items: (po.items && po.items.length)
        ? po.items.map((it) => ({
            inventoryItem: '',
            itemCode: '',
            itemName: it.description || '',
            unit: it.unit || '',
            quantity: it.quantity ?? 0,
            quantityOrdered: it.quantity ?? 0,
            unitPrice: it.unitPrice ?? '',
            notes: '',
            selected: true,
            subStore: '',
            location: { rack: '', shelf: '', bin: '' }
          }))
        : [makeEmptyItem()],
      project: '',
      notes: ''
    });
  }, []);

  useEffect(() => {
    if (!formDialog.open) return;
    let cancelled = false;
    (async () => {
      try {
        setQaPassedPOsLoading(true);
        const res = await api.get('/procurement/store/qa-list', { params: { qaStatus: 'Passed' } });
        if (!cancelled && res.data?.success && res.data?.data?.purchaseOrders) {
          setQaPassedPOs(res.data.data.purchaseOrders);
        }
      } catch (_) {
        if (!cancelled) setQaPassedPOs([]);
      } finally {
        if (!cancelled) setQaPassedPOsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [formDialog.open]);

  // When opened from Store Dashboard "Create GRN" with ?createFromPo=PO_ID: fetch PO, prefill form, open create dialog
  useEffect(() => {
    const poId = searchParams.get('createFromPo');
    if (!poId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/procurement/purchase-orders/${poId}`);
        if (cancelled || !res.data?.success || !res.data?.data) return;
        prefillFormFromPO(res.data.data);
        setFormDialog({ open: true });
        setSearchParams({});
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to load PO for GRN');
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams, prefillFormFromPO]);

  // When navigated from Procurement PO view with openGrnId: fetch GRN and open view dialog
  useEffect(() => {
    const grnId = location.state?.openGrnId;
    if (!grnId) return;
    let cancelled = false;
    (async () => {
      try {
        setViewLoading(true);
        const res = await api.get(`/procurement/goods-receive/${grnId}`);
        if (cancelled || !res.data?.success || !res.data?.data) return;
        setViewDialog({ open: true, data: res.data.data });
        navigate(location.pathname, { replace: true, state: {} });
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.message || 'Failed to load GRN');
      } finally {
        if (!cancelled) setViewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [location.state?.openGrnId, location.pathname, navigate]);

  const handleCreate = () => {
    setFormData({
      receiveDate: new Date().toISOString().split('T')[0],
      supplier: '',
      supplierName: '',
      supplierAddress: '',
      purchaseOrder: '',
      poNumber: '',
      narration: '',
      prNumber: '',
      store: '',
      project: '',
      gatePassNo: '',
      currency: 'Rupees',
      discount: 0,
      otherCharges: 0,
      observation: '',
      distributionBasis: 'Quantity',
      serviceCharges: 0,
      packingCharges: 0,
      loadingCharges: 0,
      items: [makeEmptyItem()],
      notes: ''
    });
    setSavedGrnId(null);
    setFormDialog({ open: true });
  };

  const preparedByName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}`.trim() : (user?.email || '');

  const handleSubmit = async () => {
    if (!formData.project) {
      setError('Please select a project');
      return;
    }
    const selectedItems = formData.items.filter(
      (i) => (i.selected !== false) && (Number(i.quantity) || 0) > 0
    );
    if (selectedItems.length === 0) {
      setError('Select at least one item and set quantity received');
      return;
    }
    const allFullyReceived = selectedItems.every((i) => {
      const qtyReceived = Number(i.quantity) || 0;
      const qtyOrdered = i.quantityOrdered != null ? Number(i.quantityOrdered) : null;
      return qtyOrdered == null || qtyReceived >= qtyOrdered;
    });
    const status = allFullyReceived ? 'Complete' : 'Partial';
    const payload = {
      ...formData,
      status,
      items: selectedItems.map((i) => {
        const d = getItemDisplay(i);
        return {
          inventoryItem: i.inventoryItem || undefined,
          itemCode: (i.itemCode != null && String(i.itemCode).trim() !== '') ? i.itemCode : d.itemCode || '',
          itemName: (i.itemName != null && String(i.itemName).trim() !== '') ? i.itemName : d.itemName || '',
          unit: (i.unit != null && String(i.unit).trim() !== '') ? i.unit : d.unit || '',
          quantity: Number(i.quantity) || 0,
          unitPrice: Number(i.unitPrice) || 0,
          subStore: i.subStore || undefined,
          location: i.location || {},
          notes: i.notes
        };
      }).filter((i) => (i.itemCode || i.itemName)),
      otherCharges: (Number(formData.serviceCharges) || 0) + (Number(formData.packingCharges) || 0) + (Number(formData.loadingCharges) || 0)
    };
    try {
      setLoading(true);
      const res = await api.post('/procurement/goods-receive', payload);
      const savedGrn = res.data?.data;
      setSavedGrnId(savedGrn?._id);
      setSuccess('GRN created successfully and inventory updated');
      setFormDialog({ open: false });
      loadReceives();
      loadInventory();
      // Prompt for barcode label printing
      if (savedGrn?.items?.length) {
        const labelItems = savedGrn.items.map(it => ({
          itemCode: it.itemCode,
          name: it.itemName,
          unit: it.unit,
          barcode: it.inventoryItem?.barcode || '',
          barcodeType: 'CODE128',
          location: it.location || {}
        }));
        setBarcodePrintItems(labelItems);
        setBarcodePrintOpen(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create GRN');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, makeEmptyItem()] });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'inventoryItem') {
      const inv = inventory.find((i) => i._id === value);
      if (inv) {
        newItems[index].itemCode = inv.itemCode;
        newItems[index].itemName = inv.name;
        newItems[index].unit = inv.unit;
        newItems[index].unitPrice = (newItems[index].unitPrice !== undefined && newItems[index].unitPrice !== '') ? newItems[index].unitPrice : inv.unitPrice;
      }
    }
    setFormData({ ...formData, items: newItems });
  };

  const getItemDisplay = (item) => {
    const inv = inventory.find((i) => i._id === item.inventoryItem);
    const itemCode = (item.itemCode != null && String(item.itemCode).trim() !== '') ? item.itemCode : (inv?.itemCode || '');
    const itemName = (item.itemName != null && String(item.itemName).trim() !== '') ? item.itemName : (inv?.name || '');
    const unit = (item.unit != null && String(item.unit).trim() !== '') ? item.unit : (inv?.unit || '');
    const rate = typeof item.unitPrice === 'number' ? item.unitPrice : (item.unitPrice !== '' && item.unitPrice != null ? Number(item.unitPrice) : (inv?.unitPrice || 0));
    const qtyReceived = Number(item.quantity) || 0;
    const qtyOrdered = item.quantityOrdered != null ? Number(item.quantityOrdered) : null;
    return { itemCode, itemName, unit, unitPrice: rate, qtyOrdered, qtyReceived, valueExcl: qtyReceived * rate };
  };

  const formSubtotal = formData.items.reduce((sum, item) => {
    if (item.selected === false) return sum;
    const d = getItemDisplay(item);
    return sum + (d.itemCode || d.itemName ? d.valueExcl : 0);
  }, 0);
  const serviceTotal = (Number(formData.serviceCharges) || 0) + (Number(formData.packingCharges) || 0) + (Number(formData.loadingCharges) || 0);
  const formNetAmount = formSubtotal - (Number(formData.discount) || 0) + serviceTotal;
  const formTotal = formNetAmount;

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
                GRN (Goods Received Note)
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Create and view Goods Received Notes (GRN) as per store format
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadReceives}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
              Create GRN
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
                <TableCell>GRN #</TableCell>
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
                    <TableCell><Chip label={receive.status} size="small" color={receive.status === 'Complete' || receive.status === 'Received' ? 'success' : receive.status === 'Partial' ? 'warning' : 'default'} /></TableCell>
                    <TableCell>
                      <Tooltip title="View">
                        <IconButton size="small" onClick={async () => {
                          setViewDialog({ open: true, data: receive });
                          try {
                            setViewLoading(true);
                            const res = await api.get(`/procurement/goods-receive/${receive._id}`);
                            if (res.data?.success && res.data?.data) setViewDialog((prev) => ({ ...prev, data: res.data.data }));
                          } catch (_) { /* keep list data */ } finally { setViewLoading(false); }
                        }}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sync to inventory">
                        <IconButton size="small" color="primary" onClick={async () => {
                          try {
                            await api.put(`/procurement/goods-receive/${receive._id}/sync-inventory`);
                            setSuccess(`GRN ${receive.receiveNumber} synced to inventory`);
                            loadReceives();
                            loadInventory();
                          } catch (err) {
                            setError(err.response?.data?.message || 'Sync failed');
                          }
                        }}>
                          <InventoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
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

      {/* Create Dialog - GRN layout */}
      <Dialog open={formDialog.open} onClose={() => setFormDialog({ open: false })} maxWidth="lg" fullWidth>
        <DialogTitle>Create GRN (Goods Received Note)</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Select QA-passed PO when coming from GRN tab – same prefill as Store Dashboard Create GRN */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Purchase Order (QA Passed)"
                value={formData.purchaseOrder || ''}
                onChange={async (e) => {
                  const poId = e.target.value;
                  if (!poId) return;
                  try {
                    const res = await api.get(`/procurement/purchase-orders/${poId}`);
                    if (res.data?.success && res.data?.data) prefillFormFromPO(res.data.data);
                  } catch (err) {
                    setError(err.response?.data?.message || 'Failed to load PO');
                  }
                }}
                disabled={qaPassedPOsLoading}
                helperText={qaPassedPOs.length === 0 && !qaPassedPOsLoading ? 'No QA-passed POs. Create GRN from Store Dashboard or select a PO when available.' : 'Select a QA-passed PO to prefill from (same as Store Dashboard Create GRN)'}
              >
                <MenuItem value="">Select QA-passed PO (optional)</MenuItem>
                {qaPassedPOs.map((po) => (
                  <MenuItem key={po._id} value={po._id}>
                    {po.orderNumber || po._id} – {po.vendor?.name || 'Vendor'}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {/* Two-column header like image */}
            <Grid item xs={12}><Typography variant="overline" color="textSecondary">Header details</Typography></Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Project *" value={formData.project || ''} onChange={(e) => setFormData({ ...formData, project: e.target.value })} required>
                <MenuItem value="">Select Project</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p._id} value={p._id}>{p.name} {p.projectId ? `(${p.projectId})` : ''}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Supplier" value={formData.supplier} onChange={(e) => {
                const s = suppliers.find((x) => x._id === e.target.value);
                setFormData({
                  ...formData,
                  supplier: e.target.value,
                  supplierName: s?.name || '',
                  supplierAddress: s?.address || ''
                });
              }}>
                <MenuItem value="">Select Supplier</MenuItem>
                {suppliers.map((s) => (
                  <MenuItem key={s._id} value={s._id}>{s.supplierId ? `${s.supplierId} ${s.name}` : s.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Date" type="date" value={formData.receiveDate} onChange={(e) => setFormData({ ...formData, receiveDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Address" value={formData.supplierAddress} onChange={(e) => setFormData({ ...formData, supplierAddress: e.target.value })} placeholder="Supplier address" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Currency" value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Narration" value={formData.narration} onChange={(e) => setFormData({ ...formData, narration: e.target.value })} placeholder="e.g. Indent No., Material Received for..., End user..." multiline rows={2} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="P.R No." value={formData.prNumber} onChange={(e) => setFormData({ ...formData, prNumber: e.target.value })} />
              <TextField fullWidth label="P.O No." value={formData.poNumber} onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })} sx={{ mt: 1 }} />
              <TextField
                fullWidth select label="Main Store" value={formData.store || ''} sx={{ mt: 1 }}
                onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                helperText="Select the receiving store"
              >
                <MenuItem value=""><em>— Select Store —</em></MenuItem>
                {mainStores.map(s => <MenuItem key={s._id} value={s._id}>{s.name} ({s.code})</MenuItem>)}
              </TextField>
              <TextField fullWidth label="Gate Pass No." value={formData.gatePassNo} onChange={(e) => setFormData({ ...formData, gatePassNo: e.target.value })} sx={{ mt: 1 }} />
            </Grid>
            {/* Barcode Scanner */}
            <Grid item xs={12}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="subtitle2" color="text.secondary" mb={1}>Barcode Scanner</Typography>
              <BarcodeScanner
                onItemFound={(item) => {
                  const newItems = [...formData.items];
                  const emptyIdx = newItems.findIndex(i => !i.itemCode && !i.itemName);
                  const targetIdx = emptyIdx >= 0 ? emptyIdx : newItems.length;
                  if (emptyIdx < 0) newItems.push(makeEmptyItem());
                  newItems[targetIdx] = {
                    ...newItems[targetIdx],
                    inventoryItem: item._id,
                    itemCode: item.itemCode,
                    itemName: item.name,
                    unit: item.unit,
                    unitPrice: item.unitPrice || 0,
                    quantity: 1
                  };
                  setFormData({ ...formData, items: newItems });
                  setSuccess(`Item "${item.name}" added from barcode scan`);
                }}
                onError={(msg) => setError(msg)}
              />
            </Grid>
            {/* Items table – match image: Sr.#, Product, Description, Spec Units, Qty Ordered, Qty Received, Rate, Value; select items */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">Items</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                      <TableCell padding="checkbox" sx={{ fontWeight: 'bold' }}>Select</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Sr. #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Spec Units</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Qty Ordered</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Qty Received</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Rate</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Value</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Location</TableCell>
                      <TableCell width={40} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formData.items.map((item, index) => {
                      const d = getItemDisplay(item);
                      return (
                        <TableRow key={index} hover selected={item.selected !== false}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={item.selected !== false}
                              onChange={(e) => updateItem(index, 'selected', e.target.checked)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <TextField size="small" fullWidth value={item.itemCode ?? d.itemCode ?? ''} onChange={(e) => updateItem(index, 'itemCode', e.target.value)} placeholder="Product code" sx={{ minWidth: 110 }} />
                          </TableCell>
                          <TableCell>
                            <TextField size="small" fullWidth value={item.itemName ?? d.itemName ?? ''} onChange={(e) => updateItem(index, 'itemName', e.target.value)} placeholder="Description" sx={{ minWidth: 140 }} />
                          </TableCell>
                          <TableCell>
                            <TextField size="small" fullWidth value={item.unit ?? d.unit ?? ''} onChange={(e) => updateItem(index, 'unit', e.target.value)} placeholder="Spec Units" sx={{ width: 80 }} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              {d.qtyOrdered != null ? formatNumber(d.qtyOrdered) : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <TextField size="small" type="number" value={item.quantity ?? ''} onChange={(e) => updateItem(index, 'quantity', e.target.value)} inputProps={{ min: 0, step: 0.01 }} sx={{ width: 100 }} placeholder="Received" />
                          </TableCell>
                          <TableCell align="right">
                            <TextField size="small" type="number" value={item.unitPrice ?? ''} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} inputProps={{ min: 0, step: 0.01 }} sx={{ width: 90 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ color: item.selected !== false && (d.itemCode || d.itemName) ? 'primary.main' : 'text.secondary', fontWeight: 500 }}>
                            {d.itemCode || d.itemName ? formatNumber(d.valueExcl) : '—'}
                          </TableCell>
                          <TableCell sx={{ minWidth: 200 }}>
                            <LocationSelector
                              mainStoreId={formData.store || undefined}
                              value={{ subStore: item.subStore || '', rack: item.location?.rack || '', shelf: item.location?.shelf || '', bin: item.location?.bin || '' }}
                              onChange={(loc) => {
                                const newItems = [...formData.items];
                                newItems[index] = { ...newItems[index], subStore: loc.subStore, location: { rack: loc.rack, shelf: loc.shelf, bin: loc.bin } };
                                setFormData({ ...formData, items: newItems });
                              }}
                              disabled={!formData.store}
                              size="small"
                            />
                          </TableCell>
                          <TableCell><IconButton size="small" onClick={() => removeItem(index)} color="error"><CloseIcon fontSize="small" /></IconButton></TableCell>
                        </TableRow>
                      );
                    })}
                    {formData.items.length > 0 && (
                      <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04), borderTop: 2, borderColor: 'divider' }}>
                        <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {formatNumber(formData.items.reduce((s, i) => s + (i.quantityOrdered != null ? Number(i.quantityOrdered) : 0), 0))}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {formatNumber(formData.items.reduce((s, i) => s + (i.selected !== false ? (Number(i.quantity) || 0) : 0), 0))}
                        </TableCell>
                        <TableCell />
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{formatNumber(formSubtotal)}</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            {/* Summary – Distribution Basis, Service/Packing/Loading, Total Discount, Net Total */}
            <Grid item xs={12}><Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>Distribution Basis</Typography></Grid>
            <Grid item xs={12}>
              <RadioGroup row value={formData.distributionBasis || 'Quantity'} onChange={(e) => setFormData({ ...formData, distributionBasis: e.target.value })}>
                <FormControlLabel value="Quantity" control={<Radio size="small" />} label="Quantity" />
                <FormControlLabel value="Amount" control={<Radio size="small" />} label="Amount" />
              </RadioGroup>
            </Grid>
            <Grid item xs={12}><Typography variant="subtitle2" color="textSecondary" sx={{ mt: 1 }}>Charges & Net Total</Typography></Grid>
            <Grid item xs={12} md={8}>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <TextField fullWidth size="small" label="Service Charges" type="number" value={formData.serviceCharges ?? 0} onChange={(e) => setFormData({ ...formData, serviceCharges: e.target.value })} inputProps={{ min: 0, step: 0.01 }} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField fullWidth size="small" label="Packing Charges" type="number" value={formData.packingCharges ?? 0} onChange={(e) => setFormData({ ...formData, packingCharges: e.target.value })} inputProps={{ min: 0, step: 0.01 }} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField fullWidth size="small" label="Loading Charges" type="number" value={formData.loadingCharges ?? 0} onChange={(e) => setFormData({ ...formData, loadingCharges: e.target.value })} inputProps={{ min: 0, step: 0.01 }} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <TextField fullWidth size="small" label="Total Discount" type="number" value={formData.discount ?? 0} onChange={(e) => setFormData({ ...formData, discount: e.target.value })} inputProps={{ min: 0, step: 0.01 }} />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="textSecondary">Net Total</Typography>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>{formatNumber(formTotal)}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Observation" value={formData.observation} onChange={(e) => setFormData({ ...formData, observation: e.target.value })} multiline rows={1} />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="textSecondary">Prepared By: {preparedByName || '—'}</Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Notes (internal)" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} multiline rows={1} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormDialog({ open: false })}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={loading || !formData.project || !formData.items.some((i) => (i.selected !== false) && (Number(i.quantity) || 0) > 0)}>
            Create GRN
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog - GRN document layout (Taj Residencia style) */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, data: null })} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>GRN - {viewDialog.data?.receiveNumber}</span>
          <Button startIcon={<PrintIcon />} size="small" onClick={() => window.print()} sx={{ mr: 1 }}>Print</Button>
        </DialogTitle>
        <DialogContent>
          {viewLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}
          {!viewLoading && viewDialog.data && (
            <Box id="grn-document" sx={{ pt: 1 }}>
              {/* Header: Taj Residencia / Head Office (left), Goods Received Note (center) */}
              <Grid container sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 2 }} alignItems="center">
                <Grid item xs={4}>
                  <Typography variant="h6" fontWeight="bold">Taj Residencia</Typography>
                  <Typography variant="body2" color="textSecondary">Head Office</Typography>
                </Grid>
                <Grid item xs={4} sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight="bold">Goods Received Note</Typography>
                </Grid>
                <Grid item xs={4} />
              </Grid>
              {/* Two-column: Left (No., Supplier, Address, Narration) | Right (Date, Currency, P.R No., P.O No., Store, Gate Pass No.) */}
              <Grid container spacing={3} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="textSecondary">No.</Typography>
                  <Typography variant="body1" fontWeight="bold">{viewDialog.data.receiveNumber}</Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Supplier</Typography>
                  <Typography variant="body2">{[viewDialog.data.supplier?.supplierId, viewDialog.data.supplierName || viewDialog.data.supplier?.name].filter(Boolean).join(' ') || '-'}</Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Address</Typography>
                  <Typography variant="body2">{viewDialog.data.supplierAddress || viewDialog.data.supplier?.address || '-'}</Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Narration</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{viewDialog.data.narration || '—'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="textSecondary">Date</Typography>
                  <Typography variant="body2">{formatGRNDate(viewDialog.data.receiveDate)}</Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Currency</Typography>
                  <Typography variant="body2">{viewDialog.data.currency || 'Rupees'}</Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>P.R No.</Typography>
                  <Typography variant="body2">{viewDialog.data.prNumber || '—'}</Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>P.O No.</Typography>
                  <Typography variant="body2">{viewDialog.data.poNumber || viewDialog.data.purchaseOrder?.orderNumber || '—'}</Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Store</Typography>
                  <Typography variant="body2">{viewDialog.data.store || '—'}</Typography>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Gate Pass No.</Typography>
                  <Typography variant="body2">{viewDialog.data.gatePassNo || '—'}</Typography>
                </Grid>
              </Grid>
              {/* Items table */}
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>S. No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Product Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Unit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Quantity</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Rate</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Value Excluding Sales Tax</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(viewDialog.data.items || []).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{item.itemCode || '—'}</TableCell>
                        <TableCell>{item.itemName || '—'}</TableCell>
                        <TableCell>{item.unit || '—'}</TableCell>
                        <TableCell align="right">{formatNumber(item.quantity)}</TableCell>
                        <TableCell align="right">{formatNumber(item.unitPrice)}</TableCell>
                        <TableCell align="right">{formatNumber(item.valueExcludingSalesTax ?? (item.quantity * item.unitPrice))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {/* Summary: Discount, Other Charges, Net Amount, Total (right-aligned) */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Grid container spacing={1} sx={{ maxWidth: 320 }}>
                  <Grid item xs={6}><Typography variant="body2">Discount</Typography></Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2">{formatNumber(viewDialog.data.discount)}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="body2">Other Charges</Typography></Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2">{formatNumber(viewDialog.data.otherCharges)}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="body2" fontWeight="bold">Net Amount</Typography></Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2" fontWeight="bold">{formatNumber(viewDialog.data.netAmount)}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="body2" fontWeight="bold">Total</Typography></Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2" fontWeight="bold">{formatNumber(viewDialog.data.total ?? viewDialog.data.netAmount)}</Typography></Grid>
                </Grid>
              </Box>
              {/* Footer: Observation, Prepared By */}
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="textSecondary">Observation</Typography>
              <Typography variant="body2" sx={{ minHeight: 24 }}>{viewDialog.data.observation || ' '}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 3 }}>
                <Box>
                  <Typography variant="caption" color="textSecondary">Prepared By</Typography>
                  <Typography variant="body2" fontWeight="medium">{viewDialog.data.preparedByName || (viewDialog.data.receivedBy?.firstName && viewDialog.data.receivedBy?.lastName ? `${viewDialog.data.receivedBy.firstName} ${viewDialog.data.receivedBy.lastName}` : '—')}</Typography>
                </Box>
                <Box sx={{ width: 120, height: 40, border: '1px dashed', borderColor: 'divider' }} />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<QrCodeIcon />}
            onClick={async () => {
              if (!viewDialog.data?.items) return;
              try {
                const labelItems = await Promise.all(
                  viewDialog.data.items.map(async (it) => {
                    const itemId = it.inventoryItem?._id || it.inventoryItem;
                    let barcode = it.inventoryItem?.barcode || '';
                    if (!barcode && itemId) {
                      try {
                        const res = await storeService.getItemBarcode(itemId);
                        barcode = res.data?.barcode || '';
                      } catch (_) {}
                    }
                    return {
                      itemCode: it.itemCode,
                      name: it.itemName,
                      unit: it.unit,
                      barcode,
                      barcodeType: 'CODE128',
                      location: it.location || {}
                    };
                  })
                );
                setBarcodePrintItems(labelItems);
                setBarcodePrintOpen(true);
              } catch (_) {}
            }}
          >
            Print Barcodes
          </Button>
          <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Barcode Print Label Dialog */}
      <BarcodePrintLabel
        open={barcodePrintOpen}
        onClose={() => setBarcodePrintOpen(false)}
        items={barcodePrintItems}
      />
    </Box>
  );
};

export default GoodsReceive;
