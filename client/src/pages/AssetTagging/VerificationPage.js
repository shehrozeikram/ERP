import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider
} from '@mui/material';
import { FactCheck as VerifyIcon, Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const R = { pending: 'default', found: 'success', missing: 'error', wrong_location: 'warning' };

export default function VerificationPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [scanCode, setScanCode] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cLoc, setCLoc] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await api.get('/asset-tagging/verification-sessions');
      setSessions(res.data.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load sessions');
    }
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) { setDetail(null); return; }
    setLoading(true);
    try {
      const res = await api.get(`/asset-tagging/verification-sessions/${id}`);
      setDetail(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (sessionId) loadDetail(sessionId);
    else setDetail(null);
  }, [sessionId, loadDetail]);

  const createSession = async () => {
    if (!cName.trim()) return;
    setBusy(true);
    try {
      const res = await api.post('/asset-tagging/verification-sessions', {
        name: cName.trim(),
        locationFilter: cLoc.trim()
      });
      setCreateOpen(false);
      setCName('');
      setCLoc('');
      await loadList();
      navigate(`/asset-tagging/verification/${res.data.data._id}`);
    } catch (e) {
      setError(e.response?.data?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const recordScan = async () => {
    if (!detail || !scanCode.trim()) return;
    setBusy(true);
    try {
      await api.post(`/asset-tagging/verification-sessions/${detail._id}/scan`, { tagCode: scanCode.trim() });
      setScanCode('');
      await loadDetail(detail._id);
      await loadList();
    } catch (e) {
      setError(e.response?.data?.message || 'Scan failed');
    } finally {
      setBusy(false);
    }
  };

  const markMissing = async (assetId) => {
    if (!detail) return;
    setBusy(true);
    try {
      await api.post(`/asset-tagging/verification-sessions/${detail._id}/mark-missing`, { assetId });
      await loadDetail(detail._id);
      await loadList();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const closeSession = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await api.post(`/asset-tagging/verification-sessions/${detail._id}/close`, {});
      await loadDetail(detail._id);
      await loadList();
    } catch (e) {
      setError(e.response?.data?.message || 'Close failed');
    } finally {
      setBusy(false);
    }
  };

  if (sessionId && loading && !detail) {
    return <Box p={4} textAlign="center"><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <VerifyIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Physical Verification</Typography>
        </Stack>
        <Stack direction="row" gap={1}>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)}>New session</Button>
          <Button startIcon={<RefreshIcon />} onClick={() => { loadList(); if (sessionId) loadDetail(sessionId); }}>Refresh</Button>
          </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!sessionId && (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell>Session #</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Location filter</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Lines</TableCell>
                <TableCell align="right">Open</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No sessions — create one to count tagged assets.</TableCell></TableRow>
              )}
              {sessions.map((s) => (
                <TableRow key={s._id} hover>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{s.sessionNumber}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.locationFilter || '—'}</TableCell>
                  <TableCell><Chip size="small" label={s.status} color={s.status === 'open' ? 'warning' : 'default'} /></TableCell>
                  <TableCell>{s.lines?.length ?? 0}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => navigate(`/asset-tagging/verification/${s._id}`)}>Open</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {sessionId && detail && (
        <div>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>{detail.sessionNumber} — {detail.name}</Typography>
            <Typography variant="body2" color="text.secondary">Filter: {detail.locationFilter || 'All locations'} · Status: {detail.status}</Typography>
            <Divider sx={{ my: 1 }} />
            {detail.status === 'open' && (
              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                <TextField size="small" label="Scan tag code" value={scanCode} onChange={(e) => setScanCode(e.target.value)}
                  placeholder="TAG-FA-00001" sx={{ minWidth: 220 }} />
                <Button variant="contained" onClick={recordScan} disabled={busy || !scanCode.trim()}>Record scan</Button>
                <Button color="secondary" variant="outlined" onClick={closeSession} disabled={busy}>Close session</Button>
              </Stack>
            )}
          </Paper>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell>Asset</TableCell>
                  <TableCell>Tag</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(detail.lines || []).map((line) => {
                  const asset = line.asset;
                  const num = asset?.assetNumber || '—';
                  const nm = asset?.name || '';
                  return (
                    <TableRow key={line._id}>
                      <TableCell>{num} — {nm}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{line.tagCode}</TableCell>
                      <TableCell><Chip size="small" label={line.result} color={R[line.result] || 'default'} /></TableCell>
                      <TableCell align="right">
                        {detail.status === 'open' && line.result === 'pending' && (
                          <Button size="small" color="error" onClick={() => markMissing(asset?._id || line.asset)}>Mark missing</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Button sx={{ mt: 2 }} onClick={() => navigate('/asset-tagging/verification')}>← All sessions</Button>
        </div>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New verification session</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="normal" required label="Session name" value={cName} onChange={(e) => setCName(e.target.value)} />
          <TextField fullWidth margin="normal" label="Location contains (optional)" value={cLoc} onChange={(e) => setCLoc(e.target.value)}
            helperText="Only tagged assets whose location contains this text are included. Leave empty for all tagged actives." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createSession} disabled={busy || !cName.trim()}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
