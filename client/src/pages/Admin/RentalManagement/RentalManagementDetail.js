import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  Stack,
  Alert,
  CircularProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Business as BusinessIcon,
  AccountBalance as AccountBalanceIcon,
  Payment as PaymentIcon,
  Assignment as AssignmentIcon,
  AttachMoney as AttachMoneyIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const RentalManagementDetail = ({ 
  open = false, 
  onClose, 
  recordId, 
  onEdit 
}) => {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageViewer, setImageViewer] = useState({
    open: false,
    imageUrl: '',
    imageName: '',
    isBlob: false
  });

  const fetchRecord = useCallback(async () => {
    if (!recordId) return;
    
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/rental-management/${recordId}`);
      setRecord(response.data);
    } catch (error) {
      console.error('Error fetching record:', error);
      setError('Failed to fetch rental management record details');
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    if (open && recordId) {
    fetchRecord();
    }
  }, [open, recordId, fetchRecord]);

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

  const formatPKR = (amount) => {
    return `PKR ${amount || '0'}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    // Handle different date formats
    if (dateString.includes('/')) {
      return dateString; // Already formatted
    }
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  const handleAttachmentClick = async (attachment) => {
    const isImage = attachment.mimeType.startsWith('image/');
    const isPdf = attachment.mimeType === 'application/pdf';
    
    if (isImage) {
      // For images, we'll show them in a simple way for now
      setImageViewer({
        open: true,
        imageUrl: attachment.filePath,
        imageName: attachment.originalName,
        isBlob: false
      });
    } else if (isPdf) {
      // Open PDF in new tab
      window.open(attachment.filePath, '_blank');
    } else {
      // Download for other file types
      const link = document.createElement('a');
      link.href = attachment.filePath;
      link.download = attachment.originalName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Get the current date and time for the print header
    const printDate = new Date().toLocaleString();
    
    // Create the print content HTML with comprehensive styling
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rental Management Record - ${record?.voucherNumber || 'N/A'}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              margin: 15px;
              color: #000;
              line-height: 1.5;
              font-size: 14px;
            }
            .header {
              text-align: center;
              border: 3px solid #000;
              padding: 20px;
              margin-bottom: 25px;
              background-color: #f9f9f9;
            }
            .header h1 {
              margin: 0 0 10px 0;
              color: #000;
              font-size: 24px;
              font-weight: bold;
            }
            .header .subtitle {
              color: #333;
              font-size: 16px;
              margin-bottom: 8px;
              font-weight: bold;
            }
            .print-date {
              color: #666;
              font-size: 12px;
            }
            .section {
              margin-bottom: 25px;
              page-break-inside: avoid;
              border: 1px solid #ccc;
              padding: 15px;
            }
            .section-title {
              background-color: #e0e0e0;
              padding: 10px 15px;
              margin: -15px -15px 15px -15px;
              border-bottom: 2px solid #000;
              font-weight: bold;
              font-size: 16px;
              color: #000;
              text-transform: uppercase;
            }
            .field-row {
              display: flex;
              margin-bottom: 8px;
              border-bottom: 1px dotted #999;
              padding-bottom: 5px;
              min-height: 20px;
            }
            .field-label {
              font-weight: bold;
              min-width: 180px;
              color: #000;
              font-size: 13px;
            }
            .field-value {
              flex: 1;
              color: #000;
              font-size: 13px;
              word-wrap: break-word;
            }
            .status-chip {
              display: inline-block;
              padding: 3px 8px;
              border: 1px solid #000;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              background-color: #f0f0f0;
            }
            .status-draft { background-color: #e0e0e0; }
            .status-submitted { background-color: #e3f2fd; }
            .status-approved { background-color: #e8f5e8; }
            .status-paid { background-color: #e8f5e8; }
            .status-rejected { background-color: #ffebee; }
            .amount-highlight {
              font-size: 20px;
              font-weight: bold;
              color: #000;
              text-align: center;
              background-color: #f0f0f0;
              padding: 12px;
              border: 2px solid #000;
              margin: 10px 0;
            }
            .authorization-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              margin-top: 10px;
            }
            .auth-box {
              text-align: center;
              padding: 12px;
              border: 2px solid #000;
              background-color: #f9f9f9;
            }
            .auth-box .name {
              font-weight: bold;
              font-size: 14px;
              margin-bottom: 3px;
              color: #000;
            }
            .auth-box .designation {
              color: #333;
              font-size: 12px;
            }
            .attachments-list {
              margin-top: 10px;
            }
            .attachment-item {
              padding: 6px 0;
              border-bottom: 1px solid #ddd;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 13px;
            }
            .attachment-item:last-child {
              border-bottom: none;
            }
            .attachment-name {
              font-weight: 500;
              color: #000;
            }
            .attachment-size {
              color: #666;
              font-size: 11px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 2px solid #000;
              text-align: center;
              color: #333;
              font-size: 11px;
            }
            .important-info {
              background-color: #fff3cd;
              border: 1px solid #ffeaa7;
              padding: 10px;
              margin: 10px 0;
              font-weight: bold;
            }
            .record-id {
              font-family: monospace;
              background-color: #f8f9fa;
              padding: 2px 5px;
              border: 1px solid #ccc;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>RENTAL MANAGEMENT RECORD</h1>
            <div class="subtitle">Voucher Number: ${record?.voucherNumber || 'N/A'}</div>
            <div class="print-date">Printed on: ${printDate}</div>
          </div>

          <!-- Record Summary -->
          <div class="section">
            <div class="section-title">📋 Record Summary</div>
            <div class="field-row">
              <div class="field-label">Record ID:</div>
              <div class="field-value"><span class="record-id">${record?._id || 'N/A'}</span></div>
            </div>
            <div class="field-row">
              <div class="field-label">Status:</div>
              <div class="field-value">
                <span class="status-chip status-${record?.status?.toLowerCase() || 'draft'}">${record?.status || 'N/A'}</span>
              </div>
            </div>
            <div class="field-row">
              <div class="field-label">Payment Type:</div>
              <div class="field-value">${record?.paymentType || 'N/A'}</div>
            </div>
            <div class="amount-highlight">
              💰 Grand Total: ${formatPKR(record?.grandTotal || '0')}
            </div>
            <div class="field-row">
              <div class="field-label">Amount:</div>
              <div class="field-value">${formatPKR(record?.amount || '0')}</div>
            </div>
          </div>

          <!-- Company Details -->
          <div class="section">
            <div class="section-title">🏢 Company Details</div>
            <div class="field-row">
              <div class="field-label">Tenant:</div>
              <div class="field-value">${record?.parentCompanyName || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Purpose:</div>
              <div class="field-value">${record?.subsidiaryName || 'N/A'}</div>
            </div>
          </div>

          <!-- Payment Details -->
          <div class="section">
            <div class="section-title">💳 Payment Details</div>
            <div class="field-row">
              <div class="field-label">Voucher Number:</div>
              <div class="field-value">${record?.voucherNumber || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Payment Date:</div>
              <div class="field-value">${formatDate(record?.date || '')}</div>
            </div>
            <div class="field-row">
              <div class="field-label">To Whom Paid:</div>
              <div class="field-value">${record?.toWhomPaid || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Purpose (For What):</div>
              <div class="field-value">${record?.forWhat || 'N/A'}</div>
            </div>
            ${record?.site ? `
            <div class="field-row">
              <div class="field-label">Site Location:</div>
              <div class="field-value">${record.site}</div>
            </div>
            ` : ''}
            ${record?.fromDepartment ? `
            <div class="field-row">
              <div class="field-label">From Department:</div>
              <div class="field-value">${record.fromDepartment}</div>
            </div>
            ` : ''}
            ${record?.custodian ? `
            <div class="field-row">
              <div class="field-label">Custodian:</div>
              <div class="field-value">${record.custodian}</div>
            </div>
            ` : ''}
          </div>

          <!-- Authorization Details -->
          <div class="section">
            <div class="section-title">✅ Authorization Details</div>
            <div class="authorization-grid">
              <div class="auth-box">
                <div class="name">${record?.preparedBy || 'N/A'}</div>
                <div class="designation">${record?.preparedByDesignation || 'Not specified'}</div>
              </div>
              <div class="auth-box">
                <div class="name">${record?.verifiedBy || 'N/A'}</div>
                <div class="designation">${record?.verifiedByDesignation || 'Not specified'}</div>
              </div>
              <div class="auth-box">
                <div class="name">${record?.approvedBy || 'N/A'}</div>
                <div class="designation">${record?.approvedByDesignation || 'Not specified'}</div>
              </div>
            </div>
          </div>

          <!-- Document Attachments -->
          ${record?.attachments && record.attachments.length > 0 ? `
          <div class="section">
            <div class="section-title">📎 Document Attachments (${record.attachments.length} files)</div>
            <div class="attachments-list">
              ${record.attachments.map((attachment, index) => `
                <div class="attachment-item">
                  <div class="attachment-name">${index + 1}. ${attachment.originalName}</div>
                  <div class="attachment-size">${Math.round(attachment.fileSize / 1024)} KB</div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : `
          <div class="section">
            <div class="section-title">📎 Document Attachments</div>
            <div class="field-row">
              <div class="field-label">Attachments:</div>
              <div class="field-value">No documents attached</div>
            </div>
          </div>
          `}

          <!-- System Information -->
          <div class="section">
            <div class="section-title">ℹ️ System Information</div>
            <div class="field-row">
              <div class="field-label">Created By:</div>
              <div class="field-value">${record?.createdBy?.firstName || ''} ${record?.createdBy?.lastName || ''} ${record?.createdBy?.role ? `(${record.createdBy.role})` : ''}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Created Date:</div>
              <div class="field-value">${record?.createdAt ? format(new Date(record.createdAt), 'dd/MM/yyyy HH:mm:ss') : 'N/A'}</div>
            </div>
            ${record?.updatedBy ? `
            <div class="field-row">
              <div class="field-label">Last Updated By:</div>
              <div class="field-value">${record.updatedBy.firstName || ''} ${record.updatedBy.lastName || ''} ${record.updatedBy.role ? `(${record.updatedBy.role})` : ''}</div>
            </div>
            ` : ''}
            <div class="field-row">
              <div class="field-label">Last Updated:</div>
              <div class="field-value">${record?.updatedAt ? format(new Date(record.updatedAt), 'dd/MM/yyyy HH:mm:ss') : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Record Version:</div>
              <div class="field-value">${record?.__v || '0'}</div>
            </div>
          </div>

          <!-- Additional Information -->
          <div class="section">
            <div class="section-title">📝 Additional Information</div>
            <div class="important-info">
              This document contains all available information for Rental Management Record ${record?.voucherNumber || record?._id || 'N/A'}
            </div>
            <div class="field-row">
              <div class="field-label">Total Fields:</div>
              <div class="field-value">${Object.keys(record || {}).length} data fields</div>
            </div>
            <div class="field-row">
              <div class="field-label">Document Status:</div>
              <div class="field-value">Complete - All available data included</div>
            </div>
          </div>

          <div class="footer">
            <p><strong>Generated from SGC ERP System - Rental Management Module</strong></p>
            <p>Record ID: <span class="record-id">${record?._id || 'N/A'}</span> | Printed: ${printDate}</p>
            <p>This is a complete record printout containing all available information</p>
          </div>
        </body>
      </html>
    `;

    // Write the content to the new window
    printWindow.document.write(printContent);
    printWindow.document.close();

    // Wait for content to load, then trigger print
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          pb: 2, 
          borderBottom: '1px solid', 
          borderColor: 'divider',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
              <PaymentIcon />
            </Avatar>
    <Box>
              <Typography variant="h5" fontWeight="bold">
          Rental Management Details
        </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {record?.voucherNumber || 'Record Details'}
              </Typography>
            </Box>
            <IconButton
              onClick={onClose}
              sx={{ 
                ml: 'auto', 
                color: 'white',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : !record ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="warning">Rental management record not found</Alert>
            </Box>
          ) : (
            <Box sx={{ p: 3 }}>
              {/* Header with Status and Amount */}
              <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
                <CardContent>
                  <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={6}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                  <Chip
                    label={record.status}
                    color={getStatusColor(record.status)}
                          size="medium"
                          icon={<CheckCircleIcon />}
                        />
                        <Chip
                          label={record.paymentType}
                          color={
                            record.paymentType === 'Payable' ? 'primary' :
                            record.paymentType === 'Reimbursement' ? 'secondary' :
                            record.paymentType === 'Advance' ? 'success' : 'default'
                          }
                          size="medium"
                          variant="outlined"
                        />
                      </Stack>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <AttachMoneyIcon color="primary" />
                        <Box>
                          <Typography variant="h4" fontWeight="bold" color="primary">
                            {formatPKR(record.grandTotal)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Grand Total
                          </Typography>
                        </Box>
                      </Stack>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Company Details Section */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <BusinessIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="bold">
                      Company Details
                    </Typography>
                  </Stack>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <BusinessIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" color="text.secondary">
                            Tenant
                          </Typography>
                        </Stack>
                        <Typography variant="body1" fontWeight="medium">
                          {record.parentCompanyName}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <AccountBalanceIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" color="text.secondary">
                            Purpose
                          </Typography>
                        </Stack>
                        <Typography variant="body1" fontWeight="medium">
                          {record.subsidiaryName}
                        </Typography>
                      </Box>
                    </Grid>
                </Grid>
                </CardContent>
              </Card>

              {/* Payment Details Section */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <Avatar sx={{ bgcolor: 'success.main' }}>
                      <PaymentIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="bold">
                      Payment Details
                    </Typography>
                  </Stack>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <AssignmentIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" color="text.secondary">
                            Voucher Number
                          </Typography>
                        </Stack>
                        <Typography variant="body1" fontWeight="medium">
                          {record.voucherNumber || 'N/A'}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <AttachMoneyIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Amount
                  </Typography>
                        </Stack>
                        <Typography variant="body1" fontWeight="medium" color="primary">
                    {formatPKR(record.amount)}
                  </Typography>
                      </Box>
                </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <ScheduleIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" color="text.secondary">
                            Date
                  </Typography>
                        </Stack>
                        <Typography variant="body1" fontWeight="medium">
                          {formatDate(record.date)}
                  </Typography>
                      </Box>
                </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <PersonIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" color="text.secondary">
                            To Whom Paid
                  </Typography>
                        </Stack>
                        <Typography variant="body1" fontWeight="medium">
                          {record.toWhomPaid || 'N/A'}
                  </Typography>
                      </Box>
                </Grid>
                  <Grid item xs={12}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                          <AssignmentIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" color="text.secondary">
                            For What
                    </Typography>
                        </Stack>
                        <Typography variant="body1" fontWeight="medium">
                          {record.forWhat || 'N/A'}
                    </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Authorization Details Section */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <Avatar sx={{ bgcolor: 'warning.main' }}>
                      <PersonIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="bold">
                      Authorization Details
                    </Typography>
                  </Stack>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                        <PersonIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                          Prepared By
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {record.preparedBy || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {record.preparedByDesignation || ''}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                        <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                          Verified By
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {record.verifiedBy || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {record.verifiedByDesignation || ''}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                        <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                          Approved By
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {record.approvedBy || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {record.approvedByDesignation || ''}
                    </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Additional Details Section */}
              {(record.site || record.fromDepartment || record.custodian) && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                      <Avatar sx={{ bgcolor: 'info.main' }}>
                        <AssignmentIcon />
                      </Avatar>
                      <Typography variant="h6" fontWeight="bold">
                        Additional Details
                      </Typography>
                    </Stack>
                    <Grid container spacing={3}>
                      {record.site && (
                        <Grid item xs={12} md={4}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                              Site
                    </Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {record.site}
                    </Typography>
                          </Box>
                  </Grid>
                )}
                      {record.fromDepartment && (
                        <Grid item xs={12} md={4}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                              From Department
                    </Typography>
                            <Typography variant="body1" fontWeight="medium">
                              {record.fromDepartment}
                    </Typography>
                          </Box>
                  </Grid>
                )}
                {record.custodian && (
                        <Grid item xs={12} md={4}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Custodian
                    </Typography>
                            <Typography variant="body1" fontWeight="medium">
                      {record.custodian}
                    </Typography>
                          </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
              )}

              {/* Document Attachments Section */}
              {record.attachments && record.attachments.length > 0 && (
                <Card sx={{ mb: 3 }}>
            <CardContent>
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                      <Avatar sx={{ bgcolor: 'secondary.main' }}>
                        <AttachFileIcon />
                      </Avatar>
                      <Typography variant="h6" fontWeight="bold">
                        Document Attachments ({record.attachments.length})
              </Typography>
                    </Stack>
                    <Grid container spacing={2}>
                      {record.attachments.map((attachment, index) => {
                        const isImage = attachment.mimeType.startsWith('image/');
                        const isPdf = attachment.mimeType === 'application/pdf';
                        
                        return (
                          <Grid item xs={12} sm={6} md={4} key={attachment._id || index}>
                            <Box 
                              sx={{ 
                                p: 2, 
                                bgcolor: 'grey.50', 
                                borderRadius: 1, 
                                border: '1px solid', 
                                borderColor: 'grey.200',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                  bgcolor: 'grey.100',
                                  borderColor: 'primary.main',
                                  transform: 'translateY(-2px)',
                                  boxShadow: 2
                                }
                              }}
                              onClick={() => handleAttachmentClick(attachment)}
                            >
                              <Stack direction="row" alignItems="center" spacing={2}>
                                <Avatar sx={{ bgcolor: isImage ? 'success.main' : isPdf ? 'error.main' : 'primary.main' }}>
                                  {isImage ? <VisibilityIcon /> : isPdf ? <AttachFileIcon /> : <DownloadIcon />}
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body2" fontWeight="medium" noWrap>
                                    {attachment.originalName}
                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {Math.round(attachment.fileSize / 1024)} KB
                  </Typography>
                </Box>
                              </Stack>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </CardContent>
                </Card>
              )}

              {/* Created Information Section */}
              <Card>
            <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <Avatar sx={{ bgcolor: 'grey.600' }}>
                      <PersonIcon />
                    </Avatar>
                    <Typography variant="h6" fontWeight="bold">
                      Record Information
              </Typography>
                  </Stack>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Created By
              </Typography>
                        <Typography variant="body1" fontWeight="medium">
                {record.createdBy?.firstName} {record.createdBy?.lastName}
              </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Created Date
              </Typography>
                        <Typography variant="body1" fontWeight="medium">
                {format(new Date(record.createdAt), 'dd/MM/yyyy HH:mm')}
              </Typography>
                      </Box>
                    </Grid>
                    {record.updatedBy && (
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            Last Updated By
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {record.updatedBy?.firstName} {record.updatedBy?.lastName}
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    <Grid item xs={12} md={6}>
                      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Last Updated
              </Typography>
                        <Typography variant="body1" fontWeight="medium">
                {format(new Date(record.updatedAt), 'dd/MM/yyyy HH:mm')}
              </Typography>
                      </Box>
                    </Grid>
                  </Grid>
            </CardContent>
          </Card>
    </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
          {record && (
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ mr: 1 }}
            >
              Print
            </Button>
          )}
          {onEdit && record && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => onEdit(record)}
            >
              Edit Record
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog
        open={imageViewer.open}
        onClose={() => setImageViewer({ open: false, imageUrl: '', imageName: '', isBlob: false })}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h6">{imageViewer.imageName}</Typography>
            <IconButton
              onClick={() => setImageViewer({ open: false, imageUrl: '', imageName: '', isBlob: false })}
              sx={{ ml: 'auto' }}
            >
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box
            component="img"
            src={imageViewer.imageUrl}
            alt={imageViewer.imageName}
            sx={{
              width: '100%',
              height: 'auto',
              maxHeight: '70vh',
              objectFit: 'contain'
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RentalManagementDetail;
