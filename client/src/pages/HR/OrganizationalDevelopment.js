import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  Container,
  Stack,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  AccountTree,
  Work,
  TrendingUp,
  People,
  Assessment,
  ChangeHistory,
  Add,
  Visibility,
  Edit,
  Assessment as AssessmentIcon,
  Timeline,
  Psychology,
  Business,
  School
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const OrganizationalDevelopment = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalPositions: 45,
    filledPositions: 38,
    vacantPositions: 7,
    departments: 12,
    jobDescriptions: 42,
    successionPlans: 15,
    performanceReviews: 156,
    changeInitiatives: 8
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      pending: 'warning',
      completed: 'info',
      draft: 'default'
    };
    return colors[status] || 'default';
  };

  const formatPercentage = (value, total) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Organizational Development
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage organizational structure, job analysis, and development initiatives
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<AccountTree />}
              onClick={() => navigate('/hr/organizational-development/org-chart')}
            >
              View Org Chart
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/hr/organizational-development/job-analysis/new')}
            >
              Create Job Analysis
            </Button>
          </Stack>
        </Box>

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Organizational Structure */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AccountTree sx={{ fontSize: 40, color: theme.palette.primary.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats.departments}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Departments
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    {stats.filledPositions} Filled
                  </Typography>
                  <Typography variant="body2" color="warning.main">
                    {stats.vacantPositions} Vacant
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Job Analysis */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Work sx={{ fontSize: 40, color: theme.palette.secondary.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats.jobDescriptions}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Job Descriptions
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    {formatPercentage(stats.jobDescriptions, stats.totalPositions)}% Coverage
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Succession Planning */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TrendingUp sx={{ fontSize: 40, color: theme.palette.success.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats.successionPlans}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Succession Plans
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    {formatPercentage(stats.successionPlans, stats.totalPositions)}% Coverage
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Performance Management */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Assessment sx={{ fontSize: 40, color: theme.palette.info.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats.performanceReviews}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Performance Reviews
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    This Quarter
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Quick Actions */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<AccountTree />}
                      onClick={() => navigate('/hr/organizational-development/org-chart')}
                      sx={{ justifyContent: 'flex-start', p: 2 }}
                    >
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="subtitle2">Organizational Chart</Typography>
                        <Typography variant="body2" color="text.secondary">
                          View and manage organizational structure
                        </Typography>
                      </Box>
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<Work />}
                      onClick={() => navigate('/hr/organizational-development/job-analysis')}
                      sx={{ justifyContent: 'flex-start', p: 2 }}
                    >
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="subtitle2">Job Analysis</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Create and manage job descriptions
                        </Typography>
                      </Box>
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<TrendingUp />}
                      onClick={() => navigate('/hr/organizational-development/succession')}
                      sx={{ justifyContent: 'flex-start', p: 2 }}
                    >
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="subtitle2">Succession Planning</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Plan for leadership transitions
                        </Typography>
                      </Box>
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={<Assessment />}
                      onClick={() => navigate('/hr/organizational-development/performance')}
                      sx={{ justifyContent: 'flex-start', p: 2 }}
                    >
                      <Box sx={{ textAlign: 'left' }}>
                        <Typography variant="subtitle2">Performance Management</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Manage performance reviews and goals
                        </Typography>
                      </Box>
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Activities */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Activities
                </Typography>
                <List dense>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Work fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Job Analysis Updated"
                      secondary="Software Engineer position updated"
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <TrendingUp fontSize="small" color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Succession Plan Created"
                      secondary="Marketing Manager succession plan"
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Assessment fontSize="small" color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Performance Review"
                      secondary="Q3 reviews completed"
                    />
                  </ListItem>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <ChangeHistory fontSize="small" color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Change Initiative"
                      secondary="New department structure approved"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Key Metrics */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Position Coverage
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Filled Positions</Typography>
                    <Typography variant="body2">{stats.filledPositions}/{stats.totalPositions}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={formatPercentage(stats.filledPositions, stats.totalPositions)}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Job Descriptions</Typography>
                    <Typography variant="body2">{stats.jobDescriptions}/{stats.totalPositions}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={formatPercentage(stats.jobDescriptions, stats.totalPositions)}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Succession Plans</Typography>
                    <Typography variant="body2">{stats.successionPlans}/{stats.totalPositions}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={formatPercentage(stats.successionPlans, stats.totalPositions)}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Change Management
                </Typography>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Active Change Initiatives
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Chip label="Department Restructuring" color="primary" size="small" />
                    <Chip label="New Technology Implementation" color="secondary" size="small" />
                    <Chip label="Process Optimization" color="success" size="small" />
                    <Chip label="Leadership Development" color="info" size="small" />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Upcoming Initiatives
                  </Typography>
                  <List dense>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Timeline fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Digital Transformation"
                        secondary="Starting next month"
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Psychology fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Culture Change Program"
                        secondary="Planning phase"
                      />
                    </ListItem>
                  </List>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
        >
          <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default OrganizationalDevelopment; 