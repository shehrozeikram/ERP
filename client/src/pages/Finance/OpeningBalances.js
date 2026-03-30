import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Alert, Stack, TextField, MenuItem,
  IconButton, Divider, CircularProgress, Chip, Autocomplete
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon,
  LockOpen as OpenIcon, History as HistoryIcon
} from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyLine = { account: null, description: 'Opening balance', debit: '', credit: '' };

export default function OpeningBalances() {
  const [accounts, setAccounts]   = useState([]);
  const [lines, setLines]         = useState([{ ...emptyLine }]);
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes]         = useState('Opening balances — system go-live');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [history, setHistory]     = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.get('/finance/accounts', { params: { limit: 500 } });
      setAccounts(res.data.data || res.data.accounts || []);
    } catch { setAccounts([]); }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await api.get('/finance/opening-balances');
      setHistory(res.data.data || []);
    } catch { setHistory([]); }
    finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => { loadAccounts(); loadHistory(); }, [loadAccounts, loadHistory]);

  const setLine = (idx, field, val) => {
    const next = [...lines];
    next[idx] = { ...next[idx], [field]: val };
    setLines(next);
  };
  const addLine    = () => setLines([...lines, { ...emptyLine }]);
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx));

  const totalDebits  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced   = Math.abs(totalDebits - totalCredits) < 0.01;

  const handleSave = async () => {
    if (!isBalanced) { setError('Debits must equal Credits before posting'); return; }
    const validLines = lines.filter(l => l.account && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length === 0) { setError('Add at least one line with an account and amount'); return; }

    setSaving(true); setError('');
    try {
      await api.post('/finance/opening-balances', {
        date,
        notes,
        lines: validLines.map(l => ({
          account:     l.account._id || l.account,
          description: l.description || 'Opening balance',
          debit:       Number(l.debit)  || 0,
          credit:      Number(l.credit) || 0
        }))
      });
      setSuccess('Opening balances posted successfully');
      setLines([{ ...emptyLine }]);
      loadHistory();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to post opening balances');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} display="flex" alignItems="center" gap={1} mb={3}>
        <OpenIcon color="primary" /> Opening Balances
      </Typography>

      {error   && <Alert severity="error"   onClose={() => setError('')}   sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} mb={2}>Enter Opening Balances</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Use this page to enter historical account balances when going live on this ERP. Total debits must equal total credits.
          This creates a special "Opening Entry" journal entry that sets your starting point.
        </Typography>

        <Stack direction="row" gap={2} mb={2}>
          <TextField label="Date" type="date" size="small" value={date}
            onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ maxWidth: 200 }} />
          <TextField label="Notes" value={notes} onChange={e => setNotes(e.target.value)} size="small" fullWidth />
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ minWidth: 280 }}><b>Account</b></TableCell>
                <TableCell><b>Description</b></TableCell>
                <TableCell align="right" sx={{ minWidth: 140 }}><b>Debit (PKR)</b></TableCell>
                <TableCell align="right" sx={{ minWidth: 140 }}><b>Credit (PKR)</b></TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Autocomplete
                      size="small"
                      options={accounts}
                      getOptionLabel={o => o ? `${o.accountNumber} — ${o.name}` : ''}
                      value={line.account}
                      onChange={(_, v) => setLine(idx, 'account', v)}
                      renderInput={params => <TextField {...params} placeholder="Select account" />}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={line.description}
                      onChange={e => setLine(idx, 'description', e.target.value)} fullWidth />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={line.debit}
                      onChange={e => { setLine(idx, 'debit', e.target.value); if (e.target.value) setLine(idx, 'credit', ''); }}
                      inputProps={{ min: 0, step: 0.01 }} sx={{ maxWidth: 140 }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" type="number" value={line.credit}
                      onChange={e => { setLine(idx, 'credit', e.target.value); if (e.target.value) setLine(idx, 'debit', ''); }}
                      inputProps={{ min: 0, step: 0.01 }} sx={{ maxWidth: 140 }} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="error" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals row */}
              <TableRow sx={{ bgcolor: isBalanced ? 'success.50' : 'error.50' }}>
                <TableCell colSpan={2} align="right"><b>Totals</b></TableCell>
                <TableCell align="right"><b>PKR {fmt(totalDebits)}</b></TableCell>
                <TableCell align="right"><b>PKR {fmt(totalCredits)}</b></TableCell>
                <TableCell>
                  <Chip
                    label={isBalanced ? 'Balanced' : `Off by ${fmt(Math.abs(totalDebits - totalCredits))}`}
                    color={isBalanced ? 'success' : 'error'} size="small"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" justifyContent="space-between" mt={2}>
          <Button startIcon={<AddIcon />} onClick={addLine} size="small">Add Line</Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || !isBalanced}
          >
            {saving ? 'Posting…' : 'Post Opening Balances'}
          </Button>
        </Stack>
      </Paper>

      {/* History */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={700} display="flex" alignItems="center" gap={1} mb={2}>
          <HistoryIcon fontSize="small" /> Previously Posted Opening Entries
        </Typography>
        {loadingHistory ? <CircularProgress size={20} /> : (
          history.length === 0
            ? <Typography variant="body2" color="text.secondary">No opening balance entries yet.</Typography>
            : history.map(entry => (
              <Paper key={entry._id} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" fontWeight={700}>{entry.entryNumber} — {entry.description}</Typography>
                  <Stack direction="row" gap={1}>
                    <Chip label={new Date(entry.date).toLocaleDateString()} size="small" />
                    <Chip label={entry.status} color="success" size="small" />
                  </Stack>
                </Stack>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell><b>Account</b></TableCell>
                      <TableCell><b>Description</b></TableCell>
                      <TableCell align="right"><b>Debit</b></TableCell>
                      <TableCell align="right"><b>Credit</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entry.lines?.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.account?.accountNumber} — {l.account?.name}</TableCell>
                        <TableCell>{l.description}</TableCell>
                        <TableCell align="right">{l.debit > 0 ? fmt(l.debit) : '—'}</TableCell>
                        <TableCell align="right">{l.credit > 0 ? fmt(l.credit) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            ))
        )}
      </Paper>
    </Box>
  );
}
