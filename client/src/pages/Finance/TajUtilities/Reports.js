import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { Assessment as ReportsIcon } from '@mui/icons-material';

const TajUtilitiesReports = () => {
  return (
    <Box sx={{ p: 2 }}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ReportsIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Taj Utilities Reports
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Reports for Taj Utilities (invoices, collections, arrears, etc.) will be available here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default TajUtilitiesReports;
