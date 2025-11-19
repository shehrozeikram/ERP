import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Stack,
  Divider,
  Avatar,
  Collapse
} from '@mui/material';
import {
  Place,
  Phone,
  MailOutline,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as CollapseIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import api from '../../services/api';

dayjs.extend(relativeTime);

const MyComplaints = () => {
  const [formData, setFormData] = useState({
    trackingCode: '',
    email: '',
    phone: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const formIsEmpty = !formData.trackingCode.trim() && !formData.email.trim() && !formData.phone.trim();

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    if (formIsEmpty) {
      setError('Please enter tracking code, email, or phone to search.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await api.get('/public/taj-complaints', {
        params: formData
      });
      setResults(response.data?.data || []);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.errors?.map((e) => e.msg).join(', ') ||
        'Failed to fetch complaints. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    setExpandedIds(new Set());
  }, [results]);

  const handleToggleDetails = useCallback((key) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const showLoader = submitting;
  const showEmptyState = !showLoader && !results.length && !error;
  const showResults = !showLoader && results.length > 0;

  return (
    <Box sx={{ bgcolor: '#f4f7fb', minHeight: '100vh', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="md">
        <Paper elevation={4} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, mb: 4 }}>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Track My Complaints
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            Enter your tracking code or contact details to view the progress and history of your submitted complaints.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSearch}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Tracking Code"
                  value={formData.trackingCode}
                  onChange={handleChange('trackingCode')}
                  fullWidth
                  placeholder="Example: TR-1234-ABCD"
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
              <Grid item xs={12}>
                <Button type="submit" variant="contained" size="large" disabled={submitting}>
                  {submitting ? 'Searching...' : 'Search Complaints'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Paper>

        {showLoader && (
          <Box textAlign="center" py={4}>
            <CircularProgress size={48} />
            <Typography variant="body1" mt={2}>Fetching your complaints...</Typography>
          </Box>
        )}

        {showEmptyState && (
          <Paper
            elevation={0}
            sx={{
              p: 5,
              textAlign: 'center',
              borderRadius: 4,
              border: '1px dashed rgba(0,0,0,0.08)',
              bgcolor: '#fff'
            }}
          >
            <Typography variant="h6" fontWeight={600} gutterBottom>
              No complaints yet
            </Typography>
            <Typography color="text.secondary">
              Once you submit a complaint, you’ll see its full history and status updates here.
            </Typography>
          </Paper>
        )}

        {showResults && (
          <Stack spacing={3}>
            {results.map((complaint, idx) => {
              const defaultExpanded = results.length === 1;
              const complaintKey = complaint._id || idx;
              const isExpanded = defaultExpanded || expandedIds.has(complaintKey);

              return (
                <Paper
                  key={complaintKey}
                  elevation={0}
                  sx={{
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                    background: 'linear-gradient(135deg, rgba(236,239,241,0.4), rgba(255,255,255,0.9))'
                  }}
                >
                  <Box
                    sx={{
                      px: 4,
                      py: 3,
                      display: 'flex',
                      flexDirection: { xs: 'column', md: 'row' },
                      gap: 3,
                      alignItems: { xs: 'flex-start', md: 'center' }
                    }}
                  >
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h5" fontWeight={700} color="text.primary">
                        {complaint.title}
                      </Typography>
                      <Stack direction="row" spacing={2} mt={1} flexWrap="wrap">
                        <Chip icon={<AssignmentTurnedInIcon />} label={`Status: ${complaint.status}`} color="primary" />
                        <Chip label={`Category: ${complaint.category || 'N/A'}`} />
                        <Chip label={`Priority: ${complaint.priority || 'Medium'}`} color="warning" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" mt={2}>
                        {complaint.description}
                      </Typography>
                    </Box>
                    <Box textAlign={{ xs: 'left', md: 'right' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Tracking Code
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {complaint.trackingCode}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" mt={1}>
                        Submitted {dayjs(complaint.createdAt).fromNow()}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        sx={{ mt: 1 }}
                        onClick={() => handleToggleDetails(complaintKey)}
                        endIcon={isExpanded ? <CollapseIcon /> : <ExpandMoreIcon />}
                      >
                        {isExpanded ? 'Hide Details' : 'View Details'}
                      </Button>
                    </Box>
                  </Box>
                  <Collapse in={isExpanded}>
                    <Divider />
                    <Box px={4} py={3}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Case Summary
                          </Typography>
                          <Stack spacing={1.5}>
                            <Stack direction="row" spacing={2}>
                              <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.dark' }}>
                                <AssignmentTurnedInIcon fontSize="small" />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight={600}>
                                  Current Stage
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {complaint.status}
                                </Typography>
                              </Box>
                            </Stack>
                            {complaint.location && (
                              <Stack direction="row" spacing={2}>
                                <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.dark' }}>
                                  <Place fontSize="small" />
                                </Avatar>
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>
                                    Location
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {complaint.location}
                                  </Typography>
                                </Box>
                              </Stack>
                            )}
                          </Stack>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Reporter Details
                          </Typography>
                          <Stack spacing={1.5}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Avatar sx={{ bgcolor: 'success.light', color: 'success.dark' }}>
                                {complaint?.reporter?.name?.charAt(0) || 'T'}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight={600}>
                                  {complaint?.reporter?.name || 'Not provided'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Registered visitor
                                </Typography>
                              </Box>
                            </Stack>
                            {complaint?.reporter?.phone && (
                              <Stack direction="row" spacing={2} alignItems="center">
                                <Phone fontSize="small" sx={{ color: 'text.secondary' }} />
                                <Typography variant="body2">{complaint.reporter.phone}</Typography>
                              </Stack>
                            )}
                            {complaint?.reporter?.email && (
                              <Stack direction="row" spacing={2} alignItems="center">
                                <MailOutline fontSize="small" sx={{ color: 'text.secondary' }} />
                                <Typography variant="body2">{complaint.reporter.email}</Typography>
                              </Stack>
                            )}
                          </Stack>
                        </Grid>
                      </Grid>
                    </Box>
                  </Collapse>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Container>
    </Box>
  );
};

export default MyComplaints;

