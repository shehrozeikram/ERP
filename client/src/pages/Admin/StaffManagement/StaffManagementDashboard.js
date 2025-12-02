import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  Skeleton,
  Avatar,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar
} from '@mui/material';
import {
  Security as SecurityIcon,
  Business as BusinessIcon,
  Build as BuildIcon,
  Person as PersonIcon,
  DirectionsCar as DriverIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  LocationOn as LocationIcon,
  BusinessCenter as DepartmentIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import staffAssignmentService from '../../../services/staffAssignmentService';

// Simplified staff types with only essential data
const staffTypes = [
  { key: 'Driver', label: 'Drivers', icon: DriverIcon },
  { key: 'Office Boy', label: 'Office Boys', icon: PersonIcon },
  { key: 'Guard', label: 'Guards', icon: SecurityIcon },
  { key: 'Maintenance', label: 'Maintenance', icon: BuildIcon },
  { key: 'Admin Staff', label: 'Admin Staff', icon: BusinessIcon }
];

const StaffManagementDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState([]);
  const [activeStaffType, setActiveStaffType] = useState('Driver');
  const [assignments, setAssignments] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchSummary = useCallback(async () => {
    try {
      const response = await staffAssignmentService.getSummary();
      setSummary(response.data || []);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, []);

  const fetchAssignments = useCallback(async (assignmentType) => {
    try {
      const response = await staffAssignmentService.getByType(assignmentType);
      setAssignments(response.data || []);
    } catch (err) {
      console.error(`Error fetching ${assignmentType} assignments:`, err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      await Promise.all([
        fetchSummary(),
        fetchAssignments(activeStaffType)
      ]);
    } catch (err) {
      setError('Failed to fetch staff management data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, fetchAssignments, activeStaffType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStaffTypeChange = useCallback((staffTypeKey) => {
    setActiveStaffType(staffTypeKey);
    fetchAssignments(staffTypeKey);
  }, [fetchAssignments]);

  const staffCount = useMemo(() => {
    const totalActive = summary.reduce((total, item) => total + (item.active || 0), 0);
    const totalStaff = summary.reduce((total, item) => total + (item.total || 0), 0);
    return { active: totalActive, total: totalStaff };
  }, [summary]);

  const currentStaffType = useMemo(
    () => staffTypes.find(st => st.key === activeStaffType),
    [activeStaffType]
  );

  const handleDeleteClick = useCallback((assignment) => {
    setAssignmentToDelete(assignment);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!assignmentToDelete) return;

    try {
      setDeleting(true);
      await staffAssignmentService.deleteStaffAssignment(assignmentToDelete._id);
      
      // Optimize: Update local state immediately for instant UI feedback
      setAssignments(prev => prev.filter(a => a._id !== assignmentToDelete._id));
      setSummary(prev => prev.map(item => {
        if (item._id === assignmentToDelete.assignmentType) {
          const wasActive = assignmentToDelete.status === 'Active';
          return {
            ...item,
            total: Math.max(0, (item.total || 0) - 1),
            active: Math.max(0, (item.active || 0) - (wasActive ? 1 : 0))
          };
        }
        return item;
      }));
      
      setSnackbar({
        open: true,
        message: 'Assignment deleted successfully',
        severity: 'success'
      });
      
      setDeleteDialogOpen(false);
      setAssignmentToDelete(null);
      
      // Refresh in background for data accuracy
      Promise.all([fetchAssignments(activeStaffType), fetchSummary()]).catch(console.error);
    } catch (err) {
      console.error('Error deleting assignment:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to delete assignment',
        severity: 'error'
      });
    } finally {
      setDeleting(false);
    }
  }, [assignmentToDelete, activeStaffType, fetchAssignments, fetchSummary]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteDialogOpen(false);
    setAssignmentToDelete(null);
  }, []);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box mb={4}>
          <Skeleton variant="text" width="40%" height={48} />
          <Skeleton variant="text" width="60%" height={24} sx={{ mt: 1 }} />
        </Box>

        {/* Stats Cards Skeleton */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[1, 2, 3, 4, 5].map((item) => (
            <Grid item xs={12} sm={6} md={2.4} key={item}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Skeleton variant="circular" width={40} height={40} sx={{ mx: 'auto', mb: 2 }} />
                  <Skeleton variant="text" height={24} />
                  <Skeleton variant="text" height={16} width="70%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Staff Type Tabs Skeleton */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1}>
            {[1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item} variant="rectangular" width={120} height={36} />
            ))}
          </Stack>
        </Box>

        {/* Table Skeleton */}
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((item) => (
                    <TableRow key={item}>
                      <TableCell><Skeleton variant="text" height={20} width="80%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="60%" /></TableCell>
                      <TableCell><Skeleton variant="rectangular" height={24} width={60} /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} /></TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Skeleton variant="circular" width={28} height={28} />
                          <Skeleton variant="circular" width={28} height={28} />
                        </Stack>
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

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  const { active, total } = staffCount;

  return (
    <Box sx={{ p: 3 }}>
      {/* Simplified Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Staff Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage staff assignments and assignments
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/staff-management/assignments/new')}
          >
            New Assignment
          </Button>
        </Stack>
      </Box>

      {/* Essential Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {active}
                  </Typography>
                  <Typography variant="body2">
                    Active Staff
                  </Typography>
                </Box>
                <Avatar sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <PeopleIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {total}
                  </Typography>
                  <Typography variant="body2">
                    Total Staff
                  </Typography>
                </Box>
                <Avatar sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <AssignmentIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {staffTypes.length}
                  </Typography>
                  <Typography variant="body2">
                    Staff Types
                  </Typography>
                </Box>
                <Avatar sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <BusinessIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Staff Type Selector */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {staffTypes.map((staffType) => {
          const IconComponent = staffType.icon;
          const isActive = activeStaffType === staffType.key;
          return (
            <Grid item key={staffType.key}>
              <Button
                variant={isActive ? 'contained' : 'outlined'}
                startIcon={<IconComponent />}
                onClick={() => handleStaffTypeChange(staffType.key)}
                sx={{
                  minWidth: 120,
                  textTransform: 'none',
                  backgroundColor: isActive ? 'primary.main' : 'transparent',
                  '&:hover': {
                    backgroundColor: isActive ? 'primary.dark' : 'rgba(25, 118, 210, 0.1)'
                  }
                }}
              >
                {staffType.label}
              </Button>
            </Grid>
          );
        })}
      </Grid>

      {/* Assignments Table */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {currentStaffType?.label} Assignments
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {assignments.length} assignment(s) found
              </Typography>
            </Box>
             
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate(`/admin/staff-management/assignments/new?type=${activeStaffType}`)}
              size="small"
            >
              Add Assignment
            </Button>
          </Box>

          {assignments.length > 0 ? (
            <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.50' }}>
                    <TableCell><strong>Staff Member</strong></TableCell>
                    <TableCell><strong>Assignment</strong></TableCell>
                    <TableCell><strong>Location/Department</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Start Date</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment._id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            <PersonIcon />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {assignment.staffId?.firstName} {assignment.staffId?.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {assignment.staffId?.employeeId}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={assignment.assignmentType} 
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {assignment.locationId ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <LocationIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {assignment.locationId.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {assignment.locationId.type}
                              </Typography>
                            </Box>
                          </Box>
                        ) : assignment.departmentId ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <DepartmentIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {assignment.departmentId.name}
                              </Typography>
                            </Box>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Not assigned
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={assignment.status} 
                          color={assignment.status === 'Active' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(assignment.startDate).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/admin/staff-management/assignments/${assignment._id}`)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/admin/staff-management/assignments/${assignment._id}/edit`)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteClick(assignment)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box textAlign="center" py={6}>
              <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }}>
                {currentStaffType && (() => {
                  const IconComponent = currentStaffType.icon;
                  return IconComponent ? <IconComponent /> : null;
                })()}
              </Avatar>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No {currentStaffType?.label.toLowerCase()} assignments found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first assignment to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate(`/admin/staff-management/assignments/new?type=${activeStaffType}`)}
              >
                Create Assignment
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Assignment
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the assignment for{' '}
            <strong>
              {assignmentToDelete?.staffId?.firstName} {assignmentToDelete?.staffId?.lastName}
            </strong>?
            <br />
            <br />
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StaffManagementDashboard;