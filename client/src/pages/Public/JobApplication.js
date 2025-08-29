import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Snackbar,
  CircularProgress,
  Container,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  FormControlLabel,
  Checkbox,
  FormGroup,
  InputAdornment,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Work,
  Person,
  Email,
  Phone,
  School,
  Business,
  Description,
  Upload,
  Send,
  CheckCircle,
  Warning,
  Info,
  LinkedIn,
  GitHub,
  Language,
  AttachFile,
  Delete
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const JobApplication = () => {
  const theme = useTheme();
  const { affiliateCode } = useParams();
  const navigate = useNavigate();
  
  const [jobPosting, setJobPosting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailAlreadyApplied, setEmailAlreadyApplied] = useState(false);
  const [existingApplication, setExistingApplication] = useState(null);
  const [easyApplyMode, setEasyApplyMode] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    city: '',
    country: '',
    
    // Professional Information
    currentPosition: '',
    currentCompany: '',
    yearsOfExperience: '',
    expectedSalary: '',
    noticePeriod: '',
    availableFrom: '',
    
    // Education
    highestEducation: '',
    institution: '',
    graduationYear: '',
    gpa: '',
    
    // Skills & Experience
    skills: '',
    certifications: '',
    languages: '',
    
    // Social Links
    linkedin: '',
    github: '',
    portfolio: '',
    
    // Documents
    cv: null,
    coverLetter: null,
    additionalDocuments: [],
    
    // Additional Information
    howDidYouHear: '',
    whyJoinUs: '',
    questions: '',
    
    // Terms
    agreeToTerms: false,
    agreeToDataProcessing: false
  });

  const steps = [
    'Job Details',
    'Personal Information',
    'Professional Information',
    'Education & Skills',
    'Documents',
    'Additional Information',
    'Review & Submit'
  ];

  // Load job posting
  useEffect(() => {
    const loadJobPosting = async () => {
      try {
        const response = await fetch(`/api/job-postings/apply/${affiliateCode}`);
        const data = await response.json();
        
        if (data.success) {
          console.log('📋 Job posting data received:', data.data);
          console.log('🔍 Checking for missing fields:');
          console.log('  - employmentType:', data.data.employmentType);
          console.log('  - experienceLevel:', data.data.experienceLevel);
          console.log('  - salaryRange:', data.data.salaryRange);
          console.log('  - department:', data.data.department);
          console.log('  - location:', data.data.location);
          setJobPosting(data.data);
        } else {
          setError('Job posting not found or not available');
        }
      } catch (error) {
        setError('Failed to load job posting');
      } finally {
        setLoading(false);
      }
    };

    if (affiliateCode) {
      loadJobPosting();
    }
  }, [affiliateCode]);

  const checkEmailApplication = async (email) => {
    if (!email || !affiliateCode) return;
    
    try {
      const response = await fetch(`/api/job-postings/apply/${affiliateCode}/check-email/${email}`);
      const data = await response.json();
      
      if (data.success) {
        setEmailAlreadyApplied(data.data.hasApplied);
        setExistingApplication(data.data);
        setEmailChecked(true);
        
        if (data.data.hasApplied) {
          setSnackbar({
            open: true,
            message: `You have already applied for this position on ${new Date(data.data.appliedAt).toLocaleDateString()}`,
            severity: 'warning'
          });
        }
      }
    } catch (error) {
      console.error('Error checking email application:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Check email application when email is entered
    if (field === 'email' && value && value.includes('@')) {
      // Add a small delay to avoid too many API calls
      setTimeout(() => {
        checkEmailApplication(value);
      }, 1000);
    }
  };

  const handleFileUpload = (field, file) => {
    setFormData(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const handleNext = () => {
    // Prevent moving to next step if email has already been used
    if (activeStep === 0 && emailAlreadyApplied) {
      setSnackbar({
        open: true,
        message: 'Please use a different email address or contact HR if you need to update your application',
        severity: 'error'
      });
      return;
    }
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    // Prevent submission if email has already been used
    if (emailAlreadyApplied) {
      setSnackbar({
        open: true,
        message: 'You have already applied for this position with this email address',
        severity: 'error'
      });
      return;
    }

    setSubmitting(true);
    try {
      let applicationData;
      
      if (easyApplyMode) {
        // Easy Apply - minimal data structure
        applicationData = {
          affiliateCode: affiliateCode,
          applicationType: 'easy_apply',
          personalInfo: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone
          },
          documents: {
            cv: formData.cv
          }
        };
      } else {
        // Detailed Application - full data structure
        applicationData = {
          affiliateCode: affiliateCode,
          applicationType: 'standard',
          personalInfo: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            dateOfBirth: formData.dateOfBirth,
            gender: formData.gender,
            address: formData.address,
            city: formData.city,
            country: formData.country
          },
          professionalInfo: {
            currentPosition: formData.currentPosition,
            currentCompany: formData.currentCompany,
            yearsOfExperience: formData.yearsOfExperience,
            expectedSalary: formData.expectedSalary,
            noticePeriod: formData.noticePeriod,
            availability: formData.availableFrom
          },
          education: {
            highestEducation: formData.highestEducation,
            institution: formData.institution,
            graduationYear: formData.graduationYear,
            gpa: formData.gpa
          },
          skills: {
            technicalSkills: formData.skills,
            certifications: formData.certifications,
            languages: formData.languages
          },
          additionalInfo: {
            coverLetter: formData.coverLetterText,
            portfolioUrl: formData.portfolioUrl,
            linkedinUrl: formData.linkedinUrl,
            githubUrl: formData.githubUrl,
            websiteUrl: formData.websiteUrl
          },
          documents: {
            cv: formData.cv,
            coverLetter: formData.coverLetter,
            additionalDocuments: formData.additionalDocuments
          }
        };
      }

      let response;
      
      if (easyApplyMode) {
        // Easy Apply - use FormData for file upload
        const formDataToSend = new FormData();
        formDataToSend.append('affiliateCode', affiliateCode);
        formDataToSend.append('cvFile', formData.cv);
        formDataToSend.append('applicationData', JSON.stringify({
          personalInfo: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone
          },
          professionalInfo: {
            currentPosition: formData.currentPosition || '',
            yearsOfExperience: formData.yearsOfExperience || '',
            expectedSalary: formData.expectedSalary || '',
            noticePeriod: formData.noticePeriod || '',
            availability: formData.availableFrom || ''
          },
          additionalInfo: {
            howDidYouHear: 'Website'
          }
        }));
        
        response = await fetch('/api/applications/easy-apply', {
          method: 'POST',
          body: formDataToSend
        });
      } else {
        // Standard application
        response = await fetch('/api/applications/public/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(applicationData)
        });
      }

      const data = await response.json();

      if (data.success) {
        setSnackbar({
          open: true,
          message: easyApplyMode 
            ? 'Easy application submitted successfully! We will contact you soon.'
            : 'Application submitted successfully! We will contact you soon.',
          severity: 'success'
        });
        // Reset form and go to first step
        setFormData({
          firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', gender: '', address: '', city: '', country: '',
          currentPosition: '', currentCompany: '', yearsOfExperience: '', expectedSalary: '', noticePeriod: '', availableFrom: '',
          highestEducation: '', institution: '', graduationYear: '', gpa: '',
          skills: '', certifications: '', languages: '',
          coverLetterText: '', portfolioUrl: '', linkedinUrl: '', githubUrl: '', websiteUrl: '',
          cv: null, coverLetter: null, additionalDocuments: []
        });
        setActiveStep(0);
        setEasyApplyMode(false);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Failed to submit application',
        severity: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderJobDetails = () => (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: theme.palette.primary.main }}>
          {jobPosting.title}
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Department
            </Typography>
            <Typography variant="body1">
              {jobPosting.department?.name}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Location
            </Typography>
            <Typography variant="body1">
              {jobPosting.location?.name || 'Not specified'}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Employment Type
            </Typography>
            <Typography variant="body1">
              {jobPosting.employmentType ? 
                jobPosting.employmentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                'Full-time (Default)'
              }
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Experience Level
            </Typography>
            <Typography variant="body1">
              {jobPosting.experienceLevel ? 
                jobPosting.experienceLevel.replace(/\b\w/g, l => l.toUpperCase()) : 
                'Not specified'
              }
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Salary Range
            </Typography>
            <Typography variant="body1">
              {jobPosting.salaryRange && jobPosting.salaryRange.min && jobPosting.salaryRange.max ? 
                `${jobPosting.salaryRange.currency || 'PKR'} ${jobPosting.salaryRange.min.toLocaleString()} - ${jobPosting.salaryRange.max.toLocaleString()}` : 
                'To be discussed'
              }
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Application Deadline
            </Typography>
            <Typography variant="body1">
              {new Date(jobPosting.applicationDeadline).toLocaleDateString()}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography variant="h6" gutterBottom>
          Job Description
        </Typography>
        <Typography variant="body2" paragraph>
          {jobPosting.description}
        </Typography>

        <Typography variant="h6" gutterBottom>
          Requirements
        </Typography>
        <Typography variant="body2" paragraph>
          {jobPosting.requirements}
        </Typography>

        <Typography variant="h6" gutterBottom>
          Responsibilities
        </Typography>
        <Typography variant="body2" paragraph>
          {jobPosting.responsibilities}
        </Typography>

        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<Send />}
            onClick={() => setEasyApplyMode(true)}
            sx={{ mr: 2 }}
          >
            Easy Apply
          </Button>
          <Button
            variant="outlined"
            startIcon={<Send />}
            onClick={() => setEasyApplyMode(false)}
          >
            Detailed Application
          </Button>
        </Box>
      </CardContent>
    </Card>
  );

  const renderPersonalInformation = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Personal Information
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="First Name"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
              error={emailAlreadyApplied}
              helperText={emailAlreadyApplied ? 'You have already applied with this email' : ''}
            />
            {emailAlreadyApplied && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                You have already applied for this position with this email address on{' '}
                {existingApplication?.appliedAt ? new Date(existingApplication.appliedAt).toLocaleDateString() : 'a previous date'}.
                Each candidate can only apply once per position.
              </Alert>
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Date of Birth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select
                value={formData.gender}
                label="Gender"
                onChange={(e) => handleInputChange('gender', e.target.value)}
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
                <MenuItem value="prefer_not_to_say">Prefer not to say</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address"
              multiline
              rows={2}
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="City"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Country"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderProfessionalInformation = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Professional Information
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Current Position"
              value={formData.currentPosition}
              onChange={(e) => handleInputChange('currentPosition', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Current Company"
              value={formData.currentCompany}
              onChange={(e) => handleInputChange('currentCompany', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Years of Experience"
              value={formData.yearsOfExperience}
              onChange={(e) => handleInputChange('yearsOfExperience', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Expected Salary"
              value={formData.expectedSalary}
              onChange={(e) => handleInputChange('expectedSalary', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Notice Period"
              value={formData.noticePeriod}
              onChange={(e) => handleInputChange('noticePeriod', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Available From"
              type="date"
              value={formData.availableFrom}
              onChange={(e) => handleInputChange('availableFrom', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderEducationSkills = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Education & Skills
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Highest Education"
              value={formData.highestEducation}
              onChange={(e) => handleInputChange('highestEducation', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Institution"
              value={formData.institution}
              onChange={(e) => handleInputChange('institution', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Graduation Year"
              value={formData.graduationYear}
              onChange={(e) => handleInputChange('graduationYear', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="GPA"
              value={formData.gpa}
              onChange={(e) => handleInputChange('gpa', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Skills"
              multiline
              rows={3}
              value={formData.skills}
              onChange={(e) => handleInputChange('skills', e.target.value)}
              placeholder="List your technical and soft skills"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Certifications"
              multiline
              rows={2}
              value={formData.certifications}
              onChange={(e) => handleInputChange('certifications', e.target.value)}
              placeholder="List any relevant certifications"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Languages"
              value={formData.languages}
              onChange={(e) => handleInputChange('languages', e.target.value)}
              placeholder="e.g., English (Fluent), Spanish (Intermediate)"
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderDocuments = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Documents
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              CV/Resume (Required)
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<Upload />}
              fullWidth
            >
              Upload CV
              <input
                type="file"
                hidden
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFileUpload('cv', e.target.files[0])}
              />
            </Button>
            {formData.cv && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachFile fontSize="small" />
                <Typography variant="body2">{formData.cv.name}</Typography>
                <IconButton
                  size="small"
                  onClick={() => handleFileUpload('cv', null)}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Cover Letter (Optional)
            </Typography>
            <Button
              variant="outlined"
              component="label"
              startIcon={<Upload />}
              fullWidth
            >
              Upload Cover Letter
              <input
                type="file"
                hidden
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFileUpload('coverLetter', e.target.files[0])}
              />
            </Button>
            {formData.coverLetter && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AttachFile fontSize="small" />
                <Typography variant="body2">{formData.coverLetter.name}</Typography>
                <IconButton
                  size="small"
                  onClick={() => handleFileUpload('coverLetter', null)}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderAdditionalInformation = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Additional Information
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Cover Letter"
              value={formData.coverLetter}
              onChange={(e) => handleInputChange('coverLetter', e.target.value)}
              placeholder="Tell us why you're interested in this position..."
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Additional Notes"
              value={formData.additionalNotes}
              onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
              placeholder="Any additional information you'd like to share..."
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.agreeToTerms}
                    onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                  />
                }
                label="I agree to the terms and conditions"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.agreeToDataProcessing}
                    onChange={(e) => handleInputChange('agreeToDataProcessing', e.target.checked)}
                  />
                }
                label="I agree to the processing of my personal data"
              />
            </FormGroup>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderEasyApplyForm = () => (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ color: theme.palette.primary.main }}>
          Easy Apply - Quick Application
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Just upload your CV and provide basic information to apply quickly
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="First Name"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              CV Upload
            </Typography>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: 'grey.300',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                backgroundColor: 'grey.50',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'primary.50'
                }
              }}
            >
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFileUpload('cv', e.target.files[0])}
                style={{ display: 'none' }}
                id="cv-upload"
              />
              <label htmlFor="cv-upload">
                <Button
                  component="span"
                  variant="outlined"
                  startIcon={<Upload />}
                  sx={{ mb: 2 }}
                >
                  Choose CV File
                </Button>
              </label>
              {formData.cv && (
                <Box sx={{ mt: 2 }}>
                  <Chip
                    icon={<AttachFile />}
                    label={formData.cv.name}
                    onDelete={() => handleFileUpload('cv', null)}
                    color="primary"
                  />
                </Box>
              )}
              <Typography variant="body2" color="text.secondary">
                Accepted formats: PDF, DOC, DOCX (Max 5MB)
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.agreeToTerms}
                    onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                  />
                }
                label="I agree to the terms and conditions"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.agreeToDataProcessing}
                    onChange={(e) => handleInputChange('agreeToDataProcessing', e.target.checked)}
                  />
                }
                label="I agree to the processing of my personal data"
              />
            </FormGroup>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderReview = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Review Your Application
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Name
            </Typography>
            <Typography variant="body1">
              {formData.firstName} {formData.lastName}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Email
            </Typography>
            <Typography variant="body1">
              {formData.email}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Current Position
            </Typography>
            <Typography variant="body1">
              {formData.currentPosition} at {formData.currentCompany}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Years of Experience
            </Typography>
            <Typography variant="body1">
              {formData.yearsOfExperience}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary">
              Skills
            </Typography>
            <Typography variant="body1">
              {formData.skills}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderStepContent = () => {
    if (easyApplyMode) {
      return renderEasyApplyForm();
    }
    
    switch (activeStep) {
      case 0:
        return renderJobDetails();
      case 1:
        return renderPersonalInformation();
      case 2:
        return renderProfessionalInformation();
      case 3:
        return renderEducationSkills();
      case 4:
        return renderDocuments();
      case 5:
        return renderAdditionalInformation();
      case 6:
        return renderReview();
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">
            <Typography variant="h6">Error</Typography>
            <Typography>{error}</Typography>
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ color: theme.palette.primary.main }}>
            Job Application
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Complete the form below to apply for this position
          </Typography>
        </Box>

        {/* Stepper */}
        {!easyApplyMode && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>
        )}

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation */}
        {!easyApplyMode ? (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Back
            </Button>
            
            <Box>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={submitting || !formData.agreeToTerms || !formData.agreeToDataProcessing}
                  startIcon={submitting ? <CircularProgress size={20} /> : <Send />}
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting || !formData.agreeToTerms || !formData.agreeToDataProcessing || !formData.cv}
              startIcon={submitting ? <CircularProgress size={20} /> : <Send />}
              size="large"
            >
              {submitting ? 'Submitting...' : 'Submit Easy Application'}
            </Button>
          </Box>
        )}

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
      </Box>
    </Container>
  );
};

export default JobApplication; 