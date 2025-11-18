import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Alert,
  CircularProgress,
  Skeleton,
  alpha,
  useTheme,
  Divider,
  Chip,
  Avatar,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const AddAuditFinding = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [formData, setFormData] = useState({
    audit: '',
    title: '',
    description: '',
    category: '',
    severity: 'medium',
    status: 'open',
    priority: 'medium',
    responsiblePerson: '',
    dueDate: '',
    recommendation: '',
    evidence: '',
    process: '',
    criteria: '',
    impact: '',
    rootCause: '',
    correctiveAction: ''
  });

  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAudits();
  }, []);

  const fetchAudits = async () => {
    try {
      setLoading(true);
      const response = await api.get('/audit');
      console.log('Audits API response:', response.data); // Debug log
      
      if (response.data.success) {
        const responseData = response.data.data;
        if (responseData && Array.isArray(responseData.audits)) {
          setAudits(responseData.audits);
        } else if (Array.isArray(responseData)) {
          setAudits(responseData);
        } else {
          console.error('Unexpected audits response structure:', responseData);
          setAudits([]);
        }
      } else {
        console.error('Audits API returned success: false');
        setAudits([]);
      }
    } catch (error) {
      console.error('Error fetching audits:', error);
      setError('Failed to fetch audits');
      setAudits([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Basic validation
    if (!formData.audit || !formData.title || !formData.description || !formData.process || !formData.evidence || !formData.criteria) {
      setError('Please fill in all required fields (Audit, Title, Description, Process, Evidence, and Criteria are required)');
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      const response = await api.post('/audit/findings', formData);
      
      if (response.data.success) {
        setSuccess('Audit finding created successfully!');
        setTimeout(() => {
          navigate('/audit/findings');
        }, 1500);
      } else {
        setError(response.data.message || 'Failed to create audit finding');
      }
    } catch (error) {
      console.error('Error creating audit finding:', error);
      setError(error.response?.data?.message || 'Failed to create audit finding');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/audit/findings');
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <ErrorIcon />;
      case 'high': return <WarningIcon />;
      case 'medium': return <InfoIcon />;
      case 'low': return <CheckCircleIcon />;
      default: return <InfoIcon />;
    }
  };

  const FormSkeleton = () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="rectangular" height={120} sx={{ mb: 3, borderRadius: 2 }} />
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Grid container spacing={3}>
            {Array.from({ length: 10 }).map((_, idx) => (
              <Grid item xs={12} md={idx % 2 === 0 ? 6 : 6} key={idx}>
                <Skeleton variant="rounded" height={56} />
              </Grid>
            ))}
            <Grid item xs={12}>
              <Skeleton variant="rounded" height={140} />
            </Grid>
            <Grid item xs={12}>
              <Skeleton variant="rounded" height={48} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );

  if (loading) {
    return <FormSkeleton />;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <IconButton onClick={handleCancel} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
            <ArrowBackIcon />
          </IconButton>
          <Avatar sx={{ bgcolor: theme.palette.warning.main }}>
            <DescriptionIcon />
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
              Add New Audit Finding
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Create a new audit finding to track compliance issues and recommendations
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Form */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoIcon color="primary" />
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Audit</InputLabel>
                  <Select
                    value={formData.audit}
                    onChange={handleInputChange('audit')}
                    label="Audit"
                  >
                    {(audits || []).map((audit) => (
                      <MenuItem key={audit._id} value={audit._id}>
                        {audit.title} - {audit.status}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Finding Title"
                  value={formData.title}
                  onChange={handleInputChange('title')}
                  placeholder="Enter a descriptive title for the finding"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  multiline
                  rows={4}
                  label="Description"
                  value={formData.description}
                  onChange={handleInputChange('description')}
                  placeholder="Provide a detailed description of the finding"
                />
              </Grid>

              {/* Classification */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarningIcon color="primary" />
                  Classification & Priority
                </Typography>
                <Divider sx={{ mb: 3 }} />
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={handleInputChange('category')}
                    label="Category"
                  >
                    <MenuItem value="compliance">Compliance</MenuItem>
                    <MenuItem value="process">Process</MenuItem>
                    <MenuItem value="financial">Financial</MenuItem>
                    <MenuItem value="operational">Operational</MenuItem>
                    <MenuItem value="security">Security</MenuItem>
                    <MenuItem value="documentation">Documentation</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={formData.severity}
                    onChange={handleInputChange('severity')}
                    label="Severity"
                  >
                    <MenuItem value="low">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleIcon color="success" fontSize="small" />
                        Low
                      </Box>
                    </MenuItem>
                    <MenuItem value="medium">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InfoIcon color="info" fontSize="small" />
                        Medium
                      </Box>
                    </MenuItem>
                    <MenuItem value="high">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningIcon color="warning" fontSize="small" />
                        High
                      </Box>
                    </MenuItem>
                    <MenuItem value="critical">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ErrorIcon color="error" fontSize="small" />
                        Critical
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={handleInputChange('priority')}
                    label="Priority"
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={handleInputChange('status')}
                    label="Status"
                  >
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Assignment */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleIcon color="primary" />
                  Assignment & Timeline
                </Typography>
                <Divider sx={{ mb: 3 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Responsible Person"
                  value={formData.responsiblePerson}
                  onChange={handleInputChange('responsiblePerson')}
                  placeholder="Enter the person responsible for addressing this finding"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Due Date"
                  value={formData.dueDate}
                  onChange={handleInputChange('dueDate')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Additional Details */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DescriptionIcon color="primary" />
                  Additional Details
                </Typography>
                <Divider sx={{ mb: 3 }} />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Recommendation"
                  value={formData.recommendation}
                  onChange={handleInputChange('recommendation')}
                  placeholder="Provide recommendations to address this finding"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  multiline
                  rows={3}
                  label="Evidence"
                  value={formData.evidence}
                  onChange={handleInputChange('evidence')}
                  placeholder="Document evidence supporting this finding"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Process"
                  value={formData.process}
                  onChange={handleInputChange('process')}
                  placeholder="Describe the process that was audited"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Criteria"
                  value={formData.criteria}
                  onChange={handleInputChange('criteria')}
                  placeholder="Specify the criteria used for evaluation"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Impact"
                  value={formData.impact}
                  onChange={handleInputChange('impact')}
                  placeholder="Describe the potential impact of this finding"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Root Cause"
                  value={formData.rootCause}
                  onChange={handleInputChange('rootCause')}
                  placeholder="Identify the root cause of this finding"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Corrective Action"
                  value={formData.correctiveAction}
                  onChange={handleInputChange('correctiveAction')}
                  placeholder="Describe the corrective action to be taken"
                />
              </Grid>
            </Grid>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4, pt: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                disabled={saving}
                sx={{ minWidth: 120 }}
              >
                {saving ? 'Creating...' : 'Create Finding'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AddAuditFinding;
