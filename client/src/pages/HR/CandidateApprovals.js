import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Pending as PendingIcon,
  TrendingUp as ProgressIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import candidateApprovalService from '../../services/candidateApprovalService';
import candidateService from '../../services/candidateService';
import jobPostingService from '../../services/jobPostingService';
import applicationService from '../../services/applicationService';

const CandidateApprovals = () => {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [jobPostings, setJobPostings] = useState([]);
  const [applications, setApplications] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });

  // Form state for creating approval
  const [formData, setFormData] = useState({
    candidateId: '',
    jobPostingId: '',
    applicationId: '',
    approverEmails: ['', '', '', '', '']
  });

  useEffect(() => {
    loadApprovals();
    loadCandidates();
    loadJobPostings();
    loadApplications();
  }, [filters]);

  const loadApprovals = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      
      const response = await candidateApprovalService.getApprovals(params);
      setApprovals(response.data.docs || response.data);
    } catch (error) {
      setError(error.message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const loadCandidates = async () => {
    try {
      const response = await candidateService.getCandidates({ status: 'passed' });
      setCandidates(response.data.docs || response.data);
    } catch (error) {
      console.error('Failed to load candidates:', error);
    }
  };

  const loadJobPostings = async () => {
    try {
      const response = await jobPostingService.getJobPostings();
      setJobPostings(response.data.docs || response.data);
    } catch (error) {
      console.error('Failed to load job postings:', error);
    }
  };

  const loadApplications = async () => {
    try {
      const response = await applicationService.getApplications();
      setApplications(response.data.docs || response.data);
    } catch (error) {
      console.error('Failed to load applications:', error);
    }
  };

  const handleCreateApproval = async () => {
    try {
      // Validate approver emails
      const validEmails = formData.approverEmails.filter(email => email.trim() !== '');
      if (validEmails.length !== 5) {
        setError('Exactly 5 approver emails are required');
        return;
      }

      await candidateApprovalService.createApproval({
        candidateId: formData.candidateId,
        jobPostingId: formData.jobPostingId,
        applicationId: formData.applicationId,
        approverEmails: validEmails
      });

      setCreateDialogOpen(false);
      setFormData({
        candidateId: '',
        jobPostingId: '',
        applicationId: '',
        approverEmails: ['', '', '', '', '']
      });
      loadApprovals();
    } catch (error) {
      setError(error.message || 'Failed to create approval workflow');
    }
  };

  const handleViewApproval = async (id) => {
    try {
      const response = await candidateApprovalService.getApprovalById(id);
      setSelectedApproval(response.data);
      setViewDialogOpen(true);
    } catch (error) {
      setError(error.message || 'Failed to load approval details');
    }
  };

  const handleSendReminder = async (id) => {
    try {
      await candidateApprovalService.sendReminder(id);
      setReminderDialogOpen(false);
      loadApprovals();
    } catch (error) {
      setError(error.message || 'Failed to send reminder');
    }
  };

  const handleCancelApproval = async (id) => {
    if (window.confirm('Are you sure you want to cancel this approval workflow?')) {
      try {
        await candidateApprovalService.cancelApproval(id);
        loadApprovals();
      } catch (error) {
        setError(error.message || 'Failed to cancel approval');
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'in_progress': return 'warning';
      case 'pending': return 'info';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <ApprovedIcon />;
      case 'rejected': return <RejectedIcon />;
      case 'in_progress': return <ProgressIcon />;
      case 'pending': return <PendingIcon />;
      default: return <PendingIcon />;
    }
  };

  const getProgressPercentage = (approval) => {
    const approvedLevels = approval.approvalLevels.filter(level => level.status === 'approved').length;
    return Math.round((approvedLevels / 5) * 100);
  };

  const getCurrentLevel = (approval) => {
    const pendingLevel = approval.approvalLevels.find(level => level.status === 'pending');
    return pendingLevel ? pendingLevel.level : null;
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Candidate Approvals
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Approval Workflow
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by candidate name or position..."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setFilters({ status: '', search: '' })}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Approvals Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Candidate</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Current Level</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {approvals.map((approval) => (
              <TableRow key={approval._id}>
                <TableCell>
                  <Box>
                    <Typography variant="subtitle2">
                      {approval.candidate?.firstName} {approval.candidate?.lastName}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {approval.candidate?.email}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2">
                    {approval.jobPosting?.title}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {approval.jobPosting?.department?.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={getStatusIcon(approval.status)}
                    label={approval.status.replace('_', ' ').toUpperCase()}
                    color={getStatusColor(approval.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center">
                    <Box sx={{ width: '100%', mr: 1 }}>
                      <Box
                        sx={{
                          width: '100%',
                          height: 8,
                          backgroundColor: 'grey.200',
                          borderRadius: 1,
                          overflow: 'hidden'
                        }}
                      >
                        <Box
                          sx={{
                            width: `${getProgressPercentage(approval)}%`,
                            height: '100%',
                            backgroundColor: 'primary.main',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </Box>
                    </Box>
                    <Typography variant="caption">
                      {getProgressPercentage(approval)}%
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {getCurrentLevel(approval) ? (
                    <Chip
                      label={`Level ${getCurrentLevel(approval)}`}
                      color="warning"
                      size="small"
                    />
                  ) : (
                    <Typography variant="caption" color="textSecondary">
                      Completed
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {new Date(approval.createdAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => handleViewApproval(approval._id)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    {approval.status === 'pending' || approval.status === 'in_progress' ? (
                      <>
                        <Tooltip title="Send Reminder">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedApproval(approval);
                              setReminderDialogOpen(true);
                            }}
                          >
                            <EmailIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancel Workflow">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleCancelApproval(approval._id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : null}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Approval Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Approval Workflow</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Candidate</InputLabel>
                <Select
                  value={formData.candidateId}
                  onChange={(e) => setFormData({ ...formData, candidateId: e.target.value })}
                  label="Candidate"
                >
                  {candidates.map((candidate) => (
                    <MenuItem key={candidate._id} value={candidate._id}>
                      {candidate.firstName} {candidate.lastName} - {candidate.email}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Job Posting</InputLabel>
                <Select
                  value={formData.jobPostingId}
                  onChange={(e) => setFormData({ ...formData, jobPostingId: e.target.value })}
                  label="Job Posting"
                >
                  {jobPostings.map((job) => (
                    <MenuItem key={job._id} value={job._id}>
                      {job.title} - {job.department?.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Application</InputLabel>
                <Select
                  value={formData.applicationId}
                  onChange={(e) => setFormData({ ...formData, applicationId: e.target.value })}
                  label="Application"
                >
                  {applications.map((app) => (
                    <MenuItem key={app._id} value={app._id}>
                      {app.applicationId || app._id} - {app.candidate?.firstName} {app.candidate?.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Approver Emails (5 levels required)
              </Typography>
            </Grid>
            {formData.approverEmails.map((email, index) => (
              <Grid item xs={12} md={6} key={index}>
                <TextField
                  fullWidth
                  label={`Level ${index + 1} - ${['Assistant Manager HR', 'Manager HR', 'HOD HR', 'Vice President', 'CEO'][index]}`}
                  value={email}
                  onChange={(e) => {
                    const newEmails = [...formData.approverEmails];
                    newEmails[index] = e.target.value;
                    setFormData({ ...formData, approverEmails: newEmails });
                  }}
                  placeholder="approver@company.com"
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateApproval} variant="contained" color="primary">
            Create Workflow
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Approval Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Approval Workflow Details</DialogTitle>
        <DialogContent>
          {selectedApproval && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6">Candidate Information</Typography>
                  <Typography><strong>Name:</strong> {selectedApproval.candidate?.firstName} {selectedApproval.candidate?.lastName}</Typography>
                  <Typography><strong>Email:</strong> {selectedApproval.candidate?.email}</Typography>
                  <Typography><strong>Phone:</strong> {selectedApproval.candidate?.phone}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6">Position Information</Typography>
                  <Typography><strong>Title:</strong> {selectedApproval.jobPosting?.title}</Typography>
                  <Typography><strong>Department:</strong> {selectedApproval.jobPosting?.department?.name}</Typography>
                  <Typography><strong>Application ID:</strong> {selectedApproval.application?.applicationId || selectedApproval.application?._id}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h6">Approval Levels</Typography>
                  {selectedApproval.approvalLevels.map((level, index) => (
                    <Box key={index} sx={{ mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle1">
                          Level {level.level}: {level.title}
                        </Typography>
                        <Chip
                          label={level.status.toUpperCase()}
                          color={getStatusColor(level.status)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        Email: {level.approverEmail}
                      </Typography>
                      {level.approver && (
                        <Typography variant="body2" color="textSecondary">
                          Approver: {level.approver.firstName} {level.approver.lastName}
                        </Typography>
                      )}
                      {level.comments && (
                        <Typography variant="body2">
                          Comments: {level.comments}
                        </Typography>
                      )}
                      {level.approvedAt && (
                        <Typography variant="caption" color="textSecondary">
                          Approved: {new Date(level.approvedAt).toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={reminderDialogOpen} onClose={() => setReminderDialogOpen(false)}>
        <DialogTitle>Send Reminder</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to send a reminder email to the current approver?
          </Typography>
          {selectedApproval && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Current Level: {getCurrentLevel(selectedApproval)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReminderDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => handleSendReminder(selectedApproval?._id)}
            variant="contained"
            color="primary"
          >
            Send Reminder
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CandidateApprovals; 