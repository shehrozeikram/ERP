import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  CircularProgress,
  LinearProgress,
  TextField,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ApproveIcon,
  Payment as PayIcon,
  Send as SubmitIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import pettyCashService from '../../../services/pettyCashService';

const PettyCashDashboard = () => {
  const navigate = useNavigate();
  const [funds, setFunds] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null, type: '' });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const fundsResponse = await pettyCashService.getFunds();
      
      // Filter funds by selected month
      const filteredFunds = fundsResponse.data.filter(fund => {
        const fundDate = new Date(fund.fundDate || fund.createdAt);
        const fundMonth = fundDate.toISOString().slice(0, 7); // YYYY-MM format
        return fundMonth === selectedMonth;
      });
      
      setFunds(filteredFunds);
      setExpenses([]); // No longer using expenses
      setError(null);
    } catch (err) {
      setError('Failed to fetch petty cash data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    try {
      if (deleteDialog.type === 'fund') {
        await pettyCashService.deleteFund(deleteDialog.item._id);
      } else {
        await pettyCashService.deleteExpense(deleteDialog.item._id);
      }
      setDeleteDialog({ open: false, item: null, type: '' });
      fetchData();
    } catch (err) {
      setError('Failed to delete item');
      console.error('Error deleting:', err);
    }
  };

  const handleStatusUpdate = async (fundId, newStatus) => {
    try {
      await pettyCashService.updateFund(fundId, { status: newStatus });
      fetchData();
    } catch (err) {
      setError(`Failed to update status to ${newStatus}`);
      console.error('Error updating status:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'default',
      'Pending': 'warning',
      'Approved': 'info',
      'Paid': 'success',
      'Rejected': 'error'
    };
    return colors[status] || 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getUtilizationColor = (percentage) => {
    if (percentage < 50) return 'success';
    if (percentage < 80) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Petty Cash Management
        </Typography>
        <Box display="flex" gap={2} alignItems="center" mb={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/petty-cash/funds/new')}
          >
            Add Fund
          </Button>
          
          <TextField
            label="Select Month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            size="small"
            sx={{ minWidth: 150 }}
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Funds Overview - {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Typography>

          <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fund ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Current Balance</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Payment Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Custodian</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {funds.map((fund) => {
                    return (
                      <TableRow key={fund._id}>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {fund.fundId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {fund.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(fund.currentBalance)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {fund.vendor || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {fund.paymentType || 'Cash'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={fund.status}
                            color={getStatusColor(fund.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {fund.custodian ? (
                            <Typography variant="body2">
                              {fund.custodian.firstName} {fund.custodian.lastName}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No Custodian
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/admin/petty-cash/funds/${fund._id}/edit`)}
                          >
                            <EditIcon />
                          </IconButton>
                          
                          {fund.status === 'Draft' && (
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleStatusUpdate(fund._id, 'Pending')}
                              title="Submit for Approval"
                            >
                              <SubmitIcon />
                            </IconButton>
                          )}
                          
                          {fund.status === 'Pending' && (
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleStatusUpdate(fund._id, 'Approved')}
                              title="Approve"
                            >
                              <ApproveIcon />
                            </IconButton>
                          )}
                          
                          {fund.status === 'Approved' && (
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => handleStatusUpdate(fund._id, 'Paid')}
                              title="Mark as Paid"
                            >
                              <PayIcon />
                            </IconButton>
                          )}
                          
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteDialog({ open: true, item: fund, type: 'fund' })}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, item: null, type: '' })}>
        <DialogTitle>Delete {deleteDialog.type === 'fund' ? 'Fund' : 'Expense'}</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {deleteDialog.type === 'fund' ? 'fund' : 'expense'} {deleteDialog.item?.fundId || deleteDialog.item?.expenseId}?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, item: null, type: '' })}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PettyCashDashboard;
