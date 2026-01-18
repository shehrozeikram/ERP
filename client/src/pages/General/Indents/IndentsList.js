import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Alert,
  Snackbar,
  CircularProgress,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import indentService from '../../../services/indentService';
import paymentSettlementService from '../../../services/paymentSettlementService';
import api from '../../../services/api';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';

const IndentsList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [indents, setIndents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [combinedItems, setCombinedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
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
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  // Load indents
  const loadIndents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(departmentFilter && { department: departmentFilter })
      };

      const response = await indentService.getIndents(params);
      setIndents(response.data || []);
      setTotalItems(response.pagination?.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load indents');
      console.error('Error loading indents:', err);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, statusFilter, categoryFilter, departmentFilter]);

  // Load payments
  const loadPayments = useCallback(async () => {
    try {
      const params = {
        page: 1,
        limit: 1000, // Get all payments for now
        ...(searchTerm && { search: searchTerm }),
        ...(departmentFilter && { fromDepartment: departmentFilter })
      };

      const [settlementsRes, poRes] = await Promise.all([
        paymentSettlementService.getPaymentSettlements(params),
        api.get('/procurement/purchase-orders/ceo-secretariat').catch(() => ({ data: { data: [] } }))
      ]);
      let allPayments = settlementsRes.data?.settlements || [];
      const poList = poRes.data?.data || [];
      const poFormatted = poList.filter(p => p.status === 'Forwarded to CEO').map(po => ({
        _id: po._id,
        workflowStatus: 'Forwarded to CEO',
        isPurchaseOrder: true,
        referenceNumber: po.orderNumber,
        forWhat: po.notes,
        toWhomPaid: po.vendor?.name,
        grandTotal: po.totalAmount,
        amount: po.totalAmount,
        fromDepartment: 'Procurement',
        date: po.orderDate,
        ...po
      }));
      allPayments = [...allPayments, ...poFormatted];
      
      // Filter only "Forwarded to CEO" payments for CEO review
      let filteredPayments = allPayments.filter(p => p.workflowStatus === 'Forwarded to CEO');
      
      // Additional filter by status if needed
      if (statusFilter) {
        // Map indent status to payment workflow status
        const statusMap = {
          'Submitted': 'Forwarded to CEO',
          'Under Review': 'Forwarded to CEO',
          'Approved': 'Approved',
          'Rejected': 'Rejected'
        };
        const paymentStatus = statusMap[statusFilter];
        if (paymentStatus) {
          filteredPayments = filteredPayments.filter(p => 
            (p.workflowStatus || '').includes(paymentStatus)
          );
        }
      }
      
      setPayments(filteredPayments);
    } catch (err) {
      console.error('Error loading payments:', err);
      setPayments([]);
    }
  }, [searchTerm, departmentFilter, statusFilter]);

  // Combine indents and payments
  useEffect(() => {
    const combined = [
      ...indents.map(indent => ({ ...indent, type: 'indent' })),
      ...payments.map(payment => ({ ...payment, type: 'payment' }))
    ].sort((a, b) => {
      // Sort by date (newest first)
      const dateA = a.requestedDate || a.date || a.createdAt;
      const dateB = b.requestedDate || b.date || b.createdAt;
      return new Date(dateB) - new Date(dateA);
    });
    
    setCombinedItems(combined);
  }, [indents, payments]);

  useEffect(() => {
    // Check for status filter from URL or location state
    const urlParams = new URLSearchParams(location.search);
    const statusFromUrl = urlParams.get('status');
    if (statusFromUrl) {
      setStatusFilter(statusFromUrl);
    }
    
    loadIndents();
    loadPayments();
  }, [loadIndents, loadPayments, location.search]);

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // CEO Actions for Payments
  const handleApprovePayment = async () => {
    if (!approvalSignature.trim()) {
      toast.error('Please provide digital signature');
      return;
    }

    if (approvePaymentDialog.payment?.isPurchaseOrder) {
      try {
        setPaymentActionLoading(true);
        const response = await api.put(`/procurement/purchase-orders/${approvePaymentDialog.payment._id}/ceo-approve`, {
          approvalComments,
          digitalSignature: approvalSignature
        });
        let successMessage = 'Purchase order approved successfully';
        if (response.data?.accountsPayableCreated) successMessage += ' and added to Accounts Payable';
        toast.success(successMessage);
        setApprovePaymentDialog({ open: false, payment: null });
        setApprovalComments('');
        setApprovalSignature('');
        loadPayments();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to approve purchase order');
      } finally {
        setPaymentActionLoading(false);
      }
      return;
    }

    try {
      setPaymentActionLoading(true);
      const response = await paymentSettlementService.approvePayment(approvePaymentDialog.payment._id, {
        comments: approvalComments || `Approved by CEO with digital signature: ${approvalSignature}`,
        digitalSignature: approvalSignature
      });
      
      let successMessage = 'Payment approved successfully';
      if (response.data?.accountsPayableCreated) {
        successMessage += ' and added to Accounts Payable';
      }
      
      toast.success(successMessage);
      setApprovePaymentDialog({ open: false, payment: null });
      setApprovalComments('');
      setApprovalSignature('');
      loadPayments();
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

    if (rejectPaymentDialog.payment?.isPurchaseOrder) {
      try {
        setPaymentActionLoading(true);
        await api.put(`/procurement/purchase-orders/${rejectPaymentDialog.payment._id}/ceo-reject`, {
          rejectionComments,
          digitalSignature: rejectionSignature
        });
        toast.success('Purchase order rejected successfully');
        setRejectPaymentDialog({ open: false, payment: null });
        setRejectionComments('');
        setRejectionSignature('');
        loadPayments();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to reject purchase order');
      } finally {
        setPaymentActionLoading(false);
      }
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
      loadPayments();
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

    if (returnPaymentDialog.payment?.isPurchaseOrder) {
      try {
        setPaymentActionLoading(true);
        await api.put(`/procurement/purchase-orders/${returnPaymentDialog.payment._id}/ceo-return`, {
          returnComments,
          digitalSignature: returnSignature
        });
        toast.success('Purchase order returned successfully');
        setReturnPaymentDialog({ open: false, payment: null });
        setReturnComments('');
        setReturnSignature('');
        loadPayments();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to return purchase order');
      } finally {
        setPaymentActionLoading(false);
      }
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
      loadPayments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to return payment');
    } finally {
      setPaymentActionLoading(false);
    }
  };

  // Handle delete
  const handleDelete = useCallback(async () => {
    try {
      await indentService.deleteIndent(selectedIndent._id);
      setSnackbar({
        open: true,
        message: 'Indent deleted successfully',
        severity: 'success'
      });
      setDeleteDialogOpen(false);
      setSelectedIndent(null);
      loadIndents();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error deleting indent',
        severity: 'error'
      });
    }
  }, [selectedIndent, loadIndents]);

  // Handle approve/reject
  const handleApprove = useCallback(async (indentId) => {
    try {
      await indentService.approveIndent(indentId);
      setSnackbar({
        open: true,
        message: 'Indent approved successfully',
        severity: 'success'
      });
      loadIndents();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error approving indent',
        severity: 'error'
      });
    }
  }, [loadIndents]);

  const handleReject = useCallback(async (indentId) => {
    const reason = window.prompt('Please enter rejection reason:');
    if (!reason) return;
    
    try {
      await indentService.rejectIndent(indentId, reason);
      setSnackbar({
        open: true,
        message: 'Indent rejected successfully',
        severity: 'success'
      });
      loadIndents();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error rejecting indent',
        severity: 'error'
      });
    }
  }, [loadIndents]);

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'default',
      'Submitted': 'info',
      'Under Review': 'warning',
      'Approved': 'success',
      'Rejected': 'error',
      'Partially Fulfilled': 'info',
      'Fulfilled': 'success',
      'Cancelled': 'default'
    };
    return colors[status] || 'default';
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

  // Check if user can approve/reject
  const canApproveReject = (indent) => {
    return ['super_admin', 'admin', 'hr_manager'].includes(user?.role) &&
           ['Submitted', 'Under Review'].includes(indent.status);
  };

  if (loading && indents.length === 0) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Indents Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/general/indents/create')}
        >
          Create Indent
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                placeholder="Search by indent number, title..."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Draft">Draft</MenuItem>
                  <MenuItem value="Submitted">Submitted</MenuItem>
                  <MenuItem value="Under Review">Under Review</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                  <MenuItem value="Partially Fulfilled">Partially Fulfilled</MenuItem>
                  <MenuItem value="Fulfilled">Fulfilled</MenuItem>
                  <MenuItem value="Cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Category"
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Office Supplies">Office Supplies</MenuItem>
                  <MenuItem value="IT Equipment">IT Equipment</MenuItem>
                  <MenuItem value="Furniture">Furniture</MenuItem>
                  <MenuItem value="Maintenance">Maintenance</MenuItem>
                  <MenuItem value="Raw Materials">Raw Materials</MenuItem>
                  <MenuItem value="Services">Services</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setCategoryFilter('');
                  setDepartmentFilter('');
                  setPage(0);
                }}
                sx={{ mt: 1 }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Indents Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Number/Reference</strong></TableCell>
              <TableCell><strong>Title/Description</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Requested By</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Priority</strong></TableCell>
              <TableCell align="right"><strong>Amount</strong></TableCell>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {combinedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No indents or payments found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              combinedItems.map((item) => {
                if (item.type === 'payment') {
                  return (
                    <TableRow key={`payment-${item._id}`} hover>
                      <TableCell>
                        <Chip label="Payment" size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>{item.referenceNumber || item._id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {item.forWhat || item.toWhomPaid || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.fromDepartment || '—'}</TableCell>
                      <TableCell>
                        {item.createdBy?.firstName} {item.createdBy?.lastName}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={item.workflowStatus || item.status || 'Draft'} 
                          size="small" 
                          color={getStatusColor(item.workflowStatus || item.status)}
                        />
                      </TableCell>
                      <TableCell>—</TableCell>
                      <TableCell align="right">
                        {formatCurrency(item.grandTotal || item.amount || 0)}
                      </TableCell>
                      <TableCell>{formatDate(item.date || item.createdAt)}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => navigate(`/general/ceo-secretariat/payments?settlementId=${item._id}`)}
                            title="View Details"
                          >
                            <ViewIcon />
                          </IconButton>
                          {/* CEO Actions - Only show for "Forwarded to CEO" status */}
                          {item.workflowStatus === 'Forwarded to CEO' && (
                            <>
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => setApprovePaymentDialog({ open: true, payment: item })}
                                title="Approve"
                              >
                                <CheckCircleIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setRejectPaymentDialog({ open: true, payment: item })}
                                title="Reject"
                              >
                                <CancelIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => setReturnPaymentDialog({ open: true, payment: item })}
                                title="Return with Objection"
                              >
                                <WarningIcon />
                              </IconButton>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                }
                return (
                  <TableRow key={`indent-${item._id}`} hover>
                    <TableCell>
                      <Chip label="Indent" size="small" color="secondary" variant="outlined" />
                    </TableCell>
                    <TableCell>{item.indentNumber}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {item.title}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.department?.name || '—'}</TableCell>
                    <TableCell>
                      {item.requestedBy?.firstName} {item.requestedBy?.lastName}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={item.status} 
                        size="small" 
                        color={getStatusColor(item.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={item.priority} 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(item.totalEstimatedCost)}
                    </TableCell>
                    <TableCell>{formatDate(item.requestedDate)}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => navigate(`/general/indents/${item._id}`)}
                        >
                          <ViewIcon />
                        </IconButton>
                        {item.status === 'Draft' && item.requestedBy?._id === user?.id && (
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => navigate(`/general/indents/${item._id}/edit`)}
                          >
                            <EditIcon />
                          </IconButton>
                        )}
                        {canApproveReject(item) && (
                          <>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleApprove(item._id)}
                            >
                              <CheckCircleIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleReject(item._id)}
                            >
                              <CancelIcon />
                            </IconButton>
                          </>
                        )}
                        {['super_admin', 'admin'].includes(user?.role) && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setSelectedIndent(item);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Indent</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete indent <strong>{selectedIndent?.indentNumber}</strong>? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

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
            startIcon={<CheckCircleIcon />}
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

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default IndentsList;

