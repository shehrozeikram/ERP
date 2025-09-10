import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Box,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  TextField,
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Pending as PendingIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Work as WorkIcon,
  School as SchoolIcon,
  Description as DocumentIcon,
  Signature as SignatureIcon,
  Send as SendIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import axios from 'axios';

const PublicApproval = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [approval, setApproval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    comments: '',
    signature: '',
    agreeToTerms: false
  });

  useEffect(() => {
    loadApproval();
  }, [id]);

  const loadApproval = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5001'}/api/public-approvals/${id}`);
      setApproval(response.data.data);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to load approval details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!formData.agreeToTerms) {
      setError('You must agree to the terms before approving');
      return;
    }

    try {
      setSubmitting(true);
      
      // Get the current level's approver email
      const currentLevel = approval?.approvalLevels?.find(level => level.status === 'pending');
      const approverEmail = currentLevel?.approverEmail || 'external.approver@company.com';
      
      const approvalData = {
        comments: formData.comments,
        signature: formData.signature || 'Digital approval by ' + approverEmail,
        approverEmail: approverEmail
      };
      
      await axios.post(`${process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5001'}/api/public-approvals/${id}/approve`, approvalData);
      
      setApprovalDialogOpen(false);
      setFormData({ comments: '', signature: '', agreeToTerms: false });
      loadApproval();
      
      // Show success message
      alert('Approval submitted successfully! The next approver will be notified.');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit approval');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!formData.agreeToTerms) {
      setError('You must agree to the terms before rejecting');
      return;
    }

    try {
      setSubmitting(true);
      
      // Get the current level's approver email
      const currentLevel = approval?.approvalLevels?.find(level => level.status === 'pending');
      const approverEmail = currentLevel?.approverEmail || 'external.approver@company.com';
      
      const rejectionData = {
        comments: formData.comments,
        signature: formData.signature || 'Digital rejection by ' + approverEmail,
        approverEmail: approverEmail
      };
      
      await axios.post(`${process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5001'}/api/public-approvals/${id}/reject`, rejectionData);
      
      setRejectionDialogOpen(false);
      setFormData({ comments: '', signature: '', agreeToTerms: false });
      loadApproval();
      
      // Show success message
      alert('Rejection submitted successfully! The candidate will be notified.');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit rejection');
    } finally {
      setSubmitting(false);
    }
  };

  const getCurrentLevel = () => {
    return approval?.approvalLevels?.find(level => level.status === 'pending');
  };

  const canApprove = () => {
    const currentLevel = getCurrentLevel();
    return currentLevel && currentLevel.status === 'pending';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <ApprovedIcon />;
      case 'rejected': return <RejectedIcon />;
      case 'pending': return <PendingIcon />;
      default: return <PendingIcon />;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </Container>
    );
  }

  if (!approval) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning">
          Approval workflow not found
        </Alert>
      </Container>
    );
  }

  const currentLevel = getCurrentLevel();
  const levelTitles = {
    1: 'Assistant Manager HR',
    2: 'Manager HR',
    3: 'HOD HR',
    4: 'Vice President',
    5: 'CEO'
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          🔐 Candidate Approval Request
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Level {currentLevel?.level}: {levelTitles[currentLevel?.level]}
        </Typography>
      </Box>

      {/* Approval Progress */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📊 Approval Progress
          </Typography>
          <Stepper activeStep={currentLevel?.level - 1} alternativeLabel>
            {approval.approvalLevels.map((level) => (
              <Step key={level.level}>
                <StepLabel
                  icon={getStatusIcon(level.status)}
                  color={getStatusColor(level.status)}
                >
                  {levelTitles[level.level]}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Candidate Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                👤 Candidate Information
              </Typography>
              <List>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${approval.candidate.firstName} ${approval.candidate.lastName}`}
                    secondary="Full Name"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={approval.candidate.email}
                    secondary="Email"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={approval.candidate.phone}
                    secondary="Phone"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Job Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                💼 Job Information
              </Typography>
              <List>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar>
                      <WorkIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={approval.jobPosting.title}
                    secondary="Position"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary={approval.application.applicationId}
                    secondary="Application ID"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Previous Approvals */}
        {approval.approvalLevels.filter(l => l.status === 'approved').length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📋 Previous Approvals
                </Typography>
                {approval.approvalLevels
                  .filter(level => level.status === 'approved')
                  .map((level) => (
                    <Box key={level.level} sx={{ mb: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                      <Typography variant="subtitle1" color="success.dark">
                        ✅ Level {level.level}: {levelTitles[level.level]}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Approved at: {new Date(level.approvedAt).toLocaleString()}
                      </Typography>
                      {level.comments && (
                        <Typography variant="body2" color="text.secondary">
                          Comments: {level.comments}
                        </Typography>
                      )}
                      {level.signature && (
                        <Typography variant="body2" color="text.secondary">
                          Signature: {level.signature}
                        </Typography>
                      )}
                    </Box>
                  ))}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Approval Actions */}
        {canApprove() && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🎯 Your Decision
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Please review the candidate's information and provide your approval or rejection.
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    startIcon={<ApprovedIcon />}
                    onClick={() => setApprovalDialogOpen(true)}
                  >
                    Approve Candidate
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    size="large"
                    startIcon={<RejectedIcon />}
                    onClick={() => setRejectionDialogOpen(true)}
                  >
                    Reject Candidate
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Status Display */}
        {!canApprove() && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📊 Current Status
                </Typography>
                <Chip
                  label={approval.status.toUpperCase()}
                  color={getStatusColor(approval.status)}
                  icon={getStatusIcon(approval.status)}
                  size="large"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  This approval workflow has been completed or is not available for your review.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onClose={() => setApprovalDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Candidate</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Comments (Optional)"
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Digital Signature"
            value={formData.signature}
            onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
            placeholder="Type your name or upload signature"
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.agreeToTerms}
                onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
              />
            }
            label="I agree to approve this candidate and understand this decision will be recorded"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleApprove}
            variant="contained"
            color="success"
            disabled={submitting || !formData.agreeToTerms}
          >
            {submitting ? <CircularProgress size={20} /> : 'Submit Approval'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onClose={() => setRejectionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Candidate</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Rejection Comments (Required)"
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
            required
          />
          <TextField
            fullWidth
            label="Digital Signature"
            value={formData.signature}
            onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
            placeholder="Type your name or upload signature"
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.agreeToTerms}
                onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
              />
            }
            label="I agree to reject this candidate and understand this decision will be recorded"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={submitting || !formData.agreeToTerms || !formData.comments}
          >
            {submitting ? <CircularProgress size={20} /> : 'Submit Rejection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PublicApproval; 