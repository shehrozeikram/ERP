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
  CircularProgress
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import pettyCashService from '../../../services/pettyCashService';

const FundForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    fundId: '',
    name: '',
    initialAmount: 0,
    maxAmount: 0,
    custodian: '',
    status: 'Active',
    location: 'Main Office',
    description: ''
  });

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const statuses = ['Active', 'Inactive', 'Suspended'];

  useEffect(() => {
    fetchEmployees();
    if (isEdit) {
      fetchFund();
    }
  }, [id, isEdit]);

  const fetchEmployees = async () => {
    try {
      // Note: In a real implementation, you would fetch employees from the employee service
      // For now, we'll use a mock list
      setEmployees([
        { _id: 'emp1', firstName: 'John', lastName: 'Doe', employeeId: 'EMP001' },
        { _id: 'emp2', firstName: 'Jane', lastName: 'Smith', employeeId: 'EMP002' }
      ]);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchFund = async () => {
    try {
      setLoading(true);
      const response = await pettyCashService.getFund(id);
      const fund = response.data;
      
      setFormData({
        fundId: fund.fundId || '',
        name: fund.name || '',
        initialAmount: fund.initialAmount || 0,
        maxAmount: fund.maxAmount || 0,
        custodian: fund.custodian?._id || '',
        status: fund.status || 'Active',
        location: fund.location || 'Main Office',
        description: fund.description || ''
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
        maxAmount: parseFloat(formData.maxAmount),
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
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
                  label="Fund ID"
                  name="fundId"
                  value={formData.fundId}
                  onChange={handleChange}
                  required
                  placeholder="e.g., PC001"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Fund Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Office Petty Cash"
                />
              </Grid>
              
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Initial Amount"
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
                  label="Maximum Amount"
                  name="maxAmount"
                  type="number"
                  value={formData.maxAmount}
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
                    {employees.map(employee => (
                      <MenuItem key={employee._id} value={employee._id}>
                        {employee.firstName} {employee.lastName} ({employee.employeeId})
                      </MenuItem>
                    ))}
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
