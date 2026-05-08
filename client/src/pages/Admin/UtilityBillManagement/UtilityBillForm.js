import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Skeleton,
  Avatar,
  IconButton,
  Stack
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';
import api from '../../../services/api';
import { getImageUrl, handleImageError } from '../../../utils/imageService';
import { useAuth } from '../../../contexts/AuthContext';

const userDisplayName = (user) => {
  if (!user) return '';
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.fullName || user.email || user.employeeId || '';
};
const getUserId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || value.userId || '');
};

const UtilityBillForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const defaultType = searchParams.get('type') || 'Electricity';
  const accountHeadOptions = ['President Personal', 'Head Office', 'Boly.pk', 'Usman Solar'];

  const [formData, setFormData] = useState({
    accountHead: '',
    site: 'Head Office',
    utilityType: defaultType,
    provider: '',
    accountNumber: '',
    billDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    amount: 0,
    lastMonthAmount: 0,
    forWhat: '',
    location: 'Main Office',
    department: '',
    custodian: 'Lt.Col.Safeer Ahmed'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [masterDataLoading, setMasterDataLoading] = useState(false);
  const [managerApprover, setManagerApprover] = useState(null);
  const [hodApprover, setHodApprover] = useState(null);
  const [approverOptions, setApproverOptions] = useState([]);
  const [approverLoading, setApproverLoading] = useState(false);

  useEffect(() => {
    fetchMasterData();
    if (isEdit) {
      fetchBill();
    }
  }, [id, isEdit]);

  const fetchMasterData = async () => {
    try {
      setMasterDataLoading(true);
      const [departmentsResponse, employeesResponse] = await Promise.all([
        api.get('/hr/departments'),
        api.get('/hr/employees', { params: { getAll: true, active: true } })
      ]);

      setDepartments(departmentsResponse.data.data || []);
      setEmployees(employeesResponse.data.data || []);
    } catch (err) {
      console.error('Error fetching utility bill master data:', err);
      setError('Failed to load department and custodian lists');
    } finally {
      setMasterDataLoading(false);
    }
  };

  const fetchBill = async () => {
    try {
      setLoading(true);
      const response = await utilityBillService.getUtilityBill(id);
      const bill = response.data;
      
      setFormData({
        accountHead: bill.accountHead || '',
        site: bill.site || '',
        utilityType: bill.utilityType || defaultType,
        provider: bill.provider || '',
        accountNumber: bill.accountNumber || '',
        billDate: bill.billDate ? new Date(bill.billDate).toISOString().split('T')[0] : '',
        dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString().split('T')[0] : '',
        amount: bill.amount || 0,
        lastMonthAmount: bill.lastMonthAmount || 0,
        forWhat: bill.forWhat || '',
        location: bill.location || 'Main Office',
        department: bill.department || '',
        custodian: bill.custodian || ''
      });

      // Set image preview if bill has an image
      if (bill.billImage) {
        setImagePreview(getImageUrl(bill.billImage));
      }

      const draftApprovers = bill.draftApproverIds || [];
      const chainApprovers = (bill.approvalChain || []).map((step) => step.approver).filter(Boolean);
      const approvers = draftApprovers.length ? draftApprovers : chainApprovers;
      setManagerApprover(approvers[0] && typeof approvers[0] === 'object' ? approvers[0] : null);
      setHodApprover(approvers[1] && typeof approvers[1] === 'object' ? approvers[1] : null);
    } catch (err) {
      setError('Failed to fetch utility bill details');
      console.error('Error fetching bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await saveBill('draft');
  };

  const loadApproverOptions = async (search = '') => {
    try {
      setApproverLoading(true);
      const response = await utilityBillService.getApproverCandidates({ search, limit: 50 });
      setApproverOptions(response.data || []);
    } catch {
      setApproverOptions([]);
    } finally {
      setApproverLoading(false);
    }
  };

  useEffect(() => {
    loadApproverOptions('');
  }, []);

  const saveBill = async (mode = 'draft') => {
    if (mode === 'submit' && (!managerApprover?._id || !hodApprover?._id)) {
      setError('Please select Manager Approver and Head Of Department Approver before submitting.');
      return;
    }

    const managerApproverId = getUserId(managerApprover);
    const hodApproverId = getUserId(hodApprover);
    const requesterId = getUserId(user);

    if (mode === 'submit' && [managerApproverId, hodApproverId].includes(requesterId)) {
      setError('Requester cannot be selected as Manager or Head Of Department approver.');
      return;
    }

    if (mode === 'submit' && managerApproverId === hodApproverId) {
      setError('Manager Approver and Head Of Department Approver must be different.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);

      const submitData = new FormData();
      
      // Add form data
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });

      const approverIds = [managerApproverId, hodApproverId].filter(Boolean);
      submitData.append('draftApproverIds', JSON.stringify(approverIds));

      // Add image if selected
      if (selectedImage) {
        submitData.append('billImage', selectedImage);
      }

      let savedBill;
      if (isEdit) {
        const response = await utilityBillService.updateUtilityBill(id, submitData);
        savedBill = response.data;
      } else {
        const response = await utilityBillService.createUtilityBill(submitData);
        savedBill = response.data;
      }

      if (mode === 'submit') {
        await utilityBillService.submitUtilityBill(savedBill._id, { approverIds });
        navigate(`/admin/utility-bills/${savedBill._id}`);
        return;
      }

      navigate('/admin/utility-bills');
    } catch (err) {
      setError(err.response?.data?.message || (isEdit ? 'Failed to update utility bill' : 'Failed to create utility bill'));
      console.error('Error saving bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const utilityTypes = [
    'Electricity',
    'Water',
    'Gas',
    'Internet',
    'Phone',
    'Maintenance',
    'Security',
    'Cleaning',
    'Other'
  ];

  const getEmployeeName = (employee) => (
    employee.fullName ||
    [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
    employee.employeeId ||
    'Unnamed Employee'
  );

  const getEmployeeOptionValue = (employee) => {
    const employeeName = getEmployeeName(employee);
    return employee.employeeId ? `${employeeName} (${employee.employeeId})` : employeeName;
  };

  if (loading && isEdit) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width="25%" height={40} />
          <Skeleton variant="rectangular" width={80} height={36} borderRadius={1} />
        </Box>

        <Card>
          <CardContent>
            {/* Form Skeleton */}
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="30%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="40%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="50%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="35%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="45%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Skeleton variant="text" height={20} width="30%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={56} width="100%" />
              </Grid>
              <Grid item xs={12}>
                <Skeleton variant="text" height={20} width="40%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={120} width="100%" />
              </Grid>
              <Grid item xs={12}>
                <Skeleton variant="text" height={20} width="25%" sx={{ mb: 1 }} />
                <Skeleton variant="rectangular" height={80} width="100%" />
              </Grid>
              
              {/* Image Upload Skeleton */}
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Skeleton variant="rectangular" width={120} height={80} />
                  <Box flexGrow={1}>
                    <Skeleton variant="text" height={20} width="40%" sx={{ mb: 1 }} />
                    <Skeleton variant="rectangular" height={36} width="140" />
                  </Box>
                </Box>
              </Grid>

              {/* Buttons Skeleton */}
              <Grid item xs={12}>
                <Box display="flex" gap={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                  <Skeleton variant="rectangular" width={80} height={36} borderRadius={1} />
                  <Skeleton variant="rectangular" width={120} height={36} borderRadius={1} />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {isEdit ? 'Edit Utility Bill' : 'Create New Utility Bill'}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/admin/utility-bills')}
        >
          Back to Bills
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Account Head</InputLabel>
                  <Select
                    value={formData.accountHead}
                    onChange={handleChange('accountHead')}
                    label="Account Head"
                  >
                    <MenuItem value="">
                      <em>Select account head</em>
                    </MenuItem>
                    {accountHeadOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Site"
                  value={formData.site}
                  onChange={handleChange('site')}
                  placeholder="Enter site location"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Utility Type</InputLabel>
                  <Select
                    value={formData.utilityType}
                    onChange={handleChange('utilityType')}
                    label="Utility Type"
                  >
                    {utilityTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Provider"
                  value={formData.provider}
                  onChange={handleChange('provider')}
                  required
                  placeholder="e.g., K-Electric"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Reference No"
                  value={formData.accountNumber}
                  onChange={handleChange('accountNumber')}
                  placeholder="Optional reference number"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Location"
                  value={formData.location}
                  onChange={handleChange('location')}
                  placeholder="e.g., Main Office"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={masterDataLoading}>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={formData.department}
                    onChange={handleChange('department')}
                    label="Department"
                  >
                    <MenuItem value="">
                      <em>Select department</em>
                    </MenuItem>
                    {formData.department && !departments.some((department) => department.name === formData.department) && (
                      <MenuItem value={formData.department}>
                        {formData.department}
                      </MenuItem>
                    )}
                    {departments.map((department) => (
                      <MenuItem key={department._id} value={department.name}>
                        {department.code ? `${department.name} (${department.code})` : department.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={masterDataLoading}>
                  <InputLabel>Custodian</InputLabel>
                  <Select
                    value={formData.custodian}
                    onChange={handleChange('custodian')}
                    label="Custodian"
                  >
                    <MenuItem value="">
                      <em>Select custodian</em>
                    </MenuItem>
                    {formData.custodian && !employees.some((employee) => getEmployeeOptionValue(employee) === formData.custodian) && (
                      <MenuItem value={formData.custodian}>
                        {formData.custodian}
                      </MenuItem>
                    )}
                    {employees.map((employee) => {
                      const optionValue = getEmployeeOptionValue(employee);
                      return (
                        <MenuItem key={employee._id} value={optionValue}>
                          {optionValue}
                          {employee.placementDepartment?.name ? ` - ${employee.placementDepartment.name}` : ''}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>

              {/* Date Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Date Information
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Bill Date"
                  type="date"
                  value={formData.billDate}
                  onChange={handleChange('billDate')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Due Date"
                  type="date"
                  value={formData.dueDate}
                  onChange={handleChange('dueDate')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              {/* Amount Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Amount Information
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={formData.amount}
                  onChange={handleChange('amount')}
                  required
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Last Month Amount"
                  type="number"
                  value={formData.lastMonthAmount}
                  onChange={handleChange('lastMonthAmount')}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              {/* Additional Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Additional Information
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="For What"
                  value={formData.forWhat}
                  onChange={handleChange('forWhat')}
                  multiline
                  rows={3}
                  placeholder="Explain what this utility bill is for..."
                />
              </Grid>

              {/* Image Upload Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Bill Image
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="bill-image-upload"
                    type="file"
                    onChange={handleImageChange}
                  />
                  <label htmlFor="bill-image-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<CloudUploadIcon />}
                      size="small"
                    >
                      Upload Image
                    </Button>
                  </label>
                  {imagePreview && (
                    <IconButton
                      onClick={handleRemoveImage}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>

                {imagePreview && (
                  <Box sx={{ mt: 2 }}>
                    <Avatar
                      src={imagePreview}
                      alt="Bill Preview"
                      sx={{
                        width: 200,
                        height: 200,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                      onError={(e) => handleImageError(e)}
                    />
                  </Box>
                )}
              </Grid>

              {/* Approval Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Approvals
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Choose Manager and Head Of Department approvers before submitting. You can also save as draft.
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Sig of Requester"
                  value={userDisplayName(user)}
                  InputProps={{ readOnly: true }}
                  helperText="Auto-filled from logged-in user"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={approverOptions.filter((option) => getUserId(option) !== getUserId(user))}
                  value={managerApprover}
                  loading={approverLoading}
                  onChange={(_, value) => setManagerApprover(value)}
                  onInputChange={(_, value) => loadApproverOptions(value)}
                  getOptionLabel={(option) => userDisplayName(option)}
                  isOptionEqualToValue={(option, value) => option._id === value._id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Manager Approver"
                      placeholder="Search manager approver"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={approverOptions.filter((option) => getUserId(option) !== getUserId(user))}
                  value={hodApprover}
                  loading={approverLoading}
                  onChange={(_, value) => setHodApprover(value)}
                  onInputChange={(_, value) => loadApproverOptions(value)}
                  getOptionLabel={(option) => userDisplayName(option)}
                  isOptionEqualToValue={(option, value) => option._id === value._id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Head Of Department Approver"
                      placeholder="Search HOD approver"
                    />
                  )}
                />
              </Grid>

              {/* Submit Button */}
              <Grid item xs={12}>
                <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/admin/utility-bills')}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button
                    type="button"
                    variant="contained"
                    color="success"
                    startIcon={<SendIcon />}
                    disabled={loading}
                    onClick={() => saveBill('submit')}
                  >
                    Submit for Approval
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UtilityBillForm;