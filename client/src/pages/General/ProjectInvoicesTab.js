import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControl, Grid, IconButton,
  InputLabel, MenuItem, Paper, Select, Skeleton, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import {
  Add as AddIcon, CheckCircle as PaidIcon, Delete as DeleteIcon,
  Edit as EditIcon, Receipt as InvoiceIcon, Refresh as RefreshIcon,
  Send as SendIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import {
  getProjectInvoices, createProjectInvoice, updateProjectInvoice, deleteProjectInvoice, getBOQ
} from '../../services/projectManagementService';

const fmt = (v) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })
    .format(Number(v || 0));

const STATUS_COLOR = {
  Draft: 'default', Sent: 'info', Paid: 'success',
  'Partially Paid': 'warning', Cancelled: 'error'
};

const EMPTY_FORM = {
  invoiceAmount: '', description: '', issueDate: dayjs().format('YYYY-MM-DD'),
  dueDate: '', billingPercentage: '', clientName: '', clientContact: '',
  clientAddress: '', notes: '', status: 'Draft', boqItemId: ''
};

const ProjectInvoicesTab = ({ project }) => {
  const [data, setData] = useState(null);
  const [boqItems, setBoqItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [payForm, setPayForm] = useState({ paidAmount: '', paidDate: dayjs().format('YYYY-MM-DD'), paymentMethod: '', paymentReference: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, boqRes] = await Promise.all([
        getProjectInvoices(project._id),
        getBOQ(project._id)
      ]);
      setData(res.data?.data || null);
      setBoqItems(boqRes.data?.data?.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load invoices');
    } finally { setLoading(false); }
  }, [project._id]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditInvoice(null);
    setForm({
      ...EMPTY_FORM,
      clientName: project.clientName || '',
      clientContact: project.clientContact || '',
      clientAddress: project.address || ''
    });
    setDialogOpen(true);
  };

  const openEdit = (inv) => {
    setEditInvoice(inv);
    setForm({
      invoiceAmount: inv.invoiceAmount,
      description: inv.description || '',
      issueDate: inv.issueDate ? dayjs(inv.issueDate).format('YYYY-MM-DD') : '',
      dueDate: inv.dueDate ? dayjs(inv.dueDate).format('YYYY-MM-DD') : '',
      billingPercentage: inv.billingPercentage || '',
      clientName: inv.clientName || '',
      clientContact: inv.clientContact || '',
      clientAddress: inv.clientAddress || '',
      notes: inv.notes || '',
      status: inv.status,
      boqItemId: inv.boqItemId || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.invoiceAmount || Number(form.invoiceAmount) <= 0) {
      setError('Invoice amount is required'); return;
    }
    
    // Validate billing against BOQ fulfillment progress
    if (form.boqItemId) {
      const selectedBOQ = boqItems.find(item => item._id === form.boqItemId);
      if (selectedBOQ) {
        const estQty = selectedBOQ.estimatedQuantity || 1;
        const fulfillmentPct = Math.min(100, Math.round(((selectedBOQ.usedQuantity || 0) / estQty) * 100));
        const fulfilledCost = (selectedBOQ.usedQuantity || 0) * (selectedBOQ.actualUnitPrice || selectedBOQ.estimatedUnitPrice || 0);
        
        if (Number(form.invoiceAmount) > fulfilledCost) {
          setError(`Billing limit exceeded. Maximum allowable invoice for this BOQ item based on physical fulfillment is ${fmt(fulfilledCost)} (Fulfillment: ${fulfillmentPct}%).`);
          return;
        }
      }
    }

    setSaving(true); setError('');
    try {
      if (editInvoice) {
        await updateProjectInvoice(project._id, editInvoice._id, form);
        setSuccess('Invoice updated');
      } else {
        await createProjectInvoice(project._id, form);
        setSuccess('Invoice created');
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save invoice');
    } finally { setSaving(false); }
  };

  const openMarkPaid = (inv) => {
    setPayingInvoice(inv);
    setPayForm({
      paidAmount: inv.invoiceAmount,
      paidDate: dayjs().format('YYYY-MM-DD'),
      paymentMethod: '',
      paymentReference: ''
    });
    setPayDialogOpen(true);
  };

  const handleMarkPaid = async () => {
    setSaving(true); setError('');
    try {
      await updateProjectInvoice(project._id, payingInvoice._id, {
        status: 'Paid',
        paidAmount: Number(payForm.paidAmount),
        paidDate: payForm.paidDate,
        paymentMethod: payForm.paymentMethod,
        paymentReference: payForm.paymentReference
      });
      setSuccess('Invoice marked as paid');
      setPayDialogOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update invoice');
    } finally { setSaving(false); }
  };

  const handleMarkSent = async (inv) => {
    try {
      await updateProjectInvoice(project._id, inv._id, { status: 'Sent' });
      setSuccess('Invoice marked as sent');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (invId) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await deleteProjectInvoice(project._id, invId);
      setSuccess('Invoice deleted');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
    }
  };

  const contractValue = project.contractValue || 0;
  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  // Auto-compute invoice amount from billing percentage
  const handlePctChange = (e) => {
    const pct = Number(e.target.value);
    setForm(prev => ({
      ...prev,
      billingPercentage: e.target.value,
      invoiceAmount: contractValue > 0 ? (pct / 100) * contractValue : prev.invoiceAmount
    }));
  };

  if (loading) return <Skeleton height={300} />;

  const invoices = data?.invoices || [];

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>Project Invoices</Typography>
        <Stack direction="row" gap={1}>
          <Button size="small" startIcon={<RefreshIcon />} onClick={load} variant="outlined">Refresh</Button>
          <Button size="small" startIcon={<AddIcon />} onClick={openAdd} variant="contained">Create Invoice</Button>
        </Stack>
      </Stack>

      {/* Summary cards */}
      {contractValue > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Contract Value', val: contractValue, color: 'text.primary' },
            { label: 'Total Invoiced', val: data?.totalInvoiced || 0, color: 'primary.main' },
            { label: 'Total Collected', val: data?.totalPaid || 0, color: 'success.main' },
            { label: 'Outstanding', val: data?.totalOutstanding || 0, color: 'warning.main' }
          ].map(({ label, val, color }) => (
            <Grid item xs={6} sm={3} key={label}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h6" fontWeight={700} color={color}>{fmt(val)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {!contractValue && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Contract value is not set for this project. Set it in the project details to enable percentage-based billing calculations.
        </Alert>
      )}

      {!invoices.length ? (
        <Box textAlign="center" py={4}>
          <InvoiceIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />
          <Typography color="text.secondary">No invoices yet</Typography>
          <Box mt={2}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openAdd}>Create First Invoice</Button>
          </Box>
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell><strong>Invoice #</strong></TableCell>
                <TableCell><strong>Description</strong></TableCell>
                <TableCell><strong>Milestone</strong></TableCell>
                <TableCell><strong>Issue Date</strong></TableCell>
                <TableCell><strong>Due Date</strong></TableCell>
                <TableCell align="right"><strong>Amount</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv._id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{inv.invoiceNumber}</Typography>
                    {inv.billingPercentage > 0 && (
                      <Typography variant="caption" color="text.secondary">{inv.billingPercentage}% of contract</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200 }}>{inv.description || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    {inv.milestoneName
                      ? <Chip size="small" label={inv.milestoneName} variant="outlined" />
                      : <Typography variant="caption" color="text.secondary">Manual</Typography>
                    }
                  </TableCell>
                  <TableCell>{inv.issueDate ? dayjs(inv.issueDate).format('DD MMM YYYY') : '—'}</TableCell>
                  <TableCell>
                    {inv.dueDate
                      ? <Typography variant="body2" color={dayjs(inv.dueDate).isBefore(dayjs()) && inv.status !== 'Paid' ? 'error.main' : 'inherit'}>
                          {dayjs(inv.dueDate).format('DD MMM YYYY')}
                        </Typography>
                      : '—'
                    }
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={600}>{fmt(inv.invoiceAmount)}</Typography>
                    {inv.paidAmount > 0 && inv.status !== 'Paid' && (
                      <Typography variant="caption" color="success.main">Paid: {fmt(inv.paidAmount)}</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={inv.status} color={STATUS_COLOR[inv.status] || 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {inv.status === 'Draft' && (
                        <Tooltip title="Mark as Sent">
                          <IconButton size="small" color="info" onClick={() => handleMarkSent(inv)}>
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(inv.status === 'Draft' || inv.status === 'Sent' || inv.status === 'Partially Paid') && (
                        <Tooltip title="Mark as Paid">
                          <IconButton size="small" color="success" onClick={() => openMarkPaid(inv)}>
                            <PaidIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(inv)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(inv._id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit Invoice Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <InvoiceIcon color="primary" />
            {editInvoice ? 'Edit Invoice' : 'Create Invoice'}
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Base Invoice on BOQ Item (Optional)</InputLabel>
                <Select
                  value={form.boqItemId || ''}
                  label="Base Invoice on BOQ Item (Optional)"
                  onChange={(e) => {
                    const boqId = e.target.value;
                    const selected = boqItems.find(item => item._id === boqId);
                    setForm(prev => {
                      const fulfilledCost = selected ? (selected.usedQuantity || 0) * (selected.actualUnitPrice || selected.estimatedUnitPrice || 0) : '';
                      return {
                        ...prev,
                        boqItemId: boqId,
                        invoiceAmount: fulfilledCost,
                        description: selected ? `Billing for BOQ Item: ${selected.title || selected.description} (${selected.usedQuantity} ${selected.unit} used)` : prev.description
                      };
                    });
                  }}
                >
                  <MenuItem value="">None (Manual Invoice)</MenuItem>
                  {boqItems.map(item => {
                    const estQty = item.estimatedQuantity || 1;
                    const fulfillmentPct = Math.min(100, Math.round(((item.usedQuantity || 0) / estQty) * 100));
                    const fulfilledCost = (item.usedQuantity || 0) * (item.actualUnitPrice || item.estimatedUnitPrice || 0);
                    return (
                      <MenuItem key={item._id} value={item._id}>
                        {item.title || item.description.substring(0, 30)}… (Fulfillment: {fulfillmentPct}%, Max Billable: {fmt(fulfilledCost)})
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
            {contractValue > 0 && (
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth label="Billing %" type="number"
                  value={form.billingPercentage} onChange={handlePctChange}
                  inputProps={{ min: 0, max: 100, step: 5 }}
                  helperText={`= ${fmt((Number(form.billingPercentage) / 100) * contractValue)}`}
                />
              </Grid>
            )}
            <Grid item xs={12} sm={contractValue > 0 ? 7 : 12}>
              <TextField
                fullWidth required label="Invoice Amount (PKR)" type="number"
                value={form.invoiceAmount} onChange={set('invoiceAmount')}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" value={form.description} onChange={set('description')} multiline rows={2} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="date" label="Issue Date" InputLabelProps={{ shrink: true }}
                value={form.issueDate} onChange={set('issueDate')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth type="date" label="Due Date" InputLabelProps={{ shrink: true }}
                value={form.dueDate} onChange={set('dueDate')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Client Name" value={form.clientName} onChange={set('clientName')} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Client Contact" value={form.clientContact} onChange={set('clientContact')} />
            </Grid>
            {editInvoice && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select value={form.status} label="Status" onChange={set('status')}>
                    {['Draft', 'Sent', 'Paid', 'Partially Paid', 'Cancelled'].map(s =>
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField fullWidth label="Notes" value={form.notes} onChange={set('notes')} multiline rows={2} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}>
            {saving ? 'Saving…' : editInvoice ? 'Update' : 'Create Invoice'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <Dialog open={payDialogOpen} onClose={() => setPayDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Mark Invoice as Paid</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {payingInvoice && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Invoice {payingInvoice.invoiceNumber} — {fmt(payingInvoice.invoiceAmount)}
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label="Amount Received (PKR)" type="number"
                value={payForm.paidAmount}
                onChange={e => setPayForm(p => ({ ...p, paidAmount: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth type="date" label="Payment Date" InputLabelProps={{ shrink: true }}
                value={payForm.paidDate}
                onChange={e => setPayForm(p => ({ ...p, paidDate: e.target.value }))} />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select value={payForm.paymentMethod} label="Payment Method"
                  onChange={e => setPayForm(p => ({ ...p, paymentMethod: e.target.value }))}>
                  {['Cash', 'Cheque', 'Bank Transfer', 'Online', 'Other'].map(m =>
                    <MenuItem key={m} value={m}>{m}</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Reference / Cheque No."
                value={payForm.paymentReference}
                onChange={e => setPayForm(p => ({ ...p, paymentReference: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleMarkPaid} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <PaidIcon />}>
            {saving ? 'Saving…' : 'Confirm Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectInvoicesTab;
