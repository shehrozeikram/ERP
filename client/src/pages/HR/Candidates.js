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
  Person,
  Search,
  FilterList,
  TrendingUp,
  Business,
  Schedule,
  CheckCircle,
  Warning,
  Email,
  Phone,
  Work,
  School,
  MarkEmailRead,
  MarkEmailUnread,
  Error
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import candidateService from '../../services/candidateService';
import candidateApprovalService from '../../services/candidateApprovalService';

const Candidates = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    source: '',
    availability: ''
  });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, candidate: null });
  const [approvalDialog, setApprovalDialog] = useState({ open: false, candidate: null });
  const [approvalData, setApprovalData] = useState({
    approverEmails: ['', '', '', '', '']
  });

  // Load candidates
  const loadCandidates = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.source) params.source = filters.source;
      if (filters.availability) params.availability = filters.availability;

      const response = await candidateService.getCandidates(params);
      setCandidates(response.data.docs || []);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error loading candidates',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount and when filters change
  useEffect(() => {
    loadCandidates();
  }, [filters.status, filters.source, filters.availability]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (filters.search !== undefined) {
        loadCandidates();
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [filters.search]);

  // Handle status change
  const handleStatusChange = async (candidate, newStatus) => {
    try {
      await candidateService.updateCandidateStatus(candidate._id, newStatus);
      
      // If status is changed to "passed", show approval configuration dialog
      if (newStatus === 'passed') {
        setApprovalDialog({ open: true, candidate });
        setApprovalData({
          approverEmails: [
            'assistant.hr@company.com',
            'manager.hr@company.com', 
            'hod.hr@company.com',
            'vp@company.com',
            'ceo@company.com'
          ]
        });
      } else {
        setSnackbar({
          open: true,
          message: 'Candidate status updated successfully',
          severity: 'success'
        });
      }
      
      loadCandidates();
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
    if (!deleteDialog.candidate) return;

    try {
      await candidateService.deleteCandidate(deleteDialog.candidate._id);
      setSnackbar({
        open: true,
        message: 'Candidate deleted successfully',
        severity: 'success'
      });
      setDeleteDialog({ open: false, candidate: null });
      loadCandidates();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Error deleting candidate',
        severity: 'error'
      });
    }
  };

  // Handle create approval workflow
  const handleCreateApproval = async () => {
    if (!approvalDialog.candidate) return;

    try {
      // Create approval workflow
      const approvalRequestData = {
        candidateId: approvalDialog.candidate._id,
        jobPostingId: approvalDialog.candidate.jobPosting || '688a0e15e1a3b69572795558',
        applicationId: approvalDialog.candidate.application || '688b459a5961257b92c0202f',
        approverEmails: approvalData.approverEmails,
        createdBy: user._id
      };
      
      console.log('Creating approval workflow with data:', approvalRequestData);
      
      await candidateApprovalService.createApproval(approvalRequestData);
      
      setSnackbar({
        open: true,
        message: 'Approval workflow created successfully! The first approver will receive an email notification.',
        severity: 'success'
      });
      
      setApprovalDialog({ open: false, candidate: null });
      loadCandidates();
    } catch (error) {
      console.error('Error creating approval workflow:', error);
      setSnackbar({
        open: true,
        message: error.message || error.response?.data?.message || 'Error creating approval workflow',
        severity: 'error'
      });
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      active: 'info',
      shortlisted: 'warning',
      interviewed: 'primary',
      passed: 'success',
      approval_pending: 'warning',
      approval_in_progress: 'info',
      approved: 'success',
      offered: 'success',
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

  // Get experience level
  const getExperienceLevel = (years) => {
    if (years < 2) return 'Entry Level';
    if (years < 5) return 'Junior';
    if (years < 8) return 'Mid Level';
    if (years < 12) return 'Senior';
    return 'Lead/Manager';
  };

  // Get email delivery status display
  const getEmailDeliveryStatus = (emailDeliveryStatus) => {
    if (!emailDeliveryStatus) {
      return {
        icon: <MarkEmailUnread fontSize="small" />,
        label: 'No Email Sent',
        color: 'default',
        tooltip: 'No shortlist notification email has been sent'
      };
    }

    switch (emailDeliveryStatus.status) {
      case 'delivered':
        return {
          icon: <MarkEmailRead fontSize="small" />,
          label: 'Email Delivered',
          color: 'success',
          tooltip: `Email delivered on ${new Date(emailDeliveryStatus.deliveredAt).toLocaleDateString()}`
        };
      case 'sent':
        return {
          icon: <Email fontSize="small" />,
          label: 'Email Sent',
          color: 'info',
          tooltip: `Email sent on ${new Date(emailDeliveryStatus.sentAt).toLocaleDateString()}`
        };
      case 'failed':
        return {
          icon: <Error fontSize="small" />,
          label: 'Email Failed',
          color: 'error',
          tooltip: `Email failed to send on ${new Date(emailDeliveryStatus.sentAt).toLocaleDateString()}`
        };
      case 'pending':
        return {
          icon: <Schedule fontSize="small" />,
          label: 'Email Pending',
          color: 'warning',
          tooltip: `Email pending since ${new Date(emailDeliveryStatus.sentAt).toLocaleDateString()}`
        };
      default:
        return {
          icon: <MarkEmailUnread fontSize="small" />,
          label: 'Unknown Status',
          color: 'default',
          tooltip: 'Email delivery status unknown'
        };
    }
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
          Candidates
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage candidate profiles and track their application status
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
                onClick={() => navigate('/hr/talent-acquisition/candidates/new')}
              >
                Add Candidate
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                placeholder="Search candidates..."
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
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="shortlisted">Shortlisted</MenuItem>
                  <MenuItem value="interviewed">Interviewed</MenuItem>
                  <MenuItem value="passed">Passed Interview</MenuItem>
                  <MenuItem value="approval_pending">Approval Pending</MenuItem>
                  <MenuItem value="approval_in_progress">Approval In Progress</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="offered">Offered</MenuItem>
                  <MenuItem value="hired">Hired</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="withdrawn">Withdrawn</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Source</InputLabel>
                <Select
                  value={filters.source}
                  onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
                  label="Source"
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
                  <MenuItem value="website">Company Website</MenuItem>
                  <MenuItem value="job_board">Job Board</MenuItem>
                  <MenuItem value="referral">Employee Referral</MenuItem>
                  <MenuItem value="social_media">Social Media</MenuItem>
                  <MenuItem value="recruitment_agency">Recruitment Agency</MenuItem>
                  <MenuItem value="direct_application">Direct Application</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Availability</InputLabel>
                <Select
                  value={filters.availability}
                  onChange={(e) => setFilters(prev => ({ ...prev, availability: e.target.value }))}
                  label="Availability"
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
                  <MenuItem value="immediate">Immediate</MenuItem>
                  <MenuItem value="2_weeks">2 Weeks</MenuItem>
                  <MenuItem value="1_month">1 Month</MenuItem>
                  <MenuItem value="2_months">2 Months</MenuItem>
                  <MenuItem value="3_months">3 Months</MenuItem>
                  <MenuItem value="negotiable">Negotiable</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Candidates Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <TableCell><strong>Candidate</strong></TableCell>
                  <TableCell><strong>Contact</strong></TableCell>
                  <TableCell><strong>Current Position</strong></TableCell>
                  <TableCell><strong>Experience</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Email Status</strong></TableCell>
                  <TableCell><strong>Source</strong></TableCell>
                  <TableCell><strong>Availability</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                          {getInitials(candidate.firstName, candidate.lastName)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {candidate.fullName || `${candidate.firstName} ${candidate.lastName}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {candidate.age ? `${candidate.age} years old` : 'Age not specified'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                          <Email sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          {candidate.email}
                        </Typography>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                          <Phone sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          {candidate.phone}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {candidate.currentPosition || 'Not specified'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {candidate.currentCompany || 'No company'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {getExperienceLevel(candidate.yearsOfExperience)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {candidate.yearsOfExperience || 0} years
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={candidate.statusLabel || candidate.status}
                        color={getStatusColor(candidate.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const emailStatus = getEmailDeliveryStatus(candidate.emailDeliveryStatus);
                        return (
                          <Tooltip title={emailStatus.tooltip}>
                            <Chip
                              icon={emailStatus.icon}
                              label={emailStatus.label}
                              color={emailStatus.color}
                              size="small"
                              variant={emailStatus.color === 'default' ? 'outlined' : 'filled'}
                            />
                          </Tooltip>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {candidate.sourceLabel || candidate.source}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={candidate.availabilityLabel || candidate.availability}
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
                            onClick={() => navigate(`/hr/talent-acquisition/candidates/${candidate._id}`)}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/hr/talent-acquisition/candidates/${candidate._id}/edit`)}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Change Status">
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                              value={candidate.status}
                              onChange={(e) => handleStatusChange(candidate, e.target.value)}
                              displayEmpty
                              sx={{ fontSize: '0.75rem' }}
                            >
                              <MenuItem value="active">Active</MenuItem>
                              <MenuItem value="shortlisted">Shortlisted</MenuItem>
                              <MenuItem value="interviewed">Interviewed</MenuItem>
                              <MenuItem value="passed">Passed Interview</MenuItem>
                              <MenuItem value="approval_pending">Approval Pending</MenuItem>
                              <MenuItem value="approval_in_progress">Approval In Progress</MenuItem>
                              <MenuItem value="approved">Approved</MenuItem>
                              <MenuItem value="offered">Offered</MenuItem>
                              <MenuItem value="hired">Hired</MenuItem>
                              <MenuItem value="rejected">Rejected</MenuItem>
                              <MenuItem value="withdrawn">Withdrawn</MenuItem>
                            </Select>
                          </FormControl>
                        </Tooltip>
                        
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteDialog({ open: true, candidate })}
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
          
          {candidates.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                No candidates found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Add your first candidate to get started
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, candidate: null })}
      >
        <DialogTitle>Delete Candidate</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{deleteDialog.candidate?.fullName || `${deleteDialog.candidate?.firstName} ${deleteDialog.candidate?.lastName}`}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, candidate: null })}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approval Configuration Dialog */}
      <Dialog
        open={approvalDialog.open}
        onClose={() => setApprovalDialog({ open: false, candidate: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Approval Workflow</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Candidate "{approvalDialog.candidate?.firstName} {approvalDialog.candidate?.lastName}" has passed the interview. 
            Please configure the approval workflow by entering the approver emails.
          </DialogContentText>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Approver Emails (5 levels required)
              </Typography>
            </Grid>
            {approvalData.approverEmails.map((email, index) => (
              <Grid item xs={12} md={6} key={index}>
                <TextField
                  fullWidth
                  label={`Level ${index + 1} - ${['Assistant Manager HR', 'Manager HR', 'HOD HR', 'Vice President', 'CEO'][index]}`}
                  value={email}
                  onChange={(e) => {
                    const newEmails = [...approvalData.approverEmails];
                    newEmails[index] = e.target.value;
                    setApprovalData({ ...approvalData, approverEmails: newEmails });
                  }}
                  placeholder="approver@company.com"
                  required
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog({ open: false, candidate: null })}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateApproval} 
            variant="contained" 
            color="primary"
            disabled={approvalData.approverEmails.some(email => !email.trim())}
          >
            Create Approval Workflow
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

export default Candidates; 