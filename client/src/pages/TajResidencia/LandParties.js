import React from 'react';
import { Box, Typography, Tabs, Tab, Paper } from '@mui/material';
import { Groups as GroupsIcon } from '@mui/icons-material';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import PartiesViewer, { PARTY_TABS } from './PartiesViewer';

const BASE_PATH = '/taj-residencia/land-acquisition/parties';

const LandParties = () => {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === BASE_PATH) {
    return <Navigate to={PARTY_TABS[0].path} replace />;
  }

  const tabValue = Math.max(0, PARTY_TABS.findIndex((tab) => location.pathname.startsWith(tab.path)));

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
          Parties
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Register sellers, buyers, and dealers for Taj Residencia land acquisition.
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
          onChange={(_, value) => navigate(PARTY_TABS[value].path)}
          sx={{
            px: 1,
            borderBottom: 1,
            borderColor: 'divider',
            minHeight: 48
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {PARTY_TABS.map((tab) => (
            <Tab
              key={tab.type}
              icon={<GroupsIcon fontSize="small" />}
              iconPosition="start"
              label={tab.label}
            />
          ))}
        </Tabs>
      </Paper>

      <PartiesViewer />
    </Box>
  );
};

export default LandParties;
