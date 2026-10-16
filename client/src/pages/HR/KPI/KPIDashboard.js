import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as HourglassEmptyIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  WarningAmber as WarningAmberIcon
} from '@mui/icons-material';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import KPITabNavigation from '../../../components/HR/KPITabNavigation';
import { fetchKpiDashboard } from '../../../services/kpiWorksheetService';

const MONTHS = [
  { v: 1, label: 'January' },
  { v: 2, label: 'February' },
  { v: 3, label: 'March' },
  { v: 4, label: 'April' },
  { v: 5, label: 'May' },
  { v: 6, label: 'June' },
  { v: 7, label: 'July' },
  { v: 8, label: 'August' },
  { v: 9, label: 'September' },
  { v: 10, label: 'October' },
  { v: 11, label: 'November' },
  { v: 12, label: 'December' }
];

const STATUS_COLORS = {
  manager_reviewed: '#2e7d32',
  submitted: '#1565c0',
  draft: '#ed6c02',
  not_started: '#9e9e9e'
};

const CATEGORY_COLORS = ['#455a64', '#0277bd'];
const SCORE_COLORS = ['#c62828', '#ef6c00', '#f9a825', '#7cb342', '#2e7d32', '#1b5e20'];

/** Default = previous calendar month (aligned with KPI Submissions / Reports). */
const getDefaultKpiPeriod = (d = new Date()) => {
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
};

const STATUS_LABEL = {
  submitted: 'Submitted',
  manager_reviewed: 'Manager reviewed',
  draft: 'Draft',
  not_started: 'Not started'
};

