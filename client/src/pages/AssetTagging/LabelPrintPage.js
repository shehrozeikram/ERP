import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert, Stack, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Print as PrintIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function LabelPrintPage() {
  const TOTAL_SLOTS = 10;
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [tag, setTag] = useState(null);
  const [qr, setQr] = useState(null);
  const [slot, setSlot] = useState(1);
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
      <Box
        component="style"
        className="print-sheet-style"
        sx={{ display: 'none', '@media print': { display: 'block' } }}
      >
        {`@page { size: A4 portrait; margin: 8mm; }`}
      </Box>
      <Stack direction="row" className="print-hide-toolbar" justifyContent="space-between" alignItems="center" mb={2}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/asset-tagging/assets')}>Back</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print label</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!tag && (
        <Alert severity="warning">No active tag — issue a tag from Tagged Assets first.</Alert>
      )}

      {asset && tag && qr && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Stack className="print-hide-toolbar" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2, width: '100%', maxWidth: 420 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="label-slot-select-label">Sheet position</InputLabel>
              <Select
                labelId="label-slot-select-label"
                label="Sheet position"
                value={slot}
                onChange={(e) => setSlot(Number(e.target.value))}
              >
                {Array.from({ length: TOTAL_SLOTS }).map((_, idx) => (
                  <MenuItem key={idx + 1} value={idx + 1}>
                    Position {idx + 1}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Paper
            className="print-hide-toolbar"
            sx={{
              width: '98mm',
              height: '56mm',
              p: 1,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              boxSizing: 'border-box',
              mx: 'auto',
              '@media print': {
                boxShadow: 'none',
                border: '1px solid #ddd'
              }
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.1 }}>
              Sardar Group Of Companies
            </Typography>
            <Box component="img" src={qr.dataUrl} alt="QR" sx={{ width: '34mm', height: '34mm', display: 'block' }} />
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5, fontSize: '0.75rem' }}>
              {tag.tagCode}
            </Typography>
          </Paper>

          <Box
            className="print-only-sheet"
            sx={{
              display: 'none',
              '@media print': {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 98mm)',
                gridTemplateRows: 'repeat(5, 56mm)',
                gap: '2mm',
                justifyContent: 'center'
              }
            }}
          >
            {Array.from({ length: TOTAL_SLOTS }).map((_, idx) => {
              const isSelected = idx + 1 === slot;
              return (
                <Box
                  key={`sheet-slot-${idx + 1}`}
                  sx={{
                    width: '98mm',
                    height: '56mm',
                    boxSizing: 'border-box',
                    p: 1,
                    border: '1px solid transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  {isSelected ? (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.1 }}>
                        Sardar Group Of Companies
                      </Typography>
                      <Box component="img" src={qr.dataUrl} alt="QR" sx={{ width: '34mm', height: '34mm', display: 'block' }} />
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5, fontSize: '0.75rem' }}>
                        {tag.tagCode}
                      </Typography>
                    </>
                  ) : null}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}
