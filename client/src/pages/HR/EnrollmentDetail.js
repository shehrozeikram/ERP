import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Alert,
  Snackbar,
  Container,
  Grid,
  Stack,
  LinearProgress,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Rating
} from '@mui/material';
import {
  ArrowBack,
  People,
  Schedule,
  CheckCircle,
  Star,
  AccessTime,
  CalendarToday,
  Person,
  Book
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import enrollmentService from '../../services/enrollmentService';
import CourseCompletion from '../../components/CourseCompletion';
import CourseRating from '../../components/CourseRating';

const EnrollmentDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showRating, setShowRating] = useState(false);

  const loadEnrollment = useCallback(async () => {
    try {
      setLoading(true);
      const response = await enrollmentService.getEnrollmentById(id);
      setEnrollment(response.data);
    } catch (err) {
      setError('Failed to load enrollment details');
      console.error('Error loading enrollment:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEnrollment();
  }, [loadEnrollment]);

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'warning';
      case 'enrolled':
        return 'info';
      case 'dropped':
        return 'error';
      case 'expired':
        return 'error';
      default:
        return 'default';
    }
  };

  const getEnrollmentTypeColor = (type) => {
    switch (type) {
      case 'assigned':
        return 'primary';
      case 'required':
        return 'error';
      case 'recommended':
        return 'warning';
      case 'self_enrolled':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatProgress = (progress) => {
    return `${progress || 0}%`;
  };

  const formatTimeSpent = (minutes) => {
    if (!minutes) return '0 min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString();
  };

  const formatDateTime = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading enrollment details...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error || !enrollment) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">
            {error || 'Enrollment not found'}
          </Alert>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/hr/learning/enrollments')}
            sx={{ mt: 2 }}
          >
            Back to Enrollments
          </Button>
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
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/hr/learning/enrollments')}
              sx={{ mb: 2 }}
            >
              Back to Enrollments
            </Button>
            <Typography variant="h4" component="h1" gutterBottom>
              Enrollment Details
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View enrollment information and progress
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/hr/learning/enrollments/${id}/edit`)}
            >
              Edit Enrollment
            </Button>
          </Stack>
        </Box>

        <Grid container spacing={3}>
          {/* Main Information */}
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Enrollment Information
                </Typography>
                
                <Grid container spacing={3}>
                  {/* Employee Information */}
                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Person sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="subtitle1" fontWeight="medium">
                        Employee
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        <People />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {enrollment.employee?.firstName} {enrollment.employee?.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {enrollment.employee?.email}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {enrollment.employee?.employeeId}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>

                  {/* Course Information */}
                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Book sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="subtitle1" fontWeight="medium">
                        Course
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">
                        {enrollment.course?.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {enrollment.course?.courseId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {enrollment.course?.category}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Status and Progress */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={3}>
                        <Typography variant="body2" color="text.secondary">
                          Status
                        </Typography>
                        <Chip
                          label={enrollment.statusLabel || enrollment.status}
                          color={getStatusColor(enrollment.status)}
                          sx={{ mt: 1 }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Typography variant="body2" color="text.secondary">
                          Enrollment Type
                        </Typography>
                        <Chip
                          label={enrollment.enrollmentTypeLabel || enrollment.enrollmentType}
                          color={getEnrollmentTypeColor(enrollment.enrollmentType)}
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Typography variant="body2" color="text.secondary">
                          Progress
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 1 }}>
                          {formatProgress(enrollment.progress)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Typography variant="body2" color="text.secondary">
                          Time Spent
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 1 }}>
                          {formatTimeSpent(enrollment.totalTimeSpent)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Grid>

                  {/* Progress Bar */}
                  <Grid item xs={12}>
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Overall Progress
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatProgress(enrollment.progress)}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={enrollment.progress || 0}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Course Completion Component */}
            <CourseCompletion
              enrollmentId={enrollment._id}
              courseTitle={enrollment.course?.title}
              onCompletion={loadEnrollment}
              onRatingPrompt={() => setShowRating(true)}
            />
          </Grid>

          {/* Sidebar Information */}
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {/* Dates */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Important Dates
                  </Typography>
                  <List dense>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CalendarToday fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Enrollment Date"
                        secondary={formatDate(enrollment.createdAt)}
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Schedule fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Due Date"
                        secondary={formatDate(enrollment.dueDate)}
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <AccessTime fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Last Accessed"
                        secondary={formatDateTime(enrollment.lastAccessedAt)}
                      />
                    </ListItem>
                    {enrollment.completedAt && (
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <CheckCircle fontSize="small" color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Completed Date"
                          secondary={formatDateTime(enrollment.completedAt)}
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>

              {/* Assessment Results */}
              {enrollment.assessmentAttempts && enrollment.assessmentAttempts.length > 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Assessment Results
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Attempt</TableCell>
                            <TableCell>Score</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {enrollment.assessmentAttempts.map((attempt, index) => (
                            <TableRow key={index}>
                              <TableCell>{attempt.attemptNumber}</TableCell>
                              <TableCell>{attempt.score}%</TableCell>
                              <TableCell>
                                <Chip
                                  label={attempt.passed ? 'PASSED' : 'FAILED'}
                                  color={attempt.passed ? 'success' : 'error'}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}

              {/* Rating */}
              {enrollment.status === 'completed' && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Course Rating
                    </Typography>
                    {enrollment.rating ? (
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Rating value={enrollment.rating} readOnly />
                          <Typography variant="body2" sx={{ ml: 1 }}>
                            ({enrollment.rating}/5)
                          </Typography>
                        </Box>
                        {enrollment.review && (
                          <Typography variant="body2" color="text.secondary">
                            "{enrollment.review}"
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={<Star />}
                        onClick={() => setShowRating(true)}
                        fullWidth
                      >
                        Rate This Course
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Grid>
        </Grid>

        {/* Rating Dialog */}
        {showRating && (
          <CourseRating
            enrollmentId={enrollment._id}
            courseTitle={enrollment.course?.title}
            onRatingSubmitted={() => {
              setShowRating(false);
              loadEnrollment();
              setSnackbar({
                open: true,
                message: 'Rating submitted successfully!',
                severity: 'success'
              });
            }}
            onClose={() => setShowRating(false)}
          />
        )}

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

export default EnrollmentDetail; 