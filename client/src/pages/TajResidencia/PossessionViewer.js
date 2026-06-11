import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  getPossessionStatus,
  getPossessions,
  updatePossession
} from '../../services/landAcquisitionPossessionService';
import { formatKMS } from '../../utils/landAreaUnits';

const PURCHASE_LABELS = {
  not_purchased: { label: 'Not purchased', color: 'default' },
  partial_purchased: { label: 'Partial purchased', color: 'warning' },
  fully_purchased: { label: 'Fully purchased', color: 'success' },
  purchased: { label: 'Purchased', color: 'success' }
};

const POSSESSION_LABELS = {
  not_possessed: { label: 'Not possessed', color: 'default' },
  purchased_not_possessed: { label: 'Purchased, not possessed', color: 'warning' },
  partial_possession: { label: 'Partial possession', color: 'info' },
  fully_possessed: { label: 'Fully possessed', color: 'success' },
  possessed_unregistered: { label: 'Possessed (no registry)', color: 'error' }
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
};

const StatusChip = ({ map, value }) => {
  const cfg = map[value] || { label: value || '—', color: 'default' };
  return <Chip size="small" label={cfg.label} color={cfg.color} variant="outlined" />;
};

const PossessionViewer = () => {
  const [mozas, setMozas] = useState([]);
  const [mozaFilter, setMozaFilter] = useState('');
  const [khewatFilter, setKhewatFilter] = useState('');
  const [statusRows, setStatusRows] = useState([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusSearch, setStatusSearch] = useState('');
  const [statusSearchDebounced, setStatusSearchDebounced] = useState('');

  const [registries, setRegistries] = useState([]);
  const [total, setTotal] = useState(0);
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
    const t = setTimeout(() => setStatusSearchDebounced(statusSearch), 300);
    return () => clearTimeout(t);
  }, [statusSearch]);

  useEffect(() => {
    const t = setTimeout(() => setRecordSearchDebounced(recordSearch), 300);
    return () => clearTimeout(t);
  }, [recordSearch]);

  const loadStatus = useCallback(async () => {
    if (!mozaFilter) {
      setStatusRows([]);
      return;
    }
    setStatusLoading(true);
    try {
      const res = await getPossessionStatus({
        moza: mozaFilter,
        ...(khewatFilter && { khewatNo: khewatFilter }),
        ...(statusSearchDebounced && { search: statusSearchDebounced })
      });
      setStatusRows(res.data?.data?.rows || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load possession status');
    } finally {
      setStatusLoading(false);
    }
  }, [mozaFilter, khewatFilter, statusSearchDebounced]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

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
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load possession records');
    } finally {
      setRecordsLoading(false);
    }
  }, [page, rowsPerPage, mozaFilter, recordSearchDebounced]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const statusByKhasra = useMemo(() => {
    const map = {};
    statusRows.forEach((row) => {
      map[row.khasraEntryId] = row;
    });
    return map;
  }, [statusRows]);

  const khewatOptions = useMemo(() => {
    const set = new Set(statusRows.map((r) => r.khewatNo).filter(Boolean));
    return [...set].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [statusRows]);

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
      await Promise.all([loadRecords(), loadStatus()]);
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
      await Promise.all([loadRecords(), loadStatus()]);
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
          onChange={(e) => { setMozaFilter(e.target.value); setKhewatFilter(''); }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Select mouza</MenuItem>
          {mozas.map((m) => (
            <MenuItem key={m._id} value={m._id}>{m.name}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          select
          label="Khewat"
          value={khewatFilter}
          onChange={(e) => setKhewatFilter(e.target.value)}
          sx={{ minWidth: 120 }}
          disabled={!mozaFilter}
        >
          <MenuItem value="">All</MenuItem>
          {khewatOptions.map((k) => (
            <MenuItem key={k} value={k}>{k}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          placeholder="Search khasra…"
          value={statusSearch}
          onChange={(e) => setStatusSearch(e.target.value)}
          disabled={!mozaFilter}
          sx={{ maxWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            )
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<Add />} onClick={openCreate} disabled={!mozas.length}>
          Add Possession
        </Button>
      </Stack>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Khasra status — purchased vs possessed
      </Typography>

      {!mozaFilter ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">Select a mouza to see purchase and possession status per khasra.</Typography>
        </Paper>
      ) : statusLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, mb: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell><strong>Sr</strong></TableCell>
                <TableCell><strong>Khewat</strong></TableCell>
                <TableCell><strong>Khasra</strong></TableCell>
                <TableCell><strong>Baseline</strong></TableCell>
                <TableCell><strong>Registered</strong></TableCell>
                <TableCell><strong>Possessed</strong></TableCell>
                <TableCell><strong>Purchase</strong></TableCell>
                <TableCell><strong>Possession</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {statusRows.map((row) => (
                <TableRow key={row.khasraEntryId} hover>
                  <TableCell>{row.srNo}</TableCell>
                  <TableCell>{row.khewatNo}</TableCell>
                  <TableCell>{row.khasraNo}</TableCell>
                  <TableCell>{formatKMS(row.baseline)}</TableCell>
                  <TableCell>{formatKMS(row.registered)}</TableCell>
                  <TableCell>{formatKMS(row.possessed)}</TableCell>
                  <TableCell>
                    <StatusChip map={PURCHASE_LABELS} value={row.purchaseStatus} />
                  </TableCell>
                  <TableCell>
                    <StatusChip map={POSSESSION_LABELS} value={row.possessionStatus} />
                  </TableCell>
                </TableRow>
              ))}
              {!statusRows.length && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    No khasra records for this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Possession records
      </Typography>

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
