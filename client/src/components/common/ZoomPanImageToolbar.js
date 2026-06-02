import React from 'react';
import { Box, IconButton } from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as RestartAltIcon
} from '@mui/icons-material';

/** Zoom in / out / reset controls (shared with utility bill image preview). */
const ZoomPanImageToolbar = ({ onZoomIn, onZoomOut, onReset, iconColor }) => (
  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
    <IconButton size="small" onClick={onZoomOut} title="Zoom out" sx={iconColor ? { color: iconColor } : undefined}>
      <ZoomOutIcon fontSize="small" />
    </IconButton>
    <IconButton size="small" onClick={onReset} title="Reset zoom" sx={iconColor ? { color: iconColor } : undefined}>
      <RestartAltIcon fontSize="small" />
    </IconButton>
    <IconButton size="small" onClick={onZoomIn} title="Zoom in" sx={iconColor ? { color: iconColor } : undefined}>
      <ZoomInIcon fontSize="small" />
    </IconButton>
  </Box>
);

export default ZoomPanImageToolbar;
