import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Skeleton,
  Stack,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import salesService from '../../services/salesService';

const statusOptions = ['prospect', 'active', 'inactive'];
const typeOptions = ['corporate', 'individual'];

const SalesCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    status: 'active',
    type: 'corporate',
    industry: '',
    website: ''
  });
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 0,
    rowsPerPage: 10,
    totalCount: 0
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page + 1,
        limit: pagination.rowsPerPage,
        ...filters
      };
      const response = await salesService.getCustomers(params);
      setCustomers(response.data.data.customers || []);
      setPagination((prev) => ({
        ...prev,
        totalCount: response.data.data.pagination?.totalCount || 0
      }));
    } catch (err) {
      console.error('Failed to load customers', err);
      setError(err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.rowsPerPage]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleFilterChange = (field) => (event) => {
    setFilters((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handlePageChange = (_event, newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleRowsPerPageChange = (event) => {
    setPagination((prev) => ({
      ...prev,
      rowsPerPage: parseInt(event.target.value, 10),
      page: 0
    }));
  };

  const handleOpenDialog = (customer = null) => {
    setEditingCustomer(customer);
    setFormData(customer ? {
      name: customer.name || '',
      company: customer.company || '',
      email: customer.email || '',
      phone: customer.phone || '',
      status: customer.status || 'active',
      type: customer.type || 'corporate',
      industry: customer.industry || '',
      website: customer.website || ''
    } : {
      name: '',
      company: '',
      email: '',
      phone: '',
      status: 'active',
      type: 'corporate',
      industry: '',
      website: ''
    });
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCustomer(null);
  };

  const handleSubmit = async () => {
    try {
      if (!formData.name) {
        setError('Name is required');
        return;
      }

      if (editingCustomer?._id) {
        await salesService.updateCustomer(editingCustomer._id, formData);
        setSuccess('Customer updated successfully');
      } else {
        await salesService.createCustomer(formData);
        setSuccess('Customer created successfully');
      }

      handleCloseDialog();
      fetchCustomers();
    } catch (err) {
      console.error('Failed to save customer', err);
      setError(err.response?.data?.message || 'Failed to save customer');
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    if (!window.confirm('Delete this customer?')) return;
    try {
      await salesService.deleteCustomer(customerId);
      setSuccess('Customer deleted successfully');
      fetchCustomers();
    } catch (err) {
      console.error('Failed to delete customer', err);
      setError(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  const LoadingSkeleton = () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={220} height={48} />
      <Skeleton variant="text" width={320} height={24} sx={{ mb: 3 }} />
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          {[6, 6].map((size, idx) => (
            <Grid item xs={12} md={size} key={idx}>
              <Skeleton variant="rounded" height={48} />
            </Grid>
          ))}
        </Grid>
      </Paper>
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              {Array.from({ length: 5 }).map((_, idx) => (
                <TableCell key={idx}>
                  <Skeleton variant="text" />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: 6 }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: 5 }).map((__, cellIdx) => (
                  <TableCell key={cellIdx}>
                    <Skeleton variant="text" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );

  if (loading && customers.length === 0) {
    return <LoadingSkeleton />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Sales Customers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Maintain a central view of every customer relationship.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => handleOpenDialog()}>
          New Customer
        </Button>
      </Stack>

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

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              label="Search"
              value={filters.search}
              onChange={handleFilterChange('search')}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filters.status}
                onChange={handleFilterChange('status')}
              >
                <MenuItem value="">All</MenuItem>
                {statusOptions.map((status) => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Company</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer._id} hover>
                <TableCell>
                  <Typography variant="subtitle2">{customer.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {customer.type}
                  </Typography>
                </TableCell>
                <TableCell>
                  {customer.company || '—'}
                </TableCell>
                <TableCell>
                  <Chip label={customer.status} size="small" color={customer.status === 'active' ? 'success' : customer.status === 'prospect' ? 'info' : 'default'} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{customer.email}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {customer.phone}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpenDialog(customer)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteCustomer(customer._id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No customers found.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={pagination.totalCount}
          page={pagination.page}
          onPageChange={handlePageChange}
          rowsPerPage={pagination.rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCustomer ? 'Edit Customer' : 'New Customer'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Name"
                fullWidth
                required
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Company"
                fullWidth
                value={formData.company}
                onChange={(event) => setFormData((prev) => ({ ...prev, company: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Email"
                fullWidth
                value={formData.email}
                onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Phone"
                fullWidth
                value={formData.phone}
                onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {statusOptions.map((status) => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type"
                  value={formData.type}
                  onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value }))}
                >
                  {typeOptions.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Industry"
                fullWidth
                value={formData.industry}
                onChange={(event) => setFormData((prev) => ({ ...prev, industry: event.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Website"
                fullWidth
                value={formData.website}
                onChange={(event) => setFormData((prev) => ({ ...prev, website: event.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingCustomer ? 'Update Customer' : 'Create Customer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SalesCustomers;

