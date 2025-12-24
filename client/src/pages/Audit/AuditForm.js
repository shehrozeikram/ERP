import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Stack,
  Chip,
  Divider,
  Skeleton
} from '@mui/material';
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Upload as UploadIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';

const auditTypes = ['internal', 'departmental', 'compliance', 'financial', 'asset'];
const modules = ['hr', 'finance', 'procurement', 'admin', 'sales', 'crm', 'general'];
const riskLevels = ['low', 'medium', 'high', 'critical'];
const categoryOptions = ['Compliance', 'Operational', 'Financial', 'IT', 'HR', 'Quality', 'Security', 'General'];

const getDateValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const AuditForm = () => {
  const navigate = useNavigate();
  const { auditId } = useParams();
  const isEdit = Boolean(auditId);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    auditType: 'internal',
    category: 'General',
    department: '',
    module: 'hr',
    plannedStartDate: '',
    plannedEndDate: '',
    leadAuditor: '',
    riskLevel: 'medium'
  });
  const [attachments, setAttachments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Lazy load departments when dropdown is opened
  const loadDepartments = async () => {
    if (departmentsLoaded || loadingDepartments) return;
    
    try {
      setLoadingDepartments(true);
      const deptRes = await api.get('/hr/departments');
      const deptData = deptRes.data?.data || deptRes.data?.departments || [];
      setDepartments(deptData);
      setDepartmentsLoaded(true);
    } catch (err) {
      console.error('Failed to load departments', err);
      setError(err.response?.data?.message || 'Failed to load departments');
    } finally {
      setLoadingDepartments(false);
    }
  };

  // Lazy load employees when dropdown is opened
  const loadEmployees = async () => {
    if (employeesLoaded || loadingEmployees) return;
    
    try {
      setLoadingEmployees(true);
      // Use lighter endpoint - only fetch active employees with minimal fields
      const employeeRes = await api.get('/hr/employees?active=true&limit=200');
      const employeeData = employeeRes.data?.data || [];
      setEmployees(employeeData);
      setEmployeesLoaded(true);
    } catch (err) {
      console.error('Failed to load employees', err);
      setError(err.response?.data?.message || 'Failed to load employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchAudit = async () => {
    try {
      // Pre-load departments and employees for edit mode so dropdowns work
      await Promise.all([loadDepartments(), loadEmployees()]);
      
      const response = await api.get(`/audit/${auditId}`);
      const audit = response.data?.data?.audit;
      if (audit) {
        setFormData({
          title: audit.title || '',
          description: audit.description || '',
          auditType: audit.auditType || 'internal',
          category: audit.category || 'General',
          department: audit.department?._id || '',
          module: audit.module || 'hr',
          plannedStartDate: getDateValue(audit.plannedStartDate),
          plannedEndDate: getDateValue(audit.plannedEndDate),
          leadAuditor: audit.leadAuditor?._id || '',
          riskLevel: audit.riskLevel || 'medium'
        });
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load audit details', err);
      setError(err.response?.data?.message || 'Failed to load audit details');
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Only load audit data if editing, don't block form rendering
        if (isEdit) {
          setLoading(true);
          await fetchAudit();
        }
      } catch (err) {
        console.error('Failed to load audit data', err);
        setError(err.response?.data?.message || 'Failed to load audit data');
        setLoading(false);
      }
    };

    loadInitialData();
  }, [auditId, isEdit]);

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleFileChange = (event) => {
    setAttachments(Array.from(event.target.files || []));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...formData
      };

      const formPayload = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formPayload.append(key, value);
        }
      });
      attachments.forEach((file) => formPayload.append('attachments', file));

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (isEdit) {
        await api.put(`/audit/${auditId}`, formPayload, config);
        setSuccess('Audit updated successfully');
      } else {
        await api.post('/audit', formPayload, config);
        setSuccess('Audit created successfully');
      }

      setTimeout(() => navigate('/audit/list'), 1200);
    } catch (err) {
      console.error('Failed to save audit', err);
      setError(err.response?.data?.message || 'Failed to save audit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const departmentOptions = useMemo(
    () =>
      (departments || []).map((dept) => ({
        value: dept._id || dept.id,
        label: dept.name || dept.dept_name || dept.title || 'Department'
      })),
    [departments]
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
      <Skeleton variant="text" width={260} height={48} />
      <Skeleton variant="text" width={360} height={24} sx={{ mb: 3 }} />
      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {Array.from({ length: 8 }).map((_, idx) => (
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
            {isEdit ? 'Edit Audit' : 'Create Audit'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Provide the required information to {isEdit ? 'update' : 'create'} an audit
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </Stack>
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

      <Card>
        <CardContent component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Audit Title"
                value={formData.title}
                onChange={handleChange('title')}
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Category"
                value={formData.category}
                onChange={handleChange('category')}
                select
                fullWidth
              >
                {categoryOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={formData.description}
                onChange={handleChange('description')}
                multiline
                rows={3}
                fullWidth
                placeholder="Provide a brief overview of the audit scope and objectives"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Audit Type</InputLabel>
                <Select
                  label="Audit Type"
                  value={formData.auditType}
                  onChange={handleChange('auditType')}
                  required
                >
                  {auditTypes.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item.replace('_', ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Module</InputLabel>
                <Select
                  label="Module"
                  value={formData.module}
                  onChange={handleChange('module')}
                  required
                >
                  {modules.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Risk Level</InputLabel>
                <Select
                  label="Risk Level"
                  value={formData.riskLevel}
                  onChange={handleChange('riskLevel')}
                >
                  {riskLevels.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item.charAt(0).toUpperCase() + item.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Department</InputLabel>
                <Select
                  label="Department"
                  value={formData.department}
                  onChange={handleChange('department')}
                  onOpen={loadDepartments}
                  disabled={loadingDepartments}
                >
                  {loadingDepartments ? (
                    <MenuItem disabled>Loading departments...</MenuItem>
                  ) : (
                    departmentOptions.map((dept) => (
                      <MenuItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Lead Auditor</InputLabel>
                <Select
                  label="Lead Auditor"
                  value={formData.leadAuditor}
                  onChange={handleChange('leadAuditor')}
                  onOpen={loadEmployees}
                  disabled={loadingEmployees}
                >
                  {loadingEmployees ? (
                    <MenuItem disabled>Loading employees...</MenuItem>
                  ) : (
                    employeeOptions.map((emp) => (
                      <MenuItem key={emp.value} value={emp.value}>
                        {emp.label}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Planned Start Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.plannedStartDate}
                onChange={handleChange('plannedStartDate')}
                required
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Planned End Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.plannedEndDate}
                onChange={handleChange('plannedEndDate')}
                required
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Attachments (optional)
              </Typography>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
              >
                Upload Files
                <input
                  type="file"
                  hidden
                  multiple
                  onChange={handleFileChange}
                />
              </Button>
              {attachments.length > 0 && (
                <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
                  {attachments.map((file) => (
                    <Chip key={file.name} label={file.name} />
                  ))}
                </Stack>
              )}
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} justifyContent="flex-end" mt={4}>
            <Button variant="outlined" onClick={() => navigate('/audit/list')}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddIcon />}
              disabled={saving}
            >
              {saving ? 'Saving...' : isEdit ? 'Update Audit' : 'Create Audit'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuditForm;

