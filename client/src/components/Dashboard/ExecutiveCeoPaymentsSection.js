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
  Payment as PaymentIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  AttachMoney as AttachMoneyIcon,
  Print as PrintIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Schedule as ScheduleIcon,
  History as HistoryIcon,
  ArrowForward as ArrowForwardIcon,
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
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import WorkflowHistoryDialog from '../WorkflowHistoryDialog';
import CashApprovalDetailTabsView from '../Procurement/CashApprovalDetailTabsView';
import CashApprovalGeneralDetailShell from '../CashApprovals/CashApprovalGeneralDetailShell';
import { isGeneralModuleCashApproval } from '../CashApprovals/cashApprovalGeneralDocumentUtils';
import ComparativeStatementView from '../Procurement/ComparativeStatementView';

const ExecutiveCeoPaymentsSection = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [filterTab, setFilterTab] = useState(0); // 0: All, 1: PO, 2: CA, 3: Settlement
  const [searchQuery, setSearchQuery] = useState('');
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
    poAuditTab: 0
  });

  const [approveDialog, setApproveDialog] = useState({ open: false, settlement: null });
  const [rejectDialog, setRejectDialog] = useState({ open: false, settlement: null });
  const [returnDialog, setReturnDialog] = useState({ open: false, settlement: null });
  const [workflowHistoryDialog, setWorkflowHistoryDialog] = useState({ open: false, settlement: null });

  // Form states for approval/rejection/return
  const [approvalComments, setApprovalComments] = useState('');
  const [approvalSignature, setApprovalSignature] = useState('');
  const [approvalAgree, setApprovalAgree] = useState(false);

  const [rejectionComments, setRejectionComments] = useState('');
  const [rejectionSignature, setRejectionSignature] = useState('');
  const [rejectionAgree, setRejectionAgree] = useState(false);
  const [rejectObservations, setRejectObservations] = useState([{ observation: '', severity: 'medium' }]);

  const [returnComments, setReturnComments] = useState('');
  const [returnSignature, setReturnSignature] = useState('');
  const [returnAgree, setReturnAgree] = useState(false);
  const [returnObservations, setReturnObservations] = useState([{ observation: '', severity: 'medium' }]);

  // Fetch all items currently Forwarded to CEO
  const fetchCeoPayments = useCallback(async () => {
    try {
      setLoading(true);
      const [settlementsRes, poRes, caRes] = await Promise.all([
        paymentSettlementService.getPaymentSettlements({ page: 1, limit: 100 }),
        api.get('/procurement/purchase-orders/ceo-secretariat').catch(() => ({ data: { data: [] } })),
        api.get('/cash-approvals/ceo-secretariat').catch(() => ({ data: { data: [] } }))
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

      const combined = [...forwardedPOs, ...forwardedCAs, ...forwardedSettlements];
      // Sort newest first
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

  const totalAmount = payments.reduce((sum, p) => sum + (Number(p.displayAmount) || 0), 0);
  const poAmount = poItems.reduce((sum, p) => sum + (Number(p.displayAmount) || 0), 0);
  const caAmount = caItems.reduce((sum, p) => sum + (Number(p.displayAmount) || 0), 0);
  const setAmount = settlementItems.reduce((sum, p) => sum + (Number(p.displayAmount) || 0), 0);

  // Filtered list
  const filteredPayments = payments.filter((p) => {
    if (filterTab === 1 && !p.isPurchaseOrder) return false;
    if (filterTab === 2 && !p.isCashApproval) return false;
    if (filterTab === 3 && !p.isPaymentSettlement) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = (p.displayRef || '').toLowerCase().includes(q);
      const matchVendor = (p.displayVendor || '').toLowerCase().includes(q);
      const matchNotes = (p.displayNotes || '').toLowerCase().includes(q);
      const matchDept = (p.department || '').toLowerCase().includes(q);
      return matchRef || matchVendor || matchNotes || matchDept;
    }
    return true;
  });

  // Action Dialog Openers
  const openApprove = (item) => {
    setApproveDialog({ open: true, settlement: item });
    setApprovalComments('');
    setApprovalSignature(
      user?.digitalSignature ||
      (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || '')
    );
    setApprovalAgree(false);
  };

  const openReject = (item) => {
    setRejectDialog({ open: true, settlement: item });
    setRejectionComments('');
    setRejectionSignature(
      user?.digitalSignature ||
      (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || '')
    );
    setRejectionAgree(false);
    setRejectObservations([{ observation: '', severity: 'medium' }]);
  };

  const openReturn = (item) => {
    setReturnDialog({ open: true, settlement: item });
    setReturnComments('');
    setReturnSignature(
      user?.digitalSignature ||
      (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || '')
    );
    setReturnAgree(false);
    setReturnObservations([{ observation: '', severity: 'medium' }]);
  };

  const openView = async (item) => {
    if (item.isPurchaseOrder) {
      try {
        const fullPoRes = await api.get(`/procurement/purchase-orders/${item._id}`);
        const poData = fullPoRes.data?.data || item;
        let quotations = [];
        let grns = [];
        let linkedDocs = [];
        if (poData.indent?._id) {
          try {
            const [qRes, gRes] = await Promise.all([
              api.get(`/procurement/quotations?indent=${poData.indent._id}`),
              api.get(`/procurement/grn?indent=${poData.indent._id}`).catch(() => ({ data: { data: [] } }))
            ]);
            quotations = qRes.data?.data || [];
            grns = gRes.data?.data || [];
          } catch (e) {
            console.error('Error fetching PO linked docs:', e);
          }
        }
        if (poData.supportingDocuments?.length) {
          poData.supportingDocuments.forEach((doc, idx) => {
            linkedDocs.push({
              id: `po-doc-${idx}`,
              source: 'PO Supporting Document',
              name: doc.name || doc.originalName || 'Supporting Doc',
              url: doc.url || doc.path,
              uploadedAt: doc.uploadedAt || poData.createdAt
            });
          });
        }
        setViewDialog({
          open: true,
          settlement: poData,
          isPurchaseOrder: true,
          isCashApproval: false,
          poQuotations: quotations,
          poGrns: grns,
          poLinkedDocs: linkedDocs,
          poAuditTab: 0
        });
      } catch (err) {
        setViewDialog({
          open: true,
          settlement: item,
          isPurchaseOrder: true,
          isCashApproval: false,
          poQuotations: [],
          poGrns: [],
          poLinkedDocs: [],
          poAuditTab: 0
        });
      }
      return;
    }

    if (item.isCashApproval) {
      try {
        const fullCaRes = await api.get(`/cash-approvals/${item._id}`);
        const caData = fullCaRes.data?.data || item;
        let quotations = [];
        let linkedDocs = [];
        if (caData.indent?._id) {
          try {
            const qRes = await api.get(`/procurement/quotations?indent=${caData.indent._id}`);
            quotations = qRes.data?.data || [];
          } catch (e) {
            console.error('Error fetching CA quotations:', e);
          }
        }
        if (caData.supportingDocuments?.length) {
          caData.supportingDocuments.forEach((doc, idx) => {
            linkedDocs.push({
              id: `ca-doc-${idx}`,
              source: 'CA Supporting Document',
              name: doc.name || doc.originalName || 'Supporting Doc',
              url: doc.url || doc.path,
              uploadedAt: doc.uploadedAt || caData.createdAt
            });
          });
        }
        setViewDialog({
          open: true,
          settlement: caData,
          isPurchaseOrder: false,
          isCashApproval: true,
          quotations,
          caLinkedDocs: linkedDocs,
          poAuditTab: 0
        });
      } catch (err) {
        setViewDialog({
          open: true,
          settlement: item,
          isPurchaseOrder: false,
          isCashApproval: true,
          quotations: [],
          caLinkedDocs: [],
          poAuditTab: 0
        });
      }
      return;
    }

    // Payment Settlement
    try {
      const fullRes = await paymentSettlementService.getPaymentSettlement(item._id);
      setViewDialog({
        open: true,
        settlement: fullRes.data?.settlement || item,
        isPurchaseOrder: false,
        isCashApproval: false
      });
    } catch {
      setViewDialog({
        open: true,
        settlement: item,
        isPurchaseOrder: false,
        isCashApproval: false
      });
    }
  };

  // Submit Approval
  const handleApproveSubmit = async () => {
    if (!approvalAgree) {
      toast.error('Please confirm approval checkbox');
      return;
    }
    const item = approveDialog.settlement;
    if (!item) return;

    const isCA = item.isCashApproval;
    const effectiveSig =
      approvalSignature.trim() ||
      user?.digitalSignature ||
      (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'CEO');

    if (!isCA && !effectiveSig) {
      toast.error('Please provide digital signature');
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
      } else {
        await paymentSettlementService.approvePayment(item._id, {
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
    if (!rejectionAgree || !rejectionComments.trim() || !rejectionSignature.trim()) {
      toast.error('Please provide comments, digital signature, and confirmation');
      return;
    }
    const item = rejectDialog.settlement;
    if (!item) return;

    setActionLoading(true);
    try {
      const validObs = rejectObservations.filter((o) => o.observation.trim());
      if (item.isPurchaseOrder) {
        await api.put(`/procurement/purchase-orders/${item._id}/ceo-reject`, {
          comments: rejectionComments,
          digitalSignature: rejectionSignature,
          observations: validObs
        });
      } else if (item.isCashApproval) {
        await api.put(`/cash-approvals/${item._id}/ceo-reject`, {
          comments: rejectionComments,
          digitalSignature: rejectionSignature,
          observations: validObs
        });
      } else {
        await paymentSettlementService.rejectPayment(item._id, {
          comments: rejectionComments,
          digitalSignature: rejectionSignature,
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
    if (!returnAgree || !returnComments.trim() || !returnSignature.trim() || validObs.length === 0) {
      toast.error('Please provide return comments, at least one observation, digital signature, and agree to confirmation');
      return;
    }
    const item = returnDialog.settlement;
    if (!item) return;

    setActionLoading(true);
    try {
      if (item.isPurchaseOrder) {
        await api.put(`/procurement/purchase-orders/${item._id}/ceo-return`, {
          comments: returnComments,
          digitalSignature: returnSignature,
          observations: validObs
        });
      } else if (item.isCashApproval) {
        await api.put(`/cash-approvals/${item._id}/ceo-return`, {
          comments: returnComments,
          digitalSignature: returnSignature,
          observations: validObs
        });
      } else {
        await paymentSettlementService.updateWorkflowStatus(item._id, {
          status: 'Returned from CEO Office',
          comments: returnComments,
          observations: validObs,
          digitalSignature: returnSignature
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

  const formatDateForPrint = (dateString) => {
    if (!dateString) return '—';
    try {
      return formatDate(dateString);
    } catch {
      return String(dateString);
    }
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

  const handlePrint = () => {
    if (!viewDialog.settlement) return;
    const printWindow = window.open('', '_blank');
    const settlement = viewDialog.settlement;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Record - ${settlement?.displayRef || settlement?._id || 'N/A'}</title>
          <style>body { font-family: 'Times New Roman', serif; padding: 20px; }</style>
        </head>
        <body>
          <h2>Payment Authorization Record: ${settlement?.displayRef || ''}</h2>
          <p><strong>Vendor / Payee:</strong> ${settlement?.displayVendor || ''}</p>
          <p><strong>Amount:</strong> ${formatPKR(settlement?.displayAmount || 0)}</p>
          <p><strong>Department:</strong> ${settlement?.department || ''}</p>
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
              <Avatar
                sx={{
                  bgcolor: alpha('#1976d2', 0.15),
                  color: '#1976d2',
                  width: 44,
                  height: 44,
                  borderRadius: 2.5
                }}
              >
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
              <Avatar
                sx={{
                  bgcolor: alpha('#9c27b0', 0.15),
                  color: '#9c27b0',
                  width: 44,
                  height: 44,
                  borderRadius: 2.5
                }}
              >
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
              <Avatar
                sx={{
                  bgcolor: alpha('#009688', 0.15),
                  color: '#00796b',
                  width: 44,
                  height: 44,
                  borderRadius: 2.5
                }}
              >
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
              <Avatar
                sx={{
                  bgcolor: alpha('#ef6c00', 0.15),
                  color: '#ef6c00',
                  width: 44,
                  height: 44,
                  borderRadius: 2.5
                }}
              >
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
          </Tabs>

          <TextField
            size="small"
            placeholder="Search by ref, vendor, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
            }}
            sx={{ width: { xs: '100%', sm: 260 }, bgcolor: 'background.paper', borderRadius: 2 }}
          />
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
                  <TableCell sx={{ fontWeight: 700 }}>Vendor / Payee</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Purpose / Notes</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Amount (PKR)
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, width: 220 }}>
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
      {/* FULL DOCUMENT VIEW MODAL                                                 */}
      {/* ========================================================================= */}
      <Dialog
        open={viewDialog.open}
        onClose={() => setViewDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={700}>
            {viewDialog.isPurchaseOrder
              ? `Purchase Order: ${viewDialog.settlement?.orderNumber || ''}`
              : viewDialog.isCashApproval
              ? `Cash Approval: ${viewDialog.settlement?.caNumber || ''}`
              : `Payment Settlement: ${viewDialog.settlement?.referenceNumber || ''}`}
          </Typography>
          <IconButton onClick={() => setViewDialog((prev) => ({ ...prev, open: false }))}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2, background: '#fff' }}>
          {viewDialog.settlement && (
            <Box>
              {viewDialog.isPurchaseOrder ? (
                <>
                  <Tabs
                    value={viewDialog.poAuditTab ?? 0}
                    onChange={(_, v) => setViewDialog((prev) => ({ ...prev, poAuditTab: v }))}
                    sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
                  >
                    <Tab label="Indent / PR" />
                    <Tab label="Purchase Order" />
                    <Tab label="Comparative Statement" />
                    <Tab label={`Quotations (${viewDialog.poQuotations?.length || 0})`} />
                    <Tab label={`Attached Docs (${viewDialog.poLinkedDocs?.length || 0})`} />
                  </Tabs>

                  {/* PO Indent Tab */}
                  {viewDialog.poAuditTab === 0 && (
                    <Box sx={{ p: 2 }}>
                      {!viewDialog.settlement?.indent ? (
                        <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                          No linked Indent found.
                        </Typography>
                      ) : (
                        <Paper sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                          <Typography variant="h6" fontWeight={700} gutterBottom align="center">
                            Purchase Request Form
                          </Typography>
                          <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">PR Ref:</Typography>
                              <Typography variant="body2" fontWeight={600}>{viewDialog.settlement.indent.erpRef || viewDialog.settlement.indent.indentNumber || '—'}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Department:</Typography>
                              <Typography variant="body2" fontWeight={600}>{viewDialog.settlement.indent.department?.name || viewDialog.settlement.indent.department || '—'}</Typography>
                            </Grid>
                          </Grid>
                          <Table size="small" sx={{ border: '1px solid #ddd' }}>
                            <TableHead sx={{ bgcolor: 'grey.100' }}>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Item Name</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }} align="center">Qty</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Purpose</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }} align="right">Est. Cost</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(viewDialog.settlement.indent.items || []).map((it, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell>{it.itemName || '—'}</TableCell>
                                  <TableCell align="center">{it.quantity ?? '—'}</TableCell>
                                  <TableCell>{it.purpose || '—'}</TableCell>
                                  <TableCell align="right">{it.estimatedCost != null ? formatPKR(it.estimatedCost) : '—'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Paper>
                      )}
                    </Box>
                  )}

                  {/* PO Details Tab */}
                  {viewDialog.poAuditTab === 1 && (
                    <Box sx={{ p: 2 }}>
                      <Paper sx={{ p: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight={700} align="center" gutterBottom>
                          PURCHASE ORDER
                        </Typography>
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">Order #:</Typography>
                            <Typography variant="body2" fontWeight={700}>{viewDialog.settlement.orderNumber}</Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">Vendor:</Typography>
                            <Typography variant="body2" fontWeight={700}>{viewDialog.settlement.vendor?.name || '—'}</Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">Total Amount:</Typography>
                            <Typography variant="body2" fontWeight={800} color="primary">{formatPKR(viewDialog.settlement.totalAmount)}</Typography>
                          </Grid>
                        </Grid>
                        <Table size="small" sx={{ border: '1px solid #ddd' }}>
                          <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>Item</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }} align="center">Qty</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }} align="right">Unit Price</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }} align="right">Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(viewDialog.settlement.items || []).map((it, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{it.name || it.itemName || '—'}</TableCell>
                                <TableCell align="center">{it.quantity}</TableCell>
                                <TableCell align="right">{formatPKR(it.unitPrice)}</TableCell>
                                <TableCell align="right">{formatPKR(it.totalPrice || it.quantity * it.unitPrice)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Paper>
                    </Box>
                  )}

                  {/* Comparative Statement Tab */}
                  {viewDialog.poAuditTab === 2 && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                      <ComparativeStatementView
                        requisition={viewDialog.settlement?.indent}
                        quotations={viewDialog.poQuotations || []}
                        approvalAuthority={viewDialog.settlement?.indent?.comparativeStatementApprovals || {}}
                        note={viewDialog.settlement?.indent?.notes ?? ''}
                        readOnly
                        formatNumber={(n) => (n == null ? '0.00' : parseFloat(n).toFixed(2))}
                        loadingQuotations={false}
                        showPrintButton={false}
                      />
                    </Box>
                  )}

                  {/* Quotations Tab */}
                  {viewDialog.poAuditTab === 3 && (
                    <Box sx={{ p: 2 }}>
                      {viewDialog.poQuotations?.length === 0 ? (
                        <Typography color="text.secondary" align="center">No quotations recorded.</Typography>
                      ) : (
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Vendor</TableCell>
                              <TableCell align="right">Quoted Amount</TableCell>
                              <TableCell>Terms</TableCell>
                              <TableCell align="center">Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {viewDialog.poQuotations.map((q, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{q.vendor?.name || '—'}</TableCell>
                                <TableCell align="right">{formatPKR(q.totalAmount || 0)}</TableCell>
                                <TableCell>{q.paymentTerms || '—'}</TableCell>
                                <TableCell align="center">
                                  <Chip label={q.status || 'Received'} size="small" />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </Box>
                  )}

                  {/* Attached Docs */}
                  {viewDialog.poAuditTab === 4 && (
                    <Box sx={{ p: 2 }}>
                      {viewDialog.poLinkedDocs?.length === 0 ? (
                        <Typography color="text.secondary" align="center">No attachments available.</Typography>
                      ) : (
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Doc Name</TableCell>
                              <TableCell>Source</TableCell>
                              <TableCell align="right">Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {viewDialog.poLinkedDocs.map((d, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{d.name}</TableCell>
                                <TableCell>{d.source}</TableCell>
                                <TableCell align="right">
                                  {d.url && (
                                    <Button size="small" variant="outlined" onClick={() => window.open(d.url, '_blank')}>
                                      View
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </Box>
                  )}
                </>
              ) : viewDialog.isCashApproval && isGeneralModuleCashApproval(viewDialog.settlement) ? (
                <CashApprovalGeneralDetailShell embedded hideBack ca={viewDialog.settlement} />
              ) : viewDialog.isCashApproval ? (
                <CashApprovalDetailTabsView
                  cashApproval={viewDialog.settlement}
                  tabValue={viewDialog.poAuditTab ?? 0}
                  onTabChange={(v) => setViewDialog((prev) => ({ ...prev, poAuditTab: v }))}
                  quotations={viewDialog.quotations || []}
                  linkedDocs={viewDialog.caLinkedDocs || []}
                />
              ) : (
                /* Payment Settlement View */
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6" fontWeight={700} align="center" gutterBottom>
                    {viewDialog.settlement.parentCompanyName || 'PAYMENT SETTLEMENT'}
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Document #:</Typography>
                      <Typography variant="body2" fontWeight={700}>{viewDialog.settlement.referenceNumber || '—'}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Payee:</Typography>
                      <Typography variant="body2" fontWeight={700}>{viewDialog.settlement.toWhomPaid || '—'}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Amount:</Typography>
                      <Typography variant="body2" fontWeight={800} color="primary">{formatPKR(viewDialog.settlement.grandTotal || viewDialog.settlement.amount || 0)}</Typography>
                    </Grid>
                  </Grid>
                  <Typography variant="body2" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    {viewDialog.settlement.forWhat || viewDialog.settlement.notes || 'No additional remarks'}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => {
                setWorkflowHistoryDialog({ open: true, settlement: viewDialog.settlement });
              }}
              sx={{ mr: 1 }}
            >
              Workflow History
            </Button>
            <Button variant="outlined" onClick={() => setViewDialog((prev) => ({ ...prev, open: false }))}>
              Close
            </Button>
          </Box>

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={() => {
                const it = viewDialog.settlement;
                setViewDialog((prev) => ({ ...prev, open: false }));
                openApprove(it);
              }}
            >
              Approve (CEO)
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => {
                const it = viewDialog.settlement;
                setViewDialog((prev) => ({ ...prev, open: false }));
                openReject(it);
              }}
            >
              Reject
            </Button>
            <Button
              variant="contained"
              color="warning"
              startIcon={<WarningIcon />}
              onClick={() => {
                const it = viewDialog.settlement;
                setViewDialog((prev) => ({ ...prev, open: false }));
                openReturn(it);
              }}
            >
              Return
            </Button>
          </Stack>
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

          {/* Digital Signature only shown for PO / Settlement, auto-applied for Cash Approval */}
          {!approveDialog.settlement?.isCashApproval && (
            <TextField
              fullWidth
              label="Digital Signature (Required)"
              value={approvalSignature}
              onChange={(e) => setApprovalSignature(e.target.value)}
              placeholder="Type your name as digital signature"
              required
              sx={{ mb: 2 }}
            />
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
            disabled={
              actionLoading ||
              !approvalAgree ||
              (!approveDialog.settlement?.isCashApproval && !approvalSignature.trim())
            }
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

          <TextField
            fullWidth
            label="Digital Signature"
            value={rejectionSignature}
            onChange={(e) => setRejectionSignature(e.target.value)}
            required
            sx={{ mb: 2 }}
          />

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
            disabled={actionLoading || !rejectionAgree || !rejectionComments.trim() || !rejectionSignature.trim()}
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

          <TextField
            fullWidth
            label="Digital Signature"
            value={returnSignature}
            onChange={(e) => setReturnSignature(e.target.value)}
            required
            sx={{ mb: 2 }}
          />

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
            disabled={actionLoading || !returnAgree || !returnComments.trim() || !returnSignature.trim() || returnObservations.filter((o) => o.observation.trim()).length === 0}
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
          history={workflowHistoryDialog.settlement?.workflowHistory || []}
          title={`Workflow History: ${workflowHistoryDialog.settlement?.displayRef || ''}`}
        />
      )}
    </Card>
  );
};

export default ExecutiveCeoPaymentsSection;
