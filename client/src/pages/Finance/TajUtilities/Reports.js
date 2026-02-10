import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  Assessment as ReportsIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  AccountBalance as TransactionIcon,
  GetApp as DownloadIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { fetchReports, fetchAllInvoices } from '../../../services/propertyInvoiceService';
import { fetchResidentLedger } from '../../../services/tajResidentsService';
import { generateResidentLedgerPDF } from '../../../utils/residentLedgerPDF';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const getPaymentStatusConfig = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'paid') return { color: 'success', label: 'Paid' };
  if (s === 'partial_paid') return { color: 'warning', label: 'Partial' };
  return { color: 'error', label: 'Unpaid' };
};

const getTransactionTypeLabel = (type) => {
  const t = (type || '').toLowerCase();
  if (t === 'deposit') return { color: 'success', label: 'Deposit' };
  if (t === 'bill_payment' || t === 'payment') return { color: 'info', label: 'Payment' };
  if (t === 'withdraw') return { color: 'error', label: 'Withdraw' };
  if (t === 'transfer') return { color: 'primary', label: 'Transfer' };
  return { color: 'default', label: t || '—' };
};

const TajUtilitiesReports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startMonth, setStartMonth] = useState(dayjs().subtract(11, 'month').format('YYYY-MM'));
  const [endMonth, setEndMonth] = useState(dayjs().format('YYYY-MM'));
  const [chargeTypeFilter, setChargeTypeFilter] = useState('all');
  const [report, setReport] = useState({ byMonth: [], totals: {} });

  const CHARGE_TYPE_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'CAM', label: 'CAM Charges' },
    { value: 'ELECTRICITY', label: 'Electricity Bills' },
    { value: 'RENT', label: 'Rental Management' },
    { value: 'OPEN_INVOICE', label: 'Open Invoices' },
    { value: 'Mixed', label: 'Mixed' }
  ];

  const [ledgerResidentId, setLedgerResidentId] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [ledger, setLedger] = useState(null);
  const [exportingMonthKey, setExportingMonthKey] = useState(null);

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
      setError(err.response?.data?.message || 'Failed to load report');
      setReport({ byMonth: [], totals: {} });
    } finally {
      setLoading(false);
    }
  }, [startMonth, endMonth, chargeTypeFilter]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const loadLedger = useCallback(async () => {
    const id = (ledgerResidentId || '').trim();
    if (!id) {
      setLedgerError('Please enter Resident ID');
      return;
    }
    try {
      setLedgerLoading(true);
      setLedgerError('');
      setLedger(null);
      const response = await fetchResidentLedger(id);
      const data = response.data?.data || {};
      setLedger(data);
    } catch (err) {
      setLedgerError(err.response?.data?.message || 'Failed to load ledger');
      setLedger(null);
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerResidentId]);

  const exportMonthInvoicesToExcel = useCallback(async (monthKey) => {
    if (!monthKey) return;
    try {
      setExportingMonthKey(monthKey);
      const response = await fetchAllInvoices({ monthYear: monthKey, limit: 10000 });
      const invoices = response.data?.data || [];
      const headers = [
        'Invoice #',
        'Resident ID',
        'Property',
        'Owner',
        'Charge Types',
        'Period From',
        'Period To',
        'Due Date',
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
      const rows = invoices.map((inv) => {
        const isOpen = !inv.property;
        const residentId = isOpen ? '—' : (inv.property?.resident?.residentId ?? inv.property?.residentId ?? '—');
        const propertyName = isOpen ? (inv.customerName || 'Open Invoice') : (inv.property?.propertyName || inv.property?.plotNumber || '—');
        const owner = isOpen ? (inv.customerName || '—') : (inv.property?.ownerName || '—');
        const chargeTypes = Array.isArray(inv.chargeTypes) ? inv.chargeTypes.join(', ') : (inv.chargeTypes || '—');
        const recordedBy = inv.createdBy ? [inv.createdBy.firstName, inv.createdBy.lastName].filter(Boolean).join(' ') : '—';
        const num = (v) => Number(v) || 0;
        return [
          inv.invoiceNumber || '—',
          residentId,
          propertyName,
          owner,
          chargeTypes,
          inv.periodFrom ? dayjs(inv.periodFrom).format('DD MMM YYYY') : '—',
          inv.periodTo ? dayjs(inv.periodTo).format('DD MMM YYYY') : '—',
          inv.dueDate ? dayjs(inv.dueDate).format('DD MMM YYYY') : '—',
          num(inv.subtotal),
          num(inv.totalArrears),
          num(inv.grandTotal),
          num(inv.totalPaid),
          num(inv.balance),
          inv.paymentStatus || '—',
          inv.status || '—',
          recordedBy,
          inv.customerName || '—',
          inv.customerAddress || '—',
          inv.sector || (inv.property?.sector?.name ?? inv.property?.sector ?? '—')
        ];
      });
      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet(monthKey, { views: [{ state: 'frozen', ySplit: 1 }] });
      const colWidths = [18, 12, 22, 18, 20, 12, 12, 12, 14, 10, 14, 10, 10, 12, 12, 16, 18, 20, 10];
      headers.forEach((h, i) => {
        worksheet.getColumn(i + 1).width = colWidths[i] || 12;
      });
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true, size: 12 };
      headerRow.alignment = { vertical: 'middle' };
      rows.forEach((row) => worksheet.addRow(row));
      const filename = `invoices-${monthKey}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export invoices');
    } finally {
      setExportingMonthKey(null);
    }
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <ReportsIcon color="primary" />
        <Typography variant="h5" fontWeight={600}>
          Taj Utilities Reports
        </Typography>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
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

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Invoice Amount
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {formatCurrency(report.totals.invoiceAmount)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Arrears
              </Typography>
              <Typography variant="h6" fontWeight={700} color="warning.main">
                {formatCurrency(report.totals.arrears)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Payments Received
              </Typography>
              <Typography variant="h6" fontWeight={700} color="success.main">
                {formatCurrency(report.totals.paymentsReceived)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Invoices
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {report.totals.invoiceCount ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Month-wise table */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Month-wise Breakdown
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Invoice Amount and Arrears are grouped by billing period (invoice month). Payments Received are grouped by payment date.
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : report.byMonth.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No data for the selected period
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell><strong>Month</strong></TableCell>
                    <TableCell align="right"><strong>Invoice Amount</strong></TableCell>
                    <TableCell align="right"><strong>Arrears</strong></TableCell>
                    <TableCell align="right"><strong>Payments Received</strong></TableCell>
                    <TableCell align="right"><strong>Invoices</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.byMonth.map((row) => (
                    <TableRow key={row.month} hover>
                      <TableCell>{row.monthLabel}</TableCell>
                      <TableCell align="right">{formatCurrency(row.invoiceAmount)}</TableCell>
                      <TableCell align="right" sx={{ color: 'warning.main' }}>
                        {formatCurrency(row.arrears)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>
                        {formatCurrency(row.paymentsReceived)}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                          <span>{row.invoiceCount}</span>
                          {row.invoiceCount > 0 && (
                            <Tooltip title="Download invoices report (Excel)">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => exportMonthInvoicesToExcel(row.month)}
                                disabled={!!exportingMonthKey}
                              >
                                {exportingMonthKey === row.month ? (
                                  <CircularProgress size={18} color="inherit" />
                                ) : (
                                  <DownloadIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Resident Ledger */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <PersonIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Resident Ledger
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter Resident ID (e.g. 00001) or MongoDB ID to view all invoices, deposits, and transactions.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <TextField
              size="small"
              label="Resident ID"
              placeholder="e.g. 00001"
              value={ledgerResidentId}
              onChange={(e) => setLedgerResidentId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadLedger()}
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                )
              }}
            />
            <Button
              variant="contained"
              onClick={loadLedger}
              disabled={ledgerLoading || !ledgerResidentId.trim()}
              startIcon={ledgerLoading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
            >
              {ledgerLoading ? 'Loading...' : 'View Ledger'}
            </Button>
          </Stack>

          {ledgerError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLedgerError('')}>
              {ledgerError}
            </Alert>
          )}

          {ledger && (
            <>
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={() => generateResidentLedgerPDF(ledger, { openInNewTab: false })}
                >
                  Download PDF
                </Button>
              </Stack>

              {/* Resident Information (as per sketch) */}
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                  Resident Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Resident ID</Typography>
                    <Typography variant="body2" fontWeight={500}>{ledger.resident?.residentId || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Name</Typography>
                    <Typography variant="body2" fontWeight={500}>{ledger.resident?.name || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary" display="block">CNIC</Typography>
                    <Typography variant="body2" fontWeight={500}>{ledger.resident?.cnic || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Contact</Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {[ledger.resident?.contactNumber, ledger.resident?.email].filter(Boolean).join(' • ') || '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Address</Typography>
                    <Typography variant="body2" fontWeight={500}>{ledger.resident?.address || '—'}</Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Sector</Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {ledger.resident?.properties?.[0]?.sector?.name ?? ledger.resident?.properties?.[0]?.sector ?? '—'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Typography variant="caption" color="text.secondary" display="block">Balance</Typography>
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      {formatCurrency(ledger.resident?.balance)}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Partition invoices by charge type */}
              {(() => {
                const invoices = ledger.invoices || [];
                const camInvoices = invoices.filter(inv =>
                  inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'CAM'
                );
                const electricityInvoices = invoices.filter(inv =>
                  inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'ELECTRICITY'
                );
                const rentInvoices = invoices.filter(inv =>
                  inv.chargeTypes?.length === 1 && inv.chargeTypes[0] === 'RENT'
                );
                const otherInvoices = invoices.filter(inv => {
                  const types = inv.chargeTypes || [];
                  if (types.length === 0) return true;
                  if (types.length > 1) return true;
                  return !['CAM', 'ELECTRICITY', 'RENT'].includes(types[0]);
                });

                const ledgerTable = (title, list) => (
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                          <TableCell><strong>Invoice Date</strong></TableCell>
                          <TableCell><strong>Invoice No</strong></TableCell>
                          <TableCell><strong>Due Date</strong></TableCell>
                          <TableCell><strong>Period</strong></TableCell>
                          <TableCell align="right"><strong>Invoice Amount</strong></TableCell>
                          <TableCell align="right"><strong>Arrears</strong></TableCell>
                          <TableCell align="right"><strong>Amount Due</strong></TableCell>
                          <TableCell align="right"><strong>Balance</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {list.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 2 }}>
                              <Typography variant="body2" color="text.secondary">No records</Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          list.map((inv) => (
                            <TableRow key={inv._id}>
                              <TableCell>{inv.invoiceDate ? dayjs(inv.invoiceDate).format('DD MMM YYYY') : '—'}</TableCell>
                              <TableCell>{inv.invoiceNumber}</TableCell>
                              <TableCell>{inv.dueDate ? dayjs(inv.dueDate).format('DD MMM YYYY') : '—'}</TableCell>
                              <TableCell>
                                {inv.periodFrom && inv.periodTo
                                  ? `${dayjs(inv.periodFrom).format('DD MMM YY')} - ${dayjs(inv.periodTo).format('DD MMM YY')}`
                                  : inv.periodTo ? dayjs(inv.periodTo).format('MMM YYYY') : '—'}
                              </TableCell>
                              <TableCell align="right">{formatCurrency(inv.subtotal)}</TableCell>
                              <TableCell align="right" sx={{ color: 'warning.main' }}>{formatCurrency(inv.totalArrears)}</TableCell>
                              <TableCell align="right">{formatCurrency(inv.grandTotal)}</TableCell>
                              <TableCell align="right" sx={{ color: (inv.balance || 0) > 0 ? 'warning.main' : 'text.primary' }}>
                                {formatCurrency(inv.balance)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                );

                return (
                  <>
                    {/* CAM Charges */}
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, mt: 2 }}>
                      CAM Charges
                    </Typography>
                    {ledgerTable('CAM', camInvoices)}

                    {/* Electricity Bill */}
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, mt: 2 }}>
                      Electricity Bill
                    </Typography>
                    {ledgerTable('Electricity', electricityInvoices)}

                    {/* Rental Management */}
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, mt: 2 }}>
                      Rental Management
                    </Typography>
                    {ledgerTable('Rental', rentInvoices)}

                    {/* Other / Mixed (if any) */}
                    {otherInvoices.length > 0 && (
                      <>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, mt: 2 }}>
                          Other / Mixed
                        </Typography>
                        {ledgerTable('Other', otherInvoices)}
                      </>
                    )}

                    {/* Transactions */}
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, mt: 3 }}>
                      <TransactionIcon sx={{ fontSize: 20, verticalAlign: 'middle', mr: 0.5 }} />
                      Transactions ({ledger.transactions?.length ?? 0})
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 280 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell><strong>Date</strong></TableCell>
                            <TableCell><strong>Type</strong></TableCell>
                            <TableCell><strong>Description</strong></TableCell>
                            <TableCell align="right"><strong>Amount</strong></TableCell>
                            <TableCell><strong>Ref</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(ledger.transactions || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} align="center" sx={{ py: 2 }}>
                                <Typography variant="body2" color="text.secondary">No transactions</Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            (ledger.transactions || []).map((txn) => {
                              const typeConfig = getTransactionTypeLabel(txn.transactionType);
                              const diff = (txn.balanceAfter ?? 0) - (txn.balanceBefore ?? 0);
                              const isCredit = diff >= 0;
                              return (
                                <TableRow key={txn._id}>
                                  <TableCell>{dayjs(txn.createdAt).format('DD MMM YYYY')}</TableCell>
                                  <TableCell>
                                    <Chip size="small" color={typeConfig.color} label={typeConfig.label} />
                                  </TableCell>
                                  <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {txn.description || '—'}
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography component="span" color={isCredit ? 'success.main' : 'error.main'}>
                                      {isCredit ? '+' : '-'}{formatCurrency(Math.abs(txn.amount || 0))}
                                    </Typography>
                                    {txn.transactionType === 'deposit' && txn.remainingAmount != null && (
                                      <Typography variant="caption" display="block" color="text.secondary">
                                        Remaining: {formatCurrency(txn.remainingAmount)}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>{txn.referenceNumberExternal || txn.referenceNumber || '—'}</TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                );
              })()}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default TajUtilitiesReports;
