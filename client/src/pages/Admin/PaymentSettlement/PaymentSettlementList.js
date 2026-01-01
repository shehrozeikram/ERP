import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tooltip,
  Stack,
  Avatar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Business as BusinessIcon,
  AccountBalance as AccountBalanceIcon,
  Payment as PaymentIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  AttachMoney as AttachMoneyIcon,
  AttachFile as AttachFileIcon,
  ArrowForward as ArrowForwardIcon,
  Close as CloseIcon,
  Print as PrintIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import paymentSettlementService from '../../../services/paymentSettlementService';
import toast from 'react-hot-toast';

const PaymentSettlementList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  
  // Filter state
  const [search, setSearch] = useState('');
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState('');
  const [parentCompanyFilter, setParentCompanyFilter] = useState('');
  const [subsidiaryFilter, setSubsidiaryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  
  // Workflow status dialog
  const [workflowStatusDialog, setWorkflowStatusDialog] = useState({ 
    open: false, 
    settlement: null,
    comments: ''
  });
  
  // Dialog state
  const [deleteDialog, setDeleteDialog] = useState({ open: false, settlement: null });
  const [viewDialog, setViewDialog] = useState({ open: false, settlement: null });
  const [imageViewer, setImageViewer] = useState({ open: false, imageUrl: '', imageName: '', isBlob: false });
  
  // Stats state
  const [stats, setStats] = useState(null);

  const workflowStatusOptions = [
    { value: '', label: 'All Workflow Statuses' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Active', label: 'Active' },
    { value: 'Send to AM Admin', label: 'Send to AM Admin' },
    { value: 'Send to HOD Admin', label: 'Send to HOD Admin' },
    { value: 'Send to Audit', label: 'Send to Audit' },
    { value: 'Send to Finance', label: 'Send to Finance' },
    { value: 'Send to CEO Office', label: 'Send to CEO Office' }
  ];

  const getWorkflowStatusColor = (workflowStatus) => {
    const colors = {
      'Draft': 'default',
      'Active': 'info',
      'Send to AM Admin': 'warning',
      'Send to HOD Admin': 'warning',
      'Send to Audit': 'info',
      'Send to Finance': 'primary',
      'Send to CEO Office': 'success'
    };
    return colors[workflowStatus] || 'default';
  };

  const loadSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        workflowStatus: workflowStatusFilter,
        parentCompanyName: parentCompanyFilter,
        subsidiaryName: subsidiaryFilter,
        fromDepartment: departmentFilter
      };
      
      const response = await paymentSettlementService.getPaymentSettlements(params);
      setSettlements(response.data.settlements);
      setTotalItems(response.data.pagination.totalItems);
    } catch (error) {
      setError('Failed to load payment settlements');
      toast.error('Failed to load payment settlements');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, workflowStatusFilter, parentCompanyFilter, subsidiaryFilter, departmentFilter]);

  const loadStats = useCallback(async () => {
    try {
      const response = await paymentSettlementService.getSettlementStats();
      setStats(response.data);
    } catch (error) {
      // Stats loading failed silently
    }
  }, []);

  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleFilterChange = (filterType, value) => {
    switch (filterType) {
      case 'workflowStatus':
        setWorkflowStatusFilter(value);
        break;
      case 'parentCompany':
        setParentCompanyFilter(value);
        break;
      case 'subsidiary':
        setSubsidiaryFilter(value);
        break;
      case 'department':
        setDepartmentFilter(value);
        break;
      default:
        break;
    }
    setPage(0);
  };

  const handleWorkflowStatusChange = async () => {
    if (!workflowStatusDialog.settlement || !workflowStatusDialog.workflowStatus) {
      return;
    }

    try {
      await paymentSettlementService.updateWorkflowStatus(
        workflowStatusDialog.settlement._id,
        workflowStatusDialog.workflowStatus,
        workflowStatusDialog.comments
      );
      toast.success('Workflow status updated successfully');
      setWorkflowStatusDialog({ open: false, settlement: null, workflowStatus: '', comments: '' });
      loadSettlements();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update workflow status');
    }
  };

  const handleDelete = async (settlement) => {
    try {
      await paymentSettlementService.deletePaymentSettlement(settlement._id);
      toast.success('Payment settlement deleted successfully');
      loadSettlements();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete payment settlement');
    }
    setDeleteDialog({ open: false, settlement: null });
  };



  const formatPKR = (amount) => {
    if (!amount) return 'PKR 0';
    return `PKR ${amount}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = date.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear().toString().slice(-2);
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  };

  const handlePrint = () => {
    if (!viewDialog.settlement) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Get the current date and time for the print header
    const printDate = new Date().toLocaleString();
    const settlement = viewDialog.settlement;
    
    // Create the print content HTML with comprehensive styling
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Settlement Record - ${settlement?.referenceNumber || 'N/A'}</title>
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
            <h1>PAYMENT SETTLEMENT RECORD</h1>
            <div class="subtitle">Reference Number: ${settlement?.referenceNumber || 'N/A'}</div>
            <div class="print-date">Printed on: ${printDate}</div>
          </div>

          <!-- Record Summary -->
          <div class="section">
            <div class="section-title">📋 Record Summary</div>
            <div class="field-row">
              <div class="field-label">Record ID:</div>
              <div class="field-value"><span class="record-id">${settlement?._id || 'N/A'}</span></div>
            </div>
            <div class="field-row">
              <div class="field-label">Payment Type:</div>
              <div class="field-value">${settlement?.paymentType || 'N/A'}</div>
            </div>
            <div class="amount-highlight">
              💰 Grand Total: ${formatPKR(settlement?.grandTotal || '0')}
            </div>
            <div class="field-row">
              <div class="field-label">Amount:</div>
              <div class="field-value">${formatPKR(settlement?.amount || '0')}</div>
            </div>
          </div>

          <!-- Company Details -->
          <div class="section">
            <div class="section-title">🏢 Company Details</div>
            <div class="field-row">
              <div class="field-label">Parent Company:</div>
              <div class="field-value">${settlement?.parentCompanyName || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Subsidiary:</div>
              <div class="field-value">${settlement?.subsidiaryName || 'N/A'}</div>
            </div>
          </div>

          <!-- Payment Details -->
          <div class="section">
            <div class="section-title">💳 Payment Details</div>
            <div class="field-row">
              <div class="field-label">Reference Number:</div>
              <div class="field-value">${settlement?.referenceNumber || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Payment Date:</div>
              <div class="field-value">${formatDate(settlement?.date || '')}</div>
            </div>
            <div class="field-row">
              <div class="field-label">To Whom Paid:</div>
              <div class="field-value">${settlement?.toWhomPaid || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Purpose (For What):</div>
              <div class="field-value">${settlement?.forWhat || 'N/A'}</div>
            </div>
            ${settlement?.site ? `
            <div class="field-row">
              <div class="field-label">Site Location:</div>
              <div class="field-value">${settlement.site}</div>
            </div>
            ` : ''}
            ${settlement?.fromDepartment ? `
            <div class="field-row">
              <div class="field-label">From Department:</div>
              <div class="field-value">${settlement.fromDepartment}</div>
            </div>
            ` : ''}
            ${settlement?.custodian ? `
            <div class="field-row">
              <div class="field-label">Custodian:</div>
              <div class="field-value">${settlement.custodian}</div>
            </div>
            ` : ''}
          </div>

          <!-- Authorization Details -->
          <div class="section">
            <div class="section-title">✅ Authorization Details</div>
            <div class="authorization-grid">
              <div class="auth-box">
                <div class="name">${settlement?.preparedBy || 'N/A'}</div>
                <div class="designation">${settlement?.preparedByDesignation || 'Not specified'}</div>
              </div>
              <div class="auth-box">
                <div class="name">${settlement?.verifiedBy || 'N/A'}</div>
                <div class="designation">${settlement?.verifiedByDesignation || 'Not specified'}</div>
              </div>
              <div class="auth-box">
                <div class="name">${settlement?.approvedBy || 'N/A'}</div>
                <div class="designation">${settlement?.approvedByDesignation || 'Not specified'}</div>
              </div>
            </div>
          </div>

          <!-- Document Attachments -->
          ${settlement?.attachments && settlement.attachments.length > 0 ? `
          <div class="section">
            <div class="section-title">📎 Document Attachments (${settlement.attachments.length} files)</div>
            <div class="attachments-list">
              ${settlement.attachments.map((attachment, index) => `
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
              <div class="field-value">${settlement?.createdBy?.firstName || ''} ${settlement?.createdBy?.lastName || ''} ${settlement?.createdBy?.role ? `(${settlement.createdBy.role})` : ''}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Created Date:</div>
              <div class="field-value">${settlement?.createdAt ? new Date(settlement.createdAt).toLocaleString() : 'N/A'}</div>
            </div>
            ${settlement?.updatedBy ? `
            <div class="field-row">
              <div class="field-label">Last Updated By:</div>
              <div class="field-value">${settlement.updatedBy.firstName || ''} ${settlement.updatedBy.lastName || ''} ${settlement.updatedBy.role ? `(${settlement.updatedBy.role})` : ''}</div>
            </div>
            ` : ''}
            <div class="field-row">
              <div class="field-label">Last Updated:</div>
              <div class="field-value">${settlement?.updatedAt ? new Date(settlement.updatedAt).toLocaleString() : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Record Version:</div>
              <div class="field-value">${settlement?.__v || '0'}</div>
            </div>
          </div>

          <!-- Additional Information -->
          <div class="section">
            <div class="section-title">📝 Additional Information</div>
            <div class="important-info">
              This document contains all available information for Payment Settlement Record ${settlement?.referenceNumber || settlement?._id || 'N/A'}
            </div>
            <div class="field-row">
              <div class="field-label">Total Fields:</div>
              <div class="field-value">${Object.keys(settlement || {}).length} data fields</div>
            </div>
            <div class="field-row">
              <div class="field-label">Document Status:</div>
              <div class="field-value">Complete - All available data included</div>
            </div>
          </div>

          <div class="footer">
            <p><strong>Generated from SGC ERP System - Payment Settlement Module</strong></p>
            <p>Record ID: <span class="record-id">${settlement?._id || 'N/A'}</span> | Printed: ${printDate}</p>
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

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Payment Settlements
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/payment-settlement/create')}
        >
          Create Settlement
        </Button>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Settlements
                </Typography>
                <Typography variant="h5">
                  {stats.total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Recent (30 days)
                </Typography>
                <Typography variant="h5">
                  {stats.recent}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Approved
                </Typography>
                <Typography variant="h5" color="success.main">
                  {stats.byStatus?.Approved || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Draft
                </Typography>
                <Typography variant="h5" color="warning.main">
                  {stats.byStatus?.Draft || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Filters
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Search"
              value={search}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              placeholder="Search settlements..."
            />
          </Grid>
          {(user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'higher_management') && (
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Workflow Status</InputLabel>
                <Select
                  value={workflowStatusFilter}
                  onChange={(e) => handleFilterChange('workflowStatus', e.target.value)}
                  label="Workflow Status"
                >
                  {workflowStatusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Parent Company"
              value={parentCompanyFilter}
              onChange={(e) => handleFilterChange('parentCompany', e.target.value)}
              placeholder="Filter by company"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Subsidiary"
              value={subsidiaryFilter}
              onChange={(e) => handleFilterChange('subsidiary', e.target.value)}
              placeholder="Filter by subsidiary"
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadSettlements}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setSearch('');
              setWorkflowStatusFilter('');
              setParentCompanyFilter('');
              setSubsidiaryFilter('');
              setDepartmentFilter('');
              setPage(0);
            }}
          >
            Clear Filters
          </Button>
        </Box>
      </Paper>

      {/* Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Reference #</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Payment Type</TableCell>
                <TableCell>To Whom Paid</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Workflow Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : settlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No payment settlements found
                  </TableCell>
                </TableRow>
              ) : (
                settlements.map((settlement) => (
                  <TableRow key={settlement._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {settlement.referenceNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {settlement.date}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {settlement.parentCompanyName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {settlement.subsidiaryName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={settlement.paymentType}
                        color={
                          settlement.paymentType === 'Payable' ? 'primary' : 
                          settlement.paymentType === 'Reimbursement' ? 'secondary' : 
                          settlement.paymentType === 'Advance' ? 'success' : 'default'
                        }
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {settlement.toWhomPaid}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {settlement.forWhat}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {formatPKR(settlement.amount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total: {formatPKR(settlement.grandTotal)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {formatDate(settlement.date)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={settlement.workflowStatus || 'Draft'}
                        color={getWorkflowStatusColor(settlement.workflowStatus || 'Draft')}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => setViewDialog({ open: true, settlement })}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        {(user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'higher_management') && (
                          <Tooltip title="Change Workflow Status">
                            <IconButton
                              size="small"
                              onClick={() => setWorkflowStatusDialog({ 
                                open: true, 
                                settlement,
                                workflowStatus: settlement.workflowStatus || 'Draft',
                                comments: ''
                              })}
                              color="primary"
                            >
                              <ScheduleIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/admin/payment-settlement/edit/${settlement._id}`)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteDialog({ open: true, settlement })}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalItems}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </Paper>

      {/* View Dialog */}
      <Dialog
        open={viewDialog.open}
        onClose={() => setViewDialog({ open: false, settlement: null })}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 0,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            background: '#ffffff'
          }
        }}
      >
        <DialogTitle sx={{ 
          p: 0,
          m: 0
        }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            p: 2,
            borderBottom: '1px solid #e0e0e0'
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#333' }}>
              PAYMENT SETTLEMENT
            </Typography>
            <IconButton 
              size="small" 
              onClick={() => setViewDialog({ open: false, settlement: null })}
              sx={{ color: '#666' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, background: '#ffffff' }}>
          {viewDialog.settlement && (
            <Box sx={{ 
              p: 4, 
              background: '#ffffff',
              fontFamily: '"Times New Roman", serif'
            }}>
              {/* Document Header */}
              <Box sx={{ 
                mb: 3, 
                borderBottom: '2px solid #000',
                pb: 2
              }}>
                <Typography variant="h5" sx={{ 
                  fontWeight: 700, 
                  textAlign: 'center',
                  mb: 3,
                  fontSize: '24px',
                  letterSpacing: '1px'
                }}>
                  {viewDialog.settlement.parentCompanyName || 'PAYMENT SETTLEMENT'}
                </Typography>
                
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      SITE:
                    </Typography>
                    <Typography variant="body2">
                      {viewDialog.settlement.site || 'Head Office'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      FROM:
                    </Typography>
                    <Typography variant="body2">
                      {viewDialog.settlement.fromDepartment || 'Administration'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      CUSTODIEN:
                    </Typography>
                    <Typography variant="body2">
                      {viewDialog.settlement.custodian || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      DATE:
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(viewDialog.settlement.date)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      DOCUMENT NUMBER:
                    </Typography>
                    <Typography variant="body2">
                      {viewDialog.settlement.referenceNumber || viewDialog.settlement.voucherNumber || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      NOTE:
                    </Typography>
                    <Typography variant="body2">
                      {viewDialog.settlement.attachments && viewDialog.settlement.attachments.length > 0 
                        ? 'All Supportings Attached' 
                        : 'No Attachments'}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Transaction Details Table */}
              <Box sx={{ mb: 3 }}>
                <TableContainer component={Paper} sx={{ 
                  boxShadow: 'none',
                  border: '1px solid #000'
                }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ background: '#f5f5f5' }}>
                        <TableCell sx={{ 
                          border: '1px solid #000', 
                          fontWeight: 700,
                          py: 1.5,
                          fontSize: '13px'
                        }}>
                          Date
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000', 
                          fontWeight: 700,
                          py: 1.5,
                          fontSize: '13px'
                        }}>
                          Reference No
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000', 
                          fontWeight: 700,
                          py: 1.5,
                          fontSize: '13px'
                        }}>
                          To Whom Paid
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000', 
                          fontWeight: 700,
                          py: 1.5,
                          fontSize: '13px'
                        }}>
                          For What
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000', 
                          fontWeight: 700,
                          py: 1.5,
                          fontSize: '13px',
                          textAlign: 'right'
                        }}>
                          Amount
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ 
                          border: '1px solid #000',
                          py: 2,
                          fontSize: '13px'
                        }}>
                          {formatDate(viewDialog.settlement.date)}
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000',
                          py: 2,
                          fontSize: '13px'
                        }}>
                          {viewDialog.settlement.referenceNumber || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000',
                          py: 2,
                          fontSize: '13px'
                        }}>
                          {viewDialog.settlement.toWhomPaid || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000',
                          py: 2,
                          fontSize: '13px',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {viewDialog.settlement.forWhat || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ 
                          border: '1px solid #000',
                          py: 2,
                          fontSize: '13px',
                          textAlign: 'right',
                          fontWeight: 600
                        }}>
                          {formatPKR(viewDialog.settlement.amount)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Grand Total */}
              <Box sx={{ 
                mb: 4,
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <Box sx={{ 
                  border: '2px solid #000',
                  p: 2,
                  minWidth: '250px',
                  background: '#f9f9f9'
                }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 700,
                    textAlign: 'right',
                    fontSize: '18px'
                  }}>
                    Grand Total: {formatPKR(viewDialog.settlement.grandTotal)}
                  </Typography>
                </Box>
              </Box>


              {/* Approval Section */}
              <Box sx={{ 
                mt: 4,
                borderTop: '1px solid #000',
                pt: 3
              }}>
                <Grid container spacing={4}>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600, 
                        mb: 2,
                        fontSize: '13px',
                        textDecoration: 'underline'
                      }}>
                        Prepared By:
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600,
                        mb: 0.5,
                        fontSize: '13px'
                      }}>
                        {viewDialog.settlement.preparedBy || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {viewDialog.settlement.preparedByDesignation || 'Not specified'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600, 
                        mb: 2,
                        fontSize: '13px',
                        textDecoration: 'underline'
                      }}>
                        Verified By:
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600,
                        mb: 0.5,
                        fontSize: '13px'
                      }}>
                        {viewDialog.settlement.verifiedBy || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {viewDialog.settlement.verifiedByDesignation || 'Not specified'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600, 
                        mb: 2,
                        fontSize: '13px',
                        textDecoration: 'underline'
                      }}>
                        Approved by:
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600,
                        mb: 0.5,
                        fontSize: '13px'
                      }}>
                        {viewDialog.settlement.approvedBy || 'N/A'}
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        {viewDialog.settlement.approvedByDesignation || 'Not specified'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>


              {/* Observations Section */}
              {(() => {
                // Extract observations from workflowHistory
                const observations = viewDialog.settlement.workflowHistory?.filter(entry => 
                  entry.comments && (
                    entry.comments.toLowerCase().includes('observation') || 
                    entry.comments.toLowerCase().includes('returned from pre audit with observations')
                  )
                ) || [];

                if (observations.length === 0) return null;

                return (
                  <Box sx={{ 
                    mt: 4,
                    borderTop: '2px solid #d32f2f',
                    pt: 3
                  }}>
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      mb: 2
                    }}>
                      <ErrorIcon sx={{ color: '#d32f2f', mr: 1, fontSize: '20px' }} />
                      <Typography variant="body2" sx={{ 
                        fontWeight: 700, 
                        fontSize: '15px',
                        color: '#d32f2f',
                        textTransform: 'uppercase'
                      }}>
                        CRITICAL OBSERVATIONS:
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      border: '2px solid #d32f2f',
                      p: 2.5,
                      background: '#ffebee',
                      borderRadius: '4px'
                    }}>
                      {observations.map((entry, index) => {
                        const observationMatch = entry.comments.match(/Observation\s*\(([^)]+)\):\s*(.+)/i);
                        const returnedMatch = entry.comments.match(/Returned from Pre Audit with observations:\s*(.+)/i);
                        
                        let observationText = entry.comments;
                        let severity = 'medium';
                        if (observationMatch) {
                          observationText = observationMatch[2];
                          severity = observationMatch[1].toLowerCase();
                        } else if (returnedMatch) {
                          observationText = returnedMatch[1];
                        }

                        const isCritical = severity.includes('high') || severity.includes('critical') || severity.includes('urgent');

                        return (
                          <Box key={index} sx={{ 
                            mb: index < observations.length - 1 ? 2.5 : 0,
                            p: 1.5,
                            background: isCritical ? '#ffcdd2' : '#fff',
                            border: `1px solid ${isCritical ? '#d32f2f' : '#ef5350'}`,
                            borderRadius: '4px'
                          }}>
                            {isCritical && (
                              <Chip
                                label="CRITICAL"
                                size="small"
                                sx={{
                                  mb: 1,
                                  background: '#d32f2f',
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '10px'
                                }}
                              />
                            )}
                            <Typography variant="body2" sx={{ 
                              fontSize: '12px',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.7,
                              color: '#c62828',
                              fontWeight: 500
                            }}>
                              {observationText}
                            </Typography>
                            {entry.changedBy && (
                              <Typography variant="caption" sx={{ 
                                display: 'block',
                                mt: 1,
                                color: '#d32f2f',
                                fontSize: '11px'
                              }}>
                                — {entry.changedBy.firstName} {entry.changedBy.lastName}
                                {(() => {
                                  // Extract department from workflowStatus
                                  let department = '';
                                  if (entry.toStatus) {
                                    if (entry.toStatus.includes('AM Admin')) department = 'AM Admin';
                                    else if (entry.toStatus.includes('HOD Admin')) department = 'HOD Admin';
                                    else if (entry.toStatus.includes('Audit')) department = 'Audit';
                                    else if (entry.toStatus.includes('Finance')) department = 'Finance';
                                    else if (entry.toStatus.includes('CEO Office')) department = 'CEO Office';
                                    else if (entry.toStatus.includes('Pre Audit')) department = 'Pre Audit';
                                  }
                                  return department ? ` (${department})` : '';
                                })()}
                                {entry.changedAt && ` • ${formatDate(entry.changedAt)}`}
                              </Typography>
                            )}
                            {index < observations.length - 1 && (
                              <Box sx={{ borderTop: '1px dashed #ef5350', mt: 2, pt: 2 }} />
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })()}


              {/* Document Attachments Section */}
              {viewDialog.settlement.attachments && viewDialog.settlement.attachments.length > 0 && (
                <Box sx={{ 
                  mt: 4,
                  borderTop: '1px solid #000',
                  pt: 3
                }}>
                  <Typography variant="body2" sx={{ 
                    fontWeight: 700, 
                    mb: 2,
                    fontSize: '14px',
                    textDecoration: 'underline'
                  }}>
                    ATTACHMENTS ({viewDialog.settlement.attachments.length}):
                  </Typography>
                  <Box sx={{ 
                    border: '1px solid #000',
                    p: 2
                  }}>
                    <Grid container spacing={1}>
                      {viewDialog.settlement.attachments.map((attachment, index) => {
                        const attachmentUrl = paymentSettlementService.getAttachmentUrl(viewDialog.settlement._id, attachment._id);
                        const isImage = attachment.mimeType.startsWith('image/');
                        const isPdf = attachment.mimeType === 'application/pdf';
                        
                        return (
                          <Grid item xs={12} key={attachment._id || index}>
                            <Box 
                              sx={{ 
                                p: 1.5, 
                                border: '1px solid #ccc',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  borderColor: '#000',
                                  background: '#f5f5f5'
                                }
                              }}
                              onClick={async () => {
                                if (isImage) {
                                  try {
                                    const blobUrl = await paymentSettlementService.getAttachmentBlobUrl(viewDialog.settlement._id, attachment._id);
                                    setImageViewer({
                                      open: true,
                                      imageUrl: blobUrl,
                                      imageName: attachment.originalName,
                                      isBlob: true
                                    });
                                  } catch (error) {
                                    toast.error('Failed to load image');
                                  }
                                } else if (isPdf) {
                                  window.open(attachmentUrl, '_blank');
                                } else {
                                  const link = document.createElement('a');
                                  link.href = attachmentUrl;
                                  link.download = attachment.originalName;
                                  link.target = '_blank';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }
                              }}
                            >
                              <Typography variant="body2" sx={{ 
                                fontSize: '12px',
                                fontWeight: 500
                              }}>
                                {index + 1}. {attachment.originalName}
                              </Typography>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          p: 2, 
          borderTop: '1px solid #e0e0e0',
          background: '#f9f9f9',
          justifyContent: 'space-between'
        }}>
          <Box>
            <Chip
              label={viewDialog.settlement?.workflowStatus || 'Draft'}
              color={getWorkflowStatusColor(viewDialog.settlement?.workflowStatus || 'Draft')}
              size="small"
              sx={{ mr: 1 }}
            />
            <Chip
              label={viewDialog.settlement?.paymentType}
              variant="outlined"
              size="small"
            />
          </Box>
          <Box>
            <Button 
              variant="outlined" 
              onClick={() => setViewDialog({ open: false, settlement: null })}
              sx={{ minWidth: 80, mr: 1 }}
            >
              Close
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              sx={{ minWidth: 100, mr: 1 }}
            >
              Print
            </Button>
            <Button 
              variant="contained" 
              startIcon={<EditIcon />}
              onClick={() => {
                setViewDialog({ open: false, settlement: null });
                navigate(`/admin/payment-settlement/edit/${viewDialog.settlement._id}`);
              }}
              sx={{ minWidth: 100 }}
            >
              Edit
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, settlement: null })}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the payment settlement "{deleteDialog.settlement?.referenceNumber}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, settlement: null })}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => handleDelete(deleteDialog.settlement)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Workflow Status Dialog */}
      <Dialog
        open={workflowStatusDialog.open}
        onClose={() => setWorkflowStatusDialog({ open: false, settlement: null, workflowStatus: '', comments: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Workflow Status</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Workflow Status</InputLabel>
              <Select
                value={workflowStatusDialog.workflowStatus || ''}
                onChange={(e) => setWorkflowStatusDialog({ 
                  ...workflowStatusDialog, 
                  workflowStatus: e.target.value 
                })}
                label="Workflow Status"
              >
                {workflowStatusOptions.filter(opt => opt.value !== '').map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Comments (Optional)"
              value={workflowStatusDialog.comments || ''}
              onChange={(e) => setWorkflowStatusDialog({ 
                ...workflowStatusDialog, 
                comments: e.target.value 
              })}
              placeholder="Add any comments about this status change..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkflowStatusDialog({ open: false, settlement: null, workflowStatus: '', comments: '' })}>
            Cancel
          </Button>
          <Button 
            onClick={handleWorkflowStatusChange} 
            variant="contained"
            disabled={!workflowStatusDialog.workflowStatus}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Viewer Modal */}
      <Dialog
        open={imageViewer.open}
        onClose={() => {
          // Clean up blob URL if it's a blob
          if (imageViewer.isBlob && imageViewer.imageUrl) {
            URL.revokeObjectURL(imageViewer.imageUrl);
          }
          setImageViewer({ open: false, imageUrl: '', imageName: '', isBlob: false });
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            maxHeight: '90vh'
          }
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: 2,
            p: 2
          }}
        >
          {/* Close Button */}
          <IconButton
            onClick={() => {
              // Clean up blob URL if it's a blob
              if (imageViewer.isBlob && imageViewer.imageUrl) {
                URL.revokeObjectURL(imageViewer.imageUrl);
              }
              setImageViewer({ open: false, imageUrl: '', imageName: '', isBlob: false });
            }}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)'
              },
              zIndex: 1
            }}
          >
            <CloseIcon />
          </IconButton>

          {/* Image */}
          <Box
            sx={{
              maxWidth: '100%',
              maxHeight: '80vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src={imageViewer.imageUrl}
              alt={imageViewer.imageName}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 8,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            
            {/* Error Fallback */}
            <Box
              sx={{
                display: 'none',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                textAlign: 'center',
                p: 4
              }}
            >
              <AttachFileIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
              <Typography variant="h6" gutterBottom>
                Unable to load image
              </Typography>
              <Typography variant="body2" color="grey.300">
                The image file may be corrupted or in an unsupported format
              </Typography>
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = imageViewer.imageUrl;
                  link.download = imageViewer.imageName;
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                Download Instead
              </Button>
            </Box>
          </Box>

          {/* Image Info */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              right: 16,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              borderRadius: 1,
              p: 2,
              color: 'white'
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold" noWrap>
              {imageViewer.imageName}
            </Typography>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};

export default PaymentSettlementList;
