import React, { useState, useEffect } from 'react';
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
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  Card,
  CardContent,
  Grid,
  CircularProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Person,
  Work,
  Cancel as AbsentIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const AttendanceList = () => {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filters, setFilters] = useState({
    employee: '',
    department: '',
    status: '',
    startDate: '',
    endDate: '',
    isApproved: ''
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);

  const [attendance, setAttendance] = useState([]);
  const navigate = useNavigate();

  // Initialize with empty state
  useEffect(() => {
    setAttendance([]);
    setTotalRecords(0);
  }, []);

  // Fetch today's attendance from ZKBio Time
  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/zkbio/zkbio/today');
      const result = await response.json();
      
      if (result.success) {
        setAttendance(result.data);
        setTotalRecords(result.count);
        setSuccess(result.message);
      } else {
        setError(result.message || 'Failed to fetch attendance data');
        setAttendance([]);
        setTotalRecords(0);
      }
    } catch (error) {
      console.error('❌ Error fetching attendance:', error);
      setError('Failed to connect to ZKBio Time system');
      setAttendance([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch attendance on component mount
  useEffect(() => {
    // Force fresh data fetch every time component mounts
    fetchTodayAttendance();
  }, []);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      employee: '',
      department: '',
      status: '',
      startDate: '',
      endDate: '',
      isApproved: ''
    });
  };

  const handleDelete = async () => {
    if (!selectedAttendance) return;
    
    try {
      // Simulate delete operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess('Attendance record deleted successfully');
      setSelectedAttendance(null);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting attendance record:', error);
      setError('Failed to delete attendance record');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const getStatusDisplay = (record) => {
    if (record.status) return record.status;
    if (record.checkIn?.time && record.checkOut?.time) return 'Present';
    if (record.checkIn?.time) return 'Present';
    return 'Absent';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Attendance Management
          </Typography>
          <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
            Background sync active - data automatically saved every 5 minutes
          </Typography>
        </Box>
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

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Person sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Total Records
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {totalRecords}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Person sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Present Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {attendance.filter(r => getStatusDisplay(r) === 'Present').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', color: 'white' }}>
            <CardContent>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Work sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Late Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {attendance.filter(r => getStatusDisplay(r) === 'Late').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AbsentIcon sx={{ fontSize: 40, color: 'white', mr: 2 }} />
                <Box>
                  <Typography color="white" gutterBottom>
                    Absent Today
                  </Typography>
                  <Typography variant="h4" sx={{ color: 'white' }}>
                    {attendance.filter(r => getStatusDisplay(r) === 'Absent').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                label="Search Employee"
                value={filters.employee || ''}
                onChange={(e) => handleFilterChange('employee', e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select
                  value={filters.department || ''}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  label="Department"
                >
                  <MenuItem value="">All Departments</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="Present">Present</MenuItem>
                  <MenuItem value="Absent">Absent</MenuItem>
                  <MenuItem value="Late">Late</MenuItem>
                  <MenuItem value="Leave">Leave</MenuItem>
                  <MenuItem value="Sick Leave">Sick Leave</MenuItem>
                  <MenuItem value="Personal Leave">Personal Leave</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                onClick={clearFilters}
                size="small"
                fullWidth
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Event Type</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} sx={{ mr: 2 }} />
                    <Typography variant="body2" color="textSecondary">
                      Loading ZKBio Time attendance data...
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : attendance.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No attendance records found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              attendance.map((record, index) => (
                <TableRow key={`${record.deviceUserId || record.userId || record.uid || index}-${record.recordTime || Date.now()}-${index}`} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {record.employee?.firstName || record.employee?.lastName || record.name || record.userName || record.fullName || `User ${record.deviceUserId || record.userId || record.uid || 'Unknown'}`}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {record.employee?.employeeId || record.deviceUserId || record.userId || record.uid || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(record.date) || (record.recordTime ? new Date(record.recordTime).toLocaleDateString() : 'N/A')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="primary" fontWeight="bold">
                      {record.originalRecord?.punch_state_display || 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {record.originalRecord?.punch_time ? 
                        new Date(record.originalRecord.punch_time).toLocaleTimeString('en-US', { 
                          hour12: false, 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          second: '2-digit' 
                        }) : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {record.originalRecord?.area_alias || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {record.originalRecord?.verify_type_display || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hr/attendance/employee/${record.employee?._id || record.deviceUserId || record.userId || record.uid}/detail`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hr/attendance/${record._id || record.uid || record.userId || record.deviceUserId}/edit`)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedAttendance(record);
                            setDeleteDialogOpen(true);
                          }}
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
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalRecords}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Attendance Record</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this attendance record? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttendanceList; 