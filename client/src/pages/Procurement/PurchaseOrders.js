import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Avatar,
  alpha,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Tooltip,
  CircularProgress,
  Stack,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import {
  ShoppingCart as ShoppingCartIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CheckCircle as ApproveIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Send as SendIcon,
  Print as PrintIcon,
  History as HistoryIcon,
  LocalShipping as GRNIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import WorkflowHistoryDialog from '../../components/WorkflowHistoryDialog';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import dayjs from 'dayjs';

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [vendors, setVendors] = useState([]);
  
  // Pagination and filters
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  
  // Dialog states (quotationId set when creating PO from Quotations page)
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', data: null, quotationId: null });
  const [viewDialog, setViewDialog] = useState({ open: false, data: null, attachedGrns: [], poDetailTab: 0 });
  const [workflowHistoryDialog, setWorkflowHistoryDialog] = useState({ open: false, document: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null });
  
  // Approval authorities for create/edit form (prefilled from comparative statement when creating from quotation)
  const [approvalAuthority, setApprovalAuthority] = useState({
    preparedBy: '',
    verifiedBy: '',
    authorisedRep: '',
    financeRep: '',
    managerProcurement: ''
  });
  
  // Observation answers when resubmitting to audit
  const [observationAnswers, setObservationAnswers] = useState({});
  
  // Form data
  const [formData, setFormData] = useState({
    vendor: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    deliveryAddress: '',
    status: 'Draft',
    priority: 'Medium',
    items: [{ description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0 }],
    shippingCost: 0,
    paymentTerms: '',
    notes: '',
    internalNotes: ''
  });

  // Load data on component mount
  useEffect(() => {
    loadPurchaseOrders();
    loadStatistics();
    loadVendors();
  }, [page, rowsPerPage, search, statusFilter, priorityFilter]);

  // When navigated from Quotations with createFromQuotationId, fetch quotation and open create form prefilled
  useEffect(() => {
    const quotationId = location.state?.createFromQuotationId;
    if (!quotationId) return;

    const openCreateFromQuotation = async () => {
      try {
        const res = await api.get(`/procurement/quotations/${quotationId}`);
        if (!res.data?.success || !res.data?.data) return;
        const q = res.data.data;
        const indent = q.indent || {};
        const approvals = indent.comparativeStatementApprovals || {};

        setFormData({
          vendor: q.vendor?._id || q.vendor || '',
          orderDate: new Date().toISOString().split('T')[0],
          expectedDeliveryDate: q.expiryDate ? dayjs(q.expiryDate).format('YYYY-MM-DD') : dayjs().add(30, 'day').format('YYYY-MM-DD'),
          deliveryAddress: q.vendor?.address || '',
          status: 'Draft',
          priority: 'Medium',
          items: (q.items && q.items.length > 0)
            ? q.items.map(item => ({
                description: item.description || '',
                quantity: item.quantity || 1,
                unit: item.unit || 'pcs',
                unitPrice: item.unitPrice || 0,
                taxRate: item.taxRate || 0,
                discount: item.discount || 0
              }))
            : [{ description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0 }],
          shippingCost: 0,
          paymentTerms: q.paymentTerms || '',
          notes: q.notes ? `From quotation ${q.quotationNumber || ''}. ${q.notes}` : `Created from quotation ${q.quotationNumber || ''}`,
          internalNotes: q.indent?.indentNumber ? `Source: Quotation ${q.quotationNumber || ''}, Indent: ${q.indent.indentNumber}` : ''
        });
        setApprovalAuthority({
          preparedBy: approvals.preparedBy || '',
          verifiedBy: approvals.verifiedBy || '',
          authorisedRep: approvals.authorisedRep || '',
          financeRep: approvals.financeRep || '',
          managerProcurement: approvals.managerProcurement || ''
        });
        setFormDialog({ open: true, mode: 'create', data: null, quotationId });
      } catch (err) {
        console.error('Failed to load quotation for PO', err);
        setError(err.response?.data?.message || 'Failed to load quotation');
      }
      navigate(location.pathname, { replace: true, state: {} });
    };

    openCreateFromQuotation();
  }, [location.state?.createFromQuotationId, location.pathname, navigate]);

  const loadPurchaseOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        status: statusFilter,
        priority: priorityFilter
      };

      const response = await api.get('/procurement/purchase-orders', { params });
      
      if (response.data.success) {
        setPurchaseOrders(response.data.data.purchaseOrders);
        setTotalItems(response.data.data.pagination.totalItems);
      }
    } catch (err) {
      setError('Failed to load purchase orders');
      console.error('Error loading purchase orders:', err);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter, priorityFilter]);

  const loadStatistics = async () => {
    try {
      const response = await api.get('/procurement/purchase-orders/statistics');
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (err) {
      console.error('Error loading statistics:', err);
    }
  };

  const loadVendors = async () => {
    try {
      const response = await api.get('/procurement/vendors', { params: { limit: 1000 } });
      if (response.data.success) {
        setVendors(response.data.data.vendors);
      }
    } catch (err) {
      console.error('Error loading vendors:', err);
    }
  };

  const handleCreate = () => {
    setApprovalAuthority({ preparedBy: '', verifiedBy: '', authorisedRep: '', financeRep: '', managerProcurement: '' });
    setFormData({
      vendor: '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      deliveryAddress: '',
      status: 'Draft',
      priority: 'Medium',
      items: [{ description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0 }],
      shippingCost: 0,
      paymentTerms: '',
      notes: '',
      internalNotes: ''
    });
    setFormDialog({ open: true, mode: 'create', data: null, quotationId: null });
  };

  const handleEdit = async (order) => {
    try {
      // Fetch full PO data with populated fields (especially audit rejection fields)
      const response = await api.get(`/procurement/purchase-orders/${order._id}`);
      const fullOrder = response.data.success ? response.data.data : order;
      
      setFormData({
        ...fullOrder,
        vendor: fullOrder.vendor?._id || fullOrder.vendor,
        orderDate: fullOrder.orderDate ? new Date(fullOrder.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        expectedDeliveryDate: fullOrder.expectedDeliveryDate ? new Date(fullOrder.expectedDeliveryDate).toISOString().split('T')[0] : '',
        deliveryAddress: fullOrder.deliveryAddress || ''
      });
      const approvals = fullOrder.approvalAuthorities || {};
      setApprovalAuthority({
        preparedBy: approvals.preparedBy || '',
        verifiedBy: approvals.verifiedBy || '',
        authorisedRep: approvals.authorisedRep || '',
        financeRep: approvals.financeRep || '',
        managerProcurement: approvals.managerProcurement || ''
      });
      // Initialize observation answers if there are observations
      if (fullOrder.auditObservations && fullOrder.auditObservations.length > 0) {
        const answers = {};
        fullOrder.auditObservations.forEach(obs => {
          if (obs.answer) {
            answers[obs._id] = obs.answer;
          }
        });
        setObservationAnswers(answers);
      } else {
        setObservationAnswers({});
      }
      
      setFormDialog({ open: true, mode: 'edit', data: fullOrder, quotationId: null });
    } catch (err) {
      // Fallback to using the order passed in if fetch fails
      setFormData({
        ...order,
        vendor: order.vendor?._id || order.vendor,
        orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        expectedDeliveryDate: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString().split('T')[0] : '',
        deliveryAddress: order.deliveryAddress || ''
      });
      const approvals = order.approvalAuthorities || {};
      setApprovalAuthority({
        preparedBy: approvals.preparedBy || '',
        verifiedBy: approvals.verifiedBy || '',
        authorisedRep: approvals.authorisedRep || '',
        financeRep: approvals.financeRep || '',
        managerProcurement: approvals.managerProcurement || ''
      });
      setFormDialog({ open: true, mode: 'edit', data: order, quotationId: null });
      setError('Failed to load full purchase order details');
    }
  };

  const handleView = async (order) => {
    try {
      const [poRes, grnRes] = await Promise.all([
        api.get(`/procurement/purchase-orders/${order._id}`),
        api.get('/procurement/goods-receive', { params: { purchaseOrder: order._id, limit: 100 } })
      ]);
      const poData = poRes.data?.success ? poRes.data.data : order;
      const grns = grnRes.data?.success ? (grnRes.data.data?.receives || []) : [];
      setViewDialog({ open: true, data: poData, attachedGrns: grns, poDetailTab: 0 });
    } catch (err) {
      setViewDialog({ open: true, data: order, attachedGrns: [] });
    }
  };

  // Number to words converter
  const numberToWords = (num) => {
    if (!num || num === 0) return 'Zero Rupees Only';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    const convert = (n) => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };
    
    const amount = Math.floor(num);
    const paise = Math.round((num - amount) * 100);
    
    let result = convert(amount) + ' Rupees';
    if (paise > 0) {
      result += ' and ' + convert(paise) + ' Paise';
    }
    result += ' Only';
    
    return result;
  };

  const formatDateForPrint = (date) => {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(date);
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0.00';
    return parseFloat(num).toFixed(2);
  };

  const formatGRNDate = (d) => {
    if (!d) return '';
    const x = new Date(d);
    const days = String(x.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days}-${months[x.getMonth()]}-${x.getFullYear()}`;
  };

  const formatGRNNumber = (n) => (n == null || n === '') ? '' : Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleDelete = (id) => {
    setDeleteDialog({ open: true, id });
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/procurement/purchase-orders/${deleteDialog.id}`);
      setSuccess('Purchase order deleted successfully');
      setDeleteDialog({ open: false, id: null });
      loadPurchaseOrders();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete purchase order');
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const payload = { ...formData };
      payload.approvalAuthorities = { ...approvalAuthority };
      if (formDialog.mode === 'create' && formDialog.quotationId) {
        payload.quotation = formDialog.quotationId;
      }

      // When editing, ensure status is always included
      // If status is not set in formData, use the original status from the PO
      if (formDialog.mode === 'edit' && formDialog.data) {
        if (!payload.status || payload.status === '') {
          payload.status = formDialog.data.status || 'Draft';
        }
      }

      if (formDialog.mode === 'create') {
        await api.post('/procurement/purchase-orders', payload);
        setSuccess('Purchase order created successfully');
      } else {
        await api.put(`/procurement/purchase-orders/${formDialog.data._id}`, payload);
        setSuccess('Purchase order updated successfully');
      }
      
      setFormDialog({ open: false, mode: 'create', data: null, quotationId: null });
      setObservationAnswers({}); // Clear observation answers
      loadPurchaseOrders();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/procurement/purchase-orders/${id}/approve`);
      setSuccess('Purchase order approved successfully');
      loadPurchaseOrders();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve purchase order');
    }
  };

  const handleSendToAudit = async (id, order = null) => {
    try {
      // If order is provided and has observations, prepare observation answers
      let payload = {};
      if (order && order.auditObservations && order.auditObservations.length > 0) {
        const answers = order.auditObservations
          .filter(obs => observationAnswers[obs._id] && observationAnswers[obs._id].trim())
          .map(obs => ({
            observationId: obs._id,
            answer: observationAnswers[obs._id].trim()
          }));
        if (answers.length > 0) {
          payload.observationAnswers = answers;
        }
      }
      
      await api.put(`/procurement/purchase-orders/${id}/send-to-audit`, payload);
      setSuccess('Purchase order sent to audit successfully. It will appear in the Pre-Audit page.');
      setObservationAnswers({}); // Clear observation answers
      loadPurchaseOrders();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send purchase order to audit');
    }
  };

  const handleSendToStore = async (id) => {
    try {
      await api.put(`/procurement/purchase-orders/${id}/send-to-store`, {
        comments: 'Sent to Store from Procurement'
      });
      setSuccess('Purchase order sent to store successfully');
      loadPurchaseOrders();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send purchase order to store');
    }
  };

  const handleSendToPostGrnAudit = async (id) => {
    try {
      await api.post(`/procurement/store/po/${id}/send-to-audit`);
      setSuccess('Purchase order sent to Audit for post-GRN review');
      loadPurchaseOrders();
      loadStatistics();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send purchase order to Audit');
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit: 'pcs', unitPrice: 0, taxRate: 0, discount: 0 }]
    }));
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index, field, value) => {
    const items = [...formData.items];
    items[index][field] = value;
    setFormData(prev => ({ ...prev, items }));
  };

  const calculateTotal = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPrice - (item.discount || 0);
      return sum + itemSubtotal;
    }, 0);
    
    const tax = formData.items.reduce((sum, item) => {
      const itemSubtotal = item.quantity * item.unitPrice - (item.discount || 0);
      return sum + (itemSubtotal * (item.taxRate || 0) / 100);
    }, 0);
    
    return subtotal + tax + (formData.shippingCost || 0);
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'default',
      'Pending Approval': 'warning',
      'Pending Audit': 'warning',
      'Pending Finance': 'info',
      'Send to CEO Office': 'info',
      'Forwarded to CEO': 'primary',
      'Approved': 'success',
      'Sent to Store': 'info',
      'GRN Created': 'info',
      'Sent to Procurement': 'info',
      'Sent to Audit': 'secondary',
      'Sent to Finance': 'primary',
      'Ordered': 'info',
      'Partially Received': 'secondary',
      'Received': 'success',
      'Cancelled': 'error',
      'Rejected': 'error',
      'Returned from Audit': 'error',
      'Returned from CEO Office': 'warning',
      'Returned from CEO Secretariat': 'error'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'Low': 'info',
      'Medium': 'default',
      'High': 'warning',
      'Urgent': 'error'
    };
    return colors[priority] || 'default';
  };

  // Statistics cards
  const stats = [
    {
      title: 'Total Orders',
      value: statistics?.totalOrders || 0,
      color: theme.palette.primary.main,
      bgColor: alpha(theme.palette.primary.main, 0.1)
    },
    {
      title: 'Total Value',
      value: formatPKR(statistics?.totalValue || 0),
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.1)
    },
    {
      title: 'Pending Approval',
      value: statistics?.byStatus?.find(s => s._id === 'Pending Approval')?.count || 0,
      color: theme.palette.warning.main,
      bgColor: alpha(theme.palette.warning.main, 0.1)
    },
    {
      title: 'Approved',
      value: statistics?.byStatus?.find(s => s._id === 'Approved')?.count || 0,
      color: theme.palette.info.main,
      bgColor: alpha(theme.palette.info.main, 0.1)
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 56, height: 56 }}>
              <ShoppingCartIcon fontSize="large" />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                Purchase Orders
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Manage procurement purchase orders
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                loadPurchaseOrders();
                loadStatistics();
              }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreate}
            >
              New Purchase Order
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: stat.bgColor, color: stat.color, width: 48, height: 48 }}>
                    <ShoppingCartIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      {stat.title}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {stat.value}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="Draft">Draft</MenuItem>
              <MenuItem value="Pending Approval">Pending Approval</MenuItem>
              <MenuItem value="Pending Audit">Pending Audit</MenuItem>
              <MenuItem value="Pending Finance">Pending Finance</MenuItem>
              <MenuItem value="Send to CEO Office">Send to CEO Office</MenuItem>
              <MenuItem value="Forwarded to CEO">Forwarded to CEO</MenuItem>
              <MenuItem value="Approved">Approved</MenuItem>
              <MenuItem value="Sent to Store">Sent to Store</MenuItem>
              <MenuItem value="GRN Created">GRN Created</MenuItem>
              <MenuItem value="Sent to Procurement">Sent to Procurement</MenuItem>
              <MenuItem value="Sent to Audit">Sent to Audit</MenuItem>
              <MenuItem value="Sent to Finance">Sent to Finance</MenuItem>
              <MenuItem value="Ordered">Ordered</MenuItem>
              <MenuItem value="Partially Received">Partially Received</MenuItem>
              <MenuItem value="Received">Received</MenuItem>
              <MenuItem value="Returned from Audit">Returned from Audit</MenuItem>
              <MenuItem value="Returned from CEO Office">Returned from CEO Office</MenuItem>
              <MenuItem value="Returned from CEO Secretariat">Returned from CEO Secretariat</MenuItem>
              <MenuItem value="Rejected">Rejected</MenuItem>
              <MenuItem value="Cancelled">Cancelled</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              select
              size="small"
              label="Priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <MenuItem value="">All Priorities</MenuItem>
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="High">High</MenuItem>
              <MenuItem value="Urgent">Urgent</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Purchase Orders Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Order Number</strong></TableCell>
                <TableCell><strong>Vendor</strong></TableCell>
                <TableCell><strong>Order Date</strong></TableCell>
                <TableCell><strong>Expected Delivery</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Priority</strong></TableCell>
                <TableCell align="right"><strong>Total Amount</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : purchaseOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No purchase orders found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                purchaseOrders.map((order) => (
                  <TableRow key={order._id} hover>
                    <TableCell>{order.orderNumber}</TableCell>
                    <TableCell>{order.vendor?.name || 'N/A'}</TableCell>
                    <TableCell>{formatDate(order.orderDate)}</TableCell>
                    <TableCell>{formatDate(order.expectedDeliveryDate)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={order.status} 
                        color={getStatusColor(order.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={order.priority} 
                        color={getPriorityColor(order.priority)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">{formatPKR(order.totalAmount)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => handleView(order)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {(order.status === 'Draft' || order.status === 'Returned from Audit' || order.status === 'Returned from CEO Secretariat' || order.status === 'Rejected') && (
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(order)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(order.status === 'Draft' || order.status === 'Returned from Audit' || order.status === 'Returned from CEO Secretariat' || order.status === 'Rejected') && (
                        <Tooltip title="Send to Audit">
                          <IconButton size="small" color="primary" onClick={() => handleSendToAudit(order._id, order)}>
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {order.status === 'Pending Approval' && (
                        <Tooltip title="Approve">
                          <IconButton size="small" color="success" onClick={() => handleApprove(order._id)}>
                            <ApproveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {order.status === 'Approved' && (
                        <Tooltip title="Send to Store">
                          <IconButton size="small" color="primary" onClick={() => handleSendToStore(order._id)}>
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {order.status === 'Sent to Procurement' && (
                        <Tooltip title="Send to Audit">
                          <IconButton size="small" color="secondary" onClick={() => handleSendToPostGrnAudit(order._id)}>
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {order.status === 'Draft' && (
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(order._id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={formDialog.open} 
        onClose={() => {
          setFormDialog({ open: false, mode: 'create', data: null, quotationId: null });
          setObservationAnswers({}); // Clear observation answers
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {formDialog.mode === 'create' ? 'Create Purchase Order' : 'Edit Purchase Order'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                required
              >
                {vendors.map((vendor) => (
                  <MenuItem key={vendor._id} value={vendor._id}>
                    {vendor.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <MenuItem value="Low">Low</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Urgent">Urgent</MenuItem>
              </TextField>
            </Grid>
            {formDialog.mode === 'edit' && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  select
                  label="Status"
                  value={formData.status || 'Draft'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="Draft">Draft</MenuItem>
                  <MenuItem value="Pending Audit">Pending Audit</MenuItem>
                  <MenuItem value="Pending Finance">Pending Finance</MenuItem>
                  <MenuItem value="Send to CEO Office">Send to CEO Office</MenuItem>
                  <MenuItem value="Forwarded to CEO">Forwarded to CEO</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Sent to Store">Sent to Store</MenuItem>
                  <MenuItem value="GRN Created">GRN Created</MenuItem>
                  <MenuItem value="Sent to Procurement">Sent to Procurement</MenuItem>
                  <MenuItem value="Sent to Audit">Sent to Audit</MenuItem>
                  <MenuItem value="Sent to Finance">Sent to Finance</MenuItem>
                  <MenuItem value="Ordered">Ordered</MenuItem>
                  <MenuItem value="Partially Received">Partially Received</MenuItem>
                  <MenuItem value="Received">Received</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                  <MenuItem value="Returned from Audit">Returned from Audit</MenuItem>
                  <MenuItem value="Returned from CEO Office">Returned from CEO Office</MenuItem>
                  <MenuItem value="Returned from CEO Secretariat">Returned from CEO Secretariat</MenuItem>
                  <MenuItem value="Cancelled">Cancelled</MenuItem>
                </TextField>
              </Grid>
            )}
            
            {/* Audit Rejection Observations - Show in edit mode if PO was rejected */}
            {formDialog.mode === 'edit' && formDialog.data?.status === 'Rejected' && formDialog.data?.auditRejectObservations && formDialog.data.auditRejectObservations.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Audit Rejection Observations - Please address these issues:
                  </Typography>
                  {formDialog.data.auditRejectionComments && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Rejection Comments:</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {formDialog.data.auditRejectionComments}
                      </Typography>
                    </Box>
                  )}
                  {formDialog.data.auditRejectObservations.map((obs, index) => (
                    <Box key={index} sx={{ mb: 1.5, p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.05), borderRadius: 1, border: '1px solid', borderColor: 'error.light' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Observation {index + 1}
                        </Typography>
                        {obs.severity && (
                          <Chip 
                            label={obs.severity.charAt(0).toUpperCase() + obs.severity.slice(1)} 
                            size="small" 
                            color={obs.severity === 'critical' ? 'error' : obs.severity === 'high' ? 'warning' : 'default'}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {obs.observation}
                      </Typography>
                    </Box>
                  ))}
                  {formDialog.data.auditRejectedBy && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                      Rejected by: {formDialog.data.auditRejectedBy?.firstName || ''} {formDialog.data.auditRejectedBy?.lastName || ''}
                      {formDialog.data.auditRejectedAt && ` on ${formatDate(formDialog.data.auditRejectedAt)}`}
                    </Typography>
                  )}
                </Alert>
              </Grid>
            )}
            
            {/* Audit Observations with Answer Fields - Show when PO was returned from audit */}
            {formDialog.mode === 'edit' && formDialog.data?.status === 'Returned from Audit' && formDialog.data?.auditObservations && formDialog.data.auditObservations.length > 0 && (
              <Grid item xs={12}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                    Audit Observations - Please provide responses before resubmitting:
                  </Typography>
                  {formDialog.data.auditReturnComments && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Return Comments:</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {formDialog.data.auditReturnComments}
                      </Typography>
                    </Box>
                  )}
                  {formDialog.data.auditObservations.map((obs, index) => (
                    <Box key={obs._id || index} sx={{ mb: 2, p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.05), borderRadius: 1, border: '1px solid', borderColor: 'warning.light' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Observation {index + 1}
                        </Typography>
                        {obs.severity && (
                          <Chip 
                            label={obs.severity.charAt(0).toUpperCase() + obs.severity.slice(1)} 
                            size="small" 
                            color={obs.severity === 'critical' ? 'error' : obs.severity === 'high' ? 'warning' : 'default'}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1.5 }}>
                        {obs.observation}
                      </Typography>
                      {obs.answer && (
                        <Box sx={{ mb: 1.5, p: 1, bgcolor: 'success.light', borderRadius: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                            Previous Answer:
                          </Typography>
                          <Typography variant="body2">
                            {obs.answer}
                          </Typography>
                          {obs.answeredBy && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                              Answered by: {obs.answeredBy?.firstName || ''} {obs.answeredBy?.lastName || ''}
                              {obs.answeredAt && ` on ${formatDate(obs.answeredAt)}`}
                            </Typography>
                          )}
                        </Box>
                      )}
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label={`Your Response to Observation ${index + 1}${obs.answer ? ' (Update existing answer)' : ''}`}
                        value={observationAnswers[obs._id] || obs.answer || ''}
                        onChange={(e) => setObservationAnswers(prev => ({
                          ...prev,
                          [obs._id]: e.target.value
                        }))}
                        placeholder="Provide your response/correction to this observation..."
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  ))}
                </Alert>
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Order Date"
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Expected Delivery Date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Delivery Address"
                value={formData.deliveryAddress || ''}
                onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                placeholder="Enter delivery address for this order"
                multiline
                minRows={2}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Items</Typography>
                <Button size="small" startIcon={<AddIcon />} onClick={addItem}>
                  Add Item
                </Button>
              </Box>
              {formData.items.map((item, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Quantity"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                        required
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Unit"
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Unit Price"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                        required
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Tax %"
                        value={item.taxRate}
                        onChange={(e) => updateItem(index, 'taxRate', parseFloat(e.target.value))}
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Discount"
                        value={item.discount}
                        onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value))}
                      />
                    </Grid>
                    <Grid item xs={6} md={2}>
                      <IconButton 
                        color="error" 
                        onClick={() => removeItem(index)}
                        disabled={formData.items.length === 1}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Shipping Cost"
                value={formData.shippingCost}
                onChange={(e) => setFormData({ ...formData, shippingCost: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Payment Terms"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                <Typography variant="h6" align="right">
                  Total: {formatPKR(calculateTotal())}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Approval authorities</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField fullWidth size="small" label="Prepared By" value={approvalAuthority.preparedBy} onChange={(e) => setApprovalAuthority(prev => ({ ...prev, preparedBy: e.target.value }))} placeholder="Name / Designation" />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField fullWidth size="small" label="Verified By (Procurement Committee)" value={approvalAuthority.verifiedBy} onChange={(e) => setApprovalAuthority(prev => ({ ...prev, verifiedBy: e.target.value }))} placeholder="Name / Designation" />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField fullWidth size="small" label="Authorised Rep." value={approvalAuthority.authorisedRep} onChange={(e) => setApprovalAuthority(prev => ({ ...prev, authorisedRep: e.target.value }))} placeholder="Name / Designation" />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField fullWidth size="small" label="Finance Rep." value={approvalAuthority.financeRep} onChange={(e) => setApprovalAuthority(prev => ({ ...prev, financeRep: e.target.value }))} placeholder="Name / Designation" />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField fullWidth size="small" label="Manager Procurement" value={approvalAuthority.managerProcurement} onChange={(e) => setApprovalAuthority(prev => ({ ...prev, managerProcurement: e.target.value }))} placeholder="Name / Designation" />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setFormDialog({ open: false, mode: 'create', data: null, quotationId: null });
            setObservationAnswers({}); // Clear observation answers
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={!formData.vendor || !formData.expectedDeliveryDate || formData.items.length === 0}
          >
            {formDialog.mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog 
        open={viewDialog.open} 
        onClose={() => setViewDialog({ open: false, data: null, attachedGrns: [], poDetailTab: 0 })}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '90%',
            maxWidth: '210mm',
            maxHeight: '95vh',
            m: 2,
            '@media print': {
              boxShadow: 'none',
              maxWidth: '100%',
              margin: 0,
              height: '100%',
              width: '100%',
              maxHeight: '100%'
            }
          }
        }}
      >
        <DialogTitle sx={{ '@media print': { display: 'none' }, pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Purchase Order Details</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<HistoryIcon />}
                onClick={() => setWorkflowHistoryDialog({ open: true, document: viewDialog.data })}
                size="small"
              >
                Workflow History
              </Button>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
                size="small"
              >
                Print
              </Button>
            </Stack>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'auto', '@media print': { p: 0, overflow: 'visible' } }}>
          {viewDialog.data && (
            <>
              <Tabs
                value={viewDialog.poDetailTab ?? 0}
                onChange={(_, v) => setViewDialog(prev => ({ ...prev, poDetailTab: v }))}
                sx={{ px: 2, pt: 1, borderBottom: 1, borderColor: 'divider', '@media print': { display: 'none' } }}
              >
                <Tab label="Purchase Order" />
                <Tab label={viewDialog.attachedGrns?.length > 0 ? `GRN(s) (${viewDialog.attachedGrns.length})` : 'GRN(s)'} />
              </Tabs>
              {viewDialog.poDetailTab === 0 && (
            <Box sx={{ width: '100%' }} className="print-content">
              <Paper
                sx={{
                  p: { xs: 3, sm: 3.5, md: 4 },
                  maxWidth: '210mm',
                  mx: 'auto',
                  backgroundColor: '#fff',
                  boxShadow: 'none',
                  width: '100%',
                  fontFamily: 'Arial, sans-serif',
                  '@media print': {
                    boxShadow: 'none',
                    p: 2.5,
                    maxWidth: '100%',
                    backgroundColor: '#fff',
                    mx: 0,
                    width: '100%',
                    pageBreakInside: 'avoid'
                  }
                }}
              >
                {/* Title - Centered */}
                <Typography
                  variant="h4"
                  fontWeight={700}
                  align="center"
                  sx={{
                    textTransform: 'uppercase',
                    mb: 3,
                    fontSize: { xs: '1.8rem', print: '1.6rem' },
                    letterSpacing: 1
                  }}
                >
                  Purchase Order
                </Typography>

                {/* Audit Rejection Observations - Show if status is Rejected */}
                {viewDialog.data.status === 'Rejected' && viewDialog.data.auditRejectObservations && viewDialog.data.auditRejectObservations.length > 0 && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.error.main, 0.1), border: `1px solid ${theme.palette.error.main}`, borderRadius: 1 }}>
                    <Typography variant="h6" sx={{ mb: 2, color: 'error.main', fontWeight: 'bold' }}>
                      Audit Rejection Observations
                    </Typography>
                    {viewDialog.data.auditRejectionComments && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Rejection Comments:</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                          {viewDialog.data.auditRejectionComments}
                        </Typography>
                      </Box>
                    )}
                    {viewDialog.data.auditRejectObservations.map((obs, index) => (
                      <Box key={index} sx={{ mb: 1.5, p: 1.5, bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'error.light' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Observation {index + 1}
                          </Typography>
                          {obs.severity && (
                            <Chip 
                              label={obs.severity.charAt(0).toUpperCase() + obs.severity.slice(1)} 
                              size="small" 
                              color={obs.severity === 'critical' ? 'error' : obs.severity === 'high' ? 'warning' : 'default'}
                            />
                          )}
                        </Box>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                          {obs.observation}
                        </Typography>
                      </Box>
                    ))}
                    {viewDialog.data.auditRejectedBy && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                        Rejected by: {viewDialog.data.auditRejectedBy?.firstName || ''} {viewDialog.data.auditRejectedBy?.lastName || ''}
                        {viewDialog.data.auditRejectedAt && ` on ${formatDate(viewDialog.data.auditRejectedAt)}`}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Buyer Information - First Row */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>
                    Residencia
                  </Typography>
                  <Typography sx={{ fontSize: '0.9rem', mb: 0.5 }}>
                    1st Avenue 18 4 Islamabad
                  </Typography>
                  <Typography sx={{ fontSize: '0.9rem' }}>
                    1. Het Sne 1-8. Islamabad.
                  </Typography>
                </Box>

                {/* Divider */}
                <Divider sx={{ my: 2.5, borderWidth: 1, borderColor: '#ccc' }} />

                {/* Vendor and PO Details - Second Row in Columns */}
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 3 }}>
                  {/* Left Column - Vendor Info */}
                  <Box sx={{ width: '45%', fontSize: '0.9rem' }}>
                    <Typography variant="h6" fontWeight={600} sx={{ mb: 1, fontSize: '1.1rem' }}>
                      {viewDialog.data.vendor?.name || 'Vendor Name'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6, mb: 2 }}>
                      {viewDialog.data.vendor?.address || 'Vendor Address'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', lineHeight: 1.6 }}>
                      <Typography component="span" sx={{ fontWeight: 600, mr: 1 }}>Indent Details:</Typography>
                      <Typography component="span">
                        Indent# {viewDialog.data.indent?.indentNumber || 'N/A'} Dated. {viewDialog.data.indent?.requestedDate ? formatDateForPrint(viewDialog.data.indent.requestedDate) : 'N/A'}.
                        {viewDialog.data.indent?.title && ` ${viewDialog.data.indent.title}.`}
                        {viewDialog.data.indent?.requestedBy && ` End User. ${viewDialog.data.indent.requestedBy.firstName} ${viewDialog.data.indent.requestedBy.lastName}`}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Right Column - PO Details */}
                  <Box sx={{ width: '50%', fontSize: '0.9rem', lineHeight: 2 }}>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>P.O No.:</Typography>
                      <Typography component="span">
                        {viewDialog.data.orderNumber ? 
                          (viewDialog.data.orderNumber.startsWith('P') && !viewDialog.data.orderNumber.includes('-')
                            ? viewDialog.data.orderNumber
                            : 'P' + (viewDialog.data.orderNumber.match(/\d+$/)?.[0] || viewDialog.data.orderNumber.split('-').pop() || '').padStart(9, '0'))
                          : 'N/A'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Date:</Typography>
                      <Typography component="span">{formatDateForPrint(viewDialog.data.orderDate)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Date:</Typography>
                      <Typography component="span">{viewDialog.data.expectedDeliveryDate ? formatDateForPrint(viewDialog.data.expectedDeliveryDate) : '___________'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Delivery Address:</Typography>
                      <Typography component="span">
                        {(() => {
                          const addr = viewDialog.data.shippingAddress;
                          if (typeof viewDialog.data.deliveryAddress === 'string' && viewDialog.data.deliveryAddress.trim()) {
                            return viewDialog.data.deliveryAddress.trim();
                          }
                          if (addr && typeof addr === 'object') {
                            const parts = [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean);
                            return parts.length ? parts.join(', ') : (viewDialog.data.vendor?.address || '___________');
                          }
                          return viewDialog.data.vendor?.address || '___________';
                        })()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', mb: 0.5 }}>
                      <Typography component="span" sx={{ minWidth: '140px', fontWeight: 600 }}>Cost Center:</Typography>
                      <Typography component="span">{viewDialog.data.indent?.department?.name || '___________'}</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Items Table */}
                <Box sx={{ mb: 3 }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      border: '1px solid #000',
                      fontSize: '0.85rem',
                      fontFamily: 'Arial, sans-serif'
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '5%' }}>
                          Sr no
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '11%' }}>
                          Product
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '23%' }}>
                          Description
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '14%' }}>
                          Specification
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '11%' }}>
                          Brand
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '11%' }}>
                          Quantity Unit
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '11%' }}>
                          Rate
                        </th>
                        <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '11%' }}>
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDialog.data.items && viewDialog.data.items.length > 0 ? (
                        viewDialog.data.items.map((item, index) => (
                          <tr key={index} style={{ border: '1px solid #000' }}>
                            <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                              {index + 1}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                              {item.productCode || viewDialog.data.indent?.items?.[index]?.itemCode || `44-001-${String(index + 1).padStart(4, '0')}`}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                              {item.description || viewDialog.data.indent?.items?.[index]?.itemName || '___________'}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                              {item.specification || viewDialog.data.indent?.items?.[index]?.specification || viewDialog.data.indent?.items?.[index]?.description || viewDialog.data.indent?.items?.[index]?.purpose || '___________'}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                              {item.brand || viewDialog.data.indent?.items?.[index]?.brand || '___________'}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                              {item.quantity ? `${formatNumber(item.quantity)} ${item.unit || 'Nos'}` : '___________'}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                              {item.unitPrice ? formatNumber(item.unitPrice) : '___________'}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                              {item.amount ? formatNumber(item.amount) : '___________'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>
                            No items
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Box>

                {/* Financial Summary - Right Aligned */}
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Box sx={{ width: '300px', fontSize: '0.9rem' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Total (Rupees):</Typography>
                      <Typography component="span">{formatNumber(viewDialog.data.totalAmount || 0)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Net Total:</Typography>
                      <Typography component="span">{formatNumber(viewDialog.data.totalAmount || 0)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography component="span" fontWeight={600}>Freight Charges:</Typography>
                      <Typography component="span">{formatNumber(viewDialog.data.shippingCost || 0)}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, fontStyle: 'italic' }}>
                      Rupees {numberToWords(viewDialog.data.totalAmount || 0)}
                    </Typography>
                  </Box>
                </Box>

                {/* Terms & Conditions */}
                <Box sx={{ mb: 3, border: '1px solid #ccc', p: 2, fontSize: '0.9rem' }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, textDecoration: 'underline' }}>
                    TERMS & CONDITIONS
                  </Typography>
                  <Box sx={{ lineHeight: 1.8 }}>
                    <Typography sx={{ mb: 1, fontWeight: 600 }}>Main Terms & Conditions</Typography>
                    <Box sx={{ mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Payment Terms:</Typography>
                      <Typography component="span" sx={{ ml: 1 }}>
                        {viewDialog.data.paymentTerms || '100% Advance Payment'}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Delivery Terms:</Typography>
                      <Typography component="span" sx={{ ml: 1 }}>
                        At-Site Delivery
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <Typography component="span" fontWeight={600}>Delivery Time.</Typography>
                      <Typography component="span" sx={{ ml: 1 }}>
                        Delivery within: {viewDialog.data.quotation?.deliveryTime || '03 days'} of confirmed PO & Payment
                      </Typography>
                    </Box>
                    <Typography sx={{ mb: 1 }}>
                      Rates Are Exclusive Of all The Taxes
                    </Typography>
                    {viewDialog.data.vendor?.cnic && (
                      <Typography sx={{ mb: 1 }}>
                        CNIC {viewDialog.data.vendor.cnic}
                      </Typography>
                    )}
                    {viewDialog.data.vendor?.payeeName && (
                      <Typography>
                        Payee Name: {viewDialog.data.vendor.payeeName}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Approval/Signature Section */}
                <Box sx={{ mt: 4 }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.85rem',
                      fontFamily: 'Arial, sans-serif'
                    }}
                  >
                    <tbody>
                      <tr>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '14%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 }, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500, '@media print': { fontSize: '0.7rem' } }}>
                              {viewDialog.data.approvalAuthorities?.preparedBy || ''}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Prepared By</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '14%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 }, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500, '@media print': { fontSize: '0.7rem' } }}>
                              {viewDialog.data.approvalAuthorities?.verifiedBy || ''}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Verified By: Procurement Committee</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '14%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 }, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500, '@media print': { fontSize: '0.7rem' } }}>
                              {viewDialog.data.approvalAuthorities?.authorisedRep || ''}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Authorised Rep.</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '14%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 }, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500, '@media print': { fontSize: '0.7rem' } }}>
                              {viewDialog.data.approvalAuthorities?.financeRep || ''}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Finance Rep.</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '14%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 }, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500, '@media print': { fontSize: '0.7rem' } }}>
                              {viewDialog.data.approvalAuthorities?.managerProcurement || ''}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Manager Procurement</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '15%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 }, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500, '@media print': { fontSize: '0.7rem' } }}>
                              {''}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>Senior Executive Director</Typography>
                        </td>
                        <td style={{ padding: '20px 10px', textAlign: 'center', width: '15%', verticalAlign: 'bottom' }}>
                          <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1, '@media print': { minHeight: '40px', mb: 0.5 }, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500, '@media print': { fontSize: '0.7rem' } }}>
                              {''}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', '@media print': { fontSize: '0.65rem' } }}>President</Typography>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Box>
              </Paper>
            </Box>
              )}
              {viewDialog.poDetailTab === 1 && (
            <Box sx={{ width: '100%', p: 2 }} className="print-content">
              {viewDialog.attachedGrns && viewDialog.attachedGrns.length > 0 ? viewDialog.attachedGrns.map((grn) => (
                <Paper
                  key={grn._id}
                  sx={{
                    p: { xs: 3, sm: 3.5, md: 4 },
                    maxWidth: '210mm',
                    mx: 'auto',
                    mt: 4,
                    backgroundColor: '#fff',
                    boxShadow: 'none',
                    width: '100%',
                    fontFamily: 'Arial, sans-serif',
                    border: '1px solid',
                    borderColor: 'divider',
                    '@media print': {
                      boxShadow: 'none',
                      p: 2.5,
                      maxWidth: '100%',
                      mx: 0,
                      width: '100%',
                      pageBreakBefore: 'always',
                      pageBreakInside: 'avoid'
                    }
                  }}
                >
                  <Typography variant="overline" color="textSecondary" sx={{ display: 'block', mb: 1 }}>Attached GRN (copy)</Typography>
                  <Grid container sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', pb: 2 }} alignItems="center">
                    <Grid item xs={4}>
                      <Typography variant="h6" fontWeight="bold">Taj Residencia</Typography>
                      <Typography variant="body2" color="textSecondary">Head Office</Typography>
                    </Grid>
                    <Grid item xs={4} sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight="bold">Goods Received Note</Typography>
                    </Grid>
                    <Grid item xs={4} />
                  </Grid>
                  <Grid container spacing={3} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="textSecondary">No.</Typography>
                      <Typography variant="body1" fontWeight="bold">{grn.receiveNumber || grn._id}</Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Supplier</Typography>
                      <Typography variant="body2">{[grn.supplier?.supplierId, grn.supplierName || grn.supplier?.name].filter(Boolean).join(' ') || '-'}</Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Address</Typography>
                      <Typography variant="body2">{grn.supplierAddress || grn.supplier?.address || '-'}</Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Narration</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{grn.narration || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="textSecondary">Date</Typography>
                      <Typography variant="body2">{formatGRNDate(grn.receiveDate)}</Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Currency</Typography>
                      <Typography variant="body2">{grn.currency || 'Rupees'}</Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>P.R No.</Typography>
                      <Typography variant="body2">{grn.prNumber || '—'}</Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>P.O No.</Typography>
                      <Typography variant="body2">{grn.poNumber || grn.purchaseOrder?.orderNumber || '—'}</Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Store</Typography>
                      <Typography variant="body2">{grn.store || '—'}</Typography>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>Gate Pass No.</Typography>
                      <Typography variant="body2">{grn.gatePassNo || '—'}</Typography>
                    </Grid>
                  </Grid>
                  <TableContainer component={Box} variant="outlined" sx={{ mb: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>S. No</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Product Code</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Unit</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Quantity</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Rate</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }} align="right">Value Excluding Sales Tax</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(grn.items || []).map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>{item.itemCode || '—'}</TableCell>
                            <TableCell>{item.itemName || '—'}</TableCell>
                            <TableCell>{item.unit || '—'}</TableCell>
                            <TableCell align="right">{formatGRNNumber(item.quantity)}</TableCell>
                            <TableCell align="right">{formatGRNNumber(item.unitPrice)}</TableCell>
                            <TableCell align="right">{formatGRNNumber(item.valueExcludingSalesTax ?? (item.quantity * item.unitPrice))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <Grid container spacing={1} sx={{ maxWidth: 320 }}>
                      <Grid item xs={6}><Typography variant="body2">Discount</Typography></Grid>
                      <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2">{formatGRNNumber(grn.discount)}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="body2">Other Charges</Typography></Grid>
                      <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2">{formatGRNNumber(grn.otherCharges)}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="body2" fontWeight="bold">Net Amount</Typography></Grid>
                      <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2" fontWeight="bold">{formatGRNNumber(grn.netAmount)}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="body2" fontWeight="bold">Total</Typography></Grid>
                      <Grid item xs={6} sx={{ textAlign: 'right' }}><Typography variant="body2" fontWeight="bold">{formatGRNNumber(grn.total ?? grn.netAmount)}</Typography></Grid>
                    </Grid>
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="caption" color="textSecondary">Observation</Typography>
                  <Typography variant="body2" sx={{ minHeight: 24 }}>{grn.observation || ' '}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 3 }}>
                    <Box>
                      <Typography variant="caption" color="textSecondary">Prepared By</Typography>
                      <Typography variant="body2" fontWeight="medium">{grn.preparedByName || (grn.receivedBy?.firstName && grn.receivedBy?.lastName ? `${grn.receivedBy.firstName} ${grn.receivedBy.lastName}` : '—')}</Typography>
                    </Box>
                    <Box sx={{ width: 120, height: 40, border: '1px dashed', borderColor: 'divider' }} />
                  </Box>
                </Paper>
              )) : (
                <Typography color="textSecondary" sx={{ py: 4, textAlign: 'center' }}>
                  No GRN(s) attached to this Purchase Order.
                </Typography>
              )}
            </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ '@media print': { display: 'none' } }}>
          <Button onClick={() => setViewDialog({ open: false, data: null, attachedGrns: [], poDetailTab: 0 })}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Print Styles for Dialog */}
      <Box
        component="style"
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4;
                margin: 15mm;
              }
              body * {
                visibility: hidden;
              }
              .MuiDialog-container,
              .MuiDialog-container *,
              .MuiDialog-paper,
              .MuiDialog-paper *,
              .print-content,
              .print-content * {
                visibility: visible;
              }
              .MuiDialog-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: 100% !important;
                display: block !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
              }
              .MuiDialog-paper {
                box-shadow: none !important;
                margin: 0 !important;
                max-width: 100% !important;
                width: 100% !important;
                height: auto !important;
                max-height: none !important;
                position: relative !important;
                transform: none !important;
                overflow: visible !important;
              }
              .MuiDialogContent-root {
                overflow: visible !important;
                padding: 0 !important;
                height: auto !important;
                max-height: none !important;
                margin: 0 !important;
              }
              .MuiDialogTitle-root {
                display: none !important;
              }
              .MuiDialogActions-root {
                display: none !important;
              }
              .MuiBackdrop-root {
                display: none !important;
              }
              .MuiPaper-root {
                box-shadow: none !important;
              }
            }
          `
        }}
      />

      <WorkflowHistoryDialog
        open={workflowHistoryDialog.open}
        onClose={() => setWorkflowHistoryDialog({ open: false, document: null })}
        document={workflowHistoryDialog.document}
        documentType="document"
      />

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialog.open} 
        onClose={() => setDeleteDialog({ open: false, id: null })}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this purchase order? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, id: null })}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseOrders;
