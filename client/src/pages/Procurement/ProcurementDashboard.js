import React from 'react';
import {
  Box,
  Typography
} from '@mui/material';

const ProcurementDashboard = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Procurement Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage requisitions, quotations, and purchase orders
        </Typography>
      </Box>
    </Box>
  );
};

export default ProcurementDashboard;
