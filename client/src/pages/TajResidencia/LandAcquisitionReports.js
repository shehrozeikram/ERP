import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const LandAcquisitionReports = () => {
  return (
    <Box>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Land Acquisition Reports
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Reports and analytics will be displayed here.
        </Typography>
      </Paper>
    </Box>
  );
};

export default LandAcquisitionReports;
