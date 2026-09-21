import React from 'react';
import {
  Box,
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
  Chip,
  Stack,
  Divider
} from '@mui/material';
import { AttachFile } from '@mui/icons-material';
import { formatKMS } from '../../utils/landAreaUnits';
import { resolveUploadFileHref } from '../../utils/uploadPaths';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB');
};

const StatCard = ({ label, value, color = 'text.primary', bgcolor = 'background.paper', borderColor = 'divider' }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 1.5,
      borderRadius: 1.5,
      bgcolor,
      borderColor,
      textAlign: 'center'
    }}
  >
    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
      {label}
    </Typography>
    <Typography variant="subtitle1" fontWeight={700} sx={{ color, letterSpacing: 0.5 }}>
      {formatKMS(value)}
    </Typography>
  </Paper>
);

const KhasraDetailDialog = ({ open, onClose, khasra }) => {
  if (!khasra) return null;

  const registries = khasra.registries || [];
  const possessions = khasra.possessions || [];
  const pendingByRegistry = khasra.pendingByRegistry
    || registries.filter((r) => {
      const p = r.pendingPossession || {};
      return (p.kanal || 0) > 0 || (p.marla || 0) > 0 || (p.sarsai || 0) > 0;
    });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Khasra Summary Details
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Moza {khasra.moza?.name || '—'} &bull; Khewat No. <strong>{khasra.khewatNo}</strong> &bull; Khasra No. <strong>{khasra.khasraNo}</strong>
            </Typography>
          </Box>
          <Chip label={`Sr #${khasra.srNo || 1}`} size="small" color="primary" variant="outlined" />
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: 'grey.50' }}>
        {/* Metric Cards */}
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <StatCard
              label="Land in Khasra"
              value={khasra.landInKhasra}
              bgcolor="#f8fafc"
              borderColor="#cbd5e1"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <StatCard
              label="Purchased (Registry)"
              value={khasra.totalAcquired}
              color="success.dark"
              bgcolor="#f0fdf4"
              borderColor="#bbf7d0"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <StatCard
              label="Pending Purchased"
              value={khasra.remainingToRegister}
              color="warning.dark"
              bgcolor="#fffbeb"
              borderColor="#fde68a"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <StatCard
              label="Possession"
              value={khasra.totalPossessed}
              color="primary.dark"
              bgcolor="#eff6ff"
              borderColor="#bfdbfe"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <StatCard
              label="Pending Possession"
              value={khasra.remainingToPossess}
              color="error.dark"
              bgcolor="#fef2f2"
              borderColor="#fecaca"
            />
          </Grid>
        </Grid>

        {/* Pending Possession — which registries */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700} color="error.dark">
              Pending Possession by Registry
            </Typography>
            <Chip
              size="small"
              label={`${pendingByRegistry.length} registries`}
              color="error"
              variant="outlined"
            />
            <Typography variant="caption" color="text.secondary">
              Total pending: {formatKMS(khasra.remainingToPossess)}
            </Typography>
          </Stack>

          {!pendingByRegistry.length ? (
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper' }}>
              <Typography variant="body2" color="text.secondary">
                No pending possession — all registered area for this khasra is possessed.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: '#fef2f2' }}>
                  <TableRow>
                    <TableCell><strong>Registry Date</strong></TableCell>
                    <TableCell><strong>Deal No.</strong></TableCell>
                    <TableCell><strong>Registry No.</strong></TableCell>
                    <TableCell><strong>Inteqal No.</strong></TableCell>
                    <TableCell><strong>Seller</strong></TableCell>
                    <TableCell align="center"><strong>Acquired</strong></TableCell>
                    <TableCell align="center"><strong>Possessed</strong></TableCell>
                    <TableCell align="center"><strong>Pending Possession</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingByRegistry.map((reg, idx) => (
                    <TableRow key={reg._id || idx} hover>
                      <TableCell>{formatDate(reg.registryDate)}</TableCell>
                      <TableCell><strong>{reg.dealNo ? `#${reg.dealNo}` : '—'}</strong></TableCell>
                      <TableCell>
                        <strong>{reg.registryNo || '—'}</strong>
                        {reg.isExchangeIn && (
                          <Chip
                            label="Exchange In"
                            size="small"
                            color="success"
                            variant="filled"
                            sx={{ fontSize: '0.65rem', height: 18, ml: 1, fontWeight: 700 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>{reg.inteqalNo || '—'}</TableCell>
                      <TableCell>{reg.sellerName || reg.seller?.name || '—'}</TableCell>
                      <TableCell align="center">{formatKMS(reg.acquiredArea)}</TableCell>
                      <TableCell align="center">{formatKMS(reg.possessedArea)}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={formatKMS(reg.pendingPossession)}
                          size="small"
                          color="error"
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {/* Section 1: Linked Registries */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Linked Registries
            </Typography>
            <Chip size="small" label={`${registries.length} records`} color="success" variant="outlined" />
          </Stack>

          {!registries.length ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
              <Typography variant="body2" color="text.secondary">
                No registries have been recorded for this khasra yet.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell><strong>Registry Date</strong></TableCell>
                    <TableCell><strong>Deal No.</strong></TableCell>
                    <TableCell><strong>Registry No.</strong></TableCell>
                    <TableCell><strong>Inteqal No.</strong></TableCell>
                    <TableCell><strong>Seller</strong></TableCell>
                    <TableCell><strong>Purchaser</strong></TableCell>
                    <TableCell><strong>Dealer</strong></TableCell>
                    <TableCell align="center"><strong>Acquired Area</strong></TableCell>
                    <TableCell align="center"><strong>Pending Possession</strong></TableCell>
                    <TableCell><strong>Documents</strong></TableCell>
                    <TableCell><strong>Remarks</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {registries.map((reg, idx) => {
                    const pending = reg.pendingPossession || { kanal: 0, marla: 0, sarsai: 0 };
                    const hasPending = (pending.kanal || 0) > 0 || (pending.marla || 0) > 0 || (pending.sarsai || 0) > 0;
                    return (
                      <TableRow key={reg._id || idx} hover>
                        <TableCell>{formatDate(reg.registryDate)}</TableCell>
                        <TableCell><strong>{reg.dealNo ? `#${reg.dealNo}` : '—'}</strong></TableCell>
                        <TableCell>
                          <strong>{reg.registryNo || '—'}</strong>
                          {reg.isExchangeIn && (
                            <Chip
                              label="Exchange In"
                              size="small"
                              color="success"
                              variant="filled"
                              sx={{ fontSize: '0.65rem', height: 18, ml: 1, fontWeight: 700 }}
                            />
                          )}
                        </TableCell>
                        <TableCell>{reg.inteqalNo || '—'}</TableCell>
                        <TableCell>{reg.seller?.name || '—'}</TableCell>
                        <TableCell>{reg.purchaser?.name || '—'}</TableCell>
                        <TableCell>{reg.dealer?.name || '—'}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={formatKMS(reg.acquiredArea)}
                            size="small"
                            color="success"
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          {hasPending ? (
                            <Chip
                              label={formatKMS(pending)}
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ fontWeight: 700 }}
                            />
                          ) : (
                            <Typography variant="caption" color="success.main" fontWeight={600}>
                              Fully possessed
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {[...(reg.registryDocAttachments || []), ...(reg.inteqalDocAttachments || [])].map((att, i) => {
                              const href = resolveUploadFileHref(att.path, att.mimetype);
                              return href ? (
                                <Chip
                                  key={att._id || i}
                                  icon={<AttachFile fontSize="small" />}
                                  label={att.originalName || `Doc ${i + 1}`}
                                  component="a"
                                  href={href}
                                  target="_blank"
                                  clickable
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              ) : null;
                            })}
                            {!(reg.registryDocAttachments || []).length && !(reg.inteqalDocAttachments || []).length && (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>{reg.remarks || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {/* Section: Surrendered in Land Exchanges if any */}
        {(khasra.exchangesOut || []).length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700} color="warning.dark">
                Surrendered in Land Exchanges
              </Typography>
              <Chip size="small" label={`${khasra.exchangesOut.length} records`} color="warning" variant="outlined" />
            </Stack>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell><strong>Exchange Date</strong></TableCell>
                    <TableCell><strong>Exchange Ref</strong></TableCell>
                    <TableCell><strong>Party / Exchanger</strong></TableCell>
                    <TableCell align="center"><strong>Surrendered Area</strong></TableCell>
                    <TableCell><strong>Remarks</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {khasra.exchangesOut.map((exc, idx) => (
                    <TableRow key={exc._id || idx} hover>
                      <TableCell>{formatDate(exc.exchangeDate)}</TableCell>
                      <TableCell><strong>{exc.exchangeRef}</strong></TableCell>
                      <TableCell>{exc.party?.name || '—'}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`-${formatKMS(exc.surrenderedArea)}`}
                          size="small"
                          color="warning"
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>{exc.remarks || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Section 2: Linked Possessions */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Linked Possessions
            </Typography>
            <Chip size="small" label={`${possessions.length} records`} color="primary" variant="outlined" />
          </Stack>

          {!possessions.length ? (
            <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
              <Typography variant="body2" color="text.secondary">
                No physical possession records found for this khasra yet.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                  <TableRow>
                    <TableCell><strong>Possession Date</strong></TableCell>
                    <TableCell><strong>Possession Ref</strong></TableCell>
                    <TableCell><strong>Linked Registry</strong></TableCell>
                    <TableCell align="center"><strong>Possessed Area</strong></TableCell>
                    <TableCell><strong>Remarks</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {possessions.map((pos, idx) => (
                    <TableRow key={pos._id || idx} hover>
                      <TableCell>{formatDate(pos.possessionDate)}</TableCell>
                      <TableCell><strong>{pos.possessionRef || '—'}</strong></TableCell>
                      <TableCell>
                        {pos.registryNo ? (
                          <Stack spacing={0.25}>
                            <Typography variant="body2" fontWeight={600}>{pos.registryNo}</Typography>
                            {(pos.inteqalNo || pos.dealNo) && (
                              <Typography variant="caption" color="text.secondary">
                                {[pos.inteqalNo && `Inteqal: ${pos.inteqalNo}`, pos.dealNo && `Deal: #${pos.dealNo}`]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Typography>
                            )}
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">Not linked</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={formatKMS(pos.possessedArea)}
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>{pos.remarks || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KhasraDetailDialog;
