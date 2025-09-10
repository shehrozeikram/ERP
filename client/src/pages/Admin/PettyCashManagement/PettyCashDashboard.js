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
  Tabs,
  Tab,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
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
  const [tabValue, setTabValue] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null, type: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [fundsResponse, expensesResponse] = await Promise.all([
        pettyCashService.getFunds(),
        pettyCashService.getExpenses()
      ]);
      
      setFunds(fundsResponse.data);
      setExpenses(expensesResponse.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch petty cash data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const getStatusColor = (status) => {
    const colors = {
      'Active': 'success',
      'Inactive': 'default',
      'Suspended': 'warning',
      'Pending': 'warning',
      'Approved': 'success',
      'Rejected': 'error',
      'Paid': 'info'
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
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<ReceiptIcon />}
            onClick={() => navigate('/admin/petty-cash/expenses')}
          >
            Manage Expenses
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/petty-cash/funds/new')}
          >
            Add Fund
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
            <Tab label="Funds Overview" />
            <Tab label="Recent Expenses" />
          </Tabs>

          {tabValue === 0 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fund ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Current Balance</TableCell>
                    <TableCell>Max Amount</TableCell>
                    <TableCell>Utilization</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Custodian</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {funds.map((fund) => {
                    const utilization = ((fund.maxAmount - fund.currentBalance) / fund.maxAmount) * 100;
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
                            {formatCurrency(fund.maxAmount)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <LinearProgress
                              variant="determinate"
                              value={utilization}
                              color={getUtilizationColor(utilization)}
                              sx={{ width: 60, height: 8 }}
                            />
                            <Typography variant="caption">
                              {utilization.toFixed(1)}%
                            </Typography>
                          </Box>
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
                            onClick={() => navigate(`/admin/petty-cash/funds/${fund._id}`)}
                          >
                            <EditIcon />
                          </IconButton>
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
          )}

          {tabValue === 1 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Expense ID</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Requested By</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {expenses.slice(0, 10).map((expense) => (
                    <TableRow key={expense._id}>
                      <TableCell>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {expense.expenseId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {expense.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(expense.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={expense.category} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={expense.status}
                          color={getStatusColor(expense.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {expense.requestedBy ? (
                          <Typography variant="body2">
                            {expense.requestedBy.firstName} {expense.requestedBy.lastName}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Unknown
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(expense.expenseDate).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/admin/petty-cash/expenses/${expense._id}`)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteDialog({ open: true, item: expense, type: 'expense' })}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
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
