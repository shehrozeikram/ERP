import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
  Skeleton
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';

const statusOptions = ['Open', 'In Progress', 'Completed', 'Verified', 'Overdue'];

const CorrectiveActionForm = () => {
  const navigate = useNavigate();
  const { actionId } = useParams();
  const isEdit = Boolean(actionId);

  const [formData, setFormData] = useState({
    auditFinding: '',
    description: '',
    responsiblePerson: '',
    dueDate: '',
    status: 'Open'
  });
  const [findings, setFindings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [findingRes, employeeRes] = await Promise.all([
          api.get('/audit/findings', {
            params: {
              page: 1,
              limit: 200,
              status: '',
              search: ''
            }
          }),
          api.get('/hr/employees?limit=500')
        ]);

        const findingPayload = findingRes.data?.data;
        const findingData = Array.isArray(findingPayload?.findings)
          ? findingPayload.findings
          : Array.isArray(findingPayload)
            ? findingPayload
            : [];
        const employeeData = employeeRes.data?.data || [];

        setFindings(findingData);
        setEmployees(employeeData);

        if (isEdit) {
          await fetchAction();
        }
      } catch (err) {
        console.error('Failed to load corrective action form data', err);
        setError(err.response?.data?.message || 'Failed to load required data');
      } finally {
        setLoading(false);
      }
    };

    const fetchAction = async () => {
      try {
        const response = await api.get(`/audit/corrective-actions/${actionId}`);
        const action = response.data?.data;
        if (action) {
          setFormData({
            auditFinding: action.auditFinding?._id || action.auditFinding || '',
            description: action.description || '',
            responsiblePerson: action.responsiblePerson?._id || action.responsiblePerson || '',
            dueDate: action.dueDate ? action.dueDate.split('T')[0] : '',
            status: action.status || 'Open'
          });
        }
      } catch (err) {
        console.error('Failed to load corrective action details', err);
        setError(err.response?.data?.message || 'Failed to load corrective action');
      }
    };

    loadInitialData();
  }, [actionId, isEdit]);

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (isEdit) {
        await api.put(`/audit/corrective-actions/${actionId}`, formData);
        setSuccess('Corrective action updated successfully');
      } else {
        await api.post('/audit/corrective-actions', formData);
        setSuccess('Corrective action created successfully');
      }
      setTimeout(() => navigate('/audit/corrective-actions'), 1200);
    } catch (err) {
      console.error('Failed to save corrective action', err);
      setError(err.response?.data?.message || 'Failed to save corrective action');
    } finally {
      setSaving(false);
    }
  };

  const findingOptions = useMemo(
    () =>
      (findings || []).map((finding) => ({
        value: finding._id || finding.id,
        label: finding.title
          ? `${finding.title}${finding.audit?.auditNumber ? ` (${finding.audit.auditNumber})` : ''}`
          : finding.findingNumber || 'Audit Finding'
      })),
    [findings]
  );

  const employeeOptions = useMemo(
    () =>
      (employees || []).map((emp) => ({
        value: emp._id || emp.id,
        label: `${emp.firstName || emp.first_name || ''} ${emp.lastName || emp.last_name || ''}`.trim() || emp.email || 'Employee'
      })),
    [employees]
  );

  const FormSkeleton = () => (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={280} height={48} />
      <Skeleton variant="text" width={360} height={24} sx={{ mb: 3 }} />
      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <Grid item xs={12} md={idx % 2 === 0 ? 6 : 6} key={idx}>
                <Skeleton variant="rounded" height={56} />
              </Grid>
            ))}
            <Grid item xs={12}>
              <Skeleton variant="rounded" height={120} />
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {isEdit ? 'Edit Corrective Action' : 'Add Corrective Action'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isEdit ? 'Update the corrective action details' : 'Provide the details for the new corrective action'}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Back
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card component="form" onSubmit={handleSubmit}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Audit Finding</InputLabel>
                <Select
                  label="Audit Finding"
                  value={formData.auditFinding}
                  onChange={handleChange('auditFinding')}
                >
                  {findingOptions.map((finding) => (
                    <MenuItem key={finding.value} value={finding.value}>
                      {finding.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Responsible Person</InputLabel>
                <Select
                  label="Responsible Person"
                  value={formData.responsiblePerson}
                  onChange={handleChange('responsiblePerson')}
                >
                  {employeeOptions.map((emp) => (
                    <MenuItem key={emp.value} value={emp.value}>
                      {emp.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Due Date"
                type="date"
                inputProps={{ min: new Date().toISOString().split('T')[0] }}
                InputLabelProps={{ shrink: true }}
                value={formData.dueDate}
                onChange={handleChange('dueDate')}
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={handleChange('status')}
                >
                  {statusOptions.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Action Description"
                value={formData.description}
                onChange={handleChange('description')}
                multiline
                rows={4}
                fullWidth
                required
                placeholder="Describe the corrective action that will be performed"
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} justifyContent="flex-end" mt={4}>
            <Button variant="outlined" onClick={() => navigate('/audit/corrective-actions')}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saving}
            >
              {saving ? 'Saving...' : isEdit ? 'Update Action' : 'Create Action'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CorrectiveActionForm;

