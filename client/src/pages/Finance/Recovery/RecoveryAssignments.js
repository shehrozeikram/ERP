import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { Assignment as AssignmentIcon } from '@mui/icons-material';

const RecoveryAssignments = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AssignmentIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Recovery Assignments
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Recovery assignments will be managed here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RecoveryAssignments;
