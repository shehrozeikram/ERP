import React, { useState, useEffect } from 'react';
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
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Chip,
  MenuItem,
  Alert,
  Skeleton,
  Avatar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';
import { getImageUrl, handleImageError } from '../../../utils/imageService';

const UtilityBillList = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [utilityTypeFilter, setUtilityTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchBills();
  }, [searchTerm, utilityTypeFilter, statusFilter]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (utilityTypeFilter) params.utilityType = utilityTypeFilter;
      if (statusFilter) params.status = statusFilter;
      
      const response = await utilityBillService.getUtilityBills(params);
      setBills(response.data || []);
    } catch (err) {
      setError('Failed to fetch utility bills');
      console.error('Error fetching bills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (billId) => {
    if (window.confirm('Are you sure you want to delete this utility bill?')) {
      try {
        await utilityBillService.deleteUtilityBill(billId);
        fetchBills();
      } catch (err) {
        setError('Failed to delete utility bill');
        console.error('Error deleting bill:', err);
      }
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Paid': 'success',
      'Pending': 'warning',
      'Overdue': 'error',
      'Partial': 'info'
    };
    return colors[status] || 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="25%" height={40} />
          <Skeleton variant="rectangular" width={140} height={36} borderRadius={1} />
        </Box>

        {/* Filters Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <Skeleton variant="rectangular" width={200} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={150} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={150} height={56} borderRadius={1} />
              <Skeleton variant="rectangular" width={80} height={56} borderRadius={1} />
            </Box>
          </CardContent>
        </Card>

        {/* Bills Table Skeleton */}
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" height={20} /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                    <TableRow key={item}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Skeleton variant="circular" width={32} height={32} />
                          <Box flexGrow={1}>
                            <Skeleton variant="text" height={16} width="60%" />
                            <Skeleton variant="text" height={14} width="40%" />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell><Skeleton variant="rectangular" height={24} width={80} /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="50%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="40%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="35%" /></TableCell>
                      <TableCell>
                        <Skeleton variant="rectangular" height={24} width={60} />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Skeleton variant="circular" width={32} height={32} />
                          <Skeleton variant="circular" width={32} height={32} />
                          <Skeleton variant="circular" width={32} height={32} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Utility Bills List
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchBills} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/utility-bills/new')}
          >
            New Bill
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <TextField
              label="Search Bills"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
            
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Utility Type</InputLabel>
              <Select
                value={utilityTypeFilter}
                onChange={(e) => setUtilityTypeFilter(e.target.value)}
                label="Utility Type"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="Electricity">Electricity</MenuItem>
                <MenuItem value="Water">Water</MenuItem>
                <MenuItem value="Gas">Gas</MenuItem>
                <MenuItem value="Internet">Internet</MenuItem>
                <MenuItem value="Phone">Phone</MenuItem>
                <MenuItem value="Maintenance">Maintenance</MenuItem>
                <MenuItem value="Security">Security</MenuItem>
                <MenuItem value="Cleaning">Cleaning</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All Status</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Paid">Paid</MenuItem>
                <MenuItem value="Overdue">Overdue</MenuItem>
                <MenuItem value="Partial">Partial</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Bills Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Bill ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Image</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Paid</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No utility bills found. Create your first bill to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  bills.map((bill) => (
                    <TableRow key={bill._id} hover>
                      <TableCell>{bill.billId}</TableCell>
                      <TableCell>{bill.utilityType}</TableCell>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {bill.provider}
                        </Typography>
                        {bill.accountNumber && (
                          <Typography variant="caption" color="text.secondary">
                            {bill.accountNumber}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {bill.billImage ? (
                          <Avatar
                            src={getImageUrl(bill.billImage)}
                            alt="Bill Image"
                            sx={{ width: 40, height: 40 }}
                            onError={(e) => handleImageError(e)}
                          />
                        ) : (
                          <Avatar sx={{ width: 40, height: 40, bgcolor: 'grey.300' }}>
                            <Typography variant="caption" color="text.secondary">
                              No Image
                            </Typography>
                          </Avatar>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(bill.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatCurrency(bill.paidAmount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={bill.status}
                          color={getStatusColor(bill.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatDate(bill.dueDate)}</TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/admin/utility-bills/${bill._id}`)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Bill">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/admin/utility-bills/${bill._id}/edit`)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Bill">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(bill._id)}
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
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UtilityBillList;