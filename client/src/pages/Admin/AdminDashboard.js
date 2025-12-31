import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Payment as PaymentIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  Cancel as RejectIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [approveDialog, setApproveDialog] = useState({ open: false, task: null, comments: '' });
  const [rejectDialog, setRejectDialog] = useState({ open: false, task: null, comments: '' });
  const [workflowDialog, setWorkflowDialog] = useState({ open: false, task: null, workflowStatus: '', comments: '' });
  const [loadingAction, setLoadingAction] = useState(false);

  const workflowStatuses = [
    'Draft',
    'Active',
    'Send to AM Admin',
    'Send to HOD Admin',
    'Send to Audit',
    'Send to Finance',
    'Send to CEO Office',
    'Approved',
    'Rejected',
    'Returned from Audit'
  ];

  const getWorkflowStatusColor = (status) => {
    if (!status) return 'default';
    
    // Handle dynamic statuses like "Approved (from Send to AM Admin)"
    if (status.startsWith('Approved')) {
      return 'success';
    }
    if (status.startsWith('Rejected')) {
      return 'error';
    }
    
    const colors = {
      'Draft': 'default',
      'Active': 'info',
      'Send to AM Admin': 'warning',
      'Send to HOD Admin': 'warning',
      'Send to Audit': 'info',
      'Send to Finance': 'primary',
      'Send to CEO Office': 'success'
    };
    return colors[status] || 'default';
  };

  const getSubmoduleIcon = (submodule) => {
    const icons = {
      'payment_settlement': <PaymentIcon />,
      'rental_agreements': <BusinessIcon />,
      'utility_bills_management': <AttachMoneyIcon />,
      'default': <AssignmentIcon />
    };
    return icons[submodule] || icons.default;
  };

  // Get next possible statuses for a task (excluding current status and approval statuses)
  const getNextPossibleStatuses = (currentStatus) => {
    if (!currentStatus) return [];
    
    // Extract base status if it's in format "Approved (from ...)" or "Rejected (from ...)"
    let baseStatus = currentStatus;
    let sourceStatus = null;
    
    if (currentStatus.includes('(from ')) {
      const match = currentStatus.match(/^(Approved|Rejected) \(from (.+)\)$/);
      if (match) {
        baseStatus = match[1]; // "Approved" or "Rejected"
        sourceStatus = match[2]; // "Send to AM Admin" etc.
      }
    }
    
    const statusFlow = {
      'Draft': ['Active', 'Send to AM Admin', 'Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'],
      'Active': ['Send to AM Admin', 'Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'],
      'Send to AM Admin': ['Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'],
      'Send to HOD Admin': ['Send to Audit', 'Send to Finance', 'Send to CEO Office'],
      'Send to Audit': ['Send to Finance', 'Send to CEO Office'],
      'Send to Finance': ['Send to CEO Office'],
      'Send to CEO Office': [],
      'Approved': ['Send to AM Admin', 'Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'], // Can forward to any status after approval
      'Rejected': ['Draft', 'Send to AM Admin', 'Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'], // Can be sent back to draft or forwarded
      'Returned from Audit': ['Send to Audit', 'Draft'] // Can resubmit to Pre Audit or go back to Draft
    };
    
    // If status is "Approved (from Send to AM Admin)" or "Rejected (from ...)", allow forwarding to any workflow status
    if (baseStatus === 'Approved' || baseStatus === 'Rejected') {
      // Return all forward statuses (can forward to any status after approval/rejection)
      return statusFlow[baseStatus] || [];
    }
    
    // For "Returned from Audit", allow direct resubmission to Pre Audit
    if (currentStatus === 'Returned from Audit') {
      return statusFlow['Returned from Audit'] || ['Send to Audit', 'Draft'];
    }
    
    // For other statuses, return the next possible statuses
    return statusFlow[baseStatus] || statusFlow[currentStatus] || [];
  };

  // Check if task can be approved/rejected/forwarded
  // Show buttons only if:
  // 1. Document is in user's assigned status
  // 2. User hasn't already processed it from this status
  // 3. Document is in a "Send to" status (not already approved/rejected)
  const canApproveReject = (task) => {
    if (!task.workflowStatus || !task.userAssignedStatus) return false;
    
    // Document must be in user's assigned status
    if (task.workflowStatus !== task.userAssignedStatus) {
      return false;
    }
    
    // User must not have already processed this document
    if (task.userHasProcessed) {
      return false;
    }
    
    // Document must be in a "Send to" status
    return task.workflowStatus.includes('Send to');
  };
  
  // Check if user can forward after approval
  // Show forward button if:
  // 1. Document was approved (not rejected) by current user from their assigned status
  // 2. Status shows it was approved from user's assigned status
  // 3. User has already processed it (approved it)
  const canForwardAfterApproval = (task) => {
    if (!task.workflowStatus || !task.userAssignedStatus) return false;
    
    // Only allow forwarding if approved (not rejected)
    if (!task.workflowStatus.startsWith('Approved')) {
      return false;
    }
    
    // Check if status shows it was approved from user's assigned status
    if (task.workflowStatus.includes('(from ') && task.workflowStatus.includes(task.userAssignedStatus)) {
      // Check if current user was the one who processed it
      if (task.userHasProcessed) {
        return true;
      }
    }
    
    return false;
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [tasksResponse, statsResponse] = await Promise.all([
        api.get('/admin/dashboard/tasks'),
        api.get('/admin/dashboard/stats')
      ]);

      setTasks(tasksResponse.data.data.tasks || []);
      setStats(statsResponse.data.data || {});
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to fetch dashboard data');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle approve action
  const handleApprove = async () => {
    if (!approveDialog.task) return;
    
    try {
      setLoadingAction(true);
      const apiPath = `/${approveDialog.task.submodule === 'payment_settlement' ? 'payment-settlements' : approveDialog.task.submodule}/${approveDialog.task.id}/approve`;
      
      await api.patch(apiPath, {
        comments: approveDialog.comments
      });
      
      toast.success('Document approved successfully');
      setApproveDialog({ open: false, task: null, comments: '' });
      fetchDashboardData();
    } catch (error) {
      console.error('Error approving document:', error);
      toast.error(error.response?.data?.message || 'Failed to approve document');
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle reject action
  const handleReject = async () => {
    if (!rejectDialog.task || !rejectDialog.comments.trim()) {
      toast.error('Comments are required when rejecting a document');
      return;
    }
    
    try {
      setLoadingAction(true);
      const apiPath = `/${rejectDialog.task.submodule === 'payment_settlement' ? 'payment-settlements' : rejectDialog.task.submodule}/${rejectDialog.task.id}/reject`;
      
      await api.patch(apiPath, {
        comments: rejectDialog.comments
      });
      
      toast.success('Document rejected successfully');
      setRejectDialog({ open: false, task: null, comments: '' });
      fetchDashboardData();
    } catch (error) {
      console.error('Error rejecting document:', error);
      toast.error(error.response?.data?.message || 'Failed to reject document');
    } finally {
      setLoadingAction(false);
    }
  };

  // Handle workflow status change
  const handleWorkflowStatusChange = async () => {
    if (!workflowDialog.task || !workflowDialog.workflowStatus) return;
    
    try {
      setLoadingAction(true);
      const apiPath = `/${workflowDialog.task.submodule === 'payment_settlement' ? 'payment-settlements' : workflowDialog.task.submodule}/${workflowDialog.task.id}/workflow-status`;
      
      await api.patch(apiPath, {
        workflowStatus: workflowDialog.workflowStatus,
        comments: workflowDialog.comments
      });
      
      toast.success('Workflow status updated successfully');
      setWorkflowDialog({ open: false, task: null, workflowStatus: '', comments: '' });
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating workflow status:', error);
      toast.error(error.response?.data?.message || 'Failed to update workflow status');
    } finally {
      setLoadingAction(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (selectedStatus === 'all') return true;
    return task.workflowStatus === selectedStatus;
  });

  const tasksByStatus = filteredTasks.reduce((acc, task) => {
    const status = task.workflowStatus || 'Draft';
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(task);
    return acc;
  }, {});

  const tasksBySubmodule = filteredTasks.reduce((acc, task) => {
    if (!acc[task.submodule]) {
      acc[task.submodule] = [];
    }
    acc[task.submodule].push(task);
    return acc;
  }, {});

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchDashboardData}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage tasks and documents from all admin submodules
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchDashboardData}
        >
          Refresh
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="inherit" variant="body2" gutterBottom>
                    Total Tasks
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats?.totalTasks || 0}
                  </Typography>
                </Box>
                <DashboardIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="inherit" variant="body2" gutterBottom>
                    Pending Tasks
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats?.pendingTasks || 0}
                  </Typography>
                </Box>
                <ScheduleIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="inherit" variant="body2" gutterBottom>
                    Recent (7 days)
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats?.recentTasks || 0}
                  </Typography>
                </Box>
                <AssignmentIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="inherit" variant="body2" gutterBottom>
                    My Queue
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {filteredTasks.length}
                  </Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 48, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="All Tasks" />
          <Tab label="By Status" />
          <Tab label="By Submodule" />
        </Tabs>
      </Paper>

      {/* Filter by Status */}
      {activeTab === 1 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="All"
            onClick={() => setSelectedStatus('all')}
            color={selectedStatus === 'all' ? 'primary' : 'default'}
            variant={selectedStatus === 'all' ? 'filled' : 'outlined'}
          />
          {workflowStatuses.map(status => (
            <Chip
              key={status}
              label={status}
              onClick={() => setSelectedStatus(status)}
              color={selectedStatus === status ? 'primary' : 'default'}
              variant={selectedStatus === status ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
      )}

      {/* Tasks Content */}
      {activeTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Submodule</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Workflow Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No tasks found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={`${task.submodule}-${task.id}`} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getSubmoduleIcon(task.submodule)}
                        <Typography variant="body2" fontWeight="medium">
                          {task.submoduleName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {task.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                        {task.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {task.amount ? (
                        <Typography variant="body2" fontWeight="medium">
                          {formatPKR(task.amount)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(task.date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Chip
                          label={task.workflowStatus}
                          size="small"
                          color={getWorkflowStatusColor(task.workflowStatus)}
                        />
                        {task.workflowStatus === 'Returned from Audit' && task.workflowHistory && (
                          <Tooltip 
                            title={
                              <Box>
                                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
                                  Rejection/Observations:
                                </Typography>
                                {task.workflowHistory
                                  .filter(h => h.comments && (h.comments.includes('Observation') || h.comments.includes('Rejected') || h.comments.includes('Returned')))
                                  .map((h, idx) => (
                                    <Typography key={idx} variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                      • {h.comments}
                                    </Typography>
                                  ))
                                }
                              </Box>
                            }
                            arrow
                            placement="top"
                          >
                            <Chip
                              label="View Observations"
                              size="small"
                              variant="outlined"
                              color="warning"
                              sx={{ mt: 0.5, cursor: 'help' }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => navigate(task.editPath || task.routePath)}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {canApproveReject(task) && (
                          <>
                            <Tooltip title="Approve">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => setApproveDialog({ open: true, task, comments: '' })}
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setRejectDialog({ open: true, task, comments: '' })}
                              >
                                <RejectIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {/* Show "Submit to Pre Audit" button for documents returned from audit */}
                        {task.workflowStatus === 'Returned from Audit' && (
                          <Tooltip title="Submit to Pre Audit">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => setWorkflowDialog({ open: true, task, workflowStatus: 'Send to Audit', comments: 'Resubmitted after corrections' })}
                            >
                              <SendIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* Show forward button if:
                            1. User can approve/reject (document in their status, not processed) - allows forward before approval
                            2. User has approved and can forward after approval */}
                        {(canApproveReject(task) || canForwardAfterApproval(task)) && task.workflowStatus !== 'Returned from Audit' && (
                          <Tooltip title="Forward to Next Step">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => setWorkflowDialog({ open: true, task, workflowStatus: '', comments: '' })}
                            >
                              <SendIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tasks by Status */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
            <Grid item xs={12} md={6} lg={4} key={status}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Chip
                      label={status}
                      color={getWorkflowStatusColor(status)}
                      size="medium"
                    />
                    <Chip
                      label={statusTasks.length}
                      color="default"
                      variant="outlined"
                    />
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={1}>
                    {statusTasks.slice(0, 5).map((task) => (
                      <Card
                        key={`${task.submodule}-${task.id}`}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.08)
                          }
                        }}
                        onClick={() => navigate(task.editPath || task.routePath)}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight="medium" noWrap>
                              {task.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {task.submoduleName}
                            </Typography>
                          </Box>
                          <IconButton size="small" onClick={(e) => {
                            e.stopPropagation();
                            navigate(task.editPath || task.routePath);
                          }}>
                            <ArrowForwardIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Card>
                    ))}
                    {statusTasks.length > 5 && (
                      <Button
                        size="small"
                        onClick={() => {
                          setSelectedStatus(status);
                          setActiveTab(0);
                        }}
                      >
                        View All ({statusTasks.length})
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tasks by Submodule */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          {Object.entries(tasksBySubmodule).map(([submodule, submoduleTasks]) => (
            <Grid item xs={12} md={6} key={submodule}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {getSubmoduleIcon(submodule)}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" fontWeight="bold">
                        {submoduleTasks[0]?.submoduleName || submodule}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {submoduleTasks.length} task{submoduleTasks.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                    <Chip
                      label={submoduleTasks.length}
                      color="primary"
                    />
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {submoduleTasks.slice(0, 5).map((task) => (
                          <TableRow key={`${task.submodule}-${task.id}`} hover>
                            <TableCell>
                              <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                {task.title}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={task.workflowStatus}
                                size="small"
                                color={getWorkflowStatusColor(task.workflowStatus)}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">
                                {formatDate(task.date)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => navigate(task.editPath || task.routePath)}
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {submoduleTasks.length > 5 && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Button
                        size="small"
                        onClick={() => navigate(submoduleTasks[0]?.viewPath)}
                      >
                        View All Tasks
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialog.open} onClose={() => setApproveDialog({ open: false, task: null, comments: '' })}>
        <DialogTitle>Approve Document</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, minWidth: 400 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Are you sure you want to approve this document?
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Comments (Optional)"
              value={approveDialog.comments}
              onChange={(e) => setApproveDialog({ ...approveDialog, comments: e.target.value })}
              placeholder="Add any comments about this approval..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialog({ open: false, task: null, comments: '' })}>
            Cancel
          </Button>
          <Button 
            onClick={handleApprove} 
            variant="contained"
            color="success"
            disabled={loadingAction}
          >
            {loadingAction ? <CircularProgress size={20} /> : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ open: false, task: null, comments: '' })}>
        <DialogTitle>Reject Document</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, minWidth: 400 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please provide a reason for rejecting this document.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Comments (Required)"
              value={rejectDialog.comments}
              onChange={(e) => setRejectDialog({ ...rejectDialog, comments: e.target.value })}
              placeholder="Please explain why this document is being rejected..."
              required
              error={!rejectDialog.comments.trim()}
              helperText={!rejectDialog.comments.trim() ? 'Comments are required' : ''}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog({ open: false, task: null, comments: '' })}>
            Cancel
          </Button>
          <Button 
            onClick={handleReject} 
            variant="contained"
            color="error"
            disabled={loadingAction || !rejectDialog.comments.trim()}
          >
            {loadingAction ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Workflow Status Change Dialog */}
      <Dialog open={workflowDialog.open} onClose={() => setWorkflowDialog({ open: false, task: null, workflowStatus: '', comments: '' })}>
        <DialogTitle>Forward Document</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, minWidth: 400 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Forward To</InputLabel>
              <Select
                value={workflowDialog.workflowStatus}
                onChange={(e) => setWorkflowDialog({ ...workflowDialog, workflowStatus: e.target.value })}
                label="Forward To"
              >
                {workflowDialog.task && getNextPossibleStatuses(workflowDialog.task.workflowStatus).map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Comments (Optional)"
              value={workflowDialog.comments}
              onChange={(e) => setWorkflowDialog({ ...workflowDialog, comments: e.target.value })}
              placeholder="Add any comments about forwarding this document..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkflowDialog({ open: false, task: null, workflowStatus: '', comments: '' })}>
            Cancel
          </Button>
          <Button 
            onClick={handleWorkflowStatusChange} 
            variant="contained"
            disabled={loadingAction || !workflowDialog.workflowStatus}
          >
            {loadingAction ? <CircularProgress size={20} /> : 'Forward'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDashboard;

