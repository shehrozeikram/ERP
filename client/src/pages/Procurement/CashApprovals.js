import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Tooltip, Chip, Alert, Stack, Divider, Grid,
  CircularProgress, Autocomplete, Stepper, Step, StepLabel,
  Card, CardContent, Tabs, Tab, alpha, useTheme, Popper
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Visibility as ViewIcon, Refresh as RefreshIcon,
  CheckCircle as ApproveIcon, Cancel as RejectIcon,
  Print as PrintIcon, Send as SendIcon, Undo as ReturnIcon,
  ArrowForward as ForwardIcon, MonetizationOn as CashIcon,
  Receipt as ReceiptIcon, Done as CompleteIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import procurementService from '../../services/procurementService';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';
import { useAuth } from '../../contexts/AuthContext';

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_COLORS = {
  'Draft': 'default',
  'Pending Audit': 'warning',
  'Forwarded to Audit Director': 'info',
  'Send to CEO Office': 'info',
  'Forwarded to CEO': 'info',
  'Pending Finance': 'warning',
  'Advance Issued': 'primary',
  'Payment Settled': 'secondary',
  'Sent to Procurement': 'success',
  'Completed': 'success',
  'Cancelled': 'default',
  'Rejected': 'error',
  'Returned from Audit': 'warning',
  'Returned from CEO Office': 'warning',
  'Returned from CEO Secretariat': 'warning'
};

const CA_APPROVAL_AUTHORITY_FIELDS = [
  { key: 'preparedBy', label: 'Prepared By' },
  { key: 'verifiedBy', label: 'Verified By (Procurement Committee)' },
  { key: 'authorisedRep', label: 'Authorised Rep.' },
  { key: 'financeRep', label: 'Finance Rep.' },
  { key: 'managerProcurement', label: 'Manager Procurement' }
];

const WidePopper = (props) => {
  const { style, ...rest } = props;
  return (
    <Popper
      {...rest}
      placement="bottom-start"
      style={{
        width: typeof window !== 'undefined' && window.innerWidth < 900 ? 'calc(100vw - 32px)' : 720,
        ...style
      }}
    />
  );
};

const WORKFLOW_STEPS = [
  'Draft', 'Pending Audit', 'Forwarded to Audit Director',
  'Send to CEO Office', 'Forwarded to CEO', 'Pending Finance',
  'Advance Issued', 'Payment Settled', 'Sent to Procurement', 'Completed'
];

const getStepIndex = (status) => {
  const idx = WORKFLOW_STEPS.indexOf(status);
  return idx >= 0 ? idx : 0;
};

