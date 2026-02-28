import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Container,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';

const PublicQuotationForm = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [requisition, setRequisition] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [successDialog, setSuccessDialog] = useState(false);

  const [formData, setFormData] = useState({
    quotationDate: new Date().toISOString().split('T')[0],
    validityDays: 30,
    deliveryTime: '',
    paymentTerms: '',
    notes: '',
    items: []
  });

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/procurement/public-quotation/${token}`);
      
      if (response.data.success) {
        setInvitation(response.data.data.invitation);
        setRequisition(response.data.data.requisition);
        setVendor(response.data.data.vendor);
        
        // Initialize items from requisition
        const items = response.data.data.requisition.items.map(item => ({
          description: item.itemName,
          quantity: item.quantity,
          unit: item.unit || 'pcs',
          unitPrice: 0,
          taxRate: 0,
          discount: 0,
          amount: 0
        }));
        
        setFormData(prev => ({
          ...prev,
          items
        }));
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to load quotation form');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    // Recalculate amount
    const item = newItems[index];
    const subtotal = item.quantity * item.unitPrice;
    const discountAmount = item.discount || 0;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * (item.taxRate || 0)) / 100;
    newItems[index].amount = afterDiscount + taxAmount;
    
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError('');

      // At least one item must have quantity and unit price > 0 (partial quotations allowed - can skip items)
      const quotedItems = formData.items.filter(item => 
        (Number(item.quantity) || 0) > 0 && (Number(item.unitPrice) || 0) > 0
      );

      if (quotedItems.length === 0) {
        setError('At least one item must have quantity and unit price greater than 0. Leave quantity and price as 0 for items you are not quoting.');
        return;
      }

      const response = await api.post(`/procurement/public-quotation/${token}`, formData);
      
      if (response.data.success) {
        setSuccess(true);
        setSuccessDialog(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit quotation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error && !requisition) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Paper>
      </Container>
    );
  }

  if (success) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>Quotation Submitted Successfully!</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Thank you for submitting your quotation. Our procurement team will review it and contact you soon.
          </Typography>
        </Paper>
      </Container>
    );
  }

  const totalAmount = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            Submit Quotation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Requisition: {requisition?.indentNumber} - {requisition?.title}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Requisition Details */}
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Requisition Details</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Requisition Number</Typography>
              <Typography variant="body1" fontWeight="bold">{requisition?.indentNumber}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Department</Typography>
              <Typography variant="body1">{requisition?.department?.name || '-'}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">Title</Typography>
              <Typography variant="body1">{requisition?.title}</Typography>
            </Grid>
            {requisition?.description && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">Description</Typography>
                <Typography variant="body1">{requisition.description}</Typography>
              </Grid>
            )}
          </Grid>
        </Paper>

        {/* Vendor Info */}
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Your Information</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Company Name</Typography>
              <Typography variant="body1" fontWeight="bold">{vendor?.name}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Contact Person</Typography>
              <Typography variant="body1">{vendor?.contactPerson}</Typography>
            </Grid>
          </Grid>
        </Paper>

        <Divider sx={{ my: 3 }} />

        {/* Quotation Form */}
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Quotation Details</Typography>
        
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="date"
              label="Quotation Date"
              value={formData.quotationDate}
              onChange={(e) => setFormData({ ...formData, quotationDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Validity Days"
              value={formData.validityDays}
              onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value) || 30 })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Delivery Time"
              value={formData.deliveryTime}
              onChange={(e) => setFormData({ ...formData, deliveryTime: e.target.value })}
              placeholder="e.g., 2-3 weeks"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Payment Terms"
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              placeholder="e.g., Cash, Credit 30 days"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes / Terms & Conditions"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </Grid>
        </Grid>

        {/* Items Table */}
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Items & Pricing</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          You can quote for only some items. Leave quantity and unit price as 0 for items you are not quoting. At least one item must have quantity and price &gt; 0.
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Item</strong></TableCell>
                <TableCell align="center"><strong>Quantity</strong></TableCell>
                <TableCell align="center"><strong>Unit</strong></TableCell>
                <TableCell align="right"><strong>Unit Price</strong></TableCell>
                <TableCell align="right"><strong>Tax Rate %</strong></TableCell>
                <TableCell align="right"><strong>Discount</strong></TableCell>
                <TableCell align="right"><strong>Amount</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {formData.items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Leave empty if not quoting this item"
                      value={item.description ?? ''}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <TextField
                      size="small"
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01 }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <TextField
                      size="small"
                      value={item.unit ?? ''}
                      onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      placeholder="pcs"
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01 }}
                      sx={{ width: 120 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={item.taxRate}
                      onChange={(e) => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, max: 100, step: 0.01 }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={item.discount}
                      onChange={(e) => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01 }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="bold">
                      {formatPKR(item.amount)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Total Amount: <strong>{formatPKR(totalAmount)}</strong>
          </Typography>
        </Box>

        {invitation?.expiresAt && (
          <Alert severity="info" sx={{ mt: 2 }}>
            This form expires on {formatDate(invitation.expiresAt)}. Please submit before the expiration date.
          </Alert>
        )}

        <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={submitting ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSubmit}
            disabled={submitting || formData.items.length === 0}
          >
            {submitting ? 'Submitting...' : 'Submit Quotation'}
          </Button>
        </Box>
      </Paper>

      {/* Success Dialog */}
      <Dialog open={successDialog} onClose={() => setSuccessDialog(false)}>
        <DialogTitle>Quotation Submitted Successfully!</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your quotation has been submitted successfully. Our procurement team will review it and contact you soon.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuccessDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PublicQuotationForm;
