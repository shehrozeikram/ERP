import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert, Stack, Card, CardContent,
  Grid, TextField, Button, LinearProgress
} from '@mui/material';
import { BarChart as BudgetIcon } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

export default function BudgetVsActual() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [filters, setFilters] = useState({ fromDate: '', toDate: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate)   params.toDate   = filters.toDate;
      const res = await api.get('/finance/reports/budget-vs-actual', { params });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const utilizationColor = (pctVal) => {
    if (pctVal === null || pctVal === undefined) return 'default';
    const used = 100 - pctVal;
    if (used > 100) return 'error';
    if (used > 80)  return 'warning';
    return 'success';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1} mb={3}>
        <BudgetIcon color="primary" /> Budget vs Actual
      </Typography>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filter bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
          <TextField label="From Date" type="date" size="small" value={filters.fromDate}
            onChange={e => setFilters({ ...filters, fromDate: e.target.value })}
            InputLabelProps={{ shrink: true }} />
          <TextField label="To Date" type="date" size="small" value={filters.toDate}
            onChange={e => setFilters({ ...filters, toDate: e.target.value })}
            InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} disabled={loading}>
            {loading ? <CircularProgress size={18} /> : 'Run Report'}
          </Button>
        </Stack>
      </Paper>

      {data && (
        <>
          <Grid container spacing={2} mb={3}>
            {[
              { label: 'Total Budget',   value: fmt(data.totals.budget),   color: 'primary.main' },
              { label: 'Total Actual',   value: fmt(data.totals.actual),   color: data.totals.actual > data.totals.budget ? 'error.main' : 'success.main' },
              { label: 'Total Variance', value: fmt(data.totals.variance), color: data.totals.variance >= 0 ? 'success.main' : 'error.main' }
            ].map(c => (
              <Grid item xs={12} sm={4} key={c.label}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h6" fontWeight={700} color={c.color}>PKR {c.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><b>Cost Center</b></TableCell>
                  <TableCell><b>Code</b></TableCell>
                  <TableCell><b>Department</b></TableCell>
                  <TableCell align="right"><b>Budget (PKR)</b></TableCell>
                  <TableCell align="right"><b>Actual (PKR)</b></TableCell>
                  <TableCell align="right"><b>Variance (PKR)</b></TableCell>
                  <TableCell sx={{ minWidth: 160 }}><b>Utilization</b></TableCell>
                  <TableCell><b>Status</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                    No cost centers with budget data found. Tag journal entries with cost centers to see actuals.
                  </TableCell></TableRow>
                )}
                {data.rows.map(r => {
                  const utilized = r.budget > 0 ? Math.min((r.actual / r.budget) * 100, 100) : 0;
                  return (
                    <TableRow key={r._id} hover sx={{ bgcolor: r.overBudget ? 'error.50' : 'inherit' }}>
                      <TableCell><b>{r.name}</b></TableCell>
                      <TableCell>{r.code}</TableCell>
                      <TableCell>{r.department || '—'}</TableCell>
                      <TableCell align="right">{fmt(r.budget)}</TableCell>
                      <TableCell align="right">{fmt(r.actual)}</TableCell>
                      <TableCell align="right" sx={{ color: r.variance >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                        {r.variance >= 0 ? '+' : ''}{fmt(r.variance)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress variant="determinate" value={utilized}
                            color={r.overBudget ? 'error' : utilized > 80 ? 'warning' : 'success'}
                            sx={{ flex: 1, height: 8, borderRadius: 4 }} />
                          <Typography variant="caption">{pct(r.variancePct !== null ? (100 - r.variancePct) : null)}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={r.overBudget ? 'Over Budget' : 'On Track'} color={r.overBudget ? 'error' : 'success'} size="small" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
