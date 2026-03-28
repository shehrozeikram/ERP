import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, CircularProgress, Alert,
  Stack, TextField, InputAdornment, Accordion, AccordionSummary,
  AccordionDetails, Divider, Card, CardContent, Grid
} from '@mui/material';
import {
  Inventory as InventoryIcon, Search as SearchIcon,
  ExpandMore as ExpandMoreIcon, Refresh as RefreshIcon,
  TrendingUp as ValueIcon, Warning as WarningIcon
} from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n || 0);

export default function InventoryValuation() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search) params.search = search;
      const res = await api.get('/finance/reports/inventory-valuation', { params });
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load inventory valuation');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary || {};
  const categories = data?.byCategory || [];
  const variance = summary.variance;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <InventoryIcon color="primary" sx={{ fontSize: 30 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>Inventory Valuation</Typography>
            <Typography variant="body2" color="text.secondary">
              Stock on hand valued at Weighted Average Cost (WAC)
            </Typography>
          </Box>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderLeft: '4px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Items</Typography>
              <Typography variant="h4" fontWeight={700}>{summary.totalItems || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderLeft: '4px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Inventory Value (WAC)</Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">{fmt(summary.grandTotalValue)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderLeft: '4px solid', borderColor: 'info.main' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">GL Inventory Balance</Typography>
              <Typography variant="h5" fontWeight={700} color="info.main">
                {summary.glInventoryBalance !== null ? fmt(summary.glInventoryBalance) : 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderLeft: '4px solid', borderColor: variance !== null && Math.abs(variance) > 1 ? 'error.main' : 'success.main' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {variance !== null && Math.abs(variance) > 1 && <WarningIcon fontSize="small" color="error" />}
                Variance (WAC vs GL)
              </Typography>
              <Typography variant="h5" fontWeight={700} color={variance !== null && Math.abs(variance) > 1 ? 'error.main' : 'success.main'}>
                {variance !== null ? fmt(variance) : 'N/A'}
              </Typography>
              {variance !== null && Math.abs(variance) < 1 && (
                <Typography variant="caption" color="success.main">Books are in sync ✓</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search */}
      <TextField
        placeholder="Search by item name or code…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 2, width: 320 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : categories.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          No inventory items with stock on hand.
        </Paper>
      ) : (
        categories.map((cat) => (
          <Accordion key={cat.name} defaultExpanded elevation={2} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'grey.50' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%', pr: 2 }}>
                <Typography fontWeight={700}>{cat.name}</Typography>
                <Stack direction="row" gap={3} alignItems="center">
                  <Typography variant="body2" color="text.secondary">{cat.items.length} item(s)</Typography>
                  <Typography fontWeight={700} color="primary.main">{fmt(cat.totalValue)}</Typography>
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      {['Item Code', 'Name', 'Store', 'Qty', 'Unit Price', 'WAC', 'Total Value (WAC)', 'GL Account'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cat.items.map((item) => (
                      <TableRow key={item.itemCode} hover>
                        <TableCell><Typography fontFamily="monospace" fontSize="0.75rem">{item.itemCode}</Typography></TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{item.store}</TableCell>
                        <TableCell align="right"><Typography fontWeight={600}>{item.quantity}</Typography></TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary' }}>{fmt(item.unitPrice)}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={fmt(item.weightedAverageCost)}
                            color={item.weightedAverageCost !== item.unitPrice ? 'warning' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right"><Typography fontWeight={700} color="primary.main">{fmt(item.totalValue)}</Typography></TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>{item.inventoryAccount}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell colSpan={6} align="right"><Typography fontWeight={700}>Category Total</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700} color="primary.main">{fmt(cat.totalValue)}</Typography></TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))
      )}
    </Box>
  );
}
