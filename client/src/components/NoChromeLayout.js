import React from 'react';
import { Box } from '@mui/material';

const NoChromeLayout = ({ children }) => {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f4f7fb' }}>
      {children}
    </Box>
  );
};

export default NoChromeLayout;

