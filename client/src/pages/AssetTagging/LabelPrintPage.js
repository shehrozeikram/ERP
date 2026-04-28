import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, CircularProgress, Alert, Stack, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Print as PrintIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const CENTER_LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="tovusBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1db4ef"/>
      <stop offset="100%" stop-color="#0f86cc"/>
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="60" fill="url(#tovusBlue)"/>
  <circle cx="60" cy="60" r="45" fill="none" stroke="#ffffff" stroke-width="3.2" opacity="0.92"/>
  <path d="M38 40h44v10H65v33H55V50H38z" fill="#ffffff"/>
  <text
    x="60"
    y="98"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="11"
    font-weight="700"
    letter-spacing="1.4"
    fill="#ffffff"
  >TOVUS</text>
</svg>
`)}`;

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

export default function LabelPrintPage() {
  const TOTAL_SLOTS = 4;
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [tag, setTag] = useState(null);
  const [qr, setQr] = useState(null);
  const [styledQrDataUrl, setStyledQrDataUrl] = useState('');
  const [slot, setSlot] = useState(() => {
    const savedSlot = Number(localStorage.getItem('assetTagLabelSlot') || 1);
    if (!Number.isFinite(savedSlot)) return 1;
    return Math.min(Math.max(savedSlot, 1), TOTAL_SLOTS);
  });
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
      const hasProjectObject = Boolean(
        a?.project && typeof a.project === 'object' && (a.project.name || a.project.code || a.project.projectId)
      );
      if (!hasProjectObject && assetId) {
        try {
          let fallbackProject = null;
          const financeRes = await api.get(`/finance/fixed-assets/${assetId}`);
          const financeProject = financeRes?.data?.data?.project || null;
          if (financeProject && typeof financeProject === 'object') {
            fallbackProject = financeProject;
          } else {
            const projectId = typeof a?.project === 'string'
              ? a.project
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
            nextAsset = { ...a, project: fallbackProject };
          }
        } catch {
          // Keep label usable even if fallback lookup fails.
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

  useEffect(() => {
    if (slot > TOTAL_SLOTS || slot < 1) {
      setSlot(1);
    }
  }, [slot, TOTAL_SLOTS]);

  useEffect(() => {
    let active = true;

    const makeStyledQr = async () => {
      if (!qr?.url) {
        setStyledQrDataUrl('');
        return;
      }

      try {
        const module = await import('qr-code-styling');
        const QRCodeStyling = module.default;
        const qrCode = new QRCodeStyling({
          width: 320,
          height: 320,
          type: 'canvas',
          data: qr.url,
          image: CENTER_LOGO_DATA_URI,
          margin: 6,
          qrOptions: {
            errorCorrectionLevel: 'H'
          },
          dotsOptions: {
            color: '#179cde',
            type: 'dots'
          },
          cornersSquareOptions: {
            color: '#179cde',
            type: 'extra-rounded'
          },
          cornersDotOptions: {
            color: '#179cde',
            type: 'dot'
          },
          backgroundOptions: {
            color: '#ffffff'
          },
          imageOptions: {
            hideBackgroundDots: true,
            imageSize: 0.28,
            margin: 0
          }
        });

        const rawData = await qrCode.getRawData('png');
        if (!active || !rawData) return;

        const blob = rawData instanceof Blob ? rawData : new Blob([rawData], { type: 'image/png' });
        const dataUrl = await blobToDataUrl(blob);
        if (active) {
          setStyledQrDataUrl(typeof dataUrl === 'string' ? dataUrl : '');
        }
      } catch {
        if (active) {
          setStyledQrDataUrl('');
        }
      }
    };

    makeStyledQr();
    return () => {
      active = false;
    };
  }, [qr?.url]);

  if (loading) {
    return <Box p={4} textAlign="center"><CircularProgress /></Box>;
  }

  const projectLabel = asset?.project
    ? [asset.project.code, asset.project.name].filter(Boolean).join(' - ') || asset.project.projectId || asset.project.name
    : '';

  const labelContainerSx = {
    width: '98mm',
    height: '56mm',
    boxSizing: 'border-box',
    p: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    bgcolor: '#fff'
  };

  const qrFrameSx = {
    width: '30mm',
    height: 'auto',
    p: 0,
    mb: 0.1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bgcolor: '#fff'
  };

  const qrImageSx = {
    width: '27mm',
    height: '27mm',
    display: 'block'
  };

  const textWithinQrWidthSx = {
    width: '30mm',
    maxWidth: '30mm',
    textAlign: 'center',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: 1
  };

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
              ...labelContainerSx,
              textAlign: 'center',
              border: '1px solid',
              borderColor: 'grey.400',
              '@media print': {
                display: 'none'
              }
            }}
          >
            <Typography
              variant="caption"
              color="#000"
              sx={{ ...textWithinQrWidthSx, mb: 0.05, fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.4 }}
            >
              SGC
            </Typography>
            {projectLabel ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ...textWithinQrWidthSx, mb: 0.08, fontSize: '0.58rem' }}
              >
                {projectLabel}
              </Typography>
            ) : null}
            <Box sx={qrFrameSx}>
              <Box component="img" src={styledQrDataUrl || qr.dataUrl} alt="QR" sx={qrImageSx} />
            </Box>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0, fontSize: '0.73rem', fontWeight: 600, lineHeight: 1.1 }}>
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
                gridTemplateRows: 'repeat(2, 56mm)',
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
                    ...labelContainerSx
                  }}
                >
                  {isSelected ? (
                    <>
                      <Typography
                        variant="caption"
                        color="#000"
                        sx={{ ...textWithinQrWidthSx, mb: 0.05, fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.4 }}
                      >
                        SGC
                      </Typography>
                      {projectLabel ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ...textWithinQrWidthSx, mb: 0.08, fontSize: '0.58rem' }}
                        >
                          {projectLabel}
                        </Typography>
                      ) : null}
                      <Box sx={qrFrameSx}>
                        <Box component="img" src={styledQrDataUrl || qr.dataUrl} alt="QR" sx={qrImageSx} />
                      </Box>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0, fontSize: '0.73rem', fontWeight: 600, lineHeight: 1.1 }}>
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
