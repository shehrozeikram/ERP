import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const RentalManagementDashboard = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    rentalAgreement: '',
    advancePayment: '',
    agreementDate: '',
    vendorIdCard: '',
    amount: '',
    description: '',
    paymentName: '',
    paymentSubname: '',
    location: '',
    custodian: '',
    status: 'Draft'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchRecords();
    fetchAgreements();
    fetchEmployees();
  }, []);

  const fetchRecords = async () => {
    try {
      const response = await api.get('/rental-management');
      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching records:', error);
      setError('Failed to fetch rental management records');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgreements = async () => {
    try {
      const response = await api.get('/rental-management/agreements/list');
      setAgreements(response.data);
    } catch (error) {
      console.error('Error fetching agreements:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/hr/employees?getAll=true');
      
      // Filter employees to only show those from Administration department
      const adminEmployees = (response.data.data || []).filter(emp => 
        emp.placementDepartment && emp.placementDepartment._id === '68bebffba7f2f0565a67eb50' // Administration department ID
      );
      
      setEmployees(adminEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    }
  };

  const handleOpenDialog = (record = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        rentalAgreement: record.rentalAgreement?._id || '',
        advancePayment: record.advancePayment || '',
        agreementDate: record.agreementDate ? format(new Date(record.agreementDate), 'yyyy-MM-dd') : '',
        vendorIdCard: record.vendorIdCard || '',
        amount: record.amount || '',
        description: record.description || '',
        paymentName: record.paymentName || '',
        paymentSubname: record.paymentSubname || '',
        location: record.location || '',
        custodian: record.custodian || '',
        status: record.status
      });
    } else {
      setEditingRecord(null);
      setFormData({
        rentalAgreement: '',
        advancePayment: '',
        agreementDate: '',
        vendorIdCard: '',
        amount: '',
        description: '',
        paymentName: '',
        paymentSubname: '',
        location: '',
        custodian: '',
        status: 'Draft'
      });
    }
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRecord(null);
    setFormData({});
    setError('');
    setSuccess('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRecord) {
        await api.put(`/rental-management/${editingRecord._id}`, formData);
        setSuccess('Rental management record updated successfully');
      } else {
        await api.post('/rental-management', formData);
        setSuccess('Rental management record created successfully');
      }
      fetchRecords();
      setTimeout(() => {
        handleCloseDialog();
      }, 1500);
    } catch (error) {
      console.error('Error saving record:', error);
      setError(error.response?.data?.message || 'Failed to save rental management record');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await api.delete(`/rental-management/${id}`);
        setSuccess('Record deleted successfully');
        fetchRecords();
      } catch (error) {
        console.error('Error deleting record:', error);
        setError('Failed to delete record');
      }
    }
  };

  const handleViewDetail = (id) => {
    navigate(`/admin/rental-management/${id}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'default';
      case 'HOD Admin': return 'info';
      case 'Audit': return 'primary';
      case 'Finance': return 'secondary';
      case 'CEO/President': return 'warning';
      case 'Approved': return 'success';
      case 'Paid': return 'success';
      case 'Rejected': return 'error';
      default: return 'default';
    }
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = {
      'Draft': 'HOD Admin',
      'HOD Admin': 'Audit',
      'Audit': 'Finance',
      'Finance': 'CEO/President',
      'CEO/President': 'Approved',
      'Approved': 'Paid'
    };
    return statusFlow[currentStatus];
  };

  const handleStatusChange = async (recordId, currentStatus) => {
    const nextStatus = getNextStatus(currentStatus);
    
    if (!nextStatus) {
      setError('This record is already at the final status');
      return;
    }

    if (window.confirm(`Move this record from "${currentStatus}" to "${nextStatus}"?`)) {
      try {
        await api.put(`/rental-management/${recordId}/status`, { status: nextStatus });
        setSuccess(`Status updated to ${nextStatus}`);
        fetchRecords();
      } catch (error) {
        console.error('Error updating status:', error);
        setError(error.response?.data?.message || 'Failed to update status');
      }
    }
  };

  const formatPKR = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading rental management records...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Rental Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add New Record
        </Button>
      </Box>

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
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Property</TableCell>
                  <TableCell>Advance Payment</TableCell>
                  <TableCell>Agreement Date</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record._id}>
                    <TableCell>
                      {record.rentalAgreement?.propertyName || 'N/A'}
                    </TableCell>
                    <TableCell>{formatPKR(record.advancePayment || 0)}</TableCell>
                    <TableCell>
                      {record.agreementDate ? format(new Date(record.agreementDate), 'dd/MM/yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>{formatPKR(record.amount)}</TableCell>
                    <TableCell>
                      <Chip
                        label={record.status}
                        color={getStatusColor(record.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{format(new Date(record.createdAt), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetail(record._id)}
                        color="info"
                        title="View Details"
                      >
                        <ViewIcon />
                      </IconButton>
                      {record.status !== 'Paid' && record.status !== 'Rejected' && (
                        <IconButton
                          size="small"
                          onClick={() => handleStatusChange(record._id, record.status)}
                          color="success"
                          title={`Move to ${getNextStatus(record.status)}`}
                        >
                          <ArrowForwardIcon />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(record)}
                        color="primary"
                        title="Edit"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(record._id)}
                        color="error"
                        title="Delete"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRecord ? 'Edit Rental Management Record' : 'Add New Rental Management Record'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Rental Agreement</InputLabel>
                  <Select
                    name="rentalAgreement"
                    value={formData.rentalAgreement}
                    onChange={handleInputChange}
                    label="Rental Agreement"
                  >
                    {agreements.map((agreement) => (
                      <MenuItem key={agreement._id} value={agreement._id}>
                        {agreement.propertyName} - {agreement.agreementNumber}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Advance Payment"
                  name="advancePayment"
                  type="number"
                  value={formData.advancePayment}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Agreement Date"
                  name="agreementDate"
                  type="date"
                  value={formData.agreementDate}
                  onChange={handleInputChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Vendor ID Card"
                  name="vendorIdCard"
                  value={formData.vendorIdCard}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  name="amount"
                  type="number"
                  value={formData.amount}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Status"
                  name="status"
                  select
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                >
                  <MenuItem value="Draft">Draft</MenuItem>
                  <MenuItem value="HOD Admin">HOD Admin</MenuItem>
                  <MenuItem value="Audit">Audit</MenuItem>
                  <MenuItem value="Finance">Finance</MenuItem>
                  <MenuItem value="CEO/President">CEO/President</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Paid">Paid</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Payment Name"
                  name="paymentName"
                  value={formData.paymentName}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Payment Subname"
                  name="paymentSubname"
                  value={formData.paymentSubname}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Custodian</InputLabel>
                  <Select
                    name="custodian"
                    value={formData.custodian}
                    onChange={handleInputChange}
                    label="Custodian"
                  >
                    <MenuItem value="">
                      <em>Select Custodian</em>
                    </MenuItem>
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
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingRecord ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default RentalManagementDashboard;
