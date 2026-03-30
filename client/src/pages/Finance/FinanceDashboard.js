import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Grid, Stack, Chip, Paper,
  CircularProgress, Divider, IconButton, Tooltip, List,
  ListItem, ListItemText, ListItemIcon, Card, CardContent,
  alpha, useTheme, Menu, MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  CheckCircle as OkIcon,
  Warning as WarnIcon,
  FiberManualRecord as DotIcon,
  AccountBalance as BankIconMui,
  Percent as PctIcon,
  CalendarMonth as CalIcon,
  BarChart as BarChartIcon,
  Inventory as InvIcon,
  Assessment as ReportIcon,
  CorporateFare as AssetIcon,
  ArrowForward as GoIcon,
  TrendingUp as ARIcon,
  ShoppingCart as APIcon,
  Receipt as BillIcon,
  Settings as SettingsIcon,
  ArrowDropDown as DropIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import api from '../../services/api';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ─── Custom recharts tooltip ──────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={3} sx={{ px: 1.5, py: 1, borderRadius: 1.5 }}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={700}>PKR {fmt(payload[0].value)}</Typography>
    </Paper>
  );
};

// ─── Aging bar chart ──────────────────────────────────────────────────────────
const AgingBars = ({ data, barColor, overdueColor }) => {
  const theme = useTheme();
  if (!data || data.every(d => d.value === 0)) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height={150}>
        <Typography variant="body2" color="text.secondary">No outstanding items</Typography>
      </Box>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: -18, bottom: 0 }} barSize={30}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
        />
        <RTooltip content={<ChartTooltip />} cursor={{ fill: alpha(barColor, 0.06) }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                entry.value === 0
                  ? alpha(barColor, 0.15)
                  : entry.overdue
                  ? overdueColor
                  : barColor
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ─── Panel card — Odoo layout with our MUI theme ─────────────────────────────
const Panel = ({ title, subtitle, headerAction, accentColor, children }) => {
  const theme = useTheme();
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 2,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: theme.shadows[3] },
      }}
    >
      {/* Coloured top stripe */}
      <Box sx={{ height: 4, bgcolor: accentColor, borderRadius: '8px 8px 0 0' }} />

      <CardContent sx={{ pb: '16px !important', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color={accentColor}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
            )}
          </Box>
          {headerAction}
        </Stack>

        {/* Body */}
        <Box flex={1}>{children}</Box>
      </CardContent>
    </Card>
  );
};

// ─── Stat block ───────────────────────────────────────────────────────────────
const Stat = ({ label, value, color }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
    <Typography variant="h6" fontWeight={800} color={color} lineHeight={1.1}>
      PKR {fmt(value)}
    </Typography>
  </Box>
);

