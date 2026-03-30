import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, CircularProgress, Alert, Stack,
  Card, CardContent, Grid, Divider, Chip, TextField
} from '@mui/material';
import { TrendingUp as PLIcon, Print as PrintIcon, Refresh as RefreshIcon, PictureAsPdf as PdfIcon, GridOn as ExcelIcon } from '@mui/icons-material';
import api from '../../services/api';
import { exportProfitLossPDF, exportProfitLossExcel } from '../../utils/reportExport';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PLSection = ({ title, rows, total, color }) => (
  <Box mb={2}>
    <Typography variant="subtitle2" fontWeight={700} color={color} sx={{ mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 }}>
      {title}
    </Typography>
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell><b>Account #</b></TableCell>
            <TableCell><b>Account Name</b></TableCell>
            <TableCell align="right"><b>Amount (PKR)</b></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 2 }}>No entries</TableCell></TableRow>
          )}
          {rows.map(r => (
            <TableRow key={r._id} hover>
              <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{r.accountNumber}</TableCell>
              <TableCell>{r.accountName}</TableCell>
              <TableCell align="right">{fmt(r.balance)}</TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ bgcolor: 'grey.100' }}>
            <TableCell colSpan={2} align="right"><b>Total {title}</b></TableCell>
            <TableCell align="right" sx={{ fontWeight: 800, color }}><b>PKR {fmt(total)}</b></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  </Box>
);

export default function ProfitLoss() {
  const curYear = new Date().getFullYear();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [filters, setFilters] = useState({
    fromDate: `${curYear}-01-01`,
    toDate:   new Date().toISOString().split('T')[0]
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/finance/reports/profit-loss', { params: filters });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load P&L');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} className="print-hide-toolbar">
        <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
          <PLIcon color="success" /> Profit & Loss (Income Statement)
        </Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <TextField label="From Date" type="date" size="small" value={filters.fromDate}
            onChange={e => setFilters({ ...filters, fromDate: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField label="To Date" type="date" size="small" value={filters.toDate}
            onChange={e => setFilters({ ...filters, toDate: e.target.value })} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" color="success" onClick={load} disabled={loading} startIcon={<RefreshIcon />}>
            {loading ? 'Loading…' : 'Generate'}
          </Button>
          {data && <>
            <Button variant="outlined" startIcon={<PdfIcon />} color="error" onClick={() => exportProfitLossPDF(data, filters)}>PDF</Button>
            <Button variant="outlined" startIcon={<ExcelIcon />} color="success" onClick={() => exportProfitLossExcel(data, filters)}>Excel</Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
          </>}
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {!data && !loading && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">Select a date range and click Generate to view the Profit & Loss Statement.</Typography>
        </Paper>
      )}

      {data && (
        <>
          {/* Header */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: data.totals.isProfitable ? 'success.50' : 'error.50', borderColor: data.totals.isProfitable ? 'success.200' : 'error.200' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={700}>Profit & Loss Statement</Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(data.fromDate).toLocaleDateString('en-PK', { month: 'long', day: 'numeric', year: 'numeric' })} —{' '}
                  {new Date(data.toDate).toLocaleDateString('en-PK', { month: 'long', day: 'numeric', year: 'numeric' })}
                </Typography>
              </Box>
              <Chip
                label={data.totals.isProfitable ? `Net Profit: PKR ${fmt(data.totals.netProfit)}` : `Net Loss: PKR ${fmt(Math.abs(data.totals.netProfit))}`}
                color={data.totals.isProfitable ? 'success' : 'error'}
                size="medium"
              />
            </Stack>
          </Paper>

          {/* KPI Row */}
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Total Revenue',  value: data.totals.totalRevenue,  color: 'success.main' },
              { label: 'Total Expenses', value: data.totals.totalExpenses, color: 'error.main'   },
              { label: data.totals.isProfitable ? 'Net Profit' : 'Net Loss', value: Math.abs(data.totals.netProfit), color: data.totals.isProfitable ? 'success.main' : 'error.main' },
              { label: 'Profit Margin', value: data.totals.totalRevenue > 0 ? ((data.totals.netProfit / data.totals.totalRevenue) * 100).toFixed(1) + '%' : '—', color: 'text.primary', isText: true },
            ].map(c => (
              <Grid item xs={12} sm={6} md={3} key={c.label}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h6" fontWeight={700} color={c.color}>
                      {c.isText ? c.value : `PKR ${fmt(c.value)}`}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* P&L Sections */}
          <PLSection title="Revenue" rows={data.revenue.rows} total={data.revenue.total} color="#2e7d32" />
          <PLSection title="Expenses" rows={data.expenses.rows} total={data.expenses.total} color="#c62828" />

          {/* Net profit line */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: data.totals.isProfitable ? 'success.50' : 'error.50', borderColor: data.totals.isProfitable ? 'success.300' : 'error.300' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                {data.totals.isProfitable ? 'Net Profit' : 'Net Loss'}
              </Typography>
              <Typography variant="h5" fontWeight={800} color={data.totals.isProfitable ? 'success.main' : 'error.main'}>
                PKR {fmt(Math.abs(data.totals.netProfit))}
              </Typography>
            </Stack>
          </Paper>
        </>
      )}
    </Box>
  );
}
