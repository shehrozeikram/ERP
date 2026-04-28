import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Paper, Stack, Typography
} from '@mui/material';
import { ArrowBack as BackIcon, Print as PrintIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const SLOTS_PER_PAGE = 20;
const SHEET_COLUMNS = 4;
const SHEET_ROWS = 5;

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

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export default function BulkLabelPrintPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const assetIds = useMemo(() => {
    const stateIds = Array.isArray(location.state?.assetIds) ? location.state.assetIds : [];
    const queryIds = new URLSearchParams(location.search).get('ids');
    const parsedQueryIds = queryIds ? queryIds.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const unique = Array.from(new Set([...(stateIds || []), ...parsedQueryIds]));
    return unique;
  }, [location.search, location.state]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!assetIds.length) {
        setError('No tagged assets selected for printing.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const qrModule = await import('qr-code-styling');
        const QRCodeStyling = qrModule.default;

        const resolved = await Promise.all(assetIds.map(async (assetId) => {
          const res = await api.get(`/asset-tagging/assets/${assetId}`);
          const { asset, currentTag } = res.data.data || {};
          if (!currentTag?.tagCode) return null;

          const qrRes = await api.get(`/asset-tagging/label-qr/${encodeURIComponent(currentTag.tagCode)}`);
          const qrData = qrRes.data.data;
          let styledDataUrl = '';

          try {
            const qrCode = new QRCodeStyling({
              width: 320,
              height: 320,
              type: 'canvas',
              data: qrData.url,
              image: CENTER_LOGO_DATA_URI,
              margin: 6,
              qrOptions: { errorCorrectionLevel: 'H' },
              dotsOptions: { color: '#179cde', type: 'dots' },
              cornersSquareOptions: { color: '#179cde', type: 'extra-rounded' },
              cornersDotOptions: { color: '#179cde', type: 'dot' },
              backgroundOptions: { color: '#ffffff' },
              imageOptions: { hideBackgroundDots: true, imageSize: 0.28, margin: 0 }
            });
            const rawData = await qrCode.getRawData('png');
            if (rawData) {
              const blob = rawData instanceof Blob ? rawData : new Blob([rawData], { type: 'image/png' });
              const dataUrl = await blobToDataUrl(blob);
              styledDataUrl = typeof dataUrl === 'string' ? dataUrl : '';
            }
          } catch {
            styledDataUrl = '';
          }

          const projectLabel = asset?.project && typeof asset.project === 'object'
            ? [asset.project.code, asset.project.name].filter(Boolean).join(' - ') || asset.project.projectId || asset.project.name
            : '';

          return {
            assetId,
            tagCode: currentTag.tagCode,
            projectLabel,
            qrDataUrl: styledDataUrl || qrData.dataUrl
          };
        }));

        if (active) {
          setLabels(resolved.filter(Boolean));
        }
      } catch (e) {
        if (active) {
          setError(e.response?.data?.message || 'Failed to load selected labels.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => { active = false; };
  }, [assetIds]);

  const labelContainerSx = {
    width: '51mm',
    height: '56mm',
    boxSizing: 'border-box',
    p: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    bgcolor: '#fff',
    textAlign: 'center'
  };

  const qrFrameSx = {
    width: '24mm',
    height: 'auto',
    p: 0,
    mb: 0.1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bgcolor: '#fff'
  };

  const qrImageSx = {
    width: '22mm',
    height: '22mm',
    display: 'block'
  };

  const textWithinQrWidthSx = {
    width: '24mm',
    maxWidth: '24mm',
    textAlign: 'center',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: 1
  };

  const pages = chunk(labels, SLOTS_PER_PAGE);

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
            min-height: 297mm !important;
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
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            outline: 0 !important;
            box-shadow: none !important;
          }
          .print-page-sheet {
            width: 210mm !important;
            min-height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .print-page-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</Box>

      <Stack direction="row" className="print-hide-toolbar" justifyContent="space-between" alignItems="center" mb={2}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/asset-tagging/assets')}>Back</Button>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate('/asset-tagging/assets')}>Done</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={!labels.length}>Print labels</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box p={4} textAlign="center"><CircularProgress /></Box>
      ) : (
        <>
          <Alert severity="info" className="print-hide-toolbar" sx={{ mb: 2 }}>
            Ready to print {labels.length} label{labels.length === 1 ? '' : 's'} on {pages.length} page{pages.length === 1 ? '' : 's'}.
          </Alert>

          {pages.map((pageLabels, pageIdx) => (
            <Box
              key={`print-page-${pageIdx + 1}`}
              className="print-page-sheet"
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${SHEET_COLUMNS}, 51mm)`,
                gridTemplateRows: `repeat(${SHEET_ROWS}, 56mm)`,
                columnGap: '2mm',
                rowGap: '2mm',
                justifyContent: 'start',
                alignContent: 'start',
                mb: 2
              }}
            >
              {Array.from({ length: SLOTS_PER_PAGE }).map((_, idx) => {
                const label = pageLabels[idx];
                return (
                  <Paper key={`slot-${pageIdx + 1}-${idx + 1}`} elevation={0} sx={labelContainerSx}>
                    {label ? (
                      <>
                        <Typography
                          variant="caption"
                          color="#000"
                          sx={{ ...textWithinQrWidthSx, mb: 0.05, fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.4 }}
                        >
                          SGC
                        </Typography>
                        {label.projectLabel ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ ...textWithinQrWidthSx, mb: 0.08, fontSize: '0.58rem' }}
                          >
                            {label.projectLabel}
                          </Typography>
                        ) : null}
                        <Box sx={qrFrameSx}>
                          <Box component="img" src={label.qrDataUrl} alt="QR" sx={qrImageSx} />
                        </Box>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0, fontSize: '0.73rem', fontWeight: 600, lineHeight: 1.1 }}>
                          {label.tagCode}
                        </Typography>
                      </>
                    ) : null}
                  </Paper>
                );
              })}
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}
