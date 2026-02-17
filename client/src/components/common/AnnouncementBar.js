import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import api from '../../services/api';

// Simple marquee-like ticker (CSS animation)
const AnnouncementBar = () => {
  const theme = useTheme();
  const [announcement, setAnnouncement] = useState({ enabled: false, text: '', speed: 80 });

  const text = (announcement?.text || '').trim();
  const enabled = !!announcement?.enabled && text.length > 0;
  const speed = Number(announcement?.speed || 80);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get('/settings');
        const a = res.data?.data?.announcement;
        if (!cancelled && a) setAnnouncement(a);
      } catch (e) {
        // Silent: announcement is optional
      }
    };
    load();
    const t = setInterval(load, 60000); // refresh every minute
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const durationSeconds = useMemo(() => {
    // Roughly: longer text takes longer; speed is px/sec
    const base = Math.max(10, Math.ceil((text.length * 8) / Math.max(20, speed)));
    return base;
  }, [text.length, speed]);

  if (!enabled) return null;

  return (
    <Box
      sx={{
        width: '100%',
        height: 32,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
        bgcolor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        borderBottom: `1px solid ${alpha(theme.palette.primary.contrastText, 0.15)}`
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          whiteSpace: 'nowrap',
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          alignItems: 'center',
          width: 'max-content',
          willChange: 'transform',
          animation: `sgc-marquee ${durationSeconds}s linear infinite`
        }}
      >
        <Typography variant="body2" sx={{ px: 3, fontWeight: 600 }}>
          {text}
        </Typography>
        {/* duplicate for seamless loop */}
        <Typography variant="body2" sx={{ px: 3, fontWeight: 600 }}>
          {text}
        </Typography>
      </Box>

      <style>
        {`
          @keyframes sgc-marquee {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
          }
        `}
      </style>
    </Box>
  );
};

export default AnnouncementBar;

