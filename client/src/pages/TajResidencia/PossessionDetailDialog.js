import React, { useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button
} from '@mui/material';
import { getPossession } from '../../services/landAcquisitionPossessionService';
import { formatKMS } from '../../utils/landAreaUnits';
import { formatKhasraKhewatLabel } from '../../utils/landKhasraDisplay';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
};

const formatTransferPercent = (pct) => {
  if (pct == null || pct === '') return '0';
  const n = Number(pct);
  if (!n) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const DetailField = ({ label, value }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block">
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={500}>
      {value || '—'}
    </Typography>
  </Box>
);

const PossessionDetailDialog = ({ open, onClose, possessionId }) => {
  const [possession, setPossession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !possessionId) {
      setPossession(null);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    getPossession(possessionId)
      .then((res) => {
        if (!cancelled) setPossession(res.data?.data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load possession details');
          setPossession(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, possessionId]);

  const lines = possession?.lines || [];
  const linkedRegistry = possession?.registry;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Possession details
        {possession?.possessionRef ? ` — ${possession.possessionRef}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : possession ? (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Possession date" value={formatDate(possession.possessionDate)} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Moza" value={possession.moza?.name} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Khewat" value={possession.khewatNo} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Possession ref" value={possession.possessionRef} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField
                  label="Linked registry"
                  value={linkedRegistry?.registryNo || '—'}
                />
              </Grid>
              {linkedRegistry?.inteqalNo && (
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Registry inteqal" value={linkedRegistry.inteqalNo} />
                </Grid>
              )}
              {linkedRegistry?.registryDate && (
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Registry date" value={formatDate(linkedRegistry.registryDate)} />
                </Grid>
              )}
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Total possessed" value={formatKMS(possession.totalArea)} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Khasra lines" value={String(lines.length)} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Possession lines
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>#</strong></TableCell>
                    <TableCell><strong>Registry khasra</strong></TableCell>
                    <TableCell><strong>Possessed khasra</strong></TableCell>
                    <TableCell><strong>Khasra area</strong></TableCell>
                    <TableCell><strong>Possessed area</strong></TableCell>
                    <TableCell><strong>Total land owned</strong></TableCell>
                    <TableCell><strong>Transfer %</strong></TableCell>
                    <TableCell><strong>Remarks</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((line, idx) => (
                    <TableRow key={line._id || idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        {formatKhasraKhewatLabel(line.registryKhasraNo, line.registryKhewatNo)}
                      </TableCell>
                      <TableCell>
                        {formatKhasraKhewatLabel(line.khasraNo, line.khewatNo)}
                      </TableCell>
                      <TableCell>{formatKMS(line.khasraArea)}</TableCell>
                      <TableCell>{formatKMS(line.possessedArea)}</TableCell>
                      <TableCell>{formatKMS(line.totalLandPossessed)}</TableCell>
                      <TableCell>{formatTransferPercent(line.transferPercent)}%</TableCell>
                      <TableCell>{line.remarks || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!lines.length && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                        No possession lines recorded.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PossessionDetailDialog;
