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
  Pagination
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  CheckCircle as ClearedIcon,
  ReceiptLong as VoucherIcon,
  Visibility as ViewIcon,
  Undo as UndoIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';
import { useFinanceCompanyReload } from '../../hooks/useFinanceCompanyReload';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';

const Banking = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    accountId: '',
    startDate: '',
    endDate: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 50
  });
  const [summary, setSummary] = useState({
    totalCount: 0,
    totalDr: 0,
    totalCr: 0,
    netBalance: 0,
    netBalanceType: 'Dr'
  });

  useEffect(() => {
    fetchBankAccounts();
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters/page change only
  }, [filters, pagination.currentPage]);

  useFinanceCompanyReload(() => {
    fetchBankAccounts();
    fetchTransactions();
  }, { skipInitial: true });

  const fetchBankAccounts = async () => {
    try {
      const response = await api.get('/finance/reports/bank-reconciliation');
      if (response.data.success) {
        setBankAccounts(response.data.data.bankAccounts || []);
      }
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.accountId) params.append('accountId', filters.accountId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.search) params.append('search', filters.search);
      params.append('page', pagination.currentPage);
      params.append('limit', pagination.limit);

      const response = await api.get(`/finance/banking/transactions?${params}`);
      if (response.data.success) {
        setTransactions(response.data.data.transactions || []);
        setSummary(response.data.data.summary || summary);
        setPagination(prev => ({
          ...prev,
          ...response.data.data.pagination
        }));
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to fetch reconciled banking transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field) => (event) => {
    setFilters(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (event, page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleUpdateCustomMeta = async (t, field, value) => {
    if (!t.journalEntryId) return;
    try {
      setTransactions(prev => prev.map(item => {
        if (item._id === t._id) {
          return { ...item, [field]: value };
        }
        return item;
      }));

      const payload = {
        journalEntryId: t.journalEntryId,
        customPaymentType: field === 'paymentType' ? value : t.paymentType,
        customMainAccountHead: field === 'mainAccountHead' ? value : t.mainAccountHead,
        customSubAccountHead: field === 'subAccountHead' ? value : t.subAccountHead,
        customCompany: field === 'companies' ? value : t.companies,
        customProject: field === 'project' ? value : t.project
      };

      await api.put(`/finance/banking/transactions/${t.journalEntryId}/custom-meta`, payload);
    } catch (err) {
      console.error('Failed to update custom meta:', err);
    }
  };

  const handleRevertTransaction = async (t) => {
    if (!t._id) return;
    const confirmMsg = `Are you sure you want to revert voucher ${t.vNo || ''} (Amount: PKR ${fmt(t.amount)}) back to Bank Reconciliation?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      await api.post('/finance/reports/bank-reconciliation/reconcile', {
        transactionIds: [String(t._id)],
        clearanceStatus: 'pending',
        clearedAt: null
      });
      await fetchTransactions();
    } catch (err) {
      console.error('Failed to revert transaction:', err);
      setError(err.response?.data?.message || 'Failed to revert transaction back to Bank Reconciliation');
      setLoading(false);
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.info.main }}>
              <AccountBalanceIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                Banking
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Reconciled bank book & cleared accounting transactions
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FinanceCompanySelector showHelper={false} minWidth={220} />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => { fetchBankAccounts(); fetchTransactions(); }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => {
                // Export table data to CSV
                if (!transactions.length) return;
                const headers = ['V Date', 'V No', 'Narration', 'Inst No', 'AMOUNT', 'DR/CR', 'Clearing Date', 'BANK', 'Payment Type', 'MAIN ACCOUNT HEADS', 'SUB ACCOUNT HEAD', 'COMPANIES', 'PROJECT'];
                const rows = transactions.map(t => [
                  t.vDate ? formatDate(t.vDate) : '',
                  `"${(t.vNo || '').replace(/"/g, '""')}"`,
                  `"${(t.narration || '').replace(/"/g, '""')}"`,
                  `"${(t.instNo || '').replace(/"/g, '""')}"`,
                  t.drCr === 'Cr' ? -t.amount : t.amount,
                  t.drCr,
                  t.clearingDate ? formatDate(t.clearingDate) : '',
                  `"${(t.bank || '').replace(/"/g, '""')}"`,
                  `"${(t.paymentType || '').replace(/"/g, '""')}"`,
                  `"${(t.mainAccountHead || '').replace(/"/g, '""')}"`,
                  `"${(t.subAccountHead || '').replace(/"/g, '""')}"`,
                  `"${(t.companies || '').replace(/"/g, '""')}"`,
                  `"${(t.project || '').replace(/"/g, '""')}"`
                ]);
                const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `Reconciled_Banking_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              Export CSV
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2" fontWeight={600}>
                Total Reconciled Records
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'info.main' }}>
                {summary.totalCount}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Cleared from Bank Reconciliation
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2" fontWeight={600}>
                Total Debits (Dr / Inflows)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'success.main' }}>
                {formatPKR(summary.totalDr)}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Cleared incoming receipts
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2" fontWeight={600}>
                Total Credits (Cr / Outflows)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'error.main' }}>
                {formatPKR(summary.totalCr)}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Cleared payments & charges
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2" fontWeight={600}>
                Net Cleared Balance
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: summary.netBalanceType === 'Dr' ? 'primary.main' : 'error.main' }}>
                {formatPKR(summary.netBalance)}{' '}
                <Typography component="span" variant="caption" fontWeight={800} color={summary.netBalanceType === 'Cr' ? 'error.main' : 'success.main'}>
                  {summary.netBalanceType}.
                </Typography>
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Reconciled ledger net balance
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Transactions Sheet */}
      <Card variant="outlined">
        <CardContent sx={{ p: 2 }}>
          {/* Filters */}
          <Grid container spacing={2} sx={{ mb: 2.5 }} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter Bank</InputLabel>
                <Select
                  value={filters.accountId}
                  onChange={handleFilterChange('accountId')}
                  label="Filter Bank"
                >
                  <MenuItem value="">All Banks</MenuItem>
                  {bankAccounts.map((account) => (
                    <MenuItem key={account._id} value={account._id}>
                      {account.accountName} {account.accountNumber ? `(${account.accountNumber})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="date"
                label="From Date"
                value={filters.startDate}
                onChange={handleFilterChange('startDate')}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                type="date"
                label="To Date"
                value={filters.endDate}
                onChange={handleFilterChange('endDate')}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                label="Search (Voucher, Narration, Instrument No, Bank, Head, Company, Project)"
                value={filters.search}
                onChange={handleFilterChange('search')}
                placeholder="Search anything..."
                size="small"
                InputProps={{
                  startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
          </Grid>

          {loading ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">Loading reconciled banking transactions...</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '72vh' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap', bgcolor: 'grey.100' }}>V Date</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap', bgcolor: 'grey.100' }}>V No</TableCell>
                    <TableCell sx={{ fontWeight: 800, minWidth: 260, bgcolor: 'grey.100' }}>Narration</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap', bgcolor: 'grey.100' }}>Inst No</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: 'nowrap', bgcolor: 'grey.100' }}>AMOUNT</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, whiteSpace: 'nowrap', bgcolor: 'grey.100' }}>DR/CR</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, whiteSpace: 'nowrap', bgcolor: 'grey.100' }}>Clearing Date</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap', bgcolor: 'grey.100' }}>BANK</TableCell>
                    <TableCell sx={{ fontWeight: 800, minWidth: 140, bgcolor: 'grey.100' }}>Payment Type</TableCell>
                    <TableCell sx={{ fontWeight: 800, minWidth: 170, bgcolor: 'grey.100' }}>MAIN ACCOUNT HEADS</TableCell>
                    <TableCell sx={{ fontWeight: 800, minWidth: 170, bgcolor: 'grey.100' }}>SUB ACCOUNT HEAD</TableCell>
                    <TableCell sx={{ fontWeight: 800, minWidth: 140, bgcolor: 'grey.100' }}>COMPANIES</TableCell>
                    <TableCell sx={{ fontWeight: 800, minWidth: 140, bgcolor: 'grey.100' }}>PROJECT</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, whiteSpace: 'nowrap', bgcolor: 'grey.100' }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((t, idx) => {
                    const isCredit = t.drCr === 'Cr';
                    return (
                      <TableRow key={t._id || idx} hover sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                          {formatDate(t.vDate)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                          {t.vNo}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8125rem' }}>
                          {t.narration}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', fontFamily: 'monospace' }}>
                          {t.instNo && t.instNo !== '—' ? (
                            <Chip size="small" variant="outlined" label={t.instNo} sx={{ fontSize: '0.75rem', height: 20 }} />
                          ) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.8125rem' }}>
                          {isCredit ? `-${fmt(t.amount)}` : fmt(t.amount)}
                        </TableCell>
                        <TableCell align="center">
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{
                              fontWeight: 800,
                              px: 0.75,
                              py: 0.25,
                              borderRadius: 0.5,
                              bgcolor: isCredit ? 'error.lighter' : 'success.lighter',
                              color: isCredit ? 'error.main' : 'success.main'
                            }}
                          >
                            {t.drCr}.
                          </Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', color: 'success.dark', fontWeight: 600 }}>
                          {t.clearingDate ? formatDate(t.clearingDate) : '—'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.8125rem' }}>
                          {t.bank}
                        </TableCell>
                        {/* Editable Payment Type */}
                        <TableCell sx={{ minWidth: 140 }}>
                          <TextField
                            size="small"
                            variant="standard"
                            fullWidth
                            value={t.paymentType || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransactions(prev => prev.map(item => item._id === t._id ? { ...item, paymentType: val } : item));
                            }}
                            onBlur={(e) => handleUpdateCustomMeta(t, 'paymentType', e.target.value)}
                            placeholder="e.g. BPV / Online"
                            inputProps={{ style: { fontSize: '0.8125rem' } }}
                          />
                        </TableCell>
                        {/* Editable MAIN ACCOUNT HEADS */}
                        <TableCell sx={{ minWidth: 170 }}>
                          <TextField
                            size="small"
                            variant="standard"
                            fullWidth
                            value={t.mainAccountHead || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransactions(prev => prev.map(item => item._id === t._id ? { ...item, mainAccountHead: val } : item));
                            }}
                            onBlur={(e) => handleUpdateCustomMeta(t, 'mainAccountHead', e.target.value)}
                            placeholder="Main Head"
                            inputProps={{ style: { fontSize: '0.8125rem' } }}
                          />
                        </TableCell>
                        {/* Editable SUB ACCOUNT HEAD */}
                        <TableCell sx={{ minWidth: 170 }}>
                          <TextField
                            size="small"
                            variant="standard"
                            fullWidth
                            value={t.subAccountHead || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransactions(prev => prev.map(item => item._id === t._id ? { ...item, subAccountHead: val } : item));
                            }}
                            onBlur={(e) => handleUpdateCustomMeta(t, 'subAccountHead', e.target.value)}
                            placeholder="Sub Head"
                            inputProps={{ style: { fontSize: '0.8125rem', fontWeight: 500 } }}
                          />
                        </TableCell>
                        {/* Editable COMPANIES */}
                        <TableCell sx={{ minWidth: 140 }}>
                          <TextField
                            size="small"
                            variant="standard"
                            fullWidth
                            value={t.companies || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransactions(prev => prev.map(item => item._id === t._id ? { ...item, companies: val } : item));
                            }}
                            onBlur={(e) => handleUpdateCustomMeta(t, 'companies', e.target.value)}
                            placeholder="Company"
                            inputProps={{ style: { fontSize: '0.8125rem' } }}
                          />
                        </TableCell>
                        {/* Editable PROJECT */}
                        <TableCell sx={{ minWidth: 140 }}>
                          <TextField
                            size="small"
                            variant="standard"
                            fullWidth
                            value={t.project || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTransactions(prev => prev.map(item => item._id === t._id ? { ...item, project: val } : item));
                            }}
                            onBlur={(e) => handleUpdateCustomMeta(t, 'project', e.target.value)}
                            placeholder="Project"
                            inputProps={{ style: { fontSize: '0.8125rem' } }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            {t.journalEntryId && (
                              <Tooltip title="View Linked Voucher">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => navigate(`/finance/vouchers/${t.journalEntryId}`)}
                                >
                                  <ViewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Revert to Bank Reconciliation (Mark Pending)">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => handleRevertTransaction(t)}
                              >
                                <UndoIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14} align="center" sx={{ py: 6 }}>
                        <Box sx={{ color: 'text.disabled', textAlign: 'center' }}>
                          <ClearedIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                          <Typography variant="h6" color="text.secondary">
                            No Reconciled Banking Transactions Found
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            When cheques and payment vouchers are marked as Cleared with a Clearing Date in Bank Reconciliation, they will appear here automatically.
                          </Typography>
                          <Button
                            variant="outlined"
                            startIcon={<VoucherIcon />}
                            sx={{ mt: 2 }}
                            onClick={() => navigate('/finance/reports/bank-reconciliation')}
                          >
                            Go to Bank Reconciliation
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={pagination.totalPages}
                page={pagination.currentPage}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Banking;

