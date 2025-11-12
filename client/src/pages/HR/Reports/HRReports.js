import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Container,
  Stack,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  useTheme,
  alpha,
  Fade,
  Zoom
} from '@mui/material';
import {
  Assessment,
  AttachMoney,
  People,
  TrendingUp,
  Download,
  Visibility,
  Refresh,
  FilterList,
  GetApp,
  Description,
  BarChart,
  PieChart,
  TableChart
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const HRReports = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  // Report categories with beautiful cards
  const reportCategories = [
    {
      id: 'payroll',
      title: 'Payroll Reports',
      description: 'Comprehensive payroll analysis and summaries',
      icon: <AttachMoney sx={{ fontSize: 40 }} />,
      color: '#4caf50',
      bgColor: alpha('#4caf50', 0.1),
      reports: [
        {
          id: 'monthly_payroll',
          name: 'Monthly Payroll Summary',
          description: 'Complete monthly payroll breakdown',
          icon: <BarChart />,
          path: '/hr/reports/payroll/monthly'
        },
        {
          id: 'department_payroll',
          name: 'Department-wise Payroll',
          description: 'Payroll analysis by department',
          icon: <People />,
          path: '/hr/reports/payroll/department'
        },
        {
          id: 'salary_analysis',
          name: 'Salary Analysis',
          description: 'Detailed salary structure analysis',
          icon: <TrendingUp />,
          path: '/hr/reports/payroll/salary'
        }
      ]
    },
    {
      id: 'attendance',
      title: 'Attendance Reports',
      description: 'Employee attendance tracking and analysis',
      icon: <People sx={{ fontSize: 40 }} />,
      color: '#2196f3',
      bgColor: alpha('#2196f3', 0.1),
      reports: [
        {
          id: 'monthly_attendance',
          name: 'Monthly Attendance Report',
          description: 'Complete daily attendance records for all employees',
          icon: <TableChart />,
          path: '/hr/reports/attendance/monthly'
        },
        {
          id: 'department_attendance',
          name: 'Department-wise Attendance',
          description: 'Attendance analysis grouped by department',
          icon: <BarChart />,
          path: '/hr/reports/attendance/department'
        },
        {
          id: 'attendance_summary',
          name: 'Attendance Summary',
          description: 'Employee attendance summary and statistics',
          icon: <PieChart />,
          path: '/hr/reports/attendance/summary'
        },
        {
          id: 'monthly_absent',
          name: 'Monthly Absent Report',
          description: 'Monthly absence summary with present and absent percentages',
          icon: <TableChart />,
          path: '/hr/reports/attendance/monthly_absent'
        }
      ]
    },
    {
      id: 'employee',
      title: 'Employee Reports',
      description: 'Employee data and analytics',
      icon: <Assessment sx={{ fontSize: 40 }} />,
      color: '#ff9800',
      bgColor: alpha('#ff9800', 0.1),
      reports: [
        {
          id: 'employee_summary',
          name: 'Employee Summary',
          description: 'Complete employee overview',
          icon: <People />,
          path: '/hr/reports/employee/summary'
        },
        {
          id: 'demographics',
          name: 'Demographics Report',
          description: 'Employee demographic analysis',
          icon: <PieChart />,
          path: '/hr/reports/employee/demographics'
        }
      ]
    }
  ];

  const handleReportClick = (reportPath) => {
    navigate(reportPath);
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: theme.palette.primary.main }}>
          HR Reports & Analytics
        </Typography>
        <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
          Comprehensive reports and analytics for HR insights
        </Typography>
        <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
          <Typography variant="body2">
            <strong>Note:</strong> Currently available payroll data is for September 2025. 
            Select September 2025 in the report filters to view data.
          </Typography>
        </Alert>
      </Box>

      {/* Report Categories */}
      <Grid container spacing={3}>
        {reportCategories.map((category, index) => (
          <Grid item xs={12} md={6} lg={4} key={category.id}>
            <Fade in timeout={300 + index * 100}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8]
                  },
                  border: `2px solid ${category.bgColor}`,
                  borderRadius: 3
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  {/* Category Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: category.bgColor,
                        color: category.color,
                        mr: 2
                      }}
                    >
                      {category.icon}
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
                        {category.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        {category.reports.length} reports available
                      </Typography>
                    </Box>
                  </Box>

                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
                    {category.description}
                  </Typography>

                  {/* Reports List */}
                  <Stack spacing={1}>
                    {category.reports.map((report) => (
                      <Card
                        key={report.id}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            backgroundColor: alpha(category.color, 0.05),
                            transform: 'translateX(4px)'
                          },
                          border: `1px solid ${alpha(category.color, 0.2)}`,
                          borderRadius: 2
                        }}
                        onClick={() => handleReportClick(report.path)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                backgroundColor: alpha(category.color, 0.1),
                                color: category.color,
                                mr: 2
                              }}
                            >
                              {report.icon}
                            </Box>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                {report.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                {report.description}
                              </Typography>
                            </Box>
                          </Box>
                          <Visibility sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
                        </Box>
                      </Card>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              fullWidth
              sx={{ py: 1.5, borderRadius: 2 }}
              onClick={() => setSnackbar({ open: true, message: 'Export feature coming soon!', severity: 'info' })}
            >
              Export All Reports
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              fullWidth
              sx={{ py: 1.5, borderRadius: 2 }}
              onClick={() => window.location.reload()}
            >
              Refresh Data
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
              fullWidth
              sx={{ py: 1.5, borderRadius: 2 }}
              onClick={() => setSnackbar({ open: true, message: 'Advanced filters coming soon!', severity: 'info' })}
            >
              Advanced Filters
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              startIcon={<GetApp />}
              fullWidth
              sx={{ py: 1.5, borderRadius: 2 }}
              onClick={() => setSnackbar({ open: true, message: 'Scheduled reports coming soon!', severity: 'info' })}
            >
              Schedule Reports
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default HRReports;
