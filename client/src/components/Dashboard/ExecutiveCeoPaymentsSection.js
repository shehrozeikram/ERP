import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Tooltip,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Tabs,
  Tab,
  Divider,
  alpha,
  useTheme,
  Avatar
} from '@mui/material';
import {
  Visibility as ViewIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Close as CloseIcon,
  AttachMoney as AttachMoneyIcon,
  Print as PrintIcon,
  Add as AddIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  VerifiedUser as VerifiedUserIcon,
  AccountBalanceWallet as WalletIcon,
  ReceiptLong as ReceiptIcon,
  ShoppingBag as ShoppingBagIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import paymentSettlementService from '../../services/paymentSettlementService';
import api from '../../services/api';
import nonEmployeeService from '../../services/nonEmployeeService';
import { formatPKR } from '../../utils/currency';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import WorkflowHistoryDialog from '../WorkflowHistoryDialog';
import { DigitalSignatureImage, ProcurementDigitalSignaturesRow } from '../common/DigitalSignatureImage';
import CashApprovalDetailTabsView from '../Procurement/CashApprovalDetailTabsView';
import CashApprovalGeneralDetailShell from '../CashApprovals/CashApprovalGeneralDetailShell';
import { isGeneralModuleCashApproval } from '../CashApprovals/cashApprovalGeneralDocumentUtils';
import ComparativeStatementView from '../Procurement/ComparativeStatementView';
import { WorkflowAuditFeedbackPanel } from '../Admin/workflowAuditReturn';

const ExecutiveCeoPaymentsSection = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  /** Profile digital signature applied automatically on CEO approve/reject/return */
  const getAutoDigitalSignature = useCallback(() => {
    return (
      user?.digitalSignature ||
      (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '') ||
      user?.email ||
      'CEO'
    );
  }, [user]);

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [filterTab, setFilterTab] = useState(0); // 0: All, 1: PO, 2: CA, 3: Settlement
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [viewDialog, setViewDialog] = useState({
    open: false,
    settlement: null,
    isPurchaseOrder: false,
    isCashApproval: false,
    quotations: [],
    caLinkedDocs: [],
    poQuotations: [],
    poGrns: [],
    poLinkedDocs: [],
    poAuditTab: 0,
    isOnboarding: false
  });

  const [imageViewer, setImageViewer] = useState({
    open: false,
    imageUrl: '',
    imageName: '',
    isBlob: false
  });

  const [approveDialog, setApproveDialog] = useState({ open: false, settlement: null });
  const [rejectDialog, setRejectDialog] = useState({ open: false, settlement: null });
  const [returnDialog, setReturnDialog] = useState({ open: false, settlement: null });
  const [workflowHistoryDialog, setWorkflowHistoryDialog] = useState({ open: false, settlement: null });

  // Form states for approval/rejection/return (signature comes from profile automatically)
  const [approvalComments, setApprovalComments] = useState('');
  const [approvalAgree, setApprovalAgree] = useState(false);

  const [rejectionComments, setRejectionComments] = useState('');
  const [rejectionAgree, setRejectionAgree] = useState(false);
  const [rejectObservations, setRejectObservations] = useState([{ observation: '', severity: 'medium' }]);

  const [returnComments, setReturnComments] = useState('');
  const [returnAgree, setReturnAgree] = useState(false);
  const [returnObservations, setReturnObservations] = useState([{ observation: '', severity: 'medium' }]);

  // Fetch all items currently Forwarded to CEO
  const fetchCeoPayments = useCallback(async () => {
    try {
      setLoading(true);
      const [settlementsRes, poRes, caRes, onboardingRes] = await Promise.all([
        paymentSettlementService.getPaymentSettlements({ page: 1, limit: 100 }),
        api.get('/procurement/purchase-orders/ceo-secretariat').catch(() => ({ data: { data: [] } })),
        api.get('/cash-approvals/ceo-secretariat').catch(() => ({ data: { data: [] } })),
        nonEmployeeService.getForCEO().catch(() => ({ data: { data: [] } }))
      ]);

      // 1. Payment Settlements
      const rawSettlements = settlementsRes.data?.settlements || [];
      const forwardedSettlements = rawSettlements
        .filter((s) => s.workflowStatus === 'Forwarded to CEO')
        .map((s) => ({
          ...s,
          isPaymentSettlement: true,
          itemType: 'Payment Settlement',
          typeLabel: 'Settlement',
          displayRef: s.referenceNumber || s._id,
          displayDate: s.date,
          displayAmount: s.grandTotal || s.amount || 0,
          displayVendor: s.toWhomPaid || s.custodian || '—',
          displayNotes: s.forWhat || s.notes || 'Payment Settlement',
          department: s.fromDepartment || 'Administration'
        }));

      // 2. Purchase Orders
      const rawPOs = poRes.data?.data || [];
      const forwardedPOs = rawPOs
        .filter((po) => po.status === 'Forwarded to CEO' || po.workflowStatus === 'Forwarded to CEO')
        .map((po) => ({
          ...po,
          isPurchaseOrder: true,
          itemType: 'Purchase Order',
          typeLabel: 'Purchase Order',
          displayRef: po.orderNumber || po._id,
          displayDate: po.orderDate,
          displayAmount: po.totalAmount || 0,
          displayVendor: po.vendor?.name || 'Vendor',
          displayNotes: po.notes || (po.indent?.title ? `PR: ${po.indent.title}` : 'Purchase Order'),
          department: 'Procurement'
        }));

      // 3. Cash Approvals
      const rawCAs = caRes.data?.data || [];
      const forwardedCAs = rawCAs
        .filter((ca) => ca.status === 'Forwarded to CEO' || ca.workflowStatus === 'Forwarded to CEO')
        .map((ca) => ({
          ...ca,
          isCashApproval: true,
          itemType: 'Cash Approval',
          typeLabel: 'Cash Approval',
          displayRef: ca.caNumber || ca._id,
          displayDate: ca.approvalDate || ca.createdAt,
          displayAmount: ca.totalAmount || 0,
          displayVendor: ca.vendor?.name || ca.vendorName || ca.initiator?.name || 'Beneficiary',
          displayNotes: ca.notes || ca.title || 'Cash Advance Approval',
          department: ca.originatingModule === 'general' ? 'General' : 'Procurement'
        }));

      // 4. Non-Employee Onboardings
      const rawOnboardings = onboardingRes.data?.data || [];
      const forwardedOnboardings = rawOnboardings.map((ne) => ({
        ...ne,
        isOnboarding: true,
        itemType: 'Onboarding',
        typeLabel: 'Onboarding',
        displayRef: ne.recordNumber || ne._id,
        displayDate: ne.initiatedAt || ne.createdAt,
        displayAmount: ne.expectedWages || 0,
        displayVendor: `${ne.firstName} ${ne.lastName || ''}`,
        displayNotes: `Role: ${ne.role}, CNIC: ${ne.cnic}`,
        department: 'HR'
      }));

      const combined = [...forwardedPOs, ...forwardedCAs, ...forwardedSettlements, ...forwardedOnboardings];
      combined.sort((a, b) => new Date(b.displayDate || 0) - new Date(a.displayDate || 0));

      setPayments(combined);
    } catch (err) {
      console.error('Error loading CEO payments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCeoPayments();
  }, [fetchCeoPayments]);

  // Derived metrics
  const poItems = payments.filter((p) => p.isPurchaseOrder);
  const caItems = payments.filter((p) => p.isCashApproval);
  const settlementItems = payments.filter((p) => p.isPaymentSettlement);
  const onboardingItems = payments.filter((p) => p.isOnboarding);

  const totalAmount = payments.reduce((sum, p) => sum + (Number(p.displayAmount) || 0), 0);
  const poAmount = poItems.reduce((sum, p) => sum + (Number(p.displayAmount) || 0), 0);
  const caAmount = caItems.reduce((sum, p) => sum + (Number(p.displayAmount) || 0), 0);
  const setAmount = settlementItems.reduce((sum, p) => sum + (Number(p.displayAmount) || 0), 0);

  // Filtered list
  const filteredPayments = payments.filter((p) => {
    if (filterTab === 1 && !p.isPurchaseOrder) return false;
    if (filterTab === 2 && !p.isCashApproval) return false;
    if (filterTab === 3 && !p.isPaymentSettlement) return false;
    if (filterTab === 4 && !p.isOnboarding) return false;
    return true;
  });

  // Helpers matching Payments.js
  const formatDateForPrint = (date) => {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(date);
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const formatDateForDocument = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear().toString().slice(-2);
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0.00';
    return parseFloat(num).toFixed(2);
  };

  const getCompanyValue = (item) => {
    if (!item) return '—';
    if (typeof item.parentCompanyName === 'string' && item.parentCompanyName.trim()) {
      return item.parentCompanyName.trim();
    }
    if (typeof item.company === 'string' && item.company.trim()) {
      return item.company.trim();
    }
    if (item.company && typeof item.company === 'object' && item.company.name) {
      return item.company.name.trim();
    }
    if (typeof item.companyName === 'string' && item.companyName.trim()) {
      return item.companyName.trim();
    }
    if (item.placementCompany && typeof item.placementCompany === 'object' && item.placementCompany.name) {
      return item.placementCompany.name.trim();
    }
    if (typeof item.subsidiaryName === 'string' && item.subsidiaryName.trim()) {
      return item.subsidiaryName.trim();
    }
    if (item.indent?.company) {
      if (typeof item.indent.company === 'string' && item.indent.company.trim()) {
        return item.indent.company.trim();
      }
      if (typeof item.indent.company === 'object' && item.indent.company.name) {
        return item.indent.company.name.trim();
      }
    }
    if (typeof item.indent?.companyName === 'string' && item.indent.companyName.trim()) {
      return item.indent.companyName.trim();
    }
    return '—';
  };

  const numberToWords = (num) => {
    if (!num || num === 0) return 'Zero Rupees Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    const convert = (n) => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };

    const amount = Math.floor(num);
    const paise = Math.round((num - amount) * 100);
    let result = convert(amount) + ' Rupees';
    if (paise > 0) result += ' and ' + convert(paise) + ' Paise';
    result += ' Only';
    return result;
  };

  const getWorkflowStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'default';
      case 'Send to CEO Office': return 'info';
      case 'Forwarded to CEO': return 'warning';
      case 'Approved by CEO': return 'success';
      case 'Rejected by CEO': return 'error';
      case 'Returned from CEO Office': return 'warning';
      default: return 'default';
    }
  };

  const userDisplayName = (u) => {
    if (!u) return '';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '';
  };

  // Full Audit / View Opener (identical to Payments.js)
  const openView = async (settlement) => {
    if (settlement.isPurchaseOrder) {
      const baseFlags = {
        isPurchaseOrder: true,
        isCashApproval: false,
        isOnboarding: false,
        isPaymentSettlement: false
      };
      const buildLinkedDocs = (poData, quotations = []) => {
        const poLinkedDocs = [];
        const pushDocs = (items = [], source = 'Attachment') => {
          (items || []).forEach((item, idx) => {
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
        pushDocs(poData?.attachments, 'PO Attachment');
        pushDocs(poData?.indent?.attachments, 'Indent Attachment');
        quotations.forEach((q) => pushDocs(q?.attachments, `Quotation ${q?.quotationNumber || ''}`.trim()));
        return poLinkedDocs;
      };

      try {
        const r = await api.get(`/procurement/purchase-orders/${settlement._id}`);
        const d = {
          ...withCeoDocTypeFlags({ ...settlement, ...(r.data?.data || {}) }, baseFlags)
        };
        const indentId = d?.indent?._id || d?.indent;
        const [qRes, grnRes] = await Promise.all([
          indentId
            ? api.get(`/procurement/quotations/by-indent/${indentId}`).catch(() => ({ data: { data: [] } }))
            : Promise.resolve({ data: { data: [] } }),
          api.get('/procurement/goods-receive', { params: { purchaseOrder: d._id, limit: 100 } }).catch(() => ({ data: { data: { receives: [] } } }))
        ]);
        const poQuotations = Array.isArray(qRes?.data?.data) ? qRes.data.data : [];
        const poGrns = Array.isArray(grnRes?.data?.data?.receives) ? grnRes.data.data.receives : [];
        setViewDialog({
          open: true,
          settlement: d,
          isPurchaseOrder: true,
          isCashApproval: false,
          isOnboarding: false,
          poQuotations,
          poGrns,
          poLinkedDocs: buildLinkedDocs(d, poQuotations),
          poAuditTab: 0
        });
      } catch (e) {
        console.error('Error fetching purchase order details:', e);
        // Fallback: list payload may already include populated indent from ceo-secretariat
        const fallback = withCeoDocTypeFlags(settlement, baseFlags);
        let poQuotations = [];
        const indentId = fallback?.indent?._id || (typeof fallback?.indent === 'string' ? fallback.indent : null);
        if (indentId) {
          try {
            const qRes = await api.get(`/procurement/quotations/by-indent/${indentId}`);
            poQuotations = Array.isArray(qRes?.data?.data) ? qRes.data.data : [];
          } catch (_) { /* ignore */ }
        }
        setViewDialog({
          open: true,
          settlement: fallback,
          isPurchaseOrder: true,
          isCashApproval: false,
          isOnboarding: false,
          poQuotations,
          poGrns: [],
          poLinkedDocs: buildLinkedDocs(fallback, poQuotations),
          poAuditTab: 0
        });
      }
    } else if (settlement.isCashApproval) {
      try {
        const r = await api.get(`/cash-approvals/${settlement._id}`);
        const d = r.data?.data || settlement;
        let quotations = [];
        const linkedDocuments = [];
        const pushDocs = (items = [], source = 'Attachment') => {
          items.forEach((item, idx) => {
            const url = item?.url || '';
            const name = item?.originalName || item?.filename || `Document ${idx + 1}`;
            if (!name && !url) return;
            linkedDocuments.push({
              id: item?._id || `${source}-${idx}`,
              source,
              name,
              url,
              uploadedAt: item?.uploadedAt || null,
              mimeType: item?.mimeType || ''
            });
          });
        };
        if (d?.indent?._id) {
          try {
            const qRes = await api.get(`/procurement/quotations/by-indent/${d.indent._id}`);
            if (qRes.data?.success && Array.isArray(qRes.data.data)) {
              quotations = qRes.data.data;
            }
          } catch (_) { /* ignore */ }
        }
        pushDocs(d?.attachments, 'General Attachment');
        pushDocs(d?.purchaseReceipts, 'Purchase Receipt');
        pushDocs(d?.receiptAttachments, 'Settlement Receipt');
        setViewDialog({ open: true, settlement: d, isPurchaseOrder: false, isCashApproval: true, isOnboarding: false, quotations, caLinkedDocs: linkedDocuments, poAuditTab: 0 });
      } catch (e) {
        console.error('Error fetching cash approval details:', e);
        setViewDialog({ open: true, settlement, isPurchaseOrder: false, isCashApproval: true, isOnboarding: false, quotations: [], caLinkedDocs: [], poAuditTab: 0 });
      }
    } else if (settlement.isOnboarding) {
      setViewDialog({ 
        open: true, 
        settlement, 
        isPurchaseOrder: false, 
        isCashApproval: false, 
        isOnboarding: true,
        poAuditTab: 0 
      });
    } else {
      try {
        const response = await paymentSettlementService.getPaymentSettlement(settlement._id);
        const settlementData = response.data.data || response.data;
        if (settlementData.isPurchaseOrder || (settlementData.referenceNumber && settlementData.referenceNumber.startsWith('P'))) {
          try {
            let poResponse;
            if (settlementData.isPurchaseOrder && settlement._id) {
              poResponse = await api.get(`/procurement/purchase-orders/${settlement._id}`);
            } else if (settlementData.referenceNumber) {
              const searchResponse = await api.get(`/procurement/purchase-orders?search=${settlementData.referenceNumber}`);
              if (searchResponse.data?.data?.length > 0) {
                poResponse = await api.get(`/procurement/purchase-orders/${searchResponse.data.data[0]._id}`);
              }
            }
            if (poResponse?.data?.success) {
              const poData = poResponse.data.data;
              const [qRes, grnRes] = await Promise.all([
                poData?.indent?._id
                  ? api.get(`/procurement/quotations/by-indent/${poData.indent._id}`).catch(() => ({ data: { data: [] } }))
                  : Promise.resolve({ data: { data: [] } }),
                api.get('/procurement/goods-receive', { params: { purchaseOrder: poData._id, limit: 100 } }).catch(() => ({ data: { data: { receives: [] } } }))
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
              pushDocs(poData?.attachments, 'PO Attachment');
              pushDocs(poData?.indent?.attachments, 'Indent Attachment');
              poQuotations.forEach((q) => pushDocs(q?.attachments, `Quotation ${q?.quotationNumber || ''}`.trim()));
              setViewDialog({
                open: true,
                settlement: poData,
                isPurchaseOrder: true,
                isCashApproval: false,
                poQuotations,
                poGrns,
                poLinkedDocs,
                poAuditTab: 0
              });
            } else {
              setViewDialog({ open: true, settlement: settlementData, isPurchaseOrder: false, isCashApproval: false });
            }
          } catch (poError) {
            setViewDialog({ open: true, settlement: settlementData, isPurchaseOrder: false, isCashApproval: false });
          }
        } else {
          setViewDialog({ open: true, settlement: settlementData, isPurchaseOrder: false, isCashApproval: false });
        }
      } catch (error) {
        console.error('Error fetching settlement details:', error);
        setViewDialog({ open: true, settlement, isPurchaseOrder: false, isCashApproval: false });
      }
    }
  };

  // Purchase Order View Component (identical to Payments.js)
  const PurchaseOrderView = ({ poData }) => {
    const observations = (poData?.auditObservations && poData.auditObservations.length > 0)
      ? poData.auditObservations
      : (poData?.auditRejectObservations || []).map((obs, idx) => ({
          observation: typeof obs === 'object' ? obs.observation : obs,
          severity: typeof obs === 'object' ? (obs.severity || 'medium') : 'medium',
          addedBy: poData.auditRejectedBy,
          addedAt: poData.auditRejectedAt,
          answer: null,
          answeredBy: null,
          answeredAt: null,
          resolved: false
        }));
    const hasObservations = Array.isArray(observations) && observations.length > 0;
    const hasChangeSummary = poData?.resubmissionChangeSummary && String(poData.resubmissionChangeSummary).trim().length > 0;
    const auth = poData?.approvalAuthorities || {};

    return (
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

        {hasObservations && (
          <Box sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.08), border: '1px solid', borderColor: 'warning.main', borderRadius: 1 }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'warning.dark', fontWeight: 'bold' }}>
              Audit Observations &amp; Procurement Responses
            </Typography>
            {poData.auditReturnComments && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Return Comments:</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                  {poData.auditReturnComments}
                </Typography>
              </Box>
            )}
            {poData.auditRejectionComments && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Rejection Comments:</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                  {poData.auditRejectionComments}
                </Typography>
              </Box>
            )}
            {hasChangeSummary && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: alpha(theme.palette.info.main, 0.08), borderRadius: 1, border: '1px solid', borderColor: 'info.light' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: 'info.dark' }}>
                  Changes made to PO by Procurement (on resubmission):
                </Typography>
                <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.875rem', m: 0 }}>
                  {poData.resubmissionChangeSummary}
                </Typography>
              </Box>
            )}
            {observations.map((obs, index) => (
              <Box key={obs._id || index} sx={{ mb: 2, p: 1.5, bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'warning.light' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Observation {index + 1}</Typography>
                  {obs.severity && (
                    <Chip
                      label={String(obs.severity).charAt(0).toUpperCase() + String(obs.severity).slice(1)}
                      size="small"
                      color={obs.severity === 'critical' ? 'error' : obs.severity === 'high' ? 'warning' : 'default'}
                    />
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Raised by Audit{obs.addedBy ? `: ${obs.addedBy?.firstName || ''} ${obs.addedBy?.lastName || ''}` : ''}
                  {obs.addedAt ? ` on ${formatDate(obs.addedAt)}` : ''}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: obs.answer ? 1.5 : 0 }}>{obs.observation}</Typography>
                {obs.answer && (
                  <Box sx={{ mt: 1.5, p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 1, border: '1px solid', borderColor: 'success.light' }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5, color: 'success.dark' }}>
                      Response from Procurement (edit / correction):
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{obs.answer}</Typography>
                    {obs.answeredBy && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                        Answered by: {obs.answeredBy?.firstName || ''} {obs.answeredBy?.lastName || ''}
                        {obs.answeredAt ? ` on ${formatDate(obs.answeredAt)}` : ''}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}

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

        <Divider sx={{ my: 2.5, borderWidth: 1, borderColor: '#ccc' }} />

        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 3 }}>
          <Box sx={{ width: '45%', fontSize: '0.9rem' }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>
              {poData.vendor?.name || 'Vendor Name'}
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6, mb: 2 }}>
              {poData.vendor?.address || 'Vendor Address'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', lineHeight: 1.6 }}>
              <Typography component="span" sx={{ fontWeight: 600, mr: 1 }}>Indent Details:</Typography>
              <Typography component="span">
                Indent# {poData.indent?.indentNumber || 'N/A'} Dated. {poData.indent?.requestedDate ? formatDateForPrint(poData.indent.requestedDate) : 'N/A'}.
                {poData.indent?.title && ` ${poData.indent.title}.`}
                {poData.indent?.requestedBy && ` End User. ${poData.indent.requestedBy.firstName} ${poData.indent.requestedBy.lastName}`}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ width: '50%', fontSize: '0.9rem', lineHeight: 2 }}>
            <Box sx={{ display: 'flex', mb: 0.5 }}>
              <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>P.O No.:</Typography>
              <Typography component="span">
                {poData.orderNumber ? 
                  (poData.orderNumber.startsWith('P') && !poData.orderNumber.includes('-')
                    ? poData.orderNumber
                    : 'P' + (poData.orderNumber.match(/\d+$/)?.[0] || poData.orderNumber.split('-').pop() || '').padStart(9, '0'))
                  : 'N/A'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', mb: 0.5 }}>
              <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Date:</Typography>
              <Typography component="span">{formatDateForPrint(poData.orderDate)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', mb: 0.5 }}>
              <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Date:</Typography>
              <Typography component="span">{poData.expectedDeliveryDate ? formatDateForPrint(poData.expectedDeliveryDate) : '___________'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', mb: 0.5 }}>
              <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Address:</Typography>
              <Typography component="span">{poData.shippingAddress ? 
                `${poData.shippingAddress.street || ''} ${poData.shippingAddress.city || ''}`.trim() || '___________' 
                : '___________'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', mb: 0.5 }}>
              <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Cost Center:</Typography>
              <Typography component="span">{poData.indent?.department?.name || '___________'}</Typography>
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
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '5%' }}>Sr no</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '11%' }}>Product</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '23%' }}>Description</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '14%' }}>Specification</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '11%' }}>Brand</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '11%' }}>Quantity Unit</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '11%' }}>Rate</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '11%' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {poData.items && poData.items.length > 0 ? (
                poData.items.map((item, index) => (
                  <tr key={index} style={{ border: '1px solid #000' }}>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>{index + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>{item.productCode || poData.indent?.items?.[index]?.itemCode || `44-001-${String(index + 1).padStart(4, '0')}`}</td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>{item.description || poData.indent?.items?.[index]?.itemName || '___________'}</td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>{item.specification || poData.indent?.items?.[index]?.specification || '___________'}</td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>{item.brand || poData.indent?.items?.[index]?.brand || '___________'}</td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity ? `${formatNumber(item.quantity)} ${item.unit || 'Nos'}` : '___________'}</td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>{item.unitPrice ? formatNumber(item.unitPrice) : '___________'}</td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>{item.amount ? formatNumber(item.amount) : '___________'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>No items</td>
                </tr>
              )}
            </tbody>
          </table>
        </Box>

        {/* Financial Summary */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Box sx={{ width: '300px', fontSize: '0.9rem' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography component="span" fontWeight={600}>Total (Rupees):</Typography>
              <Typography component="span">{formatNumber(poData.totalAmount || 0)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography component="span" fontWeight={600}>Net Total:</Typography>
              <Typography component="span">{formatNumber(poData.totalAmount || 0)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography component="span" fontWeight={600}>Freight Charges:</Typography>
              <Typography component="span">{formatNumber(poData.shippingCost || 0)}</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
              Rupees {numberToWords(poData.totalAmount || 0)}
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
              <Typography component="span" sx={{ ml: 1 }}>{poData.paymentTerms || '100% Advance Payment'}</Typography>
            </Box>
            <Box sx={{ mb: 1 }}>
              <Typography component="span" fontWeight={600}>Delivery Terms:</Typography>
              <Typography component="span" sx={{ ml: 1 }}>At-Site Delivery</Typography>
            </Box>
            <Box sx={{ mb: 1 }}>
              <Typography component="span" fontWeight={600}>Delivery Time.</Typography>
              <Typography component="span" sx={{ ml: 1 }}>Delivery within: {poData.quotation?.deliveryTime || '03 days'} of confirmed PO & Payment</Typography>
            </Box>
            <Typography sx={{ mb: 1 }}>Rates Are Exclusive Of all The Taxes</Typography>
            {poData.vendor?.cnic && <Typography sx={{ mb: 1 }}>CNIC {poData.vendor.cnic}</Typography>}
            {poData.vendor?.payeeName && <Typography>Payee Name: {poData.vendor.payeeName}</Typography>}
          </Box>
        </Box>

        {/* Approval Progress */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Approval Progress
          </Typography>
          {(() => {
            const indent = poData?.indent || {};
            const approvals = indent?.comparativeStatementApprovals || {};
            const approvalSteps = Array.isArray(indent?.comparativeApproval?.approvers)
              ? indent.comparativeApproval.approvers
              : [];
            const stepByUserId = new Map(
              approvalSteps.map((s) => [String(s?.approver?._id || s?.approver || ''), s])
            );
            const personName = (u, fallback = '') => {
              if (fallback && String(fallback).trim()) return String(fallback).trim();
              if (u) {
                const n = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();
                if (n) return n;
                if (u?.email) return u.email;
              }
              return '—';
            };
            const rows = [
              { key: 'preparedBy', label: 'Prepared By', user: approvals.preparedByUser, fallback: poData.approvalAuthorities?.preparedBy || approvals.preparedBy || auth.preparedBy || '' },
              { key: 'managerProcurement', label: 'Manager Procurement', user: approvals.managerProcurementUser, fallback: poData.approvalAuthorities?.managerProcurement || approvals.managerProcurement || auth.managerProcurement || '' },
              { key: 'chiefOperatingOfficer', label: 'Chief operating officer', user: null, fallback: poData.approvalAuthorities?.chiefOperatingOfficer || poData.approvalAuthorities?.verifiedBy || approvals.verifiedBy || auth.verifiedBy || '' },
              { key: 'avpTaj', label: 'AVP Taj', user: null, fallback: poData.approvalAuthorities?.avpTaj || poData.approvalAuthorities?.authorisedRep || approvals.authorisedRep || auth.authorisedRep || '' },
              ...(poData.approvalAuthorities?.technicalDepartment || auth.technicalDepartment ? [{ key: 'technicalDepartment', label: 'Technical Department', user: null, fallback: poData.approvalAuthorities?.technicalDepartment || auth.technicalDepartment || '' }] : []),
              { key: 'preAuditInitial', label: 'Pre-Audit Initial Approval', directApproval: true, approver: poData.preAuditInitialApprovedBy || null, approvedAt: poData.preAuditInitialApprovedAt || null, fallback: '' },
              { key: 'auditDirectorApproval', label: 'Audit Final Approval', directApproval: true, approver: poData.auditApprovedBy || null, approvedAt: poData.auditApprovedAt || null, fallback: '' },
              { key: 'ceoSecretariatForward', label: 'CEO Secretariat', directApproval: true, approver: poData.ceoForwardedBy || null, approvedAt: poData.ceoForwardedAt || null, fallback: '' },
              { key: 'ceoApproval', label: 'CEO Approval', directApproval: true, approver: poData.ceoApprovedBy || null, approvedAt: poData.ceoApprovedAt || null, fallback: '' }
            ];
            const authorityApprovals = Array.isArray(poData?.authorityApprovals) ? poData.authorityApprovals : [];
            const byKey = new Map(authorityApprovals.map((a) => [String(a?.authorityKey || '').trim(), a]).filter(([k]) => Boolean(k)));
            return (
              <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Authority</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Digital Signature</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const uid = String(row?.user?._id || row?.user || '');
                      const step = uid ? stepByUserId.get(uid) : null;
                      const explicitApproval = row?.key ? byKey.get(row.key) : null;
                      const approvalUser = row?.directApproval
                        ? row.approver
                        : (explicitApproval?.approver && typeof explicitApproval.approver === 'object'
                          ? explicitApproval.approver
                          : step?.approver && typeof step.approver === 'object'
                            ? step.approver
                            : row.user);
                      const approvedAt = row?.directApproval
                        ? (row.approvedAt || null)
                        : (explicitApproval?.approvedAt || step?.actedAt || null);
                      const isApproved = Boolean(approvedAt);
                      const displayAuthorityName = explicitApproval?.approver
                        ? ([explicitApproval.approver.firstName, explicitApproval.approver.lastName].filter(Boolean).join(' ').trim() || explicitApproval.approver.email || row.fallback || '—')
                        : personName(approvalUser, row.fallback);
                      return (
                        <TableRow key={row.key || row.label}>
                          <TableCell sx={{ fontWeight: 600 }}>{row.label}</TableCell>
                          <TableCell>{displayAuthorityName}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={isApproved ? 'Approved' : 'Pending'}
                              color={isApproved ? 'success' : 'warning'}
                              variant={isApproved ? 'filled' : 'outlined'}
                            />
                          </TableCell>
                          <TableCell>
                            {isApproved && approvalUser?.digitalSignature ? (
                              <DigitalSignatureImage userOrPath={approvalUser} alt={`${row.label} signature`} />
                            ) : isApproved ? (
                              <Typography variant="caption" color="text.secondary">No signature on file</Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          <TableCell>{formatDateTime(approvedAt)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            );
          })()}
          <ProcurementDigitalSignaturesRow purchaseOrder={poData} />
        </Box>
      </Paper>
    );
  };

  /** Keep document-type flags when acting from the view dialog (API payload lacks them). */
  const withCeoDocTypeFlags = (doc, flags = {}) => {
    if (!doc) return doc;
    const isPurchaseOrder =
      Boolean(flags.isPurchaseOrder) ||
      Boolean(doc.isPurchaseOrder) ||
      Boolean(doc.orderNumber) ||
      doc.itemType === 'Purchase Order' ||
      doc.typeLabel === 'Purchase Order';
    const isCashApproval =
      Boolean(flags.isCashApproval) ||
      Boolean(doc.isCashApproval) ||
      Boolean(doc.caNumber) ||
      doc.itemType === 'Cash Approval' ||
      doc.typeLabel === 'Cash Approval';
    const isOnboarding =
      Boolean(flags.isOnboarding) ||
      Boolean(doc.isOnboarding) ||
      Boolean(doc.cnic) ||
      doc.itemType === 'Onboarding' ||
      doc.typeLabel === 'Onboarding';
    const isPaymentSettlement =
      Boolean(flags.isPaymentSettlement) ||
      Boolean(doc.isPaymentSettlement) ||
      (!isPurchaseOrder && !isCashApproval && !isOnboarding);

    return {
      ...doc,
      isPurchaseOrder,
      isCashApproval,
      isOnboarding,
      isPaymentSettlement,
      itemType: isPurchaseOrder
        ? 'Purchase Order'
        : isCashApproval
          ? 'Cash Approval'
          : isOnboarding
            ? 'Onboarding'
            : doc.itemType || 'Payment Settlement',
      displayRef:
        doc.displayRef ||
        doc.orderNumber ||
        doc.caNumber ||
        doc.referenceNumber ||
        doc.recordNumber ||
        doc._id
    };
  };

  // Action Dialog Openers
  const openApprove = (item, flags = {}) => {
    setApproveDialog({ open: true, settlement: withCeoDocTypeFlags(item, flags) });
    setApprovalComments('');
    setApprovalAgree(false);
  };

  const openReject = (item, flags = {}) => {
    setRejectDialog({ open: true, settlement: withCeoDocTypeFlags(item, flags) });
    setRejectionComments('');
    setRejectionAgree(false);
    setRejectObservations([{ observation: '', severity: 'medium' }]);
  };

  const openReturn = (item, flags = {}) => {
    setReturnDialog({ open: true, settlement: withCeoDocTypeFlags(item, flags) });
    setReturnComments('');
    setReturnAgree(false);
    setReturnObservations([{ observation: '', severity: 'medium' }]);
  };

  const openWorkflowHistory = async (item) => {
    if (!item) return;
    let fullDoc = item;
    if (item.isPurchaseOrder && (!item.workflowHistory || item.workflowHistory.length === 0)) {
      try {
        const r = await api.get(`/procurement/purchase-orders/${item._id}`);
        fullDoc = { ...item, ...(r.data?.data || {}) };
      } catch (_) {}
    } else if (item.isCashApproval && (!item.workflowHistory || item.workflowHistory.length === 0)) {
      try {
        const r = await api.get(`/cash-approvals/${item._id}`);
        fullDoc = { ...item, ...(r.data?.data || {}) };
      } catch (_) {}
    } else if (item.isPaymentSettlement && (!item.workflowHistory || item.workflowHistory.length === 0)) {
      try {
        const r = await paymentSettlementService.getPaymentSettlement(item._id);
        fullDoc = { ...item, ...(r.data?.data || r.data?.settlement || {}) };
      } catch (_) {}
    }
    setWorkflowHistoryDialog({ open: true, settlement: fullDoc });
  };

  // Submit Approval
  const handleApproveSubmit = async () => {
    if (!approvalAgree) {
      toast.error('Please confirm approval checkbox');
      return;
    }
    const item = withCeoDocTypeFlags(approveDialog.settlement);
    if (!item) return;

    const effectiveSig = getAutoDigitalSignature();
    if (!item.isCashApproval && !item.isOnboarding && !effectiveSig) {
      toast.error('No digital signature on your profile. Please add one in Profile settings.');
      return;
    }

    setActionLoading(true);
    try {
      if (item.isPurchaseOrder) {
        await api.put(`/procurement/purchase-orders/${item._id}/ceo-approve`, {
          approvalComments,
          digitalSignature: effectiveSig
        });
        toast.success(`Purchase order ${item.displayRef} approved by CEO!`);
      } else if (item.isCashApproval) {
        await api.put(`/cash-approvals/${item._id}/ceo-approve`, {
          comments: approvalComments,
          approvalComments,
          digitalSignature: effectiveSig
        });
        toast.success(`Cash approval ${item.displayRef} approved by CEO and sent to Finance!`);
      } else if (item.isOnboarding) {
        await nonEmployeeService.approveByCEO(item._id, {
          comments: approvalComments,
          signature: effectiveSig
        });
        toast.success(`Onboarding ${item.displayRef} approved by CEO!`);
      } else {
        await paymentSettlementService.approvePayment(item._id, {
          comments: approvalComments || 'Approved by CEO',
          approvalComments: approvalComments || 'Approved by CEO',
          digitalSignature: effectiveSig
        });
        toast.success(`Payment settlement ${item.displayRef} approved by CEO!`);
      }
      setApproveDialog({ open: false, settlement: null });
      fetchCeoPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve payment');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Rejection
  const handleRejectSubmit = async () => {
    const item = withCeoDocTypeFlags(rejectDialog.settlement);
    if (!rejectionAgree || !rejectionComments.trim()) {
      toast.error('Please provide comments and confirmation');
      return;
    }
    if (!item) return;

    const effectiveSig = getAutoDigitalSignature();
    if (!item.isOnboarding && !effectiveSig) {
      toast.error('No digital signature on your profile. Please add one in Profile settings.');
      return;
    }

    setActionLoading(true);
    try {
      const validObs = rejectObservations.filter((o) => o.observation.trim());
      if (item.isPurchaseOrder) {
        await api.put(`/procurement/purchase-orders/${item._id}/ceo-reject`, {
          comments: rejectionComments,
          rejectionComments,
          digitalSignature: effectiveSig,
          observations: validObs
        });
      } else if (item.isCashApproval) {
        await api.put(`/cash-approvals/${item._id}/ceo-reject`, {
          comments: rejectionComments,
          rejectionComments,
          digitalSignature: effectiveSig,
          observations: validObs
        });
      } else if (item.isOnboarding) {
        await nonEmployeeService.rejectByCEO(item._id, {
          comments: rejectionComments,
          signature: effectiveSig,
          observations: validObs
        });
      } else {
        await paymentSettlementService.rejectPayment(item._id, {
          comments: rejectionComments,
          digitalSignature: effectiveSig,
          observations: validObs
        });
      }
      toast.success(`${item.itemType} ${item.displayRef} rejected`);
      setRejectDialog({ open: false, settlement: null });
      fetchCeoPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject payment');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Return
  const handleReturnSubmit = async () => {
    const validObs = returnObservations.filter((o) => o.observation.trim());
    if (!returnAgree || !returnComments.trim() || validObs.length === 0) {
      toast.error('Please provide return comments, at least one observation, and agree to confirmation');
      return;
    }
    const item = withCeoDocTypeFlags(returnDialog.settlement);
    if (!item) return;

    const effectiveSig = getAutoDigitalSignature();
    if (!effectiveSig) {
      toast.error('No digital signature on your profile. Please add one in Profile settings.');
      return;
    }

    setActionLoading(true);
    try {
      if (item.isPurchaseOrder) {
        await api.put(`/procurement/purchase-orders/${item._id}/ceo-return`, {
          comments: returnComments,
          returnComments,
          digitalSignature: effectiveSig,
          observations: validObs
        });
      } else if (item.isCashApproval) {
        await api.put(`/cash-approvals/${item._id}/ceo-return`, {
          comments: returnComments,
          returnComments,
          digitalSignature: effectiveSig,
          observations: validObs
        });
      } else if (item.isOnboarding) {
        await nonEmployeeService.returnByCEO(item._id, {
          comments: returnComments,
          signature: effectiveSig,
          observations: validObs
        });
      } else {
        await paymentSettlementService.updateWorkflowStatus(item._id, {
          workflowStatus: 'Returned from CEO Office',
          comments: returnComments,
          observations: validObs,
          digitalSignature: effectiveSig
        });
      }
      toast.success(`${item.itemType} ${item.displayRef} returned with observations`);
      setReturnDialog({ open: false, settlement: null });
      fetchCeoPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to return payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    if (!viewDialog.settlement) return;
    const printWindow = window.open('', '_blank');
    const settlement = viewDialog.settlement;
    const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Settlement - ${settlement?.referenceNumber || settlement?._id || 'N/A'}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 20px; font-size: 14px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
            .info-item { display: flex; }
            .info-label { font-weight: bold; width: 150px; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .table th, .table td { border: 1px solid #000; padding: 8px; text-align: left; }
            .table th { background-color: #f5f5f5; }
            .total { text-align: right; font-weight: bold; margin-bottom: 40px; }
            .signature-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 50px; }
            .signature-box { border-top: 1px solid #000; padding-top: 10px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${settlement?.parentCompanyName || 'PAYMENT SETTLEMENT'}</h1>
          </div>
          <div class="info-grid">
            <div class="info-item"><span class="info-label">SITE:</span><span>${settlement?.site || 'Head Office'}</span></div>
            <div class="info-item"><span class="info-label">FROM:</span><span>${settlement?.fromDepartment || 'Administration'}</span></div>
            <div class="info-item"><span class="info-label">CUSTODIAN:</span><span>${settlement?.custodian || 'N/A'}</span></div>
            <div class="info-item"><span class="info-label">DATE:</span><span>${formatDateForDocument(settlement?.date)}</span></div>
            <div class="info-item"><span class="info-label">DOCUMENT NO:</span><span>${settlement?.referenceNumber?.trim() || settlement?._id || 'N/A'}</span></div>
            <div class="info-item"><span class="info-label">NOTE:</span><span>${settlement?.attachments && settlement.attachments.length > 0 ? 'All Supportings Attached' : 'No Attachments'}</span></div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference No</th>
                <th>To Whom Paid</th>
                <th>For What</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${formatDateForDocument(settlement?.date)}</td>
                <td>${settlement?.referenceNumber?.trim() || settlement?._id || 'N/A'}</td>
                <td>${settlement?.toWhomPaid || 'N/A'}</td>
                <td>${settlement?.forWhat || 'N/A'}</td>
                <td style="text-align: right;">${formatPKR(settlement?.amount)}</td>
              </tr>
            </tbody>
          </table>
          <div class="total">
            <strong>Grand Total: ${formatPKR(settlement?.grandTotal || settlement?.amount || 0)}</strong>
          </div>
          <div class="signature-section">
            <div class="signature-box"><div><strong>Prepared By:</strong></div><div>${settlement?.preparedBy || 'N/A'}</div></div>
            <div class="signature-box"><div><strong>Verified By:</strong></div><div>${settlement?.verifiedBy || 'N/A'}</div></div>
            <div class="signature-box"><div><strong>Approved by:</strong></div><div>${settlement?.approvedBy || 'N/A'}</div></div>
          </div>
          <div style="margin-top: 40px; font-size: 12px; color: #666;">
            <p>Generated from SGC ERP System - CEO Executive Desk</p>
            <p>Printed: ${printDate}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Card
      sx={{
        borderRadius: 5,
        background: `linear-gradient(135deg, ${alpha('#0d47a1', 0.04)} 0%, ${alpha('#7b1fa2', 0.04)} 50%, ${alpha('#00897b', 0.03)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
        boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.08)}, 0 4px 12px ${alpha(theme.palette.common.black, 0.04)}`,
        mb: { xs: 3, md: 4 },
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #1976d2, #9c27b0, #00acc1, #43a047)'
        }
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        {/* Header Bar */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
            mb: 3
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #1976d2 0%, #7b1fa2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 8px 20px rgba(25, 118, 210, 0.35)'
              }}
            >
              <VerifiedUserIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #0d47a1 0%, #4a148c 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  CEO Payment Authorizations
                </Typography>
                <Chip
                  label={loading ? 'Checking...' : `${payments.length} Awaiting Authorization`}
                  size="small"
                  color={payments.length > 0 ? 'warning' : 'success'}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    animation: payments.length > 0 ? 'pulse 2s infinite' : 'none'
                  }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                High-priority Purchase Orders, Cash Approvals & Payment Settlements forwarded for executive sign-off
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title="Refresh Pending CEO Authorizations">
              <IconButton
                onClick={fetchCeoPayments}
                disabled={loading}
                sx={{
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.15) }
                }}
              >
                <RefreshIcon sx={{ animation: loading ? 'rotate 1s linear infinite' : 'none' }} />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              size="small"
              endIcon={<OpenInNewIcon fontSize="small" />}
              onClick={() => navigate('/general/ceo-secretariat/payments?tab=forwarded')}
              sx={{
                borderRadius: 2.5,
                fontWeight: 600,
                textTransform: 'none',
                borderColor: alpha(theme.palette.primary.main, 0.4),
                '&:hover': { borderColor: theme.palette.primary.main, backgroundColor: alpha(theme.palette.primary.main, 0.05) }
              }}
            >
              Full Payments Desk
            </Button>
          </Stack>
        </Box>

        {/* Metric Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {/* Total Pending Value */}
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.08) 0%, rgba(25, 118, 210, 0.02) 100%)',
                border: '1px solid rgba(25, 118, 210, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <Avatar sx={{ bgcolor: alpha('#1976d2', 0.15), color: '#1976d2', width: 44, height: 44, borderRadius: 2.5 }}>
                <AttachMoneyIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Pending Amount
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#1565c0', lineHeight: 1.2 }}>
                  {formatPKR(totalAmount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {payments.length} total request{payments.length === 1 ? '' : 's'}
                </Typography>
              </Box>
            </Paper>
          </Grid>

          {/* Purchase Orders */}
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.08) 0%, rgba(156, 39, 176, 0.02) 100%)',
                border: '1px solid rgba(156, 39, 176, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <Avatar sx={{ bgcolor: alpha('#9c27b0', 0.15), color: '#9c27b0', width: 44, height: 44, borderRadius: 2.5 }}>
                <ShoppingBagIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Purchase Orders
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#7b1fa2', lineHeight: 1.2 }}>
                  {formatPKR(poAmount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {poItems.length} order{poItems.length === 1 ? '' : 's'} pending
                </Typography>
              </Box>
            </Paper>
          </Grid>

          {/* Cash Approvals */}
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(0, 150, 136, 0.08) 0%, rgba(0, 150, 136, 0.02) 100%)',
                border: '1px solid rgba(0, 150, 136, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <Avatar sx={{ bgcolor: alpha('#009688', 0.15), color: '#00796b', width: 44, height: 44, borderRadius: 2.5 }}>
                <WalletIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Cash Approvals
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#00796b', lineHeight: 1.2 }}>
                  {formatPKR(caAmount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {caItems.length} advance{caItems.length === 1 ? '' : 's'} pending
                </Typography>
              </Box>
            </Paper>
          </Grid>

          {/* Payment Settlements */}
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(239, 108, 0, 0.08) 0%, rgba(239, 108, 0, 0.02) 100%)',
                border: '1px solid rgba(239, 108, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}
            >
              <Avatar sx={{ bgcolor: alpha('#ef6c00', 0.15), color: '#ef6c00', width: 44, height: 44, borderRadius: 2.5 }}>
                <ReceiptIcon />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Settlements
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#e65100', lineHeight: 1.2 }}>
                  {formatPKR(setAmount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {settlementItems.length} settlement{settlementItems.length === 1 ? '' : 's'} pending
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Filter Tabs & Search */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
            borderBottom: 1,
            borderColor: 'divider',
            pb: 1.5,
            mb: 2.5
          }}
        >
          <Tabs
            value={filterTab}
            onChange={(_, val) => setFilterTab(val)}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                minHeight: 40,
                px: 2
              }
            }}
          >
            <Tab label={`All (${payments.length})`} />
            <Tab label={`Purchase Orders (${poItems.length})`} />
            <Tab label={`Cash Approvals (${caItems.length})`} />
            <Tab label={`Settlements (${settlementItems.length})`} />
            <Tab label={`Onboardings (${onboardingItems.length})`} />
          </Tabs>
        </Box>

        {/* Content Table or Empty State */}
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
            <CircularProgress size={36} thickness={4} />
            <Typography variant="body2" color="text.secondary">
              Loading CEO payment authorization queue...
            </Typography>
          </Box>
        ) : filteredPayments.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 5,
              textAlign: 'center',
              borderRadius: 4,
              border: '1px dashed rgba(67, 160, 71, 0.3)',
              backgroundColor: alpha('#43a047', 0.03)
            }}
          >
            <CheckCircleOutlineIcon sx={{ fontSize: 52, color: '#43a047', mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
              All CEO Payment Approvals Cleared
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: 'auto', mt: 0.5 }}>
              There are currently no Purchase Orders, Cash Approvals, or Payment Settlements waiting for CEO authorization.
            </Typography>
          </Paper>
        ) : (
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
              overflow: 'hidden'
            }}
          >
            <Table size="small">
              <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Type & Ref #</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Company</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Vendor / Payee</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Purpose / Notes</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Amount (PKR)
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 240 }}>
                    CEO Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPayments.map((item) => {
                  const typeColor = item.isPurchaseOrder ? 'secondary' : item.isCashApproval ? 'info' : 'warning';
                  return (
                    <TableRow
                      key={item._id}
                      hover
                      sx={{
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) }
                      }}
                    >
                      <TableCell sx={{ py: 1.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={item.typeLabel}
                            size="small"
                            color={typeColor}
                            variant="outlined"
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            {item.displayRef}
                          </Typography>
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {getCompanyValue(item)}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.displayVendor}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={item.department || 'General'}
                          size="small"
                          sx={{ fontSize: '0.75rem', bgcolor: alpha(theme.palette.grey[500], 0.1) }}
                        />
                      </TableCell>

                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                          title={item.displayNotes}
                        >
                          {item.displayNotes}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateForDocument(item.displayDate)}
                        </Typography>
                      </TableCell>

                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#1565c0' }}>
                          {formatPKR(item.displayAmount)}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Stack direction="row" spacing={0.8} justifyContent="center">
                          {/* View Detail */}
                          <Tooltip title="View Complete Audit Details">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => openView(item)}
                              sx={{
                                border: '1px solid rgba(25, 118, 210, 0.3)',
                                bgcolor: alpha('#1976d2', 0.05)
                              }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Workflow History */}
                          <Tooltip title="See Workflow History">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => openWorkflowHistory(item)}
                              sx={{
                                border: '1px solid rgba(2, 136, 209, 0.3)',
                                bgcolor: alpha('#0288d1', 0.05),
                                '&:hover': { bgcolor: alpha('#0288d1', 0.15) }
                              }}
                            >
                              <HistoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Quick CEO Approve */}
                          <Tooltip title="Approve as CEO">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => openApprove(item)}
                              sx={{
                                border: '1px solid rgba(46, 125, 50, 0.3)',
                                bgcolor: alpha('#2e7d32', 0.08),
                                '&:hover': { bgcolor: alpha('#2e7d32', 0.2) }
                              }}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Quick CEO Reject */}
                          <Tooltip title="Reject as CEO">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => openReject(item)}
                              sx={{
                                border: '1px solid rgba(211, 47, 47, 0.3)',
                                bgcolor: alpha('#d32f2f', 0.05),
                                '&:hover': { bgcolor: alpha('#d32f2f', 0.15) }
                              }}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Quick CEO Return */}
                          <Tooltip title="Return with Observations">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => openReturn(item)}
                              sx={{
                                border: '1px solid rgba(237, 108, 2, 0.3)',
                                bgcolor: alpha('#ed6c02', 0.05),
                                '&:hover': { bgcolor: alpha('#ed6c02', 0.15) }
                              }}
                            >
                              <WarningIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>

      {/* ========================================================================= */}
      {/* FULL DOCUMENT VIEW MODAL - EXACT SAME WHITE PAPER STYLE AS PAYMENTS.JS   */}
      {/* ========================================================================= */}
      <Dialog
        open={viewDialog.open}
        onClose={() =>
          setViewDialog({
            open: false,
            settlement: null,
            isPurchaseOrder: false,
            isCashApproval: false,
            quotations: [],
            caLinkedDocs: [],
            poQuotations: [],
            poGrns: [],
            poLinkedDocs: [],
            poAuditTab: 0
          })
        }
        maxWidth={(viewDialog.isPurchaseOrder || viewDialog.isCashApproval) ? false : 'md'}
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 0,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            background: '#ffffff',
            ...((viewDialog.isPurchaseOrder || viewDialog.isCashApproval) && {
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
            })
          }
        }}
      >
        <DialogTitle
          sx={{
            p: 0,
            m: 0,
            '@media print': { display: (viewDialog.isPurchaseOrder || viewDialog.isCashApproval) ? 'none' : 'block' }
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 2,
              borderBottom: '1px solid #e0e0e0'
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
              {viewDialog.isPurchaseOrder
                ? 'Purchase Order Details'
                : viewDialog.isCashApproval
                ? 'Cash Approval Details'
                : 'PAYMENT SETTLEMENT'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {viewDialog.isPurchaseOrder && (
                <Button
                  variant="contained"
                  startIcon={<PrintIcon />}
                  onClick={() => window.print()}
                  size="small"
                  sx={{ '@media print': { display: 'none' } }}
                >
                  Print
                </Button>
              )}
              <IconButton
                size="small"
                onClick={() =>
                  setViewDialog({
                    open: false,
                    settlement: null,
                    isPurchaseOrder: false,
                    isCashApproval: false,
                    quotations: [],
                    caLinkedDocs: [],
                    poQuotations: [],
                    poGrns: [],
                    poLinkedDocs: [],
                    poAuditTab: 0
                  })
                }
                sx={{ color: '#666', '@media print': { display: 'none' } }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent
          sx={{
            p: 0,
            background: '#ffffff',
            overflow: 'auto',
            '@media print': { p: 0, overflow: 'visible' }
          }}
        >
          {viewDialog.settlement && (
            <Box
              sx={{
                p: (viewDialog.isPurchaseOrder || viewDialog.isCashApproval) ? 0 : 4,
                background: '#ffffff',
                fontFamily: (viewDialog.isPurchaseOrder || viewDialog.isCashApproval)
                  ? 'Arial, sans-serif'
                  : '"Times New Roman", serif'
              }}
              className={(viewDialog.isPurchaseOrder || viewDialog.isCashApproval) ? 'print-content' : ''}
            >
              {/* Show Purchase Order view if it's a PO */}
              {viewDialog.isPurchaseOrder ? (
                <>
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
                      {!viewDialog.settlement?.indent ? (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          No indent linked with this PO.
                        </Typography>
                      ) : (
                        <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="h5" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 1 }}>
                            Purchase Request Form
                          </Typography>
                          {viewDialog.settlement.indent.title && (
                            <Typography variant="h6" fontWeight={600} align="center" sx={{ mb: 2 }}>
                              {viewDialog.settlement.indent.title}
                            </Typography>
                          )}
                          <Box sx={{ mb: 1.5, fontSize: '0.9rem', textAlign: 'center' }}>
                            <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
                            <Typography component="span" sx={{ ml: 1 }}>
                              {viewDialog.settlement.indent.erpRef || 'PR #' + (viewDialog.settlement.indent.indentNumber?.split('-').pop() || '')}
                            </Typography>
                          </Box>
                          <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <Box>
                              <Typography component="span" fontWeight={600}>Date:</Typography>
                              <Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.settlement.indent.requestedDate)}</Typography>
                            </Box>
                            <Box>
                              <Typography component="span" fontWeight={600}>Required Date:</Typography>
                              <Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.settlement.indent.requiredDate) || '—'}</Typography>
                            </Box>
                            <Box>
                              <Typography component="span" fontWeight={600}>Indent No.:</Typography>
                              <Typography component="span" sx={{ ml: 1 }}>{viewDialog.settlement.indent.indentNumber || '—'}</Typography>
                            </Box>
                          </Box>
                          <Box sx={{ mb: 3, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <Box>
                              <Typography component="span" fontWeight={600}>Department:</Typography>
                              <Typography component="span" sx={{ ml: 1 }}>{viewDialog.settlement.indent.department?.name || viewDialog.settlement.indent.department || '—'}</Typography>
                            </Box>
                            <Box>
                              <Typography component="span" fontWeight={600}>Originator:</Typography>
                              <Typography component="span" sx={{ ml: 1 }}>
                                {viewDialog.settlement.indent.requestedBy?.firstName && viewDialog.settlement.indent.requestedBy?.lastName
                                  ? `${viewDialog.settlement.indent.requestedBy.firstName} ${viewDialog.settlement.indent.requestedBy.lastName}`
                                  : viewDialog.settlement.indent.requestedBy?.name || '—'}
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
                                {(viewDialog.settlement.indent.items || []).map((item, idx) => (
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
                          {viewDialog.settlement.indent.justification && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Justification:</Typography>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                {viewDialog.settlement.indent.justification}
                              </Typography>
                            </Box>
                          )}
                        </Paper>
                      )}
                    </Box>
                  )}

                  {/* Tab 1: Purchase Order View */}
                  {viewDialog.poAuditTab === 1 && (
                    <PurchaseOrderView poData={viewDialog.settlement} />
                  )}

                  {/* Tab 2: Comparative Statement */}
                  {viewDialog.poAuditTab === 2 && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                      <ComparativeStatementView
                        requisition={viewDialog.settlement?.indent}
                        quotations={viewDialog.poQuotations || []}
                        approvalAuthority={viewDialog.settlement?.indent?.comparativeStatementApprovals || {}}
                        note={viewDialog.settlement?.indent?.notes ?? ''}
                        readOnly
                        formatNumber={formatNumber}
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
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>#</TableCell>
                                <TableCell>Quotation No</TableCell>
                                <TableCell>Vendor</TableCell>
                                <TableCell>Date</TableCell>
                                <TableCell align="right">Total</TableCell>
                                <TableCell>Status</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {viewDialog.poQuotations.map((q, idx) => (
                                <TableRow key={q._id || idx}>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell>{q.quotationNumber || q.quotationRef || '—'}</TableCell>
                                  <TableCell>{q.vendor?.name || '—'}</TableCell>
                                  <TableCell>{formatDateForDocument(q.quotationDate || q.createdAt)}</TableCell>
                                  <TableCell align="right">{formatPKR(q.totalAmount || 0)}</TableCell>
                                  <TableCell>
                                    <Chip label={q.status || 'Received'} size="small" />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Box>
                  )}

                  {/* Tab 4: GRNs */}
                  {viewDialog.poAuditTab === 4 && (
                    <Box sx={{ p: 2 }}>
                      {(!viewDialog.poGrns || viewDialog.poGrns.length === 0) ? (
                        <Typography color="text.secondary">No Goods Receipt Notes (GRN) created yet.</Typography>
                      ) : (
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>#</TableCell>
                                <TableCell>GRN Number</TableCell>
                                <TableCell>Received Date</TableCell>
                                <TableCell>Received By</TableCell>
                                <TableCell>Status</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {viewDialog.poGrns.map((grn, idx) => (
                                <TableRow key={grn._id || idx}>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell>{grn.receiveNumber || grn.grnNumber || '—'}</TableCell>
                                  <TableCell>{formatDateForDocument(grn.receivedDate || grn.createdAt)}</TableCell>
                                  <TableCell>{grn.receivedBy?.name || grn.receivedBy?.firstName || '—'}</TableCell>
                                  <TableCell>
                                    <Chip label={grn.status || 'Received'} size="small" />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Box>
                  )}

                  {/* Tab 5: Attached Documents (Full list with Open action) */}
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
                                  <TableCell>{doc.uploadedAt ? formatDateForDocument(doc.uploadedAt) : '—'}</TableCell>
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
                </>
              ) : viewDialog.isCashApproval && isGeneralModuleCashApproval(viewDialog.settlement) ? (
                <CashApprovalGeneralDetailShell
                  embedded
                  hideBack
                  ca={viewDialog.settlement}
                />
              ) : viewDialog.isCashApproval ? (
                <CashApprovalDetailTabsView
                  cashApproval={viewDialog.settlement}
                  tabValue={viewDialog.poAuditTab ?? 0}
                  onTabChange={(v) => setViewDialog((prev) => ({ ...prev, poAuditTab: v }))}
                  quotations={viewDialog.quotations || []}
                  linkedDocs={viewDialog.caLinkedDocs || []}
                />
              ) : viewDialog.isOnboarding ? (
                <Box sx={{ mb: 2 }}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: { xs: 3, md: 4 }, 
                      borderRadius: 3, 
                      background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, borderBottom: '1px solid', borderColor: 'divider', pb: 3, flexWrap: 'wrap', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar 
                          sx={{ 
                            width: 64, 
                            height: 64, 
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            fontSize: '1.75rem',
                            fontWeight: 700
                          }}
                        >
                          {viewDialog.settlement.firstName ? viewDialog.settlement.firstName[0].toUpperCase() : 'N'}
                        </Avatar>
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
                            {`${viewDialog.settlement.firstName || ''} ${viewDialog.settlement.lastName || ''}`.trim() || 'N/A'}
                          </Typography>
                          <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {viewDialog.settlement.role || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                        <Chip 
                          label={`Ref: ${viewDialog.settlement.recordNumber || 'N/A'}`} 
                          size="small" 
                          sx={{ mb: 1, fontWeight: 600, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
                        />
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Initiated: {formatDateForDocument(viewDialog.settlement.initiatedAt || viewDialog.settlement.createdAt)}
                        </Typography>
                      </Box>
                    </Box>

                    <Grid container spacing={4}>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', height: '100%' }}>
                          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1, display: 'block', mb: 2 }}>
                            Candidate Details
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>CNIC Number</Typography>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>{viewDialog.settlement.cnic || 'N/A'}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Duration</Typography>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>{viewDialog.settlement.duration || 'N/A'}</Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.04), border: '1px solid', borderColor: alpha(theme.palette.success.main, 0.2), height: '100%' }}>
                          <Typography variant="overline" color="success.dark" sx={{ fontWeight: 600, letterSpacing: 1, display: 'block', mb: 2 }}>
                            Financial Details
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                            <Box>
                              <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>Expected Wages</Typography>
                              <Typography variant="h5" sx={{ fontWeight: 800, color: 'success.dark' }}>{formatPKR(viewDialog.settlement.expectedWages || 0)}</Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12}>
                        <Box sx={{ p: 3, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.04), border: '1px dashed', borderColor: alpha(theme.palette.info.main, 0.3) }}>
                          <Typography variant="overline" color="info.dark" sx={{ fontWeight: 600, letterSpacing: 1, display: 'block', mb: 1 }}>
                            Justification / Remarks
                          </Typography>
                          <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.7 }}>
                            {viewDialog.settlement.justification || 'No justification provided.'}
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12}>
                        <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1, display: 'block', mb: 2 }}>
                            Approval Signatures
                          </Typography>
                          <Grid container spacing={3}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>HOD HR Approval</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {viewDialog.settlement.hodApprovedBy ? `${viewDialog.settlement.hodApprovedBy.firstName || ''} ${viewDialog.settlement.hodApprovedBy.lastName || ''}`.trim() || viewDialog.settlement.hodApprovedBy.email || 'Approved' : 'Pending'}
                              </Typography>
                              {viewDialog.settlement.hodApprovedAt && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {formatDateTime(viewDialog.settlement.hodApprovedAt)}
                                </Typography>
                              )}
                              {viewDialog.settlement.hodSignature && (
                                <Box sx={{ mt: 1 }}>
                                  <DigitalSignatureImage userOrPath={{ digitalSignature: viewDialog.settlement.hodSignature }} alt="HOD Signature" />
                                </Box>
                              )}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>AVP Approval</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {viewDialog.settlement.avpApprovedBy ? `${viewDialog.settlement.avpApprovedBy.firstName || ''} ${viewDialog.settlement.avpApprovedBy.lastName || ''}`.trim() || viewDialog.settlement.avpApprovedBy.email || 'Approved' : 'Pending'}
                              </Typography>
                              {viewDialog.settlement.avpApprovedAt && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {formatDateTime(viewDialog.settlement.avpApprovedAt)}
                                </Typography>
                              )}
                              {viewDialog.settlement.avpSignature && (
                                <Box sx={{ mt: 1 }}>
                                  <DigitalSignatureImage userOrPath={{ digitalSignature: viewDialog.settlement.avpSignature }} alt="AVP Signature" />
                                </Box>
                              )}
                            </Grid>
                          </Grid>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </Box>
              ) : (
                <>
                  {/* Payment Settlement View */}
                  <Box sx={{ mb: 3, borderBottom: '2px solid #000', pb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, textAlign: 'center', mb: 3, fontSize: '24px', letterSpacing: '1px' }}>
                      {viewDialog.settlement.parentCompanyName || 'PAYMENT SETTLEMENT'}
                    </Typography>
                    
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>SITE:</Typography>
                        <Typography variant="body2">{viewDialog.settlement.site || 'Head Office'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>FROM:</Typography>
                        <Typography variant="body2">{viewDialog.settlement.fromDepartment || 'Administration'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>CUSTODIAN:</Typography>
                        <Typography variant="body2">{viewDialog.settlement.custodian || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>DATE:</Typography>
                        <Typography variant="body2">{formatDateForDocument(viewDialog.settlement.date)}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>DOCUMENT NUMBER:</Typography>
                        <Typography variant="body2">{viewDialog.settlement.referenceNumber?.trim() || viewDialog.settlement._id || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>NOTE:</Typography>
                        <Typography variant="body2">
                          {viewDialog.settlement.attachments && viewDialog.settlement.attachments.length > 0 
                            ? 'All Supportings Attached' 
                            : 'No Attachments'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Transaction Details Table */}
                  <Box sx={{ mb: 3 }}>
                    <TableContainer component={Paper} sx={{ boxShadow: 'none', border: '1px solid #000' }}>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ background: '#f5f5f5' }}>
                            <TableCell sx={{ border: '1px solid #000', fontWeight: 700, py: 1.5, fontSize: '13px' }}>Date</TableCell>
                            <TableCell sx={{ border: '1px solid #000', fontWeight: 700, py: 1.5, fontSize: '13px' }}>Reference No</TableCell>
                            <TableCell sx={{ border: '1px solid #000', fontWeight: 700, py: 1.5, fontSize: '13px' }}>To Whom Paid</TableCell>
                            <TableCell sx={{ border: '1px solid #000', fontWeight: 700, py: 1.5, fontSize: '13px' }}>For What</TableCell>
                            <TableCell sx={{ border: '1px solid #000', fontWeight: 700, py: 1.5, fontSize: '13px', textAlign: 'right' }}>Amount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ border: '1px solid #000', py: 2, fontSize: '13px' }}>{formatDateForDocument(viewDialog.settlement.date)}</TableCell>
                            <TableCell sx={{ border: '1px solid #000', py: 2, fontSize: '13px' }}>{viewDialog.settlement.referenceNumber?.trim() || viewDialog.settlement._id || 'N/A'}</TableCell>
                            <TableCell sx={{ border: '1px solid #000', py: 2, fontSize: '13px' }}>{viewDialog.settlement.toWhomPaid || 'N/A'}</TableCell>
                            <TableCell sx={{ border: '1px solid #000', py: 2, fontSize: '13px', whiteSpace: 'pre-wrap' }}>{viewDialog.settlement.forWhat || 'N/A'}</TableCell>
                            <TableCell sx={{ border: '1px solid #000', py: 2, fontSize: '13px', textAlign: 'right', fontWeight: 600 }}>{formatPKR(viewDialog.settlement.amount)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Grand Total */}
                  <Box sx={{ mb: 4, display: 'flex', justifyContent: 'flex-end' }}>
                    <Box sx={{ border: '2px solid #000', p: 2, minWidth: '250px', background: '#f9f9f9' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'right', fontSize: '18px' }}>
                        Grand Total: {formatPKR(viewDialog.settlement.grandTotal || viewDialog.settlement.amount || 0)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Approval Section */}
                  <Box sx={{ mt: 4, borderTop: '1px solid #000', pt: 3 }}>
                    <Grid container spacing={4}>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, fontSize: '13px', textDecoration: 'underline' }}>Prepared By:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '13px' }}>{viewDialog.settlement.preparedBy || 'N/A'}</Typography>
                          <Typography variant="body2" sx={{ fontSize: '12px', color: '#666' }}>{viewDialog.settlement.preparedByDesignation || 'Not specified'}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, fontSize: '13px', textDecoration: 'underline' }}>Verified By:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '13px' }}>{viewDialog.settlement.verifiedBy || 'N/A'}</Typography>
                          <Typography variant="body2" sx={{ fontSize: '12px', color: '#666' }}>{viewDialog.settlement.verifiedByDesignation || 'Not specified'}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, fontSize: '13px', textDecoration: 'underline' }}>Approved by:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '13px' }}>{viewDialog.settlement.approvedBy || 'N/A'}</Typography>
                          <Typography variant="body2" sx={{ fontSize: '12px', color: '#666' }}>{viewDialog.settlement.approvedByDesignation || 'Not specified'}</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  <Box sx={{ mt: 4 }}>
                    <WorkflowAuditFeedbackPanel
                      document={viewDialog.settlement}
                      formatDateTime={formatDateTime}
                      userDisplayName={userDisplayName}
                      visualVariant="settlement"
                      returnedAuditStatus="Returned from CEO Office"
                    />
                  </Box>

                  {/* Document Attachments Section (Identical with ImageViewer trigger) */}
                  {viewDialog.settlement.attachments && viewDialog.settlement.attachments.length > 0 && (
                    <Box sx={{ mt: 4, borderTop: '1px solid #000', pt: 3 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, mb: 2, fontSize: '14px', textDecoration: 'underline' }}>
                        ATTACHMENTS ({viewDialog.settlement.attachments.length}):
                      </Typography>
                      <Box sx={{ border: '1px solid #000', p: 2 }}>
                        <Grid container spacing={1}>
                          {viewDialog.settlement.attachments.map((attachment, index) => {
                            const attachmentUrl = paymentSettlementService.getAttachmentUrl(viewDialog.settlement._id, attachment._id);
                            const isImage = attachment.mimeType && attachment.mimeType.startsWith('image/');
                            const isPdf = attachment.mimeType === 'application/pdf';
                            
                            return (
                              <Grid item xs={12} key={attachment._id || index}>
                                <Box 
                                  sx={{ 
                                    p: 1.5, 
                                    border: '1px solid #ccc', 
                                    cursor: 'pointer', 
                                    transition: 'all 0.2s', 
                                    '&:hover': { borderColor: '#000', background: '#f5f5f5' } 
                                  }}
                                  onClick={async () => {
                                    if (isImage) {
                                      try {
                                        const blobUrl = await paymentSettlementService.getAttachmentBlobUrl(viewDialog.settlement._id, attachment._id);
                                        setImageViewer({
                                          open: true,
                                          imageUrl: blobUrl,
                                          imageName: attachment.originalName,
                                          isBlob: true
                                        });
                                      } catch (error) {
                                        toast.error('Failed to load image');
                                      }
                                    } else if (isPdf) {
                                      window.open(attachmentUrl, '_blank');
                                    } else {
                                      const link = document.createElement('a');
                                      link.href = attachmentUrl;
                                      link.download = attachment.originalName;
                                      link.target = '_blank';
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }
                                  }}
                                >
                                  <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                    {index + 1}. {attachment.originalName}
                                  </Typography>
                                </Box>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Box>
                    </Box>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            p: 2,
            borderTop: '1px solid #e0e0e0',
            background: '#f9f9f9',
            justifyContent: 'space-between',
            '@media print': { display: 'none' }
          }}
        >
          <Box>
            {!viewDialog.isPurchaseOrder && !viewDialog.isCashApproval && (
              <>
                <Chip
                  label={viewDialog.settlement?.workflowStatus || 'Draft'}
                  color={getWorkflowStatusColor(viewDialog.settlement?.workflowStatus || 'Draft')}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Chip
                  label={viewDialog.settlement?.paymentType}
                  variant="outlined"
                  size="small"
                />
              </>
            )}
            {viewDialog.isCashApproval && (
              <Chip
                label={viewDialog.settlement?.status || 'Draft'}
                color={getWorkflowStatusColor(viewDialog.settlement?.status || 'Draft')}
                size="small"
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={() => {
                const flags = {
                  isPurchaseOrder: viewDialog.isPurchaseOrder,
                  isCashApproval: viewDialog.isCashApproval,
                  isOnboarding: viewDialog.isOnboarding
                };
                const itemToApprove = viewDialog.settlement;
                setViewDialog((prev) => ({ ...prev, open: false }));
                openApprove(itemToApprove, flags);
              }}
            >
              Approve (CEO)
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => {
                const flags = {
                  isPurchaseOrder: viewDialog.isPurchaseOrder,
                  isCashApproval: viewDialog.isCashApproval,
                  isOnboarding: viewDialog.isOnboarding
                };
                const itemToReject = viewDialog.settlement;
                setViewDialog((prev) => ({ ...prev, open: false }));
                openReject(itemToReject, flags);
              }}
            >
              Reject (CEO)
            </Button>
            <Button
              variant="contained"
              color="warning"
              startIcon={<WarningIcon />}
              onClick={() => {
                const flags = {
                  isPurchaseOrder: viewDialog.isPurchaseOrder,
                  isCashApproval: viewDialog.isCashApproval,
                  isOnboarding: viewDialog.isOnboarding
                };
                const itemToReturn = viewDialog.settlement;
                setViewDialog((prev) => ({ ...prev, open: false }));
                openReturn(itemToReturn, flags);
              }}
            >
              Return with Observations
            </Button>
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => openWorkflowHistory(viewDialog.settlement)}
              sx={{ minWidth: 150, mr: 1 }}
            >
              See Workflow History
            </Button>
            <Button
              variant="outlined"
              onClick={() =>
                setViewDialog({
                  open: false,
                  settlement: null,
                  isPurchaseOrder: false,
                  isCashApproval: false,
                  quotations: [],
                  caLinkedDocs: [],
                  poQuotations: [],
                  poGrns: [],
                  poLinkedDocs: [],
                  poAuditTab: 0
                })
              }
              sx={{ minWidth: 80, mr: 1 }}
            >
              Close
            </Button>
            {!viewDialog.isPurchaseOrder && !viewDialog.isCashApproval && (
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                sx={{ minWidth: 100 }}
              >
                Print
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Print Styles for Purchase Order / Cash Approval Dialog */}
      {(viewDialog.isPurchaseOrder || viewDialog.isCashApproval) && (
        <Box
          component="style"
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: A4;
                  margin: 15mm;
                }
                body * {
                  visibility: hidden;
                }
                .MuiDialog-container,
                .MuiDialog-container *,
                .MuiDialog-paper,
                .MuiDialog-paper *,
                .print-content,
                .print-content * {
                  visibility: visible;
                }
                .MuiDialog-container {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: 100% !important;
                  display: block !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  overflow: visible !important;
                }
                .MuiDialog-paper {
                  box-shadow: none !important;
                  margin: 0 !important;
                  max-width: 100% !important;
                  width: 100% !important;
                  height: auto !important;
                  max-height: none !important;
                  position: relative !important;
                  transform: none !important;
                  overflow: visible !important;
                }
                .MuiDialogContent-root {
                  overflow: visible !important;
                  padding: 0 !important;
                  height: auto !important;
                  max-height: none !important;
                  margin: 0 !important;
                }
                .MuiDialogTitle-root {
                  display: none !important;
                }
                .MuiDialogActions-root {
                  display: none !important;
                }
                .MuiBackdrop-root {
                  display: none !important;
                }
                .MuiPaper-root {
                  box-shadow: none !important;
                }
              }
            `
          }}
        />
      )}

      {/* Image Viewer Dialog */}
      <Dialog
        open={imageViewer.open}
        onClose={() => {
          if (imageViewer.isBlob && imageViewer.imageUrl) {
            URL.revokeObjectURL(imageViewer.imageUrl);
          }
          setImageViewer({ open: false, imageUrl: '', imageName: '', isBlob: false });
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{imageViewer.imageName}</Typography>
          <IconButton
            onClick={() => {
              if (imageViewer.isBlob && imageViewer.imageUrl) {
                URL.revokeObjectURL(imageViewer.imageUrl);
              }
              setImageViewer({ open: false, imageUrl: '', imageName: '', isBlob: false });
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', p: 2 }}>
          {imageViewer.imageUrl && (
            <img
              src={imageViewer.imageUrl}
              alt={imageViewer.imageName}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (imageViewer.isBlob && imageViewer.imageUrl) {
                URL.revokeObjectURL(imageViewer.imageUrl);
              }
              setImageViewer({ open: false, imageUrl: '', imageName: '', isBlob: false });
            }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const link = document.createElement('a');
              link.href = imageViewer.imageUrl;
              link.download = imageViewer.imageName;
              link.target = '_blank';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* APPROVE DIALOG                                                           */}
      {/* ========================================================================= */}
      <Dialog
        open={approveDialog.open}
        onClose={() => setApproveDialog({ open: false, settlement: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {`Approve ${approveDialog.settlement?.itemType || 'Payment'}`}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You are about to give CEO approval for{' '}
            <strong>{approveDialog.settlement?.displayRef}</strong> ({approveDialog.settlement?.itemType}) of amount{' '}
            <strong>{formatPKR(approveDialog.settlement?.displayAmount)}</strong> to{' '}
            <strong>{approveDialog.settlement?.displayVendor}</strong>.
          </Typography>

          {user?.digitalSignature && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Your profile signature will be applied automatically
              </Typography>
              <DigitalSignatureImage userOrPath={user} alt="Your signature" />
            </Box>
          )}

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Approval Remarks (Optional)"
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={approvalAgree}
                onChange={(e) => setApprovalAgree(e.target.checked)}
              />
            }
            label="I confirm that I have reviewed all payment details and authorize this approval as CEO"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialog({ open: false, settlement: null })}>
            Cancel
          </Button>
          <Button
            onClick={handleApproveSubmit}
            variant="contained"
            color="success"
            disabled={actionLoading || !approvalAgree}
            startIcon={<CheckCircleIcon />}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Authorize & Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* REJECT DIALOG                                                            */}
      {/* ========================================================================= */}
      <Dialog
        open={rejectDialog.open}
        onClose={() => setRejectDialog({ open: false, settlement: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Payment (CEO)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You are rejecting <strong>{rejectDialog.settlement?.displayRef}</strong>.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Reason (Required)"
            value={rejectionComments}
            onChange={(e) => setRejectionComments(e.target.value)}
            required
            sx={{ mb: 2 }}
          />

          {user?.digitalSignature && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Your profile signature will be applied automatically
              </Typography>
              <DigitalSignatureImage userOrPath={user} alt="Your signature" />
            </Box>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={rejectionAgree}
                onChange={(e) => setRejectionAgree(e.target.checked)}
              />
            }
            label="I confirm the rejection of this payment document"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog({ open: false, settlement: null })}>
            Cancel
          </Button>
          <Button
            onClick={handleRejectSubmit}
            variant="contained"
            color="error"
            disabled={actionLoading || !rejectionAgree || !rejectionComments.trim()}
            startIcon={<CancelIcon />}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Reject Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================================= */}
      {/* RETURN DIALOG                                                            */}
      {/* ========================================================================= */}
      <Dialog
        open={returnDialog.open}
        onClose={() => setReturnDialog({ open: false, settlement: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Return with Observations (CEO)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Return <strong>{returnDialog.settlement?.displayRef}</strong> with required corrections.
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Return Comments (Required)"
            value={returnComments}
            onChange={(e) => setReturnComments(e.target.value)}
            required
            sx={{ mb: 2 }}
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              Observations (Required)
            </Typography>
            {returnObservations.map((obs, index) => (
              <Box key={index} sx={{ mb: 1.5, p: 1.5, border: '1px solid #ddd', borderRadius: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Specify observation..."
                      value={obs.observation}
                      onChange={(e) => {
                        const updated = [...returnObservations];
                        updated[index].observation = e.target.value;
                        setReturnObservations(updated);
                      }}
                    />
                  </Grid>
                  <Grid item xs={10} sm={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Severity</InputLabel>
                      <Select
                        value={obs.severity}
                        label="Severity"
                        onChange={(e) => {
                          const updated = [...returnObservations];
                          updated[index].severity = e.target.value;
                          setReturnObservations(updated);
                        }}
                      >
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={2} sm={1}>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={returnObservations.length === 1}
                      onClick={() => setReturnObservations(returnObservations.filter((_, i) => i !== index))}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Grid>
                </Grid>
              </Box>
            ))}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setReturnObservations([...returnObservations, { observation: '', severity: 'medium' }])}
            >
              Add Observation
            </Button>
          </Box>

          {user?.digitalSignature && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Your profile signature will be applied automatically
              </Typography>
              <DigitalSignatureImage userOrPath={user} alt="Your signature" />
            </Box>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={returnAgree}
                onChange={(e) => setReturnAgree(e.target.checked)}
              />
            }
            label="I confirm returning this payment with observations as CEO"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnDialog({ open: false, settlement: null })}>
            Cancel
          </Button>
          <Button
            onClick={handleReturnSubmit}
            variant="contained"
            color="warning"
            disabled={actionLoading || !returnAgree || !returnComments.trim() || returnObservations.filter((o) => o.observation.trim()).length === 0}
            startIcon={<WarningIcon />}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Return with Observations'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Workflow History Dialog */}
      {workflowHistoryDialog.open && (
        <WorkflowHistoryDialog
          open={workflowHistoryDialog.open}
          onClose={() => setWorkflowHistoryDialog({ open: false, settlement: null })}
          document={workflowHistoryDialog.settlement}
          documentType={
            workflowHistoryDialog.settlement?.isPurchaseOrder || workflowHistoryDialog.settlement?.orderNumber
              ? 'purchaseOrder'
              : workflowHistoryDialog.settlement?.isCashApproval || workflowHistoryDialog.settlement?.caNumber
              ? 'cashApproval'
              : workflowHistoryDialog.settlement?.isOnboarding || workflowHistoryDialog.settlement?.cnic
              ? 'onboarding'
              : 'settlement'
          }
        />
      )}
    </Card>
  );
};

export default ExecutiveCeoPaymentsSection;
