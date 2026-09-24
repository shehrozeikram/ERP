import React from 'react';
import { Box } from '@mui/material';
import AssistantWidget from '../AssistantWidget';

const Layout = ({ children }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default'
      }}
    >
      {children}
      <AssistantWidget />
    </Box>
  );
};

export default Layout;
