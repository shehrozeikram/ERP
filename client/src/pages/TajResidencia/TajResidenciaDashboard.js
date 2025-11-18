import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const TajResidenciaDashboard = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minHeight: 320,
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Taj Residencia
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Module shell is ready. Let me know the submodules you want here and we will wire them up.
        </Typography>
      </Paper>
    </Box>
  );
};

export default TajResidenciaDashboard;

