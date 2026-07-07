import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Summarize as ReportIcon
} from '@mui/icons-material';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import surveyService from '../../../services/surveyService';
import SurveyAnalysisReportDialog from './SurveyAnalysisReportDialog';

const PRIMARY_BLUE = '#1565C0';
const BORDER = '1px solid #e0e0e0';

const VIBRANT = [
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E',
  '#F97316', '#F59E0B', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#0EA5E9'
];

const VIBRANT_DARK = [
  '#4F46E5', '#7C3AED', '#9333EA', '#DB2777', '#E11D48',
  '#EA580C', '#D97706', '#16A34A', '#0D9488', '#0891B2', '#2563EB', '#0284C7'
];

const STATUS_COLORS = { Completed: '#22C55E', 'Not Started': '#CBD5E1' };
const COMPLETION_COLORS = ['#60A5FA', '#34D399', '#FB923C'];

const KPI_ACCENTS = ['#6366F1', '#06B6D4', '#22C55E', '#F59E0B'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const color = payload[0]?.color || payload[0]?.payload?.fill || PRIMARY_BLUE;
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        px: 1.5,
        py: 1,
        borderRadius: 2,
        border: BORDER,
        boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
        minWidth: 120
      }}
    >
      {label && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
          {label}
        </Typography>
      )}
      {payload.map((entry) => (
        <Stack key={entry.name} direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color || color }} />
          <Typography variant="body2" fontWeight={700} sx={{ color: entry.color || color }}>
            {entry.name}: {entry.value}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
};

const SurveyChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const completion = row.assigned > 0
    ? (row.completionRate ?? Math.round((row.responses / row.assigned) * 100))
    : null;

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: BORDER,
        boxShadow: '0 12px 32px rgba(15,23,42,0.14)',
        minWidth: 200
      }}
    >
      <Typography variant="body2" fontWeight={800} sx={{ color: '#1e293b', mb: 1 }}>
        {row.fullTitle || row.name}
      </Typography>
      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Typography variant="caption" color="text.secondary">Responses</Typography>
          <Typography variant="body2" fontWeight={800} sx={{ color: row.color || '#6366F1' }}>
            {row.responses}
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Typography variant="caption" color="text.secondary">Assigned</Typography>
          <Typography variant="body2" fontWeight={700}>{row.assigned ?? 0}</Typography>
        </Stack>
        {completion != null && (
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Typography variant="caption" color="text.secondary">Completion</Typography>
            <Typography variant="body2" fontWeight={800} sx={{ color: '#22C55E' }}>{completion}%</Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

const PieShareTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <Box sx={{ bgcolor: '#fff', px: 1.5, py: 1, borderRadius: 2, border: BORDER, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
      <Typography variant="body2" fontWeight={700}>{row.fullTitle || row.name}</Typography>
      <Typography variant="body2" sx={{ color: row.fill, fontWeight: 800 }}>
        {row.value} responses ({row.percent != null ? `${Math.round(row.percent * 100)}%` : ''})
      </Typography>
    </Box>
  );
};

const renderPieShareLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.07) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800}>
      {`${Math.round(percent * 100)}%`}
    </text>
  );
};

