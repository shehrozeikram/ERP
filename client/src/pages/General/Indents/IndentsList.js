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
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import indentService from '../../../services/indentService';
import dayjs from 'dayjs';

const IndentsList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [indents, setIndents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
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

  useEffect(() => {
    // Check for status filter from URL or location state
    const urlParams = new URLSearchParams(location.search);
    const statusFromUrl = urlParams.get('status');
    if (statusFromUrl) {
      setStatusFilter(statusFromUrl);
    }
    
    loadIndents();
  }, [loadIndents, location.search]);

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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
              <TableCell><strong>Indent #</strong></TableCell>
              <TableCell><strong>Title</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Requested By</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Priority</strong></TableCell>
              <TableCell align="right"><strong>Estimated Cost</strong></TableCell>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {indents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No indents found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              indents.map((indent) => (
                <TableRow key={indent._id} hover>
                  <TableCell>{indent.indentNumber}</TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {indent.title}
                    </Typography>
                  </TableCell>
                  <TableCell>{indent.department?.name || '—'}</TableCell>
                  <TableCell>
                    {indent.requestedBy?.firstName} {indent.requestedBy?.lastName}
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
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(indent.totalEstimatedCost)}
                  </TableCell>
                  <TableCell>{formatDate(indent.requestedDate)}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => navigate(`/general/indents/${indent._id}`)}
                      >
                        <ViewIcon />
                      </IconButton>
                      {indent.status === 'Draft' && indent.requestedBy?._id === user?.id && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => navigate(`/general/indents/${indent._id}/edit`)}
                        >
                          <EditIcon />
                        </IconButton>
                      )}
                      {canApproveReject(indent) && (
                        <>
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleApprove(indent._id)}
                          >
                            <CheckCircleIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleReject(indent._id)}
                          >
                            <CancelIcon />
                          </IconButton>
                        </>
                      )}
                      {indent.status === 'Draft' && indent.requestedBy?._id === user?.id && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedIndent(indent);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
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

