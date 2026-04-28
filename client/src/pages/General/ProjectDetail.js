import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GanttChart from './GanttChart';
import ProjectInvoicesTab from './ProjectInvoicesTab';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControl, Grid,
  IconButton, InputLabel, LinearProgress, MenuItem, Paper, Select, Skeleton,
  Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tabs, TextField, Tooltip, Typography, Collapse
} from '@mui/material';
import {
  Add as AddIcon, ArrowBack as BackIcon, Assignment as TaskIcon,
  AttachMoney as MoneyIcon, BarChart as ChartIcon, CheckCircle as CheckIcon,
  Construction as ConstructionIcon, Delete as DeleteIcon, Edit as EditIcon,
  ExpandLess, ExpandMore, FiberManualRecord as DotIcon, Flag as FlagIcon,
  PhotoCamera as PhotoIcon, Refresh as RefreshIcon, Warning as WarnIcon,
  ShoppingCart as POIcon, Receipt as InvoiceIcon
} from '@mui/icons-material';
import { Checkbox } from '@mui/material';
import dayjs from 'dayjs';
import { getImageUrl } from '../../utils/imageService';
import {
  getProjectById, updateProject, updateBudgetStatus,
  getBOQ, addBOQItem, updateBOQItem, deleteBOQItem,
  getTasks, createTask, updateTask, deleteTask,
  getExpenses, addExpense, updateExpense, deleteExpense,
  getDPRList, submitDPR, deleteDPR,
  addMilestone, updateMilestone, deleteMilestone,
  createPOFromBOQ, getProjectPurchaseOrders,
  generateMilestoneInvoice
} from '../../services/projectManagementService';
import api from '../../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const BUDGET_CATEGORIES = [
  'Civil Works', 'Finishes', 'Electrical', 'Plumbing',
  'Labor', 'Consultancy', 'Materials', 'Contingency', 'Miscellaneous'
];

const STATUS_COLOR = {
  Draft: 'default', Planning: 'info', Active: 'success',
  'On Hold': 'warning', Completed: 'primary', Cancelled: 'error'
};

const TASK_STATUS_COLOR = {
  'Not Started': 'default', 'In Progress': 'info',
  Completed: 'success', 'On Hold': 'warning', Cancelled: 'error'
};

const MS_STATUS_COLOR = {
  Pending: 'default', 'In Progress': 'info', Completed: 'success', Delayed: 'error'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })
    .format(Number(v || 0));

const pct = (spent, total) =>
  total > 0 ? Math.min(Math.round((spent / total) * 100), 100) : 0;

// ─── Mini components ──────────────────────────────────────────────────────────
const SectionHeader = ({ title, action }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
    <Typography variant="h6" fontWeight={600}>{title}</Typography>
    {action}
  </Stack>
);

const EmptyState = ({ icon: Icon, text, action }) => (
  <Box textAlign="center" py={4}>
    {Icon && <Icon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />}
    <Typography color="text.secondary">{text}</Typography>
    {action && <Box mt={2}>{action}</Box>}
  </Box>
);

