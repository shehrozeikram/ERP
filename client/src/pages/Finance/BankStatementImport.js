import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Button, TextField, MenuItem, CircularProgress, Alert,
  Stack, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Divider, Card, CardContent, Stepper, Step, StepLabel, FormControl,
  InputLabel, Select
} from '@mui/material';
import {
  CloudUpload as UploadIcon, AccountBalance as BankIcon,
  CheckCircle as DoneIcon, TableView as CsvIcon, Preview as PreviewIcon
} from '@mui/icons-material';
import api from '../../services/api';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 });

const STEPS = ['Select Bank Account', 'Upload File', 'Map Columns', 'Review & Import'];

export default function BankStatementImport() {
  const fileInputRef = useRef(null);

  const [step, setStep]           = useState(0);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [file, setFile]           = useState(null);
  const [colMap, setColMap]       = useState({
    dateColumn: 'Date', descColumn: 'Description',
    debitColumn: 'Debit', creditColumn: 'Credit', balanceColumn: 'Balance'
  });
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState('');

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.get('/finance/banking/accounts');
      setBankAccounts(res.data.data || res.data.accounts || []);
    } catch (e) {
      setError('Failed to load bank accounts');
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setStep(2); }
  };

  const handleImport = async () => {
    if (!bankAccountId) { setError('Select a bank account'); return; }
    if (!file) { setError('Select a file to import'); return; }
    setImporting(true); setError(''); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bankAccountId', bankAccountId);
      Object.entries(colMap).forEach(([k, v]) => fd.append(k, v));

      const res = await api.post('/finance/banking/import-statement', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
      setStep(3);
    } catch (e) {
      setError(e.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(0); setFile(null); setResult(null); setError('');
    setBankAccountId(''); setColMap({ dateColumn: 'Date', descColumn: 'Description', debitColumn: 'Debit', creditColumn: 'Credit', balanceColumn: 'Balance' });
  };

  const selectedAccount = bankAccounts.find(a => a._id === bankAccountId);

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <BankIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>Bank Statement Import</Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Upload a <strong>CSV or Excel (.xlsx)</strong> bank statement. The system will parse transactions and add them to your bank account for reconciliation.
        Duplicate transactions are automatically skipped.
      </Alert>

      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {STEPS.map(label => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {/* Step 0: Select Account */}
      {step === 0 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>Select Bank Account</Typography>
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel>Bank Account *</InputLabel>
            <Select value={bankAccountId} label="Bank Account *" onChange={e => setBankAccountId(e.target.value)}>
              {bankAccounts.map(a => (
                <MenuItem key={a._id} value={a._id}>{a.name} — {a.accountNumber}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedAccount && (
            <Box sx={{ bgcolor: 'primary.50', borderRadius: 1, p: 2, mb: 2 }}>
              <Typography variant="body2" fontWeight={600}>{selectedAccount.name}</Typography>
              <Typography variant="caption" color="text.secondary">Current Balance: PKR {fmt(selectedAccount.currentBalance)}</Typography>
            </Box>
          )}
          <Button variant="contained" disabled={!bankAccountId} onClick={() => setStep(1)}>
            Next: Upload File
          </Button>
        </Paper>
      )}

      {/* Step 1: Upload File */}
      {step === 1 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>Upload Statement File</Typography>
          <Box
            sx={{
              border: '2px dashed', borderColor: 'primary.main', borderRadius: 2, p: 5,
              textAlign: 'center', cursor: 'pointer', bgcolor: 'primary.50',
              '&:hover': { bgcolor: 'primary.100' }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h6" color="primary.main">Click to browse or drag & drop</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>Supports CSV and Excel (.xlsx, .xls)</Typography>
            {file && <Chip label={file.name} color="primary" sx={{ mt: 1 }} />}
          </Box>
          <input ref={fileInputRef} type="file" hidden accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
          <Stack direction="row" spacing={2} mt={2}>
            <Button variant="outlined" onClick={() => setStep(0)}>Back</Button>
            <Button variant="contained" disabled={!file} onClick={() => setStep(2)}>
              Next: Map Columns
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={1}>Map Column Names</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Enter the exact column headers from your CSV/Excel file. Common banks use:
            <br />HBL: Date, Narration, Debit, Credit, Balance &nbsp;|&nbsp; MCB: Transaction Date, Description, Withdrawal, Deposit, Balance
          </Typography>
          <Grid container spacing={2} mb={3}>
            {[
              { field: 'dateColumn',    label: 'Date Column Header' },
              { field: 'descColumn',    label: 'Description Column' },
              { field: 'debitColumn',   label: 'Debit / Withdrawal Column' },
              { field: 'creditColumn',  label: 'Credit / Deposit Column' },
              { field: 'balanceColumn', label: 'Balance Column (optional)' }
            ].map(({ field, label }) => (
              <Grid item xs={12} sm={6} key={field}>
                <TextField fullWidth size="small" label={label} value={colMap[field]}
                  onChange={e => setColMap(m => ({ ...m, [field]: e.target.value }))} />
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} mb={1}>Summary</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Bank Account</Typography>
                  <Typography variant="body2" fontWeight={700}>{selectedAccount?.name || '—'}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">File</Typography>
                  <Typography variant="body2" fontWeight={700}>{file?.name || '—'}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Date Column</Typography>
                  <Typography variant="body2" fontWeight={700}>{colMap.dateColumn}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} mt={3}>
            <Button variant="outlined" onClick={() => setStep(1)}>Back</Button>
            <Button variant="contained" color="success"
              startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
              onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : 'Import Transactions'}
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Step 3: Result */}
      {step === 3 && result && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <DoneIcon color="success" />
            <Typography variant="h6" fontWeight={700} color="success.main">{result.message}</Typography>
          </Box>

          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={3}>
              <Card variant="outlined" sx={{ bgcolor: 'success.50' }}>
                <CardContent sx={{ py: 1.5, textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={900} color="success.main">{result.data?.imported}</Typography>
                  <Typography variant="caption" color="text.secondary">Imported</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={900} color="text.secondary">{result.data?.skipped}</Typography>
                  <Typography variant="caption" color="text.secondary">Skipped</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {(result.data?.skippedRows || []).length > 0 && (
            <>
              <Typography variant="subtitle2" fontWeight={700} mb={1} color="warning.main">Skipped Rows (first 10)</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'warning.50' }}>
                      <TableCell>Reason</TableCell><TableCell>Data</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.data.skippedRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell><Chip label={r.reason} size="small" color="warning" /></TableCell>
                        <TableCell><Typography variant="caption">{JSON.stringify(r.row || {})}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={reset}>Import Another File</Button>
            <Button variant="contained" onClick={() => window.location.href = '/finance/banking'}>
              Go to Banking & Reconciliation
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
