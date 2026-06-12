import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
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
import { Add, CloudUpload, Delete, Edit, ExpandMore, Search as SearchIcon } from '@mui/icons-material';
import toast from 'react-hot-toast';
import MozaKhasraEntryDialog, { AREA_FIELDS } from './MozaKhasraEntryDialog';
import { formatKMS, normalizeArea, parseAreaForm, addAreas } from '../../utils/landAreaUnits';
import {
  getMozas,
  getMozaEntries,
  getMozaEntriesMeta,
  createMoza,
  updateMoza,
  deleteMoza,
  createMozaEntry,
  updateMozaEntry,
  deleteMozaEntry,
  importMozaExcel
} from '../../services/landAcquisitionMozaService';

const AREA_COLUMNS = AREA_FIELDS;

const TABLE_HEAD_SX = {
  fontWeight: 700,
  fontSize: '0.9rem',
  lineHeight: 1.3,
  whiteSpace: 'nowrap'
};

const KMS_CELL_SX = {
  px: 0.5,
  py: 1,
  width: 40,
  minWidth: 40,
  maxWidth: 48,
  fontSize: '0.8125rem'
};

const sumAreas = (entries, key) =>
  addAreas(...entries.map((row) => normalizeArea(row[key])));

const formToPayload = (form) => {
  const payload = {
    srNo: Number(form.srNo) || undefined,
    khasraNo: form.khasraNo.trim(),
    khewatNo: form.khewatNo.trim(),
    mozaRef: form.mozaRef.trim()
  };
  AREA_COLUMNS.forEach(({ key }) => {
    payload[key] = parseAreaForm(form[key]);
  });
  return payload;
};

