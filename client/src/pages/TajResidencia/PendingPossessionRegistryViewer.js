import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Download as DownloadIcon, Search as SearchIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { getMozas } from '../../services/landAcquisitionMozaService';
import { getPendingPossessionRegistries } from '../../services/landAcquisitionRegistryService';
import { formatKMS } from '../../utils/landAreaUnits';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
};

const STICKY_HEAD_SX = { bgcolor: 'grey.50', fontWeight: 700 };

const PendingPossessionRegistryViewer = () => {
  const [rows, setRows] = useState([]);
  const [mozas, setMozas] = useState([]);
  const [total, setTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [mozaFilter, setMozaFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [searchDebounced, mozaFilter]);

  useEffect(() => {
    getMozas().then((res) => setMozas(res.data?.data || [])).catch(() => setMozas([]));
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getPendingPossessionRegistries({
        page: page + 1,
        limit: rowsPerPage,
        ...(searchDebounced && { search: searchDebounced }),
        ...(mozaFilter && { moza: mozaFilter })
      });
      const payload = res.data?.data;
      setRows(payload?.registries || []);
      setTotal(payload?.pagination?.total || 0);
      setGrandTotal(payload?.grandTotal || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load pending possession registries');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchDebounced, mozaFilter]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await getPendingPossessionRegistries({
        page: 1,
        limit: 100000,
        ...(searchDebounced && { search: searchDebounced }),
        ...(mozaFilter && { moza: mozaFilter })
      });
      const data = res.data?.data?.registries || [];
      if (!data.length) {
        toast.error('No data to export');
        return;
      }

      const exportRows = data.map((row, idx) => ({
        '#': idx + 1,
        Date: formatDate(row.registryDate),
        'Deal No': row.dealNo || '',
        Moza: row.moza?.name || '',
        'Khewat No': row.khewatNo || '',
        'Registry No': row.registryNo || '',
        'Inteqal No': row.inteqalNo || '',
        Seller: row.seller?.name || '',
        Purchaser: row.purchaser?.name || '',
        Dealer: row.dealer?.name || '',
        Khasras: row.khasras || '',
        'Registered Area': formatKMS(row.registeredArea),
        Possessed: formatKMS(row.possessedArea),
        'Pending Possession': formatKMS(row.pendingPossession),
        Status: row.isFullyPending ? 'Not Possessed' : 'Partially Possessed'
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pending Possession');
      XLSX.writeFile(wb, `Pending_Possession_Registries_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Exported successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Registries that exist but are not fully possessed (registered holding minus attributed possession).
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mb: 2 }}
        alignItems={{ sm: 'center' }}
        flexWrap="wrap"
        useFlexGap
      >
        <TextField
          size="small"
          placeholder="Search registry no, inteqal, khewat…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '1 1 200px', maxWidth: { sm: 280 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            )
          }}
        />
        <TextField
          size="small"
          select
          label="Moza"
          value={mozaFilter}
          onChange={(e) => setMozaFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All mouzas</MenuItem>
          {mozas.map((m) => (
            <MenuItem key={m._id} value={m._id}>{m.name}</MenuItem>
          ))}
        </TextField>

        {grandTotal && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Box sx={{ px: 1.25, py: 0.5, borderRadius: 1, bgcolor: 'grey.100', border: '1px solid', borderColor: 'grey.300' }}>
              <Typography variant="caption" color="text.secondary" display="block" fontWeight={600}>
                Registries
              </Typography>
              <Typography variant="body2" fontWeight={700}>{grandTotal.count || 0}</Typography>
            </Box>
            <Box sx={{ px: 1.25, py: 0.5, borderRadius: 1, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
              <Typography variant="caption" color="success.main" display="block" fontWeight={600}>
                Registered
              </Typography>
              <Typography variant="body2" fontWeight={700} color="success.dark">
                {formatKMS(grandTotal.registered)}
              </Typography>
            </Box>
            <Box sx={{ px: 1.25, py: 0.5, borderRadius: 1, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
              <Typography variant="caption" color="primary.main" display="block" fontWeight={600}>
                Possessed
              </Typography>
              <Typography variant="body2" fontWeight={700} color="primary.dark">
                {formatKMS(grandTotal.possessed)}
              </Typography>
            </Box>
            <Box sx={{ px: 1.25, py: 0.5, borderRadius: 1, bgcolor: 'error.50', border: '1px solid', borderColor: 'error.200' }}>
              <Typography variant="caption" color="error.main" display="block" fontWeight={600}>
                Pending Possession
              </Typography>
              <Typography variant="body2" fontWeight={700} color="error.dark">
                {formatKMS(grandTotal.pendingPossession)}
              </Typography>
            </Box>
          </Stack>
        )}

        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
          onClick={handleExport}
          disabled={exporting || loading}
        >
          Export
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : !rows.length ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No registries with pending possession found for the selected filters.
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <TableContainer
            sx={{
              maxHeight: 'min(70vh, 720px)',
              overflowX: 'auto',
              overflowY: 'auto'
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={STICKY_HEAD_SX}>Date</TableCell>
                  <TableCell sx={STICKY_HEAD_SX}>Deal</TableCell>
                  <TableCell sx={STICKY_HEAD_SX}>Moza</TableCell>
                  <TableCell sx={STICKY_HEAD_SX}>Khewat</TableCell>
                  <TableCell sx={STICKY_HEAD_SX}>Registry</TableCell>
                  <TableCell sx={STICKY_HEAD_SX}>Inteqal</TableCell>
                  <TableCell sx={STICKY_HEAD_SX}>Seller</TableCell>
                  <TableCell sx={STICKY_HEAD_SX}>Khasras</TableCell>
                  <TableCell sx={STICKY_HEAD_SX} align="right">Registered</TableCell>
                  <TableCell sx={STICKY_HEAD_SX} align="right">Possessed</TableCell>
                  <TableCell sx={STICKY_HEAD_SX} align="right">Pending Possession</TableCell>
                  <TableCell sx={STICKY_HEAD_SX} align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row._id} hover>
                    <TableCell>{formatDate(row.registryDate)}</TableCell>
                    <TableCell>{row.dealNo ? `#${row.dealNo}` : '—'}</TableCell>
                    <TableCell>{row.moza?.name || '—'}</TableCell>
                    <TableCell>{row.khewatNo || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{row.registryNo || '—'}</Typography>
                    </TableCell>
                    <TableCell>{row.inteqalNo || '—'}</TableCell>
                    <TableCell>{row.seller?.name || '—'}</TableCell>
                    <TableCell sx={{ maxWidth: 180 }}>
                      <Typography variant="body2" noWrap title={row.khasras || ''}>
                        {row.khasras || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600} color="success.dark">
                        {formatKMS(row.registeredArea)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600} color="primary.dark">
                        {formatKMS(row.possessedArea)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={700} color="error.dark">
                        {formatKMS(row.pendingPossession)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={row.isFullyPending ? 'Not Possessed' : 'Partial'}
                        color={row.isFullyPending ? 'error' : 'warning'}
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>
      )}
    </Box>
  );
};

export default PendingPossessionRegistryViewer;
