import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, TextField, MenuItem, CircularProgress, Alert,
  Stack, Grid, IconButton, Divider, Tooltip, Chip, Autocomplete
} from '@mui/material';
import {
  Save as SaveIcon, ArrowBack as BackIcon, Add as AddIcon, Delete as DeleteIcon,
  BarChart as BudgetIcon
} from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });

export default function BudgetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState({
    name: '',
    fiscalYear: new Date().getFullYear(),
    startDate: `${new Date().getFullYear()}-07-01`,
    endDate:   `${new Date().getFullYear()}-06-30`,
    department: '',
    description: '',
    status: 'draft',
    lines: []
  });
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(!isNew);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const load = useCallback(async () => {
    try {
      const [accRes, ...rest] = await Promise.all([
        api.get('/finance/accounts', { params: { type: 'Expense,Revenue', limit: 500 } }),
        ...(isNew ? [] : [api.get(`/finance/budgets/${id}`)])
      ]);
      const accs = accRes.data.data || accRes.data.accounts || [];
      setAccounts(accs.filter(a => ['Expense', 'Revenue'].includes(a.type)));

      if (!isNew && rest[0]) {
        const b = rest[0].data.data;
        setForm({
          ...b,
          startDate: b.startDate?.split('T')[0] || '',
          endDate:   b.endDate?.split('T')[0]   || '',
          lines: (b.lines || []).map(l => ({
            account: l.account?._id || l.account,
            accountName: l.account?.name || l.accountName || '',
            accountNumber: l.account?.accountNumber || '',
            accountType: l.account?.type || '',
            budgetAmount: l.budgetAmount,
            notes: l.notes || ''
          }))
        });
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  const setF = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const addLine = () => setForm(f => ({
    ...f,
    lines: [...f.lines, { account: '', accountName: '', budgetAmount: 0, notes: '' }]
  }));

  const updateLine = (i, field, value) => setForm(f => {
    const lines = [...f.lines];
    lines[i] = { ...lines[i], [field]: value };
    return { ...f, lines };
  });

  const removeLine = (i) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const setAccount = (i, acc) => {
    if (!acc) { updateLine(i, 'account', ''); updateLine(i, 'accountName', ''); return; }
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], account: acc._id, accountName: acc.name, accountNumber: acc.accountNumber, accountType: acc.type };
      return { ...f, lines };
    });
  };

  const totalBudget = form.lines.reduce((s, l) => s + Number(l.budgetAmount || 0), 0);

  const handleSave = async () => {
    if (!form.name) { setError('Budget name is required'); return; }
    if (form.lines.length === 0) { setError('Add at least one budget line'); return; }
    if (form.lines.some(l => !l.account)) { setError('All lines must have an account selected'); return; }
    setSaving(true); setError('');
    try {
      if (isNew) {
        const res = await api.post('/finance/budgets', form);
        setSuccess('Budget created');
        navigate(`/finance/budgets/${res.data.data._id}`);
      } else {
        await api.put(`/finance/budgets/${id}`, form);
        setSuccess('Budget saved');
        load();
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box display="flex" justifyContent="center" p={6}><CircularProgress /></Box>;

  const expenseLines = form.lines.filter(l => l.accountType === 'Expense');
  const revenueLines = form.lines.filter(l => l.accountType === 'Revenue');
  const totalExpense = expenseLines.reduce((s, l) => s + Number(l.budgetAmount || 0), 0);
  const totalRevenue = revenueLines.reduce((s, l) => s + Number(l.budgetAmount || 0), 0);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/finance/budgets')} size="small">Budgets</Button>
          <Typography variant="h5" fontWeight={700}>{isNew ? 'Create Budget' : form.name}</Typography>
          {!isNew && <Chip label={form.status} color={{ draft: 'default', approved: 'success', locked: 'error' }[form.status] || 'default'} size="small" />}
        </Box>
        <Stack direction="row" spacing={1}>
          {!isNew && (
            <Button variant="outlined" startIcon={<BudgetIcon />}
              onClick={() => navigate(`/finance/budget-vs-actual?budgetId=${id}`)}>
              Budget vs Actual
            </Button>
          )}
          <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave} disabled={saving || form.status === 'locked'}>
            {saving ? 'Saving…' : 'Save Budget'}
          </Button>
        </Stack>
      </Stack>

      {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      {/* Header fields */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>Budget Details</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Budget Name *" value={form.name} onChange={setF('name')} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <TextField fullWidth size="small" label="Fiscal Year" type="number" value={form.fiscalYear} onChange={setF('fiscalYear')} />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField fullWidth size="small" label="Department" value={form.department || ''} onChange={setF('department')} placeholder="e.g. finance, operations" />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="Start Date" type="date" value={form.startDate} onChange={setF('startDate')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="End Date" type="date" value={form.endDate} onChange={setF('endDate')} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Description" value={form.description || ''} onChange={setF('description')} />
          </Grid>
        </Grid>
      </Paper>

      {/* Budget lines */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1" fontWeight={700}>Budget Lines</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip label={`Total: PKR ${fmt(totalBudget)}`} color="primary" size="small" sx={{ fontWeight: 700 }} />
            {form.status !== 'locked' && (
              <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={addLine}>Add Line</Button>
            )}
          </Stack>
        </Stack>

        {form.lines.length === 0 && (
          <Box textAlign="center" py={3} color="text.disabled">
            <Typography variant="body2">No budget lines yet. Click "Add Line" to start.</Typography>
          </Box>
        )}

        {/* Revenue lines */}
        {revenueLines.length > 0 && (
          <>
            <Typography variant="caption" fontWeight={700} color="success.main" sx={{ display: 'block', mb: 1, letterSpacing: 1 }}>REVENUE BUDGET</Typography>
            {form.lines.map((line, i) => line.accountType !== 'Revenue' ? null : (
              <BudgetLine key={i} line={line} index={i} accounts={accounts} onUpdate={updateLine}
                onRemove={removeLine} onSetAccount={setAccount} locked={form.status === 'locked'} />
            ))}
            <Box textAlign="right" mb={1}>
              <Typography variant="caption" color="success.main" fontWeight={700}>Revenue Total: PKR {fmt(totalRevenue)}</Typography>
            </Box>
            <Divider sx={{ mb: 1 }} />
          </>
        )}

        {/* Expense lines */}
        {expenseLines.length > 0 && (
          <>
            <Typography variant="caption" fontWeight={700} color="error.main" sx={{ display: 'block', mb: 1, letterSpacing: 1 }}>EXPENSE BUDGET</Typography>
            {form.lines.map((line, i) => line.accountType !== 'Expense' ? null : (
              <BudgetLine key={i} line={line} index={i} accounts={accounts} onUpdate={updateLine}
                onRemove={removeLine} onSetAccount={setAccount} locked={form.status === 'locked'} />
            ))}
            <Box textAlign="right" mb={1}>
              <Typography variant="caption" color="error.main" fontWeight={700}>Expense Total: PKR {fmt(totalExpense)}</Typography>
            </Box>
          </>
        )}

        {/* Lines with no account type yet */}
        {form.lines.map((line, i) => (!line.accountType) ? (
          <BudgetLine key={i} line={line} index={i} accounts={accounts} onUpdate={updateLine}
            onRemove={removeLine} onSetAccount={setAccount} locked={form.status === 'locked'} />
        ) : null)}
      </Paper>
    </Box>
  );
}

function BudgetLine({ line, index, accounts, onUpdate, onRemove, onSetAccount, locked }) {
  const acc = accounts.find(a => a._id === line.account) || null;
  return (
    <Stack direction="row" spacing={1} mb={1} alignItems="center">
      <Autocomplete
        size="small" sx={{ flex: 2, minWidth: 220 }}
        options={accounts}
        getOptionLabel={o => `${o.accountNumber} — ${o.name}`}
        value={acc}
        onChange={(_, val) => onSetAccount(index, val)}
        renderInput={(params) => <TextField {...params} label="Account *" placeholder="Search account…" />}
        disabled={locked}
      />
      <TextField
        size="small" label="Budget Amount (PKR)" type="number"
        value={line.budgetAmount} onChange={e => onUpdate(index, 'budgetAmount', e.target.value)}
        sx={{ width: 180 }} inputProps={{ min: 0 }} disabled={locked}
      />
      <TextField
        size="small" label="Notes" value={line.notes || ''}
        onChange={e => onUpdate(index, 'notes', e.target.value)}
        sx={{ flex: 1 }} disabled={locked}
      />
      {!locked && (
        <Tooltip title="Remove line">
          <IconButton size="small" color="error" onClick={() => onRemove(index)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}
