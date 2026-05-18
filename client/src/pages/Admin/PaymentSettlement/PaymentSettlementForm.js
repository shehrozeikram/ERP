import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Autocomplete,
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
  Chip,
  Stack,
  Alert
} from '@mui/material';
import { Save, Cancel, AttachFile, Delete, CloudUpload, RestartAlt } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import paymentSettlementService from '../../../services/paymentSettlementService';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import {
  approverSearchOnInputChange,
  mergeApproverOptionList,
  optionsForManagerApprover,
  optionsForHodApprover
} from '../../../utils/dualApproverAutocomplete';
import {
  AuditReturnFeedbackSection,
  ResendToPreAuditDialog,
  useAdminWorkflowAuditReturn,
  isWorkflowAuditBlockingEditStatus
} from '../../../components/Admin/workflowAuditReturn';

const settlementObservationKey = (obs) => {
  if (!obs) return '';
  return String(obs._id || obs.id || '');
};

const PaymentSettlementForm = ({ 
  settlement = null, 
  settlementId = null,
  onSave, 
  onCancel, 
  isEdit = false 
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [currentSettlement, setCurrentSettlement] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [dateValue, setDateValue] = useState(null);
  const [managerApprover, setManagerApprover] = useState(null);
  const [hodApprover, setHodApprover] = useState(null);
  const [approverOptions, setApproverOptions] = useState([]);
  const [approverLoading, setApproverLoading] = useState(false);
  
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

  const getUserId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return String(value._id || value.id || value.userId || '');
  };
  const userDisplayName = (u) => {
    if (!u) return '';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.employeeId || '';
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    try {
      return format(new Date(value), 'dd/MM/yyyy HH:mm');
    } catch {
      return '';
    }
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

  const settlementDoc = isEdit ? (settlement || currentSettlement) : null;

  const computeAuditUi = useCallback((s) => ({
    auditBlocksEdit:
      s?.approvalStatus === 'Approved' &&
      isWorkflowAuditBlockingEditStatus(s?.workflowStatus),
    canResendToPreAudit:
      s?.workflowStatus === 'Returned from Audit' &&
      s?.approvalStatus === 'Approved'
  }), []);

  const resendPaymentSettlementToAudit = useCallback(
    async (payload) => {
      const id = settlementId || settlement?._id || currentSettlement?._id;
      const note = String(payload.resubmitComments || '').trim();
      const res = await paymentSettlementService.updateWorkflowStatus(id, {
        workflowStatus: 'Send to Audit',
        observationAnswers: payload.observationAnswers,
        comments: note ? `Resent to Pre-Audit: ${note}` : 'Resent to Pre-Audit after corrections'
      });
      return res?.data ?? res;
    },
    [settlementId, settlement?._id, currentSettlement?._id]
  );

  const workflowAudit = useAdminWorkflowAuditReturn({
    document: settlementDoc,
    computeAuditUi,
    getObservationKey: settlementObservationKey,
    onResend: resendPaymentSettlementToAudit,
    onDocumentUpdate: (updated) => {
      const doc = updated?.data ?? updated;
      if (doc) setCurrentSettlement(doc);
    },
    onError: (message) => toast.error(message),
    onSuccess: (message) => toast.success(message)
  });

  const lockFields = Boolean(isEdit && workflowAudit.auditBlocksEdit);

  // Fetch settlement data when settlementId is provided
  useEffect(() => {
    const fetchSettlement = async () => {
      if (settlementId && isEdit) {
        try {
          setLoading(true);
          const response = await paymentSettlementService.getPaymentSettlement(settlementId);
          const payload = response?.data !== undefined ? response.data : response;
          setCurrentSettlement(payload?.data ?? payload);
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
      const draftApprovers = settlementData.draftApproverIds || [];
      const chainApprovers = (settlementData.approvalChain || []).map((step) => step.approver).filter(Boolean);
      const approvers = draftApprovers.length ? draftApprovers : chainApprovers;
      setManagerApprover(approvers[0] && typeof approvers[0] === 'object' ? approvers[0] : null);
      setHodApprover(approvers[1] && typeof approvers[1] === 'object' ? approvers[1] : null);
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
      setManagerApprover(null);
      setHodApprover(null);
    }
  }, [settlement, currentSettlement, isEdit]);

  const loadApproverOptions = async (search = '') => {
    try {
      setApproverLoading(true);
      const response = await paymentSettlementService.getApproverCandidates({ search, limit: 50 });
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
    handleSave('draft');
  };

  const handleSave = async (mode = 'draft') => {
    if (mode === 'submit' && (!managerApprover?._id || !hodApprover?._id)) {
      toast.error('Please select Manager Approver and Head Of Department Approver before submitting.');
      return;
    }
    const managerApproverId = getUserId(managerApprover);
    const hodApproverId = getUserId(hodApprover);
    const requesterId = getUserId(user);
    if (mode === 'submit' && [managerApproverId, hodApproverId].includes(requesterId)) {
      toast.error('Requester cannot be selected as Manager or Head Of Department approver.');
      return;
    }
    if (mode === 'submit' && managerApproverId === hodApproverId) {
      toast.error('Manager Approver and Head Of Department Approver must be different.');
      return;
    }
    
    // Prevent multiple submissions
    if (loading) {
      return;
    }

    if (lockFields) {
      toast.error('This settlement is with audit and cannot be edited until it is returned for correction.');
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
      const approverIds = [managerApproverId, hodApproverId].filter(Boolean);
      const payloadData = {
        ...formData,
        draftApproverIds: JSON.stringify(approverIds)
      };
      
      if (isEdit) {
        const id = settlement?._id || settlementId;
        const saved = await paymentSettlementService.updatePaymentSettlement(id, payloadData, newAttachments);
        if (mode === 'submit') {
          await paymentSettlementService.submitPaymentSettlement(id, { approverIds });
          toast.success('Payment settlement submitted for approval');
          onSave && onSave(saved?.data);
          return;
        }
        toast.success('Payment settlement updated successfully');
        onSave && onSave(saved?.data);
      } else {
        const saved = await paymentSettlementService.createPaymentSettlement(payloadData, newAttachments);
        if (mode === 'submit') {
          await paymentSettlementService.submitPaymentSettlement(saved?.data?._id, { approverIds });
          toast.success('Payment settlement submitted for approval');
          onSave && onSave(saved?.data);
          return;
        }
        toast.success('Payment settlement created successfully');
        onSave && onSave(saved?.data);
      }
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

        {settlementDoc && (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
              <Chip label={`Approval: ${settlementDoc.approvalStatus || '—'}`} color="primary" variant="outlined" size="small" />
              {settlementDoc.workflowStatus ? (
                <Chip label={`Workflow: ${settlementDoc.workflowStatus}`} size="small" variant="outlined" />
              ) : null}
              {workflowAudit.canResendToPreAudit && (
                <Button variant="contained" color="warning" size="small" startIcon={<RestartAlt />} onClick={workflowAudit.openResendDialog}>
                  Resend to Pre-Audit
                </Button>
              )}
            </Stack>
            <AuditReturnFeedbackSection
              auditStatus={settlementDoc.workflowStatus}
              returnedAuditStatus="Returned from Audit"
              latestReturnHistory={workflowAudit.latestReturnHistory}
              observations={workflowAudit.observations}
              getObservationKey={settlementObservationKey}
              formatDateTime={formatDateTime}
              userDisplayName={userDisplayName}
              returnedIntro={(
                <>
                  This settlement was returned for correction. Review the points below, use <strong>Update Draft</strong>{' '}
                  to apply changes, then use <strong>Resend to Pre-Audit</strong> when you are ready.
                </>
              )}
            />
            {lockFields && (
              <Alert severity="info" sx={{ mb: 2 }}>
                This settlement is with audit and cannot be edited until it is returned for correction.
              </Alert>
            )}
          </>
        )}

        <form onSubmit={handleSubmit}>
        <Box sx={lockFields ? { pointerEvents: 'none', opacity: 0.72 } : undefined}>
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

          {/* Approval Authority Section */}
          <Typography variant="h6" gutterBottom sx={{ mb: 2, color: 'text.secondary' }}>
            Approval Authority
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manager and Head Of Department approvers: User Management department Administration only (code ADMIN).
          </Typography>
          <Grid container spacing={3} sx={{ mb: 1 }}>
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
                options={managerApproverSelectOptions}
                value={managerApprover}
                loading={approverLoading}
                onChange={(_, value) => setManagerApprover(value)}
                onOpen={() => loadApproverOptions('')}
                onInputChange={approverSearchOnInputChange(loadApproverOptions)}
                getOptionLabel={(option) => userDisplayName(option)}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                renderInput={(params) => <TextField {...params} label="Manager Approver" placeholder="Search manager approver" />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                options={hodApproverSelectOptions}
                value={hodApprover}
                loading={approverLoading}
                onChange={(_, value) => setHodApprover(value)}
                onOpen={() => loadApproverOptions('')}
                onInputChange={approverSearchOnInputChange(loadApproverOptions)}
                getOptionLabel={(option) => userDisplayName(option)}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                renderInput={(params) => <TextField {...params} label="Head Of Department Approver" placeholder="Search HOD approver" />}
              />
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
                Upload Documents (Multiple Files)
              </Button>
            </label>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
              You can select multiple files at once. Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF, TXT (Max 10MB each)
            </Typography>
            {attachments.length > 0 && (
              <Typography variant="caption" display="block" color="primary.main" sx={{ fontWeight: 'bold' }}>
                {attachments.length} file(s) attached
              </Typography>
            )}
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

        </Box>

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
              disabled={loading || lockFields}
            >
              {loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Draft' : 'Create Draft')}
            </Button>
            <Button
              type="button"
              variant="contained"
              color="success"
              startIcon={loading ? <CircularProgress size={20} /> : <Save />}
              disabled={loading || lockFields}
              onClick={() => handleSave('submit')}
            >
              Submit for Approval
            </Button>
          </Box>
        </form>
      </Paper>

      <ResendToPreAuditDialog
        open={workflowAudit.resendDialogOpen}
        onClose={workflowAudit.closeResendDialog}
        submitting={workflowAudit.resendSubmitting}
        observations={workflowAudit.observations}
        getObservationKey={settlementObservationKey}
        resendComments={workflowAudit.resendComments}
        onResendCommentsChange={workflowAudit.setResendComments}
        resendAnswers={workflowAudit.resendAnswers}
        onResendAnswerChange={(key, value) =>
          workflowAudit.setResendAnswers((prev) => ({ ...prev, [key]: value }))}
        onSubmit={workflowAudit.handleResendToAudit}
        intro={(
          <>
            Save any changes with <strong>Update Draft</strong> before confirming. Add replies for each open observation,
            then send the settlement back to the audit queue.
          </>
        )}
      />
    </Box>
  );
};

export default PaymentSettlementForm;
