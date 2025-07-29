import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  LinearProgress,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Payment as PaymentIcon,
  AccountBalance as DisburseIcon,
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Comment as CommentIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { loanService } from '../../services/loanService';
import { formatPKR } from '../../utils/currency';

const LoanDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dialog states
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [rejectionDialog, setRejectionDialog] = useState(false);
  const [disbursementDialog, setDisbursementDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [noteDialog, setNoteDialog] = useState(false);
  
  // Form states
  const [rejectionReason, setRejectionReason] = useState('');
  const [disbursementData, setDisbursementData] = useState({
    disbursementMethod: 'Bank Transfer',
    bankAccount: ''
  });
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'Salary Deduction'
  });
  const [noteContent, setNoteContent] = useState('');

  useEffect(() => {
    fetchLoan();
  }, [id]);

  const fetchLoan = async () => {
    try {
      setLoading(true);
      const data = await loanService.getLoanById(id);
      setLoan(data);
    } catch (error) {
      setError(error.message || 'Failed to fetch loan details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      await loanService.approveLoan(id);
      setSuccess('Loan approved successfully');
      setApprovalDialog(false);
      fetchLoan();
    } catch (error) {
      setError(error.message || 'Failed to approve loan');
    }
  };

  const handleReject = async () => {
    try {
      await loanService.rejectLoan(id, rejectionReason);
      setSuccess('Loan rejected successfully');
      setRejectionDialog(false);
      setRejectionReason('');
      fetchLoan();
    } catch (error) {
      setError(error.message || 'Failed to reject loan');
    }
  };

  const handleDisburse = async () => {
    try {
      await loanService.disburseLoan(id, disbursementData);
      setSuccess('Loan disbursed successfully');
      setDisbursementDialog(false);
      fetchLoan();
    } catch (error) {
      setError(error.message || 'Failed to disburse loan');
    }
  };

  const handlePayment = async () => {
    try {
      await loanService.processPayment(id, paymentData);
      setSuccess('Payment processed successfully');
      setPaymentDialog(false);
      setPaymentData({ amount: '', paymentMethod: 'Salary Deduction' });
      fetchLoan();
    } catch (error) {
      setError(error.message || 'Failed to process payment');
    }
  };

  const handleAddNote = async () => {
    try {
      await loanService.addNote(id, noteContent);
      setSuccess('Note added successfully');
      setNoteDialog(false);
      setNoteContent('');
      fetchLoan();
    } catch (error) {
      setError(error.message || 'Failed to add note');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'warning',
      'Approved': 'info',
      'Rejected': 'error',
      'Disbursed': 'success',
      'Active': 'secondary',
      'Completed': 'success',
      'Defaulted': 'error'
    };
    return colors[status] || 'default';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderLoanSummary = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Loan Information
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Employee
              </Typography>
              <Typography variant="body1">
                {loan.employee?.firstName} {loan.employee?.lastName} ({loan.employee?.employeeId})
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Loan Type
              </Typography>
              <Typography variant="body1">{loan.loanType}</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Purpose
              </Typography>
              <Typography variant="body1">{loan.purpose}</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Status
              </Typography>
              <Chip
                label={loan.status}
                color={getStatusColor(loan.status)}
                size="small"
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Financial Details
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Loan Amount
              </Typography>
              <Typography variant="h6" color="primary">
                {formatPKR(loan.loanAmount)}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Monthly EMI
              </Typography>
              <Typography variant="h6" color="secondary">
                {formatPKR(loan.monthlyInstallment)}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Total Payable
              </Typography>
              <Typography variant="h6" color="error">
                {formatPKR(loan.totalPayable)}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Outstanding Balance
              </Typography>
              <Typography variant="h6" color="warning.main">
                {formatPKR(loan.outstandingBalance)}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Progress
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: '100%', mr: 1 }}>
              <LinearProgress
                variant="determinate"
                value={loan.progressPercentage || 0}
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {loan.progressPercentage || 0}%
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderLoanSchedule = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Loan Schedule
        </Typography>
        
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Installment</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Principal</TableCell>
                <TableCell>Interest</TableCell>
                <TableCell>Balance</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loan.loanSchedule?.map((installment) => (
                <TableRow key={installment.installmentNumber}>
                  <TableCell>{installment.installmentNumber}</TableCell>
                  <TableCell>{formatDate(installment.dueDate)}</TableCell>
                                      <TableCell>{formatPKR(installment.amount)}</TableCell>
                    <TableCell>{formatPKR(installment.principal)}</TableCell>
                    <TableCell>{formatPKR(installment.interest)}</TableCell>
                    <TableCell>{formatPKR(installment.balance)}</TableCell>
                  <TableCell>
                    <Chip
                      label={installment.status}
                      size="small"
                      color={
                        installment.status === 'Paid' ? 'success' :
                        installment.status === 'Overdue' ? 'error' :
                        installment.status === 'Partial' ? 'warning' : 'default'
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  const renderGuarantorInfo = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Guarantor Information
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Name
            </Typography>
            <Typography variant="body1">
              {loan.guarantor?.name || 'Not provided'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Relationship
            </Typography>
            <Typography variant="body1">
              {loan.guarantor?.relationship || 'Not provided'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Phone
            </Typography>
            <Typography variant="body1">
              {loan.guarantor?.phone || 'Not provided'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              ID Card
            </Typography>
            <Typography variant="body1">
              {loan.guarantor?.idCard || 'Not provided'}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderNotes = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            <CommentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Notes & Comments
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setNoteDialog(true)}
            size="small"
          >
            Add Note
          </Button>
        </Box>
        
        {loan.notes?.length > 0 ? (
          <List>
            {loan.notes.map((note, index) => (
              <ListItem key={index} alignItems="flex-start">
                <ListItemIcon>
                  <CommentIcon />
                </ListItemIcon>
                <ListItemText
                  primary={note.content}
                  secondary={`${note.addedBy?.firstName} ${note.addedBy?.lastName} - ${formatDate(note.addedAt)}`}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No notes added yet.
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderActionButtons = () => {
    const buttons = [];

    if (loan.status === 'Pending') {
      buttons.push(
        <Button
          key="approve"
          variant="contained"
          color="success"
          startIcon={<ApproveIcon />}
          onClick={() => setApprovalDialog(true)}
          sx={{ mr: 1 }}
        >
          Approve
        </Button>,
        <Button
          key="reject"
          variant="contained"
          color="error"
          startIcon={<RejectIcon />}
          onClick={() => setRejectionDialog(true)}
          sx={{ mr: 1 }}
        >
          Reject
        </Button>
      );
    }

    if (loan.status === 'Approved') {
      buttons.push(
        <Button
          key="disburse"
          variant="contained"
          color="primary"
          startIcon={<DisburseIcon />}
          onClick={() => setDisbursementDialog(true)}
          sx={{ mr: 1 }}
        >
          Disburse
        </Button>
      );
    }

    if (['Active', 'Disbursed'].includes(loan.status)) {
      buttons.push(
        <Button
          key="payment"
          variant="contained"
          color="secondary"
          startIcon={<PaymentIcon />}
          onClick={() => setPaymentDialog(true)}
          sx={{ mr: 1 }}
        >
          Process Payment
        </Button>
      );
    }

    if (loan.status === 'Pending') {
      buttons.push(
        <Button
          key="edit"
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => navigate(`/hr/loans/${id}/edit`)}
        >
          Edit
        </Button>
      );
    }

    return buttons;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!loan) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Loan not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/hr/loans')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4" component="h1">
          Loan Details
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        {renderActionButtons()}
      </Box>

      {renderLoanSummary()}
      {renderLoanSchedule()}
      {renderGuarantorInfo()}
      {renderNotes()}

      {/* Approval Dialog */}
      <Dialog open={approvalDialog} onClose={() => setApprovalDialog(false)}>
        <DialogTitle>Approve Loan</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to approve this loan application?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialog(false)}>Cancel</Button>
          <Button onClick={handleApprove} color="success" variant="contained">
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialog} onClose={() => setRejectionDialog(false)}>
        <DialogTitle>Reject Loan</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Rejection Reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectionDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleReject} 
            color="error" 
            variant="contained"
            disabled={!rejectionReason.trim()}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Disbursement Dialog */}
      <Dialog open={disbursementDialog} onClose={() => setDisbursementDialog(false)}>
        <DialogTitle>Disburse Loan</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Disbursement Method</InputLabel>
                <Select
                  value={disbursementData.disbursementMethod}
                  label="Disbursement Method"
                  onChange={(e) => setDisbursementData(prev => ({
                    ...prev,
                    disbursementMethod: e.target.value
                  }))}
                >
                  {loanService.getDisbursementMethodOptions().map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Bank Account (if applicable)"
                value={disbursementData.bankAccount}
                onChange={(e) => setDisbursementData(prev => ({
                  ...prev,
                  bankAccount: e.target.value
                }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisbursementDialog(false)}>Cancel</Button>
          <Button onClick={handleDisburse} color="primary" variant="contained">
            Disburse
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)}>
        <DialogTitle>Process Payment</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Payment Amount"
                value={paymentData.amount}
                onChange={(e) => setPaymentData(prev => ({
                  ...prev,
                  amount: e.target.value
                }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentData.paymentMethod}
                  label="Payment Method"
                  onChange={(e) => setPaymentData(prev => ({
                    ...prev,
                    paymentMethod: e.target.value
                  }))}
                >
                  {loanService.getPaymentMethodOptions().map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button 
            onClick={handlePayment} 
            color="secondary" 
            variant="contained"
            disabled={!paymentData.amount || paymentData.amount <= 0}
          >
            Process Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={noteDialog} onClose={() => setNoteDialog(false)}>
        <DialogTitle>Add Note</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Note Content"
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddNote} 
            color="primary" 
            variant="contained"
            disabled={!noteContent.trim()}
          >
            Add Note
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoanDetail; 