import React, { useMemo } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  alpha,
  useTheme,
  Chip,
  Avatar,
  Divider
} from '@mui/material';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import {
  Assessment as AssessmentIcon,
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon,
  PendingActions as PendingActionsIcon,
  TrendingUp as TrendingUpIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';

const COLORS = {
  status: {
    draft: '#9e9e9e',
    sent: '#2196f3',
    in_progress: '#ff9800',
    submitted: '#9c27b0',
    completed: '#4caf50',
    archived: '#607d8b'
  },
  approval: {
    level0: '#f44336',
    level1: '#ff9800',
    level2: '#2196f3',
    level3: '#9c27b0',
    level4: '#4caf50'
  },
  gradient: {
    primary: ['#667eea', '#764ba2'],
    success: ['#11998e', '#38ef7d'],
    warning: ['#f093fb', '#f5576c'],
    info: ['#4facfe', '#00f2fe']
  }
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: 2,
          p: 1.5,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}
      >
        <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
          {label}
        </Typography>
        {payload.map((entry, index) => (
          <Typography
            key={index}
            variant="body2"
            sx={{ color: entry.color }}
          >
            {entry.name}: {entry.value}
          </Typography>
        ))}
      </Box>
    );
  }
  return null;
};

const StatCard = ({ title, value, icon, color, subtitle }) => {
  const theme = useTheme();
  return (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${alpha(color, 0.15)} 0%, ${alpha(color, 0.05)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(color, 0.2)}`,
        borderRadius: 3,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 32px ${alpha(color, 0.25)}`,
          border: `1px solid ${alpha(color, 0.3)}`
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.5)})`,
          borderRadius: '12px 12px 0 0'
        }
      }}
    >
      <CardContent sx={{ p: 2.5, position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: alpha(color, 0.2),
              color: color,
              width: 48,
              height: 48
            }}
          >
            {icon}
          </Avatar>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5, color: theme.palette.text.primary }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600, mb: 0.5 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, opacity: 0.8 }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const ChartCard = ({ title, icon, color, children, height = 400 }) => {
  const theme = useTheme();
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 3,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(color, 0.15)}`,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 8px 32px ${alpha(color, 0.08)}, 0 4px 16px ${alpha(theme.palette.common.black, 0.06)}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 16px 48px ${alpha(color, 0.15)}, 0 8px 24px ${alpha(theme.palette.common.black, 0.1)}`,
          border: `1px solid ${alpha(color, 0.25)}`
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.7)})`,
          borderRadius: '12px 12px 0 0'
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
          <Avatar
            sx={{
              bgcolor: alpha(color, 0.15),
              color: color,
              width: 40,
              height: 40,
              mr: 1.5
            }}
          >
            {icon}
          </Avatar>
          <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{ height: height }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
};

