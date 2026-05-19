import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  Stack,
  TextField,
  CircularProgress
} from '@mui/material';
import { BalanceOutlined as TBIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('en-PK') : '—');

export default function EmployeeTrialBalancePanel({ employeeId, employeeName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  );
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [selectedLedgerRow, setSelectedLedgerRow] = useState(null);
  const [voucher, setVoucher] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState('');

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/finance/employees/${employeeId}/trial-balance`, {
        params: { fromDate, asOfDate }
      });
      const payload = res.data?.data || {};
      const rows = payload.rows || [];
      setData({
        accounts: rows.map((r) => ({
          _id: r._id,
          accountNumber: r.accountNumber,
          name: r.accountName,
          accountName: r.accountName,
          type: r.accountType,
          openingBalance: r.openingBalance || 0,
          totalDebit: r.totalDebit || 0,
          totalCredit: r.totalCredit || 0,
          closingBalance: r.closingBalance || 0
        })),
        totals: payload.totals,
        journalEntryCount: payload.journalEntryCount || 0,
        fromDate: payload.fromDate,
        asOfDate: payload.asOfDate
      });
      setSelectedAccount(null);
      setLedgerRows([]);
      setSelectedLedgerRow(null);
      setVoucher(null);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load employee trial balance');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId, fromDate, asOfDate]);

  const loadLedger = useCallback(async (account) => {
    setLedgerLoading(true);
    setLedgerError('');
    setSelectedLedgerRow(null);
    setVoucher(null);
    setVoucherError('');
    try {
      const res = await api.get(
        `/finance/employees/${employeeId}/trial-balance/ledger/${account._id}`,
        { params: { fromDate, asOfDate } }
      );
      setLedgerRows(res.data?.data || []);
    } catch (e) {
      setLedgerError(e.response?.data?.message || 'Failed to load ledger');
      setLedgerRows([]);
    } finally {
      setLedgerLoading(false);
    }
  }, [employeeId, fromDate, asOfDate]);

  const loadVoucher = useCallback(async (ledgerRow) => {
    const jeId = ledgerRow?.journalEntry?._id;
    if (!jeId) {
      setVoucher(null);
      setVoucherError('Voucher not linked for selected row');
      return;
    }
    setVoucherLoading(true);
    setVoucherError('');
    try {
      const res = await api.get(
        `/finance/employees/${employeeId}/trial-balance/voucher/${jeId}`
      );
      setVoucher(res.data?.data || null);
    } catch (e) {
      setVoucherError(e.response?.data?.message || 'Failed to load voucher');
      setVoucher(null);
    } finally {
      setVoucherLoading(false);
    }
  }, [employeeId]);

  const accounts = data?.accounts || [];
  const totalOpening = accounts.reduce((s, a) => s + (a.openingBalance || 0), 0);
  const totalDebits = accounts.reduce((s, a) => s + (a.totalDebit || 0), 0);
  const totalCredits = accounts.reduce((s, a) => s + (a.totalCredit || 0), 0);
  const totalClosing = accounts.reduce((s, a) => s + (a.closingBalance || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 1;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
        <Typography variant="subtitle1" fontWeight={700} display="flex" alignItems="center" gap={1}>
          <TBIcon color="primary" fontSize="small" />
          Employee Trial Balance
        </Typography>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <TextField
            label="From Date"
            type="date"
            size="small"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To Date"
            type="date"
            size="small"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="contained" onClick={load} disabled={loading} startIcon={<RefreshIcon />}>
            {loading ? 'Loading…' : 'Generate'}
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Trial balance for <strong>{employeeName}</strong> — accounts from cash advances and linked vouchers
        (employee advance GL under 1120).
      </Typography>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {!data && !loading && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Select dates and click Generate to view this employee&apos;s trial balance.
          </Typography>
        </Paper>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {data && !loading && (
        <>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 1 }}>
            <Typography variant="body2" fontWeight={700}>Trial Balance — {employeeName}</Typography>
            <Typography variant="body2" color="text.secondary">
              Period {new Date(fromDate).toLocaleDateString('en-PK')} to {new Date(asOfDate).toLocaleDateString('en-PK')}
              {' · '}
              {data.journalEntryCount} voucher{data.journalEntryCount === 1 ? '' : 's'}
            </Typography>
            <Typography variant="caption" color={isBalanced ? 'success.main' : 'error.main'}>
              {isBalanced ? 'Period movement balanced' : `Imbalanced by PKR ${fmt(Math.abs(totalDebits - totalCredits))}`}
            </Typography>
          </Paper>

          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 380 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: '#eef3f8' }}>
                  <TableCell sx={{ py: 0.75, fontSize: 12 }}><b>Nature</b></TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12 }}><b>Account Code</b></TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12 }}><b>Account Head</b></TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12 }} align="right"><b>Opening</b></TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12 }} align="right"><b>Debit</b></TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12 }} align="right"><b>Credit</b></TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12 }} align="right"><b>Closing</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((acc, idx) => (
                  <TableRow
                    key={acc._id}
                    hover
                    onClick={() => {
                      setSelectedAccount(acc);
                      loadLedger(acc);
                    }}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: selectedAccount?._id === acc._id ? '#fff6bf' : idx % 2 ? '#fffef7' : 'inherit'
                    }}
                  >
                    <TableCell sx={{ py: 0.45, fontSize: 12, textTransform: 'capitalize', color: 'text.secondary' }}>
                      {(acc.type || '')?.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell sx={{ py: 0.45, fontFamily: 'monospace', fontSize: 12 }}>{acc.accountNumber}</TableCell>
                    <TableCell sx={{ py: 0.45, fontSize: 12 }}>{acc.accountName}</TableCell>
                    <TableCell align="right" sx={{ py: 0.45, fontSize: 12 }}>
                      {(acc.openingBalance || 0) !== 0 ? fmt(acc.openingBalance) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.45, fontSize: 12, color: acc.totalDebit > 0 ? 'primary.main' : 'text.disabled' }}>
                      {acc.totalDebit > 0 ? fmt(acc.totalDebit) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.45, fontSize: 12, color: acc.totalCredit > 0 ? 'success.main' : 'text.disabled' }}>
                      {acc.totalCredit > 0 ? fmt(acc.totalCredit) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.45, fontSize: 12 }}>
                      {(acc.closingBalance || 0) !== 0 ? fmt(acc.closingBalance) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {accounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No posted journal activity for this employee in the selected period.
                    </TableCell>
                  </TableRow>
                )}
                {accounts.length > 0 && (
                  <TableRow sx={{ bgcolor: '#eef3f8', fontWeight: 800 }}>
                    <TableCell colSpan={3} align="right"><b>TOTALS</b></TableCell>
                    <TableCell align="right"><b>PKR {fmt(totalOpening)}</b></TableCell>
                    <TableCell align="right" sx={{ color: 'primary.main' }}><b>PKR {fmt(totalDebits)}</b></TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}><b>PKR {fmt(totalCredits)}</b></TableCell>
                    <TableCell align="right"><b>PKR {fmt(totalClosing)}</b></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {selectedAccount && (
            <Paper variant="outlined" sx={{ mt: 1.5, p: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Ledger — {selectedAccount.accountNumber} {selectedAccount.accountName}
              </Typography>
              {ledgerError && <Alert severity="error" sx={{ mt: 1 }}>{ledgerError}</Alert>}
              <Table size="small" sx={{ mt: 1 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#eef3f8' }}>
                    <TableCell sx={{ fontSize: 12 }}><b>Date</b></TableCell>
                    <TableCell sx={{ fontSize: 12 }}><b>Voucher</b></TableCell>
                    <TableCell sx={{ fontSize: 12 }}><b>Narration</b></TableCell>
                    <TableCell sx={{ fontSize: 12 }}><b>Reference</b></TableCell>
                    <TableCell sx={{ fontSize: 12 }} align="right"><b>Debit</b></TableCell>
                    <TableCell sx={{ fontSize: 12 }} align="right"><b>Credit</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledgerRows.map((row, idx) => (
                    <TableRow
                      key={row._id}
                      hover
                      onClick={() => {
                        setSelectedLedgerRow(row);
                        loadVoucher(row);
                      }}
                      sx={{
                        cursor: 'pointer',
                        bgcolor: selectedLedgerRow?._id === row._id ? '#fff6bf' : idx % 2 ? '#fffef7' : 'inherit'
                      }}
                    >
                      <TableCell sx={{ fontSize: 12 }}>{dateFmt(row.date)}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{row.entryNumber || row.journalEntry?.entryNumber || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{row.description || '—'}</TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{row.reference || row.journalEntry?.reference || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{row.debit ? fmt(row.debit) : '—'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{row.credit ? fmt(row.credit) : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {ledgerLoading && (
                    <TableRow><TableCell colSpan={6} align="center">Loading ledger…</TableCell></TableRow>
                  )}
                  {!ledgerLoading && ledgerRows.length === 0 && (
                    <TableRow><TableCell colSpan={6} align="center">No ledger lines for this account.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          {(selectedLedgerRow || voucherLoading || voucherError) && (
            <Paper variant="outlined" sx={{ mt: 1.5, p: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Voucher {voucher?.entryNumber ? `— ${voucher.entryNumber}` : ''}
              </Typography>
              {voucherError && <Alert severity="error" sx={{ mt: 1 }}>{voucherError}</Alert>}
              {voucherLoading && <Typography sx={{ mt: 1 }}>Loading voucher…</Typography>}
              {voucher && !voucherLoading && (
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#eef3f8' }}>
                      <TableCell sx={{ fontSize: 12 }}><b>Account</b></TableCell>
                      <TableCell sx={{ fontSize: 12 }}><b>Narration</b></TableCell>
                      <TableCell sx={{ fontSize: 12 }} align="right"><b>Debit</b></TableCell>
                      <TableCell sx={{ fontSize: 12 }} align="right"><b>Credit</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(voucher.lines || []).map((line, idx) => (
                      <TableRow key={line._id || idx}>
                        <TableCell sx={{ fontSize: 12 }}>
                          {line.account?.accountNumber || '—'} {line.account?.name ? `— ${line.account.name}` : ''}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{line.description || voucher.description || '—'}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12 }}>{fmt(line.debit || 0)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12 }}>{fmt(line.credit || 0)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell colSpan={2} align="right"><b>Total</b></TableCell>
                      <TableCell align="right"><b>{fmt(voucher.totalDebits || 0)}</b></TableCell>
                      <TableCell align="right"><b>{fmt(voucher.totalCredits || 0)}</b></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
