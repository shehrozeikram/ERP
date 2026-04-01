import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Alert, Stack, Card, CardContent,
  Grid, Chip, TextField, Divider
} from '@mui/material';
import { BalanceOutlined as TBIcon, Refresh as RefreshIcon, Print as PrintIcon, PictureAsPdf as PdfIcon, GridOn as ExcelIcon } from '@mui/icons-material';
import api from '../../services/api';
import { exportTrialBalancePDF, exportTrialBalanceExcel } from '../../utils/reportExport';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TrialBalance() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      // trial-balance-v2: sums posted journal lines (same source as BS); legacy route returned wrong shape for this UI
      const res = await api.get('/finance/reports/trial-balance-v2', { params: { asOfDate } });
      const payload = res.data.data || res.data;
      const rows = payload.rows || [];
      const accounts = rows.map((r) => ({
        _id: r._id,
        accountNumber: r.accountNumber,
        name: r.accountName,
        accountName: r.accountName,
        type: r.accountType,
        accountType: r.accountType,
        totalDebit: r.totalDebit || 0,
        totalCredit: r.totalCredit || 0,
        balance: r.netBalance
      }));
      setData({
        accounts,
        totals: payload.totals,
        asOfDate: payload.asOfDate
      });
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load trial balance');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  const totalDebits  = data?.accounts?.reduce((s, a) => s + (a.totalDebit  || 0), 0) || 0;
  const totalCredits = data?.accounts?.reduce((s, a) => s + (a.totalCredit || 0), 0) || 0;
  const isBalanced   = Math.abs(totalDebits - totalCredits) < 1;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} className="print-hide-toolbar">
        <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
          <TBIcon color="primary" /> Trial Balance
        </Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <TextField label="As of Date" type="date" size="small" value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} disabled={loading} startIcon={<RefreshIcon />}>
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
          <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: isBalanced ? 'success.50' : 'error.50', borderColor: isBalanced ? 'success.300' : 'error.300' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={700}>Trial Balance</Typography>
                <Typography variant="body2" color="text.secondary">
                  As of {new Date(asOfDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}
                </Typography>
              </Box>
              <Chip
                label={isBalanced ? 'Balanced ✓' : `Imbalanced — Diff: PKR ${fmt(Math.abs(totalDebits - totalCredits))}`}
                color={isBalanced ? 'success' : 'error'}
                size="medium"
              />
            </Stack>
          </Paper>

          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Total Debits',  value: totalDebits,  color: 'primary.main' },
              { label: 'Total Credits', value: totalCredits, color: 'success.main' },
              { label: 'Difference',    value: Math.abs(totalDebits - totalCredits), color: isBalanced ? 'text.secondary' : 'error.main' },
            ].map(c => (
              <Grid item xs={12} md={4} key={c.label}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h6" fontWeight={700} color={c.color}>PKR {fmt(c.value)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell><b>Account #</b></TableCell>
                  <TableCell><b>Account Name</b></TableCell>
                  <TableCell><b>Type</b></TableCell>
                  <TableCell align="right"><b>Debit (PKR)</b></TableCell>
                  <TableCell align="right"><b>Credit (PKR)</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.accounts || []).map((acc) => (
                  <TableRow key={acc._id || acc.accountNumber} hover>
                    <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{acc.accountNumber}</TableCell>
                    <TableCell>{acc.name || acc.accountName}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize', color: 'text.secondary', fontSize: 12 }}>
                      {(acc.type || acc.accountType)?.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell align="right" sx={{ color: acc.totalDebit > 0 ? 'primary.main' : 'text.disabled' }}>
                      {acc.totalDebit > 0 ? fmt(acc.totalDebit) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ color: acc.totalCredit > 0 ? 'success.main' : 'text.disabled' }}>
                      {acc.totalCredit > 0 ? fmt(acc.totalCredit) : '—'}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Totals */}
                <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 800 }}>
                  <TableCell colSpan={3} align="right"><b>TOTALS</b></TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main' }}>
                    <b>PKR {fmt(totalDebits)}</b>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>
                    <b>PKR {fmt(totalCredits)}</b>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
