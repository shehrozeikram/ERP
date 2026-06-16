import React from 'react';
import { Box, Typography } from '@mui/material';

const SurveySectionHeader = ({
  sectionNumber,
  title,
  subtitle,
  align = 'center',
  dense = false
}) => (
  <Box
    sx={{
      px: dense ? 1.5 : 2,
      py: dense ? 1.25 : 1.75,
      borderBottom: '1px solid',
      borderColor: 'divider',
      bgcolor: 'grey.50',
      textAlign: align
    }}
  >
    <Typography
      variant="overline"
      sx={{ fontWeight: 800, letterSpacing: 1.2, display: 'block', lineHeight: 1.2 }}
    >
      SECTION {sectionNumber}
    </Typography>
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
