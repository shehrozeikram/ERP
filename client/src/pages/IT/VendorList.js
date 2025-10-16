import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Tooltip,
  Avatar,
  Rating,
  Badge
} from '@mui/material';
import {
  Add,
  Search,
  FilterList,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  Business,
  Print,
  Download,
  Refresh,
  Warning,
  CheckCircle,
  Star,
  Phone,
  Email,
  Language
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';

import { itService } from '../../services/itService';
import { TableSkeleton } from '../../components/IT/SkeletonLoader';

const StatusChip = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Inactive':
        return 'default';
      case 'Suspended':
        return 'warning';
      case 'Terminated':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Chip
      label={status}
      color={getStatusColor()}
      size="small"
      variant="filled"
    />
  );
};

const VendorList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    vendorType: '',
    status: ''
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  // Query parameters
  const queryParams = {
    page: page + 1,
    limit: rowsPerPage,
    search: searchTerm || undefined,
    ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
  };

  // Fetch vendors
  const { data: vendorsData, isLoading, error, refetch } = useQuery(
    ['it-vendors', queryParams],
    () => itService.getITVendors(queryParams),
    {
      keepPreviousData: true,
      onError: (error) => {
        toast.error('Failed to load vendors');
        console.error('Vendors error:', error);
      }
    }
  );

  // Delete vendor mutation
  const deleteVendorMutation = useMutation(
    (id) => itService.deleteITVendor(id),
    {
      onSuccess: () => {
        toast.success('Vendor deleted successfully');
        queryClient.invalidateQueries(['it-vendors']);
        setDeleteDialog(false);
        setSelectedVendor(null);
      },
      onError: (error) => {
        toast.error('Failed to delete vendor');
        console.error('Delete error:', error);
      }
    }
  );

  const vendors = vendorsData?.data?.data || [];
  const total = vendorsData?.data?.pagination?.total || 0;

  // Handle search
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  // Handle filter change
  const handleFilterChange = (filter, value) => {
    setFilters(prev => ({
      ...prev,
      [filter]: value
    }));
    setPage(0);
  };

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle menu open
  const handleMenuOpen = (event, vendor) => {
    setAnchorEl(event.currentTarget);
    setSelectedVendor(vendor);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedVendor(null);
  };

  // Handle delete
  const handleDelete = () => {
    if (selectedVendor) {
      deleteVendorMutation.mutate(selectedVendor._id);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    refetch();
    toast.success('Vendors refreshed');
  };

  // Vendor types
  const vendorTypes = [
    'Hardware Supplier', 'Software Vendor', 'Service Provider', 'Consultant',
    'Maintenance Provider', 'Cloud Provider', 'Security Provider', 'Network Provider',
    'Training Provider', 'Other'
  ];

  // Vendor statuses
  const vendorStatuses = ['Active', 'Inactive', 'Suspended', 'Terminated'];

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          IT Vendors
        </Typography>
        <TableSkeleton rows={8} columns={6} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          IT Vendors
        </Typography>
        <Alert severity="error">
          Failed to load vendors. Please try again.
        </Alert>
        <Button onClick={handleRefresh} sx={{ mt: 2 }}>
          <Refresh sx={{ mr: 1 }} />
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          IT Vendors
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/it/vendors/add')}
        >
          Add Vendor
        </Button>
      </Box>

      {/* Vendor Statistics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'success.light', mr: 2 }}>
                  <CheckCircle />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Active Vendors
                  </Typography>
                  <Typography variant="h4">
                    {vendors.filter(v => v.relationship?.status === 'Active').length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'warning.light', mr: 2 }}>
                  <Star />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Preferred Vendors
                  </Typography>
                  <Typography variant="h4">
                    {vendors.filter(v => v.relationship?.preferredVendor).length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.light', mr: 2 }}>
                  <Business />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Vendors
                  </Typography>
                  <Typography variant="h4">
                    {vendors.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Avatar sx={{ bgcolor: 'error.light', mr: 2 }}>
                  <Warning />
                </Avatar>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Blacklisted
                  </Typography>
                  <Typography variant="h4">
                    {vendors.filter(v => v.relationship?.blacklisted).length}
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
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search Vendors"
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                placeholder="Search by name, contact, services..."
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Vendor Type</InputLabel>
                <Select
                  value={filters.vendorType}
                  label="Vendor Type"
                  onChange={(e) => handleFilterChange('vendorType', e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  {vendorTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {vendorStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Vendors Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vendor Details</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Preferred</TableCell>
                <TableCell>Services</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor._id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ bgcolor: 'secondary.light', mr: 2 }}>
                        <Business />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {vendor.vendorName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {vendor.businessType || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={vendor.vendorType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Box display="flex" alignItems="center" mb={0.5}>
                        <Phone sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="caption">
                          {vendor.contactInfo?.companyPhone || 'N/A'}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center">
                        <Email sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                        <Typography variant="caption">
                          {vendor.contactInfo?.companyEmail || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Rating
                        value={vendor.rating?.overall || 0}
                        readOnly
                        size="small"
                        precision={0.1}
                      />
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        ({vendor.rating?.overall?.toFixed(1) || 0})
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={vendor.relationship?.status || 'Unknown'} />
                  </TableCell>
                  <TableCell>
                    {vendor.relationship?.preferredVendor ? (
                      <Chip 
                        label="Preferred" 
                        size="small" 
                        color="warning" 
                        variant="filled"
                      />
                    ) : (
                      <Typography variant="caption" color="textSecondary">
                        No
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box>
                      {vendor.services?.slice(0, 2).map((service, index) => (
                        <Chip
                          key={index}
                          label={service}
                          size="small"
                          variant="outlined"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                      {vendor.services?.length > 2 && (
                        <Typography variant="caption" color="textSecondary">
                          +{vendor.services.length - 2} more
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      onClick={(e) => handleMenuOpen(e, vendor)}
                      size="small"
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            navigate(`/it/vendors/${selectedVendor?._id}`);
            handleMenuClose();
          }}
        >
          <Visibility sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/it/vendors/${selectedVendor?._id}/edit`);
            handleMenuClose();
          }}
        >
          <Edit sx={{ mr: 1 }} />
          Edit Vendor
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/it/vendors/${selectedVendor?._id}/contracts`);
            handleMenuClose();
          }}
        >
          <Business sx={{ mr: 1 }} />
          View Contracts
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteDialog(true);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete Vendor
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Vendor</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedVendor?.vendorName}"? 
            This action cannot be undone and will remove all associated contracts and data.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteVendorMutation.isLoading}
          >
            {deleteVendorMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VendorList;
