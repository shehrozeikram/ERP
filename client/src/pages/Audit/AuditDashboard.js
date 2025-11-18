import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  alpha,
  useTheme,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Container,
  Button,
  Skeleton
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Security,
  Assessment,
  Warning,
  CheckCircle,
  Timeline,
  Download,
  Refresh,
  Dashboard as DashboardIcon,
  BugReport as FindingsIcon,
  Assignment as CARIcon,
  History as TrailIcon,
  Visibility
} from '@mui/icons-material';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const AuditDashboard = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState([]);
  const [overdueActions, setOverdueActions] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [
        statsResponse,
        activitiesResponse,
        suspiciousResponse,
        overdueResponse
      ] = await Promise.allSettled([
        api.get('/audit/statistics'),
        api.get('/audit/trail/realtime'),
        api.get('/audit/trail?isSuspicious=true&limit=10'),
        api.get('/audit/findings?status=open&limit=10')
      ]);

      const stats = statsResponse.status === 'fulfilled' ? statsResponse.value.data.data : null;
      const activities = activitiesResponse.status === 'fulfilled' ? activitiesResponse.value.data.data : null;
      const suspicious = suspiciousResponse.status === 'fulfilled' ? suspiciousResponse.value.data.data.trailEntries : [];
      const overdue = overdueResponse.status === 'fulfilled' ? overdueResponse.value.data.data.findings : [];

      setDashboardData(stats);
      setRecentActivities(activities?.recentActivities || []);
      setSuspiciousActivities(suspicious);
      setOverdueActions(overdue);

    } catch (error) {
      console.error('Error fetching audit dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return theme.palette.error.main;
      case 'high': return theme.palette.warning.main;
      case 'medium': return theme.palette.info.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return theme.palette.error.main;
      case 'high': return theme.palette.warning.main;
      case 'medium': return theme.palette.info.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const StatCard = ({ title, value, subtitle, icon, color, trend, onClick }) => (
    <Card 
      sx={{ 
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8]
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: alpha(color, 0.1), color, mr: 2 }}>
            {icon}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Box>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {subtitle}
          </Typography>
        )}
        {trend !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {trend > 0 ? (
              <TrendingUp sx={{ color: 'success.main', fontSize: 16, mr: 0.5 }} />
            ) : trend < 0 ? (
              <TrendingDown sx={{ color: 'error.main', fontSize: 16, mr: 0.5 }} />
            ) : null}
            <Typography 
              variant="body2" 
              sx={{ 
                color: trend > 0 ? 'success.main' : trend < 0 ? 'error.main' : 'text.secondary',
                fontWeight: 500
              }}
            >
              {trend > 0 ? '+' : ''}{trend}%
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const ActivityItem = ({ activity }) => (
    <ListItem sx={{ px: 0 }}>
      <ListItemIcon>
        <Avatar sx={{ 
          bgcolor: alpha(getRiskColor(activity.riskLevel), 0.1), 
          color: getRiskColor(activity.riskLevel),
          width: 32,
          height: 32
        }}>
          {activity.action === 'create' && <CheckCircle />}
          {activity.action === 'update' && <TrendingUp />}
          {activity.action === 'delete' && <Warning />}
          {activity.action === 'read' && <Visibility />}
          {activity.action === 'login' && <Security />}
          {activity.action === 'logout' && <Security />}
          {activity.action === 'export' && <Download />}
        </Avatar>
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {activity.userId?.firstName} {activity.userId?.lastName}
          </Typography>
        }
        secondary={
          <Box>
            <Typography variant="caption" color="text.secondary">
              {activity.description}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <Chip 
                label={activity.action} 
                size="small" 
                sx={{ 
                  mr: 1, 
                  bgcolor: alpha(getRiskColor(activity.riskLevel), 0.1),
                  color: getRiskColor(activity.riskLevel)
                }} 
              />
              <Typography variant="caption" color="text.secondary">
                {new Date(activity.timestamp).toLocaleString()}
              </Typography>
            </Box>
          </Box>
        }
      />
      {activity.isSuspicious && (
        <Chip 
          label="Suspicious" 
          size="small" 
          color="error" 
          icon={<Warning />}
        />
      )}
    </ListItem>
  );

  const FindingItem = ({ finding }) => (
    <ListItem sx={{ px: 0 }}>
      <ListItemIcon>
        <Avatar sx={{ 
          bgcolor: alpha(getSeverityColor(finding.severity), 0.1), 
          color: getSeverityColor(finding.severity),
          width: 32,
          height: 32
        }}>
          <FindingsIcon />
        </Avatar>
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {finding.title}
          </Typography>
        }
        secondary={
          <Box>
            <Typography variant="caption" color="text.secondary">
              {finding.audit?.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <Chip 
                label={finding.severity} 
                size="small" 
                sx={{ 
                  mr: 1, 
                  bgcolor: alpha(getSeverityColor(finding.severity), 0.1),
                  color: getSeverityColor(finding.severity)
                }} 
              />
              <Chip 
                label={finding.status} 
                size="small" 
                variant="outlined"
                sx={{ mr: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {new Date(finding.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>
        }
      />
    </ListItem>
  );

  const DashboardSkeleton = () => (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Skeleton variant="text" width={260} height={48} />
      <Skeleton variant="text" width={380} height={28} sx={{ mb: 3 }} />
      <Grid container spacing={3}>
        {Array.from({ length: 4 }).map((_, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Skeleton variant="rounded" height={170} />
          </Grid>
        ))}
        <Grid item xs={12} md={8}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
        <Grid item xs={12} md={4}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton variant="rounded" height={280} />
        </Grid>
        <Grid item xs={12} md={6}>
          <Skeleton variant="rounded" height={280} />
        </Grid>
      </Grid>
    </Container>
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!dashboardData) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Failed to load audit dashboard data. Please try again.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Audit Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive audit oversight and compliance monitoring
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={fetchDashboardData}
            sx={{ mr: 2 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
          >
            Export Report
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Audits"
            value={dashboardData.audits?.totalAudits || 0}
            subtitle={`${dashboardData.audits?.completedAudits || 0} completed`}
            icon={<Assessment />}
            color={theme.palette.primary.main}
            trend={12.5}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Findings"
            value={dashboardData.findings?.totalFindings || 0}
            subtitle={`${dashboardData.findings?.criticalFindings || 0} critical`}
            icon={<FindingsIcon />}
            color={theme.palette.warning.main}
            trend={-5.2}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Corrective Actions"
            value={dashboardData.correctiveActions?.totalCARs || 0}
            subtitle={`${dashboardData.correctiveActions?.overdueCARs || 0} overdue`}
            icon={<CARIcon />}
            color={theme.palette.info.main}
            trend={8.1}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Compliance Rate"
            value={`${Math.round(((dashboardData.audits?.completedAudits || 0) / Math.max(dashboardData.audits?.totalAudits || 1, 1)) * 100)}%`}
            subtitle="Overall compliance"
            icon={<CheckCircle />}
            color={theme.palette.success.main}
            trend={3.7}
          />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Audit Activity Trend (Last 30 Days)
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { date: '2024-01-01', audits: 12, findings: 8, actions: 15 },
                    { date: '2024-01-02', audits: 19, findings: 12, actions: 22 },
                    { date: '2024-01-03', audits: 15, findings: 10, actions: 18 },
                    { date: '2024-01-04', audits: 22, findings: 16, actions: 25 },
                    { date: '2024-01-05', audits: 18, findings: 14, actions: 20 },
                    { date: '2024-01-06', audits: 25, findings: 20, actions: 28 },
                    { date: '2024-01-07', audits: 20, findings: 18, actions: 24 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Area type="monotone" dataKey="audits" stackId="1" stroke={theme.palette.primary.main} fill={alpha(theme.palette.primary.main, 0.3)} />
                    <Area type="monotone" dataKey="findings" stackId="2" stroke={theme.palette.warning.main} fill={alpha(theme.palette.warning.main, 0.3)} />
                    <Area type="monotone" dataKey="actions" stackId="3" stroke={theme.palette.info.main} fill={alpha(theme.palette.info.main, 0.3)} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Findings by Severity
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Critical', value: dashboardData.findings?.criticalFindings || 0, color: theme.palette.error.main },
                        { name: 'High', value: dashboardData.findings?.highFindings || 0, color: theme.palette.warning.main },
                        { name: 'Medium', value: dashboardData.findings?.mediumFindings || 0, color: theme.palette.info.main },
                        { name: 'Low', value: dashboardData.findings?.lowFindings || 0, color: theme.palette.success.main }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: 'Critical', value: dashboardData.findings?.criticalFindings || 0, color: theme.palette.error.main },
                        { name: 'High', value: dashboardData.findings?.highFindings || 0, color: theme.palette.warning.main },
                        { name: 'Medium', value: dashboardData.findings?.mediumFindings || 0, color: theme.palette.info.main },
                        { name: 'Low', value: dashboardData.findings?.lowFindings || 0, color: theme.palette.success.main }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Activity Lists */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Recent Activities
                </Typography>
                <Badge badgeContent={recentActivities.length} color="primary">
                  <Timeline />
                </Badge>
              </Box>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {recentActivities.slice(0, 5).map((activity, index) => (
                  <ActivityItem key={index} activity={activity} />
                ))}
                {recentActivities.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No recent activities
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Suspicious Activities
                </Typography>
                <Badge badgeContent={suspiciousActivities.length} color="error">
                  <Warning />
                </Badge>
              </Box>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {suspiciousActivities.slice(0, 5).map((activity, index) => (
                  <ActivityItem key={index} activity={activity} />
                ))}
                {suspiciousActivities.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No suspicious activities
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Open Findings
                </Typography>
                <Badge badgeContent={overdueActions.length} color="warning">
                  <FindingsIcon />
                </Badge>
              </Box>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {overdueActions.slice(0, 5).map((finding, index) => (
                  <FindingItem key={index} finding={finding} />
                ))}
                {overdueActions.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No open findings
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default AuditDashboard;
