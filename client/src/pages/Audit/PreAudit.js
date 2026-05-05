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
  TablePagination,
  Divider,
  Alert,
  Skeleton,
  alpha,
  useTheme,
  Tabs,
  Tab,
  Stack,
  Tooltip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Comment as CommentIcon,
  Send as SendIcon,
  Description as DescriptionIcon,
  Business as BusinessIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  AttachFile as AttachFileIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import paymentSettlementService from '../../services/paymentSettlementService';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';
import toast from 'react-hot-toast';
import WorkflowHistoryDialog from '../../components/WorkflowHistoryDialog';
import ComparativeStatementView from '../../components/Procurement/ComparativeStatementView';
import QuotationDetailView from '../../components/Procurement/QuotationDetailView';
import { DigitalSignatureImage } from '../../components/common/DigitalSignatureImage';

const PreAudit = () => {
  const theme = useTheme();
  const { user } = useAuth();
  
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    sourceDepartment: '',
    sourceModule: '',
    documentType: '',
    priority: ''
  });
  const [tabValue, setTabValue] = useState(0);
  
  // Dialog states
  const [viewDialog, setViewDialog] = useState({ open: false, document: null, fullDocument: null, loading: false, quotations: [], grns: [], caLinkedDocs: [], poAuditTab: 0 });
  const [imageViewer, setImageViewer] = useState({ open: false, imageUrl: '', imageName: '', isBlob: false });
  const [approveDialog, setApproveDialog] = useState({ open: false, document: null });
  const [forwardDialog, setForwardDialog] = useState({ open: false, document: null });
  const [observationDialog, setObservationDialog] = useState({ open: false, document: null });
  const [returnDialog, setReturnDialog] = useState({ open: false, document: null });
  const [rejectDialog, setRejectDialog] = useState({ open: false, document: null });
  const [workflowHistoryDialog, setWorkflowHistoryDialog] = useState({ open: false, document: null });
  const [approvalComments, setApprovalComments] = useState('');
  const [forwardComments, setForwardComments] = useState('');
  const [observation, setObservation] = useState({ text: '', severity: 'medium' });
  const [returnComments, setReturnComments] = useState('');
  const [rejectionComments, setRejectionComments] = useState('');
  const [rejectObservations, setRejectObservations] = useState([{ observation: '', severity: 'medium' }]);

  const normalizeRole = (value) => String(value || '').toLowerCase().replace(/\s+/g, '_');
  const userHasRoleLabel = (accepted = []) => {
    const set = accepted.map((r) => normalizeRole(r));
    const direct = normalizeRole(user?.role);
    if (set.includes(direct)) return true;
    const roleRefNames = [user?.roleRef?.name, user?.roleRef?.displayName].map(normalizeRole).filter(Boolean);
    if (roleRefNames.some((n) => set.includes(n))) return true;
    const roleNames = Array.isArray(user?.roles)
      ? user.roles.flatMap((r) => [normalizeRole(r?.name), normalizeRole(r?.displayName)]).filter(Boolean)
      : [];
    return roleNames.some((n) => set.includes(n));
  };
  const isAuditDirectorUser = () =>
    userHasRoleLabel(['audit_director', 'audit director']) ||
    normalizeRole(user?.role) === 'super_admin' ||
    normalizeRole(user?.role) === 'developer';
  const isAuditReviewerUser = () =>
    userHasRoleLabel(['audit_manager', 'auditor']) ||
    normalizeRole(user?.role) === 'super_admin' ||
    normalizeRole(user?.role) === 'developer';
  const hasInitialApproval = (doc) =>
    Boolean(
      doc?.initialAuditApproved ||
      doc?.initialAuditApprovedAt ||
      doc?.preAuditInitialApprovedAt ||
      doc?.reviewedAt
    );

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Remove status from filters since we set it based on tab
      const { status: _, ...filtersWithoutStatus } = filters;
      
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...filtersWithoutStatus
      });
      
      // Filter by status based on tab
      if (tabValue === 0) {
        params.set('status', 'pending');
      } else if (tabValue === 1) {
        params.set('status', 'under_review');
      } else if (tabValue === 2) {
        params.set('status', 'forwarded_to_director');
      } else if (tabValue === 3) {
        params.set('status', 'approved');
      } else if (tabValue === 4) {
        params.set('status', 'returned_with_observations');
      }
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await api.get(`/pre-audit?${params}`);
      setDocuments(response.data.data);
      setTotalCount(response.data.pagination.totalCount);
    } catch (error) {
      console.error('Error fetching pre-audit documents:', error);
      setError(error.response?.data?.message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery, filters, tabValue]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleForward = async () => {
    try {
      setError(null);
      const doc = forwardDialog.document;
      
      // Forward to Audit Director - works for both PreAudit and workflow documents
      await api.put(`/pre-audit/${doc._id}/forward`, {
        forwardComments
      });
      
      setSuccess('Document forwarded to Audit Director successfully');
      setForwardDialog({ open: false, document: null });
      setForwardComments('');
      fetchDocuments();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to forward document');
    }
  };

  const handleApprove = async () => {
    try {
      setError(null);
      const doc = approveDialog.document;
      
      // Pre-GRN PO: Audit Director approves via procurement after forward (super_admin may approve from Pending on server)
      if (doc.isCashApproval) {
        await api.put(`/cash-approvals/${doc._id}/audit-approve`, {
          approvalComments
        });
      } else if (doc.isPurchaseOrder && !doc.isPostGrnAudit) {
        await api.put(`/procurement/purchase-orders/${doc._id}/audit-approve`, {
          approvalComments
        });
      } else if (doc.status === 'forwarded_to_director' || doc.workflowStatus === 'Forwarded to Audit Director') {
        await api.put(`/pre-audit/${doc._id}/approve`, {
          approvalComments
        });
      } else if (doc.isWorkflowDocument) {
        // For workflow documents that are not forwarded, use payment settlement API
        await api.patch(`/payment-settlements/${doc._id}/approve`, {
          comments: approvalComments
        });
      } else {
        // For regular Pre Audit documents
        await api.put(`/pre-audit/${doc._id}/approve`, {
          approvalComments
        });
      }
      
      setSuccess('Document approved successfully');
      setApproveDialog({ open: false, document: null });
      setApprovalComments('');
      fetchDocuments();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to approve document');
    }
  };

  const handleSendToFinanceFromAudit = async (doc) => {
    try {
      setError(null);
      await api.post(`/procurement/store/po/${doc._id}/send-to-finance`);
      setSuccess('Purchase order sent to Finance for billing');
      fetchDocuments();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to send purchase order to Finance');
    }
  };

  const handleAddObservation = async () => {
    try {
      setError(null);
      await api.put(`/pre-audit/${observationDialog.document._id}/add-observation`, {
        observation: observation.text,
        severity: observation.severity
      });
      setSuccess('Observation added successfully');
      setObservationDialog({ open: false, document: null });
      setObservation({ text: '', severity: 'medium' });
      fetchDocuments();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to add observation');
    }
  };

  const handleReturn = async () => {
    try {
      setError(null);
      const doc = returnDialog.document;
      
      if (doc.isCashApproval) {
        await api.put(`/cash-approvals/${doc._id}/audit-return`, {
          returnComments
        });
      } else if (doc.isPurchaseOrder) {
        await api.put(`/procurement/purchase-orders/${doc._id}/audit-return`, {
          returnComments
        });
      } else if (doc.isWorkflowDocument) {
        // For workflow documents, return to "Returned from Audit" status
        // Collect observations from the document if they exist
        const observations = doc.observations && doc.observations.length > 0
          ? doc.observations.map(obs => ({
              observation: obs.observation || obs.text || obs,
              severity: obs.severity || 'medium'
            }))
          : [];
        
        await api.put(`/pre-audit/${doc._id}/return`, {
          returnComments,
          observations: observations.length > 0 ? observations : undefined
        });
      } else {
        // For regular Pre Audit documents
        await api.put(`/pre-audit/${doc._id}/return`, {
          returnComments
        });
      }
      
      setSuccess('Document returned to department successfully');
      setReturnDialog({ open: false, document: null });
      setReturnComments('');
      fetchDocuments();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to return document');
    }
  };

  const handleReject = async () => {
    try {
      setError(null);
      const doc = rejectDialog.document;
      
      // Prepare observations array
      const observations = rejectObservations
        .filter(obs => obs.observation.trim())
        .map(obs => ({
          observation: obs.observation,
          severity: obs.severity
        }));

      if (!rejectionComments.trim() && observations.length === 0) {
        setError('Please provide rejection comments or at least one observation');
        return;
      }

      if (doc.isCashApproval) {
        await api.put(`/cash-approvals/${doc._id}/audit-reject`, {
          rejectionComments: rejectionComments || 'Rejected with observations',
          observations: observations.length > 0 ? observations : undefined
        });
        setSuccess('Cash approval rejected successfully.');
      } else if (doc.isPurchaseOrder) {
        await api.put(`/procurement/purchase-orders/${doc._id}/audit-reject`, {
          rejectionComments: rejectionComments || 'Rejected with observations',
          observations: observations.length > 0 ? observations : undefined
        });
        setSuccess('Purchase order rejected successfully.');
      } else {
        await api.put(`/pre-audit/${doc._id}/reject`, {
          rejectionComments: rejectionComments || 'Rejected with observations',
          observations: observations.length > 0 ? observations : undefined
        });
        setSuccess('Document rejected and returned to initiator. They can correct and resend.');
      }
      setRejectDialog({ open: false, document: null });
      setRejectionComments('');
      setRejectObservations([{ observation: '', severity: 'medium' }]);
      fetchDocuments();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to reject document');
    }
  };

  const addRejectObservation = () => {
    setRejectObservations([...rejectObservations, { observation: '', severity: 'medium' }]);
  };

  const removeRejectObservation = (index) => {
    setRejectObservations(rejectObservations.filter((_, i) => i !== index));
  };

  const updateRejectObservation = (index, field, value) => {
    const updated = [...rejectObservations];
    updated[index][field] = value;
    setRejectObservations(updated);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      under_review: 'info',
      forwarded_to_director: 'primary',
      approved: 'success',
      returned_with_observations: 'error',
      rejected: 'error'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'default',
      medium: 'info',
      high: 'warning',
      urgent: 'error'
    };
    return colors[priority] || 'default';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'default',
      medium: 'info',
      high: 'warning',
      critical: 'error'
    };
    return colors[severity] || 'default';
  };

  // Format date to match Payment Settlement style (22-Dec-25)
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

  // Number to words converter for Purchase Orders
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
    if (paise > 0) {
      result += ' and ' + convert(paise) + ' Paise';
    }
    result += ' Only';
    
    return result;
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

  const renderComparativeApprovalProgress = (indent, { title = 'Comparative approval progress' } = {}) => {
    if (!indent) return null;
    const ca = indent.comparativeApproval || {};
    const steps = Array.isArray(ca.approvers) ? ca.approvers : [];
    const authorityUserMap = (() => {
      const csa = indent?.comparativeStatementApprovals || {};
      const slots = [
        { key: 'preparedByUser', label: 'Prepared By' },
        { key: 'verifiedByUser', label: 'Verified By (Procurement Committee)' },
        { key: 'authorisedRepUser', label: 'Authorised Rep.' },
        { key: 'financeRepUser', label: 'Finance Rep.' },
        { key: 'managerProcurementUser', label: 'Manager Procurement' }
      ];
      const map = new Map();
      slots.forEach((slot) => {
        const id = csa?.[slot.key]?._id || csa?.[slot.key];
        if (!id) return;
        map.set(String(id), slot.label);
      });
      return map;
    })();

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        {steps.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No comparative approval chain is recorded for this requisition.
          </Typography>
        ) : (
          <>
            <Table size="small" sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 760 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Authority / approver</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date &amp; time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Digital signature</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {steps.map((step, idx) => {
                  const approver = step.approver;
                  const aid = approver?._id || approver;
                  const name =
                    [approver?.firstName, approver?.lastName].filter(Boolean).join(' ').trim() ||
                    approver?.email ||
                    (aid ? `User ${String(aid).slice(-6)}` : `Approver ${idx + 1}`);
                  const authorityLabel = authorityUserMap.get(String(aid || ''));
                  const status = step.status || 'pending';
                  const chipColor = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
                  const chipLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending approval';
                  return (
                    <TableRow key={String(aid || idx)}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {authorityLabel || 'Approver'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={chipLabel}
                          color={chipColor}
                          variant={status === 'pending' ? 'outlined' : 'filled'}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {step.actedAt ? new Date(step.actedAt).toLocaleString() : '—'}
                      </TableCell>
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
            {ca?.status === 'rejected' && ca?.rejectionObservation ? (
              <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1 }}>
                Observation: {ca.rejectionObservation}
              </Typography>
            ) : null}
          </>
        )}
      </Box>
    );
  };

  const renderIndentApprovalProgress = (indent, { title = 'Indent approval progress' } = {}) => {
    if (!indent) return null;
    const steps = Array.isArray(indent.approvalChain) ? indent.approvalChain : [];
    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        {steps.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No indent approval chain is recorded for this requisition.
          </Typography>
        ) : (
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
              {steps.map((step, idx) => {
                const approver = step.approver;
                const aid = approver?._id || approver;
                const name =
                  [approver?.firstName, approver?.lastName].filter(Boolean).join(' ').trim() ||
                  approver?.email ||
                  (aid ? `User ${String(aid).slice(-6)}` : `Approver ${idx + 1}`);
                const status = step.status || 'pending';
                const chipColor = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
                const chipLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending approval';
                return (
                  <TableRow key={String(aid || idx)}>
                    <TableCell>{name}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={chipLabel}
                        color={chipColor}
                        variant={status === 'pending' ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {step.actedAt ? new Date(step.actedAt).toLocaleString() : '—'}
                    </TableCell>
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
        )}
      </Box>
    );
  };

  // Purchase Order View Component
  const PurchaseOrderView = ({ poData }) => {
    if (!poData) return null;
    const authorityText = poData.approvalAuthorities || {};
    const indent = poData.indent && typeof poData.indent === 'object' ? poData.indent : {};
    const csa = indent.comparativeStatementApprovals || {};
    const approvalSteps = Array.isArray(indent?.comparativeApproval?.approvers)
      ? indent.comparativeApproval.approvers
      : [];
    const stepByUserId = new Map(
      approvalSteps.map((step) => [String(step?.approver?._id || step?.approver || ''), step])
    );
    const personName = (user, fallback = '') => (
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
      || user?.email
      || fallback
      || '—'
    );
    const authorityRows = [
      { key: 'preparedBy', label: 'Prepared By', user: csa.preparedByUser, fallback: authorityText.preparedBy || csa.preparedBy || '' },
      { key: 'verifiedBy', label: 'Verified By (Procurement Committee)', user: csa.verifiedByUser, fallback: authorityText.verifiedBy || csa.verifiedBy || '' },
      { key: 'authorisedRep', label: 'Authorised Rep.', user: csa.authorisedRepUser, fallback: authorityText.authorisedRep || csa.authorisedRep || '' },
      { key: 'financeRep', label: 'Finance Rep.', user: csa.financeRepUser, fallback: authorityText.financeRep || csa.financeRep || '' },
      { key: 'managerProcurement', label: 'Manager Procurement', user: csa.managerProcurementUser, fallback: authorityText.managerProcurement || csa.managerProcurement || '' },
      { key: 'preAuditInitial', label: 'Initial Pre-Audit', user: poData.preAuditInitialApprovedBy, fallback: '' },
      { key: 'auditDirectorApproval', label: 'Audit Director', user: poData.auditApprovedBy, fallback: '' }
    ];
    const authorityApprovalByKey = new Map(
      (Array.isArray(poData.authorityApprovals) ? poData.authorityApprovals : [])
        .filter((entry) => entry?.authorityKey)
        .map((entry) => [String(entry.authorityKey), entry])
    );
    const auditAction = poData.auditRejectedBy
        ? {
            label: 'Rejected by Pre-Audit',
            user: poData.auditRejectedBy,
            actedAt: poData.auditRejectedAt,
            comments: poData.auditRejectionComments || ''
          }
        : poData.auditReturnedBy
          ? {
              label: 'Returned by Pre-Audit',
              user: poData.auditReturnedBy,
              actedAt: poData.auditReturnedAt,
              comments: poData.auditReturnComments || ''
            }
          : null;
    
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

        {/* Audit Rejection Observations - Show if status is Rejected */}
        {poData.status === 'Rejected' && poData.auditRejectObservations && poData.auditRejectObservations.length > 0 && (
          <Box sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.error.main, 0.1), border: `1px solid ${theme.palette.error.main}`, borderRadius: 1 }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'error.main', fontWeight: 'bold' }}>
              Audit Rejection Observations
            </Typography>
            {poData.auditRejectionComments && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Rejection Comments:</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                  {poData.auditRejectionComments}
                </Typography>
              </Box>
            )}
            {poData.auditRejectObservations.map((obs, index) => (
              <Box key={index} sx={{ mb: 1.5, p: 1.5, bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'error.light' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Observation {index + 1}
                  </Typography>
                  {obs.severity && (
                    <Chip 
                      label={obs.severity.charAt(0).toUpperCase() + obs.severity.slice(1)} 
                      size="small" 
                      color={obs.severity === 'critical' ? 'error' : obs.severity === 'high' ? 'warning' : 'default'}
                    />
                  )}
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                  {obs.observation}
                </Typography>
              </Box>
            ))}
            {poData.auditRejectedBy && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                Rejected by: {poData.auditRejectedBy?.firstName || ''} {poData.auditRejectedBy?.lastName || ''}
                {poData.auditRejectedAt && ` on ${formatDate(poData.auditRejectedAt)}`}
              </Typography>
            )}
          </Box>
        )}

        {/* Audit Observations & Procurement Responses - Show when PO was returned/rejected and resubmitted (Pending Audit) or has answers */}
        {(() => {
          const observations = poData.auditObservations && poData.auditObservations.length > 0
            ? poData.auditObservations
            : (poData.auditRejectObservations || []).map((obs, idx) => ({
                observation: typeof obs === 'object' ? obs.observation : obs,
                severity: typeof obs === 'object' ? (obs.severity || 'medium') : 'medium',
                addedBy: poData.auditRejectedBy,
                addedAt: poData.auditRejectedAt,
                answer: null,
                answeredBy: null,
                answeredAt: null,
                resolved: false
              }));
          const showSection = (poData.status === 'Pending Audit' || poData.status === 'Returned from Audit') && observations.length > 0;
          const hasChangeSummary = poData.resubmissionChangeSummary && String(poData.resubmissionChangeSummary).trim().length > 0;
          if (!showSection) return null;
          return (
            <Box sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.08), border: '1px solid', borderColor: 'warning.main', borderRadius: 1 }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'warning.dark', fontWeight: 'bold' }}>
                Audit Observations &amp; Procurement Responses
              </Typography>
              {poData.auditReturnComments && poData.status === 'Returned from Audit' && (
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
              {/* Show changes made to PO by Procurement when they resubmitted (e.g. quantity reduced) */}
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
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Observation {index + 1}
                    </Typography>
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
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: obs.answer ? 1.5 : 0 }}>
                    {obs.observation}
                  </Typography>
                  {obs.answer ? (
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
                  ) : hasChangeSummary ? (
                    <Typography variant="caption" sx={{ color: 'info.dark', display: 'block', mt: 1 }}>
                      Procurement updated the PO in response (see changes above).
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mt: 1 }}>
                      No response from Procurement yet
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          );
        })()}

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

          {/* Right Column - PO Details */}
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
              <Typography component="span">
                {typeof poData.deliveryAddress === 'string' && poData.deliveryAddress.trim()
                  ? poData.deliveryAddress.trim()
                  : poData.shippingAddress && typeof poData.shippingAddress === 'object'
                    ? [poData.shippingAddress.street, poData.shippingAddress.city, poData.shippingAddress.state, poData.shippingAddress.zipCode, poData.shippingAddress.country].filter(Boolean).join(', ') || (poData.vendor?.address || '___________')
                    : poData.vendor?.address || '___________'}
              </Typography>
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
              {poData.items && poData.items.length > 0 ? (
                poData.items.map((item, index) => (
                  <tr key={index} style={{ border: '1px solid #000' }}>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                      {index + 1}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                      {item.productCode || poData.indent?.items?.[index]?.itemCode || `44-001-${String(index + 1).padStart(4, '0')}`}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                      {item.description || poData.indent?.items?.[index]?.itemName || '___________'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                      {item.specification || poData.indent?.items?.[index]?.specification || poData.indent?.items?.[index]?.description || poData.indent?.items?.[index]?.purpose || '___________'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                      {item.brand || poData.indent?.items?.[index]?.brand || '___________'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                      {item.quantity ? `${formatNumber(item.quantity)} ${item.unit || 'Nos'}` : '___________'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                      {item.unitPrice ? formatNumber(item.unitPrice) : '___________'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                      {item.amount ? formatNumber(item.amount) : '___________'}
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
              <Typography component="span" sx={{ ml: 1 }}>
                {poData.paymentTerms || '100% Advance Payment'}
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
                Delivery within: {poData.quotation?.deliveryTime || '03 days'} of confirmed PO & Payment
              </Typography>
            </Box>
            <Typography sx={{ mb: 1 }}>
              Rates Are Exclusive Of all The Taxes
            </Typography>
            {poData.vendor?.cnic && (
              <Typography sx={{ mb: 1 }}>
                CNIC {poData.vendor.cnic}
              </Typography>
            )}
            {poData.vendor?.payeeName && (
              <Typography>
                Payee Name: {poData.vendor.payeeName}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" fontWeight={700} mb={1.5} sx={{ textAlign: 'center' }}>
          APPROVAL AUTHORITIES
        </Typography>
        <TableContainer component={Box} sx={{ border: '1px solid #ccc', mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700 }}>Authority</TableCell>
                <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, textAlign: 'center' }}>Digital Signature</TableCell>
                <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {authorityRows.map((row) => {
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
                return (
                  <TableRow key={row.key}>
                    <TableCell sx={{ border: '1px solid #ccc', fontWeight: 600 }}>{row.label}</TableCell>
                    <TableCell sx={{ border: '1px solid #ccc' }}>{personName(authorityUser, row.fallback)}</TableCell>
                    <TableCell sx={{ border: '1px solid #ccc', textAlign: 'center' }}>
                      {authorityUser?.digitalSignature ? (
                        <DigitalSignatureImage userOrPath={authorityUser} alt={`${row.label} signature`} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ border: '1px solid #ccc' }}>
                      {actionDate ? formatDateTime(actionDate) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {auditAction && (
                <TableRow>
                  <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, color: 'primary.main' }}>
                    {auditAction.label}
                  </TableCell>
                  <TableCell sx={{ border: '1px solid #ccc' }}>
                    {personName(auditAction.user)}
                    {auditAction.comments ? (
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25 }}>
                        {auditAction.comments}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell sx={{ border: '1px solid #ccc', textAlign: 'center' }}>
                    {auditAction.user?.digitalSignature ? (
                      <DigitalSignatureImage userOrPath={auditAction.user} alt="Pre-Audit signature" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ border: '1px solid #ccc' }}>
                    {auditAction.actedAt ? formatDateTime(auditAction.actedAt) : '—'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        
      </Paper>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Pre Audit
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="under_review">Under Review</MenuItem>
                  <MenuItem value="forwarded_to_director">Forwarded to Director</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="returned_with_observations">Returned</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Module</InputLabel>
                <Select
                  value={filters.sourceModule}
                  label="Module"
                  onChange={(e) => setFilters({ ...filters, sourceModule: e.target.value })}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="hr">HR</MenuItem>
                  <MenuItem value="finance">Finance</MenuItem>
                  <MenuItem value="procurement">Procurement</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="sales">Sales</MenuItem>
                  <MenuItem value="crm">CRM</MenuItem>
                  <MenuItem value="it">IT</MenuItem>
                  <MenuItem value="general">General</MenuItem>
                  <MenuItem value="taj_residencia">Taj Residencia</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Document Type</InputLabel>
                <Select
                  value={filters.documentType}
                  label="Document Type"
                  onChange={(e) => setFilters({ ...filters, documentType: e.target.value })}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="invoice">Invoice</MenuItem>
                  <MenuItem value="receipt">Receipt</MenuItem>
                  <MenuItem value="agreement">Agreement</MenuItem>
                  <MenuItem value="report">Report</MenuItem>
                  <MenuItem value="statement">Statement</MenuItem>
                  <MenuItem value="certificate">Certificate</MenuItem>
                  <MenuItem value="license">License</MenuItem>
                  <MenuItem value="permit">Permit</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={filters.priority}
                  label="Priority"
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
            <Tab label="Pending" />
            <Tab label="Under Review" />
            <Tab label="Forwarded to Director" />
            <Tab label="Approved" />
            <Tab label="Returned" />
          </Tabs>

          {loading ? (
            <Box>
              <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" height={200} />
            </Box>
          ) : documents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <DescriptionIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No documents found
              </Typography>
            </Box>
          ) : (() => {
            // Group documents by department, then month + year
            const groupedData = documents.reduce((acc, doc) => {
              const dept = doc.sourceDepartmentName || 'Other';
              const date = new Date(doc.documentDate || doc.createdAt || doc.date);
              const year = date.getFullYear();
              const month = date.toLocaleString('default', { month: 'long' }); // e.g., "January"
              const monthNum = date.getMonth(); // 0-11 for sorting
              const monthYearKey = `${month} ${year}`; // e.g., "December 2025"
              const sortKey = `${year}-${String(monthNum).padStart(2, '0')}`; // For sorting: "2025-11"
              
              if (!acc[dept]) {
                acc[dept] = {};
              }
              if (!acc[dept][monthYearKey]) {
                acc[dept][monthYearKey] = { sortKey, documents: [] };
              }
              acc[dept][monthYearKey].documents.push(doc);
              return acc;
            }, {});

            return (
              <Box>
                {Object.entries(groupedData).map(([department, monthYears]) => {
                  const totalDocuments = Object.values(monthYears).reduce((sum, m) => sum + m.documents.length, 0);

                  return (
                    <Accordion key={department} defaultExpanded sx={{ mb: 2 }}>
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          backgroundColor: '#f5f5f5',
                          '&:hover': {
                            backgroundColor: '#eeeeee'
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                          <BusinessIcon color="primary" />
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {department}
                          </Typography>
                          <Chip
                            label={`${totalDocuments} document${totalDocuments !== 1 ? 's' : ''}`}
                            size="small"
                            color="primary"
                            sx={{ ml: 'auto' }}
                          />
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 0 }}>
                        <Box>
                          {Object.entries(monthYears)
                            .sort(([, a], [, b]) => b.sortKey.localeCompare(a.sortKey)) // Sort by year-month descending (newest first)
                            .map(([monthYear, { documents: monthDocuments }]) => (
                              <Accordion key={`${department}-${monthYear}`} defaultExpanded sx={{ mb: 1, boxShadow: 'none', border: '1px solid #e0e0e0' }}>
                                <AccordionSummary
                                  expandIcon={<ExpandMoreIcon />}
                                  sx={{
                                    backgroundColor: '#fafafa',
                                    '&:hover': {
                                      backgroundColor: '#f5f5f5'
                                    },
                                    pl: 3
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                    <ScheduleIcon color="secondary" />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                      {monthYear}
                                    </Typography>
                                    <Chip
                                      label={`${monthDocuments.length} document${monthDocuments.length !== 1 ? 's' : ''}`}
                                      size="small"
                                      color="secondary"
                                      sx={{ ml: 'auto' }}
                                    />
                                  </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ p: 0 }}>
                                  <TableContainer component={Paper} variant="outlined">
                                    <Table>
                                      <TableHead>
                                        <TableRow sx={{ background: '#fafafa' }}>
                                          <TableCell>Document #</TableCell>
                                          <TableCell>Title</TableCell>
                                          <TableCell>Module</TableCell>
                                          <TableCell>Type</TableCell>
                                          <TableCell>Date</TableCell>
                                          <TableCell>Priority</TableCell>
                                          <TableCell>Status</TableCell>
                                          <TableCell>Actions</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {monthDocuments.map((doc) => (
                                          <TableRow key={doc._id} hover>
                                            <TableCell>{doc.documentNumber}</TableCell>
                                            <TableCell>
                                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                <Typography variant="body2" fontWeight="medium">
                                                  {doc.title}
                                                </Typography>
                                                {doc.isWorkflowDocument && !doc.isPostGrnAudit && (
                                                  <Chip
                                                    label="Workflow"
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                  />
                                                )}
                                                {doc.isPostGrnAudit && (
                                                  <Chip
                                                    label="Post-GRN"
                                                    size="small"
                                                    color="warning"
                                                    variant="filled"
                                                  />
                                                )}
                                                {doc.isCashApproval && (
                                                  <Chip
                                                    label="Cash Approval"
                                                    size="small"
                                                    color="success"
                                                    variant="outlined"
                                                  />
                                                )}
                                              </Box>
                                              {doc.description && (
                                                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                                                  {doc.description}
                                                </Typography>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <Chip label={doc.sourceModule} size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell>
                                              <Chip label={doc.documentType} size="small" />
                                            </TableCell>
                                            <TableCell>{formatDate(doc.documentDate)}</TableCell>
                                            <TableCell>
                                              <Chip
                                                label={doc.priority}
                                                size="small"
                                                color={getPriorityColor(doc.priority)}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Chip
                                                label={doc.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                size="small"
                                                color={getStatusColor(doc.status)}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Stack direction="row" spacing={1}>
                                                <Tooltip title="View Details">
                                                  <IconButton
                                                    size="small"
                                                    onClick={async () => {
                                                      setViewDialog({ open: true, document: doc, fullDocument: null, loading: true });
                                                      
                                                      // If it's a Purchase Order, fetch full PO and related Comparative Statement data (quotations by indent)
                                                      if (doc.isPurchaseOrder) {
                                                        try {
                                                          const response = await api.get(`/procurement/purchase-orders/${doc._id}`);
                                                          let quotations = [];
                                                          let grns = [];
                                                          const poData = response.data.success ? response.data.data : null;
                                                          if (poData?.indent?._id) {
                                                            try {
                                                              const qRes = await api.get(`/procurement/quotations/by-indent/${poData.indent._id}`);
                                                              if (qRes.data?.success && Array.isArray(qRes.data.data)) {
                                                                quotations = qRes.data.data;
                                                              }
                                                            } catch (_) { /* ignore */ }
                                                          }
                                                          // Fetch GRNs linked to this PO
                                                          try {
                                                            const grnRes = await api.get('/procurement/goods-receive', { params: { purchaseOrder: doc._id, limit: 100 } });
                                                            if (grnRes.data?.success && Array.isArray(grnRes.data.data?.receives)) {
                                                              grns = grnRes.data.data.receives;
                                                            } else if (grnRes.data?.success && Array.isArray(grnRes.data.data)) {
                                                              grns = grnRes.data.data;
                                                            }
                                                          } catch (_) { /* ignore */ }
                                                          setViewDialog({ 
                                                            open: true, 
                                                            document: { ...doc, isPurchaseOrder: true }, 
                                                            fullDocument: poData,
                                                            loading: false,
                                                            quotations,
                                                            grns,
                                                            poAuditTab: 0
                                                          });
                                                        } catch (error) {
                                                          console.error('Error fetching purchase order:', error);
                                                          setViewDialog({ open: true, document: { ...doc, isPurchaseOrder: true }, fullDocument: null, loading: false, quotations: [], grns: [], poAuditTab: 0 });
                                                        }
                                                      } else if (doc.isCashApproval) {
                                                        try {
                                                          const response = await api.get(`/cash-approvals/${doc._id}`);
                                                          const caData = response.data?.success ? response.data.data : null;
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
                                                          if (caData?.indent?._id) {
                                                            try {
                                                              const qRes = await api.get(`/procurement/quotations/by-indent/${caData.indent._id}`);
                                                              if (qRes.data?.success && Array.isArray(qRes.data.data)) {
                                                                quotations = qRes.data.data;
                                                              }
                                                            } catch (_) { /* ignore */ }
                                                          }
                                                          pushDocs(caData?.attachments, 'General Attachment');
                                                          pushDocs(caData?.purchaseReceipts, 'Purchase Receipt');
                                                          pushDocs(caData?.receiptAttachments, 'Settlement Receipt');
                                                          setViewDialog({
                                                            open: true,
                                                            document: { ...doc, isCashApproval: true },
                                                            fullDocument: caData,
                                                            loading: false,
                                                            quotations,
                                                            caLinkedDocs: linkedDocuments,
                                                            grns: [],
                                                            poAuditTab: 0
                                                          });
                                                        } catch (error) {
                                                          console.error('Error fetching cash approval:', error);
                                                          setViewDialog({ open: true, document: { ...doc, isCashApproval: true }, fullDocument: null, loading: false, quotations: [], grns: [], caLinkedDocs: [], poAuditTab: 0 });
                                                        }
                                                      }
                                                      // If it's a workflow document (payment settlement), check if it's related to a PO
                                                      else if (doc.isWorkflowDocument && doc.workflowSubmodule === 'payment_settlement') {
                                                        try {
                                                          const response = await paymentSettlementService.getPaymentSettlement(doc._id);
                                                          const settlementData = response.data?.data || response.data;
                                                          
                                                          // Check if this payment settlement is related to a Purchase Order
                                                          // Check for isPurchaseOrder flag or try to find PO by referenceNumber
                                                          if (settlementData.isPurchaseOrder || (settlementData.referenceNumber && settlementData.referenceNumber.startsWith('P'))) {
                                                            // Try to find the PO by referenceNumber or _id
                                                            try {
                                                              let poResponse;
                                                              if (settlementData.isPurchaseOrder && doc._id) {
                                                                // If settlement has isPurchaseOrder flag, use the doc._id to fetch PO
                                                                poResponse = await api.get(`/procurement/purchase-orders/${doc._id}`);
                                                              } else if (settlementData.referenceNumber) {
                                                                // Try to find PO by orderNumber
                                                                const searchResponse = await api.get(`/procurement/purchase-orders?search=${settlementData.referenceNumber}`);
                                                                if (searchResponse.data?.data?.length > 0) {
                                                                  poResponse = await api.get(`/procurement/purchase-orders/${searchResponse.data.data[0]._id}`);
                                                                }
                                                              }
                                                              
                                                              if (poResponse?.data?.success) {
                                                                let quotations = [];
                                                                const poData = poResponse.data.data;
                                                                if (poData?.indent?._id) {
                                                                  try {
                                                                    const qRes = await api.get(`/procurement/quotations/by-indent/${poData.indent._id}`);
                                                                    if (qRes.data?.success && Array.isArray(qRes.data.data)) quotations = qRes.data.data;
                                                                  } catch (_) {}
                                                                }
                                                                setViewDialog({ 
                                                                  open: true, 
                                                                  document: { ...doc, isPurchaseOrder: true }, 
                                                                  fullDocument: poData,
                                                                  loading: false,
                                                                  quotations,
                                                                  poAuditTab: 0
                                                                });
                                                              } else {
                                                                // Fallback to payment settlement view
                                                                setViewDialog({ 
                                                                  open: true, 
                                                                  document: doc, 
                                                                  fullDocument: settlementData,
                                                                  loading: false 
                                                                });
                                                              }
                                                            } catch (poError) {
                                                              console.error('Error fetching related purchase order:', poError);
                                                              // Fallback to payment settlement view
                                                              setViewDialog({ 
                                                                open: true, 
                                                                document: doc, 
                                                                fullDocument: settlementData,
                                                                loading: false 
                                                              });
                                                            }
                                                          } else {
                                                            // Regular payment settlement - show payment settlement view
                                                            setViewDialog({ 
                                                              open: true, 
                                                              document: doc, 
                                                              fullDocument: settlementData,
                                                              loading: false 
                                                            });
                                                          }
                                                        } catch (error) {
                                                          console.error('Error fetching full document:', error);
                                                          setViewDialog({ 
                                                            open: true, 
                                                            document: doc, 
                                                            fullDocument: doc.originalDocument || null,
                                                            loading: false 
                                                          });
                                                        }
                                                      } else {
                                                        // Check if doc has originalDocument with isPurchaseOrder flag
                                                        if (doc.originalDocument?.isPurchaseOrder || doc.originalDocument?.orderNumber) {
                                                          setViewDialog({ 
                                                            open: true, 
                                                            document: { ...doc, isPurchaseOrder: true }, 
                                                            fullDocument: doc.originalDocument || null, 
                                                            loading: false 
                                                          });
                                                        } else {
                                                          setViewDialog({ open: true, document: doc, fullDocument: null, loading: false });
                                                        }
                                                      }
                                                    }}
                                                  >
                                                    <ViewIcon fontSize="small" />
                                                  </IconButton>
                                                </Tooltip>
                                                {/* Action buttons based on status and user role */}
                                                {doc.status === 'pending' || doc.status === 'under_review' ? (
                                                  <>
                                                    {/* Post-GRN audit POs: Show "Send to Finance" instead of standard audit actions */}
                                                    {doc.isPostGrnAudit ? (
                                                      (user?.role === 'audit_manager' || user?.role === 'super_admin' || user?.role === 'developer' || user?.role === 'auditor') && (
                                                        <Tooltip title="Send to Finance">
                                                          <IconButton
                                                            size="small"
                                                            color="success"
                                                            onClick={() => handleSendToFinanceFromAudit(doc)}
                                                          >
                                                            <SendIcon fontSize="small" />
                                                          </IconButton>
                                                        </Tooltip>
                                                      )
                                                    ) : (
                                                      <>
                                                        {/* Audit staff: forward to Audit Director (director approves after forward) */}
                                                        {isAuditReviewerUser() && (
                                                          <Tooltip title={hasInitialApproval(doc) ? 'Forward to Audit Director' : 'Initial approval required first'}>
                                                            <IconButton
                                                              size="small"
                                                              color="primary"
                                                              onClick={() => setForwardDialog({ open: true, document: doc })}
                                                              disabled={!hasInitialApproval(doc)}
                                                            >
                                                              <SendIcon fontSize="small" />
                                                            </IconButton>
                                                          </Tooltip>
                                                        )}
                                                        {/* Initial approval by assistant/auditor (or super admin) */}
                                                        {isAuditReviewerUser() && (
                                                          <Tooltip title={hasInitialApproval(doc) ? 'Initial approval already recorded' : 'Initial Approve'}>
                                                            <IconButton
                                                              size="small"
                                                              color="success"
                                                              onClick={() => setApproveDialog({ open: true, document: doc })}
                                                              disabled={hasInitialApproval(doc)}
                                                            >
                                                              <CheckCircleIcon fontSize="small" />
                                                            </IconButton>
                                                          </Tooltip>
                                                        )}
                                                        <Tooltip title="Add Observation">
                                                          <IconButton
                                                            size="small"
                                                            color="info"
                                                            onClick={() => setObservationDialog({ open: true, document: doc })}
                                                          >
                                                            <CommentIcon fontSize="small" />
                                                          </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Reject with Observation">
                                                          <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => setRejectDialog({ open: true, document: doc })}
                                                          >
                                                            <CancelIcon fontSize="small" />
                                                          </IconButton>
                                                        </Tooltip>
                                                        {doc.observations && doc.observations.length > 0 && (
                                                          <Tooltip title="Return to Department">
                                                            <IconButton
                                                              size="small"
                                                              color="warning"
                                                              onClick={() => setReturnDialog({ open: true, document: doc })}
                                                            >
                                                              <SendIcon fontSize="small" />
                                                            </IconButton>
                                                          </Tooltip>
                                                        )}
                                                      </>
                                                    )}
                                                  </>
                                                ) : (doc.status === 'forwarded_to_director' || doc.workflowStatus === 'Forwarded to Audit Director') ? (
                                                  <>
                                                    {/* Audit Director: final approval after forwarding */}
                                                    {isAuditDirectorUser() && (
                                                      <>
                                                        <Tooltip title="Final Approve">
                                                          <IconButton
                                                            size="small"
                                                            color="success"
                                                            onClick={() => setApproveDialog({ open: true, document: doc })}
                                                          >
                                                            <CheckCircleIcon fontSize="small" />
                                                          </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Reject with Observation">
                                                          <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => setRejectDialog({ open: true, document: doc })}
                                                          >
                                                            <CancelIcon fontSize="small" />
                                                          </IconButton>
                                                        </Tooltip>
                                                      </>
                                                    )}
                                                  </>
                                                ) : null}
                                              </Stack>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </TableContainer>
                                </AccordionDetails>
                              </Accordion>
                            ))}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Box>
            );
          })()}

          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        </CardContent>
      </Card>

      {/* View Document Dialog */}
      <Dialog
        open={viewDialog.open}
        onClose={() => setViewDialog({ open: false, document: null, fullDocument: null, loading: false, quotations: [], grns: [], caLinkedDocs: [], poAuditTab: 0 })}
        maxWidth={(viewDialog.document?.isPurchaseOrder || viewDialog.document?.isCashApproval || (viewDialog.document?.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder)) ? false : "md"}
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 0,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            background: '#ffffff',
            ...((viewDialog.document?.isPurchaseOrder || viewDialog.document?.isCashApproval || (viewDialog.document?.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder)) && {
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
        <DialogTitle sx={{ 
          p: 0,
          m: 0,
          '@media print': { display: (viewDialog.document?.isPurchaseOrder || viewDialog.document?.isCashApproval || (viewDialog.document?.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder)) ? 'none' : 'block' }
        }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            p: 2,
            borderBottom: '1px solid #e0e0e0'
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
              {viewDialog.document?.isCashApproval
                ? 'Cash Approval Details'
                : (viewDialog.document?.isPurchaseOrder || (viewDialog.document?.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder))
                  ? 'Purchase Order Details'
                  : 'PAYMENT SETTLEMENT'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {(viewDialog.document?.isPurchaseOrder || viewDialog.document?.isCashApproval || (viewDialog.document?.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder)) && (
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
                onClick={() => setViewDialog({ open: false, document: null, fullDocument: null, loading: false, quotations: [], grns: [], caLinkedDocs: [], poAuditTab: 0 })}
                sx={{ color: '#666', '@media print': { display: 'none' } }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, background: '#ffffff', overflow: 'auto', '@media print': { p: 0, overflow: 'visible' } }}>
          {viewDialog.loading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>Loading document details...</Typography>
            </Box>
          ) : viewDialog.document && (
            <Box sx={{ 
              p: (viewDialog.document.isPurchaseOrder || viewDialog.document.isCashApproval || (viewDialog.document.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder)) ? 0 : 4, 
              background: '#ffffff',
              fontFamily: (viewDialog.document.isPurchaseOrder || viewDialog.document.isCashApproval || (viewDialog.document.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder)) ? 'Arial, sans-serif' : '"Times New Roman", serif'
            }} className={(viewDialog.document.isPurchaseOrder || viewDialog.document.isCashApproval || (viewDialog.document.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder)) ? "print-content" : ""}>
              {/* Show Purchase Order + Comparative Statement + Quotations when it's a PO (for audit) */}
              {(viewDialog.document.isPurchaseOrder && viewDialog.fullDocument) ? (
                <>
                  <Tabs
                    value={viewDialog.poAuditTab ?? 0}
                    onChange={(_, v) => setViewDialog(prev => ({ ...prev, poAuditTab: v }))}
                    sx={{ px: 2, pt: 1, borderBottom: 1, borderColor: 'divider', '@media print': { display: 'none' } }}
                    variant="scrollable"
                    scrollButtons="auto"
                  >
                    <Tab label="Indent" />
                    <Tab label="Purchase Order" />
                    <Tab label="Comparative Statement" />
                    <Tab label={`Quotations (${viewDialog.quotations?.length || 0})`} />
                    <Tab label={viewDialog.grns?.length > 0 ? `GRN(s) (${viewDialog.grns.length})` : 'GRN(s)'} />
                  </Tabs>

                  {/* Tab 0: Indent */}
                  {viewDialog.poAuditTab === 0 && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                      {!viewDialog.fullDocument?.indent ? (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No indent linked to this Purchase Order.</Typography>
                      ) : (
                        <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="h5" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 1 }}>
                            Purchase Request Form
                          </Typography>
                          {viewDialog.fullDocument.indent.title && (
                            <Typography variant="h6" fontWeight={600} align="center" sx={{ mb: 2 }}>{viewDialog.fullDocument.indent.title}</Typography>
                          )}
                          <Box sx={{ mb: 1.5, fontSize: '0.9rem', textAlign: 'center' }}>
                            <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
                            <Typography component="span" sx={{ ml: 1 }}>{viewDialog.fullDocument.indent.erpRef || 'PR #' + (viewDialog.fullDocument.indent.indentNumber?.split('-').pop() || '')}</Typography>
                          </Box>
                          <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <Box><Typography component="span" fontWeight={600}>Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.fullDocument.indent.requestedDate)}</Typography></Box>
                            <Box><Typography component="span" fontWeight={600}>Required Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.fullDocument.indent.requiredDate) || '—'}</Typography></Box>
                            <Box><Typography component="span" fontWeight={600}>Indent No.:</Typography><Typography component="span" sx={{ ml: 1 }}>{viewDialog.fullDocument.indent.indentNumber || '—'}</Typography></Box>
                          </Box>
                          <Box sx={{ mb: 3, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <Box><Typography component="span" fontWeight={600}>Department:</Typography><Typography component="span" sx={{ ml: 1 }}>{viewDialog.fullDocument.indent.department?.name || viewDialog.fullDocument.indent.department || '—'}</Typography></Box>
                            <Box><Typography component="span" fontWeight={600}>Originator:</Typography><Typography component="span" sx={{ ml: 1 }}>{viewDialog.fullDocument.indent.requestedBy?.firstName && viewDialog.fullDocument.indent.requestedBy?.lastName ? `${viewDialog.fullDocument.indent.requestedBy.firstName} ${viewDialog.fullDocument.indent.requestedBy.lastName}` : viewDialog.fullDocument.indent.requestedBy?.name || '—'}</Typography></Box>
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
                                {(viewDialog.fullDocument.indent.items || []).map((item, idx) => (
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
                          {viewDialog.fullDocument.indent.justification && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Justification:</Typography>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>{viewDialog.fullDocument.indent.justification}</Typography>
                            </Box>
                          )}
                          {renderIndentApprovalProgress(viewDialog.fullDocument.indent, {
                            title: 'Indent approval progress'
                          })}
                        </Paper>
                      )}
                    </Box>
                  )}

                  {/* Tab 1: Purchase Order */}
                  {viewDialog.poAuditTab === 1 && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                      <PurchaseOrderView 
                        poData={{
                          ...viewDialog.fullDocument,
                          auditObservations: viewDialog.fullDocument?.auditObservations || 
                                            viewDialog.document?.auditObservations || 
                                            viewDialog.document?.originalDocument?.auditObservations ||
                                            []
                        }} 
                      />
                    </Box>
                  )}

                  {/* Tab 2: Comparative Statement */}
                  {viewDialog.poAuditTab === 2 && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                      <ComparativeStatementView
                        requisition={viewDialog.fullDocument?.indent}
                        quotations={viewDialog.quotations || []}
                        approvalAuthority={viewDialog.fullDocument?.indent?.comparativeStatementApprovals || {}}
                        note={viewDialog.fullDocument?.indent?.notes ?? ''}
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
                      {(!viewDialog.quotations || viewDialog.quotations.length === 0) ? (
                        <Typography color="text.secondary">No quotations for this requisition.</Typography>
                      ) : (
                        <Stack spacing={4}>
                          {viewDialog.quotations.map((q) => (
                            <QuotationDetailView
                              key={q._id}
                              quotation={q}
                              formatNumber={formatNumber}
                              formatDateForPrint={formatDateForPrint}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}

                  {/* Tab 4: GRN(s) */}
                  {viewDialog.poAuditTab === 4 && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                      {(!viewDialog.grns || viewDialog.grns.length === 0) ? (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No GRN(s) attached to this Purchase Order.</Typography>
                      ) : (
                        viewDialog.grns.map((grn) => (
                          <Paper key={grn._id} sx={{ p: 4, mb: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="overline" color="textSecondary" sx={{ display: 'block', mb: 1 }}>Goods Received Note</Typography>
                            <Grid container sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 2 }} alignItems="center">
                              <Grid item xs={4}><Typography variant="h6" fontWeight="bold">SGC</Typography><Typography variant="body2" color="textSecondary">Head Office</Typography></Grid>
                              <Grid item xs={4} sx={{ textAlign: 'center' }}><Typography variant="h5" fontWeight="bold">Goods Received Note</Typography></Grid>
                              <Grid item xs={4} />
                            </Grid>
                            <Grid container spacing={3} sx={{ mb: 2 }}>
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="textSecondary">No.</Typography>
                                <Typography variant="body1" fontWeight="bold">{grn.receiveNumber || grn._id}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Supplier</Typography>
                                <Typography variant="body2">{[grn.supplier?.supplierId, grn.supplierName || grn.supplier?.name].filter(Boolean).join(' ') || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Address</Typography>
                                <Typography variant="body2">{grn.supplierAddress || grn.supplier?.address || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Narration</Typography>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{grn.narration || '—'}</Typography>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <Typography variant="caption" color="textSecondary">Date</Typography>
                                <Typography variant="body2">{formatDateForPrint(grn.receiveDate)}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Currency</Typography>
                                <Typography variant="body2">{grn.currency || 'Rupees'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>P.R No.</Typography>
                                <Typography variant="body2">{grn.prNumber || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>P.O No.</Typography>
                                <Typography variant="body2">{grn.poNumber || viewDialog.fullDocument?.orderNumber || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Store</Typography>
                                <Typography variant="body2">{grn.storeSnapshot || '—'}</Typography>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Gate Pass No.</Typography>
                                <Typography variant="body2">{grn.gatePassNo || '—'}</Typography>
                              </Grid>
                            </Grid>
                            <TableContainer sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>S. No</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Product Code</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Description</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Unit</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Quantity</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Rate</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Value Excl. ST</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(grn.items || []).map((item, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{idx + 1}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.itemCode || '—'}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.itemName || '—'}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.unit || '—'}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatNumber(item.quantity)}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatNumber(item.unitPrice)}</TableCell>
                                      <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{formatNumber(item.valueExcludingSalesTax ?? ((item.quantity || 0) * (item.unitPrice || 0)))}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                              <Grid container spacing={1} sx={{ maxWidth: 320 }}>
                                <Grid item xs={6}><Typography variant="body2">Discount</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2">{formatNumber(grn.discount)}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="body2">Other Charges</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2">{formatNumber(grn.otherCharges)}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="body2" fontWeight="bold">Net Amount</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2" fontWeight="bold">{formatNumber(grn.netAmount)}</Typography></Grid>
                                <Grid item xs={6}><Typography variant="body2" fontWeight="bold">Total</Typography></Grid>
                                <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2" fontWeight="bold">{formatNumber(grn.total ?? grn.netAmount)}</Typography></Grid>
                              </Grid>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="caption" color="textSecondary">Observation</Typography>
                            <Typography variant="body2" sx={{ minHeight: 24 }}>{grn.observation || ' '}</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 3 }}>
                              <Box>
                                <Typography variant="caption" color="textSecondary">Prepared By</Typography>
                                <Typography variant="body2" fontWeight="medium">{grn.preparedByName || (grn.receivedBy?.firstName && grn.receivedBy?.lastName ? `${grn.receivedBy.firstName} ${grn.receivedBy.lastName}` : '—')}</Typography>
                              </Box>
                              <Box sx={{ width: 120, height: 40, border: '1px dashed', borderColor: 'divider' }} />
                            </Box>
                          </Paper>
                        ))
                      )}
                    </Box>
                  )}
                </>
              ) : viewDialog.document.isWorkflowDocument && viewDialog.fullDocument ? (
                <>
                  {/* Document Header */}
                  <Box sx={{ 
                    mb: 3, 
                    borderBottom: '2px solid #000',
                    pb: 2
                  }}>
                    <Typography variant="h5" sx={{ 
                      fontWeight: 700, 
                      textAlign: 'center',
                      mb: 3,
                      fontSize: '24px',
                      letterSpacing: '1px'
                    }}>
                      {viewDialog.fullDocument.parentCompanyName || 'PAYMENT SETTLEMENT'}
                    </Typography>
                    
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          SITE:
                        </Typography>
                        <Typography variant="body2">
                          {viewDialog.fullDocument.site || 'Head Office'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          FROM:
                        </Typography>
                        <Typography variant="body2">
                          {viewDialog.fullDocument.fromDepartment || 'Administration'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          CUSTODIEN:
                        </Typography>
                        <Typography variant="body2">
                          {viewDialog.fullDocument.custodian || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          DATE:
                        </Typography>
                        <Typography variant="body2">
                          {formatDateForDocument(viewDialog.fullDocument.date)}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          DOCUMENT NUMBER:
                        </Typography>
                        <Typography variant="body2">
                          {viewDialog.fullDocument.referenceNumber || viewDialog.document?.documentNumber || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          NOTE:
                        </Typography>
                        <Typography variant="body2">
                          {viewDialog.fullDocument.attachments && viewDialog.fullDocument.attachments.length > 0 
                            ? 'All Supportings Attached' 
                            : 'No Attachments'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Transaction Details Table */}
                  <Box sx={{ mb: 3 }}>
                    <TableContainer component={Paper} sx={{ 
                      boxShadow: 'none',
                      border: '1px solid #000'
                    }}>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ background: '#f5f5f5' }}>
                            <TableCell sx={{ 
                              border: '1px solid #000', 
                              fontWeight: 700,
                              py: 1.5,
                              fontSize: '13px'
                            }}>
                              Date
                            </TableCell>
                            <TableCell sx={{ 
                              border: '1px solid #000', 
                              fontWeight: 700,
                              py: 1.5,
                              fontSize: '13px'
                            }}>
                              Reference No
                            </TableCell>
                            <TableCell sx={{ 
                              border: '1px solid #000', 
                              fontWeight: 700,
                              py: 1.5,
                              fontSize: '13px'
                            }}>
                              To Whom Paid
                            </TableCell>
                            <TableCell sx={{ 
                              border: '1px solid #000', 
                              fontWeight: 700,
                              py: 1.5,
                              fontSize: '13px'
                            }}>
                              For What
                            </TableCell>
                            <TableCell sx={{ 
                              border: '1px solid #000', 
                              fontWeight: 700,
                              py: 1.5,
                              fontSize: '13px',
                              textAlign: 'right'
                            }}>
                              Amount
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ 
                              border: '1px solid #000',
                              py: 2,
                              fontSize: '13px'
                            }}>
                              {formatDateForDocument(viewDialog.fullDocument.date)}
                            </TableCell>
                            <TableCell sx={{ 
                              border: '1px solid #000',
                              py: 2,
                              fontSize: '13px'
                            }}>
                              {viewDialog.fullDocument.referenceNumber || 'N/A'}
                            </TableCell>
                            <TableCell sx={{ 
                              border: '1px solid #000',
                              py: 2,
                              fontSize: '13px'
                            }}>
                              {viewDialog.fullDocument.toWhomPaid || 'N/A'}
                            </TableCell>
                            <TableCell sx={{ 
                              border: '1px solid #000',
                              py: 2,
                              fontSize: '13px',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {viewDialog.fullDocument.forWhat || 'N/A'}
                            </TableCell>
                            <TableCell sx={{ 
                              border: '1px solid #000',
                              py: 2,
                              fontSize: '13px',
                              textAlign: 'right',
                              fontWeight: 600
                            }}>
                              {formatPKR(viewDialog.fullDocument.amount)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  {/* Grand Total */}
                  <Box sx={{ 
                    mb: 4,
                    display: 'flex',
                    justifyContent: 'flex-end'
                  }}>
                    <Box sx={{ 
                      border: '2px solid #000',
                      p: 2,
                      minWidth: '250px',
                      background: '#f9f9f9'
                    }}>
                      <Typography variant="h6" sx={{ 
                        fontWeight: 700,
                        textAlign: 'right',
                        fontSize: '18px'
                      }}>
                        Grand Total: {formatPKR(viewDialog.fullDocument.grandTotal || viewDialog.fullDocument.amount || 0)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Approval Section */}
                  <Box sx={{ 
                    mt: 4,
                    borderTop: '1px solid #000',
                    pt: 3
                  }}>
                    <Grid container spacing={4}>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 600, 
                            mb: 2,
                            fontSize: '13px',
                            textDecoration: 'underline'
                          }}>
                            Prepared By:
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 600,
                            mb: 0.5,
                            fontSize: '13px'
                          }}>
                            {viewDialog.fullDocument.preparedBy || 'N/A'}
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            fontSize: '12px',
                            color: '#666'
                          }}>
                            {viewDialog.fullDocument.preparedByDesignation || 'Not specified'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 600, 
                            mb: 2,
                            fontSize: '13px',
                            textDecoration: 'underline'
                          }}>
                            Verified By:
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 600,
                            mb: 0.5,
                            fontSize: '13px'
                          }}>
                            {viewDialog.fullDocument.verifiedBy || 'N/A'}
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            fontSize: '12px',
                            color: '#666'
                          }}>
                            {viewDialog.fullDocument.verifiedByDesignation || 'Not specified'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 600, 
                            mb: 2,
                            fontSize: '13px',
                            textDecoration: 'underline'
                          }}>
                            Approved by:
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 600,
                            mb: 0.5,
                            fontSize: '13px'
                          }}>
                            {viewDialog.fullDocument.approvedBy || 'N/A'}
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            fontSize: '12px',
                            color: '#666'
                          }}>
                            {viewDialog.fullDocument.approvedByDesignation || 'Not specified'}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Observations Section */}
                  {(() => {
                    // Extract observations from workflowHistory
                    const observations = viewDialog.document.workflowHistory?.filter(entry => 
                      entry.comments && (
                        entry.comments.toLowerCase().includes('observation') || 
                        entry.comments.toLowerCase().includes('returned from pre audit with observations')
                      )
                    ) || [];

                    if (observations.length === 0) return null;

                    return (
                      <Box sx={{ 
                        mt: 4,
                        borderTop: '2px solid #d32f2f',
                        pt: 3
                      }}>
                        <Box sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          mb: 2
                        }}>
                          <ErrorIcon sx={{ color: '#d32f2f', mr: 1, fontSize: '20px' }} />
                          <Typography variant="body2" sx={{ 
                            fontWeight: 700, 
                            fontSize: '15px',
                            color: '#d32f2f',
                            textTransform: 'uppercase'
                          }}>
                            CRITICAL OBSERVATIONS:
                          </Typography>
                        </Box>
                        <Box sx={{ 
                          border: '2px solid #d32f2f',
                          p: 2.5,
                          background: '#ffebee',
                          borderRadius: '4px'
                        }}>
                          {observations.map((entry, index) => {
                            const observationMatch = entry.comments.match(/Observation\s*\(([^)]+)\):\s*(.+)/i);
                            const returnedMatch = entry.comments.match(/Returned from Pre Audit with observations:\s*(.+)/i);
                            
                            let observationText = entry.comments;
                            let severity = 'medium';
                            if (observationMatch) {
                              observationText = observationMatch[2];
                              severity = observationMatch[1].toLowerCase();
                            } else if (returnedMatch) {
                              observationText = returnedMatch[1];
                            }

                            const isCritical = severity.includes('high') || severity.includes('critical') || severity.includes('urgent');

                            return (
                              <Box key={index} sx={{ 
                                mb: index < observations.length - 1 ? 2.5 : 0,
                                p: 1.5,
                                background: isCritical ? '#ffcdd2' : '#fff',
                                border: `1px solid ${isCritical ? '#d32f2f' : '#ef5350'}`,
                                borderRadius: '4px'
                              }}>
                                {isCritical && (
                                  <Chip
                                    label="CRITICAL"
                                    size="small"
                                    sx={{
                                      mb: 1,
                                      background: '#d32f2f',
                                      color: '#fff',
                                      fontWeight: 700,
                                      fontSize: '10px'
                                    }}
                                  />
                                )}
                                <Typography variant="body2" sx={{ 
                                  fontSize: '12px',
                                  whiteSpace: 'pre-wrap',
                                  lineHeight: 1.7,
                                  color: '#c62828',
                                  fontWeight: 500
                                }}>
                                  {observationText}
                                </Typography>
                                {entry.changedBy && (
                                  <Typography variant="caption" sx={{ 
                                    display: 'block',
                                    mt: 1,
                                    color: '#d32f2f',
                                    fontSize: '11px'
                                  }}>
                                    — {entry.changedBy.firstName} {entry.changedBy.lastName}
                                    {(() => {
                                      // Extract department from workflowStatus
                                      let department = '';
                                      if (entry.toStatus) {
                                        if (entry.toStatus.includes('AM Admin')) department = 'AM Admin';
                                        else if (entry.toStatus.includes('HOD Admin')) department = 'HOD Admin';
                                        else if (entry.toStatus.includes('Audit')) department = 'Audit';
                                        else if (entry.toStatus.includes('Finance')) department = 'Finance';
                                        else if (entry.toStatus.includes('CEO Office')) department = 'CEO Office';
                                        else if (entry.toStatus.includes('Pre Audit')) department = 'Pre Audit';
                                      }
                                      return department ? ` (${department})` : '';
                                    })()}
                                    {entry.changedAt && ` • ${formatDateForDocument(entry.changedAt)}`}
                                  </Typography>
                                )}
                                {index < observations.length - 1 && (
                                  <Box sx={{ borderTop: '1px dashed #ef5350', mt: 2, pt: 2 }} />
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    );
                  })()}

                  {/* Document Attachments Section */}
                  {viewDialog.fullDocument.attachments && viewDialog.fullDocument.attachments.length > 0 && (
                    <Box sx={{ 
                      mt: 4,
                      borderTop: '1px solid #000',
                      pt: 3
                    }}>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 700, 
                        mb: 2,
                        fontSize: '14px',
                        textDecoration: 'underline'
                      }}>
                        ATTACHMENTS ({viewDialog.fullDocument.attachments.length}):
                      </Typography>
                      <Box sx={{ 
                        border: '1px solid #000',
                        p: 2
                      }}>
                        <Grid container spacing={1}>
                          {viewDialog.fullDocument.attachments.map((attachment, index) => {
                            const attachmentUrl = paymentSettlementService.getAttachmentUrl(viewDialog.fullDocument._id, attachment._id);
                            const isImage = attachment.mimeType.startsWith('image/');
                            const isPdf = attachment.mimeType === 'application/pdf';
                            
                            return (
                              <Grid item xs={12} key={attachment._id || index}>
                                <Box 
                                  sx={{ 
                                    p: 1.5, 
                                    border: '1px solid #ccc',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                      borderColor: '#000',
                                      background: '#f5f5f5'
                                    }
                                  }}
                                  onClick={async () => {
                                    if (isImage) {
                                      try {
                                        const blobUrl = await paymentSettlementService.getAttachmentBlobUrl(viewDialog.fullDocument._id, attachment._id);
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
                                  <Typography variant="body2" sx={{ 
                                    fontSize: '12px',
                                    fontWeight: 500
                                  }}>
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
              ) : (viewDialog.document.isCashApproval && viewDialog.fullDocument) ? (
                <>
                  <Tabs
                    value={viewDialog.poAuditTab ?? 0}
                    onChange={(_, v) => setViewDialog(prev => ({ ...prev, poAuditTab: v }))}
                    sx={{ px: 2, pt: 1, borderBottom: 1, borderColor: 'divider', '@media print': { display: 'none' } }}
                    variant="scrollable"
                    scrollButtons="auto"
                  >
                    <Tab label="Indent" />
                    <Tab label="Cash Approval" />
                    <Tab label="Comparative Statement" />
                    <Tab label={`Quotations (${viewDialog.quotations?.length || 0})`} />
                    <Tab label={`Linked Documents (${viewDialog.caLinkedDocs?.length || 0})`} />
                  </Tabs>

                  {viewDialog.poAuditTab === 0 && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                      {!viewDialog.fullDocument?.indent ? (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          No indent linked to this Cash Approval.
                        </Typography>
                      ) : (
                        <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="h5" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 1 }}>
                            Purchase Request Form
                          </Typography>
                          {viewDialog.fullDocument.indent.title && (
                            <Typography variant="h6" fontWeight={600} align="center" sx={{ mb: 2 }}>
                              {viewDialog.fullDocument.indent.title}
                            </Typography>
                          )}
                          <Box sx={{ mb: 1.5, fontSize: '0.9rem', textAlign: 'center' }}>
                            <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
                            <Typography component="span" sx={{ ml: 1 }}>
                              {viewDialog.fullDocument.indent.erpRef || 'PR #' + (viewDialog.fullDocument.indent.indentNumber?.split('-').pop() || '')}
                            </Typography>
                          </Box>
                          <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <Box><Typography component="span" fontWeight={600}>Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.fullDocument.indent.requestedDate)}</Typography></Box>
                            <Box><Typography component="span" fontWeight={600}>Required Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.fullDocument.indent.requiredDate) || '—'}</Typography></Box>
                            <Box><Typography component="span" fontWeight={600}>Indent No.:</Typography><Typography component="span" sx={{ ml: 1 }}>{viewDialog.fullDocument.indent.indentNumber || '—'}</Typography></Box>
                          </Box>
                          <Box sx={{ mb: 3, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <Box><Typography component="span" fontWeight={600}>Department:</Typography><Typography component="span" sx={{ ml: 1 }}>{viewDialog.fullDocument.indent.department?.name || viewDialog.fullDocument.indent.department || '—'}</Typography></Box>
                            <Box><Typography component="span" fontWeight={600}>Originator:</Typography><Typography component="span" sx={{ ml: 1 }}>{viewDialog.fullDocument.indent.requestedBy?.firstName && viewDialog.fullDocument.indent.requestedBy?.lastName ? `${viewDialog.fullDocument.indent.requestedBy.firstName} ${viewDialog.fullDocument.indent.requestedBy.lastName}` : viewDialog.fullDocument.indent.requestedBy?.name || '—'}</Typography></Box>
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
                                {(viewDialog.fullDocument.indent.items || []).map((item, idx) => (
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
                          {viewDialog.fullDocument.indent.justification && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Justification:</Typography>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                {viewDialog.fullDocument.indent.justification}
                              </Typography>
                            </Box>
                          )}
                          {renderIndentApprovalProgress(viewDialog.fullDocument.indent, {
                            title: 'Indent approval progress'
                          })}
                        </Paper>
                      )}
                    </Box>
                  )}

                  {viewDialog.poAuditTab === 1 && (
                    <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider', '@media print': { p: 2.5, maxWidth: '100%', mx: 0 } }}>
                      <Typography variant="h5" align="center" fontWeight={700} sx={{ mb: 2, letterSpacing: 1 }}>
                        CASH APPROVAL
                      </Typography>
                      <Box sx={{ mb: 1.5, fontSize: '0.9rem', textAlign: 'center' }}>
                        <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
                        <Typography component="span" sx={{ ml: 1 }}>
                          {viewDialog.fullDocument?.indent?.erpRef || viewDialog.fullDocument?.caNumber || '—'}
                        </Typography>
                      </Box>
                      <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <Box><Typography component="span" fontWeight={600}>CA Number:</Typography><Typography component="span" sx={{ ml: 1 }}>{viewDialog.fullDocument.caNumber || '—'}</Typography></Box>
                        <Box><Typography component="span" fontWeight={600}>Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.fullDocument.approvalDate)}</Typography></Box>
                        <Box><Typography component="span" fontWeight={600}>Status:</Typography><Typography component="span" sx={{ ml: 1 }}>{viewDialog.fullDocument.status || '—'}</Typography></Box>
                      </Box>
                      <Box sx={{ mb: 3, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <Box><Typography component="span" fontWeight={600}>Vendor:</Typography><Typography component="span" sx={{ ml: 1 }}>{viewDialog.fullDocument.vendor?.name || '—'}</Typography></Box>
                        <Box><Typography component="span" fontWeight={600}>Expected Purchase:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(viewDialog.fullDocument.expectedPurchaseDate) || '—'}</Typography></Box>
                        <Box><Typography component="span" fontWeight={600}>Total:</Typography><Typography component="span" sx={{ ml: 1, fontWeight: 700 }}>{formatPKR(viewDialog.fullDocument.totalAmount)}</Typography></Box>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Items</Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>#</TableCell>
                              <TableCell>Description</TableCell>
                              <TableCell align="right">Qty</TableCell>
                              <TableCell>Unit</TableCell>
                              <TableCell align="right">Unit Price</TableCell>
                              <TableCell align="right">Amount</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(viewDialog.fullDocument.items || []).map((row, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{row.description}</TableCell>
                                <TableCell align="right">{row.quantity}</TableCell>
                                <TableCell>{row.unit}</TableCell>
                                <TableCell align="right">{formatPKR(row.unitPrice)}</TableCell>
                                <TableCell align="right">{formatPKR(row.amount)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Approval authorities</Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Authority</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Approver</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Date &amp; Time</TableCell>
                              <TableCell sx={{ fontWeight: 700 }} align="center">Digital Signature</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(() => {
                              const authorityRows = [
                                { key: 'preparedBy', label: 'Prepared By' },
                                { key: 'verifiedBy', label: 'Verified By (Procurement Committee)' },
                                { key: 'authorisedRep', label: 'Authorised Rep.' },
                                { key: 'financeRep', label: 'Finance Rep.' },
                                { key: 'managerProcurement', label: 'Manager Procurement' }
                              ];
                              if (viewDialog.fullDocument?.preAuditInitialApprovedBy || viewDialog.fullDocument?.preAuditInitialApprovedAt) {
                                authorityRows.push({
                                  label: 'Pre-Audit Initial Approval',
                                  directApproval: true,
                                  approver: viewDialog.fullDocument.preAuditInitialApprovedBy || null,
                                  approvedAt: viewDialog.fullDocument.preAuditInitialApprovedAt || null
                                });
                              }
                              if (viewDialog.fullDocument?.auditApprovedBy || viewDialog.fullDocument?.auditApprovedAt) {
                                authorityRows.push({
                                  label: 'Audit Final Approval',
                                  directApproval: true,
                                  approver: viewDialog.fullDocument.auditApprovedBy || null,
                                  approvedAt: viewDialog.fullDocument.auditApprovedAt || null
                                });
                              }
                              const authorityApprovals = Array.isArray(viewDialog.fullDocument?.authorityApprovals)
                                ? viewDialog.fullDocument.authorityApprovals
                                : [];
                              const byKey = new Map(
                                authorityApprovals
                                  .map((a) => [String(a?.authorityKey || '').trim(), a])
                                  .filter(([k]) => Boolean(k))
                              );
                              const normalizeToken = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
                              const legacyApprover = viewDialog.fullDocument?.authorityApprovedBy;
                              const legacyAt = viewDialog.fullDocument?.authorityApprovedAt;
                              const legacyTokens = [
                                [legacyApprover?.firstName, legacyApprover?.lastName].filter(Boolean).join(' ').trim(),
                                legacyApprover?.email,
                                legacyApprover?.employeeId
                              ].map(normalizeToken).filter(Boolean);
                              let legacyApplied = false;
                              return authorityRows.map((row) => {
                                const explicitApproval = row?.key ? byKey.get(row.key) : null;
                                let approver = row?.directApproval
                                  ? row.approver
                                  : (explicitApproval?.approver && typeof explicitApproval.approver === 'object'
                                    ? explicitApproval.approver
                                    : null);
                                let approvedAt = row?.directApproval ? (row.approvedAt || null) : (explicitApproval?.approvedAt || null);
                                const assignedText = (viewDialog.fullDocument?.approvalAuthorities || {})[row.key] || '';
                                const assignedToken = normalizeToken(assignedText);
                                const legacyMatch = assignedToken && legacyTokens.some((t) => t === assignedToken || t.includes(assignedToken) || assignedToken.includes(t));
                                if (!row?.directApproval && !explicitApproval && !legacyApplied && legacyApprover && legacyAt && legacyMatch) {
                                  approver = legacyApprover;
                                  approvedAt = legacyAt;
                                  legacyApplied = true;
                                }
                                const approverName = approver
                                  ? ([approver?.firstName, approver?.lastName].filter(Boolean).join(' ').trim() || approver?.email || assignedText || '—')
                                  : (assignedText || '—');
                                const isApproved = Boolean(approvedAt);
                                return (
                                  <TableRow key={row.key}>
                                    <TableCell>{row.label}</TableCell>
                                    <TableCell>{approverName}</TableCell>
                                    <TableCell>
                                      <Chip
                                        size="small"
                                        label={isApproved ? 'Approved' : 'Pending'}
                                        color={isApproved ? 'success' : 'warning'}
                                        variant={isApproved ? 'filled' : 'outlined'}
                                      />
                                    </TableCell>
                                    <TableCell>{approvedAt ? new Date(approvedAt).toLocaleString() : '—'}</TableCell>
                                    <TableCell align="center">
                                      {isApproved && approver?.digitalSignature ? (
                                        <DigitalSignatureImage userOrPath={approver} alt={`${row.label} signature`} />
                                      ) : isApproved ? (
                                        <Typography variant="caption" color="text.secondary">No signature on file</Typography>
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">—</Typography>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              });
                            })()}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  )}

                  {viewDialog.poAuditTab === 2 && (
                    <Box sx={{ p: 2, overflowX: 'auto' }}>
                      <ComparativeStatementView
                        requisition={viewDialog.fullDocument?.indent}
                        quotations={viewDialog.quotations || []}
                        approvalAuthority={viewDialog.fullDocument?.indent?.comparativeStatementApprovals || {}}
                        note={viewDialog.fullDocument?.indent?.notes ?? ''}
                        readOnly
                        formatNumber={formatNumber}
                        loadingQuotations={false}
                        showPrintButton={false}
                      />
                    </Box>
                  )}

                  {viewDialog.poAuditTab === 3 && (
                    <Box sx={{ p: 2 }}>
                      {(!viewDialog.quotations || viewDialog.quotations.length === 0) ? (
                        <Typography color="text.secondary">No quotations for this requisition.</Typography>
                      ) : (
                        <Stack spacing={4}>
                          {viewDialog.quotations.map((q) => (
                            <QuotationDetailView
                              key={q._id}
                              quotation={q}
                              formatNumber={formatNumber}
                              formatDateForPrint={formatDateForPrint}
                            />
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}

                  {viewDialog.poAuditTab === 4 && (
                    <Box sx={{ p: 2 }}>
                      {(!viewDialog.caLinkedDocs || viewDialog.caLinkedDocs.length === 0) ? (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          No linked documents found for this Cash Approval.
                        </Typography>
                      ) : (
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>#</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Document</TableCell>
                                <TableCell>Date</TableCell>
                                <TableCell align="right">Action</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {viewDialog.caLinkedDocs.map((doc, idx) => (
                                <TableRow key={doc.id || idx}>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell>{doc.source || 'Attachment'}</TableCell>
                                  <TableCell>{doc.name || 'Document'}</TableCell>
                                  <TableCell>{doc.uploadedAt ? formatDate(doc.uploadedAt) : '—'}</TableCell>
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
              ) : (
                /* Regular Pre Audit Document View */
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12}>
                    <Typography variant="h6">{viewDialog.document.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {viewDialog.document.description}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Department</Typography>
                    <Typography variant="body2">{viewDialog.document.sourceDepartmentName}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Module</Typography>
                    <Typography variant="body2">{viewDialog.document.sourceModule}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Document Type</Typography>
                    <Typography variant="body2">{viewDialog.document.documentType}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Document Date</Typography>
                    <Typography variant="body2">{formatDate(viewDialog.document.documentDate)}</Typography>
                  </Grid>
                  {viewDialog.document.amount && (
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Amount</Typography>
                      <Typography variant="body2">{formatPKR(viewDialog.document.amount)}</Typography>
                    </Grid>
                  )}
                  {/* Show observations for regular PreAudit documents */}
                  {viewDialog.document.observations && 
                   !viewDialog.document.isPurchaseOrder && 
                   !viewDialog.document.isCashApproval &&
                   !(viewDialog.document.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder) &&
                   viewDialog.document.observations.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Observations</Typography>
                      {viewDialog.document.observations.map((obs, idx) => (
                        <Paper key={idx} sx={{ p: 2, mb: 1, bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Chip
                              label={obs.severity}
                              size="small"
                              color={getSeverityColor(obs.severity)}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(obs.addedAt)}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ mb: obs.answer ? 1.5 : 0 }}>{obs.observation}</Typography>
                          {obs.answer && (
                            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 1, border: '1px solid', borderColor: 'success.light' }}>
                              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                                Response from Procurement:
                              </Typography>
                              <Typography variant="body2">{obs.answer}</Typography>
                              {obs.answeredBy && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                                  Answered by: {obs.answeredBy?.firstName || ''} {obs.answeredBy?.lastName || ''}
                                  {obs.answeredAt && ` on ${formatDate(obs.answeredAt)}`}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Paper>
                      ))}
                    </Grid>
                  )}
                  {/* Show auditObservations for Purchase Orders */}
                  {(() => {
                    const isPO = viewDialog.document?.isPurchaseOrder || viewDialog.document?.isCashApproval || (viewDialog.document?.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder);
                    const observations = viewDialog.fullDocument?.auditObservations || viewDialog.document?.auditObservations || [];
                    const hasObservations = Array.isArray(observations) && observations.length > 0;
                    return isPO && hasObservations;
                  })() && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>Audit Observations</Typography>
                      {(viewDialog.fullDocument?.auditObservations || viewDialog.document?.auditObservations || []).map((obs, idx) => (
                        <Paper key={obs._id || idx} sx={{ p: 2, mb: 1, bgcolor: alpha(theme.palette.warning.main, 0.1), border: '1px solid', borderColor: 'warning.light' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Chip
                              label={obs.severity || 'medium'}
                              size="small"
                              color={getSeverityColor(obs.severity)}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {obs.addedAt ? formatDate(obs.addedAt) : 'N/A'}
                              {obs.addedBy && ` by ${obs.addedBy?.firstName || ''} ${obs.addedBy?.lastName || ''}`}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ mb: obs.answer ? 1.5 : 0, fontWeight: 500 }}>
                            {obs.observation}
                          </Typography>
                          {obs.answer && (
                            <Box sx={{ mt: 1.5, p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 1, border: '1px solid', borderColor: 'success.light' }}>
                              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5, color: 'success.dark' }}>
                                Response from Procurement:
                              </Typography>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{obs.answer}</Typography>
                              {obs.answeredBy && (
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                                  Answered by: {obs.answeredBy?.firstName || ''} {obs.answeredBy?.lastName || ''}
                                  {obs.answeredAt && ` on ${formatDate(obs.answeredAt)}`}
                                </Typography>
                              )}
                            </Box>
                          )}
                          {!obs.answer && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', mt: 1 }}>
                              No response provided yet
                            </Typography>
                          )}
                        </Paper>
                      ))}
                    </Grid>
                  )}
                  {viewDialog.document.attachments && viewDialog.document.attachments.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Attachments</Typography>
                      {viewDialog.document.attachments.map((att, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <AttachFileIcon sx={{ mr: 1 }} />
                          <Typography variant="body2">{att.originalName}</Typography>
                        </Box>
                      ))}
                    </Grid>
                  )}
                </Grid>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          p: 2, 
          borderTop: '1px solid #e0e0e0',
          background: '#f9f9f9',
          justifyContent: 'space-between'
        }}>
          <Box>
            {viewDialog.document?.isWorkflowDocument && viewDialog.fullDocument && (
              <>
                <Chip
                  label={viewDialog.fullDocument.workflowStatus || viewDialog.document.workflowStatus || 'Draft'}
                  color={getStatusColor(viewDialog.document.status)}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Chip
                  label={viewDialog.fullDocument.paymentType}
                  variant="outlined"
                  size="small"
                />
              </>
            )}
          </Box>
          <Box>
            {(viewDialog.document?.isWorkflowDocument || viewDialog.document?.isCashApproval) && viewDialog.fullDocument && (
              <Button
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => setWorkflowHistoryDialog({ open: true, document: viewDialog.fullDocument })}
                sx={{ minWidth: 150, mr: 1 }}
              >
                See Workflow History
              </Button>
            )}
            <Button 
              onClick={() => setViewDialog({ open: false, document: null, fullDocument: null, loading: false, quotations: [], grns: [], caLinkedDocs: [], poAuditTab: 0 })}
              variant="outlined"
              sx={{ minWidth: 80, '@media print': { display: 'none' } }}
            >
              Close
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Print Styles for Purchase Order / Cash Approval wide dialogs */}
      {(viewDialog.document?.isPurchaseOrder || viewDialog.document?.isCashApproval || (viewDialog.document?.isWorkflowDocument && viewDialog.fullDocument?.isPurchaseOrder)) && (
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

      {/* Workflow History Dialog */}
      <WorkflowHistoryDialog
        open={workflowHistoryDialog.open}
        onClose={() => setWorkflowHistoryDialog({ open: false, document: null })}
        document={workflowHistoryDialog.document}
        documentType="preAudit"
      />

      {/* Image Viewer Modal */}
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
        PaperProps={{
          sx: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            maxHeight: '90vh'
          }
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: 2,
            p: 2
          }}
        >
          <IconButton
            onClick={() => {
              if (imageViewer.isBlob && imageViewer.imageUrl) {
                URL.revokeObjectURL(imageViewer.imageUrl);
              }
              setImageViewer({ open: false, imageUrl: '', imageName: '', isBlob: false });
            }}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)'
              },
              zIndex: 1
            }}
          >
            <CloseIcon />
          </IconButton>
          <Box
            sx={{
              maxWidth: '100%',
              maxHeight: '80vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src={imageViewer.imageUrl}
              alt={imageViewer.imageName}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 8,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}
            />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              right: 16,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              borderRadius: 1,
              p: 2,
              color: 'white'
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold" noWrap>
              {imageViewer.imageName}
            </Typography>
          </Box>
        </Box>
      </Dialog>

      {/* Forward to Audit Director Dialog */}
      <Dialog
        open={forwardDialog.open}
        onClose={() => {
          setForwardDialog({ open: false, document: null });
          setForwardComments('');
        }}
      >
        <DialogTitle>Forward to Audit Director</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Forward Comments (Optional)"
            value={forwardComments}
            onChange={(e) => setForwardComments(e.target.value)}
            sx={{ mt: 2, minWidth: 400 }}
            placeholder="Add any comments for the Audit Director..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setForwardDialog({ open: false, document: null });
            setForwardComments('');
          }}>Cancel</Button>
          <Button onClick={handleForward} variant="contained" color="primary">
            Forward to Audit Director
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog
        open={approveDialog.open}
        onClose={() => {
          setApproveDialog({ open: false, document: null });
          setApprovalComments('');
        }}
      >
        <DialogTitle>
          {approveDialog.document?.status === 'forwarded_to_director' ||
          approveDialog.document?.workflowStatus === 'Forwarded to Audit Director'
            ? 'Final Approve (Audit Director)'
            : 'Initial Approve (Pre-Audit)'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={
              approveDialog.document?.status === 'forwarded_to_director' ||
              approveDialog.document?.workflowStatus === 'Forwarded to Audit Director'
                ? 'Final Approval Comments'
                : 'Initial Approval Comments'
            }
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            sx={{ mt: 2, minWidth: 400 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setApproveDialog({ open: false, document: null });
            setApprovalComments('');
          }}>Cancel</Button>
          <Button onClick={handleApprove} variant="contained" color="success">
            {approveDialog.document?.status === 'forwarded_to_director' ||
            approveDialog.document?.workflowStatus === 'Forwarded to Audit Director'
              ? 'Final Approve'
              : 'Initial Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Observation Dialog */}
      <Dialog
        open={observationDialog.open}
        onClose={() => {
          setObservationDialog({ open: false, document: null });
          setObservation({ text: '', severity: 'medium' });
        }}
      >
        <DialogTitle>Add Observation</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Observation"
            value={observation.text}
            onChange={(e) => setObservation({ ...observation, text: e.target.value })}
            sx={{ mt: 2, mb: 2, minWidth: 400 }}
            required
          />
          <FormControl fullWidth>
            <InputLabel>Severity</InputLabel>
            <Select
              value={observation.severity}
              label="Severity"
              onChange={(e) => setObservation({ ...observation, severity: e.target.value })}
            >
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setObservationDialog({ open: false, document: null });
            setObservation({ text: '', severity: 'medium' });
          }}>Cancel</Button>
          <Button
            onClick={handleAddObservation}
            variant="contained"
            color="primary"
            disabled={!observation.text}
          >
            Add Observation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Return Dialog */}
      <Dialog
        open={returnDialog.open}
        onClose={() => {
          setReturnDialog({ open: false, document: null });
          setReturnComments('');
        }}
      >
        <DialogTitle>Return Document to Department</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Return Comments"
            value={returnComments}
            onChange={(e) => setReturnComments(e.target.value)}
            sx={{ mt: 2, minWidth: 400 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setReturnDialog({ open: false, document: null });
            setReturnComments('');
          }}>Cancel</Button>
          <Button onClick={handleReturn} variant="contained" color="warning">
            Return to Department
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog.open}
        onClose={() => {
          setRejectDialog({ open: false, document: null });
          setRejectionComments('');
          setRejectObservations([{ observation: '', severity: 'medium' }]);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Reject Document with Observations</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will reject the document and return it to the initiator. They can correct and resend it.
          </Alert>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Comments"
            value={rejectionComments}
            onChange={(e) => setRejectionComments(e.target.value)}
            sx={{ mb: 3 }}
            required
          />

          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
            Observations (Optional)
          </Typography>
          
          {rejectObservations.map((obs, index) => (
            <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label={`Observation ${index + 1}`}
                    value={obs.observation}
                    onChange={(e) => updateRejectObservation(index, 'observation', e.target.value)}
                    placeholder="Enter observation..."
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={obs.severity}
                      label="Severity"
                      onChange={(e) => updateRejectObservation(index, 'severity', e.target.value)}
                    >
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={1}>
                  {rejectObservations.length > 1 && (
                    <IconButton
                      color="error"
                      onClick={() => removeRejectObservation(index)}
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Grid>
              </Grid>
            </Box>
          ))}
          
          <Button
            startIcon={<AddIcon />}
            onClick={addRejectObservation}
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
          >
            Add Another Observation
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setRejectDialog({ open: false, document: null });
            setRejectionComments('');
            setRejectObservations([{ observation: '', severity: 'medium' }]);
          }}>Cancel</Button>
          <Button 
            onClick={handleReject} 
            variant="contained" 
            color="error"
            disabled={!rejectionComments.trim() && rejectObservations.every(obs => !obs.observation.trim())}
          >
            Reject & Return
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PreAudit;

