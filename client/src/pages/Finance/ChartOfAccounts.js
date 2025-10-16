import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  alpha,
  useTheme,
  Avatar,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';

const ChartOfAccounts = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [filters, setFilters] = useState({
    type: '',
    department: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0
  });

  useEffect(() => {
    fetchAccounts();
  }, [filters]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.department) params.append('department', filters.department);
      if (filters.search) params.append('search', filters.search);
      params.append('limit', '1000');

      const response = await api.get(`/finance/accounts?${params}`);
      if (response.data.success) {
        setAccounts(response.data.data.accounts || []);
        setPagination(response.data.data.pagination || {});
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError('Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field) => (event) => {
    setFilters(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const toggleRowExpansion = (accountId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedRows(newExpanded);
  };

  const getAccountTypeColor = (type) => {
    const colorMap = {
      'Asset': 'success',
      'Liability': 'error',
      'Equity': 'info',
      'Revenue': 'primary',
      'Expense': 'warning'
    };
    return colorMap[type] || 'default';
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

  const getBalanceIcon = (balance) => {
    if (balance > 0) return <TrendingUpIcon color="success" />;
    if (balance < 0) return <TrendingDownIcon color="error" />;
    return <AccountBalanceIcon color="disabled" />;
  };

  // Group accounts by type
  const groupedAccounts = accounts.reduce((acc, account) => {
    if (!acc[account.type]) {
      acc[account.type] = [];
    }
    acc[account.type].push(account);
    return acc;
  }, {});

  const accountTypeTotals = Object.keys(groupedAccounts).reduce((totals, type) => {
    totals[type] = groupedAccounts[type].reduce((sum, account) => sum + account.balance, 0);
    return totals;
  }, {});

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading Chart of Accounts...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
              <AccountBalanceIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                Chart of Accounts
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Manage your accounting accounts and categories
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchAccounts}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/finance/accounts/new')}
            >
              Add Account
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Search Accounts"
              value={filters.search}
              onChange={handleFilterChange('search')}
              placeholder="Search by name or number"
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Account Type</InputLabel>
              <Select
                value={filters.type}
                onChange={handleFilterChange('type')}
                label="Account Type"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="Asset">Asset</MenuItem>
                <MenuItem value="Liability">Liability</MenuItem>
                <MenuItem value="Equity">Equity</MenuItem>
                <MenuItem value="Revenue">Revenue</MenuItem>
                <MenuItem value="Expense">Expense</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={filters.department}
                onChange={handleFilterChange('department')}
                label="Department"
              >
                <MenuItem value="">All Departments</MenuItem>
                <MenuItem value="hr">HR</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="procurement">Procurement</MenuItem>
                <MenuItem value="sales">Sales</MenuItem>
                <MenuItem value="finance">Finance</MenuItem>
                <MenuItem value="audit">Audit</MenuItem>
                <MenuItem value="general">General</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {Object.keys(accountTypeTotals).map((type) => (
          <Grid item xs={12} sm={6} md={2.4} key={type}>
            <Card sx={{ height: '100%', background: `linear-gradient(135deg, ${alpha(theme.palette[getAccountTypeColor(type)]?.main || theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette[getAccountTypeColor(type)]?.main || theme.palette.primary.main, 0.05)} 100%)` }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      {type}s
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette[getAccountTypeColor(type)]?.main }}>
                      {formatPKR(accountTypeTotals[type])}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {groupedAccounts[type]?.length || 0} accounts
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: theme.palette[getAccountTypeColor(type)]?.main }}>
                    {getBalanceIcon(accountTypeTotals[type])}
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Chart of Accounts Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Account Details
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.keys(groupedAccounts).map((type) => (
                  <React.Fragment key={type}>
                    {/* Type Header Row */}
                    <TableRow sx={{ bgcolor: alpha(theme.palette[getAccountTypeColor(type)]?.main || theme.palette.primary.main, 0.1) }}>
                      <TableCell colSpan={7}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {type}s ({groupedAccounts[type].length} accounts)
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ ml: 'auto' }}>
                            Total: {formatPKR(accountTypeTotals[type])}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                    
                    {/* Accounts in this type */}
                    {groupedAccounts[type].map((account) => (
                      <TableRow key={account._id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {account.accountNumber}
                            </Typography>
                            <Typography variant="body2">
                              {account.name}
                            </Typography>
                          </Box>
                          {account.description && (
                            <Typography variant="caption" color="textSecondary">
                              {account.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={account.type} 
                            size="small" 
                            color={getAccountTypeColor(account.type)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="textSecondary">
                            {account.category}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={account.department?.toUpperCase() || 'GENERAL'} 
                            size="small" 
                            color={getDepartmentColor(account.department)}
                            icon={getDepartmentIcon(account.department)}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            {getBalanceIcon(account.balance)}
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 'bold',
                                color: account.balance > 0 ? 'success.main' : account.balance < 0 ? 'error.main' : 'textSecondary'
                              }}
                            >
                              {formatPKR(account.balance)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={account.isActive ? 'Active' : 'Inactive'} 
                            size="small" 
                            color={account.isActive ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="View Details">
                              <IconButton size="small">
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Account">
                              <IconButton size="small">
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {accounts.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="textSecondary">
                No accounts found
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Create your first account to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/finance/accounts/new')}
              >
                Create First Account
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ChartOfAccounts;
