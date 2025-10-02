import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Skeleton,
  CircularProgress
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import pettyCashService from '../../../services/pettyCashService';
import api from '../../../services/api';

const FundForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    initialAmount: 0,
    custodian: '',
    status: 'Draft',
    location: 'Main Office',
    description: '',
    fundDate: new Date().toISOString().split('T')[0], // Today's date
    vendor: '',
    paymentType: 'Cash',
    subtitle: ''
  });

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const statuses = ['Draft', 'Pending', 'Approved', 'Paid', 'Rejected'];
  const paymentTypes = [
    'Cash',
    'Card', 
    'Bank Transfer',
    'Cheque',
    'Other'
  ];

  useEffect(() => {
    fetchEmployees();
    if (isEdit) {
      fetchFund();
    }
  }, [id, isEdit]);

  const fetchEmployees = async () => {
    try {
      console.log('🔍 Fetching employees...');
      const response = await api.get('/hr/employees?getAll=true');
      console.log('📡 Response status:', response.status);
      console.log('📊 Total employees received:', response.data.data?.length || 0);
      
      // Filter employees to only show those from Administration department
      const adminEmployees = (response.data.data || []).filter(emp => 
        emp.placementDepartment && emp.placementDepartment._id === '68bebffba7f2f0565a67eb50' // Administration department ID
      );
      
      console.log('👥 Administration employees found:', adminEmployees.length);
      console.log('📋 First few admin employees:', adminEmployees.slice(0, 3));
      
      setEmployees(adminEmployees);
    } catch (err) {
      console.error('❌ Error fetching employees:', err);
      console.error('❌ Error details:', err.response?.data || err.message);
      setEmployees([]);
    }
  };

  const fetchFund = async () => {
    try {
      setLoading(true);
      const response = await pettyCashService.getFund(id);
      const fund = response.data;
      
      setFormData({
        title: fund.title || '',
        initialAmount: fund.initialAmount || 0,
        custodian: fund.custodian?._id || '',
        status: fund.status || 'Draft',
        location: fund.location || 'Main Office',
        description: fund.description || '',
        fundDate: fund.fundDate ? new Date(fund.fundDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        vendor: fund.vendor || '',
        paymentType: fund.paymentType || 'Cash',
        subtitle: fund.subtitle || ''
      });
    } catch (err) {
      setError('Failed to fetch fund details');
      console.error('Error fetching fund:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const submitData = {
        ...formData,
        initialAmount: parseFloat(formData.initialAmount),
        fundDate: new Date(formData.fundDate),
        custodian: formData.custodian || null
      };

      if (isEdit) {
        await pettyCashService.updateFund(id, submitData);
        setSuccess('Fund updated successfully!');
      } else {
        await pettyCashService.createFund(submitData);
        setSuccess('Fund created successfully!');
      }

      setTimeout(() => {
        navigate('/admin/petty-cash');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save fund');
      console.error('Error saving fund:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="25%" height={40} />
          <Skeleton variant="rectangular" width={80} height={36} borderRadius={1} />
        </Box>

        <Card>
          <CardContent>
            <Grid container spacing={3}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((item) => (
                <Grid item xs={12} sm={6} key={item}>
                  <Skeleton variant="text" height={20} width="40%" sx={{ mb: 1 }} />
                  <Skeleton variant="rectangular" height={56} width="100%" />
                </Grid>
              ))}
              <Grid item xs={12}>
                <Skeleton variant="text" height={20} width="30%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={80} width="100%" />
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" gap={2} sx={{ mt: 3 }}>
                  <Skeleton variant="rectangular" width={120} height={36} borderRadius={1} />
                  <Skeleton variant="rectangular" width={80} height={36} borderRadius={1} />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Petty Cash Fund' : 'Add New Petty Cash Fund'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/admin/petty-cash')}
        >
          Back to Dashboard
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Office Petty Cash"
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Amount"
                  name="initialAmount"
                  type="number"
                  value={formData.initialAmount}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Main Office"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Custodian</InputLabel>
                  <Select
                    name="custodian"
                    value={formData.custodian}
                    onChange={handleChange}
                    label="Custodian"
                    required
                  >
                    {employees.length === 0 ? (
                      <MenuItem disabled>No employees found</MenuItem>
                    ) : (
                      employees.map(employee => (
                        <MenuItem key={employee._id} value={employee._id}>
                          {employee.firstName} {employee.lastName} ({employee.employeeId})
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    label="Status"
                    required
                  >
                    {statuses.map(status => (
                      <MenuItem key={status} value={status}>{status}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Fund Date"
                  name="fundDate"
                  type="date"
                  value={formData.fundDate}
                  onChange={handleChange}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Vendor"
                  name="vendor"
                  value={formData.vendor}
                  onChange={handleChange}
                  placeholder="e.g., Office Depot"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Type</InputLabel>
                  <Select
                    name="paymentType"
                    value={formData.paymentType}
                    onChange={handleChange}
                    label="Payment Type"
                  >
                    {paymentTypes.map(type => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Subtitle"
                  name="subtitle"
                  value={formData.subtitle}
                  onChange={handleChange}
                  placeholder="e.g., Debit Card, Credit Card, etc."
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  multiline
                  rows={3}
                  placeholder="Additional details about the fund..."
                />
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" gap={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    size="large"
                  >
                    {loading ? <CircularProgress size={24} /> : (isEdit ? 'Update Fund' : 'Create Fund')}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/admin/petty-cash')}
                    size="large"
                  >
                    Cancel
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default FundForm;
