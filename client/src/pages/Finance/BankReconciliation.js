import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, Checkbox, CircularProgress, Alert,
  Tooltip, Stack, Card, CardContent, Grid, TextField, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { AccountBalance as BankIcon, CheckCircle as ReconcileIcon } from '@mui/icons-material';
import api from '../../services/api';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import { useFinanceCompanyReload } from '../../hooks/useFinanceCompanyReload';
import { fetchPayFromAccounts } from '../../utils/payFromAccounts';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BankReconciliation() {
  const { selectedCompanyId } = useFinanceCompany();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [filters, setFilters] = useState({
    asOfDate: new Date().toISOString().split('T')[0],
    bankAccountId: ''
  });

  const loadBankAccounts = useCallback(async () => {
    try {
      const res = await api.get('/finance/banking/accounts');
      let accountsList = res.data?.data?.accounts || res.data?.accounts || (Array.isArray(res.data?.data) ? res.data.data : []);
      if (!accountsList.length) {
        const coaList = await fetchPayFromAccounts(api, { companyId: selectedCompanyId });
        accountsList = coaList.map((item) => ({
          _id: item.account?._id || item._id,
          accountName: item.account?.name || item.name,
          accountNumber: item.account?.accountNumber || item.accountNumber,
          bankName: item.account?.category || item.account?.detailType || 'Bank Account'
        }));
      }
      setBankAccounts(accountsList);
    } catch (_) {
      setBankAccounts([]);
    }
  }, [selectedCompanyId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { asOfDate: filters.asOfDate };
      if (filters.bankAccountId) {
        params.accountId = filters.bankAccountId;
      }
      const res = await api.get('/finance/reports/bank-reconciliation', { params });
      const reportData = res.data?.data;
      setData(reportData);
      if (reportData?.bankAccounts && Array.isArray(reportData.bankAccounts) && reportData.bankAccounts.length > 0) {
        setBankAccounts(reportData.bankAccounts);
      }
      setSelected([]);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadBankAccounts();
    load();
  }, [loadBankAccounts, load]);

  useFinanceCompanyReload(() => {
    loadBankAccounts();
    load();
  }, { skipInitial: true });

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleReconcile = async () => {
    if (selected.length === 0) return;
    try {
      await api.post('/finance/reports/bank-reconciliation/reconcile', { transactionIds: selected });
      setSuccess(`${selected.length} transactions reconciled`);
      load();
    } catch (e) {
      setError(e.response?.data?.message || 'Reconciliation failed');
    }
  };

  const unreconciled = (data?.transactions || []).filter(t => !t.isReconciled);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
          <BankIcon color="primary" /> Bank Reconciliation
        </Typography>
        <FinanceCompanySelector size="small" />
      </Stack>

      {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      {/* Filter bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel>Bank Account</InputLabel>
            <Select
              label="Bank Account"
              value={filters.bankAccountId}
              onChange={(e) => setFilters((prev) => ({ ...prev, bankAccountId: e.target.value }))}
            >
              <MenuItem value=""><em>All Bank Accounts</em></MenuItem>
              {bankAccounts.map((acc) => (
                <MenuItem key={acc._id} value={acc._id}>
                  {acc.accountName || acc.bankName} ({acc.accountNumber || 'N/A'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="As of Date" type="date" size="small" sx={{ minWidth: 180 }}
            value={filters.asOfDate} onChange={e => setFilters({ ...filters, asOfDate: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="contained" onClick={load} disabled={loading}>
            {loading ? <CircularProgress size={18} /> : 'Load'}
          </Button>
          {selected.length > 0 && (
            <Button variant="contained" color="success" startIcon={<ReconcileIcon />} onClick={handleReconcile}>
              Reconcile ({selected.length})
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Summary cards */}
      {data && (
        <Grid container spacing={2} mb={3}>
          {[
            { label: 'GL Balance', value: fmt(data.glBalance), color: 'primary.main' },
            { label: 'Bank Statement Balance', value: fmt(data.bankStatementBalance), color: 'info.main' },
            { label: 'Difference', value: fmt(data.difference), color: Math.abs(data.difference) < 0.01 ? 'success.main' : 'error.main' },
            { label: 'Unreconciled Txns', value: data.unreconciledCount, color: 'warning.main' }
          ].map(c => (
            <Grid item xs={12} sm={6} md={3} key={c.label}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                  <Typography variant="h6" fontWeight={700} color={c.color}>
                    {typeof c.value === 'number' && c.label !== 'Unreconciled Txns' ? `PKR ${c.value}` : c.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {data && (
        <>
          <Typography variant="subtitle1" fontWeight={600} mb={1}>
            Unreconciled Transactions ({unreconciled.length})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell padding="checkbox"><Checkbox checked={selected.length === unreconciled.length && unreconciled.length > 0} onChange={e => setSelected(e.target.checked ? unreconciled.map(t => t._id || t.id) : [])} /></TableCell>
                  <TableCell><b>Date</b></TableCell>
                  <TableCell><b>Description</b></TableCell>
                  <TableCell><b>Reference</b></TableCell>
                  <TableCell><b>Type</b></TableCell>
                  <TableCell align="right"><b>Amount (PKR)</b></TableCell>
                  <TableCell><b>Status</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unreconciled.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'success.main', py: 4 }}>All transactions are reconciled!</TableCell></TableRow>
                )}
                {unreconciled.map((t, idx) => {
                  const id = t._id || t.id || idx;
                  const txnDate = t.date || t.transactionDate;
                  const txnType = t.type || t.transactionType || 'debit';
                  return (
                    <TableRow key={id} hover>
                      <TableCell padding="checkbox"><Checkbox checked={selected.includes(id)} onChange={() => toggleSelect(id)} /></TableCell>
                      <TableCell>{txnDate ? new Date(txnDate).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>{t.description || '—'}</TableCell>
                      <TableCell>{t.reference || '—'}</TableCell>
                      <TableCell><Chip label={txnType} color={txnType === 'credit' || txnType === 'deposit' ? 'success' : 'error'} size="small" /></TableCell>
                      <TableCell align="right">{fmt(t.amount)}</TableCell>
                      <TableCell><Chip label="Unreconciled" color="warning" size="small" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
