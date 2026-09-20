import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  People as CustomerIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Add as AddIcon
} from '@mui/icons-material';
import api from '../../services/api';
import FinanceCompanyPageHeader from '../../components/Finance/FinanceCompanyPageHeader';
import { useFinanceCompanyReload } from '../../hooks/useFinanceCompanyReload';

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_COLOR = {
  paid: 'success',
  partial: 'info',
  pending: 'warning',
  overdue: 'error',
  approved: 'info',
  draft: 'default',
  active: 'success',
  inactive: 'default',
  prospect: 'info'
};

const emptyForm = {
  name: '',
  company: '',
  email: '',
  phone: '',
  status: 'active',
  type: 'corporate',
  industry: '',
  website: ''
};

export default function FinanceCustomersList() {
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailTab, setDetailTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [statementFilters, setStatementFilters] = useState({ fromDate: '', toDate: '' });

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { limit: 500, page: 1 };
      if (searchDebounced) params.search = searchDebounced;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/finance/customers', { params });
      setCustomers(res.data?.data?.customers || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, statusFilter]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useFinanceCompanyReload(() => {
    setSelected(null);
    setDetail(null);
    loadCustomers();
  }, { skipInitial: true });

  const openCustomer = async (customer) => {
    setSelected(customer);
    setDetail(null);
    setDetailTab(0);
    setDetailLoading(true);
    try {
      const res = await api.get(`/finance/customers/${customer._id}`, {
        headers: { 'Cache-Control': 'no-cache' },
        params: { _: Date.now() }
      });
      setDetail(res.data?.data || null);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load customer finance details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!(formData.name || '').trim()) {
      setError('Customer name is required');
      return;
    }
    try {
      setSaving(true);
      setError('');
      const payload = { ...formData };
      if (!payload.email) delete payload.email;
      const res = await api.post('/finance/customers', payload);
      if (res.data?.success) {
        setSuccess('Customer created successfully');
        setDialogOpen(false);
        setFormData(emptyForm);
        await loadCustomers();
        if (res.data.data?._id) openCustomer(res.data.data);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  const filteredInvoices = (detail?.invoices || []).filter((inv) => {
    if (!statementFilters.fromDate && !statementFilters.toDate) return true;
    const d = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
    if (!d) return true;
    if (statementFilters.fromDate && d < new Date(statementFilters.fromDate)) return false;
    if (statementFilters.toDate && d > new Date(statementFilters.toDate)) return false;
    return true;
  });

  const filteredPayments = (detail?.payments || []).filter((p) => {
    if (!statementFilters.fromDate && !statementFilters.toDate) return true;
    const d = p.paymentDate ? new Date(p.paymentDate) : null;
    if (!d) return true;
    if (statementFilters.fromDate && d < new Date(statementFilters.fromDate)) return false;
    if (statementFilters.toDate && d > new Date(statementFilters.toDate)) return false;
    return true;
  });

  if (selected) {
    const customer = detail?.customer || selected;
    const summary = detail?.summary || selected.finance || {};

    return (
      <Box sx={{ p: 3 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={() => {
            setSelected(null);
            setDetail(null);
          }}
          sx={{ mb: 2 }}
        >
          Back to Customers
        </Button>

        <Stack direction="row" alignItems="center" gap={2} mb={2} flexWrap="wrap">
          <Avatar sx={{ bgcolor: 'primary.main' }}>{(customer.name || 'C').charAt(0).toUpperCase()}</Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700}>{customer.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {[customer.company, customer.email, customer.phone].filter(Boolean).join(' · ') || '—'}
            </Typography>
          </Box>
          <Chip
            label={customer.status || '—'}
            color={STATUS_COLOR[customer.status] || 'default'}
            size="small"
          />
        </Stack>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

        {detailLoading ? (
          <CircularProgress />
        ) : (
          <>
            <Grid container spacing={2} mb={3}>
              {[
                { label: 'Total Invoiced', value: summary.totalInvoiced, color: 'primary.main' },
                { label: 'Total Received', value: summary.totalReceived, color: 'success.main' },
                { label: 'Outstanding', value: summary.outstanding, color: (summary.outstanding || 0) > 0 ? 'error.main' : 'text.secondary' },
                { label: 'Invoices', value: summary.invoiceCount, color: 'info.main', isCount: true }
              ].map((c) => (
                <Grid item xs={12} sm={6} md={3} key={c.label}>
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                      <Typography variant="h6" fontWeight={700} color={c.color}>
                        {c.isCount ? c.value || 0 : `PKR ${fmt(c.value)}`}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Paper variant="outlined" sx={{ mb: 2, px: 2 }}>
              <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)}>
                <Tab label={`Invoices (${detail?.invoices?.length || 0})`} />
                <Tab label={`Payments (${detail?.payments?.length || 0})`} />
                <Tab label={`Journal Entries (${detail?.journalEntries?.length || 0})`} />
                <Tab label="Statement" />
                <Tab label="Profile" />
              </Tabs>
            </Paper>

            {detailTab === 0 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell><b>Invoice #</b></TableCell>
                      <TableCell><b>Date</b></TableCell>
                      <TableCell><b>Due</b></TableCell>
                      <TableCell align="right"><b>Invoiced</b></TableCell>
                      <TableCell align="right"><b>Received</b></TableCell>
                      <TableCell align="right"><b>Balance</b></TableCell>
                      <TableCell><b>Status</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detail?.invoices || []).map((inv) => (
                      <TableRow key={inv._id} hover>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{inv.invoiceNumber || '—'}</TableCell>
                        <TableCell>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}</TableCell>
                        <TableCell>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</TableCell>
                        <TableCell align="right">{fmt(inv.totalAmount)}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(inv.paidAmount)}</TableCell>
                        <TableCell align="right" sx={{ color: (inv.balance || 0) > 0 ? 'error.main' : 'text.secondary' }}>
                          {fmt(inv.balance)}
                        </TableCell>
                        <TableCell>
                          <Chip label={inv.status || '—'} size="small" color={STATUS_COLOR[inv.status] || 'default'} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {(detail?.invoices || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          No accounts receivable invoices for this customer yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {detailTab === 1 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell><b>Date</b></TableCell>
                      <TableCell><b>Invoice #</b></TableCell>
                      <TableCell><b>Method</b></TableCell>
                      <TableCell><b>Reference</b></TableCell>
                      <TableCell align="right"><b>Amount</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detail?.payments || []).map((p) => (
                      <TableRow key={String(p._id) + String(p.invoiceId)} hover>
                        <TableCell>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '—'}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{p.invoiceNumber || '—'}</TableCell>
                        <TableCell>{p.paymentMethod || '—'}</TableCell>
                        <TableCell>{p.reference || '—'}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                    {(detail?.payments || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          No payments recorded for this customer yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {detailTab === 2 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell><b>Entry #</b></TableCell>
                      <TableCell><b>Date</b></TableCell>
                      <TableCell><b>Description</b></TableCell>
                      <TableCell><b>Reference</b></TableCell>
                      <TableCell align="right"><b>Debits</b></TableCell>
                      <TableCell align="right"><b>Credits</b></TableCell>
                      <TableCell><b>Tag</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detail?.journalEntries || []).map((je) => (
                      <TableRow key={je._id} hover>
                        <TableCell sx={{ fontFamily: 'monospace' }}>{je.entryNumber || '—'}</TableCell>
                        <TableCell>{je.date ? new Date(je.date).toLocaleDateString() : '—'}</TableCell>
                        <TableCell>{je.description || '—'}</TableCell>
                        <TableCell>{je.reference || '—'}</TableCell>
                        <TableCell align="right">{fmt(je.totalDebits)}</TableCell>
                        <TableCell align="right">{fmt(je.totalCredits)}</TableCell>
                        <TableCell>
                          {je.partyTagged ? <Chip label="Party" size="small" color="secondary" /> : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(detail?.journalEntries || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          No journal entries linked to this customer yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {detailTab === 3 && (
              <Box>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
                    <TextField
                      label="From Date"
                      type="date"
                      size="small"
                      value={statementFilters.fromDate}
                      onChange={(e) => setStatementFilters((f) => ({ ...f, fromDate: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="To Date"
                      type="date"
                      size="small"
                      value={statementFilters.toDate}
                      onChange={(e) => setStatementFilters((f) => ({ ...f, toDate: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                    />
                    <Button size="small" variant="outlined" onClick={() => setStatementFilters({ fromDate: '', toDate: '' })}>
                      Clear
                    </Button>
                  </Stack>
                </Paper>

                <Typography variant="subtitle2" fontWeight={700} mb={1}>Invoices</Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell><b>Invoice #</b></TableCell>
                        <TableCell><b>Date</b></TableCell>
                        <TableCell align="right"><b>Invoiced</b></TableCell>
                        <TableCell align="right"><b>Received</b></TableCell>
                        <TableCell align="right"><b>Balance</b></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredInvoices.map((inv) => (
                        <TableRow key={inv._id}>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</TableCell>
                          <TableCell>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}</TableCell>
                          <TableCell align="right">{fmt(inv.totalAmount)}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(inv.paidAmount)}</TableCell>
                          <TableCell align="right">{fmt(inv.balance)}</TableCell>
                        </TableRow>
                      ))}
                      {filteredInvoices.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 2, color: 'text.secondary' }}>No invoices in range</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography variant="subtitle2" fontWeight={700} mb={1}>Payments</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell><b>Date</b></TableCell>
                        <TableCell><b>Invoice #</b></TableCell>
                        <TableCell><b>Reference</b></TableCell>
                        <TableCell align="right"><b>Amount</b></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredPayments.map((p) => (
                        <TableRow key={String(p._id) + '-stmt'}>
                          <TableCell>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '—'}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{p.invoiceNumber}</TableCell>
                          <TableCell>{p.reference || '—'}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                      {filteredPayments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 2, color: 'text.secondary' }}>No payments in range</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {detailTab === 4 && (
              <Card variant="outlined">
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Company</Typography>
                      <Typography>{customer.company || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Type</Typography>
                      <Typography>{customer.type || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Email</Typography>
                      <Typography>{customer.email || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Phone</Typography>
                      <Typography>{customer.phone || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Industry</Typography>
                      <Typography>{customer.industry || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">Website</Typography>
                      <Typography>{customer.website || '—'}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Address</Typography>
                      <Typography>
                        {[
                          customer.address?.street,
                          customer.address?.city,
                          customer.address?.state,
                          customer.address?.postalCode,
                          customer.address?.country
                        ].filter(Boolean).join(', ') || '—'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <FinanceCompanyPageHeader title="Customers" icon={CustomerIcon}>
        <Stack direction="row" gap={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadCustomers} size="small">
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
            onClick={() => {
              setFormData(emptyForm);
              setDialogOpen(true);
              setError('');
            }}
          >
            Create Customer
          </Button>
        </Stack>
      </FinanceCompanyPageHeader>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, mt: -2 }}>
        Customer master data with invoices, payments, statements, and linked journal entries — same workflow as Vendor List.
      </Typography>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              size="small"
              label="Search customers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 240, flex: 1 }}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="prospect">Prospect</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell><b>Name</b></TableCell>
                <TableCell><b>Company</b></TableCell>
                <TableCell><b>Contact</b></TableCell>
                <TableCell align="right"><b>Total Invoiced</b></TableCell>
                <TableCell align="right"><b>Total Received</b></TableCell>
                <TableCell align="right"><b>Outstanding</b></TableCell>
                <TableCell align="center"><b>Invoices</b></TableCell>
                <TableCell><b>Status</b></TableCell>
                <TableCell align="center"><b>Action</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No customers found.
                  </TableCell>
                </TableRow>
              )}
              {customers.map((c) => (
                <TableRow key={c._id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>{(c.name || 'C').charAt(0)}</Avatar>
                      {c.name}
                    </Stack>
                  </TableCell>
                  <TableCell>{c.company || '—'}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{c.email || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">{c.phone || ''}</Typography>
                  </TableCell>
                  <TableCell align="right">PKR {fmt(c.finance?.totalInvoiced)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main' }}>PKR {fmt(c.finance?.totalReceived)}</TableCell>
                  <TableCell align="right" sx={{ color: (c.finance?.outstanding || 0) > 0 ? 'error.main' : 'text.primary' }}>
                    PKR {fmt(c.finance?.outstanding)}
                  </TableCell>
                  <TableCell align="center">{c.finance?.invoiceCount || 0}</TableCell>
                  <TableCell>
                    <Chip label={c.status} size="small" color={STATUS_COLOR[c.status] || 'default'} />
                  </TableCell>
                  <TableCell align="center">
                    <Button size="small" variant="outlined" onClick={() => openCustomer(c)}>
                      View finance
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Customer</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                label="Name"
                required
                fullWidth
                size="small"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Company"
                fullWidth
                size="small"
                value={formData.company}
                onChange={(e) => setFormData((f) => ({ ...f, company: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type"
                  value={formData.type}
                  onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                >
                  <MenuItem value="corporate">Corporate</MenuItem>
                  <MenuItem value="individual">Individual</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                fullWidth
                size="small"
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                fullWidth
                size="small"
                value={formData.phone}
                onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="prospect">Prospect</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Industry"
                fullWidth
                size="small"
                value={formData.industry}
                onChange={(e) => setFormData((f) => ({ ...f, industry: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Saving…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
