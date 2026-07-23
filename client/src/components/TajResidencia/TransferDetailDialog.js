import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  CheckCircle as PaidIcon,
  HourglassEmpty as PendingIcon,
  SwapHoriz as TransferIcon
} from '@mui/icons-material';
import landAcquisitionTransferService from '../../services/landAcquisitionTransferService';
import { formatAreaReadable } from '../../utils/landAreaUnits';
import { resolveUploadFileHref } from '../../utils/uploadPaths';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatMoney = (value) =>
  `Rs. ${Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const DetailField = ({ label, value, highlight = false }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
      {label}
    </Typography>
    <Typography variant="body2" fontWeight={highlight ? 700 : 500} color={highlight ? 'primary.main' : 'text.primary'}>
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
        if (!cancelled) setTransfer(res?.transfer || res?.data?.data || res?.data || null);
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

  const lines = transfer?.lines || transfer?.transferLines || [];
  const payments = transfer?.transferPayments || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                bgcolor: 'primary.light',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <TransferIcon />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                Land Transfer Details
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {transfer?.referenceNo || '—'} {transfer?.transferNo ? `(${transfer.transferNo})` : ''}
              </Typography>
            </Box>
          </Stack>
          {transfer && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={transfer.status || 'Open'}
                color={transfer.status === 'Closed' ? 'success' : 'warning'}
                size="small"
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label={`Payment: ${transfer.paymentStatus || 'Pending'}`}
                color={transfer.paymentStatus === 'Paid' ? 'success' : transfer.paymentStatus === 'Partial Paid' ? 'info' : 'default'}
                variant="outlined"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Stack>
          )}
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2, pb: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={36} />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : transfer ? (
          <Stack spacing={3}>

            {/* KPI Overview Grid */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50', borderColor: 'primary.100' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    TRANSFER AREA
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="primary.main">
                    {formatAreaReadable(transfer.transferArea)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {transfer.transferSizeInKanal ? `${transfer.transferSizeInKanal} Kanals` : ''}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={3}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50', borderColor: 'success.100' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    TOTAL CHARGES
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="success.main">
                    {formatMoney(transfer.totalTransferPayments)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Transfer / Intiqal Cost
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    RATE PER KANAL
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {formatMoney(transfer.ratePerKanal)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Agreed Purchase Rate
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={3}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    MOUZA
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {transfer.moza?.name || '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Land Location
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* General Info Card */}
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                General Information
              </Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Transfer Date" value={formatDate(transfer.transferDate)} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Reference No" value={transfer.referenceNo} highlight />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Transfer No" value={transfer.transferNo} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Deal No" value={transfer.dealNo ? `Deal #${transfer.dealNo}` : '—'} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Purchase Reference" value={transfer.purchaseNo} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Seller Party" value={transfer.seller?.name || transfer.sellerName || '—'} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Purchaser Party" value={transfer.purchaser?.name || transfer.purchaserName || '—'} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Dealer" value={transfer.landPurchase?.dealer?.name || '—'} />
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Intiqal No." value={transfer.intiqalNo || '—'} />
                  {transfer.inteqalAttachment && (
                    <Button
                      size="small"
                      variant="text"
                      color="primary"
                      sx={{ p: 0, minWidth: 0, mt: 0.5, fontSize: '0.75rem' }}
                      onClick={() => window.open(resolveUploadFileHref(transfer.inteqalAttachment), '_blank')}
                    >
                      View Inteqal Attachment
                    </Button>
                  )}
                </Grid>
                <Grid item xs={6} sm={4} md={3}>
                  <DetailField label="Registry No." value={transfer.registryNo || '—'} />
                  {transfer.registryAttachment && (
                    <Button
                      size="small"
                      variant="text"
                      color="primary"
                      sx={{ p: 0, minWidth: 0, mt: 0.5, fontSize: '0.75rem' }}
                      onClick={() => window.open(resolveUploadFileHref(transfer.registryAttachment), '_blank')}
                    >
                      View Registry Attachment
                    </Button>
                  )}
                </Grid>
              </Grid>
            </Paper>

            {/* Transfer Lines (Khasras) */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Transfer Khasra Lines ({lines.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Khewat No</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Khasra No</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Khasra Area</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lines.map((line, idx) => (
                      <TableRow key={line._id || idx} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{line.khewatNo || '—'}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{line.khasraNo || '—'}</TableCell>
                        <TableCell>{formatAreaReadable(line.khasraArea)}</TableCell>
                      </TableRow>
                    ))}
                    {!lines.length && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          No khasra lines recorded for this transfer.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Transfer Payments Breakdown */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Transfer Payments &amp; Charges Breakdown ({payments.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Payment Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Mode / Ref</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Amount (PKR)</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map((p, idx) => (
                      <TableRow key={p._id || idx} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{p.paymentType}</TableCell>
                        <TableCell>{p.description || '—'}</TableCell>
                        <TableCell>{formatDate(p.paymentDate)}</TableCell>
                        <TableCell>{p.paymentMode || p.refNo ? `${p.paymentMode || ''} ${p.refNo || ''}` : '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatMoney(p.amount)}</TableCell>
                        <TableCell align="center">
                          <Chip
                            icon={p.status === 'Paid' ? <PaidIcon fontSize="small" /> : <PendingIcon fontSize="small" />}
                            label={p.status || 'Pending'}
                            color={p.status === 'Paid' ? 'success' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {!payments.length && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          No transfer payment line items recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant="outlined" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransferDetailDialog;
