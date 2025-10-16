import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Alert,
  alpha,
  useTheme,
  Tooltip,
  Avatar,
  Stack,
  Divider
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  AccountBalanceWallet as WalletIcon,
  Assessment as AssessmentIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';

const AdvancedFinanceDashboard = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState({
    trialBalance: null,
    balanceSheet: null,
    profitLoss: null,
    cashFlow: null,
    departmentSummary: [],
    moduleAnalytics: [],
    recentTransactions: [],
    agingReports: {
      receivables: null,
      payables: null
    }
  });

  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [selectedReport, setSelectedReport] = useState('');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [
        trialBalanceResponse,
        balanceSheetResponse,
        profitLossResponse,
        cashFlowResponse,
        departmentSummaryResponse,
        moduleAnalyticsResponse,
        receivablesAgingResponse,
        payablesAgingResponse
      ] = await Promise.allSettled([
        api.get('/finance/reports/trial-balance'),
        api.get('/finance/reports/balance-sheet'),
        api.get('/finance/reports/profit-loss', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate }
        }),
        api.get('/finance/reports/cash-flow', {
          params: { startDate: dateRange.startDate, endDate: dateRange.endDate }
        }),
        api.get('/finance/journal-entries', {
          params: { limit: 10, page: 1 }
        }),
        api.get('/finance/journal-entries', {
          params: { limit: 5, page: 1 }
        }),
        api.get('/finance/accounts-receivable/aging'),
        api.get('/finance/accounts-payable/aging')
      ]);

      setDashboardData({
        trialBalance: trialBalanceResponse.status === 'fulfilled' ? trialBalanceResponse.value.data.data : null,
        balanceSheet: balanceSheetResponse.status === 'fulfilled' ? balanceSheetResponse.value.data.data : null,
        profitLoss: profitLossResponse.status === 'fulfilled' ? profitLossResponse.value.data.data : null,
        cashFlow: cashFlowResponse.status === 'fulfilled' ? cashFlowResponse.value.data.data : null,
        departmentSummary: departmentSummaryResponse.status === 'fulfilled' ? departmentSummaryResponse.value.data.data.entries || [] : [],
        moduleAnalytics: moduleAnalyticsResponse.status === 'fulfilled' ? moduleAnalyticsResponse.value.data.data.entries || [] : [],
        recentTransactions: departmentSummaryResponse.status === 'fulfilled' ? departmentSummaryResponse.value.data.data.entries || [] : [],
        agingReports: {
          receivables: receivablesAgingResponse.status === 'fulfilled' ? receivablesAgingResponse.value.data.data : null,
          payables: payablesAgingResponse.status === 'fulfilled' ? payablesAgingResponse.value.data.data : null
        }
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleViewReport = (reportType) => {
    setSelectedReport(reportType);
    setReportDialogOpen(true);
  };

  const handleExportReport = async (reportType) => {
    try {
      // Implementation for exporting reports
      console.log(`Exporting ${reportType} report...`);
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  const getDepartmentIcon = (department) => {
    const iconMap = {
      'hr': <PeopleIcon />,
      'admin': <AdminIcon />,
      'procurement': <ShoppingCartIcon />,
      'sales': <BusinessIcon />,
      'finance': <AccountBalanceIcon />,
      'audit': <SecurityIcon />,
      'general': <AccountBalanceIcon />
    };
    return iconMap[department] || <AccountBalanceIcon />;
  };

  const getDepartmentColor = (department) => {
    const colorMap = {
      'hr': 'primary',
      'admin': 'secondary',
      'procurement': 'warning',
      'sales': 'success',
      'finance': 'info',
      'audit': 'error',
      'general': 'default'
    };
    return colorMap[department] || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading Finance Dashboard...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 60, height: 60 }}>
              <AccountBalanceIcon sx={{ fontSize: 30 }} />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                Finance Dashboard
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Comprehensive financial overview and analytics
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/finance/journal-entries/new')}
            >
              New Entry
            </Button>
          </Box>
        </Box>

        {/* Date Range Selector */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            type="date"
            label="Start Date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            type="date"
            label="End Date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Total Assets */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Assets
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                    {dashboardData.balanceSheet ? formatPKR(dashboardData.balanceSheet.assets.total) : 'N/A'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.success.main }}>
                  <TrendingUpIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Revenue */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Revenue
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                    {dashboardData.profitLoss ? formatPKR(dashboardData.profitLoss.revenue.total) : 'N/A'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.info.main }}>
                  <ReceiptIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Net Income */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Net Income
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.warning.main }}>
                    {dashboardData.profitLoss ? formatPKR(dashboardData.profitLoss.netIncome) : 'N/A'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.warning.main }}>
                  {dashboardData.profitLoss && dashboardData.profitLoss.netIncome >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Cash Balance */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)` }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Cash Balance
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                    {dashboardData.balanceSheet ? formatPKR(dashboardData.balanceSheet.assets.accounts.find(acc => acc.accountNumber === '1000')?.balance || 0) : 'N/A'}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                  <WalletIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Department Analytics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssessmentIcon color="primary" />
                Department Summary
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Department</TableCell>
                      <TableCell align="right">Transactions</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboardData.departmentSummary.slice(0, 5).map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getDepartmentIcon(entry.department)}
                            <Typography variant="body2">
                              {entry.department?.toUpperCase() || 'GENERAL'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {entry.lines?.length || 0}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {formatPKR(entry.totalDebits || 0)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={entry.status} 
                            size="small" 
                            color={entry.status === 'posted' ? 'success' : 'warning'}
                          />
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
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PaymentIcon color="primary" />
                Aging Reports
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Accounts Receivable
                </Typography>
                {dashboardData.agingReports.receivables ? (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`Current: ${formatPKR(dashboardData.agingReports.receivables.current)}`} size="small" color="success" />
                    <Chip label={`30+ Days: ${formatPKR(dashboardData.agingReports.receivables.days_30)}`} size="small" color="warning" />
                    <Chip label={`60+ Days: ${formatPKR(dashboardData.agingReports.receivables.days_60)}`} size="small" color="error" />
                  </Box>
                ) : (
                  <Typography variant="body2" color="textSecondary">No data available</Typography>
                )}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Accounts Payable
                </Typography>
                {dashboardData.agingReports.payables ? (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`Current: ${formatPKR(dashboardData.agingReports.payables.current)}`} size="small" color="success" />
                    <Chip label={`30+ Days: ${formatPKR(dashboardData.agingReports.payables.days_30)}`} size="small" color="warning" />
                    <Chip label={`60+ Days: ${formatPKR(dashboardData.agingReports.payables.days_60)}`} size="small" color="error" />
                  </Box>
                ) : (
                  <Typography variant="body2" color="textSecondary">No data available</Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<ViewIcon />}
                onClick={() => handleViewReport('trial-balance')}
              >
                Trial Balance
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<AssessmentIcon />}
                onClick={() => handleViewReport('balance-sheet')}
              >
                Balance Sheet
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<TrendingUpIcon />}
                onClick={() => handleViewReport('profit-loss')}
              >
                Profit & Loss
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<DownloadIcon />}
                onClick={() => handleExportReport('all')}
              >
                Export Reports
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Recent Transactions
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Entry Number</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dashboardData.recentTransactions.slice(0, 10).map((entry) => (
                  <TableRow key={entry._id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {entry.entryNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>
                      <Chip 
                        label={entry.department?.toUpperCase() || 'GENERAL'} 
                        size="small" 
                        color={getDepartmentColor(entry.department)}
                        icon={getDepartmentIcon(entry.department)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatPKR(entry.totalDebits)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={entry.status} 
                        size="small" 
                        color={entry.status === 'posted' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => navigate(`/finance/journal-entries/${entry._id}`)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Report Dialog */}
      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedReport === 'trial-balance' && 'Trial Balance Report'}
          {selectedReport === 'balance-sheet' && 'Balance Sheet Report'}
          {selectedReport === 'profit-loss' && 'Profit & Loss Report'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Report content would be displayed here...
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => handleExportReport(selectedReport)}>
            Export
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdvancedFinanceDashboard;
