import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert, Stack, Chip, Divider, TextField
} from '@mui/material';
import { QrCode2 as QrIcon, Sensors as ScanIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatAssetLocationLabeledRows } from '../../utils/assetLocationDisplay';
import { useAuth } from '../../contexts/AuthContext';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-PK') : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-PK') : '—');

export default function ScanAssetPage() {
  const { tagCode: tagCodeParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [scanning, setScanning] = useState(false);

  const tagCode = tagCodeParam ? decodeURIComponent(tagCodeParam) : '';

  const load = useCallback(async () => {
    if (!tagCode) return;
    setLoading(true);
    setError('');
    try {
      const enc = encodeURIComponent(tagCode);
      const res = user
        ? await api.get(`/asset-tagging/resolve/${enc}`)
        : await api.get(`/public/asset-tagging/resolve/${enc}`);
      const nextData = { ...(res.data.data || {}) };
      const nextAsset = nextData.asset ? { ...nextData.asset } : null;

      const hasProjectObject = Boolean(
        nextAsset?.project &&
        typeof nextAsset.project === 'object' &&
        (nextAsset.project.name || nextAsset.project.code || nextAsset.project.projectId)
      );

      if (nextAsset && !hasProjectObject) {
        try {
          const financeRes = await api.get(`/finance/fixed-assets/${nextAsset._id}`);
          const financeProject = financeRes?.data?.data?.project || null;
          let fallbackProject = null;

          if (financeProject && typeof financeProject === 'object') {
            fallbackProject = financeProject;
          } else {
            const projectId = typeof nextAsset.project === 'string'
              ? nextAsset.project
              : (typeof financeProject === 'string' ? financeProject : null);

            if (projectId) {
              let projects = [];
              try {
                const projectsRes = await api.get('/finance/fixed-assets/projects');
                projects = projectsRes?.data?.data || [];
              } catch (projectsErr) {
                if (projectsErr?.response?.status === 404) {
                  const fallbackProjectsRes = await api.get('/projects');
                  projects = fallbackProjectsRes?.data?.data || [];
                } else {
                  throw projectsErr;
                }
              }
              fallbackProject = projects.find((p) => String(p._id) === String(projectId)) || null;
            }
          }

          if (fallbackProject) {
            nextAsset.project = fallbackProject;
          }
        } catch {
          // Keep lookup page functional even if project fallback APIs are unavailable.
        }
      }

      nextData.asset = nextAsset;
      setData(nextData);
    } catch (e) {
      setError(e.response?.data?.message || 'Tag not found');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tagCode, user]);

  useEffect(() => { load(); }, [load]);

  const logScan = async () => {
    setScanning(true);
    try {
      if (user) {
        await api.post('/asset-tagging/scan', { tagCode, note });
      } else {
        await api.post('/public/asset-tagging/scan', { tagCode, note });
      }
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to log scan');
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <Box p={4} textAlign="center"><CircularProgress /></Box>
    );
  }

  const asset = data?.asset;
  const transferHistory = data?.transferHistory || [];
  const assetLocationRows = asset ? formatAssetLocationLabeledRows(asset.location) : [];
  const projectLabel = asset?.project
    ? [asset.project.code, asset.project.name].filter(Boolean).join(' - ') || asset.project.projectId || asset.project.name
    : '';

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: { xs: '100%', sm: 560 }, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" gap={1} mb={2}>
        <ScanIcon color="primary" />
        <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }}>Asset lookup</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {asset && (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
            <Box>
              <Typography variant="overline" color="text.secondary">Tag</Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>{data.tag?.tagCode}</Typography>
            </Box>
            <Chip label={asset.status?.replace(/_/g, ' ')} size="small" />
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Typography variant="h6" fontWeight={800}>{asset.assetNumber}</Typography>
          <Typography variant="body1" gutterBottom>{asset.name}</Typography>
          <Typography variant="body2" color="text.secondary">Category: {asset.category}</Typography>
          <Box sx={{ color: 'text.secondary', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>
              Location
            </Typography>
            {assetLocationRows.length ? (
              <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2.5, typography: 'body2' }}>
                {assetLocationRows.map((row, idx) => (
                  <Typography key={`loc-${idx}-${row.label}`} component="li" variant="body2" color="text.secondary">
                    <strong>{row.label}:</strong> {row.value}
                  </Typography>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">—</Typography>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary"><strong>Custodian:</strong> {asset.assignedTo || '—'}</Typography>
          {projectLabel ? (
            <Typography variant="body2" color="text.secondary"><strong>Project:</strong> {projectLabel}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary"><strong>Project:</strong> —</Typography>
          )}
          <Typography variant="body2" color="text.secondary">Serial: {asset.serialNumber || '—'}</Typography>
          {user ? (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Book value: PKR {fmt(asset.currentBookValue)} · Purchased {fmtDate(asset.purchaseDate)}
            </Typography>
          ) : null}

          <TextField fullWidth size="small" label="Scan note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mt: 2 }} />
          <Button fullWidth variant="contained" sx={{ mt: 2 }} startIcon={<QrIcon />} onClick={logScan} disabled={scanning}>
            {scanning ? 'Saving…' : 'Log scan event'}
          </Button>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Transfer History
          </Typography>
          {transferHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No transfer history yet.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {transferHistory.map((ev) => {
                const rawPrev = ev?.meta?.previous?.location;
                const rawCurr = ev?.meta?.current?.location;
                const prevRows = rawPrev != null && String(rawPrev).trim()
                  ? formatAssetLocationLabeledRows(rawPrev)
                  : [];
                const currRows = rawCurr != null && String(rawCurr).trim()
                  ? formatAssetLocationLabeledRows(rawCurr)
                  : [];
                const prevCustodian = ev?.meta?.previous?.assignedTo || '—';
                const currCustodian = ev?.meta?.current?.assignedTo || '—';
                const changedBy = ev?.user
                  ? `${ev.user.firstName || ''} ${ev.user.lastName || ''}`.trim() || ev.user.email || '—'
                  : '—';
                return (
                  <Paper key={ev._id} variant="outlined" sx={{ p: 1.25 }}>
                    <Typography variant="caption" color="text.secondary">
                      {fmtDateTime(ev.createdAt)} • by {changedBy}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ mt: 0.75, mb: 0.5 }}>
                      Location
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems="flex-start">
                      <Box flex={1} sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">From</Typography>
                        {prevRows.length ? (
                          <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2, typography: 'body2' }}>
                            {prevRows.map((row, idx) => (
                              <Typography key={`pf-${ev._id}-${idx}`} component="li" variant="body2">
                                <strong>{row.label}:</strong> {row.value}
                              </Typography>
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2">—</Typography>
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, pt: 1.25, color: 'text.secondary' }} aria-hidden>
                        →
                      </Typography>
                      <Box flex={1} sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">To</Typography>
                        {currRows.length ? (
                          <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2, typography: 'body2' }}>
                            {currRows.map((row, idx) => (
                              <Typography key={`pt-${ev._id}-${idx}`} component="li" variant="body2">
                                <strong>{row.label}:</strong> {row.value}
                              </Typography>
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2">—</Typography>
                        )}
                      </Box>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Custodian:</strong> {prevCustodian} → {currCustodian}
                    </Typography>
                    {ev.note ? (
                      <Typography variant="caption" color="text.secondary">
                        Note: {ev.note}
                      </Typography>
                    ) : null}
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      )}

      {user ? (
        <Button sx={{ mt: 2 }} onClick={() => navigate('/asset-tagging/assets')}>← Tagged assets</Button>
      ) : null}
    </Box>
  );
}
