import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  Stack,
  CircularProgress
} from '@mui/material';
import {
  AccountBalance as ReconciliationIcon,
  Refresh as RefreshIcon,
  GetApp as DownloadIcon,
  AttachFile as AttachFileIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { fetchReports, fetchAllInvoices, fetchReconciliationRecords, saveReconciliation } from '../../../services/propertyInvoiceService';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const TajUtilitiesReconciliation = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startMonth, setStartMonth] = useState(dayjs().subtract(11, 'month').format('YYYY-MM'));
  const [endMonth, setEndMonth] = useState(dayjs().format('YYYY-MM'));
  const [chargeTypeFilter, setChargeTypeFilter] = useState('all');
  const [report, setReport] = useState({ byMonth: [], totals: {} });
  const [exportingMonthKey, setExportingMonthKey] = useState(null);
  const [reconcileAmounts, setReconcileAmounts] = useState({});
  const [attachments, setAttachments] = useState({});
  const [attachmentFiles, setAttachmentFiles] = useState({});
  const [savingMonthKey, setSavingMonthKey] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const setReconcileAmount = (monthKey, value) => {
    setReconcileAmounts((prev) => ({ ...prev, [monthKey]: value }));
  };

  const handleAttachmentChange = (monthKey, file) => {
    if (!file) return;
    setAttachments((prev) => ({ ...prev, [monthKey]: file.name }));
    setAttachmentFiles((prev) => ({ ...prev, [monthKey]: file }));
  };

  const loadSavedReconciliation = useCallback(async () => {
    if (!report.byMonth?.length) return;
    try {
      const monthKeys = report.byMonth.map((r) => r.month).join(',');
      const response = await fetchReconciliationRecords({ monthKeys });
      const data = response.data?.data || {};
      const amounts = {};
      const savedNames = {};
      Object.entries(data).forEach(([key, val]) => {
        if (val.reconcileAmount != null) amounts[key] = String(val.reconcileAmount);
        if (val.attachmentOriginalName) savedNames[key] = val.attachmentOriginalName;
      });
      setReconcileAmounts((prev) => ({ ...amounts, ...prev }));
      setAttachments((prev) => ({ ...savedNames, ...prev }));
    } catch (_) {}
  }, [report.byMonth]);

  useEffect(() => {
    loadSavedReconciliation();
  }, [loadSavedReconciliation]);

  const handleSaveReconciliation = useCallback(async (monthKey) => {
    const amount = reconcileAmounts[monthKey];
    const file = attachmentFiles[monthKey];
    if (amount === undefined || amount === '' || Number(amount) < 0) {
      setError('Enter a valid Reconcile Amount to save.');
      return;
    }
    if (!file) {
      setError('Attach a document before saving.');
      return;
    }
    try {
      setSavingMonthKey(monthKey);
      setError('');
      setSuccessMessage('');
      const formData = new FormData();
      formData.append('monthKey', monthKey);
      formData.append('reconcileAmount', String(amount));
      formData.append('attachment', file);
      await saveReconciliation(formData);
      setSuccessMessage(`Saved for ${monthKey}`);
      setAttachmentFiles((prev) => {
        const next = { ...prev };
        delete next[monthKey];
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSavingMonthKey(null);
    }
  }, [reconcileAmounts, attachmentFiles]);

  const CHARGE_TYPE_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'CAM', label: 'CAM Charges' },
    { value: 'ELECTRICITY', label: 'Electricity Bills' },
    { value: 'RENT', label: 'Rental Management' },
    { value: 'OPEN_INVOICE', label: 'Open Invoices' },
    { value: 'Mixed', label: 'Mixed' }
  ];

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { startMonth, endMonth };
      if (chargeTypeFilter && chargeTypeFilter !== 'all') {
        params.chargeType = chargeTypeFilter;
      }
      const response = await fetchReports(params);
      const data = response.data?.data || {};
      setReport({
        byMonth: data.byMonth || [],
        totals: data.totals || {}
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reconciliation');
      setReport({ byMonth: [], totals: {} });
    } finally {
      setLoading(false);
    }
  }, [startMonth, endMonth, chargeTypeFilter]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const exportMonthInvoicesToExcel = useCallback(async (monthKey) => {
    if (!monthKey) return;
    try {
      setExportingMonthKey(monthKey);
      const params = { monthYear: monthKey, limit: 10000 };
      if (chargeTypeFilter && chargeTypeFilter !== 'all') {
        params.chargeType = chargeTypeFilter;
        if (chargeTypeFilter === 'OPEN_INVOICE') params.openInvoices = 'true';
      }
      const response = await fetchAllInvoices(params);
      const invoices = response.data?.data || [];
      const monthData = report.byMonth.find((r) => r.month === monthKey);
      const deposits = monthData?.deposits || [];

      const headers = [
        'Invoice #',
        'Resident ID',
        'Property',
        'Owner',
        'Charge Types',
        'Period From',
        'Period To',
        'Due Date',
        'Deposit Date',
        'Invoice Amount (Subtotal)',
        'Arrears',
        'Grand Total',
        'Paid',
        'Balance',
        'Payment Status',
        'Status',
        'Recorded By',
        'Customer Name',
        'Customer Address',
        'Sector'
      ];
      const num = (v) => Number(v) || 0;
      const rows = invoices.map((inv) => {
        const isOpen = !inv.property;
        const residentId = isOpen ? '—' : (inv.property?.resident?.residentId ?? inv.property?.residentId ?? '—');
        const paid = inv.totalPaid != null && inv.totalPaid !== ''
          ? num(inv.totalPaid)
          : (Array.isArray(inv.payments) ? inv.payments.reduce((sum, p) => sum + (num(p.amount) || num(p.totalAmount)), 0) : 0);
        const residentDeposits = (deposits || []).filter((d) => String(d.residentId || '').trim() !== '' && String(residentId || '').trim() !== '' && String(d.residentId) === String(residentId));
        const depositDateStr = residentDeposits.length > 0
          ? residentDeposits
              .map((d) => d.depositDate ? dayjs(d.depositDate).format('DD MMM YYYY') : null)
              .filter(Boolean)
              .join(', ') || '—'
          : '—';
        return [
          inv.invoiceNumber || '—',
          residentId,
          isOpen ? (inv.customerName || 'Open Invoice') : (inv.property?.propertyName || inv.property?.plotNumber || '—'),
          isOpen ? (inv.customerName || '—') : (inv.property?.ownerName || '—'),
          Array.isArray(inv.chargeTypes) ? inv.chargeTypes.join(', ') : (inv.chargeTypes || '—'),
          inv.periodFrom ? dayjs(inv.periodFrom).format('DD MMM YYYY') : '—',
          inv.periodTo ? dayjs(inv.periodTo).format('DD MMM YYYY') : '—',
          inv.dueDate ? dayjs(inv.dueDate).format('DD MMM YYYY') : '—',
          depositDateStr,
          num(inv.subtotal),
          num(inv.totalArrears),
          num(inv.grandTotal),
          paid,
          num(inv.balance),
          inv.paymentStatus || '—',
          inv.status || '—',
          inv.createdBy ? [inv.createdBy.firstName, inv.createdBy.lastName].filter(Boolean).join(' ') : '—',
          inv.customerName || '—',
          inv.customerAddress || '—',
          inv.sector || (inv.property?.sector?.name ?? inv.property?.sector ?? '—')
        ];
      });

      const totalInvoiceAmount = rows.reduce((s, row) => s + (Number(row[9]) || 0), 0);
      const totalArrears = rows.reduce((s, row) => s + (Number(row[10]) || 0), 0);
      const totalGrandTotal = rows.reduce((s, row) => s + (Number(row[11]) || 0), 0);
      const totalPaid = rows.reduce((s, row) => s + (Number(row[12]) || 0), 0);
      const totalBalance = rows.reduce((s, row) => s + (Number(row[13]) || 0), 0);
      const totalsRow = [
        '', '', '', '', '', '', '', '', '',
        totalInvoiceAmount, totalArrears, totalGrandTotal, totalPaid, totalBalance,
        '', '', '', '', ''
      ];

      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet('Invoices', { views: [{ state: 'frozen', ySplit: 1 }] });
      const colWidths = [20, 14, 26, 22, 24, 14, 14, 14, 16, 18, 16, 18, 16, 16, 14, 12, 18, 22, 24, 12];
      headers.forEach((h, i) => { worksheet.getColumn(i + 1).width = colWidths[i] || 12; });
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true, size: 12 };
      headerRow.alignment = { vertical: 'middle' };
      rows.forEach((row) => worksheet.addRow(row));
      const totalsRowNode = worksheet.addRow(totalsRow);
      totalsRowNode.font = { bold: true, size: 11 };
      totalsRowNode.getCell(1).value = 'Total';
      [10, 11, 12, 13, 14].forEach((c) => totalsRowNode.getCell(c).numFmt = '#,##0.00');

      const depositHeaders = ['Deposit Date', 'Resident ID', 'Resident Name', 'Amount'];
      const depositRows = (deposits || []).map((d) => [
        d.depositDate ? dayjs(d.depositDate).format('DD MMM YYYY HH:mm') : '—',
        d.residentId || '—',
        d.residentName || '—',
        Number(d.amount) || 0
      ]);
      const depositSheet = workbook.addWorksheet('Deposits', { views: [{ state: 'frozen', ySplit: 1 }] });
      [14, 14, 22, 14].forEach((w, i) => depositSheet.getColumn(i + 1).width = w);
      const depositHeaderRow = depositSheet.addRow(depositHeaders);
      depositHeaderRow.font = { bold: true, size: 12 };
      depositRows.forEach((row) => depositSheet.addRow(row));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reconciliation-${monthKey}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export');
    } finally {
      setExportingMonthKey(null);
    }
  }, [report.byMonth, chargeTypeFilter]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <ReconciliationIcon color="primary" />
        <Typography variant="h5" fontWeight={600}>
          Reconciliation
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                fullWidth
                label="Start Month"
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                fullWidth
                label="End Month"
                type="month"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Charge Type</InputLabel>
                <Select
                  value={chargeTypeFilter}
                  label="Charge Type"
                  onChange={(e) => setChargeTypeFilter(e.target.value)}
                >
                  {CHARGE_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                onClick={loadReport}
                disabled={loading}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Month-wise Reconciliation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Amount = Deposit + Suspense for that month. Enter Reconcile Amount; Balance = Amount − Reconcile Amount. Attachment is enabled when Balance = 0.
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : report.byMonth.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">No data for the selected period</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell><strong>Month</strong></TableCell>
                    <TableCell align="right"><strong>Amount (Deposit + Suspense)</strong></TableCell>
                    <TableCell align="right"><strong>Reconcile Amount</strong></TableCell>
                    <TableCell align="right"><strong>Balance</strong></TableCell>
                    <TableCell><strong>Attachment</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.byMonth.map((row) => {
                    const depositTotal = (row.depositTotal ?? (row.deposits || []).reduce((s, d) => s + (d.amount || 0), 0));
                    const suspenseAmount = row.suspenseAmount ?? 0;
                    const amount = depositTotal + suspenseAmount;
                    const reconcileVal = reconcileAmounts[row.month];
                    const reconcileNum = reconcileVal === '' || reconcileVal === undefined ? NaN : Number(reconcileVal);
                    const balance = Number.isFinite(reconcileNum) ? amount - reconcileNum : amount;
                    const isReconciled = Math.abs(balance) < 0.01;
                    return (
                      <TableRow key={row.month} hover>
                        <TableCell>{row.monthLabel}</TableCell>
                        <TableCell align="right">{formatCurrency(amount)}</TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            placeholder="Enter amount"
                            value={reconcileAmounts[row.month] ?? ''}
                            onChange={(e) => setReconcileAmount(row.month, e.target.value)}
                            inputProps={{ min: 0, step: 1 }}
                            sx={{ width: 140 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            fontWeight={600}
                            color={isReconciled ? 'success.main' : balance > 0 ? 'warning.main' : 'error.main'}
                          >
                            {formatCurrency(isReconciled ? 0 : balance)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                            <Tooltip title={isReconciled ? 'Attach file (balance is zero)' : 'Reconcile to zero to enable attachment'}>
                              <span>
                                <Button
                                  component="label"
                                  size="small"
                                  variant="outlined"
                                  startIcon={<AttachFileIcon />}
                                  disabled={!isReconciled}
                                >
                                  <input
                                    type="file"
                                    hidden
                                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                                    onChange={(e) => handleAttachmentChange(row.month, e.target.files?.[0])}
                                  />
                                  {attachments[row.month] || 'Attach'}
                                </Button>
                              </span>
                            </Tooltip>
                            {attachmentFiles[row.month] && (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                startIcon={savingMonthKey === row.month ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                                onClick={() => handleSaveReconciliation(row.month)}
                                disabled={!!savingMonthKey}
                              >
                                Save
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default TajUtilitiesReconciliation;
