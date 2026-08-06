import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Card, CardContent, Chip, CircularProgress, Divider, Grid,
  IconButton, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip, Typography, Alert
} from '@mui/material';
import {
  AttachMoney as MoneyIcon, People as PeopleIcon, TrendingUp as TrendIcon,
  AccountBalance as FinanceIcon, ShoppingCart as ProcIcon, LocationCity as TajIcon,
  Groups as HRIcon, BarChart as ChartIcon, Refresh as RefreshIcon,
  CalendarToday as CalIcon, TouchApp as ActIcon
} from '@mui/icons-material';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { getFinancials } from '../../services/developerService';

const PKR = (v) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(v || 0));

const SHORT_PKR = (v) => {
  const n = Number(v || 0);
  if (n >= 1e9) return `PKR ${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `PKR ${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `PKR ${(n / 1e3).toFixed(0)}K`;
  return PKR(n);
};

const daysSince = (date) => {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
};

const KpiCard = ({ label, value, sub, color, icon, highlight }) => (
  <Card
    sx={{
      borderRadius: 3, height: '100%',
      border: '1px solid', borderColor: highlight ? color : 'divider',
      background: highlight
        ? `linear-gradient(135deg, ${color}22 0%, ${color}08 100%)`
        : 'background.paper',
      transition: 'all 0.2s',
      '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' }
    }}
    elevation={highlight ? 2 : 0}
  >
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box flex={1}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing={0.8} display="block">
            {label}
          </Typography>
          <Typography variant="h5" fontWeight={800} sx={{ color: color || 'text.primary', mt: 0.5, lineHeight: 1.2 }}>
            {value}
          </Typography>
          {sub && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>{sub}</Typography>}
        </Box>
        <Box sx={{
          p: 1.2, borderRadius: 2, bgcolor: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44
        }}>
          <Box sx={{ color }}>{icon}</Box>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const SectionTitle = ({ icon, children, sub }) => (
  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5, mt: 4 }}>
    <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
    <Box>
      <Typography variant="h6" fontWeight={800}>{children}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Box>
    <Divider sx={{ flex: 1 }} />
  </Stack>
);

const MODULE_COLORS = {
  hr: '#7c4dff',
  procurement: '#00b0ff',
  finance: '#00e676',
  tajResidencia: '#ff9100',
};
const ACTIVITY_COLORS = ['#7c4dff', '#00b0ff', '#ff9100', '#00e676', '#e91e63', '#009688'];

