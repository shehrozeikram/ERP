import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, MenuItem, CircularProgress, Alert, Stack, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip, Checkbox
} from '@mui/material';
import {
  QrCode2 as QrIcon, Print as PrintIcon, SwapHoriz as TransferIcon, Block as VoidIcon,
  OpenInNew as OpenIcon, Refresh as RefreshIcon, DeleteOutline as DeleteIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import storeService from '../../services/storeService';
import LocationSelector from '../../components/Procurement/Store/LocationSelector';
import {
  ASSET_TAGGING_HQ_BUILDING as HQ_LOCATION,
  normalizeHqRoomSegment,
  formatAssetLocationForDisplay,
  formatCustodianForDisplay
} from '../../utils/assetLocationDisplay';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TaggedAssetsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [tagStatus, setTagStatus] = useState('');

  const [transferOpen, setTransferOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [sel, setSel] = useState(null);
  const [locationBuilding, setLocationBuilding] = useState(HQ_LOCATION);
  const [locationFloor, setLocationFloor] = useState('Ground Floor');
  const [locationRoom, setLocationRoom] = useState('');
  const [locationSubStore, setLocationSubStore] = useState('');
  const [locationRack, setLocationRack] = useState('');
  const [locationShelf, setLocationShelf] = useState('');
  const [locationBin, setLocationBin] = useState('');
  const [mainStores, setMainStores] = useState([]);
  const [selectedMainStoreId, setSelectedMainStoreId] = useState('');
  const [selectedSubStores, setSelectedSubStores] = useState([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (tagStatus) params.tagStatus = tagStatus;
      const res = await api.get('/asset-tagging/assets', { params });
      setRows(res.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [search, tagStatus]);

  const paginatedRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const taggedRows = rows.filter((a) => Boolean(a.currentTag));
  const isAllTaggedSelected = taggedRows.length > 0 && taggedRows.every((a) => selectedAssetIds.includes(a._id));
  const isSomeTaggedSelected = taggedRows.some((a) => selectedAssetIds.includes(a._id)) && !isAllTaggedSelected;

  useEffect(() => {
    setPage(0);
  }, [rows.length, rowsPerPage]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setSelectedAssetIds((prev) => prev.filter((id) => rows.some((r) => r._id === id && r.currentTag)));
  }, [rows]);

  useEffect(() => {
    storeService.getStores({ type: 'main', activeOnly: 'true' })
      .then((res) => setMainStores(res.data || []))
      .catch(() => setMainStores([]));
  }, []);

  useEffect(() => {
    const selectedStore = mainStores.find((s) => String(s.name || '') === String(locationBuilding || ''));
    const mainStoreId = selectedStore?._id || '';
    setSelectedMainStoreId(mainStoreId);
    if (!mainStoreId) {
      setSelectedSubStores([]);
      return;
    }
    storeService.getSubStores(mainStoreId)
      .then((res) => setSelectedSubStores(res.data || []))
      .catch(() => setSelectedSubStores([]));
  }, [mainStores, locationBuilding]);

  const issueTag = async (asset) => {
    setBusy(true);
    try {
      await api.post(`/asset-tagging/assets/${asset._id}/issue-tag`, {});
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Issue tag failed');
    } finally {
      setBusy(false);
    }
  };

  const openTransfer = (asset) => {
    setSel(asset);
    const parts = String(asset.location || '').split(',').map((p) => p.trim()).filter(Boolean);
    const inferredBuilding = parts[0] || HQ_LOCATION;
    const isStore = inferredBuilding !== HQ_LOCATION;
    setLocationBuilding(inferredBuilding);
    setLocationFloor(!isStore ? (parts[1] || 'Ground Floor') : '');
    setLocationRoom(!isStore ? (parts[2] || '') : '');
    setLocationSubStore(isStore ? (parts[1] || '') : '');
    setLocationRack(isStore ? (parts[2] || '') : '');
    setLocationShelf(isStore ? (parts[3] || '') : '');
    setLocationBin(isStore ? (parts[4] || '') : '');
    setAssignedTo(asset.assignedTo || '');
    setTransferOpen(true);
  };

  const saveTransfer = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const isStore = locationBuilding !== HQ_LOCATION;
      const selectedSubStore = selectedSubStores.find((s) => s._id === locationSubStore);
      const subStoreLabel = selectedSubStore?.name || locationSubStore || '';
      const locationParts = isStore
        ? [locationBuilding, subStoreLabel, locationRack, locationShelf, locationBin]
        : [locationBuilding, locationFloor, normalizeHqRoomSegment(locationRoom)];
      const normalizedLocation = locationParts.map((part) => String(part || '').trim()).filter(Boolean).join(', ');
      await api.put(`/asset-tagging/assets/${sel._id}/custody`, { location: normalizedLocation, assignedTo });
      setTransferOpen(false);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const voidTag = async () => {
    if (!sel || !voidReason.trim()) return;
    setBusy(true);
    try {
      await api.post(`/asset-tagging/assets/${sel._id}/void-tag`, { reason: voidReason });
      setVoidOpen(false);
      setVoidReason('');
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Void failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteAsset = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/asset-tagging/assets/${deleteTarget._id}`);
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleAssetSelection = (asset) => {
    if (!asset?.currentTag) return;
    setSelectedAssetIds((prev) => (
      prev.includes(asset._id)
        ? prev.filter((id) => id !== asset._id)
        : [...prev, asset._id]
    ));
  };

  const toggleSelectAllTagged = () => {
    if (isAllTaggedSelected) {
      setSelectedAssetIds([]);
      return;
    }
    setSelectedAssetIds(taggedRows.map((a) => a._id));
  };

  const printSelectedLabels = () => {
    if (!selectedAssetIds.length) return;
    navigate('/asset-tagging/labels/print', { state: { assetIds: selectedAssetIds } });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <QrIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Tagged Assets</Typography>
        </Stack>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Refresh</Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
        <TextField size="small" label="Search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, number, location, serial" sx={{ minWidth: 220 }} />
        <TextField size="small" select label="Tag filter" value={tagStatus} onChange={(e) => setTagStatus(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="tagged">Tagged only</MenuItem>
          <MenuItem value="untagged">Untagged only</MenuItem>
        </TextField>
        <Button variant="contained" onClick={load} disabled={loading}>Apply</Button>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          disabled={selectedAssetIds.length === 0}
          onClick={printSelectedLabels}
        >
          Print selected ({selectedAssetIds.length})
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box py={6} textAlign="center"><CircularProgress /></Box>
      ) : (
        <Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell padding="checkbox" sx={{ width: 52 }}>
                    <Tooltip title="Select all tagged assets">
                      <span>
                        <Checkbox
                          size="small"
                          checked={isAllTaggedSelected}
                          indeterminate={isSomeTaggedSelected}
                          onChange={toggleSelectAllTagged}
                          disabled={taggedRows.length === 0}
                        />
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell><b>Asset #</b></TableCell>
                  <TableCell><b>Name</b></TableCell>
                  <TableCell><b>Location</b></TableCell>
                  <TableCell><b>Custodian</b></TableCell>
                  <TableCell><b>Book value</b></TableCell>
                  <TableCell><b>Tag code</b></TableCell>
                  <TableCell align="right"><b>Actions</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No assets — add fixed assets in Finance first.</TableCell></TableRow>
                )}
                {paginatedRows.map((a) => (
                  <TableRow key={a._id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selectedAssetIds.includes(a._id)}
                        disabled={!a.currentTag}
                        onChange={() => toggleAssetSelection(a)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{a.assetNumber}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{formatAssetLocationForDisplay(a.location) || '—'}</TableCell>
                    <TableCell>{formatCustodianForDisplay(a.assignedTo) || '—'}</TableCell>
                    <TableCell align="right">{fmt(a.currentBookValue)}</TableCell>
                    <TableCell>
                      {a.currentTag ? (
                        <Chip size="small" label={a.currentTag.tagCode} color="success" variant="outlined" />
                      ) : (
                        <Chip size="small" label="No tag" color="warning" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {!a.currentTag && a.status !== 'disposed' && (
                        <Button size="small" variant="contained" disabled={busy} onClick={() => issueTag(a)}>Issue tag</Button>
                      )}
                      {a.currentTag && (
                        <>
                          <Tooltip title="Scan / lookup">
                            <IconButton size="small" onClick={() => navigate(`/asset-tagging/scan/${encodeURIComponent(a.currentTag.tagCode)}`)}>
                              <OpenIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Print label">
                            <IconButton size="small" onClick={() => navigate(`/asset-tagging/label/${a._id}`)}>
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Transfer location / custodian">
                            <IconButton size="small" onClick={() => openTransfer(a)}><TransferIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Delete asset">
                            <IconButton
                              size="small"
                              color="error"
                              disabled={busy}
                              onClick={() => {
                                setDeleteTarget(a);
                                setDeleteOpen(true);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Void tag">
                            <IconButton size="small" color="error" onClick={() => { setSel(a); setVoidOpen(true); }}>
                              <VoidIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
            <TextField
              select
              size="small"
              label="Rows"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(0);
              }}
              sx={{ width: 110, mr: 1 }}
            >
              {[5, 10, 25, 50].map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </TextField>
            <Button size="small" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              Prev
            </Button>
            <Typography variant="body2" sx={{ px: 1.5, alignSelf: 'center' }}>
              Page {rows.length === 0 ? 0 : page + 1} / {Math.max(1, Math.ceil(rows.length / rowsPerPage))}
            </Typography>
            <Button
              size="small"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * rowsPerPage >= rows.length}
            >
              Next
            </Button>
          </Box>
        </Box>
      )}

      <Dialog open={transferOpen} onClose={() => setTransferOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Transfer — {sel?.assetNumber}</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="normal"
            label="Location"
            value={locationBuilding}
            onChange={(e) => {
              const next = e.target.value;
              setLocationBuilding(next);
              if (next === HQ_LOCATION) {
                setLocationFloor('Ground Floor');
                setLocationRoom('');
                setLocationSubStore('');
                setLocationRack('');
                setLocationShelf('');
                setLocationBin('');
              } else {
                setLocationFloor('');
                setLocationRoom('');
              }
            }}
          >
            {[HQ_LOCATION, ...mainStores.map((s) => s.name).filter(Boolean)].map((loc) => (
              <MenuItem key={loc} value={loc}>{loc}</MenuItem>
            ))}
          </TextField>
          {locationBuilding !== HQ_LOCATION ? (
            <>
              <LocationSelector
                mainStoreId={selectedMainStoreId || undefined}
                value={{
                  subStore: locationSubStore || '',
                  rack: locationRack || '',
                  shelf: locationShelf || '',
                  bin: locationBin || ''
                }}
                onChange={(loc) => {
                  setLocationSubStore(loc.subStore || '');
                  setLocationRack(loc.rack || '');
                  setLocationShelf(loc.shelf || '');
                  setLocationBin(loc.bin || '');
                }}
                size="small"
              />
            </>
          ) : (
            <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
              <TextField fullWidth label="Floor" value={locationFloor} onChange={(e) => setLocationFloor(e.target.value)} />
              <TextField fullWidth label="Room" value={locationRoom} onChange={(e) => setLocationRoom(e.target.value)} />
            </Stack>
          )}
          <TextField fullWidth margin="normal" label="Assigned to (custodian)" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveTransfer} disabled={busy}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => {
        if (busy) return;
        setDeleteOpen(false);
        setDeleteTarget(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Delete asset</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Permanently remove <strong>{deleteTarget?.assetNumber}</strong> — {deleteTarget?.name} from the register.
            Active tags and scan history for this asset will be removed.
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            You cannot delete an asset that already has posted depreciation (use Finance → dispose instead).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={busy}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDeleteAsset} disabled={busy}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={voidOpen} onClose={() => setVoidOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Void tag — {sel?.currentTag?.tagCode}</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="normal" required label="Reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} multiline rows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoidOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={voidTag} disabled={busy || !voidReason.trim()}>Void tag</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
