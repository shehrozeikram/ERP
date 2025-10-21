import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Badge,
  TablePagination,
  TableFooter
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';
import api from '../../../services/api';

const LeaveApproval = () => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [pagination, setPagination] = useState({ total: 0, current: 1, pages: 1, limit: 100 });
  
  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // Filter states moved below with pagination states
  
  // Form states
  const [approveForm, setApproveForm] = useState({
    comments: ''
  });
  
  const [rejectForm, setRejectForm] = useState({
    reason: ''
  });

  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState({
    status: 'all',
    leaveType: 'all',
    startDate: '',
    endDate: '',
    employee: ''
  });

  // Load data on component mount
  useEffect(() => {
    loadData(0, rowsPerPage, filters);
  }, []);

  // Load data when filters change (reset to page 0)
  useEffect(() => {
    setPage(0);
    loadData(0, rowsPerPage, filters);
  }, [filters.status, filters.leaveType, filters.startDate, filters.endDate, filters.employee]);

  // Load data when pagination changes
  useEffect(() => {
    if (page > 0) { // Avoid double load on initial render
      loadData(page, rowsPerPage, filters);
    }
  }, [page, rowsPerPage]);

  const loadData = async (pageNum = page, limit = rowsPerPage, currentFilters = filters) => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = {
        page: pageNum + 1, // API uses 1-based pagination
        limit: limit
      };
      
      // Add filters if not 'all'
      if (currentFilters.status !== 'all') {
        params.status = currentFilters.status;
      }
      if (currentFilters.leaveType !== 'all') {
        params.leaveType = currentFilters.leaveType;
      }
      if (currentFilters.startDate) {
        params.startDate = currentFilters.startDate;
      }
      if (currentFilters.endDate) {
        params.endDate = currentFilters.endDate;
      }
      if (currentFilters.employee) {
        params.employee = currentFilters.employee;
      }
      
      const response = await api.get('/leaves/requests', { params });
      setLeaveRequests(response.data.data);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error loading leave requests:', error);
      setError('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  // Filtering is now done server-side through API calls

  const handleApproveLeave = async () => {
    try {
      setLoading(true);
      await api.put(`/leaves/requests/${selectedRequest._id}/approve`, approveForm);
      setSuccess('Leave request approved successfully');
      setApproveDialogOpen(false);
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      console.error('Error approving leave:', error);
      setError(error.response?.data?.message || 'Failed to approve leave request');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectLeave = async () => {
    try {
      setLoading(true);
      await api.put(`/leaves/requests/${selectedRequest._id}/reject`, rejectForm);
      setSuccess('Leave request rejected');
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      setError(error.response?.data?.message || 'Failed to reject leave request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const formatDate = (date) => {
    return format(new Date(date), 'MMM dd, yyyy');
  };

  const getEmployeeInitials = (employee) => {
    return `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getPendingCount = () => {
    return leaveRequests.filter(request => request.status === 'pending').length;
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // No need for local pagination - data comes paginated from server

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    const statusMap = ['all', 'pending', 'approved', 'rejected'];
    setFilters({ ...filters, status: statusMap[newValue] });
  };

  if (loading && leaveRequests.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="text" width="35%" height={60} />
          <Skeleton variant="text" width="50%" height={30} />
        </Box>

        {/* Filters Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Skeleton variant="text" width="20%" height={28} sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Leave Requests Table Skeleton */}
        <Card>
          <CardContent>
            <Skeleton variant="text" width="25%" height={32} sx={{ mb: 2 }} />
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Skeleton variant="text" width="70%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="60%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="50%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="60%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="40%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="50%" /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5, 6].map((row) => (
                    <TableRow key={row}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                          <Box>
                            <Skeleton variant="text" width={140} height={20} />
                            <Skeleton variant="text" width={100} height={16} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 12 }} />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Skeleton variant="text" width={100} height={16} />
                          <Skeleton variant="text" width={80} height={16} />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={60} height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="rectangular" width={70} height={24} sx={{ borderRadius: 12 }} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={80} height={16} />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Skeleton variant="rectangular" width={60} height={28} sx={{ borderRadius: 1 }} />
                          <Skeleton variant="rectangular" width={60} height={28} sx={{ borderRadius: 1 }} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Leave Approval
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="warning.main" gutterBottom>
                Pending Requests
              </Typography>
              <Typography variant="h4" color="warning.main">
                {getPendingCount()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main" gutterBottom>
                Approved Today
              </Typography>
              <Typography variant="h4" color="success.main">
                {leaveRequests.filter(request => 
                  request.status === 'approved' && 
                  formatDate(request.approvedDate) === formatDate(new Date())
                ).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error.main" gutterBottom>
                Rejected Today
              </Typography>
              <Typography variant="h4" color="error.main">
                {leaveRequests.filter(request => 
                  request.status === 'rejected' && 
                  formatDate(request.rejectedDate) === formatDate(new Date())
                ).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary.main" gutterBottom>
                Total Requests
              </Typography>
              <Typography variant="h4" color="primary.main">
                {pagination.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Action Buttons */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
        >
          Refresh
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => {
            // Handle export functionality
            console.log('Export leave requests');
          }}
        >
          Export
        </Button>
      </Box>

      {/* Tabs for Status Filter */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab 
            label={
              <Badge badgeContent={getPendingCount()} color="warning">
                All Requests
              </Badge>
            } 
          />
          <Tab 
            label={
              <Badge badgeContent={getPendingCount()} color="warning">
                Pending
              </Badge>
            } 
          />
          <Tab label="Approved" />
          <Tab label="Rejected" />
        </Tabs>
      </Box>

      {/* Leave Requests Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Leave Requests
            </Typography>
                   <Typography variant="body2" color="text.secondary">
                     Showing {leaveRequests.length} of {pagination.total} requests
                   </Typography>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Leave Type</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell>Days</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Applied Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  // Show loading skeletons
                  Array.from({ length: rowsPerPage }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Skeleton variant="circular" width={32} height={32} />
                          <Box>
                            <Skeleton variant="text" width={120} height={20} />
                            <Skeleton variant="text" width={80} height={16} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell><Skeleton variant="text" width={80} /></TableCell>
                      <TableCell><Skeleton variant="text" width={100} /></TableCell>
                      <TableCell><Skeleton variant="text" width={100} /></TableCell>
                      <TableCell><Skeleton variant="text" width={40} /></TableCell>
                      <TableCell><Skeleton variant="text" width={150} /></TableCell>
                      <TableCell><Skeleton variant="rectangular" width={60} height={24} /></TableCell>
                      <TableCell><Skeleton variant="text" width={100} /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Skeleton variant="circular" width={32} height={32} />
                          <Skeleton variant="circular" width={32} height={32} />
                          <Skeleton variant="circular" width={32} height={32} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : leaveRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No leave requests found matching your criteria.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  leaveRequests.map((request) => (
                  <TableRow key={request._id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {getEmployeeInitials(request.employee)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {request.employee.firstName} {request.employee.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {request.employee.employeeId}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.leaveType?.name}
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(request.startDate)}</TableCell>
                    <TableCell>{formatDate(request.endDate)}</TableCell>
                    <TableCell>{request.totalDays}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {request.reason}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        color={getStatusColor(request.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(request.appliedDate)}</TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedRequest(request);
                            setViewDialogOpen(true);
                          }}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {request.status === 'pending' && (
                        <>
                          <Tooltip title="Approve">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => {
                                setSelectedRequest(request);
                                setApproveDialogOpen(true);
                              }}
                            >
                              <ApproveIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setSelectedRequest(request);
                                setRejectDialogOpen(true);
                              }}
                            >
                              <RejectIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                       <TablePagination
                         rowsPerPageOptions={[10, 25, 50, 100]}
                         colSpan={9}
                         count={pagination.total}
                         rowsPerPage={rowsPerPage}
                         page={page}
                         onPageChange={handleChangePage}
                         onRowsPerPageChange={handleChangeRowsPerPage}
                    labelRowsPerPage="Rows per page:"
                    labelDisplayedRows={({ from, to, count }) => 
                      `${from}-${to} of ${count !== -1 ? count : `more than ${to}`}`
                    }
                    sx={{
                      '& .MuiTablePagination-toolbar': {
                        paddingLeft: 2,
                        paddingRight: 2,
                      },
                      '& .MuiTablePagination-selectLabel': {
                        marginBottom: 0,
                      },
                      '& .MuiTablePagination-displayedRows': {
                        marginBottom: 0,
                      },
                    }}
                  />
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* View Leave Request Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Leave Request Details</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Employee
                </Typography>
                <Typography variant="body1">
                  {selectedRequest.employee.firstName} {selectedRequest.employee.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ID: {selectedRequest.employee.employeeId}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Leave Type
                </Typography>
                <Typography variant="body1">
                  {selectedRequest.leaveType?.name}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Start Date
                </Typography>
                <Typography variant="body1">
                  {formatDate(selectedRequest.startDate)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  End Date
                </Typography>
                <Typography variant="body1">
                  {formatDate(selectedRequest.endDate)}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Days
                </Typography>
                <Typography variant="body1">
                  {selectedRequest.totalDays}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={selectedRequest.status}
                  color={getStatusColor(selectedRequest.status)}
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Reason
                </Typography>
                <Typography variant="body1">
                  {selectedRequest.reason}
                </Typography>
              </Grid>
              {selectedRequest.workHandover && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Work Handover
                  </Typography>
                  <Typography variant="body1">
                    {selectedRequest.workHandover}
                  </Typography>
                </Grid>
              )}
              {selectedRequest.approvalComments && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Approval Comments
                  </Typography>
                  <Typography variant="body1">
                    {selectedRequest.approvalComments}
                  </Typography>
                </Grid>
              )}
              {selectedRequest.rejectionReason && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Rejection Reason
                  </Typography>
                  <Typography variant="body1">
                    {selectedRequest.rejectionReason}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Approve Leave Dialog */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Leave Request</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Approval Comments"
            multiline
            rows={3}
            value={approveForm.comments}
            onChange={(e) => setApproveForm({ ...approveForm, comments: e.target.value })}
            placeholder="Add any comments for the employee..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleApproveLeave}
            variant="contained"
            color="success"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Leave Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Leave Request</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Rejection Reason"
            multiline
            rows={3}
            value={rejectForm.reason}
            onChange={(e) => setRejectForm({ ...rejectForm, reason: e.target.value })}
            placeholder="Please provide a reason for rejection..."
            sx={{ mt: 2 }}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRejectLeave}
            variant="contained"
            color="error"
            disabled={loading || !rejectForm.reason}
          >
            {loading ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeaveApproval;
