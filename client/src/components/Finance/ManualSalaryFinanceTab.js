import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  Payments as PaymentsIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import api from '../../services/api';
import {
  fetchFinanceAuthorityCandidates,
  userOptionLabel,
  userOptionSecondary
} from '../../services/financeApprovalAuthorityService';
import { fetchPayFromAccounts, formatPayFromAccountLabel } from '../../utils/payFromAccounts';
import { useFinanceCompany } from '../../context/FinanceCompanyContext';

const SR_MANAGER_ACCOUNTS_NAME = 'Muhammad Iftikhar Rashid';

const fmt = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`;

const statusChip = (status) => {
  if (status === 'paid') return <Chip size="small" color="success" label="Paid" />;
  if (status === 'payment_pending') return <Chip size="small" color="info" label="Payment Pending Approval" />;
  if (status === 'pending_payment') return <Chip size="small" color="warning" label="Pending Payment" />;
  return <Chip size="small" label={status || '—'} />;
};

const recordStatusChip = (status) => {
  const s = String(status || '');
  let color = 'default';
  if (s === 'Paid') color = 'success';
  else if (s === 'Payment Pending') color = 'info';
  else if (s === 'Pending Finance' || s === 'Approved by CEO') color = 'warning';
  return <Chip size="small" label={s || '—'} color={color} variant={s === 'Paid' ? 'filled' : 'outlined'} />;
};

export default function ManualSalaryFinanceTab({ onSnackbar }) {
  const { selectedCompanyId, companies: financeCompanies } = useFinanceCompany();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [financeAuthorityCandidates, setFinanceAuthorityCandidates] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [paymentFinAuth, setPaymentFinAuth] = useState({ financeControllerUser: null });
  const [payingCompanyId, setPayingCompanyId] = useState('');
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    grossAmount: 0,
    paymentMethod: 'bank_transfer',
    reference: '',
    narration: '',
    paymentDate: new Date().toISOString().split('T')[0],
    bankAccountId: ''
  });

  const notify = useCallback((message, severity = 'success') => {
    if (onSnackbar) onSnackbar({ open: true, message, severity });
  }, [onSnackbar]);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/finance/manual-salary-queue');
      setQueue(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load manual salary finance queue');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (month, year) => {
    try {
      setDetailLoading(true);
      const res = await api.get(`/finance/manual-salary-queue/${month}/${year}`);
      setDetail(res.data?.data || null);
      setSelected({ month, year, periodLabel: res.data?.data?.periodLabel });
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to load manual salary period', 'error');
    } finally {
      setDetailLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const effectivePayingCompanyId = useMemo(
    () => payingCompanyId || selectedCompanyId,
    [payingCompanyId, selectedCompanyId]
  );

  useEffect(() => {
    if (!paymentDialogOpen) return;
    let cancelled = false;
    fetchFinanceAuthorityCandidates()
      .then((list) => {
        if (cancelled) return;
        setFinanceAuthorityCandidates(list);
        const faisalMatch = list.find((user) => {
          const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
          return fullName.includes('faisal') && fullName.includes('farooq');
        });
        if (faisalMatch) {
          setPaymentFinAuth((prev) => ({ ...prev, financeControllerUser: faisalMatch }));
        }
      })
      .catch(() => {
        if (!cancelled) setFinanceAuthorityCandidates([]);
      });
    fetchPayFromAccounts(api, { companyId: effectivePayingCompanyId })
      .then((list) => {
        if (!cancelled) setBankAccounts(list);
      })
      .catch(() => {
        if (!cancelled) setBankAccounts([]);
      });
    return () => { cancelled = true; };
  }, [paymentDialogOpen, effectivePayingCompanyId]);

  const pendingRecords = useMemo(
    () => (detail?.records || []).filter((r) =>
      ['Pending Finance', 'Approved by CEO'].includes(r.workflowStatus)
    ),
    [detail]
  );

  const pendingPaymentApps = useMemo(
    () => (detail?.paymentApps || []).filter((a) => a.workflowStatus === 'pending_authority'),
    [detail]
  );

  const openPaymentDialog = () => {
    if (!detail?.summary || !pendingRecords.length) return;
    const pendingAmount = pendingRecords.reduce((s, r) => s + Math.round(Number(r.netPayable) || 0), 0);
    const pendingGross = pendingRecords.reduce((s, r) => s + Math.round(Number(r.grossSalary) || 0), 0);
    setPaymentFinAuth({ financeControllerUser: null });
    setPaymentData({
      amount: pendingAmount,
      grossAmount: pendingGross,
      paymentMethod: 'bank_transfer',
      reference: selected ? `MSAL-${selected.month}-${selected.year}` : '',
      narration: selected?.periodLabel ? `Manual salary payment — ${selected.periodLabel}` : '',
      paymentDate: new Date().toISOString().split('T')[0],
      bankAccountId: ''
    });
    setPayingCompanyId(selectedCompanyId || '');
    setPaymentDialogOpen(true);
  };

  const handleMakePayment = async () => {
    if (!selected) return;
    if (!paymentFinAuth.financeControllerUser) {
      notify('Select GM Finance before submitting.', 'warning');
      return;
    }
    const financeControllerUser =
      paymentFinAuth.financeControllerUser?._id || paymentFinAuth.financeControllerUser;
    const company = financeCompanies.find((c) => String(c._id) === String(effectivePayingCompanyId));

    try {
      setProcessingPayment(true);
      const res = await api.post(
        `/finance/manual-salary-queue/${selected.month}/${selected.year}/make-payment`,
        {
          financeControllerUser,
          paymentMethod: paymentData.paymentMethod,
          reference: paymentData.reference,
          narration: paymentData.narration,
          paymentDate: paymentData.paymentDate,
          bankAccountId: paymentData.bankAccountId || null,
          companyId: effectivePayingCompanyId || null,
          payingCompanyId: effectivePayingCompanyId || null,
          companyName: company?.name || ''
        }
      );
      setPaymentDialogOpen(false);
      notify(res.data?.message || 'Manual salary payment submitted');
      await Promise.all([loadQueue(), loadDetail(selected.month, selected.year)]);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to submit manual salary payment', 'error');
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          CEO-approved manual salary sheets awaiting Finance payment (BPV → GM Finance).
        </Typography>
        <Button startIcon={<RefreshIcon />} onClick={loadQueue} disabled={loading} size="small">
          Refresh
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Paper sx={{ mb: 3 }}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell align="right">Records</TableCell>
                  <TableCell align="right">Pending Amount</TableCell>
                  <TableCell>Finance Status</TableCell>
                  <TableCell align="right">Pending</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {queue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No CEO-approved manual salary periods in finance queue.
                    </TableCell>
                  </TableRow>
                ) : queue.map((row) => (
                  <TableRow
                    key={`msal-${row.month}-${row.year}`}
                    hover
                    selected={selected?.month === row.month && selected?.year === row.year}
                  >
                    <TableCell>{row.periodLabel}</TableCell>
                    <TableCell align="right">{row.totalRecords}</TableCell>
                    <TableCell align="right">{fmt(row.pendingAmount || row.paymentPendingAmount)}</TableCell>
                    <TableCell>{statusChip(row.status)}</TableCell>
                    <TableCell align="right">{row.pendingFinance + row.paymentPending}</TableCell>
                    <TableCell align="right">{row.paid}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => loadDetail(row.month, row.year)}>Open</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {selected ? (
        <Paper sx={{ p: 2 }}>
          {detailLoading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>
          ) : detail ? (
            <>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6">{detail.periodLabel} — Manual Salary</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {detail.summary.employeeCount} employees
                    {' · '}Net {fmt(detail.summary.totalNetPayable)}
                    {' · '}Pending payment {fmt(detail.summary.pendingNetPayable)}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PaymentsIcon />}
                    disabled={!pendingRecords.length || processingPayment}
                    onClick={openPaymentDialog}
                  >
                    Pay Pending ({pendingRecords.length})
                  </Button>
                </Stack>
              </Stack>

              {pendingPaymentApps.length > 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {pendingPaymentApps.length} payment(s) pending GM Finance approval on the BPV.
                  {pendingPaymentApps[0]?.journalEntryId?._id || pendingPaymentApps[0]?.journalEntryId ? (
                    <>
                      {' '}
                      <Button
                        component={RouterLink}
                        to={`/finance/vouchers/${pendingPaymentApps[0].journalEntryId?._id || pendingPaymentApps[0].journalEntryId}`}
                        size="small"
                        startIcon={<VisibilityIcon />}
                      >
                        Open BPV {pendingPaymentApps[0].journalEntryId?.entryNumber || ''}
                      </Button>
                    </>
                  ) : null}
                </Alert>
              ) : null}

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Emp ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Designation</TableCell>
                      <TableCell>Project</TableCell>
                      <TableCell align="right">Gross</TableCell>
                      <TableCell align="right">Tax</TableCell>
                      <TableCell align="right">Net Payable</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detail.records || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">No records for this period.</TableCell>
                      </TableRow>
                    ) : detail.records.map((row) => (
                      <TableRow key={row._id}>
                        <TableCell>{row.empId || '—'}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.designation || '—'}</TableCell>
                        <TableCell>{row.project || '—'}</TableCell>
                        <TableCell align="right">{fmt(row.grossSalary)}</TableCell>
                        <TableCell align="right">{fmt(row.incomeTax)}</TableCell>
                        <TableCell align="right">{fmt(row.netPayable)}</TableCell>
                        <TableCell>{recordStatusChip(row.workflowStatus)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : null}
        </Paper>
      ) : null}

      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Manual Salary Payment — {selected?.periodLabel || ''}
          <Typography variant="body2" color="text.secondary">
            Creates BPV and submits for GM Finance approval
            {' · '}Gross: {fmt(paymentData.grossAmount)} · Net: {fmt(paymentData.amount)}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Sr Manager Accounts: <strong>{SR_MANAGER_ACCOUNTS_NAME}</strong> — auto-approved on submit.
                  {' '}GM Finance approves on the BPV.
                </Typography>
                <Autocomplete
                  disabled={processingPayment}
                  options={financeAuthorityCandidates}
                  value={paymentFinAuth.financeControllerUser || null}
                  onChange={(_, value) => setPaymentFinAuth({ financeControllerUser: value })}
                  getOptionLabel={userOptionLabel}
                  isOptionEqualToValue={(a, b) => String(a?._id || a?.id) === String(b?._id || b?.id)}
                  renderOption={(props, option) => (
                    <li {...props} key={option._id || option.id}>
                      <Typography variant="body2">{userOptionLabel(option)}</Typography>
                      {userOptionSecondary(option) ? (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {userOptionSecondary(option)}
                        </Typography>
                      ) : null}
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField {...params} label="GM Finance *" size="small" required />
                  )}
                />
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Paying Company</InputLabel>
                <Select
                  value={payingCompanyId}
                  label="Paying Company"
                  onChange={(e) => setPayingCompanyId(e.target.value)}
                >
                  <MenuItem value=""><em>— Default (context) —</em></MenuItem>
                  {financeCompanies.map((c) => (
                    <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentData.paymentMethod}
                  label="Payment Method"
                  onChange={(e) => setPaymentData((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                >
                  <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  <MenuItem value="check">Check / Cheque</MenuItem>
                  <MenuItem value="cash">Cash</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Pay From Account</InputLabel>
                <Select
                  value={paymentData.bankAccountId || ''}
                  label="Pay From Account"
                  onChange={(e) => setPaymentData((prev) => ({ ...prev, bankAccountId: e.target.value }))}
                >
                  <MenuItem value="">— Auto (default bank) —</MenuItem>
                  {bankAccounts.map((item) => {
                    const account = item?.account || item;
                    const depth = item?.depth || 0;
                    return (
                      <MenuItem key={account._id} value={account._id}>
                        {formatPayFromAccountLabel(account, depth)}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Payment Date"
                type="date"
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData((prev) => ({ ...prev, paymentDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Reference / Cheque #"
                value={paymentData.reference}
                onChange={(e) => setPaymentData((prev) => ({ ...prev, reference: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Narration"
                value={paymentData.narration}
                onChange={(e) => setPaymentData((prev) => ({ ...prev, narration: e.target.value }))}
                multiline
                minRows={2}
                inputProps={{ maxLength: 500 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Gross Salary"
                value={paymentData.grossAmount}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                size="small"
                label="Net Payable (BPV)"
                value={paymentData.amount}
                InputProps={{ readOnly: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleMakePayment}
            disabled={processingPayment}
          >
            {processingPayment ? 'Submitting…' : 'Create BPV & Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
