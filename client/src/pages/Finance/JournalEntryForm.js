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
  Avatar,
  Autocomplete
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
import { useFinanceCompany } from '../../context/FinanceCompanyContext';
import FinanceCompanySelector from '../../components/Finance/FinanceCompanySelector';
import { useAuth } from '../../contexts/AuthContext';


const JournalEntryForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const theme = useTheme();
  const isEdit = Boolean(id);
  const { selectedCompanyId } = useFinanceCompany();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    department: '',
    project: '',
    costCenter: '',
    referenceId: '',
    referenceType: 'manual',
    financeApprovalAuthorities: {
      accountsOfficerUser: null,
      accountsManagerUser: null,
      financeControllerUser: null
    },
    lines: [
      { account: '', reference: '', description: '', debit: 0, credit: 0, department: '', partyType: '', party: '' },
      { account: '', reference: '', description: '', debit: 0, credit: 0, department: '', partyType: '', party: '' }
    ]
  });

  const [accounts, setAccounts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  useEffect(() => {
    fetchDepartments();
    fetchProjects();
    fetchVendors();
    fetchCustomers();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchAccounts();
      fetchCostCenters();
    }
    if (isEdit) {
      fetchJournalEntry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch fns are stable for this form lifecycle
  }, [isEdit, id, selectedCompanyId]);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/indents/departments');
      if (response.data.success) {
        setDepartments(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await api.get('/hr/projects');
      if (response.data.success) {
        setProjects(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch projects', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await api.get('/procurement/vendors', { params: { limit: 1000 } });
      if (res.data.success) {
        setVendors(res.data.data.vendors || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/finance/customers', { params: { limit: 1000, status: 'active' } });
      if (res.data.success) {
        setCustomers(res.data.data.customers || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/hr/employees?getAll=true');
      if (res.data.success) {
        setEmployees(res.data.data || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchCostCenters = async () => {
    try {
      const response = await api.get('/finance/cost-centers');
      if (response.data.success) {
        setCostCenters(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch cost centers', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/finance/accounts', {
        params: { limit: 1000, companyId: selectedCompanyId }
      });
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
        const entry = response.data.data;
        const entryCompanyId = entry.companyId?._id || entry.companyId || selectedCompanyId;
        
        // Fetch accounts specifically for this entry's company if needed
        if (entryCompanyId) {
          try {
            const accRes = await api.get('/finance/accounts', {
              params: { limit: 1000, companyId: entryCompanyId }
            });
            if (accRes.data.success) {
              setAccounts(accRes.data.data.accounts || []);
            }
          } catch (accErr) {
            console.error('Error fetching accounts for journal entry company:', accErr);
          }
        }

        // Normalize lines: if account is a populated object, extract _id for the Select value
        // but keep the full object so we can display account name
        const normalizedLines = (entry.lines || []).map(line => ({
          ...line,
          account: line.account?._id || line.account || '',
          reference: line.reference || '',
          department: line.department?._id || line.department || '',
          costCenter: line.costCenter?._id || line.costCenter || '',
          partyType: line.partyType || '',
          party: line.party?._id || line.party || '',
          _accountObj: line.account // preserve full object for display
        }));
        setFormData({ 
          ...entry, 
          companyId: entryCompanyId,
          date: entry.date ? new Date(entry.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          department: entry.department?._id || entry.department || '',
          costCenter: entry.costCenter?._id || entry.costCenter || '',
          lines: normalizedLines 
        });
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

  const getAccountById = (accountId) =>
    accounts.find((a) => String(a._id) === String(accountId)) || null;

  const isAccountsPayableAccount = (account) => {
    if (!account) return false;
    const num = String(account.accountNumber || '');
    const name = String(account.name || '').toLowerCase();
    const detail = String(account.detailType || '').toLowerCase();
    return (
      num === '2100' ||
      num === '2001' ||
      name.includes('accounts payable') ||
      detail.includes('accounts payable')
    );
  };

  const isAccountsReceivableAccount = (account) => {
    if (!account) return false;
    const num = String(account.accountNumber || '');
    const name = String(account.name || '').toLowerCase();
    const detail = String(account.detailType || '').toLowerCase();
    return (
      num === '1100' ||
      num === '1200' ||
      name.includes('accounts receivable') ||
      detail.includes('accounts receivable')
    );
  };

  const getAllowedPartyTypes = (accountId) => {
    const account = getAccountById(accountId);
    if (isAccountsPayableAccount(account)) return ['Vendor', 'Employee'];
    if (isAccountsReceivableAccount(account)) return ['Customer'];
    return ['Vendor', 'Customer', 'Employee'];
  };

  const handleLineChange = (index, field, directValue) => {
    if (directValue !== undefined) {
      setFormData(prev => ({
        ...prev,
        lines: prev.lines.map((line, i) => 
          i === index ? { ...line, [field]: directValue } : line
        )
      }));
    } else {
      return (event) => {
        const value = event?.target?.value;
        setFormData(prev => ({
          ...prev,
          lines: prev.lines.map((line, i) => 
            i === index ? { ...line, [field]: value } : line
          )
        }));
      };
    }
  };

  const handleLineChangeValue = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => {
        if (i !== index) return line;
        if (field === 'account') {
          const allowed = (() => {
            const account = accounts.find((a) => String(a._id) === String(value)) || null;
            if (isAccountsPayableAccount(account)) return ['Vendor', 'Employee'];
            if (isAccountsReceivableAccount(account)) return ['Customer'];
            return ['Vendor', 'Customer', 'Employee'];
          })();
          const partyTypeStillValid = !line.partyType || allowed.includes(line.partyType);
          return {
            ...line,
            account: value,
            ...(partyTypeStillValid
              ? {}
              : { partyType: '', party: '' })
          };
        }
        return { ...line, [field]: value };
      })
    }));
  };

  const addLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, { account: '', reference: '', description: '', debit: 0, credit: 0, department: '', partyType: '', party: '' }]
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

    const targetCompanyId = formData.companyId || selectedCompanyId;
    if (!targetCompanyId) {
      setError('Select a finance company before saving a journal entry');
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      const payload = { 
        ...formData, 
        companyId: targetCompanyId,
        module: formData.module || 'general' 
      };
      const response = isEdit 
        ? await api.put(`/finance/journal-entries/${id}`, payload)
        : await api.post('/finance/journal-entries', payload);
      
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

  // ── READ-ONLY VIEW for reversed entries only ────────────────────────────
  if (isEdit && (formData.status === 'reversed' || formData.isReversed)) {
    const totalDr = (formData.lines || []).reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCr = (formData.lines || []).reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    const balanced = Math.abs(totalDr - totalCr) < 0.01;
    return (
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/finance/journal-entries')} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              <ArrowBackIcon />
            </IconButton>
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}><AccountBalanceIcon /></Avatar>
            <Box flex={1}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                {formData.entryNumber || 'Journal Entry'}
              </Typography>
              <Typography variant="body2" color="textSecondary">{formData.description}</Typography>
            </Box>
            <Chip
              label={formData.status?.toUpperCase() || 'REVERSED'}
              color="error"
              sx={{ fontWeight: 700 }}
            />
          </Box>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Summary chips */}
        <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box><Typography variant="caption" color="text.secondary">Date</Typography><Typography fontWeight={700}>{formData.date ? new Date(formData.date).toLocaleDateString() : '—'}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Department</Typography><Typography fontWeight={700}>{formData.department?.toUpperCase()}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Module</Typography><Typography fontWeight={700}>{formData.module?.toUpperCase()}</Typography></Box>
          <Box flex={1} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {balanced ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
            <Typography color={balanced ? 'success.main' : 'error.main'} fontWeight={700}>
              {balanced ? 'Balanced' : 'Not Balanced'} — Debits: {formatPKR(totalDr)} | Credits: {formatPKR(totalCr)}
            </Typography>
          </Box>
        </Paper>

        {/* Lines */}
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ width: 36 }}><b>#</b></TableCell>
                    <TableCell sx={{ minWidth: 360 }}><b>Account</b></TableCell>
                    <TableCell><b>Reference</b></TableCell>
                    <TableCell><b>Description</b></TableCell>
                    <TableCell align="right"><b>Debit (PKR)</b></TableCell>
                    <TableCell align="right"><b>Credit (PKR)</b></TableCell>
                    <TableCell><b>Dept</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(formData.lines || []).map((line, idx) => {
                    const accObj = line._accountObj || accounts.find(a => a._id === line.account);
                    const accLabel = accObj
                      ? `${accObj.accountNumber} — ${accObj.name}`
                      : (line.account || '—');
                    const dr = parseFloat(line.debit) || 0;
                    const cr = parseFloat(line.credit) || 0;
                    return (
                      <TableRow key={idx} sx={{ bgcolor: dr > 0 ? 'success.50' : cr > 0 ? 'primary.50' : undefined }}>
                        <TableCell sx={{ color: 'text.secondary', width: 36 }}>{idx + 1}</TableCell>
                        <TableCell sx={{ minWidth: 360 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {accLabel}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{line.reference || '—'}</TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{line.description}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: dr > 0 ? 700 : 400, color: dr > 0 ? 'success.main' : 'text.disabled' }}>
                          {dr > 0 ? formatPKR(dr) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: cr > 0 ? 700 : 400, color: cr > 0 ? 'primary.main' : 'text.disabled' }}>
                          {cr > 0 ? formatPKR(cr) : '—'}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: 11 }}>{line.department?.toUpperCase()}</TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell colSpan={4} align="right"><b>Totals</b></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}><b>{formatPKR(totalDr)}</b></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main' }}><b>{formatPKR(totalCr)}</b></TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleCancel} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
            <ArrowBackIcon />
          </IconButton>
          <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
            <AccountBalanceIcon />
          </Avatar>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                {isEdit ? 'Edit Journal Entry' : 'Create Journal Entry'}
              </Typography>
              {isEdit && formData.status && (
                <Chip
                  label={formData.status.toUpperCase()}
                  color={formData.status === 'posted' ? 'success' : 'default'}
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              )}
            </Box>
            <Typography variant="body2" color="textSecondary">
              {isEdit ? (formData.entryNumber ? `${formData.entryNumber} — Modify journal entry details and lines` : 'Modify journal entry details and lines') : 'Create a new journal entry with double-entry accounting'}
            </Typography>
          </Box>
          </Box>
          {!isEdit && <FinanceCompanySelector minWidth={280} showHelper={false} />}
        </Box>
      </Paper>

      {/* Alerts */}
      {isEdit && formData.status === 'posted' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          This journal entry is already <strong>POSTED</strong>. Updating amounts or accounts will automatically recalculate associated account balances and synchronize General Ledger records.
        </Alert>
      )}

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

              <Grid item xs={12} md={4}>
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

              <Grid item xs={12} md={4}>
                <FormControl fullWidth required>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={formData.department}
                    onChange={handleInputChange('department')}
                    label="Department"
                  >
                    {departments.map((dept) => (
                      <MenuItem key={dept._id} value={dept._id}>
                        {dept.name} ({dept.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Cost Center</InputLabel>
                  <Select
                    value={formData.costCenter || ''}
                    onChange={handleInputChange('costCenter')}
                    label="Cost Center"
                  >
                    <MenuItem value="">None</MenuItem>
                    {costCenters.filter(cc => cc.isActive).map((cc) => (
                      <MenuItem key={cc._id} value={cc._id}>
                        {cc.name}
                      </MenuItem>
                    ))}
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
                <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                  <Table sx={{ minWidth: 1280 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ minWidth: 420, width: '28%' }}>Account*</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>Reference</TableCell>
                        <TableCell sx={{ minWidth: 160 }}>Description</TableCell>
                        <TableCell sx={{ minWidth: 130 }}>Department</TableCell>
                        <TableCell sx={{ minWidth: 120 }}>Party Type</TableCell>
                        <TableCell sx={{ minWidth: 160 }}>Name / Party</TableCell>
                        <TableCell sx={{ minWidth: 120, textAlign: 'right' }}>Debit (PKR)</TableCell>
                        <TableCell sx={{ minWidth: 120, textAlign: 'right' }}>Credit (PKR)</TableCell>
                        <TableCell width={50}></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formData.lines.map((line, index) => (
                        <TableRow key={index}>
                          <TableCell sx={{ minWidth: 420, verticalAlign: 'top' }}>
                            <Autocomplete
                              size="small"
                              options={accounts}
                              getOptionLabel={(option) => option ? `${option.accountNumber} — ${option.name}` : ''}
                              value={accounts.find(a => a._id === line.account) || null}
                              onChange={(_, newValue) => {
                                handleLineChangeValue(index, 'account', newValue ? newValue._id : '');
                              }}
                              isOptionEqualToValue={(option, val) => option?._id === val?._id}
                              ListboxProps={{ style: { maxHeight: 320 } }}
                              componentsProps={{
                                paper: {
                                  sx: { minWidth: 480, maxWidth: 640 }
                                }
                              }}
                              sx={{
                                minWidth: 400,
                                '& .MuiInputBase-root': { minHeight: 40 },
                                '& .MuiAutocomplete-input': {
                                  minWidth: '0 !important',
                                  width: '100% !important'
                                }
                              }}
                              renderOption={(props, option) => (
                                <li {...props} key={option._id}>
                                  <Box sx={{ py: 0.25 }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                      {option.accountNumber}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'normal' }}>
                                      {option.name}
                                    </Typography>
                                  </Box>
                                </li>
                              )}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label="Select Account"
                                  variant="outlined"
                                  required
                                  size="small"
                                  inputProps={{
                                    ...params.inputProps,
                                    style: {
                                      ...(params.inputProps?.style || {}),
                                      textOverflow: 'clip'
                                    }
                                  }}
                                />
                              )}
                              fullWidth
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              value={line.reference || ''}
                              onChange={handleLineChange(index, 'reference')}
                              placeholder="Line reference"
                              size="small"
                            />
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
                            <FormControl fullWidth size="small">
                              <Select
                                value={line.department || ''}
                                onChange={(e) => handleLineChange(index, 'department', e.target.value)}
                                displayEmpty
                              >
                                <MenuItem value="">None</MenuItem>
                                {departments.map((dept) => (
                                  <MenuItem key={dept._id} value={dept._id}>
                                    {dept.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <FormControl fullWidth size="small">
                              <Select
                                value={line.partyType || ''}
                                onChange={(e) => {
                                  handleLineChange(index, 'partyType', e.target.value);
                                  handleLineChangeValue(index, 'party', '');
                                }}
                                displayEmpty
                              >
                                <MenuItem value="">None</MenuItem>
                                {getAllowedPartyTypes(line.account).map((pt) => (
                                  <MenuItem key={pt} value={pt}>{pt}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <Autocomplete
                              size="small"
                              disabled={!line.partyType}
                              options={line.partyType === 'Vendor' ? vendors : line.partyType === 'Customer' ? customers : line.partyType === 'Employee' ? employees : []}
                              getOptionLabel={(option) => {
                                if (!option) return '';
                                if (line.partyType === 'Employee') return `${option.firstName || ''} ${option.lastName || ''} - ${option.employeeId || ''}`;
                                return option.name || option.vendorName || option.customerName || option.companyName || '';
                              }}
                              value={(line.partyType === 'Vendor' ? vendors : line.partyType === 'Customer' ? customers : line.partyType === 'Employee' ? employees : []).find(p => String(p._id) === String(line.party)) || null}
                              onChange={(_, newValue) => {
                                handleLineChangeValue(index, 'party', newValue ? newValue._id : '');
                              }}
                              isOptionEqualToValue={(option, val) => String(option?._id) === String(val?._id)}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label={
                                    getAllowedPartyTypes(line.account).length === 1
                                      ? 'Select Customer'
                                      : getAllowedPartyTypes(line.account).includes('Customer') &&
                                          getAllowedPartyTypes(line.account).length === 3
                                        ? 'Select Party'
                                        : 'Select Vendor / Employee'
                                  }
                                  variant="outlined"
                                  size="small"
                                />
                              )}
                              fullWidth
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              value={line.debit}
                              onChange={handleLineChange(index, 'debit')}
                              inputProps={{ min: 0, step: 0.01 }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              value={line.credit}
                              onChange={handleLineChange(index, 'credit')}
                              inputProps={{ min: 0, step: 0.01 }}
                              size="small"
                            />
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
