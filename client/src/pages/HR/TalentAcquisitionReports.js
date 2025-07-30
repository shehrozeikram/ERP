import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Container,
  useTheme,
  alpha,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider
} from '@mui/material';
import {
  TrendingUp,
  People,
  Business,
  Assignment,
  Schedule,
  CheckCircle,
  Warning,
  Error,
  Download,
  FilterList,
  BarChart,
  PieChart,
  Timeline,
  Assessment
} from '@mui/icons-material';
import applicationService from '../../services/applicationService';
import candidateService from '../../services/candidateService';
import jobPostingService from '../../services/jobPostingService';

const TalentAcquisitionReports = () => {
  const theme = useTheme();
  
  // State
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [filters, setFilters] = useState({
    period: '30_days',
    department: 'all',
    status: 'all'
  });
  
  // Data state
  const [stats, setStats] = useState({
    totalApplications: 0,
    totalCandidates: 0,
    totalJobPostings: 0,
    applicationsThisMonth: 0,
    hiredThisMonth: 0,
    conversionRate: 0,
    averageTimeToHire: 0,
    topDepartments: [],
    applicationStatusBreakdown: [],
    monthlyTrends: [],
    candidateSources: []
  });

  // Load reports data
  const loadReportsData = async () => {
    setLoading(true);
    try {
      // Load applications
      const applicationsResponse = await applicationService.getApplications();
      const applications = applicationsResponse.data.docs || [];
      
      // Load candidates
      const candidatesResponse = await candidateService.getCandidates();
      const candidates = candidatesResponse.data.docs || [];
      
      // Load job postings
      const jobPostingsResponse = await jobPostingService.getJobPostings();
      const jobPostings = jobPostingsResponse.data.docs || [];
      
      // Calculate statistics
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      const applicationsThisMonth = applications.filter(app => 
        new Date(app.createdAt) >= thirtyDaysAgo
      );
      
      const hiredThisMonth = applications.filter(app => 
        app.status === 'hired' && new Date(app.updatedAt) >= thirtyDaysAgo
      );
      
      // Calculate conversion rate
      const conversionRate = applications.length > 0 
        ? ((hiredThisMonth.length / applications.length) * 100).toFixed(1)
        : 0;
      
      // Application status breakdown
      const statusBreakdown = applications.reduce((acc, app) => {
        acc[app.status] = (acc[app.status] || 0) + 1;
        return acc;
      }, {});
      
      const applicationStatusBreakdown = Object.entries(statusBreakdown).map(([status, count]) => ({
        status,
        count,
        percentage: ((count / applications.length) * 100).toFixed(1)
      }));
      
      // Top departments
      const departmentStats = jobPostings.reduce((acc, job) => {
        const deptName = job.department?.name || 'Unknown';
        acc[deptName] = (acc[deptName] || 0) + 1;
        return acc;
      }, {});
      
      const topDepartments = Object.entries(departmentStats)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      // Candidate sources
      const sourceStats = candidates.reduce((acc, candidate) => {
        const source = candidate.source || 'unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {});
      
      const candidateSources = Object.entries(sourceStats).map(([source, count]) => ({
        source,
        count,
        percentage: ((count / candidates.length) * 100).toFixed(1)
      }));
      
      // Monthly trends (last 6 months)
      const monthlyTrends = [];
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        
        const monthApplications = applications.filter(app => {
          const appDate = new Date(app.createdAt);
          return appDate >= month && appDate <= monthEnd;
        });
        
        monthlyTrends.push({
          month: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          applications: monthApplications.length,
          hired: monthApplications.filter(app => app.status === 'hired').length
        });
      }
      
      setStats({
        totalApplications: applications.length,
        totalCandidates: candidates.length,
        totalJobPostings: jobPostings.length,
        applicationsThisMonth: applicationsThisMonth.length,
        hiredThisMonth: hiredThisMonth.length,
        conversionRate: parseFloat(conversionRate),
        averageTimeToHire: 45, // Placeholder - would need actual calculation
        topDepartments,
        applicationStatusBreakdown,
        monthlyTrends,
        candidateSources
      });
      
    } catch (error) {
      console.error('Error loading reports data:', error);
      setSnackbar({
        open: true,
        message: 'Error loading reports data',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportsData();
  }, [filters]);

  const getStatusColor = (status) => {
    const colors = {
      applied: 'info',
      screening: 'warning',
      shortlisted: 'primary',
      interview_scheduled: 'warning',
      interviewed: 'primary',
      technical_test: 'warning',
      reference_check: 'info',
      offer_sent: 'success',
      offer_accepted: 'success',
      offer_declined: 'error',
      hired: 'success',
      rejected: 'error',
      withdrawn: 'default'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labels = {
      applied: 'Applied',
      screening: 'Screening',
      shortlisted: 'Shortlisted',
      interview_scheduled: 'Interview Scheduled',
      interviewed: 'Interviewed',
      technical_test: 'Technical Test',
      reference_check: 'Reference Check',
      offer_sent: 'Offer Sent',
      offer_accepted: 'Offer Accepted',
      offer_declined: 'Offer Declined',
      hired: 'Hired',
      rejected: 'Rejected',
      withdrawn: 'Withdrawn'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
          <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
          Talent Acquisition Reports & Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive insights into your recruitment process and performance metrics
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Time Period</InputLabel>
                <Select
                  value={filters.period}
                  onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value }))}
                  label="Time Period"
                >
                  <MenuItem value="7_days">Last 7 Days</MenuItem>
                  <MenuItem value="30_days">Last 30 Days</MenuItem>
                  <MenuItem value="90_days">Last 90 Days</MenuItem>
                  <MenuItem value="6_months">Last 6 Months</MenuItem>
                  <MenuItem value="1_year">Last Year</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={filters.department}
                  onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                  label="Department"
                >
                  <MenuItem value="all">All Departments</MenuItem>
                  {stats.topDepartments.map((dept) => (
                    <MenuItem key={dept.name} value={dept.name}>{dept.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  label="Status"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  {stats.applicationStatusBreakdown.map((item) => (
                    <MenuItem key={item.status} value={item.status}>
                      {getStatusLabel(item.status)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                startIcon={<Download />}
                fullWidth
                onClick={() => {
                  setSnackbar({
                    open: true,
                    message: 'Export functionality will be implemented soon',
                    severity: 'info'
                  });
                }}
              >
                Export Report
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assignment sx={{ color: theme.palette.primary.main, mr: 1 }} />
                <Typography variant="h6" color="primary">
                  Total Applications
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {stats.totalApplications}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stats.applicationsThisMonth} this month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <People sx={{ color: theme.palette.success.main, mr: 1 }} />
                <Typography variant="h6" color="success.main">
                  Total Candidates
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" color="success.main">
                {stats.totalCandidates}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active in system
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.info.main, 0.1) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Business sx={{ color: theme.palette.info.main, mr: 1 }} />
                <Typography variant="h6" color="info.main">
                  Job Postings
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" color="info.main">
                {stats.totalJobPostings}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active positions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ color: theme.palette.warning.main, mr: 1 }} />
                <Typography variant="h6" color="warning.main">
                  Conversion Rate
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold" color="warning.main">
                {stats.conversionRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stats.hiredThisMonth} hired this month
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Analytics */}
      <Grid container spacing={3}>
        {/* Application Status Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <PieChart sx={{ mr: 1, verticalAlign: 'middle' }} />
                Application Status Breakdown
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={1}>
                {stats.applicationStatusBreakdown.map((item) => (
                  <Box key={item.status} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Chip 
                        label={getStatusLabel(item.status)} 
                        color={getStatusColor(item.status)} 
                        size="small" 
                        sx={{ mr: 1 }}
                      />
                      <Typography variant="body2">
                        {item.count} applications
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                      {item.percentage}%
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Departments */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <BarChart sx={{ mr: 1, verticalAlign: 'middle' }} />
                Top Departments by Job Postings
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={1}>
                {stats.topDepartments.map((dept, index) => (
                  <Box key={dept.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Chip 
                        label={`#${index + 1}`} 
                        color="primary" 
                        size="small" 
                        sx={{ mr: 1 }}
                      />
                      <Typography variant="body2">
                        {dept.name}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                      {dept.count} positions
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Trends */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <Timeline sx={{ mr: 1, verticalAlign: 'middle' }} />
                Monthly Application Trends
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={1}>
                {stats.monthlyTrends.map((trend) => (
                  <Box key={trend.month} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" fontWeight="medium">
                      {trend.month}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {trend.applications} applications
                      </Typography>
                      <Chip 
                        label={`${trend.hired} hired`} 
                        color="success" 
                        size="small"
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Candidate Sources */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
                <People sx={{ mr: 1, verticalAlign: 'middle' }} />
                Candidate Sources
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={1}>
                {stats.candidateSources.map((source) => (
                  <Box key={source.source} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                      {source.source.replace('_', ' ')}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {source.count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({source.percentage}%)
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Performance Insights */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main }}>
            <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
            Performance Insights
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Alert severity="info" icon={<TrendingUp />}>
                <Typography variant="subtitle2" gutterBottom>
                  Conversion Rate
                </Typography>
                <Typography variant="body2">
                  Your current conversion rate is {stats.conversionRate}%. 
                  Industry average is typically 15-20%.
                </Typography>
              </Alert>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Alert severity="success" icon={<CheckCircle />}>
                <Typography variant="subtitle2" gutterBottom>
                  Monthly Growth
                </Typography>
                <Typography variant="body2">
                  {stats.applicationsThisMonth} applications this month shows 
                  strong interest in your positions.
                </Typography>
              </Alert>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Alert severity="warning" icon={<Schedule />}>
                <Typography variant="subtitle2" gutterBottom>
                  Time to Hire
                </Typography>
                <Typography variant="body2">
                  Average time to hire is {stats.averageTimeToHire} days. 
                  Consider optimizing your process.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default TalentAcquisitionReports; 