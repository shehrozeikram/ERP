import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert, Stack, Card, CardContent,
  Grid, TextField, Button, LinearProgress
} from '@mui/material';
import { HourglassBottom as AgedIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUCKETS = [
  { key: 'current',   label: 'Current (Not Due)', color: 'success' },
  { key: 'days1_30',  label: '1–30 Days',         color: 'info'    },
  { key: 'days31_60', label: '31–60 Days',         color: 'warning' },
  { key: 'days61_90', label: '61–90 Days',         color: 'error'   },
  { key: 'over90',    label: 'Over 90 Days',       color: 'error'   }
];

const BUCKET_BAR_COLOR = {
  current:   '#2e7d32',
  days1_30:  '#0288d1',
  days31_60: '#f57c00',
  days61_90: '#c62828',
  over90:    '#7b1fa2'
};

export default function AgedReceivables() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/finance/reports/aged-receivables', { params: { asOfDate } });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load aged receivables');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  const totalOutstanding = data
    ? Object.values(data.buckets).reduce((s, v) => s + (v || 0), 0)
    : 0;

  const bucketPct = (key) =>
    totalOutstanding > 0 ? Math.round(((data?.buckets?.[key] || 0) / totalOutstanding) * 100) : 0;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1} mb={3}>
        <AgedIcon color="primary" /> Aged Receivables
      </Typography>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filter */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" gap={2} alignItems="center">
          <TextField label="As of Date" type="date" size="small" value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} disabled={loading} startIcon={<RefreshIcon />}>
            {loading ? 'Loading…' : 'Generate'}
          </Button>
        </Stack>
      </Paper>

      {loading && <Box textAlign="center" py={6}><CircularProgress /></Box>}

      {!loading && !data && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">Select a date and click Generate to view Aged Receivables.</Typography>
        </Paper>
      )}

      {data && (
        <>
          {/* Aging bucket summary cards */}
          <Grid container spacing={2} mb={3}>
            {BUCKETS.map(b => (
              <Grid item xs={12} sm={6} md key={b.key}>
                <Card variant="outlined" sx={{ borderTop: 4, borderColor: BUCKET_BAR_COLOR[b.key] }}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" display="block">{b.label}</Typography>
                    <Typography variant="h6" fontWeight={700} color={BUCKET_BAR_COLOR[b.key]}>
                      PKR {fmt(data.buckets[b.key])}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={bucketPct(b.key)}
                      sx={{ mt: 0.5, height: 4, borderRadius: 2,
                        bgcolor: 'grey.100',
                        '& .MuiLinearProgress-bar': { bgcolor: BUCKET_BAR_COLOR[b.key] }
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">{bucketPct(b.key)}% of total</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Total outstanding */}
          <Paper variant="outlined" sx={{ p: 1.5, mb: 3, bgcolor: 'primary.50', borderColor: 'primary.200' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography fontWeight={700} color="primary.main">Total Outstanding Receivables</Typography>
              <Typography variant="h5" fontWeight={800} color="primary.main">PKR {fmt(totalOutstanding)}</Typography>
            </Stack>
          </Paper>

          {/* Detail table */}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><b>Invoice #</b></TableCell>
                  <TableCell><b>Customer</b></TableCell>
                  <TableCell><b>Due Date</b></TableCell>
                  <TableCell align="right"><b>Balance (PKR)</b></TableCell>
                  <TableCell align="center"><b>Days Outstanding</b></TableCell>
                  <TableCell><b>Aging Bucket</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No outstanding receivables — all invoices are current or paid
                    </TableCell>
                  </TableRow>
                )}
                {data.rows
                  .sort((a, b) => b.daysOutstanding - a.daysOutstanding)
                  .map(row => {
                    const bucket = BUCKETS.find(b => b.key === row.bucket);
                    return (
                      <TableRow key={row._id} hover>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{row.reference || '—'}</TableCell>
                        <TableCell>{row.customer?.name || '—'}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                          {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: row.daysOutstanding > 60 ? 'error.main' : 'inherit' }}>
                          {fmt(row.balance)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={row.daysOutstanding > 0 ? `${row.daysOutstanding} days` : 'Not due'}
                            size="small"
                            sx={{
                              bgcolor: BUCKET_BAR_COLOR[row.bucket] + '18',
                              color: BUCKET_BAR_COLOR[row.bucket],
                              fontWeight: 700,
                              border: `1px solid ${BUCKET_BAR_COLOR[row.bucket]}40`
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip label={bucket?.label || row.bucket} size="small" color={bucket?.color || 'default'} />
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {/* Totals */}
                {data.rows.length > 0 && (
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell colSpan={3} align="right"><b>Total Outstanding</b></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main' }}>
                      <b>PKR {fmt(totalOutstanding)}</b>
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
