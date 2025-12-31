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
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Skeleton,
  LinearProgress,
  alpha,
  useTheme,
  Tabs,
  Tab,
  Stack,
  Tooltip,
  Badge,
  Avatar,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Comment as CommentIcon,
  Send as SendIcon,
  Description as DescriptionIcon,
  Business as BusinessIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Cancel as CancelIcon,
  Payment as PaymentIcon,
  AccountBalance as AccountBalanceIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  AttachMoney as AttachMoneyIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import paymentSettlementService from '../../services/paymentSettlementService';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';
import toast from 'react-hot-toast';

const PreAudit = () => {
  const theme = useTheme();
  const navigate = useNavigate();
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
  const [viewDialog, setViewDialog] = useState({ open: false, document: null, fullDocument: null, loading: false });
  const [imageViewer, setImageViewer] = useState({ open: false, imageUrl: '', imageName: '', isBlob: false });
  const [approveDialog, setApproveDialog] = useState({ open: false, document: null });
  const [observationDialog, setObservationDialog] = useState({ open: false, document: null });
  const [returnDialog, setReturnDialog] = useState({ open: false, document: null });
  const [rejectDialog, setRejectDialog] = useState({ open: false, document: null });
  const [approvalComments, setApprovalComments] = useState('');
  const [observation, setObservation] = useState({ text: '', severity: 'medium' });
  const [returnComments, setReturnComments] = useState('');
  const [rejectionComments, setRejectionComments] = useState('');
  const [rejectObservations, setRejectObservations] = useState([{ observation: '', severity: 'medium' }]);

  useEffect(() => {
    fetchDocuments();
  }, [page, rowsPerPage, searchQuery, filters, tabValue]);

  const fetchDocuments = async () => {
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
        params.set('status', 'approved');
      } else if (tabValue === 3) {
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
  };

  const handleApprove = async () => {
    try {
      setError(null);
      const doc = approveDialog.document;
      
      if (doc.isWorkflowDocument) {
        // For workflow documents, approve via payment settlement API
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
      
      if (doc.isWorkflowDocument) {
        // For workflow documents, change status back to Draft or previous status
        await api.patch(`/payment-settlements/${doc._id}/workflow-status`, {
          workflowStatus: 'Draft',
          comments: returnComments
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

      await api.put(`/pre-audit/${doc._id}/reject`, {
        rejectionComments: rejectionComments || 'Rejected with observations',
        observations: observations.length > 0 ? observations : undefined
      });
      
      setSuccess('Document rejected and returned to initiator. They can correct and resend.');
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

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Document #</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Module</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc._id} hover>
                      <TableCell>{doc.documentNumber}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            {doc.title}
                          </Typography>
                          {doc.isWorkflowDocument && (
                            <Chip
                              label="Workflow"
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          )}
                        </Box>
                        {doc.description && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                            {doc.description}
                          </Typography>
                        )}
                        {doc.isWorkflowDocument && doc.workflowConfig && (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => navigate(`${doc.workflowConfig.routePath}/${doc._id}`)}
                            sx={{ mt: 0.5, fontSize: '0.75rem' }}
                          >
                            View Original Document
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<BusinessIcon />}
                          label={doc.sourceDepartmentName || 'N/A'}
                          size="small"
                          variant="outlined"
                        />
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
                          label={doc.status.replace('_', ' ')}
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
                                
                                // If it's a workflow document, fetch the full document details
                                if (doc.isWorkflowDocument && doc.workflowSubmodule === 'payment_settlement') {
                                  try {
                                    const response = await paymentSettlementService.getPaymentSettlement(doc._id);
                                    setViewDialog({ 
                                      open: true, 
                                      document: doc, 
                                      fullDocument: response.data?.data || response.data,
                                      loading: false 
                                    });
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
                                  setViewDialog({ open: true, document: doc, fullDocument: null, loading: false });
                                }
                              }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {doc.status === 'pending' || doc.status === 'under_review' ? (
                            <>
                              <Tooltip title="Approve">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => setApproveDialog({ open: true, document: doc })}
                                >
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
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
                          ) : null}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

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
        onClose={() => setViewDialog({ open: false, document: null, fullDocument: null, loading: false })}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 2, 
          borderBottom: '1px solid', 
          borderColor: 'divider',
          background: viewDialog.document?.isWorkflowDocument 
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
            : 'inherit',
          color: viewDialog.document?.isWorkflowDocument ? 'white' : 'inherit'
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            {viewDialog.document?.isWorkflowDocument && (
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                <PaymentIcon />
              </Avatar>
            )}
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {viewDialog.document?.isWorkflowDocument ? 'Payment Settlement Details' : 'Document Details'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {viewDialog.document?.isWorkflowDocument 
                  ? (viewDialog.fullDocument?.referenceNumber || viewDialog.document?.documentNumber)
                  : viewDialog.document?.documentNumber}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {viewDialog.loading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 2 }}>Loading document details...</Typography>
            </Box>
          ) : viewDialog.document && (
            <Box sx={{ p: 3 }}>
              {/* Show Payment Settlement details if it's a workflow document */}
              {viewDialog.document.isWorkflowDocument && viewDialog.fullDocument ? (
                <>
                  {/* Header with Status and Amount */}
                  <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                    <CardContent>
                      <Grid container spacing={3} alignItems="center">
                        <Grid item xs={12} md={6}>
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Chip
                              label={viewDialog.fullDocument.workflowStatus || viewDialog.document.workflowStatus || 'Draft'}
                              color={getStatusColor(viewDialog.document.status)}
                              size="medium"
                              icon={<CheckCircleIcon />}
                            />
                            <Chip
                              label={viewDialog.fullDocument.paymentType}
                              color={
                                viewDialog.fullDocument.paymentType === 'Payable' ? 'primary' : 
                                viewDialog.fullDocument.paymentType === 'Reimbursement' ? 'secondary' : 
                                viewDialog.fullDocument.paymentType === 'Advance' ? 'success' : 'default'
                              }
                              size="medium"
                              variant="outlined"
                            />
                          </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <AttachMoneyIcon color="primary" />
                            <Box>
                              <Typography variant="h4" fontWeight="bold" color="primary">
                                {formatPKR(viewDialog.fullDocument.grandTotal || viewDialog.fullDocument.amount || 0)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Grand Total
                              </Typography>
                            </Box>
                          </Stack>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  {/* Company Details Section */}
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <BusinessIcon />
                        </Avatar>
                        <Typography variant="h6" fontWeight="bold">
                          Company Details
                        </Typography>
                      </Stack>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                              <BusinessIcon color="primary" fontSize="small" />
                              <Typography variant="subtitle2" color="text.secondary">
                                Parent Company
                              </Typography>
                            </Stack>
                            <Typography variant="body1" fontWeight="medium">
                              {viewDialog.fullDocument.parentCompanyName}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                              <AccountBalanceIcon color="primary" fontSize="small" />
                              <Typography variant="subtitle2" color="text.secondary">
                                Subsidiary
                              </Typography>
                            </Stack>
                            <Typography variant="body1" fontWeight="medium">
                              {viewDialog.fullDocument.subsidiaryName}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  {/* Payment Details Section */}
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                        <Avatar sx={{ bgcolor: 'success.main' }}>
                          <PaymentIcon />
                        </Avatar>
                        <Typography variant="h6" fontWeight="bold">
                          Payment Details
                        </Typography>
                      </Stack>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                              <AssignmentIcon color="primary" fontSize="small" />
                              <Typography variant="subtitle2" color="text.secondary">
                                Reference Number
                              </Typography>
                            </Stack>
                            <Typography variant="body1" fontWeight="medium">
                              {viewDialog.fullDocument.referenceNumber}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                              <ScheduleIcon color="primary" fontSize="small" />
                              <Typography variant="subtitle2" color="text.secondary">
                                Date
                              </Typography>
                            </Stack>
                            <Typography variant="body1" fontWeight="medium">
                              {formatDate(viewDialog.fullDocument.date)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                              <AttachMoneyIcon color="primary" fontSize="small" />
                              <Typography variant="subtitle2" color="text.secondary">
                                Amount
                              </Typography>
                            </Stack>
                            <Typography variant="body1" fontWeight="medium" color="primary">
                              {formatPKR(viewDialog.fullDocument.amount)}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                              <PersonIcon color="primary" fontSize="small" />
                              <Typography variant="subtitle2" color="text.secondary">
                                To Whom Paid
                              </Typography>
                            </Stack>
                            <Typography variant="body1" fontWeight="medium">
                              {viewDialog.fullDocument.toWhomPaid}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                              <AssignmentIcon color="primary" fontSize="small" />
                              <Typography variant="subtitle2" color="text.secondary">
                                For What
                              </Typography>
                            </Stack>
                            <Typography variant="body1" fontWeight="medium">
                              {viewDialog.fullDocument.forWhat}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  {/* Authorization Details Section */}
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                        <Avatar sx={{ bgcolor: 'warning.main' }}>
                          <PersonIcon />
                        </Avatar>
                        <Typography variant="h6" fontWeight="bold">
                          Authorization Details
                        </Typography>
                      </Stack>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                            <PersonIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                              Prepared By
                            </Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {viewDialog.fullDocument.preparedBy}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {viewDialog.fullDocument.preparedByDesignation}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                            <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                              Verified By
                            </Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {viewDialog.fullDocument.verifiedBy}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {viewDialog.fullDocument.verifiedByDesignation}
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                            <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                              Approved By
                            </Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {viewDialog.fullDocument.approvedBy}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {viewDialog.fullDocument.approvedByDesignation}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  {/* Additional Details Section */}
                  {(viewDialog.fullDocument.site || viewDialog.fullDocument.fromDepartment || viewDialog.fullDocument.custodian) && (
                    <Card sx={{ mb: 3 }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                          <Avatar sx={{ bgcolor: 'info.main' }}>
                            <AssignmentIcon />
                          </Avatar>
                          <Typography variant="h6" fontWeight="bold">
                            Additional Details
                          </Typography>
                        </Stack>
                        <Grid container spacing={3}>
                          {viewDialog.fullDocument.site && (
                            <Grid item xs={12} md={4}>
                              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                  Site
                                </Typography>
                                <Typography variant="body1" fontWeight="medium">
                                  {viewDialog.fullDocument.site}
                                </Typography>
                              </Box>
                            </Grid>
                          )}
                          {viewDialog.fullDocument.fromDepartment && (
                            <Grid item xs={12} md={4}>
                              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                  From Department
                                </Typography>
                                <Typography variant="body1" fontWeight="medium">
                                  {viewDialog.fullDocument.fromDepartment}
                                </Typography>
                              </Box>
                            </Grid>
                          )}
                          {viewDialog.fullDocument.custodian && (
                            <Grid item xs={12} md={4}>
                              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                  Custodian
                                </Typography>
                                <Typography variant="body1" fontWeight="medium">
                                  {viewDialog.fullDocument.custodian}
                                </Typography>
                              </Box>
                            </Grid>
                          )}
                        </Grid>
                      </CardContent>
                    </Card>
                  )}

                  {/* Document Attachments Section */}
                  {viewDialog.fullDocument.attachments && viewDialog.fullDocument.attachments.length > 0 && (
                    <Card sx={{ mb: 3 }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                          <Avatar sx={{ bgcolor: 'secondary.main' }}>
                            <AttachFileIcon />
                          </Avatar>
                          <Typography variant="h6" fontWeight="bold">
                            Document Attachments ({viewDialog.fullDocument.attachments.length})
                          </Typography>
                        </Stack>
                        <Grid container spacing={2}>
                          {viewDialog.fullDocument.attachments.map((attachment, index) => {
                            const attachmentUrl = paymentSettlementService.getAttachmentUrl(viewDialog.fullDocument._id, attachment._id);
                            const isImage = attachment.mimeType.startsWith('image/');
                            const isPdf = attachment.mimeType === 'application/pdf';
                            
                            return (
                              <Grid item xs={12} sm={6} md={4} key={attachment._id || index}>
                                <Box 
                                  sx={{ 
                                    p: 2, 
                                    bgcolor: 'grey.50', 
                                    borderRadius: 1, 
                                    border: '1px solid', 
                                    borderColor: 'grey.200',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': {
                                      bgcolor: 'grey.100',
                                      borderColor: 'primary.main',
                                      transform: 'translateY(-2px)',
                                      boxShadow: 2
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
                                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <AttachFileIcon color="primary" fontSize="small" />
                                    <Typography variant="body2" fontWeight="medium" noWrap>
                                      {attachment.originalName}
                                    </Typography>
                                  </Stack>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Size: {formatFileSize(attachment.fileSize)}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Type: {attachment.mimeType}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Uploaded: {new Date(attachment.uploadedAt).toLocaleDateString()}
                                  </Typography>
                                  <Typography variant="caption" color="primary" display="block" sx={{ mt: 1, fontWeight: 'medium' }}>
                                    {isImage ? 'Click to view image' : isPdf ? 'Click to view PDF' : 'Click to download'}
                                  </Typography>
                                </Box>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </CardContent>
                    </Card>
                  )}

                  {/* Workflow History Section */}
                  {viewDialog.document.workflowHistory && viewDialog.document.workflowHistory.length > 0 && (
                    <Card sx={{ mb: 3 }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                          <Avatar sx={{ bgcolor: 'info.main' }}>
                            <ScheduleIcon />
                          </Avatar>
                          <Typography variant="h6" fontWeight="bold">
                            Workflow History
                          </Typography>
                        </Stack>
                        <Stack spacing={2}>
                          {viewDialog.document.workflowHistory.map((history, idx) => (
                            <Paper key={idx} sx={{ p: 2, bgcolor: 'grey.50' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" fontWeight="medium">
                                  {history.fromStatus} → {history.toStatus}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(history.changedAt)}
                                </Typography>
                              </Box>
                              {history.comments && (
                                <Typography variant="body2" color="text.secondary">
                                  {history.comments}
                                </Typography>
                              )}
                              {history.changedBy && (
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                  By: {history.changedBy.firstName} {history.changedBy.lastName}
                                </Typography>
                              )}
                            </Paper>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
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
                  {viewDialog.document.observations && viewDialog.document.observations.length > 0 && (
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
                          <Typography variant="body2">{obs.observation}</Typography>
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
        <DialogActions sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={() => setViewDialog({ open: false, document: null, fullDocument: null, loading: false })}
            variant="outlined"
            sx={{ minWidth: 100 }}
          >
            Close
          </Button>
          {viewDialog.document?.isWorkflowDocument && viewDialog.document?.workflowConfig && (
            <Button 
              variant="contained"
              onClick={() => {
                setViewDialog({ open: false, document: null, fullDocument: null, loading: false });
                navigate(`${viewDialog.document.workflowConfig.routePath}/${viewDialog.document._id}`);
              }}
              sx={{ minWidth: 120 }}
            >
              View Original Document
            </Button>
          )}
        </DialogActions>
      </Dialog>

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

      {/* Approve Dialog */}
      <Dialog
        open={approveDialog.open}
        onClose={() => {
          setApproveDialog({ open: false, document: null });
          setApprovalComments('');
        }}
      >
        <DialogTitle>Approve Document</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Approval Comments"
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
            Approve
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

