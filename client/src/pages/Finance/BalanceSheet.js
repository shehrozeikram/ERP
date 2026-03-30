import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, CircularProgress, Alert, Stack,
  Card, CardContent, Grid, Divider, Chip, TextField
} from '@mui/material';
import { AccountBalance as BSIcon, Print as PrintIcon, Refresh as RefreshIcon, PictureAsPdf as PdfIcon, GridOn as ExcelIcon } from '@mui/icons-material';
import api from '../../services/api';
import { exportBalanceSheetPDF, exportBalanceSheetExcel } from '../../utils/reportExport';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Section = ({ title, rows, total, color }) => (
  <Box mb={3}>
    <Typography variant="subtitle1" fontWeight={700} color={color} sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: 13 }}>
      {title}
    </Typography>
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell><b>Account #</b></TableCell>
            <TableCell><b>Account Name</b></TableCell>
            <TableCell><b>Type</b></TableCell>
            <TableCell align="right"><b>Balance (PKR)</b></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>No accounts in this section</TableCell></TableRow>
          )}
          {rows.map(r => (
            <TableRow key={r._id} hover>
              <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{r.accountNumber}</TableCell>
              <TableCell>{r.accountName}</TableCell>
              <TableCell sx={{ textTransform: 'capitalize' }}>{r.accountType?.replace(/_/g, ' ')}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 500 }}>{fmt(r.balance)}</TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ bgcolor: 'grey.100' }}>
            <TableCell colSpan={3} align="right"><b>Total {title}</b></TableCell>
            <TableCell align="right" sx={{ fontWeight: 800, color }}><b>PKR {fmt(total)}</b></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  </Box>
);

export default function BalanceSheet() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/finance/reports/balance-sheet', { params: { asOfDate } });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load balance sheet');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} className="print-hide-toolbar">
        <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
          <BSIcon color="primary" /> Balance Sheet
        </Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <TextField label="As of Date" type="date" size="small" value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} disabled={loading} startIcon={<RefreshIcon />}>
            {loading ? 'Loading…' : 'Generate'}
          </Button>
          {data && <>
            <Button variant="outlined" startIcon={<PdfIcon />} color="error" onClick={() => exportBalanceSheetPDF(data)}>PDF</Button>
            <Button variant="outlined" startIcon={<ExcelIcon />} color="success" onClick={() => exportBalanceSheetExcel(data)}>Excel</Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
          </>}
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {!data && !loading && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">Select a date and click Generate to view the Balance Sheet.</Typography>
        </Paper>
      )}

      {data && (
        <>
          {/* Header */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'primary.50', borderColor: 'primary.200' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={700}>Balance Sheet</Typography>
                <Typography variant="body2" color="text.secondary">
                  As of {new Date(data.asOfDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' })}
                </Typography>
              </Box>
              <Chip
                label={data.totals.isBalanced ? 'Balanced ✓' : `Imbalance: PKR ${fmt(Math.abs(data.totals.totalAssets - data.totals.liabilitiesAndEquity))}`}
                color={data.totals.isBalanced ? 'success' : 'error'}
                variant="filled"
              />
            </Stack>
          </Paper>

          {/* Summary KPI row */}
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Total Assets',             value: data.totals.totalAssets,           color: 'primary.main'  },
              { label: 'Total Liabilities',        value: data.totals.totalLiabilities,       color: 'error.main'    },
              { label: 'Total Equity',             value: data.totals.totalEquity,            color: 'success.main'  },
              { label: 'Liabilities + Equity',     value: data.totals.liabilitiesAndEquity,   color: 'warning.dark'  },
            ].map(c => (
              <Grid item xs={12} sm={6} md={3} key={c.label}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h6" fontWeight={700} color={c.color}>PKR {fmt(c.value)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Sections */}
          <Section title="Assets"      rows={data.assets.rows}      total={data.assets.total}      color="#1565c0" />
          <Section title="Liabilities" rows={data.liabilities.rows} total={data.liabilities.total} color="#c62828" />
          <Section title="Equity"      rows={data.equity.rows}      total={data.equity.total}      color="#2e7d32" />

          {/* Final balance check */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: data.totals.isBalanced ? 'success.50' : 'error.50', borderColor: data.totals.isBalanced ? 'success.300' : 'error.300' }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography fontWeight={700}>Total Assets</Typography>
              <Typography fontWeight={700} color="primary.main">PKR {fmt(data.totals.totalAssets)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography fontWeight={700}>Total Liabilities + Equity</Typography>
              <Typography fontWeight={700} color={data.totals.isBalanced ? 'success.main' : 'error.main'}>PKR {fmt(data.totals.liabilitiesAndEquity)}</Typography>
            </Stack>
          </Paper>
        </>
      )}
    </Box>
  );
}