const EMPTY_FORM = {
  vendor: '', approvalDate: new Date().toISOString().split('T')[0],
  expectedPurchaseDate: '', deliveryAddress: '', priority: 'Urgent',
  items: [{ description: '', specification: '', brand: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0, amount: 0 }],
  shippingCost: 0, notes: ''
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CashApprovalsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const theme = useTheme();

  const [approvalAuthority, setApprovalAuthority] = useState({
    preparedBy: '',
    verifiedBy: '',
    authorisedRep: '',
    financeRep: '',
    managerProcurement: ''
  });
  const authoritySearchDebounceRef = useRef(null);
  const [authoritySearchOptions, setAuthoritySearchOptions] = useState([]);
  const [authoritySearchLoading, setAuthoritySearchLoading] = useState(false);
  const [observationAnswers, setObservationAnswers] = useState({});

  const loadAuthorityApproverOptions = useCallback(async (q) => {
    try {
      setAuthoritySearchLoading(true);
      const res = await api.get('/indents/approver-candidates', {
        params: { search: q || '', limit: 50 }
      });
      setAuthoritySearchOptions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setAuthoritySearchOptions([]);
    } finally {
      setAuthoritySearchLoading(false);
    }
  }, []);

  const approverLabel = (u) => {
    if (!u) return '';
    const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return n || u.email || u.employeeId || '';
  };

  const handleAuthoritySearchInput = (value) => {
    if (authoritySearchDebounceRef.current) clearTimeout(authoritySearchDebounceRef.current);
    authoritySearchDebounceRef.current = setTimeout(() => {
      loadAuthorityApproverOptions(value);
    }, 300);
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cashApprovals, setCashApprovals] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dialogs
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', data: null });
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  const [actionDialog, setActionDialog] = useState({ open: false, type: '', ca: null });

  useEffect(() => {
    if (!formDialog.open) return;
    loadAuthorityApproverOptions('');
  }, [formDialog.open, loadAuthorityApproverOptions]);

  // Action form state
  const [actionComments, setActionComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [prefillQuotationId, setPrefillQuotationId] = useState(null);

  // ─── Load data ──────────────────────────────────────────────────────────────
  const loadCashApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await procurementService.getCashApprovals({ page: page + 1, limit: rowsPerPage, search, status: statusFilter });
      setCashApprovals(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError('Failed to load cash approvals');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter]);

  const loadVendors = useCallback(async () => {
    try {
      const res = await procurementService.getVendors({ limit: 500 });
      const list = res?.data?.vendors ?? res?.vendors;
      setVendors(Array.isArray(list) ? list : []);
    } catch {
      setVendors([]);
    }
  }, []);

  useEffect(() => { loadCashApprovals(); }, [loadCashApprovals]);
  useEffect(() => { loadVendors(); }, [loadVendors]);

  // Pre-fill from quotation (when navigated from Quotations page)
  useEffect(() => {
    if (location.state?.createFromQuotationId) {
      const qId = location.state.createFromQuotationId;
      setPrefillQuotationId(qId);
      setFormDialog({ open: true, mode: 'create', data: null });
      // Clear the state so back navigation doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // When form opens for create with a quotation ID, pre-fetch quotation
  useEffect(() => {
    if (formDialog.open && formDialog.mode === 'create' && prefillQuotationId) {
      (async () => {
        try {
          const res = await api.get(`/procurement/quotations/${prefillQuotationId}`);
          const q = res.data?.data || res.data;
          if (!q) return;
          const items = (q.items || []).map((item) => ({
            description: item.description || item.name || '',
            specification: item.specification || '',
            brand: item.brand || '',
            quantity: item.quantity || 1,
            unit: item.unit || 'pcs',
            unitPrice: item.unitPrice || item.price || 0,
            taxRate: item.taxRate || 0,
            discount: item.discount || 0,
            amount: ((item.quantity || 1) * (item.unitPrice || item.price || 0)) - (item.discount || 0)
          }));
          const csa = q.indent?.comparativeStatementApprovals || {};
          setFormData({
            ...EMPTY_FORM,
            vendor: q.vendor?._id || q.vendor || '',
            items: items.length ? items : EMPTY_FORM.items,
            notes: q.notes || ''
          });
          setApprovalAuthority({
            preparedBy: csa.preparedBy || '',
            verifiedBy: csa.verifiedBy || '',
            authorisedRep: csa.authorisedRep || '',
            financeRep: csa.financeRep || '',
            managerProcurement: csa.managerProcurement || ''
          });
        } catch { /* ignore, user can fill manually */ }
      })();
    } else if (formDialog.open && formDialog.mode === 'create' && !prefillQuotationId) {
      setFormData(EMPTY_FORM);
      setApprovalAuthority({ preparedBy: '', verifiedBy: '', authorisedRep: '', financeRep: '', managerProcurement: '' });
    } else if (formDialog.open && formDialog.mode === 'edit' && formDialog.data) {
      const ca = formDialog.data;
      setFormData({
        vendor: ca.vendor?._id || ca.vendor || '',
        approvalDate: ca.approvalDate ? new Date(ca.approvalDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        expectedPurchaseDate: ca.expectedPurchaseDate ? new Date(ca.expectedPurchaseDate).toISOString().split('T')[0] : '',
        deliveryAddress: ca.deliveryAddress || '',
        priority: ca.priority || 'Urgent',
        items: ca.items || EMPTY_FORM.items,
        shippingCost: ca.shippingCost || 0,
        notes: ca.notes || ''
      });
      const approvals = ca.approvalAuthorities || {};
      setApprovalAuthority({
        preparedBy: approvals.preparedBy || '',
        verifiedBy: approvals.verifiedBy || '',
        authorisedRep: approvals.authorisedRep || '',
        financeRep: approvals.financeRep || '',
        managerProcurement: approvals.managerProcurement || ''
      });
      if (ca.auditObservations && ca.auditObservations.length > 0) {
        const answers = {};
        ca.auditObservations.forEach((obs) => {
          if (obs.answer) answers[obs._id] = obs.answer;
        });
        setObservationAnswers(answers);
      } else {
        setObservationAnswers({});
      }
    }
  }, [formDialog.open, formDialog.mode, formDialog.data, prefillQuotationId]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const clearMessages = () => { setError(''); setSuccess(''); };
  const computeItemAmount = (item) => ((item.quantity || 0) * (item.unitPrice || 0)) - (item.discount || 0);
  const computeSubtotal = (items) => items.reduce((s, i) => s + computeItemAmount(i), 0);
  const computeTotal = (items, shippingCost) => {
    const sub = computeSubtotal(items);
    const tax = items.reduce((s, i) => {
      const base = computeItemAmount(i);
      return s + base * (i.taxRate || 0) / 100;
    }, 0);
    return sub + tax + (parseFloat(shippingCost) || 0);
  };

  // ─── Form handlers ────────────────────────────────────────────────────────────
  const handleItemChange = (idx, field, value) => {
    const items = [...formData.items];
    items[idx] = { ...items[idx], [field]: value };
    items[idx].amount = computeItemAmount(items[idx]);
    setFormData({ ...formData, items });
  };
  const addItem = () => setFormData({ ...formData, items: [...formData.items, { description: '', specification: '', brand: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0, amount: 0 }] });
  const removeItem = (idx) => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) });

  const handleFormSubmit = async () => {
    clearMessages();
    if (!formData.vendor) return setError('Vendor is required');
    if (!formData.expectedPurchaseDate) return setError('Expected purchase date is required');
    if (!formData.items.length || !formData.items[0].description) return setError('At least one item is required');
    setFormLoading(true);
    try {
      const payload = {
        ...formData,
        approvalAuthorities: { ...approvalAuthority },
        ...(prefillQuotationId && formDialog.mode === 'create' ? { quotationId: prefillQuotationId } : {})
      };
      if (formDialog.mode === 'create') {
        await procurementService.createCashApproval(payload);
        setSuccess('Cash Approval created successfully');
        setPrefillQuotationId(null);
      } else {
        await procurementService.updateCashApproval(formDialog.data._id, payload);
        setSuccess('Cash Approval updated successfully');
      }
      setFormDialog({ open: false, mode: 'create', data: null });
      setObservationAnswers({});
      loadCashApprovals();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save Cash Approval');
    } finally {
      setFormLoading(false);
    }
  };

  // ─── Action handlers ──────────────────────────────────────────────────────────
  const openAction = (type, ca) => { setActionDialog({ open: true, type, ca }); setActionComments(''); };
  const closeAction = () => { setActionDialog({ open: false, type: '', ca: null }); setActionComments(''); };

  const handleSendToAudit = async (id, ca = null) => {
    clearMessages();
    try {
      let payload = { comments: 'Sent to Pre-Audit' };
      if (ca && ca.auditObservations && ca.auditObservations.length > 0) {
        const answers = ca.auditObservations
          .filter((obs) => observationAnswers[obs._id] && String(observationAnswers[obs._id]).trim())
          .map((obs) => ({ observationId: obs._id, answer: String(observationAnswers[obs._id]).trim() }));
        if (answers.length > 0) payload.observationAnswers = answers;
      }
      await procurementService.caSendToAudit(id, payload);
      setSuccess('Cash approval sent to audit successfully. It will appear on the Pre-Audit page.');
      setObservationAnswers({});
      loadCashApprovals();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send cash approval to audit');
    }
  };

  const handleAction = async (extraData = {}) => {
    clearMessages();
    setActionLoading(true);
    const { type, ca } = actionDialog;
    try {
      switch (type) {
        case 'send-to-audit': {
          let payload = { comments: actionComments || 'Sent to Pre-Audit' };
          if (ca?.auditObservations?.length) {
            const answers = ca.auditObservations
              .filter((obs) => observationAnswers[obs._id] && String(observationAnswers[obs._id]).trim())
              .map((obs) => ({ observationId: obs._id, answer: String(observationAnswers[obs._id]).trim() }));
            if (answers.length) payload.observationAnswers = answers;
          }
          await procurementService.caSendToAudit(ca._id, payload);
          setObservationAnswers({});
          break;
        }
        case 'audit-approve': await procurementService.caAuditApprove(ca._id, { comments: actionComments, approvalComments: actionComments }); break;
        case 'forward-to-audit-director': await procurementService.caForwardToAuditDirector(ca._id, actionComments); break;
        case 'audit-reject': await procurementService.caAuditReject(ca._id, { rejectionComments: actionComments, comments: actionComments }); break;
        case 'audit-return': await procurementService.caAuditReturn(ca._id, { returnComments: actionComments, comments: actionComments }); break;
        case 'forward-to-ceo': await procurementService.caForwardToCeo(ca._id, actionComments); break;
        case 'ceo-secretariat-return': await procurementService.caCeoSecretariatReturn(ca._id, actionComments); break;
        case 'ceo-approve': await procurementService.caCeoApprove(ca._id, { comments: actionComments, ...extraData }); break;
        case 'ceo-reject': await procurementService.caCeoReject(ca._id, actionComments); break;
        case 'ceo-return': await procurementService.caCeoReturn(ca._id, actionComments); break;
        case 'issue-advance': await procurementService.caIssueAdvance(ca._id, extraData); break;
        case 'settle-payment': await procurementService.caSettlePayment(ca._id, extraData); break;
        case 'send-to-procurement': await procurementService.caSendToProcurement(ca._id, actionComments); break;
        case 'complete': await procurementService.caComplete(ca._id, actionComments); break;
        case 'cancel': await procurementService.caCancel(ca._id, actionComments); break;
        default: break;
      }
      setSuccess('Action completed successfully');
      closeAction();
      loadCashApprovals();
      if (viewDialog.open && viewDialog.data?._id === ca._id) {
        const updated = await procurementService.getCashApprovalById(ca._id);
        setViewDialog({ open: true, data: updated.data });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Determine what actions are available ─────────────────────────────────────
  const getAvailableActions = (ca) => {
    const role = user?.role;
    const isAdmin = ['super_admin', 'admin'].includes(role);
    const isProcurement = isAdmin || role === 'procurement_manager';
    const isFinance = isAdmin || role === 'finance_manager';
    const isCeoSecretariat = isAdmin || role === 'hr_manager' || role === 'higher_management';
    const isCeo = isAdmin || role === 'higher_management';
    const actions = [];
    switch (ca.status) {
      case 'Draft':
      case 'Returned from Audit':
      case 'Returned from CEO Office':
      case 'Returned from CEO Secretariat':
        if (isProcurement) {
          actions.push({ label: 'Send to Audit', type: 'send-to-audit', color: 'primary', icon: <SendIcon /> });
          actions.push({ label: 'Cancel', type: 'cancel', color: 'error', icon: <RejectIcon /> });
        }
        break;
      case 'Pending Audit':
      case 'Forwarded to Audit Director':
        break;
      case 'Send to CEO Office':
        if (isCeoSecretariat) {
          actions.push({ label: 'Forward to CEO', type: 'forward-to-ceo', color: 'primary', icon: <ForwardIcon /> });
          actions.push({ label: 'Return to Procurement', type: 'ceo-secretariat-return', color: 'warning', icon: <ReturnIcon /> });
        }
        break;
      case 'Forwarded to CEO':
        if (isCeo) {
          actions.push({ label: 'Approve', type: 'ceo-approve', color: 'success', icon: <ApproveIcon /> });
          actions.push({ label: 'Return', type: 'ceo-return', color: 'warning', icon: <ReturnIcon /> });
          actions.push({ label: 'Reject', type: 'ceo-reject', color: 'error', icon: <RejectIcon /> });
        }
        break;
      case 'Pending Finance':
        if (isFinance) {
          actions.push({ label: 'Issue Advance', type: 'issue-advance', color: 'success', icon: <CashIcon /> });
        }
        break;
      case 'Advance Issued':
        if (isFinance) {
          actions.push({ label: 'Settle Payment', type: 'settle-payment', color: 'primary', icon: <ReceiptIcon /> });
        }
        break;
      case 'Payment Settled':
        if (isFinance) {
          actions.push({ label: 'Send to Procurement', type: 'send-to-procurement', color: 'primary', icon: <SendIcon /> });
        }
        break;
      case 'Sent to Procurement':
        if (isProcurement) {
          actions.push({ label: 'Mark as Completed', type: 'complete', color: 'success', icon: <CompleteIcon /> });
        }
        break;
      default:
        break;
    }
    return actions;
  };

  // ─── Advance Issue Dialog State ───────────────────────────────────────────────
  const [advanceForm, setAdvanceForm] = useState({ advanceTo: null, advanceToName: '', advanceAmount: '', advancePaymentMethod: 'Cash', advanceVoucherNo: '', advanceRemarks: '' });
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    if (actionDialog.type === 'issue-advance') {
      api.get('/hr/employees?limit=300&isActive=true').then((r) => setEmployees(r.data?.data || [])).catch(() => setEmployees([]));
      setAdvanceForm({ advanceTo: null, advanceToName: '', advanceAmount: actionDialog.ca?.totalAmount || '', advancePaymentMethod: 'Cash', advanceVoucherNo: '', advanceRemarks: '' });
    }
  }, [actionDialog.type, actionDialog.ca]);

  const [settlementForm, setSettlementForm] = useState({ actualAmountSpent: '', settlementRemarks: '' });
  useEffect(() => {
    if (actionDialog.type === 'settle-payment') {
      setSettlementForm({ actualAmountSpent: actionDialog.ca?.advanceAmount || '', settlementRemarks: '' });
    }
  }, [actionDialog.type, actionDialog.ca]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Cash Approvals</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh"><IconButton onClick={loadCashApprovals}><RefreshIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
            setPrefillQuotationId(null);
            setApprovalAuthority({ preparedBy: '', verifiedBy: '', authorisedRep: '', financeRep: '', managerProcurement: '' });
            setFormDialog({ open: true, mode: 'create', data: null });
          }}>
            New Cash Approval
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={clearMessages}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={clearMessages}>{success}</Alert>}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField size="small" label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ minWidth: 200 }} />
          <TextField size="small" select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} sx={{ minWidth: 200 }}>
            <MenuItem value="">All Statuses</MenuItem>
            {Object.keys(STATUS_COLORS).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>

      {/* List Table */}
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>CA #</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Total Amount</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              ) : cashApprovals.length === 0 ? (
                <TableRow><TableCell colSpan={7} align="center">No cash approvals found</TableCell></TableRow>
              ) : cashApprovals.map((ca) => (
                <TableRow key={ca._id} hover>
                  <TableCell><Typography variant="body2" fontWeight={600}>{ca.caNumber}</Typography></TableCell>
                  <TableCell>{ca.vendor?.name || '—'}</TableCell>
                  <TableCell>{formatDate(ca.approvalDate)}</TableCell>
                  <TableCell>{formatPKR(ca.totalAmount)}</TableCell>
                  <TableCell>
                    <Chip label={ca.priority} size="small" color={ca.priority === 'Urgent' ? 'error' : ca.priority === 'High' ? 'warning' : 'default'} />
                  </TableCell>
                  <TableCell>
                    <Chip label={ca.status} size="small" color={STATUS_COLORS[ca.status] || 'default'} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="View"><IconButton size="small" onClick={() => setViewDialog({ open: true, data: ca })}><ViewIcon fontSize="small" /></IconButton></Tooltip>
                      {['Draft', 'Returned from Audit', 'Returned from CEO Office', 'Returned from CEO Secretariat'].includes(ca.status) && (
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => setFormDialog({ open: true, mode: 'edit', data: ca })}><EditIcon fontSize="small" /></IconButton></Tooltip>
                      )}
                      {['Draft', 'Returned from Audit', 'Returned from CEO Office', 'Returned from CEO Secretariat', 'Rejected'].includes(ca.status) && (
                        <Tooltip title="Send to Audit">
                          <IconButton size="small" color="primary" onClick={() => handleSendToAudit(ca._id, ca)}>
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Print"><IconButton size="small" onClick={() => navigate(`/procurement/cash-approvals/${ca._id}/print`)}><PrintIcon fontSize="small" /></IconButton></Tooltip>
                      {['Draft', 'Cancelled', 'Rejected'].includes(ca.status) && (
                        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: ca._id })}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={total} page={page}
          onPageChange={(e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </Paper>

      {/* ─── Create/Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={formDialog.open} onClose={() => { setFormDialog({ open: false, mode: 'create', data: null }); setPrefillQuotationId(null); setObservationAnswers({}); }} maxWidth="lg" fullWidth>
        <DialogTitle>{formDialog.mode === 'create' ? 'Create Cash Approval' : 'Edit Cash Approval'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={vendors}
                getOptionLabel={(v) => v.name || ''}
                value={vendors.find((v) => v._id === formData.vendor) || null}
                onChange={(_, v) => setFormData({ ...formData, vendor: v?._id || '' })}
                renderInput={(params) => <TextField {...params} label="Vendor *" size="small" />}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" type="date" label="Approval Date" InputLabelProps={{ shrink: true }}
                value={formData.approvalDate} onChange={(e) => setFormData({ ...formData, approvalDate: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" type="date" label="Expected Purchase Date *" InputLabelProps={{ shrink: true }}
                value={formData.expectedPurchaseDate} onChange={(e) => setFormData({ ...formData, expectedPurchaseDate: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Delivery Address"
                value={formData.deliveryAddress} onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" select label="Priority" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
                {['Low', 'Medium', 'High', 'Urgent'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" type="number" label="Shipping Cost"
                value={formData.shippingCost} onChange={(e) => setFormData({ ...formData, shippingCost: parseFloat(e.target.value) || 0 })} />
            </Grid>

            {/* Items */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={600} mb={1}>Items</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 200 }}>Description *</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Specification</TableCell>
                      <TableCell sx={{ minWidth: 100 }}>Brand</TableCell>
                      <TableCell sx={{ minWidth: 80 }}>Qty *</TableCell>
                      <TableCell sx={{ minWidth: 80 }}>Unit *</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Unit Price *</TableCell>
                      <TableCell sx={{ minWidth: 80 }}>Tax %</TableCell>
                      <TableCell sx={{ minWidth: 100 }}>Discount</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>Amount</TableCell>
                      <TableCell sx={{ width: 50 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formData.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell><TextField size="small" fullWidth value={item.description} onChange={(e) => handleItemChange(idx, 'description', e.target.value)} /></TableCell>
                        <TableCell><TextField size="small" fullWidth value={item.specification || ''} onChange={(e) => handleItemChange(idx, 'specification', e.target.value)} /></TableCell>
                        <TableCell><TextField size="small" fullWidth value={item.brand || ''} onChange={(e) => handleItemChange(idx, 'brand', e.target.value)} /></TableCell>
                        <TableCell><TextField size="small" type="number" value={item.quantity} onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)} inputProps={{ min: 0 }} /></TableCell>
                        <TableCell><TextField size="small" value={item.unit} onChange={(e) => handleItemChange(idx, 'unit', e.target.value)} /></TableCell>
                        <TableCell><TextField size="small" type="number" value={item.unitPrice} onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)} inputProps={{ min: 0 }} /></TableCell>
                        <TableCell><TextField size="small" type="number" value={item.taxRate || 0} onChange={(e) => handleItemChange(idx, 'taxRate', parseFloat(e.target.value) || 0)} inputProps={{ min: 0, max: 100 }} /></TableCell>
                        <TableCell><TextField size="small" type="number" value={item.discount || 0} onChange={(e) => handleItemChange(idx, 'discount', parseFloat(e.target.value) || 0)} inputProps={{ min: 0 }} /></TableCell>
                        <TableCell><Typography variant="body2">{formatPKR(item.amount || 0)}</Typography></TableCell>
                        <TableCell>
                          {formData.items.length > 1 && <IconButton size="small" color="error" onClick={() => removeItem(idx)}><DeleteIcon fontSize="small" /></IconButton>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button size="small" startIcon={<AddIcon />} onClick={addItem} sx={{ mt: 1 }}>Add Item</Button>
              <Box sx={{ mt: 1, textAlign: 'right' }}>
                <Typography variant="body2">Subtotal: <strong>{formatPKR(computeSubtotal(formData.items))}</strong></Typography>
                <Typography variant="body1" fontWeight={700}>Total: {formatPKR(computeTotal(formData.items, formData.shippingCost))}</Typography>
              </Box>
            </Grid>

            {/* Approval Authorities (same pattern as Purchase Orders) */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>Approval authorities</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Search active users (same directory as indents) or type a name/designation. Saved values are stored as text for print.
              </Typography>
              <Grid container spacing={2}>
                {CA_APPROVAL_AUTHORITY_FIELDS.map(({ key, label }) => (
                  <Grid item xs={12} sm={6} md={4} key={key}>
                    <Autocomplete
                      freeSolo
                      options={authoritySearchOptions}
                      loading={authoritySearchLoading}
                      value={approvalAuthority[key]}
                      onChange={(_, newValue) => {
                        if (newValue == null) {
                          setApprovalAuthority((prev) => ({ ...prev, [key]: '' }));
                        } else if (typeof newValue === 'string') {
                          setApprovalAuthority((prev) => ({ ...prev, [key]: newValue }));
                        } else {
                          setApprovalAuthority((prev) => ({ ...prev, [key]: approverLabel(newValue) }));
                        }
                      }}
                      onInputChange={(_, input, reason) => {
                        if (reason === 'input') {
                          handleAuthoritySearchInput(input);
                          setApprovalAuthority((prev) => ({ ...prev, [key]: input }));
                        }
                        if (reason === 'clear') {
                          setApprovalAuthority((prev) => ({ ...prev, [key]: '' }));
                          loadAuthorityApproverOptions('');
                        }
                      }}
                      getOptionLabel={(option) =>
                        typeof option === 'string' ? option : approverLabel(option)
                      }
                      filterOptions={(opts) => opts}
                      isOptionEqualToValue={(a, b) => {
                        if (a && b && typeof a === 'object' && typeof b === 'object') {
                          return a._id === b._id;
                        }
                        if (typeof a === 'string' && typeof b === 'string') return a === b;
                        return false;
                      }}
                      PopperComponent={WidePopper}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={label}
                          size="small"
                          placeholder="Search user or type name…"
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {authoritySearchLoading ? (
                                  <CircularProgress color="inherit" size={16} />
                                ) : null}
                                {params.InputProps.endAdornment}
                              </>
                            )
                          }}
                        />
                      )}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>

            {formDialog.mode === 'edit' && formDialog.data?.status === 'Returned from Audit' && formDialog.data?.auditObservations?.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Audit observations — respond before sending back to Pre-Audit</Typography>
                  {formDialog.data.auditReturnComments && (
                    <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>{formDialog.data.auditReturnComments}</Typography>
                  )}
                  {formDialog.data.auditObservations.map((obs, index) => (
                    <Box key={obs._id || index} sx={{ mb: 2, p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.06), borderRadius: 1 }}>
                      <Typography variant="caption" fontWeight={600}>Observation {index + 1}</Typography>
                      <Typography variant="body2" sx={{ my: 1 }}>{obs.observation}</Typography>
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        minRows={2}
                        label="Your response"
                        value={observationAnswers[obs._id] || ''}
                        onChange={(e) => setObservationAnswers((prev) => ({ ...prev, [obs._id]: e.target.value }))}
                      />
                    </Box>
                  ))}
                </Alert>
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField fullWidth size="small" multiline rows={3} label="Notes"
                value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setFormDialog({ open: false, mode: 'create', data: null }); setPrefillQuotationId(null); setObservationAnswers({}); }}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSubmit} disabled={formLoading}>
            {formLoading ? <CircularProgress size={20} /> : (formDialog.mode === 'create' ? 'Create' : 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── View Dialog ──────────────────────────────────────────────────────── */}
      {viewDialog.open && viewDialog.data && (
        <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, data: null })} maxWidth="md" fullWidth>
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={700}>{viewDialog.data.caNumber}</Typography>
                <Chip label={viewDialog.data.status} size="small" color={STATUS_COLORS[viewDialog.data.status] || 'default'} />
              </Box>
              <Button startIcon={<PrintIcon />} onClick={() => navigate(`/procurement/cash-approvals/${viewDialog.data._id}/print`)}>Print</Button>
            </Stack>
          </DialogTitle>
          <DialogContent>
            {/* Workflow progress */}
            <Box sx={{ mb: 3 }}>
              <Stepper activeStep={getStepIndex(viewDialog.data.status)} alternativeLabel>
                {WORKFLOW_STEPS.map((step) => (
                  <Step key={step}><StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.65rem' } }}>{step}</StepLabel></Step>
                ))}
              </Stepper>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Vendor</Typography><Typography fontWeight={600}>{viewDialog.data.vendor?.name || '—'}</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Total Amount</Typography><Typography fontWeight={600}>{formatPKR(viewDialog.data.totalAmount)}</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Approval Date</Typography><Typography>{formatDate(viewDialog.data.approvalDate)}</Typography></Grid>
              <Grid item xs={6}><Typography variant="caption" color="text.secondary">Expected Purchase Date</Typography><Typography>{formatDate(viewDialog.data.expectedPurchaseDate)}</Typography></Grid>
              {viewDialog.data.advanceAmount > 0 && (
                <>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Advance Amount</Typography><Typography fontWeight={600} color="primary">{formatPKR(viewDialog.data.advanceAmount)}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">Payment Method</Typography><Typography>{viewDialog.data.advancePaymentMethod}</Typography></Grid>
                  {viewDialog.data.advanceVoucherNo && <Grid item xs={6}><Typography variant="caption" color="text.secondary">Voucher No.</Typography><Typography>{viewDialog.data.advanceVoucherNo}</Typography></Grid>}
                  {viewDialog.data.advanceIssuedBy && <Grid item xs={6}><Typography variant="caption" color="text.secondary">Advance Issued By</Typography><Typography>{viewDialog.data.advanceIssuedBy?.firstName} {viewDialog.data.advanceIssuedBy?.lastName}</Typography></Grid>}
                </>
              )}
              {viewDialog.data.actualAmountSpent > 0 && (
                <>
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Actual Spent</Typography><Typography fontWeight={600}>{formatPKR(viewDialog.data.actualAmountSpent)}</Typography></Grid>
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Excess Returned</Typography><Typography color="success.main">{formatPKR(viewDialog.data.excessReturned)}</Typography></Grid>
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Additional Paid</Typography><Typography color="error.main">{formatPKR(viewDialog.data.additionalPaid)}</Typography></Grid>
                </>
              )}
            </Grid>

            {/* Items */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={600} mb={1}>Items</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell><TableCell>Description</TableCell><TableCell>Qty</TableCell>
                    <TableCell>Unit</TableCell><TableCell>Unit Price</TableCell><TableCell>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(viewDialog.data.items || []).map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{item.description}{item.specification && <Typography variant="caption" display="block" color="text.secondary">{item.specification}</Typography>}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{formatPKR(item.unitPrice)}</TableCell>
                      <TableCell>{formatPKR(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ mt: 1, textAlign: 'right' }}>
              <Typography variant="body2">Subtotal: {formatPKR(viewDialog.data.subtotal)}</Typography>
              {viewDialog.data.shippingCost > 0 && <Typography variant="body2">Shipping: {formatPKR(viewDialog.data.shippingCost)}</Typography>}
              <Typography variant="h6" fontWeight={700}>Total: {formatPKR(viewDialog.data.totalAmount)}</Typography>
            </Box>

            {/* Workflow history */}
            {viewDialog.data.workflowHistory?.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} mb={1}>Workflow History</Typography>
                <Stack spacing={1}>
                  {[...viewDialog.data.workflowHistory].reverse().map((h, i) => (
                    <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2"><strong>{h.fromStatus}</strong> → <strong>{h.toStatus}</strong></Typography>
                        <Typography variant="caption" color="text.secondary">{formatDate(h.changedAt)}</Typography>
                      </Stack>
                      {h.changedBy && <Typography variant="caption" color="text.secondary">By: {h.changedBy.firstName} {h.changedBy.lastName}</Typography>}
                      {h.comments && <Typography variant="body2" mt={0.5}>{h.comments}</Typography>}
                    </Paper>
                  ))}
                </Stack>
              </>
            )}

            {/* Available Actions */}
            {getAvailableActions(viewDialog.data).length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" fontWeight={600} mb={1}>Available Actions</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {getAvailableActions(viewDialog.data).map((action) => (
                    <Button key={action.type} size="small" variant="outlined" color={action.color} startIcon={action.icon}
                      onClick={() => openAction(action.type, viewDialog.data)}>
                      {action.label}
                    </Button>
                  ))}
                </Stack>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* ─── Action Dialogs ───────────────────────────────────────────────────── */}
      <Dialog open={actionDialog.open && !['issue-advance', 'settle-payment'].includes(actionDialog.type)} onClose={closeAction} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionDialog.type === 'send-to-audit' && 'Send to Audit'}
          {actionDialog.type === 'audit-approve' && 'Audit Approval'}
          {actionDialog.type === 'forward-to-audit-director' && 'Forward to Audit Director'}
          {actionDialog.type === 'audit-reject' && 'Reject by Audit'}
          {actionDialog.type === 'audit-return' && 'Return from Audit'}
          {actionDialog.type === 'forward-to-ceo' && 'Forward to CEO'}
          {actionDialog.type === 'ceo-secretariat-return' && 'Return from CEO Secretariat'}
          {actionDialog.type === 'ceo-approve' && 'CEO Approval'}
          {actionDialog.type === 'ceo-reject' && 'CEO Reject'}
          {actionDialog.type === 'ceo-return' && 'CEO Return'}
          {actionDialog.type === 'send-to-procurement' && 'Send to Procurement'}
          {actionDialog.type === 'complete' && 'Mark as Completed'}
          {actionDialog.type === 'cancel' && 'Cancel Cash Approval'}
        </DialogTitle>
        <DialogContent>
          {actionDialog.type === 'send-to-audit' && actionDialog.ca?.auditObservations?.length > 0 && (
            <Stack spacing={2} sx={{ mb: 2 }}>
              <Alert severity="info">Provide responses to audit observations (optional fields left blank are skipped).</Alert>
              {actionDialog.ca.auditObservations.map((obs, idx) => (
                <Box key={obs._id || idx}>
                  <Typography variant="caption" color="text.secondary">Observation {idx + 1}</Typography>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>{obs.observation}</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    label="Response"
                    value={observationAnswers[obs._id] || ''}
                    onChange={(e) => setObservationAnswers((prev) => ({ ...prev, [obs._id]: e.target.value }))}
                  />
                </Box>
              ))}
            </Stack>
          )}
          <TextField fullWidth multiline rows={3} label="Comments / Remarks" value={actionComments}
            onChange={(e) => setActionComments(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAction}>Cancel</Button>
          <Button variant="contained"
            color={['audit-reject', 'ceo-reject', 'cancel'].includes(actionDialog.type) ? 'error' : ['audit-return', 'ceo-return', 'ceo-secretariat-return'].includes(actionDialog.type) ? 'warning' : 'primary'}
            onClick={() => handleAction()} disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={20} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Issue Advance Dialog */}
      <Dialog open={actionDialog.open && actionDialog.type === 'issue-advance'} onClose={closeAction} maxWidth="sm" fullWidth>
        <DialogTitle>Issue Advance — {actionDialog.ca?.caNumber}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Alert severity="info">Total CA Amount: <strong>{formatPKR(actionDialog.ca?.totalAmount)}</strong></Alert>
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                options={employees}
                getOptionLabel={(e) => `${e.firstName || ''} ${e.lastName || ''} — ${e.designation || e.department || ''}`.trim()}
                onChange={(_, v) => setAdvanceForm({ ...advanceForm, advanceTo: v?._id || null, advanceToName: v ? `${v.firstName} ${v.lastName}` : '' })}
                renderInput={(params) => <TextField {...params} label="Advance To (Procurement Officer) *" size="small" />}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" type="number" label="Advance Amount *"
                value={advanceForm.advanceAmount} onChange={(e) => setAdvanceForm({ ...advanceForm, advanceAmount: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" select label="Payment Method" value={advanceForm.advancePaymentMethod}
                onChange={(e) => setAdvanceForm({ ...advanceForm, advancePaymentMethod: e.target.value })}>
                {['Cash', 'Bank Transfer', 'Cheque', 'Online Transfer'].map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth size="small" label="Voucher No." value={advanceForm.advanceVoucherNo}
                onChange={(e) => setAdvanceForm({ ...advanceForm, advanceVoucherNo: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" multiline rows={2} label="Remarks"
                value={advanceForm.advanceRemarks} onChange={(e) => setAdvanceForm({ ...advanceForm, advanceRemarks: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAction}>Cancel</Button>
          <Button variant="contained" color="success" onClick={() => handleAction({ ...advanceForm, advanceAmount: parseFloat(advanceForm.advanceAmount) })} disabled={actionLoading || !advanceForm.advanceAmount}>
            {actionLoading ? <CircularProgress size={20} /> : 'Issue Advance'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settle Payment Dialog */}
      <Dialog open={actionDialog.open && actionDialog.type === 'settle-payment'} onClose={closeAction} maxWidth="sm" fullWidth>
        <DialogTitle>Settle Payment — {actionDialog.ca?.caNumber}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Alert severity="info">Advance Issued: <strong>{formatPKR(actionDialog.ca?.advanceAmount)}</strong></Alert>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" type="number" label="Actual Amount Spent *"
                value={settlementForm.actualAmountSpent} onChange={(e) => setSettlementForm({ ...settlementForm, actualAmountSpent: e.target.value })} />
            </Grid>
            {settlementForm.actualAmountSpent && (
              <Grid item xs={12}>
                {parseFloat(settlementForm.actualAmountSpent) < (actionDialog.ca?.advanceAmount || 0) && (
                  <Alert severity="success">Excess to be returned: {formatPKR((actionDialog.ca?.advanceAmount || 0) - parseFloat(settlementForm.actualAmountSpent))}</Alert>
                )}
                {parseFloat(settlementForm.actualAmountSpent) > (actionDialog.ca?.advanceAmount || 0) && (
                  <Alert severity="warning">Additional amount required: {formatPKR(parseFloat(settlementForm.actualAmountSpent) - (actionDialog.ca?.advanceAmount || 0))}</Alert>
                )}
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField fullWidth size="small" multiline rows={2} label="Settlement Remarks"
                value={settlementForm.settlementRemarks} onChange={(e) => setSettlementForm({ ...settlementForm, settlementRemarks: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAction}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={() => handleAction({ ...settlementForm, actualAmountSpent: parseFloat(settlementForm.actualAmountSpent) })} disabled={actionLoading || !settlementForm.actualAmountSpent}>
            {actionLoading ? <CircularProgress size={20} /> : 'Settle Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null })} maxWidth="xs">
        <DialogTitle>Delete Cash Approval</DialogTitle>
        <DialogContent><Typography>Are you sure you want to delete this Cash Approval? This cannot be undone.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, id: null })}>Cancel</Button>
          <Button color="error" variant="contained" onClick={async () => {
            try {
              await procurementService.deleteCashApproval(deleteDialog.id);
              setSuccess('Deleted successfully');
              setDeleteDialog({ open: false, id: null });
              loadCashApprovals();
            } catch (err) {
              setError(err.response?.data?.message || 'Delete failed');
            }
          }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CashApprovalsPage;
