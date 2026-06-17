import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Paper, Stack, Typography
} from '@mui/material';
import { ArrowBack as BackIcon, Print as PrintIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  ASSET_TAG_QR_PRINT_SIZE_MM,
  assetTagQrImageSx,
  buildAssetTagQrDataUrl
} from '../../utils/assetTagQr';

const SLOTS_PER_PAGE = 20;
const SHEET_COLUMNS = 4;
const SHEET_ROWS = 5;

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
        const resolved = await Promise.all(assetIds.map(async (assetId) => {
          const res = await api.get(`/asset-tagging/assets/${assetId}`);
          const { asset, currentTag } = res.data.data || {};
          if (!currentTag?.tagCode) return null;

          const qrRes = await api.get(`/asset-tagging/label-qr/${encodeURIComponent(currentTag.tagCode)}`);
          const qrData = qrRes.data.data;
          let styledDataUrl = '';

          try {
            styledDataUrl = await buildAssetTagQrDataUrl(qrData.url);
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

  const qrSizeMm = ASSET_TAG_QR_PRINT_SIZE_MM.bulk;

  const qrFrameSx = {
    width: `${qrSizeMm + 2}mm`,
    height: 'auto',
    p: 0,
    mb: 0.1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bgcolor: '#fff'
  };

  const qrImageSx = assetTagQrImageSx(qrSizeMm);

  const textWithinQrWidthSx = {
    width: `${qrSizeMm + 2}mm`,
    maxWidth: `${qrSizeMm + 2}mm`,
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
