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
import { useAuth } from '../../contexts/AuthContext';
import candidateApprovalService from '../../services/candidateApprovalService';

const ApprovalDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
      const response = await candidateApprovalService.getApprovalById(id);
      setApproval(response.data);
    } catch (error) {
      setError(error.message || 'Failed to load approval details');
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
      const approverEmail = currentLevel?.approverEmail || user?.email || 'external.approver@company.com';
      
      const approvalData = {
        comments: formData.comments,
        signature: formData.signature || 'Digital approval by ' + (user?.email || approverEmail),
        approverEmail: approverEmail
      };
      
      await candidateApprovalService.approveApproval(id, approvalData);
      
      setApprovalDialogOpen(false);
      setFormData({ comments: '', signature: '', agreeToTerms: false });
      loadApproval();
    } catch (error) {
      setError(error.message || 'Failed to submit approval');
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
      const rejectionData = {
        comments: formData.comments,
        signature: formData.signature || 'Digital rejection by ' + (user?.email || 'External Approver')
      };
      
      await candidateApprovalService.rejectApproval(id, rejectionData);
      
      setRejectionDialogOpen(false);
      setFormData({ comments: '', signature: '', agreeToTerms: false });
      loadApproval();
    } catch (error) {
      setError(error.message || 'Failed to submit rejection');
    } finally {
      setSubmitting(false);
    }
  };

  const getCurrentLevel = () => {
    if (!approval) return null;
    return approval.approvalLevels.find(level => level.status === 'pending');
  };

  const canApprove = () => {
    const currentLevel = getCurrentLevel();
    return currentLevel && currentLevel.approverEmail === user.email;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'info';
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
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!approval) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error">Approval not found</Alert>
      </Container>
    );
  }

  const currentLevel = getCurrentLevel();

  return (
    <Container maxWidth="lg">
      <Box display="flex" alignItems="center" mb={3}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/hr/candidate-approvals')}
          sx={{ mr: 2 }}
        >
          Back to Approvals
        </Button>
        <Typography variant="h4" component="h1">
          Candidate Approval
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Approval Progress */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Approval Progress
          </Typography>
          <Stepper activeStep={approval.currentLevel - 1} alternativeLabel>
            {approval.approvalLevels.map((level, index) => (
              <Step key={index}>
                <StepLabel
                  icon={
                    <Box position="relative">
                      {getStatusIcon(level.status)}
                      {level.status === 'pending' && level.approverEmail === user.email && (
                        <Box
                          position="absolute"
                          top={-5}
                          right={-5}
                          width={20}
                          height={20}
                          borderRadius="50%"
                          bgcolor="warning.main"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          fontSize="12px"
                          color="white"
                        >
                          !
                        </Box>
                      )}
                    </Box>
                  }
                >
                  <Typography variant="caption">
                    {level.title}
                  </Typography>
                  <Chip
                    label={level.status.toUpperCase()}
                    color={getStatusColor(level.status)}
                    size="small"
                    sx={{ mt: 1 }}
                  />
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
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ mr: 2 }}>
                  <PersonIcon />
                </Avatar>
                <Typography variant="h6">
                  Candidate Information
                </Typography>
              </Box>
              
              <Typography><strong>Name:</strong> {approval.candidate?.firstName} {approval.candidate?.lastName}</Typography>
              <Typography><strong>Email:</strong> {approval.candidate?.email}</Typography>
              <Typography><strong>Phone:</strong> {approval.candidate?.phone}</Typography>
              <Typography><strong>Date of Birth:</strong> {new Date(approval.candidate?.dateOfBirth).toLocaleDateString()}</Typography>
              <Typography><strong>Nationality:</strong> {approval.candidate?.nationality}</Typography>
              
              {approval.candidate?.address && (
                <Box mt={2}>
                  <Typography variant="subtitle2">Address:</Typography>
                  <Typography variant="body2">
                    {approval.candidate.address.street}<br />
                    {approval.candidate.address.city}, {approval.candidate.address.state}<br />
                    {approval.candidate.address.country} {approval.candidate.address.postalCode}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Position Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ mr: 2 }}>
                  <WorkIcon />
                </Avatar>
                <Typography variant="h6">
                  Position Information
                </Typography>
              </Box>
              
              <Typography><strong>Job Title:</strong> {approval.jobPosting?.title}</Typography>
              <Typography><strong>Department:</strong> {approval.jobPosting?.department?.name}</Typography>
              <Typography><strong>Application ID:</strong> {approval.application?.applicationId || approval.application?._id}</Typography>
              <Typography><strong>Expected Salary:</strong> ${approval.application?.expectedSalary?.toLocaleString()}</Typography>
              
              {approval.jobPosting?.description && (
                <Box mt={2}>
                  <Typography variant="subtitle2">Job Description:</Typography>
                  <Typography variant="body2">
                    {approval.jobPosting.description}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Education & Experience */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ mr: 2 }}>
                  <SchoolIcon />
                </Avatar>
                <Typography variant="h6">
                  Education & Experience
                </Typography>
              </Box>
              
              <Typography><strong>Current Position:</strong> {approval.candidate?.currentPosition || 'N/A'}</Typography>
              <Typography><strong>Current Company:</strong> {approval.candidate?.currentCompany || 'N/A'}</Typography>
              <Typography><strong>Years of Experience:</strong> {approval.candidate?.yearsOfExperience || 0}</Typography>
              <Typography><strong>Notice Period:</strong> {approval.candidate?.noticePeriod || 30} days</Typography>
              
              {approval.candidate?.education && approval.candidate.education.length > 0 && (
                <Box mt={2}>
                  <Typography variant="subtitle2">Education:</Typography>
                  <List dense>
                    {approval.candidate.education.map((edu, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`${edu.degree} in ${edu.field}`}
                          secondary={`${edu.institution} (${edu.graduationYear})`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Skills & Certifications */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ mr: 2 }}>
                  <DocumentIcon />
                </Avatar>
                <Typography variant="h6">
                  Skills & Certifications
                </Typography>
              </Box>
              
              {approval.candidate?.skills && approval.candidate.skills.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2">Skills:</Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {approval.candidate.skills.map((skill, index) => (
                      <Chip
                        key={index}
                        label={`${skill.name} (${skill.level})`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              {approval.candidate?.certifications && approval.candidate.certifications.length > 0 && (
                <Box>
                  <Typography variant="subtitle2">Certifications:</Typography>
                  <List dense>
                    {approval.candidate.certifications.map((cert, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={cert.name}
                          secondary={`${cert.issuingOrganization} (${new Date(cert.issueDate).getFullYear()})`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Approval Actions */}
        {canApprove() && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Your Approval Decision
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={2}>
                  You are currently at Level {currentLevel?.level}: {currentLevel?.title}
                </Typography>
                
                <Box display="flex" gap={2}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<ApprovedIcon />}
                    onClick={() => setApprovalDialogOpen(true)}
                    size="large"
                  >
                    Approve Candidate
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<RejectedIcon />}
                    onClick={() => setRejectionDialogOpen(true)}
                    size="large"
                  >
                    Reject Candidate
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Approval History */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Approval History
              </Typography>
              <List>
                {approval.approvalLevels.map((level, index) => (
                  <ListItem key={index}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: getStatusColor(level.status) }}>
                        {getStatusIcon(level.status)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`Level ${level.level}: ${level.title}`}
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            Status: {level.status.toUpperCase()}
                          </Typography>
                          {level.approver && (
                            <Typography variant="body2">
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
                              {new Date(level.approvedAt).toLocaleString()}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onClose={() => setApprovalDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Approve Candidate</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" mb={2}>
            You are about to approve this candidate for the position of {approval.jobPosting?.title}.
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Comments (Optional)"
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Digital Signature"
            value={formData.signature}
            onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
            placeholder="Type your name as digital signature"
            sx={{ mb: 2 }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.agreeToTerms}
                onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
              />
            }
            label="I confirm that I have reviewed all candidate information and approve this candidate for the position"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleApprove}
            variant="contained"
            color="success"
            disabled={submitting || !formData.agreeToTerms}
            startIcon={<SendIcon />}
          >
            {submitting ? <CircularProgress size={20} /> : 'Submit Approval'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onClose={() => setRejectionDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Reject Candidate</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" mb={2}>
            You are about to reject this candidate for the position of {approval.jobPosting?.title}.
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Rejection Comments (Required)"
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            required
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            label="Digital Signature"
            value={formData.signature}
            onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
            placeholder="Type your name as digital signature"
            sx={{ mb: 2 }}
          />
          
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.agreeToTerms}
                onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
              />
            }
            label="I confirm that I have reviewed all candidate information and reject this candidate for the position"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectionDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            disabled={submitting || !formData.agreeToTerms || !formData.comments.trim()}
            startIcon={<SendIcon />}
          >
            {submitting ? <CircularProgress size={20} /> : 'Submit Rejection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ApprovalDetail; 