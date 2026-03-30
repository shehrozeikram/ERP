import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert, Stack, Chip, Divider, TextField
} from '@mui/material';
import { QrCode2 as QrIcon, Sensors as ScanIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-PK') : '—');

export default function ScanAssetPage() {
  const { tagCode: tagCodeParam } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [scanning, setScanning] = useState(false);

  const tagCode = tagCodeParam ? decodeURIComponent(tagCodeParam) : '';

  const load = useCallback(async () => {
    if (!tagCode) return;
    setLoading(true);
    setError('');
    try {
      const enc = encodeURIComponent(tagCode);
      const res = await api.get(`/asset-tagging/resolve/${enc}`);
      setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Tag not found');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tagCode]);

  useEffect(() => { load(); }, [load]);

  const logScan = async () => {
    setScanning(true);
    try {
      await api.post('/asset-tagging/scan', { tagCode, note });
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to log scan');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <Box p={4} textAlign="center"><CircularProgress /></Box>
    );
  }

  const asset = data?.asset;

  return (
    <Box sx={{ p: 3, maxWidth: 560, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" gap={1} mb={2}>
        <ScanIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>Asset lookup</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {asset && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
            <Box>
              <Typography variant="overline" color="text.secondary">Tag</Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>{data.tag?.tagCode}</Typography>
            </Box>
            <Chip label={asset.status?.replace(/_/g, ' ')} size="small" />
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Typography variant="h6" fontWeight={800}>{asset.assetNumber}</Typography>
          <Typography variant="body1" gutterBottom>{asset.name}</Typography>
          <Typography variant="body2" color="text.secondary">Category: {asset.category}</Typography>
          <Typography variant="body2" color="text.secondary">Location: {asset.location || '—'}</Typography>
          <Typography variant="body2" color="text.secondary">Custodian: {asset.assignedTo || '—'}</Typography>
          <Typography variant="body2" color="text.secondary">Serial: {asset.serialNumber || '—'}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>Book value: PKR {fmt(asset.currentBookValue)} · Purchased {fmtDate(asset.purchaseDate)}</Typography>

          <TextField fullWidth size="small" label="Scan note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mt: 2 }} />
          <Button fullWidth variant="contained" sx={{ mt: 2 }} startIcon={<QrIcon />} onClick={logScan} disabled={scanning}>
            {scanning ? 'Saving…' : 'Log scan event'}
          </Button>
        </Paper>
      )}

      <Button sx={{ mt: 2 }} onClick={() => navigate('/asset-tagging/assets')}>← Tagged assets</Button>
    </Box>
  );
}
