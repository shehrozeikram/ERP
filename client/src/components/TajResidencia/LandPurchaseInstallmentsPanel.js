import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandLess as CollapseIcon,
  ExpandMore as ExpandIcon,
  MoreVert as MoreIcon,
  Payments as PayIcon
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import landAcquisitionPurchaseService from '../../services/landAcquisitionPurchaseService';

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const statusColor = (status) => {
  switch (status) {
    case 'Paid': return 'success';
    case 'Partial': return 'warning';
    case 'Overdue': return 'error';
    default: return 'default';
  }
};

const emptyInstallmentForm = () => ({
  description: '',
  amount: '',
  dueDate: new Date().toISOString().slice(0, 10)
});

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Cheque', 'Pay Order'];

export default function LandPurchaseInstallmentsPanel({
  purchaseId,
  installments = [],
  agreedAmount = 0,
  tokenAmount = 0,
  onUpdated
}) {
  const [expanded, setExpanded] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [payingInstallment, setPayingInstallment] = useState(null);
  const [form, setForm] = useState(emptyInstallmentForm);
  const [payForm, setPayForm] = useState({ amount: '', paymentMode: '', paymentRemarks: '' });
  const [saving, setSaving] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuRow, setMenuRow] = useState(null);

  const totals = useMemo(() => {
    const amount = installments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const paid = installments.reduce((sum, row) => sum + (Number(row.paidAmount) || 0), 0);
    return {
      amount,
      paid,
      balance: Math.max(0, amount - paid)
    };
  }, [installments]);

  const schedulableRemaining = useMemo(() => {
    const agreed = Number(agreedAmount) || 0;
    const token = Number(tokenAmount) || 0;
    const scheduled = installments
      .filter((row) => String(row._id) !== String(editingId))
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return Math.max(0, agreed - token - scheduled);
  }, [agreedAmount, tokenAmount, installments, editingId]);

  const openAddForm = () => {
    setEditingId(null);
    setForm(emptyInstallmentForm());
    setFormOpen(true);
  };

  const openEditForm = (row) => {
    setEditingId(row._id);
    setForm({
      description: row.description || '',
      amount: row.amount ?? '',
      dueDate: row.dueDate ? new Date(row.dueDate).toISOString().slice(0, 10) : ''
    });
    setFormOpen(true);
    setMenuAnchor(null);
    setMenuRow(null);
  };

  const openPayForm = (row) => {
    const balance = Math.max(0, (Number(row.amount) || 0) - (Number(row.paidAmount) || 0));
    setPayingInstallment(row);
    setPayForm({
      amount: String(balance),
      paymentMode: row.paymentMode || '',
      paymentRemarks: row.paymentRemarks || ''
    });
    setPayOpen(true);
    setMenuAnchor(null);
    setMenuRow(null);
  };

  const handleSaveInstallment = async () => {
    if (!form.description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!Number(form.amount)) {
      toast.error('Amount is required');
      return;
    }
    if (!form.dueDate) {
      toast.error('Due date is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        description: form.description.trim(),
        amount: Number(form.amount),
        dueDate: form.dueDate
      };
      if (editingId) {
        await landAcquisitionPurchaseService.updateInstallment(purchaseId, editingId, payload);
        toast.success('Installment updated');
      } else {
        await landAcquisitionPurchaseService.addInstallment(purchaseId, payload);
        toast.success('Installment added');
      }
      setFormOpen(false);
      onUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save installment');
    } finally {
      setSaving(false);
    }
  };

  const handlePayInstallment = async (payFull = false) => {
    if (!payingInstallment) return;

    setSaving(true);
    try {
      await landAcquisitionPurchaseService.payInstallment(purchaseId, payingInstallment._id, {
        ...(payFull ? { payFull: true } : { amount: Number(payForm.amount) || 0 }),
        paymentMode: payForm.paymentMode,
        paymentRemarks: payForm.paymentRemarks
      });
      toast.success('Installment payment recorded');
      setPayOpen(false);
      setPayingInstallment(null);
      onUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInstallment = async (row) => {
    if (!window.confirm(`Delete installment "${row.description}"?`)) return;
    setMenuAnchor(null);
    setMenuRow(null);
    try {
      await landAcquisitionPurchaseService.deleteInstallment(purchaseId, row._id);
      toast.success('Installment deleted');
      onUpdated?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete installment');
    }
  };

  return (
    <Paper variant="outlined" sx={{ mt: 3, overflow: 'hidden', borderRadius: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>Manage Installments</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openAddForm}>
            Add Installment
          </Button>
          <Button
            size="small"
            endIcon={expanded ? <CollapseIcon /> : <ExpandIcon />}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Hide' : 'View'}
          </Button>
        </Stack>
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, py: 1.25, bgcolor: 'primary.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={700} color="primary.main">
            Installments
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Schedulable balance: PKR {formatMoney(schedulableRemaining)}
          </Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700, width: 48 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Paid</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Balance</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {installments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No installments yet — add one to schedule payments.
                  </TableCell>
                </TableRow>
              ) : (
                installments.map((row, idx) => {
                  const balance = Math.max(0, (Number(row.amount) || 0) - (Number(row.paidAmount) || 0));
                  return (
                    <TableRow key={row._id} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{row.description}</TableCell>
                      <TableCell align="right">{formatMoney(row.amount)}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>
                        {formatMoney(row.paidAmount)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: balance > 0 ? 'error.main' : 'text.secondary', fontWeight: 600 }}>
                        {formatMoney(balance)}
                      </TableCell>
                      <TableCell>{formatDate(row.dueDate)}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.status || 'Pending'}
                          size="small"
                          color={statusColor(row.status)}
                          variant={row.status === 'Paid' ? 'filled' : 'outlined'}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          {row.status !== 'Paid' && (
                            <Tooltip title="Pay installment">
                              <IconButton size="small" color="primary" onClick={() => openPayForm(row)}>
                                <PayIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setMenuAnchor(e.currentTarget);
                              setMenuRow(row);
                            }}
                          >
                            <MoreIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {installments.length > 0 && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ mr: 1, alignSelf: 'center' }}>Total</Typography>
            <Chip label={`Total ${formatMoney(totals.amount)}`} color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
            <Chip label={`Paid ${formatMoney(totals.paid)}`} color="success" variant="outlined" sx={{ fontWeight: 700 }} />
            <Chip label={`Balance ${formatMoney(totals.balance)}`} color="error" variant="outlined" sx={{ fontWeight: 700 }} />
          </Stack>
        )}
      </Collapse>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => {
          setMenuAnchor(null);
          setMenuRow(null);
        }}
      >
        {menuRow?.status !== 'Paid' && Number(menuRow?.paidAmount || 0) === 0 && (
          <MenuItem onClick={() => openEditForm(menuRow)}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
          </MenuItem>
        )}
        {menuRow?.status !== 'Paid' && (
          <MenuItem onClick={() => openPayForm(menuRow)}>
            <PayIcon fontSize="small" sx={{ mr: 1 }} /> Pay
          </MenuItem>
        )}
        {Number(menuRow?.paidAmount || 0) === 0 && (
          <MenuItem onClick={() => handleDeleteInstallment(menuRow)} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
          </MenuItem>
        )}
      </Menu>

      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editingId ? 'Edit Installment' : 'Add Installment'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              fullWidth
              label="Description *"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Full Payment, 1st Installment"
            />
            <TextField
              fullWidth
              type="number"
              label="Amount *"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              inputProps={{ min: 0, step: 0.01 }}
              helperText={`Available to schedule: PKR ${formatMoney(schedulableRemaining)}`}
            />
            <TextField
              fullWidth
              type="date"
              label="Due Date *"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveInstallment} disabled={saving}>
            {editingId ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={payOpen} onClose={() => !saving && setPayOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Pay Installment</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
              <Typography variant="body2"><strong>Description:</strong> {payingInstallment?.description || '—'}</Typography>
              <Typography variant="body2"><strong>Due:</strong> {formatMoney(payingInstallment?.amount)}</Typography>
              <Typography variant="body2"><strong>Remaining:</strong> {formatMoney(
                Math.max(0, (Number(payingInstallment?.amount) || 0) - (Number(payingInstallment?.paidAmount) || 0))
              )}
              </Typography>
            </Paper>
            <TextField
              fullWidth
              type="number"
              label="Payment Amount *"
              value={payForm.amount}
              onChange={(e) => setPayForm((prev) => ({ ...prev, amount: e.target.value }))}
              inputProps={{ min: 0, step: 0.01 }}
            />
            <TextField
              fullWidth
              select
              label="Payment Mode"
              value={payForm.paymentMode}
              onChange={(e) => setPayForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
            >
              <MenuItem value="">Select mode</MenuItem>
              {PAYMENT_MODES.map((mode) => (
                <MenuItem key={mode} value={mode}>{mode}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Remarks"
              value={payForm.paymentRemarks}
              onChange={(e) => setPayForm((prev) => ({ ...prev, paymentRemarks: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="outlined" onClick={() => handlePayInstallment(true)} disabled={saving}>
            Pay Full
          </Button>
          <Button variant="contained" onClick={() => handlePayInstallment(false)} disabled={saving}>
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
