import React, { useState, useEffect } from 'react';
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
  Alert,
  Stack,
  Tooltip,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab
} from '@mui/material';
import {
  Visibility as ViewIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Send as SendIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  Payment as PaymentIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  AttachMoney as AttachMoneyIcon,
  AttachFile as AttachFileIcon,
  Print as PrintIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  Schedule as ScheduleIcon,
  History as HistoryIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import paymentSettlementService from '../../services/paymentSettlementService';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';
import toast from 'react-hot-toast';
import WorkflowHistoryDialog from '../../components/WorkflowHistoryDialog';

const Payments = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState([]);
  const [tabValue, setTabValue] = useState(0);
  
  // Dialog states
  const [viewDialog, setViewDialog] = useState({ open: false, settlement: null });
  const [imageViewer, setImageViewer] = useState({ open: false, imageUrl: '', imageName: '', isBlob: false });
  const [approveDialog, setApproveDialog] = useState({ open: false, settlement: null });
  const [rejectDialog, setRejectDialog] = useState({ open: false, settlement: null });
  const [returnDialog, setReturnDialog] = useState({ open: false, settlement: null });
  const [workflowHistoryDialog, setWorkflowHistoryDialog] = useState({ open: false, settlement: null });
  
  // Form states
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
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchSettlements();
    fetchDepartments();
  }, [page, rowsPerPage, searchQuery, departmentFilter, tabValue]);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/hr/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery || undefined,
        fromDepartment: departmentFilter || undefined
      };

      // Fetch payment settlements and purchase orders for CEO Secretariat in parallel
      const [settlementsRes, poRes] = await Promise.all([
        paymentSettlementService.getPaymentSettlements(params),
        api.get('/procurement/purchase-orders/ceo-secretariat').catch(() => ({ data: { data: [] } }))
      ]);
      let allSettlements = settlementsRes.data?.settlements || [];
      const poList = poRes.data?.data || [];
      const poFormatted = poList.map(po => ({
        _id: po._id,
        workflowStatus: po.status,
        isPurchaseOrder: true,
        referenceNumber: po.orderNumber,
        date: po.orderDate,
        toWhomPaid: po.vendor?.name,
        forWhat: po.notes || 'Purchase Order',
        amount: po.totalAmount,
        grandTotal: po.totalAmount,
        fromDepartment: 'Procurement',
        ...po
      }));
      allSettlements = [...allSettlements, ...poFormatted];
      
      // Client-side filtering based on tab with proper status categorization
      // Document Flow Logic:
      // - Pending: Documents with "Send to CEO Office" status (waiting for action)
      // - Forwarded: Documents with "Forwarded to CEO" status (forwarded to CEO for review)
      // - Returned: Documents with "Returned from CEO Office" status (returned with observations)
      // - Approved: Documents with "Approved" or "Approved (from Send to CEO Office)" status
      // - Rejected: Documents with "Rejected" or "Rejected (from Send to CEO Office)" status
      // Note: When a returned document is resubmitted (status changes to "Send to CEO Office" or any department),
      // it will appear in Pending tab again if it reaches "Send to CEO Office"
      let filteredSettlements = allSettlements;
      if (tabValue === 0) {
        // Pending - Show "Send to CEO Office" status (exact match, not approved/rejected variants)
        filteredSettlements = allSettlements.filter(s => {
          const status = s.workflowStatus || '';
          // Must be exactly "Send to CEO Office" (includes resubmitted documents that reached CEO Office again)
          return status === 'Send to CEO Office';
        });
      } else if (tabValue === 1) {
        // Forwarded - Show "Forwarded to CEO" status
        filteredSettlements = allSettlements.filter(s => {
          const status = s.workflowStatus || '';
          return status === 'Forwarded to CEO';
        });
      } else if (tabValue === 2) {
        // Returned - Show "Returned from CEO Office" status
        filteredSettlements = allSettlements.filter(s => {
          const status = s.workflowStatus || '';
          return status === 'Returned from CEO Office';
        });
      } else if (tabValue === 3) {
        // Approved - Show only documents approved from "Send to CEO Office" or "Forwarded to CEO"
        // Must be "Approved (from Send to CEO Office)" or "Approved (from Forwarded to CEO)" - not approved from other departments
        filteredSettlements = allSettlements.filter(s => {
          const status = s.workflowStatus || '';
          // Only show if it's approved from Send to CEO Office or Forwarded to CEO
          return status === 'Approved (from Send to CEO Office)' || 
                 status === 'Approved (from Forwarded to CEO)' ||
                 (status.startsWith('Approved (from') && (status.includes('Send to CEO Office') || status.includes('Forwarded to CEO')));
        });
      } else if (tabValue === 4) {
        // Rejected - Show only documents rejected from "Send to CEO Office" or "Forwarded to CEO"
        // Must be "Rejected (from Send to CEO Office)" or "Rejected (from Forwarded to CEO)" - not rejected from other departments
        filteredSettlements = allSettlements.filter(s => {
          const status = s.workflowStatus || '';
          // Only show if it's rejected from Send to CEO Office or Forwarded to CEO
          return status === 'Rejected (from Send to CEO Office)' || 
                 status === 'Rejected (from Forwarded to CEO)' ||
                 (status.startsWith('Rejected (from') && (status.includes('Send to CEO Office') || status.includes('Forwarded to CEO')));
        });
      }
      
      setSettlements(filteredSettlements);
      setTotalCount(filteredSettlements.length);
    } catch (error) {
      console.error('Error fetching payments:', error);
      setError(error.response?.data?.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const handleForward = async () => {
    if (!approvalAgree || !approvalSignature.trim()) {
      toast.error('Please provide digital signature and agree to terms');
      return;
    }

    if (approveDialog.settlement?.isPurchaseOrder) {
      try {
        setActionLoading(true);
        setError(null);
        await api.put(`/procurement/purchase-orders/${approveDialog.settlement._id}/forward-to-ceo`, {
          comments: approvalComments,
          digitalSignature: approvalSignature
        });
        toast.success('Purchase order forwarded to CEO successfully');
        setApproveDialog({ open: false, settlement: null });
        setApprovalComments('');
        setApprovalSignature('');
        setApprovalAgree(false);
        fetchSettlements();
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to forward purchase order');
        toast.error('Failed to forward purchase order');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      
      // Forward to CEO by updating workflow status to "Forwarded to CEO"
      await paymentSettlementService.updateWorkflowStatus(approveDialog.settlement._id, {
        workflowStatus: 'Forwarded to CEO',
        comments: approvalComments || `Forwarded to CEO with digital signature: ${approvalSignature}`,
        digitalSignature: approvalSignature
      });
      
      toast.success('Payment forwarded to CEO successfully');
      setApproveDialog({ open: false, settlement: null });
      setApprovalComments('');
      setApprovalSignature('');
      setApprovalAgree(false);
      fetchSettlements();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to forward payment');
      toast.error('Failed to forward payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionAgree || !rejectionSignature.trim() || !rejectionComments.trim()) {
      toast.error('Please provide comments, digital signature, and agree to terms');
      return;
    }

    const observations = rejectObservations
      .filter(obs => obs.observation.trim())
      .map(obs => ({
        observation: obs.observation,
        severity: obs.severity
      }));

    if (rejectDialog.settlement?.isPurchaseOrder) {
      try {
        setActionLoading(true);
        setError(null);
        await api.put(`/procurement/purchase-orders/${rejectDialog.settlement._id}/ceo-secretariat-reject`, {
          rejectionComments,
          digitalSignature: rejectionSignature,
          observations: observations.length > 0 ? observations : undefined
        });
        toast.success('Purchase order rejected successfully');
        setRejectDialog({ open: false, settlement: null });
        setRejectionComments('');
        setRejectionSignature('');
        setRejectionAgree(false);
        setRejectObservations([{ observation: '', severity: 'medium' }]);
        fetchSettlements();
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to reject purchase order');
        toast.error('Failed to reject purchase order');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      
      await paymentSettlementService.rejectPayment(rejectDialog.settlement._id, {
        comments: rejectionComments,
        observations: observations.length > 0 ? observations : undefined,
        digitalSignature: rejectionSignature
      });
      
      toast.success('Payment rejected successfully');
      setRejectDialog({ open: false, settlement: null });
      setRejectionComments('');
      setRejectionSignature('');
      setRejectionAgree(false);
      setRejectObservations([{ observation: '', severity: 'medium' }]);
      fetchSettlements();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to reject payment');
      toast.error('Failed to reject payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!returnAgree || !returnSignature.trim() || !returnComments.trim()) {
      toast.error('Please provide comments, digital signature, and agree to terms');
      return;
    }

    const observations = returnObservations
      .filter(obs => obs.observation.trim())
      .map(obs => ({
        observation: obs.observation,
        severity: obs.severity
      }));

    if (returnDialog.settlement?.isPurchaseOrder) {
      try {
        setActionLoading(true);
        setError(null);
        await api.put(`/procurement/purchase-orders/${returnDialog.settlement._id}/ceo-secretariat-return`, {
          returnComments,
          digitalSignature: returnSignature,
          observations: observations.length > 0 ? observations : undefined
        });
        toast.success('Purchase order returned to procurement successfully');
        setReturnDialog({ open: false, settlement: null });
        setReturnComments('');
        setReturnSignature('');
        setReturnAgree(false);
        setReturnObservations([{ observation: '', severity: 'medium' }]);
        fetchSettlements();
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to return purchase order');
        toast.error('Failed to return purchase order');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      
      // Build comments with observations
      let returnCommentsText = `Returned from Payments with observations: ${returnComments}`;
      if (observations.length > 0) {
        const observationTexts = observations.map((obs, idx) => 
          `Observation ${idx + 1} (${obs.severity || 'medium'}): ${obs.observation}`
        ).join('; ');
        returnCommentsText = `${returnCommentsText}. Observations: ${observationTexts}`;
      }
      if (returnSignature) {
        returnCommentsText = `${returnCommentsText} [Digital Signature: ${returnSignature}]`;
      }
      
      // Use "Returned from CEO Office" status to indicate it's returned with observations
      await paymentSettlementService.updateWorkflowStatus(returnDialog.settlement._id, {
        workflowStatus: 'Returned from CEO Office',
        comments: returnCommentsText
      });
      
      toast.success('Payment returned with observations successfully');
      setReturnDialog({ open: false, settlement: null });
      setReturnComments('');
      setReturnSignature('');
      setReturnAgree(false);
      setReturnObservations([{ observation: '', severity: 'medium' }]);
      fetchSettlements();
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to return payment');
      toast.error('Failed to return payment');
    } finally {
      setActionLoading(false);
    }
  };

  const addObservation = (type) => {
    if (type === 'reject') {
      setRejectObservations([...rejectObservations, { observation: '', severity: 'medium' }]);
    } else {
      setReturnObservations([...returnObservations, { observation: '', severity: 'medium' }]);
    }
  };

  const removeObservation = (index, type) => {
    if (type === 'reject') {
      setRejectObservations(rejectObservations.filter((_, i) => i !== index));
    } else {
      setReturnObservations(returnObservations.filter((_, i) => i !== index));
    }
  };

  const updateObservation = (index, field, value, type) => {
    if (type === 'reject') {
      const updated = [...rejectObservations];
      updated[index][field] = value;
      setRejectObservations(updated);
    } else {
      const updated = [...returnObservations];
      updated[index][field] = value;
      setReturnObservations(updated);
    }
  };

  const getWorkflowStatusColor = (workflowStatus) => {
    if (!workflowStatus) return 'default';
    if (workflowStatus.includes('Approved')) return 'success';
    if (workflowStatus.includes('Rejected')) return 'error';
    if (workflowStatus.includes('Returned')) return 'warning';
    if (workflowStatus.includes('Send to')) return 'info';
    return 'default';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const handlePrint = () => {
    if (!viewDialog.settlement) return;
    
    const printWindow = window.open('', '_blank');
    const settlement = viewDialog.settlement;
    const printDate = new Date().toLocaleString();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Settlement Record - ${settlement?.referenceNumber?.trim() || settlement?._id || 'N/A'}</title>
          <style>
            body { font-family: 'Times New Roman', serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .section { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .total { text-align: right; font-weight: bold; }
            .signature-section { margin-top: 40px; display: flex; justify-content: space-around; }
            .signature-box { text-align: center; width: 30%; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>PAYMENT SETTLEMENT</h1>
            <div class="subtitle">Reference Number: ${settlement?.referenceNumber?.trim() || settlement?._id || 'N/A'}</div>
          </div>
          <div class="section">
            <table>
              <tr>
                <th>Date</th>
                <th>Reference No</th>
                <th>To Whom Paid</th>
                <th>For What</th>
                <th>Amount</th>
              </tr>
              <tr>
                <td>${formatDateForDocument(settlement?.date)}</td>
                <td>${settlement?.referenceNumber?.trim() || settlement?._id || 'N/A'}</td>
                <td>${settlement?.toWhomPaid || 'N/A'}</td>
                <td>${settlement?.forWhat || 'N/A'}</td>
                <td class="total">${formatPKR(settlement?.amount)}</td>
              </tr>
            </table>
            <div class="total" style="margin-top: 20px;">
              <strong>Grand Total: ${formatPKR(settlement?.grandTotal)}</strong>
            </div>
          </div>
          <div class="signature-section">
            <div class="signature-box">
              <div><strong>Prepared By:</strong></div>
              <div>${settlement?.preparedBy || 'N/A'}</div>
              <div>${settlement?.preparedByDesignation || ''}</div>
            </div>
            <div class="signature-box">
              <div><strong>Verified By:</strong></div>
              <div>${settlement?.verifiedBy || 'N/A'}</div>
              <div>${settlement?.verifiedByDesignation || ''}</div>
            </div>
            <div class="signature-box">
              <div><strong>Approved by:</strong></div>
              <div>${settlement?.approvedBy || 'N/A'}</div>
              <div>${settlement?.approvedByDesignation || ''}</div>
            </div>
          </div>
          <div style="margin-top: 40px; font-size: 12px; color: #666;">
            <p>Generated from SGC ERP System - Payment Settlement Module</p>
            <p>Printed: ${printDate}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Payments
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
                placeholder="Search payments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select
                  value={departmentFilter}
                  label="Department"
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                  <MenuItem value="">All Departments</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept.name}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Tabs value={tabValue} onChange={(e, newValue) => {
            setTabValue(newValue);
            setPage(0);
          }} sx={{ mb: 2 }}>
            <Tab label="Pending" />
            <Tab label="Forwarded" />
            <Tab label="Returned" />
            <Tab label="Approved" />
            <Tab label="Rejected" />
          </Tabs>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : settlements.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No payments found
              </Typography>
            </Box>
          ) : (() => {
            // Group settlements by department, then month + year
            const groupedData = settlements.reduce((acc, settlement) => {
              const dept = settlement.fromDepartment || 'Other';
              const date = new Date(settlement.date || settlement.createdAt);
              const year = date.getFullYear();
              const month = date.toLocaleString('default', { month: 'long' }); // e.g., "January"
              const monthNum = date.getMonth(); // 0-11 for sorting
              const monthYearKey = `${month} ${year}`; // e.g., "December 2025"
              const sortKey = `${year}-${String(monthNum).padStart(2, '0')}`; // For sorting: "2025-11"
              
              if (!acc[dept]) {
                acc[dept] = {};
              }
              if (!acc[dept][monthYearKey]) {
                acc[dept][monthYearKey] = { sortKey, settlements: [] };
              }
              acc[dept][monthYearKey].settlements.push(settlement);
              return acc;
            }, {});

            return (
              <Box>
                {Object.entries(groupedData).map(([department, monthYears]) => {
                  const totalSettlements = Object.values(monthYears).reduce((sum, m) => sum + m.settlements.length, 0);

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
                            label={`${totalSettlements} payment${totalSettlements !== 1 ? 's' : ''}`}
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
                            .map(([monthYear, { settlements: monthSettlements }]) => (
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
                                      label={`${monthSettlements.length} payment${monthSettlements.length !== 1 ? 's' : ''}`}
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
                                          <TableCell sx={{ fontWeight: 700 }}>Reference No</TableCell>
                                          <TableCell sx={{ fontWeight: 700 }}>To Whom Paid</TableCell>
                                          <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                          <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                          <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                          <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {monthSettlements.map((settlement) => (
                                          <TableRow key={settlement._id} hover>
                                            <TableCell>{settlement.referenceNumber?.trim() || settlement._id || 'N/A'}</TableCell>
                                            <TableCell>{settlement.toWhomPaid || 'N/A'}</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>
                                              {formatPKR(settlement.grandTotal || settlement.amount)}
                                            </TableCell>
                                            <TableCell>{formatDateForDocument(settlement.date)}</TableCell>
                                            <TableCell>
                                              <Chip
                                                label={settlement.workflowStatus || 'Draft'}
                                                color={getWorkflowStatusColor(settlement.workflowStatus)}
                                                size="small"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Stack direction="row" spacing={1}>
                                                <Tooltip title="View Details">
                                                  <IconButton
                                                    size="small"
                                                    onClick={async () => {
                                                      if (settlement.isPurchaseOrder) {
                                                        try {
                                                          const r = await api.get(`/procurement/purchase-orders/${settlement._id}`);
                                                          const d = r.data.data;
                                                          setViewDialog({ open: true, settlement: { ...d, workflowStatus: d.status, referenceNumber: d.orderNumber, toWhomPaid: d.vendor?.name, forWhat: d.notes || 'Purchase Order', amount: d.totalAmount, grandTotal: d.totalAmount, date: d.orderDate, fromDepartment: 'Procurement', isPurchaseOrder: true } });
                                                        } catch (e) {
                                                          console.error('Error fetching purchase order details:', e);
                                                          setViewDialog({ open: true, settlement });
                                                        }
                                                      } else {
                                                        try {
                                                          const response = await paymentSettlementService.getPaymentSettlement(settlement._id);
                                                          setViewDialog({ open: true, settlement: response.data.data || response.data });
                                                        } catch (error) {
                                                          console.error('Error fetching settlement details:', error);
                                                          setViewDialog({ open: true, settlement });
                                                        }
                                                      }
                                                    }}
                                                  >
                                                    <ViewIcon fontSize="small" />
                                                  </IconButton>
                                                </Tooltip>
                                                {/* Pending tab (tabValue === 0): Forward, Reject, Return with Observations */}
                                                {tabValue === 0 && settlement.workflowStatus === 'Send to CEO Office' && (
                                                  <>
                                                    <Tooltip title="Forward to CEO">
                                                      <IconButton
                                                        size="small"
                                                        color="primary"
                                                        onClick={() => setApproveDialog({ open: true, settlement })}
                                                      >
                                                        <ArrowForwardIcon fontSize="small" />
                                                      </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Reject">
                                                      <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => setRejectDialog({ open: true, settlement })}
                                                      >
                                                        <CancelIcon fontSize="small" />
                                                      </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Return with Observations">
                                                      <IconButton
                                                        size="small"
                                                        color="warning"
                                                        onClick={() => setReturnDialog({ open: true, settlement })}
                                                      >
                                                        <WarningIcon fontSize="small" />
                                                      </IconButton>
                                                    </Tooltip>
                                                  </>
                                                )}
                                                {/* Returned tab (tabValue === 2): Forward again when CEO returned */}
                                                {tabValue === 2 && settlement.workflowStatus === 'Returned from CEO Office' && (
                                                  <Tooltip title="Forward again to CEO">
                                                    <IconButton
                                                      size="small"
                                                      color="primary"
                                                      onClick={() => setApproveDialog({ open: true, settlement })}
                                                    >
                                                      <ArrowForwardIcon fontSize="small" />
                                                    </IconButton>
                                                  </Tooltip>
                                                )}
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
        </CardContent>
      </Card>

      {/* View Dialog - Same white paper style as PreAudit */}
      <Dialog
        open={viewDialog.open}
        onClose={() => setViewDialog({ open: false, settlement: null })}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 0,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            background: '#ffffff'
          }
        }}
      >
        <DialogTitle sx={{ p: 0, m: 0 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            p: 2,
            borderBottom: '1px solid #e0e0e0'
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
              {viewDialog.settlement?.isPurchaseOrder ? 'PURCHASE ORDER' : 'PAYMENT SETTLEMENT'}
            </Typography>
            <IconButton 
              size="small" 
              onClick={() => setViewDialog({ open: false, settlement: null })}
              sx={{ color: '#666' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, background: '#ffffff' }}>
          {viewDialog.settlement && (
            <Box sx={{ 
              p: 4, 
              background: '#ffffff',
              fontFamily: '"Times New Roman", serif'
            }}>
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
                  {viewDialog.settlement.parentCompanyName || 'PAYMENT SETTLEMENT'}
                </Typography>
                
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      SITE:
                    </Typography>
                    <Typography variant="body2">
                      {viewDialog.settlement.site || 'Head Office'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      FROM:
                    </Typography>
                    <Typography variant="body2">
                      {viewDialog.settlement.fromDepartment || 'Administration'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      CUSTODIEN:
                    </Typography>
                    <Typography variant="body2">
                      {viewDialog.settlement.custodian || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      DATE:
                    </Typography>
                    <Typography variant="body2">
                      {formatDateForDocument(viewDialog.settlement.date)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      DOCUMENT NUMBER:
                    </Typography>
                    <Typography variant="body2">
                      {viewDialog.settlement.referenceNumber?.trim() || viewDialog.settlement._id || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      NOTE:
                    </Typography>
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
                          {formatDateForDocument(viewDialog.settlement.date)}
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000',
                          py: 2,
                          fontSize: '13px'
                        }}>
                          {viewDialog.settlement.referenceNumber?.trim() || viewDialog.settlement._id || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000',
                          py: 2,
                          fontSize: '13px'
                        }}>
                          {viewDialog.settlement.toWhomPaid || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000',
                          py: 2,
                          fontSize: '13px',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {viewDialog.settlement.forWhat || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000',
                          py: 2,
                          fontSize: '13px',
                          textAlign: 'right',
                          fontWeight: 600
                        }}>
                          {formatPKR(viewDialog.settlement.amount)}
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
                    Grand Total: {formatPKR(viewDialog.settlement.grandTotal || viewDialog.settlement.amount || 0)}
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
                        {viewDialog.settlement.preparedBy || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {viewDialog.settlement.preparedByDesignation || 'Not specified'}
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
                        {viewDialog.settlement.verifiedBy || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {viewDialog.settlement.verifiedByDesignation || 'Not specified'}
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
                        {viewDialog.settlement.approvedBy || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {viewDialog.settlement.approvedByDesignation || 'Not specified'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Observations Section */}
              {(() => {
                const observations = viewDialog.settlement.workflowHistory?.filter(entry => 
                  entry.comments && (
                    entry.comments.toLowerCase().includes('observation') || 
                    entry.comments.toLowerCase().includes('returned from pre audit with observations') ||
                    entry.comments.toLowerCase().includes('returned from payments with observations') ||
                    entry.comments.toLowerCase().includes('returned from ceo office')
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
                        const observationMatch = entry.comments.match(/Observation\s+\d+\s*\(([^)]+)\):\s*(.+?)(?:;|$)/i);
                        const returnedPreAuditMatch = entry.comments.match(/Returned from Pre Audit with observations:\s*(.+?)(?:\.\s*Observations:|$)/i);
                        const returnedPaymentsMatch = entry.comments.match(/Returned from Payments with observations:\s*(.+?)(?:\.\s*Observations:|$)/i);
                        const observationsMatch = entry.comments.match(/Observations:\s*(.+?)(?:\[Digital Signature|$)/i);
                        
                        let observationText = entry.comments;
                        let severity = 'medium';
                        
                        if (observationMatch) {
                          observationText = observationMatch[2].trim();
                          severity = observationMatch[1].toLowerCase();
                        } else if (returnedPreAuditMatch) {
                          observationText = returnedPreAuditMatch[1].trim();
                        } else if (returnedPaymentsMatch) {
                          observationText = returnedPaymentsMatch[1].trim();
                        } else if (observationsMatch) {
                          observationText = observationsMatch[1].trim();
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
              {viewDialog.settlement.attachments && viewDialog.settlement.attachments.length > 0 && (
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
                    ATTACHMENTS ({viewDialog.settlement.attachments.length}):
                  </Typography>
                  <Box sx={{ 
                    border: '1px solid #000',
                    p: 2
                  }}>
                    <Grid container spacing={1}>
                      {viewDialog.settlement.attachments.map((attachment, index) => {
                        const attachmentUrl = paymentSettlementService.getAttachmentUrl(viewDialog.settlement._id, attachment._id);
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
          </Box>
          <Box>
            <Button 
              variant="outlined" 
              startIcon={<HistoryIcon />}
              onClick={() => setWorkflowHistoryDialog({ open: true, settlement: viewDialog.settlement })}
              sx={{ minWidth: 150, mr: 1 }}
            >
              See Workflow History
            </Button>
            <Button 
              variant="outlined" 
              onClick={() => setViewDialog({ open: false, settlement: null })}
              sx={{ minWidth: 80, mr: 1 }}
            >
              Close
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ minWidth: 100 }}
            >
              Print
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog 
        open={approveDialog.open} 
        onClose={() => {
          setApproveDialog({ open: false, settlement: null });
          setApprovalComments('');
          setApprovalSignature('');
          setApprovalAgree(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Forward to CEO</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You are about to forward {approveDialog.settlement?.isPurchaseOrder ? 'purchase order' : 'payment settlement'} to CEO: <strong>{approveDialog.settlement?.referenceNumber}</strong>
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Comments (Optional)"
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Digital Signature"
            value={approvalSignature}
            onChange={(e) => setApprovalSignature(e.target.value)}
            placeholder="Type your name as digital signature"
            required
            sx={{ mb: 2 }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={approvalAgree}
                onChange={(e) => setApprovalAgree(e.target.checked)}
              />
            }
            label={approveDialog.settlement?.isPurchaseOrder ? 'I confirm that I have reviewed all details and forward this purchase order to CEO' : 'I confirm that I have reviewed all payment details and forward this payment settlement to CEO'}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setApproveDialog({ open: false, settlement: null });
              setApprovalComments('');
              setApprovalSignature('');
              setApprovalAgree(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleForward}
            variant="contained"
            color="primary"
            disabled={actionLoading || !approvalAgree || !approvalSignature.trim()}
            startIcon={<ArrowForwardIcon />}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Forward to CEO'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog 
        open={rejectDialog.open} 
        onClose={() => {
          setRejectDialog({ open: false, settlement: null });
          setRejectionComments('');
          setRejectionSignature('');
          setRejectionAgree(false);
          setRejectObservations([{ observation: '', severity: 'medium' }]);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Reject Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You are about to reject payment settlement: <strong>{rejectDialog.settlement?.referenceNumber}</strong>
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Rejection Comments (Required)"
            value={rejectionComments}
            onChange={(e) => setRejectionComments(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Observations (Optional)
            </Typography>
            {rejectObservations.map((obs, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="Enter observation..."
                      value={obs.observation}
                      onChange={(e) => updateObservation(index, 'observation', e.target.value, 'reject')}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Severity</InputLabel>
                      <Select
                        value={obs.severity}
                        label="Severity"
                        onChange={(e) => updateObservation(index, 'severity', e.target.value, 'reject')}
                      >
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeObservation(index, 'reject')}
                      disabled={rejectObservations.length === 1}
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
              onClick={() => addObservation('reject')}
            >
              Add Observation
            </Button>
          </Box>
          
          <TextField
            fullWidth
            label="Digital Signature"
            value={rejectionSignature}
            onChange={(e) => setRejectionSignature(e.target.value)}
            placeholder="Type your name as digital signature"
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
            label="I confirm that I have reviewed all payment details and reject this payment settlement"
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setRejectDialog({ open: false, settlement: null });
              setRejectionComments('');
              setRejectionSignature('');
              setRejectionAgree(false);
              setRejectObservations([{ observation: '', severity: 'medium' }]);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={actionLoading || !rejectionAgree || !rejectionSignature.trim() || !rejectionComments.trim()}
            startIcon={<CancelIcon />}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Return with Observations Dialog */}
      <Dialog 
        open={returnDialog.open} 
        onClose={() => {
          setReturnDialog({ open: false, settlement: null });
          setReturnComments('');
          setReturnSignature('');
          setReturnAgree(false);
          setReturnObservations([{ observation: '', severity: 'medium' }]);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{returnDialog.settlement?.isPurchaseOrder ? 'Return Purchase Order with Observations' : 'Return Payment with Observations'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You are about to return {returnDialog.settlement?.isPurchaseOrder ? 'purchase order' : 'payment settlement'}: <strong>{returnDialog.settlement?.referenceNumber}</strong> with observations
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Return Comments (Required)"
            value={returnComments}
            onChange={(e) => setReturnComments(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Observations (Required - At least one)
            </Typography>
            {returnObservations.map((obs, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="Enter observation..."
                      value={obs.observation}
                      onChange={(e) => updateObservation(index, 'observation', e.target.value, 'return')}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Severity</InputLabel>
                      <Select
                        value={obs.severity}
                        label="Severity"
                        onChange={(e) => updateObservation(index, 'severity', e.target.value, 'return')}
                      >
                        <MenuItem value="low">Low</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="high">High</MenuItem>
                        <MenuItem value="critical">Critical</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeObservation(index, 'return')}
                      disabled={returnObservations.length === 1}
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
              onClick={() => addObservation('return')}
            >
              Add Observation
            </Button>
          </Box>
          
          <TextField
            fullWidth
            label="Digital Signature"
            value={returnSignature}
            onChange={(e) => setReturnSignature(e.target.value)}
            placeholder="Type your name as digital signature"
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
            label={returnDialog.settlement?.isPurchaseOrder ? 'I confirm that I have reviewed all details and return this purchase order with observations' : 'I confirm that I have reviewed all payment details and return this payment settlement with observations'}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setReturnDialog({ open: false, settlement: null });
              setReturnComments('');
              setReturnSignature('');
              setReturnAgree(false);
              setReturnObservations([{ observation: '', severity: 'medium' }]);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReturn}
            variant="contained"
            color="warning"
            disabled={
              actionLoading || 
              !returnAgree || 
              !returnSignature.trim() || 
              !returnComments.trim() ||
              returnObservations.every(obs => !obs.observation.trim())
            }
            startIcon={<WarningIcon />}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Return with Observations'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Workflow History Dialog */}
      <WorkflowHistoryDialog
        open={workflowHistoryDialog.open}
        onClose={() => setWorkflowHistoryDialog({ open: false, settlement: null })}
        document={workflowHistoryDialog.settlement}
        documentType="settlement"
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
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px'
          }}
        >
          <IconButton
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'white',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
            }}
            onClick={() => {
              if (imageViewer.isBlob && imageViewer.imageUrl) {
                URL.revokeObjectURL(imageViewer.imageUrl);
              }
              setImageViewer({ open: false, imageUrl: '', imageName: '', isBlob: false });
            }}
          >
            <CloseIcon />
          </IconButton>
          <img
            src={imageViewer.imageUrl}
            alt={imageViewer.imageName}
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain'
            }}
          />
        </Box>
      </Dialog>
    </Box>
  );
};

export default Payments;

