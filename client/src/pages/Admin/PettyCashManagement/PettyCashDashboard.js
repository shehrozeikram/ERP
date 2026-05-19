import React, { useState, useEffect, useCallback } from 'react';
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
  Chip,
  Alert,
  Skeleton,
  LinearProgress,
  TextField,
  Grid
} from '@mui/material';
import {
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import pettyCashService from '../../../services/pettyCashService';

const PettyCashDashboard = () => {
  const [funds, setFunds] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const fundsResponse = await pettyCashService.getFunds();
      
      // Filter funds by selected month
      const filteredFunds = fundsResponse.data.filter(fund => {
        const fundDate = new Date(fund.fundDate || fund.createdAt);
        const fundMonth = fundDate.toISOString().slice(0, 7); // YYYY-MM format
        return fundMonth === selectedMonth;
      });
      
      setFunds(filteredFunds);
      setExpenses([]); // No longer using expenses
      setError(null);
    } catch (err) {
      setError('Failed to fetch petty cash data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'default',
      'Pending': 'warning',
      'Approved': 'info',
      'Paid': 'success',
      'Rejected': 'error'
    };
    return colors[status] || 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getUtilizationColor = (percentage) => {
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="30%" height={40} />
          <Box display="flex" gap={1}>
            <Skeleton variant="rectangular" width={140} height={36} borderRadius={1} />
            <Skeleton variant="rectangular" width={100} height={36} borderRadius={1} />
          </Box>
        </Box>

        {/* Month Filter Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Skeleton variant="rectangular" height={36} width={100} borderRadius={1} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Summary Cards Skeleton */}
        <Grid container spacing={3} mb={3}>
          {[1, 2, 3].map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box flexGrow={1}>
                      <Skeleton variant="text" height={16} width="40%" sx={{ mb: 1 }} />
                      <Skeleton variant="text" height={32} width="60%" />
                      <Skeleton variant="text" height={14} width="35%" sx={{ mt: 1 }} />
                    </Box>
                    <Skeleton variant="circular" width={48} height={48} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Funds Table Skeleton */}
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Skeleton variant="text" width="25%" height={28} />
              <Skeleton variant="rectangular" width={100} height={36} borderRadius={1} />
            </Box>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((item) => (
                    <TableRow key={item}>
                      <TableCell><Skeleton variant="text" height={20} width="60%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="50%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="40%" /></TableCell>
                      <TableCell><Skeleton variant="rectangular" height={20} width={60} /></TableCell>
                      <TableCell>
                        <Box>
                          <Skeleton variant="text" height={16} width="50%" sx={{ mb: 0.5 }} />
                          <Skeleton variant="rectangular" height={4} width="80%" />
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" justifyContent="center" gap={1}>
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
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" component="h1">
            Petty Cash Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            View petty cash fund records for the selected month.
          </Typography>
        </Box>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            label="Select Month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            size="small"
            sx={{ minWidth: 150 }}
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Funds Overview - {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Typography>

          <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fund ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Current Balance</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Payment Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Custodian</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {funds.map((fund) => {
                    return (
                      <TableRow key={fund._id}>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {fund.fundId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {fund.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(fund.currentBalance)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {fund.vendor || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {fund.paymentType || 'Cash'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={fund.status}
                            color={getStatusColor(fund.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {fund.custodian ? (
                            <Typography variant="body2">
                              {fund.custodian.firstName} {fund.custodian.lastName}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No Custodian
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

        </CardContent>
      </Card>

    </Box>
  );
};

export default PettyCashDashboard;
