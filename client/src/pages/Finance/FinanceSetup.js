import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Button, Alert, CircularProgress, Divider,
  Stack, Card, CardContent, Grid, Chip, List, ListItem, ListItemIcon,
  ListItemText, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stepper, Step, StepLabel, StepContent, Table,
  TableBody, TableCell, TableHead, TableRow, TableContainer
} from '@mui/material';
import {
  Warning as WarnIcon, CheckCircle as OkIcon, DeleteForever as ResetIcon,
  AutoFixHigh as SeedIcon, AccountBalance as CoAIcon, Settings as SetupIcon,
  ArrowForward as NextIcon, Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../../services/api';

const STEPS = [
  'Reset Finance Data',
  'Seed Chart of Accounts',
  'Map Inventory Categories',
  'Ready to Test'
];

export default function FinanceSetup() {
  const navigate = useNavigate();
  const [activeStep, setActiveStepRaw] = useState(() => {
    const saved = localStorage.getItem('financeSetupStep');
    return saved !== null ? Number(saved) : 0;
  });

  const setActiveStep = (step) => {
    setActiveStepRaw(step);
    localStorage.setItem('financeSetupStep', step);
  };

  // Step 1 — Reset
  const [resetDlg, setResetDlg]     = useState(false);
  const [resetTyped, setResetTyped] = useState('');
  const [resetting, setResetting]   = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [resetError, setResetError]   = useState('');

  // Step 2 — Seed
  const [seeding, setSeeding]       = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [seedError, setSeedError]   = useState('');

  const handleReset = async () => {
    if (resetTyped !== 'RESET_FINANCE') return;
    setResetting(true); setResetError('');
    try {
      const res = await api.post('/finance/admin/reset-finance', { confirm: 'RESET_FINANCE' });
      setResetResult(res.data.data);
      setResetDlg(false);
      setResetTyped('');
      setActiveStep(1);
      localStorage.setItem('financeSetupStep', 1);
    } catch (e) {
      setResetError(e.response?.data?.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true); setSeedError('');
    try {
      const res = await api.post('/finance/admin/seed-accounts');
      setSeedResult(res.data.data);
      setActiveStep(2);
    } catch (e) {
      setSeedError(e.response?.data?.message || 'Seed failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1.5} mb={1}>
        <SetupIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h5" fontWeight={800}>Finance Setup Wizard</Typography>
          <Typography variant="body2" color="text.secondary">
            Reset all finance data and seed a standard Pakistan-ready Chart of Accounts for testing
          </Typography>
        </Box>
      </Box>

      <Alert severity="warning" icon={<WarnIcon />} sx={{ mb: 3 }}>
        <strong>Developer Tool — Use before testing only.</strong> This will permanently delete all finance records
        (journal entries, AP, AR, GL, inventory stock) and reset everything to zero.
      </Alert>

      {/* Step jump bar */}
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} mr={1}>Jump to step:</Typography>
        {STEPS.map((label, i) => (
          <Chip
            key={i}
            label={`${i + 1}. ${label}`}
            size="small"
            onClick={() => setActiveStep(i)}
            color={activeStep === i ? 'primary' : 'default'}
            variant={activeStep === i ? 'filled' : 'outlined'}
            sx={{ cursor: 'pointer', fontWeight: activeStep === i ? 700 : 400 }}
          />
        ))}
        <Button size="small" sx={{ ml: 'auto' }} onClick={() => { localStorage.removeItem('financeSetupStep'); setActiveStep(0); }}>
          Reset Wizard
        </Button>
      </Paper>

      <Stepper activeStep={activeStep} orientation="vertical">

        {/* ── STEP 1: RESET ─────────────────────────────────────────── */}
        <Step>
          <StepLabel>
            <Typography fontWeight={700}>Reset Finance Data</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" mb={2}>
              This clears the following — <strong>cannot be undone:</strong>
            </Typography>
            <Grid container spacing={1} mb={2}>
              {[
                ['Journal Entries',   'All posted and draft journal entries'],
                ['General Ledger',    'All GL transaction lines'],
                ['Accounts Payable',  'All vendor bills and payments'],
                ['Accounts Receivable','All customer invoices and receipts'],
                ['Chart of Accounts', 'All GL accounts (will re-seed next step)'],
                ['Inventory Stock',   'Quantities reset to 0, costs reset to 0'],
                ['Banking Transactions','Transactions cleared, bank accounts kept'],
                ['Fixed Assets',      'All assets and depreciation schedules'],
                ['Budgets',           'All budgets and budget lines'],
                ['Deferred Entries',  'All deferred revenue/expense entries'],
                ['GRN Finance Links', 'billingStatus reset on all GRNs'],
                ['Sales Order Links', 'AR invoice links cleared'],
              ].map(([title, desc]) => (
                <Grid item xs={12} sm={6} key={title}>
                  <Box display="flex" gap={1} alignItems="flex-start">
                    <ResetIcon fontSize="small" color="error" sx={{ mt: 0.2, flexShrink: 0 }} />
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{title}</Typography>
                      <Typography variant="caption" color="text.secondary">{desc}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Typography variant="body2" color="text.secondary" mb={2}>
              ✅ <strong>Kept intact:</strong> Users, Vendors, Customers, Employees, Procurement Indents/POs/GRNs (data kept, finance links cleared), Taxes, Payment Terms, Finance Journals, Bank Account definitions.
            </Typography>
            {resetResult && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Finance data successfully reset! Records cleared: Journal Entries ({resetResult.journalEntries}),
                GL ({resetResult.generalLedger}), AP ({resetResult.accountsPayable}),
                AR ({resetResult.accountsReceivable}), Accounts ({resetResult.accounts})
              </Alert>
            )}
            <Button variant="contained" color="error" startIcon={<ResetIcon />}
              onClick={() => { setResetDlg(true); setResetError(''); }}>
              Reset All Finance Data
            </Button>
          </StepContent>
        </Step>

        {/* ── STEP 2: SEED ──────────────────────────────────────────── */}
        <Step>
          <StepLabel>
            <Typography fontWeight={700}>Seed Standard Chart of Accounts</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Creates <strong>55 standard accounts</strong> — a complete Pakistan-ready Chart of Accounts with proper numbering.
              This is what will drive every financial transaction in your test.
            </Typography>

            <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 700, bgcolor: 'primary.main' }}>Account #</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 700, bgcolor: 'primary.main' }}>Account Name</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 700, bgcolor: 'primary.main' }}>Type</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 700, bgcolor: 'primary.main' }}>Role</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      // Assets
                      ['1010', 'Cash in Hand',               'Asset',     ''],
                      ['1020', 'Bank Account – Main (HBL)',   'Asset',     '⭐ System - Bank'],
                      ['1100', 'Accounts Receivable',        'Asset',     '⭐ System - AR'],
                      ['1200', 'Raw Materials Inventory',    'Asset',     '⭐ System - Inventory'],
                      ['1300', 'GST Input Tax Recoverable',  'Asset',     '⭐ System - GST Input'],
                      ['1500', 'Land & Buildings',           'Asset',     'Fixed Asset'],
                      ['1520', 'Vehicles',                   'Asset',     'Fixed Asset'],
                      ['1590', 'Accumulated Depreciation',   'Asset',     '⭐ System - Depreciation'],
                      // Liabilities
                      ['2100', 'Accounts Payable',           'Liability', '⭐ System - AP'],
                      ['2110', 'WHT Payable (FBR)',          'Liability', '⭐ System - WHT'],
                      ['2120', 'GST / Sales Tax Payable',    'Liability', '⭐ System - GST Out'],
                      ['2130', 'Salary & Wages Payable',     'Liability', '⭐ System - Payroll'],
                      ['2140', 'GRNI – Goods Received Not Invoiced', 'Liability', '⭐ System - GRNI'],
                      // Equity
                      ['3000', 'Share Capital',              'Equity',    ''],
                      ['3100', 'Retained Earnings',          'Equity',    '⭐ System'],
                      // Revenue
                      ['4000', 'Sales Revenue',              'Revenue',   '⭐ System'],
                      // Expenses
                      ['5000', 'Cost of Goods Sold (COGS)',  'Expense',   '⭐ System - COGS'],
                      ['6000', 'Salaries & Wages',           'Expense',   '⭐ System - Payroll'],
                      ['6500', 'Depreciation Expense',       'Expense',   '⭐ System - Depreciation'],
                      ['…',    '+ 36 more accounts',         '—',         'Rent, Utilities, Travel, etc.'],
                    ].map(([num, name, type, role]) => (
                      <TableRow key={num} hover sx={{
                        bgcolor: role.includes('⭐') ? 'primary.50' : 'inherit'
                      }}>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{num}</TableCell>
                        <TableCell>{name}</TableCell>
                        <TableCell>
                          <Chip label={type} size="small" color={
                            { Asset: 'success', Liability: 'error', Equity: 'info', Revenue: 'warning', Expense: 'default' }[type] || 'default'
                          } variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color={role.includes('⭐') ? 'primary.main' : 'text.secondary'} fontWeight={role.includes('⭐') ? 700 : 400}>
                            {role}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {seedError && <Alert severity="error" sx={{ mb: 2 }}>{seedError}</Alert>}

            {seedResult && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <strong>{seedResult.total} accounts created!</strong> Assets: {seedResult.byType?.Assets}, Liabilities: {seedResult.byType?.Liabilities},
                Equity: {seedResult.byType?.Equity}, Revenue: {seedResult.byType?.Revenue}, Expenses: {seedResult.byType?.Expenses}
              </Alert>
            )}

            <Button variant="contained" color="success"
              startIcon={seeding ? <CircularProgress size={18} color="inherit" /> : <SeedIcon />}
              onClick={handleSeed} disabled={seeding}>
              {seeding ? 'Creating Accounts…' : 'Seed 55 Standard Accounts'}
            </Button>
          </StepContent>
        </Step>

        {/* ── STEP 3: MAP INVENTORY CATEGORIES ─────────────────────── */}
        <Step>
          <StepLabel>
            <Typography fontWeight={700}>Map Inventory Categories to GL Accounts</Typography>
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" mb={2}>
              This is the critical link between Store items and Finance. Each item category must be mapped to:
            </Typography>
            <List dense>
              {[
                ['Inventory Account', '1200 – Raw Materials Inventory', 'Asset account where stock is held'],
                ['COGS Account', '5000 – Cost of Goods Sold', 'Expense account when items are issued from store'],
              ].map(([label, acc, desc]) => (
                <ListItem key={label} sx={{ pl: 0 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}><OkIcon color="success" fontSize="small" /></ListItemIcon>
                  <ListItemText
                    primary={<><strong>{label}:</strong> {acc}</>}
                    secondary={desc}
                  />
                </ListItem>
              ))}
            </List>
            <Alert severity="info" sx={{ mb: 2 }}>
              Go to <strong>Finance → Configuration → Inventory Categories</strong> after seeding accounts.
              Map your "Cement" or "Raw Materials" category to accounts 1200 and 5000.
            </Alert>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" endIcon={<NextIcon />}
                onClick={() => {
                  localStorage.setItem('financeSetupStep', 2);
                  navigate('/finance/inventory-categories');
                }}>
                Go to Inventory Categories
              </Button>
              <Button variant="outlined" onClick={() => setActiveStep(3)}>
                ✅ Done — Continue to Step 4
              </Button>
            </Stack>
          </StepContent>
        </Step>

        {/* ── STEP 4: READY ─────────────────────────────────────────── */}
        <Step>
          <StepLabel>
            <Typography fontWeight={700}>Ready to Test!</Typography>
          </StepLabel>
          <StepContent>
            <Alert severity="success" sx={{ mb: 3 }}>
              <strong>Setup complete!</strong> Your finance module is clean and ready for a full end-to-end test.
            </Alert>

            <Typography variant="subtitle1" fontWeight={700} mb={1}>Follow this exact test sequence:</Typography>

            <List dense>
              {[
                ['1', 'Finance → Configuration → Inventory Categories', 'Map Cement category → Account 1200 (Inventory) + Account 5000 (COGS)'],
                ['2', 'Finance → Chart of Accounts', 'Click "Ensure System Accounts" button to auto-link critical accounts'],
                ['3', 'Store → Add Item', 'Add "OPC Cement 50kg Bag" with category "Cement/Raw Materials"'],
                ['4', 'Procurement → New Indent', 'Create indent for 100 bags OPC Cement'],
                ['5', 'Procurement → Approve Indent', 'HOD/CEO approve the indent'],
                ['6', 'Procurement → Create PO', 'Create Purchase Order from approved indent, set price PKR 850/bag'],
                ['7', 'Procurement → GRN', 'Create Goods Receipt Note — receive 100 bags'],
                ['8', 'Finance → Accounts Payable', 'Create Vendor Bill from GRN — check GRNI journal auto-posted'],
                ['9', 'Finance → AP → Pay Bill', 'Pay the vendor (with WHT @ 4% if applicable)'],
                ['10','Store → Issue Note', 'Issue 50 bags to a department/project'],
                ['11','Finance → Journal Entries', 'Verify all auto-posted entries are correct'],
                ['12','Finance → Balance Sheet', 'Verify Assets, AP, Inventory all correct'],
                ['13','Finance → Profit & Loss', 'Verify COGS appears as expense'],
              ].map(([step, page, desc]) => (
                <ListItem key={step} sx={{ pl: 0, alignItems: 'flex-start' }}>
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                    <Chip label={step} size="small" color="primary" sx={{ width: 28, height: 22, fontSize: 11, fontWeight: 700 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography variant="body2" fontWeight={700}>{page}</Typography>}
                    secondary={desc}
                  />
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" fontWeight={700} mb={1} color="primary.main">Quick Navigation</Typography>
            <Grid container spacing={1}>
              {[
                ['Chart of Accounts', '/finance/accounts'],
                ['Inventory Categories', '/finance/inventory-categories'],
                ['Journal Entries', '/finance/journal-entries'],
                ['Accounts Payable', '/finance/accounts-payable'],
                ['Balance Sheet', '/finance/balance-sheet'],
                ['Profit & Loss', '/finance/profit-loss'],
              ].map(([label, path]) => (
                <Grid item key={label}>
                  <Button size="small" variant="outlined" onClick={() => navigate(path)}>{label}</Button>
                </Grid>
              ))}
            </Grid>
          </StepContent>
        </Step>

      </Stepper>

      {/* ── RESET CONFIRMATION DIALOG ─────────────────────────────── */}
      <Dialog open={resetDlg} onClose={() => setResetDlg(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarnIcon color="error" /> Confirm Finance Reset
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            This will permanently delete <strong>all finance data</strong> including journal entries, AP bills, AR invoices, Chart of Accounts, and reset inventory to zero. This cannot be undone.
          </Alert>
          <Typography variant="body2" mb={1}>
            Type <strong>RESET_FINANCE</strong> below to confirm:
          </Typography>
          <TextField
            fullWidth size="small" value={resetTyped}
            onChange={e => setResetTyped(e.target.value)}
            placeholder="RESET_FINANCE"
            error={resetTyped.length > 0 && resetTyped !== 'RESET_FINANCE'}
            helperText={resetTyped.length > 0 && resetTyped !== 'RESET_FINANCE' ? 'Must match exactly' : ''}
          />
          {resetError && <Alert severity="error" sx={{ mt: 1 }}>{resetError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setResetDlg(false); setResetTyped(''); }}>Cancel</Button>
          <Button variant="contained" color="error" startIcon={resetting ? <CircularProgress size={18} color="inherit" /> : <ResetIcon />}
            onClick={handleReset} disabled={resetTyped !== 'RESET_FINANCE' || resetting}>
            {resetting ? 'Resetting…' : 'Yes, Reset Everything'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
