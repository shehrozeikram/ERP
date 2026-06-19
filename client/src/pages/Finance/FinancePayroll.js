import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  Print as PrintIcon,
  Refresh as RefreshIcon,
  Payments as PaymentsIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import PayrollMonthlyComparisonDialog from '../../components/HR/PayrollMonthlyComparisonDialog';
import {
  buildPayrollBankLetterData,
  downloadPayrollBankLetterExcel,
  openPayrollBankLetterPrint
} from '../../utils/payrollBankLetterPrint';
import {
  buildPayrollProjectSummary,
  downloadPayrollProjectSummaryExcel,
  getNetPayableColumnLabel,
  openPayrollProjectSummaryPrint,
  PROJECT_SUMMARY_AMOUNT_COLUMNS
} from '../../utils/payrollFinanceSummaryReport';

const fmt = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-PK')}`;

const grandTotalRowSx = {
  fontWeight: 800,
  fontSize: '0.9rem',
  color: 'text.primary',
  backgroundColor: 'grey.100',
  borderTop: 2,
  borderColor: 'divider'
};

const statusChip = (status) => {
  if (status === 'paid') return <Chip size="small" color="success" label="Paid" />;
  if (status === 'pending_payment') return <Chip size="small" color="warning" label="Pending Payment" />;
  return <Chip size="small" label={status || '—'} />;
};

