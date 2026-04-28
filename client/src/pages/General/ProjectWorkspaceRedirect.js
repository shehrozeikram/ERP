import React, { useEffect } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';

const TAB_BY_SECTION = {
  overview: 0,
  boq: 1,
  tasks: 2,
  expenses: 3,
  dpr: 4,
  gantt: 5,
  invoices: 6
};

export default function ProjectWorkspaceRedirect() {
  const navigate = useNavigate();
  const { section } = useParams();
  const lastProjectId = localStorage.getItem('pmLastProjectId');
  const tab = TAB_BY_SECTION[section] ?? 0;
  const hasKnownSection = Object.prototype.hasOwnProperty.call(TAB_BY_SECTION, section || '');

  useEffect(() => {
    if (!lastProjectId || !hasKnownSection) return;
    navigate(`/general/project-management/${lastProjectId}?tab=${tab}`, { replace: true });
  }, [hasKnownSection, lastProjectId, navigate, tab]);

  if (lastProjectId && hasKnownSection) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">Opening workspace…</Typography>
      </Box>
    );
  }

  if (!hasKnownSection) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Unknown workspace section. Please use Project Management sidebar links.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper variant="outlined" sx={{ p: 2.5, maxWidth: 640 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          Select a Project First
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Open a project from Projects list once, then these sidebar shortcuts (BOQ, Tasks, Expenses, etc.) will jump directly to that project tab.
        </Alert>
        <Button variant="contained" onClick={() => navigate('/general/project-management/projects')}>
          Go to Projects
        </Button>
      </Paper>
    </Box>
  );
}
