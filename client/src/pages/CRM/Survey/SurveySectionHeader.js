import React from 'react';
import { Box, Typography } from '@mui/material';

const SurveySectionHeader = ({
  sectionNumber,
  title,
  subtitle,
  align = 'center',
  dense = false,
  isInternal = false
}) => (
  <Box
    sx={{
      px: dense ? 1.5 : 2,
      py: dense ? 1.25 : 1.75,
      borderBottom: '1px solid',
      borderColor: isInternal ? 'warning.main' : 'divider',
      bgcolor: isInternal ? 'warning.100' : 'grey.50',
      textAlign: align,
      display: 'flex',
      flexDirection: 'column',
      alignItems: align === 'center' ? 'center' : 'flex-start'
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography
        variant="overline"
        sx={{ fontWeight: 800, letterSpacing: 1.2, display: 'block', lineHeight: 1.2, color: isInternal ? 'warning.dark' : 'text.primary' }}
      >
        SECTION {sectionNumber}
      </Typography>
      {isInternal && (
        <Typography variant="caption" sx={{ bgcolor: 'warning.main', color: '#fff', px: 1, py: 0.25, borderRadius: 1, fontWeight: 700, fontSize: '0.65rem' }}>
          INTERNAL ONLY
        </Typography>
      )}
    </Box>
    <Typography
      variant="subtitle1"
      sx={{
        fontWeight: 800,
        textTransform: 'uppercase',
        lineHeight: 1.35,
        mt: 0.25
      }}
    >
      {title || 'Untitled section'}
    </Typography>
    {subtitle ? (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {subtitle}
      </Typography>
    ) : null}
  </Box>
);

export default SurveySectionHeader;
