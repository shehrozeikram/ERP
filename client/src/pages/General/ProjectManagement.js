import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { Assignment as ProjectIcon } from '@mui/icons-material';

const ProjectManagement = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <ProjectIcon sx={{ fontSize: 40, color: 'primary.main' }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Project Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage projects and track progress
          </Typography>
        </Box>
      </Box>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Project Management module. Content coming soon.
        </Typography>
      </Paper>
    </Box>
  );
};

export default ProjectManagement;