export default function FinancePayroll() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [projectFilter, setProjectFilter] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/finance/payroll-queue');
      setQueue(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load finance payroll queue');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (month, year) => {
    try {
      setDetailLoading(true);
      const res = await api.get(`/finance/payroll-queue/${month}/${year}`);
      setDetail(res.data?.data || null);
      setSelected({ month, year, periodLabel: res.data?.data?.periodLabel });
    } catch (err) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: err.response?.data?.message || 'Failed to load payroll period detail'
      });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    const month = Number(searchParams.get('month'));
    const year = Number(searchParams.get('year'));
    if (month && year) {
      loadDetail(month, year);
    }
  }, [searchParams, loadDetail]);

  useEffect(() => {
    setProjectFilter('');
  }, [selected?.month, selected?.year]);

  const projectOptions = useMemo(() => {
    if (!detail?.payrolls?.length) return [];
    return [...new Set(detail.payrolls.map((row) => row.employee?.project).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [detail]);

  const filteredPayrolls = useMemo(() => {
    if (!detail?.payrolls?.length) return [];
    if (!projectFilter) return detail.payrolls;
    return detail.payrolls.filter((row) => row.employee?.project === projectFilter);
  }, [detail, projectFilter]);

  const filteredSummary = useMemo(() => {
    const totalNetSalary = filteredPayrolls.reduce((sum, row) => sum + (Number(row.netSalary) || 0), 0);
    const totalGrossSalary = filteredPayrolls.reduce((sum, row) => sum + (Number(row.grossSalary) || 0), 0);
    return {
      employeeCount: filteredPayrolls.length,
      totalNetSalary,
      totalGrossSalary
    };
  }, [filteredPayrolls]);

  const projectSummary = useMemo(
    () => buildPayrollProjectSummary(detail?.payrolls || []),
    [detail]
  );

  const handleSelectPeriod = (row) => {
    setSearchParams({ month: String(row.month), year: String(row.year) });
  };

  const fetchCompanyProfile = async () => {
    const companyRes = await api.get('/finance/company-profile').catch(() => ({ data: { data: {} } }));
    return companyRes.data?.data || {};
  };

  const fetchLetterBundle = useCallback(async () => {
    const company = await fetchCompanyProfile();

    if (projectFilter) {
      return {
        letter: buildPayrollBankLetterData({
          payrollRows: filteredPayrolls,
          periodLabel: detail?.periodLabel || selected?.periodLabel || '',
          projectName: projectFilter
        }),
        company
      };
    }

    const letterRes = await api.get(`/finance/payroll-queue/${selected.month}/${selected.year}/bank-letter`);
    return {
      letter: letterRes.data?.data,
      company
    };
  }, [selected, projectFilter, filteredPayrolls, detail]);

  const handlePrintSummaryReport = async () => {
    if (!detail?.payrolls?.length) return;
    try {
      setProcessing(true);
      const company = await fetchCompanyProfile();
      const result = openPayrollProjectSummaryPrint({
        periodLabel: detail.periodLabel,
        company,
        summary: projectSummary
      });
      if (result?.ok === false) {
        setSnackbar({ open: true, severity: 'warning', message: result.message });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: err.response?.data?.message || 'Failed to print summary report'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleExportSummaryReport = async () => {
    if (!detail?.payrolls?.length) return;
    try {
      setProcessing(true);
      const result = await downloadPayrollProjectSummaryExcel({
        periodLabel: detail.periodLabel,
        summary: projectSummary
      });
      if (result?.ok === false) {
        setSnackbar({ open: true, severity: 'warning', message: result.message });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: err.response?.data?.message || 'Failed to export summary report'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintBankLetter = async () => {
    if (!selected) return;
    if (projectFilter && !filteredPayrolls.length) {
      setSnackbar({
        open: true,
        severity: 'warning',
        message: 'No employees for the selected project.'
      });
      return;
    }
    try {
      setProcessing(true);
      const { letter, company } = await fetchLetterBundle();
      const result = openPayrollBankLetterPrint({ letter, company });
      if (result?.ok === false) {
        setSnackbar({ open: true, severity: 'warning', message: result.message });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: err.response?.data?.message || 'Failed to generate bank letter'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleExportBankLetter = async () => {
    if (!selected) return;
    try {
      setProcessing(true);
      const { letter, company } = await fetchLetterBundle();
      const result = await downloadPayrollBankLetterExcel({ letter, company });
      if (result?.ok === false) {
        setSnackbar({ open: true, severity: 'warning', message: result.message });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: err.response?.data?.message || 'Failed to export bank letter'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!selected) return;
    if (!window.confirm(`Mark all pending payrolls for ${selected.periodLabel} as paid?`)) return;
    try {
      setProcessing(true);
      const res = await api.post(`/finance/payroll-queue/${selected.month}/${selected.year}/mark-paid`, {
        paymentMethod: 'bank_transfer'
      });
      setSnackbar({ open: true, severity: 'success', message: res.data?.message || 'Payroll marked as paid' });
      await Promise.all([loadQueue(), loadDetail(selected.month, selected.year)]);
    } catch (err) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: err.response?.data?.message || 'Failed to mark payroll as paid'
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Payroll — Finance</Typography>
          <Typography variant="body2" color="text.secondary">
            AVP-approved monthly payroll and comparison reports for salary payment processing.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={loadQueue} disabled={loading}>
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
                  <TableCell align="right">Employees</TableCell>
                  <TableCell align="right">Total Net Salary</TableCell>
                  <TableCell>Comparison</TableCell>
                  <TableCell>Finance Status</TableCell>
                  <TableCell align="right">Pending</TableCell>
                  <TableCell align="right">Paid</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {queue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">No AVP-approved payroll periods in finance queue.</TableCell>
                  </TableRow>
                ) : queue.map((row) => (
                  <TableRow
                    key={`${row.month}-${row.year}`}
                    hover
                    selected={selected?.month === row.month && selected?.year === row.year}
                  >
                    <TableCell>{row.periodLabel}</TableCell>
                    <TableCell align="right">{row.employeeCount}</TableCell>
                    <TableCell align="right">{fmt(row.totalNetSalary)}</TableCell>
                    <TableCell><Chip size="small" label={row.comparisonStatus || '—'} /></TableCell>
                    <TableCell>{statusChip(row.financeStatus)}</TableCell>
                    <TableCell align="right">{row.pendingCount}</TableCell>
                    <TableCell align="right">{row.paidCount}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => handleSelectPeriod(row)}>Open</Button>
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
                  <Typography variant="h6">{detail.periodLabel}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {filteredSummary.employeeCount} employees
                    {projectFilter ? ` in ${projectFilter}` : ''}
                    {' · '}Net {fmt(filteredSummary.totalNetSalary)}
                    {' · '}Gross {fmt(filteredSummary.totalGrossSalary)}
                    {projectFilter ? ` (filtered from ${detail.summary.employeeCount})` : ''}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    startIcon={<AssessmentIcon />}
                    onClick={() => setSummaryOpen(true)}
                    disabled={!detail?.payrolls?.length}
                  >
                    Summary Report
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() => setComparisonOpen(true)}
                    disabled={!detail?.comparisonReport}
                  >
                    Comparison Report
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportBankLetter}
                    disabled={processing}
                  >
                    Export Excel
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PrintIcon />}
                    onClick={handlePrintBankLetter}
                    disabled={processing}
                  >
                    Print Bank Letter
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<PaymentsIcon />}
                    onClick={handleMarkPaid}
                    disabled={processing || detail.summary.pendingCount === 0}
                  >
                    Mark as Paid
                  </Button>
                </Stack>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                  <InputLabel>Project</InputLabel>
                  <Select
                    value={projectFilter}
                    label="Project"
                    onChange={(e) => setProjectFilter(e.target.value)}
                  >
                    <MenuItem value="">All Projects</MenuItem>
                    {projectOptions.map((project) => (
                      <MenuItem key={project} value={project}>
                        {project}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {projectFilter ? (
                  <Button size="small" onClick={() => setProjectFilter('')} sx={{ alignSelf: { sm: 'center' } }}>
                    Clear filter
                  </Button>
                ) : null}
              </Stack>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Project</TableCell>
                      <TableCell>CNIC</TableCell>
                      <TableCell>Branch</TableCell>
                      <TableCell>Account No</TableCell>
                      <TableCell align="right">Net Salary</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPayrolls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          No employees match the selected project filter.
                        </TableCell>
                      </TableRow>
                    ) : filteredPayrolls.map((row) => (
                      <TableRow key={row._id}>
                        <TableCell>{row.employee?.employeeId || '—'}</TableCell>
                        <TableCell>{row.employee?.name || '—'}</TableCell>
                        <TableCell>{row.employee?.project || '—'}</TableCell>
                        <TableCell>{row.employee?.idCard || '—'}</TableCell>
                        <TableCell>{row.employee?.branchCode || '—'}</TableCell>
                        <TableCell>{row.employee?.accountNumber || '—'}</TableCell>
                        <TableCell align="right">{fmt(row.netSalary)}</TableCell>
                        <TableCell><Chip size="small" label={row.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} align="right" sx={{ fontWeight: 700, borderTop: 2, borderColor: 'divider' }}>
                        {projectFilter ? `Total — ${projectFilter}` : 'Total'}
                        {' '}({filteredSummary.employeeCount} employees)
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, borderTop: 2, borderColor: 'divider' }}
                      >
                        {fmt(filteredSummary.totalNetSalary)}
                      </TableCell>
                      <TableCell sx={{ borderTop: 2, borderColor: 'divider' }} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            </>
          ) : null}
        </Paper>
      ) : null}

      <Dialog
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{ sx: { width: 'min(96vw, 1400px)', maxWidth: '96vw' } }}
      >
        <DialogTitle>
          Company-Wise Summary of Salary — {detail?.periodLabel || selected?.periodLabel}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Project-wise salary breakdown for the full payroll period, with grand total for all projects.
          </Typography>
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Sr No</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Project Name</TableCell>
                  <TableCell align="right">No of Employees</TableCell>
                  {PROJECT_SUMMARY_AMOUNT_COLUMNS.map((col) => (
                    <TableCell key={col.key} align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {col.label}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {getNetPayableColumnLabel(detail?.periodLabel || selected?.periodLabel)}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectSummary.rows.map((row, index) => (
                  <TableRow
                    key={row.project}
                    selected={projectFilter === row.project}
                    hover
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{row.project}</TableCell>
                    <TableCell align="right">{row.employeeCount}</TableCell>
                    {PROJECT_SUMMARY_AMOUNT_COLUMNS.map((col) => (
                      <TableCell key={col.key} align="right">
                        {fmt(row[col.key])}
                      </TableCell>
                    ))}
                    <TableCell align="right">{fmt(row.netPayable)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} align="right" sx={grandTotalRowSx}>
                    <strong>Grand Total (All Projects)</strong>
                  </TableCell>
                  <TableCell align="right" sx={grandTotalRowSx}>
                    <strong>{projectSummary.totals.employeeCount}</strong>
                  </TableCell>
                  {PROJECT_SUMMARY_AMOUNT_COLUMNS.map((col) => (
                    <TableCell key={col.key} align="right" sx={grandTotalRowSx}>
                      <strong>{fmt(projectSummary.totals[col.key])}</strong>
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={grandTotalRowSx}>
                    <strong>{fmt(projectSummary.totals.netPayable)}</strong>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>Close</Button>
          <Button
            startIcon={<DownloadIcon />}
            onClick={handleExportSummaryReport}
            disabled={processing}
          >
            Export Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrintSummaryReport}
            disabled={processing}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>

      <PayrollMonthlyComparisonDialog
        open={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        report={detail?.comparisonReport}
        generatedAt={detail?.comparisonMeta?.generatedAt}
        reportStatus={detail?.comparisonMeta?.status || 'Approved by AVP'}
        month={selected?.month}
        year={selected?.year}
        periodLabel={selected?.periodLabel}
        draftCount={0}
        approvalDoc={detail?.approval}
        approvalLoading={false}
        onRefreshApproval={() => selected && loadDetail(selected.month, selected.year)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.message}
      />
    </Box>
  );
}
