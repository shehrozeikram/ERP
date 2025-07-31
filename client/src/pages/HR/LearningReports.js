import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
  Snackbar,
  Container,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Rating,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  TrendingUp,
  School,
  People,
  CheckCircle,
  Download,
  Refresh,
  Assignment
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import courseService from '../../services/courseService';
import enrollmentService from '../../services/enrollmentService';
import trainingProgramService from '../../services/trainingProgramService';

const LearningReports = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Data
  const [courseStats, setCourseStats] = useState(null);
  const [enrollmentStats, setEnrollmentStats] = useState(null);
  const [trainingProgramStats, setTrainingProgramStats] = useState(null);
  const [topCourses, setTopCourses] = useState([]);
  const [recentEnrollments, setRecentEnrollments] = useState([]);
  
  // Filters
  const [timeFilter, setTimeFilter] = useState('30');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    loadReportsData();
  }, [timeFilter, categoryFilter]);

  const loadReportsData = async () => {
    try {
      setLoading(true);
      
      // Load course statistics
      const courseStatsResponse = await courseService.getCourseStats();
      setCourseStats(courseStatsResponse.data);
      
      // Load enrollment statistics
      const enrollmentStatsResponse = await enrollmentService.getEnrollmentStats();
      setEnrollmentStats(enrollmentStatsResponse.data);
      
      // Load training program statistics
      const trainingProgramStatsResponse = await trainingProgramService.getTrainingProgramStats();
      setTrainingProgramStats(trainingProgramStatsResponse.data);
      
      // Load top performing courses (real data)
      const topCoursesResponse = await courseService.getTopPerformingCourses(5);
      setTopCourses(topCoursesResponse.data);
      
      // Load recent enrollments (real data)
      const recentEnrollmentsResponse = await enrollmentService.getRecentEnrollments(5);
      setRecentEnrollments(recentEnrollmentsResponse.data);
      
    } catch (err) {
      setError('Failed to load reports data');
      console.error('Error loading reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const calculateCompletionRate = () => {
    if (!enrollmentStats) return 0;
    const total = enrollmentStats.totalEnrollments || 0;
    const completed = enrollmentStats.completedEnrollments || 0;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const calculateAverageProgress = () => {
    if (!enrollmentStats?.progressStats?.averageProgress) return 0;
    return Math.round(enrollmentStats.progressStats.averageProgress);
  };

  const getStatusColor = (status) => {
    const colors = {
      enrolled: 'info',
      in_progress: 'warning',
      completed: 'success',
      dropped: 'error'
    };
    return colors[status] || 'default';
  };



  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading reports...
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Learning Reports & Analytics
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Comprehensive insights into learning performance and trends
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadReportsData}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download />}
            >
              Export Report
            </Button>
          </Stack>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Time Period</InputLabel>
                  <Select
                    value={timeFilter}
                    label="Time Period"
                    onChange={(e) => setTimeFilter(e.target.value)}
                  >
                    <MenuItem value="7">Last 7 days</MenuItem>
                    <MenuItem value="30">Last 30 days</MenuItem>
                    <MenuItem value="90">Last 90 days</MenuItem>
                    <MenuItem value="365">Last year</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={categoryFilter}
                    label="Category"
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    <MenuItem value="technical">Technical Skills</MenuItem>
                    <MenuItem value="soft_skills">Soft Skills</MenuItem>
                    <MenuItem value="leadership">Leadership</MenuItem>
                    <MenuItem value="compliance">Compliance</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <School sx={{ fontSize: 40, color: theme.palette.primary.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {courseStats?.totalCourses || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Courses
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    {courseStats?.publishedCourses || 0} Published
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {courseStats?.draftCourses || 0} Draft
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
                      {enrollmentStats?.totalEnrollments || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Enrollments
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    {enrollmentStats?.completedEnrollments || 0} Completed
                  </Typography>
                  <Typography variant="body2" color="warning.main">
                    {enrollmentStats?.activeEnrollments || 0} Active
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
                      {calculateCompletionRate()}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completion Rate
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    {calculateAverageProgress()}% Avg Progress
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
                      {enrollmentStats?.progressStats?.averageTimeSpent?.toFixed(1) || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Time Spent (min)
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="info.main">
                    Per enrollment
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Assignment sx={{ fontSize: 40, color: theme.palette.warning.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" component="div">
                      {trainingProgramStats?.totalPrograms || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Training Programs
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="success.main">
                    {trainingProgramStats?.activePrograms || 0} Active
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {trainingProgramStats?.draftPrograms || 0} Draft
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Detailed Analytics */}
        <Grid container spacing={3}>
          {/* Top Performing Courses */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" component="h2">
                    Top Performing Courses
                  </Typography>
                  <Button size="small" onClick={() => navigate('/hr/learning/courses')}>
                    View All
                  </Button>
                </Box>
                
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Course</TableCell>
                        <TableCell>Enrollments</TableCell>
                        <TableCell>Completion</TableCell>
                        <TableCell>Rating</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topCourses.map((course, index) => (
                        <TableRow key={course._id || index}>
                          <TableCell>
                            <Box>
                              <Typography variant="subtitle2" component="div">
                                {course.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {course.category}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {course.totalEnrollments || 0}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="success.main">
                              {course.completionRate || 0}%
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Rating
                                value={course.averageRating || 0}
                                readOnly
                                size="small"
                                precision={0.1}
                              />
                              <Typography variant="body2" sx={{ ml: 1 }}>
                                {course.averageRating || 0}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
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
                  <Button size="small" onClick={() => navigate('/hr/learning/enrollments')}>
                    View All
                  </Button>
                </Box>
                
                <Stack spacing={2}>
                  {recentEnrollments.map((enrollment, index) => (
                    <Box key={enrollment._id || index} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle2" component="div">
                          {enrollment.employee?.name || 'Unknown Employee'}
                        </Typography>
                        <Chip
                          label={enrollment.status}
                          color={getStatusColor(enrollment.status)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {enrollment.course?.title || 'Unknown Course'}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          Progress: {enrollment.progress || 0}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(enrollment.enrolledDate).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={enrollment.progress || 0}
                        sx={{ height: 4, borderRadius: 2, mt: 1 }}
                      />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Category Breakdown */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  Course Categories
                </Typography>
                
                {courseStats?.categoryStats?.map((category, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        {category._id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {category.count} courses
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(category.count / (courseStats?.totalCourses || 1)) * 100}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          {/* Enrollment Status Breakdown */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  Enrollment Status
                </Typography>
                
                {enrollmentStats?.statusStats?.map((status, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        {status._id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {status.count} enrollments
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(status.count / (enrollmentStats?.totalEnrollments || 1)) * 100}
                      sx={{ height: 6, borderRadius: 3 }}
                      color={getStatusColor(status._id)}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          {/* Training Program Categories */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h2" gutterBottom>
                  Training Program Categories
                </Typography>
                
                {trainingProgramStats?.categoryStats?.map((category, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        {category._id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {category.count} programs
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(category.count / (trainingProgramStats?.totalPrograms || 1)) * 100}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
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

export default LearningReports; 