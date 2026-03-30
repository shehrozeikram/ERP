import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Divider, Alert,
  CircularProgress, Stack, Avatar, Chip, InputAdornment, Card, CardContent
} from '@mui/material';
import {
  Business as BizIcon, Save as SaveIcon, Image as ImageIcon,
  AccountBalance as BankIcon, Receipt as TaxIcon, ContactPhone as ContactIcon
} from '@mui/icons-material';
import api from '../../services/api';

const Section = ({ icon, title, children }) => (
  <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
    <Box display="flex" alignItems="center" gap={1} mb={2}>
      {icon}
      <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
    </Box>
    <Divider sx={{ mb: 2 }} />
    {children}
  </Paper>
);

export default function CompanyProfile() {
  const [form, setForm]     = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/finance/company-profile');
      setForm(res.data.data || {});
    } catch (e) {
      setError('Failed to load company profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.put('/finance/company-profile', form);
      setSuccess('Company profile saved successfully');
    } catch (e) {
      setError(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" p={6}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <BizIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>Company Profile</Typography>
          <Chip label="Used in Invoices & Bills" size="small" color="info" sx={{ ml: 1 }} />
        </Box>
        <Button variant="contained" startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={handleSave} disabled={saving} size="large">
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </Box>

      {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      {/* Preview card */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)', color: 'white' }}>
        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {form.logoUrl ? (
            <Avatar src={form.logoUrl} alt="Logo" sx={{ width: 64, height: 64, bgcolor: 'white' }} imgProps={{ style: { objectFit: 'contain' } }} />
          ) : (
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 28 }}>
              {(form.name || 'S').charAt(0)}
            </Avatar>
          )}
          <Box>
            <Typography variant="h6" fontWeight={800}>{form.name || 'Your Company Name'}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>{form.legalName || form.address || 'Address will appear here'}</Typography>
            <Stack direction="row" spacing={1} mt={0.5}>
              {form.ntn  && <Chip label={`NTN: ${form.ntn}`}  size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 11 }} />}
              {form.strn && <Chip label={`STRN: ${form.strn}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 11 }} />}
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Section icon={<BizIcon color="primary" fontSize="small" />} title="Basic Information">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Company Name *" value={form.name || ''} onChange={set('name')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Legal / Registered Name" value={form.legalName || ''} onChange={set('legalName')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Currency" value={form.currency || 'PKR'} onChange={set('currency')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Logo URL" value={form.logoUrl || ''} onChange={set('logoUrl')}
              placeholder="https://…/logo.png"
              InputProps={{ startAdornment: <InputAdornment position="start"><ImageIcon fontSize="small" /></InputAdornment> }} />
          </Grid>
        </Grid>
      </Section>

      <Section icon={<TaxIcon color="warning" fontSize="small" />} title="Tax Registrations (FBR)">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="NTN (National Tax Number)" value={form.ntn || ''} onChange={set('ntn')}
              placeholder="1234567-8" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="STRN (Sales Tax Reg. Number)" value={form.strn || ''} onChange={set('strn')}
              placeholder="01-00-0000-000-11" />
          </Grid>
        </Grid>
      </Section>

      <Section icon={<ContactIcon color="success" fontSize="small" />} title="Contact & Address">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Street Address" value={form.address || ''} onChange={set('address')}
              multiline rows={2} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="City" value={form.city || ''} onChange={set('city')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Country" value={form.country || ''} onChange={set('country')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Phone" value={form.phone || ''} onChange={set('phone')} placeholder="+92 51 000 0000" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Email" value={form.email || ''} onChange={set('email')} type="email" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Website" value={form.website || ''} onChange={set('website')} placeholder="www.example.com" />
          </Grid>
        </Grid>
      </Section>

      <Section icon={<BankIcon color="secondary" fontSize="small" />} title="Bank Details (Printed on Bills/Invoices)">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Bank Name" value={form.bankName || ''} onChange={set('bankName')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Account Number" value={form.bankAccount || ''} onChange={set('bankAccount')} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="IBAN" value={form.bankIBAN || ''} onChange={set('bankIBAN')} placeholder="PK00AAAA0000000000000000" />
          </Grid>
        </Grid>
      </Section>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Receipt fontSize="small" color="action" />
          <Typography variant="subtitle1" fontWeight={700}>Invoice Footer Message</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <TextField fullWidth size="small" label="Footer text on invoices & bills"
          value={form.invoiceFooter || ''} onChange={set('invoiceFooter')}
          multiline rows={2} placeholder="Thank you for your business. Please pay within the agreed terms." />
      </Paper>

      <Box display="flex" justifyContent="flex-end" mt={3}>
        <Button variant="contained" size="large"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Company Profile'}
        </Button>
      </Box>
    </Box>
  );
}

// tiny fix — Receipt was not imported above
function Receipt(props) { return <TaxIcon {...props} />; }
