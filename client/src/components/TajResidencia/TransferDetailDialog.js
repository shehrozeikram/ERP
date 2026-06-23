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
import landAcquisitionTransferService from '../../services/landAcquisitionTransferService';
import { formatAreaReadable } from '../../utils/landAreaUnits';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

const TransferDetailDialog = ({ open, onClose, transferId }) => {
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !transferId) {
      setTransfer(null);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    landAcquisitionTransferService.getTransfer(transferId)
      .then((res) => {
        if (!cancelled) setTransfer(res.data?.data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load transfer details');
          setTransfer(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, transferId]);

  const lines = transfer?.transferLines || transfer?.lines || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Land Transfer Details
        {transfer?.transferNo ? ` — ${transfer.transferNo}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : transfer ? (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Transfer Date" value={formatDate(transfer.transferDate)} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Transfer No" value={transfer.transferNo} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Reference No" value={transfer.referenceNo} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Deal No" value={transfer.dealNo} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Purchase No" value={transfer.purchaseNo} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Seller" value={transfer.seller?.name || '—'} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Purchaser" value={transfer.purchaser?.name || '—'} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Moza" value={transfer.moza?.name || '—'} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Total Area" value={formatAreaReadable(transfer.transferArea)} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Transfer Charges" value={formatMoney(transfer.totalTransferPayments)} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Status" value={transfer.status} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Inteqal No" value={transfer.intiqalNo || '—'} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Registry No" value={transfer.registryNo || '—'} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Transfer Lines (Khasras)
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>#</strong></TableCell>
                    <TableCell><strong>Khewat No</strong></TableCell>
                    <TableCell><strong>Khasra No</strong></TableCell>
                    <TableCell><strong>Area</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((line, idx) => (
                    <TableRow key={line._id || idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{line.khewatNo || '—'}</TableCell>
                      <TableCell>{line.khasraNo || '—'}</TableCell>
                      <TableCell>{formatAreaReadable(line.khasraArea)}</TableCell>
                    </TableRow>
                  ))}
                  {!lines.length && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        No khasra lines recorded.
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

export default TransferDetailDialog;
