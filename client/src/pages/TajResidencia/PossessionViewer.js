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
import { Add, Delete, Edit, Search as SearchIcon, Visibility } from '@mui/icons-material';
import toast from 'react-hot-toast';
import PossessionFormDialog from './PossessionFormDialog';
import PossessionDetailDialog from './PossessionDetailDialog';
import { getMozas } from '../../services/landAcquisitionMozaService';
import {
  createPossession,
  deletePossession,
  getPossessions,
  updatePossession
} from '../../services/landAcquisitionPossessionService';
import { formatKMS } from '../../utils/landAreaUnits';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
};

const PossessionViewer = () => {
  const [mozas, setMozas] = useState([]);
  const [mozaFilter, setMozaFilter] = useState('');

  const [registries, setRegistries] = useState([]);
  const [total, setTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [recordSearch, setRecordSearch] = useState('');
  const [recordSearchDebounced, setRecordSearchDebounced] = useState('');
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [error, setError] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    getMozas().then((res) => {
      const list = res.data?.data || [];
      setMozas(list);
      if (list.length === 1) setMozaFilter(list[0]._id);
    }).catch(() => setMozas([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setRecordSearchDebounced(recordSearch), 300);
    return () => clearTimeout(t);
  }, [recordSearch]);

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    setError('');
    try {
      const res = await getPossessions({
        page: page + 1,
        limit: rowsPerPage,
        ...(mozaFilter && { moza: mozaFilter }),
        ...(recordSearchDebounced && { search: recordSearchDebounced })
      });
      const payload = res.data?.data;
      setRegistries(payload?.possessions || []);
      setTotal(payload?.pagination?.total || 0);
      setGrandTotal(payload?.grandTotal || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load possession records');
    } finally {
      setRecordsLoading(false);
    }
  }, [page, rowsPerPage, mozaFilter, recordSearchDebounced]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);



  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        const res = await updatePossession(editing._id, payload);
        toast.success(res.data?.message || 'Possession updated');
      } else {
        const res = await createPossession(payload);
        toast.success(res.data?.message || 'Possession recorded');
      }
      setDialogOpen(false);
      setEditing(null);
      await loadRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save possession');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm('Delete this possession record?')) return;
    setDeletingId(row._id);
    try {
      const res = await deletePossession(row._id);
      toast.success(res.data?.message || 'Possession deleted');
      await loadRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete possession');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
        <TextField
          size="small"
          select
          label="Moza"
          value={mozaFilter}
          onChange={(e) => setMozaFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Select mouza</MenuItem>
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
              bgcolor: 'success.main',
              color: 'success.contrastText',
              boxShadow: 1
            }}
          >
            <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 500 }}>Grand Total Possessed:</Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              {formatKMS(grandTotal)}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75 }}>(K-M-S)</Typography>
          </Box>
        )}

        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<Add />} onClick={openCreate} disabled={!mozas.length}>
          Add Possession
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search possession ref, khewat…"
          value={recordSearch}
          onChange={(e) => setRecordSearch(e.target.value)}
          sx={{ maxWidth: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            )
          }}
        />
      </Stack>

      {recordsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : !registries.length ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No possession records yet.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Moza</strong></TableCell>
                <TableCell><strong>Khewat</strong></TableCell>
                <TableCell><strong>Ref</strong></TableCell>
                <TableCell><strong>Registry</strong></TableCell>
                <TableCell><strong>Khasra</strong></TableCell>
                <TableCell><strong>Total Possessed</strong></TableCell>
                <TableCell><strong>Lines</strong></TableCell>
                <TableCell align="center" width={128}><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {registries.map((row) => (
                <TableRow key={row._id} hover>
                  <TableCell>{formatDate(row.possessionDate)}</TableCell>
                  <TableCell>{row.moza?.name || '—'}</TableCell>
                  <TableCell>{row.khewatNo}</TableCell>
                  <TableCell>{row.possessionRef || '—'}</TableCell>
                  <TableCell>{row.registry?.registryNo || '—'}</TableCell>
                  <TableCell>{[...new Set((row.lines || []).map((l) => l.khasraNo).filter(Boolean))].join(', ') || '—'}</TableCell>
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

      <PossessionFormDialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        onSave={handleSave}
        possession={editing}
        saving={saving}
      />

      <PossessionDetailDialog
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        possessionId={detailId}
      />
    </Box>
  );
};

export default PossessionViewer;
