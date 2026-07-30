import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, Checkbox, CircularProgress, Alert,
  Tooltip, Stack, Card, CardContent, Grid, TextField, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TablePagination
} from '@mui/material';
import { AccountBalance as BankIcon, CheckCircle as ReconcileIcon } from '@mui/icons-material';
import api from '../../services/api';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import { useFinanceCompanyReload } from '../../hooks/useFinanceCompanyReload';
import { fetchPayFromAccounts } from '../../utils/payFromAccounts';
import { formatDate } from '../../utils/dateUtils';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const clearedAtToYmd = (raw) => {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

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

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [clearanceDialog, setClearanceDialog] = useState({
    open: false,
    transaction: null,
    status: 'pending',
    clearedAtDate: ''
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

  const openClearanceDialog = (txn) => {
    const isCleared = txn?.clearanceStatus === 'cleared' || txn?.isReconciled;
    setClearanceDialog({
      open: true,
      transaction: txn,
      status: isCleared ? 'cleared' : (txn?.clearanceStatus || 'pending'),
      clearedAtDate: isCleared && txn?.clearedAt ? clearedAtToYmd(txn.clearedAt) : new Date().toISOString().split('T')[0]
    });
  };

  const closeClearanceDialog = () => {
    setClearanceDialog({ open: false, transaction: null, status: 'pending', clearedAtDate: '' });
  };

  const saveClearance = async () => {
    if (!clearanceDialog.transaction?._id) return;
    const txn = clearanceDialog.transaction;
    const rawId = String(txn._id);
    const jeId = rawId.split('-')[0]; // Extract MongoDB ObjectId if ID is composite (e.g. jeId-accId)
    const journalEntryId = txn.journalEntryId ? String(txn.journalEntryId) : null;
    const nextStatus = clearanceDialog.status || 'pending';
    let clearedAt = null;

    if (nextStatus === 'cleared') {
      const ymd = (clearanceDialog.clearedAtDate || '').trim();
      if (!ymd) {
        window.alert('Please select a clearance date using the calendar.');
        return;
      }
      clearedAt = new Date(`${ymd}T12:00:00.000Z`).toISOString();
    }

    try {
      const idsToUpdate = Array.from(new Set([rawId, jeId, journalEntryId].filter(Boolean)));
      
      // Update via bank reconciliation endpoint
      await api.post('/finance/reports/bank-reconciliation/reconcile', {
        transactionIds: idsToUpdate,
        clearanceStatus: nextStatus,
        clearedAt
      });

      // Also attempt journal entry endpoint update if journalEntryId exists
      const targetJeId = journalEntryId || (/^[0-9a-fA-F]{24}$/.test(jeId) ? jeId : null);
      if (targetJeId) {
        try {
          await api.put(`/finance/journal-entries/${targetJeId}/clearance`, {
            clearanceStatus: nextStatus,
            clearanceRemarks: '',
            clearedAt
          });
        } catch (_) {
          // ignore if not a standard JE
        }
      }

      setSuccess('Clearance status updated successfully');
      closeClearanceDialog();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update clearance');
    }
  };

  const allTransactions = data?.transactions || [];

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
            Bank Transactions ({allTransactions.length})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell padding="checkbox"><Checkbox checked={selected.length === allTransactions.length && allTransactions.length > 0} onChange={e => setSelected(e.target.checked ? allTransactions.map(t => t._id || t.id) : [])} /></TableCell>
                  <TableCell><b>Date</b></TableCell>
                  <TableCell><b>Voucher No</b></TableCell>
                  <TableCell><b>Description</b></TableCell>
                  <TableCell><b>Reference</b></TableCell>
                  <TableCell><b>Type</b></TableCell>
                  <TableCell align="right"><b>Amount (PKR)</b></TableCell>
                  <TableCell><b>Clearance Status</b></TableCell>
                  <TableCell><b>Clearing Date</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allTransactions.length === 0 && (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 4 }}>No bank transactions found.</TableCell></TableRow>
                )}
                {allTransactions
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((t, idx) => {
                    const id = t._id || t.id || idx;
                    const txnDate = t.date || t.transactionDate;
                    const txnType = t.type || t.transactionType || 'debit';
                    return (
                      <TableRow key={id} hover>
                        <TableCell padding="checkbox"><Checkbox checked={selected.includes(id)} onChange={() => toggleSelect(id)} /></TableCell>
                        <TableCell>{txnDate ? formatDate(txnDate) : '—'}</TableCell>
                        <TableCell>{t.voucherNo || t.entryNumber || '—'}</TableCell>
                        <TableCell>{t.description || '—'}</TableCell>
                        <TableCell>{t.reference || '—'}</TableCell>
                        <TableCell><Chip label={txnType} color={txnType === 'credit' || txnType === 'deposit' ? 'success' : 'error'} size="small" /></TableCell>
                        <TableCell align="right">{fmt(t.amount)}</TableCell>
                        <TableCell>
                          <Tooltip title="Update clearance status">
                            <Chip
                              size="small"
                              label={t.clearanceStatus === 'cleared' || t.isReconciled ? 'Cleared' : 'Pending'}
                              color={t.clearanceStatus === 'cleared' || t.isReconciled ? 'success' : 'warning'}
                              variant={t.clearanceStatus === 'cleared' || t.isReconciled ? 'filled' : 'outlined'}
                              onClick={() => openClearanceDialog(t)}
                              sx={{ cursor: 'pointer' }}
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {(t.clearanceStatus === 'cleared' || t.isReconciled)
                            ? formatDate(t.clearedAt || t.reconciledDate || t.reconciledAt || t.date)
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
              component="div"
              count={allTransactions.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </TableContainer>
        </>
      )}

      {/* Clearance Dialog */}
      <Dialog
        open={clearanceDialog.open}
        onClose={closeClearanceDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Clearance — {clearanceDialog.transaction?.reference || 'Transaction'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                size="small"
                label="Clearance Status"
                value={clearanceDialog.status}
                onChange={(e) => {
                  const v = e.target.value;
                  setClearanceDialog((d) => ({
                    ...d,
                    status: v,
                    clearedAtDate: v === 'pending' ? '' : (d.clearedAtDate || new Date().toISOString().split('T')[0])
                  }));
                }}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="cleared">Cleared</MenuItem>
              </TextField>
            </Grid>
            {clearanceDialog.status === 'cleared' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Clearance date"
                  value={clearanceDialog.clearedAtDate}
                  onChange={(e) => setClearanceDialog((d) => ({ ...d, clearedAtDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  helperText="Choose the actual clearance date."
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeClearanceDialog}>Cancel</Button>
          <Button variant="contained" onClick={saveClearance}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
