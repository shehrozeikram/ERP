import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, Tab, Paper } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SummarizeIcon from '@mui/icons-material/Summarize';

const KPI_TABS = [
  { label: 'Monthly KPI Sheet', path: '/hr/kpi/sheet', icon: <AssignmentIcon /> },
  { label: 'KPI Submissions', path: '/hr/kpi/submissions', icon: <AssessmentIcon /> },
  { label: 'KPI Reports', path: '/hr/kpi/reports', icon: <SummarizeIcon /> },
];

const KPITabNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentTabIndex = () => {
    const currentPath = location.pathname;
    const index = KPI_TABS.findIndex((tab) => currentPath.startsWith(tab.path));
    return index !== -1 ? index : 0;
  };

  const handleTabChange = (event, newValue) => {
    const targetTab = KPI_TABS[newValue];
    if (targetTab && location.pathname !== targetTab.path) {
      navigate(targetTab.path);
    }
  };

  return (
    <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, bgcolor: 'background.paper' }}>
      <Tabs
        value={getCurrentTabIndex()}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
      >
        {KPI_TABS.map((tab) => (
          <Tab
            key={tab.path}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
            sx={{ fontWeight: 600, minHeight: 48, px: 3 }}
          />
        ))}
      </Tabs>
    </Paper>
  );
};

export default KPITabNavigation;
