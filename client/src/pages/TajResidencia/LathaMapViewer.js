import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Popover,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as RestartAltIcon,
  Fullscreen as FullscreenIcon,
  PictureAsPdf as PdfIcon,
  Layers as LayersIcon
} from '@mui/icons-material';
import { getMapStatus } from '../../services/landAcquisitionMapService';
import {
  STATUS_LEGEND,
  fillForStatus,
  formatStatusSummary,
  pointsToPath,
  statusKeyForParcel,
  strokeForStatus
} from '../../utils/lathaMapStatus';
import { formatKMS, normalizeArea } from '../../utils/landAreaUnits';

const MAP_BASE = `${process.env.PUBLIC_URL}/maps/latha`;
const LATHA_MAP_IMAGE = `${MAP_BASE}/latha-map.png`;
const LATHA_MAP_PDF = `${MAP_BASE}/latha-map.pdf`;
const MAP_INDEX_URL = `${MAP_BASE}/latha-map-index.json`;

const MOUZA_LABELS = {
  sheikhpur: 'Mouza Sheikhpur',
  kaak: 'Mouza Kaak',
  lakhu: 'Mouza Lakhu',
  rupa: 'Mouza Rupa',
  'chak-rupa': 'Mouza Chak Rupa',
  narhala: 'Mouza Narhala',
  unknown: 'Other / Unmapped'
};

const clampZoom = (value) => Math.min(5, Math.max(0.4, +value.toFixed(2)));

