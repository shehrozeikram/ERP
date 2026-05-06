import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Tooltip, Chip, Alert, Stack, Divider, Grid,
  CircularProgress, Autocomplete, Stepper, Step, StepLabel,
  Card, CardContent, alpha, useTheme, Popper, Avatar
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Visibility as ViewIcon, Refresh as RefreshIcon,
  CheckCircle as ApproveIcon, Cancel as RejectIcon,
  Print as PrintIcon, Send as SendIcon, Undo as ReturnIcon,
  ArrowForward as ForwardIcon, MonetizationOn as CashIcon,
  Done as CompleteIcon,
  Search as SearchIcon, History as HistoryIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import procurementService from '../../services/procurementService';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { DigitalSignatureImage } from '../../components/common/DigitalSignatureImage';
import WorkflowHistoryDialog from '../../components/WorkflowHistoryDialog';
import { formatPKR } from '../../utils/currency';
import { useAuth } from '../../contexts/AuthContext';

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_COLORS = {
  'Draft': 'default',
  'Pending Approval': 'warning',
  'Pending Audit': 'warning',
  'Forwarded to Audit Director': 'info',
  'Send to CEO Office': 'info',
  'Forwarded to CEO': 'info',
  'Pending Finance': 'warning',
  'Advance Issued': 'primary',
  'Payment Settled': 'success',
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
  'Draft', 'Pending Approval', 'Pending Audit', 'Forwarded to Audit Director',
  'Send to CEO Office', 'Forwarded to CEO', 'Pending Finance',
  'Payment Settled', 'Sent to Procurement', 'Completed'
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
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statistics, setStatistics] = useState(null);

  // Dialogs
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', data: null });
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  const [actionDialog, setActionDialog] = useState({ open: false, type: '', ca: null });
  const [workflowHistoryDialog, setWorkflowHistoryDialog] = useState({ open: false, document: null });

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

  const loadStatistics = useCallback(async () => {
    try {
      const res = await procurementService.getCashApprovalStats();
      setStatistics(res?.success ? res.data : null);
    } catch {
      setStatistics(null);
    }
  }, []);

  // ─── Load data ──────────────────────────────────────────────────────────────
  const loadCashApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await procurementService.getCashApprovals({
        page: page + 1,
        limit: rowsPerPage,
        search,
        status: statusFilter,
        ...(priorityFilter ? { priority: priorityFilter } : {})
      });
      setCashApprovals(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError('Failed to load cash approvals');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter, priorityFilter]);

  const refreshList = useCallback(() => {
    loadCashApprovals();
    loadStatistics();
  }, [loadCashApprovals, loadStatistics]);

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
  useEffect(() => { loadStatistics(); }, [loadStatistics]);
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
            preparedBy: approverLabel(user) || '',
            verifiedBy: csa.verifiedBy || '',
            authorisedRep: csa.authorisedRep || '',
            financeRep: csa.financeRep || '',
            managerProcurement: csa.managerProcurement || ''
          });
        } catch { /* ignore, user can fill manually */ }
      })();
    } else if (formDialog.open && formDialog.mode === 'create' && !prefillQuotationId) {
      setFormData(EMPTY_FORM);
      setApprovalAuthority({
        preparedBy: approverLabel(user) || '',
        verifiedBy: '',
        authorisedRep: '',
        financeRep: '',
        managerProcurement: ''
      });
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
  }, [formDialog.open, formDialog.mode, formDialog.data, prefillQuotationId, user]);

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

  const calculateFormTotal = () => computeTotal(formData.items, formData.shippingCost);

  const numberToWords = (num) => {
    if (!num || num === 0) return 'Zero Rupees Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const convert = (n) => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : '');
      if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${convert(n % 100)}` : ''}`;
      if (n < 100000) return `${convert(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${convert(n % 1000)}` : ''}`;
      if (n < 10000000) return `${convert(Math.floor(n / 100000))} Lakh${n % 100000 ? ` ${convert(n % 100000)}` : ''}`;
      return `${convert(Math.floor(n / 10000000))} Crore${n % 10000000 ? ` ${convert(n % 10000000)}` : ''}`;
    };
    const amount = Math.floor(num);
    const paise = Math.round((num - amount) * 100);
    let result = `${convert(amount)} Rupees`;
    if (paise > 0) result += ` and ${convert(paise)} Paise`;
    return `${result} Only`;
  };

  const formatDateForPrint = (date) => {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(date);
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0.00';
    return parseFloat(num).toFixed(2);
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: 'info', Medium: 'default', High: 'warning', Urgent: 'error' };
    return colors[priority] || 'default';
  };

  const getCaStatusChipColor = (status) => STATUS_COLORS[status] || 'default';

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
      refreshList();
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
      refreshList();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send cash approval to audit');
    }
  };

  const handleAction = async (extraData = {}) => {
    clearMessages();
    setActionLoading(true);
    const { type, ca } = actionDialog;
    try {
      let actionRes = null;
      switch (type) {
        case 'send-to-audit': {
          let payload = { comments: actionComments || 'Sent to Pre-Audit' };
          if (ca?.auditObservations?.length) {
            const answers = ca.auditObservations
              .filter((obs) => observationAnswers[obs._id] && String(observationAnswers[obs._id]).trim())
              .map((obs) => ({ observationId: obs._id, answer: String(observationAnswers[obs._id]).trim() }));
            if (answers.length) payload.observationAnswers = answers;
          }
          actionRes = await procurementService.caSendToAudit(ca._id, payload);
          setObservationAnswers({});
          break;
        }
        case 'approve': actionRes = await procurementService.caApprove(ca._id, { comments: actionComments }); break;
        case 'reject': actionRes = await procurementService.caReject(ca._id, { rejectionComments: actionComments, comments: actionComments }); break;
        case 'audit-approve': actionRes = await procurementService.caAuditApprove(ca._id, { comments: actionComments, approvalComments: actionComments }); break;
        case 'forward-to-audit-director': actionRes = await procurementService.caForwardToAuditDirector(ca._id, actionComments); break;
        case 'audit-reject': actionRes = await procurementService.caAuditReject(ca._id, { rejectionComments: actionComments, comments: actionComments }); break;
        case 'audit-return': actionRes = await procurementService.caAuditReturn(ca._id, { returnComments: actionComments, comments: actionComments }); break;
        case 'forward-to-ceo': actionRes = await procurementService.caForwardToCeo(ca._id, actionComments); break;
        case 'ceo-secretariat-return': actionRes = await procurementService.caCeoSecretariatReturn(ca._id, actionComments); break;
        case 'ceo-approve': actionRes = await procurementService.caCeoApprove(ca._id, { comments: actionComments, ...extraData }); break;
        case 'ceo-reject': actionRes = await procurementService.caCeoReject(ca._id, actionComments); break;
        case 'ceo-return': actionRes = await procurementService.caCeoReturn(ca._id, actionComments); break;
        case 'issue-advance': actionRes = await procurementService.caIssueAdvance(ca._id, extraData); break;
        case 'send-to-procurement': actionRes = await procurementService.caSendToProcurement(ca._id, actionComments); break;
        case 'complete': actionRes = await procurementService.caComplete(ca._id, actionComments); break;
        case 'cancel': actionRes = await procurementService.caCancel(ca._id, actionComments); break;
        default: break;
      }
      setSuccess(actionRes?.message || 'Action completed successfully');
      closeAction();
      refreshList();
      if (viewDialog.open && viewDialog.data?._id === ca._id) {
        const updated = await procurementService.getCashApprovalById(ca._id);
        setViewDialog({ open: true, data: updated?.data ?? viewDialog.data });
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
    const hasModuleAccess = (moduleKey) => {
      const hasInRoleDoc = (roleDoc) => roleDoc?.isActive && Array.isArray(roleDoc?.permissions) &&
        roleDoc.permissions.some((p) => p?.module === moduleKey);
      if (hasInRoleDoc(user?.roleRef)) return true;
      if (Array.isArray(user?.roles) && user.roles.some((r) => hasInRoleDoc(r))) return true;
      return false;
    };
    const isAdmin = ['super_admin', 'admin'].includes(role);
    const uid = String(user?.id || user?._id || '');
    const csa = ca?.indent?.comparativeStatementApprovals || {};
    const authorityIds = [
      csa.preparedByUser?._id || csa.preparedByUser,
      csa.verifiedByUser?._id || csa.verifiedByUser,
      csa.authorisedRepUser?._id || csa.authorisedRepUser,
      csa.financeRepUser?._id || csa.financeRepUser,
      csa.managerProcurementUser?._id || csa.managerProcurementUser
    ].map((id) => String(id || '')).filter(Boolean);
    const chainIds = Array.isArray(ca?.indent?.comparativeApproval?.approvers)
      ? ca.indent.comparativeApproval.approvers.map((s) => String(s?.approver?._id || s?.approver || '')).filter(Boolean)
      : [];
    const authorityText = ca?.approvalAuthorities || {};
    const userTokens = [
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim().toLowerCase(),
      String(user?.email || '').trim().toLowerCase(),
      String(user?.employeeId || '').trim().toLowerCase()
    ].filter(Boolean);
    const textAssigned = [
      authorityText.preparedBy,
      authorityText.verifiedBy,
      authorityText.authorisedRep,
      authorityText.financeRep,
      authorityText.managerProcurement
    ].map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
    const isAssignedAuthority = (uid && [...authorityIds, ...chainIds].includes(uid)) || userTokens.some((t) => textAssigned.includes(t));
    const hasAlreadyApproved = Array.isArray(ca?.authorityApprovals)
      && ca.authorityApprovals.some((a) => String(a?.approver?._id || a?.approver || '') === uid);
    const isProcurement = isAdmin || role === 'procurement_manager' || hasModuleAccess('procurement');
    const isFinance = isAdmin || role === 'finance_manager' || hasModuleAccess('finance');
    const isCeoSecretariat = isAdmin || role === 'hr_manager' || role === 'higher_management' || hasModuleAccess('hr') || hasModuleAccess('general');
    const isCeo = isAdmin || role === 'higher_management' || hasModuleAccess('general');
    const actions = [];
    switch (ca.status) {
      case 'Pending Approval':
        if (isAssignedAuthority && !hasAlreadyApproved) {
          actions.push({ label: 'Approve', type: 'approve', color: 'success', icon: <ApproveIcon /> });
          actions.push({ label: 'Reject', type: 'reject', color: 'error', icon: <RejectIcon /> });
        }
        break;
      case 'Draft':
      case 'Returned from Audit':
      case 'Returned from CEO Office':
      case 'Returned from CEO Secretariat':
        if (isProcurement || isAssignedAuthority) {
          actions.push({ label: 'Send to Audit', type: 'send-to-audit', color: 'primary', icon: <SendIcon /> });
          actions.push({ label: 'Cancel', type: 'cancel', color: 'error', icon: <RejectIcon /> });
        }
        break;
      case 'Pending Audit':
      case 'Forwarded to Audit Director':
        break;
      case 'Send to CEO Office':
        if (isCeoSecretariat || isAssignedAuthority) {
          actions.push({ label: 'Forward to CEO', type: 'forward-to-ceo', color: 'primary', icon: <ForwardIcon /> });
          actions.push({ label: 'Return to Procurement', type: 'ceo-secretariat-return', color: 'warning', icon: <ReturnIcon /> });
        }
        break;
      case 'Forwarded to CEO':
        if (isCeo || isAssignedAuthority) {
          actions.push({ label: 'Approve', type: 'ceo-approve', color: 'success', icon: <ApproveIcon /> });
          actions.push({ label: 'Return', type: 'ceo-return', color: 'warning', icon: <ReturnIcon /> });
          actions.push({ label: 'Reject', type: 'ceo-reject', color: 'error', icon: <RejectIcon /> });
        }
        break;
      case 'Pending Finance':
        if (isFinance || isAssignedAuthority) {
          actions.push({ label: 'Issue Advance', type: 'issue-advance', color: 'success', icon: <CashIcon /> });
        }
        break;
      case 'Payment Settled':
        if (isFinance || isAssignedAuthority) {
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

  const stats = [
    {
      title: 'Total Cash Approvals',
      value: statistics?.totalCAs || 0,
      color: theme.palette.primary.main,
      bgColor: alpha(theme.palette.primary.main, 0.1)
    },
    {
      title: 'Total Value',
      value: formatPKR(statistics?.totalValue || 0),
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.1)
    },
    {
      title: 'Pending Audit',
      value: statistics?.byStatus?.find((s) => s._id === 'Pending Audit')?.count || 0,
      color: theme.palette.warning.main,
      bgColor: alpha(theme.palette.warning.main, 0.1)
    },
    {
      title: 'Completed',
      value: statistics?.byStatus?.find((s) => s._id === 'Completed')?.count || 0,
      color: theme.palette.info.main,
      bgColor: alpha(theme.palette.info.main, 0.1)
    }
  ];

  const handleView = async (ca) => {
    try {
      const res = await procurementService.getCashApprovalById(ca._id);
      const doc = res?.success ? res.data : ca;
      setViewDialog({ open: true, data: doc });
    } catch {
      setViewDialog({ open: true, data: ca });
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 56, height: 56 }}>
              <CashIcon fontSize="large" />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                Cash Approvals
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Manage cash advance approvals and finance workflow
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refreshList}>
              Refresh
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
              setPrefillQuotationId(null);
              setApprovalAuthority({
                preparedBy: approverLabel(user) || '',
                verifiedBy: '',
                authorisedRep: '',
                financeRep: '',
                managerProcurement: ''
              });
              setFormDialog({ open: true, mode: 'create', data: null });
            }}>
              New Cash Approval
            </Button>
          </Box>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={clearMessages}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }} onClose={clearMessages}>{success}</Alert>}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: stat.bgColor, color: stat.color, width: 48, height: 48 }}>
                    <CashIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="textSecondary">{stat.title}</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{stat.value}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search cash approvals..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth select size="small" label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
              <MenuItem value="">All Statuses</MenuItem>
              {Object.keys(STATUS_COLORS).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth select size="small" label="Priority" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(0); }}>
              <MenuItem value="">All Priorities</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Urgent">Urgent</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>CA Number</strong></TableCell>
                <TableCell><strong>Vendor</strong></TableCell>
                <TableCell><strong>Approval Date</strong></TableCell>
                <TableCell><strong>Expected Purchase</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Priority</strong></TableCell>
                <TableCell align="right"><strong>Total Amount</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center"><CircularProgress /></TableCell>
                </TableRow>
              ) : cashApprovals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="textSecondary">No cash approvals found</Typography>
                  </TableCell>
                </TableRow>
              ) : cashApprovals.map((ca) => (
                <TableRow key={ca._id} hover>
                  <TableCell>{ca.caNumber}</TableCell>
                  <TableCell>{ca.vendor?.name || 'N/A'}</TableCell>
                  <TableCell>{formatDate(ca.approvalDate)}</TableCell>
                  <TableCell>{formatDate(ca.expectedPurchaseDate)}</TableCell>
                  <TableCell>
                    <Chip label={ca.status} size="small" color={getCaStatusChipColor(ca.status)} />
                  </TableCell>
                  <TableCell>
                    <Chip label={ca.priority} size="small" color={getPriorityColor(ca.priority)} />
                  </TableCell>
                  <TableCell align="right">{formatPKR(ca.totalAmount)}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap">
                      <Tooltip title="View"><IconButton size="small" onClick={() => handleView(ca)}><ViewIcon fontSize="small" /></IconButton></Tooltip>
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
                      {/* Finance / Procurement stage quick-action buttons */}
                      {getAvailableActions(ca).filter(a => !['send-to-audit', 'cancel'].includes(a.type)).map((action) => (
                        <Tooltip key={action.type} title={action.label}>
                          <IconButton size="small" color={action.color} onClick={() => openAction(action.type, ca)}>
                            {action.icon}
                          </IconButton>
                        </Tooltip>
                      ))}
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
          component="div"
          count={total}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      {/* ─── Create/Edit Dialog (layout aligned with Purchase Orders) ───────── */}
      <Dialog
        open={formDialog.open}
        onClose={() => { setFormDialog({ open: false, mode: 'create', data: null }); setPrefillQuotationId(null); setObservationAnswers({}); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{formDialog.mode === 'create' ? 'Create Cash Approval' : 'Edit Cash Approval'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                required
              >
                {vendors.map((vendor) => (
                  <MenuItem key={vendor._id} value={vendor._id}>{vendor.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Priority" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
                <MenuItem value="Low">Low</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Urgent">Urgent</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth type="date" label="Approval Date" value={formData.approvalDate} onChange={(e) => setFormData({ ...formData, approvalDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth type="date" label="Expected Purchase Date" value={formData.expectedPurchaseDate} onChange={(e) => setFormData({ ...formData, expectedPurchaseDate: e.target.value })} InputLabelProps={{ shrink: true }} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Delivery Address" value={formData.deliveryAddress || ''} onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })} placeholder="Enter delivery address" multiline minRows={2} />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Items</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              </Box>
              {formData.items.map((item, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" label="Description" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} required />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth size="small" label="Specification" value={item.specification || ''} onChange={(e) => handleItemChange(index, 'specification', e.target.value)} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth size="small" label="Brand" value={item.brand || ''} onChange={(e) => handleItemChange(index, 'brand', e.target.value)} />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField fullWidth size="small" type="number" label="Quantity" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)} required />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField fullWidth size="small" label="Unit" value={item.unit} onChange={(e) => handleItemChange(index, 'unit', e.target.value)} required />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField fullWidth size="small" type="number" label="Unit Price" value={item.unitPrice} onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)} required />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField fullWidth size="small" type="number" label="Tax %" value={item.taxRate || 0} onChange={(e) => handleItemChange(index, 'taxRate', parseFloat(e.target.value) || 0)} />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField fullWidth size="small" type="number" label="Discount" value={item.discount || 0} onChange={(e) => handleItemChange(index, 'discount', parseFloat(e.target.value) || 0)} />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <IconButton color="error" onClick={() => removeItem(index)} disabled={formData.items.length === 1}>
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField fullWidth type="number" label="Shipping Cost" value={formData.shippingCost} onChange={(e) => setFormData({ ...formData, shippingCost: parseFloat(e.target.value) || 0 })} />
            </Grid>
            <Grid item xs={12} md={6} />
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                <Typography variant="h6" align="right">Total: {formatPKR(calculateFormTotal())}</Typography>
              </Paper>
            </Grid>

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
                        if (newValue == null) setApprovalAuthority((prev) => ({ ...prev, [key]: '' }));
                        else if (typeof newValue === 'string') setApprovalAuthority((prev) => ({ ...prev, [key]: newValue }));
                        else setApprovalAuthority((prev) => ({ ...prev, [key]: approverLabel(newValue) }));
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
                      getOptionLabel={(option) => (typeof option === 'string' ? option : approverLabel(option))}
                      filterOptions={(opts) => opts}
                      isOptionEqualToValue={(a, b) => {
                        if (a && b && typeof a === 'object' && typeof b === 'object') return a._id === b._id;
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
                                {authoritySearchLoading ? <CircularProgress color="inherit" size={16} /> : null}
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
              <TextField fullWidth multiline rows={2} label="Notes"
                value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setFormDialog({ open: false, mode: 'create', data: null }); setPrefillQuotationId(null); setObservationAnswers({}); }}>Cancel</Button>
          <Button variant="contained" onClick={handleFormSubmit} disabled={formLoading || !formData.vendor || !formData.expectedPurchaseDate || !formData.items.length || !formData.items[0].description}>
            {formLoading ? <CircularProgress size={20} /> : (formDialog.mode === 'create' ? 'Create' : 'Update')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── View Dialog (layout aligned with Purchase Order details) ─────────── */}
      {viewDialog.open && viewDialog.data && (
        <Dialog
          open={viewDialog.open}
          onClose={() => setViewDialog({ open: false, data: null })}
          maxWidth={false}
          fullWidth
          PaperProps={{
            sx: {
              width: '90%',
              maxWidth: '210mm',
              maxHeight: '95vh',
              m: 2,
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
          <DialogTitle sx={{ '@media print': { display: 'none' }, pb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Cash Approval Details</Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" size="small" startIcon={<HistoryIcon />} onClick={() => setWorkflowHistoryDialog({ open: true, document: viewDialog.data })}>Workflow History</Button>
                <Button variant="contained" size="small" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
              </Stack>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 0, overflow: 'auto', '@media print': { p: 0, overflow: 'visible' } }}>
            <Box className="print-content">
              <Box className="app-print-hide" sx={{ px: 2, pt: 1, pb: 2 }}>
                <Stepper activeStep={getStepIndex(viewDialog.data.status)} alternativeLabel>
                  {WORKFLOW_STEPS.map((step) => (
                    <Step key={step}><StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.65rem' } }}>{step}</StepLabel></Step>
                  ))}
                </Stepper>
              </Box>

              <Paper
                className="ca-print-page"
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
                    p: 1.25,
                    maxWidth: '100%',
                    backgroundColor: '#fff',
                    mx: 0,
                    width: '100%',
                    pageBreakInside: 'avoid'
                  }
                }}
              >
                <Typography variant="h4" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 3, fontSize: { xs: '1.8rem', print: '1.6rem' }, letterSpacing: 1 }}>
                  Cash Approval
                </Typography>

                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>Residencia</Typography>
                  <Typography sx={{ fontSize: '0.9rem', mb: 0.5 }}>1st Avenue 18 4 Islamabad</Typography>
                  <Typography sx={{ fontSize: '0.9rem' }}>1. Het Sne 1-8. Islamabad.</Typography>
                </Box>

                <Divider sx={{ my: 2.5, borderWidth: 1, borderColor: '#ccc' }} />

                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 3 }}>
                  <Box sx={{ width: '45%', fontSize: '0.9rem' }}>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>
                      {viewDialog.data.vendor?.name || 'Vendor Name'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6, mb: 2 }}>
                      {viewDialog.data.vendor?.address || 'Vendor Address'}
                    </Typography>
                    {viewDialog.data.indent?.indentNumber && (
                      <Typography sx={{ fontSize: '0.9rem' }}>
                        Indent# {viewDialog.data.indent.indentNumber}
                        {viewDialog.data.indent?.title ? ` — ${viewDialog.data.indent.title}` : ''}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ width: '50%', fontSize: '0.9rem', lineHeight: 2 }}>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>C.A No.:</Typography>
                      <Typography component="span">{viewDialog.data.caNumber}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Date:</Typography>
                      <Typography component="span">{formatDateForPrint(viewDialog.data.approvalDate)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Expected Purchase:</Typography>
                      <Typography component="span">{formatDateForPrint(viewDialog.data.expectedPurchaseDate)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Address:</Typography>
                      <Typography component="span">{viewDialog.data.deliveryAddress?.trim() || viewDialog.data.vendor?.address || '___________'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Priority:</Typography>
                      <Typography component="span">{viewDialog.data.priority}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Status:</Typography>
                      <Typography component="span">{viewDialog.data.status}</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '0.85rem', fontFamily: 'Arial, sans-serif' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '5%' }}>Sr</th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left' }}>Description</th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left' }}>Specification</th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left' }}>Brand</th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center' }}>Qty / Unit</th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right' }}>Rate</th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewDialog.data.items || []).length > 0 ? (
                        (viewDialog.data.items || []).map((item, index) => (
                          <tr key={index} style={{ border: '1px solid #000' }}>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>{index + 1}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', verticalAlign: 'top' }}>{item.description}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', verticalAlign: 'top' }}>{item.specification || '___________'}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', verticalAlign: 'top' }}>{item.brand || '___________'}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity} {item.unit}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', verticalAlign: 'top' }}>{formatNumber(item.unitPrice)}</td>
                            <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', verticalAlign: 'top' }}>{formatNumber(item.amount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>No items</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Box>

                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Box sx={{ width: '300px', fontSize: '0.9rem' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Shipping:</Typography>
                      <Typography component="span">{formatNumber(viewDialog.data.shippingCost || 0)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Total (Rupees):</Typography>
                      <Typography component="span">{formatNumber(viewDialog.data.totalAmount || 0)}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
                      Rupees {numberToWords(viewDialog.data.totalAmount || 0)}
                    </Typography>
                  </Box>
                </Box>

                {viewDialog.data.notes && (
                  <Box sx={{ mb: 3, border: '1px solid #ccc', p: 2, fontSize: '0.9rem' }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>Notes</Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewDialog.data.notes}</Typography>
                  </Box>
                )}

                <Box sx={{ mt: 4 }}>
                  {(() => {
                    const indent = viewDialog.data?.indent || {};
                    const approvals = indent?.comparativeStatementApprovals || {};
                    const personName = (user, fallback = '') => (
                      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
                      user?.email ||
                      fallback ||
                      '—'
                    );
                    const rows = [
                      { key: 'preparedBy', label: 'Prepared By', user: approvals.preparedByUser, fallback: viewDialog.data.approvalAuthorities?.preparedBy || approvals.preparedBy || '' },
                      { key: 'verifiedBy', label: 'Verified By (Procurement Committee)', user: approvals.verifiedByUser, fallback: viewDialog.data.approvalAuthorities?.verifiedBy || approvals.verifiedBy || '' },
                      { key: 'authorisedRep', label: 'Authorised Rep.', user: approvals.authorisedRepUser, fallback: viewDialog.data.approvalAuthorities?.authorisedRep || approvals.authorisedRep || '' },
                      { key: 'financeRep', label: 'Finance Rep.', user: approvals.financeRepUser, fallback: viewDialog.data.approvalAuthorities?.financeRep || approvals.financeRep || '' },
                      { key: 'managerProcurement', label: 'Manager Procurement', user: approvals.managerProcurementUser, fallback: viewDialog.data.approvalAuthorities?.managerProcurement || approvals.managerProcurement || '' }
                    ];
                    if (viewDialog.data?.preAuditInitialApprovedBy || viewDialog.data?.preAuditInitialApprovedAt) {
                      rows.push({
                        label: 'Pre-Audit Initial Approval',
                        user: viewDialog.data.preAuditInitialApprovedBy || null,
                        actedAt: viewDialog.data.preAuditInitialApprovedAt || null,
                        fallback: '—',
                        directApproval: true
                      });
                    }
                    if (viewDialog.data?.auditApprovedBy || viewDialog.data?.auditApprovedAt) {
                      rows.push({
                        label: 'Audit Final Approval',
                        user: viewDialog.data.auditApprovedBy || null,
                        actedAt: viewDialog.data.auditApprovedAt || null,
                        fallback: '—',
                        directApproval: true
                      });
                    }
                    const authorityApprovalHistory = Array.isArray(viewDialog.data?.workflowHistory)
                      ? [...viewDialog.data.workflowHistory]
                        .reverse()
                        .find((h) => h?.fromStatus === 'Pending Approval' && h?.toStatus === 'Pending Audit')
                      : null;
                    const authorityApprovedBy = viewDialog.data?.authorityApprovedBy || authorityApprovalHistory?.changedBy || null;
                    const authorityApprovedAt = viewDialog.data?.authorityApprovedAt || authorityApprovalHistory?.changedAt || null;
                    const authorityApprovals = Array.isArray(viewDialog.data?.authorityApprovals) ? viewDialog.data.authorityApprovals : [];
                    const authorityApprovalByKey = new Map(
                      authorityApprovals
                        .map((approval) => [String(approval?.authorityKey || '').trim(), approval])
                        .filter(([key]) => Boolean(key))
                    );
                    const normalizeToken = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
                    const getUserTokens = (u) => {
                      if (!u || typeof u !== 'object') return [];
                      return [
                        [u.firstName, u.lastName].filter(Boolean).join(' ').trim(),
                        u.email,
                        u.employeeId
                      ].map(normalizeToken).filter(Boolean);
                    };
                    const authorityTokens = getUserTokens(authorityApprovedBy);
                    const matchesAuthority = (value) => {
                      const token = normalizeToken(value);
                      if (!token || authorityTokens.length === 0) return false;
                      return authorityTokens.some((at) => at === token || at.includes(token) || token.includes(at));
                    };
                    let legacyAuthorityApplied = false;
                    return (
                      <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                              <TableCell sx={{ fontWeight: 700 }}>Authority</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Digital Signature</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Date &amp; Time</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rows.map((row) => {
                              const slotApproval = row?.key ? authorityApprovalByKey.get(row.key) : null;
                              let approvalUser = row.user;
                              let actedAt = row?.actedAt || null;
                              if (!row?.directApproval && slotApproval) {
                                approvalUser = slotApproval?.approver && typeof slotApproval.approver === 'object'
                                  ? slotApproval.approver
                                  : row.user;
                                actedAt = slotApproval?.approvedAt || null;
                              }
                              const rowAuthorityText = viewDialog.data?.approvalAuthorities?.[row.key] || approvals?.[row.key] || row.fallback || '';
                              const rowMatchesApprovedAuthority = matchesAuthority(rowAuthorityText) || matchesAuthority(personName(row.user, ''));
                              if (!row?.directApproval && !slotApproval && !legacyAuthorityApplied && (authorityApprovedBy || authorityApprovedAt) && rowMatchesApprovedAuthority) {
                                approvalUser = authorityApprovedBy || approvalUser;
                                actedAt = authorityApprovedAt || actedAt;
                                legacyAuthorityApplied = true;
                              }
                              return (
                                <TableRow key={row.label}>
                                  <TableCell sx={{ fontWeight: 600 }}>{row.label}</TableCell>
                                  <TableCell>{personName(approvalUser, row.fallback)}</TableCell>
                                  <TableCell>
                                    {actedAt && approvalUser?.digitalSignature ? (
                                      <DigitalSignatureImage userOrPath={approvalUser} alt={`${row.label} signature`} />
                                    ) : (
                                      <Typography variant="caption" color="text.secondary">—</Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>{actedAt ? formatDateTime(actedAt) : '—'}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    );
                  })()}
                </Box>
              </Paper>

              <Box className="app-print-hide" sx={{ px: 2, pb: 2 }}>
                {(viewDialog.data.advanceAmount > 0 || viewDialog.data.evidenceActualAmount > 0 || viewDialog.data.actualAmountSpent > 0) && (
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    {/* Finance Advance block */}
                    {viewDialog.data.advanceAmount > 0 && (
                      <>
                        <Grid item xs={12}><Divider><Typography variant="caption" color="text.secondary" fontWeight={600}>Finance — Advance Issued</Typography></Divider></Grid>
                        <Grid item xs={6}><Typography variant="caption" color="text.secondary">Advance Amount</Typography><Typography fontWeight={600} color="primary">{formatPKR(viewDialog.data.advanceAmount)}</Typography></Grid>
                        <Grid item xs={6}><Typography variant="caption" color="text.secondary">Payment Method</Typography><Typography>{viewDialog.data.advancePaymentMethod}</Typography></Grid>
                        {viewDialog.data.advanceVoucherNo && <Grid item xs={6}><Typography variant="caption" color="text.secondary">Voucher No.</Typography><Typography>{viewDialog.data.advanceVoucherNo}</Typography></Grid>}
                        {viewDialog.data.advanceIssuedBy && <Grid item xs={6}><Typography variant="caption" color="text.secondary">Issued By</Typography><Typography>{viewDialog.data.advanceIssuedBy?.firstName} {viewDialog.data.advanceIssuedBy?.lastName}</Typography></Grid>}
                      </>
                    )}
                    {/* Procurement evidence block */}
                    {viewDialog.data.evidenceActualAmount > 0 && (
                      <>
                        <Grid item xs={12}><Divider><Typography variant="caption" color="text.secondary" fontWeight={600}>Procurement — Purchase Evidence</Typography></Divider></Grid>
                        <Grid item xs={6}><Typography variant="caption" color="text.secondary">Amount Spent (reported)</Typography><Typography fontWeight={600} color="secondary.main">{formatPKR(viewDialog.data.evidenceActualAmount)}</Typography></Grid>
                        {viewDialog.data.purchaseInvoiceNo && <Grid item xs={6}><Typography variant="caption" color="text.secondary">Invoice / Receipt No.</Typography><Typography>{viewDialog.data.purchaseInvoiceNo}</Typography></Grid>}
                        {viewDialog.data.evidenceSubmittedBy && <Grid item xs={6}><Typography variant="caption" color="text.secondary">Submitted By</Typography><Typography>{viewDialog.data.evidenceSubmittedBy?.firstName} {viewDialog.data.evidenceSubmittedBy?.lastName}</Typography></Grid>}
                        {viewDialog.data.evidenceRemarks && <Grid item xs={12}><Typography variant="caption" color="text.secondary">Evidence Remarks</Typography><Typography variant="body2" sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider', mt: 0.5 }}>{viewDialog.data.evidenceRemarks}</Typography></Grid>}
                      </>
                    )}
                    {/* Finance settlement block */}
                    {viewDialog.data.actualAmountSpent > 0 && (
                      <>
                        <Grid item xs={12}><Divider><Typography variant="caption" color="text.secondary" fontWeight={600}>Finance — Settlement Confirmed</Typography></Divider></Grid>
                        <Grid item xs={4}><Typography variant="caption" color="text.secondary">Actual Spent</Typography><Typography fontWeight={600}>{formatPKR(viewDialog.data.actualAmountSpent)}</Typography></Grid>
                        <Grid item xs={4}><Typography variant="caption" color="text.secondary">Excess Returned</Typography><Typography color="success.main">{formatPKR(viewDialog.data.excessReturned)}</Typography></Grid>
                        <Grid item xs={4}><Typography variant="caption" color="text.secondary">Additional Paid</Typography><Typography color="error.main">{formatPKR(viewDialog.data.additionalPaid)}</Typography></Grid>
                        {viewDialog.data.financeVerificationNotes && <Grid item xs={12}><Typography variant="caption" color="text.secondary">Finance Verification Notes</Typography><Typography variant="body2">{viewDialog.data.financeVerificationNotes}</Typography></Grid>}
                      </>
                    )}
                  </Grid>
                )}

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
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ '@media print': { display: 'none' } }}>
            <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      <Box
        component="style"
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: A4; margin: 8mm; }
              body * { visibility: hidden; }
              .MuiDialog-container, .MuiDialog-container *, .MuiDialog-paper, .MuiDialog-paper *,
              .print-content, .print-content * { visibility: visible; }
              .app-print-hide { display: none !important; visibility: hidden !important; }
              .MuiDialog-container {
                position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important;
                display: block !important; padding: 0 !important; margin: 0 !important; overflow: visible !important;
              }
              .MuiDialog-paper {
                box-shadow: none !important; margin: 0 !important; max-width: 100% !important; width: 100% !important;
                height: auto !important; max-height: none !important; position: relative !important; transform: none !important; overflow: visible !important;
              }
              .MuiDialogContent-root { overflow: visible !important; padding: 0 !important; height: auto !important; max-height: none !important; margin: 0 !important; }
              .MuiDialogTitle-root { display: none !important; }
              .MuiDialogActions-root { display: none !important; }
              .MuiBackdrop-root { display: none !important; }
              .ca-print-page { page-break-inside: avoid !important; }
              .ca-print-page table th, .ca-print-page table td { padding-top: 6px !important; padding-bottom: 6px !important; }
            }
          `
        }}
      />

      <WorkflowHistoryDialog
        open={workflowHistoryDialog.open}
        onClose={() => setWorkflowHistoryDialog({ open: false, document: null })}
        document={workflowHistoryDialog.document}
        documentType="document"
      />

      {/* ─── Action Dialogs ───────────────────────────────────────────────────── */}
      <Dialog open={actionDialog.open && !['issue-advance'].includes(actionDialog.type)} onClose={closeAction} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionDialog.type === 'send-to-audit' && 'Send to Audit'}
          {actionDialog.type === 'approve' && 'Approve Cash Approval'}
          {actionDialog.type === 'reject' && 'Reject Cash Approval'}
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
            color={['reject', 'audit-reject', 'ceo-reject', 'cancel'].includes(actionDialog.type) ? 'error' : ['audit-return', 'ceo-return', 'ceo-secretariat-return'].includes(actionDialog.type) ? 'warning' : 'primary'}
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
              refreshList();
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
