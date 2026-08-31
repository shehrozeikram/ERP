import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, CircularProgress, Alert,
  Tooltip, Stack, Card, CardContent, Grid, TextField, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, TablePagination, Divider, IconButton
} from '@mui/material';
import {
  AccountBalance as BankIcon,
  CheckCircle as ReconcileIcon,
  CalendarMonth as CalendarIcon,
  ReceiptLong as VoucherIcon,
  Search as SearchIcon,
  PictureAsPdf as PdfIcon,
  EditCalendar as EditDateIcon,
  AttachFile as AttachIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon,
  InsertDriveFile as FileIcon,
  Close as CloseIcon,
  Undo as UndoIcon
} from '@mui/icons-material';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import api from '../../services/api';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import { useFinanceCompanyReload } from '../../hooks/useFinanceCompanyReload';
import { fetchPayFromAccounts } from '../../utils/payFromAccounts';
import { formatDate } from '../../utils/dateUtils';

const fmt = (n) => Number(Math.abs(n || 0)).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SIGNATORY_OPTIONS = [
  { value: 'Sardar Tanveer Ilyas', label: 'Sardar Tanveer Ilyas' },
  { value: 'Sardar Umer Tanveer', label: 'Sardar Umer Tanveer' },
  { value: 'Hamza Tanveer', label: 'Hamza Tanveer' }
];

