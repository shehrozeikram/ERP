import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const AccountList = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Account List
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Typography variant="body1">
          Financial accounts management page - Coming soon!
        </Typography>
      </Paper>
    </Box>
  );
};

export default AccountList; 