export default function FinancialsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await getFinancials();
      if (res.data?.success) setData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load financials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight={500}>
      <CircularProgress size={48} />
      <Typography variant="body1" color="text.secondary" sx={{ ml: 2 }}>Aggregating financial records…</Typography>
    </Box>
  );

  if (error) return (
    <Box p={3}><Alert severity="error" action={
      <IconButton size="small" onClick={load}><RefreshIcon /></IconButton>
    }>{error}</Alert></Box>
  );

  if (!data) return null;

  const { goLiveDate, activeUsers, totalUsers, totalActions, totalLogins,
    grandTotal, moduleFinancials, monthlyTrend, activityBreakdown,
    moduleActivity, topUsers } = data;
  const { hr, procurement, finance, tajResidencia } = moduleFinancials;
  const liveDays = daysSince(goLiveDate);

  const moduleBreakdown = [
    { name: 'HR & Payroll', value: hr.total, color: MODULE_COLORS.hr },
    { name: 'Procurement', value: procurement.total, color: MODULE_COLORS.procurement },
    { name: 'Finance', value: finance.total, color: MODULE_COLORS.finance },
    { name: 'Taj Residencia', value: tajResidencia.total, color: MODULE_COLORS.tajResidencia },
  ].filter(m => m.value > 0);

  const barChartData = moduleBreakdown.map(m => ({ name: m.name.split(' ')[0], value: m.value, color: m.color }));

  const activityPieData = Object.entries(activityBreakdown || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>

      {/* Executive Header */}
      <Paper
        sx={{
          p: 3.5, mb: 3, borderRadius: 3,
          background: 'linear-gradient(135deg, #0d0d1a 0%, #1a0533 40%, #0d2137 100%)',
          border: '1px solid rgba(124,77,255,0.3)', color: '#fff'
        }}
        elevation={6}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box sx={{ p: 1.5, bgcolor: 'rgba(124,77,255,0.25)', borderRadius: 2, display: 'flex', border: '1px solid rgba(124,77,255,0.4)' }}>
              <TrendIcon sx={{ fontSize: 38, color: '#b39ddb' }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: '#ce93d8', letterSpacing: 0.5 }}>
                ERP Financial Value Report
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.5 }}>
                Total financial value processed through the system · All figures in PKR
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip label={`Live since ${formatDate(goLiveDate)}`} icon={<CalIcon />}
              sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)', border: '1px solid', fontWeight: 600 }} />
            <Tooltip title="Refresh">
              <IconButton onClick={load} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Grand Total Banner */}
        <Box sx={{ mt: 3, p: 2.5, borderRadius: 2, bgcolor: 'rgba(124,77,255,0.15)', border: '1px solid rgba(124,77,255,0.3)', textAlign: 'center' }}>
          <Typography variant="overline" sx={{ color: '#b39ddb', fontWeight: 700, letterSpacing: 2 }}>
            TOTAL VALUE PROCESSED THROUGH ERP
          </Typography>
          <Typography variant="h3" fontWeight={900} sx={{ color: '#fff', mt: 0.5, textShadow: '0 0 30px rgba(179,157,219,0.4)' }}>
            {PKR(grandTotal)}
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>
            Across {liveDays} days of operation · {activeUsers} active users
          </Typography>
        </Box>
      </Paper>

      {/* Top KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Total Value Processed" value={SHORT_PKR(grandTotal)} sub="All modules combined" color="#7c4dff" icon={<MoneyIcon />} highlight />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Active ERP Users" value={activeUsers} sub={`${totalUsers} total registered`} color="#00b0ff" icon={<PeopleIcon />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="System Live" value={`${liveDays} days`} sub={`Since ${formatDate(goLiveDate)}`} color="#ff9100" icon={<CalIcon />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard label="Total Actions Logged" value={Number(totalActions).toLocaleString()} sub={`${Number(totalLogins).toLocaleString()} logins recorded`} color="#00e676" icon={<ActIcon />} />
        </Grid>
      </Grid>

      {/* Module Breakdown + Pie Chart */}
      <SectionTitle icon={<ChartIcon />} sub="Financial value managed per module">Module-wise Financial Breakdown</SectionTitle>
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }} elevation={0}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
              Total by Module (PKR)
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tickFormatter={v => SHORT_PKR(v)} tick={{ fontSize: 11 }} width={80} />
                <RechartsTooltip formatter={v => [PKR(v), 'Amount']} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {barChartData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }} elevation={0}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
              Value Share
            </Typography>
            {moduleBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={moduleBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {moduleBreakdown.map((m, i) => <Cell key={i} fill={m.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={v => [PKR(v)]} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Legend formatter={(v) => <span style={{ fontSize: 12, fontWeight: 600 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                <Typography color="text.secondary">No financial data yet</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Monthly Trend */}
      <SectionTitle icon={<TrendIcon />} sub="Last 12 months financial flow">Monthly Financial Trend</SectionTitle>
      <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }} elevation={0}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={monthlyTrend} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="gPayroll" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c4dff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7c4dff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gProc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00b0ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00b0ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gFin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00e676" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00e676" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => SHORT_PKR(v)} tick={{ fontSize: 11 }} width={80} />
            <RechartsTooltip formatter={v => [PKR(v)]} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
            <Legend />
            <Area type="monotone" dataKey="payroll" name="HR & Payroll" stroke="#7c4dff" fill="url(#gPayroll)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="procurement" name="Procurement" stroke="#00b0ff" fill="url(#gProc)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="finance" name="Finance (AP)" stroke="#00e676" fill="url(#gFin)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Paper>

      {/* Detailed Module Tables */}
      <SectionTitle icon={<HRIcon />} sub="Payroll & workforce costs">HR & Payroll</SectionTitle>
      <Grid container spacing={2}>
        {[
          { label: 'Total Payroll Disbursed', value: PKR(hr.payrollDisbursed), badge: `${hr.payrollCount} payslips`, color: '#7c4dff' },
        ].map(({ label, value, badge, color }) => (
          <Grid item xs={12} sm={6} md={4} key={label}>
            <KpiCard label={label} value={value} sub={badge} color={color} icon={<HRIcon />} highlight />
          </Grid>
        ))}
      </Grid>

      <SectionTitle icon={<ProcIcon />} sub="Purchase orders, GRNs, vendor transactions">Procurement</SectionTitle>
      <Grid container spacing={2}>
        {[
          { label: 'Purchase Orders Total', value: PKR(procurement.purchaseOrdersTotal), badge: `${procurement.purchaseOrdersCount} POs`, color: '#00b0ff' },
          { label: 'Goods Received (GRN)', value: PKR(procurement.grnTotal), badge: `${procurement.grnCount} GRNs`, color: '#00acc1' },
          { label: 'Total Procurement', value: PKR(procurement.total), badge: 'PO + GRN combined', color: '#006064', highlight: true },
        ].map(({ label, value, badge, color, highlight }) => (
          <Grid item xs={12} sm={6} md={4} key={label}>
            <KpiCard label={label} value={value} sub={badge} color={color} icon={<ProcIcon />} highlight={highlight} />
          </Grid>
        ))}
      </Grid>

      <SectionTitle icon={<FinanceIcon />} sub="Vendor bills, journals, fixed assets, cash approvals">Finance</SectionTitle>
      <Grid container spacing={2}>
        {[
          { label: 'Vendor Bills (AP)', value: PKR(finance.vendorBillsTotal), badge: `${finance.vendorBillsCount} bills`, color: '#00e676' },
          { label: 'Journal Entries Debits', value: PKR(finance.journalEntriesTotal), badge: `${finance.journalEntriesCount} entries`, color: '#1de9b6' },
          { label: 'Fixed Assets Registered', value: PKR(finance.fixedAssetsTotal), badge: `${finance.fixedAssetsCount} assets`, color: '#69f0ae' },
          { label: 'Cash Approvals', value: PKR(finance.cashApprovalsTotal), badge: `${finance.cashApprovalsCount} approvals`, color: '#b9f6ca' },
          { label: 'Total Finance Value', value: PKR(finance.total), badge: 'All finance combined', color: '#00c853', highlight: true },
        ].map(({ label, value, badge, color, highlight }) => (
          <Grid item xs={12} sm={6} md={4} key={label}>
            <KpiCard label={label} value={value} sub={badge} color={color} icon={<FinanceIcon />} highlight={highlight} />
          </Grid>
        ))}
      </Grid>

      <SectionTitle icon={<TajIcon />} sub="CAM, water, electricity, land, property invoices">Taj Residencia</SectionTitle>
      <Grid container spacing={2}>
        {[
          { label: 'CAM Charges Billed', value: PKR(tajResidencia.camChargesTotal), badge: `${tajResidencia.camChargesCount} invoices`, color: '#ff9100' },
          { label: 'Water Charges', value: PKR(tajResidencia.waterChargesTotal), badge: `${tajResidencia.waterChargesCount} bills`, color: '#ff6d00' },
          { label: 'Electricity Bills', value: PKR(tajResidencia.electricityTotal), badge: `${tajResidencia.electricityCount} bills`, color: '#ffab40' },
          { label: 'Land Purchases', value: PKR(tajResidencia.landPurchasesTotal), badge: `${tajResidencia.landPurchasesCount} transactions`, color: '#ff3d00' },
          { label: 'Property Invoices', value: PKR(tajResidencia.propertyInvoicesTotal), badge: `${tajResidencia.propertyInvoicesCount} invoices`, color: '#dd2c00' },
          { label: 'Total Taj Residencia', value: PKR(tajResidencia.total), badge: 'All Taj modules', color: '#bf360c', highlight: true },
        ].map(({ label, value, badge, color, highlight }) => (
          <Grid item xs={12} sm={6} md={4} key={label}>
            <KpiCard label={label} value={value} sub={badge} color={color} icon={<TajIcon />} highlight={highlight} />
          </Grid>
        ))}
      </Grid>

      {/* User Activity */}
      <SectionTitle icon={<ActIcon />} sub="System usage statistics">User Activity & Usage</SectionTitle>
      <Grid container spacing={3}>
        {/* Activity Type Pie */}
        {activityPieData.length > 0 && (
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }} elevation={0}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                Action Types
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={activityPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" paddingAngle={2}>
                    {activityPieData.map((_, i) => <Cell key={i} fill={ACTIVITY_COLORS[i % ACTIVITY_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                  <Legend formatter={v => <span style={{ fontSize: 11, fontWeight: 600 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Module Activity Table */}
        {moduleActivity?.length > 0 && (
          <Grid item xs={12} md={7}>
            <Paper sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }} elevation={0}>
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700} color="text.secondary" textTransform="uppercase" letterSpacing={1}>
                  Most Used Modules
                </Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 260 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>Module</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', color: 'text.secondary' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {moduleActivity.map((m, i) => (
                      <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell><Chip size="small" label={i + 1} sx={{ bgcolor: ACTIVITY_COLORS[i % ACTIVITY_COLORS.length], color: '#fff', fontWeight: 800, minWidth: 28 }} /></TableCell>
                        <TableCell sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{String(m._id || 'Unknown').replace(/_/g, ' ')}</TableCell>
                        <TableCell align="right"><Typography fontWeight={700} color="primary.main">{Number(m.count).toLocaleString()}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Top Users */}
      {topUsers?.length > 0 && (
        <>
          <SectionTitle icon={<PeopleIcon />} sub="Most active users by total actions">Top Active Users</SectionTitle>
          <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }} elevation={0}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  {['Rank', 'Name', 'Email', 'Total Actions'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {topUsers.map((u, i) => (
                  <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell>
                      <Chip size="small" label={`#${i + 1}`}
                        sx={{ bgcolor: ACTIVITY_COLORS[i % ACTIVITY_COLORS.length], color: '#fff', fontWeight: 800, minWidth: 36 }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{u.username || '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{u.email}</TableCell>
                    <TableCell><Chip size="small" label={Number(u.actions).toLocaleString()} color="primary" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Footer Note */}
      <Box sx={{ mt: 4, p: 2, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          All figures represent the total financial volume managed through the ERP system since go-live ({formatDate(goLiveDate)}).
          Data is aggregated directly from the database in real-time.
        </Typography>
      </Box>
    </Box>
  );
}
