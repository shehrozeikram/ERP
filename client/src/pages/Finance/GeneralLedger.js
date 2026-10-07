import React, { useState, useEffect, useCallback } from 'react';
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
  TablePagination
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  Download as DownloadIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';

/** Local YYYY-MM-DD (avoid UTC shift from toISOString). */
const toYmd = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** FBR / SGC financial year: 1 July → 30 June (same as Accounts Receivable). */
const getFinancialYearStartYmd = (date = new Date()) => {
  const fyStartYear = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  return toYmd(new Date(fyStartYear, 6, 1));
};

const GeneralLedger = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { selectedCompanyId } = useFinanceCompany();

  const initialFyStart = getFinancialYearStartYmd();
  const initialToday = toYmd(new Date());
  
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingBalance, setOpeningBalance] = useState(null);
  const [closingBalance, setClosingBalance] = useState(null);
  // Applied filters (drive API fetch) — same pattern as Accounts Payable
  const [filters, setFilters] = useState({
    accountId: '',
    department: '',
    module: '',
    startDate: initialFyStart,
    endDate: initialToday,
    search: ''
  });
  // Local draft for dates/search so typing or opening calendar does not remount/refetch
  const [startDateInput, setStartDateInput] = useState(initialFyStart);
  const [endDateInput, setEndDateInput] = useState(initialToday);
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 100
  });

  const fetchAccounts = useCallback(async () => {
    if (!selectedCompanyId) return;
    try {
      const response = await api.get('/finance/accounts', {
        params: { limit: 1000, companyId: selectedCompanyId }
      });
      if (response.data.success) {
        setAccounts(response.data.data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  }, [selectedCompanyId]);

  const fetchGeneralLedger = useCallback(async () => {
    if (!selectedCompanyId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.accountId) params.append('accountId', filters.accountId);
      if (filters.department) params.append('department', filters.department);
      if (filters.module) params.append('module', filters.module);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.search) params.append('search', filters.search);
      params.append('page', pagination.currentPage);
      params.append('limit', pagination.limit);
      params.append('companyId', selectedCompanyId);
      params.append('_t', new Date().getTime());

      const response = await api.get(`/finance/general-ledger?${params}`);
      if (response.data.success) {
        const data = response.data.data || {};
        setEntries(data.entries || []);
        setOpeningBalance(
          data.openingBalance != null && data.balanceAccountId ? Number(data.openingBalance) : null
        );
        setClosingBalance(
          data.closingBalance != null && data.balanceAccountId ? Number(data.closingBalance) : null
        );
        setPagination(prev => ({
          ...prev,
          ...data.pagination
        }));
      }
    } catch (error) {
      console.error('Error fetching general ledger:', error);
      setError('Failed to fetch general ledger entries');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.currentPage, pagination.limit, selectedCompanyId]);

  // Accounts only when company changes (not on every date keystroke)
  useEffect(() => {
    if (!selectedCompanyId) {
      setAccounts([]);
      return;
    }
    fetchAccounts();
  }, [selectedCompanyId, fetchAccounts]);

  // Debounce date drafts → applied filters (like AP search debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.startDate === startDateInput && prev.endDate === endDateInput) return prev;
        return { ...prev, startDate: startDateInput, endDate: endDateInput };
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [startDateInput, endDateInput]);

  // Debounce search draft → applied filters
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === searchInput) return prev;
        return { ...prev, search: searchInput };
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when applied date/search/account filters change
  useEffect(() => {
    setPagination((prev) => (prev.currentPage === 1 ? prev : { ...prev, currentPage: 1 }));
  }, [filters.startDate, filters.endDate, filters.search, filters.accountId]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setLoading(false);
      setEntries([]);
      return;
    }
    fetchGeneralLedger();
  }, [fetchGeneralLedger, selectedCompanyId]);

  const handleFilterChange = (field) => (event) => {
    setFilters(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const applyDateFiltersNow = () => {
    setFilters((prev) => ({
      ...prev,
      startDate: startDateInput,
      endDate: endDateInput
    }));
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
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

  // Calculate running totals
  const calculateTotals = () => {
    const totalDebits = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredits = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    return { totalDebits, totalCredits };
  };

  const { totalDebits, totalCredits } = calculateTotals();
  const showRunningBalance = Boolean(filters.accountId);

  if (!selectedCompanyId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">Select a finance company to view the General Ledger.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
              <AccountBalanceIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                General Ledger
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Complete transaction history and account details
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FinanceCompanySelector minWidth={280} showHelper={false} />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchGeneralLedger}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => console.log('Export functionality')}
            >
              Export
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              type="date"
              label="Start Date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              onBlur={applyDateFiltersNow}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              type="date"
              label="End Date"
              value={endDateInput}
              onChange={(e) => setEndDateInput(e.target.value)}
              onBlur={applyDateFiltersNow}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Account</InputLabel>
              <Select
                value={filters.accountId}
                onChange={handleFilterChange('accountId')}
                label="Account"
              >
                <MenuItem value="">All Accounts</MenuItem>
                {accounts.map((account) => (
                  <MenuItem key={account._id} value={account._id}>
                    {account.accountNumber} - {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
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
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Module</InputLabel>
              <Select
                value={filters.module}
                onChange={handleFilterChange('module')}
                label="Module"
              >
                <MenuItem value="">All Modules</MenuItem>
                <MenuItem value="payroll">Payroll</MenuItem>
                <MenuItem value="procurement">Procurement</MenuItem>
                <MenuItem value="sales">Sales</MenuItem>
                <MenuItem value="hr">HR</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="audit">Audit</MenuItem>
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="finance">Finance</MenuItem>
                <MenuItem value="taj_utilities">Taj Utilities</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search entries"
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={showRunningBalance ? 3 : 4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Entries
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {pagination.totalCount}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                  <AccountBalanceIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={showRunningBalance ? 3 : 4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Period Debits
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {formatPKR(totalDebits)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <AccountBalanceIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={showRunningBalance ? 3 : 4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Period Credits
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    {formatPKR(totalCredits)}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <AccountBalanceIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        {showRunningBalance && (
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Closing Balance
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 'bold',
                        color:
                          (closingBalance || 0) > 0
                            ? 'success.main'
                            : (closingBalance || 0) < 0
                              ? 'error.main'
                              : 'textSecondary'
                      }}
                    >
                      {formatPKR(closingBalance || 0)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Opening {formatPKR(openingBalance || 0)}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: theme.palette.info.main }}>
                    <AccountBalanceIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* General Ledger Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Ledger Entries
          </Typography>
          {!showRunningBalance && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Select an <strong>Account</strong> to see a correct running Balance (opening as of start date + movements).
            </Alert>
          )}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Entry Number</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  {showRunningBalance && <TableCell align="right">Balance</TableCell>}
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {showRunningBalance && pagination.currentPage === 1 && (
                  <TableRow sx={{ bgcolor: alpha(theme.palette.info.main, 0.06) }}>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {filters.startDate ? formatDate(filters.startDate) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Opening
                      </Typography>
                    </TableCell>
                    <TableCell colSpan={3}>
                      <Typography variant="body2" color="textSecondary">
                        Balance brought forward
                      </Typography>
                    </TableCell>
                    <TableCell align="right">—</TableCell>
                    <TableCell align="right">—</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 'bold',
                          color:
                            (openingBalance || 0) > 0
                              ? 'success.main'
                              : (openingBalance || 0) < 0
                                ? 'error.main'
                                : 'textSecondary'
                        }}
                      >
                        {formatPKR(openingBalance || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
                {entries.map((entry) => (
                  <TableRow key={entry._id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(entry.date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {entry.entryNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {entry.account?.accountNumber || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {entry.account?.name || 'Unknown Account'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {entry.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={entry.department?.toUpperCase() || 'GENERAL'} 
                        size="small" 
                        color={getDepartmentColor(entry.department)}
                        icon={getDepartmentIcon(entry.department)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 'bold',
                          color: entry.debit > 0 ? 'success.main' : 'textSecondary'
                        }}
                      >
                        {entry.debit > 0 ? formatPKR(entry.debit) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 'bold',
                          color: entry.credit > 0 ? 'error.main' : 'textSecondary'
                        }}
                      >
                        {entry.credit > 0 ? formatPKR(entry.credit) : '-'}
                      </Typography>
                    </TableCell>
                    {showRunningBalance && (
                      <TableCell align="right">
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 'bold',
                            color: entry.runningBalance > 0 ? 'success.main' : entry.runningBalance < 0 ? 'error.main' : 'textSecondary'
                          }}
                        >
                          {formatPKR(entry.runningBalance)}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Tooltip title="View Journal Entry">
                        <IconButton 
                          size="small"
                          onClick={() => navigate(`/finance/journal-entries/${entry.journalEntry?._id}`)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {entries.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="textSecondary">
                No ledger entries found
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Adjust your filters or create some journal entries
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/finance/journal-entries/new')}
              >
                Create Journal Entry
              </Button>
            </Box>
          )}

          {/* Pagination */}
          <TablePagination
            component="div"
            count={pagination.totalCount}
            page={Math.max(0, pagination.currentPage - 1)}
            onPageChange={(_, newPage) => setPagination(prev => ({ ...prev, currentPage: newPage + 1 }))}
            rowsPerPage={pagination.limit}
            onRowsPerPageChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value, 10), currentPage: 1 }))}
            rowsPerPageOptions={[25, 50, 100, 250, 500]}
            labelRowsPerPage="Rows per page:"
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default GeneralLedger;
