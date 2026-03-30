import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, Checkbox, CircularProgress, Alert,
  Tooltip, Stack, Card, CardContent, Grid, TextField
} from '@mui/material';
import { AccountBalance as BankIcon, CheckCircle as ReconcileIcon } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BankReconciliation() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState({ asOfDate: new Date().toISOString().split('T')[0] });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { asOfDate: filters.asOfDate };
      const res = await api.get('/finance/reports/bank-reconciliation', { params });
      setData(res.data.data);
      setSelected([]);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

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

  const unreconciled = data?.transactions?.filter(t => !t.isReconciled) || [];

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1}>
          <BankIcon color="primary" /> Bank Reconciliation
        </Typography>
      </Stack>

      {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      {/* Filter bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" gap={2} alignItems="center">
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
            Unreconciled Transactions ({unreconciled.length})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell padding="checkbox"><Checkbox checked={selected.length === unreconciled.length && unreconciled.length > 0} onChange={e => setSelected(e.target.checked ? unreconciled.map(t => t._id) : [])} /></TableCell>
                  <TableCell><b>Date</b></TableCell>
                  <TableCell><b>Description</b></TableCell>
                  <TableCell><b>Reference</b></TableCell>
                  <TableCell><b>Type</b></TableCell>
                  <TableCell align="right"><b>Amount (PKR)</b></TableCell>
                  <TableCell><b>Status</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unreconciled.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'success.main', py: 4 }}>All transactions are reconciled!</TableCell></TableRow>
                )}
                {unreconciled.map(t => (
                  <TableRow key={t._id} hover>
                    <TableCell padding="checkbox"><Checkbox checked={selected.includes(t._id)} onChange={() => toggleSelect(t._id)} /></TableCell>
                    <TableCell>{t.date ? new Date(t.date).toLocaleDateString() : '—'}</TableCell>
                    <TableCell>{t.description || '—'}</TableCell>
                    <TableCell>{t.reference || '—'}</TableCell>
                    <TableCell><Chip label={t.type} color={t.type === 'credit' ? 'success' : 'error'} size="small" /></TableCell>
                    <TableCell align="right">{fmt(t.amount)}</TableCell>
                    <TableCell><Chip label="Unreconciled" color="warning" size="small" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
