import React from 'react';
import { Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import {
  Map as MapIcon,
  TableChart as TableChartIcon,
  Description as DescriptionIcon,
  Key as KeyIcon
} from '@mui/icons-material';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import LathaMapViewer from './LathaMapViewer';
import MozaViewer from './MozaViewer';
import RegistryViewer from './RegistryViewer';
import PossessionViewer from './PossessionViewer';

const BASE_PATH = '/taj-residencia/land-acquisition';
const MAPS_PATH = `${BASE_PATH}/maps`;
const MOZA_PATH = `${BASE_PATH}/moza`;
const REGISTRY_PATH = `${BASE_PATH}/registry`;
const POSSESSION_PATH = `${BASE_PATH}/possession`;

const LandAcquisition = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMapsTab = location.pathname.startsWith(MAPS_PATH);
  const isMozaTab = location.pathname.startsWith(MOZA_PATH);
  const isRegistryTab = location.pathname.startsWith(REGISTRY_PATH);
  const isPossessionTab = location.pathname.startsWith(POSSESSION_PATH);

  if (location.pathname === BASE_PATH) {
    return <Navigate to={MAPS_PATH} replace />;
  }

  const tabValue = isPossessionTab ? 3 : isRegistryTab ? 2 : isMozaTab ? 1 : isMapsTab ? 0 : false;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
          Land Acquisition
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Survey maps, moza records, registries, possession, and land registers for Taj Residencia.
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
          value={tabValue}
          onChange={(_, value) => {
            if (value === 0) navigate(MAPS_PATH);
            if (value === 1) navigate(MOZA_PATH);
            if (value === 2) navigate(REGISTRY_PATH);
            if (value === 3) navigate(POSSESSION_PATH);
          }}
          sx={{
            px: 1,
            borderBottom: 1,
            borderColor: 'divider',
            minHeight: 48
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<MapIcon fontSize="small" />} iconPosition="start" label="Maps" />
          <Tab icon={<TableChartIcon fontSize="small" />} iconPosition="start" label="Moza" />
          <Tab icon={<DescriptionIcon fontSize="small" />} iconPosition="start" label="Registry" />
          <Tab icon={<KeyIcon fontSize="small" />} iconPosition="start" label="Possession" />
        </Tabs>
      </Paper>

      {isMapsTab && <LathaMapViewer />}
      {isMozaTab && <MozaViewer />}
      {isRegistryTab && <RegistryViewer />}
      {isPossessionTab && <PossessionViewer />}
    </Box>
  );
};

export default LandAcquisition;
