import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Edit as EditIcon,
  Payment as PaymentIcon,
  ArrowBack as ArrowBackIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  AccountBalance as AccountIcon,
  LocationOn as LocationIcon,
  Description as DescriptionIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import utilityBillService from '../../../services/utilityBillService';

const UtilityBillDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentData, setPaymentData] = useState({
    paidAmount: 0,
    paymentMethod: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const paymentMethods = ['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Credit Card', 'Other'];

  useEffect(() => {
    fetchBill();
  }, [id]);

  const fetchBill = async () => {
    try {
      setLoading(true);
      const response = await utilityBillService.getUtilityBill(id);
      setBill(response.data);
    } catch (err) {
      setError('Failed to fetch utility bill details');
      console.error('Error fetching bill:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    setPaymentData({
      paidAmount: bill.amount - bill.paidAmount,
      paymentMethod: '',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setPaymentDialog(true);
  };

  const handlePaymentSubmit = async () => {
    try {
      await utilityBillService.recordPayment(bill._id, paymentData);
      setPaymentDialog(false);
      fetchBill();
    } catch (err) {
      setError('Failed to record payment');
      console.error('Error recording payment:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'success';
      case 'Pending': return 'warning';
      case 'Overdue': return 'error';
      case 'Partial': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Paid': return <CheckCircleIcon />;
      case 'Pending': return <WarningIcon />;
      case 'Overdue': return <WarningIcon />;
      case 'Partial': return <InfoIcon />;
      default: return <InfoIcon />;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/utility-bills')}
        >
          Back to Bills
        </Button>
      </Box>
    );
  }

  if (!bill) {
    return (
      <Box>
        <Typography variant="h6" color="textSecondary">
          Utility bill not found
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/admin/utility-bills')}
          sx={{ mt: 2 }}
        >
          Back to Bills
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Utility Bill Details
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/utility-bills')}
          >
            Back to Bills
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/admin/utility-bills/${bill._id}/edit`)}
          >
            Edit Bill
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Bill Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Bill Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Bill ID
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.billId}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Utility Type
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.utilityType}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Provider
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.provider}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Account Number
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.accountNumber || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Bill Date
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatDate(bill.billDate)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Due Date
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatDate(bill.dueDate)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Location
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.location}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={bill.status}
                    color={getStatusColor(bill.status)}
                    size="small"
                    icon={getStatusIcon(bill.status)}
                  />
                </Grid>
                {bill.description && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      Description
                    </Typography>
                    <Typography variant="body1">
                      {bill.description}
                    </Typography>
                  </Grid>
                )}
                {bill.notes && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary">
                      Notes
                    </Typography>
                    <Typography variant="body1">
                      {bill.notes}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Reading Information */}
          {bill.previousReading !== undefined && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Reading Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">
                      Previous Reading
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {bill.previousReading}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">
                      Current Reading
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {bill.currentReading}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="body2" color="textSecondary">
                      Units Consumed
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {bill.units}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="textSecondary">
                      Rate Per Unit
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {formatCurrency(bill.ratePerUnit)}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Payment Information */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Total Amount
                </Typography>
                <Typography variant="h5" color="primary.main" fontWeight="bold">
                  {formatCurrency(bill.amount)}
                </Typography>
              </Box>
              
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Paid Amount
                </Typography>
                <Typography variant="h6" color="success.main" fontWeight="bold">
                  {formatCurrency(bill.paidAmount)}
                </Typography>
              </Box>
              
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Remaining Amount
                </Typography>
                <Typography variant="h6" color="error.main" fontWeight="bold">
                  {formatCurrency(bill.amount - bill.paidAmount)}
                </Typography>
              </Box>

              {bill.paymentMethod && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">
                    Payment Method
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {bill.paymentMethod}
                  </Typography>
                </Box>
              )}

              {bill.paymentDate && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">
                    Payment Date
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatDate(bill.paymentDate)}
                  </Typography>
                </Box>
              )}

              {bill.status !== 'Paid' && (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={handlePayment}
                  sx={{ mt: 2 }}
                >
                  Record Payment
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Tax Information */}
          {(bill.taxes?.gst > 0 || bill.taxes?.other > 0) && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Tax Breakdown
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <List dense>
                  {bill.taxes.gst > 0 && (
                    <ListItem>
                      <ListItemText
                        primary="GST"
                        secondary={formatCurrency(bill.taxes.gst)}
                      />
                    </ListItem>
                  )}
                  {bill.taxes.other > 0 && (
                    <ListItem>
                      <ListItemText
                        primary="Other Taxes"
                        secondary={formatCurrency(bill.taxes.other)}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Payment Amount"
                type="number"
                value={paymentData.paidAmount}
                onChange={(e) => setPaymentData({ ...paymentData, paidAmount: parseFloat(e.target.value) })}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                  label="Payment Method"
                >
                  {paymentMethods.map(method => (
                    <MenuItem key={method} value={method}>{method}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Payment Date"
                type="date"
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button onClick={handlePaymentSubmit} variant="contained">Record Payment</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UtilityBillDetails;