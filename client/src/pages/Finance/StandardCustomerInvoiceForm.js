import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatPKR } from '../../utils/currency';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';

const DEFAULT_TERMS = [
  { value: 'due_on_receipt', label: 'Due on receipt', days: 0 },
  { value: 'net_15', label: 'Net 15', days: 15 },
  { value: 'net_30', label: 'Net 30', days: 30 },
  { value: 'net_45', label: 'Net 45', days: 45 },
  { value: 'net_60', label: 'Net 60', days: 60 },
  { value: 'custom', label: 'Custom', days: 30 }
];

const emptyLine = () => ({
  id: Date.now() + Math.random(),
  account: null,
  description: '',
  quantity: 1,
  unitPrice: '',
  amount: ''
});

const StandardCustomerInvoiceForm = () => {
  const navigate = useNavigate();
  const { selectedCompanyId } = useFinanceCompany();

  // Customer & Invoice Metadata
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [department, setDepartment] = useState('general');
  const [notes, setNotes] = useState('');

  // Line items
  const [lines, setLines] = useState([emptyLine()]);

  // Master Data
  const [accounts, setAccounts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Quick Add Revenue Account Dialog
  const [newAccountDialog, setNewAccountDialog] = useState(false);
  const [newAccountRowIndex, setNewAccountRowIndex] = useState(null);
  const [newAccountForm, setNewAccountForm] = useState({
    name: '',
    accountNumber: '',
    type: 'Revenue',
    category: 'Operating Revenue',
    description: ''
  });
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Submitting
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto calculate due date
  const updateDueDateFromTerms = useCallback((termsValue, bDate) => {
    if (!bDate) return;
    const term = DEFAULT_TERMS.find((t) => t.value === termsValue);
    const days = term ? term.days : 30;
    const d = new Date(bDate);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + days);
      setDueDate(d.toISOString().split('T')[0]);
    }
  }, []);

  useEffect(() => {
    updateDueDateFromTerms(paymentTerms, invoiceDate);
  }, [paymentTerms, invoiceDate, updateDueDateFromTerms]);

  // Load Master Data
  useEffect(() => {
    const fetchData = async () => {
      setLoadingMaster(true);
      try {
        const [accRes, compRes, deptRes] = await Promise.all([
          api.get('/finance/accounts', { params: { limit: 5000, companyId: selectedCompanyId } }).catch(() => ({ data: { data: [] } })),
          api.get('/finance/companies').catch(() => ({ data: { data: [] } })),
          api.get('/indents/departments').catch(() => ({ data: { data: [] } }))
        ]);

        const aList = accRes.data?.data?.accounts || accRes.data?.accounts || accRes.data?.data || [];
        setAccounts(Array.isArray(aList) ? aList : []);

        const cList = compRes.data?.data || compRes.data || [];
        setCompaniesList(Array.isArray(cList) ? cList : []);
        if (selectedCompanyId && Array.isArray(cList)) {
          const match = cList.find((c) => String(c._id) === String(selectedCompanyId));
          if (match) setSelectedCompany(match);
        }

        const dList = deptRes.data?.data || [];
        setDepartments(Array.isArray(dList) ? dList : []);

        // Auto-generate invoice number suggestion
        const now = new Date();
        const rand = Math.floor(1000 + Math.random() * 9000);
        setInvoiceNumber(`INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${rand}`);
      } catch (err) {
        console.error('Failed to load master data:', err);
      } finally {
        setLoadingMaster(false);
      }
    };
    fetchData();
  }, [selectedCompanyId]);

  // Filter Revenue Accounts
  const revenueAccounts = useMemo(() => {
    return accounts.filter((a) => a.type === 'Revenue');
  }, [accounts]);

  // Line Handlers
  const handleLineChange = (index, field, value) => {
    setLines((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(field === 'quantity' ? value : row.quantity) || 0;
        const price = Number(field === 'unitPrice' ? value : row.unitPrice) || 0;
        row.amount = Math.round(qty * price * 100) / 100;
      }
      updated[index] = row;
      return updated;
    });
  };

  const handleAddLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const handleDeleteLine = (index) => {
    if (lines.length === 1) {
      setLines([emptyLine()]);
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Grand Total Calculation
  const grandTotal = useMemo(() => {
    return lines.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  }, [lines]);

  // Quick Add Revenue Account Dialog Handlers
  const handleOpenAddAccount = (rowIndex) => {
    setNewAccountRowIndex(rowIndex);
    setNewAccountForm({
      name: '',
      accountNumber: '',
      type: 'Revenue',
      category: 'Operating Revenue',
      description: ''
    });
    setNewAccountDialog(true);
  };

  const handleSaveNewAccount = async (e) => {
    e.preventDefault();
    if (!newAccountForm.name.trim() || !newAccountForm.accountNumber.trim()) {
      toast.error('Account Name and Number are required');
      return;
    }
    try {
      setCreatingAccount(true);
      const payload = {
        ...newAccountForm,
        companyId: selectedCompany?._id || selectedCompanyId || undefined
      };
      const res = await api.post('/finance/accounts', payload);
      if (res.data?.success || res.status === 201 || res.status === 200) {
        const created = res.data?.data || res.data;
        toast.success(`Account "${created.name}" created!`);
        setAccounts((prev) => [created, ...prev]);
        if (newAccountRowIndex !== null) {
          handleLineChange(newAccountRowIndex, 'account', created);
        }
        setNewAccountDialog(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create account');
    } finally {
      setCreatingAccount(false);
    }
  };

  // Submit Invoice
  const handleSubmitInvoice = async () => {
    setError('');
    if (!customerName.trim()) {
      setError('Customer name is required');
      return;
    }
    if (!invoiceNumber.trim()) {
      setError('Invoice number is required');
      return;
    }
    if (grandTotal <= 0) {
      setError('Total invoice amount must be greater than zero');
      return;
    }

    const validLines = lines.filter((l) => Number(l.amount) > 0);
    if (validLines.length === 0) {
      setError('Please add at least one line item with an amount');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customer: {
          name: customerName.trim(),
          email: customerEmail.trim() || undefined,
          phone: customerPhone.trim() || undefined,
          address: customerAddress.trim() ? { street: customerAddress.trim() } : undefined
        },
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        dueDate,
        paymentTerms,
        department: department || 'general',
        notes,
        totalAmount: grandTotal,
        companyId: selectedCompany?._id || selectedCompanyId || undefined,
        lineItems: validLines.map((l) => ({
          description: l.description.trim() || 'Service / Product Delivery',
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || Number(l.amount),
          amount: Number(l.amount),
          account: l.account?._id || null
        }))
      };

      const res = await api.post('/finance/accounts-receivable', payload);
      if (res.data?.success || res.status === 201 || res.status === 200) {
        toast.success(`✓ Invoice ${invoiceNumber} created and booked to revenue!`);
        navigate('/finance/accounts-receivable');
      }
    } catch (err) {
      console.error('Error creating invoice:', err);
      setError(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Header Bar & Live Amount Due */}
      <Paper elevation={1} sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item xs={12} md={6}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/finance/accounts-receivable')}
                size="small"
              >
                Back to Accounts Receivable
              </Button>
              <Typography variant="h4" fontWeight={700} sx={{ color: 'text.primary', letterSpacing: -0.5 }}>
                New Customer Invoice
              </Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={6} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Total Invoice Amount
            </Typography>
            <Typography variant="h4" fontWeight={800} color={grandTotal > 0 ? 'success.main' : 'text.primary'}>
              {formatPKR(grandTotal)}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Main Form Body */}
      <Card elevation={2} sx={{ borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          {/* Customer & Invoice Details */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {/* Customer Details */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1.5, textTransform: 'uppercase' }}>
                Customer Information
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Customer Name"
                  size="small"
                  required
                  placeholder="e.g. Acme Corp / Resident Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Customer Email"
                      size="small"
                      type="email"
                      placeholder="billing@customer.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone / Contact"
                      size="small"
                      placeholder="0300-1234567"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </Grid>
                </Grid>
                <TextField
                  fullWidth
                  label="Billing Address"
                  size="small"
                  placeholder="Plot / Office / Street Address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
              </Stack>
            </Grid>

            {/* Invoice Meta */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={700} color="primary" sx={{ mb: 1.5, textTransform: 'uppercase' }}>
                Invoice Details & Terms
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Invoice #"
                    size="small"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-001"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Payment Terms</InputLabel>
                    <Select
                      value={paymentTerms}
                      label="Payment Terms"
                      onChange={(e) => setPaymentTerms(e.target.value)}
                    >
                      {DEFAULT_TERMS.map((t) => (
                        <MenuItem key={t.value} value={t.value}>
                          {t.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Invoice Date"
                    type="date"
                    size="small"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Due Date"
                    type="date"
                    size="small"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={companiesList}
                    getOptionLabel={(c) => c?.name || ''}
                    value={selectedCompany}
                    onChange={(_, val) => setSelectedCompany(val)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        label="Entity / Company"
                        placeholder="Select Company"
                        fullWidth
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Department"
                    size="small"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <MenuItem value="general">General</MenuItem>
                    <MenuItem value="finance">Finance</MenuItem>
                    <MenuItem value="sales">Sales & Marketing</MenuItem>
                    <MenuItem value="operations">Operations</MenuItem>
                    <MenuItem value="admin">Administration</MenuItem>
                    {departments.map((d) => (
                      <MenuItem key={d._id || d.name} value={d.name?.toLowerCase()}>
                        {d.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Revenue Line Items Section */}
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Revenue & Line Item Breakdown
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ width: 45, fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ minWidth: 260, fontWeight: 700 }}>REVENUE ACCOUNT (CHART OF ACCOUNTS)</TableCell>
                  <TableCell sx={{ minWidth: 260, fontWeight: 700 }}>DESCRIPTION</TableCell>
                  <TableCell sx={{ width: 100, fontWeight: 700 }} align="right">QTY</TableCell>
                  <TableCell sx={{ width: 150, fontWeight: 700 }} align="right">RATE (PKR)</TableCell>
                  <TableCell sx={{ width: 160, fontWeight: 700 }} align="right">AMOUNT (PKR)</TableCell>
                  <TableCell sx={{ width: 80, fontWeight: 700 }} align="center">ACTION</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((row, idx) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>{idx + 1}</TableCell>

                    {/* Revenue Account Selection */}
                    <TableCell>
                      <Autocomplete
                        options={revenueAccounts}
                        getOptionLabel={(o) => {
                          if (o?.__isNewOption) return '+ Add new revenue account';
                          return o?.name ? `${o.name} (${o.accountNumber || ''})` : '';
                        }}
                        value={row.account}
                        onChange={(_, val) => {
                          if (val?.__isNewOption) {
                            handleOpenAddAccount(idx);
                          } else {
                            handleLineChange(idx, 'account', val);
                          }
                        }}
                        isOptionEqualToValue={(a, b) => String(a?._id) === String(b?._id)}
                        filterOptions={(opts, state) => {
                          const filtered = opts.filter((opt) =>
                            (opt.name || '').toLowerCase().includes(state.inputValue.toLowerCase()) ||
                            (opt.accountNumber || '').includes(state.inputValue)
                          );
                          return [{ __isNewOption: true }, ...filtered];
                        }}
                        renderOption={(props, option) => {
                          if (option.__isNewOption) {
                            return (
                              <li {...props} key="add-new" style={{ color: '#1976d2', fontWeight: 600, borderBottom: '1px solid #e0e0e0' }}>
                                <AddIcon fontSize="small" sx={{ mr: 1 }} /> + Add new
                              </li>
                            );
                          }
                          return (
                            <li {...props} key={option._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{option.name} <Typography component="span" variant="caption" color="text.secondary">({option.accountNumber})</Typography></span>
                              <Chip label={option.type || 'Revenue'} size="small" variant="outlined" color="success" sx={{ height: 20, fontSize: 10 }} />
                            </li>
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            placeholder="Select Revenue Category"
                            fullWidth
                          />
                        )}
                      />
                    </TableCell>

                    {/* Description */}
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Description of goods or services"
                        value={row.description}
                        onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                      />
                    </TableCell>

                    {/* Qty */}
                    <TableCell align="right">
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={row.quantity}
                        onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                        inputProps={{ min: 1, style: { textAlign: 'right' } }}
                      />
                    </TableCell>

                    {/* Rate */}
                    <TableCell align="right">
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        placeholder="0.00"
                        value={row.unitPrice}
                        onChange={(e) => handleLineChange(idx, 'unitPrice', e.target.value)}
                        inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right' } }}
                      />
                    </TableCell>

                    {/* Amount */}
                    <TableCell align="right">
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        placeholder="0.00"
                        value={row.amount}
                        onChange={(e) => handleLineChange(idx, 'amount', e.target.value)}
                        inputProps={{ min: 0, step: 0.01, style: { textAlign: 'right', fontWeight: 'bold' } }}
                      />
                    </TableCell>

                    {/* Delete Action */}
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => handleDeleteLine(idx)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Button
            startIcon={<AddIcon />}
            variant="outlined"
            size="small"
            onClick={handleAddLine}
            sx={{ mb: 3 }}
          >
            Add Line
          </Button>

          {/* Notes & Summary */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <TextField
                label="Invoice Notes & Terms"
                multiline
                rows={3}
                fullWidth
                size="small"
                placeholder="Payment instructions, bank wire info, or invoice notes for the client..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, backgroundColor: 'background.default' }}>
                <Stack spacing={1.5}>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                    <Typography variant="body2" fontWeight={600}>{formatPKR(grandTotal)}</Typography>
                  </Box>
                  <Divider />
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" fontWeight={700}>Total Receivable:</Typography>
                    <Typography variant="h6" fontWeight={800} color="success.main">
                      {formatPKR(grandTotal)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Posting this invoice will automatically debit <strong>1100 Accounts Receivable</strong> and credit your selected <strong>Revenue Accounts</strong> in the General Ledger.
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Bottom Sticky Action Bar */}
      <Paper
        elevation={3}
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          borderRadius: 2
        }}
      >
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={() => navigate('/finance/accounts-receivable')}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="large"
            disabled={submitting || grandTotal <= 0}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSubmitInvoice}
            sx={{ px: 4, fontWeight: 700 }}
          >
            {submitting ? 'Booking Invoice...' : 'Save & Book Invoice'}
          </Button>
        </Stack>
      </Paper>

      {/* Quick Add Revenue Account Dialog */}
      <Dialog open={newAccountDialog} onClose={() => setNewAccountDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New Revenue Account</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Account Name"
              required
              fullWidth
              size="small"
              placeholder="e.g. Consultancy Services, Land Transfer Fee"
              value={newAccountForm.name}
              onChange={(e) => setNewAccountForm((p) => ({ ...p, name: e.target.value }))}
            />
            <TextField
              label="Account Number / Code"
              required
              fullWidth
              size="small"
              placeholder="e.g. 4050"
              value={newAccountForm.accountNumber}
              onChange={(e) => setNewAccountForm((p) => ({ ...p, accountNumber: e.target.value }))}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Account Type</InputLabel>
              <Select
                value={newAccountForm.type}
                label="Account Type"
                disabled
              >
                <MenuItem value="Revenue">Revenue</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Category"
              fullWidth
              size="small"
              value={newAccountForm.category}
              onChange={(e) => setNewAccountForm((p) => ({ ...p, category: e.target.value }))}
            />
            <TextField
              label="Description"
              multiline
              rows={2}
              fullWidth
              size="small"
              placeholder="Optional notes"
              value={newAccountForm.description}
              onChange={(e) => setNewAccountForm((p) => ({ ...p, description: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNewAccountDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSaveNewAccount}
            variant="contained"
            disabled={creatingAccount || !newAccountForm.name.trim() || !newAccountForm.accountNumber.trim()}
          >
            {creatingAccount ? 'Saving...' : 'Save Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StandardCustomerInvoiceForm;
