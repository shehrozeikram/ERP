import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Alert, Stack, Card, CardContent,
  Grid, TextField, MenuItem, Divider, Autocomplete, CircularProgress
} from '@mui/material';
import { LockClock as CloseIcon, Warning as WarnIcon, CheckCircle as OkIcon } from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function YearEndClosing() {
  const curYear = new Date().getFullYear();
  const years   = Array.from({ length: 10 }, (_, i) => curYear - i);

  const [year, setYear]       = useState(curYear - 1);
  const [accounts, setAccounts] = useState([]);
  const [reAccount, setReAccount] = useState(null);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.get('/finance/accounts', { params: { limit: 500 } });
      setAccounts(res.data.data || res.data.accounts || []);
    } catch { setAccounts([]); }
  }, []);

  React.useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleClose = async () => {
    if (!confirmed) { setError('Please confirm you understand this action before proceeding'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/finance/year-end-closing', {
        year,
        retainedEarningsAccountId: reAccount?._id || undefined
      });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Year-end closing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1} mb={3}>
        <CloseIcon color="warning" /> Year-End Closing
      </Typography>

      {error  && <Alert severity="error"   onClose={() => setError('')}  sx={{ mb: 2 }}>{error}</Alert>}

      {result && (
        <Alert severity="success" icon={<OkIcon />} sx={{ mb: 3 }}>
          <Typography fontWeight={700}>{result.message}</Typography>
          <Typography variant="body2">
            Revenue: PKR {fmt(result.data?.totalRevenue)} | Expenses: PKR {fmt(result.data?.totalExpenses)} | Net: PKR {fmt(result.data?.netIncome)}
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>Closing Parameters</Typography>

            <Stack gap={2}>
              <TextField
                select label="Fiscal Year to Close" value={year}
                onChange={e => setYear(Number(e.target.value))} fullWidth
              >
                {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </TextField>

              <Autocomplete
                options={accounts.filter(a => ['equity','retained_earnings','owners_equity'].some(t => a.type?.includes(t)))}
                getOptionLabel={o => o ? `${o.accountNumber} — ${o.name}` : ''}
                value={reAccount}
                onChange={(_, v) => setReAccount(v)}
                renderInput={params => (
                  <TextField {...params} label="Retained Earnings Account (optional — auto-detected)" />
                )}
              />
            </Stack>

            <Divider sx={{ my: 3 }} />

            <Alert severity="warning" icon={<WarnIcon />} sx={{ mb: 2 }}>
              <Typography fontWeight={700}>Important — Read Before Proceeding</Typography>
              <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 0.5 }}>
                <li>This will post a closing journal entry transferring the year's net income/loss to Retained Earnings</li>
                <li>This is an <b>irreversible</b> accounting action (you can manually reverse the JE if needed)</li>
                <li>Ensure all transactions for {year} have been entered and the fiscal period is locked</li>
                <li>Run Balance Sheet and P&L reports first to verify correctness</li>
              </Typography>
            </Alert>

            <Stack direction="row" alignItems="center" gap={1} mb={2}>
              <input type="checkbox" id="confirm-close" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
              <label htmlFor="confirm-close">
                <Typography variant="body2">I confirm that all {year} transactions are complete and I want to post the closing entry</Typography>
              </label>
            </Stack>

            <Button
              variant="contained" color="warning" size="large" fullWidth
              onClick={handleClose} disabled={loading || !confirmed}
              startIcon={loading ? <CircularProgress size={18} /> : <CloseIcon />}
            >
              {loading ? 'Processing…' : `Post Year-End Closing for ${year}`}
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>What This Does</Typography>
            <Stack gap={1.5}>
              {[
                { step: '1', title: 'Calculate Net Income', desc: `Sums all revenue and expense accounts for ${year}` },
                { step: '2', title: 'Post Closing Entry', desc: 'Creates a journal: DR Revenue → CR Retained Earnings (profit) or DR Retained Earnings → CR Expenses (loss)' },
                { step: '3', title: 'Balance Sheet Updated', desc: 'Retained Earnings on the Balance Sheet reflects the year\'s performance' },
                { step: '4', title: 'New Year Starts Fresh', desc: 'Income/expense accounts start at zero for the new fiscal year' }
              ].map(s => (
                <Stack key={s.step} direction="row" gap={1.5} alignItems="flex-start">
                  <Box sx={{ bgcolor: 'warning.main', color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700 }}>
                    {s.step}
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{s.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.desc}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              Tip: After closing, lock the {year} fiscal period to prevent any further postings.
              Go to <b>Fiscal Periods</b> → select the {year} periods → Lock.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
