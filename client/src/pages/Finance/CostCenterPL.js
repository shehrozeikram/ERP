import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Button, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  TextField, FormControl, InputLabel, Select, MenuItem, Stack, Collapse,
  Card, CardContent, IconButton, Tooltip
} from '@mui/material';
import {
  AccountTree as CostCenterIcon, PictureAsPdf as PdfIcon, TableView as ExcelIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon
} from '@mui/icons-material';
import api from '../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function DeptSection({ dept, data }) {
  const [open, setOpen] = useState(true);
  const profit = (data.netProfit || 0);
  return (
    <Box mb={2}>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {/* Header row */}
        <Box
          display="flex" alignItems="center" justifyContent="space-between"
          px={2} py={1.2}
          sx={{ bgcolor: 'primary.50', borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer' }}
          onClick={() => setOpen(v => !v)}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton size="small">{open ? <CollapseIcon /> : <ExpandIcon />}</IconButton>
            <Typography variant="subtitle1" fontWeight={800} color="primary.dark">{dept}</Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Chip label={`Revenue: ${fmt(data.totalRevenue)}`} size="small" color="success" />
            <Chip label={`Expenses: ${fmt(data.totalExpenses)}`} size="small" color="error" />
            <Chip
              label={`Net: ${fmt(profit)}`} size="small"
              color={profit >= 0 ? 'primary' : 'error'}
              sx={{ fontWeight: 800 }}
            />
          </Stack>
        </Box>

        <Collapse in={open}>
          <Table size="small">
            <TableBody>
              {/* Revenue */}
              <TableRow sx={{ bgcolor: 'success.50' }}>
                <TableCell colSpan={2} sx={{ fontWeight: 700, color: 'success.dark', pl: 3 }}>Revenue</TableCell>
              </TableRow>
              {(data.revenue || []).map((r, i) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ pl: 5 }}>
                    <Typography variant="body2">{r.accountName}</Typography>
                    <Typography variant="caption" color="text.disabled">{r.accountNumber}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'success.main' }}>
                    {fmt(r.balance)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: 'success.100' }}>
                <TableCell sx={{ fontWeight: 800, pl: 3 }}>Total Revenue</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'success.dark' }}>
                  {fmt(data.totalRevenue)}
                </TableCell>
              </TableRow>

              {/* Expenses */}
              <TableRow sx={{ bgcolor: 'error.50' }}>
                <TableCell colSpan={2} sx={{ fontWeight: 700, color: 'error.dark', pl: 3 }}>Expenses</TableCell>
              </TableRow>
              {(data.expenses || []).map((r, i) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ pl: 5 }}>
                    <Typography variant="body2">{r.accountName}</Typography>
                    <Typography variant="caption" color="text.disabled">{r.accountNumber}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'error.main' }}>
                    {fmt(r.balance)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: 'error.100' }}>
                <TableCell sx={{ fontWeight: 800, pl: 3 }}>Total Expenses</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'error.dark' }}>
                  {fmt(data.totalExpenses)}
                </TableCell>
              </TableRow>

              {/* Net */}
              <TableRow sx={{ bgcolor: profit >= 0 ? 'primary.50' : 'error.50' }}>
                <TableCell sx={{ fontWeight: 900, pl: 3, fontSize: 14 }}>NET PROFIT / (LOSS)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, fontFamily: 'monospace', fontSize: 15,
                  color: profit >= 0 ? 'success.dark' : 'error.dark' }}>
                  {fmt(profit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Collapse>
      </Paper>
    </Box>
  );
}

