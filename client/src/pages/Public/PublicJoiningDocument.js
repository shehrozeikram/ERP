import React, { useState, useEffect } from 'react';
import { Container, Typography, Paper, Box, Button, Divider, TextField, Alert, CircularProgress } from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import api from '../../services/api';

const PublicJoiningDocument = () => {
  const { approvalId } = useParams();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  // Debug logging
  useEffect(() => {
    console.log('🔍 PublicJoiningDocument component loaded');
    console.log('📋 Approval ID from params:', approvalId);
    console.log('🔗 Current URL:', window.location.href);
  }, [approvalId]);

  const [formData, setFormData] = useState({
    employeeName: '',
    guardianRelation: '',
    guardianName: '',
    cnic: '',
    contactNo: '',
    dutyLocation: '',
    dutyDate: '',
    dutyTime: '',
    department: '',
    hodName: '',
    joiningRemarks: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    console.log('🚀 Submitting joining document...');
    console.log('📋 Approval ID:', approvalId);
    console.log('📝 Form Data:', formData);
    console.log('🔗 API URL:', `/hiring/public/joining-document/${approvalId}`);
    
    try {
      const response = await api.post(`/hiring/public/joining-document/${approvalId}`, formData);
      
      if (response.data.success) {
        setSubmitSuccess(true);
        console.log('✅ Joining document submitted successfully:', response.data);
      } else {
        setError(response.data.message || 'Failed to submit joining document');
      }
    } catch (err) {
      console.error('❌ Error submitting joining document:', err);
      console.error('❌ Error response:', err.response);
      setError(err.response?.data?.message || 'Failed to submit joining document. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center', boxShadow: 3, borderRadius: 2 }}>
          <Typography variant="h4" color="success.main" gutterBottom>
            ✅ Joining Document Submitted Successfully!
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Thank you for completing your joining document. Your information has been saved to our system.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Our HR team will review your submission and contact you within 24-48 hours for next steps.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, boxShadow: 3, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom align="center" color="primary" sx={{ mb: 3, fontWeight: 'bold' }}>
          📝 Employee Joining Document
        </Typography>
        
        <Divider sx={{ mb: 3 }} />
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
              Employee:
            </Typography>
            
            <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', mb: 2 }}>
              Dear Sir
            </Typography>
            
            <Box sx={{ backgroundColor: '#f8f9fa', p: 2, borderRadius: 1, mb: 3 }}>
              <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem' }}>
                With reference to your offer,<br/>
                For the employment as<br/>
                <strong>With Sardar Group of Companies</strong>
              </Typography>
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                label="I Mr. / Mrs. / Ms."
                name="employeeName"
                value={formData.employeeName}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
              />
              
              <TextField
                fullWidth
                label="S/o, D/o, W/o"
                name="guardianRelation"
                value={formData.guardianRelation}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
              />
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                label="Guardian Name"
                name="guardianName"
                value={formData.guardianName}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
              />
              
              <TextField
                fullWidth
                label="CNIC #"
                name="cnic"
                value={formData.cnic}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
                placeholder="00000-0000000-0"
              />
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                label="Contact No"
                name="contactNo"
                value={formData.contactNo}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
                placeholder="03XX-XXXXXXX"
              />
              
              <TextField
                fullWidth
                label="Duty Location"
                name="dutyLocation"
                value={formData.dutyLocation}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
              />
            </Box>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
              <TextField
                fullWidth
                label="Duty Date"
                name="dutyDate"
                type="date"
                value={formData.dutyDate}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              
              <TextField
                fullWidth
                label="Duty Time"
                name="dutyTime"
                type="time"
                value={formData.dutyTime}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, mb: 2 }}>
              <Box sx={{ flex: 1, mr: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom align="center">
                  Signature
                </Typography>
                <Box sx={{ border: '2px solid #1976d2', borderRadius: 1, minHeight: '3rem', backgroundColor: '#fff' }} />
              </Box>
              <Box sx={{ flex: 1, ml: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom align="center">
                  Date
                </Typography>
                <Box sx={{ border: '2px solid #1976d2', borderRadius: 1, minHeight: '3rem', backgroundColor: '#fff' }} />
              </Box>
            </Box>
            
            <Divider sx={{ my: 4 }} />
            
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', fontWeight: 'bold' }}>
              🔍 Verification (Concerned Department):
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 4 }}>
              <TextField
                fullWidth
                label="Department"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
              />
              
              <TextField
                fullWidth
                label="HOD Name"
                name="hodName"
                value={formData.hodName}
                onChange={handleInputChange}
                variant="outlined"
                size="small"
              />
            </Box>
            
            <Divider sx={{ my: 4 }} />
            
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', fontWeight: 'bold' }}>
              📋 For Official Use Only (Human Resources Department):
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Joining Remarks"
                name="joiningRemarks"
                value={formData.joiningRemarks}
                onChange={handleInputChange}
                variant="outlined"
                multiline
                rows={4}
                placeholder="Enter any additional remarks or comments..."
              />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, mb: 4 }}>
              <Box sx={{ flex: 1, mr: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom align="center">
                  HR Signature
                </Typography>
                <Box sx={{ border: '2px solid #1976d2', borderRadius: 1, minHeight: '3rem', backgroundColor: '#fff' }} />
              </Box>
              <Box sx={{ flex: 1, ml: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom align="center">
                  HR Date
                </Typography>
                <Box sx={{ border: '2px solid #1976d2', borderRadius: 1, minHeight: '3rem', backgroundColor: '#fff' }} />
              </Box>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  borderRadius: 2,
                  boxShadow: 2,
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Joining Document'}
              </Button>
            </Box>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default PublicJoiningDocument;
