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
  LinearProgress,
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
  Assignment,
  Security,
  Print,
  Download,
  Refresh,
  Warning,
  CheckCircle
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
      case 'Expired':
        return 'error';
      case 'Expiring Soon':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Chip
      label={status}
      color={getStatusColor()}
      size="small"
      variant="outlined"
    />
  );
};

const LicenseUtilizationBar = ({ used, total }) => {
  const percentage = total > 0 ? (used / total) * 100 : 0;
  const getColor = () => {
    if (percentage >= 90) return 'error';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="caption" color="textSecondary">
          {used}/{total} licenses
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {percentage.toFixed(1)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={getColor()}
        sx={{ height: 6, borderRadius: 3 }}
      />
    </Box>
  );
};

const SoftwareList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    licenseType: '',
    expiring: ''
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedSoftware, setSelectedSoftware] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  // Query parameters
  const queryParams = {
    page: page + 1,
    limit: rowsPerPage,
    search: searchTerm || undefined,
    ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
  };

  // Fetch software
  const { data: softwareData, isLoading, error, refetch } = useQuery(
    ['software', queryParams],
    () => itService.getSoftware(queryParams),
    {
      keepPreviousData: true,
      onError: (error) => {
        toast.error('Failed to load software');
        console.error('Software error:', error);
      }
    }
  );

  // Delete software mutation
  const deleteSoftwareMutation = useMutation(
    (id) => itService.deleteSoftware(id),
    {
      onSuccess: () => {
        toast.success('Software deleted successfully');
        queryClient.invalidateQueries(['software']);
        setDeleteDialog(false);
        setSelectedSoftware(null);
      },
      onError: (error) => {
        toast.error(`Failed to delete software: ${error.response?.data?.message || error.message}`);
      }
    }
  );

  const software = softwareData?.data?.data || [];
  const total = softwareData?.data?.pagination?.total || 0;

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
  const handleMenuOpen = (event, software) => {
    setAnchorEl(event.currentTarget);
    setSelectedSoftware(software);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedSoftware(null);
  };

  // Handle delete
  const handleDelete = () => {
    if (selectedSoftware) {
      deleteSoftwareMutation.mutate(selectedSoftware._id);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    refetch();
    toast.success('Software refreshed');
  };

  // Software categories
  const softwareCategories = [
    'Operating System', 'Office Suite', 'Design Software', 'Development Tools',
    'Database Software', 'Security Software', 'Antivirus', 'Backup Software',
    'Communication Tools', 'Project Management', 'Accounting Software', 'ERP Software', 'Other'
  ];

  // License types
  const licenseTypes = ['Perpetual', 'Subscription', 'Volume', 'Site License', 'Concurrent', 'Open Source'];

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Software & Licenses
        </Typography>
        <TableSkeleton rows={8} columns={6} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Software & Licenses
        </Typography>
        <Alert severity="error">
          Failed to load software. Please try again.
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
          Software & Licenses
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/it/software/add')}
        >
          Add Software
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search Software"
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                placeholder="Search by name, version, vendor..."
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filters.category}
                  label="Category"
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {softwareCategories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>License Type</InputLabel>
                <Select
                  value={filters.licenseType}
                  label="License Type"
                  onChange={(e) => handleFilterChange('licenseType', e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  {licenseTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Expiry Status</InputLabel>
                <Select
                  value={filters.expiring}
                  label="Expiry Status"
                  onChange={(e) => handleFilterChange('expiring', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Expiring Soon</MenuItem>
                  <MenuItem value="false">Not Expiring</MenuItem>
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

      {/* Software Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Software Details</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>License Type</TableCell>
                <TableCell>License Utilization</TableCell>
                <TableCell>Expiry Status</TableCell>
                <TableCell>Purchase Date</TableCell>
                <TableCell>Value</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {software.map((item) => (
                <TableRow key={item._id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ bgcolor: 'secondary.light', mr: 2 }}>
                        <Security />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {item.softwareName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          v{item.version} • {item.vendor?.vendorName || 'Unknown Vendor'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={item.category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip label={item.licenseType} size="small" color="primary" />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ minWidth: 120 }}>
                      <LicenseUtilizationBar 
                        used={item.licenseCount?.used || 0} 
                        total={item.licenseCount?.total || 0} 
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    {item.expiryDate ? (
                      <StatusChip status={item.expiryStatus} />
                    ) : (
                      <Chip label="No Expiry" size="small" color="default" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(item.purchaseDate).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.currency} {item.purchasePrice?.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      onClick={(e) => handleMenuOpen(e, item)}
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
            navigate(`/it/software/${selectedSoftware?._id}`);
            handleMenuClose();
          }}
        >
          <Visibility sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/it/software/${selectedSoftware?._id}/edit`);
            handleMenuClose();
          }}
        >
          <Edit sx={{ mr: 1 }} />
          Edit Software
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/it/software/${selectedSoftware?._id}/assign`);
            handleMenuClose();
          }}
        >
          <Assignment sx={{ mr: 1 }} />
          Assign Licenses
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteDialog(true);
            // Don't close menu yet - keep selectedSoftware for delete dialog
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete Software
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialog} 
        onClose={() => {
          setDeleteDialog(false);
          handleMenuClose(); // Close menu when dialog closes
        }}
      >
        <DialogTitle>Delete Software</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedSoftware?.softwareName}"? 
            This action cannot be undone and will affect all license assignments.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteDialog(false);
            handleMenuClose(); // Close menu when canceling
          }}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteSoftwareMutation.isLoading}
          >
            {deleteSoftwareMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SoftwareList;
