import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Button,
  LinearProgress,
  Tooltip,
  Badge,
  Tabs,
  Tab,
  Alert,
  Skeleton
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  AttachMoney as MoneyIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Person as PersonIcon,
  BusinessCenter as BusinessCenterIcon,
  Assignment as AssignmentIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import crmService from '../../services/crmService';

const CRMDashboard = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, [refreshKey]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await crmService.getDashboard();
      setDashboardData(response.data);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const navigateToSection = (section) => {
    navigate(`/crm/${section}`);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Won':
      case 'Closed Won':
      case 'Active':
      case 'Customer':
        return <CheckCircleIcon sx={{ color: '#4CAF50' }} />;
      case 'Lost':
      case 'Closed Lost':
      case 'Inactive':
      case 'Former Customer':
        return <CancelIcon sx={{ color: '#F44336' }} />;
      case 'New':
      case 'Prospecting':
      case 'Lead':
        return <InfoIcon sx={{ color: '#2196F3' }} />;
      case 'Negotiation':
      case 'Proposal':
      case 'Qualification':
      case 'Prospect':
        return <WarningIcon sx={{ color: '#FF9800' }} />;
      default:
        return <InfoIcon sx={{ color: '#9E9E9E' }} />;
    }
  };

  const StatCard = ({ title, value, icon, color, subtitle, onClick, trend }) => (
    <Card 
      sx={{ 
        height: '100%', 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: 4
        } : {}
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: color }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {title}
            </Typography>
            {subtitle && (
              <Box display="flex" alignItems="center" sx={{ mt: 1 }}>
                {trend && (
                  trend > 0 ? 
                    <ArrowUpIcon sx={{ color: '#4CAF50', fontSize: 16, mr: 0.5 }} /> :
                    <ArrowDownIcon sx={{ color: '#F44336', fontSize: 16, mr: 0.5 }} />
                )}
                <Typography variant="caption" color="text.secondary">
                  {subtitle}
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  const PipelineCard = ({ stage, count, amount, probability }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" component="div">
            {stage}
          </Typography>
          <Chip 
            label={`${probability}%`} 
            size="small" 
            color={probability >= 75 ? 'success' : probability >= 50 ? 'warning' : 'default'}
          />
        </Box>
        <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
          {count}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {crmService.formatCurrency(amount || 0)}
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={probability} 
          sx={{ 
            height: 8, 
            borderRadius: 4,
            backgroundColor: '#E0E0E0',
            '& .MuiLinearProgress-bar': {
              backgroundColor: probability >= 75 ? '#4CAF50' : probability >= 50 ? '#FF9800' : '#2196F3'
            }
          }} 
        />
      </CardContent>
    </Card>
  );

  const RecentActivityItem = ({ activity }) => (
    <ListItem sx={{ px: 0 }}>
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: crmService.getStatusColor(activity.type) }}>
          {activity.type === 'Call' && <PhoneIcon />}
          {activity.type === 'Email' && <EmailIcon />}
          {activity.type === 'Meeting' && <ScheduleIcon />}
          {activity.type === 'Proposal' && <AssignmentIcon />}
          {activity.type === 'Follow-up' && <TimelineIcon />}
          {activity.type === 'Other' && <InfoIcon />}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={activity.subject}
        secondary={
          <Box>
            <Typography variant="body2" color="text.secondary">
              {activity.description}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {crmService.getTimeAgo(activity.date)} • {activity.duration ? `${activity.duration} min` : ''}
            </Typography>
          </Box>
        }
      />
    </ListItem>
  );

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Typography variant="h4" gutterBottom>
            CRM Dashboard
          </Typography>
          <Skeleton variant="circular" width={40} height={40} />
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={handleRefresh}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          CRM Dashboard
        </Typography>
        <Box>
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={handleRefresh} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigateToSection('leads/new')}
            sx={{ mr: 1 }}
          >
            New Lead
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigateToSection('opportunities/new')}
          >
            New Opportunity
          </Button>
        </Box>
      </Box>

      {/* Overview Statistics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Leads"
            value={dashboardData?.overview?.totalLeads || 0}
            icon={<PeopleIcon />}
            color="#2196F3"
            subtitle="Active leads in pipeline"
            onClick={() => navigateToSection('leads')}
            trend={5}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Contacts"
            value={dashboardData?.overview?.totalContacts || 0}
            icon={<PersonIcon />}
            color="#4CAF50"
            subtitle="Customer contacts"
            onClick={() => navigateToSection('contacts')}
            trend={12}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Companies"
            value={dashboardData?.overview?.totalCompanies || 0}
            icon={<BusinessIcon />}
            color="#FF9800"
            subtitle="Business accounts"
            onClick={() => navigateToSection('companies')}
            trend={8}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Opportunities"
            value={dashboardData?.overview?.totalOpportunities || 0}
            icon={<MoneyIcon />}
            color="#9C27B0"
            subtitle="Active opportunities"
            onClick={() => navigateToSection('opportunities')}
            trend={-3}
          />
        </Grid>
      </Grid>

      {/* Tabs for different views */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Pipeline Overview" />
          <Tab label="Lead Statistics" />
          <Tab label="Recent Activities" />
          <Tab label="Quick Actions" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardHeader
                title="Sales Pipeline"
                subheader="Opportunity stages and values"
                action={
                  <Button size="small" onClick={() => navigateToSection('opportunities')}>
                    View All
                  </Button>
                }
              />
              <CardContent>
                <Grid container spacing={2}>
                  {dashboardData?.pipelineSummary?.map((stage) => (
                    <Grid item xs={12} sm={6} md={4} key={stage._id}>
                      <PipelineCard
                        stage={stage._id}
                        count={stage.count}
                        amount={stage.totalAmount}
                        probability={crmService.getProbabilityPercentage(stage._id)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardHeader
                title="Lead Status Distribution"
                subheader="Current lead status breakdown"
              />
              <CardContent>
                {dashboardData?.leadStats?.map((stat) => (
                  <Box key={stat._id} mb={2}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Box display="flex" alignItems="center">
                        {getStatusIcon(stat._id)}
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {stat._id}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight="bold">
                        {stat.count}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(stat.count / dashboardData.overview.totalLeads) * 100}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                title="Lead Sources"
                subheader="Where your leads come from"
              />
              <CardContent>
                <Box display="flex" flexDirection="column" gap={2}>
                  {['Website', 'Referral', 'Social Media', 'Cold Call', 'Trade Show'].map((source) => (
                    <Box key={source} display="flex" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2">{source}</Typography>
                      <Chip label={Math.floor(Math.random() * 50) + 10} size="small" />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                title="Conversion Rates"
                subheader="Lead to opportunity conversion"
              />
              <CardContent>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2">New → Contacted</Typography>
                    <Typography variant="body2" fontWeight="bold" color="#4CAF50">
                      85%
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2">Contacted → Qualified</Typography>
                    <Typography variant="body2" fontWeight="bold" color="#FF9800">
                      45%
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2">Qualified → Proposal</Typography>
                    <Typography variant="body2" fontWeight="bold" color="#9C27B0">
                      60%
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2">Proposal → Won</Typography>
                    <Typography variant="body2" fontWeight="bold" color="#4CAF50">
                      35%
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Recent Activities"
                subheader="Latest CRM activities"
                action={
                  <Button size="small" onClick={() => navigateToSection('activities')}>
                    View All
                  </Button>
                }
              />
              <CardContent>
                <List>
                  {dashboardData?.recentActivities?.slice(0, 10).map((activity, index) => (
                    <React.Fragment key={index}>
                      <RecentActivityItem activity={activity} />
                      {index < dashboardData.recentActivities.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Quick Actions" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => navigateToSection('leads/new')}
                      sx={{ mb: 2 }}
                    >
                      Add Lead
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => navigateToSection('contacts/new')}
                      sx={{ mb: 2 }}
                    >
                      Add Contact
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => navigateToSection('companies/new')}
                      sx={{ mb: 2 }}
                    >
                      Add Company
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => navigateToSection('opportunities/new')}
                      sx={{ mb: 2 }}
                    >
                      Add Opportunity
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Quick Reports" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<ViewIcon />}
                      onClick={() => navigateToSection('reports/leads')}
                      sx={{ mb: 2 }}
                    >
                      Lead Report
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<ViewIcon />}
                      onClick={() => navigateToSection('reports/opportunities')}
                      sx={{ mb: 2 }}
                    >
                      Pipeline Report
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<ViewIcon />}
                      onClick={() => navigateToSection('reports/activities')}
                      sx={{ mb: 2 }}
                    >
                      Activity Report
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<ViewIcon />}
                      onClick={() => navigateToSection('reports/performance')}
                      sx={{ mb: 2 }}
                    >
                      Performance Report
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default CRMDashboard; 