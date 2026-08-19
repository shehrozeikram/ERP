import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Stack,
  Grid,
  Button,
  TextField,
  ButtonGroup,
  Collapse,
  IconButton,
  Tooltip,
  Divider,
  Menu
} from '@mui/material';
import {
  TrendingUp as ProfitLossIcon,
  AccountBalance as BalanceSheetIcon,
  PieChart as EquityIcon,
  MonetizationOn as CashFlowIcon,
  ReceiptLong as TrialBalanceIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  Email as EmailIcon,
  FileDownload as ExportIcon,
  MoreVert as MoreVertIcon,
  AutoAwesome as InsightsIcon,
  KeyboardArrowDown as CollapseIcon,
  KeyboardArrowRight as ExpandIcon,
  SwapVert as SortIcon,
  Tune as CustomizeIcon,
  UnfoldMore as ExpandAllIcon,
  UnfoldLess as CollapseAllIcon,
  Check as CheckIcon,
  NoteAdd as NoteAddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../services/api';

const TAB_CONFIG = [
  { id: 0, key: 'profit-loss', label: 'Profit & Loss', icon: <ProfitLossIcon fontSize="small" /> },
  { id: 1, key: 'balance-sheet', label: 'Balance Sheet', icon: <BalanceSheetIcon fontSize="small" /> },
  { id: 2, key: 'equity', label: 'Equity', icon: <EquityIcon fontSize="small" /> },
  { id: 3, key: 'cash-flow', label: 'Cash Flow', icon: <CashFlowIcon fontSize="small" /> },
  { id: 4, key: 'trial-balance', label: 'Trial Balance', icon: <TrialBalanceIcon fontSize="small" /> }
];

const PERIOD_PRESETS = [
  { label: 'Last month', value: 'last-month' },
  { label: 'This month', value: 'this-month' },
  { label: 'This Year (FY)', value: 'this-year' },
  { label: 'Last Year (FY)', value: 'last-year' },
  { label: 'This Quarter', value: 'this-quarter' },
  { label: 'Custom', value: 'custom' }
];

const COMPARE_OPTIONS = [
  { label: 'Select Period', value: 'none' },
  { label: 'Previous period (PP)', value: 'prev-period' },
  { label: 'Previous year (PY)', value: 'prev-year' },
  { label: 'Year to date (YTD)', value: 'ytd' }
];

const DISPLAY_COLUMNS_OPTIONS = [
  { label: 'Total', value: 'total' },
  { label: 'Months', value: 'months' },
  { label: 'Quarters', value: 'quarters' },
  { label: 'Years', value: 'years' }
];

/** Financial Value Cell Component with Tabular Lining Figures */
const FinancialValue = ({
  val,
  showCurrency = false,
  isTotal = false,
  isGrandTotal = false,
  isNegative = false,
  currencyPrefix = 'PRs'
}) => {
  if (val === null || val === undefined || isNaN(val) || val === '') {
    return (
      <Typography component="span" sx={{ color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 400 }}>
        —
      </Typography>
    );
  }

  const num = Math.round(Number(val));
  const absFormatted = Math.abs(num).toLocaleString('en-US');
  const negative = isNegative || num < 0;

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        justifyContent: 'flex-end',
        fontVariantNumeric: 'tabular-nums lining-nums',
        fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        letterSpacing: '0.02em',
        fontWeight: isGrandTotal ? 800 : isTotal ? 700 : 500,
        fontSize: isGrandTotal ? '0.875rem' : isTotal ? '0.825rem' : '0.8125rem',
        color: isGrandTotal
          ? '#0f172a'
          : isTotal
          ? '#0f172a'
          : negative
          ? '#b91c1c'
          : '#1e293b'
      }}
    >
      {negative && (
        <Box component="span" sx={{ fontWeight: 800, mr: 0.25, color: '#dc2626' }}>
          -
        </Box>
      )}

      {showCurrency && (
        <Box component="span" sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', mr: 0.35 }}>
          {currencyPrefix}
        </Box>
      )}

      <Box component="span">{absFormatted}</Box>
    </Box>
  );
};

