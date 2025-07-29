import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalance as AccountBalanceIcon,
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { loanService } from '../../services/loanService';
import { formatPKR } from '../../utils/currency';

const LoanStatistics = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const data = await loanService.getLoanStatistics();
      setStats(data);
    } catch (error) {
      setError(error.message || 'Failed to fetch loan statistics');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'Pending': '#ff9800',
      'Approved': '#2196f3',
      'Rejected': '#f44336',
      'Disbursed': '#4caf50',
      'Active': '#9c27b0',
      'Completed': '#4caf50',
      'Defaulted': '#f44336'
    };
    return statusColors[status] || '#757575';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed':
        return <CheckCircleIcon />;
      case 'Active':
      case 'Disbursed':
        return <PaymentIcon />;
      case 'Pending':
        return <WarningIcon />;
      default:
        return <AccountBalanceIcon />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/hr/loans')} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          Loan Statistics & Analytics
        </Typography>
        <Tooltip title="Refresh Statistics">
          <IconButton onClick={fetchStatistics}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#e3f2fd' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalanceIcon sx={{ color: '#1976d2', mr: 1 }} />
                <Typography variant="h6" color="primary">
                  Total Loans
                </Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {stats?.overall?.totalLoans || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                All time loan applications
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#f3e5f5' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUpIcon sx={{ color: '#9c27b0', mr: 1 }} />
                <Typography variant="h6" color="secondary">
                  Total Amount
                </Typography>
              </Box>
              <Typography variant="h4" color="secondary">
                {formatPKR(stats?.overall?.totalAmount || 0)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total loan amount disbursed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#fff3e0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PaymentIcon sx={{ color: '#ff9800', mr: 1 }} />
                <Typography variant="h6" color="warning.main">
                  Outstanding
                </Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                {formatPKR(stats?.overall?.totalOutstanding || 0)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Amount yet to be recovered
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#e8f5e8' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircleIcon sx={{ color: '#4caf50', mr: 1 }} />
                <Typography variant="h6" color="success.main">
                  Total Paid
                </Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {formatPKR(stats?.overall?.totalPaid || 0)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Amount recovered so far
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recovery Rate */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recovery Rate
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box sx={{ flexGrow: 1, mr: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={stats?.overall?.totalAmount ? (stats.overall.totalPaid / stats.overall.totalAmount) * 100 : 0}
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Box>
            <Typography variant="h6" color="primary">
              {stats?.overall?.totalAmount ? Math.round((stats.overall.totalPaid / stats.overall.totalAmount) * 100) : 0}%
            </Typography>
          </Box>
          <Typography variant="body2" color="textSecondary">
            {formatPKR(stats?.overall?.totalPaid || 0)} recovered out of {formatPKR(stats?.overall?.totalAmount || 0)}
          </Typography>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Loans by Status
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats?.byStatus?.map((status) => (
                      <TableRow key={status._id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box sx={{ color: getStatusColor(status._id), mr: 1 }}>
                              {getStatusIcon(status._id)}
                            </Box>
                            <Chip 
                              label={status._id} 
                              size="small"
                              sx={{ 
                                bgcolor: getStatusColor(status._id),
                                color: 'white'
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="h6">
                            {status.count}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="h6" color="primary">
                            {formatPKR(status.totalAmount)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Key Metrics
              </Typography>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Average Loan Amount
                </Typography>
                <Typography variant="h4" color="primary">
                  {formatPKR(stats?.overall?.avgLoanAmount || 0)}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Active Loans
                </Typography>
                <Typography variant="h4" color="secondary">
                  {stats?.byStatus?.find(s => s._id === 'Active')?.count || 0}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Completed Loans
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats?.byStatus?.find(s => s._id === 'Completed')?.count || 0}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Pending Approvals
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {stats?.byStatus?.find(s => s._id === 'Pending')?.count || 0}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LoanStatistics; 