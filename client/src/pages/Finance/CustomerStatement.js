import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert, Stack, Card, CardContent,
  Grid, TextField, Button, Avatar, Divider, IconButton, Tooltip
} from '@mui/material';
import {
  ArrowBack as BackIcon, People as CustomerIcon,
  Print as PrintIcon, Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_COLOR = { paid: 'success', pending: 'warning', partial: 'info', overdue: 'error', draft: 'default' };

export default function CustomerStatement() {
  const [customers, setCustomers]         = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [statement, setStatement]         = useState(null);
  const [loading, setLoading]             = useState(true);
  const [loading2, setLoading2]           = useState(false);
  const [error, setError]                 = useState('');
  const [filters, setFilters]             = useState({ fromDate: '', toDate: '' });

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/finance/reports/customer-statement');
      setCustomers(res.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const openCustomer = async (customer) => {
    // _id is now the customer name string (from aggregation by customer.name)
    const customerName = typeof customer._id === 'string' ? customer._id : customer.customerName;
    if (!customerName) return;
    setSelectedCustomer({ ...customer, _id: customerName });
    setLoading2(true);
    try {
      const params = {};
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate)   params.toDate   = filters.toDate;
      const res = await api.get(`/finance/reports/customer-statement/${encodeURIComponent(customerName)}`, { params });
      setStatement(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load statement');
    } finally {
      setLoading2(false);
    }
  };

  const back = () => { setSelectedCustomer(null); setStatement(null); };

  // ── Customer List ──────────────────────────────────────────────────────────
  if (!selectedCustomer) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1} mb={3}>
          <CustomerIcon color="primary" /> Customer Statements
        </Typography>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

        <Paper variant="outlined" sx={{ p: 2, mb: 3 }} className="print-hide-toolbar">
          <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
            <TextField label="From Date" type="date" size="small" value={filters.fromDate}
              onChange={e => setFilters(f => ({ ...f, fromDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            <TextField label="To Date" type="date" size="small" value={filters.toDate}
              onChange={e => setFilters(f => ({ ...f, toDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadCustomers}>Refresh</Button>
          </Stack>
        </Paper>

        {loading ? (
          <Box textAlign="center" py={6}><CircularProgress /></Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><b>Customer</b></TableCell>
                  <TableCell align="right"><b>Total Invoiced</b></TableCell>
                  <TableCell align="right"><b>Total Received</b></TableCell>
                  <TableCell align="right"><b>Outstanding Balance</b></TableCell>
                  <TableCell><b>Last Activity</b></TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No customer invoices found
                  </TableCell></TableRow>
                )}
                {customers.map((c, i) => (
                  <TableRow key={i} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1.5}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.100', color: 'primary.main', fontSize: 13 }}>
                          {(c._id || '?')[0]?.toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{c._id || '—'}</Typography>
                          {c.customerEmail && (
                            <Typography variant="caption" color="text.secondary">{c.customerEmail}</Typography>
                          )}
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">PKR {fmt(c.totalInvoiced)}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>PKR {fmt(c.totalReceived)}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} color={c.totalBalance > 0 ? 'error.main' : 'text.secondary'}>
                        PKR {fmt(c.totalBalance)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                      {c.lastActivity ? new Date(c.lastActivity).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined"
                        disabled={!c._id}
                        onClick={() => openCustomer(c)}>
                        View Statement
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  }

  // ── Customer Detail Statement ──────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" gap={1} mb={3} className="print-hide-toolbar">
        <IconButton onClick={back}><BackIcon /></IconButton>
        <Typography variant="h5" fontWeight={700}>
          Customer Statement — {statement?.customer?.name || selectedCustomer?._id || '…'}
        </Typography>
        <Box flex={1} />
        <Tooltip title="Print Statement">
          <IconButton onClick={() => window.print()}><PrintIcon /></IconButton>
        </Tooltip>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Date filter for drill-down */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }} className="print-hide-toolbar">
        <Stack direction="row" gap={2} alignItems="center">
          <TextField label="From Date" type="date" size="small" value={filters.fromDate}
            onChange={e => setFilters(f => ({ ...f, fromDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <TextField label="To Date" type="date" size="small" value={filters.toDate}
            onChange={e => setFilters(f => ({ ...f, toDate: e.target.value }))} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" size="small" onClick={() => openCustomer(selectedCustomer)}>Apply</Button>
        </Stack>
      </Paper>

      {loading2 ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : statement ? (
        <>
          {/* Summary cards */}
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Total Invoiced',   value: statement.summary?.totalInvoiced, color: 'primary.main' },
              { label: 'Total Received',   value: statement.summary?.totalReceived, color: 'success.main' },
              { label: 'Outstanding',      value: statement.summary?.totalBalance,  color: statement.summary?.totalBalance > 0 ? 'error.main' : 'text.secondary' },
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

          {/* Transactions table */}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><b>Invoice #</b></TableCell>
                  <TableCell><b>Date</b></TableCell>
                  <TableCell><b>Due Date</b></TableCell>
                  <TableCell align="right"><b>Invoiced</b></TableCell>
                  <TableCell align="right"><b>Received</b></TableCell>
                  <TableCell align="right"><b>Balance</b></TableCell>
                  <TableCell><b>Status</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(statement.invoices || []).length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>No invoices found</TableCell></TableRow>
                )}
                {(statement.invoices || []).map(inv => {
                  const bal = (inv.totalAmount || inv.amount || 0) - (inv.amountPaid || inv.paidAmount || 0);
                  return (
                    <TableRow key={inv._id} hover>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                        {inv.invoiceDate || inv.createdAt ? new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell align="right">{fmt(inv.totalAmount || inv.amount)}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(inv.amountPaid || inv.paidAmount)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: bal > 0 ? 'error.main' : 'text.secondary' }}>
                        {fmt(bal)}
                      </TableCell>
                      <TableCell>
                        <Chip label={inv.status} size="small" color={STATUS_COLOR[inv.status] || 'default'} />
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Running total row */}
                <TableRow sx={{ bgcolor: 'primary.50' }}>
                  <TableCell colSpan={3} align="right"><b>Totals</b></TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>PKR {fmt(statement.summary?.totalInvoiced)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>PKR {fmt(statement.summary?.totalReceived)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: statement.summary?.totalBalance > 0 ? 'error.main' : 'text.secondary' }}>
                    PKR {fmt(statement.summary?.totalBalance)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}
    </Box>
  );
}
