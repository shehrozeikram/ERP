import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
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
  Close as CloseIcon,
  SwapHoriz as ExchangeIcon,
  Person as PersonIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  ArrowForward as ArrowForwardIcon,
  Payment as PaymentIcon,
  Description as DocIcon
} from '@mui/icons-material';
import landAcquisitionExchangeService from '../../services/landAcquisitionExchangeService';
import { formatAreaReadable, formatKMS } from '../../utils/landAreaUnits';
import { resolveUploadFileHref } from '../../utils/uploadPaths';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const formatCurrency = (n) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n || 0);

export default function LandExchangeDetailDialog({
  open,
  onClose,
  exchangeId,
  onEdit
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !exchangeId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    landAcquisitionExchangeService.getExchange(exchangeId)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load exchange details');
      })
      .finally(() => setLoading(false));
  }, [open, exchangeId]);

  if (!open) return null;

  const outS = data?.totalOutArea
    ? (data.totalOutArea.kanal || 0) * 180 + (data.totalOutArea.marla || 0) * 9 + (data.totalOutArea.sarsai || 0)
    : 0;
  const inS = data?.totalInArea
    ? (data.totalInArea.kanal || 0) * 180 + (data.totalInArea.marla || 0) * 9 + (data.totalInArea.sarsai || 0)
    : 0;

  let netLabel = 'Balanced (0-0-0)';
  let netColor = 'info';
  if (outS > 0 && inS === 0) {
    netLabel = `Out Only (Pending In: ${formatKMS(data.totalOutArea)})`;
    netColor = 'warning';
  } else if (inS > 0 && outS === 0) {
    netLabel = `In Only (Pending Out: ${formatKMS(data.totalInArea)})`;
    netColor = 'success';
  } else if (data?.netAreaDiff?.type === 'IN_SURPLUS') {
    netLabel = `In Surplus (+${formatKMS(data.netAreaDiff)})`;
    netColor = 'success';
  } else if (data?.netAreaDiff?.type === 'OUT_SURPLUS') {
    netLabel = `Out Surplus (-${formatKMS(data.netAreaDiff)})`;
    netColor = 'warning';
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ExchangeIcon color="primary" sx={{ fontSize: 28 }} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Land Exchange Details — {data?.exchangeRef || '...'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Executed on {formatDate(data?.exchangeDate)}
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.950' : 'grey.50' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" align="center" sx={{ py: 4 }}>
            {error}
          </Typography>
        ) : data ? (
          <Stack spacing={3}>
            {/* Counterparty & Metadata Overview */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <PersonIcon color="primary" sx={{ fontSize: 32 }} />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {data.party?.name || '—'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        CNIC: {data.party?.cnic || '—'} | Phone: {data.party?.phone || '—'}
                      </Typography>
                      {data.party?.address && (
                        <Typography variant="caption" color="text.secondary">
                          Address: {data.party.address}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Stack spacing={0.5} alignItems={{ sm: 'flex-end' }}>
                    <Typography variant="body2">
                      <strong>Exchange Ref:</strong> {data.exchangeRef || '—'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Deal No:</strong> {data.dealNo ? `#${data.dealNo}` : '—'}
                    </Typography>
                    {data.registryNo && (
                      <Typography variant="body2">
                        <strong>Registry No:</strong> {data.registryNo}
                      </Typography>
                    )}
                    {data.inteqalNo && (
                      <Typography variant="body2">
                        <strong>Inteqal No:</strong> {data.inteqalNo}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>Created By:</strong> {data.createdBy?.name || data.createdBy?.firstName || 'System'}
                    </Typography>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>

            {/* Out Land vs In Land Cards */}
            <Grid container spacing={2.5}>
              {/* Out Land */}
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1.5px solid',
                    borderColor: 'warning.light',
                    height: '100%',
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(237, 108, 2, 0.05)' : '#fffdfa'
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Chip label="OUT LAND (Surrendered)" color="warning" size="small" sx={{ fontWeight: 700 }} />
                    <Typography variant="subtitle2" fontWeight={800} color="warning.dark">
                      {formatAreaReadable(data.totalOutArea)} ({formatKMS(data.totalOutArea)})
                    </Typography>
                  </Stack>

                  {(data.outLandLines || []).length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        No Out Land recorded yet (Pending)
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.50' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Moza</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Khewat</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Khasra</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Area (K-M-S)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {data.outLandLines.map((l, i) => (
                            <TableRow key={l._id || i}>
                              <TableCell>{l.moza?.name || data.moza?.name || '—'}</TableCell>
                              <TableCell>{l.khewatNo || '—'}</TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>{l.khasraNo}</Typography>
                                {l.registryNo && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Reg #{l.registryNo}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {formatKMS(l.surrenderedArea)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>
              </Grid>

              {/* In Land */}
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1.5px solid',
                    borderColor: 'success.light',
                    height: '100%',
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.05)' : '#f9fdfa'
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Chip label="IN LAND (Acquired)" color="success" size="small" sx={{ fontWeight: 700 }} />
                    <Typography variant="subtitle2" fontWeight={800} color="success.dark">
                      {formatAreaReadable(data.totalInArea)} ({formatKMS(data.totalInArea)})
                    </Typography>
                  </Stack>

                  {(data.inLandLines || []).length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        No In Land recorded yet (Pending)
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.50' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Moza</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Khewat</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Khasra</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Area (K-M-S)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {data.inLandLines.map((l, i) => (
                            <TableRow key={l._id || i}>
                              <TableCell>{l.moza?.name || data.moza?.name || '—'}</TableCell>
                              <TableCell>{l.khewatNo || '—'}</TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>{l.khasraNo}</Typography>
                                {l.registryNo && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Reg #{l.registryNo}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {formatKMS(l.acquiredArea)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>
              </Grid>
            </Grid>

            {/* Net Exchange Variance Banner */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Exchange Settlement Status
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip label={`Out: ${formatKMS(data.totalOutArea)}`} color="warning" variant="outlined" />
                  <ArrowForwardIcon fontSize="small" color="action" />
                  <Chip label={`In: ${formatKMS(data.totalInArea)}`} color="success" variant="outlined" />
                  <Chip label={netLabel} color={netColor} sx={{ fontWeight: 700 }} />
                </Stack>
              </Stack>
            </Paper>

            {/* Financial Settlement If Any */}
            {data.financialAdjustment?.hasAdjustment && (
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                  <PaymentIcon color="primary" />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Financial Settlement Adjustment
                  </Typography>
                </Stack>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Amount</Typography>
                    <Typography variant="body1" fontWeight={700} color="primary">
                      {formatCurrency(data.financialAdjustment.amount)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Paid By</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {data.financialAdjustment.paidBy === 'COMPANY' ? 'Company to Party' : 'Party to Company'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Payment Mode</Typography>
                    <Typography variant="body2">{data.financialAdjustment.paymentMode || '—'}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Chip
                      label={data.financialAdjustment.status || 'Pending'}
                      color={data.financialAdjustment.status === 'Paid' ? 'success' : 'warning'}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </Grid>
                  {data.financialAdjustment.remarks && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Payment Remarks</Typography>
                      <Typography variant="body2">{data.financialAdjustment.remarks}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            )}

            {/* Attachments */}
            {data.attachments?.length > 0 && (
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Attached Documents ({data.attachments.length})
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {data.attachments.map((att, i) => (
                    <Stack
                      key={att._id || i}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5 }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <DocIcon color="primary" fontSize="small" />
                        <Typography variant="body2" fontWeight={500}>
                          {att.originalName || att.filename}
                        </Typography>
                      </Stack>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        href={resolveUploadFileHref(att.path)}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ textTransform: 'none' }}
                      >
                        View / Download
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            )}

            {data.remarks && (
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  General Remarks:
                </Typography>
                <Typography variant="body2">{data.remarks}</Typography>
              </Paper>
            )}
          </Stack>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
        {onEdit && (
          <Button
            variant="outlined"
            onClick={() => {
              onClose();
              onEdit(exchangeId);
            }}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Edit Record
          </Button>
        )}
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', fontWeight: 600 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
