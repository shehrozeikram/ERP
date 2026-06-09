import React, { useRef, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';

const OrgChartCanvas = ({ children, scale }) => {
  const scrollRef = useRef(null);

  const centerChart = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    requestAnimationFrame(() => {
      scrollEl.scrollLeft = Math.max(0, (scrollEl.scrollWidth - scrollEl.clientWidth) / 2);
      scrollEl.scrollTop = 0;
    });
  }, []);

  useEffect(() => {
    centerChart();
  }, [scale, children, centerChart]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => centerChart());
    observer.observe(scrollEl);
    return () => observer.disconnect();
  }, [centerChart]);

  return (
    <Box
      ref={scrollRef}
      sx={{
        width: '100%',
        height: 'calc(100vh - 300px)',
        minHeight: 480,
        overflow: 'auto',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: '#FAFAFA'
      }}
    >
      <Box
        sx={{
          width: 'max-content',
          minWidth: '100%',
          mx: 'auto',
          py: 3,
          px: 2,
          display: 'flex',
          justifyContent: 'center'
        }}
      >
        <Box
          sx={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            width: 'max-content'
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default OrgChartCanvas;
