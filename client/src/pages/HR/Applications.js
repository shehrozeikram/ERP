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
  Container,
  useTheme,
  alpha,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Avatar
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Assignment,
  Search,
  FilterList,
  TrendingUp,
  Business,
  Schedule,
  CheckCircle,
  Warning,
  Person,
  Work,
  CalendarToday,
  AccessTime,
  Star,
  StarBorder,
  AutoAwesome,
  Email
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import applicationService from '../../services/applicationService';

const Applications = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // State
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    jobPosting: '',
    candidate: ''
  });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, application: null });

  // Load applications
  const loadApplications = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.jobPosting) params.jobPosting = filters.jobPosting;
      if (filters.candidate) params.candidate = filters.candidate;

      const response = await applicationService.getApplications(params);
      const apps = response.data.docs || [];
      
      // Check for duplicate emails per job posting
      const duplicateEmails = [];
      const emailJobMap = new Map();
      
      apps.forEach(app => {
        const email = app.candidate?.email || app.personalInfo?.email;
        const jobId = app.jobPosting?._id;
        
        if (email && jobId) {
          const key = `${email}-${jobId}`;
          if (emailJobMap.has(key)) {
            duplicateEmails.push({
              email,
              jobTitle: app.jobPosting?.title,
              applicationIds: [emailJobMap.get(key), app._id]
            });
          } else {
            emailJobMap.set(key, app._id);
          }
        }
      });
      
      if (duplicateEmails.length > 0) {
        console.warn('Duplicate applications found:', duplicateEmails);
        setSnackbar({
          open: true,
          message: `Found ${duplicateEmails.length} duplicate applications. Please review.`,
          severity: 'warning'
        });
      }
      
      setApplications(apps);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error loading applications',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount and when filters change
  useEffect(() => {
    loadApplications();
  }, [filters.status, filters.jobPosting, filters.candidate]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filters.search !== undefined) {
        loadApplications();
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [filters.search]);

  // Handle status change
  const handleStatusChange = async (application, newStatus) => {
    try {
      await applicationService.updateApplicationStatus(application._id, newStatus);
      setSnackbar({
        open: true,
        message: 'Application status updated successfully',
        severity: 'success'
      });
      loadApplications();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error updating status',
        severity: 'error'
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteDialog.application) return;

    try {
      await applicationService.deleteApplication(deleteDialog.application._id);
      setSnackbar({
        open: true,
        message: 'Application deleted successfully',
        severity: 'success'
      });
      setDeleteDialog({ open: false, application: null });
      loadApplications();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error deleting application',
        severity: 'error'
      });
    }
  };

  const handleBulkEvaluation = async () => {
    try {
      setLoading(true);
      const response = await applicationService.bulkEvaluateApplications();
      setSnackbar({
        open: true,
        message: response.message || 'Bulk evaluation completed successfully',
        severity: 'success'
      });
      loadApplications();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error during bulk evaluation',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkEmail = async () => {
    try {
      setLoading(true);
      const response = await applicationService.sendBulkShortlistEmails();
      setSnackbar({
        open: true,
        message: response.message || 'Bulk emails sent successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error sending bulk emails',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      applied: 'info',
      screening: 'warning',
      shortlisted: 'primary',
      interview_scheduled: 'warning',
      interviewed: 'primary',
      technical_test: 'warning',
      reference_check: 'info',
      offer_sent: 'success',
      offer_accepted: 'success',
      offer_declined: 'error',
      hired: 'success',
      rejected: 'error',
      withdrawn: 'default'
    };
    return colors[status] || 'default';
  };

  // Get initials for avatar
  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get days since application
  const getDaysSinceApplication = (createdAt) => {
    const days = applicationService.calculateDaysSinceApplication(createdAt);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

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
          Applications
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track application progress and manage the hiring workflow
        </Typography>
      </Box>

      {/* Actions and Filters */}
      <Card sx={{ mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                startIcon={<Add />}
                fullWidth
                onClick={() => navigate('/hr/talent-acquisition/applications/new')}
              >
                Create Application
              </Button>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                startIcon={<AutoAwesome />}
                fullWidth
                onClick={handleBulkEvaluation}
                disabled={loading}
              >
                Evaluate All
              </Button>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                startIcon={<Email />}
                fullWidth
                onClick={handleBulkEmail}
                disabled={loading}
                color="success"
              >
                Send Emails
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                placeholder="Search applications..."
                value={filters.search || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: theme.palette.primary.main,
                    },
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  label="Status"
                  sx={{
                    '& .MuiSelect-select': {
                      paddingRight: '32px', // Ensure space for dropdown icon
                    },
                    '& .MuiSelect-icon': {
                      right: '8px', // Position icon properly
                    }
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="applied">Applied</MenuItem>
                  <MenuItem value="screening">Screening</MenuItem>
                  <MenuItem value="shortlisted">Shortlisted</MenuItem>
                  <MenuItem value="interview_scheduled">Interview Scheduled</MenuItem>
                  <MenuItem value="interviewed">Interviewed</MenuItem>
                  <MenuItem value="technical_test">Technical Test</MenuItem>
                  <MenuItem value="reference_check">Reference Check</MenuItem>
                  <MenuItem value="offer_sent">Offer Sent</MenuItem>
                  <MenuItem value="offer_accepted">Offer Accepted</MenuItem>
                  <MenuItem value="offer_declined">Offer Declined</MenuItem>
                  <MenuItem value="hired">Hired</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="withdrawn">Withdrawn</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Job Posting</InputLabel>
                <Select
                  value={filters.jobPosting}
                  onChange={(e) => setFilters(prev => ({ ...prev, jobPosting: e.target.value }))}
                  label="Job Posting"
                  sx={{
                    '& .MuiSelect-select': {
                      paddingRight: '32px', // Ensure space for dropdown icon
                    },
                    '& .MuiSelect-icon': {
                      right: '8px', // Position icon properly
                    }
                  }}
                >
                  <MenuItem value="">All Jobs</MenuItem>
                  {/* This would be populated with actual job postings */}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <TableCell><strong>Application ID</strong></TableCell>
                  <TableCell><strong>Candidate</strong></TableCell>
                  <TableCell><strong>Job Position</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Shortlist Status</strong></TableCell>
                  <TableCell><strong>Applied Date</strong></TableCell>
                  <TableCell><strong>Expected Salary</strong></TableCell>
                  <TableCell><strong>Availability</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {applications.map((application) => (
                  <TableRow key={application._id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold" color="primary">
                        {application.applicationId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                          {getInitials(
                            application.candidate?.firstName, 
                            application.candidate?.lastName
                          )}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {application.candidate?.fullName || 
                             `${application.candidate?.firstName} ${application.candidate?.lastName}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {application.candidate?.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {application.jobPosting?.title || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {application.jobPosting?.jobCode || 'N/A'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={application.statusLabel || application.status}
                        color={getStatusColor(application.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {application.evaluation ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {application.evaluation.isShortlisted ? (
                            <>
                              <Star sx={{ color: 'gold', fontSize: 20 }} />
                              <Chip
                                label="Shortlisted"
                                color="success"
                                size="small"
                                icon={<AutoAwesome fontSize="small" />}
                              />
                            </>
                          ) : (
                            <>
                              <StarBorder sx={{ color: 'text.secondary', fontSize: 20 }} />
                              <Chip
                                label="Not Shortlisted"
                                color="default"
                                size="small"
                                variant="outlined"
                              />
                            </>
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {application.evaluation.overallScore}/100
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Warning sx={{ color: 'warning.main', fontSize: 20 }} />
                          <Chip
                            label="Pending Evaluation"
                            color="warning"
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {formatDate(application.createdAt)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getDaysSinceApplication(application.createdAt)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {application.expectedSalary ? 
                          applicationService.formatExpectedSalary(application.expectedSalary) : 
                          application.professionalInfo?.expectedSalary ?
                          applicationService.formatExpectedSalary(application.professionalInfo.expectedSalary) :
                          'Not specified'
                        }
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={application.availabilityLabel || 
                               application.availability || 
                               application.professionalInfo?.availability || 
                               'Not specified'}
                        color="info"
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/hr/talent-acquisition/applications/${application._id}`)}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/hr/talent-acquisition/applications/${application._id}/edit`)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteDialog({ open: true, application })}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {applications.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No applications found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Create your first application to get started
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, application: null })}
      >
        <DialogTitle>Delete Application</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete application "{deleteDialog.application?.applicationId}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, application: null })}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

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

export default Applications; 