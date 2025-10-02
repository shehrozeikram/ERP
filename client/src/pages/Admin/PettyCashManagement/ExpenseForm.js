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

const ExpenseForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    expenseId: '',
    fundId: '',
    amount: 0,
    description: '',
    category: 'Other',
    receiptNumber: '',
    expenseDate: new Date().toISOString().split('T')[0], // Today's date
    vendor: '',
    paymentType: 'Cash',
    paymentSubtype: '',
    requestedBy: '',
    notes: ''
  });

  const [funds, setFunds] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const categories = [
    'Office Supplies', 
    'Travel', 
    'Meals', 
    'Utilities', 
    'Maintenance', 
    'Communication', 
    'Other'
  ];

  const paymentTypes = [
    'Cash',
    'Card', 
    'Bank Transfer',
    'Cheque',
    'Other'
  ];

  useEffect(() => {
    fetchFunds();
    fetchEmployees();
    if (isEdit) {
      fetchExpense();
    }
  }, [id, isEdit]);

  const fetchFunds = async () => {
    try {
      const response = await pettyCashService.getFunds();
      setFunds(response.data);
    } catch (err) {
      console.error('Error fetching funds:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      // Note: In a real implementation, you would fetch employees from the employee service
      // For now, we'll use a mock list
      setEmployees([
        { _id: 'emp1', firstName: 'John', lastName: 'Doe', employeeId: 'EMP001' },
        { _id: 'emp2', firstName: 'Jane', lastName: 'Smith', employeeId: 'EMP002' },
        { _id: 'emp3', firstName: 'Atif', lastName: 'Mahmood', employeeId: '6031' }
      ]);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchExpense = async () => {
    try {
      setLoading(true);
      const response = await pettyCashService.getExpense(id);
      const expense = response.data;
      
      setFormData({
        expenseId: expense.expenseId || '',
        fundId: expense.fundId?._id || '',
        amount: expense.amount || 0,
        description: expense.description || '',
        category: expense.category || 'Other',
        receiptNumber: expense.receiptNumber || '',
        expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        vendor: expense.vendor || '',
        paymentType: expense.paymentType || 'Cash',
        paymentSubtype: expense.paymentSubtype || '',
        requestedBy: expense.requestedBy?._id || '',
        notes: expense.notes || ''
      });
    } catch (err) {
      setError('Failed to fetch expense details');
      console.error('Error fetching expense:', err);
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
        amount: parseFloat(formData.amount),
        expenseDate: new Date(formData.expenseDate),
        fundId: formData.fundId || null,
        requestedBy: formData.requestedBy || null
      };

      if (isEdit) {
        await pettyCashService.updateExpense(id, submitData);
        setSuccess('Expense updated successfully!');
      } else {
        await pettyCashService.createExpense(submitData);
        setSuccess('Expense created successfully!');
      }

      setTimeout(() => {
        navigate('/admin/petty-cash');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save expense');
      console.error('Error saving expense:', err);
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
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((item) => (
                <Grid item xs={12} sm={6} key={item}>
                  <Skeleton variant="text" height={20} width="35%" sx={{ mb: 1 }} />
                  <Skeleton variant="rectangular" height={56} width="100%" />
                </Grid>
              ))}
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
          {isEdit ? 'Edit Petty Cash Expense' : 'Add New Petty Cash Expense'}
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
                  label="Expense ID"
                  name="expenseId"
                  value={formData.expenseId}
                  onChange={handleChange}
                  required
                  placeholder="e.g., EXP001"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Fund</InputLabel>
                  <Select
                    name="fundId"
                    value={formData.fundId}
                    onChange={handleChange}
                    label="Fund"
                    required
                  >
                    {funds.map(fund => (
                      <MenuItem key={fund._id} value={fund._id}>
                        {fund.fundId} - {fund.title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  name="amount"
                  type="number"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    label="Category"
                    required
                  >
                    {categories.map(category => (
                      <MenuItem key={category} value={category}>{category}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  multiline
                  rows={2}
                  placeholder="Describe the expense..."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Receipt Number"
                  name="receiptNumber"
                  value={formData.receiptNumber}
                  onChange={handleChange}
                  placeholder="e.g., RCP001"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Expense Date"
                  name="expenseDate"
                  type="date"
                  value={formData.expenseDate}
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
                  label="Payment Subtype"
                  name="paymentSubtype"
                  value={formData.paymentSubtype}
                  onChange={handleChange}
                  placeholder="e.g., Debit Card, Credit Card, etc."
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Requested By</InputLabel>
                  <Select
                    name="requestedBy"
                    value={formData.requestedBy}
                    onChange={handleChange}
                    label="Requested By"
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
                <TextField
                  fullWidth
                  label="Notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  multiline
                  rows={2}
                  placeholder="Additional notes..."
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
                    {loading ? <CircularProgress size={24} /> : (isEdit ? 'Update Expense' : 'Create Expense')}
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

export default ExpenseForm;
