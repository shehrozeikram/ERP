import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip
} from '@mui/material';
import { Save, Cancel, AttachFile, Delete, CloudUpload } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import paymentSettlementService from '../../../services/paymentSettlementService';
import toast from 'react-hot-toast';

const PaymentSettlementForm = ({ 
  settlement = null, 
  settlementId = null,
  onSave, 
  onCancel, 
  isEdit = false 
}) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [currentSettlement, setCurrentSettlement] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [dateValue, setDateValue] = useState(null);
  
  const [formData, setFormData] = useState({
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
    
    // Authorization Details
    preparedBy: '',
    preparedByDesignation: '',
    verifiedBy: '',
    verifiedByDesignation: '',
    approvedBy: '',
    approvedByDesignation: '',
    
    // Status
    status: 'Draft'
  });

  const statusOptions = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Submitted', label: 'Submitted' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Paid', label: 'Paid' }
  ];

  // Fetch settlement data when settlementId is provided
  useEffect(() => {
    const fetchSettlement = async () => {
      if (settlementId && isEdit) {
        try {
          setLoading(true);
          const response = await paymentSettlementService.getPaymentSettlement(settlementId);
          setCurrentSettlement(response.data);
        } catch (error) {
          toast.error('Failed to fetch settlement data');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchSettlement();
  }, [settlementId, isEdit]);

  // Update form data when settlement data is available
  useEffect(() => {
    const settlementData = settlement || currentSettlement;
    if (settlementData && isEdit) {
      setFormData({
        parentCompanyName: settlementData.parentCompanyName || '',
        subsidiaryName: settlementData.subsidiaryName || '',
        site: settlementData.site || '',
        paymentType: settlementData.paymentType || '',
        fromDepartment: settlementData.fromDepartment || '',
        custodian: settlementData.custodian || '',
        date: settlementData.date || '',
        referenceNumber: settlementData.referenceNumber || '',
        toWhomPaid: settlementData.toWhomPaid || '',
        forWhat: settlementData.forWhat || '',
        amount: settlementData.amount || '',
        grandTotal: settlementData.grandTotal || '',
        preparedBy: settlementData.preparedBy || '',
        preparedByDesignation: settlementData.preparedByDesignation || '',
        verifiedBy: settlementData.verifiedBy || '',
        verifiedByDesignation: settlementData.verifiedByDesignation || '',
        approvedBy: settlementData.approvedBy || '',
        approvedByDesignation: settlementData.approvedByDesignation || '',
        status: settlementData.status || 'Draft'
      });
      
      // Convert date string to Date object for DatePicker
      if (settlementData.date) {
        try {
          const dateObj = new Date(settlementData.date);
          if (!isNaN(dateObj.getTime())) {
            setDateValue(dateObj);
          } else {
            setDateValue(null);
          }
        } catch (error) {
          setDateValue(null);
        }
      } else {
        setDateValue(null);
      }
      
      // Set existing attachments
      if (settlementData.attachments && settlementData.attachments.length > 0) {
        setAttachments(settlementData.attachments);
      }
    } else if (!isEdit) {
      // Reset form and date when creating new record
      setFormData({
        parentCompanyName: '',
        subsidiaryName: '',
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
        preparedBy: '',
        preparedByDesignation: '',
        verifiedBy: '',
        verifiedByDesignation: '',
        approvedBy: '',
        approvedByDesignation: '',
        status: 'Draft'
      });
      setDateValue(null);
      setAttachments([]);
    }
  }, [settlement, currentSettlement, isEdit]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleDateChange = (newValue) => {
    setDateValue(newValue);
    // Format date as YYYY-MM-DD for form submission
    if (newValue) {
      const formattedDate = format(newValue, 'yyyy-MM-dd');
      setFormData(prev => ({
        ...prev,
        date: formattedDate
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        date: ''
      }));
    }
    
    // Clear error when user selects a date
    if (errors.date) {
      setErrors(prev => ({
        ...prev,
        date: ''
      }));
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/gif',
        'text/plain'
      ];
      
      if (file.size > maxSize) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      
      if (!allowedTypes.includes(file.type)) {
        toast.error(`File ${file.name} has an invalid type. Only PDF, DOC, DOCX, JPG, PNG, GIF, and TXT files are allowed.`);
        return false;
      }
      
      return true;
    });
    
    setAttachments(prev => [...prev, ...validFiles]);
    e.target.value = ''; // Clear the input
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = async (attachmentId) => {
    try {
      await paymentSettlementService.deleteAttachment(settlementId || settlement?._id, attachmentId);
      setAttachments(prev => prev.filter(att => att._id !== attachmentId));
      toast.success('Attachment deleted successfully');
    } catch (error) {
      toast.error('Failed to delete attachment');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields validation
    if (!formData.parentCompanyName.trim()) {
      newErrors.parentCompanyName = 'Parent company name is required';
    }
    if (!formData.subsidiaryName.trim()) {
      newErrors.subsidiaryName = 'Subsidiary name is required';
    }
    if (!formData.date.trim()) {
      newErrors.date = 'Date is required';
    }
    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required';
    }
    if (!formData.grandTotal.trim()) {
      newErrors.grandTotal = 'Grand total is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (loading) {
      return;
    }
    
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }
    
    setLoading(true);
    try {
      // Filter out existing attachments (those with _id) and get only new files
      const newAttachments = attachments.filter(att => !att._id);
      
      if (isEdit) {
        const id = settlement?._id || settlementId;
        await paymentSettlementService.updatePaymentSettlement(id, formData, newAttachments);
        toast.success('Payment settlement updated successfully');
      } else {
        await paymentSettlementService.createPaymentSettlement(formData, newAttachments);
        toast.success('Payment settlement created successfully');
      }
      
      onSave && onSave();
    } catch (error) {
      if (error.response?.data?.errors) {
        const serverErrors = {};
        error.response.data.errors.forEach(err => {
          serverErrors[err.field] = err.message;
        });
        setErrors(serverErrors);
      }
      
      toast.error(error.response?.data?.message || 'Failed to save payment settlement');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while fetching settlement data
  if (loading && isEdit && settlementId) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading settlement data...
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3, color: 'primary.main' }}>
          {isEdit ? 'Edit Payment Settlement' : 'Create Payment Settlement'}
        </Typography>

        <form onSubmit={handleSubmit}>
          {/* Company Details Section */}
          <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2, color: 'text.secondary' }}>
            Company Details
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Parent Company Name"
                name="parentCompanyName"
                value={formData.parentCompanyName}
                onChange={handleInputChange}
                error={!!errors.parentCompanyName}
                helperText={errors.parentCompanyName}
                placeholder="e.g., Sardar Group of Companies"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Subsidiary Name"
                name="subsidiaryName"
                value={formData.subsidiaryName}
                onChange={handleInputChange}
                error={!!errors.subsidiaryName}
                helperText={errors.subsidiaryName}
                placeholder="e.g., Gun & Country Club"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Payment Details Section */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2, color: 'text.secondary' }}>
            Payment Details
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Site"
                name="site"
                value={formData.site}
                onChange={handleInputChange}
                error={!!errors.site}
                helperText={errors.site}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!errors.paymentType}>
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
              {errors.paymentType && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {errors.paymentType}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="From Department"
                name="fromDepartment"
                value={formData.fromDepartment}
                onChange={handleInputChange}
                error={!!errors.fromDepartment}
                helperText={errors.fromDepartment}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Custodian"
                name="custodian"
                value={formData.custodian}
                onChange={handleInputChange}
                error={!!errors.custodian}
                helperText={errors.custodian}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Date"
                  value={dateValue}
                  onChange={handleDateChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.date,
                      helperText: errors.date,
                      required: true
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Reference Number"
                name="referenceNumber"
                value={formData.referenceNumber}
                onChange={handleInputChange}
                error={!!errors.referenceNumber}
                helperText={errors.referenceNumber}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="To Whom Paid"
                name="toWhomPaid"
                value={formData.toWhomPaid}
                onChange={handleInputChange}
                error={!!errors.toWhomPaid}
                helperText={errors.toWhomPaid}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Amount"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                error={!!errors.amount}
                helperText={errors.amount}
                placeholder="e.g., 50000"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Grand Total"
                name="grandTotal"
                value={formData.grandTotal}
                onChange={handleInputChange}
                error={!!errors.grandTotal}
                helperText={errors.grandTotal}
                placeholder="e.g., 55000"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="For What"
                name="forWhat"
                value={formData.forWhat}
                onChange={handleInputChange}
                error={!!errors.forWhat}
                helperText={errors.forWhat}
                multiline
                rows={3}
                placeholder="Description of what the payment is for"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Authorization Details Section */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2, color: 'text.secondary' }}>
            Authorization Details
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Prepared By"
                name="preparedBy"
                value={formData.preparedBy}
                onChange={handleInputChange}
                error={!!errors.preparedBy}
                helperText={errors.preparedBy}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Prepared By Designation"
                name="preparedByDesignation"
                value={formData.preparedByDesignation}
                onChange={handleInputChange}
                error={!!errors.preparedByDesignation}
                helperText={errors.preparedByDesignation}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Verified By"
                name="verifiedBy"
                value={formData.verifiedBy}
                onChange={handleInputChange}
                error={!!errors.verifiedBy}
                helperText={errors.verifiedBy}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Verified By Designation"
                name="verifiedByDesignation"
                value={formData.verifiedByDesignation}
                onChange={handleInputChange}
                error={!!errors.verifiedByDesignation}
                helperText={errors.verifiedByDesignation}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Approved By"
                name="approvedBy"
                value={formData.approvedBy}
                onChange={handleInputChange}
                error={!!errors.approvedBy}
                helperText={errors.approvedBy}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Approved By Designation"
                name="approvedByDesignation"
                value={formData.approvedByDesignation}
                onChange={handleInputChange}
                error={!!errors.approvedByDesignation}
                helperText={errors.approvedByDesignation}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!errors.status}>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  label="Status"
                >
                  {statusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {errors.status && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {errors.status}
                </Typography>
              )}
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Document Attachments Section */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2, color: 'text.secondary' }}>
            Document Attachments (Optional)
          </Typography>
          
          {/* File Upload */}
          <Box sx={{ mb: 3 }}>
            <input
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"
              style={{ display: 'none' }}
              id="file-upload"
              multiple
              type="file"
              onChange={handleFileUpload}
            />
            <label htmlFor="file-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUpload />}
                sx={{ mb: 2 }}
              >
                Upload Documents
              </Button>
            </label>
            <Typography variant="caption" display="block" color="text.secondary">
              Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF, TXT (Max 10MB each)
            </Typography>
          </Box>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Attached Documents ({attachments.length})
                </Typography>
                <List>
                  {attachments.map((attachment, index) => (
                    <ListItem key={attachment._id || index} divider>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AttachFile color="primary" />
                            <Typography variant="body2">
                              {attachment.originalName || attachment.name}
                            </Typography>
                            <Chip
                              label={formatFileSize(attachment.fileSize || attachment.size)}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          attachment.uploadedAt ? 
                            `Uploaded: ${new Date(attachment.uploadedAt).toLocaleDateString()}` :
                            'New file'
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          color="error"
                          onClick={() => {
                            if (attachment._id) {
                              removeExistingAttachment(attachment._id);
                            } else {
                              removeAttachment(index);
                            }
                          }}
                        >
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <Save />}
              disabled={loading}
            >
              {loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update' : 'Create')}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default PaymentSettlementForm;
