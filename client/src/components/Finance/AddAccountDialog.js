import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Grid, Checkbox, FormControlLabel, Box, Typography, Divider, Autocomplete, Alert, Stack, Paper, Chip, useTheme, alpha } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import api from '../../services/api';
import { accountTypesGrouped, detailTypesByAccountType } from '../../utils/chartOfAccountsConstants';

const AddAccountDialog = ({ open, onClose, onSuccess, selectedCompanyId }) => {
  const theme = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [parentAccounts, setParentAccounts] = useState([]);
  const [parentAccountsLoading, setParentAccountsLoading] = useState(false);
  const [allAccounts, setAllAccounts] = useState([]);

  const [form, setForm] = useState({
    name: '',
    section: '',
    accountType: '',
    detailType: '',
    parentAccount: '',
    openingBalance: '',
    openingBalanceAsOf: new Date().toISOString().slice(0, 10),
    description: '',
    isSubaccount: false
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: '',
        section: '',
        accountType: '',
        detailType: '',
        parentAccount: '',
        openingBalance: '',
        openingBalanceAsOf: new Date().toISOString().slice(0, 10),
        description: '',
        isSubaccount: false
      });
      setError('');
      fetchAllAccounts();
    }
  }, [open, selectedCompanyId]);

  useEffect(() => {
    if (open && form.isSubaccount) {
      fetchParentAccounts();
    }
  }, [open, form.isSubaccount]);

  const fetchAllAccounts = async () => {
    try {
      const res = await api.get('/finance/accounts', { params: { limit: 1000, companyId: selectedCompanyId } });
      setAllAccounts(res.data?.data?.accounts || []);
    } catch (err) {
      console.error('Failed to fetch accounts', err);
    }
  };

  const fetchParentAccounts = async () => {
    setParentAccountsLoading(true);
    try {
      const res = await api.get('/finance/accounts', { params: { limit: 1000, companyId: selectedCompanyId } });
      setParentAccounts(res.data?.data?.accounts || []);
    } catch (err) {
      console.error('Failed to fetch parent accounts', err);
    } finally {
      setParentAccountsLoading(false);
    }
  };

  const parentAccountOptions = useMemo(() => {
    const base = parentAccounts.length > 0 ? parentAccounts : allAccounts;
    const uniqueAccounts = new Map();
    base.forEach((a) => {
      if (a && (a._id || a.id) && (a.name || a.accountNumber)) {
        uniqueAccounts.set(a.accountNumber || a._id || a.id, a);
      }
    });
    return Array.from(uniqueAccounts.values())
      .sort((a, b) => String(a.accountNumber || '').localeCompare(String(b.accountNumber || ''), undefined, { numeric: true }));
  }, [parentAccounts, allAccounts]);

  const getSectionForAccountType = (accountType) => {
    for (const [section, opts] of Object.entries(accountTypesGrouped)) {
      if ((opts || []).includes(accountType)) return section;
    }
    return 'Asset';
  };

  const getNextAccountNumber = (section) => {
    const ranges = { Asset: [1000, 1999], Liability: [2000, 2999], Equity: [3000, 3999], Revenue: [4000, 4999], Income: [4000, 4999], Expense: [5000, 5999] };
    const type = section === 'Income' ? 'Revenue' : section;
    const [min, max] = ranges[section] || [1000, 1999];
    const used = new Set(
      allAccounts
        .filter((a) => a.type === type)
        .map((a) => parseInt(a.accountNumber, 10))
        .filter((n) => !Number.isNaN(n) && n >= min && n <= max)
    );
    for (let n = min; n <= max; n += 1) {
      if (!used.has(n)) return String(n);
    }
    return String(max);
  };

  const handleCreateAccount = async () => {
    if (!form.name?.trim()) {
      setError('Account name is required');
      return;
    }
    if (!form.accountType) {
      setError('Account type is required');
      return;
    }
    const detailOptions = detailTypesByAccountType[form.accountType] || [];
    if (detailOptions.length && !form.detailType) {
      setError('Detail type is required');
      return;
    }
    const section = form.section || getSectionForAccountType(form.accountType);
    const accountNumber = getNextAccountNumber(section);
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        companyId: selectedCompanyId === 'all' ? undefined : selectedCompanyId,
        accountNumber,
        name: form.name.trim(),
        accountType: form.accountType,
        detailType: form.detailType,
        balance: Number(form.openingBalance) || 0,
        description: form.description?.trim() || undefined,
        parentAccount: form.isSubaccount && form.parentAccount ? form.parentAccount : undefined
      };
      const res = await api.post('/finance/accounts', payload);
      onSuccess(res.data?.data || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2, minHeight: 520, boxShadow: 24 } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2.5, px: 3, pb: 2.5, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" component="span" fontWeight={600}>Add New Chart of Accounts Category</Typography>
      </DialogTitle>
      <DialogContent sx={{ p: 3, pt: 3, overflow: 'visible' }}>
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
        <Box sx={{ pt: 1, overflow: 'visible' }}>
          <Stack spacing={3}>
            <TextField fullWidth required label="Account name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Petty Cash" size="medium" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>Account classification</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth required size="medium">
                    <InputLabel>Section</InputLabel>
                    <Select value={form.section} label="Section" onChange={(e) => setForm(f => ({ ...f, section: e.target.value, accountType: '', detailType: '' }))} sx={{ borderRadius: 1.5 }}>
                      <MenuItem value="">Select section</MenuItem>
                      {['Asset', 'Liability', 'Equity', 'Income', 'Expense'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth required size="medium">
                    <InputLabel>Account type</InputLabel>
                    <Select value={form.accountType} label="Account type" onChange={(e) => setForm(f => ({ ...f, accountType: e.target.value, detailType: '' }))} disabled={!form.section} sx={{ borderRadius: 1.5 }}>
                      <MenuItem value="">Select account type</MenuItem>
                      {(accountTypesGrouped[form.section] || []).map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth required size="medium">
                    <InputLabel>Detail type</InputLabel>
                    <Select value={form.detailType} label="Detail type" MenuProps={{ disableScrollLock: true }} onChange={(e) => setForm(f => ({ ...f, detailType: e.target.value }))} disabled={!form.accountType} sx={{ borderRadius: 1.5 }}>
                      <MenuItem value=""><em>Select detail type</em></MenuItem>
                      {(detailTypesByAccountType[form.accountType] || []).map((d) => (
                        <MenuItem key={d} value={d}>
                          <Box component="span" sx={{ width: 28, display: 'inline-flex', alignItems: 'center', mr: 0.5 }}>
                            {form.detailType === d && <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />}
                          </Box>
                          {d}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
            <Divider sx={{ my: 0.5 }} />
            <FormControlLabel control={<Checkbox checked={form.isSubaccount} onChange={(e) => setForm(f => ({ ...f, isSubaccount: e.target.checked, ...(e.target.checked ? {} : { parentAccount: '', openingBalance: '', openingBalanceAsOf: new Date().toISOString().slice(0, 10) }) }))} color="primary" />} label="Make this a subaccount (nested under a parent account)" />
            {form.isSubaccount && (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Autocomplete options={parentAccountOptions} getOptionLabel={(option) => `${option.accountNumber || ''} — ${option.name || ''}${option.type ? ` (${option.type})` : ''}`} value={parentAccountOptions.find(a => a._id === form.parentAccount) || null} onChange={(event, newValue) => setForm(f => ({ ...f, parentAccount: newValue ? newValue._id : '' }))} loading={parentAccountsLoading} renderInput={(params) => <TextField {...params} label="Parent account" size="medium" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 }, maxWidth: 520 }} />} noOptionsText={parentAccountsLoading ? 'Loading parent accounts...' : 'No parent accounts found'} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Opening balance" type="number" value={form.openingBalance} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} inputProps={{ step: '0.01' }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="As of" type="date" value={form.openingBalanceAsOf} onChange={(e) => setForm((f) => ({ ...f, openingBalanceAsOf: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
                </Grid>
              </Grid>
            )}
            <TextField fullWidth multiline rows={3} label="Description (optional)" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Add any notes or description for this account" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }} />
            {(form.section || form.accountType || form.detailType) && (
              <Paper variant="outlined" sx={{ p: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 2, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.2) }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>{form.section === 'Income' || form.section === 'Expense' ? 'Profit & Loss' : 'Balance Sheet'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Active accounts as of {new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {form.section && <Chip label={form.section} size="small" color="default" variant="outlined" />}
                  {form.accountType && <Chip label={form.accountType} size="small" color="primary" variant="outlined" />}
                  {form.detailType && <Chip label={form.detailType} size="small" color="success" variant="outlined" />}
                </Box>
                <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                  {form.accountType && form.detailType ? `New account will appear under ${form.accountType} → ${form.detailType}` : form.accountType ? 'Select a detail type to complete' : form.section ? 'Select an account type to continue' : ''}
                </Typography>
              </Paper>
            )}
          </Stack>
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2.5, gap: 1.5, bgcolor: 'grey.50' }}>
        <Button onClick={onClose} size="medium">Cancel</Button>
        <Button variant="contained" onClick={handleCreateAccount} disabled={submitting} size="medium" startIcon={submitting ? null : <CheckIcon />} sx={{ minWidth: 120 }}>{submitting ? 'Saving...' : 'Create account'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddAccountDialog;
