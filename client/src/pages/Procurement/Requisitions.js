import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
  Chip,
  Alert,
  Stack,
  Divider,
  Grid,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  CircularProgress
} from '@mui/material';
import {
  Assignment as RequisitionIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';

const Requisitions = () => {
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requisitions, setRequisitions] = useState([]);
  const [vendors, setVendors] = useState([]);
  
  // Pagination and filters
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Dialog states
  const [viewDialog, setViewDialog] = useState({ open: false, data: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  const [emailDialog, setEmailDialog] = useState({ open: false, requisition: null, selectedVendors: [] });

  // Load data on component mount
  useEffect(() => {
    loadRequisitions();
    loadVendors();
  }, [page, rowsPerPage, search, statusFilter]);

  const loadVendors = async () => {
    try {
      const response = await api.get('/procurement/vendors', { params: { limit: 1000 } });
      if (response.data.success) {
        setVendors(response.data.data.vendors || []);
      }
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  const loadRequisitions = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
        status: statusFilter || 'Approved' // Default to showing only approved requisitions
      };
      
      const response = await api.get('/indents', { params });
      if (response.data.success) {
        const requisitionsData = response.data.data || [];
        // Ensure we only show approved requisitions (or the selected status)
        const filteredRequisitions = requisitionsData.filter(req => 
          req.status === (statusFilter || 'Approved')
        );
        setRequisitions(filteredRequisitions);
        // Use the total from pagination, but adjust if filtering
        setTotalItems(statusFilter ? filteredRequisitions.length : response.data.pagination?.total || 0);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter]);

  const handleView = (requisition) => {
    setViewDialog({ open: true, data: requisition });
  };

  const handleDelete = (id) => {
    setDeleteDialog({ open: true, id });
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/indents/${deleteDialog.id}`);
      setSuccess('Requisition deleted successfully');
      setDeleteDialog({ open: false, id: null });
      loadRequisitions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete requisition');
    }
  };

  const handleSendEmail = (requisition) => {
    setEmailDialog({ open: true, requisition, selectedVendors: [] });
  };

  const handleSendEmailToVendors = async () => {
    try {
      setLoading(true);
      const { requisition, selectedVendors } = emailDialog;
      
      if (selectedVendors.length === 0) {
        setError('Please select at least one vendor');
        return;
      }

      await api.post('/procurement/requisitions/send-email', {
        requisitionId: requisition._id,
        vendorIds: selectedVendors
      });

      setSuccess(`Requisition sent to ${selectedVendors.length} vendor(s) successfully`);
      setEmailDialog({ open: false, requisition: null, selectedVendors: [] });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send requisition to vendors');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'default',
      'Submitted': 'info',
      'Under Review': 'warning',
      'Approved': 'success',
      'Rejected': 'error',
      'Partially Fulfilled': 'warning',
      'Fulfilled': 'success',
      'Cancelled': 'default'
    };
    return colors[status] || 'default';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Procurement Requisitions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View approved requisitions from departments
          </Typography>
        </Box>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />} 
          onClick={loadRequisitions}
          sx={{ mr: 2 }}
        >
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search requisitions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }}
            sx={{ flexGrow: 1 }}
          />
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter || 'Approved'}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="Approved">Approved</MenuItem>
            <MenuItem value="Partially Fulfilled">Partially Fulfilled</MenuItem>
            <MenuItem value="Fulfilled">Fulfilled</MenuItem>
          </TextField>
        </Stack>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Requisition #</strong></TableCell>
                <TableCell><strong>Title</strong></TableCell>
                <TableCell><strong>Department</strong></TableCell>
                <TableCell><strong>Requester</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Priority</strong></TableCell>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography>Loading...</Typography>
                  </TableCell>
                </TableRow>
              ) : requisitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography color="text.secondary">No requisitions found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                requisitions.map((req) => (
                  <TableRow key={req._id} hover>
                    <TableCell>{req.indentNumber}</TableCell>
                    <TableCell>{req.title}</TableCell>
                    <TableCell>{req.department?.name || '-'}</TableCell>
                    <TableCell>
                      {req.requestedBy?.firstName} {req.requestedBy?.lastName}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={req.status} 
                        color={getStatusColor(req.status)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{req.priority || '-'}</TableCell>
                    <TableCell>{formatDate(req.createdAt)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Send to Vendors">
                        <IconButton 
                          size="small" 
                          color="primary" 
                          onClick={() => handleSendEmail(req)}
                        >
                          <EmailIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleView(req)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {req.status === 'Draft' && (
                        <Tooltip title="Delete">
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => handleDelete(req._id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={(e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* VIEW DIALOG */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false, data: null })} maxWidth="md" fullWidth>
        <DialogTitle>Requisition Details</DialogTitle>
        <DialogContent>
          {viewDialog.data && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Requisition #</Typography>
                  <Typography variant="body1">{viewDialog.data.indentNumber}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip 
                    label={viewDialog.data.status} 
                    color={getStatusColor(viewDialog.data.status)} 
                    size="small" 
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Title</Typography>
                  <Typography variant="body1">{viewDialog.data.title}</Typography>
                </Grid>
                {viewDialog.data.description && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                    <Typography variant="body1">{viewDialog.data.description}</Typography>
                  </Grid>
                )}
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Department</Typography>
                  <Typography variant="body1">{viewDialog.data.department?.name || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Requester</Typography>
                  <Typography variant="body1">
                    {viewDialog.data.requestedBy?.firstName} {viewDialog.data.requestedBy?.lastName}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Priority</Typography>
                  <Typography variant="body1">{viewDialog.data.priority || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Category</Typography>
                  <Typography variant="body1">{viewDialog.data.category || '-'}</Typography>
                </Grid>
                {viewDialog.data.items && viewDialog.data.items.length > 0 && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Items</Typography>
                    </Grid>
                    {viewDialog.data.items.map((item, idx) => (
                      <Grid item xs={12} key={idx}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Typography variant="body2"><strong>{item.itemName}</strong></Typography>
                          <Typography variant="body2">Quantity: {item.quantity} {item.unit}</Typography>
                          {item.estimatedCost && (
                            <Typography variant="body2">Estimated Cost: {formatPKR(item.estimatedCost)}</Typography>
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog({ open: false, data: null })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* EMAIL DIALOG */}
      <Dialog 
        open={emailDialog.open} 
        onClose={() => setEmailDialog({ open: false, requisition: null, selectedVendors: [] })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Send Requisition to Vendors</DialogTitle>
        <DialogContent>
          {emailDialog.requisition && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Requisition Details
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Requisition #:</strong> {emailDialog.requisition.indentNumber}<br />
                <strong>Title:</strong> {emailDialog.requisition.title}<br />
                <strong>Department:</strong> {emailDialog.requisition.department?.name || '-'}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Select Vendors to Send
              </Typography>
              <List>
                {vendors.map((vendor) => (
                  <ListItem key={vendor._id} dense>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={emailDialog.selectedVendors.includes(vendor._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEmailDialog({
                                ...emailDialog,
                                selectedVendors: [...emailDialog.selectedVendors, vendor._id]
                              });
                            } else {
                              setEmailDialog({
                                ...emailDialog,
                                selectedVendors: emailDialog.selectedVendors.filter(id => id !== vendor._id)
                              });
                            }
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2"><strong>{vendor.name}</strong></Typography>
                          <Typography variant="caption" color="text.secondary">
                            {vendor.email} | {vendor.contactPerson}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
              {vendors.length === 0 && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                  No vendors available
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialog({ open: false, requisition: null, selectedVendors: [] })}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSendEmailToVendors}
            disabled={loading || emailDialog.selectedVendors.length === 0}
            startIcon={loading ? <CircularProgress size={20} /> : <EmailIcon />}
          >
            Send Email
          </Button>
        </DialogActions>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null })}>
        <DialogTitle>Delete Requisition</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this requisition? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, id: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Requisitions;
