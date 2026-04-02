import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import toast from 'react-hot-toast';

const VendorAdvance = () => {
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingPos, setLoadingPos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedPo, setSelectedPo] = useState(null);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [advances, setAdvances] = useState([]);
  const [form, setForm] = useState({
    amount: '',
    paymentMethod: 'bank_transfer',
    reference: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });

  const loadVendors = useCallback(async () => {
    setLoadingVendors(true);
    try {
      const res = await api.get('/procurement/vendors', { params: { limit: 500 } });
      const list = res.data?.data?.vendors || res.data?.data || [];
      setVendors(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not load vendors');
      setVendors([]);
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  const loadPosForVendor = useCallback(async (vendorId) => {
    if (!vendorId) {
      setPurchaseOrders([]);
      setSelectedPo(null);
      return;
    }
    setLoadingPos(true);
    try {
      const res = await api.get('/procurement/purchase-orders', {
        params: { vendor: vendorId, limit: 100, page: 1 }
      });
      const list = res.data?.data?.purchaseOrders || [];
      setPurchaseOrders(Array.isArray(list) ? list : []);
    } catch (e) {
      setPurchaseOrders([]);
      if (e.response?.status === 403) {
        toast.error('No permission to list purchase orders for this vendor (link PO in procurement or skip).');
      }
    } finally {
      setLoadingPos(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    if (selectedVendor?._id) {
      loadPosForVendor(selectedVendor._id);
    } else {
      setPurchaseOrders([]);
      setSelectedPo(null);
    }
  }, [selectedVendor, loadPosForVendor]);

  const loadAdvancesForVendor = useCallback(async (vendorId) => {
    if (!vendorId) {
      setAdvances([]);
      return;
    }
    setLoadingAdvances(true);
    try {
      const res = await api.get('/finance/accounts-payable/vendor-advances', {
        params: { vendorId, limit: 50, page: 1 }
      });
      const list = res.data?.data?.advances || [];
      setAdvances(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load vendor advances');
      setAdvances([]);
    } finally {
      setLoadingAdvances(false);
    }
  }, []);

  useEffect(() => {
    if (selectedVendor?._id) {
      loadAdvancesForVendor(selectedVendor._id);
    } else {
      setAdvances([]);
    }
  }, [selectedVendor, loadAdvancesForVendor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVendor) {
      toast.error('Select a vendor');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid advance amount');
      return;
    }
    const ref = (form.reference || '').trim() || `ADV-${Date.now()}`;
    const paymentDateIso = form.paymentDate
      ? new Date(`${form.paymentDate}T12:00:00`).toISOString()
      : new Date().toISOString();

    setSubmitting(true);
    try {
      const body = {
        vendorName: selectedVendor.name,
        vendorEmail: selectedVendor.email || '',
        vendorId: selectedVendor._id,
        amount,
        paymentMethod: form.paymentMethod,
        reference: ref,
        paymentDate: paymentDateIso,
        referenceType: selectedPo ? 'purchase_order' : 'advance',
        referenceId: selectedPo ? selectedPo._id : null
      };
      const res = await api.post('/finance/accounts-payable/advance-payment', body);
      if (res.data?.success) {
        toast.success(res.data.message || 'Vendor advance recorded');
        setForm({
          amount: '',
          paymentMethod: 'bank_transfer',
          reference: '',
          paymentDate: new Date().toISOString().split('T')[0]
        });
        setSelectedPo(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record advance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PaymentsIcon color="primary" /> Vendor Advance
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Record prepayment to a supplier (DR Advance to suppliers / CR Bank or Cash). Link an optional PO for traceability.
        Apply this advance later on Accounts Payable when the vendor bill is created.
      </Typography>

      <Card variant="outlined">
        <CardContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This matches Flow 2 step 2 (payment before GRN). Amount posts to account <strong>1110</strong> Advance to suppliers until
            you apply it to a bill on <strong>Finance → Vendors → Vendor Bills</strong>.
          </Alert>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  loading={loadingVendors}
                  options={vendors}
                  getOptionLabel={(o) => (o?.name ? `${o.name}${o.email ? ` (${o.email})` : ''}` : '')}
                  value={selectedVendor}
                  onChange={(_, v) => setSelectedVendor(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Vendor *" required placeholder="Search vendor" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  loading={loadingPos}
                  options={purchaseOrders}
                  disabled={!selectedVendor}
                  getOptionLabel={(po) =>
                    po?.orderNumber ? `${po.orderNumber} — ${formatPKR(po.totalAmount || 0)}` : ''
                  }
                  value={selectedPo}
                  onChange={(_, v) => setSelectedPo(v)}
                  renderInput={(params) => (
                    <TextField {...params} label="Link to PO (optional)" placeholder="Select PO" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label="Amount (PKR)"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  inputProps={{ min: 0.01, step: 0.01 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment method</InputLabel>
                  <Select
                    value={form.paymentMethod}
                    label="Payment method"
                    onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                  >
                    <MenuItem value="bank_transfer">Bank transfer</MenuItem>
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="check">Cheque</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Payment date"
                  type="date"
                  value={form.paymentDate}
                  onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Reference / narration"
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="Bank ref, TT #, or leave blank to auto-generate"
                />
              </Grid>
              <Grid item xs={12}>
                <Button type="submit" variant="contained" disabled={submitting} size="large">
                  {submitting ? 'Posting…' : 'Record vendor advance'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          Next steps (Flow 2)
        </Typography>
        <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2 }}>
          <li>GRN in Procurement → Store → GRN</li>
          <li>Create vendor bill from GRN: Procurement → Vendor Bills</li>
          <li>Open the bill in Finance → Vendor Bills → View details → apply advance and pay any remainder</li>
        </Typography>
      </Paper>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          Advance history (partial payments)
        </Typography>

        {!selectedVendor?._id ? (
          <Typography variant="body2" color="text.secondary">
            Select a vendor to view advance records.
          </Typography>
        ) : loadingAdvances ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Loading advances…</Typography>
          </Box>
        ) : advances.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No vendor advances found for this vendor.
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><b>Reference</b></TableCell>
                  <TableCell><b>Payment date</b></TableCell>
                  <TableCell><b>Linked PO</b></TableCell>
                  <TableCell align="right"><b>Amount</b></TableCell>
                  <TableCell align="right"><b>Applied</b></TableCell>
                  <TableCell><b>Applied to bills</b></TableCell>
                  <TableCell align="right"><b>Remaining</b></TableCell>
                  <TableCell><b>Status</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {advances.map((a) => (
                  <TableRow key={a._id}>
                    <TableCell>{a.reference || a._id}</TableCell>
                    <TableCell>
                      {a.paymentDate ? new Date(a.paymentDate).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>{a.linkedPoNumber || '—'}</TableCell>
                    <TableCell align="right">{formatPKR(a.amount || 0)}</TableCell>
                    <TableCell align="right">{formatPKR(a.appliedAmount || 0)}</TableCell>
                    <TableCell>
                      {a.allocations && a.allocations.length > 0 ? (
                        <Box sx={{ maxWidth: 260 }}>
                          {a.allocations.slice(0, 3).map((al, idx) => (
                            <Typography key={`${a._id}-al-${idx}`} variant="caption" sx={{ display: 'block' }}>
                              {al.billNumber || 'Bill'}: {formatPKR(al.amount || 0)}
                            </Typography>
                          ))}
                          {a.allocations.length > 3 && (
                            <Typography variant="caption" sx={{ display: 'block' }}>
                              +{a.allocations.length - 3} more
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">{formatPKR(a.remainingAmount || 0)}</TableCell>
                    <TableCell>
                      <Chip
                        label={String(a.status || 'open').replaceAll('_', ' ')}
                        size="small"
                        color={a.status === 'applied' ? 'success' : a.status === 'partially_applied' ? 'info' : 'warning'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
};

export default VendorAdvance;
