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
  Pagination,
  Snackbar,
  Checkbox,
  Stack
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  CheckCircle as ClearedIcon,
  ReceiptLong as VoucherIcon,
  Visibility as ViewIcon,
  Undo as UndoIcon,
  Save as SaveIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import { useFinanceCompanyReload } from '../../hooks/useFinanceCompanyReload';
import { fetchPayFromAccounts } from '../../utils/payFromAccounts';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';

const Banking = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { selectedCompanyId } = useFinanceCompany();
  
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companiesList, setCompaniesList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [bankingSetup, setBankingSetup] = useState({ paymentTypes: [], mainAccountHeads: [], subAccountHeads: [] });
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
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkValues, setBulkValues] = useState({
    paymentType: '',
    mainAccountHead: '',
    subAccountHead: '',
    companies: '',
    project: ''
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [compRes, projRes, setupRes] = await Promise.all([
          api.get('/hr/companies', { params: { limit: 1000 } }).catch(() => ({ data: { data: [] } })),
          api.get('/hr/projects', { params: { limit: 1000 } }).catch(() => ({ data: { data: [] } })),
          api.get('/finance/banking-setup').catch(() => ({ data: { data: {} } }))
        ]);
        const rawComps = compRes.data?.data?.companies || compRes.data?.data || [];
        const rawProjs = projRes.data?.data?.projects || projRes.data?.data || [];
        setCompaniesList(Array.isArray(rawComps) ? rawComps : []);
        setProjectsList(Array.isArray(rawProjs) ? rawProjs : []);
        if (setupRes.data?.success && setupRes.data?.data) {
          setBankingSetup({
            paymentTypes: setupRes.data.data.paymentTypes || [],
            mainAccountHeads: setupRes.data.data.mainAccountHeads || [],
            subAccountHeads: setupRes.data.data.subAccountHeads || []
          });
        }

      } catch (e) {
        console.error(e);
      }
    };
    fetchOptions();
  }, []);

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
      // Fetch COA accounts (Asset bank/cash accounts & sub-accounts) for selected company
      const coaList = await fetchPayFromAccounts(api, { companyId: selectedCompanyId });
      let accountsList = (coaList || []).map((item) => ({
        _id: item.account?._id || item._id,
        accountName: item.account?.name || item.name,
        accountNumber: item.account?.accountNumber || item.accountNumber,
        bankName: item.account?.category || item.account?.detailType || 'Bank Account',
        depth: item.depth || 0
      }));

      // If empty, fallback to broad bank/cash search
      if (!accountsList.length) {
        const res = await api.get('/finance/accounts', {
          params: {
            type: 'Asset',
            limit: 500,
            ...(selectedCompanyId && selectedCompanyId !== 'all' ? { companyId: selectedCompanyId } : {})
          }
        });
        const list = res.data?.data?.accounts || res.data?.accounts || [];
        accountsList = list
          .filter(a => a.category?.match(/cash|bank|current/i) || a.detailType?.match(/cash|bank/i) || a.accountCode === 'BANK' || a.accountCode === 'CASH')
          .map(a => ({
            _id: a._id,
            accountName: a.name,
            accountNumber: a.accountNumber,
            bankName: a.category || a.detailType || 'Bank Account',
            depth: 0
          }));
      }

      // Filter out 'Cash' accounts, keeping only true bank accounts
      const filteredAccounts = accountsList.filter((a) => {
        const nameLower = String(a.accountName || '').toLowerCase();
        return !nameLower.includes('cash');
      });

      setBankAccounts(filteredAccounts);

      setFilters((prev) => {
        // If the currently selected accountId is no longer in the list (and not empty 'all'), keep current selection or clear
        if (prev.accountId && !filteredAccounts.find(a => a._id === prev.accountId)) {
          return { ...prev, accountId: '' };
        }
        return prev;
      });
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
        setSelectedIds(new Set());
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

  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  const [importModal, setImportModal] = useState({
    open: false,
    file: null,
    loading: false,
    error: '',
    result: null
  });

  const handleImportVoucherDates = async () => {
    if (!importModal.file) {
      setImportModal(prev => ({ ...prev, error: 'Please select an Excel (.xlsx) or CSV file to import.' }));
      return;
    }
    setImportModal(prev => ({ ...prev, loading: true, error: '', result: null }));
    try {
      const formData = new FormData();
      formData.append('file', importModal.file);

      const res = await api.post('/finance/banking/import-voucher-dates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        setImportModal(prev => ({
          ...prev,
          loading: false,
          result: res.data.data
        }));
        setToast({ open: true, message: res.data.message || 'Voucher dates updated successfully!', severity: 'success' });
        fetchTransactions();
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportModal(prev => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || 'Failed to import voucher dates.'
      }));
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

  const rowId = (t, idx = 0) => String(t?._id || t?.journalEntryId || `row-${idx}`);

  const handleSaveRow = async (t, { silent = false } = {}) => {
    if (!t.journalEntryId) {
      if (!silent) {
        setToast({ open: true, message: 'Cannot save: No linked Journal Entry found.', severity: 'error' });
      }
      return false;
    }
    try {
      const payload = {
        journalEntryId: t.journalEntryId,
        customPaymentType: t.paymentType,
        customMainAccountHead: t.mainAccountHead,
        customSubAccountHead: t.subAccountHead,
        customCompany: t.companies,
        customProject: t.project
      };

      const res = await api.put(`/finance/banking/transactions/${t.journalEntryId}/custom-meta`, payload);
      if (res.data.success) {
        if (!silent) {
          setToast({ open: true, message: 'Row saved successfully!', severity: 'success' });
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save row custom meta:', err);
      if (!silent) {
        setToast({ open: true, message: err.response?.data?.message || 'Failed to save changes.', severity: 'error' });
      }
      return false;
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (transactions.length && prev.size === transactions.length) return new Set();
      return new Set(transactions.map((t, i) => rowId(t, i)));
    });
  };

  const updateRowField = (id, field, value) => {
    setTransactions((prev) =>
      prev.map((item, i) => (rowId(item, i) === id ? { ...item, [field]: value } : item))
    );
  };

  /** When rows are selected, changing a dropdown on one selected row applies to all selected. */
  const handleEditableChange = (t, idx, field, value) => {
    const id = rowId(t, idx);
    if (selectedIds.size > 1 && selectedIds.has(id)) {
      setTransactions((prev) =>
        prev.map((item, i) => (selectedIds.has(rowId(item, i)) ? { ...item, [field]: value } : item))
      );
      return;
    }
    updateRowField(id, field, value);
  };

  const applyBulkValuesToSelected = (rows) => {
    const patch = {};
    if (bulkValues.paymentType !== '') patch.paymentType = bulkValues.paymentType;
    if (bulkValues.mainAccountHead !== '') patch.mainAccountHead = bulkValues.mainAccountHead;
    if (bulkValues.subAccountHead !== '') patch.subAccountHead = bulkValues.subAccountHead;
    if (bulkValues.companies !== '') patch.companies = bulkValues.companies;
    if (bulkValues.project !== '') patch.project = bulkValues.project;
    if (!Object.keys(patch).length) return rows;
    return rows.map((t, i) =>
      selectedIds.has(rowId(t, i)) ? { ...t, ...patch } : t
    );
  };

  const handleUpdateSelected = async () => {
    if (!selectedIds.size) {
      setToast({ open: true, message: 'Select at least one row to update.', severity: 'warning' });
      return;
    }

    const nextRows = applyBulkValuesToSelected(transactions);
    if (nextRows !== transactions) {
      setTransactions(nextRows);
    }

    const toSave = nextRows.filter((t, i) => selectedIds.has(rowId(t, i)));
    setBulkSaving(true);
    let ok = 0;
    let fail = 0;
    for (const t of toSave) {
      const saved = await handleSaveRow(t, { silent: true });
      if (saved) ok += 1;
      else fail += 1;
    }
    setBulkSaving(false);
    setSelectedIds(new Set());
    if (ok && !fail) {
      setToast({ open: true, message: `Updated ${ok} selected row${ok === 1 ? '' : 's'}.`, severity: 'success' });
    } else if (ok && fail) {
      setToast({ open: true, message: `Updated ${ok}; ${fail} failed.`, severity: 'warning' });
    } else {
      setToast({ open: true, message: 'Could not update the selected rows.', severity: 'error' });
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** Always quote CSV cells so commas/newlines in dates/narration cannot shift columns. */
  const csvEscape = (value) => {
    const text = value == null ? '' : String(value);
    return `"${text.replace(/"/g, '""').replace(/\r\n/g, '\n').replace(/\r/g, '\n')}"`;
  };

  const csvDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const exportBankingCsv = () => {
    if (!transactions.length) {
      setToast({ open: true, message: 'No rows to export.', severity: 'warning' });
      return;
    }

    const headers = [
      'V Date',
      'V No',
      'Narration',
      'Inst No',
      'AMOUNT',
      'DR/CR',
      'Clearing Date',
      'BANK',
      'Payment Type',
      'MAIN ACCOUNT HEADS',
      'SUB ACCOUNT HEAD',
      'COMPANIES',
      'PROJECT'
    ];

    const lines = [
      headers.map(csvEscape).join(','),
      ...transactions.map((t) => {
        const amount = t.drCr === 'Cr' ? -Number(t.amount || 0) : Number(t.amount || 0);
        return [
          csvDate(t.vDate),
          t.vNo || '',
          t.narration || '',
          t.instNo && t.instNo !== '—' ? t.instNo : '',
          amount.toFixed(2),
          t.drCr || '',
          csvDate(t.clearingDate),
          t.bank || '',
          t.paymentType || '',
          t.mainAccountHead || '',
          t.subAccountHead || '',
          t.companies || '',
          t.project || ''
        ].map(csvEscape).join(',');
      })
    ];

    // BOM helps Excel open UTF-8 correctly
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reconciled_Banking_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
            <FinanceCompanySelector showHelper={false} minWidth={220} allowAll={true} />
            <Button
              variant="contained"
              color="primary"
              startIcon={<UploadIcon />}
              onClick={() => setImportModal(prev => ({ ...prev, open: true, file: null, result: null, error: '' }))}
            >
              Import Voucher Dates
            </Button>
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
              onClick={exportBankingCsv}
              disabled={!transactions.length}
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
                  <MenuItem value="">
                    <em>All Bank Accounts</em>
                  </MenuItem>
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

          {!loading && transactions.length > 0 && (
            <Paper
              variant="outlined"
              sx={{
                mb: 2,
                px: 2,
                py: 1.5,
                bgcolor: selectedIds.size ? 'primary.50' : 'grey.50'
              }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'stretch', md: 'center' }}
                  justifyContent="space-between"
                >
                  <Typography variant="body2" fontWeight={600}>
                    {selectedIds.size
                      ? `${selectedIds.size} selected — set columns below (optional) or edit any selected row, then Update Selected`
                      : 'Select rows, set Payment Type / Heads / Company / Project, then Update Selected'}
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={bulkSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    disabled={!selectedIds.size || bulkSaving}
                    onClick={handleUpdateSelected}
                    sx={{ whiteSpace: 'nowrap', alignSelf: { xs: 'stretch', md: 'center' } }}
                  >
                    Update Selected{selectedIds.size ? ` (${selectedIds.size})` : ''}
                  </Button>
                </Stack>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment Type</InputLabel>
                      <Select
                        label="Payment Type"
                        value={bulkValues.paymentType}
                        onChange={(e) => setBulkValues((p) => ({ ...p, paymentType: e.target.value }))}
                      >
                        <MenuItem value=""><em>Keep current</em></MenuItem>
                        {(bankingSetup.paymentTypes || []).map((pt, i) => (
                          <MenuItem key={i} value={pt}>{pt}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Main Account Head</InputLabel>
                      <Select
                        label="Main Account Head"
                        value={bulkValues.mainAccountHead}
                        onChange={(e) => setBulkValues((p) => ({ ...p, mainAccountHead: e.target.value }))}
                      >
                        <MenuItem value=""><em>Keep current</em></MenuItem>
                        {(bankingSetup.mainAccountHeads || []).map((mh, i) => (
                          <MenuItem key={i} value={mh}>{mh}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Sub Account Head</InputLabel>
                      <Select
                        label="Sub Account Head"
                        value={bulkValues.subAccountHead}
                        onChange={(e) => setBulkValues((p) => ({ ...p, subAccountHead: e.target.value }))}
                      >
                        <MenuItem value=""><em>Keep current</em></MenuItem>
                        {(bankingSetup.subAccountHeads || []).map((sh, i) => (
                          <MenuItem key={i} value={sh}>{sh}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Company</InputLabel>
                      <Select
                        label="Company"
                        value={bulkValues.companies}
                        onChange={(e) => setBulkValues((p) => ({ ...p, companies: e.target.value }))}
                      >
                        <MenuItem value=""><em>Keep current</em></MenuItem>
                        {(Array.isArray(companiesList) ? companiesList : []).map((c) => (
                          <MenuItem key={c._id || c.name} value={c.name}>{c.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Project</InputLabel>
                      <Select
                        label="Project"
                        value={bulkValues.project}
                        onChange={(e) => setBulkValues((p) => ({ ...p, project: e.target.value }))}
                      >
                        <MenuItem value=""><em>Keep current</em></MenuItem>
                        {(Array.isArray(projectsList) ? projectsList : []).map((p) => (
                          <MenuItem key={p._id || p.name} value={p.name}>{p.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Stack>
            </Paper>
          )}

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
                    <TableCell padding="checkbox" sx={{ bgcolor: 'grey.100' }}>
                      <Checkbox
                        size="small"
                        indeterminate={selectedIds.size > 0 && selectedIds.size < transactions.length}
                        checked={transactions.length > 0 && selectedIds.size === transactions.length}
                        onChange={toggleSelectAll}
                        disabled={!transactions.length || bulkSaving}
                      />
                    </TableCell>
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
                    const id = rowId(t, idx);
                    const isSelected = selectedIds.has(id);
                    return (
                      <TableRow
                        key={id}
                        hover
                        selected={isSelected}
                        sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(id)}
                            disabled={bulkSaving}
                          />
                        </TableCell>
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
                          <FormControl fullWidth size="small" variant="standard">
                            <Select
                              value={t.paymentType || ''}
                              onChange={(e) => handleEditableChange(t, idx, 'paymentType', e.target.value)}
                              displayEmpty
                              sx={{ fontSize: '0.8125rem' }}
                            >
                              <MenuItem value=""><em>None</em></MenuItem>
                              {Array.from(new Set([
                                ...(bankingSetup.paymentTypes || []),
                                ...(t.paymentType ? [t.paymentType] : [])
                              ])).map((pt, i) => (
                                <MenuItem key={i} value={pt}>{pt}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        {/* Editable MAIN ACCOUNT HEADS */}
                        <TableCell sx={{ minWidth: 170 }}>
                          <FormControl fullWidth size="small" variant="standard">
                            <Select
                              value={t.mainAccountHead || ''}
                              onChange={(e) => handleEditableChange(t, idx, 'mainAccountHead', e.target.value)}
                              displayEmpty
                              sx={{ fontSize: '0.8125rem' }}
                            >
                              <MenuItem value=""><em>None</em></MenuItem>
                              {Array.from(new Set([
                                ...(bankingSetup.mainAccountHeads || []),
                                ...(t.mainAccountHead ? [t.mainAccountHead] : [])
                              ])).map((mh, i) => (
                                <MenuItem key={i} value={mh}>{mh}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        {/* Editable SUB ACCOUNT HEAD */}
                        <TableCell sx={{ minWidth: 170 }}>
                          <FormControl fullWidth size="small" variant="standard">
                            <Select
                              value={t.subAccountHead || ''}
                              onChange={(e) => handleEditableChange(t, idx, 'subAccountHead', e.target.value)}
                              displayEmpty
                              sx={{ fontSize: '0.8125rem', fontWeight: 500 }}
                            >
                              <MenuItem value=""><em>None</em></MenuItem>
                              {Array.from(new Set([
                                ...(bankingSetup.subAccountHeads || []),
                                ...(t.subAccountHead ? [t.subAccountHead] : [])
                              ])).map((sh, i) => (
                                <MenuItem key={i} value={sh}>{sh}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        {/* Editable COMPANIES */}
                        <TableCell sx={{ minWidth: 140 }}>
                          <FormControl fullWidth size="small" variant="standard">
                            <Select
                              value={t.companies || ''}
                              onChange={(e) => handleEditableChange(t, idx, 'companies', e.target.value)}
                              displayEmpty
                              sx={{ fontSize: '0.8125rem' }}
                            >
                              <MenuItem value=""><em>None</em></MenuItem>
                              {Array.from(new Set([
                                ...(Array.isArray(companiesList) ? companiesList : []).map(c => c?.name).filter(Boolean),
                                ...(t.companies ? [t.companies] : [])
                              ])).map((cName, cIdx) => (
                                <MenuItem key={cIdx} value={cName}>{cName}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        {/* Editable PROJECT */}
                        <TableCell sx={{ minWidth: 140 }}>
                          <FormControl fullWidth size="small" variant="standard">
                            <Select
                              value={t.project || ''}
                              onChange={(e) => handleEditableChange(t, idx, 'project', e.target.value)}
                              displayEmpty
                              sx={{ fontSize: '0.8125rem' }}
                            >
                              <MenuItem value=""><em>None</em></MenuItem>
                              {Array.from(new Set([
                                ...(Array.isArray(projectsList) ? projectsList : []).map(p => p?.name).filter(Boolean),
                                ...(t.project ? [t.project] : [])
                              ])).map((pName, pIdx) => (
                                <MenuItem key={pIdx} value={pName}>{pName}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
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
                            <Tooltip title="Save Row Changes">
                              <IconButton
                                size="small"
                                color="success"
                                disabled={bulkSaving}
                                onClick={() => handleSaveRow(t)}
                              >
                                <SaveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={15} align="center" sx={{ py: 6 }}>
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

      {/* Import Voucher Dates Dialog */}
      <Dialog
        open={importModal.open}
        onClose={() => setImportModal(prev => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUploadIcon color="primary" /> Import & Update Voucher Dates
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            Upload an Excel (<code>.xlsx</code>) or CSV file. Rows will be strictly matched by <strong>Voucher Number</strong> (e.g. <code>BPV-1001</code>, <code>CPV-502</code>, or <code>JV-204</code>) and their dates will be updated in both Journal Entries and General Ledger.
          </Alert>

          {importModal.error && (
            <Alert severity="error" onClose={() => setImportModal(prev => ({ ...prev, error: '' }))} sx={{ mb: 2 }}>
              {importModal.error}
            </Alert>
          )}

          {!importModal.result ? (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box
                sx={{
                  border: `2px dashed ${theme.palette.divider}`,
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.03),
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
                }}
                component="label"
              >
                <input
                  type="file"
                  hidden
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImportModal(prev => ({ ...prev, file, error: '' }));
                    }
                  }}
                />
                <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" fontWeight={600}>
                  {importModal.file ? importModal.file.name : 'Click to select Excel (.xlsx / .csv) file'}
                </Typography>
                {importModal.file && (
                  <Typography variant="caption" color="textSecondary" display="block">
                    Size: {(importModal.file.size / 1024).toFixed(1)} KB
                  </Typography>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ mt: 1 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                Import Completed! Updated <strong>{importModal.result.updatedCount || 0}</strong> existing voucher date(s) & Created <strong>{importModal.result.createdCount || 0}</strong> missing voucher(s).
              </Alert>

              {importModal.result.created?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="success.main" mb={1}>
                    Newly Created Vouchers ({importModal.result.created.length}):
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: theme.palette.action.hover }}>
                        <TableRow>
                          <TableCell>Voucher No</TableCell>
                          <TableCell>System Entry No</TableCell>
                          <TableCell>Voucher Date</TableCell>
                          <TableCell>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {importModal.result.created.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell><Chip label={item.vNo} size="small" color="success" variant="outlined" /></TableCell>
                            <TableCell><strong>{item.entryNumber}</strong></TableCell>
                            <TableCell>{item.date ? formatDate(item.date) : '—'}</TableCell>
                            <TableCell><Chip label="Created" size="small" color="success" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {importModal.result.updated?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                    Updated Date Vouchers ({importModal.result.updated.length}):
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: theme.palette.action.hover }}>
                        <TableRow>
                          <TableCell>Voucher No</TableCell>
                          <TableCell>Previous Date</TableCell>
                          <TableCell>New Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {importModal.result.updated.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell><Chip label={item.vNo} size="small" color="primary" variant="outlined" /></TableCell>
                            <TableCell>{item.oldDate ? formatDate(item.oldDate) : '—'}</TableCell>
                            <TableCell><strong>{item.newDate ? formatDate(item.newDate) : '—'}</strong></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {importModal.result.skipped?.length > 0 && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold" color="error.main" mb={1}>
                    Skipped Rows ({importModal.result.skipped.length}):
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: theme.palette.action.hover }}>
                        <TableRow>
                          <TableCell>Row #</TableCell>
                          <TableCell>Voucher No</TableCell>
                          <TableCell>Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {importModal.result.skipped.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{item.rowNumber}</TableCell>
                            <TableCell>{item.vNo || '—'}</TableCell>
                            <TableCell><Typography variant="body2" color="error">{item.reason}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportModal(prev => ({ ...prev, open: false }))}>
            {importModal.result ? 'Close' : 'Cancel'}
          </Button>
          {!importModal.result && (
            <Button
              variant="contained"
              disabled={importModal.loading || !importModal.file}
              onClick={handleImportVoucherDates}
              startIcon={importModal.loading ? <CircularProgress size={18} /> : <UploadIcon />}
            >
              {importModal.loading ? 'Updating Dates...' : 'Upload & Match'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Banking;

