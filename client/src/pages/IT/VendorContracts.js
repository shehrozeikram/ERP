import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  Alert,
  TablePagination,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  ArrowBack,
  Add,
  MoreVert,
  Visibility,
  Edit,
  Delete,
  Search,
  Business,
  DateRange,
  AttachMoney,
  Description,
  Security,
  Refresh
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

import { itService } from '../../services/itService';
import { PageLoading } from '../../components/LoadingSpinner';

const StatusChip = ({ status }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Expired': return 'error';
      case 'Draft': return 'default';
      case 'Terminated': return 'error';
      case 'Suspended': return 'warning';
      case 'Cancelled': return 'error';
      default: return 'default';
    }
  };

  return (
    <Chip
      label={status}
      color={getStatusColor(status)}
      size="small"
      variant="filled"
    />
  );
};

const VendorContracts = () => {
  const navigate = useNavigate();
  const { id: vendorId } = useParams();
  const queryClient = useQueryClient();
  
  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  // Fetch vendor info
  const { data: vendorData, isLoading: vendorLoading } = useQuery(
    ['it-vendor', vendorId],
    () => itService.getITVendor(vendorId),
    {
      onError: (error) => {
        toast.error('Failed to load vendor information');
        console.error('Vendor error:', error);
      }
    }
  );

  // Fetch contracts
  const { data: contractsData, isLoading: contractsLoading, error } = useQuery(
    ['vendor-contracts', vendorId],
    () => {
      return itService.getVendorContracts(vendorId);
    },
    {
      onSuccess: (data) => {
        // Contracts loaded successfully
      },
      onError: (error) => {
        console.error('Contracts API error:', error);
        console.error('Error response:', error.response);
        console.error('Error status:', error.response?.status);
        console.error('Error data:', error.response?.data);
        toast.error('Failed to load contracts');
      }
    }
  );

  // Delete contract mutation
  const deleteContractMutation = useMutation(
    (contractId) => itService.deleteVendorContract(contractId),
    {
      onSuccess: () => {
        toast.success('Contract deleted successfully');
        queryClient.invalidateQueries(['vendor-contracts']);
        setDeleteDialog(false);
        setSelectedContract(null);
      },
      onError: (error) => {
        toast.error('Failed to delete contract');
        console.error('Delete error:', error);
      }
    }
  );

  // Handle data structure - check both possible structures
  let contracts = [];
  if (contractsData?.data?.data && Array.isArray(contractsData.data.data)) {
    contracts = contractsData.data.data;
  } else if (contractsData?.data && Array.isArray(contractsData.data)) {
    contracts = contractsData.data;
  }
  
  // Handle vendor data structure safely
  let vendor = null;
  if (vendorData?.data?.vendor) {
    vendor = vendorData.data.vendor;
  } else if (vendorData?.data && !Array.isArray(vendorData.data)) {
    vendor = vendorData.data;
  }
  const isLoading = vendorLoading || contractsLoading;

  // Filter contracts based on search term - ensure contracts is always an array
  const filteredContracts = Array.isArray(contracts) ? contracts.filter(contract => {
    if (!contract) return false;
    return (
      contract?.contractNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract?.contractTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract?.contractType?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }) : [];

  // Pagination
  const paginatedContracts = filteredContracts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Handle search
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
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

  // Handle menu actions
  const handleMenuOpen = (event, contract) => {
    setAnchorEl(event.currentTarget);
    setSelectedContract(contract);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedContract(null);
  };

  // Handle delete confirmation
  const handleDelete = () => {
    if (selectedContract) {
      deleteContractMutation.mutate(selectedContract._id);
    }
  };

  // Format currency
  const formatCurrency = (amount, currency = 'PKR') => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Vendor Contracts
        </Typography>
        <Alert severity="error">
          Failed to load contracts. Please try again.
        </Alert>
        <Button onClick={() => window.location.reload()} sx={{ mt: 2 }}>
          <Refresh sx={{ mr: 1 }} />
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton onClick={() => navigate('/it/vendors')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1">
              Vendor Contracts
            </Typography>
            {vendor && (
              <Typography variant="subtitle1" color="text.secondary">
                {vendor.vendorName}
              </Typography>
            )}
          </Box>
        </Box>
        
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Security />}
            onClick={() => navigate(`/it/vendors/${vendorId}/passwords`)}
          >
            View Passwords
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate(`/it/vendors/${vendorId}/contracts/new`)}
          >
            Add Contract
          </Button>
        </Box>
      </Box>

      {/* Search and Stats */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={8}>
          <TextField
            fullWidth
            placeholder="Search contracts..."
            value={searchTerm}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Contract Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Total Contracts
                  </Typography>
                  <Typography variant="h6">
                    {contracts.length}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Active Contracts
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {contracts.filter(c => c.status === 'Active').length}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Contracts Table */}
      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Contract Number</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Box py={4}>
                        <Business sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          No contracts found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {searchTerm ? 'Try adjusting your search terms' : 'Add your first contract to get started'}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedContracts.map((contract) => (
                    <TableRow key={contract._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {contract.contractNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {contract.contractTitle}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={contract.contractType}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <StatusChip status={contract.status} />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <DateRange sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {contract.startDate ? format(new Date(contract.startDate), 'MMM dd, yyyy') : 'N/A'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <DateRange sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {contract.endDate ? format(new Date(contract.endDate), 'MMM dd, yyyy') : 'N/A'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <AttachMoney sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {contract.value?.total ? formatCurrency(contract.value.total, contract.value.currency) : 'N/A'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          onClick={(e) => handleMenuOpen(e, contract)}
                          size="small"
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredContracts.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            navigate(`/it/contracts/${selectedContract?._id}`);
            handleMenuClose();
          }}
        >
          <Visibility sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/it/contracts/${selectedContract?._id}/edit`);
            handleMenuClose();
          }}
        >
          <Edit sx={{ mr: 1 }} />
          Edit Contract
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteDialog(true);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete Contract
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Contract</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the contract "{selectedContract?.contractNumber}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            disabled={deleteContractMutation.isLoading}
          >
            {deleteContractMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VendorContracts;