const EvaluationCharts = ({ groupedData }) => {
  const theme = useTheme();

  // Calculate total statistics
  const totalStats = useMemo(() => {
    let totalDocs = 0;
    let completed = 0;
    let pending = 0;
    let inProgress = 0;
    let draft = 0;

    groupedData.forEach(group => {
      group.documents?.forEach(doc => {
        totalDocs++;
        if (doc.status === 'completed') completed++;
        else if (doc.status === 'submitted' && 
                 (doc.approvalStatus === 'pending' || doc.approvalStatus === 'in_progress')) {
          pending++;
        } else if (doc.status === 'in_progress') inProgress++;
        else if (doc.status === 'draft') draft++;
      });
    });

    return { totalDocs, completed, pending, inProgress, draft };
  }, [groupedData]);

  // Calculate status distribution
  const statusData = useMemo(() => {
    const statusCounts = {};
    groupedData.forEach(group => {
      group.documents?.forEach(doc => {
        statusCounts[doc.status] = (statusCounts[doc.status] || 0) + 1;
      });
    });

    const statusLabels = {
      draft: 'Draft',
      sent: 'Sent',
      in_progress: 'In Progress',
      submitted: 'Submitted',
      completed: 'Completed',
      archived: 'Archived'
    };

    return Object.entries(statusCounts)
      .map(([status, count]) => ({
        name: statusLabels[status] || status,
        value: count,
        status,
        fill: COLORS.status[status] || '#8884d8'
      }))
      .sort((a, b) => b.value - a.value);
  }, [groupedData]);

  // Calculate department/project distribution
  const departmentData = useMemo(() => {
    return groupedData
      .map(group => ({
        name: (group.project?.name || group.department?.name || 'Unknown').substring(0, 15),
        fullName: group.project?.name || group.department?.name || 'Unknown',
        documents: group.documents?.length || 0,
        completed: group.documents?.filter(d => d.status === 'completed').length || 0,
        pending: group.documents?.filter(d => 
          d.status === 'submitted' && 
          (d.approvalStatus === 'pending' || d.approvalStatus === 'in_progress')
        ).length || 0
      }))
      .sort((a, b) => b.documents - a.documents)
      .slice(0, 8);
  }, [groupedData]);

  // Calculate approval level distribution
  const approvalLevelData = useMemo(() => {
    const levelCounts = { level0: 0, level1: 0, level2: 0, level3: 0, level4: 0 };
    
    groupedData.forEach(group => {
      group.documents?.forEach(doc => {
        if (doc.status === 'submitted' && 
            (doc.approvalStatus === 'pending' || doc.approvalStatus === 'in_progress')) {
          if (doc.currentApprovalLevel === 0 || 
              (doc.level0ApprovalStatus === 'pending' && doc.status === 'submitted')) {
            levelCounts.level0++;
          } else if (doc.currentApprovalLevel === 1) {
            levelCounts.level1++;
          } else if (doc.currentApprovalLevel === 2) {
            levelCounts.level2++;
          } else if (doc.currentApprovalLevel === 3) {
            levelCounts.level3++;
          } else if (doc.currentApprovalLevel === 4) {
            levelCounts.level4++;
          }
        }
      });
    });

    return Object.entries(levelCounts)
      .filter(([_, count]) => count > 0)
      .map(([level, count]) => ({
        name: level === 'level0' ? 'Level 0' : `Level ${level.slice(-1)}`,
        value: count,
        level,
        fill: COLORS.approval[level] || '#9c27b0'
      }));
  }, [groupedData]);

  // Calculate score distribution
  const scoreData = useMemo(() => {
    const scoreRanges = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0
    };

    groupedData.forEach(group => {
      group.documents?.forEach(doc => {
        if (doc.status === 'completed' && doc.percentage !== undefined) {
          const score = doc.percentage;
          if (score <= 20) scoreRanges['0-20']++;
          else if (score <= 40) scoreRanges['21-40']++;
          else if (score <= 60) scoreRanges['41-60']++;
          else if (score <= 80) scoreRanges['61-80']++;
          else scoreRanges['81-100']++;
        }
      });
    });

    return Object.entries(scoreRanges)
      .map(([range, count]) => ({
        name: range,
        value: count
      }))
      .filter(item => item.value > 0);
  }, [groupedData]);

  // Calculate completion rate
  const completionRate = useMemo(() => {
    if (totalStats.totalDocs === 0) return 0;
    return Math.round((totalStats.completed / totalStats.totalDocs) * 100);
  }, [totalStats]);

  return (
    <Box mb={4}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <AssessmentIcon sx={{ fontSize: 32, color: theme.palette.primary.main, mr: 1.5 }} />
        <Typography variant="h5" fontWeight="bold">
          Evaluation Analytics Dashboard
        </Typography>
      </Box>

      {/* Summary Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Documents"
            value={totalStats.totalDocs}
            icon={<BarChartIcon />}
            color={theme.palette.primary.main}
            subtitle="All evaluation documents"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completed"
            value={totalStats.completed}
            icon={<CheckCircleIcon />}
            color={theme.palette.success.main}
            subtitle={`${completionRate}% completion rate`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Approval"
            value={totalStats.pending}
            icon={<PendingActionsIcon />}
            color={theme.palette.warning.main}
            subtitle="Awaiting review"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="In Progress"
            value={totalStats.inProgress}
            icon={<TrendingUpIcon />}
            color={theme.palette.info.main}
            subtitle="Currently being evaluated"
          />
        </Grid>
      </Grid>

      {/* Charts Grid */}
      <Grid container spacing={3}>
        {/* Status Distribution - Pie Chart */}
        <Grid item xs={12} md={6}>
          <ChartCard
            title="Status Distribution"
            icon={<AssessmentIcon />}
            color={theme.palette.primary.main}
            height={350}
          >
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => 
                      percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''
                    }
                    outerRadius={110}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span style={{ fontSize: '12px' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  No data available
                </Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Approval Level Distribution */}
        <Grid item xs={12} md={6}>
          <ChartCard
            title="Pending Approvals by Level"
            icon={<PendingActionsIcon />}
            color={theme.palette.warning.main}
            height={350}
          >
            {approvalLevelData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={approvalLevelData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="approvalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.palette.warning.main} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={theme.palette.warning.main} stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    stroke={theme.palette.text.secondary}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke={theme.palette.text.secondary}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="value" 
                    name="Pending Documents"
                    radius={[8, 8, 0, 0]}
                  >
                    {approvalLevelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  No pending approvals
                </Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Department/Project Distribution */}
        <Grid item xs={12} md={8}>
          <ChartCard
            title={`Documents by ${groupedData[0]?.project ? 'Project' : 'Department'}`}
            icon={<BusinessIcon />}
            color={theme.palette.info.main}
            height={350}
          >
            {departmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={departmentData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                >
                  <defs>
                    <linearGradient id="docGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.palette.info.main} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={theme.palette.info.main} stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0.2}/>
                    </linearGradient>
                    <linearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.palette.warning.main} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={theme.palette.warning.main} stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={100}
                    interval={0}
                    tick={{ fontSize: 11 }}
                    stroke={theme.palette.text.secondary}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke={theme.palette.text.secondary}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={(value, name) => {
                      if (name === 'documents') return [`${value} Total`, 'Total Documents'];
                      if (name === 'completed') return [`${value} Completed`, 'Completed'];
                      if (name === 'pending') return [`${value} Pending`, 'Pending Approval'];
                      return value;
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="documents" 
                    name="Total Documents" 
                    fill="url(#docGradient)"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar 
                    dataKey="completed" 
                    name="Completed" 
                    fill="url(#completedGradient)"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar 
                    dataKey="pending" 
                    name="Pending Approval" 
                    fill="url(#pendingGradient)"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  No data available
                </Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Score Distribution */}
        <Grid item xs={12} md={4}>
          <ChartCard
            title="Score Distribution"
            icon={<TrendingUpIcon />}
            color={theme.palette.success.main}
            height={350}
          >
            {scoreData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    stroke={theme.palette.text.secondary}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke={theme.palette.text.secondary}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="value" 
                    name="Number of Evaluations" 
                    fill="url(#scoreGradient)"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  No completed evaluations with scores available
                </Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default React.memo(EvaluationCharts);
