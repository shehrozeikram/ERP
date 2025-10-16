import React, { useState, useEffect } from 'react';
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
  LinearProgress
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
  Computer,
  Print,
  Download,
  Refresh
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
      case 'In Repair':
        return 'warning';
      case 'Retired':
      case 'Lost':
      case 'Stolen':
        return 'error';
      case 'Disposed':
        return 'default';
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

const ConditionChip = ({ condition }) => {
  const getConditionColor = () => {
    switch (condition) {
      case 'Excellent':
        return 'success';
      case 'Good':
        return 'primary';
      case 'Fair':
        return 'warning';
      case 'Poor':
      case 'Damaged':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Chip
      label={condition}
      color={getConditionColor()}
      size="small"
    />
  );
};

const AssetList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    status: '',
    assigned: ''
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  // Query parameters
  const queryParams = {
    page: page + 1,
    limit: rowsPerPage,
    search: searchTerm || undefined,
    ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
  };

  // Fetch assets
  const { data: assetsData, isLoading, error, refetch } = useQuery(
    ['assets', queryParams],
    () => itService.getAssets(queryParams),
    {
      keepPreviousData: true,
      onError: (error) => {
        toast.error('Failed to load assets');
        console.error('Assets error:', error);
      }
    }
  );

  // Delete asset mutation
  const deleteAssetMutation = useMutation(
    (id) => itService.deleteAsset(id),
    {
      onSuccess: () => {
        toast.success('Asset deleted successfully');
        queryClient.invalidateQueries(['assets']);
        setDeleteDialog(false);
        setSelectedAsset(null);
      },
      onError: (error) => {
        toast.error('Failed to delete asset');
        console.error('Delete error:', error);
      }
    }
  );

  const assets = assetsData?.data?.data || [];
  const total = assetsData?.data?.pagination?.total || 0;

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
  const handleMenuOpen = (event, asset) => {
    setAnchorEl(event.currentTarget);
    setSelectedAsset(asset);
  };

  // Handle menu close
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAsset(null);
  };

  // Handle delete
  const handleDelete = () => {
    if (selectedAsset) {
      deleteAssetMutation.mutate(selectedAsset._id);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    refetch();
    toast.success('Assets refreshed');
  };

  // Asset categories
  const assetCategories = [
    'Laptop', 'Desktop', 'Server', 'Printer', 'Scanner', 'Router', 'Switch',
    'Access Point', 'Firewall', 'UPS', 'Monitor', 'Keyboard', 'Mouse',
    'Webcam', 'Headset', 'Projector', 'Tablet', 'Smartphone', 'Other'
  ];

  // Asset statuses
  const assetStatuses = ['Active', 'In Repair', 'Retired', 'Lost', 'Stolen', 'Disposed'];

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          IT Assets
        </Typography>
        <TableSkeleton rows={8} columns={6} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          IT Assets
        </Typography>
        <Alert severity="error">
          Failed to load assets. Please try again.
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
          IT Assets
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/it/assets/add')}
        >
          Add Asset
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search Assets"
                value={searchTerm}
                onChange={handleSearch}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                placeholder="Search by name, tag, brand, model..."
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
                  {assetCategories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  {assetStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Assignment</InputLabel>
                <Select
                  value={filters.assigned}
                  label="Assignment"
                  onChange={(e) => handleFilterChange('assigned', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Assigned</MenuItem>
                  <MenuItem value="false">Unassigned</MenuItem>
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

      {/* Assets Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Asset Details</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Condition</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>Purchase Date</TableCell>
                <TableCell>Value</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset._id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center">
                      <Avatar sx={{ bgcolor: 'primary.light', mr: 2 }}>
                        <Computer />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {asset.assetName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {asset.assetTag} • {asset.brand} {asset.model}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={asset.category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <StatusChip status={asset.status} />
                  </TableCell>
                  <TableCell>
                    <ConditionChip condition={asset.condition} />
                  </TableCell>
                  <TableCell>
                    {asset.assignedTo?.employee ? (
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {asset.assignedTo.employee.firstName} {asset.assignedTo.employee.lastName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {asset.assignedTo.employee.employeeId}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        Unassigned
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(asset.purchaseDate).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {asset.currency} {asset.purchasePrice?.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      onClick={(e) => handleMenuOpen(e, asset)}
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
            navigate(`/it/assets/${selectedAsset?._id}`);
            handleMenuClose();
          }}
        >
          <Visibility sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/it/assets/${selectedAsset?._id}/edit`);
            handleMenuClose();
          }}
        >
          <Edit sx={{ mr: 1 }} />
          Edit Asset
        </MenuItem>
        {selectedAsset?.assignedTo?.employee ? (
          <MenuItem
            onClick={() => {
              navigate(`/it/assets/${selectedAsset?._id}/return`);
              handleMenuClose();
            }}
          >
            <Assignment sx={{ mr: 1 }} />
            Return Asset
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              navigate(`/it/assets/${selectedAsset?._id}/assign`);
              handleMenuClose();
            }}
          >
            <Assignment sx={{ mr: 1 }} />
            Assign Asset
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setDeleteDialog(true);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete Asset
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Asset</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedAsset?.assetName}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteAssetMutation.isLoading}
          >
            {deleteAssetMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AssetList;
