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
  IconButton,
  Divider
} from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import { Link as RouterLink } from 'react-router-dom';
import api from '../../services/api';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import { formatPKR } from '../../utils/currency';
import { fetchPayFromAccounts, formatPayFromAccountLabel } from '../../utils/payFromAccounts';
import ComparativeStatementView from '../../components/Procurement/ComparativeStatementView';
import QuotationDetailView from '../../components/Procurement/QuotationDetailView';
import { DigitalSignatureImage } from '../../components/common/DigitalSignatureImage';
import { numberToWords } from '../../utils/numberToWords';
import toast from 'react-hot-toast';

const formatDateForPrint = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Issuance column: “Advance issued” only after the linked voucher’s signed document is recorded. */
function getVoucherIssuanceChip(a) {
  const wf = a.voucherWorkflowStatus || 'immediate';
  if (wf === 'pending_authority') return { label: 'Pending Signatures', color: 'warning' };
  if (wf === 'rejected') return { label: 'Rejected', color: 'error' };
  const signedOk = a.voucherSignedDocumentStatus === 'signed' && Boolean(a.voucherSignedDocumentAt);
  if (signedOk) return { label: 'Advance Issued', color: 'success' };
  if (wf === 'fully_approved' || wf === 'immediate') {
    return { label: 'Posted — Sign Voucher', color: 'info' };
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
    bankAccountId: '',
    reference: '',
    paymentDate: new Date().toISOString().split('T')[0]
  });
  const [finAuth, setFinAuth] = useState({
    accountsManagerUser: null,
    financeControllerUser: null
  });
  const [approverPool, setApproverPool] = useState([]);
  const [poPendingVoucher, setPoPendingVoucher] = useState({ loading: false, hasPending: false });
  const [bankAccounts, setBankAccounts] = useState([]);
  const advanceHistorySectionRef = useRef(null);
  const [highlightPoId, setHighlightPoId] = useState(null);
  const { selectedCompanyId } = useFinanceCompany();

  const [viewDialog, setViewDialog] = useState({
    open: false,
    po: null,
    poQuotations: [],
    poGrns: [],
    poLinkedDocs: [],
    poAuditTab: 0,
    loading: false
  });

  const handleViewPoDetails = async (poRow) => {
    setViewDialog({
      open: true,
      po: poRow,
      poQuotations: [],
      poGrns: [],
      poLinkedDocs: [],
      poAuditTab: 0,
      loading: true
    });

    try {
      const r = await api.get(`/procurement/purchase-orders/${poRow._id}`);
      const d = r.data?.data || poRow;

      const [qRes, grnRes] = await Promise.all([
        d?.indent?._id
          ? api.get(`/procurement/quotations/by-indent/${d.indent._id}`).catch(() => ({ data: { data: [] } }))
          : Promise.resolve({ data: { data: [] } }),
        api.get('/procurement/goods-receive', { params: { purchaseOrder: d._id, limit: 100 } }).catch(() => ({ data: { data: { receives: [] } } }))
      ]);

      const poQuotations = Array.isArray(qRes?.data?.data) ? qRes.data.data : [];
      const poGrns = Array.isArray(grnRes?.data?.data?.receives) ? grnRes.data.data.receives : [];
      const poLinkedDocs = [];

      const pushDocs = (items = [], source = 'Attachment') => {
        items.forEach((item, idx) => {
          const url = item?.url || '';
          const name = item?.originalName || item?.filename || `Document ${idx + 1}`;
          if (!name && !url) return;
          poLinkedDocs.push({
            id: item?._id || `${source}-${idx}`,
            source,
            name,
            url,
            uploadedAt: item?.uploadedAt || null,
            mimeType: item?.mimeType || ''
          });
        });
      };

      pushDocs(d?.attachments, 'PO Attachment');
      pushDocs(d?.indent?.attachments, 'Indent Attachment');
      poQuotations.forEach((q) => pushDocs(q?.attachments, `Quotation ${q?.quotationNumber || ''}`.trim()));

      setViewDialog({
        open: true,
        po: d,
        poQuotations,
        poGrns,
        poLinkedDocs,
        poAuditTab: 0,
        loading: false
      });
    } catch (e) {
      console.error('Error loading PO details:', e);
      setViewDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    setSelectedVendor(null);
    setSelectedPo(null);
    setQueuePrefillPoId(null);
    setQueuePrefillSnapshot(null);
  }, [selectedCompanyId]);

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
    fetchPayFromAccounts(api, { companyId: selectedCompanyId })
      .then(setBankAccounts)
      .catch(() => setBankAccounts([]));
  }, [selectedCompanyId]);

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
      const res = await api.get('/finance/accounts-payable/vendor-advance-po-queue', {
        params: { companyId: selectedCompanyId }
      });
      const items = res.data?.data?.items || [];
      setPoQueue(Array.isArray(items) ? items : []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not load PO advance queue');
      setPoQueue([]);
    } finally {
      setLoadingQueue(false);
    }
  }, [selectedCompanyId]);

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
    setLoadingAdvances(true);
    try {
      const params = { limit: 100, page: 1, companyId: selectedCompanyId };
      if (vendorId) params.vendorId = vendorId;
      const res = await api.get('/finance/accounts-payable/vendor-advances', { params });
      const list = res.data?.data?.advances || [];
      setAdvances(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load vendor advances');
      setAdvances([]);
    } finally {
      setLoadingAdvances(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    loadAdvancesForVendor(selectedVendor?._id || null);
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
    if (!form.bankAccountId) {
      toast.error('Select the account the payment is made from (pay from account).');
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
        bankAccountId: form.bankAccountId,
        reference: ref,
        paymentDate: paymentDateIso,
        referenceType: selectedPo ? 'purchase_order' : 'advance',
        referenceId: selectedPo ? selectedPo._id : null,
        financeApprovalAuthorities: {
          accountsManagerUser: finAuth.accountsManagerUser._id,
          financeControllerUser: finAuth.financeControllerUser._id
        },
        companyId: selectedCompanyId
      };
      const res = await api.post('/finance/accounts-payable/advance-payment', body);
      if (res.data?.success) {
        toast.success(res.data.message || 'Vendor advance recorded');
        setForm({
          amount: '',
          paymentMethod: 'bank_transfer',
          bankAccountId: '',
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
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, gap: 2, mb: 1 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaymentsIcon color="primary" /> Vendor Advance
        </Typography>
        <FinanceCompanySelector minWidth={280} showHelper={false} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Record prepayment to a supplier (DR Advance to suppliers / CR pay-from account). Link an optional PO for traceability.
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
                        <Button
                          size="small"
                          variant="outlined"
                          color="info"
                          startIcon={<VisibilityIcon />}
                          onClick={() => handleViewPoDetails(row)}
                        >
                          View Docs
                        </Button>
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
              <Grid item xs={12} md={3}>
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
              <Grid item xs={12} md={3}>
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
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small" required disabled={bankAccounts.length === 0}>
                  <InputLabel id="vendor-advance-pay-from-label">Pay from account</InputLabel>
                  <Select
                    labelId="vendor-advance-pay-from-label"
                    value={form.bankAccountId}
                    label="Pay from account"
                    onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}
                  >
                    {bankAccounts.map((item) => {
                      const account = item?.account || item;
                      const depth = item?.depth || 0;
                      return (
                        <MenuItem key={account._id} value={account._id}>
                          {formatPayFromAccountLabel(account, depth)}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                {bankAccounts.length === 0 ? (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                    No suitable pay-from accounts found. Add Cash and cash equivalents accounts in Chart of Accounts (or subaccounts under them).
                  </Typography>
                ) : null}
              </Grid>
              <Grid item xs={12} md={3}>
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
                          || bankAccounts.length === 0
                          || !form.bankAccountId
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
                    disabled={submitting || (Boolean(selectedPo?._id) && poPendingVoucher.hasPending) || bankAccounts.length === 0 || !form.bankAccountId}
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

        {loadingAdvances ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Loading advances…</Typography>
          </Box>
        ) : advances.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {selectedVendor?._id ? 'No vendor advances found for this vendor.' : 'No vendor advances recorded yet.'}
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><b>Reference</b></TableCell>
                  <TableCell><b>Vendor</b></TableCell>
                  <TableCell><b>Payment date</b></TableCell>
                  <TableCell><b>Pay from account</b></TableCell>
                  <TableCell><b>Linked PO</b></TableCell>
                  <TableCell><b>Voucher</b></TableCell>
                  <TableCell><b>Issuance</b></TableCell>
                  <TableCell align="right"><b>Amount</b></TableCell>
                  <TableCell align="right"><b>Applied</b></TableCell>
                  <TableCell><b>Applied to bills</b></TableCell>
                  <TableCell align="right"><b>Remaining</b></TableCell>
                  <TableCell><b>Status</b></TableCell>
                  <TableCell><b>Actions</b></TableCell>
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
                    <TableCell>{a.vendor?.name || '—'}</TableCell>
                    <TableCell>
                      {a.paymentDate ? new Date(a.paymentDate).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      {a.bankAccount?.name
                        ? `${a.bankAccount.name}${a.bankAccount.accountNumber ? ` (${a.bankAccount.accountNumber})` : ''}`
                        : '—'}
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
                        label={String(a.status || 'open').replaceAll('_', ' ').toUpperCase()}
                        size="small"
                        color={a.status === 'applied' ? 'success' : a.status === 'partially_applied' ? 'info' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      {a.referenceType === 'purchase_order' && a.referenceId ? (
                        <Button
                          size="small"
                          variant="outlined"
                          color="info"
                          startIcon={<VisibilityIcon />}
                          onClick={() => handleViewPoDetails({ _id: a.referenceId, orderNumber: a.linkedPoNumber })}
                        >
                          View Docs
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Related PO Documents Dialog (Reusing existing Indent, PO, CS, Quotation, GRN & Attachment components) */}
      <Dialog
        open={viewDialog.open}
        onClose={() => setViewDialog((prev) => ({ ...prev, open: false }))}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 0,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            background: '#ffffff',
            width: '90%',
            maxWidth: '210mm',
            maxHeight: '95vh',
            '@media print': {
              boxShadow: 'none',
              maxWidth: '100%',
              margin: 0,
              height: '100%',
              width: '100%',
              maxHeight: '100%'
            }
          }
        }}
      >
        <DialogTitle sx={{ p: 0, m: 0, '@media print': { display: 'none' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e0e0e0' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
              Purchase Order Documents ({viewDialog.po?.orderNumber || ''})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
                size="small"
                sx={{ '@media print': { display: 'none' } }}
              >
                Print
              </Button>
              <IconButton
                size="small"
                onClick={() => setViewDialog((prev) => ({ ...prev, open: false }))}
                sx={{ color: '#666', '@media print': { display: 'none' } }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, background: '#ffffff', overflow: 'auto', '@media print': { p: 0, overflow: 'visible' } }}>
          {viewDialog.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : viewDialog.po ? (
            <Box sx={{ p: 0, background: '#ffffff', fontFamily: 'Arial, sans-serif' }} className="print-content">
              <Tabs
                value={viewDialog.poAuditTab ?? 0}
                onChange={(_, v) => setViewDialog((prev) => ({ ...prev, poAuditTab: v }))}
                sx={{ px: 2, pt: 1, borderBottom: 1, borderColor: 'divider', '@media print': { display: 'none' } }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Indent" />
                <Tab label="Purchase Order" />
                <Tab label="Comparative Statement" />
                <Tab label={`Quotations (${viewDialog.poQuotations?.length || 0})`} />
                <Tab label={viewDialog.poGrns?.length > 0 ? `GRN(s) (${viewDialog.poGrns.length})` : 'GRN(s)'} />
                <Tab label={`Attached Documents (${viewDialog.poLinkedDocs?.length || 0})`} />
              </Tabs>

              {/* Tab 0: Indent */}
              {viewDialog.poAuditTab === 0 && (
                <Box sx={{ p: 2, overflowX: 'auto' }}>
                  {!viewDialog.po?.indent ? (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      No indent linked with this PO.
                    </Typography>
                  ) : (
                    <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="h5" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 1 }}>
                        Purchase Request Form
                      </Typography>
                      {viewDialog.po.indent.title && (
                        <Typography variant="h6" fontWeight={600} align="center" sx={{ mb: 2 }}>
                          {viewDialog.po.indent.title}
                        </Typography>
                      )}
                      <Box sx={{ mb: 1.5, fontSize: '0.9rem', textAlign: 'center' }}>
                        <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
                        <Typography component="span" sx={{ ml: 1 }}>
                          {viewDialog.po.indent.erpRef || 'PR #' + (viewDialog.po.indent.indentNumber?.split('-').pop() || '')}
                        </Typography>
                      </Box>
                      <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <Box>
                          <Typography component="span" fontWeight={600}>Date:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.po.indent.requestedDate)}</Typography>
                        </Box>
                        <Box>
                          <Typography component="span" fontWeight={600}>Required Date:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.po.indent.requiredDate) || '—'}</Typography>
                        </Box>
                        <Box>
                          <Typography component="span" fontWeight={600}>Indent No.:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>{viewDialog.po.indent.indentNumber || '—'}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mb: 3, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <Box>
                          <Typography component="span" fontWeight={600}>Department:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>{viewDialog.po.indent.department?.name || viewDialog.po.indent.department || '—'}</Typography>
                        </Box>
                        <Box>
                          <Typography component="span" fontWeight={600}>Originator:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>
                            {viewDialog.po.indent.requestedBy?.firstName && viewDialog.po.indent.requestedBy?.lastName
                              ? `${viewDialog.po.indent.requestedBy.firstName} ${viewDialog.po.indent.requestedBy.lastName}`
                              : viewDialog.po.indent.requestedBy?.name || '—'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ mb: 3 }}>
                        <Table size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>S#</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Item Name</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Description</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Brand</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Unit</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="center">Qty</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Purpose</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Est. Cost</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(viewDialog.po.indent.items || []).map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{idx + 1}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.itemName || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.description || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.brand || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.unit || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{item.quantity ?? '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.purpose || '—'}</TableCell>
                                <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{item.estimatedCost != null ? Number(item.estimatedCost).toFixed(2) : '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                      {viewDialog.po.indent.justification && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Justification:</Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            {viewDialog.po.indent.justification}
                          </Typography>
                        </Box>
                      )}
                      {Array.isArray(viewDialog.po.indent.approvalChain) && viewDialog.po.indent.approvalChain.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                            Indent approval progress
                          </Typography>
                          <Table size="small" sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 760 }}>
                            <TableHead>
                              <TableRow sx={{ bgcolor: 'action.hover' }}>
                                <TableCell sx={{ fontWeight: 700 }}>Approver</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Date &amp; time</TableCell>
                                <TableCell sx={{ fontWeight: 700 }} align="center">Digital signature</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {viewDialog.po.indent.approvalChain.map((step, idx) => {
                                const approver = step.approver;
                                const name =
                                  [approver?.firstName, approver?.lastName].filter(Boolean).join(' ').trim() ||
                                  approver?.email ||
                                  `Approver ${idx + 1}`;
                                const status = step.status || 'pending';
                                const chipColor = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
                                const chipLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending approval';
                                return (
                                  <TableRow key={`${name}-${idx}`}>
                                    <TableCell>{name}</TableCell>
                                    <TableCell>
                                      <Chip size="small" label={chipLabel} color={chipColor} variant={status === 'pending' ? 'outlined' : 'filled'} />
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{step?.actedAt ? formatDateForPrint(step.actedAt) : '—'}</TableCell>
                                    <TableCell align="center">
                                      {status === 'approved' && approver?.digitalSignature ? (
                                        <DigitalSignatureImage userOrPath={approver} alt={`Signature ${name}`} />
                                      ) : status === 'approved' ? (
                                        <Typography variant="caption" color="text.secondary">No signature on file</Typography>
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">—</Typography>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </Box>
                      )}
                    </Paper>
                  )}
                </Box>
              )}

              {/* Tab 1: Purchase Order (Official Layout matching Audit and CEO) */}
              {viewDialog.poAuditTab === 1 && (
                <Box sx={{ p: 2 }}>
                  <Paper
                    sx={{
                      p: { xs: 3, sm: 3.5, md: 4 },
                      maxWidth: '210mm',
                      mx: 'auto',
                      backgroundColor: '#fff',
                      boxShadow: 'none',
                      width: '100%',
                      fontFamily: 'Arial, sans-serif',
                      '@media print': {
                        boxShadow: 'none',
                        p: 2.5,
                        maxWidth: '100%',
                        backgroundColor: '#fff',
                        mx: 0,
                        width: '100%',
                        pageBreakInside: 'avoid'
                      }
                    }}
                  >
                    {/* Title - Centered */}
                    <Typography
                      variant="h4"
                      fontWeight={700}
                      align="center"
                      sx={{
                        textTransform: 'uppercase',
                        mb: 3,
                        fontSize: { xs: '1.8rem', print: '1.6rem' },
                        letterSpacing: 1
                      }}
                    >
                      Purchase Order
                    </Typography>

                    {/* Buyer Information - First Row */}
                    <Box sx={{ mb: 2.5 }}>
                      <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>
                        Residencia
                      </Typography>
                      <Typography sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                        1st Avenue 18 4 Islamabad
                      </Typography>
                      <Typography sx={{ fontSize: '0.9rem' }}>
                        1. Het Sne 1-8. Islamabad.
                      </Typography>
                    </Box>

                    {/* Divider */}
                    <Divider sx={{ my: 2.5, borderWidth: 1, borderColor: '#ccc' }} />

                    {/* Vendor and PO Details - Second Row in Columns */}
                    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 3 }}>
                      {/* Left Column - Vendor Info */}
                      <Box sx={{ width: '45%', fontSize: '0.9rem' }}>
                        <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>
                          {viewDialog.po.vendor?.name || 'Vendor Name'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6, mb: 2 }}>
                          {viewDialog.po.vendor?.address || 'Vendor Address'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', lineHeight: 1.6 }}>
                          <Typography component="span" sx={{ fontWeight: 600, mr: 1 }}>Indent Details:</Typography>
                          <Typography component="span">
                            Indent# {viewDialog.po.indent?.indentNumber || 'N/A'} Dated. {viewDialog.po.indent?.requestedDate ? formatDateForPrint(viewDialog.po.indent.requestedDate) : 'N/A'}.
                            {viewDialog.po.indent?.title && ` ${viewDialog.po.indent.title}.`}
                            {viewDialog.po.indent?.requestedBy && ` End User. ${viewDialog.po.indent.requestedBy.firstName || ''} ${viewDialog.po.indent.requestedBy.lastName || ''}`}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Right Column - PO Details */}
                      <Box sx={{ width: '50%', fontSize: '0.9rem', lineHeight: 2 }}>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>P.O No.:</Typography>
                          <Typography component="span">
                            {viewDialog.po.orderNumber ? 
                              (viewDialog.po.orderNumber.startsWith('P') && !viewDialog.po.orderNumber.includes('-')
                                ? viewDialog.po.orderNumber
                                : 'P' + (viewDialog.po.orderNumber.match(/\d+$/)?.[0] || viewDialog.po.orderNumber.split('-').pop() || '').padStart(9, '0'))
                              : 'N/A'}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Date:</Typography>
                          <Typography component="span">{formatDateForPrint(viewDialog.po.orderDate)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Date:</Typography>
                          <Typography component="span">{viewDialog.po.expectedDeliveryDate ? formatDateForPrint(viewDialog.po.expectedDeliveryDate) : '___________'}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Address:</Typography>
                          <Typography component="span">
                            {(() => {
                              if (viewDialog.po.deliveryAddress && typeof viewDialog.po.deliveryAddress === 'string' && viewDialog.po.deliveryAddress.trim()) {
                                return viewDialog.po.deliveryAddress.trim();
                              }
                              if (viewDialog.po.shippingAddress && typeof viewDialog.po.shippingAddress === 'object') {
                                const parts = [
                                  viewDialog.po.shippingAddress.street,
                                  viewDialog.po.shippingAddress.city,
                                  viewDialog.po.shippingAddress.state,
                                  viewDialog.po.shippingAddress.zipCode,
                                  viewDialog.po.shippingAddress.country
                                ].filter(Boolean);
                                if (parts.length > 0) return parts.join(', ');
                              }
                              if (viewDialog.po.vendor?.address) return viewDialog.po.vendor.address;
                              return '___________';
                            })()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Cost Center:</Typography>
                          <Typography component="span">{viewDialog.po.indent?.department?.name || viewDialog.po.indent?.department || '___________'}</Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Items Table */}
                    <Box sx={{ mb: 3 }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          border: '1px solid #000',
                          fontSize: '0.85rem',
                          fontFamily: 'Arial, sans-serif'
                        }}
                      >
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                            <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '5%' }}>
                              Sr no
                            </th>
                            <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '11%' }}>
                              Product
                            </th>
                            <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '23%' }}>
                              Description
                            </th>
                            <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '14%' }}>
                              Specification
                            </th>
                            <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '11%' }}>
                              Brand
                            </th>
                            <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '11%' }}>
                              Quantity Unit
                            </th>
                            <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '11%' }}>
                              Rate
                            </th>
                            <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '11%' }}>
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewDialog.po.items && viewDialog.po.items.length > 0 ? (
                            viewDialog.po.items.map((item, index) => (
                              <tr key={index} style={{ border: '1px solid #000' }}>
                                <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                  {index + 1}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                                  {item.productCode || viewDialog.po.indent?.items?.[index]?.itemCode || `44-001-${String(index + 1).padStart(4, '0')}`}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                                  {item.itemName || item.description || viewDialog.po.indent?.items?.[index]?.itemName || '___________'}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                                  {(() => {
                                    if (item.specification && String(item.specification).trim()) return item.specification.trim();
                                    const indentItem = viewDialog.po.indent?.items?.[index];
                                    if (indentItem?.specification && String(indentItem.specification).trim()) return indentItem.specification.trim();
                                    if (indentItem?.description && String(indentItem.description).trim()) return indentItem.description.trim();
                                    if (indentItem?.purpose && String(indentItem.purpose).trim()) return indentItem.purpose.trim();
                                    return '___________';
                                  })()}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                                  {item.brand || viewDialog.po.indent?.items?.[index]?.brand || '___________'}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                                  {item.quantity ? `${Number(item.quantity).toLocaleString()} ${item.unit || 'Nos'}` : '___________'}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                                  {item.unitPrice ? Number(item.unitPrice).toLocaleString() : '___________'}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                                  {item.totalPrice || item.amount ? Number(item.totalPrice || item.amount).toLocaleString() : '___________'}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>
                                No items
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </Box>

                    {/* Financial Summary - Right Aligned */}
                    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                      <Box sx={{ width: '300px', fontSize: '0.9rem' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography component="span" fontWeight={600}>Total (Rupees):</Typography>
                          <Typography component="span">{Number(viewDialog.po.totalAmount || 0).toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography component="span" fontWeight={600}>Net Total:</Typography>
                          <Typography component="span">{Number(viewDialog.po.totalAmount || 0).toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography component="span" fontWeight={600}>Freight Charges:</Typography>
                          <Typography component="span">{Number(viewDialog.po.shippingCost || 0).toLocaleString()}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
                          Rupees {numberToWords(viewDialog.po.totalAmount || 0)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Terms & Conditions */}
                    <Box sx={{ mb: 3, border: '1px solid #ccc', p: 2, fontSize: '0.9rem' }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, textDecoration: 'underline' }}>
                        TERMS & CONDITIONS
                      </Typography>
                      <Box sx={{ lineHeight: 1.8 }}>
                        <Typography sx={{ mb: 1, fontWeight: 600 }}>Main Terms & Conditions</Typography>
                        <Box sx={{ mb: 1 }}>
                          <Typography component="span" fontWeight={600}>Payment Terms:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>
                            {viewDialog.po.paymentTerms || '100% Advance Payment'}
                          </Typography>
                        </Box>
                        <Box sx={{ mb: 1 }}>
                          <Typography component="span" fontWeight={600}>Delivery Terms:</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>
                            At-Site Delivery
                          </Typography>
                        </Box>
                        <Box sx={{ mb: 1 }}>
                          <Typography component="span" fontWeight={600}>Delivery Time.</Typography>
                          <Typography component="span" sx={{ ml: 1 }}>
                            Delivery within: {viewDialog.po.quotation?.deliveryTime || '03 days'} of confirmed PO & Payment
                          </Typography>
                        </Box>
                        <Typography sx={{ mb: 1 }}>
                          Rates Are Exclusive Of all The Taxes
                        </Typography>
                        {viewDialog.po.vendor?.cnic && (
                          <Typography sx={{ mb: 1 }}>
                            CNIC {viewDialog.po.vendor.cnic}
                          </Typography>
                        )}
                        {viewDialog.po.vendor?.payeeName && (
                          <Typography>
                            Payee Name: {viewDialog.po.vendor.payeeName}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* Approval Authorities Table */}
                    <Typography variant="subtitle1" fontWeight={700} mb={1.5} sx={{ textAlign: 'center' }}>
                      APPROVAL AUTHORITIES
                    </Typography>
                    <TableContainer component={Box} sx={{ border: '1px solid #ccc', mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700 }}>Authority</TableCell>
                            <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700 }}>Name</TableCell>
                            <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, textAlign: 'center' }}>Digital Signature</TableCell>
                            <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700 }}>Date & Time</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(() => {
                            const poData = viewDialog.po;
                            const authorityText = poData.approvalAuthorities || {};
                            const indent = poData.indent && typeof poData.indent === 'object' ? poData.indent : {};
                            const csa = indent.comparativeStatementApprovals || {};
                            const approvalSteps = Array.isArray(indent?.comparativeApproval?.approvers)
                              ? indent.comparativeApproval.approvers
                              : [];
                            const stepByUserId = new Map(
                              approvalSteps.map((step) => [String(step?.approver?._id || step?.approver || ''), step])
                            );
                            const personName = (user, fallback = '') => {
                              if (fallback && String(fallback).trim()) return String(fallback).trim();
                              if (user) {
                                const n = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
                                if (n) return n;
                                if (user?.email) return user.email;
                              }
                              return '—';
                            };
                            const authorityRows = [
                              { key: 'preparedBy', label: 'Prepared By', user: csa.preparedByUser, fallback: authorityText.preparedBy || csa.preparedBy || '' },
                              { key: 'managerProcurement', label: 'Manager Procurement', user: csa.managerProcurementUser, fallback: authorityText.managerProcurement || csa.managerProcurement || '' },
                              { key: 'chiefOperatingOfficer', label: 'Chief operating officer', user: null, fallback: authorityText.chiefOperatingOfficer || authorityText.verifiedBy || csa.verifiedBy || '' },
                              { key: 'avpTaj', label: 'AVP Taj', user: null, fallback: authorityText.avpTaj || authorityText.authorisedRep || csa.authorisedRep || '' },
                              ...(authorityText.technicalDepartment || csa.technicalDepartment ? [
                                { key: 'technicalDepartment', label: 'Technical Department', user: null, fallback: authorityText.technicalDepartment || csa.technicalDepartment || '' }
                              ] : []),
                              { key: 'preAuditInitial', label: 'Initial Pre-Audit', user: poData.preAuditInitialApprovedBy, fallback: '' },
                              { key: 'auditDirectorApproval', label: 'Audit Director', user: poData.auditApprovedBy, fallback: '' }
                            ];
                            const authorityApprovalByKey = new Map(
                              (Array.isArray(poData.authorityApprovals) ? poData.authorityApprovals : [])
                                .filter((entry) => entry?.authorityKey)
                                .map((entry) => [String(entry.authorityKey), entry])
                            );

                            return authorityRows.map((row) => {
                              const uid = String(row?.user?._id || row?.user || '');
                              const step = uid ? stepByUserId.get(uid) : null;
                              const authorityApproval = authorityApprovalByKey.get(String(row.key));
                              const authorityUser = authorityApproval?.approver && typeof authorityApproval.approver === 'object'
                                ? authorityApproval.approver
                                : step?.approver && typeof step.approver === 'object'
                                  ? step.approver
                                  : row.user;
                              const actionDate = authorityApproval?.approvedAt
                                || step?.actedAt
                                || (row.key === 'preAuditInitial' ? poData.preAuditInitialApprovedAt : null)
                                || (row.key === 'auditDirectorApproval' ? poData.auditApprovedAt : null)
                                || null;

                              const displayAuthorityName = authorityApproval?.approver
                                ? ([authorityApproval.approver.firstName, authorityApproval.approver.lastName].filter(Boolean).join(' ').trim() || authorityApproval.approver.email || row.fallback || '—')
                                : personName(authorityUser, row.fallback);

                              return (
                                <TableRow key={row.key}>
                                  <TableCell sx={{ border: '1px solid #ccc', fontWeight: 600 }}>{row.label}</TableCell>
                                  <TableCell sx={{ border: '1px solid #ccc' }}>{displayAuthorityName}</TableCell>
                                  <TableCell sx={{ border: '1px solid #ccc', textAlign: 'center' }}>
                                    {authorityUser?.digitalSignature ? (
                                      <DigitalSignatureImage userOrPath={authorityUser} alt={`${row.label} signature`} />
                                    ) : (
                                      <Typography variant="caption" color="text.secondary">—</Typography>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ border: '1px solid #ccc' }}>
                                    {actionDate ? formatDateForPrint(actionDate) : '—'}
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })()}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>
              )}

              {/* Tab 2: Comparative Statement */}
              {viewDialog.poAuditTab === 2 && (
                <Box sx={{ p: 2, overflowX: 'auto' }}>
                  <ComparativeStatementView
                    requisition={viewDialog.po?.indent}
                    quotations={viewDialog.poQuotations || []}
                    approvalAuthority={viewDialog.po?.indent?.comparativeStatementApprovals || {}}
                    note={viewDialog.po?.indent?.notes ?? ''}
                    readOnly
                    formatNumber={(n) => Number(n || 0).toLocaleString()}
                    loadingQuotations={false}
                    showPrintButton={false}
                  />
                </Box>
              )}

              {/* Tab 3: Quotations */}
              {viewDialog.poAuditTab === 3 && (
                <Box sx={{ p: 2 }}>
                  {(!viewDialog.poQuotations || viewDialog.poQuotations.length === 0) ? (
                    <Typography color="text.secondary">No quotations linked with this PO.</Typography>
                  ) : (
                    <Stack spacing={4}>
                      {viewDialog.poQuotations.map((q) => (
                        <QuotationDetailView
                          key={q._id}
                          quotation={q}
                          formatNumber={(n) => Number(n || 0).toLocaleString()}
                          formatDateForPrint={formatDateForPrint}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              {/* Tab 4: GRNs */}
              {viewDialog.poAuditTab === 4 && (
                <Box sx={{ p: 2 }}>
                  {(!viewDialog.poGrns || viewDialog.poGrns.length === 0) ? (
                    <Typography color="text.secondary">No GRN attached to this PO.</Typography>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>GRN No</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Supplier</TableCell>
                            <TableCell align="right">Net Amount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {viewDialog.poGrns.map((grn, idx) => (
                            <TableRow key={grn._id || idx}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>{grn.receiveNumber || grn._id}</TableCell>
                              <TableCell>{formatDateForPrint(grn.receiveDate)}</TableCell>
                              <TableCell>{grn.supplierName || grn.supplier?.name || '—'}</TableCell>
                              <TableCell align="right">{formatPKR(grn.netAmount || grn.total || 0)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {/* Tab 5: Attached Documents */}
              {viewDialog.poAuditTab === 5 && (
                <Box sx={{ p: 2 }}>
                  {(!viewDialog.poLinkedDocs || viewDialog.poLinkedDocs.length === 0) ? (
                    <Typography color="text.secondary">No attached documents found.</Typography>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Source</TableCell>
                            <TableCell>Document</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {viewDialog.poLinkedDocs.map((doc, idx) => (
                            <TableRow key={doc.id || idx}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>{doc.source || 'Attachment'}</TableCell>
                              <TableCell>{doc.name || 'Document'}</TableCell>
                              <TableCell>{doc.uploadedAt ? formatDateForPrint(doc.uploadedAt) : '—'}</TableCell>
                              <TableCell align="right">
                                {doc.url ? (
                                  <Button size="small" variant="outlined" onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}>
                                    Open
                                  </Button>
                                ) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default VendorAdvance;
