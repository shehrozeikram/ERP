import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Container,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Chip,
  Grid,
  useTheme
} from '@mui/material';
import {
  CheckCircle,
  Business,
  Work,
  AttachMoney,
  Schedule,
  Person,
  Email,
  Phone
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import candidateService from '../../services/candidateService';

const OfferAcceptance = () => {
  const theme = useTheme();
  const { candidateId } = useParams();
  const navigate = useNavigate();
  
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState({ show: false, text: '', severity: 'info' });

  useEffect(() => {
    loadCandidate();
  }, [candidateId]);

  const loadCandidate = async () => {
    try {
      setLoading(true);
      const response = await candidateService.getCandidateById(candidateId);
      setCandidate(response.data);
    } catch (error) {
      setMessage({
        show: true,
        text: 'Candidate not found or offer has expired',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async () => {
    try {
      setAccepting(true);
      
      await candidateService.acceptJobOffer(candidateId);
      
      setMessage({
        show: true,
        text: 'Congratulations! You have accepted the job offer. We will contact you within 2-3 business days for next steps.',
        severity: 'success'
      });

      // Reload candidate to show updated status
      setTimeout(() => {
        loadCandidate();
      }, 2000);
    } catch (error) {
      let messageText = 'Error accepting offer. Please try again.';
      let severity = 'error';
      
      if (error.status === 409) {
        messageText = 'This job offer has already been accepted. You cannot accept it again.';
        severity = 'info';
      } else if (error.status === 404) {
        messageText = 'Job offer not found or already processed. Please contact HR for assistance.';
        severity = 'warning';
      } else if (error.response?.data?.message) {
        messageText = error.response.data.message;
      }
      
      setMessage({
        show: true,
        text: messageText,
        severity: severity
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclineOffer = () => {
    setMessage({
      show: true,
      text: 'Offer declined. Thank you for your interest in our company.',
      severity: 'info'
    });
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (!candidate) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          Candidate not found or offer has expired.
        </Alert>
      </Container>
    );
  }

  // Check if candidate has already accepted the offer
  if (candidate.status === 'offer_accepted') {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="success">
          🎉 Congratulations! You have already accepted this job offer. We will contact you within 2-3 business days for next steps.
        </Alert>
      </Container>
    );
  }

  // Check if candidate has an active offer
  if (candidate.status !== 'offered' || !candidate.offer) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">
          No active job offer found for this candidate.
        </Alert>
      </Container>
    );
  }

  // Check if offer has expired
  const offerExpired = candidate.offer.offerExpiryDate && new Date() > new Date(candidate.offer.offerExpiryDate);
  
  if (offerExpired) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">
          ⏰ This job offer has expired. Please contact HR for assistance.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box textAlign="center" mb={4}>
            <CheckCircle sx={{ fontSize: 60, color: theme.palette.success.main, mb: 2 }} />
            <Typography variant="h4" component="h1" gutterBottom color="primary">
              🎉 Job Offer
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Congratulations! You've been offered a position at our company
            </Typography>
          </Box>

          {/* Candidate Info */}
          <Paper elevation={1} sx={{ p: 3, mb: 3, backgroundColor: theme.palette.grey[50] }}>
            <Typography variant="h6" gutterBottom>
              <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
              Candidate Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Name:</strong> {candidate.firstName} {candidate.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <Email sx={{ mr: 1, fontSize: 16, verticalAlign: 'middle' }} />
                  {candidate.email}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  <Phone sx={{ mr: 1, fontSize: 16, verticalAlign: 'middle' }} />
                  {candidate.phone}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Experience:</strong> {candidate.yearsOfExperience || 0} years
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {/* Offer Details */}
          <Paper elevation={1} sx={{ p: 3, mb: 3, borderLeft: `4px solid ${theme.palette.primary.main}` }}>
            <Typography variant="h6" gutterBottom>
              <Work sx={{ mr: 1, verticalAlign: 'middle' }} />
              Offer Details
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Business sx={{ mr: 1, color: theme.palette.primary.main }} />
                  <Typography variant="body1">
                    <strong>Position:</strong> {candidate.offer.offeredPosition}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" mb={2}>
                  <AttachMoney sx={{ mr: 1, color: theme.palette.success.main }} />
                  <Typography variant="body1">
                    <strong>Salary:</strong> PKR {candidate.offer.offeredSalary?.toLocaleString() || 'To be discussed'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Business sx={{ mr: 1, color: theme.palette.info.main }} />
                  <Typography variant="body1">
                    <strong>Department:</strong> {candidate.offer.offeredDepartment}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" mb={2}>
                  <Schedule sx={{ mr: 1, color: theme.palette.warning.main }} />
                  <Typography variant="body1">
                    <strong>Offer Date:</strong> {new Date(candidate.offer.offerDate).toLocaleDateString()}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {candidate.offer.offerNotes && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Additional Notes:</strong> {candidate.offer.offerNotes}
                </Typography>
              </Box>
            )}
          </Paper>

          {/* Expiry Warning */}
          {offerExpired ? (
            <Alert severity="error" sx={{ mb: 3 }}>
              ⚠️ This offer has expired on {new Date(candidate.offer.offerExpiryDate).toLocaleDateString()}. 
              Please contact our HR team if you're still interested.
            </Alert>
          ) : (
            <Paper elevation={1} sx={{ p: 3, mb: 3, backgroundColor: theme.palette.warning[50] }}>
              <Typography variant="body1" color="warning.dark">
                ⏰ <strong>Important:</strong> This offer expires on{' '}
                {new Date(candidate.offer.offerExpiryDate).toLocaleDateString()}. 
                Please respond within this timeframe.
              </Typography>
            </Paper>
          )}

          {/* Action Buttons */}
          <Box textAlign="center" mt={4}>
            {!offerExpired ? (
              <Box>
                <Button
                  variant="contained"
                  size="large"
                  color="success"
                  onClick={handleAcceptOffer}
                  disabled={accepting}
                  sx={{ mr: 2, px: 4, py: 1.5 }}
                  startIcon={accepting ? <CircularProgress size={20} /> : <CheckCircle />}
                >
                  {accepting ? 'Accepting...' : '✅ Accept Offer'}
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  color="error"
                  onClick={handleDeclineOffer}
                  sx={{ px: 4, py: 1.5 }}
                >
                  ❌ Decline Offer
                </Button>
              </Box>
            ) : (
              <Button
                variant="contained"
                size="large"
                color="primary"
                onClick={() => window.close()}
                sx={{ px: 4, py: 1.5 }}
              >
                Close
              </Button>
            )}
          </Box>

          {/* Message Display */}
          {message.show && (
            <Box mt={3}>
              <Alert severity={message.severity} onClose={() => setMessage({ ...message, show: false })}>
                {message.text}
              </Alert>
            </Box>
          )}

          {/* Footer */}
          <Divider sx={{ my: 3 }} />
          <Box textAlign="center">
            <Typography variant="body2" color="text.secondary">
              This is an automated message from SGC ERP System
            </Typography>
            <Typography variant="body2" color="text.secondary">
              For inquiries, please contact our HR team
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default OfferAcceptance;
