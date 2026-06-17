import React, { useState } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, CircularProgress, Alert
} from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import api from '../../services/api';

const IMPORT_SET_SIZE = 27;

export default function CeoOfficeFarImportButton({ onImported, apiPath = '/finance/fixed-assets/import/ceo-office-far', size = 'medium', variant = 'outlined' }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runImport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post(apiPath);
      setOpen(false);
      if (onImported) onImported(res.data?.message || 'Import complete', res.data?.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        startIcon={loading ? <CircularProgress size={16} /> : <UploadIcon />}
        onClick={() => { setError(''); setOpen(true); }}
        disabled={loading}
      >
        Import CEO Office FAR
      </Button>

      <Dialog open={open} onClose={() => !loading && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import CEO office fixed assets</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Typography variant="body2" paragraph>
            Loads <strong>{IMPORT_SET_SIZE} assets</strong> from the handwritten FAR log (June 2024) for{' '}
            <strong>Sardar Plaza Head Quarter, 2nd floor — CEO office</strong>.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Safe to run more than once — existing rows are skipped. New assets appear in Fixed Assets, FAR register, and Tagged Assets.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button variant="contained" onClick={runImport} disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : <UploadIcon />}>
            {loading ? 'Importing…' : 'Import now'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
