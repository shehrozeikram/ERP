import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
  Typography
} from '@mui/material';
import toast from 'react-hot-toast';
import landAcquisitionTransferService from '../../services/landAcquisitionTransferService';
import api from '../../services/api';
import { fetchPayFromAccounts, formatPayFromAccountLabel } from '../../utils/payFromAccounts';
import LandTransferPaymentsPanel, { mapTransferPaymentsFromApi } from './LandTransferPaymentsPanel';

const PAYMENT_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'Pay Order'];

const emptyForm = () => ({
  paymentType: 'Transfer Fee',
  status: 'Paid',
  amount: '',
  whtRate: '',
  paymentMode: 'Bank Transfer',
  bankAccountId: '',
  paymentDate: new Date().toISOString().split('T')[0],
  refNo: '',
  narration: ''
});

export default function TransferPaymentDialog({ open, transferId, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transferPayments, setTransferPayments] = useState([]);

  const loadTransfer = async () => {
    if (!transferId || !open) return;
    setLoading(true);
    try {
      const res = await landAcquisitionTransferService.getTransfer(transferId);
      const charges = res.data?.totalTransferPayments || 0;
      setForm((prev) => ({ ...prev, amount: charges }));
      setTransferPayments(mapTransferPaymentsFromApi(res.data?.transferPayments || []));
    } catch (err) {
      console.error('Failed to load transfer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setError('');
      loadTransfer();
      fetchPayFromAccounts(api)
        .then(setBankAccounts)
        .catch(() => setBankAccounts([]));
    }
  }, [open, transferId]);

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Valid payment amount is required');
      return;
    }
    if (!form.paymentDate) {
      toast.error('Payment date is required');
      return;
    }
    if (!form.paymentMode) {
      toast.error('Payment method is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await landAcquisitionTransferService.addTransferPayment(transferId, {
        paymentType: form.paymentType,
        status: form.status,
        amount: Number(form.amount),
        whtRate: Number(form.whtRate) || 0,
        paymentMode: form.paymentMode,
        bankAccountId: form.bankAccountId || undefined,
        paymentDate: form.paymentDate,
        refNo: form.refNo,
        narration: form.narration
      });
      toast.success('Transfer payment recorded successfully');
      onSaved?.();
      onClose?.();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to record payment';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 2, pt: 3, px: 3 }}>
        <Typography variant="h6" fontWeight={600} color="text.primary">
          Payment details
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        
        <Box sx={{ mb: 4 }}>
          <LandTransferPaymentsPanel 
            payments={transferPayments} 
            onChange={() => {}} 
            readOnly={true} 
          />
        </Box>

        <Box component="form" noValidate sx={{ mt: 1 }}>
          <Grid container spacing={3}>
            {/* Row 0 - Type and Status */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                size="small"
                label="Payment Type"
                value={form.paymentType}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentType: e.target.value }))}
              >
                <MenuItem value="Transfer Fee">Transfer Fee</MenuItem>
                <MenuItem value="Surcharge">Surcharge</MenuItem>
                <MenuItem value="Taxes">Taxes</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                size="small"
                label="Status"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Partial">Partial</MenuItem>
                <MenuItem value="Paid">Paid</MenuItem>
              </TextField>
            </Grid>

            {/* Row 1 */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Payment Amount (PKR)"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="WHT Rate %"
                value={form.whtRate}
                onChange={(e) => setForm((prev) => ({ ...prev, whtRate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                helperText="Leave 0 if no WHT applies"
                FormHelperTextProps={{ sx: { mx: 0 } }}
              />
            </Grid>

            {/* Row 2 */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                size="small"
                label="Payment Method"
                value={form.paymentMode}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              >
                {PAYMENT_MODES.map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                size="small"
                label="Pay From Account"
                value={form.bankAccountId}
                onChange={(e) => setForm((prev) => ({ ...prev, bankAccountId: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              >
                <MenuItem value="">Select Account</MenuItem>
                {bankAccounts.map(({ account, depth }) => (
                  <MenuItem
                    key={account._id || account.id}
                    value={account._id || account.id}
                    sx={{ pl: depth * 2 + 2 }}
                  >
                    {formatPayFromAccountLabel(account, depth)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Row 3 */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Payment Date"
                value={form.paymentDate}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Reference / Cheque # / TT #"
                value={form.refNo}
                onChange={(e) => setForm((prev) => ({ ...prev, refNo: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Row 4 */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                size="small"
                label="Narration"
                value={form.narration}
                onChange={(e) => setForm((prev) => ({ ...prev, narration: e.target.value }))}
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} disabled={saving} color="inherit">Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || loading}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Save Payment
        </Button>
      </DialogActions>
    </Dialog>
  );
}