// ─── BOQ Tab ─────────────────────────────────────────────────────────────────
const BOQTab = ({ projectId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: '', unit: '', estimatedQuantity: '', estimatedUnitPrice: '',
    phase: 'General', category: '', specification: '', notes: ''
  });

  // PO creation state
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [poSaving, setPoSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [poItems, setPoItems] = useState([]);
  const [poForm, setPoForm] = useState({ vendorId: '', expectedDeliveryDate: '', deliveryAddress: '', notes: '' });

  // POs already created for this project
  const [projectPOs, setProjectPOs] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [boqRes, posRes] = await Promise.all([
        getBOQ(projectId),
        getProjectPurchaseOrders(projectId).catch(() => ({ data: { data: [] } }))
      ]);
      setData(boqRes.data?.data || null);
      setProjectPOs(posRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load BOQ');
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const toggleSelectItem = (itemId) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const openCreatePO = async () => {
    if (!selectedItems.size) return;
    setVendorsLoading(true);
    setPoDialogOpen(true);
    try {
      const res = await api.get('/procurement/vendors', { params: { status: 'Active', limit: 500 } });
      setVendors(res.data?.data?.suppliers || res.data?.data || []);
    } catch { /* leave empty */ }
    finally { setVendorsLoading(false); }

    // Pre-fill PO items from selected BOQ rows
    const allItems = data ? Object.values(data.grouped || {}).flat() : [];
    setPoItems(
      allItems
        .filter(i => selectedItems.has(i._id))
        .map(i => ({
          boqItemId: i._id,
          description: i.description,
          unit: i.unit,
          quantity: Math.max(0, (i.estimatedQuantity || 0) - (i.orderedQuantity || 0)),
          unitPrice: i.estimatedUnitPrice || 0,
          taxRate: 0,
          specification: i.specification || ''
        }))
    );
    setPoForm({ vendorId: '', expectedDeliveryDate: '', deliveryAddress: '', notes: '' });
  };

  const setPoItemField = (idx, field) => (e) => {
    setPoItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: e.target.value };
      return next;
    });
  };

  const handleSubmitPO = async () => {
    if (!poForm.vendorId) { setError('Please select a vendor'); return; }
    if (!poForm.expectedDeliveryDate) { setError('Please set expected delivery date'); return; }
    if (poItems.some(i => !i.quantity || Number(i.quantity) <= 0)) {
      setError('All items must have a quantity greater than 0'); return;
    }
    setPoSaving(true); setError('');
    try {
      const res = await createPOFromBOQ(projectId, {
        vendorId: poForm.vendorId,
        expectedDeliveryDate: poForm.expectedDeliveryDate,
        deliveryAddress: poForm.deliveryAddress,
        notes: poForm.notes,
        items: poItems.map(i => ({
          boqItemId: i.boqItemId,
          description: i.description,
          unit: i.unit,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          taxRate: Number(i.taxRate) || 0,
          specification: i.specification
        }))
      });
      setSuccess(`Purchase Order ${res.data?.data?.orderNumber || ''} created successfully`);
      setPoDialogOpen(false);
      setSelectedItems(new Set());
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create PO');
    } finally { setPoSaving(false); }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ description: '', unit: '', estimatedQuantity: '', estimatedUnitPrice: '', phase: 'General', category: '', specification: '', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      description: item.description, unit: item.unit,
      estimatedQuantity: item.estimatedQuantity, estimatedUnitPrice: item.estimatedUnitPrice,
      phase: item.phase || 'General', category: item.category || '',
      specification: item.specification || '', notes: item.notes || '',
      usedQuantity: item.usedQuantity || '', actualUnitPrice: item.actualUnitPrice || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.description) { setError('Description is required'); return; }
    setSaving(true); setError('');
    try {
      if (editItem) {
        await updateBOQItem(projectId, editItem._id, { ...form });
      } else {
        await addBOQItem(projectId, { ...form });
      }
      setSuccess(editItem ? 'Item updated' : 'Item added');
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save item');
    } finally { setSaving(false); }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Delete this BOQ item?')) return;
    try {
      await deleteBOQItem(projectId, itemId);
      setSuccess('Item deleted');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  if (loading) return <Skeleton height={200} />;

  const phases = data ? Object.keys(data.grouped || {}) : [];
  const allItems = data ? Object.values(data.grouped || {}).flat() : [];
  const poTotal = poItems.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0);

  const PO_STATUS_COLOR = { Draft: 'default', Approved: 'success', Ordered: 'primary', 'Partially Received': 'info', Received: 'success', Cancelled: 'error' };

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <SectionHeader
        title={`Bill of Quantities${selectedItems.size ? ` — ${selectedItems.size} selected` : ''}`}
        action={
          <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
            {selectedItems.size > 0 && (
              <Button size="small" startIcon={<POIcon />} onClick={openCreatePO} variant="contained" color="secondary">
                Create PO ({selectedItems.size})
              </Button>
            )}
            <Button size="small" startIcon={<RefreshIcon />} onClick={load} variant="outlined">Refresh</Button>
            <Button size="small" startIcon={<AddIcon />} onClick={openAdd} variant="contained">Add Item</Button>
          </Stack>
        }
      />

      {/* Totals summary */}
      {data && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Estimated Total', val: data.totalEstimated, color: 'primary.main' },
            { label: 'Actual Total', val: data.totalActual, color: 'warning.main' },
            { label: 'Variance', val: data.totalActual - data.totalEstimated, color: data.totalActual > data.totalEstimated ? 'error.main' : 'success.main' }
          ].map(({ label, val, color }) => (
            <Grid item xs={12} sm={4} key={label}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" fontWeight={600} color={color}>{fmt(val)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {(!data?.items?.length) ? (
        <EmptyState icon={ChartIcon} text="No BOQ items added yet"
          action={<Button variant="outlined" startIcon={<AddIcon />} onClick={openAdd}>Add First Item</Button>} />
      ) : (
        phases.map(phase => (
          <Box key={phase} sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} color="primary.main" gutterBottom>{phase}</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell padding="checkbox" />
                    <TableCell><strong>Description</strong></TableCell>
                    <TableCell><strong>Unit</strong></TableCell>
                    <TableCell align="right"><strong>Est. Qty</strong></TableCell>
                    <TableCell align="right"><strong>Est. Price</strong></TableCell>
                    <TableCell align="right"><strong>Est. Total</strong></TableCell>
                    <TableCell align="right"><strong>Ordered</strong></TableCell>
                    <TableCell align="right"><strong>Used</strong></TableCell>
                    <TableCell align="right"><strong>Variance</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.grouped[phase] || []).map(item => (
                    <TableRow key={item._id} hover selected={selectedItems.has(item._id)}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selectedItems.has(item._id)}
                          onChange={() => toggleSelectItem(item._id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.description}</Typography>
                        {item.specification && <Typography variant="caption" color="text.secondary">{item.specification}</Typography>}
                        {item.linkedPurchaseOrders?.length > 0 && (
                          <Chip size="small" icon={<POIcon />} label={`${item.linkedPurchaseOrders.length} PO`} variant="outlined" color="info" sx={{ mt: 0.5, fontSize: '0.65rem', height: 18 }} />
                        )}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell align="right">{item.estimatedQuantity?.toLocaleString()}</TableCell>
                      <TableCell align="right">{fmt(item.estimatedUnitPrice)}</TableCell>
                      <TableCell align="right"><strong>{fmt(item.estimatedTotalCost)}</strong></TableCell>
                      <TableCell align="right">
                        {item.orderedQuantity > 0
                          ? <Typography variant="body2" color="info.main">{item.orderedQuantity?.toLocaleString()}</Typography>
                          : '—'}
                      </TableCell>
                      <TableCell align="right">{item.usedQuantity?.toLocaleString() || '—'}</TableCell>
                      <TableCell align="right">
                        {item.costVariance !== 0 ? (
                          <Typography variant="body2" color={item.costVariance > 0 ? 'error.main' : 'success.main'}>
                            {item.costVariance > 0 ? '+' : ''}{fmt(item.costVariance)}
                          </Typography>
                        ) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small" onClick={() => openEdit(item)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDelete(item._id)}><DeleteIcon fontSize="small" /></IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))
      )}

      {/* Purchase Orders linked to this project */}
      {projectPOs.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Linked Purchase Orders</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><strong>PO Number</strong></TableCell>
                  <TableCell><strong>Vendor</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell align="right"><strong>Total</strong></TableCell>
                  <TableCell><strong>Expected Delivery</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectPOs.map(po => (
                  <TableRow key={po._id} hover>
                    <TableCell><Typography variant="body2" fontWeight={600}>{po.orderNumber}</Typography></TableCell>
                    <TableCell>{po.vendor?.name || '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={po.status} color={PO_STATUS_COLOR[po.status] || 'default'} />
                    </TableCell>
                    <TableCell align="right">{fmt(po.totalAmount)}</TableCell>
                    <TableCell>{po.expectedDeliveryDate ? dayjs(po.expectedDeliveryDate).format('DD MMM YYYY') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Add/Edit BOQ Item Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? 'Edit BOQ Item' : 'Add BOQ Item'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth required label="Description" value={form.description} onChange={set('description')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Phase" value={form.phase} onChange={set('phase')} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={form.category} label="Category" onChange={set('category')}>
                  <MenuItem value="">None</MenuItem>
                  {BUDGET_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth label="Unit" required value={form.unit} onChange={set('unit')} placeholder="Bags, Kg, Sq Ft…" />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth label="Est. Quantity" type="number" required value={form.estimatedQuantity} onChange={set('estimatedQuantity')} />
            </Grid>
            <Grid item xs={4}>
              <TextField fullWidth label="Est. Unit Price" type="number" required value={form.estimatedUnitPrice} onChange={set('estimatedUnitPrice')} />
            </Grid>
            {editItem && (
              <>
                <Grid item xs={4}>
                  <TextField fullWidth label="Used Quantity" type="number" value={form.usedQuantity} onChange={set('usedQuantity')} />
                </Grid>
                <Grid item xs={4}>
                  <TextField fullWidth label="Actual Unit Price" type="number" value={form.actualUnitPrice} onChange={set('actualUnitPrice')} />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <TextField fullWidth label="Specification / Notes" value={form.specification || form.notes} onChange={set('specification')} multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editItem ? 'Update' : 'Add Item'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Purchase Order Dialog */}
      <Dialog open={poDialogOpen} onClose={() => setPoDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <POIcon color="secondary" />
            <span>Create Purchase Order from BOQ</span>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Vendor / Supplier</InputLabel>
                <Select
                  value={poForm.vendorId}
                  label="Vendor / Supplier"
                  onChange={e => setPoForm(p => ({ ...p, vendorId: e.target.value }))}
                  disabled={vendorsLoading}
                >
                  {vendorsLoading
                    ? <MenuItem disabled>Loading vendors…</MenuItem>
                    : vendors.map(v => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)
                  }
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth required type="date" label="Expected Delivery Date"
                InputLabelProps={{ shrink: true }}
                value={poForm.expectedDeliveryDate}
                onChange={e => setPoForm(p => ({ ...p, expectedDeliveryDate: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth label="Delivery Address"
                value={poForm.deliveryAddress}
                onChange={e => setPoForm(p => ({ ...p, deliveryAddress: e.target.value }))}
              />
            </Grid>

            {/* Items table */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Items</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Unit</strong></TableCell>
                      <TableCell align="right" sx={{ width: 110 }}><strong>Quantity</strong></TableCell>
                      <TableCell align="right" sx={{ width: 130 }}><strong>Unit Price (PKR)</strong></TableCell>
                      <TableCell align="right"><strong>Total</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {poItems.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small" type="number" value={item.quantity}
                            onChange={setPoItemField(idx, 'quantity')}
                            inputProps={{ min: 0, style: { textAlign: 'right' } }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small" type="number" value={item.unitPrice}
                            onChange={setPoItemField(idx, 'unitPrice')}
                            inputProps={{ min: 0, style: { textAlign: 'right' } }}
                            sx={{ width: 120 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <strong>{fmt(Number(item.quantity) * Number(item.unitPrice))}</strong>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell colSpan={4} align="right"><strong>Grand Total</strong></TableCell>
                      <TableCell align="right"><strong>{fmt(poTotal)}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth label="Notes" multiline rows={2}
                value={poForm.notes}
                onChange={e => setPoForm(p => ({ ...p, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPoDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" startIcon={poSaving ? <CircularProgress size={16} /> : <POIcon />}
            onClick={handleSubmitPO} disabled={poSaving}>
            {poSaving ? 'Creating…' : 'Create Purchase Order'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Tasks Tab ────────────────────────────────────────────────────────────────
const TasksTab = ({ projectId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [parentPhase, setParentPhase] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState({ title: '', description: '', plannedStartDate: '', plannedEndDate: '', assignedTo: '', estimatedLaborCost: '', level: 0, notes: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getTasks(projectId);
      setData(res.data?.data || null);
      // Expand all phases by default
      const expanded = {};
      (res.data?.data?.tree || []).forEach(p => { expanded[p._id] = true; });
      setExpanded(expanded);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tasks');
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openAddPhase = () => {
    setEditTask(null); setParentPhase(null);
    setForm({ title: '', description: '', plannedStartDate: '', plannedEndDate: '', assignedTo: '', estimatedLaborCost: '', level: 0, notes: '' });
    setDialogOpen(true);
  };

  const openAddTask = (phase) => {
    setEditTask(null); setParentPhase(phase);
    setForm({ title: '', description: '', plannedStartDate: '', plannedEndDate: '', assignedTo: '', estimatedLaborCost: '', level: 1, notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (task) => {
    setEditTask(task); setParentPhase(null);
    setForm({
      title: task.title, description: task.description || '', level: task.level,
      plannedStartDate: task.plannedStartDate ? dayjs(task.plannedStartDate).format('YYYY-MM-DD') : '',
      plannedEndDate: task.plannedEndDate ? dayjs(task.plannedEndDate).format('YYYY-MM-DD') : '',
      assignedTo: task.assignedTo || '', estimatedLaborCost: task.estimatedLaborCost || '',
      progressPercent: task.progressPercent || 0, status: task.status, notes: task.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        plannedStartDate: form.plannedStartDate || undefined,
        plannedEndDate: form.plannedEndDate || undefined,
        parentTask: parentPhase?._id || undefined
      };
      if (editTask) {
        await updateTask(projectId, editTask._id, payload);
      } else {
        await createTask(projectId, payload);
      }
      setSuccess(editTask ? 'Task updated' : 'Task created');
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save task');
    } finally { setSaving(false); }
  };

  const handleProgressChange = async (task, value) => {
    try {
      await updateTask(projectId, task._id, { progressPercent: Number(value) });
      load();
    } catch { /* silent */ }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task and all subtasks?')) return;
    try {
      await deleteTask(projectId, taskId);
      setSuccess('Task deleted');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  if (loading) return <Skeleton height={300} />;

  const tree = data?.tree || [];

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <SectionHeader
        title="Work Breakdown Structure"
        action={
          <Stack direction="row" gap={1}>
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openAddPhase}>Add Phase</Button>
          </Stack>
        }
      />

      {!tree.length ? (
        <EmptyState icon={TaskIcon} text="No phases or tasks yet. Start by adding a phase."
          action={<Button variant="outlined" startIcon={<AddIcon />} onClick={openAddPhase}>Add Phase</Button>} />
      ) : (
        tree.map(phase => (
          <Card key={phase._id} variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ pb: 1 }}>
              {/* Phase header */}
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" gap={1}>
                  <IconButton size="small" onClick={() => setExpanded(prev => ({ ...prev, [phase._id]: !prev[phase._id] }))}>
                    {expanded[phase._id] ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                  <Typography variant="subtitle1" fontWeight={700}>{phase.title}</Typography>
                  <Chip label={phase.status} size="small" color={TASK_STATUS_COLOR[phase.status] || 'default'} />
                </Stack>
                <Stack direction="row" gap={0.5}>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => openAddTask(phase)}>Add Task</Button>
                  <IconButton size="small" onClick={() => openEdit(phase)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(phase._id)}><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              </Stack>

              {/* Phase timeline */}
              {(phase.plannedStartDate || phase.plannedEndDate) && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 5 }}>
                  {phase.plannedStartDate ? dayjs(phase.plannedStartDate).format('DD MMM') : '—'}
                  {' → '}
                  {phase.plannedEndDate ? dayjs(phase.plannedEndDate).format('DD MMM YYYY') : '—'}
                </Typography>
              )}

              {/* Tasks */}
              <Collapse in={expanded[phase._id] !== false} timeout="auto">
                {phase.children?.length > 0 && (
                  <TableContainer sx={{ mt: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Task</strong></TableCell>
                          <TableCell><strong>Assigned To</strong></TableCell>
                          <TableCell><strong>Planned Dates</strong></TableCell>
                          <TableCell><strong>Status</strong></TableCell>
                          <TableCell sx={{ width: 160 }}><strong>Progress</strong></TableCell>
                          <TableCell align="right"><strong>Actions</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {phase.children.map(task => (
                          <TableRow key={task._id} hover>
                            <TableCell>
                              <Stack direction="row" alignItems="center" gap={0.5}>
                                <DotIcon sx={{ fontSize: 8, color: 'grey.400' }} />
                                <Typography variant="body2">{task.title}</Typography>
                              </Stack>
                              {task.description && (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                                  {task.description}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{task.assignedTo || '—'}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">
                                {task.plannedStartDate ? dayjs(task.plannedStartDate).format('DD MMM') : '—'}
                                {' → '}
                                {task.plannedEndDate ? dayjs(task.plannedEndDate).format('DD MMM') : '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={task.status} size="small" color={TASK_STATUS_COLOR[task.status] || 'default'} />
                            </TableCell>
                            <TableCell>
                              <Stack spacing={0.5}>
                                <Stack direction="row" justifyContent="space-between">
                                  <Typography variant="caption">{task.progressPercent}%</Typography>
                                </Stack>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={task.progressPercent}
                                  onChange={(e) => handleProgressChange(task, e.target.value)}
                                  InputProps={{ inputProps: { min: 0, max: 100 }, sx: { py: 0.5, fontSize: '0.75rem' } }}
                                  sx={{ width: 70, display: 'inline-block' }}
                                />
                                <LinearProgress
                                  variant="determinate"
                                  value={task.progressPercent || 0}
                                  color={task.progressPercent === 100 ? 'success' : task.progressPercent > 0 ? 'info' : 'inherit'}
                                  sx={{ height: 4, borderRadius: 2 }}
                                />
                              </Stack>
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <IconButton size="small" onClick={() => openEdit(task)}><EditIcon fontSize="small" /></IconButton>
                                <IconButton size="small" color="error" onClick={() => handleDelete(task._id)}><DeleteIcon fontSize="small" /></IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
                {!phase.children?.length && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 5, mt: 1, display: 'block' }}>
                    No tasks in this phase.{' '}
                    <Box component="span" sx={{ cursor: 'pointer', color: 'primary.main' }} onClick={() => openAddTask(phase)}>
                      Add a task
                    </Box>
                  </Typography>
                )}
              </Collapse>
            </CardContent>
          </Card>
        ))
      )}

      {/* Task Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editTask ? `Edit: ${editTask.title}` : parentPhase ? `Add Task to "${parentPhase.title}"` : 'Add Phase'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth required label="Title" value={form.title} onChange={set('title')} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" value={form.description} onChange={set('description')} multiline rows={2} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="date" label="Planned Start" value={form.plannedStartDate}
                onChange={set('plannedStartDate')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="date" label="Planned End" value={form.plannedEndDate}
                onChange={set('plannedEndDate')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Assigned To (Contractor)" value={form.assignedTo} onChange={set('assignedTo')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Est. Labor Cost" type="number" value={form.estimatedLaborCost} onChange={set('estimatedLaborCost')} />
            </Grid>
            {editTask && (
              <>
                <Grid item xs={6}>
                  <TextField fullWidth label="Progress %" type="number" value={form.progressPercent}
                    onChange={set('progressPercent')} InputProps={{ inputProps: { min: 0, max: 100 } }} />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select value={form.status || 'Not Started'} label="Status" onChange={set('status')}>
                      {['Not Started', 'In Progress', 'Completed', 'On Hold', 'Cancelled'].map(s =>
                        <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editTask ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Expenses Tab ─────────────────────────────────────────────────────────────
const ExpensesTab = ({ projectId, project }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: '', description: '', amount: '', expenseDate: dayjs().format('YYYY-MM-DD'),
    vendor: '', invoiceNumber: '', paymentStatus: 'Pending', paymentMethod: 'Bank Transfer', notes: ''
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getExpenses(projectId);
      setData(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load expenses');
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditExpense(null);
    setForm({ category: '', description: '', amount: '', expenseDate: dayjs().format('YYYY-MM-DD'), vendor: '', invoiceNumber: '', paymentStatus: 'Pending', paymentMethod: 'Bank Transfer', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (exp) => {
    setEditExpense(exp);
    setForm({
      category: exp.category, description: exp.description,
      amount: exp.amount, expenseDate: dayjs(exp.expenseDate).format('YYYY-MM-DD'),
      vendor: exp.vendor || '', invoiceNumber: exp.invoiceNumber || '',
      paymentStatus: exp.paymentStatus, paymentMethod: exp.paymentMethod || 'Bank Transfer',
      notes: exp.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.category) { setError('Category is required'); return; }
    if (!form.description) { setError('Description is required'); return; }
    if (!form.amount) { setError('Amount is required'); return; }
    setSaving(true); setError('');
    try {
      if (editExpense) {
        await updateExpense(projectId, editExpense._id, form);
      } else {
        await addExpense(projectId, form);
      }
      setSuccess(editExpense ? 'Expense updated' : 'Expense recorded');
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save expense');
    } finally { setSaving(false); }
  };

  const handleDelete = async (expId) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await deleteExpense(projectId, expId);
      setSuccess('Expense deleted');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  // Build budget vs actual per category
  const budgetByCategory = (project?.budgetCategories || []).reduce((acc, c) => {
    acc[c.category] = c.approvedAmount || c.estimatedAmount || 0;
    return acc;
  }, {});

  const spentByCategory = (data?.summary || []).reduce((acc, s) => {
    acc[s._id] = s.total;
    return acc;
  }, {});

  if (loading) return <Skeleton height={300} />;

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <SectionHeader
        title="Project Expenses"
        action={
          <Stack direction="row" gap={1}>
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Record Expense</Button>
          </Stack>
        }
      />

      {/* Budget vs Actual by category */}
      {Object.keys(budgetByCategory).length > 0 && (
        <Card variant="outlined" sx={{ mb: 3, p: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>Budget vs Actual by Category</Typography>
          <Grid container spacing={1}>
            {BUDGET_CATEGORIES.filter(c => budgetByCategory[c] > 0 || spentByCategory[c] > 0).map(cat => {
              const budget = budgetByCategory[cat] || 0;
              const spent = spentByCategory[cat] || 0;
              const utilPct = pct(spent, budget);
              return (
                <Grid item xs={12} sm={6} md={4} key={cat}>
                  <Box>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" fontWeight={500}>{cat}</Typography>
                      <Typography variant="caption" color={utilPct > 100 ? 'error.main' : 'text.secondary'}>
                        {utilPct}%
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(utilPct, 100)}
                      color={utilPct > 100 ? 'error' : utilPct > 80 ? 'warning' : 'success'}
                      sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                    />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Budget: {fmt(budget)}</Typography>
                      <Typography variant="caption">Spent: {fmt(spent)}</Typography>
                    </Stack>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Card>
      )}

      {/* Expenses table */}
      {(!data?.expenses?.length) ? (
        <EmptyState icon={MoneyIcon} text="No expenses recorded yet"
          action={<Button variant="outlined" startIcon={<AddIcon />} onClick={openAdd}>Record First Expense</Button>} />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell><strong>Expense #</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Category</strong></TableCell>
                <TableCell><strong>Description</strong></TableCell>
                <TableCell><strong>Vendor</strong></TableCell>
                <TableCell align="right"><strong>Amount</strong></TableCell>
                <TableCell><strong>Payment</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.expenses || []).map(exp => (
                <TableRow key={exp._id} hover>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace">{exp.expenseNumber}</Typography>
                  </TableCell>
                  <TableCell>{dayjs(exp.expenseDate).format('DD MMM YYYY')}</TableCell>
                  <TableCell><Chip label={exp.category} size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    <Typography variant="body2">{exp.description}</Typography>
                    {exp.invoiceNumber && <Typography variant="caption" color="text.secondary">Inv: {exp.invoiceNumber}</Typography>}
                  </TableCell>
                  <TableCell>{exp.vendor || '—'}</TableCell>
                  <TableCell align="right"><strong>{fmt(exp.amount)}</strong></TableCell>
                  <TableCell>
                    <Chip
                      label={exp.paymentStatus}
                      size="small"
                      color={exp.paymentStatus === 'Paid' ? 'success' : exp.paymentStatus === 'Pending' ? 'warning' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton size="small" onClick={() => openEdit(exp)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(exp._id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell colSpan={5} align="right"><strong>Total</strong></TableCell>
                <TableCell align="right">
                  <strong>{fmt((data?.expenses || []).reduce((s, e) => s + (e.amount || 0), 0))}</strong>
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Expense Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editExpense ? 'Edit Expense' : 'Record Expense'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select value={form.category} label="Category" onChange={set('category')}>
                  {BUDGET_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth type="date" label="Date" value={form.expenseDate}
                onChange={set('expenseDate')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth required label="Description" value={form.description} onChange={set('description')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth required label="Amount (PKR)" type="number" value={form.amount} onChange={set('amount')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Vendor / Contractor" value={form.vendor} onChange={set('vendor')} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Invoice / Ref #" value={form.invoiceNumber} onChange={set('invoiceNumber')} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Status</InputLabel>
                <Select value={form.paymentStatus} label="Payment Status" onChange={set('paymentStatus')}>
                  {['Pending', 'Paid', 'Cancelled'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select value={form.paymentMethod} label="Payment Method" onChange={set('paymentMethod')}>
                  {['Cash', 'Bank Transfer', 'Cheque', 'Online'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Notes" value={form.notes} onChange={set('notes')} multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editExpense ? 'Update' : 'Record'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── DPR Tab ──────────────────────────────────────────────────────────────────
const DPRTab = ({ projectId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState([]);
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    reportDate: dayjs().format('YYYY-MM-DD'), weather: '', temperature: '',
    workforceCivil: 0, workforceElectrical: 0, workforcePlumbing: 0, workforceSupervisors: 0,
    summary: '', nextDayPlan: '',
    workDone: [{ taskTitle: '', description: '', progressToday: 0 }],
    issues: []
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getDPRList(projectId);
      setData(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load DPRs');
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({
      reportDate: dayjs().format('YYYY-MM-DD'), weather: '', temperature: '',
      workforceCivil: 0, workforceElectrical: 0, workforcePlumbing: 0, workforceSupervisors: 0,
      summary: '', nextDayPlan: '',
      workDone: [{ taskTitle: '', description: '', progressToday: 0 }],
      issues: []
    });
    setPhotos([]);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.reportDate) { setError('Report date is required'); return; }
    setSaving(true); setError('');
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'workDone' || k === 'issues') {
          formData.append(k, JSON.stringify(v));
        } else {
          formData.append(k, v);
        }
      });
      photos.forEach(p => formData.append('photos', p.file));
      formData.append('photoCaptions', JSON.stringify(photos.map(p => p.caption || '')));

      await submitDPR(projectId, formData);
      setSuccess('DPR submitted successfully');
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit DPR');
    } finally { setSaving(false); }
  };

  const handleDelete = async (dprId) => {
    if (!window.confirm('Delete this DPR?')) return;
    try {
      await deleteDPR(projectId, dprId);
      setSuccess('DPR deleted');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete DPR');
    }
  };

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  const setNum = (field) => (e) => setForm(prev => ({ ...prev, [field]: Number(e.target.value) || 0 }));

  const addWorkDone = () => setForm(prev => ({
    ...prev, workDone: [...prev.workDone, { taskTitle: '', description: '', progressToday: 0 }]
  }));

  const setWorkDone = (idx, field) => (e) => setForm(prev => {
    const wd = [...prev.workDone];
    wd[idx] = { ...wd[idx], [field]: e.target.value };
    return { ...prev, workDone: wd };
  });

  const removeWorkDone = (idx) => setForm(prev => ({
    ...prev, workDone: prev.workDone.filter((_, i) => i !== idx)
  }));

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files.map(f => ({ file: f, caption: '', preview: URL.createObjectURL(f) }))]);
  };

  if (loading) return <Skeleton height={300} />;

  const reports = data?.reports || [];

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <SectionHeader
        title="Daily Progress Reports"
        action={
          <Stack direction="row" gap={1}>
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Submit DPR</Button>
          </Stack>
        }
      />

      {!reports.length ? (
        <EmptyState icon={PhotoIcon} text="No daily progress reports yet"
          action={<Button variant="outlined" startIcon={<AddIcon />} onClick={openAdd}>Submit First DPR</Button>} />
      ) : (
        reports.map(report => (
          <Card key={report._id} variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {dayjs(report.reportDate).format('dddd, DD MMMM YYYY')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                      {report.reportNumber}
                    </Typography>
                  </Stack>
                  <Stack direction="row" gap={2} sx={{ mt: 0.5 }}>
                    {report.weather && <Typography variant="caption">🌤 {report.weather} {report.temperature}</Typography>}
                    <Typography variant="caption">
                      👷 {report.workforceTotal} workers
                      {report.workforceCivil > 0 && ` (Civil: ${report.workforceCivil}`}
                      {report.workforceElectrical > 0 && `, Elec: ${report.workforceElectrical}`}
                      {report.workforcePlumbing > 0 && `, Plumb: ${report.workforcePlumbing}`}
                      {report.workforceSupervisors > 0 && `, Sup: ${report.workforceSupervisors}`}
                      {report.workforceCivil > 0 && ')'}
                    </Typography>
                    {report.submittedBy && (
                      <Typography variant="caption">
                        By: {report.submittedBy.firstName} {report.submittedBy.lastName}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <IconButton size="small" color="error" onClick={() => handleDelete(report._id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>

              {report.summary && (
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>{report.summary}</Typography>
              )}

              {report.workDone?.length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary">WORK DONE:</Typography>
                  {report.workDone.map((w, i) => (
                    <Typography key={i} variant="body2" sx={{ ml: 1 }}>
                      • {w.taskTitle ? `[${w.taskTitle}] ` : ''}{w.description}
                      {w.progressToday > 0 && ` (+${w.progressToday}%)`}
                    </Typography>
                  ))}
                </Box>
              )}

              {report.issues?.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary">ISSUES:</Typography>
                  {report.issues.map((iss, i) => (
                    <Stack key={i} direction="row" alignItems="center" gap={0.5} sx={{ ml: 1 }}>
                      <WarnIcon sx={{ fontSize: 14, color: iss.severity === 'High' || iss.severity === 'Critical' ? 'error.main' : 'warning.main' }} />
                      <Typography variant="body2">{iss.description}</Typography>
                      <Chip label={iss.severity} size="small" color={iss.severity === 'High' || iss.severity === 'Critical' ? 'error' : 'warning'} />
                      <Chip label={iss.status} size="small" color={iss.status === 'Resolved' ? 'success' : 'default'} />
                    </Stack>
                  ))}
                </Box>
              )}

              {report.photos?.length > 0 && (
                <Stack direction="row" gap={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                  {report.photos.map((photo, i) => (
                    <Box key={i}>
                      <Box
                        component="img"
                        src={getImageUrl(photo.url)}
                        alt={photo.caption || `Photo ${i + 1}`}
                        sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1, cursor: 'pointer' }}
                        onClick={() => window.open(getImageUrl(photo.url), '_blank')}
                      />
                      {photo.caption && <Typography variant="caption" display="block" align="center">{photo.caption}</Typography>}
                    </Box>
                  ))}
                </Stack>
              )}

              {report.nextDayPlan && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  <strong>Next day plan:</strong> {report.nextDayPlan}
                </Typography>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* DPR Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Submit Daily Progress Report</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={6} md={4}>
              <TextField fullWidth type="date" label="Report Date" required value={form.reportDate}
                onChange={set('reportDate')} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField fullWidth label="Weather" value={form.weather} onChange={set('weather')} placeholder="Sunny, Cloudy…" />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField fullWidth label="Temperature" value={form.temperature} onChange={set('temperature')} placeholder="32°C" />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Workforce on Site</Typography>
              <Grid container spacing={2}>
                {[['workforceCivil', 'Civil'], ['workforceElectrical', 'Electrical'], ['workforcePlumbing', 'Plumbing'], ['workforceSupervisors', 'Supervisors']].map(([f, l]) => (
                  <Grid item xs={6} sm={3} key={f}>
                    <TextField fullWidth label={l} type="number" value={form[f]} onChange={setNum(f)} size="small" />
                  </Grid>
                ))}
              </Grid>
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">Work Done Today</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addWorkDone}>Add</Button>
              </Stack>
              {form.workDone.map((wd, idx) => (
                <Stack key={idx} direction="row" gap={1} sx={{ mt: 1 }} alignItems="flex-start">
                  <TextField size="small" label="Task" value={wd.taskTitle} onChange={setWorkDone(idx, 'taskTitle')} sx={{ width: 160 }} />
                  <TextField size="small" label="Description" value={wd.description} onChange={setWorkDone(idx, 'description')} sx={{ flex: 1 }} />
                  <TextField size="small" label="Progress %" type="number" value={wd.progressToday} onChange={setWorkDone(idx, 'progressToday')} sx={{ width: 90 }} />
                  <IconButton size="small" onClick={() => removeWorkDone(idx)}><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              ))}
            </Grid>

            <Grid item xs={12}>
              <TextField fullWidth multiline rows={3} label="Summary of Day's Work" value={form.summary} onChange={set('summary')} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth multiline rows={2} label="Next Day Plan" value={form.nextDayPlan} onChange={set('nextDayPlan')} />
            </Grid>

            <Grid item xs={12}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Button
                  variant="outlined"
                  startIcon={<PhotoIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  size="small"
                >
                  Attach Photos ({photos.length})
                </Button>
                <input ref={fileInputRef} type="file" multiple accept="image/*" hidden onChange={handlePhotoSelect} />
              </Stack>
              {photos.length > 0 && (
                <Stack direction="row" gap={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  {photos.map((p, i) => (
                    <Box key={i} position="relative">
                      <Box component="img" src={p.preview} alt={`photo-${i}`}
                        sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1 }} />
                      <IconButton size="small" sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper' }}
                        onClick={() => setPhotos(prev => prev.filter((_, pi) => pi !== i))}>
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Submit DPR'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────
const OverviewTab = ({ project, onRefresh }) => {
  const [msDialogOpen, setMsDialogOpen] = useState(false);
  const [editMs, setEditMs] = useState(null);
  const [msForm, setMsForm] = useState({ title: '', description: '', plannedDate: '', billingTrigger: false, billingPercentage: 0, notes: '' });
  const [msError, setMsError] = useState('');
  const [saving, setSaving] = useState(false);
  const [genInvLoading, setGenInvLoading] = useState(null);
  const [genInvSuccess, setGenInvSuccess] = useState('');
  const [genInvError, setGenInvError] = useState('');

  const openAddMs = () => {
    setEditMs(null);
    setMsForm({ title: '', description: '', plannedDate: '', billingTrigger: false, billingPercentage: 0, notes: '' });
    setMsDialogOpen(true);
  };

  const openEditMs = (ms) => {
    setEditMs(ms);
    setMsForm({
      title: ms.title, description: ms.description || '',
      plannedDate: ms.plannedDate ? dayjs(ms.plannedDate).format('YYYY-MM-DD') : '',
      status: ms.status, completionPercentage: ms.completionPercentage || 0,
      billingTrigger: ms.billingTrigger || false,
      billingPercentage: ms.billingPercentage || 0, notes: ms.notes || ''
    });
    setMsDialogOpen(true);
  };

  const handleSaveMs = async () => {
    if (!msForm.title) { setMsError('Title is required'); return; }
    setSaving(true);
    try {
      if (editMs) {
        await updateMilestone(project._id, editMs._id, msForm);
      } else {
        await addMilestone(project._id, msForm);
      }
      setMsDialogOpen(false);
      onRefresh();
    } catch (err) {
      setMsError(err.response?.data?.message || 'Failed to save milestone');
    } finally { setSaving(false); }
  };

  const handleDeleteMs = async (msId) => {
    if (!window.confirm('Delete this milestone?')) return;
    try {
      await deleteMilestone(project._id, msId);
      onRefresh();
    } catch { /* silent */ }
  };

  const handleUpdateBudget = async (action) => {
    try {
      await updateBudgetStatus(project._id, action);
      onRefresh();
    } catch { /* silent */ }
  };

  const handleGenerateInvoice = async (ms) => {
    if (!project.contractValue) {
      setGenInvError('Set the project contract value first before generating invoices.');
      return;
    }
    setGenInvLoading(ms._id);
    setGenInvError(''); setGenInvSuccess('');
    try {
      const res = await generateMilestoneInvoice(project._id, ms._id);
      setGenInvSuccess(res.data?.message || 'Invoice generated');
    } catch (err) {
      setGenInvError(err.response?.data?.message || 'Failed to generate invoice');
    } finally { setGenInvLoading(null); }
  };

  const setMs = (field) => (e) => setMsForm(prev => ({ ...prev, [field]: e.target.value }));

  const budgetPct = pct(project.totalActualSpent, project.totalApprovedBudget);
  const daysLeft = project.expectedEndDate
    ? dayjs(project.expectedEndDate).diff(dayjs(), 'day')
    : null;

  return (
    <Grid container spacing={3}>
      {/* Key Metrics */}
      <Grid item xs={12} md={8}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Progress</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {project.overallProgress || 0}%
                </Typography>
                <LinearProgress variant="determinate" value={project.overallProgress || 0} sx={{ mt: 0.5, height: 6, borderRadius: 3 }} />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Total Budget</Typography>
                <Typography variant="h6" fontWeight={700}>{fmt(project.totalApprovedBudget || project.totalEstimatedCost)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Spent</Typography>
                <Typography variant="h6" fontWeight={700} color={budgetPct > 90 ? 'error.main' : 'text.primary'}>
                  {fmt(project.totalActualSpent)}
                </Typography>
                <Typography variant="caption" color="text.secondary">{budgetPct}% of budget</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Days Remaining</Typography>
                <Typography variant="h6" fontWeight={700} color={daysLeft !== null && daysLeft < 0 ? 'error.main' : 'text.primary'}>
                  {daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)} overdue` : daysLeft) : '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Budget categories */}
        <Card variant="outlined" sx={{ mt: 2 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={600}>Budget by Category</Typography>
              <Stack direction="row" gap={1} alignItems="center">
                <Chip label={project.budgetStatus} size="small"
                  color={project.budgetStatus === 'Approved' ? 'success' : project.budgetStatus === 'Submitted' ? 'warning' : 'default'} />
                {project.budgetStatus === 'Draft' && (
                  <Button size="small" variant="outlined" onClick={() => handleUpdateBudget('submit')}>Submit Budget</Button>
                )}
                {project.budgetStatus === 'Submitted' && (
                  <Button size="small" variant="contained" color="success" onClick={() => handleUpdateBudget('approve')}>Approve Budget</Button>
                )}
              </Stack>
            </Stack>
            <Grid container spacing={1}>
              {(project.budgetCategories || []).filter(c => c.estimatedAmount > 0).map(cat => (
                <Grid item xs={12} sm={6} key={cat.category}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption">{cat.category}</Typography>
                    <Typography variant="caption" fontWeight={600}>{fmt(cat.approvedAmount || cat.estimatedAmount)}</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(pct(cat.approvedAmount, project.totalApprovedBudget), 100)}
                    sx={{ height: 4, borderRadius: 2 }}
                  />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Project Details */}
      <Grid item xs={12} md={4}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Project Details</Typography>
            <Divider sx={{ mb: 1.5 }} />
            {[
              ['Type', project.projectType],
              ['Client', project.clientName],
              ['Contact', project.clientContact],
              ['Society', project.society],
              ['Sector', project.sector],
              ['Plot #', project.plotNumber],
              ['Address', project.address],
              ['Manager', project.projectManager ? `${project.projectManager.firstName} ${project.projectManager.lastName}` : null],
              ['Start Date', project.startDate ? dayjs(project.startDate).format('DD MMM YYYY') : null],
              ['Expected End', project.expectedEndDate ? dayjs(project.expectedEndDate).format('DD MMM YYYY') : null],
            ].filter(([, v]) => v).map(([label, value]) => (
              <Stack key={label} direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="caption" align="right" sx={{ maxWidth: '60%', wordBreak: 'break-word' }}>{value}</Typography>
              </Stack>
            ))}
          </CardContent>
        </Card>
      </Grid>

      {/* Milestones */}
      <Grid item xs={12}>
        <SectionHeader
          title="Project Milestones"
          action={<Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={openAddMs}>Add Milestone</Button>}
        />

        {genInvSuccess && <Alert severity="success" onClose={() => setGenInvSuccess('')} sx={{ mb: 2 }}>{genInvSuccess}</Alert>}
        {genInvError && <Alert severity="error" onClose={() => setGenInvError('')} sx={{ mb: 2 }}>{genInvError}</Alert>}

        {!project.milestones?.length ? (
          <EmptyState icon={FlagIcon} text="No milestones defined"
            action={<Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={openAddMs}>Add First Milestone</Button>} />
        ) : (
          <Grid container spacing={2}>
            {project.milestones.map((ms, idx) => (
              <Grid item xs={12} sm={6} md={4} key={ms._id || idx}>
                <Card variant="outlined">
                  <CardContent sx={{ pb: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={600} noWrap>{ms.title}</Typography>
                        <Chip label={ms.status} size="small" color={MS_STATUS_COLOR[ms.status] || 'default'} sx={{ mt: 0.5 }} />
                      </Box>
                      <Stack direction="row">
                        <IconButton size="small" onClick={() => openEditMs(ms)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteMs(ms._id)}><DeleteIcon fontSize="small" /></IconButton>
                      </Stack>
                    </Stack>
                    {ms.description && <Typography variant="caption" color="text.secondary">{ms.description}</Typography>}
                    {ms.plannedDate && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Planned: {dayjs(ms.plannedDate).format('DD MMM YYYY')}
                      </Typography>
                    )}
                    {ms.completionPercentage > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <LinearProgress variant="determinate" value={ms.completionPercentage} sx={{ height: 4, borderRadius: 2 }} />
                        <Typography variant="caption">{ms.completionPercentage}% complete</Typography>
                      </Box>
                    )}
                    {ms.billingTrigger && (
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
                        <Chip
                          icon={<InvoiceIcon />}
                          label={`Bill ${ms.billingPercentage}% of contract`}
                          size="small" color="warning" variant="outlined"
                        />
                        <Tooltip title={project.contractValue ? `Generate invoice for ${fmt((ms.billingPercentage / 100) * project.contractValue)}` : 'Set contract value first'}>
                          <span>
                            <Button
                              size="small" variant="outlined" color="warning"
                              startIcon={genInvLoading === ms._id ? <CircularProgress size={12} /> : <InvoiceIcon />}
                              onClick={() => handleGenerateInvoice(ms)}
                              disabled={genInvLoading === ms._id}
                              sx={{ mt: 0.5, fontSize: '0.65rem', py: 0.3 }}
                            >
                              {genInvLoading === ms._id ? 'Generating…' : 'Generate Invoice'}
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Milestone Dialog */}
        <Dialog open={msDialogOpen} onClose={() => setMsDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editMs ? 'Edit Milestone' : 'Add Milestone'}</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {msError && <Alert severity="error" sx={{ mb: 2 }}>{msError}</Alert>}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField fullWidth required label="Milestone Title" value={msForm.title} onChange={setMs('title')} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Description" value={msForm.description} onChange={setMs('description')} multiline rows={2} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth type="date" label="Planned Date" value={msForm.plannedDate}
                  onChange={setMs('plannedDate')} InputLabelProps={{ shrink: true }} />
              </Grid>
              {editMs && (
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select value={msForm.status || 'Pending'} label="Status" onChange={setMs('status')}>
                      {['Pending', 'In Progress', 'Completed', 'Delayed'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {editMs && (
                <Grid item xs={6}>
                  <TextField fullWidth label="Completion %" type="number" value={msForm.completionPercentage}
                    onChange={setMs('completionPercentage')} InputProps={{ inputProps: { min: 0, max: 100 } }} />
                </Grid>
              )}
              <Grid item xs={6}>
                <TextField fullWidth label="Billing % (if milestone billing)" type="number"
                  value={msForm.billingPercentage} onChange={setMs('billingPercentage')}
                  helperText="% of contract value to invoice" />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMsDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveMs} disabled={saving}>
              {saving ? 'Saving…' : editMs ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>
      </Grid>
    </Grid>
  );
};

// ─── Main Detail Page ─────────────────────────────────────────────────────────
const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);

  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getProjectById(id);
      setProject(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load project');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton height={60} sx={{ mb: 2 }} />
        <Skeleton height={200} />
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Project not found'}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/general/project-management')} sx={{ mt: 2 }}>
          Back to Projects
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumb + Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/general/project-management')}
            size="small"
            sx={{ mb: 1, color: 'text.secondary' }}
          >
            Project Management
          </Button>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <ConstructionIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Box>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="h5" fontWeight={700}>{project.name}</Typography>
                <Chip label={project.status} size="small" color={STATUS_COLOR[project.status] || 'default'} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {project.projectNumber} · {project.projectType}
                {project.society && ` · ${project.society}`}
                {project.sector && `, ${project.sector}`}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Stack direction="row" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadProject}><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Progress bar */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">Overall Progress</Typography>
            <Typography variant="body2" fontWeight={600}>{project.overallProgress || 0}%</Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={project.overallProgress || 0}
            sx={{ height: 10, borderRadius: 5, mt: 0.5 }}
            color={project.overallProgress >= 80 ? 'success' : project.overallProgress >= 40 ? 'warning' : 'primary'}
          />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Overview" />
          <Tab label="Bill of Quantities" />
          <Tab label="Tasks / WBS" />
          <Tab label="Expenses" />
          <Tab label="Daily Reports" />
          <Tab label="Gantt Chart" />
          <Tab label="Invoices" />
        </Tabs>
      </Box>

      <Box>
        {tab === 0 && <OverviewTab project={project} onRefresh={loadProject} />}
        {tab === 1 && <BOQTab projectId={id} />}
        {tab === 2 && <TasksTab projectId={id} />}
        {tab === 3 && <ExpensesTab projectId={id} project={project} />}
        {tab === 4 && <DPRTab projectId={id} />}
        {tab === 5 && <GanttChart project={project} />}
        {tab === 6 && <ProjectInvoicesTab project={project} />}
      </Box>
    </Box>
  );
};

export default ProjectDetail;