const Legacy = () => {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState(3); // Default to Cash Flow as requested
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingReport] = useState(false);
  const [error, setError] = useState('');

  // Date filters
  const [reportPeriod, setReportPeriod] = useState('last-month');
  const [fromDate, setFromDate] = useState('2026-07-01');
  const [toDate, setToDate] = useState('2026-07-31');
  const [accountingBasis, setAccountingBasis] = useState('Accrual');
  const [displayColumnsBy, setDisplayColumnsBy] = useState('total');
  const [compareTo, setCompareTo] = useState('none');
  const [density, setDensity] = useState('Compact | 100%');
  const [densityAnchor, setDensityAnchor] = useState(null);

  // Tree collapse/expand state for Profit & Loss
  const [openSectionsPL, setOpenSectionsPL] = useState({
    income: true,
    sales: true,
    expenses: true,
    utilities: true
  });

  // Tree collapse/expand state for Balance Sheet
  const [openSectionsBS, setOpenSectionsBS] = useState({
    assets: true,
    currentAssets: true,
    cashEquivalents: true,
    employeeAdvances: true,
    longTermAssets: true,
    ppe: true,
    liabilitiesAndEquity: true,
    currentLiabilities: true,
    accountsPayable: true,
    accruedLiabilities: true,
    incomeTaxPayable: true,
    payableRelatedParties: true,
    shareholdersEquity: true
  });

  // Tree collapse/expand state for Cash Flow
  const [openSectionsCF, setOpenSectionsCF] = useState({
    operating: true,
    adjustments: true
  });

  const toggleSectionPL = (key) => setOpenSectionsPL((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleSectionBS = (key) => setOpenSectionsBS((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleSectionCF = (key) => setOpenSectionsCF((prev) => ({ ...prev, [key]: !prev[key] }));

  const collapseAll = () => {
    if (currentTab === 0) setOpenSectionsPL({ income: false, sales: false, expenses: false, utilities: false });
    else if (currentTab === 1) setOpenSectionsBS({ assets: false, currentAssets: false, cashEquivalents: false, employeeAdvances: false, longTermAssets: false, ppe: false, liabilitiesAndEquity: false, currentLiabilities: false, accountsPayable: false, accruedLiabilities: false, incomeTaxPayable: false, payableRelatedParties: false, shareholdersEquity: false });
    else if (currentTab === 3) setOpenSectionsCF({ operating: false, adjustments: false });
  };

  const expandAll = () => {
    if (currentTab === 0) setOpenSectionsPL({ income: true, sales: true, expenses: true, utilities: true });
    else if (currentTab === 1) setOpenSectionsBS({ assets: true, currentAssets: true, cashEquivalents: true, employeeAdvances: true, longTermAssets: true, ppe: true, liabilitiesAndEquity: true, currentLiabilities: true, accountsPayable: true, accruedLiabilities: true, incomeTaxPayable: true, payableRelatedParties: true, shareholdersEquity: true });
    else if (currentTab === 3) setOpenSectionsCF({ operating: true, adjustments: true });
  };

  // Fetch company list
  const loadCompanies = useCallback(async () => {
    try {
      setLoadingCompanies(true);
      setError('');
      const res = await api.get('/hr/companies');
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setCompanies(list);
      if (list.length > 0 && !selectedCompany) {
        setSelectedCompany(list[0]._id);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
      try {
        const fallbackRes = await api.get('/finance/companies');
        const fallbackList = Array.isArray(fallbackRes.data?.data) ? fallbackRes.data.data : [];
        setCompanies(fallbackList);
        if (fallbackList.length > 0 && !selectedCompany) {
          setSelectedCompany(fallbackList[0]._id);
        }
      } catch (e) {
        setError('Failed to load companies.');
      }
    } finally {
      setLoadingCompanies(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handlePeriodChange = (preset) => {
    setReportPeriod(preset);
    let start = dayjs();
    let end = dayjs();

    if (preset === 'last-month') {
      start = dayjs().subtract(1, 'month').startOf('month');
      end = dayjs().subtract(1, 'month').endOf('month');
    } else if (preset === 'this-month') {
      start = dayjs().startOf('month');
      end = dayjs();
    } else if (preset === 'this-year') {
      start = dayjs().startOf('year');
      end = dayjs();
    } else if (preset === 'last-year') {
      start = dayjs().subtract(1, 'year').startOf('year');
      end = dayjs().subtract(1, 'year').endOf('year');
    }

    if (preset !== 'custom') {
      setFromDate(start.format('YYYY-MM-DD'));
      setToDate(end.format('YYYY-MM-DD'));
    }
  };

  const activeTab = TAB_CONFIG[currentTab];
  const currentCompany = companies.find((c) => c._id === selectedCompany);
  const currentCompanyName = currentCompany?.name || 'Country International College of Nursing';

  const primaryPeriodHeader = dayjs(fromDate).format('MMM YYYY');
  const comparePeriodHeader = useMemo(() => {
    if (compareTo === 'prev-year') return `${dayjs(fromDate).subtract(1, 'year').format('MMM YYYY')} (PY)`;
    if (compareTo === 'prev-period') return `${dayjs(fromDate).subtract(1, 'month').format('MMM YYYY')} (PP)`;
    if (compareTo === 'ytd') return 'YTD';
    return '';
  }, [compareTo, fromDate]);

  const isComparative = compareTo !== 'none';

  // ── Profit & Loss Data ───────────────────────────────────────
  const plData = {
    p1: { income: 2846800, grossProfit: 2846800, expenses: 4828557, net: -1981757, sales: 2846800, fee: 2846800, bankCharges: 23, dues: 19813, eobi: 40000, meals: null, otherAdmin: null, payroll: 3082169, rent: 1260000, repairs: 23900, electricity: 375456, gas: 5090, internet: 11531, water: 10575, utilities: 402652 },
    p2: { income: 3060005, grossProfit: 3060005, expenses: 5677796, net: -2617791, sales: 3060005, fee: 3060005, bankCharges: 10301, dues: 773500, eobi: 38850, meals: 82842, otherAdmin: 2295, payroll: 2553066, rent: 1950000, repairs: null, electricity: 245655, gas: 2820, internet: 7942, water: 10525, utilities: 266942 }
  };

  // ── Balance Sheet Data ───────────────────────────────────────
  const bsData = {
    advanceTax: 259590, ablBank: -4475476, bankIslami: 20, cashOnHand: 100000, totalCashEquivalents: -4375456, advanceAgainstSalary: 0, totalEmployeeAdvances: 240000, totalCurrentAssets: -3875866,
    accDepreciationPPE: -1130783, computerEquipment: 2275000, electricalItem: 1734000, furnitureFixtures: 5695000, libraryBooks: 2756145, solarSystem: 1962400, totalPPE: 14422545, securityDeposit: 5040000, totalLongTermAssets: 18331762, totalAssets: 14455896,
    accountsPayable: -5596494, totalAccountsPayable: -5596494, eobiEmployeeContribution: 48090, eobiEmployerContribution: 240449, whtEmployeeSalary: 0, totalAccruedLiabilities: 288539, whtSupplies: 25996, totalIncomeTaxPayable: 25996, sardarGroupPayable: 78785405, tajResidenciaPayable: 19850151, totalPayableRelatedParties: 98635556, totalCurrentLiabilities: 93353597,
    shareCapital: 100000, retainedEarnings: -77015944, netIncome: -1981757, totalShareholdersEquity: -78897701, totalLiabilitiesAndEquity: 14455896
  };

  // ── Statement of Changes in Equity Data ───────────────────────
  const equityData = {
    retainedEarnings: -77015944,
    shareCapital: 100000,
    totalEquity: -76915944
  };

  // ── Statement of Cash Flows Data (Matching User's Image) ───────
  const cfData = {
    profitForTheYear: -1981757,
    accountsPayable: -2012640,
    eobiEmployeeContribution: 8000,
    eobiEmployerContribution: 40000,
    whtEmployeeSalary: 0,
    sardarGroupPayable: 1458526,
    totalAdjustments: -506114,
    netCashOperatingActivities: -2487871,
    netIncreaseDecreaseCash: -2487871,
    cashBeginningOfYear: -1887585,
    cashEndOfYear: -4375456
  };

  const getDocumentSubtitle = () => {
    if (currentTab === 0) return 'Profit and Loss';
    if (currentTab === 1) return 'Balance Sheet';
    if (currentTab === 2) return 'Statement of changes in equity';
    if (currentTab === 3) return 'Statement of Cash Flows';
    return 'Trial Balance';
  };

  const getDocumentDateLabel = () => {
    if (currentTab === 0) return dayjs(fromDate).format('MMMM YYYY');
    if (currentTab === 1) return `As of ${dayjs(toDate).format('MMMM DD, YYYY')}`;
    if (currentTab === 2) return `As of ${dayjs(toDate).format('MMMM DD, YYYY')}`;
    if (currentTab === 3) return dayjs(fromDate).format('MMMM YYYY');
    return dayjs(toDate).format('MMMM DD, YYYY');
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: '#f4f6f8', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ── Top Header / Tabs ─────────────────── */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ fontSize: '0.75rem' }}>
            <Link underline="hover" color="inherit" href="#" onClick={(e) => { e.preventDefault(); navigate('/finance'); }}>
              Finance
            </Link>
            <Typography color="text.primary" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Legacy Statements</Typography>
          </Breadcrumbs>

          {/* Company Selector */}
          <FormControl size="small" sx={{ minWidth: 240, bgcolor: '#ffffff' }}>
            <InputLabel id="entity-select-label" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Company</InputLabel>
            <Select
              labelId="entity-select-label"
              value={selectedCompany}
              label="Company"
              onChange={(e) => setSelectedCompany(e.target.value)}
              disabled={loadingCompanies}
              startAdornment={<BusinessIcon sx={{ mr: 1, color: '#64748b', fontSize: 16 }} />}
              sx={{ height: 32, fontSize: '0.8rem', borderRadius: 1 }}
            >
              {loadingCompanies ? (
                <MenuItem value="" disabled>Loading...</MenuItem>
              ) : (
                companies.map((comp) => (
                  <MenuItem key={comp._id} value={comp._id} sx={{ fontSize: '0.8rem' }}>
                    {comp.name} {comp.code ? `(${comp.code})` : ''}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Stack>

        <Paper elevation={0} sx={{ borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff', borderRadius: 1.5 }}>
          <Tabs
            value={currentTab}
            onChange={(_, val) => setCurrentTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 38,
              '& .MuiTab-root': { minHeight: 38, py: 0.5, px: 2, fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', gap: 1 }
            }}
          >
            {TAB_CONFIG.map((t) => (
              <Tab key={t.id} icon={t.icon} iconPosition="start" label={t.label} />
            ))}
          </Tabs>
        </Paper>
      </Box>

      {/* ── QuickBooks Compact Filter Toolbar ─────────────────── */}
      <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 1.5, bgcolor: '#ffffff', border: '1px solid #e5e7eb' }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.72rem' }}>
              Report period
            </Typography>
            <FormControl fullWidth size="small">
              <Select value={reportPeriod} onChange={(e) => handlePeriodChange(e.target.value)} sx={{ height: 32, fontSize: '0.8rem', bgcolor: '#ffffff' }}>
                {PERIOD_PRESETS.map((p) => (<MenuItem key={p.value} value={p.value} sx={{ fontSize: '0.8rem' }}>{p.label}</MenuItem>))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} sm={3} md={1.5}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.72rem' }}>
              From
            </Typography>
            <TextField fullWidth size="small" type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setReportPeriod('custom'); }} sx={{ '& .MuiOutlinedInput-root': { height: 32, fontSize: '0.8rem' } }} />
          </Grid>

          <Grid item xs={6} sm={3} md={1.5}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.72rem' }}>
              To
            </Typography>
            <TextField fullWidth size="small" type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setReportPeriod('custom'); }} sx={{ '& .MuiOutlinedInput-root': { height: 32, fontSize: '0.8rem' } }} />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.72rem' }}>
              Accounting method
            </Typography>
            <ButtonGroup size="small" sx={{ height: 32, width: '100%' }}>
              {['Cash', 'Accrual'].map((basis) => (
                <Button
                  key={basis}
                  variant={accountingBasis === basis ? 'contained' : 'outlined'}
                  onClick={() => setAccountingBasis(basis)}
                  sx={{
                    flex: 1, textTransform: 'none', fontWeight: 600, fontSize: '0.75rem',
                    bgcolor: accountingBasis === basis ? '#111827' : '#ffffff',
                    color: accountingBasis === basis ? '#ffffff' : '#374151',
                    borderColor: '#d1d5db',
                    '&:hover': { bgcolor: accountingBasis === basis ? '#1f2937' : '#f9fafb' }
                  }}
                >
                  {basis}
                </Button>
              ))}
            </ButtonGroup>
          </Grid>

          <Grid item xs={12} sm={6} md={1.75}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.72rem' }}>
              Display columns by
            </Typography>
            <FormControl fullWidth size="small">
              <Select value={displayColumnsBy} onChange={(e) => setDisplayColumnsBy(e.target.value)} sx={{ height: 32, fontSize: '0.8rem', bgcolor: '#ffffff' }}>
                {DISPLAY_COLUMNS_OPTIONS.map((d) => (<MenuItem key={d.value} value={d.value} sx={{ fontSize: '0.8rem' }}>{d.label}</MenuItem>))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.72rem' }}>
              Compare to
            </Typography>
            <FormControl fullWidth size="small">
              <Select value={compareTo} onChange={(e) => setCompareTo(e.target.value)} sx={{ height: 32, fontSize: '0.8rem', bgcolor: '#ffffff' }}>
                {COMPARE_OPTIONS.map((c) => (<MenuItem key={c.value} value={c.value} sx={{ fontSize: '0.8rem' }}>{c.label}</MenuItem>))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={1.25} sx={{ textAlign: 'right' }}>
            <Button fullWidth variant="outlined" size="small" startIcon={<CustomizeIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', height: 32, borderRadius: 1, borderColor: '#d1d5db', color: '#374151' }}>
              Customize
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* ── QuickBooks Statement Document Sheet (Centered & Proportional) ─────────────────── */}
      {loadingReport ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: 960,
              p: { xs: 2, md: 3 },
              borderRadius: 1.5,
              bgcolor: '#ffffff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            {/* Top Document Utilities Bar */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  size="small"
                  onClick={(e) => setDensityAnchor(e.currentTarget)}
                  endIcon={<CollapseIcon sx={{ fontSize: 16 }} />}
                  sx={{ textTransform: 'none', color: '#111827', fontWeight: 600, fontSize: '0.8125rem', px: 1, py: 0.25, borderRadius: 1, '&:hover': { bgcolor: '#f3f4f6' } }}
                >
                  {density}
                </Button>
                <Menu anchorEl={densityAnchor} open={Boolean(densityAnchor)} onClose={() => setDensityAnchor(null)}>
                  {['Compact | 100%', 'Normal | 100%', 'Comfortable | 125%'].map((opt) => (
                    <MenuItem key={opt} selected={opt === density} onClick={() => { setDensity(opt); setDensityAnchor(null); }} sx={{ fontSize: '0.8rem', fontWeight: opt === density ? 700 : 500 }}>
                      {opt === density && <CheckIcon fontSize="small" sx={{ mr: 1, color: '#111827' }} />}
                      {opt}
                    </MenuItem>
                  ))}
                </Menu>

                <Divider orientation="vertical" flexItem sx={{ height: 16, my: 'auto' }} />

                <Tooltip title="Expand all rows">
                  <IconButton size="small" onClick={expandAll} sx={{ p: 0.5, color: '#6b7280' }}>
                    <ExpandAllIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Collapse all rows">
                  <IconButton size="small" onClick={collapseAll} sx={{ p: 0.5, color: '#6b7280' }}>
                    <CollapseAllIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title="Refresh"><IconButton size="small" sx={{ p: 0.5, color: '#4b5563' }}><RefreshIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title="Email"><IconButton size="small" sx={{ p: 0.5, color: '#4b5563' }}><EmailIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title="Print"><IconButton size="small" onClick={() => window.print()} sx={{ p: 0.5, color: '#4b5563' }}><PrintIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title="Export"><IconButton size="small" sx={{ p: 0.5, color: '#4b5563' }}><ExportIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <IconButton size="small" sx={{ p: 0.5, color: '#4b5563' }}><MoreVertIcon sx={{ fontSize: 17 }} /></IconButton>
              </Stack>
            </Stack>

            {/* Centered Document Title */}
            <Box sx={{ textAlign: 'center', mb: 2.5 }}>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#111827', letterSpacing: -0.2, fontSize: '1.2rem' }}>
                {currentCompanyName}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#4b5563', mt: 0.25 }}>
                {getDocumentSubtitle()}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, fontWeight: 500, display: 'block' }}>
                {getDocumentDateLabel()}
              </Typography>
            </Box>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* ── TAB 3: STATEMENT OF CASH FLOWS (Exact Image Implementation) ─── */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {currentTab === 3 && (
              <Box sx={{ width: '100%', overflowX: 'auto' }}>
                {/* Column Headers */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    py: 0.75,
                    borderTop: '1px solid #e5e7eb',
                    borderBottom: '2px solid #111827',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    color: '#374151'
                  }}
                >
                  <Box sx={{ flex: 1, pl: 0.5 }}>
                    <span>Account Name</span>
                  </Box>
                  <Box sx={{ width: 240, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, pr: 1 }}>
                    <SortIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                    <span>Total</span>
                  </Box>
                </Box>

                {/* Cash flows from operating activities Header */}
                <Box sx={{ mt: 0.5 }}>
                  <Box
                    onClick={() => toggleSectionCF('operating')}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      py: 0.45,
                      cursor: 'pointer',
                      bgcolor: openSectionsCF.operating ? '#f3f4f6' : 'transparent',
                      px: 0.5,
                      '&:hover': { bgcolor: '#f3f4f6' },
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      color: '#111827'
                    }}
                  >
                    {openSectionsCF.operating ? (
                      <CollapseIcon sx={{ fontSize: 16, mr: 0.5, color: '#6b7280' }} />
                    ) : (
                      <ExpandIcon sx={{ fontSize: 16, mr: 0.5, color: '#6b7280' }} />
                    )}
                    <span>Cash flows from operating activities</span>
                  </Box>

                  <Collapse in={openSectionsCF.operating}>
                    {/* Profit for the year */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 0.4,
                        pl: 4,
                        pr: 1,
                        fontSize: '0.8125rem',
                        color: '#374151',
                        '&:hover': { bgcolor: '#f9fafb' }
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <span>Profit for the year</span>
                      </Box>
                      <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}>
                        <FinancialValue val={cfData.profitForTheYear} />
                      </Box>
                    </Box>

                    {/* Adjustments for non-cash income and expenses Subfolder */}
                    <Box
                      onClick={() => toggleSectionCF('adjustments')}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        py: 0.4,
                        pl: 3,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#f9fafb' },
                        fontWeight: 500,
                        fontSize: '0.8125rem',
                        color: '#374151'
                      }}
                    >
                      {openSectionsCF.adjustments ? (
                        <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />
                      ) : (
                        <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />
                      )}
                      <span>Adjustments for non-cash income and expenses:</span>
                    </Box>

                    <Collapse in={openSectionsCF.adjustments}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563', '&:hover': { bgcolor: '#f9fafb' } }}>
                        <Box sx={{ flex: 1 }}><span>Accounts Payable</span></Box>
                        <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}><FinancialValue val={cfData.accountsPayable} /></Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563', '&:hover': { bgcolor: '#f9fafb' } }}>
                        <Box sx={{ flex: 1 }}><span>Accrued liabilities:EOBI Employees Contribution</span></Box>
                        <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}><FinancialValue val={cfData.eobiEmployeeContribution} /></Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563', '&:hover': { bgcolor: '#f9fafb' } }}>
                        <Box sx={{ flex: 1 }}><span>Accrued liabilities:EOBI Employer Contribution</span></Box>
                        <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}><FinancialValue val={cfData.eobiEmployerContribution} /></Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563', '&:hover': { bgcolor: '#f9fafb' } }}>
                        <Box sx={{ flex: 1 }}><span>Accrued liabilities:WHT Employees Salary</span></Box>
                        <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}><FinancialValue val={cfData.whtEmployeeSalary} /></Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563', '&:hover': { bgcolor: '#f9fafb' } }}>
                        <Box sx={{ flex: 1 }}><span>Payable To Related Parties:Sardar Group of Companies</span></Box>
                        <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}><FinancialValue val={cfData.sardarGroupPayable} /></Box>
                      </Box>
                    </Collapse>

                    {/* Total for Adjustments for non-cash income and expenses */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        py: 0.5,
                        pl: 5,
                        pr: 1,
                        borderTop: '1px solid #f3f4f6',
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                        color: '#111827'
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <span>Total for Adjustments for non-cash income and expenses:</span>
                      </Box>
                      <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}>
                        <FinancialValue val={cfData.totalAdjustments} showCurrency isTotal />
                      </Box>
                    </Box>

                    {/* Net cash from operating activities */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        py: 0.65,
                        pl: 4,
                        pr: 1,
                        borderTop: '1px solid #e5e7eb',
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                        color: '#111827'
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <span>Net cash from operating activities</span>
                      </Box>
                      <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}>
                        <FinancialValue val={cfData.netCashOperatingActivities} showCurrency isTotal />
                      </Box>
                    </Box>
                  </Collapse>
                </Box>

                {/* NET INCREASE (DECREASE) IN CASH AND CASH EQUIVALENTS */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 0.65,
                    px: 0.5,
                    mt: 0.5,
                    borderTop: '1px solid #111827',
                    borderBottom: '1px solid #111827',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    color: '#111827'
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <span>NET INCREASE (DECREASE) IN CASH AND CASH EQUIVALENTS</span>
                  </Box>
                  <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}>
                    <FinancialValue val={cfData.netIncreaseDecreaseCash} showCurrency isTotal />
                  </Box>
                </Box>

                {/* Cash and cash equivalents at beginning of year */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 0.6,
                    px: 0.5,
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '0.8125rem',
                    color: '#374151'
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <span>Cash and cash equivalents at beginning of year</span>
                  </Box>
                  <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}>
                    <FinancialValue val={cfData.cashBeginningOfYear} showCurrency />
                  </Box>
                </Box>

                {/* CASH AND CASH EQUIVALENTS AT END OF YEAR */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 0.75,
                    px: 0.5,
                    borderBottom: '3px double #111827',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    color: '#111827'
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <span>CASH AND CASH EQUIVALENTS AT END OF YEAR</span>
                  </Box>
                  <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}>
                    <FinancialValue val={cfData.cashEndOfYear} showCurrency isGrandTotal />
                  </Box>
                </Box>
              </Box>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* ── TAB 2: STATEMENT OF CHANGES IN EQUITY ────────────────────────── */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {currentTab === 2 && (
              <Box sx={{ width: '100%', overflowX: 'auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderTop: '1px solid #e5e7eb', borderBottom: '2px solid #111827', fontWeight: 700, fontSize: '0.8125rem', color: '#374151' }}>
                  <Box sx={{ flex: 1, pl: 0.5 }}><span>Account</span></Box>
                  <Box sx={{ width: 240, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, pr: 1 }}>
                    <SortIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                    <span>Total</span>
                  </Box>
                </Box>

                <Box sx={{ py: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.45, pl: 3.5, pr: 1, fontSize: '0.8125rem', color: '#374151', '&:hover': { bgcolor: '#f9fafb' } }}>
                    <Box sx={{ flex: 1 }}><span>Retained Earnings</span></Box>
                    <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}><FinancialValue val={equityData.retainedEarnings} /></Box>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.45, pl: 3.5, pr: 1, fontSize: '0.8125rem', color: '#374151', '&:hover': { bgcolor: '#f9fafb' } }}>
                    <Box sx={{ flex: 1 }}><span>Share capital</span></Box>
                    <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}><FinancialValue val={equityData.shareCapital} /></Box>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, px: 0.5, mt: 0.5, borderTop: '1px solid #111827', borderBottom: '3px double #111827', fontWeight: 800, fontSize: '0.85rem', color: '#111827' }}>
                  <Box sx={{ flex: 1 }}><span>TOTAL</span></Box>
                  <Box sx={{ width: 240, textAlign: 'right', pr: 1 }}><FinancialValue val={equityData.totalEquity} showCurrency isGrandTotal /></Box>
                </Box>
              </Box>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* ── TAB 1: BALANCE SHEET VIEW ────────────────────────────────────── */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {currentTab === 1 && (
              <Box sx={{ width: '100%', overflowX: 'auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '2px solid #111827', fontWeight: 700, fontSize: '0.8125rem', color: '#374151' }}>
                  <Box sx={{ flex: 1 }}></Box>
                  <Box sx={{ width: 220, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, pr: 1 }}>
                    <SortIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                    <span>Total</span>
                  </Box>
                </Box>

                {/* Assets */}
                <Box sx={{ mt: 0.5 }}>
                  <Box onClick={() => toggleSectionBS('assets')} sx={{ display: 'flex', alignItems: 'center', py: 0.45, cursor: 'pointer', bgcolor: openSectionsBS.assets ? '#f3f4f6' : 'transparent', px: 0.5, fontWeight: 600, fontSize: '0.8125rem', color: '#111827' }}>
                    {openSectionsBS.assets ? <CollapseIcon sx={{ fontSize: 16, mr: 0.5, color: '#6b7280' }} /> : <ExpandIcon sx={{ fontSize: 16, mr: 0.5, color: '#6b7280' }} />}
                    <span>Assets</span>
                  </Box>

                  <Collapse in={openSectionsBS.assets}>
                    <Box onClick={() => toggleSectionBS('currentAssets')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 2.5, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                      {openSectionsBS.currentAssets ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                      <span>Current Assets</span>
                    </Box>

                    <Collapse in={openSectionsBS.currentAssets}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                        <Box sx={{ flex: 1 }}><span>Advance Tax Recoverable</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.advanceTax} /></Box>
                      </Box>

                      <Box onClick={() => toggleSectionBS('cashEquivalents')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 4, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                        {openSectionsBS.cashEquivalents ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                        <span>Cash and cash equivalents</span>
                      </Box>

                      <Collapse in={openSectionsBS.cashEquivalents}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>ABL-CHC-0019</span></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.ablBank} /></Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>Bank Islami-CHC-0001</span></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.bankIslami} /></Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>Cash on Hand</span></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.cashOnHand} /></Box>
                        </Box>
                      </Collapse>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 5, pr: 1, borderTop: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Cash and cash equivalents</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalCashEquivalents} showCurrency isTotal /></Box>
                      </Box>

                      <Box onClick={() => toggleSectionBS('employeeAdvances')} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.35, pl: 4, pr: 1, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {openSectionsBS.employeeAdvances ? <CollapseIcon sx={{ fontSize: 15, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, color: '#9ca3af' }} />}
                          <span>Employee Advances</span>
                        </Stack>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={240000} showCurrency /></Box>
                      </Box>

                      <Collapse in={openSectionsBS.employeeAdvances}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>Advance Against Salary</span></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.advanceAgainstSalary} /></Box>
                        </Box>
                      </Collapse>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 5, pr: 1, borderTop: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Employee Advances</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalEmployeeAdvances} showCurrency isTotal /></Box>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 4, pr: 1, borderTop: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Current Assets</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalCurrentAssets} showCurrency isTotal /></Box>
                      </Box>
                    </Collapse>

                    <Box onClick={() => toggleSectionBS('longTermAssets')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 2.5, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                      {openSectionsBS.longTermAssets ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                      <span>Long-term assets</span>
                    </Box>

                    <Collapse in={openSectionsBS.longTermAssets}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                        <Box sx={{ flex: 1 }}><span>Accumulated depreciation on PP&E</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.accDepreciationPPE} /></Box>
                      </Box>

                      <Box onClick={() => toggleSectionBS('ppe')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 4, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                        {openSectionsBS.ppe ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                        <span>Property, plant and equipment</span>
                      </Box>

                      <Collapse in={openSectionsBS.ppe}>
                        {[
                          { name: 'Computer & Ancillary Equipment', val: bsData.computerEquipment },
                          { name: 'Electrical Item', val: bsData.electricalItem },
                          { name: 'Furniture & Fixtures', val: bsData.furnitureFixtures },
                          { name: 'Library Books', val: bsData.libraryBooks },
                          { name: 'Solar System', val: bsData.solarSystem }
                        ].map((row, idx) => (
                          <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                            <Box sx={{ flex: 1 }}><span>{row.name}</span></Box>
                            <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={row.val} /></Box>
                          </Box>
                        ))}
                      </Collapse>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 5, pr: 1, borderTop: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Property, plant and equipment</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalPPE} showCurrency isTotal /></Box>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                        <Box sx={{ flex: 1 }}><span>Security Deposit</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.securityDeposit} /></Box>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 4, pr: 1, borderTop: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Long-term assets</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalLongTermAssets} showCurrency isTotal /></Box>
                      </Box>
                    </Collapse>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.65, pl: 2.5, pr: 1, borderTop: '1px solid #111827', borderBottom: '1px solid #111827', fontWeight: 800, fontSize: '0.85rem', color: '#111827' }}>
                      <Box sx={{ flex: 1 }}><span>Total for Assets</span></Box>
                      <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalAssets} showCurrency isGrandTotal /></Box>
                    </Box>
                  </Collapse>
                </Box>

                {/* Liabilities & Equity */}
                <Box sx={{ mt: 1 }}>
                  <Box onClick={() => toggleSectionBS('liabilitiesAndEquity')} sx={{ display: 'flex', alignItems: 'center', py: 0.45, cursor: 'pointer', bgcolor: openSectionsBS.liabilitiesAndEquity ? '#f3f4f6' : 'transparent', px: 0.5, fontWeight: 600, fontSize: '0.8125rem', color: '#111827' }}>
                    {openSectionsBS.liabilitiesAndEquity ? <CollapseIcon sx={{ fontSize: 16, mr: 0.5, color: '#6b7280' }} /> : <ExpandIcon sx={{ fontSize: 16, mr: 0.5, color: '#6b7280' }} />}
                    <span>Liabilities and Shareholder's Equity</span>
                  </Box>

                  <Collapse in={openSectionsBS.liabilitiesAndEquity}>
                    <Box onClick={() => toggleSectionBS('currentLiabilities')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 2.5, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                      {openSectionsBS.currentLiabilities ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                      <span>Current Liabilities</span>
                    </Box>

                    <Collapse in={openSectionsBS.currentLiabilities}>
                      <Box onClick={() => toggleSectionBS('accountsPayable')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 4, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                        {openSectionsBS.accountsPayable ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                        <span>Accounts Payable</span>
                      </Box>

                      <Collapse in={openSectionsBS.accountsPayable}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}><span>Accounts Payable</span><InsightsIcon sx={{ fontSize: 13, color: '#2563eb', opacity: 0.85 }} /></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.accountsPayable} /></Box>
                        </Box>
                      </Collapse>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 5, pr: 1, borderTop: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Accounts Payable</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalAccountsPayable} showCurrency isTotal /></Box>
                      </Box>

                      <Box onClick={() => toggleSectionBS('accruedLiabilities')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 4, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                        {openSectionsBS.accruedLiabilities ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                        <span>Accrued liabilities</span>
                      </Box>

                      <Collapse in={openSectionsBS.accruedLiabilities}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>EOBI Employees Contribution</span></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.eobiEmployeeContribution} /></Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>EOBI Employer Contribution</span></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.eobiEmployerContribution} /></Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>WHT Employees Salary</span></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.whtEmployeeSalary} /></Box>
                        </Box>
                      </Collapse>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 5, pr: 1, borderTop: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Accrued liabilities</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalAccruedLiabilities} showCurrency isTotal /></Box>
                      </Box>

                      <Box onClick={() => toggleSectionBS('incomeTaxPayable')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 4, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                        {openSectionsBS.incomeTaxPayable ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                        <span>Income tax payable</span>
                      </Box>

                      <Collapse in={openSectionsBS.incomeTaxPayable}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>WHT- Supplies - 5.5%</span></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.whtSupplies} /></Box>
                        </Box>
                      </Collapse>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 5, pr: 1, borderTop: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Income tax payable</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalIncomeTaxPayable} showCurrency isTotal /></Box>
                      </Box>

                      <Box onClick={() => toggleSectionBS('payableRelatedParties')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 4, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                        {openSectionsBS.payableRelatedParties ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                        <span>Payable To Related Parties</span>
                      </Box>

                      <Collapse in={openSectionsBS.payableRelatedParties}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>Sardar Group of Companies</span></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.sardarGroupPayable} /></Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 6.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>Taj Residencia</span></Box>
                          <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.tajResidenciaPayable} /></Box>
                        </Box>
                      </Collapse>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 5, pr: 1, borderTop: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Payable To Related Parties</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalPayableRelatedParties} showCurrency isTotal /></Box>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 4, pr: 1, borderTop: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Current Liabilities</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalCurrentLiabilities} showCurrency isTotal /></Box>
                      </Box>
                    </Collapse>

                    <Box onClick={() => toggleSectionBS('shareholdersEquity')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 2.5, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                      {openSectionsBS.shareholdersEquity ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                      <span>Shareholders' equity</span>
                    </Box>

                    <Collapse in={openSectionsBS.shareholdersEquity}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                        <Box sx={{ flex: 1 }}><span>Share capital</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.shareCapital} /></Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                        <Box sx={{ flex: 1 }}><span>Retained Earnings</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.retainedEarnings} /></Box>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, pl: 5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                        <Box sx={{ flex: 1 }}><span>Net Income</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.netIncome} /></Box>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 4, pr: 1, borderTop: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Shareholders' equity</span></Box>
                        <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalShareholdersEquity} showCurrency isTotal /></Box>
                      </Box>
                    </Collapse>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.65, pl: 2.5, pr: 1, borderTop: '1px solid #111827', borderBottom: '3px double #111827', fontWeight: 800, fontSize: '0.85rem', color: '#111827' }}>
                      <Box sx={{ flex: 1 }}><span>Total for Liabilities and Shareholder's Equity</span></Box>
                      <Box sx={{ width: 220, textAlign: 'right', pr: 1 }}><FinancialValue val={bsData.totalLiabilitiesAndEquity} showCurrency isGrandTotal /></Box>
                    </Box>
                  </Collapse>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, pt: 1.5, borderTop: '1px solid #f1f5f9', fontSize: '0.72rem', color: '#64748b' }}>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ cursor: 'pointer' }}>
                    <NoteAddIcon sx={{ fontSize: 15 }} />
                    <span>Add note</span>
                  </Stack>
                  <Box><span>{accountingBasis} basis | Tuesday, August 18, 2026 05:29 PM GMT+05:00</span></Box>
                </Box>
              </Box>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* ── TAB 0: PROFIT & LOSS VIEW ────────────────────────────────────── */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {currentTab === 0 && (
              <Box sx={{ width: '100%', overflowX: 'auto' }}>
                {isComparative && (
                  <Box sx={{ display: 'flex', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                    <Box sx={{ flex: 1 }}></Box>
                    <Box sx={{ width: 320, textAlign: 'center', py: 0.5, fontWeight: 700, fontSize: '0.75rem', color: '#111827', letterSpacing: 0.5 }}>
                      TOTAL
                    </Box>
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '2px solid #111827', fontWeight: 700, fontSize: '0.8125rem', color: '#374151' }}>
                  <Box sx={{ flex: 1 }}></Box>
                  <Box sx={{ width: 320, display: 'flex' }}>
                    <Box sx={{ width: 160, textAlign: 'right', pr: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      <SortIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                      <span>{primaryPeriodHeader}</span>
                    </Box>
                    {isComparative && (
                      <Box sx={{ width: 160, textAlign: 'right', pr: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <span>{comparePeriodHeader}</span>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Income */}
                <Box sx={{ mt: 0.5 }}>
                  <Box onClick={() => toggleSectionPL('income')} sx={{ display: 'flex', alignItems: 'center', py: 0.45, cursor: 'pointer', bgcolor: openSectionsPL.income ? '#f3f4f6' : 'transparent', px: 0.5, fontWeight: 600, fontSize: '0.8125rem', color: '#111827' }}>
                    {openSectionsPL.income ? <CollapseIcon sx={{ fontSize: 16, mr: 0.5, color: '#6b7280' }} /> : <ExpandIcon sx={{ fontSize: 16, mr: 0.5, color: '#6b7280' }} />}
                    <span>Income</span>
                  </Box>

                  <Collapse in={openSectionsPL.income}>
                    <Box onClick={() => toggleSectionPL('sales')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 2.5, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                      {openSectionsPL.sales ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                      <span>Sales</span>
                    </Box>

                    <Collapse in={openSectionsPL.sales}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.35, pl: 5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                        <Box sx={{ flex: 1 }}><span>Fee Collection - Students</span></Box>
                        <Box sx={{ width: 320, display: 'flex' }}>
                          <Box sx={{ width: 160, textAlign: 'right', pr: 2 }}><FinancialValue val={plData.p1.fee} /></Box>
                          {isComparative && <Box sx={{ width: 160, textAlign: 'right', pr: 1 }}><FinancialValue val={plData.p2.fee} /></Box>}
                        </Box>
                      </Box>
                    </Collapse>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, pl: 4, pr: 1, borderTop: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                      <Box sx={{ flex: 1 }}><span>Total for Sales</span></Box>
                      <Box sx={{ width: 320, display: 'flex' }}>
                        <Box sx={{ width: 160, textAlign: 'right', pr: 2 }}><FinancialValue val={plData.p1.sales} showCurrency isTotal /></Box>
                        {isComparative && <Box sx={{ width: 160, textAlign: 'right', pr: 1 }}><FinancialValue val={plData.p2.sales} showCurrency isTotal /></Box>}
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, pl: 2.5, pr: 1, borderTop: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                      <Box sx={{ flex: 1 }}><span>Total for Income</span></Box>
                      <Box sx={{ width: 320, display: 'flex' }}>
                        <Box sx={{ width: 160, textAlign: 'right', pr: 2 }}><FinancialValue val={plData.p1.income} showCurrency isTotal /></Box>
                        {isComparative && <Box sx={{ width: 160, textAlign: 'right', pr: 1 }}><FinancialValue val={plData.p2.income} showCurrency isTotal /></Box>}
                      </Box>
                    </Box>
                  </Collapse>
                </Box>

                {/* Gross Profit */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.65, px: 0.5, my: 0.25, borderTop: '1px solid #111827', borderBottom: '1px solid #111827', fontWeight: 700, fontSize: '0.85rem', color: '#111827' }}>
                  <Box sx={{ flex: 1 }}><span>Gross Profit</span></Box>
                  <Box sx={{ width: 320, display: 'flex' }}>
                    <Box sx={{ width: 160, textAlign: 'right', pr: 2 }}><FinancialValue val={plData.p1.grossProfit} showCurrency isTotal /></Box>
                    {isComparative && <Box sx={{ width: 160, textAlign: 'right', pr: 1 }}><FinancialValue val={plData.p2.grossProfit} showCurrency isTotal /></Box>}
                  </Box>
                </Box>

                {/* Expenses */}
                <Box sx={{ mt: 0.5 }}>
                  <Box onClick={() => toggleSectionPL('expenses')} sx={{ display: 'flex', alignItems: 'center', py: 0.45, cursor: 'pointer', bgcolor: openSectionsPL.expenses ? '#f3f4f6' : 'transparent', px: 0.5, fontWeight: 600, fontSize: '0.8125rem', color: '#111827' }}>
                    {openSectionsPL.expenses ? <CollapseIcon sx={{ fontSize: 16, mr: 0.5, color: '#6b7280' }} /> : <ExpandIcon sx={{ fontSize: 16, mr: 0.5, color: '#6b7280' }} />}
                    <span>Expenses</span>
                  </Box>

                  <Collapse in={openSectionsPL.expenses}>
                    {[
                      { name: 'Bank charges', val1: plData.p1.bankCharges, val2: plData.p2.bankCharges },
                      { name: 'Dues and subscriptions', val1: plData.p1.dues, val2: plData.p2.dues },
                      { name: 'EOBI Expense', val1: plData.p1.eobi, val2: plData.p2.eobi },
                      { name: 'Meals and entertainment', val1: plData.p1.meals, val2: plData.p2.meals },
                      { name: 'Other general and administrative expenses', val1: plData.p1.otherAdmin, val2: plData.p2.otherAdmin },
                      { name: 'Payroll Expenses', val1: plData.p1.payroll, val2: plData.p2.payroll },
                      { name: 'Rent or lease payments', val1: plData.p1.rent, val2: plData.p2.rent },
                      { name: 'Repairs and Maintenance', val1: plData.p1.repairs, val2: plData.p2.repairs }
                    ].map((row, idx) => (
                      <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.35, pl: 3.5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                        <Box sx={{ flex: 1 }}><span>{row.name}</span></Box>
                        <Box sx={{ width: 320, display: 'flex' }}>
                          <Box sx={{ width: 160, textAlign: 'right', pr: 2 }}><FinancialValue val={row.val1} /></Box>
                          {isComparative && <Box sx={{ width: 160, textAlign: 'right', pr: 1 }}><FinancialValue val={row.val2} /></Box>}
                        </Box>
                      </Box>
                    ))}

                    {/* Utilities */}
                    <Box onClick={() => toggleSectionPL('utilities')} sx={{ display: 'flex', alignItems: 'center', py: 0.35, pl: 2.5, cursor: 'pointer', fontWeight: 500, fontSize: '0.8125rem', color: '#374151' }}>
                      {openSectionsPL.utilities ? <CollapseIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} /> : <ExpandIcon sx={{ fontSize: 15, mr: 0.5, color: '#9ca3af' }} />}
                      <span>Utilities</span>
                    </Box>

                    <Collapse in={openSectionsPL.utilities}>
                      {[
                        { name: 'Electricity Charges', val1: plData.p1.electricity, val2: plData.p2.electricity },
                        { name: 'Gas Charges', val1: plData.p1.gas, val2: plData.p2.gas },
                        { name: 'Internet Charges', val1: plData.p1.internet, val2: plData.p2.internet },
                        { name: 'Water Charges', val1: plData.p1.water, val2: plData.p2.water }
                      ].map((u, i) => (
                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.35, pl: 5, pr: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                          <Box sx={{ flex: 1 }}><span>{u.name}</span></Box>
                          <Box sx={{ width: 320, display: 'flex' }}>
                            <Box sx={{ width: 160, textAlign: 'right', pr: 2 }}><FinancialValue val={u.val1} /></Box>
                            {isComparative && <Box sx={{ width: 160, textAlign: 'right', pr: 1 }}><FinancialValue val={u.val2} /></Box>}
                          </Box>
                        </Box>
                      ))}

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, pl: 4, pr: 1, borderTop: '1px solid #f3f4f6', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                        <Box sx={{ flex: 1 }}><span>Total for Utilities</span></Box>
                        <Box sx={{ width: 320, display: 'flex' }}>
                          <Box sx={{ width: 160, textAlign: 'right', pr: 2 }}><FinancialValue val={plData.p1.utilities} showCurrency isTotal /></Box>
                          {isComparative && <Box sx={{ width: 160, textAlign: 'right', pr: 1 }}><FinancialValue val={plData.p2.utilities} showCurrency isTotal /></Box>}
                        </Box>
                      </Box>
                    </Collapse>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.6, pl: 2.5, pr: 1, borderTop: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>
                      <Box sx={{ flex: 1 }}><span>Total for Expenses</span></Box>
                      <Box sx={{ width: 320, display: 'flex' }}>
                        <Box sx={{ width: 160, textAlign: 'right', pr: 2 }}><FinancialValue val={plData.p1.expenses} showCurrency isTotal /></Box>
                        {isComparative && <Box sx={{ width: 160, textAlign: 'right', pr: 1 }}><FinancialValue val={plData.p2.expenses} showCurrency isTotal /></Box>}
                      </Box>
                    </Box>
                  </Collapse>
                </Box>

                {/* Net Earnings */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, px: 0.5, mt: 0.5, bgcolor: '#f3f4f6', borderTop: '1px solid #111827', borderBottom: '3px double #111827', fontWeight: 800, fontSize: '0.875rem', color: '#111827' }}>
                  <Box sx={{ flex: 1 }}><span>Net Earnings</span></Box>
                  <Box sx={{ width: 320, display: 'flex' }}>
                    <Box sx={{ width: 160, textAlign: 'right', pr: 2 }}><FinancialValue val={plData.p1.net} showCurrency isGrandTotal /></Box>
                    {isComparative && <Box sx={{ width: 160, textAlign: 'right', pr: 1 }}><FinancialValue val={plData.p2.net} showCurrency isGrandTotal /></Box>}
                  </Box>
                </Box>
              </Box>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* ── TAB 4: TRIAL BALANCE PLACEHOLDER ─────────────────────────────── */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {currentTab === 4 && (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
                  {activeTab.label} View
                </Typography>
                <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                  Statement template ready. Data will populate dynamically upon connecting external API.
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default Legacy;
