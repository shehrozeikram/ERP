import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack
} from '@mui/material';
import {
  CheckCircle,
  PlayCircle,
  Assignment,
  VideoLibrary,
  Description,
  Link,
  School,
  Celebration
} from '@mui/icons-material';
import enrollmentService from '../services/enrollmentService';

const CourseCompletion = ({ 
  enrollmentId, 
  courseTitle, 
  onCompletion, 
  onRatingPrompt 
}) => {
  const [completionStatus, setCompletionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [completionDialog, setCompletionDialog] = useState(false);

  const loadCompletionStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await enrollmentService.getCompletionStatus(enrollmentId);
      setCompletionStatus(response.data);
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to load completion status',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => {
    loadCompletionStatus();
  }, [loadCompletionStatus]);

  const handleCompleteCourse = async () => {
    try {
      setCompleting(true);
      const response = await enrollmentService.completeEnrollment(enrollmentId);
      
      setSnackbar({
        open: true,
        message: 'Course completed successfully! You can now rate this course.',
        severity: 'success'
      });

      setCompletionDialog(false);
      
      // Reload completion status
      await loadCompletionStatus();
      
      // Call completion callback
      if (onCompletion) {
        onCompletion(response.data);
      }

      // Show rating prompt after a short delay
      setTimeout(() => {
        if (onRatingPrompt) {
          onRatingPrompt();
        }
      }, 2000);

    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to complete course',
        severity: 'error'
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
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
        return <PlayCircle />;
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
      <Card>
        <CardContent>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Loading completion status...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!completionStatus) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            Failed to load completion status
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { 
    status, 
    progress, 
    materialProgress, 
    assessmentStatus, 
    canComplete,
    requirements 
  } = completionStatus;

  const isCompleted = status === 'completed';

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <School sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" component="h3">
              Course Progress
            </Typography>
          </Box>

          {courseTitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {courseTitle}
            </Typography>
          )}

          {/* Overall Progress */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Overall Progress
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progress}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>

          {/* Status Chip */}
          <Box sx={{ mb: 3 }}>
            <Chip
              label={status.replace('_', ' ').toUpperCase()}
              color={isCompleted ? 'success' : status === 'in_progress' ? 'warning' : 'default'}
              variant="outlined"
            />
          </Box>

          {/* Materials Progress */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Required Materials ({requirements.completedRequiredMaterials}/{requirements.totalRequiredMaterials})
            </Typography>
            
            <List dense>
              {materialProgress.map((material, index) => (
                <ListItem key={material.materialId} sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {material.isCompleted ? (
                      <CheckCircle color="success" />
                    ) : (
                      getMaterialIcon(material.type)
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={material.title}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={getMaterialTypeLabel(material.type)}
                          size="small"
                          variant="outlined"
                        />
                        {material.isCompleted && (
                          <Typography variant="caption" color="success.main">
                            Completed
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Assessment Status */}
          {assessmentStatus.isRequired && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Assessment
              </Typography>
              
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">
                    Best Score:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {assessmentStatus.bestScore}%
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">
                    Passing Score:
                  </Typography>
                  <Typography variant="body2">
                    {assessmentStatus.passingScore}%
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">
                    Attempts:
                  </Typography>
                  <Typography variant="body2">
                    {assessmentStatus.attempts}/{assessmentStatus.maxAttempts}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">
                    Status:
                  </Typography>
                  <Chip
                    label={assessmentStatus.passed ? 'PASSED' : 'NOT PASSED'}
                    color={assessmentStatus.passed ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
              </Stack>
            </Box>
          )}

          {/* Completion Button */}
          {!isCompleted && canComplete && (
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Celebration />}
                onClick={() => setCompletionDialog(true)}
                disabled={completing}
              >
                Complete Course
              </Button>
            </Box>
          )}

          {!isCompleted && !canComplete && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="info">
                Complete all required materials and pass the assessment to finish this course.
              </Alert>
            </Box>
          )}

          {isCompleted && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="success" icon={<CheckCircle />}>
                Course completed! You can now rate this course to share your experience.
              </Alert>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Completion Confirmation Dialog */}
      <Dialog
        open={completionDialog}
        onClose={() => setCompletionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Complete Course</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to mark "{courseTitle}" as completed?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. You will be able to rate the course after completion.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletionDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCompleteCourse} 
            variant="contained"
            disabled={completing}
          >
            {completing ? 'Completing...' : 'Complete Course'}
          </Button>
        </DialogActions>
      </Dialog>

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
    </>
  );
};

export default CourseCompletion; 