const SurveyResponsesChart = ({ data }) => {
  const enriched = useMemo(
    () => data.map((item, i) => ({
      ...item,
      label: item.name,
      color: VIBRANT[i % VIBRANT.length],
      completion: item.assigned > 0
        ? (item.completionRate ?? Math.round((item.responses / item.assigned) * 100))
        : null
    })),
    [data]
  );

  const pieData = useMemo(
    () => enriched.map((item) => ({
      name: item.label,
      fullTitle: item.fullTitle || item.name,
      value: item.responses,
      fill: item.color
    })),
    [enriched]
  );

  const totalResponses = enriched.reduce((sum, item) => sum + item.responses, 0);
  const barHeight = 300;
  const barMinWidth = Math.max(420, enriched.length * 76);

  return (
    <Grid container spacing={2} alignItems="stretch">
      <Grid item xs={12} md={7}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.4, mb: 1, display: 'block' }}>
          RESPONSE COUNT BY SURVEY
        </Typography>
        <Box
          sx={{
            width: '100%',
            overflowX: 'auto',
            overflowY: 'hidden',
            borderRadius: 2,
            border: '1px solid #eef2f7',
            bgcolor: '#fafbfd',
            p: 1
          }}
        >
          <Box sx={{ width: barMinWidth, height: barHeight }}>
            <ResponsiveContainer width={barMinWidth} height={barHeight}>
              <BarChart
                data={enriched}
                margin={{ top: 32, right: 16, left: 0, bottom: 8 }}
                barCategoryGap="24%"
                barGap={6}
              >
                <GradientDefs id="surveyRsp" colors={VIBRANT} />
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                  interval={0}
                  angle={-32}
                  textAnchor="end"
                  height={72}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, (max) => Math.max(Math.ceil(max * 1.12), 4)]}
                />
                <RechartsTooltip content={<SurveyChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.07)' }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, fontWeight: 700, top: -4 }}
                />
                <Bar dataKey="assigned" name="Assigned" fill="#E2E8F0" radius={[8, 8, 0, 0]} maxBarSize={40} />
                <Bar dataKey="responses" name="Responses" radius={[8, 8, 0, 0]} maxBarSize={40}>
                  <LabelList dataKey="responses" position="top" fontSize={11} fontWeight={800} fill="#334155" />
                  {enriched.map((_, i) => (
                    <Cell key={`rsp-bar-${i}`} fill={`url(#surveyRspGrad${i % VIBRANT.length})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      </Grid>

      <Grid item xs={12} md={5}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.4, mb: 1, display: 'block' }}>
          RESPONSE SHARE
        </Typography>
        <Box
          sx={{
            position: 'relative',
            borderRadius: 2,
            border: '1px solid #eef2f7',
            bgcolor: '#fafbfd',
            p: 1,
            height: 300
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                stroke="#fff"
                strokeWidth={3}
                label={renderPieShareLabel}
                labelLine={false}
              >
                {pieData.map((entry, i) => (
                  <Cell key={`pie-${i}`} fill={entry.fill} />
                ))}
              </Pie>
              <RechartsTooltip content={<PieShareTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}
          >
            <Typography variant="h4" fontWeight={800} sx={{ color: '#6366F1', lineHeight: 1 }}>
              {totalResponses}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              Total
            </Typography>
          </Box>
        </Box>

        <Stack spacing={0.75} sx={{ mt: 1.5, maxHeight: 140, overflowY: 'auto', pr: 0.5 }}>
          {pieData.map((item) => {
            const share = totalResponses ? Math.round((item.value / totalResponses) * 100) : 0;
            return (
              <Stack key={item.name} direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.fill, flexShrink: 0 }} />
                <Typography variant="caption" noWrap sx={{ flex: 1, color: '#475569', fontWeight: 600 }} title={item.fullTitle}>
                  {item.fullTitle}
                </Typography>
                <Typography variant="caption" fontWeight={800} sx={{ color: item.fill }}>
                  {item.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32, textAlign: 'right' }}>
                  {share}%
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      </Grid>
    </Grid>
  );
};

const KpiCard = ({ title, value, sub, loading, accentIndex = 0 }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      height: '100%',
      border: BORDER,
      borderRadius: 2,
      bgcolor: '#fff',
      borderTop: `4px solid ${KPI_ACCENTS[accentIndex % KPI_ACCENTS.length]}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }
    }}
  >
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.3 }}>
      {title}
    </Typography>
    {loading ? (
      <Skeleton variant="text" width="70%" height={40} sx={{ mt: 0.5 }} />
    ) : (
      <>
        <Typography
          variant="h5"
          sx={{ mt: 0.5, fontWeight: 800, color: KPI_ACCENTS[accentIndex % KPI_ACCENTS.length] }}
        >
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            {sub}
          </Typography>
        )}
      </>
    )}
  </Paper>
);

