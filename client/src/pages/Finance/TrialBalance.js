import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Alert, Stack, TextField
} from '@mui/material';
import { BalanceOutlined as TBIcon, Refresh as RefreshIcon, Print as PrintIcon, PictureAsPdf as PdfIcon, GridOn as ExcelIcon } from '@mui/icons-material';
import api from '../../services/api';
import { exportTrialBalancePDF, exportTrialBalanceExcel } from '../../utils/reportExport';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('en-PK') : '—');

export default function TrialBalance() {
  const { selectedCompanyId } = useFinanceCompany();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
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
    if (!selectedCompanyId) return;
    setLoading(true); setError('');
    try {
      const res = await api.get('/finance/reports/trial-balance-v2', {
        params: { fromDate, asOfDate, companyId: selectedCompanyId }
      });
      const payload = res.data.data || res.data;
      const rows = payload.rows || [];
      const accounts = rows.map((r) => ({
        _id: r._id,
        accountNumber: r.accountNumber,
        name: r.accountName,
        accountName: r.accountName,
        type: r.accountType,
        accountType: r.accountType,
        openingBalance: r.openingBalance || 0,
        totalDebit: r.totalDebit || 0,
        totalCredit: r.totalCredit || 0,
        closingBalance: r.closingBalance || r.netBalance || 0,
        balance: r.netBalance
      }));
      setData({
        accounts,
        totals: payload.totals,
        fromDate: payload.fromDate,
        asOfDate: payload.asOfDate
      });
      setSelectedAccount(null);
      setLedgerRows([]);
      setSelectedLedgerRow(null);
      setVoucher(null);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load trial balance');
    } finally {
      setLoading(false);
    }
  }, [fromDate, asOfDate, selectedCompanyId]);

  const loadLedger = useCallback(async (account) => {
    setLedgerLoading(true);
    setLedgerError('');
    setSelectedLedgerRow(null);
    setVoucher(null);
    setVoucherError('');
    try {
      const res = await api.get(`/finance/general-ledger/account/${account._id}`, {
        params: { startDate: fromDate, endDate: asOfDate }
      });
      setLedgerRows(res.data?.data || []);
    } catch (e) {
      setLedgerError(e.response?.data?.message || 'Failed to load ledger');
      setLedgerRows([]);
    } finally {
      setLedgerLoading(false);
    }
  }, [fromDate, asOfDate]);

  const loadVoucher = useCallback(async (ledgerRow) => {
    const jeId = ledgerRow?.journalEntry?._id;
    if (!jeId) {
      setVoucher(null);
      setVoucherError('Voucher not linked for selected ledger row');
      return;
    }
    setVoucherLoading(true);
    setVoucherError('');
    try {
      const res = await api.get(`/finance/journal-entries/${jeId}`);
      setVoucher(res.data?.data || null);
    } catch (e) {
      setVoucherError(e.response?.data?.message || 'Failed to load voucher');
      setVoucher(null);
    } finally {
      setVoucherLoading(false);
    }
  }, []);

  const totalOpening = data?.accounts?.reduce((s, a) => s + (a.openingBalance || 0), 0) || 0;
  const totalDebits  = data?.accounts?.reduce((s, a) => s + (a.totalDebit  || 0), 0) || 0;
  const totalCredits = data?.accounts?.reduce((s, a) => s + (a.totalCredit || 0), 0) || 0;
  const totalClosing = data?.accounts?.reduce((s, a) => s + (a.closingBalance || 0), 0) || 0;
  const isBalanced   = Math.abs(totalDebits - totalCredits) < 1;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} className="print-hide-toolbar" flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
          <TBIcon color="primary" /> Trial Balance
        </Typography>
        <Stack direction="row" gap={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
          <FinanceCompanySelector minWidth={240} showHelper={false} />
          <TextField label="From Date" type="date" size="small" value={fromDate}
            onChange={e => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To Date" type="date" size="small" value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} disabled={loading || !selectedCompanyId} startIcon={<RefreshIcon />}>
            {loading ? 'Loading…' : 'Generate'}
          </Button>
          {data && <>
            <Button variant="outlined" startIcon={<PdfIcon />} color="error" onClick={() => exportTrialBalancePDF(data, asOfDate)}>PDF</Button>
            <Button variant="outlined" startIcon={<ExcelIcon />} color="success" onClick={() => exportTrialBalanceExcel(data, asOfDate)}>Excel</Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
          </>}
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {!data && !loading && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">Select a date and click Generate to view the Trial Balance.</Typography>
        </Paper>
      )}

      {data && (
        <>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 1 }}>
            <Typography fontWeight={700} sx={{ fontSize: 18 }}>Sardar Group of Companies</Typography>
            <Typography variant="body2" fontWeight={700}>Trial Balance</Typography>
            <Typography variant="body2" color="text.secondary">
              Period {new Date(fromDate).toLocaleDateString('en-PK')} to {new Date(asOfDate).toLocaleDateString('en-PK')}
            </Typography>
            <Typography variant="caption" color={isBalanced ? 'success.main' : 'error.main'}>
              {isBalanced ? 'Balanced' : `Imbalanced by PKR ${fmt(Math.abs(totalDebits - totalCredits))}`}
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
                {(data.accounts || []).map((acc, idx) => (
                  <TableRow
                    key={acc._id || acc.accountNumber}
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
                      {(acc.type || acc.accountType)?.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell sx={{ py: 0.45, fontFamily: 'monospace', color: 'text.secondary', fontSize: 12 }}>{acc.accountNumber}</TableCell>
                    <TableCell sx={{ py: 0.45, fontSize: 12 }}>{acc.name || acc.accountName}</TableCell>
                    <TableCell align="right" sx={{ py: 0.45, fontSize: 12, color: (acc.openingBalance || 0) !== 0 ? 'text.primary' : 'text.disabled' }}>
                      {(acc.openingBalance || 0) !== 0 ? fmt(acc.openingBalance) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.45, fontSize: 12, color: acc.totalDebit > 0 ? 'primary.main' : 'text.disabled' }}>
                      {acc.totalDebit > 0 ? fmt(acc.totalDebit) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.45, fontSize: 12, color: acc.totalCredit > 0 ? 'success.main' : 'text.disabled' }}>
                      {acc.totalCredit > 0 ? fmt(acc.totalCredit) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.45, fontSize: 12, color: (acc.closingBalance || 0) !== 0 ? 'text.primary' : 'text.disabled' }}>
                      {(acc.closingBalance || 0) !== 0 ? fmt(acc.closingBalance) : '—'}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals */}
                <TableRow sx={{ bgcolor: '#eef3f8', fontWeight: 800 }}>
                  <TableCell colSpan={3} align="right"><b>TOTALS</b></TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    <b>PKR {fmt(totalOpening)}</b>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main' }}>
                    <b>PKR {fmt(totalDebits)}</b>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>
                    <b>PKR {fmt(totalCredits)}</b>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    <b>PKR {fmt(totalClosing)}</b>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {selectedAccount && (
            <Paper variant="outlined" sx={{ mt: 1.5, p: 1.25 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Ledger — {selectedAccount.accountNumber} {selectedAccount.accountName}
              </Typography>
              {ledgerError && <Alert severity="error" sx={{ mt: 1 }}>{ledgerError}</Alert>}
              <Table size="small" sx={{ mt: 1 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#eef3f8' }}>
                    <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Date</b></TableCell>
                    <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>DocRef</b></TableCell>
                    <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Narration</b></TableCell>
                    <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Reference</b></TableCell>
                    <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Project</b></TableCell>
                    <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Department</b></TableCell>
                    <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Party</b></TableCell>
                    <TableCell sx={{ py: 0.65, fontSize: 12 }} align="right"><b>Debit</b></TableCell>
                    <TableCell sx={{ py: 0.65, fontSize: 12 }} align="right"><b>Credit</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(ledgerRows || []).map((row, idx) => (
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
                      <TableCell sx={{ py: 0.45, fontSize: 12 }}>{dateFmt(row.date)}</TableCell>
                      <TableCell sx={{ py: 0.45, fontSize: 12 }}>{row.entryNumber || row.journalEntry?.entryNumber || '—'}</TableCell>
                      <TableCell sx={{ py: 0.45, fontSize: 12 }}>{row.description || row.journalEntry?.description || '—'}</TableCell>
                      <TableCell sx={{ py: 0.45, fontSize: 12 }}>{row.reference || row.journalEntry?.reference || '—'}</TableCell>
                      <TableCell sx={{ py: 0.45, fontSize: 12 }}>{row.project || 'null'}</TableCell>
                      <TableCell sx={{ py: 0.45, fontSize: 12 }}>{row.department || 'null'}</TableCell>
                      <TableCell sx={{ py: 0.45, fontSize: 12 }}>{row.party || 'null'}</TableCell>
                      <TableCell sx={{ py: 0.45, fontSize: 12 }} align="right">{row.debit ? fmt(row.debit) : '0.00'}</TableCell>
                      <TableCell sx={{ py: 0.45, fontSize: 12 }} align="right">{row.credit ? fmt(row.credit) : '0.00'}</TableCell>
                    </TableRow>
                  ))}
                  {!ledgerLoading && ledgerRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center">No ledger entries for selected account/date range.</TableCell>
                    </TableRow>
                  )}
                  {ledgerLoading && (
                    <TableRow>
                      <TableCell colSpan={9} align="center">Loading ledger...</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          {(selectedLedgerRow || voucherLoading || voucherError) && (
            <Paper variant="outlined" sx={{ mt: 1.5, p: 1.25 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Voucher {voucher?.entryNumber ? `— ${voucher.entryNumber}` : ''}
              </Typography>
              {voucherError && <Alert severity="error" sx={{ mt: 1 }}>{voucherError}</Alert>}
              {voucherLoading && <Typography sx={{ mt: 1 }}>Loading voucher...</Typography>}
              {!!voucher && !voucherLoading && (
                <>
                  <Table size="small" sx={{ mt: 1 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#eef3f8' }}>
                        <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Sr.No.</b></TableCell>
                        <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Account Code</b></TableCell>
                        <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Narration</b></TableCell>
                        <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Reference</b></TableCell>
                        <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Project</b></TableCell>
                        <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Department</b></TableCell>
                        <TableCell sx={{ py: 0.65, fontSize: 12 }}><b>Party</b></TableCell>
                        <TableCell sx={{ py: 0.65, fontSize: 12 }} align="right"><b>Debit</b></TableCell>
                        <TableCell sx={{ py: 0.65, fontSize: 12 }} align="right"><b>Credit</b></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(voucher.lines || []).map((line, idx) => (
                        <TableRow key={`${line._id || idx}`}>
                          <TableCell sx={{ py: 0.45, fontSize: 12 }}>{idx + 1}</TableCell>
                          <TableCell sx={{ py: 0.45, fontSize: 12 }}>
                            {line.account?.accountNumber || '—'} {line.account?.name ? `- ${line.account.name}` : ''}
                          </TableCell>
                          <TableCell sx={{ py: 0.45, fontSize: 12 }}>{line.description || voucher.description || '—'}</TableCell>
                          <TableCell sx={{ py: 0.45, fontSize: 12 }}>{voucher.reference || '—'}</TableCell>
                          <TableCell sx={{ py: 0.45, fontSize: 12 }}>{voucher.module || 'null'}</TableCell>
                          <TableCell sx={{ py: 0.45, fontSize: 12 }}>{voucher.department || 'null'}</TableCell>
                          <TableCell sx={{ py: 0.45, fontSize: 12 }}>{voucher.party || 'null'}</TableCell>
                          <TableCell sx={{ py: 0.45, fontSize: 12 }} align="right">{fmt(line.debit || 0)}</TableCell>
                          <TableCell sx={{ py: 0.45, fontSize: 12 }} align="right">{fmt(line.credit || 0)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell colSpan={7} align="right"><b>Total</b></TableCell>
                        <TableCell align="right"><b>{fmt(voucher.totalDebits || 0)}</b></TableCell>
                        <TableCell align="right"><b>{fmt(voucher.totalCredits || 0)}</b></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={8} align="right"><b>Voucher Difference</b></TableCell>
                        <TableCell align="right"><b>{fmt(Math.abs((voucher.totalDebits || 0) - (voucher.totalCredits || 0)))}</b></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </>
              )}
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
