import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, CircularProgress, Alert, Stack, Card, CardContent,
  Grid, TextField, Button
} from '@mui/material';
import { Warning as AgedIcon } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BUCKETS = [
  { key: 'current',   label: 'Current',    color: 'success' },
  { key: 'days1_30',  label: '1–30 Days',  color: 'info' },
  { key: 'days31_60', label: '31–60 Days', color: 'warning' },
  { key: 'days61_90', label: '61–90 Days', color: 'error' },
  { key: 'over90',    label: 'Over 90',    color: 'error' }
];

export default function AgedPayables() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/finance/reports/aged-payables', { params: { asOfDate } });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  const bucketColor = (b) => BUCKETS.find(x => x.key === b)?.color || 'default';

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1} mb={3}>
        <AgedIcon color="error" /> Aged Payables
      </Typography>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" gap={2} alignItems="center">
          <TextField label="As of Date" type="date" size="small" value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load} disabled={loading}>
            {loading ? <CircularProgress size={18} /> : 'Run Report'}
          </Button>
        </Stack>
      </Paper>

      {data && (
        <>
          <Grid container spacing={2} mb={3}>
            {BUCKETS.map(b => (
              <Grid item xs={12} sm={6} md={2.4} key={b.key}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">{b.label}</Typography>
                    <Typography variant="h6" fontWeight={700} color={`${b.color}.main`}>PKR {fmt(data.buckets[b.key])}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell><b>Reference</b></TableCell>
                  <TableCell><b>Supplier</b></TableCell>
                  <TableCell><b>Due Date</b></TableCell>
                  <TableCell align="right"><b>Balance (PKR)</b></TableCell>
                  <TableCell align="right"><b>Days Outstanding</b></TableCell>
                  <TableCell><b>Aging Bucket</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>No outstanding payables</TableCell></TableRow>
                )}
                {data.rows.map(r => (
                  <TableRow key={r._id} hover>
                    <TableCell>{r.reference || '—'}</TableCell>
                    <TableCell>{r.supplier?.name || '—'}</TableCell>
                    <TableCell>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main', fontWeight: 600 }}>{fmt(r.balance)}</TableCell>
                    <TableCell align="right">{r.daysOutstanding}</TableCell>
                    <TableCell>
                      <Chip label={BUCKETS.find(b => b.key === r.bucket)?.label || r.bucket} color={bucketColor(r.bucket)} size="small" />
                    </TableCell>
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