const StatCard = ({ title, value, subtitle, icon, color, onClick }) => {
  const theme = useTheme();
  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        border: `1px solid ${alpha(color, 0.25)}`,
        background: `linear-gradient(135deg, ${alpha(color, 0.12)} 0%, ${alpha(theme.palette.background.paper, 1)} 55%)`,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': onClick
          ? { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${alpha(color, 0.18)}` }
          : undefined
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {title}
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{ mt: 0.5, color, lineHeight: 1.1 }}>
              {value}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(color, 0.15),
              color
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

const ChartCard = ({ title, subtitle, children, height = 280 }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          {subtitle}
        </Typography>
      ) : (
        <Box sx={{ mb: 1.5 }} />
      )}
      <Box sx={{ flex: 1, minHeight: height }}>{children}</Box>
    </CardContent>
  </Card>
);

const KPIDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const defaults = useMemo(() => getDefaultKpiPeriod(), []);
  const [year, setYear] = useState(defaults.year);
  const [month, setMonth] = useState(defaults.month);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchKpiDashboard({ year, month });
      setData(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load KPI dashboard:', err);
      setError(err.response?.data?.message || 'Failed to load KPI dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary || {};
  const statusBreakdown = (data?.statusBreakdown || []).filter((s) => s.value > 0);
  const categoryBreakdown = (data?.categoryBreakdown || []).filter((s) => s.value > 0);
  const byDepartment = data?.byDepartment || [];
  const scoreBuckets = data?.scoreBuckets || [];
  const trend = data?.trend || [];
  const attentionList = data?.attentionList || [];
  const topScores = data?.topScores || [];

  const periodLabel = `${MONTHS.find((m) => m.v === month)?.label || month} ${year}`;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <KPITabNavigation />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            KPI Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Crux of monthly KPI progress with status, department, and score visuals
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <TextField
            select
            size="small"
            label="Month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            sx={{ minWidth: 140 }}
          >
            {MONTHS.map((m) => (
              <MenuItem key={m.v} value={m.v}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Year"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || defaults.year)}
            sx={{ width: 110 }}
            inputProps={{ min: 2000, max: 2100 }}
          />
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={load}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {loading && !data ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            Period: <strong>{periodLabel}</strong>
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Employees in scope"
                value={summary.totalEmployees ?? 0}
                subtitle={`${summary.blueCollar || 0} blue · ${summary.whiteCollar || 0} white collar`}
                icon={<PeopleIcon />}
                color={theme.palette.primary.main}
                onClick={() => navigate('/hr/kpi/submissions')}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Completion rate"
                value={`${summary.completionRate ?? 0}%`}
                subtitle={`${summary.completed || 0} completed · ${summary.pending || 0} pending`}
                icon={<CheckCircleIcon />}
                color={theme.palette.success.main}
                onClick={() => navigate('/hr/kpi/reports')}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Average KPI score"
                value={summary.averageScore ?? 0}
                subtitle={`Based on ${summary.scoredCount || 0} scored sheet(s)`}
                icon={<TrendingUpIcon />}
                color={theme.palette.info.main}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Awaiting action"
                value={summary.pending ?? 0}
                subtitle={`${summary.draft || 0} draft · ${summary.notStarted || 0} not started · ${summary.submitted || 0} awaiting manager`}
                icon={<HourglassEmptyIcon />}
                color={theme.palette.warning.main}
                onClick={() => navigate('/hr/kpi/submissions')}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} md={4}>
              <ChartCard title="Status mix" subtitle="Where sheets stand this period" height={260}>
                {statusBreakdown.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {statusBreakdown.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={STATUS_COLORS[entry.key] || theme.palette.grey[500]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                    <Typography color="text.secondary">No status data</Typography>
                  </Box>
                )}
              </ChartCard>
            </Grid>

            <Grid item xs={12} md={4}>
              <ChartCard title="Workforce mix" subtitle="Blue vs white collar coverage" height={260}>
                {categoryBreakdown.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                      >
                        {categoryBreakdown.map((entry, idx) => (
                          <Cell key={entry.key} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                    <Typography color="text.secondary">No category data</Typography>
                  </Box>
                )}
              </ChartCard>
            </Grid>

            <Grid item xs={12} md={4}>
              <ChartCard title="Score distribution" subtitle="Sheets with a computed KPI score" height={260}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreBuckets} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Bar dataKey="count" name="Employees" radius={[4, 4, 0, 0]}>
                      {scoreBuckets.map((entry, idx) => (
                        <Cell key={entry.label} fill={SCORE_COLORS[idx % SCORE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} lg={7}>
              <ChartCard
                title="6-month completion trend"
                subtitle="Completed share and average score across recent months"
                height={300}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="kpiCompleteGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="completionRate"
                      name="Completion %"
                      stroke={theme.palette.success.main}
                      fill="url(#kpiCompleteGrad)"
                      strokeWidth={2}
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="averageScore"
                      name="Avg score"
                      stroke={theme.palette.info.main}
                      fill="transparent"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>

            <Grid item xs={12} lg={5}>
              <ChartCard
                title="Department completion"
                subtitle="Top departments by completion rate"
                height={300}
              >
                {byDepartment.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={byDepartment.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fontSize: 11 }}
                      />
                      <RechartsTooltip
                        formatter={(value, name) => {
                          if (name === 'completionRate') return [`${value}%`, 'Completion'];
                          return [value, name];
                        }}
                      />
                      <Bar dataKey="completionRate" name="completionRate" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                    <Typography color="text.secondary">No department data</Typography>
                  </Box>
                )}
              </ChartCard>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <WarningAmberIcon color="warning" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Needs attention
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                    Employees still pending for {periodLabel}
                  </Typography>
                  <Divider sx={{ mb: 1 }} />
                  {attentionList.length ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Employee</TableCell>
                            <TableCell>Department</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {attentionList.map((row) => (
                            <TableRow key={`${row.employeeId}-${row.name}`} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>
                                  {row.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {String(row.employeeId || '').padStart(5, '0')}
                                </Typography>
                              </TableCell>
                              <TableCell>{row.department}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={STATUS_LABEL[row.status] || row.status}
                                  color={
                                    row.status === 'draft'
                                      ? 'warning'
                                      : row.status === 'submitted'
                                        ? 'info'
                                        : 'default'
                                  }
                                  variant="outlined"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
                      All in-scope employees are completed for this period.
                    </Alert>
                  )}
                  <Button
                    size="small"
                    sx={{ mt: 1.5 }}
                    startIcon={<AssessmentIcon />}
                    onClick={() => navigate('/hr/kpi/submissions')}
                  >
                    Open submissions
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <TrendingUpIcon color="success" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Top KPI scores
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                    Highest scored sheets in {periodLabel}
                  </Typography>
                  <Divider sx={{ mb: 1 }} />
                  {topScores.length ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Employee</TableCell>
                            <TableCell>Department</TableCell>
                            <TableCell align="right">Score</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {topScores.map((row) => (
                            <TableRow key={`${row.employeeId}-${row.score}`} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>
                                  {row.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {String(row.employeeId || '').padStart(5, '0')}
                                </Typography>
                              </TableCell>
                              <TableCell>{row.department}</TableCell>
                              <TableCell align="right">
                                <Chip size="small" color="success" label={row.score} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Alert severity="info">No scored worksheets yet for this period.</Alert>
                  )}
                  <Button
                    size="small"
                    sx={{ mt: 1.5 }}
                    startIcon={<AssessmentIcon />}
                    onClick={() => navigate('/hr/kpi/reports')}
                  >
                    Open reports
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default KPIDashboard;
