import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
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
  Typography
} from '@mui/material';
import toast from 'react-hot-toast';
import landAcquisitionTransferService from '../../services/landAcquisitionTransferService';
import api from '../../services/api';
import { fetchPayFromAccounts, formatPayFromAccountLabel } from '../../utils/payFromAccounts';
import { mapTransferPaymentsFromApi } from './LandTransferPaymentsPanel';
import { numberToWords } from '../../utils/numberToWords';

const PAYMENT_MODES = ['Cash', 'Cheque', 'Bank Transfer', 'Pay Order'];

const emptyMeta = () => ({
  paymentMode: 'Bank Transfer',
  bankAccountId: '',
  paymentDate: new Date().toISOString().split('T')[0],
  refNo: '',
  narration: ''
});

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TransferPaymentDialog({ open, transferId, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(emptyMeta());
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transferPayments, setTransferPayments] = useState([]);
  // selectedTypes: Set of paymentType strings the user has checked
  const [selectedTypes, setSelectedTypes] = useState(new Set());

  const loadTransfer = async () => {
    if (!transferId || !open) return;
    setLoading(true);
    try {
      const res = await landAcquisitionTransferService.getTransfer(transferId);
      const rows = mapTransferPaymentsFromApi(res.data?.transferPayments || []);
      setTransferPayments(rows);
    } catch (err) {
      console.error('Failed to load transfer:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setMeta(emptyMeta());
      setError('');
      setSelectedTypes(new Set());
      loadTransfer();
      fetchPayFromAccounts(api)
        .then(setBankAccounts)
        .catch(() => setBankAccounts([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transferId]);

  const pendingRows = useMemo(
    () => transferPayments.filter((r) => r.status !== 'Paid'),
    [transferPayments]
  );

  const paidRows = useMemo(
    () => transferPayments.filter((r) => r.status === 'Paid'),
    [transferPayments]
  );

  // Auto-sum amounts of selected pending rows
  const totalSelectedAmount = useMemo(() => {
    return transferPayments
      .filter((r) => selectedTypes.has(r.paymentType))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [selectedTypes, transferPayments]);

  // Grand total of all rows
  const grandTotal = useMemo(
    () => transferPayments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [transferPayments]
  );

  const handleTypeToggle = (paymentType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.has(paymentType) ? next.delete(paymentType) : next.add(paymentType);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTypes.size === pendingRows.length) {
      setSelectedTypes(new Set());
    } else {
      setSelectedTypes(new Set(pendingRows.map((r) => r.paymentType)));
    }
  };

  const handleSave = async () => {
    if (!selectedTypes.size) {
      toast.error('Please select at least one payment type');
      return;
    }
    if (!totalSelectedAmount || totalSelectedAmount <= 0) {
      toast.error('Selected payment types have no amount set');
      return;
    }
    if (!meta.paymentDate) {
      toast.error('Payment date is required');
      return;
    }
    if (!meta.paymentMode) {
      toast.error('Payment method is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const paymentTypesWithAmounts = transferPayments
        .filter((r) => selectedTypes.has(r.paymentType))
        .map((r) => ({ paymentType: r.paymentType, amount: Number(r.amount) || 0 }));

      await landAcquisitionTransferService.addTransferPayment(transferId, {
        paymentTypesWithAmounts,
        paymentTypes: Array.from(selectedTypes),
        amount: totalSelectedAmount,
        amountInWords: numberToWords(totalSelectedAmount),
        paymentMode: meta.paymentMode,
        bankAccountId: meta.bankAccountId || undefined,
        paymentDate: meta.paymentDate,
        refNo: meta.refNo,
        narration: meta.narration,
        whtRate: 0
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

  const allPendingSelected = pendingRows.length > 0 && selectedTypes.size === pendingRows.length;
  const somePendingSelected = selectedTypes.size > 0 && selectedTypes.size < pendingRows.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 2, pt: 3, px: 3 }}>
        <Typography variant="h6" fontWeight={600} color="text.primary">
          Payment details
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pb: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* Integrated Transfer Payments Table */}
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 4 }}>
          {/* Panel header */}
          <Box
            sx={{
              px: 2, py: 1.5,
              bgcolor: 'grey.50',
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Typography variant="subtitle1" fontWeight={700}>Transfer Payments</Typography>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  {/* Checkbox column — only shows if there are pending rows */}
                  {pendingRows.length > 0 && (
                    <TableCell padding="checkbox" sx={{ bgcolor: 'primary.main' }}>
                      <Checkbox
                        size="small"
                        checked={allPendingSelected}
                        indeterminate={somePendingSelected}
                        onChange={handleSelectAll}
                        sx={{ color: 'primary.contrastText', '&.Mui-checked': { color: 'primary.contrastText' }, '&.MuiCheckbox-indeterminate': { color: 'primary.contrastText' } }}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText', minWidth: 180 }}>
                    Payment Type
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText', width: 140 }} align="right">
                    Amount
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText' }}>
                    Amount in Words
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText', minWidth: 100 }}>
                    Status
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={pendingRows.length > 0 ? 5 : 4} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : transferPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No transfer payments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  transferPayments.map((row) => {
                    const isPending = row.status !== 'Paid';
                    const isSelected = selectedTypes.has(row.paymentType);

                    return (
                      <TableRow
                        key={row._localId || row.paymentType}
                        hover={isPending}
                        onClick={isPending ? () => handleTypeToggle(row.paymentType) : undefined}
                        sx={{
                          cursor: isPending ? 'pointer' : 'default',
                          bgcolor: isSelected ? 'primary.50' : 'inherit',
                          '&:hover': isPending ? { bgcolor: isSelected ? 'primary.100' : 'action.hover' } : {}
                        }}
                      >
                        {/* Checkbox cell — only for pending rows */}
                        {pendingRows.length > 0 && (
                          <TableCell padding="checkbox">
                            {isPending ? (
                              <Checkbox
                                size="small"
                                checked={isSelected}
                                onChange={() => handleTypeToggle(row.paymentType)}
                                onClick={(e) => e.stopPropagation()}
                                color="primary"
                              />
                            ) : null}
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography variant="body2" fontWeight={isSelected ? 600 : 400}>
                            {row.paymentType}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600}>
                            {formatMoney(row.amount)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" fontSize={12}>
                            {row.amountInWords || (row.amount ? numberToWords(Number(row.amount)) : '—')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{
                              color: row.status === 'Paid' ? 'success.main' : 'error.main'
                            }}
                          >
                            {row.status || 'Pending'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}

                {/* Total row */}
                <TableRow sx={{ bgcolor: 'primary.dark' }}>
                  {pendingRows.length > 0 && <TableCell />}
                  <TableCell sx={{ color: 'primary.contrastText', fontWeight: 700 }}>Total</TableCell>
                  <TableCell align="right" sx={{ color: 'primary.contrastText', fontWeight: 700 }}>
                    {formatMoney(grandTotal)}
                  </TableCell>
                  <TableCell sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                    {numberToWords(grandTotal)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Selected summary */}
          {selectedTypes.size > 0 && (
            <Box sx={{ px: 2, py: 1.5, bgcolor: 'primary.main', borderTop: '2px solid', borderColor: 'primary.dark' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" fontWeight={600} color="primary.contrastText">
                  Selected ({selectedTypes.size} type{selectedTypes.size > 1 ? 's' : ''}) — Payment Amount
                </Typography>
                <Typography variant="subtitle1" fontWeight={700} color="primary.contrastText">
                  PKR {formatMoney(totalSelectedAmount)}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                {numberToWords(totalSelectedAmount)}
              </Typography>
            </Box>
          )}
        </Paper>

        {pendingRows.length === 0 && !loading && (
          <Alert severity="success" sx={{ mb: 3 }}>
            All payment types have been paid.
          </Alert>
        )}

        {/* Payment metadata form */}
        <Box component="form" noValidate>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Payment Amount (PKR)"
                value={totalSelectedAmount > 0 ? formatMoney(totalSelectedAmount) : ''}
                InputProps={{ readOnly: true }}
                InputLabelProps={{ shrink: true }}
                sx={{ '& .MuiInputBase-root': { bgcolor: 'grey.50' } }}
                helperText={
                  selectedTypes.size === 0
                    ? 'Check rows above to select payment types'
                    : `Sum of ${selectedTypes.size} selected type(s)`
                }
                FormHelperTextProps={{ sx: { mx: 0 } }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                size="small"
                label="Payment Method"
                value={meta.paymentMode}
                onChange={(e) => setMeta((prev) => ({ ...prev, paymentMode: e.target.value }))}
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
                value={meta.bankAccountId}
                onChange={(e) => setMeta((prev) => ({ ...prev, bankAccountId: e.target.value }))}
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

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Payment Date"
                value={meta.paymentDate}
                onChange={(e) => setMeta((prev) => ({ ...prev, paymentDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Reference / Cheque # / TT #"
                value={meta.refNo}
                onChange={(e) => setMeta((prev) => ({ ...prev, refNo: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                size="small"
                label="Narration"
                value={meta.narration}
                onChange={(e) => setMeta((prev) => ({ ...prev, narration: e.target.value }))}
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
          disabled={saving || loading || selectedTypes.size === 0}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Save Payment
        </Button>
      </DialogActions>
    </Dialog>
  );
}
