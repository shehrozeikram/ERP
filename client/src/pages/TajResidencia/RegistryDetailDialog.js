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
  Stack
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

const RegistryDetailDialog = ({ open, onClose, registryId }) => {
  const [registry, setRegistry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !registryId) {
      setRegistry(null);
      setError('');
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
  }, [open, registryId]);

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
                <DetailField label="Total area" value={formatKMS(registry.totalArea)} />
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <DetailField label="Khasra lines" value={String(lines.length)} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Khasra lines
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>#</strong></TableCell>
                    <TableCell><strong>Khewat</strong></TableCell>
                    <TableCell><strong>Khasra</strong></TableCell>
                    <TableCell><strong>Khasra area</strong></TableCell>
                    <TableCell><strong>Area in registry</strong></TableCell>
                    <TableCell><strong>Total land owned</strong></TableCell>
                    <TableCell><strong>Transfer %</strong></TableCell>
                    <TableCell><strong>Remarks</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((line, idx) => (
                    <TableRow key={line._id || idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{line.khewatNo || '—'}</TableCell>
                      <TableCell>{line.khasraNo || '—'}</TableCell>
                      <TableCell>{formatKMS(line.khasraArea)}</TableCell>
                      <TableCell>{formatKMS(line.acquiredArea)}</TableCell>
                      <TableCell>{formatKMS(line.landWithMalkiyat)}</TableCell>
                      <TableCell>{formatTransferPercent(line.transferPercent)}%</TableCell>
                      <TableCell>{line.remarks || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!lines.length && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
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
