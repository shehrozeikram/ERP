import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Assessment as AnalyticsIcon,
  Assignment as SurveyIcon,
  Edit as EditIcon,
  Groups as ResponsesIcon,
  Refresh as RefreshIcon,
  Send as SendIcon
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
import { alpha, useTheme } from '@mui/material/styles';
import surveyService from '../../../services/surveyService';

const LIKERT_COLORS = ['#EF4444', '#F59E0B', '#EAB308', '#3B82F6', '#10B981'];
const DEPT_COLORS = ['#3B82F6', '#14B8A6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#64748B'];
const STATUS_COLORS = ['#3B82F6', '#10B981', '#94A3B8'];

const NAV_ITEMS = [
  { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
  { id: 'responses', label: 'Responses', icon: ResponsesIcon },
  { id: 'overview', label: 'Surveys', icon: SurveyIcon }
];

const KpiCard = ({ label, value, badge, badgeColor = 'default' }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2.5,
      borderRadius: 3,
      border: '1px solid',
      borderColor: 'divider',
      height: '100%'
    }}
  >
    <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1 }}>
      {label}
    </Typography>
    <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
      <Typography variant="h3" fontWeight={800} lineHeight={1}>
        {value}
      </Typography>
      {badge && (
        <Chip
          size="small"
          label={badge}
          color={badgeColor}
          variant="outlined"
          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
        />
      )}
    </Stack>
  </Paper>
);

const ChartCard = ({ title, subtitle, action, children, sx = {} }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2.5,
      borderRadius: 3,
      border: '1px solid',
      borderColor: 'divider',
      height: '100%',
      ...sx
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
      <Box>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        )}
      </Box>
      {action}
    </Stack>
    {children}
  </Paper>
);

const SurveyAnalytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('analytics');
  const [chartMode, setChartMode] = useState('likert');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await surveyService.getAnalytics(id);
      setData(res.data?.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const likertScores = useMemo(() => {
    if (!data?.charts?.likertChartData?.length) return [];
    const first = data.charts.likertChartData[0];
    return Object.keys(first)
      .filter((k) => k.startsWith('score_'))
      .map((k) => Number(k.replace('score_', '')))
      .sort((a, b) => a - b);
  }, [data]);

  const choiceOptions = useMemo(() => {
    if (!data?.charts?.choiceChartData?.length) return [];
    const first = data.charts.choiceChartData[0];
    return Object.keys(first)
      .filter((k) => k.startsWith('opt_') && !k.endsWith('_label'))
      .map((k) => ({
        key: k,
        label: first[`${k}_label`] || k
      }));
  }, [data]);

  useEffect(() => {
    if (!data) return;
    if (data.charts?.likertChartData?.length) setChartMode('likert');
    else if (data.charts?.choiceChartData?.length) setChartMode('choice');
  }, [data]);

  const distributionData = chartMode === 'likert'
    ? data?.charts?.likertChartData || []
    : data?.charts?.choiceChartData || [];

  const distributionTitle = chartMode === 'likert'
    ? `Response Distribution (Q1–Q${distributionData.length})`
    : `Answer Distribution (Q1–Q${distributionData.length})`;

  if (loading) {
    return (
      <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
        <Skeleton variant="rounded" height={64} sx={{ mb: 3, borderRadius: 3 }} />
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} md={4} key={i}>
              <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
          <Grid item xs={12} md={8}>
            <Skeleton variant="rounded" height={380} sx={{ borderRadius: 3 }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rounded" height={380} sx={{ borderRadius: 3 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Analytics unavailable'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/crm/survey')}>Back</Button>
      </Box>
    );
  }

  const { survey, summary, charts, questionAnalytics, recentResponses, pendingUsers } = data;
  const satisfaction = summary.avgSatisfaction;

  const pageBg = {
    minHeight: '100vh',
    bgcolor: alpha(theme.palette.primary.main, 0.02)
  };

  return (
    <Box sx={pageBg}>
      {/* Dashboard shell */}
      <Paper
        elevation={0}
        sx={{
          maxWidth: 1400,
          mx: 'auto',
          my: { xs: 0, md: 2 },
          borderRadius: { xs: 0, md: 4 },
          border: { xs: 'none', md: '1px solid' },
          borderColor: 'divider',
          overflow: 'hidden',
          minHeight: { xs: '100vh', md: 'auto' }
        }}
      >
        {/* Top header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper'
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Typography variant="overline" color="text.secondary" fontWeight={700} letterSpacing={1.5}>
              Internal ERP Analytics &amp; Reporting Dashboard
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<RefreshIcon />} onClick={loadAnalytics}>
                Refresh
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/crm/survey/${id}/edit`)}
              >
                Edit survey
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Stack direction="row" sx={{ minHeight: 600 }}>
          {/* Sidebar */}
          <Box
            sx={{
              width: 72,
              flexShrink: 0,
              borderRight: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.primary.main, 0.03),
              py: 2,
              display: { xs: 'none', sm: 'flex' },
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1
            }}
          >
            {NAV_ITEMS.map(({ id: tabId, label, icon: Icon }) => {
              const active = activeTab === tabId;
              return (
                <Tooltip key={tabId} title={label} placement="right">
                  <IconButton
                    onClick={() => setActiveTab(tabId)}
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
                      color: active ? 'primary.main' : 'text.secondary',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                    }}
                  >
                    <Icon />
                  </IconButton>
                </Tooltip>
              );
            })}
          </Box>

          {/* Main content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Sub header */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ px: { xs: 2, md: 3 }, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <IconButton size="small" onClick={() => navigate('/crm/survey')}>
                <ArrowBackIcon />
              </IconButton>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" fontWeight={700} noWrap>
                  {survey.title} — Analytics
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                  <Chip
                    size="small"
                    label={survey.status}
                    color={survey.status === 'active' ? 'success' : 'default'}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {survey.questionCount} questions
                  </Typography>
                </Stack>
              </Box>
              {charts.likertChartData?.length > 0 && activeTab === 'analytics' && (
                <Chip size="small" label="Likert data" color="primary" variant="outlined" />
              )}
            </Stack>

            {/* Mobile tabs */}
            <Stack
              direction="row"
              spacing={1}
              sx={{ px: 2, py: 1.5, display: { xs: 'flex', sm: 'none' }, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              {NAV_ITEMS.map(({ id: tabId, label }) => (
                <Chip
                  key={tabId}
                  label={label}
                  size="small"
                  color={activeTab === tabId ? 'primary' : 'default'}
                  onClick={() => setActiveTab(tabId)}
                  sx={{ fontWeight: 600 }}
                />
              ))}
            </Stack>

            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {/* ── ANALYTICS TAB ── */}
              {activeTab === 'analytics' && (
                <Stack spacing={3}>
                  {/* KPI row */}
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <KpiCard
                        label="Total Responses"
                        value={summary.responseCount}
                        badge={summary.assignedCount ? `${summary.assignedCount} assigned` : 'No assignments'}
                        badgeColor="success"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <KpiCard
                        label="Completion Rate"
                        value={`${summary.responseRate}%`}
                        badge={summary.pendingCount ? `${summary.pendingCount} pending` : 'All done'}
                        badgeColor={summary.responseRate >= 70 ? 'success' : 'default'}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <KpiCard
                        label="Avg. Satisfaction Score"
                        value={satisfaction ? `${satisfaction.average}/${satisfaction.max}` : '—'}
                        badge={satisfaction ? 'Rating questions' : 'No ratings'}
                        badgeColor={satisfaction ? 'success' : 'default'}
                      />
                    </Grid>
                  </Grid>

                  <Grid container spacing={2}>
                    {/* Main distribution chart */}
                    <Grid item xs={12} lg={8}>
                      <ChartCard
                        title={distributionTitle}
                        subtitle="Likert Scale Responses"
                        action={(
                          <FormControl size="small" sx={{ minWidth: 130 }}>
                            <Select
                              value={chartMode}
                              onChange={(e) => setChartMode(e.target.value)}
                            >
                              <MenuItem value="likert" disabled={!charts.likertChartData?.length}>
                                Likert scale
                              </MenuItem>
                              <MenuItem value="choice" disabled={!charts.choiceChartData?.length}>
                                Choice questions
                              </MenuItem>
                            </Select>
                          </FormControl>
                        )}
                        sx={{ minHeight: 420 }}
                      >
                        {distributionData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={340}>
                            <BarChart data={distributionData} barGap={2} barCategoryGap="18%">
                              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.8)} />
                              <XAxis dataKey="question" tick={{ fontSize: 12 }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} label={{ value: 'Responses', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                              <RechartsTooltip
                                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                                formatter={(value, name) => {
                                  if (chartMode === 'likert') {
                                    const score = name.replace('score_', '');
                                    return [value, `Score ${score}`];
                                  }
                                  const opt = choiceOptions.find((o) => o.key === name);
                                  return [value, opt?.label || name];
                                }}
                                labelFormatter={(label, payload) => {
                                  const item = payload?.[0]?.payload;
                                  return item?.label ? `${label}: ${item.label}` : label;
                                }}
                              />
                              <Legend />
                              {chartMode === 'likert'
                                ? likertScores.map((score, i) => (
                                  <Bar
                                    key={score}
                                    dataKey={`score_${score}`}
                                    name={`Score ${score}`}
                                    fill={LIKERT_COLORS[i % LIKERT_COLORS.length]}
                                    radius={[4, 4, 0, 0]}
                                  />
                                ))
                                : choiceOptions.map((opt, i) => (
                                  <Bar
                                    key={opt.key}
                                    dataKey={opt.key}
                                    name={opt.label}
                                    fill={LIKERT_COLORS[i % LIKERT_COLORS.length]}
                                    radius={[4, 4, 0, 0]}
                                  />
                                ))}
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <Box sx={{ py: 10, textAlign: 'center' }}>
                            <Typography color="text.secondary">
                              No chartable questions yet. Add rating or choice questions to see distribution.
                            </Typography>
                          </Box>
                        )}
                      </ChartCard>
                    </Grid>

                    {/* Right column */}
                    <Grid item xs={12} lg={4}>
                      <Stack spacing={2}>
                        {/* Department scores */}
                        <ChartCard title="Average Score by Department" subtitle="Based on numeric & rating answers">
                          {charts.departmentScores?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart
                                data={charts.departmentScores}
                                layout="vertical"
                                margin={{ left: 10, right: 20 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="department" width={90} tick={{ fontSize: 11 }} />
                                <RechartsTooltip
                                  formatter={(val) => [val, 'Avg score']}
                                  contentStyle={{ borderRadius: 8 }}
                                />
                                <Bar dataKey="average" radius={[0, 6, 6, 0]}>
                                  {charts.departmentScores.map((_, i) => (
                                    <Cell key={`dept-${i}`} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                              Department scores appear when respondents have departments and numeric answers.
                            </Typography>
                          )}
                        </ChartCard>

                        {/* Status donut */}
                        <ChartCard title="Survey Status" subtitle="Assigned audience breakdown">
                          {charts.statusBreakdown?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={180}>
                              <PieChart>
                                <Pie
                                  data={charts.statusBreakdown}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={72}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {charts.statusBreakdown.map((entry, i) => (
                                    <Cell key={entry.name} fill={entry.color || STATUS_COLORS[i % STATUS_COLORS.length]} />
                                  ))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ borderRadius: 8 }} />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                              Assign users to see completion status.
                            </Typography>
                          )}
                        </ChartCard>

                        {/* Daily volume */}
                        <ChartCard title="Daily Response Volume" subtitle="Submissions over time">
                          {charts.dailyVolume?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={140}>
                              <AreaChart data={charts.dailyVolume}>
                                <defs>
                                  <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={30} />
                                <RechartsTooltip contentStyle={{ borderRadius: 8 }} />
                                <Area
                                  type="monotone"
                                  dataKey="count"
                                  stroke="#3B82F6"
                                  fill="url(#volumeGrad)"
                                  strokeWidth={2}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                              No responses recorded yet.
                            </Typography>
                          )}
                        </ChartCard>
                      </Stack>
                    </Grid>
                  </Grid>

                  {/* Question breakdown */}
                  <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
                    Question-level insights
                  </Typography>
                  <Grid container spacing={2}>
                    {questionAnalytics.map((qa) => (
                      <Grid item xs={12} md={6} key={qa.key}>
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                            <Box sx={{ flex: 1, pr: 1 }}>
                              <Typography fontWeight={600} sx={{ lineHeight: 1.4 }}>{qa.label}</Typography>
                              <Typography variant="caption" color="text.secondary">{qa.type}</Typography>
                            </Box>
                            <Chip size="small" label={`${qa.responseRate}%`} color="primary" variant="outlined" />
                          </Stack>

                          {qa.distribution?.map((row) => (
                            <Box key={`${qa.key}-${row.value}`} sx={{ mb: 1 }}>
                              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                                <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>{row.label}</Typography>
                                <Typography variant="caption" color="text.secondary">{row.count} ({row.percent}%)</Typography>
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={row.percent}
                                sx={{
                                  height: 6,
                                  borderRadius: 3,
                                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                                  '& .MuiLinearProgress-bar': { borderRadius: 3 }
                                }}
                              />
                            </Box>
                          ))}

                          {qa.average !== undefined && !qa.distribution?.length && (
                            <Typography variant="body2">
                              Average: <strong>{qa.average}</strong>
                            </Typography>
                          )}

                          {qa.textAnswers?.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              {qa.textAnswers.slice(0, 3).map((text, idx) => (
                                <Typography key={idx} variant="body2" color="text.secondary" sx={{ py: 0.25 }}>
                                  • {text}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Stack>
              )}

              {/* ── RESPONSES TAB ── */}
              {activeTab === 'responses' && (
                <Grid container spacing={3}>
                  <Grid item xs={12} lg={8}>
                    <ChartCard title="Recent Responses" subtitle={`${recentResponses.length} latest submissions`}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Respondent</TableCell>
                              <TableCell>Department</TableCell>
                              <TableCell>Submitted</TableCell>
                              <TableCell align="right">Answers</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {recentResponses.map((row) => (
                              <TableRow key={row._id} hover>
                                <TableCell>
                                  {row.respondent
                                    ? `${row.respondent.firstName || ''} ${row.respondent.lastName || ''}`.trim()
                                    : '—'}
                                </TableCell>
                                <TableCell>{row.respondent?.department || '—'}</TableCell>
                                <TableCell>{new Date(row.submittedAt).toLocaleString()}</TableCell>
                                <TableCell align="right">{row.answers?.length || 0}</TableCell>
                              </TableRow>
                            ))}
                            {recentResponses.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                                  No responses yet
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </ChartCard>
                  </Grid>
                  <Grid item xs={12} lg={4}>
                    <ChartCard
                      title="Pending Users"
                      subtitle={`${pendingUsers?.length || 0} have not responded`}
                      action={(
                        <Button
                          size="small"
                          startIcon={<SendIcon />}
                          onClick={() => navigate('/crm/survey')}
                        >
                          Send
                        </Button>
                      )}
                    >
                      <Stack spacing={1} sx={{ maxHeight: 400, overflow: 'auto' }}>
                        {pendingUsers?.length ? pendingUsers.map((user) => (
                          <Box
                            key={user._id}
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: alpha(theme.palette.warning.main, 0.06),
                              border: '1px solid',
                              borderColor: alpha(theme.palette.warning.main, 0.15)
                            }}
                          >
                            <Typography variant="body2" fontWeight={600}>
                              {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {user.department || 'No department'}
                            </Typography>
                          </Box>
                        )) : (
                          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                            Everyone assigned has responded.
                          </Typography>
                        )}
                      </Stack>
                    </ChartCard>
                  </Grid>
                </Grid>
              )}

              {/* ── OVERVIEW TAB ── */}
              {activeTab === 'overview' && (
                <Stack spacing={3}>
                  <ChartCard title="Survey Overview">
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">Title</Typography>
                        <Typography fontWeight={600}>{survey.title}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">Status</Typography>
                        <Typography fontWeight={600}>{survey.status}</Typography>
                      </Grid>
                      {survey.description && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">Description</Typography>
                          <Typography>{survey.description}</Typography>
                        </Grid>
                      )}
                      <Grid item xs={12} sm={4}>
                        <Typography variant="caption" color="text.secondary">Published</Typography>
                        <Typography>
                          {survey.publishedAt ? new Date(survey.publishedAt).toLocaleString() : '—'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="caption" color="text.secondary">Closes</Typography>
                        <Typography>
                          {survey.closesAt ? new Date(survey.closesAt).toLocaleDateString() : 'No close date'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="caption" color="text.secondary">Questions</Typography>
                        <Typography>{survey.questionCount}</Typography>
                      </Grid>
                    </Grid>
                    <Divider sx={{ my: 2 }} />
                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" startIcon={<EditIcon />} onClick={() => navigate(`/crm/survey/${id}/edit`)}>
                        Edit survey
                      </Button>
                      <Button variant="outlined" onClick={() => navigate('/crm/survey')}>
                        Manage surveys
                      </Button>
                    </Stack>
                  </ChartCard>

                  <ChartCard title="Questions" subtitle={`${survey.questions?.length || 0} total`}>
                    <Stack spacing={1}>
                      {(survey.questions || []).map((q, i) => (
                        <Box
                          key={q.key}
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2
                          }}
                        >
                          <Chip size="small" label={`Q${i + 1}`} color="primary" variant="outlined" />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" fontWeight={600}>{q.label}</Typography>
                            <Typography variant="caption" color="text.secondary">{q.type}{q.required ? ' · Required' : ''}</Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </ChartCard>
                </Stack>
              )}
            </Box>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

export default SurveyAnalytics;