const LathaMapViewer = () => {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState({ active: false, startX: 0, startY: 0 });

  const [mapIndex, setMapIndex] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [mozas, setMozas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [mouzaFilter, setMouzaFilter] = useState('all');
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [indexRes, statusRes] = await Promise.all([
          fetch(MAP_INDEX_URL).then((r) => {
            if (!r.ok) throw new Error('Map shapes index not found. Run scripts/extract-latha-map-shapes.py');
            return r.json();
          }),
          getMapStatus()
        ]);

        if (cancelled) return;
        setMapIndex(indexRes);
        setMozas(statusRes.data?.data?.mozas || []);
        setStatusMap(statusRes.data?.data?.status || {});

        const files = indexRes.mouzaFiles || {};
        const shapeResponses = await Promise.all(
          Object.entries(files).map(async ([mouza, filename]) => {
            const res = await fetch(`${MAP_BASE}/${filename}`);
            if (!res.ok) return { mouza, parcels: [] };
            const json = await res.json();
            return {
              mouza,
              parcels: (json.parcels || []).map((p, idx) => ({
                ...p,
                id: `${mouza}:${p.k || idx}`,
                mouza
              }))
            };
          })
        );

        if (cancelled) return;
        setParcels(shapeResponses.flatMap((entry) => entry.parcels));
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || 'Failed to load map data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const viewBox = mapIndex?.viewBox || [5184, 2520];
  const [vbW, vbH] = viewBox;

  const visibleParcels = useMemo(() => {
    if (mouzaFilter === 'all') return parcels;
    return parcels.filter((p) => p.mouza === mouzaFilter);
  }, [parcels, mouzaFilter]);

  const mouzaChips = useMemo(() => {
    const fromMap = Object.keys(mapIndex?.mouzaFiles || {}).filter((m) => m !== 'unknown');
    const fromErp = mozas.map((m) => m.slug);
    return [...new Set([...fromMap, ...fromErp])].sort();
  }, [mapIndex, mozas]);

  const getStatusForParcel = useCallback((parcel) => {
    const key = statusKeyForParcel(parcel.mouza, parcel.k);
    return key ? statusMap[key] : null;
  }, [statusMap]);

  const changeZoom = useCallback((delta) => {
    setZoom((prev) => clampZoom(prev + delta));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => clampZoom(prev + delta));
  }, []);

  const startDrag = useCallback((event) => {
    if (event.target.closest('[data-map-popover]')) return;
    if (zoom <= 1) return;
    event.preventDefault();
    setDragState({
      active: true,
      startX: event.clientX - offset.x,
      startY: event.clientY - offset.y
    });
  }, [offset.x, offset.y, zoom]);

  const onDrag = useCallback((event) => {
    if (!dragState.active) return;
    setOffset({
      x: event.clientX - dragState.startX,
      y: event.clientY - dragState.startY
    });
  }, [dragState.active, dragState.startX, dragState.startY]);

  const stopDrag = useCallback(() => {
    setDragState((prev) => (prev.active ? { ...prev, active: false } : prev));
  }, []);

  const openFullscreen = useCallback(() => {
    const node = containerRef.current;
    if (node?.requestFullscreen) node.requestFullscreen();
  }, []);

  const handleParcelClick = (event, parcel) => {
    event.stopPropagation();
    setSelectedParcel(parcel);
    setAnchorEl(event.currentTarget);
  };

  const closePopover = () => {
    setAnchorEl(null);
    setSelectedParcel(null);
  };

  const selectedStatus = selectedParcel ? getStatusForParcel(selectedParcel) : null;

  return (
    <Paper
      elevation={2}
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          background: 'linear-gradient(135deg, #f8fbff 0%, #eef6f1 100%)'
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Latha Land Map
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Live overlay — registry &amp; possession from ERP on survey khasras
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Tooltip title="Zoom out">
              <IconButton size="small" onClick={() => changeZoom(-0.2)}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ minWidth: 48, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </Typography>
            <Tooltip title="Zoom in">
              <IconButton size="small" onClick={() => changeZoom(0.2)}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset view">
              <IconButton size="small" onClick={resetView}>
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fullscreen">
              <IconButton size="small" onClick={openFullscreen}>
                <FullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PdfIcon />}
              href={LATHA_MAP_PDF}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open PDF
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
          <LayersIcon fontSize="small" color="action" />
          <Chip
            size="small"
            label="All mouzas"
            color={mouzaFilter === 'all' ? 'primary' : 'default'}
            onClick={() => setMouzaFilter('all')}
            variant={mouzaFilter === 'all' ? 'filled' : 'outlined'}
          />
          {mouzaChips.map((slug) => (
            <Chip
              key={slug}
              size="small"
              label={MOUZA_LABELS[slug] || slug}
              color={mouzaFilter === slug ? 'primary' : 'default'}
              onClick={() => setMouzaFilter(slug)}
              variant={mouzaFilter === slug ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>
      </Box>

      <Box
        ref={containerRef}
        onWheel={handleWheel}
        onMouseMove={onDrag}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onClick={closePopover}
        sx={{
          position: 'relative',
          height: { xs: '58vh', md: '70vh' },
          bgcolor: '#eef2f7',
          overflow: 'hidden',
          cursor: zoom > 1 ? (dragState.active ? 'grabbing' : 'grab') : 'default'
        }}
      >
        {loading && (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Loading map shapes &amp; land status…
            </Typography>
          </Stack>
        )}

        {!loading && loadError && (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', px: 3 }}>
            <Typography color="error" align="center">{loadError}</Typography>
          </Stack>
        )}

        {!loading && !loadError && (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseDown={startDrag}
          >
            <Box
              sx={{
                position: 'relative',
                display: 'inline-block',
                lineHeight: 0,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: dragState.active ? 'none' : 'transform 0.15s ease',
                boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                borderRadius: 1,
                overflow: 'hidden'
              }}
            >
              <Box
                component="img"
                src={LATHA_MAP_IMAGE}
                alt="Latha Map"
                draggable={false}
                sx={{
                  display: 'block',
                  maxWidth: { xs: '92vw', md: 'min(92vw, calc(68vh * 2.06))' },
                  maxHeight: { xs: '52vh', md: '68vh' },
                  width: 'auto',
                  height: 'auto',
                  userSelect: 'none'
                }}
              />
              <Box
                component="svg"
                viewBox={`0 0 ${vbW} ${vbH}`}
                preserveAspectRatio="xMidYMid meet"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'auto'
                }}
              >
                {visibleParcels.map((parcel) => {
                  const statusRow = getStatusForParcel(parcel);
                  const isSelected = selectedParcel?.id === parcel.id;
                  return (
                    <path
                      key={parcel.id}
                      d={pointsToPath(parcel.p)}
                      fill={fillForStatus(statusRow)}
                      stroke={strokeForStatus(statusRow, isSelected)}
                      strokeWidth={isSelected ? 2.5 : 0.8}
                      style={{ cursor: 'pointer', transition: 'fill 0.2s ease, stroke 0.2s ease' }}
                      onClick={(e) => handleParcelClick(e, parcel)}
                    >
                      <title>
                        {parcel.k
                          ? `Khasra ${parcel.k} (${MOUZA_LABELS[parcel.mouza] || parcel.mouza})`
                          : `Parcel (${parcel.mouza})`}
                      </title>
                    </path>
                  );
                })}
              </Box>
            </Box>
          </Box>
        )}

        <Popover
          open={Boolean(anchorEl && selectedParcel)}
          anchorEl={anchorEl}
          onClose={closePopover}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          PaperProps={{ sx: { p: 2, maxWidth: 320, borderRadius: 2 }, 'data-map-popover': true }}
        >
          {selectedParcel && (
            <Box data-map-popover>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                {selectedParcel.k ? `Khasra ${selectedParcel.k}` : 'Land parcel'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                {MOUZA_LABELS[selectedParcel.mouza] || selectedParcel.mouza}
              </Typography>
              {selectedStatus ? (
                <Stack spacing={0.75}>
                  <Typography variant="body2">
                    <strong>Khewat:</strong> {selectedStatus.khewatNo}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Baseline:</strong> {formatKMS(normalizeArea(selectedStatus.baseline))}
                  </Typography>
                  <Typography variant="body2" color="primary.main">
                    <strong>Registered:</strong> {formatKMS(normalizeArea(selectedStatus.registered))}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    <strong>Possessed:</strong> {formatKMS(normalizeArea(selectedStatus.possessed))}
                  </Typography>
                  <Chip
                    size="small"
                    label={selectedStatus.possessionStatus.replace(/_/g, ' ')}
                    color={
                      selectedStatus.possessionStatus === 'fully_possessed'
                        ? 'success'
                        : selectedStatus.possessionStatus === 'partial_possession'
                          ? 'warning'
                          : 'default'
                    }
                    sx={{ mt: 0.5, textTransform: 'capitalize' }}
                  />
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                  {formatStatusSummary(null)}
                </Typography>
              )}
            </Box>
          )}
        </Popover>
      </Box>

      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default'
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Land status legend — click any khasra for details
        </Typography>
        <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
          {STATUS_LEGEND.map((item) => (
            <Stack key={item.id} direction="row" spacing={0.75} alignItems="center">
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: 0.5,
                  bgcolor: item.fill,
                  border: `2px solid ${item.color}`,
                  flexShrink: 0
                }}
              />
              <Typography variant="caption">{item.label}</Typography>
            </Stack>
          ))}
        </Stack>
        {mapIndex && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {visibleParcels.length.toLocaleString()} khasra shapes shown
            {mapIndex.totalParcels ? ` · ${mapIndex.totalParcels.toLocaleString()} extracted from survey PDF` : ''}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default LathaMapViewer;
