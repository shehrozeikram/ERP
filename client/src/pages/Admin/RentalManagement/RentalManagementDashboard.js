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
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  CircularProgress
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
import RentalManagementDetail from './RentalManagementDetail';

const RentalManagementDashboard = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const defaultFormData = {
    // Company Details
    parentCompanyName: '',
    subsidiaryName: '',
    
    // Payment Details
    site: '',
    paymentType: '',
    fromDepartment: '',
    custodian: '',
    date: '',
    toWhomPaid: '',
    forWhat: '',
    amount: '',
    grandTotal: '',
    
    // Rental Agreement
    rentalAgreement: '',
    
    // Authorization Details
    preparedBy: '',
    preparedByDesignation: '',
    verifiedBy: '',
    verifiedByDesignation: '',
    approvedBy: '',
    approvedByDesignation: '',
    
    // Status
    status: 'Draft'
  };
  const [formData, setFormData] = useState(defaultFormData);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewDialog, setViewDialog] = useState({ open: false, record: null });
  const [rentalAgreements, setRentalAgreements] = useState([]);

  useEffect(() => {
    fetchRecords();
    fetchRentalAgreements();
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

  const fetchRentalAgreements = async () => {
    try {
      const response = await api.get('/rental-management/rental-agreements/list');
      setRentalAgreements(response.data);
    } catch (error) {
      console.error('Error fetching rental agreements:', error);
    }
  };


  const handleOpenDialog = (record = null) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        parentCompanyName: record.parentCompanyName || '',
        subsidiaryName: record.subsidiaryName || '',
        site: record.site || '',
        paymentType: record.paymentType || '',
        fromDepartment: record.fromDepartment || '',
        custodian: record.custodian || '',
        date: record.date || '',
        toWhomPaid: record.toWhomPaid || '',
        forWhat: record.forWhat || '',
        amount: record.amount || '',
        grandTotal: record.grandTotal || '',
        rentalAgreement: record.rentalAgreement?._id || '',
        preparedBy: record.preparedBy || '',
        preparedByDesignation: record.preparedByDesignation || '',
        verifiedBy: record.verifiedBy || '',
        verifiedByDesignation: record.verifiedByDesignation || '',
        approvedBy: record.approvedBy || '',
        approvedByDesignation: record.approvedByDesignation || '',
        status: record.status || 'Draft'
      });
    } else {
      setEditingRecord(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
    setError('');
    setSuccess('');
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRecord(null);
    setFormData(defaultFormData);
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
      setDeleting(true);
      setError('');
      try {
        await api.delete(`/rental-management/${id}`);
        setSuccess('Record deleted successfully');
        await fetchRecords(); // Wait for records to reload
      } catch (error) {
        console.error('Error deleting record:', error);
        setError('Failed to delete record');
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleViewDetail = (record) => {
    setViewDialog({ open: true, record });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Draft': return 'default';
      case 'Submitted': return 'info';
      case 'Approved': return 'success';
      case 'Paid': return 'success';
      case 'Rejected': return 'error';
      default: return 'default';
    }
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = {
      'Draft': 'Submitted',
      'Submitted': 'Approved',
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


  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="35%" height={40} />
          <Skeleton variant="rectangular" width={140} height={36} borderRadius={1} />
        </Box>

        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Skeleton variant="text" width="35%" height={28} />
              <Skeleton variant="rectangular" width={140} height={36} borderRadius={1} />
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                      <TableCell key={item}><Skeleton variant="text" height={20} /></TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((item) => (
                    <TableRow key={item}>
                      <TableCell><Skeleton variant="text" height={20} width="60%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="50%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="45%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="70%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="40%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="65%" /></TableCell>
                      <TableCell><Skeleton variant="text" height={20} width="55%" /></TableCell>
                      <TableCell><Skeleton variant="rectangular" height={20} width={60} /></TableCell>
                      <TableCell align="center">
                        <Box display="flex" justifyContent="center" gap={1}>
                          <Skeleton variant="circular" width={32} height={32} />
                          <Skeleton variant="circular" width={32} height={32} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
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
                  <TableCell>Tenant</TableCell>
                  <TableCell>Purpose</TableCell>
                  <TableCell>To Whom Paid</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Grand Total</TableCell>
                  <TableCell>Rental Agreement</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record._id}>
                    <TableCell>
                      {record.parentCompanyName || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {record.subsidiaryName || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {record.toWhomPaid || 'N/A'}
                    </TableCell>
                    <TableCell>PKR {record.amount || '0'}</TableCell>
                    <TableCell>PKR {record.grandTotal || '0'}</TableCell>
                    <TableCell>
                      {record.rentalAgreement ? (
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {record.rentalAgreement.agreementNumber}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {record.rentalAgreement.tenantName}
                          </Typography>
                        </Box>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>
                      {record.date || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.status}
                        color={getStatusColor(record.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetail(record)}
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
                        disabled={deleting}
                      >
                        {deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
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
              {/* Company Details Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
                  Company Details
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Tenant"
                  name="parentCompanyName"
                  value={formData.parentCompanyName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Tenant Name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Purpose"
                  name="subsidiaryName"
                  value={formData.subsidiaryName}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Office Rent"
                />
              </Grid>

              {/* Payment Details Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
                  Payment Details
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Site"
                  name="site"
                  value={formData.site}
                  onChange={handleInputChange}
                  placeholder="Enter site location"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Type</InputLabel>
                  <Select
                    name="paymentType"
                    value={formData.paymentType}
                    onChange={handleInputChange}
                    label="Payment Type"
                  >
                    <MenuItem value="Payable">Payable</MenuItem>
                    <MenuItem value="Reimbursement">Reimbursement</MenuItem>
                    <MenuItem value="Advance">Advance</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="From Department"
                  name="fromDepartment"
                  value={formData.fromDepartment}
                  onChange={handleInputChange}
                  placeholder="Enter department name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Custodian"
                  name="custodian"
                  value={formData.custodian}
                  onChange={handleInputChange}
                  placeholder="Enter custodian name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  placeholder="DD/MM/YYYY"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="To Whom Paid"
                  name="toWhomPaid"
                  value={formData.toWhomPaid}
                  onChange={handleInputChange}
                  placeholder="Enter recipient name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter amount"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Grand Total"
                  name="grandTotal"
                  value={formData.grandTotal}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter grand total"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="For What"
                  name="forWhat"
                  value={formData.forWhat}
                  onChange={handleInputChange}
                  multiline
                  rows={3}
                  placeholder="Describe the purpose of payment"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Rental Agreement</InputLabel>
                  <Select
                    name="rentalAgreement"
                    value={formData.rentalAgreement}
                    onChange={handleInputChange}
                    label="Rental Agreement"
                  >
                    <MenuItem value="">
                      <em>Select a rental agreement</em>
                    </MenuItem>
                    {rentalAgreements.map((agreement) => (
                      <MenuItem key={agreement._id} value={agreement._id}>
                        {agreement.agreementNumber} - {agreement.propertyName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Authorization Details Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
                  Authorization Details
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Prepared By"
                  name="preparedBy"
                  value={formData.preparedBy}
                  onChange={handleInputChange}
                  placeholder="Enter preparer name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Prepared By Designation"
                  name="preparedByDesignation"
                  value={formData.preparedByDesignation}
                  onChange={handleInputChange}
                  placeholder="Enter designation"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Verified By"
                  name="verifiedBy"
                  value={formData.verifiedBy}
                  onChange={handleInputChange}
                  placeholder="Enter verifier name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Verified By Designation"
                  name="verifiedByDesignation"
                  value={formData.verifiedByDesignation}
                  onChange={handleInputChange}
                  placeholder="Enter designation"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Approved By"
                  name="approvedBy"
                  value={formData.approvedBy}
                  onChange={handleInputChange}
                  placeholder="Enter approver name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Approved By Designation"
                  name="approvedByDesignation"
                  value={formData.approvedByDesignation}
                  onChange={handleInputChange}
                  placeholder="Enter designation"
                />
              </Grid>

              {/* Status */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    label="Status"
                  >
                    <MenuItem value="Draft">Draft</MenuItem>
                    <MenuItem value="Submitted">Submitted</MenuItem>
                    <MenuItem value="Approved">Approved</MenuItem>
                    <MenuItem value="Rejected">Rejected</MenuItem>
                    <MenuItem value="Paid">Paid</MenuItem>
                  </Select>
                </FormControl>
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

      {/* View Details Modal */}
      <RentalManagementDetail
        open={viewDialog.open}
        onClose={() => setViewDialog({ open: false, record: null })}
        recordId={viewDialog.record?._id}
        onEdit={(record) => {
          setViewDialog({ open: false, record: null });
          handleOpenDialog(record);
        }}
      />
    </Box>
  );
};

export default RentalManagementDashboard;
