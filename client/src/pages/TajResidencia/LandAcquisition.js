import React from 'react';
import { Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import { Map as MapIcon } from '@mui/icons-material';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import LathaMapViewer from './LathaMapViewer';

const BASE_PATH = '/taj-residencia/land-acquisition';
const MAPS_PATH = `${BASE_PATH}/maps`;

const LandAcquisition = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMapsTab = location.pathname.startsWith(MAPS_PATH);

  if (location.pathname === BASE_PATH) {
    return <Navigate to={MAPS_PATH} replace />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
          Land Acquisition
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Survey maps and land records for Taj Residencia acquisition areas.
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2
        }}
      >
        <Tabs
          value={isMapsTab ? 0 : false}
          onChange={(_, value) => {
            if (value === 0) navigate(MAPS_PATH);
          }}
          sx={{
            px: 1,
            borderBottom: 1,
            borderColor: 'divider',
            minHeight: 48
          }}
        >
          <Tab icon={<MapIcon fontSize="small" />} iconPosition="start" label="Maps" />
        </Tabs>
      </Paper>

      {isMapsTab && <LathaMapViewer />}
    </Box>
  );
};

export default LandAcquisition;
