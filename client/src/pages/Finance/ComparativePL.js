import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Button, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  TextField, Stack, Card, CardContent
} from '@mui/material';
import { CompareArrows as CompareIcon, PictureAsPdf as PdfIcon, TableView as ExcelIcon } from '@mui/icons-material';
import api from '../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtFull = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SummaryCard({ label, p1, p2, color }) {
  const diff = (p2 || 0) - (p1 || 0);
  const pct  = p1 ? ((diff / Math.abs(p1)) * 100).toFixed(1) : null;
  return (
    <Card variant="outlined" sx={{ textAlign: 'center' }}>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Box display="flex" justifyContent="space-around" mt={0.5}>
          <Box>
            <Typography variant="caption" color="text.disabled">Period 1</Typography>
            <Typography variant="body2" fontWeight={700} color={color}>{fmt(p1)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.disabled">Period 2</Typography>
            <Typography variant="body2" fontWeight={700} color={color}>{fmt(p2)}</Typography>
          </Box>
          {pct !== null && (
            <Box>
              <Typography variant="caption" color="text.disabled">Change</Typography>
              <Chip label={`${diff >= 0 ? '+' : ''}${pct}%`} size="small"
                color={diff >= 0 ? 'success' : 'error'} sx={{ fontWeight: 700, fontSize: 11 }} />
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function AccountRows({ rows1, rows2, type }) {
  const all = new Map();
  (rows1 || []).forEach(r => all.set(r._id?.toString(), { name: r.accountName, num: r.accountNumber, p1: type === 'Revenue' ? (r.totalCredit - r.totalDebit) : (r.totalDebit - r.totalCredit) }));
  (rows2 || []).forEach(r => {
    const key = r._id?.toString();
    const p2 = type === 'Revenue' ? (r.totalCredit - r.totalDebit) : (r.totalDebit - r.totalCredit);
    if (all.has(key)) all.set(key, { ...all.get(key), p2 });
    else all.set(key, { name: r.accountName, num: r.accountNumber, p1: 0, p2 });
  });
  const sorted = [...all.values()].sort((a, b) => a.num?.localeCompare(b.num));
  return sorted.map((row, i) => {
    const diff = (row.p2 || 0) - (row.p1 || 0);
    const pct  = row.p1 ? ((diff / Math.abs(row.p1)) * 100).toFixed(1) : '—';
    return (
      <TableRow key={i} hover>
        <TableCell sx={{ pl: 4 }}>
          <Typography variant="body2">{row.name}</Typography>
          <Typography variant="caption" color="text.disabled">{row.num}</Typography>
        </TableCell>
        <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{fmt(row.p1 || 0)}</TableCell>
        <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{fmt(row.p2 || 0)}</TableCell>
        <TableCell align="right">
          <Chip label={`${diff >= 0 ? '+' : ''}${fmtFull(diff)}`} size="small"
            color={diff === 0 ? 'default' : diff > 0 ? (type === 'Revenue' ? 'success' : 'error') : (type === 'Revenue' ? 'error' : 'success')}
            sx={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }} />
        </TableCell>
        <TableCell align="right">
          <Typography variant="caption">{typeof pct === 'string' ? pct : `${pct}%`}</Typography>
        </TableCell>
      </TableRow>
    );
  });
}

export default function ComparativePL() {
  const [filters, setFilters] = useState({
    p1From: `${new Date().getFullYear() - 1}-01-01`,
    p1To:   `${new Date().getFullYear() - 1}-12-31`,
    p2From: `${new Date().getFullYear()}-01-01`,
    p2To:   new Date().toISOString().split('T')[0]
  });
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const setF = (k) => (e) => setFilters(f => ({ ...f, [k]: e.target.value }));

  const load = useCallback(async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const res = await api.get('/finance/reports/comparative-pl', { params: filters });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const labelP = (p) => `${p?.from || '?'} → ${p?.to || '?'}`;

  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Comparative Profit & Loss Statement', 14, 18);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Period 1: ${labelP(data.period1)}   |   Period 2: ${labelP(data.period2)}`, 14, 26);
    const rows = [];
    rows.push(['REVENUE', '', '', '', '']);
    (data.period1?.revenue || []).forEach(r => {
      const p1 = (r.totalCredit || 0) - (r.totalDebit || 0);
      const match = (data.period2?.revenue || []).find(x => x._id?.toString() === r._id?.toString());
      const p2 = match ? (match.totalCredit - match.totalDebit) : 0;
      rows.push([r.accountName, fmt(p1), fmt(p2), fmt(p2 - p1), p1 ? `${(((p2 - p1) / Math.abs(p1)) * 100).toFixed(1)}%` : '—']);
    });
    rows.push(['Total Revenue', fmt(data.period1?.totalRevenue), fmt(data.period2?.totalRevenue), fmt((data.period2?.totalRevenue || 0) - (data.period1?.totalRevenue || 0)), '']);
    rows.push(['EXPENSES', '', '', '', '']);
    (data.period1?.expenses || []).forEach(r => {
      const p1 = (r.totalDebit || 0) - (r.totalCredit || 0);
      const match = (data.period2?.expenses || []).find(x => x._id?.toString() === r._id?.toString());
      const p2 = match ? (match.totalDebit - match.totalCredit) : 0;
      rows.push([r.accountName, fmt(p1), fmt(p2), fmt(p2 - p1), p1 ? `${(((p2 - p1) / Math.abs(p1)) * 100).toFixed(1)}%` : '—']);
    });
    rows.push(['Total Expenses', fmt(data.period1?.totalExpenses), fmt(data.period2?.totalExpenses), '', '']);
    rows.push(['NET PROFIT', fmt(data.period1?.netProfit), fmt(data.period2?.netProfit), fmt((data.period2?.netProfit || 0) - (data.period1?.netProfit || 0)), '']);
    autoTable(doc, {
      head: [['Account', 'Period 1', 'Period 2', 'Change (PKR)', 'Change %']],
      body: rows, startY: 30,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [21, 101, 192] }
    });
    doc.save('Comparative-PL.pdf');
  };

  const exportExcel = () => {
    if (!data) return;
    const rows = [['Account', 'Period 1', 'Period 2', 'Change (PKR)', 'Change %'],
                  ['=== REVENUE ===', '', '', '', '']];
    (data.period1?.revenue || []).forEach(r => {
      const p1 = (r.totalCredit || 0) - (r.totalDebit || 0);
      const m  = (data.period2?.revenue || []).find(x => x._id?.toString() === r._id?.toString());
      const p2 = m ? (m.totalCredit - m.totalDebit) : 0;
      rows.push([r.accountName, p1, p2, p2 - p1, p1 ? `${(((p2 - p1) / Math.abs(p1)) * 100).toFixed(1)}%` : '—']);
    });
    rows.push(['Total Revenue', data.period1?.totalRevenue, data.period2?.totalRevenue, (data.period2?.totalRevenue || 0) - (data.period1?.totalRevenue || 0), '']);
    rows.push(['=== EXPENSES ===', '', '', '', '']);
    (data.period1?.expenses || []).forEach(r => {
      const p1 = (r.totalDebit || 0) - (r.totalCredit || 0);
      const m  = (data.period2?.expenses || []).find(x => x._id?.toString() === r._id?.toString());
      const p2 = m ? (m.totalDebit - m.totalCredit) : 0;
      rows.push([r.accountName, p1, p2, p2 - p1, p1 ? `${(((p2 - p1) / Math.abs(p1)) * 100).toFixed(1)}%` : '—']);
    });
    rows.push(['Total Expenses', data.period1?.totalExpenses, data.period2?.totalExpenses, '', '']);
    rows.push(['NET PROFIT', data.period1?.netProfit, data.period2?.netProfit, (data.period2?.netProfit || 0) - (data.period1?.netProfit || 0), '']);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Comparative PL');
    XLSX.writeFile(wb, 'Comparative-PL.xlsx');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} className="print-hide-toolbar">
        <Box display="flex" alignItems="center" gap={1}>
          <CompareIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Comparative Profit & Loss</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<PdfIcon />} onClick={exportPDF} disabled={!data}>PDF</Button>
          <Button variant="outlined" size="small" startIcon={<ExcelIcon />} onClick={exportExcel} disabled={!data} color="success">Excel</Button>
        </Stack>
      </Box>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }} className="print-hide-toolbar">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={2}><Typography variant="subtitle2" fontWeight={700} color="primary">Period 1</Typography></Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth size="small" label="From" type="date" value={filters.p1From} onChange={setF('p1From')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth size="small" label="To" type="date" value={filters.p1To} onChange={setF('p1To')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={2}><Typography variant="subtitle2" fontWeight={700} color="secondary">Period 2</Typography></Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth size="small" label="From" type="date" value={filters.p2From} onChange={setF('p2From')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth size="small" label="To" type="date" value={filters.p2To} onChange={setF('p2To')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={12} display="flex" justifyContent="flex-end">
            <Button variant="contained" onClick={load} disabled={loading} startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CompareIcon />}>
              {loading ? 'Loading…' : 'Compare'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {data && (
        <>
          {/* Summary cards */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={4}>
              <SummaryCard label="Total Revenue" p1={data.period1?.totalRevenue} p2={data.period2?.totalRevenue} color="success.main" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <SummaryCard label="Total Expenses" p1={data.period1?.totalExpenses} p2={data.period2?.totalExpenses} color="error.main" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <SummaryCard label="Net Profit" p1={data.period1?.netProfit} p2={data.period2?.netProfit} color="primary.main" />
            </Grid>
          </Grid>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 700, width: '40%' }}>Account</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>
                    <Chip label="Period 1" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700 }} />
                    <Typography variant="caption" display="block" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.3 }}>{labelP(data.period1)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>
                    <Chip label="Period 2" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 700 }} />
                    <Typography variant="caption" display="block" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.3 }}>{labelP(data.period2)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Change (PKR)</TableCell>
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 700 }}>Change %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Revenue */}
                <TableRow sx={{ bgcolor: 'success.50' }}>
                  <TableCell colSpan={5} sx={{ fontWeight: 800, color: 'success.dark', letterSpacing: 1 }}>REVENUE</TableCell>
                </TableRow>
                <AccountRows rows1={data.period1?.revenue} rows2={data.period2?.revenue} type="Revenue" />
                <TableRow sx={{ bgcolor: 'success.100' }}>
                  <TableCell sx={{ fontWeight: 800 }}>Total Revenue</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'success.dark' }}>{fmt(data.period1?.totalRevenue)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'success.dark' }}>{fmt(data.period2?.totalRevenue)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
                    {fmt((data.period2?.totalRevenue || 0) - (data.period1?.totalRevenue || 0))}
                  </TableCell>
                  <TableCell />
                </TableRow>

                <TableRow><TableCell colSpan={5} sx={{ py: 0.5 }} /></TableRow>

                {/* Expenses */}
                <TableRow sx={{ bgcolor: 'error.50' }}>
                  <TableCell colSpan={5} sx={{ fontWeight: 800, color: 'error.dark', letterSpacing: 1 }}>EXPENSES</TableCell>
                </TableRow>
                <AccountRows rows1={data.period1?.expenses} rows2={data.period2?.expenses} type="Expense" />
                <TableRow sx={{ bgcolor: 'error.100' }}>
                  <TableCell sx={{ fontWeight: 800 }}>Total Expenses</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'error.dark' }}>{fmt(data.period1?.totalExpenses)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'error.dark' }}>{fmt(data.period2?.totalExpenses)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
                    {fmt((data.period2?.totalExpenses || 0) - (data.period1?.totalExpenses || 0))}
                  </TableCell>
                  <TableCell />
                </TableRow>

                <TableRow><TableCell colSpan={5} sx={{ py: 0.5 }} /></TableRow>

                {/* Net Profit */}
                <TableRow sx={{ bgcolor: data.period2?.netProfit >= 0 ? 'primary.50' : 'error.50' }}>
                  <TableCell sx={{ fontWeight: 900, fontSize: 16 }}>NET PROFIT / (LOSS)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900, fontSize: 15, fontFamily: 'monospace',
                    color: (data.period1?.netProfit || 0) >= 0 ? 'success.dark' : 'error.dark' }}>
                    {fmt(data.period1?.netProfit)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900, fontSize: 15, fontFamily: 'monospace',
                    color: (data.period2?.netProfit || 0) >= 0 ? 'success.dark' : 'error.dark' }}>
                    {fmt(data.period2?.netProfit)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
                    {fmt((data.period2?.netProfit || 0) - (data.period1?.netProfit || 0))}
                  </TableCell>
                  <TableCell align="right">
                    {data.period1?.netProfit ? (
                      <Chip size="small" fontWeight={700}
                        label={`${((((data.period2?.netProfit || 0) - (data.period1?.netProfit || 0)) / Math.abs(data.period1.netProfit)) * 100).toFixed(1)}%`}
                        color={(data.period2?.netProfit || 0) >= (data.period1?.netProfit || 0) ? 'success' : 'error'}
                      />
                    ) : '—'}
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
