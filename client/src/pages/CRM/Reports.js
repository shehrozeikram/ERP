import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  TextField,
  Grid,
  Card,
  CardContent,
  Avatar,
  Alert,
  Skeleton,
  LinearProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Business as BusinessIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckCircleIcon,
  BarChart as BarChartIcon,
  Dashboard as DashboardIcon,
  Group as GroupIcon,
  Phone as PhoneIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';

const Reports = () => {
  // State management
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Report data
  const [dashboardData, setDashboardData] = useState(null);
  const [salesPipelineData, setSalesPipelineData] = useState(null);
  const [leadConversionData, setLeadConversionData] = useState(null);
  const [campaignPerformanceData, setCampaignPerformanceData] = useState(null);
  const [userPerformanceData, setUserPerformanceData] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: 'dashboard'
  });
  
  // Active tab
  const [activeTab, setActiveTab] = useState(0);

  // Load report data
  const loadReportData = useCallback(async (reportType = 'dashboard') => {
    try {
      setError(null);
      
      const params = {
        ...filters,
        _t: Date.now()
      };
      
      let response;
      switch (reportType) {
        case 'dashboard':
          response = await api.get('/reports/dashboard', { params });
          setDashboardData(response.data.data);
          break;
        case 'sales-pipeline':
          response = await api.get('/reports/sales-pipeline', { params });
          setSalesPipelineData(response.data.data);
          break;
        case 'lead-conversion':
          response = await api.get('/reports/lead-conversion', { params });
          setLeadConversionData(response.data.data);
          break;
        case 'campaign-performance':
          response = await api.get('/reports/campaign-performance', { params });
          setCampaignPerformanceData(response.data.data);
          break;
        case 'user-performance':
          response = await api.get('/reports/user-performance', { params });
          setUserPerformanceData(response.data.data);
          break;
        default:
          response = await api.get('/reports/dashboard', { params });
          setDashboardData(response.data.data);
      }
      
      console.log('Report response:', response);
      
    } catch (err) {
      console.error('Error loading report data:', err);
      setError('Failed to load report data. Please try again.');
    }
  }, [filters]);

  useEffect(() => {
    console.log('=== REPORTS COMPONENT MOUNTED ===');
    loadReportData();
  }, [loadReportData]);

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    const reportTypes = ['dashboard', 'sales-pipeline', 'lead-conversion', 'campaign-performance', 'user-performance'];
    loadReportData(reportTypes[newValue]);
  };

  // Export report
  const handleExportReport = async (type, format = 'json') => {
    try {
      const params = {
        ...filters,
        format,
        _t: Date.now()
      };
      
      const response = await api.get(`/reports/export/${type}`, { 
        params,
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      
      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${type}-report.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const dataStr = JSON.stringify(response.data.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${type}-report.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      
      setSuccess('Report exported successfully!');
    } catch (err) {
      setError('Failed to export report. Please try again.');
    }
  };

  // Format currency
  const formatCurrency = (amount, currency = 'PKR') => {
    if (!amount) return '₨0';
    return formatPKR(amount);
  };

  // Format percentage
  const formatPercentage = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  // Dashboard Overview Card
  const DashboardCard = ({ title, value, subtitle, icon, color = 'primary', trend = null }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            {trend && (
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingUpIcon 
                  sx={{ 
                    fontSize: 16, 
                    mr: 0.5, 
                    color: trend > 0 ? 'success.main' : 'error.main' 
                  }} 
                />
                <Typography 
                  variant="caption" 
                  color={trend > 0 ? 'success.main' : 'error.main'}
                >
                  {trend > 0 ? '+' : ''}{trend}% from last month
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar sx={{ bgcolor: `${color}.main`, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  // Sales Pipeline Component
  const SalesPipelineReport = () => {
    if (!salesPipelineData) return <Skeleton variant="rectangular" height={400} />;
    
    return (
      <Box>
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Total Opportunities"
              value={salesPipelineData.totalOpportunities || 0}
              icon={<BusinessIcon />}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Total Value"
              value={formatCurrency(salesPipelineData.totalValue || 0)}
              icon={<MoneyIcon />}
              color="success"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Conversion Rate"
              value={formatPercentage(salesPipelineData.conversionRate || 0)}
              icon={<TrendingUpIcon />}
              color="info"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Closed Won"
              value={salesPipelineData.closedWon || 0}
              icon={<CheckCircleIcon />}
              color="success"
            />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Pipeline by Stage
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Stage</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell align="right">Avg Probability</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {salesPipelineData.pipeline?.map((stage) => (
                      <TableRow key={stage._id}>
                        <TableCell>
                          <Chip 
                            label={stage._id} 
                            size="small" 
                            color="primary" 
                          />
                        </TableCell>
                        <TableCell align="right">{stage.count}</TableCell>
                        <TableCell align="right">{formatCurrency(stage.totalValue)}</TableCell>
                        <TableCell align="right">{formatPercentage(stage.avgProbability)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Performance by User
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell align="right">Opportunities</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell align="right">Closed Won</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {salesPipelineData.opportunitiesByUser?.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>{user.userName}</TableCell>
                        <TableCell align="right">{user.count}</TableCell>
                        <TableCell align="right">{formatCurrency(user.totalValue)}</TableCell>
                        <TableCell align="right">{user.closedWon}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // Lead Conversion Component
  const LeadConversionReport = () => {
    if (!leadConversionData) return <Skeleton variant="rectangular" height={400} />;
    
    return (
      <Box>
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Total Leads"
              value={leadConversionData.conversionFunnel?.totalLeads || 0}
              icon={<PeopleIcon />}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Contact Rate"
              value={formatPercentage(leadConversionData.conversionRates?.contactRate || 0)}
              icon={<PhoneIcon />}
              color="info"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Qualification Rate"
              value={formatPercentage(leadConversionData.conversionRates?.qualificationRate || 0)}
              icon={<AssessmentIcon />}
              color="warning"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Conversion Rate"
              value={formatPercentage(leadConversionData.conversionRates?.conversionRate || 0)}
              icon={<TrendingUpIcon />}
              color="success"
            />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Conversion Funnel
              </Typography>
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Total Leads</Typography>
                  <Typography variant="body2">{leadConversionData.conversionFunnel?.totalLeads || 0}</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={100} 
                  sx={{ height: 8, borderRadius: 4, mb: 2 }}
                />
                
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Contacted</Typography>
                  <Typography variant="body2">{leadConversionData.conversionFunnel?.contacted || 0}</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={leadConversionData.conversionFunnel?.totalLeads > 0 ? 
                    (leadConversionData.conversionFunnel.contacted / leadConversionData.conversionFunnel.totalLeads) * 100 : 0} 
                  sx={{ height: 8, borderRadius: 4, mb: 2 }}
                />
                
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Qualified</Typography>
                  <Typography variant="body2">{leadConversionData.conversionFunnel?.qualified || 0}</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={leadConversionData.conversionFunnel?.contacted > 0 ? 
                    (leadConversionData.conversionFunnel.qualified / leadConversionData.conversionFunnel.contacted) * 100 : 0} 
                  sx={{ height: 8, borderRadius: 4, mb: 2 }}
                />
                
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Converted</Typography>
                  <Typography variant="body2">{leadConversionData.conversionFunnel?.converted || 0}</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={leadConversionData.conversionFunnel?.qualified > 0 ? 
                    (leadConversionData.conversionFunnel.converted / leadConversionData.conversionFunnel.qualified) * 100 : 0} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Leads by Source
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Source</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Avg Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leadConversionData.leadsBySource?.map((source) => (
                      <TableRow key={source._id}>
                        <TableCell>
                          <Chip 
                            label={source._id} 
                            size="small" 
                            color="primary" 
                          />
                        </TableCell>
                        <TableCell align="right">{source.count}</TableCell>
                        <TableCell align="right">{source.avgScore?.toFixed(1) || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // Campaign Performance Component
  const CampaignPerformanceReport = () => {
    if (!campaignPerformanceData) return <Skeleton variant="rectangular" height={400} />;
    
    return (
      <Box>
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Total Campaigns"
              value={campaignPerformanceData.metrics?.totalCampaigns || 0}
              icon={<AssessmentIcon />}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Total Budget"
              value={formatCurrency(campaignPerformanceData.metrics?.totalBudget || 0)}
              icon={<MoneyIcon />}
              color="warning"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Total Revenue"
              value={formatCurrency(campaignPerformanceData.metrics?.totalRevenue || 0)}
              icon={<TrendingUpIcon />}
              color="success"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Overall ROI"
              value={formatPercentage(campaignPerformanceData.overallROI || 0)}
              icon={<BarChartIcon />}
              color="info"
            />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Campaigns by Type
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Budget</TableCell>
                      <TableCell align="right">Revenue</TableCell>
                      <TableCell align="right">ROI</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {campaignPerformanceData.campaignsByType?.map((type) => (
                      <TableRow key={type._id}>
                        <TableCell>
                          <Chip 
                            label={type._id} 
                            size="small" 
                            color="primary" 
                          />
                        </TableCell>
                        <TableCell align="right">{type.count}</TableCell>
                        <TableCell align="right">{formatCurrency(type.totalBudget)}</TableCell>
                        <TableCell align="right">{formatCurrency(type.totalRevenue)}</TableCell>
                        <TableCell align="right">
                          {type.totalBudget > 0 ? 
                            formatPercentage(((type.totalRevenue - type.totalBudget) / type.totalBudget) * 100) : 
                            'N/A'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Top Performing Campaigns
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Campaign</TableCell>
                      <TableCell align="right">Revenue</TableCell>
                      <TableCell align="right">Budget</TableCell>
                      <TableCell align="right">ROI</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {campaignPerformanceData.campaignROI?.slice(0, 5).map((campaign) => (
                      <TableRow key={campaign._id}>
                        <TableCell>{campaign.name}</TableCell>
                        <TableCell align="right">{formatCurrency(campaign.actualRevenue)}</TableCell>
                        <TableCell align="right">{formatCurrency(campaign.budget)}</TableCell>
                        <TableCell align="right">{formatPercentage(campaign.roi)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // User Performance Component
  const UserPerformanceReport = () => {
    if (!userPerformanceData) return <Skeleton variant="rectangular" height={400} />;
    
    return (
      <Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                User Performance - Opportunities
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell align="right">Opportunities</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell align="right">Closed Won</TableCell>
                      <TableCell align="right">Win Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userPerformanceData.userOpportunities?.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>{user.userName}</TableCell>
                        <TableCell align="right">{user.totalOpportunities}</TableCell>
                        <TableCell align="right">{formatCurrency(user.totalValue)}</TableCell>
                        <TableCell align="right">{user.closedWon}</TableCell>
                        <TableCell align="right">
                          {user.totalOpportunities > 0 ? 
                            formatPercentage((user.closedWon / user.totalOpportunities) * 100) : 
                            '0%'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                User Performance - Leads
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell align="right">Leads</TableCell>
                      <TableCell align="right">Qualified</TableCell>
                      <TableCell align="right">Converted</TableCell>
                      <TableCell align="right">Conversion Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userPerformanceData.userLeads?.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>{user.userName}</TableCell>
                        <TableCell align="right">{user.totalLeads}</TableCell>
                        <TableCell align="right">{user.qualifiedLeads}</TableCell>
                        <TableCell align="right">{user.convertedLeads}</TableCell>
                        <TableCell align="right">
                          {user.qualifiedLeads > 0 ? 
                            formatPercentage((user.convertedLeads / user.qualifiedLeads) * 100) : 
                            '0%'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  // Main Dashboard Component
  const DashboardReport = () => {
    if (!dashboardData) return <Skeleton variant="rectangular" height={400} />;
    
    return (
      <Box>
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Total Leads"
              value={dashboardData.leads?.totalLeads || 0}
              subtitle={`${dashboardData.leads?.newLeads || 0} new this month`}
              icon={<PeopleIcon />}
              color="primary"
              trend={12.5}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Total Contacts"
              value={dashboardData.contacts?.totalContacts || 0}
              subtitle={`${dashboardData.contacts?.customers || 0} customers`}
              icon={<GroupIcon />}
              color="info"
              trend={8.2}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Total Opportunities"
              value={dashboardData.opportunities?.totalOpportunities || 0}
              subtitle={formatCurrency(dashboardData.opportunities?.totalValue || 0)}
              icon={<BusinessIcon />}
              color="warning"
              trend={-3.1}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <DashboardCard
              title="Active Campaigns"
              value={dashboardData.campaigns?.activeCampaigns || 0}
              subtitle={`${dashboardData.campaigns?.totalCampaigns || 0} total campaigns`}
              icon={<AssessmentIcon />}
              color="success"
              trend={15.7}
            />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Top Performing Users
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell align="right">Opportunities</TableCell>
                      <TableCell align="right">Value</TableCell>
                      <TableCell align="right">Closed Won</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboardData.topUsers?.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell>{user.firstName} {user.lastName}</TableCell>
                        <TableCell align="right">{user.totalOpportunities}</TableCell>
                        <TableCell align="right">{formatCurrency(user.totalValue)}</TableCell>
                        <TableCell align="right">{user.closedWon}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Monthly Trends
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Month</TableCell>
                      <TableCell align="right">Leads</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboardData.monthlyTrends?.map((trend) => (
                      <TableRow key={`${trend._id.year}-${trend._id.month}`}>
                        <TableCell>
                          {new Date(trend._id.year, trend._id.month - 1).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short' 
                          })}
                        </TableCell>
                        <TableCell align="right">{trend.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          Reports & Analytics
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => handleExportReport('dashboard')}
            sx={{ mr: 1 }}
          >
            Export Dashboard
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => loadReportData()}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              onClick={() => {
                setFilters({ startDate: '', endDate: '', type: 'dashboard' });
                loadReportData();
              }}
              fullWidth
            >
              Clear Filters
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="contained"
              onClick={() => loadReportData()}
              fullWidth
            >
              Apply Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Report Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Dashboard" icon={<DashboardIcon />} />
          <Tab label="Sales Pipeline" icon={<TimelineIcon />} />
          <Tab label="Lead Conversion" icon={<TrendingUpIcon />} />
          <Tab label="Campaign Performance" icon={<AssessmentIcon />} />
          <Tab label="User Performance" icon={<GroupIcon />} />
        </Tabs>
      </Paper>

      {/* Report Content */}
      {activeTab === 0 && <DashboardReport />}
      {activeTab === 1 && <SalesPipelineReport />}
      {activeTab === 2 && <LeadConversionReport />}
      {activeTab === 3 && <CampaignPerformanceReport />}
      {activeTab === 4 && <UserPerformanceReport />}
    </Box>
  );
};

export default Reports; 