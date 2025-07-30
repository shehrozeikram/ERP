import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
  Avatar,
  Container,
  useTheme,
  alpha,
  LinearProgress,
  Chip,
  Stack
} from '@mui/material';
import {
  Work,
  People,
  Assignment,
  TrendingUp,
  Add,
  Business,
  Schedule,
  CheckCircle,
  Cancel,
  Pending,
  PersonAdd,
  Description,
  Assessment,
  Group
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import jobPostingService from '../../services/jobPostingService';
import candidateService from '../../services/candidateService';
import applicationService from '../../services/applicationService';

const TalentAcquisition = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // State
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Load statistics
  const loadStats = async () => {
    setLoading(true);
    try {
      const [jobStats, candidateStats, applicationStats] = await Promise.all([
        jobPostingService.getJobPostingStats(),
        candidateService.getCandidateStats(),
        applicationService.getApplicationStats()
      ]);

      setStats({
        jobs: jobStats.data,
        candidates: candidateStats.data,
        applications: applicationStats.data
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error loading statistics',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
          Talent Acquisition
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage job postings, candidates, and applications to build your dream team
        </Typography>
      </Box>

      {/* Quick Actions */}
      <Card sx={{ mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
            🚀 Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                startIcon={<Add />}
                fullWidth
                onClick={() => navigate('/hr/talent-acquisition/job-postings/new')}
                sx={{ mb: 1 }}
              >
                Create Job Posting
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                startIcon={<PersonAdd />}
                fullWidth
                onClick={() => navigate('/hr/talent-acquisition/candidates/new')}
                sx={{ mb: 1 }}
              >
                Add Candidate
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                startIcon={<Assignment />}
                fullWidth
                onClick={() => navigate('/hr/talent-acquisition/applications/new')}
                sx={{ mb: 1 }}
              >
                Create Application
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                startIcon={<Assessment />}
                fullWidth
                onClick={() => navigate('/hr/talent-acquisition/reports')}
                sx={{ mb: 1 }}
              >
                View Reports
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Job Postings Stats */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ color: theme.palette.primary.main }}>
                  Job Postings
                </Typography>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                  <Work sx={{ color: theme.palette.primary.main }} />
                </Avatar>
              </Box>
              
              <Typography variant="h4" sx={{ color: theme.palette.primary.main, fontWeight: 'bold', mb: 1 }}>
                {stats.jobs?.overview?.totalJobPostings || 0}
              </Typography>
              
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip 
                  label={`${stats.jobs?.overview?.publishedJobPostings || 0} Published`} 
                  color="success" 
                  size="small" 
                />
                <Chip 
                  label={`${stats.jobs?.overview?.draftJobPostings || 0} Draft`} 
                  color="default" 
                  size="small" 
                />
              </Stack>
              
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/hr/talent-acquisition/job-postings')}
                fullWidth
              >
                View All Job Postings
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Candidates Stats */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ color: theme.palette.success.main }}>
                  Candidates
                </Typography>
                <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                  <People sx={{ color: theme.palette.success.main }} />
                </Avatar>
              </Box>
              
              <Typography variant="h4" sx={{ color: theme.palette.success.main, fontWeight: 'bold', mb: 1 }}>
                {stats.candidates?.overview?.totalCandidates || 0}
              </Typography>
              
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip 
                  label={`${stats.candidates?.overview?.activeCandidates || 0} Active`} 
                  color="info" 
                  size="small" 
                />
                <Chip 
                  label={`${stats.candidates?.overview?.shortlistedCandidates || 0} Shortlisted`} 
                  color="warning" 
                  size="small" 
                />
              </Stack>
              
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/hr/talent-acquisition/candidates')}
                fullWidth
              >
                View All Candidates
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Applications Stats */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ color: theme.palette.warning.main }}>
                  Applications
                </Typography>
                <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                  <Assignment sx={{ color: theme.palette.warning.main }} />
                </Avatar>
              </Box>
              
              <Typography variant="h4" sx={{ color: theme.palette.warning.main, fontWeight: 'bold', mb: 1 }}>
                {stats.applications?.overview?.totalApplications || 0}
              </Typography>
              
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Chip 
                  label={`${stats.applications?.overview?.appliedApplications || 0} Applied`} 
                  color="info" 
                  size="small" 
                />
                <Chip 
                  label={`${stats.applications?.overview?.hiredApplications || 0} Hired`} 
                  color="success" 
                  size="small" 
                />
              </Stack>
              
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/hr/talent-acquisition/applications')}
                fullWidth
              >
                View All Applications
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Module Navigation */}
      <Grid container spacing={3}>
        {/* Job Postings Module */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate('/hr/talent-acquisition/job-postings')}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), mr: 2 }}>
                  <Work sx={{ color: theme.palette.primary.main }} />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theme.palette.primary.main }}>
                    Job Postings
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create and manage job openings
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Post job openings, manage applications, and track hiring progress. Create compelling job descriptions and reach qualified candidates.
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {stats.jobs?.overview?.publishedJobPostings || 0} active postings
                </Typography>
                <Button variant="text" size="small">
                  Manage Jobs →
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Candidates Module */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate('/hr/talent-acquisition/candidates')}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), mr: 2 }}>
                  <People sx={{ color: theme.palette.success.main }} />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theme.palette.success.main }}>
                    Candidates
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage candidate profiles and information
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Build and maintain a comprehensive candidate database. Track skills, experience, and application history for better hiring decisions.
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {stats.candidates?.overview?.totalCandidates || 0} candidates in database
                </Typography>
                <Button variant="text" size="small">
                  Manage Candidates →
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Applications Module */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate('/hr/talent-acquisition/applications')}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), mr: 2 }}>
                  <Assignment sx={{ color: theme.palette.warning.main }} />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theme.palette.warning.main }}>
                    Applications
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Track application progress and interviews
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Manage the complete application lifecycle from submission to hiring. Schedule interviews, conduct assessments, and make hiring decisions.
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {stats.applications?.overview?.totalApplications || 0} applications received
                </Typography>
                <Button variant="text" size="small">
                  Manage Applications →
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Reports Module */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => navigate('/hr/talent-acquisition/reports')}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), mr: 2 }}>
                  <Assessment sx={{ color: theme.palette.info.main }} />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ color: theme.palette.info.main }}>
                    Reports & Analytics
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    View hiring metrics and insights
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Generate comprehensive reports on hiring performance, candidate sources, time-to-hire, and other key recruitment metrics.
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Detailed analytics and insights
                </Typography>
                <Button variant="text" size="small">
                  View Reports →
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default TalentAcquisition; 