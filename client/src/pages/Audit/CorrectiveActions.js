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
  CircularProgress,
  Skeleton,
  alpha,
  useTheme,
  Tooltip,
  Avatar,
  Stack,
  LinearProgress
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
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Verified as VerifiedIcon,
  Pending as PendingIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const CorrectiveActions = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    responsiblePerson: ''
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedActionId, setSelectedActionId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);

  const fetchActions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery,
        ...filters
      });
      const response = await api.get(`/audit/corrective-actions?${params.toString()}`);
      const responseData = response.data.data;
      
      // Handle different response structures
      if (responseData && responseData.actions) {
        // New structure: { actions: [...], pagination: {...} }
        setActions(responseData.actions || []);
        setTotalItems(responseData.pagination?.totalCount || 0);
      } else if (Array.isArray(responseData)) {
        // Old structure: direct array
        setActions(responseData);
        setTotalItems(response.data.total || responseData.length);
      } else {
        // Fallback
        setActions([]);
        setTotalItems(0);
      }
    } catch (err) {
      console.error('Error fetching corrective actions:', err);
      setError(err.response?.data?.message || 'Failed to fetch corrective actions.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery, filters]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

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

  const handleMenuOpen = (event, actionId) => {
    setAnchorEl(event.currentTarget);
    setSelectedActionId(actionId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedActionId(null);
  };

  const handleViewAction = async () => {
    try {
      const response = await api.get(`/audit/corrective-actions/${selectedActionId}`);
      setSelectedAction(response.data.data);
      setViewDialogOpen(true);
    } catch (err) {
      console.error('Error fetching action details:', err);
      setError(err.response?.data?.message || 'Failed to fetch action details.');
    }
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/audit/corrective-actions/${selectedActionId}`);
      fetchActions();
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Error deleting action:', err);
      setError(err.response?.data?.message || 'Failed to delete action.');
      setDeleteDialogOpen(false);
    }
  };

  const getStatusChip = (status) => {
    let color = 'default';
    let icon = null;
    switch (status) {
      case 'Open':
        color = 'error';
        icon = <ErrorIcon />;
        break;
      case 'In Progress':
        color = 'warning';
        icon = <PendingIcon />;
        break;
      case 'Completed':
        color = 'info';
        icon = <CheckCircleIcon />;
        break;
      case 'Verified':
        color = 'success';
        icon = <VerifiedIcon />;
        break;
      case 'Overdue':
        color = 'error';
        icon = <WarningIcon />;
        break;
      default:
        break;
    }
    return <Chip label={status} color={color} icon={icon} size="small" />;
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    return due < today;
  };

  const getProgressPercentage = (action) => {
    if (action.status === 'Verified') return 100;
    if (action.status === 'Completed') return 90;
    if (action.status === 'In Progress') return 50;
    return 10;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading Corrective Actions...</Typography>
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
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: theme.palette.primary.dark }}>
        <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} /> Corrective Actions
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" sx={{ mb: 3 }}>
        Track and manage corrective actions for audit findings.
      </Typography>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              label="Search Actions"
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
                <MenuItem value="Open">Open</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Verified">Verified</MenuItem>
                <MenuItem value="Overdue">Overdue</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/audit/corrective-actions/new')}
              fullWidth
            >
              Add Action
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

      {/* Actions Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Action</TableCell>
              <TableCell>Finding</TableCell>
              <TableCell>Responsible</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(actions || []).map((action) => (
              <TableRow key={action._id} hover>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
                      {action.description}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Created: {formatDate(action.createdAt)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ 
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {action.auditFinding?.title || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                      {action.responsiblePerson?.firstName?.charAt(0)}{action.responsiblePerson?.lastName?.charAt(0)}
                    </Avatar>
                    <Typography variant="body2">
                      {action.responsiblePerson?.firstName} {action.responsiblePerson?.lastName}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2" color={isOverdue(action.dueDate) ? 'error.main' : 'inherit'}>
                      {formatDate(action.dueDate)}
                    </Typography>
                    {isOverdue(action.dueDate) && (
                      <Chip label="Overdue" color="error" size="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {getStatusChip(action.status)}
                </TableCell>
                <TableCell>
                  <Box sx={{ width: '100%', minWidth: 100 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={getProgressPercentage(action)}
                      sx={{ height: 8, borderRadius: 4 }}
                      color={
                        action.status === 'Verified' ? 'success' :
                        action.status === 'Completed' ? 'info' :
                        action.status === 'In Progress' ? 'warning' : 'error'
                      }
                    />
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                      {getProgressPercentage(action)}%
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    onClick={(e) => handleMenuOpen(e, action._id)}
                    size="small"
                  >
                    <MoreVertIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {actions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="textSecondary">
                    No corrective actions found.
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
        <MenuItem onClick={handleViewAction}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => navigate(`/audit/corrective-actions/${selectedActionId}/edit`)}>
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

      {/* View Action Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssignmentIcon />
            Corrective Action Details
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedAction && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Status
                  </Typography>
                  {getStatusChip(selectedAction.status)}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Due Date
                  </Typography>
                  <Typography variant="body2" color={isOverdue(selectedAction.dueDate) ? 'error.main' : 'inherit'}>
                    {formatDate(selectedAction.dueDate)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Description
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {selectedAction.description}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Responsible Person
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Avatar sx={{ width: 32, height: 32 }}>
                      {selectedAction.responsiblePerson?.firstName?.charAt(0)}{selectedAction.responsiblePerson?.lastName?.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">
                        {selectedAction.responsiblePerson?.firstName} {selectedAction.responsiblePerson?.lastName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {selectedAction.responsiblePerson?.email}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Related Finding
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {selectedAction.auditFinding?.title}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {selectedAction.auditFinding?.audit?.objective}
                  </Typography>
                </Grid>
                {selectedAction.completionDate && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Completion Date
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(selectedAction.completionDate)}
                    </Typography>
                  </Grid>
                )}
                {selectedAction.verificationDate && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Verification Date
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(selectedAction.verificationDate)}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => navigate(`/audit/corrective-actions/${selectedAction?._id}/edit`)}>
            Edit Action
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Corrective Action</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this corrective action? This action cannot be undone.
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

export default CorrectiveActions;
