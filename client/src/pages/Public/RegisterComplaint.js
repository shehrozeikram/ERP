import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Paper,
  Button,
  Alert
} from '@mui/material';
import api from '../../services/api';

const categories = [
  'Allotment',
  'Transfer',
  'Merger',
  'Contact/Address Update',
  'Document Collection',
  'Statement of Dues',
  'Deposit of Dues',
  'Receipts against deposits',
  'Project Information',
  'Other (please specify)'
];

const priorities = ['High', 'Medium', 'Low'];

const RegisterComplaint = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    description: '',
    category: 'Allotment',
    priority: 'Medium',
    location: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const response = await api.post('/public/taj-complaints', formData);
      setResult(response.data?.data || null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        title: '',
        description: '',
    category: 'Allotment',
        priority: 'Medium',
        location: ''
      });
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      if (Array.isArray(apiErrors) && apiErrors.length) {
        setError(apiErrors.map(e => e.msg).join(', '));
      } else {
        setError(err.response?.data?.message || 'Failed to submit complaint. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ bgcolor: '#f4f7fb', minHeight: '100vh', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="md">
        <Paper elevation={5} sx={{ borderRadius: 4, p: { xs: 3, md: 5 } }}>
          <Typography variant="h4" fontWeight={800} gutterBottom align="center">
            Register a Complaint
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center" mb={4}>
            Share details about your issue so our Taj Residencia support team can investigate and resolve it promptly.
          </Typography>

          {result && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Complaint submitted successfully! Your tracking code is{' '}
              <strong>{result.trackingCode}</strong>. Please keep it safe to follow up later.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Full Name"
                  value={formData.name}
                  onChange={handleChange('name')}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange('email')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Phone"
                  value={formData.phone}
                  onChange={handleChange('phone')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Location / Block"
                  value={formData.location}
                  onChange={handleChange('location')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={8}>
                <TextField
                  label="Complaint Title"
                  value={formData.title}
                  onChange={handleChange('title')}
                  required
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Category"
                  value={formData.category}
                  onChange={handleChange('category')}
                  fullWidth
                >
                  {categories.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  select
                  label="Priority"
                  value={formData.priority}
                  onChange={handleChange('priority')}
                  fullWidth
                >
                  {priorities.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Detailed Description"
                  value={formData.description}
                  onChange={handleChange('description')}
                  required
                  fullWidth
                  multiline
                  minRows={4}
                />
              </Grid>
            </Grid>

            <Box mt={4} textAlign="center">
              <Button type="submit" variant="contained" color="primary" size="large" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Complaint'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default RegisterComplaint;

