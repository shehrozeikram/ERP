import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  AccountBalance as BankIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { fetchTajBanks, createTajBank, deleteTajBank, fetchAllDeposits } from '../../../services/tajResidentsService';

const BANK_REQUIRED_METHODS = new Set(['Bank Transfer', 'Cheque', 'Online']);
const normalizeBank = (value) => String(value || '').trim();

const Banks = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [banks, setBanks] = useState([]);
  const [deposits, setDeposits] = useState([]);

  // Add bank dialog
  const [addDialog, setAddDialog] = useState(false);
  const [newBankName, setNewBankName] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [banksRes, depositsRes] = await Promise.all([
        fetchTajBanks(),
        fetchAllDeposits({ page: 1, limit: 10000 })
      ]);
      setBanks(banksRes?.data?.data || []);
      setDeposits(depositsRes?.data?.data?.deposits || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Enrich each bank with usage stats from deposits
  const bankRows = useMemo(() => {
    const statsMap = new Map();
    deposits.forEach((deposit) => {
      const method = normalizeBank(deposit.paymentMethod);
      const bankName = normalizeBank(deposit.bank);
      if (!bankName || !BANK_REQUIRED_METHODS.has(method)) return;
      const key = bankName.toLowerCase();
      const cur = statsMap.get(key) || { usedInDeposits: 0, totalAmount: 0 };
      cur.usedInDeposits += 1;
      cur.totalAmount += Number(deposit.amount) || 0;
      statsMap.set(key, cur);
    });

    return banks.map((bank) => {
      const stats = statsMap.get(bank.name.toLowerCase()) || { usedInDeposits: 0, totalAmount: 0 };
      return { ...bank, ...stats };
    });
  }, [banks, deposits]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return bankRows;
    return bankRows.filter((row) => row.name.toLowerCase().includes(query));
  }, [search, bankRows]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(value || 0);

  const handleAddBank = useCallback(async () => {
    const trimmed = newBankName.trim();
    if (!trimmed) return;
    try {
      setSaving(true);
      setError('');
      await createTajBank(trimmed);
      setSuccess(`Bank "${trimmed}" added`);
      setNewBankName('');
      setAddDialog(false);
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to add bank');
    } finally {
      setSaving(false);
    }
  }, [newBankName, loadData]);

  const handleDeleteBank = useCallback(async (bank) => {
    if (bank.usedInDeposits > 0) {
      if (!window.confirm(`"${bank.name}" is used in ${bank.usedInDeposits} deposit(s). Deleting it will only remove it from this list — existing deposit records are not affected. Continue?`)) return;
    } else {
      if (!window.confirm(`Delete bank "${bank.name}"?`)) return;
    }
    try {
      setError('');
      await deleteTajBank(bank._id);
      setSuccess(`Bank "${bank.name}" deleted`);
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete bank');
    }
  }, [loadData]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h4" fontWeight={600}>
          Banks
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setNewBankName(''); setAddDialog(true); }}
        >
          Add Bank
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manage bank accounts used in Taj Utilities deposits. Banks added here will appear in all deposit forms.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Search Bank"
                placeholder="e.g. ABL 129, CAM CHARGES ADJUSTMENT"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={`Total Banks: ${bankRows.length}`} color="primary" variant="outlined" />
                <Chip
                  label={`Active in Deposits: ${bankRows.filter((b) => b.usedInDeposits > 0).length}`}
                  color="success"
                  variant="outlined"
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredRows.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                {bankRows.length === 0
                  ? 'No banks yet. Click "Add Bank" to create one.'
                  : 'No banks match your search.'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredRows.map((row) => (
                <ListItem
                  key={row._id}
                  divider
                  secondaryAction={
                    <Tooltip title="Delete bank">
                      <IconButton
                        edge="end"
                        color="error"
                        size="small"
                        onClick={() => handleDeleteBank(row)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <BankIcon sx={{ mr: 2, color: 'primary.main', flexShrink: 0 }} />
                  <ListItemText
                    primary={<Typography fontWeight={500}>{row.name}</Typography>}
                    secondary={
                      row.usedInDeposits > 0
                        ? `Used in ${row.usedInDeposits} deposit(s) · ${formatCurrency(row.totalAmount)}`
                        : 'Not used in any deposit yet'
                    }
                  />
                  {row.usedInDeposits > 0 && (
                    <Chip label="Active" size="small" color="success" sx={{ mr: 5 }} />
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Add Bank Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Add New Bank</span>
          <IconButton onClick={() => setAddDialog(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Bank Name"
            placeholder="e.g. ABL 129, HBL Main"
            value={newBankName}
            onChange={(e) => setNewBankName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddBank(); }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddBank}
            disabled={!newBankName.trim() || saving}
          >
            {saving ? 'Saving…' : 'Add Bank'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Banks;
