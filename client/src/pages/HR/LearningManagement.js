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
  Stack
} from '@mui/material';
import {
  School,
  People,
  TrendingUp,
  Add,
  Visibility,
  Edit,
  CheckCircle,
  Assessment
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import courseService from '../../services/courseService';
import enrollmentService from '../../services/enrollmentService';

const LearningManagement = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentCourses, setRecentCourses] = useState([]);
  const [recentEnrollments, setRecentEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load course statistics
      const courseStatsResponse = await courseService.getCourseStats();
      const courseStats = courseStatsResponse.data;
      
      // Load enrollment statistics
      const enrollmentStatsResponse = await enrollmentService.getEnrollmentStats();
      const enrollmentStats = enrollmentStatsResponse.data;
      
      setStats({
        ...courseStats,
        ...enrollmentStats
      });
      
      setRecentCourses(courseStats.recentCourses || []);
      setRecentEnrollments(enrollmentStats.recentEnrollments || []);
      
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      published: 'success',
      archived: 'error',
      maintenance: 'warning',
      enrolled: 'info',
      in_progress: 'warning',
      completed: 'success',
      dropped: 'error'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Draft',
      published: 'Published',
      archived: 'Archived',
      maintenance: 'Under Maintenance',
      enrolled: 'Enrolled',
      in_progress: 'In Progress',
      completed: 'Completed',
      dropped: 'Dropped'
    };
    return labels[status] || status;
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0 hours';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
      return `${remainingMinutes} minutes`;
    } else if (remainingMinutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  const formatProgress = (progress) => {
    if (!progress) return '0%';
    return `${Math.round(progress)}%`;
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading Learning Management Dashboard...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Learning & Development
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage courses, enrollments, and training programs
          </Typography>
        </Box>

        {/* Quick Actions */}
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate('/hr/learning/courses/new')}
            >
              Create Course
            </Button>
            <Button
              variant="outlined"
              startIcon={<People />}
              onClick={() => navigate('/hr/learning/enrollments')}
            >
              Manage Enrollments
            </Button>
            <Button
              variant="outlined"
              startIcon={<School />}
              onClick={() => navigate('/hr/learning/programs')}
            >
              Training Programs
            </Button>
            <Button
              variant="outlined"
              startIcon={<Assessment />}
              onClick={() => navigate('/hr/learning/reports')}
            >
              Reports & Analytics
            </Button>
            <Button
              variant="outlined"
              startIcon={<School />}
              onClick={() => navigate('/hr/learning/programs/new')}
            >
              Create Program
            </Button>
            {/* Reports are now accessible through the sidebar menu under Learning & Development */}
          </Stack>
        </Box>

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <School sx={{ fontSize: 40, color: theme.palette.primary.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats?.totalCourses || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Courses
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    {stats?.publishedCourses || 0} Published
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stats?.draftCourses || 0} Draft
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <People sx={{ fontSize: 40, color: theme.palette.secondary.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats?.totalEnrollments || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Enrollments
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    {stats?.completedEnrollments || 0} Completed
                  </Typography>
                  <Typography variant="body2" color="warning.main">
                    {stats?.activeEnrollments || 0} Active
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CheckCircle sx={{ fontSize: 40, color: theme.palette.success.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats?.completedEnrollments || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    {stats?.progressStats?.averageProgress?.toFixed(1) || 0}% Avg Progress
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TrendingUp sx={{ fontSize: 40, color: theme.palette.info.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats?.activeEnrollments || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      In Progress
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="info.main">
                    {stats?.progressStats?.averageTimeSpent?.toFixed(1) || 0} min avg
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent Courses and Enrollments */}
        <Grid container spacing={3}>
          {/* Recent Courses */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" component="h2">
                    Recent Courses
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => navigate('/hr/learning/courses')}
                  >
                    View All
                  </Button>
                </Box>
                
                {recentCourses.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No courses created yet
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {recentCourses.map((course) => (
                      <Box key={course._id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="subtitle2" component="div">
                            {course.title}
                          </Typography>
                          <Chip
                            label={getStatusLabel(course.status)}
                            color={getStatusColor(course.status)}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {course.courseId} • {formatDuration(course.duration)}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(course.createdAt).toLocaleDateString()}
                          </Typography>
                          <Box>
                            <Tooltip title="View Course">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/hr/learning/courses/${course._id}`)}
                              >
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Course">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/hr/learning/courses/${course._id}/edit`)}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Enrollments */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" component="h2">
                    Recent Enrollments
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => navigate('/hr/learning/enrollments')}
                  >
                    View All
                  </Button>
                </Box>
                
                {recentEnrollments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No enrollments yet
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {recentEnrollments.map((enrollment) => (
                      <Box key={enrollment._id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="subtitle2" component="div">
                            {enrollment.employee?.firstName} {enrollment.employee?.lastName}
                          </Typography>
                          <Chip
                            label={getStatusLabel(enrollment.status)}
                            color={getStatusColor(enrollment.status)}
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {enrollment.course?.title}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Progress: {formatProgress(enrollment.progress)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(enrollment.createdAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={enrollment.progress || 0}
                          sx={{ height: 4, borderRadius: 2 }}
                        />
                      </Box>
                    ))}
                  </Stack>
                )}
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

export default LearningManagement; 