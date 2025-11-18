import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
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
  alpha,
  useTheme,
  Tooltip,
  Avatar,
  Stack,
  CalendarMonth
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  CalendarToday as CalendarTodayIcon,
  Assignment as AssignmentIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const AuditSchedules = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    leadAuditor: ''
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery,
        ...filters
      });
      const response = await api.get(`/audit/schedules?${params.toString()}`);
      const responseData = response.data.data;
      
      // Handle different response structures
      if (responseData && responseData.schedules) {
        // New structure: { schedules: [...], pagination: {...} }
        setSchedules(responseData.schedules || []);
        setTotalItems(responseData.pagination?.totalCount || 0);
      } else if (Array.isArray(responseData)) {
        // Old structure: direct array
        setSchedules(responseData);
        setTotalItems(response.data.total || responseData.length);
      } else {
        // Fallback
        setSchedules([]);
        setTotalItems(0);
      }
    } catch (err) {
      console.error('Error fetching audit schedules:', err);
      setError(err.response?.data?.message || 'Failed to fetch audit schedules.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery, filters]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleFilterChange = (event) => {
    setFilters({
      ...filters,
      [event.target.name]: event.target.value,
    });
  };

  const handleMenuOpen = (event, scheduleId) => {
    setAnchorEl(event.currentTarget);
    setSelectedScheduleId(scheduleId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedScheduleId(null);
  };

  const handleViewSchedule = async () => {
    try {
      const response = await api.get(`/audit/schedules/${selectedScheduleId}`);
      setSelectedSchedule(response.data.data);
      setViewDialogOpen(true);
    } catch (err) {
      console.error('Error fetching schedule details:', err);
      setError(err.response?.data?.message || 'Failed to fetch schedule details.');
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/audit/schedules/${selectedScheduleId}`);
      fetchSchedules();
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Error deleting schedule:', err);
      setError(err.response?.data?.message || 'Failed to delete schedule.');
      setDeleteDialogOpen(false);
    }
  };

  const getStatusChip = (status) => {
    let color = 'default';
    let icon = null;
    switch (status) {
      case 'Scheduled':
        color = 'info';
        icon = <CalendarTodayIcon />;
        break;
      case 'Rescheduled':
        color = 'warning';
        icon = <ScheduleIcon />;
        break;
      case 'Completed':
        color = 'success';
        icon = <CheckCircleIcon />;
        break;
      case 'Cancelled':
        color = 'error';
        icon = <ErrorIcon />;
        break;
      default:
        break;
    }
    return <Chip label={status} color={color} icon={icon} size="small" />;
  };

  const isUpcoming = (scheduledDate) => {
    if (!scheduledDate) return false;
    const today = new Date();
    const scheduled = new Date(scheduledDate);
    const diffTime = scheduled - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 7; // Upcoming in next 7 days
  };

  const isOverdue = (scheduledDate) => {
    if (!scheduledDate) return false;
    const today = new Date();
    const scheduled = new Date(scheduledDate);
    return scheduled < today;
  };

  const LoadingSkeleton = () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={260} height={48} />
      <Skeleton variant="text" width={360} height={24} sx={{ mb: 3 }} />
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          {[4, 2, 2, 2].map((size, idx) => (
            <Grid item xs={12} md={size} key={idx}>
              <Skeleton variant="rounded" height={48} />
            </Grid>
          ))}
        </Grid>
      </Paper>
      <Paper>
        <Table>
          <TableBody>
            {Array.from({ length: 5 }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: 6 }).map((_, cellIdx) => (
                  <TableCell key={cellIdx}>
                    <Skeleton variant="text" width={`${90 - cellIdx * 10}%`} />
                    {cellIdx === 0 && <Skeleton variant="text" width="60%" />}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );

  if (loading) {
    return <LoadingSkeleton />;
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
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: theme.palette.primary.dark }}>
        <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} /> Audit Schedules
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" sx={{ mb: 3 }}>
        Manage audit schedules and track upcoming audits.
      </Typography>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              label="Search Schedules"
              variant="outlined"
              size="small"
              fullWidth
              value={searchQuery}
              onChange={handleSearchChange}
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
                name="status"
                onChange={handleFilterChange}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Scheduled">Scheduled</MenuItem>
                <MenuItem value="Rescheduled">Rescheduled</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/audit/schedules/new')}
              fullWidth
            >
              Schedule Audit
            </Button>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              fullWidth
            >
              Export
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Schedules Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Audit</TableCell>
              <TableCell>Scheduled Date</TableCell>
              <TableCell>Lead Auditor</TableCell>
              <TableCell>Team</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(schedules || []).map((schedule) => (
              <TableRow key={schedule._id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                      {schedule.audit?.objective || 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {schedule.audit?.auditType || ''}
                    </Typography>
                    {isUpcoming(schedule.scheduledDate) && (
                      <Chip label="Upcoming" color="warning" size="small" sx={{ ml: 1 }} />
                    )}
                    {isOverdue(schedule.scheduledDate) && (
                      <Chip label="Overdue" color="error" size="small" sx={{ ml: 1 }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color={isOverdue(schedule.scheduledDate) ? 'error.main' : 'inherit'}>
                      {formatDate(schedule.scheduledDate, { includeTime: true })}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                      {schedule.leadAuditor?.firstName?.charAt(0)}{schedule.leadAuditor?.lastName?.charAt(0)}
                    </Avatar>
                    <Typography variant="body2">
                      {schedule.leadAuditor?.firstName} {schedule.leadAuditor?.lastName}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GroupIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {schedule.teamAuditors?.length || 0} members
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {getStatusChip(schedule.status)}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={schedule.audit?.priority || 'Medium'} 
                    color={schedule.audit?.priority === 'High' ? 'error' : schedule.audit?.priority === 'Low' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    onClick={(e) => handleMenuOpen(e, schedule._id)}
                    size="small"
                  >
                    <MoreVertIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {schedules.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="textSecondary">
                    No audit schedules found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalItems}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
      />

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewSchedule}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => navigate(`/audit/schedules/${selectedScheduleId}/edit`)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* View Schedule Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScheduleIcon />
            Audit Schedule Details
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedSchedule && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Status
                  </Typography>
                  {getStatusChip(selectedSchedule.status)}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Scheduled Date
                  </Typography>
                  <Typography variant="body2" color={isOverdue(selectedSchedule.scheduledDate) ? 'error.main' : 'inherit'}>
                    {formatDate(selectedSchedule.scheduledDate, { includeTime: true })}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Audit Details
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>Objective:</strong> {selectedSchedule.audit?.objective}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Type:</strong> {selectedSchedule.audit?.auditType}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Scope:</strong> {selectedSchedule.audit?.scope}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Lead Auditor
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {selectedSchedule.leadAuditor?.firstName?.charAt(0)}{selectedSchedule.leadAuditor?.lastName?.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">
                        {selectedSchedule.leadAuditor?.firstName} {selectedSchedule.leadAuditor?.lastName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {selectedSchedule.leadAuditor?.email}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Team Auditors
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                    {selectedSchedule.teamAuditors?.map((auditor, index) => (
                      <Chip
                        key={index}
                        label={`${auditor.firstName} ${auditor.lastName}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Grid>
                {selectedSchedule.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Notes
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {selectedSchedule.notes}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => navigate(`/audit/schedules/${selectedSchedule?._id}/edit`)}>
            Edit Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Schedule</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this audit schedule? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditSchedules;
