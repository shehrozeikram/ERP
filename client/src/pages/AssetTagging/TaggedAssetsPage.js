import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, TextField, MenuItem, CircularProgress, Alert, Stack, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip
} from '@mui/material';
import {
  QrCode2 as QrIcon, Print as PrintIcon, SwapHoriz as TransferIcon, Block as VoidIcon,
  OpenInNew as OpenIcon, Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

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
  const [location, setLocation] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [busy, setBusy] = useState(false);

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

  useEffect(() => { load(); }, [load]);

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
    setLocation(asset.location || '');
    setAssignedTo(asset.assignedTo || '');
    setTransferOpen(true);
  };

  const saveTransfer = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      await api.put(`/asset-tagging/assets/${sel._id}/custody`, { location, assignedTo });
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
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box py={6} textAlign="center"><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
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
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No assets — add fixed assets in Finance first.</TableCell></TableRow>
              )}
              {rows.map((a) => (
                <TableRow key={a._id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{a.assetNumber}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.location || '—'}</TableCell>
                  <TableCell>{a.assignedTo || '—'}</TableCell>
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
      )}

      <Dialog open={transferOpen} onClose={() => setTransferOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Transfer — {sel?.assetNumber}</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="normal" label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <TextField fullWidth margin="normal" label="Assigned to (custodian)" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveTransfer} disabled={busy}>Save</Button>
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
