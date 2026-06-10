import React from 'react';
import { Box, Typography, Paper, Stack, Tooltip } from '@mui/material';
import { getOrgNodeSx } from './orgChartTheme';
import { NODE_TYPE_OPTIONS } from './orgChartHelpers';

const OrgChartStencilPanel = ({ activeType, onPickType, disabled }) => (
  <Paper
    variant="outlined"
    sx={{
      width: 200,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#F3F2F1',
      borderRadius: 0,
      borderTop: 0,
      borderBottom: 0,
      borderLeft: 0
    }}
  >
    <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider', bgcolor: '#EAE9E8' }}>
      <Typography variant="caption" fontWeight={700} sx={{ letterSpacing: '0.06em' }}>
        SHAPES
      </Typography>
      <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.25 }}>
        Click a shape, then click the canvas
      </Typography>
    </Box>
    <Stack spacing={1} sx={{ p: 1.5, overflow: 'auto' }}>
      {NODE_TYPE_OPTIONS.map((opt) => {
        const sample = { type: opt.value, isVacant: false, title: opt.label.split(' / ')[0] };
        const active = activeType === opt.value;
        return (
          <Tooltip key={opt.value} title={opt.hint} placement="right">
            <Box
              onClick={() => !disabled && onPickType(active ? null : opt.value)}
              sx={{
                ...getOrgNodeSx(sample, active),
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                outline: active ? '2px solid #0078D4' : 'none',
                outlineOffset: 2,
                '&:hover': disabled ? {} : { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }
              }}
            >
              <Typography sx={{ fontWeight: 'inherit', fontSize: 'inherit' }}>
                {sample.title}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  </Paper>
);

export default OrgChartStencilPanel;
