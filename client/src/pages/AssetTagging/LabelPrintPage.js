import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert, Stack
} from '@mui/material';
import { Print as PrintIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function LabelPrintPage() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [tag, setTag] = useState(null);
  const [qr, setQr] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/asset-tagging/assets/${assetId}`);
      const { asset: a, currentTag: t } = res.data.data;
      setAsset(a);
      setTag(t);
      if (t?.tagCode) {
        const enc = encodeURIComponent(t.tagCode);
        const qrRes = await api.get(`/asset-tagging/label-qr/${enc}`);
        setQr(qrRes.data.data);
      } else {
        setQr(null);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <Box p={4} textAlign="center"><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" className="print-hide-toolbar" justifyContent="space-between" alignItems="center" mb={2}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/asset-tagging/assets')}>Back</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print label</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!tag && (
        <Alert severity="warning">No active tag — issue a tag from Tagged Assets first.</Alert>
      )}

      {asset && tag && qr && (
        <Paper sx={{ maxWidth: 400, mx: 'auto', p: 3, textAlign: 'center', '@media print': { boxShadow: 'none' } }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Sardar Group Of Companies
          </Typography>
          <Box component="img" src={qr.dataUrl} alt="QR" sx={{ width: 200, height: 200, mx: 'auto', display: 'block' }} />
          <Typography variant="h6" sx={{ fontFamily: 'monospace', mt: 1 }}>{tag.tagCode}</Typography>
        </Paper>
      )}
    </Box>
  );
}
