import React, { useState, useEffect, useMemo } from 'react';
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
  CircularProgress,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import RentalManagementDetail from './RentalManagementDetail';
import {
  approverSearchOnInputChange,
  mergeApproverOptionList,
  optionsForManagerApprover,
  optionsForHodApprover
} from '../../../utils/dualApproverAutocomplete';

const RentalManagementDashboard = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
    referenceNumber: '',
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
  const [departments, setDepartments] = useState([]);
  const [dateValue, setDateValue] = useState(null);
  const [approverOptions, setApproverOptions] = useState([]);
  const [managerApprover, setManagerApprover] = useState(null);
  const [hodApprover, setHodApprover] = useState(null);

  useEffect(() => {
    fetchRecords();
    fetchRentalAgreements();
    fetchDepartments();
    fetchApproverOptions();
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

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/hr/departments');
      setDepartments(response.data?.data || []);
    } catch {
      setDepartments([]);
    }
  };

  const fetchApproverOptions = async (search = '') => {
    try {
      const response = await api.get('/rental-management/approver-candidates', {
        params: { limit: 50, search: search || undefined }
      });
      setApproverOptions(response.data?.data || []);
    } catch {
      setApproverOptions([]);
    }
  };

  const getUserId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return String(value._id || value.id || value.userId || '');
  };
  const userDisplayName = (u) => {
    if (!u) return '';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.employeeId || '';
  };

  const requesterId = getUserId(user);
  const mergedApproverOptions = useMemo(
    () => mergeApproverOptionList(approverOptions, managerApprover, hodApprover),
    [approverOptions, managerApprover, hodApprover]
  );
  const managerApproverSelectOptions = useMemo(
    () => optionsForManagerApprover({ optionsMerged: mergedApproverOptions, requesterId, hodApprover }),
    [mergedApproverOptions, requesterId, hodApprover]
  );
  const hodApproverSelectOptions = useMemo(
    () => optionsForHodApprover({ optionsMerged: mergedApproverOptions, requesterId, managerApprover }),
    [mergedApproverOptions, requesterId, managerApprover]
  );


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
        referenceNumber: record.referenceNumber || '',
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
        status: record.status || 'Draft',
        draftApproverIds: record.draftApproverIds || []
      });
      if (record.date) {
        const parsed = new Date(record.date);
        setDateValue(Number.isNaN(parsed.getTime()) ? null : parsed);
      } else {
        setDateValue(null);
      }
      const draftApprovers = record.draftApproverIds || [];
      const chainApprovers = (record.approvalChain || []).map((step) => step.approver).filter(Boolean);
      const approvers = draftApprovers.length ? draftApprovers : chainApprovers;
      setManagerApprover(approvers[0] && typeof approvers[0] === 'object' ? approvers[0] : null);
      setHodApprover(approvers[1] && typeof approvers[1] === 'object' ? approvers[1] : null);
    } else {
      setEditingRecord(null);
      setFormData(defaultFormData);
      setDateValue(null);
      setManagerApprover(null);
      setHodApprover(null);
    }
    setDialogOpen(true);
    setError('');
    setSuccess('');
    fetchApproverOptions('');
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

  const handleDateChange = (newValue) => {
    setDateValue(newValue);
    setFormData((prev) => ({
      ...prev,
      date: newValue ? format(newValue, 'yyyy-MM-dd') : ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const managerApproverId = getUserId(managerApprover);
    const hodApproverId = getUserId(hodApprover);
    const requesterId = getUserId(user);
    if (!managerApproverId || !hodApproverId) {
      setError('Please select Manager Approver and Head Of Department Approver.');
      return;
    }
    if (managerApproverId === hodApproverId) {
      setError('Manager Approver and Head Of Department Approver must be different.');
      return;
    }
    if ([managerApproverId, hodApproverId].includes(requesterId)) {
      setError('Requester cannot be selected as Manager or Head Of Department approver.');
      return;
    }

    // Prevent multiple submissions
    if (submitting) {
      return;
    }
    
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      const payload = {
        ...formData,
        draftApproverIds: JSON.stringify([managerApproverId, hodApproverId])
      };
      if (editingRecord) {
        await api.put(`/rental-management/${editingRecord._id}`, payload);
        setSuccess('Rental management record updated successfully');
      } else {
        await api.post('/rental-management', payload);
        setSuccess('Rental management record created successfully');
      }
      fetchRecords();
      setTimeout(() => {
        handleCloseDialog();
      }, 1500);
    } catch (error) {
      console.error('Error saving record:', error);
      setError(error.response?.data?.message || 'Failed to save rental management record');
    } finally {
      setSubmitting(false);
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
  const getWorkflowLabel = (record) => {
    if (record?.workflowStatus && record.workflowStatus !== 'Draft') return record.workflowStatus;
    return record?.approvalStatus || record?.status || 'Draft';
  };
  const getWorkflowColor = (record) => {
    const label = getWorkflowLabel(record);
    if (String(label).includes('Approved')) return 'success';
    if (label === 'Submitted' || label === 'Send to Audit' || label === 'Forwarded to Audit Director') return 'warning';
    if (String(label).includes('Rejected') || label === 'Returned from Audit') return 'error';
    return 'default';
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
                        label={getWorkflowLabel(record)}
                        color={getWorkflowColor(record)}
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
        <LocalizationProvider dateAdapter={AdapterDateFns}>
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
                <FormControl fullWidth>
                  <InputLabel>From Department</InputLabel>
                  <Select
                    name="fromDepartment"
                    value={formData.fromDepartment}
                    onChange={handleInputChange}
                    label="From Department"
                  >
                    <MenuItem value="">
                      <em>Select department</em>
                    </MenuItem>
                    {departments.map((department) => (
                      <MenuItem key={department._id} value={department.name || ''}>
                        {department.name || 'N/A'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
                <DatePicker
                  label="Date"
                  value={dateValue}
                  onChange={handleDateChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      placeholder: 'DD/MM/YYYY'
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Reference Number"
                  name="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={handleInputChange}
                  placeholder="Enter reference number"
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
                      <em>None (Optional)</em>
                    </MenuItem>
                    {rentalAgreements.map((agreement) => (
                      <MenuItem key={agreement._id} value={agreement._id}>
                        {agreement.agreementNumber} - {agreement.propertyName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Approval Authority Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
                  Approval Authority
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Manager and Head Of Department approvers: User Management department Administration only (code ADMIN).
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Prepared By"
                  value={userDisplayName(user) || 'Current User'}
                  InputProps={{ readOnly: true }}
                  helperText="Auto-filled from logged in user"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={managerApproverSelectOptions}
                  value={managerApprover}
                  onChange={(_, value) => setManagerApprover(value)}
                  onOpen={() => fetchApproverOptions('')}
                  onInputChange={approverSearchOnInputChange(fetchApproverOptions)}
                  getOptionLabel={(option) =>
                    [option?.firstName, option?.lastName].filter(Boolean).join(' ') || option?.email || ''
                  }
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  renderInput={(params) => (
                    <TextField {...params} label="Manager Approver" required placeholder="Select manager approver" />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  options={hodApproverSelectOptions}
                  value={hodApprover}
                  onChange={(_, value) => setHodApprover(value)}
                  onOpen={() => fetchApproverOptions('')}
                  onInputChange={approverSearchOnInputChange(fetchApproverOptions)}
                  getOptionLabel={(option) =>
                    [option?.firstName, option?.lastName].filter(Boolean).join(' ') || option?.email || ''
                  }
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  renderInput={(params) => (
                    <TextField {...params} label="Head Of Department Approver" required placeholder="Select HOD approver" />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} /> : null}
            >
              {submitting ? (editingRecord ? 'Updating...' : 'Creating...') : (editingRecord ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </form>
        </LocalizationProvider>
      </Dialog>

      {/* View Details Modal */}
      <RentalManagementDetail
        open={viewDialog.open}
        onClose={() => setViewDialog({ open: false, record: null })}
        recordId={viewDialog.record?._id}
        onStatusChange={(updatedRecord) => {
          if (updatedRecord?._id) {
            setRecords((prev) => prev.map((item) => (item._id === updatedRecord._id ? updatedRecord : item)));
            setViewDialog((prev) => ({ ...prev, record: updatedRecord }));
          } else {
            fetchRecords();
          }
        }}
        onEdit={(record) => {
          setViewDialog({ open: false, record: null });
          handleOpenDialog(record);
        }}
      />
    </Box>
  );
};

export default RentalManagementDashboard;
