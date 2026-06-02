import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
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
  Visibility as ViewIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';
import { getImageUrl, handleImageError } from '../../../utils/imageService';
import NarrationTableCell from '../../../components/common/NarrationTableCell';
import { getBillNarrationDisplay } from '../../../utils/documentNarrationDisplay';

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
      
      const params = { excludeCentralizedStore: true };
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

  const getStatusColor = (status) => {
    const colors = {
      'Paid': 'success',
      'Pending': 'warning',
      'Overdue': 'error',
      'Partial': 'info'
    };
    return colors[status] || 'default';
  };

  const getWorkflowLabel = (bill) => {
    if (bill.auditStatus && bill.auditStatus !== 'Not Sent') return bill.auditStatus;
    return bill.approvalStatus || 'Draft';
  };

  const getWorkflowColor = (bill) => {
    const label = getWorkflowLabel(bill);
    if (label.includes('Approved')) return 'success';
    if (label === 'Send to Audit' || label === 'Forwarded to Audit Director' || label === 'Submitted') return 'warning';
    if (label.includes('Rejected') || label === 'Returned from Audit') return 'error';
    return 'default';
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
        <Box>
          <Typography variant="h4" component="h1">
            Utility Bills List
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            View utility bill records only.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchBills}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
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
              placeholder="Search by bill ID, site, provider, department..."
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
                  <TableCell>Site</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell sx={{ minWidth: 180, maxWidth: 280 }}>Narration / Description</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Custodian</TableCell>
                  <TableCell>Image</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Paid</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Workflow Status</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No utility bills found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  bills.map((bill) => (
                    <TableRow key={bill._id} hover>
                      <TableCell>{bill.billId}</TableCell>
                      <TableCell>{bill.site || 'N/A'}</TableCell>
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
                      <NarrationTableCell text={getBillNarrationDisplay(bill)} />
                      <TableCell>{bill.department || 'N/A'}</TableCell>
                      <TableCell>{bill.custodian || 'N/A'}</TableCell>
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
                      <TableCell>
                        <Chip
                          label={getWorkflowLabel(bill)}
                          color={getWorkflowColor(bill)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatDate(bill.dueDate)}</TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/admin/utility-bills/${bill._id}`)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
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