import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Box, 
  Button, 
  Divider, 
  TextField, 
  Alert, 
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import { Send as SendIcon, Person as PersonIcon, Work as WorkIcon, AccountBalance as BankIcon, ContactEmergency as EmergencyIcon } from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import api from '../../services/api';

const PublicEmployeeOnboarding = () => {
  const { id: onboardingId } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);
  
  // Add state for departments and positions
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  
  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    idCard: '',
    nationality: '',
    religion: 'Islam',
    maritalStatus: 'Single',
    qualification: '',
    
    // Address Information
    address: {
      street: '',
      city: null,
      state: null,
      country: null
    },
    
    // Emergency Contact
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      email: ''
    },
    
    // Employment Details
    position: null,
    department: null,
    joiningDate: '',
    employmentType: 'Full-time',
    probationPeriod: 3,
    salary: 0,
    
    // Additional Information
    notes: ''
  });

  // Load onboarding data and fetch departments/positions
  useEffect(() => {
    const fetchDepartmentsAndPositions = async () => {
      try {
        // Fetch departments
        const deptResponse = await api.get('/hr/departments');
        setDepartments(deptResponse.data.data || []);
        
        // Fetch positions
        const posResponse = await api.get('/hr/positions');
        setPositions(posResponse.data.data || []);
        
        console.log('📋 Departments loaded:', deptResponse.data.data?.length || 0);
        console.log('💼 Positions loaded:', posResponse.data.data?.length || 0);
      } catch (err) {
        console.error('Error fetching departments/positions:', err);
      }
    };

    const loadOnboarding = async () => {
      try {
        console.log('🚀 Loading onboarding data for ID:', onboardingId);
        console.log('🔗 API URL:', `/employee-onboarding/public/${onboardingId}`);
        
        const response = await api.get(`/employee-onboarding/public/${onboardingId}`);
        console.log('📡 API Response:', response);
        
        if (response.data.success) {
          setOnboardingData(response.data.data);
          console.log('✅ Onboarding data loaded:', response.data.data);
          
          // Pre-fill form with candidate data if available
          if (response.data.data.approvalId?.candidate) {
            const candidate = response.data.data.approvalId.candidate;
            setFormData(prev => ({
              ...prev,
              firstName: candidate.firstName || '',
              lastName: candidate.lastName || '',
              email: candidate.email || '',
              phone: candidate.phone || '',
              dateOfBirth: candidate.dateOfBirth ? candidate.dateOfBirth.split('T')[0] : '',
              gender: candidate.gender || '',
              nationality: candidate.nationality || ''
            }));
          }
          
          // Auto-populate position and department from job posting
          if (response.data.data.approvalId?.jobPosting) {
            const jobPosting = response.data.data.approvalId.jobPosting;
            console.log('💼 Job posting data for auto-population:', jobPosting);
            
            // Find department by name and set it
            if (jobPosting.department?.name) {
              const dept = departments.find(d => d.name === jobPosting.department.name);
              if (dept) {
                setFormData(prev => ({
                  ...prev,
                  department: dept._id
                }));
                console.log('✅ Auto-populated department:', dept.name);
              }
            }
            
            // Find position by title and set it
            if (jobPosting.title) {
              const pos = positions.find(p => p.title === jobPosting.title);
              if (pos) {
                setFormData(prev => ({
                  ...prev,
                  position: pos._id
                }));
                console.log('✅ Auto-populated position:', pos.title);
              }
            }
          }
        } else {
          setError(response.data.message || 'Failed to load onboarding data');
        }
      } catch (err) {
        console.error('❌ Error loading onboarding:', err);
        setError(err.response?.data?.message || 'Failed to load onboarding data');
      } finally {
        setLoading(false);
      }
    };

    if (onboardingId) {
      console.log('🎯 Starting to load onboarding for ID:', onboardingId);
      // First fetch departments and positions, then load onboarding
      fetchDepartmentsAndPositions().then(() => {
        loadOnboarding();
      });
    } else {
      console.log('❌ No onboarding ID provided');
      setError('No onboarding ID provided');
    }
  }, [onboardingId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      // Prepare the form data to match the Employee model structure
      const submitData = {
        ...formData,
        // Ensure salary is a number
        salary: parseFloat(formData.salary) || 0,
        // Ensure probationPeriod is a number
        probationPeriod: parseInt(formData.probationPeriod) || 3,
        // Ensure joiningDate is properly formatted
        joiningDate: formData.joiningDate || new Date().toISOString().split('T')[0]
      };
      
      console.log('Submitting form data:', submitData);
      
      const response = await api.post(`/employee-onboarding/public/${onboardingId}/submit`, submitData);
      
      if (response.data.success) {
        setSubmitSuccess(true);
        console.log('Employee onboarding submitted successfully:', response.data);
      } else {
        setError(response.data.message || 'Failed to submit onboarding');
      }
    } catch (err) {
      console.error('Error submitting onboarding:', err);
      setError(err.response?.data?.message || 'Failed to submit onboarding. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading onboarding form...
        </Typography>
      </Container>
    );
  }

  if (submitSuccess) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center', boxShadow: 3, borderRadius: 2 }}>
          <Typography variant="h4" color="success.main" gutterBottom>
            🎉 Employee Onboarding Completed!
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Congratulations! Your employee onboarding has been submitted successfully.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your information has been saved and your employee record has been updated with <strong>Draft</strong> status.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            <strong>Note:</strong> If you already have an employee record, it has been updated with your new information.
            If this is your first time, a new employee record has been created.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Our HR team will review your information and activate your employee account within 24-48 hours.
            You will receive an email notification once your account is activated.
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center', boxShadow: 3, borderRadius: 2 }}>
          <Typography variant="h4" color="error" gutterBottom>
            ❌ Error Loading Onboarding
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            {error}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, boxShadow: 3, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom align="center" color="primary" sx={{ mb: 3, fontWeight: 'bold' }}>
          🚀 Complete Your Employee Onboarding
        </Typography>
        
        {onboardingData && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              📋 Onboarding Information
            </Typography>
            <Typography variant="body2">
              <strong>Candidate:</strong> {onboardingData.candidateId?.firstName} {onboardingData.candidateId?.lastName}
            </Typography>
            <Typography variant="body2">
              <strong>Position:</strong> {onboardingData.approvalId?.jobPosting?.title || 'N/A'}
            </Typography>
            <Typography variant="body2">
              <strong>Department:</strong> {onboardingData.approvalId?.jobPosting?.department?.name || 'N/A'}
            </Typography>
          </Box>
        )}
        
        <Divider sx={{ mb: 3 }} />
        
        <form onSubmit={handleSubmit}>
          {/* Personal Information Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
              <PersonIcon sx={{ mr: 1 }} />
              Personal Information
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  variant="outlined"
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  variant="outlined"
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  variant="outlined"
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  variant="outlined"
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  name="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Gender</InputLabel>
                  <Select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    label="Gender"
                  >
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="ID Card Number"
                  name="idCard"
                  value={formData.idCard}
                  onChange={handleInputChange}
                  variant="outlined"
                  required
                  helperText="Must be unique. If duplicate exists, a suffix will be added automatically."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nationality"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleInputChange}
                  variant="outlined"
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Qualification"
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleInputChange}
                  variant="outlined"
                  required
                  placeholder="e.g., Bachelor's in Computer Science"
                />
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Employment Details Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
              <WorkIcon sx={{ mr: 1 }} />
              Employment Details
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Position</InputLabel>
                  <Select
                    name="position"
                    value={formData.position || ''}
                    onChange={handleInputChange}
                    label="Position"
                  >
                    {positions.map(pos => (
                      <MenuItem key={pos._id} value={pos._id}>{pos.title}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Department</InputLabel>
                  <Select
                    name="department"
                    value={formData.department || ''}
                    onChange={handleInputChange}
                    label="Department"
                  >
                    {departments.map(dept => (
                      <MenuItem key={dept._id} value={dept._id}>{dept.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Joining Date"
                  name="joiningDate"
                  type="date"
                  value={formData.joiningDate}
                  onChange={handleInputChange}
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Employment Type</InputLabel>
                  <Select
                    name="employmentType"
                    value={formData.employmentType}
                    onChange={handleInputChange}
                    label="Employment Type"
                  >
                    <MenuItem value="Full-time">Full-time</MenuItem>
                    <MenuItem value="Part-time">Part-time</MenuItem>
                    <MenuItem value="Contract">Contract</MenuItem>
                    <MenuItem value="Intern">Intern</MenuItem>
                    <MenuItem value="Temporary">Temporary</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Probation Period (Months)"
                  name="probationPeriod"
                  type="number"
                  value={formData.probationPeriod}
                  onChange={handleInputChange}
                  variant="outlined"
                  required
                  inputProps={{ min: 0, max: 24 }}
                  placeholder="e.g., 6"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Salary (Monthly)"
                  name="salary"
                  type="number"
                  value={formData.salary}
                  onChange={handleInputChange}
                  variant="outlined"
                  required
                  inputProps={{ min: 0 }}
                  placeholder="e.g., 50000"
                />
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Emergency Contact Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center' }}>
              <EmergencyIcon sx={{ mr: 1 }} />
              Emergency Contact
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Emergency Contact Name"
                  name="emergencyContact.name"
                  value={formData.emergencyContact.name}
                  onChange={handleInputChange}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Relationship"
                  name="emergencyContact.relationship"
                  value={formData.emergencyContact.relationship}
                  onChange={handleInputChange}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Emergency Contact Phone"
                  name="emergencyContact.phone"
                  value={formData.emergencyContact.phone}
                  onChange={handleInputChange}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Emergency Contact Email"
                  name="emergencyContact.email"
                  type="email"
                  value={formData.emergencyContact.email}
                  onChange={handleInputChange}
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Additional Information Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ mb: 2, color: 'primary.main' }}>
              📝 Additional Information
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Additional Notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  variant="outlined"
                  multiline
                  rows={4}
                  placeholder="Any additional information you'd like to share..."
                />
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Submit Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
              sx={{
                px: 6,
                py: 2,
                fontSize: '1.2rem',
                fontWeight: 'bold',
                borderRadius: 2,
                boxShadow: 3,
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-2px)'
                }
              }}
            >
              {submitting ? 'Submitting...' : 'Complete Employee Onboarding'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default PublicEmployeeOnboarding;
