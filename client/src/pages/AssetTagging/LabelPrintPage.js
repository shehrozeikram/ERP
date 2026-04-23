import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert, Stack, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Print as PrintIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const hasProjectDetails = (project) => Boolean(
  project &&
  typeof project === 'object' &&
  (project.name || project.code || project.projectId)
);

const projectIdFromValue = (project) => {
  if (!project) return '';
  if (typeof project === 'string') return project;
  if (typeof project === 'object') return project._id || project.id || '';
  return '';
};

const formatProjectLabel = (project) => {
  if (!project) return '';
  if (typeof project === 'string') return project;
  return [project.code, project.name].filter(Boolean).join(' - ') || project.projectId || project.name || '';
};

export default function LabelPrintPage() {
  const TOTAL_SLOTS = 10;
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [tag, setTag] = useState(null);
  const [qr, setQr] = useState(null);
  const [slot, setSlot] = useState(() => Number(localStorage.getItem('assetTagLabelSlot') || 1));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/asset-tagging/assets/${assetId}`);
      const { asset: a, currentTag: t } = res.data.data;
      let nextAsset = a;
      const hasProjectObject = hasProjectDetails(a?.project);
      if (!hasProjectObject && assetId) {
        try {
          let fallbackProject = null;
          const financeRes = await api.get(`/finance/fixed-assets/${assetId}`);
          const financeProject = financeRes?.data?.data?.project || null;
          if (financeProject && typeof financeProject === 'object') {
            fallbackProject = financeProject;
          }
          if (fallbackProject) {
            nextAsset = { ...a, project: fallbackProject };
          }
        } catch {
          // Keep label usable even if fallback lookup fails.
        }

        if (!hasProjectDetails(nextAsset?.project)) {
          const projectId = projectIdFromValue(nextAsset?.project);
          if (projectId) {
            try {
              const projectsRes = await api.get('/finance/fixed-assets/projects');
              const projects = Array.isArray(projectsRes?.data?.data) ? projectsRes.data.data : [];
              const match = projects.find((row) => String(row?._id) === String(projectId));
              if (match) {
                nextAsset = { ...nextAsset, project: match };
              }
            } catch {
              // Keep label usable even if project list lookup fails.
            }
          }
        }
      }
      setAsset(nextAsset);
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

  useEffect(() => {
    localStorage.setItem('assetTagLabelSlot', String(slot));
  }, [slot]);

  if (loading) {
    return <Box p={4} textAlign="center"><CircularProgress /></Box>;
  }

  const projectLabel = formatProjectLabel(asset?.project);

  return (
    <Box className="print-label-root" sx={{ p: 2, minHeight: '100vh', bgcolor: '#fff', '@media print': { bgcolor: '#fff', p: 0, minHeight: 'auto' } }}>
      <Box
        component="style"
      >{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          .print-label-root,
          .print-label-root * {
            visibility: visible !important;
          }
          html, body, #root {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hide-toolbar {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-label-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            background: #fff !important;
            width: 210mm !important;
            min-height: 297mm !important;
            height: 297mm !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            outline: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-label-root * {
            box-shadow: none !important;
            text-shadow: none !important;
            border-color: transparent !important;
          }
          .print-label-root .MuiPaper-root {
            border: 0 !important;
            outline: 0 !important;
            background: #fff !important;
          }
          .print-only-sheet {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #fff !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            outline: 0 !important;
            justify-content: center !important;
            align-content: start !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-only-sheet > * {
            border: 0 !important;
            outline: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
          }
        }
      `}</Box>
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
            justifyContent: 'flex-start',
            flexDirection: 'column',
            alignItems: 'flex-start'
          }}
        >
          <Stack className="print-hide-toolbar" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2, width: '100%', maxWidth: 320 }}>
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
            className="print-preview-label"
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
              bgcolor: '#fff',
              '@media print': {
                display: 'none'
              }
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.1 }}>
              Sardar Group Of Companies
            </Typography>
            {projectLabel ? (
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.1 }}>
                {projectLabel}
              </Typography>
            ) : null}
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
                justifyContent: 'start'
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
                    bgcolor: '#fff',
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
                      {projectLabel ? (
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.1 }}>
                          {projectLabel}
                        </Typography>
                      ) : null}
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