export default function CostCenterPL() {
  const [departments, setDepts]   = useState([]);
  const [selDept, setSelDept]     = useState('');
  const [fromDate, setFromDate]   = useState(`${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate]       = useState(new Date().toISOString().split('T')[0]);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Load department list
  useEffect(() => {
    api.get('/finance/reports/department-pl').then(r => {
      setDepts(r.data.data?.departments || []);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const res = await api.get('/finance/reports/department-pl', {
        params: { department: selDept || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined }
      });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [selDept, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const byDept = data?.byDept || {};
  const deptKeys = Object.keys(byDept).sort();

  const totals = deptKeys.reduce((acc, d) => ({
    totalRevenue:  acc.totalRevenue  + (byDept[d].totalRevenue  || 0),
    totalExpenses: acc.totalExpenses + (byDept[d].totalExpenses || 0),
    netProfit:     acc.netProfit     + (byDept[d].netProfit     || 0)
  }), { totalRevenue: 0, totalExpenses: 0, netProfit: 0 });

  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Cost Center / Department P&L', 14, 18);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${fromDate} to ${toDate}${selDept ? ` | Dept: ${selDept}` : ''}`, 14, 26);
    const rows = [];
    deptKeys.forEach(dept => {
      rows.push([`--- ${dept} ---`, '', '']);
      byDept[dept].revenue.forEach(r => rows.push([`  ${r.accountName}`, 'Revenue', fmt(r.balance)]));
      rows.push([`  Total Revenue`, '', fmt(byDept[dept].totalRevenue)]);
      byDept[dept].expenses.forEach(r => rows.push([`  ${r.accountName}`, 'Expense', fmt(r.balance)]));
      rows.push([`  Total Expenses`, '', fmt(byDept[dept].totalExpenses)]);
      rows.push([`  NET PROFIT`, '', fmt(byDept[dept].netProfit)]);
      rows.push(['', '', '']);
    });
    autoTable(doc, { head: [['Account', 'Type', 'Amount (PKR)']], body: rows, startY: 30, styles: { fontSize: 8 }, headStyles: { fillColor: [21, 101, 192] } });
    doc.save('CostCenter-PL.pdf');
  };

  const exportExcel = () => {
    if (!data) return;
    const rows = [['Department', 'Account', 'Type', 'Amount']];
    deptKeys.forEach(dept => {
      byDept[dept].revenue.forEach(r => rows.push([dept, r.accountName, 'Revenue', r.balance]));
      rows.push([dept, 'Total Revenue', '', byDept[dept].totalRevenue]);
      byDept[dept].expenses.forEach(r => rows.push([dept, r.accountName, 'Expense', r.balance]));
      rows.push([dept, 'Total Expenses', '', byDept[dept].totalExpenses]);
      rows.push([dept, 'NET PROFIT', '', byDept[dept].netProfit]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Dept PL');
    XLSX.writeFile(wb, 'CostCenter-PL.xlsx');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} className="print-hide-toolbar">
        <Box display="flex" alignItems="center" gap={1}>
          <CostCenterIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Cost Center / Department P&L</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" startIcon={<PdfIcon />} onClick={exportPDF} disabled={!data}>PDF</Button>
          <Button variant="outlined" size="small" startIcon={<ExcelIcon />} onClick={exportExcel} disabled={!data} color="success">Excel</Button>
        </Stack>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }} className="print-hide-toolbar">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select value={selDept} label="Department" onChange={e => setSelDept(e.target.value)}>
                <MenuItem value="">All Departments</MenuItem>
                {departments.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="From Date" type="date"
              value={fromDate} onChange={e => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="To Date" type="date"
              value={toDate} onChange={e => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={3} display="flex" justifyContent="flex-end">
            <Button variant="contained" onClick={load} disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CostCenterIcon />}>
              {loading ? 'Loading…' : 'Generate'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Grand totals */}
      {data && deptKeys.length > 0 && (
        <>
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Total Revenue', value: totals.totalRevenue, color: 'success.main' },
              { label: 'Total Expenses', value: totals.totalExpenses, color: 'error.main' },
              { label: 'Net Profit', value: totals.netProfit, color: totals.netProfit >= 0 ? 'success.main' : 'error.main' },
              { label: 'Departments', value: deptKeys.length, color: 'primary.main', raw: true }
            ].map(c => (
              <Grid item xs={6} sm={3} key={c.label}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h6" fontWeight={800} color={c.color}>
                      {c.raw ? c.value : `PKR ${fmt(c.value)}`}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {deptKeys.map(dept => (
            <DeptSection key={dept} dept={dept} data={byDept[dept]} />
          ))}
        </>
      )}

      {data && deptKeys.length === 0 && (
        <Alert severity="info">No posted revenue or expense transactions found for the selected filters.</Alert>
      )}
    </Box>
  );
}