const ChartPanel = ({ title, subtitle, children, height = 'auto', accentColor = PRIMARY_BLUE }) => (
  <Paper
    elevation={0}
    sx={{
      border: BORDER,
      bgcolor: '#fff',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 2,
      overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
    }}
  >
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: BORDER,
        background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}06 50%, transparent 100%)`
      }}
    >
      <Typography fontWeight={700} sx={{ color: accentColor }}>{title}</Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block">
          {subtitle}
        </Typography>
      )}
    </Box>
    <Box sx={{ p: 2, flex: 1, minHeight: height }}>{children}</Box>
  </Paper>
);

const GradientDefs = ({ id, colors }) => (
  <defs>
    {colors.map((color, i) => (
      <linearGradient key={`${id}-${i}`} id={`${id}Grad${i}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={1} />
        <stop offset="100%" stopColor={VIBRANT_DARK[i % VIBRANT_DARK.length]} stopOpacity={0.85} />
      </linearGradient>
    ))}
    <linearGradient id="areaMultiGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.5} />
      <stop offset="50%" stopColor="#6366F1" stopOpacity={0.4} />
      <stop offset="100%" stopColor="#EC4899" stopOpacity={0.25} />
    </linearGradient>
    <linearGradient id="areaStrokeGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="#06B6D4" />
      <stop offset="50%" stopColor="#6366F1" />
      <stop offset="100%" stopColor="#A855F7" />
    </linearGradient>
  </defs>
);

const SurveyExecutiveDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [analysisSurvey, setAnalysisSurvey] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await surveyService.getExecutiveDashboard();
      setData(res.data?.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load executive dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const openAnalysisDialog = (survey) => {
    setAnalysisSurvey(survey);
    setAnalysisDialogOpen(true);
  };

  const closeAnalysisDialog = () => {
    setAnalysisDialogOpen(false);
    setAnalysisSurvey(null);
  };

  const statusPieData = useMemo(() => {
    if (!data?.charts?.statusBreakdown) return [];
    return data.charts.statusBreakdown.map((item) => ({
      ...item,
      fill: STATUS_COLORS[item.name] || VIBRANT[0]
    }));
  }, [data]);

  const donutTotal = statusPieData.reduce((s, d) => s + d.value, 0);

  const surveyChartData = useMemo(
    () => (data?.charts?.surveyResponseChart || []).slice().sort((a, b) => b.responses - a.responses),
    [data]
  );

  if (loading && !data) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f8fafc', minHeight: '100%' }}>
        <Skeleton variant="text" width={360} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rounded" height={90} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 3, bgcolor: '#f8fafc' }}>
        <Alert severity="error">{error || 'Dashboard unavailable'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/crm/survey')}>Back</Button>
      </Box>
    );
  }

  const { summary, charts, surveys, recentResponses } = data;
  const satisfaction = summary.avgSatisfaction;
  const deptData = charts.departmentParticipation || [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f8fafc', minHeight: '100%' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ color: '#1e293b' }}>
            Analytics &amp; Reporting Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Organization-wide survey performance summary for executives
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={loadDashboard}
          disabled={loading}
          sx={{ borderColor: '#6366F1', color: '#6366F1', fontWeight: 600 }}
        >
          Refresh
        </Button>
      </Stack>

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { title: 'Active Surveys', value: summary.activeSurveys, sub: `${summary.draftSurveys} draft · ${summary.closedSurveys} closed` },
          { title: 'Total Responses', value: summary.totalResponses, sub: `${summary.totalAssigned} users assigned` },
          { title: 'Completion Rate', value: `${summary.overallCompletionRate}%`, sub: `${summary.totalPending} pending` },
          { title: 'Avg. Satisfaction', value: satisfaction ? `${satisfaction.average}/${satisfaction.max}` : '—', sub: satisfaction ? 'All rating questions' : 'No rating data' }
        ].map((kpi, i) => (
          <Grid item xs={12} sm={6} md={3} key={kpi.title}>
            <KpiCard {...kpi} loading={loading} accentIndex={i} />
          </Grid>
        ))}
      </Grid>

      {/* Main charts */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} lg={7}>
          <ChartPanel
            title="Responses by Survey"
            subtitle="Grouped bar chart and share donut — assigned vs actual responses"
            height={420}
            accentColor="#6366F1"
          >
            {surveyChartData.length > 0 ? (
              <SurveyResponsesChart data={surveyChartData} />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 10, textAlign: 'center' }}>
                No survey responses yet. Publish surveys to see trends here.
              </Typography>
            )}
          </ChartPanel>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Stack spacing={2}>
            <ChartPanel title="Participation by Department" subtitle="Color-coded team responses" height={220} accentColor="#14B8A6">
              {deptData.length > 0 ? (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={deptData} layout="vertical" margin={{ left: 4, right: 16 }}>
                    <GradientDefs id="deptBar" colors={VIBRANT} />
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="department" width={96} tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Responses" radius={[0, 8, 8, 0]} maxBarSize={26}>
                      {deptData.map((_, i) => (
                        <Cell key={`dp-${i}`} fill={`url(#deptBarGrad${i % VIBRANT.length})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                  Department data appears when respondents have departments.
                </Typography>
              )}
            </ChartPanel>

            <ChartPanel title="Overall Survey Status" subtitle="Completion breakdown" height={220} accentColor="#22C55E">
              {statusPieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="#fff"
                        strokeWidth={3}
                      >
                        {statusPieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Stack direction="row" justifyContent="center" spacing={2} flexWrap="wrap" useFlexGap>
                    {statusPieData.map((entry) => (
                      <Chip
                        key={entry.name}
                        size="small"
                        label={`${entry.name}: ${entry.value}${donutTotal ? ` (${Math.round((entry.value / donutTotal) * 100)}%)` : ''}`}
                        sx={{
                          fontWeight: 700,
                          bgcolor: `${entry.fill}22`,
                          color: entry.fill === '#CBD5E1' ? '#64748b' : entry.fill,
                          border: `1px solid ${entry.fill}44`
                        }}
                      />
                    ))}
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                  Assign users to surveys to track completion.
                </Typography>
              )}
            </ChartPanel>
          </Stack>
        </Grid>
      </Grid>

      {/* Volume + completion */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={8}>
          <ChartPanel title="Daily Response Volume" subtitle="Submission trend — all surveys" height={300} accentColor="#A855F7">
            {charts.dailyVolume?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.dailyVolume} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <GradientDefs id="unused" colors={VIBRANT} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="url(#areaStrokeGrad)"
                    fill="url(#areaMultiGrad)"
                    strokeWidth={3}
                    name="Responses"
                    dot={{ r: 4, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 7, fill: '#EC4899', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
                No response activity recorded yet.
              </Typography>
            )}
          </ChartPanel>
        </Grid>

        <Grid item xs={12} md={4}>
          <ChartPanel title="Completion Overview" subtitle="Assigned · Responded · Pending" height={300} accentColor="#F97316">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Assigned', value: summary.totalAssigned },
                  { name: 'Responded', value: summary.totalResponses },
                  { name: 'Pending', value: summary.totalPending }
                ]}
                margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Count" radius={[10, 10, 0, 0]} maxBarSize={64}>
                  {COMPLETION_COLORS.map((color, i) => (
                    <Cell key={`co-${i}`} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </Grid>
      </Grid>

      {/* Performance table */}
      <Paper elevation={0} sx={{ border: BORDER, bgcolor: '#fff', mb: 2, borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: BORDER, background: 'linear-gradient(135deg, #6366F118 0%, transparent 100%)' }}>
          <Typography fontWeight={700} sx={{ color: '#6366F1' }}>Survey Performance Summary</Typography>
          <Typography variant="caption" color="text.secondary">Click a row or analytics icon for detailed reports</Typography>
        </Box>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {['Survey', 'Status', 'Assigned', 'Responses', 'Completion', 'Avg. Score', 'Action'].map((h, i) => (
                  <TableCell
                    key={h}
                    align={i >= 2 && i <= 5 ? 'right' : i === 4 ? 'left' : 'inherit'}
                    sx={{ fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569', ...(i === 4 && { minWidth: 150 }) }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {surveys.map((survey, idx) => {
                const barColor = VIBRANT[idx % VIBRANT.length];
                return (
                  <TableRow
                    key={survey._id}
                    hover
                    sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f8fafc', cursor: 'pointer' }}
                    onClick={() => navigate(`/crm/survey/${survey._id}/analytics`)}
                  >
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 4, height: 32, borderRadius: 2, bgcolor: barColor, flexShrink: 0 }} />
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{survey.title}</Typography>
                          <Typography variant="caption" color="text.secondary">{survey.questionCount} questions</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={survey.status}
                        sx={{
                          fontWeight: 700,
                          bgcolor: survey.status === 'active' ? '#DCFCE7' : '#F1F5F9',
                          color: survey.status === 'active' ? '#16A34A' : '#64748b'
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">{survey.assignedCount}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: barColor }}>{survey.responseCount}</TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <LinearProgress
                          variant="determinate"
                          value={survey.responseRate}
                          sx={{
                            flex: 1,
                            height: 10,
                            borderRadius: 5,
                            bgcolor: `${barColor}22`,
                            '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 5 }
                          }}
                        />
                        <Typography variant="caption" fontWeight={800} sx={{ color: barColor, minWidth: 32 }}>
                          {survey.responseRate}%
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#6366F1' }}>
                      {survey.avgSatisfaction ? `${survey.avgSatisfaction.average}/${survey.avgSatisfaction.max}` : '—'}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      {survey.analysisReport?.isSentToManagement && (
                        <IconButton 
                          size="small" 
                          sx={{ color: '#16A34A', bgcolor: '#DCFCE7', '&:hover': { bgcolor: '#BBF7D0' }, mr: 1 }} 
                          onClick={(e) => { e.stopPropagation(); openAnalysisDialog(survey); }}
                          title="View Analysis Report"
                        >
                          <ReportIcon fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton size="small" sx={{ color: barColor, bgcolor: `${barColor}15`, '&:hover': { bgcolor: `${barColor}28` } }} onClick={() => navigate(`/crm/survey/${survey._id}/analytics`)}>
                        <AnalyticsIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {surveys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">No active or closed surveys yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Recent activity */}
      <Paper elevation={0} sx={{ border: BORDER, bgcolor: '#fff', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: BORDER, background: 'linear-gradient(135deg, #06B6D418 0%, transparent 100%)' }}>
          <Typography fontWeight={700} sx={{ color: '#0891B2' }}>Recent Activity</Typography>
          <Typography variant="caption" color="text.secondary">Latest submissions across all surveys</Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Survey', 'Respondent', 'Department', 'Submitted', 'Answers'].map((h, i) => (
                  <TableCell key={h} align={i === 4 ? 'right' : 'inherit'} sx={{ fontWeight: 700, bgcolor: '#f1f5f9', color: '#475569' }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {recentResponses.map((row, idx) => (
                <TableRow key={row._id} sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f8fafc' }} hover>
                  <TableCell sx={{ fontWeight: 600, color: VIBRANT[idx % VIBRANT.length] }}>{row.surveyTitle}</TableCell>
                  <TableCell>
                    {row.respondent ? `${row.respondent.firstName || ''} ${row.respondent.lastName || ''}`.trim() : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={row.respondent?.department || '—'} sx={{ bgcolor: `${VIBRANT[(idx + 3) % VIBRANT.length]}18`, color: VIBRANT[(idx + 3) % VIBRANT.length], fontWeight: 600 }} />
                  </TableCell>
                  <TableCell>{new Date(row.submittedAt).toLocaleString()}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{row.answerCount}</TableCell>
                </TableRow>
              ))}
              {recentResponses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">No recent submissions</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          startIcon={<TrendingUpIcon />}
          onClick={() => navigate('/crm/survey')}
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            '&:hover': { background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }
          }}
        >
          Manage Surveys
        </Button>
      </Stack>
      <SurveyAnalysisReportDialog
        open={analysisDialogOpen}
        survey={analysisSurvey}
        onClose={closeAnalysisDialog}
        onSaved={() => {}}
      />
    </Box>
  );
};

export default SurveyExecutiveDashboard;
