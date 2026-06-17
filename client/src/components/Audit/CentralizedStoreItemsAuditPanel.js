import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, MenuItem, Stack, CircularProgress, Alert, Chip, Grid, Card, CardContent
} from '@mui/material';
import { Store as StoreIcon } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CentralizedStoreItemsAuditPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storeName, setStoreName] = useState('Centralized Store');
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [utilityTypeFilter, setUtilityTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/pre-audit/centralized-store-items');
      const data = res.data?.data || {};
      setStoreName(data.store?.name || 'Centralized Store');
      setCategories(data.categories || []);
      setItems(data.items || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load centralized store items');
      setCategories([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const locationOptions = useMemo(() => {
    const values = new Set();
    items.forEach((item) => {
      const loc = String(item.location || '').trim();
      if (loc) values.add(loc);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const siteOptions = useMemo(() => {
    const values = new Set();
    items.forEach((item) => {
      const site = String(item.site || '').trim();
      if (site) values.add(site);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const utilityTypeOptions = useMemo(() => {
    const values = new Set();
    items.forEach((item) => {
      const type = String(item.utilityType || '').trim();
      if (type) values.add(type);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter && String(item.category?._id || item.category) !== String(categoryFilter)) return false;
      if (locationFilter && String(item.location || '').trim() !== locationFilter) return false;
      if (siteFilter && String(item.site || '').trim() !== siteFilter) return false;
      if (utilityTypeFilter && String(item.utilityType || '') !== utilityTypeFilter) return false;
      if (!q) return true;
      const haystack = [
        item.name,
        item.code,
        item.meterNumber,
        item.location,
        item.site,
        item.department,
        item.category?.name,
        item.expenseAccount?.accountNumber,
        item.expenseAccount?.name
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [items, categoryFilter, locationFilter, siteFilter, utilityTypeFilter, search]);

  const totals = useMemo(() => filteredItems.reduce(
    (acc, item) => ({
      count: acc.count + 1,
      amount: acc.amount + Number(item.defaultAmount || 0)
    }),
    { count: 0, amount: 0 }
  ), [filteredItems]);

  const hasFilters = Boolean(categoryFilter || locationFilter || siteFilter || utilityTypeFilter || search.trim());

  const clearFilters = () => {
    setCategoryFilter('');
    setLocationFilter('');
    setSiteFilter('');
    setUtilityTypeFilter('');
    setSearch('');
  };

  return (
    <Paper variant="outlined" sx={{ mb: 3, p: 2, bgcolor: 'grey.50' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <StoreIcon color="primary" />
        <Box>
          <Typography variant="h6" fontWeight={700}>{storeName} — reference for Audit Director</Typography>
          <Typography variant="body2" color="text.secondary">
            Catalog items used on centralized store bills. Filter by category or location while reviewing forwarded documents.
          </Typography>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Items (matching filters)</Typography>
              <Typography variant="h6" fontWeight={700} color="primary.main">{totals.count}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Default amount total (PKR)</Typography>
              <Typography variant="h6" fontWeight={700} color="success.dark">{fmt(totals.amount)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, code, meter, account…"
          sx={{ minWidth: 200 }}
        />
        <TextField
          size="small"
          select
          label="Category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All categories</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label="Location"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All locations</MenuItem>
          {locationOptions.map((loc) => (
            <MenuItem key={loc} value={loc}>{loc}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label="Site"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All sites</MenuItem>
          {siteOptions.map((site) => (
            <MenuItem key={site} value={site}>{site}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label="Utility type"
          value={utilityTypeFilter}
          onChange={(e) => setUtilityTypeFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All types</MenuItem>
          {utilityTypeOptions.map((type) => (
            <MenuItem key={type} value={type}>{type}</MenuItem>
          ))}
        </TextField>
        {hasFilters && (
          <Chip label="Clear filters" onClick={clearFilters} variant="outlined" size="small" clickable />
        )}
      </Stack>

      {loading ? (
        <Box py={4} textAlign="center"><CircularProgress size={28} /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell><b>Category</b></TableCell>
                <TableCell><b>Code</b></TableCell>
                <TableCell><b>Item</b></TableCell>
                <TableCell><b>Type</b></TableCell>
                <TableCell><b>Location</b></TableCell>
                <TableCell><b>Site</b></TableCell>
                <TableCell><b>Meter</b></TableCell>
                <TableCell><b>Account</b></TableCell>
                <TableCell align="right"><b>Default (PKR)</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    {items.length === 0 ? 'No centralized store items configured.' : 'No items match the selected filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item._id} hover>
                    <TableCell>{item.category?.name || '—'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.code || '—'}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.utilityType || '—'}</TableCell>
                    <TableCell>{item.location || '—'}</TableCell>
                    <TableCell>{item.site || '—'}</TableCell>
                    <TableCell>{item.meterNumber || '—'}</TableCell>
                    <TableCell>
                      {item.expenseAccount
                        ? [item.expenseAccount.accountNumber, item.expenseAccount.name].filter(Boolean).join(' — ')
                        : '—'}
                    </TableCell>
                    <TableCell align="right">{fmt(item.defaultAmount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
