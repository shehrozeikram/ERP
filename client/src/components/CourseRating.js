import React, { useState } from 'react';
import {
  Box,
  Typography,
  Rating,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack
} from '@mui/material';
import {
  Star,
  RateReview
} from '@mui/icons-material';
import enrollmentService from '../services/enrollmentService';

const CourseRating = ({ 
  enrollmentId, 
  courseTitle, 
  onRatingSubmitted, 
  existingRating = null,
  existingReview = null,
  disabled = false 
}) => {
  const [rating, setRating] = useState(existingRating || 0);
  const [review, setReview] = useState(existingReview || '');
  const [hover, setHover] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRatingSubmit = async () => {
    if (rating === 0) {
      setSnackbar({
        open: true,
        message: 'Please select a rating before submitting',
        severity: 'error'
      });
      return;
    }

    try {
      setLoading(true);
      await enrollmentService.submitRating(enrollmentId, {
        rating,
        review: review.trim() || undefined
      });

      setSnackbar({
        open: true,
        message: 'Rating submitted successfully!',
        severity: 'success'
      });

      if (onRatingSubmitted) {
        onRatingSubmitted({ rating, review });
      }

      setDialogOpen(false);
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to submit rating',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const labels = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  };

  const getRatingLabel = (value) => {
    return labels[value] || '';
  };

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <RateReview sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" component="h3">
              Rate This Course
            </Typography>
          </Box>

          {courseTitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {courseTitle}
            </Typography>
          )}

          {existingRating ? (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Your Rating:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Rating
                  value={existingRating}
                  readOnly
                  size="large"
                />
                <Typography variant="body1" sx={{ ml: 1 }}>
                  {getRatingLabel(existingRating)}
                </Typography>
              </Box>
              {existingReview && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Your Review:
                  </Typography>
                  <Typography variant="body1" sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50', 
                    borderRadius: 1,
                    fontStyle: 'italic'
                  }}>
                    "{existingReview}"
                  </Typography>
                </Box>
              )}
              <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
                ✓ Thank you for your feedback!
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Share your experience with this course to help others
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Rating:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Rating
                    value={rating}
                    onChange={(event, newValue) => {
                      setRating(newValue);
                    }}
                    onChangeActive={(event, newHover) => {
                      setHover(newHover);
                    }}
                    size="large"
                    disabled={disabled}
                  />
                  {rating !== null && (
                    <Typography variant="body1" sx={{ ml: 1 }}>
                      {getRatingLabel(hover !== -1 ? hover : rating)}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Review (Optional):
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Share your thoughts about this course..."
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  disabled={disabled}
                  variant="outlined"
                />
              </Box>

              <Button
                variant="contained"
                startIcon={<Star />}
                onClick={() => setDialogOpen(true)}
                disabled={disabled || rating === 0}
                fullWidth
              >
                Submit Rating
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Your Rating</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Course:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {courseTitle}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                Your Rating:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Rating value={rating} readOnly size="large" />
                <Typography variant="body1" sx={{ ml: 1 }}>
                  {getRatingLabel(rating)}
                </Typography>
              </Box>
            </Box>

            {review && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Your Review:
                </Typography>
                <Typography variant="body1" sx={{ 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 1,
                  fontStyle: 'italic'
                }}>
                  "{review}"
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleRatingSubmit} 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Rating'}
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

export default CourseRating; 