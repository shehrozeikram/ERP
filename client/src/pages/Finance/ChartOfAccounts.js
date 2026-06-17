import React, { useState, useEffect, useMemo } from 'react';
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
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Divider,
  Pagination
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  Delete as DeleteIcon
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
    totalCount: 0,
    limit: 100
  });
  const [summaryAccounts, setSummaryAccounts] = useState([]);
  const [newAccountDialog, setNewAccountDialog] = useState(false);
  const [accountTypesGrouped, setAccountTypesGrouped] = useState({
    Asset: ['Cash and cash equivalents', 'Accounts receivable (A/R)', 'Current assets', 'Fixed assets', 'Non-current assets'],
    Liability: ['Credit card', 'Accounts payable (A/P)', 'Current liabilities', 'Non-current liabilities'],
    Equity: ["Owner's equity"],
    Income: ['Income', 'Other income'],
    Expense: ['Cost of sales', 'Expenses', 'Other expense']
  });
  const [detailTypesByAccountType, setDetailTypesByAccountType] = useState({
    'Cash and cash equivalents': ['Bank', 'Cash and cash equivalents', 'Cash on hand', 'Client trust account', 'Money Market', 'Rents Held in Trust', 'Savings'],
    'Accounts receivable (A/R)': ['Accounts receivable'],
    'Current assets': [
      'Allowance for bad debts',
      'Assets available for sale',
      'Development Costs',
      'Employee Cash Advances',
      'Inventory',
      'Investments - Other',
      'Loans To Officers',
      'Loans to Others',
      'Loans to Shareholders',
      'Other current assets',
      'Prepaid Expenses',
      'Retainage',
      'Undeposited Funds'
    ],
    'Fixed assets': [
      'Accumulated depletion',
      'Accumulated depreciation on property, plant and equipment',
      'Buildings',
      'Depletable Assets',
      'Furniture and Fixtures',
      'Land',
      'Leasehold Improvements',
      'Machinery and equipments',
      'Other fixed assets',
      'Vehicles'
    ],
    'Non-current assets': [
      'Accumulated amortisation of non-current assets',
      'Assets held for sale',
      'Deferred tax',
      'Goodwill',
      'Intangible Assets',
      'Lease Buyout',
      'Licences',
      'Long-term investments',
      'Organisational Costs',
      'Other non-current assets',
      'Security Deposits'
    ],
    'Credit card': ['Credit card'],
    'Accounts payable (A/P)': ['Accounts payable'],
    'Current liabilities': [
      'Accrued liabilities',
      'Client Trust Accounts - Liabilities',
      'Current Tax Liability',
      'Current portion of obligations under finance leases',
      'Dividends payable',
      'Income tax payable',
      'Insurance payable',
      'Line of Credit',
      'Loan Payable',
      'Other current liabilities',
      'Payroll Clearing',
      'Payroll liabilities',
      'Prepaid Expenses Payable',
      'Rents in trust - Liability',
      'Sales and service tax payable'
    ],
    'Non-current liabilities': [
      'Accrued holiday payable',
      'Accrued non-current liabilities',
      'Liabilities related to assets held for sale',
      'Long-term debt',
      'Notes Payable',
      'Other non-current liabilities',
      'Shareholder Notes Payable'
    ],
    "Owner's equity": [
      'Accumulated adjustment',
      'Dividend disbursed',
      'Equity in earnings of subsidiaries',
      'Opening Balance Equity',
      'Ordinary shares',
      'Other comprehensive income',
      "Owner's equity",
      'Paid-in capital or surplus',
      'Partner Contributions',
      'Partner Distributions',
      "Partner's Equity",
      'Preferred shares',
      'Retained Earnings',
      'Share capital',
      'Treasury Shares'
    ],
    Income: [
      'Discounts/Refunds Given',
      'Non-Profit Income',
      'Other Primary Income',
      'Revenue - General',
      'Sales - retail',
      'Sales - wholesale',
      'Sales of Product Income',
      'Service/Fee Income',
      'Unapplied Cash Payment Income'
    ],
    'Other income': [
      'Dividend income',
      'Interest earned',
      'Loss on disposal of assets',
      'Other Investment Income',
      'Other Miscellaneous Income',
      'Other operating income',
      'Tax-Exempt Interest',
      'Unrealised loss on securities, net of tax'
    ],
    'Cost of sales': [
      'Cost of labour - COS',
      'Equipment rental - COS',
      'Freight and delivery - COS',
      'Other costs of sales - COS',
      'Supplies and materials - COS'
    ],
    Expenses: [
      'Advertising/Promotional',
      'Amortisation expense',
      'Auto',
      'Bad debts',
      'Bank charges',
      'Charitable Contributions',
      'Commissions and fees',
      'Cost of Labour',
      'Dues and Subscriptions',
      'Equipment rental',
      'Finance costs',
      'Income tax expense',
      'Insurance',
      'Interest paid',
      'Legal and professional fees',
      'Loss on discontinued operations, net of tax',
      'Management compensation',
      'Meals and entertainment',
      'Office/General Administrative Expenses',
      'Other Miscellaneous Service Cost',
      'Other selling expenses',
      'Payroll Expenses',
      'Rent or Lease of Buildings',
      'Repair and maintenance',
      'Shipping and delivery expense',
      'Supplies and materials',
      'Taxes Paid',
      'Travel expenses - general and admin expense',
      'Travel expenses - selling expense',
      'Unapplied Cash Bill Payment Expense',
      'Utilities'
    ],
    'Other expense': [
      'Amortisation',
      'Depreciation',
      'Exchange Gain or Loss',
      'Interest expense',
      'Other Expense',
      'Penalties and settlements'
    ]
  });
  const [newAccountForm, setNewAccountForm] = useState({
    name: '',
    section: '',
    accountType: '',
    detailType: '',
    parentAccount: '',
    openingBalance: '',
    openingBalanceAsOf: new Date().toISOString().slice(0, 10),
    description: '',
    isSubaccount: false
  });
  const [parentAccounts, setParentAccounts] = useState([]);
  const [parentAccountsLoading, setParentAccountsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSummaryAccounts();
  }, [filters]);

  useEffect(() => {
    fetchAccounts();
  }, [filters, pagination.currentPage, pagination.limit]);

  const buildAccountQueryParams = (page, limit) => {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.department) params.append('department', filters.department);
    if (filters.search) params.append('search', filters.search);
    params.append('page', String(page));
    params.append('limit', String(limit));
    return params;
  };

  const fetchSummaryAccounts = async () => {
    try {
      const params = buildAccountQueryParams(1, 10000);
      const response = await api.get(`/finance/accounts?${params}`);
      if (response.data.success) {
        setSummaryAccounts(response.data.data.accounts || []);
      }
    } catch {
      setSummaryAccounts([]);
    }
  };

  const fetchDetailTypes = async () => {
    try {
      const res = await api.get('/finance/accounts/detail-types');
      if (res.data.success) {
        setAccountTypesGrouped(res.data.data.accountTypesGrouped || {});
        setDetailTypesByAccountType(res.data.data.detailTypesByAccountType || {});
      }
    } catch (e) {
      console.warn('Could not fetch detail types, using defaults');
    }
  };

  const openNewAccountDialog = () => {
    setNewAccountForm({
      name: '',
      section: '',
      accountType: '',
      detailType: '',
      parentAccount: '',
      openingBalance: '',
      openingBalanceAsOf: new Date().toISOString().slice(0, 10),
      description: '',
      isSubaccount: false
    });
    fetchDetailTypes();
    // Seed from currently loaded chart rows so dropdown is immediately usable
    setParentAccounts((accounts || []).filter((a) => a && (a._id || a.id) && (a.name || a.accountNumber)));
    fetchParentAccounts();
    setNewAccountDialog(true);
  };

  const fetchParentAccounts = async () => {
    setParentAccountsLoading(true);
    try {
      const response = await api.get('/finance/accounts', {
        params: { page: 1, limit: 10000, _t: Date.now() }
      });
      if (response.data?.success) {
        const allAccounts = response.data?.data?.accounts || [];
        setParentAccounts(allAccounts.filter((a) => a && (a._id || a.id) && (a.name || a.accountNumber)));
        return;
      }
    } catch {
      // fallback to current in-memory list
    } finally {
      setParentAccountsLoading(false);
    }
    setParentAccounts((accounts || []).filter((a) => a && (a._id || a.id) && (a.name || a.accountNumber)));
  };

  const closeNewAccountDialog = () => {
    setNewAccountDialog(false);
  };

  const getSectionForAccountType = (accountType) => {
    for (const [section, opts] of Object.entries(accountTypesGrouped)) {
      if ((opts || []).includes(accountType)) return section;
    }
    return 'Asset';
  };

  const getNextAccountNumber = (section) => {
    const ranges = { Asset: [1000, 1999], Liability: [2000, 2999], Equity: [3000, 3999], Revenue: [4000, 4999], Income: [4000, 4999], Expense: [5000, 5999] };
    const type = section === 'Income' ? 'Revenue' : section;
    const [min, max] = ranges[section] || [1000, 1999];
    const source = parentAccounts.length > 0 ? parentAccounts : summaryAccounts.length > 0 ? summaryAccounts : accounts;
    const used = new Set(
      source
        .filter((a) => a.type === type)
        .map((a) => parseInt(a.accountNumber, 10))
        .filter((n) => !Number.isNaN(n) && n >= min && n <= max)
    );
    for (let n = min; n <= max; n += 1) {
      if (!used.has(n)) return String(n);
    }
    return String(max);
  };

  const parentAccountOptions = useMemo(() => {
    const base = (parentAccounts && parentAccounts.length > 0 ? parentAccounts : accounts) || [];
    return base
      .filter((a) => a && (a._id || a.id) && (a.name || a.accountNumber))
      .sort((a, b) =>
        String(a.accountNumber || '').localeCompare(String(b.accountNumber || ''), undefined, { numeric: true })
      );
  }, [parentAccounts, accounts]);

  useEffect(() => {
    if (newAccountDialog && newAccountForm.isSubaccount) {
      fetchParentAccounts();
    }
  }, [newAccountDialog, newAccountForm.isSubaccount]);

  const getParentAccountId = (account) => {
    if (!account?.parentAccount) return null;
    const parent = account.parentAccount;
    return String(parent._id || parent);
  };

  const { rootAccounts, childrenByParentId } = useMemo(() => {
    const byParent = {};
    const roots = [];
    const accountIds = new Set((accounts || []).map((a) => String(a._id)));

    (accounts || []).forEach((account) => {
      const parentId = getParentAccountId(account);
      if (parentId && accountIds.has(parentId)) {
        if (!byParent[parentId]) byParent[parentId] = [];
        byParent[parentId].push(account);
      } else {
        roots.push(account);
      }
    });

    const sortByNumber = (list) =>
      [...list].sort((a, b) =>
        String(a.accountNumber || '').localeCompare(String(b.accountNumber || ''), undefined, { numeric: true })
      );

    Object.keys(byParent).forEach((key) => {
      byParent[key] = sortByNumber(byParent[key]);
    });

    return { rootAccounts: sortByNumber(roots), childrenByParentId: byParent };
  }, [accounts]);

  const handleCreateAccount = async () => {
    if (!newAccountForm.name?.trim()) {
      setError('Account name is required');
      return;
    }
    if (!newAccountForm.accountType) {
      setError('Account type is required');
      return;
    }
    const detailOptions = detailTypesByAccountType[newAccountForm.accountType] || [];
    if (detailOptions.length && !newAccountForm.detailType) {
      setError('Detail type is required');
      return;
    }
    const section = newAccountForm.section || getSectionForAccountType(newAccountForm.accountType);
    const accountNumber = getNextAccountNumber(section);
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        accountNumber,
        name: newAccountForm.name.trim(),
        accountType: newAccountForm.accountType,
        detailType: newAccountForm.detailType,
        balance: Number(newAccountForm.openingBalance) || 0,
        description: newAccountForm.description?.trim() || undefined,
        parentAccount: newAccountForm.isSubaccount && newAccountForm.parentAccount ? newAccountForm.parentAccount : undefined
      };
      await api.post('/finance/accounts', payload);
      if (newAccountForm.isSubaccount && newAccountForm.parentAccount) {
        setExpandedRows((prev) => new Set([...prev, newAccountForm.parentAccount]));
      }
      await fetchAccounts();
      await fetchSummaryAccounts();
      closeNewAccountDialog();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const params = buildAccountQueryParams(pagination.currentPage, pagination.limit);
      params.append('_t', new Date().getTime());

      const response = await api.get(`/finance/accounts?${params}`);
      if (response.data.success) {
        setAccounts(response.data.data.accounts || []);
        const apiPagination = response.data.data.pagination || {};
        setPagination((prev) => ({
          ...prev,
          currentPage: apiPagination.currentPage || prev.currentPage,
          totalPages: apiPagination.totalPages || 1,
          totalCount: apiPagination.totalCount ?? apiPagination.totalItems ?? 0
        }));
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError('Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field) => (event) => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    setFilters(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handlePageChange = (_event, page) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };

  const handlePageSizeChange = (event) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      limit: Number(event.target.value)
    }));
  };

  const refreshAccounts = async () => {
    await Promise.all([fetchSummaryAccounts(), fetchAccounts()]);
  };

  const openDeleteDialog = (account) => {
    setAccountToDelete(account);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteDialogOpen(false);
    setAccountToDelete(null);
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete?._id) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/finance/accounts/${accountToDelete._id}`);
      setExpandedRows((prev) => {
        const next = new Set(prev);
        next.delete(String(accountToDelete._id));
        return next;
      });
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
      await fetchAccounts();
      await fetchSummaryAccounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setDeleteDialogOpen(false);
      setAccountToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const canDeleteAccount = (account) => !account?.isSystem && !account?.isSystemAccount;

  const toggleRowExpansion = (accountId) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const renderAccountRows = (accountList, depth = 0) =>
    (accountList || []).flatMap((account) => {
      const accountId = String(account._id);
      const children = childrenByParentId[accountId] || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedRows.has(accountId);

      const row = (
        <TableRow
          key={account._id}
          hover
          sx={{
            bgcolor: depth > 0 ? alpha(theme.palette.primary.main, 0.03) : undefined,
            '& td:first-of-type': { pl: depth > 0 ? 2 + depth * 2 : undefined }
          }}
        >
          <TableCell padding="checkbox" sx={{ width: 48 }}>
            {hasChildren ? (
              <IconButton
                size="small"
                onClick={() => toggleRowExpansion(accountId)}
                aria-label={isExpanded ? 'Collapse subaccounts' : 'Expand subaccounts'}
              >
                {isExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
              </IconButton>
            ) : (
              <Box sx={{ width: 34 }} />
            )}
          </TableCell>
          <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: depth * 3 }}>
              <Typography variant="body2" sx={{ fontWeight: depth === 0 ? 500 : 400 }}>
                {account.accountNumber ? `${account.accountNumber} — ` : ''}
                {account.name || '—'}
              </Typography>
              {hasChildren && (
                <Chip
                  label={`${children.length} subaccount${children.length === 1 ? '' : 's'}`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              )}
              {depth > 0 && (
                <Chip label="Subaccount" size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
              )}
            </Box>
          </TableCell>
          <TableCell>
            <Typography variant="body2">
              {account.category || account.type || '—'}
            </Typography>
          </TableCell>
          <TableCell>
            <Typography variant="body2" color="text.secondary">
              {account.detailType || '—'}
            </Typography>
          </TableCell>
          <TableCell align="right">
            <Typography variant="body2">
              {formatPKR(account.balance || 0)}
            </Typography>
          </TableCell>
          <TableCell align="right">
            <Typography variant="body2" color="text.secondary">
              {formatPKR(account.bankBalance || 0)}
            </Typography>
          </TableCell>
          <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Button
                variant="text"
                size="small"
                endIcon={<KeyboardArrowDownIcon />}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Account history
              </Button>
              {canDeleteAccount(account) ? (
                <Tooltip title="Delete account">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => openDeleteDialog(account)}
                    aria-label="Delete account"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="System accounts cannot be deleted">
                  <span>
                    <IconButton size="small" disabled aria-label="Delete account disabled">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          </TableCell>
        </TableRow>
      );

      if (hasChildren && isExpanded) {
        return [row, ...renderAccountRows(children, depth + 1)];
      }
      return [row];
    });

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

  // Group accounts by type (summary across all filtered accounts, not just current page)
  const groupedAccounts = summaryAccounts.reduce((acc, account) => {
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

  const pageStart = pagination.totalCount === 0
    ? 0
    : (pagination.currentPage - 1) * pagination.limit + 1;
  const pageEnd = Math.min(pagination.currentPage * pagination.limit, pagination.totalCount);

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
              onClick={refreshAccounts}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              color="warning"
              size="small"
              onClick={async () => {
                try {
                  const api = (await import('../../services/api')).default;
                  const res = await api.post('/finance/accounts/ensure-defaults');
                  alert(res.data.message);
                  fetchAccounts();
                  fetchSummaryAccounts();
                } catch (e) {
                  alert(e.response?.data?.message || 'Failed to ensure system accounts');
                }
              }}
            >
              Ensure System Accounts
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openNewAccountDialog}
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
                <MenuItem value="finance">Finance</MenuItem>
                <MenuItem value="taj_utilities">Taj Utilities</MenuItem>
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Typography variant="h6">
              Account Details
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                {pagination.totalCount > 0
                  ? `Showing ${pageStart}–${pageEnd} of ${pagination.totalCount} accounts`
                  : 'No accounts'}
              </Typography>
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Rows</InputLabel>
                <Select
                  value={pagination.limit}
                  label="Rows"
                  onChange={handlePageSizeChange}
                >
                  <MenuItem value={100}>100</MenuItem>
                  <MenuItem value={250}>250</MenuItem>
                  <MenuItem value={500}>500</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" disabled />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Account Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Detail Type</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Balance</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Bank Balance</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {renderAccountRows(rootAccounts)}
              </TableBody>
            </Table>
          </TableContainer>

          {pagination.totalCount === 0 && !loading && (
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
                onClick={openNewAccountDialog}
              >
                Create First Account
              </Button>
            </Box>
          )}

          {pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={pagination.totalPages}
                page={pagination.currentPage}
                onChange={handlePageChange}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* New Account Dialog (QuickBooks-style) */}
      <Dialog
        open={newAccountDialog}
        onClose={closeNewAccountDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            minHeight: 520,
            boxShadow: 24
          }
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pt: 2.5,
            px: 3,
            pb: 4,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            borderBottom: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 40, height: 40 }}>
              <AddIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="span" fontWeight={600}>
                New account
              </Typography>
              <Typography variant="body2" color="text.secondary" display="block">
                Add a new account to your chart of accounts
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={closeNewAccountDialog} size="small" sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 5, overflow: 'visible' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Box sx={{ pt: 6, overflow: 'visible' }}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                required
                label="Account name"
                value={newAccountForm.name}
                onChange={(e) => setNewAccountForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Petty Cash"
                size="medium"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                Account classification
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth required size="medium">
                    <InputLabel>Section</InputLabel>
                    <Select
                      value={newAccountForm.section}
                      label="Section"
                      onChange={(e) => setNewAccountForm(f => ({ ...f, section: e.target.value, accountType: '', detailType: '' }))}
                      sx={{ borderRadius: 1.5 }}
                    >
                      <MenuItem value="">Select section</MenuItem>
                      {['Asset', 'Liability', 'Equity', 'Income', 'Expense'].map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth required size="medium">
                    <InputLabel>Account type</InputLabel>
                    <Select
                      value={newAccountForm.accountType}
                      label="Account type"
                      onChange={(e) => setNewAccountForm(f => ({ ...f, accountType: e.target.value, detailType: '' }))}
                      disabled={!newAccountForm.section}
                      sx={{ borderRadius: 1.5 }}
                    >
                      <MenuItem value="">Select account type</MenuItem>
                      {(accountTypesGrouped[newAccountForm.section] || []).map((opt) => (
                        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth required size="medium">
                    <InputLabel>Detail type</InputLabel>
                    <Select
                      value={newAccountForm.detailType}
                      label="Detail type"
                      MenuProps={{ disableScrollLock: true }}
                      onChange={(e) => setNewAccountForm(f => ({ ...f, detailType: e.target.value }))}
                      disabled={!newAccountForm.accountType}
                      sx={{ borderRadius: 1.5 }}
                    >
                      <MenuItem value="">
                        <em>Select detail type</em>
                      </MenuItem>
                      {(detailTypesByAccountType[newAccountForm.accountType] || []).map((d) => (
                        <MenuItem key={d} value={d}>
                          <Box component="span" sx={{ width: 28, display: 'inline-flex', alignItems: 'center', mr: 0.5 }}>
                            {newAccountForm.detailType === d && (
                              <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />
                            )}
                          </Box>
                          {d}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
            <Divider sx={{ my: 0.5 }} />
            <FormControlLabel
              control={
                <Checkbox
                  checked={newAccountForm.isSubaccount}
                  onChange={(e) => setNewAccountForm(f => ({
                    ...f,
                    isSubaccount: e.target.checked,
                    ...(e.target.checked ? {} : { parentAccount: '', openingBalance: '', openingBalanceAsOf: new Date().toISOString().slice(0, 10) })
                  }))}
                  color="primary"
                />
              }
              label="Make this a subaccount (nested under a parent account)"
            />
            {newAccountForm.isSubaccount && (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="medium" sx={{ maxWidth: 520 }}>
                    <InputLabel>Parent account</InputLabel>
                    <Select
                      value={newAccountForm.parentAccount}
                      label="Parent account"
                      onChange={(e) => setNewAccountForm(f => ({ ...f, parentAccount: e.target.value }))}
                      sx={{ borderRadius: 1.5 }}
                    >
                      <MenuItem value="">
                        <em>{parentAccountsLoading ? 'Loading parent accounts...' : 'Select...'}</em>
                      </MenuItem>
                      {parentAccountOptions.map((a) => (
                        <MenuItem key={a._id} value={a._id}>
                          {a.accountNumber} — {a.name}
                          {a.type ? ` (${a.type})` : ''}
                        </MenuItem>
                      ))}
                      {!parentAccountsLoading && parentAccountOptions.length === 0 && (
                        <MenuItem value="" disabled>
                          No parent accounts found
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Opening balance"
                    type="number"
                    value={newAccountForm.openingBalance}
                    onChange={(e) => setNewAccountForm((f) => ({ ...f, openingBalance: e.target.value }))}
                    inputProps={{ step: '0.01' }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="As of"
                    type="date"
                    value={newAccountForm.openingBalanceAsOf}
                    onChange={(e) => setNewAccountForm((f) => ({ ...f, openingBalanceAsOf: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                </Grid>
              </Grid>
            )}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description (optional)"
              value={newAccountForm.description}
              onChange={(e) => setNewAccountForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Add any notes or description for this account"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            {(newAccountForm.section || newAccountForm.accountType || newAccountForm.detailType) && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha(theme.palette.primary.main, 0.2)
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {newAccountForm.section === 'Income' || newAccountForm.section === 'Expense' ? 'Profit & Loss' : 'Balance Sheet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Active accounts as of {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {newAccountForm.section && (
                    <Chip label={newAccountForm.section} size="small" color="default" variant="outlined" />
                  )}
                  {newAccountForm.accountType && (
                    <Chip label={newAccountForm.accountType} size="small" color="primary" variant="outlined" />
                  )}
                  {newAccountForm.detailType && (
                    <Chip label={newAccountForm.detailType} size="small" color="success" variant="outlined" />
                  )}
                </Box>
                <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                  {newAccountForm.accountType && newAccountForm.detailType
                    ? `New account will appear under ${newAccountForm.accountType} → ${newAccountForm.detailType}`
                    : newAccountForm.accountType
                    ? 'Select a detail type to complete'
                    : newAccountForm.section
                    ? 'Select an account type to continue'
                    : ''}
                </Typography>
              </Paper>
            )}
            </Stack>
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2.5, gap: 1.5, bgcolor: 'grey.50' }}>
          <Button onClick={closeNewAccountDialog} size="medium">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateAccount}
            disabled={submitting}
            size="medium"
            startIcon={submitting ? null : <CheckIcon />}
            sx={{ minWidth: 120 }}
          >
            {submitting ? 'Saving...' : 'Create account'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Delete account?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {accountToDelete
              ? `This will remove ${accountToDelete.accountNumber ? `${accountToDelete.accountNumber} — ` : ''}${accountToDelete.name || 'this account'} from the chart of accounts.`
              : 'This will remove the account from the chart of accounts.'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Accounts with a balance, journal entries, or active subaccounts cannot be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDeleteDialog} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteAccount}
            disabled={deleting}
            startIcon={<DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChartOfAccounts;