const baseUploadsUrl = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');

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
  const [bankAccounts, setBankAccounts] = useState([]);
  const [rowClearDates, setRowClearDates] = useState({});
  const [clearingLoading, setClearingLoading] = useState({});
  
  const [filters, setFilters] = useState({
    asOfDate: new Date().toISOString().split('T')[0],
    fromDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
    bankAccountId: ''
  });

  const [clearanceDialog, setClearanceDialog] = useState({
    open: false,
    transaction: null,
    status: 'pending',
    clearedAtDate: ''
  });

  const [attachDlg, setAttachDlg] = useState({ open: false, txn: null, uploading: false });
  const [attachError, setAttachError] = useState('');

  const openAttachDlg = (txn) => {
    setAttachError('');
    setAttachDlg({ open: true, txn, uploading: false });
  };

  const closeAttachDlg = () => {
    setAttachDlg({ open: false, txn: null, uploading: false });
    setAttachError('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !attachDlg.txn) return;
    const targetJeId = attachDlg.txn.journalEntryId || String(attachDlg.txn._id).split('-')[0];
    if (!targetJeId || !/^[0-9a-fA-F]{24}$/.test(targetJeId)) {
      setAttachError('Linked voucher not found for uploading attachment.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setAttachDlg((d) => ({ ...d, uploading: true }));
    setAttachError('');
    try {
      const res = await api.post(`/finance/journal-entries/${targetJeId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const updatedAttachments = res?.data?.data?.attachments || [];
      setAttachDlg((d) => ({
        ...d,
        txn: d.txn ? { ...d.txn, attachments: updatedAttachments } : null
      }));
      setSuccess('Attachment uploaded successfully');
      load();
    } catch (err) {
      setAttachError(err.response?.data?.message || 'Upload failed');
    } finally {
      setAttachDlg((d) => ({ ...d, uploading: false }));
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (filename) => {
    if (!attachDlg.txn) return;
    const targetJeId = attachDlg.txn.journalEntryId || String(attachDlg.txn._id).split('-')[0];
    if (!targetJeId || !/^[0-9a-fA-F]{24}$/.test(targetJeId)) return;
    try {
      const res = await api.delete(`/finance/journal-entries/${targetJeId}/attachments/${encodeURIComponent(filename)}`);
      const updatedAttachments = res?.data?.data?.attachments || [];
      setAttachDlg((d) => ({
        ...d,
        txn: d.txn ? { ...d.txn, attachments: updatedAttachments } : null
      }));
      setSuccess('Attachment deleted');
      load();
    } catch (err) {
      setAttachError(err.response?.data?.message || 'Delete failed');
    }
  };

  const saveSignedDocumentStatus = async (txn, nextStatus, signedBySignatory) => {
    const targetJeId = txn.journalEntryId || String(txn._id).split('-')[0];
    if (!targetJeId || !/^[0-9a-fA-F]{24}$/.test(targetJeId)) {
      setError('Linked voucher not found.');
      return;
    }
    try {
      const payload = { signedDocumentStatus: nextStatus };
      if (nextStatus === 'signed') {
        if (signedBySignatory !== undefined) {
          payload.signedBySignatory = signedBySignatory || null;
        }
      }
      await api.put(`/finance/journal-entries/${targetJeId}/signed-document`, payload);
      setSuccess(`Voucher marked as ${nextStatus === 'signed' ? 'signed' : 'not signed'}`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update signed document status');
    }
  };

  const loadBankAccounts = useCallback(async () => {
    try {
      // 1. Fetch COA accounts (Asset bank/cash accounts & sub-accounts) for selected company
      const coaList = await fetchPayFromAccounts(api, { companyId: selectedCompanyId });
      let accountsList = (coaList || []).map((item) => ({
        _id: item.account?._id || item._id,
        accountName: item.account?.name || item.name,
        accountNumber: item.account?.accountNumber || item.accountNumber,
        bankName: item.account?.category || item.account?.detailType || 'Bank Account',
        depth: item.depth || 0
      }));

      // 2. If empty, fallback to /finance/accounts with broad bank/cash search
      if (!accountsList.length) {
        const res = await api.get('/finance/accounts', {
          params: {
            type: 'Asset',
            limit: 500,
            ...(selectedCompanyId ? { companyId: selectedCompanyId } : {})
          }
        });
        const list = res.data?.data?.accounts || res.data?.accounts || [];
        accountsList = list.map((a) => ({
          _id: a._id,
          accountName: a.name,
          accountNumber: a.accountNumber,
          bankName: a.category || a.detailType || 'Bank Account',
          depth: 0
        }));
      }

      setBankAccounts(accountsList);
      if (accountsList.length > 0) {
        setFilters((prev) => {
          const exists = accountsList.some(a => String(a._id) === String(prev.bankAccountId));
          return {
            ...prev,
            bankAccountId: exists ? prev.bankAccountId : accountsList[0]._id
          };
        });
      } else {
        setFilters((prev) => ({ ...prev, bankAccountId: '' }));
      }
    } catch (_) {
      setBankAccounts([]);
    }
  }, [selectedCompanyId]);

  const load = useCallback(async () => {
    if (!filters.bankAccountId) return;
    setLoading(true);
    setError('');
    try {
      const params = {
        accountId: filters.bankAccountId,
        asOfDate: filters.asOfDate,
        fromDate: filters.fromDate,
        toDate: filters.toDate
      };
      const res = await api.get('/finance/reports/bank-reconciliation', { params });
      const reportData = res.data?.data;
      setData(reportData);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadBankAccounts();
  }, [loadBankAccounts, selectedCompanyId]);

  useEffect(() => {
    if (filters.bankAccountId) {
      load();
    }
  }, [filters.bankAccountId, filters.asOfDate, load]);

  useFinanceCompanyReload(() => {
    loadBankAccounts();
  }, { skipInitial: true });

  const openClearanceDialog = (txn) => {
    const isCleared = txn?.clearanceStatus === 'cleared';
    setClearanceDialog({
      open: true,
      transaction: txn,
      status: isCleared ? 'cleared' : (txn?.clearanceStatus || 'pending'),
      clearedAtDate: isCleared && txn?.clearingDate ? clearedAtToYmd(txn.clearingDate) : new Date().toISOString().split('T')[0]
    });
  };

  const closeClearanceDialog = () => {
    setClearanceDialog({ open: false, transaction: null, status: 'pending', clearedAtDate: '' });
  };

  const saveClearance = async () => {
    if (!clearanceDialog.transaction?._id) return;
    const txn = clearanceDialog.transaction;
    const rawId = String(txn._id);
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
      // Reconcile specifically this individual transaction row
      await api.post('/finance/reports/bank-reconciliation/reconcile', {
        transactionIds: [rawId],
        clearanceStatus: nextStatus,
        clearedAt
      });

      setSuccess('Clearance status updated successfully');
      closeClearanceDialog();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update clearance');
    }
  };

  const handleDirectClear = async (txn) => {
    if (!txn?._id) return;
    const rawId = String(txn._id);
    const targetJeId = txn.journalEntryId || rawId.split('-')[0];
    const selectedDate = rowClearDates[txn._id] ?? (txn.clearingDate ? clearedAtToYmd(txn.clearingDate) : (filters.asOfDate || new Date().toISOString().split('T')[0]));

    if (!selectedDate) {
      setError('Please provide a valid clearing date.');
      return;
    }

    const clearedAt = new Date(`${selectedDate}T12:00:00.000Z`).toISOString();
    setClearingLoading((prev) => ({ ...prev, [txn._id]: true }));
    setError('');

    try {
      const idsToSend = [rawId];
      if (targetJeId && targetJeId !== rawId && /^[0-9a-fA-F]{24}$/.test(targetJeId)) {
        idsToSend.push(targetJeId);
      }
      await api.post('/finance/reports/bank-reconciliation/reconcile', {
        transactionIds: idsToSend,
        clearanceStatus: 'cleared',
        clearedAt
      });
      setRowClearDates((prev) => ({ ...prev, [txn._id]: selectedDate }));
      setSuccess(`Voucher ${txn.vrNo || ''} marked as cleared and removed from unpresented cheques.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not clear transaction');
    } finally {
      setClearingLoading((prev) => ({ ...prev, [txn._id]: false }));
    }
  };

  const handleDirectUnclear = async (txn) => {
    if (!txn?._id) return;
    const rawId = String(txn._id);
    const targetJeId = txn.journalEntryId || rawId.split('-')[0];
    const existingDate = txn.clearingDate ? clearedAtToYmd(txn.clearingDate) : (rowClearDates[txn._id] || null);
    setClearingLoading((prev) => ({ ...prev, [txn._id]: true }));
    setError('');

    try {
      const idsToSend = [rawId];
      if (targetJeId && targetJeId !== rawId && /^[0-9a-fA-F]{24}$/.test(targetJeId)) {
        idsToSend.push(targetJeId);
      }
      await api.post('/finance/reports/bank-reconciliation/reconcile', {
        transactionIds: idsToSend,
        clearanceStatus: 'pending',
        clearedAt: existingDate ? new Date(`${existingDate}T12:00:00.000Z`).toISOString() : null
      });
      if (existingDate) {
        setRowClearDates((prev) => ({ ...prev, [txn._id]: existingDate }));
      }
      setSuccess(`Voucher ${txn.vrNo || ''} moved back to unpresented cheques.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not revert clearance');
    } finally {
      setClearingLoading((prev) => ({ ...prev, [txn._id]: false }));
    }
  };

  const selectedAccount = bankAccounts.find(a => a._id === filters.bankAccountId);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
            <BankIcon color="primary" /> Bank Reconciliation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Reconcile general ledger bank records against bank statements and unpresented cheques
          </Typography>
        </Box>
        <FinanceCompanySelector size="small" />
      </Stack>

      {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      {/* Main Filter & Parameters Bar */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Account Code / Bank Account</InputLabel>
              <Select
                label="Account Code / Bank Account"
                value={filters.bankAccountId}
                onChange={(e) => setFilters((prev) => ({ ...prev, bankAccountId: e.target.value }))}
              >
                {bankAccounts.map((acc) => {
                  const depth = acc.depth || 0;
                  return (
                    <MenuItem key={acc._id} value={acc._id} sx={{ pl: 2 + depth * 2.5 }}>
                      {depth > 0 && <span style={{ color: '#888', marginRight: 6 }}>↳</span>}
                      <b>{acc.accountNumber || '—'}</b> &nbsp;—&nbsp; {acc.accountName || acc.bankName}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="As of Date"
              type="date"
              size="small"
              value={filters.asOfDate}
              onChange={e => setFilters({ ...filters, asOfDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
              onClick={load}
              disabled={loading}
              sx={{ height: 40 }}
            >
              Generate Reconciliation
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Summary Table */}
      {data && (
        <Paper variant="outlined" sx={{ mb: 4, overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 700, width: '65%' }}>Narration / Description</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Amount (PKR)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow hover>
                  <TableCell sx={{ fontWeight: 600 }}>Balance as Per Bank Ledger</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: data.glBalanceType === 'Cr' ? 'error.main' : 'success.main' }}>
                    {data.glBalance < 0 ? `-${fmt(data.glBalance)}` : fmt(data.glBalance)}{' '}
                    <Typography component="span" fontWeight={800} color={data.glBalanceType === 'Cr' ? 'error.main' : 'success.main'}>
                      {data.glBalanceType}.
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow hover>
                  <TableCell sx={{ fontWeight: 600 }}>Difference (Unpresented / Uncleared Cheques)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: data.differenceType === 'Cr' ? 'error.main' : 'success.main' }}>
                    {data.difference < 0 ? `-${fmt(data.difference)}` : fmt(data.difference)}{' '}
                    <Typography component="span" fontWeight={800} color={data.differenceType === 'Cr' ? 'error.main' : 'success.main'}>
                      {data.differenceType}.
                    </Typography>
                  </TableCell>
                </TableRow>
                <TableRow sx={{ bgcolor: 'primary.50' }}>
                  <TableCell sx={{ fontWeight: 800, color: 'primary.dark' }}>Balance as Per Bank Statement</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: '1.05rem', color: data.bankStatementBalanceType === 'Cr' ? 'error.main' : 'success.main' }}>
                    {data.bankStatementBalance < 0 ? `-${fmt(data.bankStatementBalance)}` : fmt(data.bankStatementBalance)}{' '}
                    <Typography component="span" fontWeight={900} color={data.bankStatementBalanceType === 'Cr' ? 'error.main' : 'success.main'}>
                      {data.bankStatementBalanceType}.
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Upper Table: Unpresented / Uncleared Cheques & Payments */}
      {data && (
        <Box sx={{ mb: 5 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
            <Typography variant="h6" fontWeight={700}>
              Unpresented / Uncleared Cheques &amp; Payments ({(data.unpresentedTransactions || []).length})
            </Typography>
            <Chip
              label={`Total Difference: ${data.difference < 0 ? `-${fmt(data.difference)}` : fmt(data.difference)} ${data.differenceType}.`}
              color={data.differenceType === 'Cr' ? 'error' : 'success'}
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>VrNo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Narration</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Attachment</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 130 }}>Signed Document</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>Signed By</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Signed Date</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, minWidth: 155 }}>Clearing.Date</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, minWidth: 100 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.unpresentedTransactions || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No unpresented/uncleared cheques found up to {formatDate(filters.asOfDate)}.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {(data.unpresentedTransactions || []).map((t, idx) => {
                      const hasAttachment = (t.attachments || []).length > 0;
                      const isSigned = t.signedDocumentStatus === 'signed';
                      const defaultClearDate = rowClearDates[t._id] ?? (t.clearingDate ? clearedAtToYmd(t.clearingDate) : (filters.asOfDate || new Date().toISOString().split('T')[0]));
                      return (
                        <TableRow key={t._id || idx} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(t.date)}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{t.vrNo}</TableCell>
                          <TableCell>{t.narration}</TableCell>
                          <TableCell>{t.reference || '—'}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {t.type === 'Cr' ? `-${fmt(t.amount)}` : fmt(t.amount)}{' '}
                            <Typography component="span" fontWeight={700} color={t.type === 'Cr' ? 'error.main' : 'success.main'}>
                              {t.type}.
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title={`Attachments (${(t.attachments || []).length}) — click to add or view`}>
                              <span>
                                <IconButton
                                  size="small"
                                  color={(t.attachments || []).length > 0 ? 'primary' : 'default'}
                                  onClick={() => openAttachDlg(t)}
                                >
                                  <AttachIcon fontSize="small" />
                                  {(t.attachments || []).length > 0 && (
                                    <Typography component="span" variant="caption" sx={{ fontSize: 10, fontWeight: 700, ml: 0.25 }}>
                                      {t.attachments.length}
                                    </Typography>
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ minWidth: 120 }}>
                              <TextField
                                select
                                fullWidth
                                size="small"
                                value={isSigned ? 'signed' : 'not_signed'}
                                onChange={(e) => saveSignedDocumentStatus(t, e.target.value, t.signedBySignatory)}
                                SelectProps={{
                                  displayEmpty: true,
                                  MenuProps: { PaperProps: { sx: { maxHeight: 250 } } }
                                }}
                              >
                                <MenuItem value="signed">Signed</MenuItem>
                                <MenuItem value="not_signed">Not Signed</MenuItem>
                              </TextField>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ minWidth: 150 }}>
                              <TextField
                                select
                                fullWidth
                                size="small"
                                disabled={!isSigned}
                                value={t.signedBySignatory || ''}
                                onChange={(e) => saveSignedDocumentStatus(t, 'signed', e.target.value)}
                                SelectProps={{
                                  displayEmpty: true,
                                  MenuProps: { PaperProps: { sx: { maxHeight: 250 } } }
                                }}
                              >
                                <MenuItem value="">
                                  <em>Select Signatory</em>
                                </MenuItem>
                                {SIGNATORY_OPTIONS.map((opt) => (
                                  <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {t.signedDocumentAt ? formatDate(t.signedDocumentAt) : '—'}
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              type="date"
                              size="small"
                              value={defaultClearDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRowClearDates((prev) => ({ ...prev, [t._id]: val }));
                              }}
                              InputLabelProps={{ shrink: true }}
                              inputProps={{ style: { fontSize: '0.85rem', padding: '6px 8px' } }}
                              sx={{ width: 145 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                              <Tooltip title="Clear cheque & reconcile (removes from unpresented)">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="success"
                                    disabled={Boolean(clearingLoading[t._id])}
                                    onClick={() => handleDirectClear(t)}
                                    sx={{
                                      bgcolor: 'rgba(46, 125, 50, 0.1)',
                                      border: '1px solid rgba(46, 125, 50, 0.3)',
                                      '&:hover': { bgcolor: 'success.main', color: '#fff' }
                                    }}
                                  >
                                    {clearingLoading[t._id] ? (
                                      <CircularProgress size={16} color="inherit" />
                                    ) : (
                                      <ReconcileIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Clearance dialog / custom options">
                                <IconButton size="small" color="primary" onClick={() => openClearanceDialog(t)}>
                                  <EditDateIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Total Row */}
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell colSpan={4} sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        Total
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.95rem', color: data.differenceType === 'Cr' ? 'error.main' : 'success.main' }}>
                        {data.difference < 0 ? `-${fmt(data.difference)}` : fmt(data.difference)} {data.differenceType}.
                      </TableCell>
                      <TableCell colSpan={6} />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Lower Table: Period Activity & Cleared Bank Transactions */}
      {data && (
        <Box sx={{ mb: 3 }}>
          <Divider sx={{ my: 3 }} />
          
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" mb={2} gap={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Bank Statement &amp; Period Activity
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Cleared bank transactions between selected dates
              </Typography>
            </Box>

            {/* Date Range Filter for Lower Table */}
            <Stack direction="row" gap={1.5} alignItems="center">
              <TextField
                label="Date.From"
                type="date"
                size="small"
                value={filters.fromDate}
                onChange={e => setFilters({ ...filters, fromDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
              <TextField
                label="Date.To"
                type="date"
                size="small"
                value={filters.toDate}
                onChange={e => setFilters({ ...filters, toDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
              <Button variant="outlined" size="small" startIcon={<SearchIcon />} onClick={load} sx={{ height: 40 }}>
                Filter
              </Button>
            </Stack>
          </Stack>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>VrNo</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Narration</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Clearing.Date</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Opening Balance Row */}
                <TableRow sx={{ bgcolor: 'info.50' }}>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatDate(filters.fromDate)}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>-0</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Opening Balance</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    {data.openingBalance < 0 ? `-${fmt(data.openingBalance)}` : fmt(data.openingBalance)}{' '}
                    <Typography component="span" fontWeight={800} color={data.openingBalanceType === 'Cr' ? 'error.main' : 'success.main'}>
                      {data.openingBalanceType}.
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{formatDate(filters.fromDate)}</TableCell>
                  <TableCell align="center">—</TableCell>
                </TableRow>

                {/* Period Transactions */}
                {(data.periodTransactions || []).map((t, idx) => (
                  <TableRow key={t._id || idx} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(t.date)}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t.vrNo}</TableCell>
                    <TableCell>{t.narration}</TableCell>
                    <TableCell>{t.reference || '—'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {t.type === 'Cr' ? `-${fmt(t.amount)}` : fmt(t.amount)}{' '}
                      <Typography component="span" fontWeight={700} color={t.type === 'Cr' ? 'error.main' : 'success.main'}>
                        {t.type}.
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {t.clearingDate ? formatDate(t.clearingDate) : '—'}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Un-clear / Move back to Unpresented Cheques">
                        <span>
                          <IconButton
                            size="small"
                            color="warning"
                            disabled={Boolean(clearingLoading[t._id])}
                            onClick={() => handleDirectUnclear(t)}
                            sx={{
                              bgcolor: 'rgba(237, 108, 2, 0.08)',
                              border: '1px solid rgba(237, 108, 2, 0.3)',
                              '&:hover': { bgcolor: 'warning.main', color: '#fff' }
                            }}
                          >
                            {clearingLoading[t._id] ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : (
                              <UndoIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Total Closing Statement Balance Row */}
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell colSpan={4} sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
                    Total
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.95rem', color: data.bankStatementBalanceType === 'Cr' ? 'error.main' : 'success.main' }}>
                    {data.bankStatementBalance < 0 ? `-${fmt(data.bankStatementBalance)}` : fmt(data.bankStatementBalance)}{' '}
                    <Typography component="span" fontWeight={800} color={data.bankStatementBalanceType === 'Cr' ? 'error.main' : 'success.main'}>
                      {data.bankStatementBalanceType}.
                    </Typography>
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Clearance Dialog */}
      <Dialog
        open={clearanceDialog.open}
        onClose={closeClearanceDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Clearance — {clearanceDialog.transaction?.vrNo || 'Transaction'}</DialogTitle>
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
                <MenuItem value="pending">Pending (Unpresented / Uncleared)</MenuItem>
                <MenuItem value="cleared">Cleared (Reconciled in Bank)</MenuItem>
              </TextField>
            </Grid>
            {clearanceDialog.status === 'cleared' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Clearing Date"
                  value={clearanceDialog.clearedAtDate}
                  onChange={(e) => setClearanceDialog((d) => ({ ...d, clearedAtDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  helperText="Choose the date this transaction cleared in the bank statement."
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

      {/* Attachments Dialog */}
      <Dialog open={attachDlg.open} onClose={closeAttachDlg} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={700}>
              Voucher Attachments — {attachDlg.txn?.vrNo || ''}
            </Typography>
            <IconButton size="small" onClick={closeAttachDlg}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {attachError && <Alert severity="error" sx={{ mb: 2 }}>{attachError}</Alert>}
          {(attachDlg.txn?.attachments || []).length === 0 && (
            <Box textAlign="center" py={3} color="text.disabled">
              <AttachIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
              <Typography variant="body2">
                No attachments yet. Upload a voucher image, bank slip, or supporting document.
              </Typography>
            </Box>
          )}
          <List dense>
            {(attachDlg.txn?.attachments || []).map((a, i) => (
              <ListItem key={i} divider sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                <FileIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                <ListItemText
                  primary={<Typography variant="body2" fontWeight={600}>{a.originalName || a.filename}</Typography>}
                  secondary={a.uploadedAt ? new Date(a.uploadedAt).toLocaleDateString('en-PK') : ''}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Open / download">
                    <IconButton
                      size="small"
                      component="a"
                      href={`${baseUploadsUrl}/uploads/finance/${encodeURIComponent(a.filename)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={a.originalName}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDeleteAttachment(a.filename)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
          <Button
            variant="outlined"
            startIcon={attachDlg.uploading ? <CircularProgress size={16} /> : <UploadIcon />}
            component="label"
            disabled={attachDlg.uploading}
          >
            Upload Document
            <input type="file" hidden onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg" />
          </Button>
          <Button variant="contained" onClick={closeAttachDlg}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
