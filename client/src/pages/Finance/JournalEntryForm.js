import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Alert,
  CircularProgress,
  alpha,
  useTheme,
  Divider,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  AccountBalance as AccountBalanceIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';

const JournalEntryForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const theme = useTheme();
  const isEdit = Boolean(id);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    department: 'general',
    module: 'general',
    referenceId: '',
    referenceType: 'manual',
    lines: [
      { account: '', description: '', debit: 0, credit: 0, department: 'general' },
      { account: '', description: '', debit: 0, credit: 0, department: 'general' }
    ]
  });

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAccounts();
    if (isEdit) {
      fetchJournalEntry();
    }
  }, [isEdit, id]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/finance/accounts?limit=1000');
      if (response.data.success) {
        setAccounts(response.data.data.accounts || []);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setError('Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchJournalEntry = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/finance/journal-entries/${id}`);
      if (response.data.success) {
        setFormData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching journal entry:', error);
      setError('Failed to fetch journal entry');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLineChange = (index, field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => 
        i === index ? { ...line, [field]: value } : line
      )
    }));
  };

  const addLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, { account: '', description: '', debit: 0, credit: 0, department: 'general' }]
    }));
  };

  const removeLine = (index) => {
    if (formData.lines.length > 2) {
      setFormData(prev => ({
        ...prev,
        lines: prev.lines.filter((_, i) => i !== index)
      }));
    }
  };

  const calculateTotals = () => {
    const totalDebits = formData.lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredits = formData.lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    return { totalDebits, totalCredits };
  };

  const isBalanced = () => {
    const { totalDebits, totalCredits } = calculateTotals();
    return Math.abs(totalDebits - totalCredits) < 0.01;
  };

  const validateForm = () => {
    if (!formData.description.trim()) {
      setError('Description is required');
      return false;
    }

    if (formData.lines.length < 2) {
      setError('At least 2 lines are required');
      return false;
    }

    for (let i = 0; i < formData.lines.length; i++) {
      const line = formData.lines[i];
      if (!line.account) {
        setError(`Account is required for line ${i + 1}`);
        return false;
      }
      if (line.debit > 0 && line.credit > 0) {
        setError(`Line ${i + 1} cannot have both debit and credit amounts`);
        return false;
      }
      if (line.debit === 0 && line.credit === 0) {
        setError(`Line ${i + 1} must have either debit or credit amount`);
        return false;
      }
    }

    if (!isBalanced()) {
      setError('Journal entry must be balanced (total debits = total credits)');
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      const response = isEdit 
        ? await api.put(`/finance/journal-entries/${id}`, formData)
        : await api.post('/finance/journal-entries', formData);
      
      if (response.data.success) {
        setSuccess(isEdit ? 'Journal entry updated successfully!' : 'Journal entry created successfully!');
        setTimeout(() => {
          navigate('/finance/journal-entries');
        }, 1500);
      } else {
        setError(response.data.message || 'Failed to save journal entry');
      }
    } catch (error) {
      console.error('Error saving journal entry:', error);
      setError(error.response?.data?.message || 'Failed to save journal entry');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/finance/journal-entries');
  };

  const { totalDebits, totalCredits } = calculateTotals();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <IconButton onClick={handleCancel} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
            <ArrowBackIcon />
          </IconButton>
          <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
            <AccountBalanceIcon />
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
              {isEdit ? 'Edit Journal Entry' : 'Create Journal Entry'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {isEdit ? 'Modify journal entry details and lines' : 'Create a new journal entry with double-entry accounting'}
            </Typography>
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

      {/* Balance Status */}
      <Card sx={{ mb: 3, bgcolor: isBalanced() ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1) }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isBalanced() ? (
              <CheckCircleIcon color="success" />
            ) : (
              <ErrorIcon color="error" />
            )}
            <Typography variant="h6" color={isBalanced() ? 'success.main' : 'error.main'}>
              {isBalanced() ? 'Entry is Balanced' : 'Entry is Not Balanced'}
            </Typography>
            <Typography variant="body1" sx={{ ml: 'auto' }}>
              Debits: {formatPKR(totalDebits)} | Credits: {formatPKR(totalCredits)} | Difference: {formatPKR(Math.abs(totalDebits - totalCredits))}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Header Information */}
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Entry Information
                </Typography>
                <Divider sx={{ mb: 3 }} />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  label="Entry Date"
                  value={formData.date}
                  onChange={handleInputChange('date')}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Reference"
                  value={formData.reference}
                  onChange={handleInputChange('reference')}
                  placeholder="Optional reference number"
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth required>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={formData.department}
                    onChange={handleInputChange('department')}
                    label="Department"
                  >
                    <MenuItem value="general">General</MenuItem>
                    <MenuItem value="hr">HR</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="procurement">Procurement</MenuItem>
                    <MenuItem value="sales">Sales</MenuItem>
                    <MenuItem value="finance">Finance</MenuItem>
                    <MenuItem value="audit">Audit</MenuItem>
                    <MenuItem value="finance">Finance</MenuItem>
                    <MenuItem value="taj_utilities">Taj Utilities</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth required>
                  <InputLabel>Module</InputLabel>
                  <Select
                    value={formData.module}
                    onChange={handleInputChange('module')}
                    label="Module"
                  >
                    <MenuItem value="general">General</MenuItem>
                    <MenuItem value="payroll">Payroll</MenuItem>
                    <MenuItem value="procurement">Procurement</MenuItem>
                    <MenuItem value="sales">Sales</MenuItem>
                    <MenuItem value="hr">HR</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="audit">Audit</MenuItem>
                    <MenuItem value="finance">Finance</MenuItem>
                    <MenuItem value="taj_utilities">Taj Utilities</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  multiline
                  rows={2}
                  label="Description"
                  value={formData.description}
                  onChange={handleInputChange('description')}
                  placeholder="Enter a clear description of this journal entry"
                />
              </Grid>

              {/* Journal Entry Lines */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Journal Entry Lines
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addLine}
                  >
                    Add Line
                  </Button>
                </Box>
                <Divider sx={{ mb: 3 }} />
              </Grid>

              <Grid item xs={12}>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Account</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Debit</TableCell>
                        <TableCell align="right">Credit</TableCell>
                        <TableCell>Department</TableCell>
                        <TableCell width={50}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formData.lines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <FormControl fullWidth required>
                              <Select
                                value={line.account}
                                onChange={handleLineChange(index, 'account')}
                                displayEmpty
                              >
                                <MenuItem value="" disabled>
                                  Select Account
                                </MenuItem>
                                {accounts.map((account) => (
                                  <MenuItem key={account._id} value={account._id}>
                                    {account.accountNumber} - {account.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              value={line.description}
                              onChange={handleLineChange(index, 'description')}
                              placeholder="Line description"
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={line.debit}
                              onChange={handleLineChange(index, 'debit')}
                              inputProps={{ min: 0, step: 0.01 }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={line.credit}
                              onChange={handleLineChange(index, 'credit')}
                              inputProps={{ min: 0, step: 0.01 }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <FormControl fullWidth size="small">
                              <Select
                                value={line.department}
                                onChange={handleLineChange(index, 'department')}
                              >
                                <MenuItem value="general">General</MenuItem>
                                <MenuItem value="hr">HR</MenuItem>
                                <MenuItem value="admin">Admin</MenuItem>
                                <MenuItem value="procurement">Procurement</MenuItem>
                                <MenuItem value="sales">Sales</MenuItem>
                                <MenuItem value="finance">Finance</MenuItem>
                                <MenuItem value="audit">Audit</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            {formData.lines.length > 2 && (
                              <Tooltip title="Remove Line">
                                <IconButton 
                                  size="small" 
                                  color="error"
                                  onClick={() => removeLine(index)}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Totals */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 4, mt: 2 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="textSecondary">
                      Total Debits
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {formatPKR(totalDebits)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="textSecondary">
                      Total Credits
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {formatPKR(totalCredits)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" color="textSecondary">
                      Difference
                    </Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: isBalanced() ? 'success.main' : 'error.main'
                      }}
                    >
                      {formatPKR(Math.abs(totalDebits - totalCredits))}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4, pt: 3, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                disabled={saving || !isBalanced()}
                sx={{ minWidth: 120 }}
              >
                {saving ? 'Saving...' : (isEdit ? 'Update Entry' : 'Create Entry')}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default JournalEntryForm;
