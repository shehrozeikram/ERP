import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
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
  Tooltip,
  Typography
} from '@mui/material';
import { Add, Delete, Edit, Search as SearchIcon, Visibility, Download as DownloadIcon } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import RegistryFormDialog from './RegistryFormDialog';
import RegistryDetailDialog from './RegistryDetailDialog';
import { getMozas } from '../../services/landAcquisitionMozaService';
import {
  createRegistry,
  deleteRegistry,
  getRegistries,
  updateRegistry
} from '../../services/landAcquisitionRegistryService';
import { formatKMS } from '../../utils/landAreaUnits';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
};

const RegistryViewer = () => {
  const [registries, setRegistries] = useState([]);
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [detailId, setDetailId] = useState(null);
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

  const loadRegistries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getRegistries({
        page: page + 1,
        limit: rowsPerPage,
        ...(searchDebounced && { search: searchDebounced }),
        ...(mozaFilter && { moza: mozaFilter })
      });
      const payload = res.data?.data;
      setRegistries(payload?.registries || []);
      setTotal(payload?.pagination?.total || 0);
      setGrandTotal(payload?.grandTotal || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load registries');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchDebounced, mozaFilter]);

  useEffect(() => {
    loadRegistries();
  }, [loadRegistries]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleSave = async ({ payload, files = [], removedAttachmentIds = [] }) => {
    setSaving(true);
    try {
      if (editing) {
        const res = await updateRegistry(editing._id, payload, files, removedAttachmentIds);
        toast.success(res.data?.message || 'Registry updated');
      } else {
        const res = await createRegistry(payload, files);
        toast.success(res.data?.message || 'Registry created');
      }
      setDialogOpen(false);
      setEditing(null);
      await loadRegistries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save registry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete registry ${row.registryNo}?`)) return;
    setDeletingId(row._id);
    try {
      const res = await deleteRegistry(row._id);
      toast.success(res.data?.message || 'Registry deleted');
      await loadRegistries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete registry');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await getRegistries({
        page: 1,
        limit: 100000,
        ...(searchDebounced && { search: searchDebounced }),
        ...(mozaFilter && { moza: mozaFilter })
      });
      const data = res.data?.data?.registries || [];
      if (!data.length) {
        toast.error('No data to export');
        setExporting(false);
        return;
      }
      
      const rows = data.map(row => ({
        'Date': formatDate(row.registryDate),
        'Moza': row.moza?.name || '',
        'Khewat No': row.khewatNo || '',
        'Registry No': row.registryNo || '',
        'Inteqal No': row.inteqalNo || '',
        'Dealer': row.dealer?.name || '',
        'Total Acquired': formatKMS(row.totalArea),
        'Total Khasras': row.lines?.length || 0
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Registries");
      XLSX.writeFile(wb, `Registries_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Exported successfully');
    } catch (err) {
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
        <TextField
          size="small"
          placeholder="Search registry no, inteqal, khewat…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ maxWidth: 280 }}
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
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 2,
              py: 0.75,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              boxShadow: 1
            }}
          >
            <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 500 }}>Grand Total Acquired:</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              {formatKMS(grandTotal)}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75 }}>(K-M-S)</Typography>
          </Box>
        )}

        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />} onClick={handleExport} disabled={exporting || loading}>
          Export
        </Button>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add Registry
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : !registries.length ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" gutterBottom>
            No registries yet. Record a legal purchase linked to mouza khasra records.
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate} sx={{ mt: 2 }}>
            Add Registry
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Moza</strong></TableCell>
                <TableCell><strong>Khewat</strong></TableCell>
                <TableCell><strong>Registry No.</strong></TableCell>
                <TableCell><strong>Inteqal No.</strong></TableCell>
                <TableCell><strong>Dealer</strong></TableCell>
                <TableCell><strong>Total Acquired</strong></TableCell>
                <TableCell><strong>Lines</strong></TableCell>
                <TableCell align="center" width={128}><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {registries.map((row) => (
                <TableRow key={row._id} hover>
                  <TableCell>{formatDate(row.registryDate)}</TableCell>
                  <TableCell>{row.moza?.name || '—'}</TableCell>
                  <TableCell>{row.khewatNo}</TableCell>
                  <TableCell>{row.registryNo}</TableCell>
                  <TableCell>{row.inteqalNo || '—'}</TableCell>
                  <TableCell>{row.dealer?.name || '—'}</TableCell>
                  <TableCell>{formatKMS(row.totalArea)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={`${row.lines?.length || 0} khasra`} variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View details">
                      <IconButton size="small" onClick={() => setDetailId(row._id)}>
                        <Visibility fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(row)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(row)}
                          disabled={deletingId === row._id}
                        >
                          {deletingId === row._id ? <CircularProgress size={16} /> : <Delete fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </TableContainer>
      )}

      <RegistryFormDialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        onSave={handleSave}
        registry={editing}
        saving={saving}
      />

      <RegistryDetailDialog
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        registryId={detailId}
      />
    </Box>
  );
};

export default RegistryViewer;
