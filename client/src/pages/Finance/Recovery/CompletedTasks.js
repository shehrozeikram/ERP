import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { TaskAlt as TaskAltIcon } from '@mui/icons-material';

const CompletedTasks = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TaskAltIcon color="success" />
            <Typography variant="h6" fontWeight={600}>
              Completed Tasks
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Completed recovery tasks will be listed here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CompletedTasks;
