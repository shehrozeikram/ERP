import React, { useCallback, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  Button
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as RestartAltIcon,
  Fullscreen as FullscreenIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';

const LATHA_MAP_IMAGE = `${process.env.PUBLIC_URL}/maps/latha/latha-map.png`;
const LATHA_MAP_PDF = `${process.env.PUBLIC_URL}/maps/latha/latha-map.pdf`;

const MOUZA_LEGEND = [
  { label: 'Existing Roads', color: '#8B4513' },
  { label: 'Mouza Sheikhpur', color: '#7B1FA2' },
  { label: 'Mouza Kaak', color: '#2E7D32' },
  { label: 'Mouza Lakhu', color: '#EF6C00' },
  { label: 'Mouza Rupa', color: '#0288D1' },
  { label: 'Mouza Chak Rupa', color: '#1565C0' },
  { label: 'Mouza Narhala', color: '#C62828' }
];

const clampZoom = (value) => Math.min(5, Math.max(0.4, +value.toFixed(2)));

const LathaMapViewer = () => {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState({ active: false, startX: 0, startY: 0 });

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
    if (!node) return;
    if (node.requestFullscreen) {
      node.requestFullscreen();
    }
  }, []);

  return (
    <Paper
      elevation={2}
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap'
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Latha Map
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cadastral survey map — I-14 to I-17, Islamabad Capital Territory
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
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
      </Box>

      <Box
        ref={containerRef}
        onWheel={handleWheel}
        onMouseMove={onDrag}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        sx={{
          position: 'relative',
          height: { xs: '55vh', md: '68vh' },
          bgcolor: '#f5f5f5',
          overflow: 'hidden',
          cursor: zoom > 1 ? (dragState.active ? 'grabbing' : 'grab') : 'default'
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Box
            component="img"
            src={LATHA_MAP_IMAGE}
            alt="Latha Map"
            draggable={false}
            onMouseDown={startDrag}
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              userSelect: 'none',
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: dragState.active ? 'none' : 'transform 0.15s ease'
            }}
          />
        </Box>
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
          Legend
        </Typography>
        <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
          {MOUZA_LEGEND.map((item) => (
            <Stack key={item.label} direction="row" spacing={0.75} alignItems="center">
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: item.color,
                  flexShrink: 0
                }}
              />
              <Typography variant="caption">{item.label}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Paper>
  );
};

export default LathaMapViewer;
