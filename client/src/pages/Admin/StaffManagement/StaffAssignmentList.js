import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  SwapHoriz as TransferIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import staffAssignmentService from '../../../services/staffAssignmentService';

const StaffAssignmentList = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationTypeFilter, setLocationTypeFilter] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, assignmentId: null });

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (assignmentTypeFilter) params.assignmentType = assignmentTypeFilter;
      if (statusFilter) params.status = statusFilter;
      if (locationTypeFilter) params.locationType = locationTypeFilter;
      
      const response = await staffAssignmentService.getStaffAssignments(params);
      setAssignments(response.data || []);
    } catch (err) {
      setError('Failed to fetch staff assignments');
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, assignmentTypeFilter, statusFilter, locationTypeFilter]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleDelete = async () => {
    try {
      await staffAssignmentService.deleteStaffAssignment(deleteDialog.assignmentId);
      setDeleteDialog({ open: false, assignmentId: null });
      fetchAssignments();
    } catch (err) {
      setError('Failed to delete assignment');
      console.error('Error deleting assignment:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Active': 'success',
      'Completed': 'default',
      'Transferred': 'warning',
      'Suspended': 'error'
    };
    return colors[status] || 'default';
  };

  const getAssignmentTypeColor = (type) => {
    const colors = {
      'Guard': 'error',
      'Office Staff': 'primary',
      'Maintenance': 'warning',
      'Security': 'error',
      'Receptionist': 'info',
      'Other': 'default'
    };
    return colors[type] || 'default';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="25%" height={40} />
          <Box>
            <Skeleton variant="circular" width={48} height={48} sx={{ mr: 1, display: 'inline-block' }} />
            <Skeleton variant="rectangular" width={140} height={36} borderRadius={1} />
          </Box>
        </Box>

        {/* Filters Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Skeleton variant="text" width="15%" height={24} sx={{ mb: 2 }} />
            <Box display="flex" gap={2} flexWrap="wrap">
              <Skeleton variant="rectangular" width={200} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={150} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={150} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={120} height={56} borderRadius={1} />
            </Box>
          </CardContent>
        </Card>

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
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                    <TableRow key={item}>
                      <TableCell><Skeleton variant="text" height={20} width="80%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="60%" /></TableCell>
                      <TableCell><Skeleton variant="rectangular" height={24} width={80} /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="40%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} /></TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Skeleton variant="circular" width={28} height={28} />
                          <Skeleton variant="circular" width={28} height={28} />
                          <Skeleton variant="circular" width={28} height={28} />
                          <Skeleton variant="circular" width={28} height={28} />
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
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Staff Assignments
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchAssignments} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/staff-management/assignments/new')}
          >
            New Assignment
          </Button>
        </Box>
      </Box>

      {error && (
        <Box mb={3}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <TextField
              label="Search Assignments"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
            
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Assignment Type</InputLabel>
              <Select
                value={assignmentTypeFilter}
                onChange={(e) => setAssignmentTypeFilter(e.target.value)}
                label="Assignment Type"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="Guard">Guard</MenuItem>
                <MenuItem value="Office Staff">Office Staff</MenuItem>
                <MenuItem value="Maintenance">Maintenance</MenuItem>
                <MenuItem value="Security">Security</MenuItem>
                <MenuItem value="Receptionist">Receptionist</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Transferred">Transferred</MenuItem>
                <MenuItem value="Suspended">Suspended</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Location Type</InputLabel>
              <Select
                value={locationTypeFilter}
                onChange={(e) => setLocationTypeFilter(e.target.value)}
                label="Location Type"
              >
                <MenuItem value="">All Locations</MenuItem>
                <MenuItem value="Office">Office</MenuItem>
                <MenuItem value="House">House</MenuItem>
                <MenuItem value="Warehouse">Warehouse</MenuItem>
                <MenuItem value="Factory">Factory</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Assignments Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Assignment ID</TableCell>
                  <TableCell>Staff Member</TableCell>
                  <TableCell>Assignment Type</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No assignments found. Create your first assignment to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((assignment) => (
                    <TableRow key={assignment._id} hover>
                      <TableCell>{assignment.assignmentId}</TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {assignment.staffId?.firstName} {assignment.staffId?.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {assignment.staffId?.employeeId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={assignment.assignmentType}
                          color={getAssignmentTypeColor(assignment.assignmentType)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {assignment.locationId?.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {assignment.locationId?.type}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(assignment.startDate)}</TableCell>
                      <TableCell>
                        <Chip
                          label={assignment.status}
                          color={getStatusColor(assignment.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/admin/staff-management/assignments/${assignment._id}`)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Assignment">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/admin/staff-management/assignments/${assignment._id}/edit`)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Transfer Assignment">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => navigate(`/admin/staff-management/assignments/${assignment._id}/transfer`)}
                            >
                              <TransferIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Assignment">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteDialog({ open: true, assignmentId: assignment._id })}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, assignmentId: null })}
      >
        <DialogTitle>Delete Assignment</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this assignment? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, assignmentId: null })}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StaffAssignmentList;
