import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Assignment,
  CheckCircle,
  Schedule,
  Error,
  Visibility,
  Add,
  PendingActions,
  PriorityHigh,
  Recommend,
  ArrowForward,
  Warning as WarningIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  History as HistoryIcon,
  Print as PrintIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import indentService from '../../../services/indentService';
import paymentSettlementService from '../../../services/paymentSettlementService';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { formatPKR } from '../../../utils/currency';
import WorkflowHistoryDialog from '../../../components/WorkflowHistoryDialog';

// Stat Card Component
const StatCard = ({ title, value, subtitle, icon, color, onClick }) => (
  <Card 
    sx={{ 
      height: '100%', 
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': onClick ? {
        transform: 'translateY(-4px)',
        boxShadow: 4
      } : {}
    }}
    onClick={onClick}
  >
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Avatar sx={{ bgcolor: color, color: 'white', width: 56, height: 56 }}>
          {icon}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const IndentsDashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentIndents, setRecentIndents] = useState([]);
  const [myIndents, setMyIndents] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // CEO action dialogs for payments
  const [approvePaymentDialog, setApprovePaymentDialog] = useState({ open: false, payment: null });
  const [rejectPaymentDialog, setRejectPaymentDialog] = useState({ open: false, payment: null });
  const [returnPaymentDialog, setReturnPaymentDialog] = useState({ open: false, payment: null });
  const [paymentActionLoading, setPaymentActionLoading] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [approvalSignature, setApprovalSignature] = useState('');
  const [rejectionComments, setRejectionComments] = useState('');
  const [rejectionSignature, setRejectionSignature] = useState('');
  const [returnComments, setReturnComments] = useState('');
  const [returnSignature, setReturnSignature] = useState('');
  
  // View detail dialog
  const [viewDialog, setViewDialog] = useState({ open: false, settlement: null });
  const [imageViewer, setImageViewer] = useState({ open: false, imageUrl: '', imageName: '', isBlob: false });
  const [workflowHistoryDialog, setWorkflowHistoryDialog] = useState({ open: false, settlement: null });

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [indentsResponse, paymentsResponse] = await Promise.allSettled([
        indentService.getDashboardStats(),
        paymentSettlementService.getPaymentSettlements({ page: 1, limit: 50 })
      ]);

      if (indentsResponse.status === 'fulfilled') {
        const data = indentsResponse.value.data;
        setStats(data.stats);
        setRecentIndents(data.recentIndents || []);
        setMyIndents(data.myIndents || []);
      }

      if (paymentsResponse.status === 'fulfilled') {
        const payments = paymentsResponse.value.data?.settlements || [];
        // Filter only "Forwarded to CEO" payments for CEO review
        const forwardedPayments = payments.filter(p => p.workflowStatus === 'Forwarded to CEO');
        // Get recent payments (last 10)
        setRecentPayments(forwardedPayments.slice(0, 10));
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Get status color
  const getStatusColor = (status) => {
    if (!status) return 'default';
    const statusStr = String(status).toLowerCase();
    const colors = {
      'draft': 'default',
      'submitted': 'info',
      'under review': 'warning',
      'approved': 'success',
      'rejected': 'error',
      'partially fulfilled': 'info',
      'fulfilled': 'success',
      'cancelled': 'default',
      'send to ceo office': 'warning',
      'returned from ceo office': 'warning',
      'paid': 'success'
    };
    // Check if status contains any of the keys
    for (const [key, color] of Object.entries(colors)) {
      if (statusStr.includes(key)) {
        return color;
      }
    }
    return 'default';
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    const colors = {
      'Low': 'default',
      'Medium': 'info',
      'High': 'warning',
      'Urgent': 'error'
    };
    return colors[priority] || 'default';
  };

  // Format currency
  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0
    }).format(value || 0);

  // Format date
  const formatDate = (date) => {
    if (!date) return '—';
    return dayjs(date).format('DD-MMM-YYYY');
  };

  // Format date for document display
  const formatDateForDocument = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'N/A';
    }
  };

  // Get workflow status color
  const getWorkflowStatusColor = (workflowStatus) => {
    if (!workflowStatus) return 'default';
    if (workflowStatus.includes('Approved')) return 'success';
    if (workflowStatus.includes('Rejected')) return 'error';
    if (workflowStatus.includes('Returned')) return 'warning';
    if (workflowStatus.includes('Send to')) return 'info';
    if (workflowStatus.includes('Forwarded')) return 'primary';
    return 'default';
  };

  // Handle print
  const handlePrint = () => {
    if (!viewDialog.settlement) return;
    window.print();
  };

  // CEO Actions for Payments
  const handleApprovePayment = async () => {
    if (!approvalSignature.trim()) {
      toast.error('Please provide digital signature');
      return;
    }

    try {
      setPaymentActionLoading(true);
      await paymentSettlementService.approvePayment(approvePaymentDialog.payment._id, {
        comments: approvalComments || `Approved by CEO with digital signature: ${approvalSignature}`,
        digitalSignature: approvalSignature
      });
      toast.success('Payment approved successfully');
      setApprovePaymentDialog({ open: false, payment: null });
      setApprovalComments('');
      setApprovalSignature('');
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve payment');
    } finally {
      setPaymentActionLoading(false);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectionSignature.trim() || !rejectionComments.trim()) {
      toast.error('Please provide comments and digital signature');
      return;
    }

    try {
      setPaymentActionLoading(true);
      await paymentSettlementService.rejectPayment(rejectPaymentDialog.payment._id, {
        comments: rejectionComments,
        digitalSignature: rejectionSignature
      });
      toast.success('Payment rejected successfully');
      setRejectPaymentDialog({ open: false, payment: null });
      setRejectionComments('');
      setRejectionSignature('');
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject payment');
    } finally {
      setPaymentActionLoading(false);
    }
  };

  const handleReturnPayment = async () => {
    if (!returnSignature.trim() || !returnComments.trim()) {
      toast.error('Please provide objection comments and digital signature');
      return;
    }

    try {
      setPaymentActionLoading(true);
      await paymentSettlementService.updateWorkflowStatus(returnPaymentDialog.payment._id, {
        workflowStatus: 'Returned from CEO Office',
        comments: `Returned with objection: ${returnComments}`,
        digitalSignature: returnSignature
      });
      toast.success('Payment returned with objection successfully');
      setReturnPaymentDialog({ open: false, payment: null });
      setReturnComments('');
      setReturnSignature('');
      loadDashboardData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to return payment');
    } finally {
      setPaymentActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Indents Dashboard
          </Typography>
          <Typography color="text.secondary">
            Overview of indent management and tracking
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Tooltip title="View All Indents">
            <IconButton 
              color="primary" 
              onClick={() => navigate('/general/indents')}
              sx={{ bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
            >
              <Visibility />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/general/indents/create')}
          >
            Create Indent
          </Button>
        </Stack>
      </Stack>

      {/* Urgent Documents Section - Recommended by Coordinator */}
      {recentPayments.length > 0 && (
        <Card sx={{ mb: 3, borderLeft: '4px solid', borderLeftColor: 'warning.main' }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography variant="h6" fontWeight={600}>
                    Urgent Documents
                  </Typography>
                  <Chip 
                    icon={<Recommend />}
                    label="Recommended by Coordinator"
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {recentPayments.length} payment{recentPayments.length !== 1 ? 's' : ''} forwarded for your review
                </Typography>
              </Box>
              <Button size="small" onClick={() => navigate('/general/indents')}>
                View All
              </Button>
            </Stack>
            
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Reference #</strong></TableCell>
                    <TableCell><strong>Description</strong></TableCell>
                    <TableCell><strong>Department</strong></TableCell>
                    <TableCell><strong>Amount</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentPayments.slice(0, 5).map((payment) => (
                    <TableRow key={payment._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {payment.referenceNumber || payment._id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                          {payment.forWhat || payment.toWhomPaid || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>{payment.fromDepartment || '—'}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="primary">
                          {formatCurrency(payment.grandTotal || payment.amount || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={async () => {
                                try {
                                  // Fetch full settlement details
                                  const response = await paymentSettlementService.getPaymentSettlement(payment._id);
                                  setViewDialog({ open: true, settlement: response.data.data || response.data });
                                } catch (error) {
                                  console.error('Error fetching settlement details:', error);
                                  toast.error('Failed to load payment details');
                                }
                              }}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Approve">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => setApprovePaymentDialog({ open: true, payment })}
                            >
                              <CheckCircle fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setRejectPaymentDialog({ open: true, payment })}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Return with Objection">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => setReturnPaymentDialog({ open: true, payment })}
                            >
                              <WarningIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {recentPayments.length > 5 && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  size="small"
                  onClick={() => navigate('/general/indents')}
                >
                  View {recentPayments.length - 5} more document{recentPayments.length - 5 !== 1 ? 's' : ''}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Indents"
            value={stats?.total || 0}
            subtitle={`${stats?.myIndents || 0} my indents`}
            icon={<Assignment />}
            color="primary.main"
            onClick={() => navigate('/general/indents')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Approval"
            value={stats?.pendingApproval || 0}
            subtitle="Awaiting review"
            icon={<PendingActions />}
            color="warning.main"
            onClick={() => navigate('/general/indents?status=Submitted')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Approved"
            value={stats?.byStatus?.Approved || 0}
            subtitle={`${stats?.byStatus?.['Partially Fulfilled'] || 0} partially fulfilled`}
            icon={<CheckCircle />}
            color="success.main"
            onClick={() => navigate('/general/indents?status=Approved')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Estimated Cost"
            value={formatCurrency(stats?.totalEstimatedCost || 0)}
            subtitle="All indents"
            icon={<Schedule />}
            color="info.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Indents */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Recent Indents
                </Typography>
                <Button size="small" onClick={() => navigate('/general/indents')}>
                  View All
                </Button>
              </Stack>
              {recentIndents.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No indents found
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Indent #</strong></TableCell>
                        <TableCell><strong>Title</strong></TableCell>
                        <TableCell><strong>Department</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Date</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentIndents.map((indent) => (
                        <TableRow 
                          key={indent._id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/general/indents/${indent._id}`)}
                        >
                          <TableCell>{indent.indentNumber}</TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {indent.title}
                            </Typography>
                          </TableCell>
                          <TableCell>{indent.department?.name || '—'}</TableCell>
                          <TableCell>
                            <Chip 
                              label={indent.status} 
                              size="small" 
                              color={getStatusColor(indent.status)}
                            />
                          </TableCell>
                          <TableCell>{formatDate(indent.requestedDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* All Forwarded Payments */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h6" fontWeight={600}>
                      All Forwarded Payments
                    </Typography>
                    <Chip 
                      icon={<Recommend />}
                      label="From Coordinator"
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Documents forwarded by coordinator for your review
                  </Typography>
                </Box>
                <Button size="small" onClick={() => navigate('/general/indents')}>
                  View All
                </Button>
              </Stack>
              {recentPayments.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircle sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No payments forwarded for review
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Reference #</strong></TableCell>
                        <TableCell><strong>Description</strong></TableCell>
                        <TableCell><strong>Department</strong></TableCell>
                        <TableCell><strong>Amount</strong></TableCell>
                        <TableCell><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentPayments.map((payment) => (
                        <TableRow 
                          key={payment._id}
                          hover
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {payment.referenceNumber || payment._id}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {payment.forWhat || payment.toWhomPaid || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>{payment.fromDepartment || '—'}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600} color="primary">
                              {formatCurrency(payment.grandTotal || payment.amount || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => navigate(`/general/ceo-secretariat/payments?settlementId=${payment._id}`)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* My Indents */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  My Indents
                </Typography>
                <Button size="small" onClick={() => navigate('/general/indents?myIndents=true')}>
                  View All
                </Button>
              </Stack>
              {myIndents.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No indents found
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Indent #</strong></TableCell>
                        <TableCell><strong>Title</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell><strong>Priority</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {myIndents.map((indent) => (
                        <TableRow 
                          key={indent._id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/general/indents/${indent._id}`)}
                        >
                          <TableCell>{indent.indentNumber}</TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {indent.title}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={indent.status} 
                              size="small" 
                              color={getStatusColor(indent.status)}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={indent.priority} 
                              size="small" 
                              color={getPriorityColor(indent.priority)}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Status Distribution */}
      {stats && (
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Status Distribution
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(stats.byStatus || {}).map(([status, count]) => (
                    count > 0 && (
                      <Stack key={status} direction="row" justifyContent="space-between" alignItems="center">
                        <Chip label={status} size="small" color={getStatusColor(status)} />
                        <Typography variant="body2" fontWeight={600}>
                          {count}
                        </Typography>
                      </Stack>
                    )
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                  Priority Distribution
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(stats.byPriority || {}).map(([priority, count]) => (
                    count > 0 && (
                      <Stack key={priority} direction="row" justifyContent="space-between" alignItems="center">
                        <Chip 
                          label={priority} 
                          size="small" 
                          color={getPriorityColor(priority)}
                          variant="outlined"
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {count}
                        </Typography>
                      </Stack>
                    )
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* CEO Payment Action Dialogs */}
      {/* Approve Payment Dialog */}
      <Dialog open={approvePaymentDialog.open} onClose={() => setApprovePaymentDialog({ open: false, payment: null })}>
        <DialogTitle>Approve Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Approve payment settlement: <strong>{approvePaymentDialog.payment?.referenceNumber}</strong>
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
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
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovePaymentDialog({ open: false, payment: null })}>Cancel</Button>
          <Button
            onClick={handleApprovePayment}
            variant="contained"
            color="success"
            disabled={paymentActionLoading || !approvalSignature.trim()}
            startIcon={<CheckCircle />}
          >
            {paymentActionLoading ? <CircularProgress size={20} /> : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Payment Dialog */}
      <Dialog open={rejectPaymentDialog.open} onClose={() => setRejectPaymentDialog({ open: false, payment: null })}>
        <DialogTitle>Reject Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Reject payment settlement: <strong>{rejectPaymentDialog.payment?.referenceNumber}</strong>
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rejection Comments"
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
            placeholder="Type your name as digital signature"
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectPaymentDialog({ open: false, payment: null })}>Cancel</Button>
          <Button
            onClick={handleRejectPayment}
            variant="contained"
            color="error"
            disabled={paymentActionLoading || !rejectionSignature.trim() || !rejectionComments.trim()}
            startIcon={<CancelIcon />}
          >
            {paymentActionLoading ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Return Payment with Objection Dialog */}
      <Dialog open={returnPaymentDialog.open} onClose={() => setReturnPaymentDialog({ open: false, payment: null })}>
        <DialogTitle>Return Payment with Objection</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Return payment settlement with objection: <strong>{returnPaymentDialog.payment?.referenceNumber}</strong>
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Objection Comments"
            value={returnComments}
            onChange={(e) => setReturnComments(e.target.value)}
            placeholder="Specify the objection or issue with this payment..."
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Digital Signature"
            value={returnSignature}
            onChange={(e) => setReturnSignature(e.target.value)}
            placeholder="Type your name as digital signature"
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnPaymentDialog({ open: false, payment: null })}>Cancel</Button>
          <Button
            onClick={handleReturnPayment}
            variant="contained"
            color="warning"
            disabled={paymentActionLoading || !returnSignature.trim() || !returnComments.trim()}
            startIcon={<WarningIcon />}
          >
            {paymentActionLoading ? <CircularProgress size={20} /> : 'Return with Objection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Payment Detail Dialog */}
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
              PAYMENT SETTLEMENT
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
            {viewDialog.settlement?.paymentType && (
              <Chip
                label={viewDialog.settlement.paymentType}
                variant="outlined"
                size="small"
              />
            )}
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

export default IndentsDashboard;

