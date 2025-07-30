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
  DialogContentText
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Publish,
  Close,
  Cancel,
  Search,
  FilterList,
  TrendingUp,
  Business,
  Schedule,
  CheckCircle,
  Warning
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import jobPostingService from '../../services/jobPostingService';

const JobPostings = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // State
  const [jobPostings, setJobPostings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    employmentType: '',
    experienceLevel: ''
  });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, jobPosting: null });

  // Load job postings
  const loadJobPostings = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.employmentType) params.employmentType = filters.employmentType;
      if (filters.experienceLevel) params.experienceLevel = filters.experienceLevel;

      const response = await jobPostingService.getJobPostings(params);
      setJobPostings(response.data.docs || []);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error loading job postings',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount and when filters change
  useEffect(() => {
    loadJobPostings();
  }, [filters.status, filters.employmentType, filters.experienceLevel]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filters.search !== undefined) {
        loadJobPostings();
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [filters.search]);

  // Handle status change
  const handleStatusChange = async (jobPosting, newStatus) => {
    try {
      let response;
      switch (newStatus) {
        case 'published':
          response = await jobPostingService.publishJobPosting(jobPosting._id);
          break;
        case 'closed':
          response = await jobPostingService.closeJobPosting(jobPosting._id);
          break;
        case 'cancelled':
          response = await jobPostingService.cancelJobPosting(jobPosting._id);
          break;
        default:
          return;
      }

      setSnackbar({
        open: true,
        message: response.message,
        severity: 'success'
      });
      loadJobPostings();
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
    if (!deleteDialog.jobPosting) return;

    try {
      await jobPostingService.deleteJobPosting(deleteDialog.jobPosting._id);
      setSnackbar({
        open: true,
        message: 'Job posting deleted successfully',
        severity: 'success'
      });
      setDeleteDialog({ open: false, jobPosting: null });
      loadJobPostings();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error deleting job posting',
        severity: 'error'
      });
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      published: 'success',
      closed: 'warning',
      cancelled: 'error'
    };
    return colors[status] || 'default';
  };

  // Get deadline status
  const getDeadlineStatus = (deadline) => {
    const days = jobPostingService.getDaysUntilDeadline(deadline);
    if (days < 0) return { color: 'error', label: 'Expired' };
    if (days <= 7) return { color: 'warning', label: 'Urgent' };
    if (days <= 30) return { color: 'info', label: 'Soon' };
    return { color: 'success', label: 'Normal' };
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
          Job Postings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage job openings and track application progress
        </Typography>
      </Box>

      {/* Actions and Filters */}
      <Card sx={{ mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                startIcon={<Add />}
                fullWidth
                onClick={() => navigate('/hr/talent-acquisition/job-postings/new')}
              >
                Create Job Posting
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                placeholder="Search job postings..."
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
            <Grid item xs={12} md={2}>
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
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Employment Type</InputLabel>
                <Select
                  value={filters.employmentType}
                  onChange={(e) => setFilters(prev => ({ ...prev, employmentType: e.target.value }))}
                  label="Employment Type"
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
                  <MenuItem value="full_time">Full Time</MenuItem>
                  <MenuItem value="part_time">Part Time</MenuItem>
                  <MenuItem value="contract">Contract</MenuItem>
                  <MenuItem value="internship">Internship</MenuItem>
                  <MenuItem value="temporary">Temporary</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Experience Level</InputLabel>
                <Select
                  value={filters.experienceLevel}
                  onChange={(e) => setFilters(prev => ({ ...prev, experienceLevel: e.target.value }))}
                  label="Experience Level"
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
                  <MenuItem value="entry">Entry Level</MenuItem>
                  <MenuItem value="junior">Junior</MenuItem>
                  <MenuItem value="mid">Mid Level</MenuItem>
                  <MenuItem value="senior">Senior</MenuItem>
                  <MenuItem value="lead">Lead</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="director">Director</MenuItem>
                  <MenuItem value="executive">Executive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Job Postings Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <TableCell><strong>Job Title</strong></TableCell>
                  <TableCell><strong>Department</strong></TableCell>
                  <TableCell><strong>Location</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Applications</strong></TableCell>
                  <TableCell><strong>Deadline</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobPostings.map((jobPosting) => {
                  const deadlineStatus = getDeadlineStatus(jobPosting.applicationDeadline);
                  return (
                    <TableRow key={jobPosting._id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {jobPosting.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {jobPosting.jobCode}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {jobPosting.department?.name || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {jobPosting.location?.name || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={jobPosting.statusLabel || jobPosting.status}
                          color={getStatusColor(jobPosting.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {jobPosting.applications || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={deadlineStatus.label}
                          color={deadlineStatus.color}
                          size="small"
                          icon={deadlineStatus.color === 'error' ? <Warning /> : <Schedule />}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/hr/talent-acquisition/job-postings/${jobPosting._id}`)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          
                          {jobPosting.status === 'draft' && (
                            <>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/hr/talent-acquisition/job-postings/${jobPosting._id}/edit`)}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Publish">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleStatusChange(jobPosting, 'published')}
                                >
                                  <Publish fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setDeleteDialog({ open: true, jobPosting })}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          
                          {jobPosting.status === 'published' && (
                            <>
                              <Tooltip title="Close">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() => handleStatusChange(jobPosting, 'closed')}
                                >
                                  <Close fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Cancel">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleStatusChange(jobPosting, 'cancelled')}
                                >
                                  <Cancel fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          
          {jobPostings.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No job postings found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Create your first job posting to get started
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, jobPosting: null })}
      >
        <DialogTitle>Delete Job Posting</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{deleteDialog.jobPosting?.title}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, jobPosting: null })}>
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

export default JobPostings; 