// ─── Main component ───────────────────────────────────────────────────────────
export default function FinanceDashboard() {
  const navigate = useNavigate();
  const theme    = useTheme();

  // Section card dropdown menu state
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuSection, setMenuSection] = useState(null); // holds the section object

  const openMenu = (e, section) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuSection(section);
  };
  const closeMenu = () => { setMenuAnchor(null); setMenuSection(null); };

  const [arData,   setArData]   = useState(null);
  const [apData,   setApData]   = useState(null);
  const [bankData, setBankData] = useState(null);
  const [taxes,    setTaxes]    = useState([]);
  const [period,   setPeriod]   = useState(null);
  const [tlData,   setTlData]   = useState(null);
  const [loading,  setLoading]  = useState(true);

  const today = new Date().toISOString().split('T')[0];

  const loadAll = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.get('/finance/reports/aged-receivables',    { params: { asOfDate: today } }),
      api.get('/finance/reports/aged-payables',       { params: { asOfDate: today } }),
      api.get('/finance/reports/bank-reconciliation', { params: { asOfDate: today } }),
      api.get('/finance/taxes', { params: { active: true } }),
      api.get('/finance/fiscal-periods'),
      api.get('/finance/reports/trial-balance-v2',    { params: { asOfDate: today } }),
    ]);
    if (results[0].status === 'fulfilled') setArData(results[0].value.data.data);
    if (results[1].status === 'fulfilled') setApData(results[1].value.data.data);
    if (results[2].status === 'fulfilled') setBankData(results[2].value.data.data);
    if (results[3].status === 'fulfilled') setTaxes(results[3].value.data.data || []);
    if (results[4].status === 'fulfilled') {
      const periods = results[4].value.data.data || [];
      const now = new Date();
      setPeriod(
        periods.find(p => p.status === 'open' && new Date(p.startDate) <= now && new Date(p.endDate) >= now)
        || periods.find(p => p.status === 'open') || null
      );
    }
    if (results[5].status === 'fulfilled') setTlData(results[5].value.data.data);
    setLoading(false);
  }, [today]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Build chart data (same structure for both AR and AP) ──────────────────
  const makeChart = (b) => b ? [
    { label: 'Due',       value: b.over90    || 0, overdue: true  },
    { label: '1–30 Days', value: b.days1_30  || 0, overdue: false },
    { label: '31–60 D',   value: b.days31_60 || 0, overdue: true  },
    { label: '61–90 D',   value: b.days61_90 || 0, overdue: true  },
    { label: 'Not Due',   value: b.current   || 0, overdue: false },
  ] : [];

  const arChart = makeChart(arData?.buckets);
  const apChart = makeChart(apData?.buckets);

  const arTotal    = arChart.reduce((s, d) => s + d.value, 0);
  const apTotal    = apChart.reduce((s, d) => s + d.value, 0);
  const arOverdue  = (arData?.buckets?.days31_60 || 0) + (arData?.buckets?.days61_90 || 0) + (arData?.buckets?.over90 || 0);
  const apOverdue  = (apData?.buckets?.days31_60 || 0) + (apData?.buckets?.days61_90 || 0) + (apData?.buckets?.over90 || 0);

  const isBalanced = tlData?.totals?.isBalanced;
  const isReconc   = Math.abs(bankData?.difference || 0) < 0.01;
  const unrecCount = bankData?.unreconciledCount || 0;

  const gstTaxes   = taxes.filter(t => t.taxType === 'gst');
  const whtTaxes   = taxes.filter(t => t.taxType === 'wht');

  // Theme colours — use primary for AR, warning/amber for AP
  const arColor  = theme.palette.success.main;
  const apColor  = theme.palette.warning.dark;
  const redColor = theme.palette.error.main;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'grey.50', minHeight: '100vh' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>
            Finance Dashboard
          </Typography>
          <Stack direction="row" alignItems="center" gap={1} mt={0.5}>
            <Typography variant="body2" color="text.secondary">
              {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
            {period && (
              <Chip
                icon={<CalIcon sx={{ fontSize: '13px !important' }} />}
                label={period.name}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {isBalanced !== undefined && (
              <Chip
                icon={isBalanced
                  ? <OkIcon sx={{ fontSize: '13px !important' }} />
                  : <WarnIcon sx={{ fontSize: '13px !important' }} />}
                label={isBalanced ? 'Books Balanced' : 'Imbalance!'}
                size="small"
                color={isBalanced ? 'success' : 'error'}
                variant={isBalanced ? 'outlined' : 'filled'}
              />
            )}
          </Stack>
        </Box>
        <Tooltip title="Refresh all data">
          <IconButton onClick={loadAll} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ── Section Navigation (Odoo-style top nav as cards with dropdown) ── */}
      {(() => {
        const sections = [
          {
            label: 'Customers',
            icon: <ARIcon />,
            color: '#2e7d32',
            bg: '#e8f5e9',
            path: '/finance/accounts-receivable',
            sub: [
              { label: 'AR Invoices',         path: '/finance/accounts-receivable' },
              { label: 'Credit Notes',         path: '/finance/credit-notes'        },
              { label: 'Customer Payments',    path: '/finance/customer-payments'   },
              { label: 'Customer Statements',  path: '/finance/customer-statement'  },
              { label: 'Aged Receivables',     path: '/finance/aged-receivables'    },
            ],
          },
          {
            label: 'Vendors',
            icon: <APIcon />,
            color: '#c62828',
            bg: '#ffebee',
            path: '/finance/accounts-payable',
            sub: [
              { label: 'Vendor Bills',         path: '/finance/accounts-payable'    },
              { label: 'Batch Payment',         path: '/finance/batch-payment'       },
              { label: 'Vendor Payments',       path: '/finance/vendor-payments'     },
              { label: 'Vendor Refunds',        path: '/finance/vendor-refunds'      },
              { label: 'Bill to Receive',       path: '/finance/bill-to-receive'     },
              { label: 'Billed Not Received',   path: '/finance/billed-not-received' },
              { label: 'Vendor Statements',     path: '/finance/vendor-statement'    },
              { label: 'Aged Payables',         path: '/finance/aged-payables'       },
              { label: 'Payment Terms',         path: '/finance/payment-terms'       },
            ],
          },
          {
            label: 'Accounting',
            icon: <BankIconMui />,
            color: '#1565c0',
            bg: '#e3f2fd',
            path: '/finance/journal-entries',
            sub: [
              { label: 'Journal Entries',       path: '/finance/journal-entries'        },
              { label: 'Recurring Journals',   path: '/finance/recurring-journals'    },
              { label: 'Deferred Entries',     path: '/finance/deferred-entries'      },
              { label: 'General Ledger',       path: '/finance/general-ledger'        },
              { label: 'Banking',              path: '/finance/banking'               },
              { label: 'Bank Statement Import',path: '/finance/bank-statement-import' },
              { label: 'Bank Reconciliation',  path: '/finance/bank-reconciliation'   },
              { label: 'Opening Balances',    path: '/finance/opening-balances'    },
              { label: 'Year-End Closing',    path: '/finance/year-end-closing'    },
            ],
          },
          {
            label: 'Review',
            icon: <InvIcon />,
            color: '#6a1b9a',
            bg: '#f3e5f5',
            path: '/finance/inventory-valuation',
            sub: [
              { label: 'Inventory Valuation', path: '/finance/inventory-valuation' },
              { label: 'Fixed Assets',        path: '/finance/fixed-assets'        },
              { label: 'Budgets',             path: '/finance/budgets'             },
              { label: 'Budget vs Actual',    path: '/finance/budget-vs-actual'    },
            ],
          },
          {
            label: 'Reporting',
            icon: <ReportIcon />,
            color: '#e65100',
            bg: '#fff3e0',
            path: '/finance/balance-sheet',
            sub: [
              { label: 'Balance Sheet',       path: '/finance/balance-sheet'    },
              { label: 'Profit & Loss',       path: '/finance/profit-loss'      },
              { label: 'Comparative P&L',     path: '/finance/comparative-pl'   },
              { label: 'Cost Center P&L',     path: '/finance/cost-center-pl'   },
              { label: 'Cash Flow',           path: '/finance/cash-flow'        },
              { label: 'Trial Balance',       path: '/finance/trial-balance'    },
              { label: 'Tax Summary (FBR)',   path: '/finance/tax-summary'      },
            ],
          },
          {
            label: 'Configuration',
            icon: <SettingsIcon />,
            color: '#37474f',
            bg: '#eceff1',
            path: '/finance/accounts',
            sub: [
              { label: 'Chart of Accounts',   path: '/finance/accounts'             },
              { label: 'Tax Management',      path: '/finance/taxes'                },
              { label: 'Finance Journals',    path: '/finance/journals'             },
              { label: 'Fiscal Periods',      path: '/finance/fiscal-periods'       },
              { label: 'Inventory Categories',path: '/finance/inventory-categories' },
              { label: 'Company Profile',     path: '/finance/company-profile'      },
            ],
          },
        ];
        return (
          <>
            <Grid container spacing={1.5} mb={3}>
              {sections.map(s => (
                <Grid item xs={6} sm={4} md={2} key={s.label}>
                  <Paper
                    variant="outlined"
                    onClick={() => navigate(s.path)}
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderRadius: 2,
                      borderColor: 'divider',
                      bgcolor: s.bg,
                      transition: 'all 0.18s',
                      '&:hover': {
                        boxShadow: theme.shadows[4],
                        transform: 'translateY(-2px)',
                        borderColor: s.color,
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 0.5,
                      height: '100%',
                      minHeight: 96,
                      position: 'relative',
                    }}
                  >
                    {/* Header row with icon, label, dropdown trigger */}
                    <Box sx={{ color: s.color, display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
                      {s.icon}
                      <Typography variant="subtitle2" fontWeight={800} color={s.color} noWrap sx={{ flex: 1 }}>
                        {s.label}
                      </Typography>
                      <Tooltip title="Quick navigate">
                        <IconButton
                          size="small"
                          onClick={(e) => openMenu(e, s)}
                          sx={{
                            p: 0.2,
                            color: s.color,
                            '&:hover': { bgcolor: alpha(s.color, 0.12) },
                          }}
                        >
                          <DropIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Divider sx={{ width: '100%', borderColor: alpha(s.color, 0.2) }} />
                    {s.sub.slice(0, 3).map(item => (
                      <Typography
                        key={item.label}
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          lineHeight: 1.4,
                          '&:hover': { color: s.color, textDecoration: 'underline' },
                          cursor: 'pointer',
                        }}
                        onClick={(e) => { e.stopPropagation(); navigate(item.path); }}
                      >
                        · {item.label}
                      </Typography>
                    ))}
                    {s.sub.length > 3 && (
                      <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.4 }}>
                        +{s.sub.length - 3} more…
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Shared dropdown menu for all section cards */}
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={closeMenu}
              PaperProps={{ elevation: 4, sx: { borderRadius: 2, minWidth: 220 } }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              {menuSection && (
                <>
                  <MenuItem disabled sx={{ opacity: '1 !important' }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box sx={{ color: menuSection.color }}>{menuSection.icon}</Box>
                      <Typography variant="subtitle2" fontWeight={800} color={menuSection.color}>
                        {menuSection.label}
                      </Typography>
                    </Box>
                  </MenuItem>
                  <Divider />
                  {menuSection.sub.map(item => (
                    <MenuItem
                      key={item.path}
                      onClick={() => { navigate(item.path); closeMenu(); }}
                      sx={{
                        py: 0.75,
                        '&:hover': { bgcolor: alpha(menuSection.color, 0.08), color: menuSection.color },
                      }}
                    >
                      <Typography variant="body2">{item.label}</Typography>
                    </MenuItem>
                  ))}
                </>
              )}
            </Menu>
          </>
        );
      })()}

      {/* ── Row 1: Sales | Purchases | Bank ─────────────────────────────────── */}
      <Grid container spacing={2.5} mb={2.5}>

        {/* ① SALES / AR — with aging bar chart */}
        <Grid item xs={12} md={4}>
          <Panel
            title="Sales"
            subtitle="Outstanding receivables by aging"
            accentColor={arColor}
            headerAction={
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                color="success"
                onClick={() => navigate('/finance/accounts-receivable')}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: 12 }}
              >
                New
              </Button>
            }
          >
            <Stack direction="row" gap={3} mb={2}>
              <Stat label="Total Outstanding" value={arTotal} color="success.main" />
              {arOverdue > 0 && <Stat label="Overdue" value={arOverdue} color="error.main" />}
              <Box>
                <Typography variant="caption" color="text.secondary">Invoices</Typography>
                <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
                  {arData?.rows?.length || 0}
                </Typography>
              </Box>
            </Stack>

            <AgingBars data={arChart} barColor={arColor} overdueColor={redColor} />

            <Divider sx={{ mt: 1, mb: 1 }} />
            <Button
              size="small"
              endIcon={<GoIcon sx={{ fontSize: 12 }} />}
              color="success"
              onClick={() => navigate('/finance/accounts-receivable')}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              View all receivables
            </Button>
          </Panel>
        </Grid>

        {/* ② PURCHASES / AP — identical layout to Sales */}
        <Grid item xs={12} md={4}>
          <Panel
            title="Purchases"
            subtitle="Outstanding payables by aging"
            accentColor={apColor}
            headerAction={
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                color="warning"
                onClick={() => navigate('/finance/accounts-payable')}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: 12 }}
              >
                New
              </Button>
            }
          >
            <Stack direction="row" gap={3} mb={2}>
              <Stat label="Total Outstanding" value={apTotal} color="warning.dark" />
              {apOverdue > 0 && <Stat label="Overdue" value={apOverdue} color="error.main" />}
              <Box>
                <Typography variant="caption" color="text.secondary">Bills</Typography>
                <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
                  {apData?.rows?.length || 0}
                </Typography>
              </Box>
            </Stack>

            <AgingBars data={apChart} barColor={apColor} overdueColor={redColor} />

            <Divider sx={{ mt: 1, mb: 1 }} />
            <Stack direction="row" justifyContent="space-between">
              <Button
                size="small"
                color="warning"
                onClick={() => navigate('/finance/vendor-statement')}
                sx={{ textTransform: 'none', fontSize: 12 }}
              >
                Vendor statements
              </Button>
              <Button
                size="small"
                endIcon={<GoIcon sx={{ fontSize: 12 }} />}
                color="warning"
                onClick={() => navigate('/finance/aged-payables')}
                sx={{ textTransform: 'none', fontSize: 12 }}
              >
                Aged payables
              </Button>
            </Stack>
          </Panel>
        </Grid>

        {/* ③ BANK */}
        <Grid item xs={12} md={4}>
          <Panel
            title="Bank"
            subtitle="Account balances and reconciliation"
            accentColor={theme.palette.primary.main}
            headerAction={
              <Button
                variant="outlined"
                size="small"
                color="primary"
                onClick={() => navigate('/finance/bank-reconciliation')}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: 12 }}
              >
                Reconcile
              </Button>
            }
          >
            {bankData ? (
              <>
                <Grid container spacing={1.5} mb={2}>
                  {[
                    {
                      label: 'GL Balance',
                      value: `PKR ${fmt(bankData.glBalance)}`,
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      color: theme.palette.primary.main,
                      border: alpha(theme.palette.primary.main, 0.2),
                    },
                    {
                      label: 'Unreconciled',
                      value: `${unrecCount} txns`,
                      bgcolor: unrecCount > 0 ? alpha(theme.palette.warning.main, 0.1) : alpha(theme.palette.success.main, 0.08),
                      color: unrecCount > 0 ? theme.palette.warning.dark : theme.palette.success.main,
                      border: unrecCount > 0 ? alpha(theme.palette.warning.main, 0.3) : alpha(theme.palette.success.main, 0.3),
                    },
                    {
                      label: 'Difference',
                      value: `PKR ${fmt(Math.abs(bankData.difference || 0))}`,
                      bgcolor: isReconc ? alpha(theme.palette.success.main, 0.08) : alpha(theme.palette.error.main, 0.08),
                      color: isReconc ? theme.palette.success.main : theme.palette.error.main,
                      border: isReconc ? alpha(theme.palette.success.main, 0.3) : alpha(theme.palette.error.main, 0.3),
                    },
                    {
                      label: 'Status',
                      value: isReconc ? 'Fully Reconciled' : 'Needs Review',
                      bgcolor: isReconc ? alpha(theme.palette.success.main, 0.08) : alpha(theme.palette.error.main, 0.08),
                      color: isReconc ? theme.palette.success.main : theme.palette.error.main,
                      border: isReconc ? alpha(theme.palette.success.main, 0.3) : alpha(theme.palette.error.main, 0.3),
                    },
                  ].map(item => (
                    <Grid item xs={6} key={item.label}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.2, borderRadius: 1.5,
                          bgcolor: item.bgcolor,
                          borderColor: item.border,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" display="block">{item.label}</Typography>
                        <Typography variant="body2" fontWeight={700} color={item.color} noWrap>{item.value}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                <Divider sx={{ mb: 1 }} />
                <Stack direction="row" gap={1}>
                  <Button variant="contained" size="small" fullWidth color="primary"
                    onClick={() => navigate('/finance/bank-reconciliation')}
                    sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: 12 }}>
                    Reconcile Now
                  </Button>
                  <Button variant="outlined" size="small" fullWidth color="primary"
                    onClick={() => navigate('/finance/banking')}
                    sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: 12 }}>
                    View Banking
                  </Button>
                </Stack>
              </>
            ) : (
              <Stack alignItems="center" justifyContent="center" gap={2} py={3}>
                <BankIconMui sx={{ fontSize: 48, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  No bank data yet.
                </Typography>
                <Button variant="outlined" size="small" onClick={() => navigate('/finance/banking')} sx={{ textTransform: 'none' }}>
                  Set up Banking
                </Button>
              </Stack>
            )}
          </Panel>
        </Grid>
      </Grid>

      {/* ── Row 2: Tax Returns | Fiscal Period | Journal Entries ─────────────── */}
      <Grid container spacing={2.5} mb={2.5}>

        {/* TAX RETURNS */}
        <Grid item xs={12} md={4}>
          <Panel
            title="Tax Returns"
            subtitle="GST and WHT configuration"
            accentColor={theme.palette.error.main}
            headerAction={
              <Button variant="outlined" size="small" color="error"
                onClick={() => navigate('/finance/taxes')}
                sx={{ borderRadius: 1.5, textTransform: 'none', fontSize: 12 }}>
                Manage Taxes
              </Button>
            }
          >
            <Button
              variant="contained"
              size="small"
              color="error"
              startIcon={<PctIcon />}
              onClick={() => navigate('/finance/taxes')}
              sx={{ textTransform: 'none', mb: 2, borderRadius: 1.5 }}
            >
              Tax Returns
            </Button>

            {/* GST / WHT chips */}
            {gstTaxes.length > 0 && (
              <Stack direction="row" gap={0.8} flexWrap="wrap" mb={1}>
                {gstTaxes.map(t => (
                  <Chip key={t._id} label={`GST ${t.rate}%`} size="small" color="error" variant="outlined" sx={{ fontSize: 11 }} />
                ))}
              </Stack>
            )}
            {whtTaxes.length > 0 && (
              <Stack direction="row" gap={0.8} flexWrap="wrap" mb={1.5}>
                {whtTaxes.map(t => (
                  <Chip key={t._id} label={`WHT ${t.rate}%`} size="small" color="warning" variant="outlined" sx={{ fontSize: 11 }} />
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 1 }} />
            <List dense disablePadding>
              {[
                { label: 'Set Company Data',          path: '/finance/fiscal-periods' },
                { label: 'Set Periods',               path: '/finance/fiscal-periods' },
                { label: 'Review Chart of Accounts',  path: '/finance/accounts' },
              ].map(l => (
                <ListItem key={l.label} disableGutters
                  sx={{ py: 0.2, cursor: 'pointer', '&:hover .ll': { color: 'primary.main' } }}
                  onClick={() => navigate(l.path)}>
                  <ListItemIcon sx={{ minWidth: 16 }}>
                    <DotIcon sx={{ fontSize: 8, color: 'primary.main' }} />
                  </ListItemIcon>
                  <ListItemText primary={
                    <Typography variant="body2" className="ll" sx={{ transition: 'color 0.15s' }}>{l.label}</Typography>
                  } />
                </ListItem>
              ))}
            </List>
          </Panel>
        </Grid>

        {/* FISCAL PERIOD */}
        <Grid item xs={12} md={4}>
          <Panel
            title="Fiscal Period"
            subtitle="Current accounting period"
            accentColor={theme.palette.info.main}
          >
            <Box
              sx={{
                bgcolor: period ? alpha(theme.palette.info.main, 0.07) : alpha(theme.palette.warning.main, 0.08),
                border: `1px solid ${period ? alpha(theme.palette.info.main, 0.25) : alpha(theme.palette.warning.main, 0.3)}`,
                borderRadius: 2, p: 2, mb: 2,
              }}
            >
              <Stack direction="row" alignItems="center" gap={1}>
                <CalIcon color={period ? 'info' : 'warning'} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Active Period</Typography>
                  <Typography variant="body1" fontWeight={700} color={period ? 'info.main' : 'warning.main'}>
                    {period ? period.name : 'No open period'}
                  </Typography>
                  {period && (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(period.startDate).toLocaleDateString()} — {new Date(period.endDate).toLocaleDateString()}
                    </Typography>
                  )}
                </Box>
                <Chip label={period ? period.status : 'none'} size="small"
                  color={period?.status === 'open' ? 'success' : 'warning'} sx={{ ml: 'auto' }} />
              </Stack>
            </Box>
            <Stack gap={1}>
              <Button variant="contained" size="small" color="info"
                startIcon={<CalIcon />}
                onClick={() => navigate('/finance/fiscal-periods')}
                sx={{ textTransform: 'none', borderRadius: 1.5 }}>
                Manage Periods
              </Button>
              <Button variant="outlined" size="small" color="info"
                endIcon={<GoIcon sx={{ fontSize: 13 }} />}
                onClick={() => navigate('/finance/budget-vs-actual')}
                sx={{ textTransform: 'none', borderRadius: 1.5 }}>
                Budget vs Actual
              </Button>
            </Stack>
          </Panel>
        </Grid>

        {/* JOURNAL ENTRIES */}
        <Grid item xs={12} md={4}>
          <Panel
            title="Journal Entries"
            subtitle="Post and review manual entries"
            accentColor={theme.palette.secondary.main}
          >
            <Button variant="contained" size="small" color="secondary"
              startIcon={<AddIcon />}
              onClick={() => navigate('/finance/journal-entries')}
              sx={{ textTransform: 'none', mb: 2, borderRadius: 1.5 }}>
              New Entry
            </Button>
            <Divider sx={{ mb: 1.5 }} />
            <List dense disablePadding>
              {[
                { label: 'All Journal Entries',    path: '/finance/journal-entries' },
                { label: 'Journals (Folders)',     path: '/finance/journals' },
                { label: 'General Ledger',         path: '/finance/general-ledger' },
                { label: 'Trial Balance',          path: '/finance/reports' },
                { label: 'Inventory Categories',   path: '/finance/inventory-categories' },
              ].map(l => (
                <ListItem key={l.label} disableGutters
                  sx={{ py: 0.25, cursor: 'pointer', '&:hover .ll': { color: 'secondary.main' } }}
                  onClick={() => navigate(l.path)}>
                  <ListItemIcon sx={{ minWidth: 16 }}>
                    <DotIcon sx={{ fontSize: 8, color: 'secondary.main' }} />
                  </ListItemIcon>
                  <ListItemText primary={
                    <Typography variant="body2" className="ll" sx={{ transition: 'color 0.15s' }}>{l.label}</Typography>
                  } />
                </ListItem>
              ))}
            </List>
          </Panel>
        </Grid>
      </Grid>

      {/* ── Row 3: Shortcut cards ─────────────────────────────────────────────── */}
      <Typography variant="subtitle2" color="text.secondary" fontWeight={600} mb={1.5} ml={0.5}>
        Quick Access
      </Typography>
      <Grid container spacing={2}>
        {[
          { title: 'Inventory Valuation', desc: 'WAC-based stock valuation by category.',      icon: <InvIcon     color="success"   sx={{ fontSize: 28 }} />, path: '/finance/inventory-valuation',  color: 'success'   },
          { title: 'Fixed Assets',        desc: 'Asset register and depreciation schedules.',    icon: <AssetIcon   color="secondary" sx={{ fontSize: 28 }} />, path: '/finance/fixed-assets',         color: 'secondary' },
          { title: 'Financial Reports',   desc: 'Trial balance, ledger, aged payables.',         icon: <ReportIcon  color="primary"   sx={{ fontSize: 28 }} />, path: '/finance/reports',              color: 'primary'   },
          { title: 'Budget vs Actual',    desc: 'Cost center spend vs allocated budgets.',       icon: <BarChartIcon color="info"     sx={{ fontSize: 28 }} />, path: '/finance/budget-vs-actual',     color: 'info'      },
          { title: 'Payment Terms',       desc: 'Manage instalment and net payment terms.',      icon: <CalIcon     color="warning"   sx={{ fontSize: 28 }} />, path: '/finance/payment-terms',        color: 'warning'   },
          { title: 'Purchase Returns',    desc: 'Return goods to vendor, reverse journals.',     icon: <BillIcon    color="error"     sx={{ fontSize: 28 }} />, path: '/procurement/purchase-returns', color: 'error'     },
        ].map(card => (
          <Grid item xs={12} sm={6} md={4} key={card.title}>
            <Paper
              variant="outlined"
              onClick={() => navigate(card.path)}
              sx={{
                p: 2, borderRadius: 2, cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: theme.shadows[4],
                  borderColor: theme.palette[card.color]?.main,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Stack direction="row" alignItems="center" gap={1.5}>
                <Box sx={{
                  width: 44, height: 44, borderRadius: 2,
                  bgcolor: alpha(theme.palette[card.color]?.main || '#000', 0.1),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {card.icon}
                </Box>
                <Box flex={1}>
                  <Typography variant="body2" fontWeight={700}>{card.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{card.desc}</Typography>
                </Box>
                <GoIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