const MozaEntriesTable = ({ mozaId, mozaName, active, onEntryCountChange }) => {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [suggestedSrNo, setSuggestedSrNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [searchDebounced, mozaId]);

  const loadEntries = useCallback(async () => {
    if (!mozaId || !active) return;
    setLoading(true);
    setError('');
    try {
      const res = await getMozaEntries(mozaId, {
        page: page + 1,
        limit: rowsPerPage,
        ...(searchDebounced && { search: searchDebounced })
      });
      const payload = res.data?.data;
      setEntries(payload?.entries || []);
      setTotal(payload?.pagination?.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load khasra records');
    } finally {
      setLoading(false);
    }
  }, [mozaId, active, page, rowsPerPage, searchDebounced]);

  useEffect(() => {
    if (active) loadEntries();
  }, [loadEntries, active]);

  const openAddDialog = async () => {
    try {
      const res = await getMozaEntriesMeta(mozaId);
      setSuggestedSrNo(res.data?.data?.nextSrNo || 1);
    } catch {
      setSuggestedSrNo('');
    }
    setEditingEntry(null);
    setEntryDialogOpen(true);
  };

  const openEditDialog = (entry) => {
    setEditingEntry(entry);
    setSuggestedSrNo('');
    setEntryDialogOpen(true);
  };

  const handleSaveEntry = async (form) => {
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (editingEntry) {
        const res = await updateMozaEntry(mozaId, editingEntry._id, payload);
        toast.success(res.data?.message || 'Record updated');
      } else {
        const res = await createMozaEntry(mozaId, payload);
        toast.success(res.data?.message || 'Record added');
        if (res.data?.data?.entryCount != null) {
          onEntryCountChange?.(mozaId, res.data.data.entryCount);
        }
      }
      setEntryDialogOpen(false);
      setEditingEntry(null);
      await loadEntries();
      if (editingEntry) return;
      const metaRes = await getMozaEntriesMeta(mozaId);
      onEntryCountChange?.(mozaId, metaRes.data?.data?.total);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete Sr No ${entry.srNo} (Khewat ${entry.khewatNo}, Khasra ${entry.khasraNo})?`)) return;
    setDeletingId(entry._id);
    try {
      const res = await deleteMozaEntry(mozaId, entry._id);
      toast.success(res.data?.message || 'Record deleted');
      if (res.data?.data?.entryCount != null) {
        onEntryCountChange?.(mozaId, res.data.data.entryCount);
      }
      await loadEntries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete record');
    } finally {
      setDeletingId(null);
    }
  };

  const totals = useMemo(() => sumAreas(entries, 'landInKhasra'), [entries]);

  if (!active) return null;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search khasra, khewat, moza ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ maxWidth: 400 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            )
          }}
        />
        <Button variant="contained" size="small" startIcon={<Add />} onClick={openAddDialog} sx={{ flexShrink: 0 }}>
          Add Khasra Record
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 'min(72vh, 720px)', minHeight: 420, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Table size="small" stickyHeader sx={{ tableLayout: 'auto' }}>
            <TableHead>
              <TableRow>
                <TableCell rowSpan={2} sx={TABLE_HEAD_SX}>Sr No</TableCell>
                <TableCell rowSpan={2} sx={TABLE_HEAD_SX}>Khewat No.</TableCell>
                <TableCell rowSpan={2} sx={TABLE_HEAD_SX}>Khasra No.</TableCell>
                {AREA_COLUMNS.map((col) => (
                  <TableCell key={col.key} align="center" colSpan={3} sx={{ ...TABLE_HEAD_SX, px: 0.5 }}>
                    {col.label}
                  </TableCell>
                ))}
                <TableCell rowSpan={2} align="center" width={88} sx={TABLE_HEAD_SX}>Actions</TableCell>
              </TableRow>
              <TableRow>
                {AREA_COLUMNS.map((col) => (
                  <React.Fragment key={`${col.key}-sub`}>
                    <TableCell align="right" sx={{ ...TABLE_HEAD_SX, ...KMS_CELL_SX }}>K</TableCell>
                    <TableCell align="right" sx={{ ...TABLE_HEAD_SX, ...KMS_CELL_SX }}>M</TableCell>
                    <TableCell align="right" sx={{ ...TABLE_HEAD_SX, ...KMS_CELL_SX }}>S</TableCell>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((row) => (
                <TableRow key={row._id} hover>
                  <TableCell>{row.srNo}</TableCell>
                  <TableCell>{row.khewatNo}</TableCell>
                  <TableCell>{row.khasraNo}</TableCell>
                  {AREA_COLUMNS.map((col) => {
                    const a = normalizeArea(row[col.key]);
                    return (
                      <React.Fragment key={`${row._id}-${col.key}`}>
                        <TableCell align="right" sx={KMS_CELL_SX}>{a.kanal || '—'}</TableCell>
                        <TableCell align="right" sx={KMS_CELL_SX}>{a.marla || '—'}</TableCell>
                        <TableCell align="right" sx={KMS_CELL_SX}>{a.sarsai || '—'}</TableCell>
                      </React.Fragment>
                    );
                  })}
                  <TableCell align="center" padding="checkbox">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(row)}>
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
              {entries.length > 0 && (
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell colSpan={3}><strong>Page subtotal (Land in Khasra)</strong></TableCell>
                  <TableCell align="right" sx={KMS_CELL_SX}><strong>{totals.kanal || '—'}</strong></TableCell>
                  <TableCell align="right" sx={KMS_CELL_SX}><strong>{totals.marla || '—'}</strong></TableCell>
                  <TableCell align="right" sx={KMS_CELL_SX}><strong>{totals.sarsai || '—'}</strong></TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      Combined: {formatKMS(totals)} (current page)
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {!entries.length && (
                <TableRow>
                  <TableCell colSpan={3 + AREA_COLUMNS.length * 3 + 1} align="center" sx={{ py: 4 }}>
                    No khasra records yet. Click &quot;Add Khasra Record&quot; to enter data manually.
                  </TableCell>
                </TableRow>
              )}
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
            rowsPerPageOptions={[25, 50, 100, 200]}
          />
        </TableContainer>
      )}

      <MozaKhasraEntryDialog
        open={entryDialogOpen}
        onClose={() => !saving && setEntryDialogOpen(false)}
        onSave={handleSaveEntry}
        entry={editingEntry}
        suggestedSrNo={suggestedSrNo}
        saving={saving}
        mozaName={mozaName}
      />
    </Box>
  );
};

const MozaViewer = () => {
  const [mozas, setMozas] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newMozaName, setNewMozaName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingMoza, setEditingMoza] = useState(null);
  const [editMozaName, setEditMozaName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [deletingMozaId, setDeletingMozaId] = useState(null);
  const [error, setError] = useState('');

  const loadMozas = useCallback(async (expandId) => {
    setListLoading(true);
    setError('');
    try {
      const res = await getMozas();
      const list = res.data?.data || [];
      setMozas(list);
      if (expandId) {
        setExpandedId(expandId);
      } else if (list.length === 1) {
        setExpandedId(list[0]._id);
      }
      return list;
    } catch {
      setError('Failed to load moza list');
      return [];
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMozas();
  }, [loadMozas]);

  const handleEntryCountChange = useCallback((mozaId, entryCount) => {
    setMozas((prev) =>
      prev.map((m) => (m._id === mozaId ? { ...m, entryCount } : m))
    );
  }, []);

  const handleCreateMoza = async () => {
    const name = newMozaName.trim();
    if (!name) {
      toast.error('Mouza name is required');
      return;
    }
    setCreating(true);
    try {
      const res = await createMoza({ name });
      toast.success(res.data?.message || 'Mouza created');
      setCreateOpen(false);
      setNewMozaName('');
      await loadMozas(res.data?.data?._id || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create mouza');
    } finally {
      setCreating(false);
    }
  };

  const openEditMoza = (event, moza) => {
    event.stopPropagation();
    setEditingMoza(moza);
    setEditMozaName(moza.name);
    setEditOpen(true);
  };

  const handleUpdateMoza = async () => {
    const name = editMozaName.trim();
    if (!name) {
      toast.error('Mouza name is required');
      return;
    }
    if (!editingMoza) return;

    setUpdating(true);
    try {
      const res = await updateMoza(editingMoza._id, { name });
      toast.success(res.data?.message || 'Mouza updated');
      const updated = res.data?.data;
      setMozas((prev) =>
        prev.map((m) => (m._id === editingMoza._id ? { ...m, ...updated } : m))
      );
      setEditOpen(false);
      setEditingMoza(null);
      setEditMozaName('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update mouza');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteMoza = async (event, moza) => {
    event.stopPropagation();
    const count = moza.entryCount || 0;
    const detail = count
      ? ` This will also remove all ${count} khasra records in this mouza.`
      : '';
    if (!window.confirm(`Delete mouza "${moza.name}"?${detail}`)) return;

    setDeletingMozaId(moza._id);
    try {
      const res = await deleteMoza(moza._id);
      toast.success(res.data?.message || 'Mouza deleted');
      if (expandedId === moza._id) setExpandedId(null);
      await loadMozas();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete mouza');
    } finally {
      setDeletingMozaId(null);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const res = await importMozaExcel(file);
      toast.success(res.data?.message || 'Import successful');
      await loadMozas(res.data?.data?.mozaId || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          Add Mouza
        </Button>
        <Button
          component="label"
          variant="outlined"
          startIcon={importing ? <CircularProgress size={16} /> : <CloudUpload />}
          disabled={importing}
        >
          Import Excel
          <input type="file" hidden accept=".xlsx,.xls" onChange={handleImport} />
        </Button>
      </Stack>

      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Mouza</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Mouza name"
            placeholder="e.g. Sheikhpur"
            value={newMozaName}
            onChange={(e) => setNewMozaName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateMoza()}
            disabled={creating}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            After creating the mouza, expand it and use &quot;Add Khasra Record&quot; to enter all fields manually.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateMoza} disabled={creating || !newMozaName.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editOpen}
        onClose={() => !updating && setEditOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Edit Mouza</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Mouza name"
            value={editMozaName}
            onChange={(e) => setEditMozaName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdateMoza()}
            disabled={updating}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={updating}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateMoza}
            disabled={updating || !editMozaName.trim() || editMozaName.trim() === editingMoza?.name}
          >
            {updating ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {listLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : !mozas.length ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary" gutterBottom>
            No mouza yet. Create one manually or import from Excel.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
              Add Mouza
            </Button>
            <Button component="label" variant="outlined" startIcon={<CloudUpload />}>
              Import Excel
              <input type="file" hidden accept=".xlsx,.xls" onChange={handleImport} />
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {mozas.map((m) => {
            const isExpanded = expandedId === m._id;
            return (
              <Accordion
                key={m._id}
                expanded={isExpanded}
                onChange={(_, open) => setExpandedId(open ? m._id : null)}
                disableGutters
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '8px !important',
                  '&:before': { display: 'none' },
                  overflow: 'hidden'
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  sx={{
                    bgcolor: isExpanded ? 'action.selected' : 'background.paper',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                    sx={{ width: '100%', pr: 1 }}
                  >
                    <Typography variant="subtitle1" fontWeight={700}>
                      Mouza {m.name}
                    </Typography>
                    <Chip size="small" label={`${m.entryCount || 0} khasra records`} color="primary" variant="outlined" />
                    <Box sx={{ ml: { sm: 'auto' }, display: 'flex', alignItems: 'center', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Edit mouza name">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => openEditMoza(e, m)}
                          aria-label={`Edit mouza ${m.name}`}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete mouza">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => handleDeleteMoza(e, m)}
                            disabled={deletingMozaId === m._id}
                            aria-label={`Delete mouza ${m.name}`}
                          >
                            {deletingMozaId === m._id ? <CircularProgress size={18} /> : <Delete fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 1, pb: 2, px: 2, bgcolor: 'grey.50', minHeight: 480 }}>
                  <MozaEntriesTable
                    mozaId={m._id}
                    mozaName={m.name}
                    active={isExpanded}
                    onEntryCountChange={handleEntryCountChange}
                  />
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

export default MozaViewer;
