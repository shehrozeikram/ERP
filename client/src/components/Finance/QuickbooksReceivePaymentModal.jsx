import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Grid, TextField, FormControl, InputLabel, Select, MenuItem,
  Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Checkbox, Chip, Alert, Box, Stack,
  CircularProgress, Tooltip, Divider, InputAdornment, IconButton
} from '@mui/material';
import {
  Payment as PaymentIcon,
  AccountBalance as BankIcon,
  AttachMoney as MoneyIcon,
  Receipt as ReceiptIcon,
  CheckCircle as CheckCircleIcon,
  ClearAll as ClearIcon,
  SelectAll as SelectAllIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';


import { fetchPayFromAccounts, formatPayFromAccountLabel } from '../../utils/payFromAccounts';

import { useFinanceCompany } from '../../context/FinanceCompanyContext';

const formatPKR = (amount) => {
  const n = Number(amount) || 0;
  return `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const round2 = (val) => Math.round((Number(val) || 0) * 100) / 100;

const isValidVoucherId = (id) => /^[a-fA-F0-9]{24}$/.test(String(id || '').trim());

export default function QuickbooksReceivePaymentModal({
  open,
  onClose,
  onSuccess,
  selectedCompanyId = null,
  preselectedCustomerId = null,
  preselectedCustomerName = '',
  preselectedInvoiceId = null,
  preselectedInstallmentId = null
}) {
  const navigate = useNavigate();
  const { companies } = useFinanceCompany();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId || '');
  const [selectedCustomerName, setSelectedCustomerName] = useState(preselectedCustomerName || '');
  const [payingCompanyId, setPayingCompanyId] = useState(selectedCompanyId || '');

  useEffect(() => {
    if (open) {
      setSelectedCustomerId(preselectedCustomerId || '');
      setSelectedCustomerName(preselectedCustomerName || '');
      setPayingCompanyId(selectedCompanyId || '');
    }
  }, [open, preselectedCustomerId, preselectedCustomerName, selectedCompanyId]);
  
  const [openInvoices, setOpenInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  
  const [customerAdvances, setCustomerAdvances] = useState([]);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  
  const [bankAccounts, setBankAccounts] = useState([]);
  const [costCenters, setCostCenters] = useState([]);

  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'bank_transfer',
    bankAccountId: '',
    costCenter: '',
    reference: '',
    narration: '',
    whtRate: 0
  });

  const [processing, setProcessing] = useState(false);


  // Load Customers from finance customer master (same source as Customer List / JE form)
  useEffect(() => {
    if (!open) return;
    Promise.allSettled([
      api.get('/finance/customers', { params: { limit: 1000, status: 'active' } }),
      api.get('/finance/accounts-receivable', { params: { limit: 1000 } })
    ]).then(([custRes, arRes]) => {
      const vMap = new Map();
      if (custRes.status === 'fulfilled' && custRes.value.data?.data?.customers) {
        custRes.value.data.data.customers.forEach((v) => {
          vMap.set(String(v._id), {
            customerId: String(v._id),
            customerName: v.name,
            email: v.email || '',
            phone: v.phone || ''
          });
        });
      }
      // Include any AR-only customers (name match legacy invoices without customerId)
      if (arRes.status === 'fulfilled' && arRes.value.data?.data?.invoices) {
        arRes.value.data.data.invoices.forEach((b) => {
          const vId = String(b.customer?.customerId || b.customer?._id || '');
          const vName = b.customer?.name || b.customerName || '';
          if (vName) {
            const key = vId || vName;
            if (!vMap.has(key)) {
              vMap.set(key, {
                customerId: key,
                customerName: vName,
                email: b.customer?.email || '',
                phone: ''
              });
            }
          }
        });
      }
      setCustomers(Array.from(vMap.values()).sort((a, b) => a.customerName.localeCompare(b.customerName)));
    });
  }, [open]);

  // Load Bank Accounts for the chosen Paying Company
  useEffect(() => {
    if (!open) return;
    const targetComp = payingCompanyId || selectedCompanyId;
    if (!targetComp) return;
    api.get('/finance/cost-centers', { params: { companyId: targetComp } }).then(res => setCostCenters(res.data?.data || [])).catch(() => setCostCenters([]));
    fetchPayFromAccounts(api, { companyId: targetComp })
      .then((accs) => {
        setBankAccounts(accs);
        // Reset bank selection if current account doesn't belong to newly fetched list
        if (paymentForm.bankAccountId && !accs.some((a) => String((a.account || a)._id) === String(paymentForm.bankAccountId))) {
          setPaymentForm((f) => ({ ...f, bankAccountId: '' }));
        }
      })
      .catch(() => setBankAccounts([]));
  }, [open, payingCompanyId, selectedCompanyId]);

  
  // Load Bills and Advances when Customer changes
  const loadCustomerData = useCallback(async (customerId, customerName) => {
    if (!customerId && !customerName) {
      setOpenInvoices([]);
      setCustomerAdvances([]);
      return;
    }
    try {
      setLoadingInvoices(true);
      setLoadingAdvances(true);

      const cleanCustomerName = String(customerName || '').trim();
      const isObjectId = /^[a-fA-F0-9]{24}$/.test(String(customerId || ''));
      const invoiceParams = { limit: 1000 };
      if (isObjectId) {
        invoiceParams.customerId = customerId;
      } else if (cleanCustomerName) {
        invoiceParams.search = cleanCustomerName;
      }
      const [invoicesRes] = await Promise.allSettled([
        api.get('/finance/accounts-receivable', { params: invoiceParams })
      ]);

      if (invoicesRes.status === 'fulfilled' && invoicesRes.value.data?.success) {
        const rawInvoices = invoicesRes.value.data.data.invoices || [];
        const normName = cleanCustomerName.toLowerCase();
        let filtered = rawInvoices.filter((b) => {
          if (b.status === 'cancelled') return false;
          const matchId = customerId && String(b.customer?.customerId || b.customer?._id || '') === String(customerId);
          if (isObjectId) {
            // Prefer id match; also keep name-only legacy invoices for this customer
            const bName = String(b.customer?.name || b.customerName || '').toLowerCase().trim();
            return matchId || (normName && bName === normName && !b.customer?.customerId);
          }
          const bName = String(b.customer?.name || b.customerName || '').toLowerCase().trim();
          const matchName = normName && bName.includes(normName);
          return matchId || matchName;
        });

        // Ensure preselected bill is included if passed AND it matches the current customer
        const isSameCustomer = (preselectedCustomerId && String(preselectedCustomerId) === String(customerId)) || 
                               (preselectedCustomerName && String(preselectedCustomerName) === String(customerName));
                               
        if (isSameCustomer && preselectedInvoiceId && !filtered.some((b) => String(b._id) === String(preselectedInvoiceId))) {
          try {
            const singleRes = await api.get(`/finance/accounts-receivable/${preselectedInvoiceId}`);
            if (singleRes.data?.success && singleRes.data?.data) {
              filtered = [singleRes.data.data, ...filtered];
            }
          } catch {
            // keep filtered
          }
        }

        const rows = [];
        filtered.forEach((b) => {
          const total = Number(b.totalAmount || 0);
          const paid = Number(b.paidAmount ?? b.amountPaid ?? 0);
          const advance = Number(b.advanceApplied || 0);
          const pending = Number(b.paymentPending || 0) + Number(b.advancePending || 0);
          const openBal = Math.max(0, round2(total - paid - advance - pending));
          if (openBal <= 0 && !(b.installments || []).length) return;

          const isTargetBill = preselectedInvoiceId && String(b._id) === String(preselectedInvoiceId);
          const allInstallments = (b.installments || []).map((inst) => {
            const amount = Number(inst.amount) || 0;
            const paidAmount = Number(inst.paidAmount) || 0;
            let status = inst.status || 'pending';
            if (paidAmount >= amount - 0.01 && amount > 0) status = 'paid';
            else if (paidAmount > 0) status = 'partial';
            else if (inst.dueDate && new Date(inst.dueDate) < new Date(new Date().toDateString()) && status === 'pending') {
              status = 'overdue';
            }
            // Prefer installment.lastJournalEntry; fallback to matching payment.journalEntry
            let journalEntryId = inst.lastJournalEntry?._id || inst.lastJournalEntry || null;
            if (!journalEntryId && Array.isArray(b.payments)) {
              const linkedPay = [...b.payments].reverse().find(
                (p) => p.installmentId && String(p.installmentId) === String(inst._id) && (p.journalEntry || p.journalEntryId)
              );
              journalEntryId = linkedPay?.journalEntry?._id || linkedPay?.journalEntry || linkedPay?.journalEntryId || null;
            }
            return {
              _id: String(inst._id),
              sequence: inst.sequence,
              amount,
              paidAmount,
              dueDate: inst.dueDate,
              status,
              balance: Math.max(0, round2(amount - paidAmount)),
              journalEntryId: isValidVoucherId(journalEntryId) ? String(journalEntryId) : null
            };
          });

          if (allInstallments.length > 0) {
            // Show each installment as its own row (including paid — status visible, not selectable)
            allInstallments.forEach((inst) => {
              const isPaid = inst.status === 'paid' || inst.balance <= 0;
              const preselect =
                isTargetBill &&
                preselectedInstallmentId &&
                String(inst._id) === String(preselectedInstallmentId) &&
                !isPaid;
              rows.push({
                rowKey: `${b._id}-inst-${inst._id}`,
                rowType: 'installment',
                billId: String(b._id),
                billNumber: b.invoiceNumber,
                billDate: b.invoiceDate,
                dueDate: inst.dueDate,
                totalAmount: total,
                billOpenBalance: openBal,
                installmentId: inst._id,
                installmentSequence: inst.sequence,
                installmentAmount: inst.amount,
                installmentPaid: inst.paidAmount,
                journalEntryId: inst.journalEntryId,
                status: inst.status,
                openBalance: inst.balance,
                disabled: isPaid,
                selected: !!preselect,
                payAmount: preselect ? inst.balance : 0
              });
            });
            // Saved installment schedule: do not offer full / custom receipt row
          } else if (openBal > 0) {
            rows.push({
              rowKey: String(b._id),
              rowType: 'bill',
              billId: String(b._id),
              billNumber: b.invoiceNumber,
              billDate: b.invoiceDate,
              dueDate: b.dueDate,
              totalAmount: total,
              billOpenBalance: openBal,
              installmentId: '',
              installmentSequence: null,
              installmentAmount: null,
              installmentPaid: null,
              status: 'open',
              openBalance: openBal,
              disabled: false,
              selected: !!isTargetBill,
              payAmount: isTargetBill ? openBal : 0
            });
          }
        });

        setOpenInvoices(rows);
      } else {
        setOpenInvoices([]);
      }

      setCustomerAdvances([]);
    } catch (err) {
      console.error('Error loading customer invoices and advances:', err);
      toast.error('Failed to load customer data');
    } finally {
      setLoadingInvoices(false);
      setLoadingAdvances(false);
    }
  }, [preselectedInvoiceId, preselectedInstallmentId]);

  useEffect(() => {
    if (open && (selectedCustomerId || selectedCustomerName)) {
      loadCustomerData(selectedCustomerId, selectedCustomerName);
    }
  }, [open, selectedCustomerId, selectedCustomerName, loadCustomerData]);

  // Handle Customer Selection Change
  const handleCustomerChange = (e) => {
    const vId = e.target.value;
    setSelectedCustomerId(vId);
    const v = customers.find((x) => x.customerId === vId);
    const vName = v?.customerName || '';
    setSelectedCustomerName(vName);
    if (vId || vName) {
      loadCustomerData(vId, vName);
    }
  };

  // Toggle Single Bill Selection
  const handleToggleBill = (index) => {
    setOpenInvoices((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      if (row.disabled) return prev;
      row.selected = !row.selected;
      row.payAmount = row.selected ? row.openBalance : 0;
      next[index] = row;
      return next;
    });
  };

  // Change specific Pay Amount
  const handlePayAmountChange = (index, value) => {
    const row = openInvoices[index];
    if (row.disabled) return;
    const num = Math.max(0, Math.min(Number(value) || 0, row.openBalance));
    setOpenInvoices((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        payAmount: round2(num),
        selected: num > 0
      };
      return next;
    });
  };

  // Select All Bills — only unpaid / full rows
  const handleSelectAll = () => {
    setOpenInvoices((prev) =>
      prev.map((r) => {
        if (r.disabled || r.rowType === 'full') {
          // Don't auto-select full receipt when selecting installments; select unpaid installments + plain bills
          if (r.rowType === 'full') return { ...r, selected: false, payAmount: 0 };
          return r;
        }
        return {
          ...r,
          selected: true,
          payAmount: r.openBalance
        };
      })
    );
  };

  // Clear All
  const handleClearAll = () => {
    setOpenInvoices((prev) =>
      prev.map((r) => ({
        ...r,
        selected: false,
        payAmount: 0
      }))
    );
  };

  // Calculations
  const totalOpenBalance = useMemo(() => {
    const byBill = new Map();
    openInvoices.forEach((r) => {
      if (!byBill.has(r.billId)) {
        byBill.set(r.billId, Number(r.billOpenBalance ?? r.openBalance) || 0);
      }
    });
    return round2([...byBill.values()].reduce((s, v) => s + v, 0));
  }, [openInvoices]);

  const totalOpenAdvances = useMemo(() => {
    return round2(customerAdvances.reduce((s, r) => s + (Number(r.open) || 0), 0));
  }, [customerAdvances]);

  const selectableRows = useMemo(
    () => openInvoices.filter((r) => !r.disabled),
    [openInvoices]
  );

  const selectedBills = useMemo(() => {
    return openInvoices.filter((r) => !r.disabled && r.selected && Number(r.payAmount) > 0);
  }, [openInvoices]);

  const totalSelectedPayAmount = useMemo(() => {
    return round2(selectedBills.reduce((s, r) => s + (Number(r.payAmount) || 0), 0));
  }, [selectedBills]);

  const whtAmount = useMemo(() => {
    const rate = Number(paymentForm.whtRate) || 0;
    if (rate <= 0) return 0;
    return round2(totalSelectedPayAmount * (rate / 100));
  }, [totalSelectedPayAmount, paymentForm.whtRate]);

  const netDisbursementAmount = useMemo(() => {
    return round2(Math.max(0, totalSelectedPayAmount - whtAmount));
  }, [totalSelectedPayAmount, whtAmount]);

  // Submit Multi-Bill Payment
  const handlePostPayments = async () => {
    if (selectedBills.length === 0) {
      toast.error('Please select at least one invoice to receive payment against');
      return;
    }

    if (totalSelectedPayAmount <= 0) {
      toast.error('Total payment amount must be greater than zero');
      return;
    }

    try {
      setProcessing(true);

      const promises = selectedBills.map(b => {
        const payload = {
          amount: b.payAmount,
          paymentMethod: paymentForm.paymentMethod,
          bankAccountId: paymentForm.bankAccountId || null,
          paymentDate: paymentForm.paymentDate,
          reference: paymentForm.reference,
          ...(b.installmentId ? { installmentId: b.installmentId } : {})
        };
        return api.post(`/finance/accounts-receivable/${b.billId}/payment`, payload);
      });

      await Promise.all(promises);

      toast.success(`✓ Successfully posted consolidated payment for ${selectedBills.length} invoice(s)! Total: ${formatPKR(totalSelectedPayAmount)}`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error posting batch payment:', err);
      toast.error(err.response?.data?.message || 'Failed to post payments');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ bgcolor: 'success.dark', color: 'white', py: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1.5}>
            <PaymentIcon fontSize="medium" />
            <Typography variant="h6" fontWeight={700}>
              Receive Payment
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2.5 }}>
        {/* Top Controls: Customer Selection & Balance Highlights */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={5}>
            <FormControl fullWidth size="small">
              <InputLabel>Select Customer *</InputLabel>
              <Select
                value={selectedCustomerId}
                label="Select Customer *"
                onChange={handleCustomerChange}
              >
                <MenuItem value=""><em>-- Choose a Customer --</em></MenuItem>
                {customers.map((v) => (
                  <MenuItem key={v.customerId} value={v.customerId}>
                    {v.customerName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={7}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Paper variant="outlined" sx={{ p: 1.2, px: 2, bgcolor: 'grey.50', minWidth: 160 }}>
                <Typography variant="caption" color="text.secondary">Total Open Balance</Typography>
                <Typography variant="subtitle1" fontWeight={700} color="error.main">
                  {formatPKR(totalOpenBalance)}
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.2, px: 2, bgcolor: totalOpenAdvances > 0 ? 'success.50' : 'grey.50', minWidth: 160 }}>
                <Typography variant="caption" color="text.secondary">Unapplied Advances / Credits</Typography>
                <Typography variant="subtitle1" fontWeight={700} color={totalOpenAdvances > 0 ? 'success.dark' : 'text.secondary'}>
                  {formatPKR(totalOpenAdvances)}
                </Typography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>

        {/* Available Customer Advances alert/details */}
        {totalOpenAdvances > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This customer has <strong>{customerAdvances.length} unapplied advance(s)</strong> totaling <strong>{formatPKR(totalOpenAdvances)}</strong>.
            You can record a direct settlement or deduct from cash approval in Accounts Payable.
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          If a bill has an installment schedule, only installment parts are listed (pending / partial / paid / overdue).
          Select unpaid parts to receive — full / custom receipt is not available once a schedule is saved.
          Without a schedule, the open bill balance can be received as a full / custom payment. Paid parts are shown but cannot be selected.
        </Alert>

        {/* Bills Selection Table */}
        <Paper variant="outlined" sx={{ mb: 2.5 }}>
          <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'grey.100' }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Open Bills / Installments for {selectedCustomerName || 'Selected Customer'} ({openInvoices.length} rows)
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" startIcon={<SelectAllIcon />} onClick={handleSelectAll} disabled={!selectableRows.length}>
                Select unpaid installments
              </Button>
              <Button size="small" variant="outlined" color="inherit" startIcon={<ClearIcon />} onClick={handleClearAll} disabled={!openInvoices.length}>
                Clear
              </Button>
            </Stack>
          </Box>

          <TableContainer sx={{ maxHeight: 380 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      indeterminate={selectedBills.length > 0 && selectedBills.length < selectableRows.filter((r) => r.rowType !== 'full').length}
                      checked={
                        selectableRows.filter((r) => r.rowType !== 'full').length > 0 &&
                        selectedBills.filter((r) => r.rowType !== 'full').length ===
                          selectableRows.filter((r) => r.rowType !== 'full').length
                      }
                      onChange={(e) => (e.target.checked ? handleSelectAll() : handleClearAll())}
                      disabled={!selectableRows.length}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Bill #</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Part</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Part Amount</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Paid</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Balance</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, width: 140 }}>Amount to Pay</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingInvoices ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : openInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      {selectedCustomerId ? 'No open invoices found for this customer.' : 'Please select a customer above to view open invoices.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  openInvoices.map((row, index) => {
                    const statusColor =
                      row.status === 'paid'
                        ? 'success'
                        : row.status === 'partial'
                          ? 'info'
                          : row.status === 'overdue'
                            ? 'error'
                            : row.status === 'full_receipt'
                              ? 'secondary'
                              : 'default';
                    const partLabel =
                      row.rowType === 'installment'
                        ? `Installment #${row.installmentSequence || '—'}`
                        : row.rowType === 'full'
                          ? 'Full / custom receipt'
                          : 'Full invoice';
                    return (
                      <TableRow
                        key={row.rowKey || row.billId}
                        hover={!row.disabled}
                        selected={row.selected}
                        sx={row.disabled ? { opacity: 0.65, bgcolor: 'action.hover' } : undefined}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={!!row.selected}
                            disabled={!!row.disabled}
                            onChange={() => handleToggleBill(index)}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{row.billNumber}</TableCell>
                        <TableCell>{partLabel}</TableCell>
                        <TableCell>{formatDate(row.dueDate)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                            <Chip
                              size="small"
                              label={
                                row.status === 'full_receipt'
                                  ? 'full / custom'
                                  : row.status === 'open'
                                    ? 'open'
                                    : row.status
                              }
                              color={statusColor}
                            />
                            {isValidVoucherId(row.journalEntryId) && (
                              <Tooltip title="View receipt voucher">
                                <Chip
                                  onClick={() => navigate(`/finance/vouchers/${row.journalEntryId}`)}
                                  label="VOUCHER CREATED"
                                  size="small"
                                  color="success"
                                  variant="filled"
                                  sx={{ height: 22, fontWeight: 'bold', fontSize: '0.65rem', cursor: 'pointer' }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {row.rowType === 'installment' ? formatPKR(row.installmentAmount) : formatPKR(row.openBalance)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>
                          {row.rowType === 'installment' ? formatPKR(row.installmentPaid) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, color: row.disabled ? 'success.main' : 'error.main' }}>
                          {formatPKR(row.openBalance)}
                        </TableCell>
                        <TableCell align="right">
                          {row.disabled ? (
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                              {isValidVoucherId(row.journalEntryId) ? (
                                <Tooltip title="View receipt voucher">
                                  <Chip
                                    onClick={() => navigate(`/finance/vouchers/${row.journalEntryId}`)}
                                    label="VOUCHER CREATED"
                                    size="small"
                                    color="success"
                                    variant="filled"
                                    sx={{ height: 22, fontWeight: 'bold', fontSize: '0.65rem', cursor: 'pointer' }}
                                  />
                                </Tooltip>
                              ) : (
                                <Typography variant="caption" color="success.main">Paid</Typography>
                              )}
                            </Stack>
                          ) : (
                            <TextField
                              size="small"
                              type="number"
                              value={row.payAmount || ''}
                              inputProps={{ min: 0, max: row.openBalance, step: 0.01 }}
                              onChange={(e) => handlePayAmountChange(index, e.target.value)}
                              placeholder="0.00"
                              sx={{ width: 130 }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Payment & Bank Configuration */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            Payment & Bank Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" type="date" label="Payment Date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Paying Company</InputLabel>
                <Select
                  value={payingCompanyId || selectedCompanyId || ''}
                  label="Paying Company"
                  onChange={(e) => setPayingCompanyId(e.target.value)}
                >
                  {companies.map((c) => (
                    <MenuItem key={c._id} value={c._id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={paymentForm.paymentMethod}
                  label="Payment Method"
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                >
                  <MenuItem value="bank_transfer">Bank Transfer / Online</MenuItem>
                  <MenuItem value="check">Cheque / TT</MenuItem>
                  <MenuItem value="cash">Cash (CPV)</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Pay-From Account</InputLabel>
                <Select
                  value={paymentForm.bankAccountId}
                  label="Pay-From Account"
                  onChange={(e) => setPaymentForm({ ...paymentForm, bankAccountId: e.target.value })}
                >
                  <MenuItem value="">-- Default Bank Account --</MenuItem>
                  {bankAccounts.map((item) => {
                    const acc = item?.account || item;
                    const depth = item?.depth || 0;
                    return (
                      <MenuItem key={acc._id} value={acc._id}>
                        {formatPayFromAccountLabel(acc, depth)}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Cost Center</InputLabel>
                <Select
                  value={paymentForm.costCenter}
                  label="Cost Center"
                  onChange={(e) => setPaymentForm({ ...paymentForm, costCenter: e.target.value })}
                >
                  <MenuItem value="">-- None --</MenuItem>
                  {costCenters.filter(cc => cc.isActive).map(cc => (
                    <MenuItem key={cc._id} value={cc._id}>{cc.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Cheque # / TT # / Transaction Reference"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                placeholder="e.g. CHQ-991204"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Narration / Description"
                value={paymentForm.narration}
                onChange={(e) => setPaymentForm({ ...paymentForm, narration: e.target.value })}
                placeholder="Enter payment narration for voucher"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" type="number" label="WHT Rate % (Optional)"
                value={paymentForm.whtRate || ''}
                onChange={(e) => setPaymentForm({ ...paymentForm, whtRate: e.target.value })}
                inputProps={{ min: 0, max: 30, step: 0.1 }}
                helperText={whtAmount > 0 ? `WHT Deduction: ${formatPKR(whtAmount)} | Net Bank: ${formatPKR(netDisbursementAmount)}` : 'Leave 0 if exempt'}
              />
            </Grid>
          </Grid>
        </Paper>


        {/* Final Payment Summary Banner */}
        <Paper sx={{ p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">Selected Bills:</Typography>
              <Typography variant="h6" fontWeight={700}>{selectedBills.length} bill(s)</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">Gross Amount to Settle:</Typography>
              <Typography variant="h6" fontWeight={800} color="success.main">
                {formatPKR(totalSelectedPayAmount)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">Net Bank Disbursement:</Typography>
              <Typography variant="h6" fontWeight={800} color="success.dark">
                {formatPKR(netDisbursementAmount)}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </DialogContent>

      <DialogActions sx={{ p: 2, px: 3, justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          size="large"
          startIcon={<CheckCircleIcon />}
          onClick={handlePostPayments}
          disabled={processing || selectedBills.length === 0 || totalSelectedPayAmount <= 0}
        >
          {processing ? 'Posting Payments…' : `Post Payment (${formatPKR(totalSelectedPayAmount)})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
