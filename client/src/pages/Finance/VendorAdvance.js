import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  CircularProgress,
  Tooltip,
  IconButton
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import { Link as RouterLink } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import toast from 'react-hot-toast';

/** Issuance column: “Advance issued” only after the linked voucher’s signed document is recorded. */
function getVoucherIssuanceChip(a) {
  const wf = a.voucherWorkflowStatus || 'immediate';
  if (wf === 'pending_authority') return { label: 'Pending signatures', color: 'warning' };
  if (wf === 'rejected') return { label: 'Rejected', color: 'error' };
  const signedOk = a.voucherSignedDocumentStatus === 'signed' && Boolean(a.voucherSignedDocumentAt);
  if (signedOk) return { label: 'Advance issued', color: 'success' };
  if (wf === 'fully_approved' || wf === 'immediate') {
    return { label: 'Posted — sign voucher', color: 'info' };
  }
  return { label: 'Posted', color: 'success' };
}

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
  const [poQueue, setPoQueue] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queuePrefillPoId, setQueuePrefillPoId] = useState(null);
  const [queuePrefillSnapshot, setQueuePrefillSnapshot] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    paymentMethod: 'bank_transfer',
    reference: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });
  const [finAuth, setFinAuth] = useState({
    accountsManagerUser: null,
    financeControllerUser: null
  });
  const [approverPool, setApproverPool] = useState([]);
  const [poPendingVoucher, setPoPendingVoucher] = useState({ loading: false, hasPending: false });
  const advanceHistorySectionRef = useRef(null);
  const [highlightPoId, setHighlightPoId] = useState(null);

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
    setPurchaseOrders([]);
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
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/indents/approver-candidates', { params: { search: '', limit: 100 } });
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        if (!cancelled) setApproverPool(list);
      } catch {
        if (!cancelled) setApproverPool([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadPoQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const res = await api.get('/finance/accounts-payable/vendor-advance-po-queue');
      const items = res.data?.data?.items || [];
      setPoQueue(Array.isArray(items) ? items : []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not load PO advance queue');
      setPoQueue([]);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    loadPoQueue();
  }, [loadPoQueue]);

  const vendorOptions = useMemo(() => {
    if (!selectedVendor?._id) return vendors;
    const has = vendors.some((v) => String(v._id) === String(selectedVendor._id));
    if (has) return vendors;
    return [selectedVendor, ...vendors];
  }, [vendors, selectedVendor]);

  useEffect(() => {
    if (!queuePrefillPoId || !selectedVendor?._id) return;
    if (loadingPos) return;
    const po = purchaseOrders.find((p) => String(p._id) === String(queuePrefillPoId));
    if (po) {
      setSelectedPo(po);
      setQueuePrefillPoId(null);
      setQueuePrefillSnapshot(null);
      return;
    }
    if (purchaseOrders.length >= 0 && queuePrefillSnapshot && String(queuePrefillSnapshot._id) === String(queuePrefillPoId)) {
      setSelectedPo({
        _id: queuePrefillSnapshot._id,
        orderNumber: queuePrefillSnapshot.orderNumber,
        totalAmount: queuePrefillSnapshot.totalAmount
      });
      setQueuePrefillPoId(null);
      setQueuePrefillSnapshot(null);
    }
  }, [queuePrefillPoId, purchaseOrders, loadingPos, selectedVendor, queuePrefillSnapshot]);

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

  useEffect(() => {
    let cancelled = false;
    const poId = selectedPo?._id;
    if (!poId) {
      setPoPendingVoucher({ loading: false, hasPending: false });
      return undefined;
    }
    (async () => {
      setPoPendingVoucher((p) => ({ ...p, loading: true }));
      try {
        const res = await api.get(`/finance/vendor-advances/po/${poId}/pending-voucher`);
        const hasPending = Boolean(res.data?.data?.hasPending);
        if (!cancelled) setPoPendingVoucher({ loading: false, hasPending });
      } catch {
        if (!cancelled) setPoPendingVoucher({ loading: false, hasPending: false });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedPo?._id]);

  useEffect(() => {
    if (!highlightPoId || loadingAdvances) return;
    const rowElId = `vendor-advance-row-po-${highlightPoId}`;
    requestAnimationFrame(() => {
      advanceHistorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const rowEl = document.getElementById(rowElId);
      if (rowEl) rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [highlightPoId, advances, loadingAdvances]);

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
    if (!finAuth.accountsManagerUser || !finAuth.financeControllerUser) {
      toast.error('Select Sr Manager Accounts and GM Finance (required for every vendor advance).');
      return;
    }
    if (selectedPo?._id && poPendingVoucher.hasPending) {
      toast.error('This PO already has an advance pending voucher approval. You cannot record another until that is finished.');
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
        referenceId: selectedPo ? selectedPo._id : null,
        financeApprovalAuthorities: {
          accountsManagerUser: finAuth.accountsManagerUser._id,
          financeControllerUser: finAuth.financeControllerUser._id
        }
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
        setFinAuth({
          accountsManagerUser: null,
          financeControllerUser: null
        });
        loadPoQueue();
        if (selectedVendor?._id) loadAdvancesForVendor(selectedVendor._id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record advance');
    } finally {
      setSubmitting(false);
    }
  };

  const preparePaymentFromQueue = (row) => {
    if (row.hasPendingVoucherApproval) {
      toast.error('This PO already has a vendor advance in voucher approval. Finish or reject it first.');
      return;
    }
    setSelectedPo(null);
    const v = vendors.find((x) => String(x._id) === String(row.vendor?._id));
    const vendorObj = v || {
      _id: row.vendor._id,
      name: row.vendor.name || 'Vendor',
      email: row.vendor.email || ''
    };
    setSelectedVendor(vendorObj);
    setQueuePrefillSnapshot({
      _id: row._id,
      orderNumber: row.orderNumber,
      totalAmount: row.totalAmount
    });
    setQueuePrefillPoId(row._id);
    setForm((f) => ({
      ...f,
      amount: String(row.remainingAdvanceDue > 0 ? row.remainingAdvanceDue : ''),
      reference: ''
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.success('Vendor and amount filled — confirm PO link and submit when ready.');
  };

  const showRelatedAdvanceInHistory = (row) => {
    const vid = row.vendor?._id;
    if (!vid) return;
    const v = vendors.find((x) => String(x._id) === String(vid));
    const vendorObj = v || {
      _id: vid,
      name: row.vendor?.name || 'Vendor',
      email: row.vendor?.email || ''
    };
    setSelectedVendor(vendorObj);
    setHighlightPoId(String(row._id));
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

      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
        <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentTurnedInIcon color="warning" fontSize="small" />
          Awaiting vendor advance payment
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Purchase orders in <strong>Pending Finance</strong> with <strong>Full Advance</strong> (or advance) terms that still need an advance posted.
          Use <strong>Prepare payment</strong> to fill the form below. If an advance is already in <strong>voucher approval</strong> for that PO, action is disabled until it is completed or rejected.
        </Typography>
        {loadingQueue ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">Loading queue…</Typography>
          </Box>
        ) : poQueue.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No POs are waiting for vendor advance right now.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.paper' }}>
                  <TableCell><b>PO</b></TableCell>
                  <TableCell><b>Vendor</b></TableCell>
                  <TableCell><b>Terms</b></TableCell>
                  <TableCell align="right"><b>PO total</b></TableCell>
                  <TableCell align="right"><b>Already recorded</b></TableCell>
                  <TableCell align="right"><b>Still due</b></TableCell>
                  <TableCell><b>Voucher</b></TableCell>
                  <TableCell><b>Actions</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {poQueue.map((row) => (
                  <TableRow key={row._id} hover>
                    <TableCell>{row.orderNumber || row._id}</TableCell>
                    <TableCell>
                      {row.vendor?.name || '—'}
                      {row.vendor?.email ? (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {row.vendor.email}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.paymentTerms || '—'}</TableCell>
                    <TableCell align="right">{formatPKR(row.totalAmount || 0)}</TableCell>
                    <TableCell align="right">{formatPKR(row.advanceRecordedAmount || 0)}</TableCell>
                    <TableCell align="right">
                      <Chip label={formatPKR(row.remainingAdvanceDue || 0)} size="small" color="warning" />
                    </TableCell>
                    <TableCell>
                      {row.hasPendingVoucherApproval ? (
                        <Chip size="small" color="info" label="Awaiting signatures" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Tooltip title="Show related advance in history below">
                          <IconButton
                            size="small"
                            color="primary"
                            aria-label="Show related advance in history"
                            onClick={() => showRelatedAdvanceInHistory(row)}
                          >
                            <ArticleOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip
                          title={
                            row.hasPendingVoucherApproval
                              ? 'An advance for this PO is waiting for voucher signatures — finish or reject it first.'
                              : ''
                          }
                        >
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              color="warning"
                              disabled={Boolean(row.hasPendingVoucherApproval)}
                              onClick={() => preparePaymentFromQueue(row)}
                            >
                              Prepare payment
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

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
                  options={vendorOptions}
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
              {selectedPo?._id && poPendingVoucher.loading ? (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">Checking this PO for pending voucher approval…</Typography>
                </Grid>
              ) : null}
              {selectedPo?._id && poPendingVoucher.hasPending ? (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    This PO already has a vendor advance in <strong>voucher approval</strong>. You cannot record another advance for this PO until that voucher is fully approved or rejected.
                  </Alert>
                </Grid>
              ) : null}
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
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Finance voucher signatures (required)
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={approverPool}
                  value={finAuth.accountsManagerUser}
                  onChange={(_, v) => setFinAuth((f) => ({ ...f, accountsManagerUser: v }))}
                  getOptionLabel={(u) => ([u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || '')}
                  renderInput={(params) => <TextField {...params} label="Sr Manager Accounts *" size="small" required />}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={approverPool}
                  value={finAuth.financeControllerUser}
                  onChange={(_, v) => setFinAuth((f) => ({ ...f, financeControllerUser: v }))}
                  getOptionLabel={(u) => ([u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || '')}
                  renderInput={(params) => <TextField {...params} label="GM Finance *" size="small" required />}
                />
              </Grid>
              <Grid item xs={12}>
                {(!finAuth.accountsManagerUser || !finAuth.financeControllerUser) ? (
                  <Tooltip title="Select Sr Manager Accounts and GM Finance before recording the advance.">
                    <span>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={
                          submitting
                          || (Boolean(selectedPo?._id) && poPendingVoucher.hasPending)
                          || !finAuth.accountsManagerUser
                          || !finAuth.financeControllerUser
                        }
                        size="large"
                      >
                        {submitting ? 'Posting…' : 'Record vendor advance'}
                      </Button>
                    </span>
                  </Tooltip>
                ) : (
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitting || (Boolean(selectedPo?._id) && poPendingVoucher.hasPending)}
                    size="large"
                  >
                    {submitting ? 'Posting…' : 'Record vendor advance'}
                  </Button>
                )}
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

      <Box ref={advanceHistorySectionRef} sx={{ mt: 3 }}>
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
                  <TableCell><b>Voucher</b></TableCell>
                  <TableCell><b>Issuance</b></TableCell>
                  <TableCell align="right"><b>Amount</b></TableCell>
                  <TableCell align="right"><b>Applied</b></TableCell>
                  <TableCell><b>Applied to bills</b></TableCell>
                  <TableCell align="right"><b>Remaining</b></TableCell>
                  <TableCell><b>Status</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {advances.map((a) => (
                  <TableRow
                    key={a._id}
                    id={
                      a.referenceType === 'purchase_order' && a.referenceId
                        ? `vendor-advance-row-po-${String(a.referenceId)}`
                        : undefined
                    }
                    sx={
                      highlightPoId
                      && a.referenceType === 'purchase_order'
                      && String(a.referenceId) === String(highlightPoId)
                        ? { bgcolor: 'action.selected' }
                        : undefined
                    }
                  >
                    <TableCell>{a.reference || a._id}</TableCell>
                    <TableCell>
                      {a.paymentDate ? new Date(a.paymentDate).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>{a.linkedPoNumber || '—'}</TableCell>
                    <TableCell>
                      {a.journalEntryId ? (
                        <RouterLink to={`/finance/vouchers/${a.journalEntryId}`} style={{ fontSize: 13 }}>
                          Open voucher
                        </RouterLink>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" {...getVoucherIssuanceChip(a)} />
                    </TableCell>
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
