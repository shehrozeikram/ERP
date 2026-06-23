import React from 'react';
import { Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import {
  Map as MapIcon,
  TableChart as TableChartIcon,
  Description as DescriptionIcon,
  Key as KeyIcon,
  Dashboard as DashboardIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import LathaMapViewer from './LathaMapViewer';
import MozaViewer from './MozaViewer';
import RegistryViewer from './RegistryViewer';
import PossessionViewer from './PossessionViewer';
import LandAcquisitionDashboard from './LandAcquisitionDashboard';
import LandAcquisitionReports from './LandAcquisitionReports';

const BASE_PATH = '/taj-residencia/land-acquisition';
const DASHBOARD_PATH = `${BASE_PATH}/dashboard`;
const MAPS_PATH = `${BASE_PATH}/maps`;
const MOZA_PATH = `${BASE_PATH}/moza`;
const REGISTRY_PATH = `${BASE_PATH}/registry`;
const POSSESSION_PATH = `${BASE_PATH}/possession`;
const REPORTS_PATH = `${BASE_PATH}/reports`;

const LandAcquisition = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboardTab = location.pathname.startsWith(DASHBOARD_PATH);
  const isMapsTab = location.pathname.startsWith(MAPS_PATH);
  const isMozaTab = location.pathname.startsWith(MOZA_PATH);
  const isRegistryTab = location.pathname.startsWith(REGISTRY_PATH);
  const isPossessionTab = location.pathname.startsWith(POSSESSION_PATH);
  const isReportsTab = location.pathname.startsWith(REPORTS_PATH);

  if (location.pathname === BASE_PATH) {
    return <Navigate to={DASHBOARD_PATH} replace />;
  }

  const tabValue = isReportsTab ? 5 : isPossessionTab ? 4 : isRegistryTab ? 3 : isMozaTab ? 2 : isMapsTab ? 1 : isDashboardTab ? 0 : false;

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
            if (value === 0) navigate(DASHBOARD_PATH);
            if (value === 1) navigate(MAPS_PATH);
            if (value === 2) navigate(MOZA_PATH);
            if (value === 3) navigate(REGISTRY_PATH);
            if (value === 4) navigate(POSSESSION_PATH);
            if (value === 5) navigate(REPORTS_PATH);
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
          <Tab icon={<DashboardIcon fontSize="small" />} iconPosition="start" label="Dashboard" />
          <Tab icon={<MapIcon fontSize="small" />} iconPosition="start" label="Maps" />
          <Tab icon={<TableChartIcon fontSize="small" />} iconPosition="start" label="Moza" />
          <Tab icon={<DescriptionIcon fontSize="small" />} iconPosition="start" label="Registry" />
          <Tab icon={<KeyIcon fontSize="small" />} iconPosition="start" label="Possession" />
          <Tab icon={<AssessmentIcon fontSize="small" />} iconPosition="start" label="Reports" />
        </Tabs>
      </Paper>

      {isDashboardTab && <LandAcquisitionDashboard />}
      {isMapsTab && <LathaMapViewer />}
      {isMozaTab && <MozaViewer />}
      {isRegistryTab && <RegistryViewer />}
      {isPossessionTab && <PossessionViewer />}
      {isReportsTab && <LandAcquisitionReports />}
    </Box>
  );
};

export default LandAcquisition;
