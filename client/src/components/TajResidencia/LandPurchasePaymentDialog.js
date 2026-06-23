import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { Payments as PaymentIcon } from '@mui/icons-material';
import toast from 'react-hot-toast';
import landAcquisitionPurchaseService from '../../services/landAcquisitionPurchaseService';
import api from '../../services/api';
import { fetchPayFromAccounts, formatPayFromAccountLabel } from '../../utils/payFromAccounts';
import LandPurchaseInstallmentsPanel from './LandPurchaseInstallmentsPanel';
import { numberToWords } from '../../utils/numberToWords';

const PAYMENT_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'Pay Order'];

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LandPurchasePaymentDialog({ open, purchaseId, purchaseNo, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [agreedAmount, setAgreedAmount] = useState(0);
  const [installments, setInstallments] = useState([]);
  const [form, setForm] = useState({
    tokenAmount: '',
    paymentMode: '',
    paymentRemarks: '',
    bankAccountId: '',
    whtRate: '',
    drawnOn: '',
    refNo: '',
    narration: '',
    tokenPaymentDate: new Date().toISOString().split('T')[0]
  });
  const [bankAccounts, setBankAccounts] = useState([]);

  const loadPurchase = useCallback(async () => {
    if (!purchaseId) return;
    setLoading(true);
    setError('');
    try {
      const res = await landAcquisitionPurchaseService.getPurchase(purchaseId);
      const row = res.data;
      setAgreedAmount(Number(row.agreedAmount) || 0);
      setInstallments(row.installments || []);
      setForm({
        tokenAmount: row.tokenAmount ?? '',
        paymentMode: row.paymentMode || '',
        paymentRemarks: row.paymentRemarks || '',
        bankAccountId: row.bankAccountId || '',
        whtRate: row.whtRate || '',
        drawnOn: row.drawnOn || '',
        refNo: row.refNo || '',
        narration: row.narration || '',
        tokenPaymentDate: row.tokenPaymentDate ? new Date(row.tokenPaymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    if (!open || !purchaseId) return;
    loadPurchase();
    fetchPayFromAccounts(api)
      .then(setBankAccounts)
      .catch(() => setBankAccounts([]));
  }, [open, purchaseId, loadPurchase]);

  const installmentPaid = useMemo(
    () => installments.reduce((sum, row) => sum + (Number(row.paidAmount) || 0), 0),
    [installments]
  );

  const balanceAmount = useMemo(
    () => Math.max(
      0,
      Math.round((agreedAmount - (Number(form.tokenAmount) || 0) - installmentPaid) * 100) / 100
    ),
    [agreedAmount, form.tokenAmount, installmentPaid]
  );

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await landAcquisitionPurchaseService.updatePurchasePayment(purchaseId, {
        tokenAmount: Number(form.tokenAmount) || 0,
        tokenAmountInWords: numberToWords(Number(form.tokenAmount) || 0),
        paymentMode: form.paymentMode,
        paymentRemarks: form.paymentRemarks,
        bankAccountId: form.bankAccountId || undefined,
        whtRate: Number(form.whtRate) || 0,
        drawnOn: form.drawnOn,
        refNo: form.refNo,
        narration: form.narration,
        tokenPaymentDate: form.tokenPaymentDate
      });
      toast.success('Payment information saved');
      onSaved?.();
      onClose?.();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save payment information';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleInstallmentsUpdated = async () => {
    await loadPurchase();
    onSaved?.();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PaymentIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={700}>Payment Information</Typography>
            {purchaseNo && (
              <Typography variant="body2" color="text.secondary">
                Land Purchase {purchaseNo}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: 'grey.50' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <CircularProgress size={28} sx={{ display: 'block', mx: 'auto', my: 4 }} />
        ) : (
          <>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Payment Summary</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Agreed Amount"
                    value={formatMoney(agreedAmount)}
                    InputProps={{ readOnly: true }}
                    size="small"
                    sx={{ '& .MuiInputBase-input': { bgcolor: 'primary.50', fontWeight: 700 } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Installments Paid"
                    value={formatMoney(installmentPaid)}
                    InputProps={{ readOnly: true }}
                    size="small"
                    sx={{ '& .MuiInputBase-input': { bgcolor: 'success.50', fontWeight: 700, color: 'success.dark' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Outstanding Balance"
                    value={formatMoney(balanceAmount)}
                    InputProps={{ readOnly: true }}
                    size="small"
                    sx={{ '& .MuiInputBase-input': { bgcolor: 'error.50', fontWeight: 700, color: 'error.dark' } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Token Amount In Words"
                    value={numberToWords(Number(form.tokenAmount) || 0)}
                    InputProps={{ readOnly: true }}
                    size="small"
                    sx={{ '& .MuiInputBase-input': { bgcolor: 'grey.50' } }}
                  />
                </Grid>

                {/* Detailed Payment Fields */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Token Payment Amount"
                    value={form.tokenAmount}
                    onChange={(e) => setForm((prev) => ({ ...prev, tokenAmount: e.target.value }))}
                    inputProps={{ min: 0 }}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="WHT Rate %"
                    value={form.whtRate}
                    onChange={(e) => setForm((prev) => ({ ...prev, whtRate: e.target.value }))}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    select
                    label="Payment Method"
                    value={form.paymentMode}
                    onChange={(e) => setForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
                    size="small"
                  >
                    <MenuItem value="">Select mode</MenuItem>
                    {PAYMENT_MODES.map((m) => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    select
                    label="Pay From Account"
                    value={form.bankAccountId}
                    onChange={(e) => setForm((prev) => ({ ...prev, bankAccountId: e.target.value }))}
                    size="small"
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

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Payment Date"
                    value={form.tokenPaymentDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, tokenPaymentDate: e.target.value }))}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Reference / Cheque # / TT #"
                    value={form.refNo}
                    onChange={(e) => setForm((prev) => ({ ...prev, refNo: e.target.value }))}
                    size="small"
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Narration"
                    value={form.narration}
                    onChange={(e) => setForm((prev) => ({ ...prev, narration: e.target.value }))}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Payment Remarks"
                    value={form.paymentRemarks}
                    onChange={(e) => setForm((prev) => ({ ...prev, paymentRemarks: e.target.value }))}
                    size="small"
                  />
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                <Chip label={`Agreed ${formatMoney(agreedAmount)}`} color="primary" variant="outlined" size="small" />
                <Chip label={`Token ${formatMoney(form.tokenAmount)}`} color="info" variant="outlined" size="small" />
                <Chip label={`Paid ${formatMoney((Number(form.tokenAmount) || 0) + installmentPaid)}`} color="success" variant="outlined" size="small" />
                <Chip label={`Balance ${formatMoney(balanceAmount)}`} color="error" variant="outlined" size="small" />
              </Stack>
            </Paper>

            <Divider sx={{ my: 2 }} />

            <LandPurchaseInstallmentsPanel
              purchaseId={purchaseId}
              installments={installments}
              agreedAmount={agreedAmount}
              tokenAmount={form.tokenAmount}
              onUpdated={handleInstallmentsUpdated}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Close</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || loading}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Save Payment Info
        </Button>
      </DialogActions>
    </Dialog>
  );
}
