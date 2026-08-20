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
  Button,
  Link,
  Stack,
  Chip
} from '@mui/material';
import { AttachFile } from '@mui/icons-material';
import { getRegistry } from '../../services/landAcquisitionRegistryService';
import { formatKMS } from '../../utils/landAreaUnits';
import { isAttachmentPdf, resolveUploadFileHref } from '../../utils/uploadPaths';

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

const RegistryDetailDialog = ({ open, onClose, registryId, registryData = null }) => {
  const [registry, setRegistry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setRegistry(null);
      setError('');
      return;
    }

    if (registryData) {
      setRegistry(registryData);
      setLoading(false);
      setError('');
      return;
    }

    if (!registryId || String(registryId).startsWith('exchange-in-')) {
      setRegistry(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    getRegistry(registryId)
      .then((res) => {
        if (!cancelled) setRegistry(res.data?.data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load registry details');
          setRegistry(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, registryId, registryData]);

  const lines = registry?.lines || [];
  const attachments = registry?.attachments || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Registry details
        {registry?.registryNo ? ` — ${registry.registryNo}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : registry ? (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Registry date" value={formatDate(registry.registryDate)} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Moza" value={registry.moza?.name} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Khewat" value={registry.khewatNo} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Registry no." value={registry.registryNo} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Inteqal no." value={registry.inteqalNo || '—'} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Seller" value={registry.seller?.name || '—'} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Purchaser" value={registry.purchaser?.name || '—'} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Dealer" value={registry.dealer?.name || '—'} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Total Registered Area" value={formatKMS(registry.totalArea)} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField
                  label="Exchanged Out"
                  value={
                    registry.exchangedOutArea && (registry.exchangedOutArea.kanal > 0 || registry.exchangedOutArea.marla > 0 || registry.exchangedOutArea.sarsai > 0)
                      ? `- ${formatKMS(registry.exchangedOutArea)}`
                      : '0-0-0'
                  }
                />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField
                  label="Exchanged In"
                  value={
                    registry.exchangedInArea && (registry.exchangedInArea.kanal > 0 || registry.exchangedInArea.marla > 0 || registry.exchangedInArea.sarsai > 0)
                      ? `+ ${formatKMS(registry.exchangedInArea)}`
                      : '0-0-0'
                  }
                />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField
                  label="Total Acquired Holding"
                  value={formatKMS(registry.netRemainingArea || registry.totalArea)}
                />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Khasra lines" value={String(lines.length)} />
              </Grid>
            </Grid>

            {/* Land Exchange Impact History if any */}
            {registry.exchanges?.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(237, 108, 2, 0.05)' : '#fffdfa', borderColor: 'primary.light' }}>
                <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>
                  Land Exchanges Linked to this Registry ({registry.exchanges.length})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Exchange Ref</strong></TableCell>
                        <TableCell><strong>Type</strong></TableCell>
                        <TableCell><strong>Date</strong></TableCell>
                        <TableCell><strong>Counterparty</strong></TableCell>
                        <TableCell><strong>Khasra</strong></TableCell>
                        <TableCell align="right"><strong>Area Variance</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {registry.exchanges.map((exc, i) => (
                        <TableRow key={exc._id || i}>
                          <TableCell><strong>{exc.exchangeRef}</strong></TableCell>
                          <TableCell>
                            <Chip
                              label={exc.type === 'IN' ? 'IN (Acquired)' : 'OUT (Surrendered)'}
                              size="small"
                              color={exc.type === 'IN' ? 'success' : 'warning'}
                              sx={{ fontSize: '0.65rem', height: 20, fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell>{formatDate(exc.exchangeDate)}</TableCell>
                          <TableCell>{exc.partyName}</TableCell>
                          <TableCell>{exc.khasraNo || '—'}</TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: 700,
                              color: exc.type === 'IN' ? 'success.dark' : 'warning.dark'
                            }}
                          >
                            {exc.type === 'IN'
                              ? `+ ${formatKMS(exc.acquiredArea)}`
                              : `- ${formatKMS(exc.surrenderedArea)}`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Khasra lines & Total Acquired Holdings
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>#</strong></TableCell>
                    <TableCell><strong>Khewat</strong></TableCell>
                    <TableCell><strong>Khasra</strong></TableCell>
                    <TableCell><strong>Khasra area</strong></TableCell>
                    <TableCell><strong>Original Registered</strong></TableCell>
                    <TableCell><strong>Exchanged Out</strong></TableCell>
                    <TableCell><strong>Exchanged In</strong></TableCell>
                    <TableCell><strong>Total Acquired Holding</strong></TableCell>
                    <TableCell><strong>Total land owned</strong></TableCell>
                    <TableCell><strong>Transfer %</strong></TableCell>
                    <TableCell><strong>Remarks</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((line, idx) => {
                    const hasOut = line.exchangedOutArea && (line.exchangedOutArea.kanal > 0 || line.exchangedOutArea.marla > 0 || line.exchangedOutArea.sarsai > 0);
                    const hasIn = line.exchangedInArea && (line.exchangedInArea.kanal > 0 || line.exchangedInArea.marla > 0 || line.exchangedInArea.sarsai > 0);

                    return (
                      <TableRow key={line._id || idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{line.khewatNo || '—'}</TableCell>
                        <TableCell>{line.khasraNo || '—'}</TableCell>
                        <TableCell>{formatKMS(line.khasraArea)}</TableCell>
                        <TableCell>{formatKMS(line.acquiredArea)}</TableCell>
                        <TableCell sx={{ color: hasOut ? 'warning.dark' : 'text.secondary', fontWeight: hasOut ? 700 : 400 }}>
                          {hasOut ? `- ${formatKMS(line.exchangedOutArea)}` : '—'}
                        </TableCell>
                        <TableCell sx={{ color: hasIn ? 'success.dark' : 'text.secondary', fontWeight: hasIn ? 700 : 400 }}>
                          {hasIn ? `+ ${formatKMS(line.exchangedInArea)}` : '—'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: (hasOut || hasIn) ? 'primary.main' : 'text.primary' }}>
                          {formatKMS(line.netRemainingArea || line.acquiredArea)}
                        </TableCell>
                        <TableCell>{formatKMS(line.landWithMalkiyat)}</TableCell>
                        <TableCell>{formatTransferPercent(line.transferPercent)}%</TableCell>
                        <TableCell>{line.remarks || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!lines.length && (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                        No khasra lines recorded.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Grid container spacing={2} sx={{ mt: 3 }}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Registry Document Attachments
                  </Typography>
                  {!(registry.registryDocAttachments || []).length ? (
                    <Typography variant="body2" color="text.secondary">
                      No registry document attachments.
                    </Typography>
                  ) : (
                    <Stack spacing={0.75}>
                      {(registry.registryDocAttachments || []).map((att) => {
                        const href = resolveUploadFileHref(att.path, att.mimetype);
                        return (
                          <Stack key={att._id || att.path} direction="row" spacing={1} alignItems="center">
                            <AttachFile fontSize="small" color="primary" />
                            {href ? (
                              <Link href={href} target="_blank" rel="noopener noreferrer" underline="hover">
                                {att.originalName || att.filename}
                                {isAttachmentPdf(att.path, att.mimetype) ? ' (PDF)' : ''}
                              </Link>
                            ) : (
                              <Typography variant="body2">{att.originalName || att.filename}</Typography>
                            )}
                          </Stack>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Inteqal Document Attachments
                  </Typography>
                  {!(registry.inteqalDocAttachments || []).length ? (
                    <Typography variant="body2" color="text.secondary">
                      No inteqal document attachments.
                    </Typography>
                  ) : (
                    <Stack spacing={0.75}>
                      {(registry.inteqalDocAttachments || []).map((att) => {
                        const href = resolveUploadFileHref(att.path, att.mimetype);
                        return (
                          <Stack key={att._id || att.path} direction="row" spacing={1} alignItems="center">
                            <AttachFile fontSize="small" color="primary" />
                            {href ? (
                              <Link href={href} target="_blank" rel="noopener noreferrer" underline="hover">
                                {att.originalName || att.filename}
                                {isAttachmentPdf(att.path, att.mimetype) ? ' (PDF)' : ''}
                              </Link>
                            ) : (
                              <Typography variant="body2">{att.originalName || att.filename}</Typography>
                            )}
                          </Stack>
                        );
                      })}
                    </Stack>
                  )}
                </Paper>
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 3, mb: 1 }}>
              Other Attachments
            </Typography>
            {!attachments.length ? (
              <Typography variant="body2" color="text.secondary">
                No other attachments uploaded.
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                {attachments.map((att) => {
                  const href = resolveUploadFileHref(att.path, att.mimetype);
                  return (
                    <Stack key={att._id || att.path} direction="row" spacing={1} alignItems="center">
                      <AttachFile fontSize="small" color="action" />
                      {href ? (
                        <Link
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="hover"
                        >
                          {att.originalName || att.filename}
                          {isAttachmentPdf(att.path, att.mimetype) ? ' (PDF)' : ''}
                        </Link>
                      ) : (
                        <Typography variant="body2">
                          {att.originalName || att.filename}
                        </Typography>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RegistryDetailDialog;
