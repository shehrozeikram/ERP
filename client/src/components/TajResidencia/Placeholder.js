import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

/**
 * Reusable placeholder component for unimplemented Taj Residencia modules
 */
const Placeholder = ({ title, description = 'Module is ready for implementation.' }) => {
  return (
    <Box sx={{ p: 3 }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          minHeight: 320, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 2, 
          justifyContent: 'center', 
          alignItems: 'center', 
          textAlign: 'center' 
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {description}
        </Typography>
      </Paper>
    </Box>
  );
};

export default Placeholder;

