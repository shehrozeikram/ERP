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
  Paper
} from '@mui/material';
import {
  ArrowBack,
  School,
  Schedule,
  CheckCircle,
  Star,
  AccessTime,
  CalendarToday,
  Book,
  People,
  Assignment,
  VideoLibrary,
  Description,
  Link
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import trainingProgramService from '../../services/trainingProgramService';

const TrainingProgramDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadProgram = useCallback(async () => {
    try {
      setLoading(true);
      const response = await trainingProgramService.getTrainingProgramById(id);
      setProgram(response.data);
    } catch (err) {
      setError('Failed to load training program details');
      console.error('Error loading training program:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProgram();
  }, [loadProgram]);

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'draft':
        return 'warning';
      case 'inactive':
        return 'error';
      case 'archived':
        return 'default';
      default:
        return 'default';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner':
        return 'success';
      case 'intermediate':
        return 'warning';
      case 'advanced':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'Not specified';
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

  const getMaterialIcon = (type) => {
    switch (type) {
      case 'video':
        return <VideoLibrary />;
      case 'document':
        return <Description />;
      case 'presentation':
        return <Description />;
      case 'quiz':
        return <Assignment />;
      case 'assignment':
        return <Assignment />;
      case 'link':
        return <Link />;
      default:
        return <Book />;
    }
  };

  const getMaterialTypeLabel = (type) => {
    switch (type) {
      case 'video':
        return 'Video';
      case 'document':
        return 'Document';
      case 'presentation':
        return 'Presentation';
      case 'quiz':
        return 'Quiz';
      case 'assignment':
        return 'Assignment';
      case 'link':
        return 'External Link';
      default:
        return 'Material';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading training program details...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error || !program) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">
            {error || 'Training program not found'}
          </Alert>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/hr/learning/programs')}
            sx={{ mt: 2 }}
          >
            Back to Training Programs
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
              onClick={() => navigate('/hr/learning/programs')}
              sx={{ mb: 2 }}
            >
              Back to Training Programs
            </Button>
            <Typography variant="h4" component="h1" gutterBottom>
              Training Program Details
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View comprehensive training program information
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/hr/learning/programs/${id}/edit`)}
            >
              Edit Program
            </Button>
          </Stack>
        </Box>

        <Grid container spacing={3}>
          {/* Main Information */}
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Program Information
                </Typography>
                
                <Grid container spacing={3}>
                  {/* Basic Information */}
                  <Grid item xs={12}>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h5" gutterBottom>
                        {program.title}
                      </Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        {program.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                        <Chip
                          label={program.statusLabel || program.status}
                          color={getStatusColor(program.status)}
                        />
                        <Chip
                          label={program.difficultyLabel || program.difficulty}
                          color={getDifficultyColor(program.difficulty)}
                          variant="outlined"
                        />
                        <Chip
                          label={program.categoryLabel || program.category}
                          variant="outlined"
                        />
                      </Stack>
                    </Box>
                  </Grid>

                  {/* Program Details */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                      Program Details
                    </Typography>
                    <List dense>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <AccessTime fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Duration"
                          secondary={formatDuration(program.duration)}
                        />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <People fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Enrollments"
                          secondary={`${program.currentEnrollments || 0}${program.maxEnrollments ? `/${program.maxEnrollments}` : ''} enrolled`}
                        />
                      </ListItem>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Book fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Type"
                          secondary={program.typeLabel || program.type}
                        />
                      </ListItem>
                    </List>
                  </Grid>

                  {/* Learning Objectives */}
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                      Learning Objectives
                    </Typography>
                    {program.objectives && program.objectives.length > 0 ? (
                      <List dense>
                        {program.objectives.map((objective, index) => (
                          <ListItem key={index} sx={{ px: 0 }}>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <CheckCircle fontSize="small" color="success" />
                            </ListItemIcon>
                            <ListItemText primary={objective} />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No learning objectives specified
                      </Typography>
                    )}
                  </Grid>

                  {/* Target Audience */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                      Target Audience
                    </Typography>
                    <Grid container spacing={2}>
                      {program.targetAudience?.roles && program.targetAudience.roles.length > 0 && (
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Target Roles
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                            {program.targetAudience.roles.map((role, index) => (
                              <Chip key={index} label={role} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        </Grid>
                      )}
                      {program.targetAudience?.departments && program.targetAudience.departments.length > 0 && (
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Target Departments
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
                            {program.targetAudience.departments.map((dept, index) => (
                              <Chip key={index} label={dept} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        </Grid>
                      )}
                      {program.targetAudience?.experienceLevel && (
                        <Grid item xs={12} md={4}>
                          <Typography variant="body2" color="text.secondary">
                            Experience Level
                          </Typography>
                          <Chip 
                            label={program.targetAudience.experienceLevel} 
                            size="small" 
                            variant="outlined"
                            sx={{ mt: 1 }}
                          />
                        </Grid>
                      )}
                    </Grid>
                  </Grid>

                  {/* Completion Criteria */}
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                      Completion Criteria
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Required Courses
                        </Typography>
                        <Typography variant="body1">
                          {program.completionCriteria?.requiredCourses ? 'All courses required' : 'Some courses optional'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Minimum Score
                        </Typography>
                        <Typography variant="body1">
                          {program.completionCriteria?.minimumScore || 'Not specified'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary">
                          Time Limit
                        </Typography>
                        <Typography variant="body1">
                          {program.completionCriteria?.timeLimit || 'No time limit'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Grid>

                  {/* Certification */}
                  {program.providesCertificate && (
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                        Certification
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CheckCircle color="success" />
                        <Typography variant="body1">
                          {program.certificateTemplate || 'Certificate provided upon completion'}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>

            {/* Courses in Program */}
            {program.courses && program.courses.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Courses in Program ({program.courses.length})
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Course</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Duration</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {program.courses.map((course, index) => (
                          <TableRow key={course._id || index}>
                            <TableCell>
                              <Box>
                                <Typography variant="subtitle2">
                                  {course.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {course.courseId}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={course.typeLabel || course.type}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              {formatDuration(course.duration)}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={course.statusLabel || course.status}
                                color={getStatusColor(course.status)}
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
                        primary="Created Date"
                        secondary={formatDate(program.createdAt)}
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Schedule fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Last Updated"
                        secondary={formatDateTime(program.updatedAt)}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>

              {/* Prerequisites */}
              {program.prerequisites && program.prerequisites.length > 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Prerequisites
                    </Typography>
                    <List dense>
                      {program.prerequisites.map((prereq, index) => (
                        <ListItem key={index} sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Assignment fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary={prereq} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              )}

              {/* Program Statistics */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Program Statistics
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Enrollments
                      </Typography>
                      <Typography variant="h6">
                        {program.currentEnrollments || 0}
                      </Typography>
                    </Box>
                    {program.maxEnrollments && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Enrollment Capacity
                        </Typography>
                        <Typography variant="h6">
                          {program.maxEnrollments}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={((program.currentEnrollments || 0) / program.maxEnrollments) * 100}
                          sx={{ mt: 1 }}
                        />
                      </Box>
                    )}
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Completion Rate
                      </Typography>
                      <Typography variant="h6">
                        {program.completionRate ? `${program.completionRate}%` : 'Not available'}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
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

export default TrainingProgramDetail; 