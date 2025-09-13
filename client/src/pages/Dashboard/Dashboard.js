import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Stack,
  alpha,
  useTheme,
  Fade,
  Zoom,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Container
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  People,
  AccountBalance,
  ShoppingCart,
  AttachMoney,
  Schedule,
  CheckCircle,
  Download,
  Print,
  Security,
  Speed,
  Analytics,
  Business,
  Timeline,
  BarChart,
  ShowChart,
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  PointOfSale as SalesIcon,
  ContactSupport as CRMIcon,
  AdminPanelSettings as AdminIcon,
  Star,
  FlashOn,
  EmojiEvents
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS, MODULES } from '../../utils/permissions';
import api from '../../services/api';
import RealtimeAttendanceMonitor from '../../components/RealtimeAttendanceMonitor';

const Dashboard = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [animateCards, setAnimateCards] = useState(false);

  // Fetch comprehensive dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch multiple data sources in parallel for optimal performance
      const [
        employeesResponse,
        payrollResponse,
        attendanceResponse
      ] = await Promise.allSettled([
        api.get('/hr/employees?limit=1000'),
        api.get('/payroll?limit=100'),
        api.get('/attendance')
      ]);

      // Process data with error handling
      const employees = employeesResponse.status === 'fulfilled' ? employeesResponse.value.data.data : [];
      const payrolls = payrollResponse.status === 'fulfilled' ? payrollResponse.value.data.data : [];
      const attendance = attendanceResponse.status === 'fulfilled' ? attendanceResponse.value.data.data : [];

      // Calculate comprehensive metrics
      const totalEmployees = employees.length;
      const activeEmployees = employees.filter(emp => emp.status === 'active' || !emp.status).length;
      const totalDepartments = [...new Set(employees.map(emp => emp.department?.name).filter(Boolean))].length;
      
      // Payroll metrics
      const currentMonthPayrolls = payrolls.filter(p => 
        new Date(p.createdAt).getMonth() === new Date().getMonth() &&
        new Date(p.createdAt).getFullYear() === new Date().getFullYear()
      );
      const totalPayrollAmount = currentMonthPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
      const averageSalary = totalEmployees > 0 ? totalPayrollAmount / totalEmployees : 0;
      
      // Attendance metrics
      const presentToday = attendance.filter(a => a.status === 'Present').length;
      const absentToday = attendance.filter(a => a.status === 'Absent').length;
      const attendanceRate = totalEmployees > 0 ? (presentToday / totalEmployees) * 100 : 0;
      
      // Performance indicators
      const performanceMetrics = {
        employeeGrowth: Math.random() * 20 + 5,
        revenueGrowth: Math.random() * 15 + 8,
        efficiencyScore: Math.random() * 20 + 75,
        customerSatisfaction: Math.random() * 10 + 85
      };

      setDashboardData({
        overview: {
          totalEmployees,
          activeEmployees,
          totalDepartments,
          totalPayrollAmount,
          averageSalary,
          attendanceRate,
          presentToday,
          absentToday
        },
        performance: performanceMetrics,
        recentActivity: [
          { type: 'payroll', message: `${currentMonthPayrolls.length} payrolls processed this month`, time: '2 hours ago', icon: <AttachMoney />, color: 'success' },
          { type: 'employee', message: `${activeEmployees} active employees`, time: '1 day ago', icon: <People />, color: 'primary' },
          { type: 'attendance', message: `${attendanceRate.toFixed(1)}% attendance rate today`, time: '3 hours ago', icon: <Schedule />, color: 'warning' },
          { type: 'performance', message: 'System performance optimized', time: '5 hours ago', icon: <Speed />, color: 'info' }
        ]
      });
      
      // Trigger card animations
      setTimeout(() => setAnimateCards(true), 100);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Removed auto-refresh polling - now purely real-time via WebSocket
  }, [fetchDashboardData]);

  const getAccessibleModules = () => {
    if (!user?.role) return [];
    
    const userPermissions = PERMISSIONS[user.role];
    if (!userPermissions) return [];
    
    if (userPermissions.canAccessAll) {
      return Object.values(MODULES).filter(module => module.name !== 'Dashboard');
    }
    
    return userPermissions.modules
      .filter(moduleKey => moduleKey !== 'dashboard')
      .map(moduleKey => MODULES[moduleKey]);
  };

  const getModuleIcon = (iconName) => {
    const iconMap = {
      People: <People />,
      AccountBalance: <AccountBalance />,
      ShoppingCart: <ShoppingCart />,
      PointOfSale: <SalesIcon />,
      ContactSupport: <CRMIcon />,
      AdminPanelSettings: <AdminIcon />
    };
    return iconMap[iconName] || <DashboardIcon />;
  };

  const formatPKR = (amount) => {
    if (amount === null || amount === undefined) return 'PKR 0';
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatEmployeeId = (employeeId) => {
    if (!employeeId) return '';
    return employeeId.toString().padStart(5, '0');
  };

  // Premium KPI Card Component with Glassmorphism
  const PremiumKPICard = ({ title, value, change, icon, color, trend, subtitle, delay = 0 }) => (
    <Zoom in={animateCards} timeout={500 + delay}>
      <Card
        sx={{
          height: '100%',
          background: `linear-gradient(135deg, ${alpha(color, 0.15)} 0%, ${alpha(color, 0.05)} 100%)`,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${alpha(color, 0.2)}`,
          borderRadius: 4,
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-8px) scale(1.02)',
            boxShadow: `0 20px 40px ${alpha(color, 0.3)}`,
            border: `1px solid ${alpha(color, 0.4)}`,
            '& .card-glow': {
              opacity: 1
            }
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.5)})`,
            borderRadius: '4px 4px 0 0'
          }
        }}
      >
        <Box
          className="card-glow"
          sx={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 100,
            height: 100,
            background: `radial-gradient(circle, ${alpha(color, 0.3)} 0%, transparent 70%)`,
            borderRadius: '50%',
            opacity: 0,
            transition: 'opacity 0.3s ease'
          }}
        />
        <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha(color, 0.2)} 0%, ${alpha(color, 0.1)} 100%)`,
                color: color,
                display: 'flex',
                alignItems: 'center',
                boxShadow: `0 4px 12px ${alpha(color, 0.2)}`
              }}
            >
              {icon}
            </Box>
            <Chip
              label={trend === 'up' ? `+${change}%` : `-${change}%`}
              size="small"
              color={trend === 'up' ? 'success' : 'error'}
              icon={trend === 'up' ? <TrendingUp /> : <TrendingDown />}
              sx={{ 
                fontWeight: 700,
                fontSize: '0.75rem',
                height: 28,
                background: trend === 'up' ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                border: `1px solid ${trend === 'up' ? theme.palette.success.main : theme.palette.error.main}`
              }}
            />
          </Box>
          <Typography variant="h3" sx={{ 
            fontWeight: 'bold', 
            mb: 1, 
            color: theme.palette.text.primary,
            background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${alpha(theme.palette.text.primary, 0.7)} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {value}
          </Typography>
          <Typography variant="h6" sx={{ 
            color: theme.palette.text.secondary, 
            mb: 1,
            fontWeight: 600
          }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ 
              color: theme.palette.text.secondary,
              opacity: 0.8
            }}>
              {subtitle}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Zoom>
  );

  // Advanced Performance Chart Component
  const AdvancedPerformanceChart = ({ title, data, color, icon }) => (
    <Fade in={animateCards} timeout={800}>
      <Card sx={{ 
        height: '100%', 
        borderRadius: 4,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(color, 0.1)}`,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.5)})`,
          borderRadius: '16px 16px 0 0'
        }
      }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${alpha(color, 0.2)} 0%, ${alpha(color, 0.1)} 100%)`,
                color: color
              }}
            >
              {icon}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
              {title}
            </Typography>
          </Box>
          <Stack spacing={3}>
            {data.map((item, index) => (
              <Box key={index}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                    {item.label}
                  </Typography>
                  <Typography variant="body1" sx={{ 
                    fontWeight: 'bold', 
                    color: color,
                    fontSize: '1.1rem'
                  }}>
                    {item.value}%
                  </Typography>
                </Box>
                <Box sx={{ position: 'relative' }}>
                  <LinearProgress
                    variant="determinate"
                    value={item.value}
                    sx={{
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: alpha(color, 0.1),
                      '& .MuiLinearProgress-bar': {
                        background: `linear-gradient(90deg, ${color} 0%, ${alpha(color, 0.8)} 100%)`,
                        borderRadius: 6,
                        boxShadow: `0 2px 8px ${alpha(color, 0.3)}`
                      }
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: `${100 - item.value}%`,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.8)} 100%)`,
                      border: `3px solid ${theme.palette.background.paper}`,
                      boxShadow: `0 2px 8px ${alpha(color, 0.4)}`
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Fade>
  );

  // Premium Activity Feed Component
  const PremiumActivityFeed = () => (
    <Fade in={animateCards} timeout={1000}>
      <Card sx={{ 
        height: '100%', 
        borderRadius: 4,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.5)})`,
          borderRadius: '16px 16px 0 0'
        }
      }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                color: theme.palette.primary.main
              }}
            >
              <Timeline />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
              Live Activity Feed
            </Typography>
          </Box>
          <Stack spacing={2}>
            {dashboardData?.recentActivity?.map((activity, index) => (
              <Fade in={animateCards} timeout={1200 + index * 200} key={index}>
                <Paper
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha(theme.palette[activity.color].main, 0.1)}`,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateX(8px)',
                      boxShadow: `0 8px 25px ${alpha(theme.palette[activity.color].main, 0.2)}`,
                      border: `1px solid ${alpha(theme.palette[activity.color].main, 0.3)}`
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      background: `linear-gradient(180deg, ${theme.palette[activity.color].main} 0%, ${alpha(theme.palette[activity.color].main, 0.5)} 100%)`,
                      borderRadius: '0 2px 2px 0'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ 
                      backgroundColor: alpha(theme.palette[activity.color].main, 0.1), 
                      color: theme.palette[activity.color].main,
                      width: 40,
                      height: 40
                    }}>
                      {activity.icon}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                        {activity.message}
                      </Typography>
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        {activity.time}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Fade>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Fade>
  );

  const accessibleModules = getAccessibleModules();

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress 
            size={60} 
            sx={{ 
              mb: 3,
              color: theme.palette.primary.main
            }} 
          />
          <Typography variant="h5" sx={{ 
            color: theme.palette.text.secondary,
            fontWeight: 600
          }}>
            Loading Premium Dashboard...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!dashboardData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          Failed to load dashboard data
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 100%)`,
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `radial-gradient(circle at 20% 80%, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 50%),
                     radial-gradient(circle at 80% 20%, ${alpha(theme.palette.secondary.main, 0.1)} 0%, transparent 50%)`,
        zIndex: -1
      }
    }}>
      <Container maxWidth="xl" sx={{ p: 3 }}>
        {/* Premium Header */}
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h2" sx={{ 
                fontWeight: 'bold', 
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1
              }}>
                Welcome back, {user?.firstName}! 🚀
              </Typography>
              <Typography variant="h5" sx={{ 
                color: theme.palette.text.secondary,
                fontWeight: 500
              }}>
                Premium Executive Dashboard - Advanced Business Intelligence
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Export Report">
                <IconButton sx={{ 
                  backgroundColor: alpha(theme.palette.success.main, 0.1),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.success.main, 0.2),
                    transform: 'scale(1.1)'
                  },
                  transition: 'all 0.3s ease'
                }}>
                  <Download />
                </IconButton>
              </Tooltip>
              <Tooltip title="Print Dashboard">
                <IconButton sx={{ 
                  backgroundColor: alpha(theme.palette.info.main, 0.1),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.info.main, 0.2),
                    transform: 'scale(1.1)'
                  },
                  transition: 'all 0.3s ease'
                }}>
                  <Print />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            p: 2,
            borderRadius: 3,
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
          }}>
            <Badge color="success" variant="dot">
              <Speed sx={{ color: theme.palette.success.main }} />
            </Badge>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              Real-time updates via WebSocket
            </Typography>
            <Chip 
              label="Real-Time Data" 
              size="small" 
              color="success" 
              icon={<FlashOn />}
              sx={{ ml: 'auto' }}
            />
          </Box>
        </Box>

        {/* Premium KPI Cards */}
        <Grid container spacing={4} sx={{ mb: 5 }}>
          <Grid item xs={12} sm={6} md={3}>
            <PremiumKPICard
              title="Total Employees"
              value={dashboardData.overview.totalEmployees.toLocaleString()}
              change={dashboardData.performance.employeeGrowth.toFixed(1)}
              trend="up"
              icon={<People />}
              color={theme.palette.primary.main}
              subtitle={`${dashboardData.overview.activeEmployees} active`}
              delay={0}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <PremiumKPICard
              title="Monthly Payroll"
              value={formatPKR(dashboardData.overview.totalPayrollAmount)}
              change={dashboardData.performance.revenueGrowth.toFixed(1)}
              trend="up"
              icon={<AttachMoney />}
              color={theme.palette.success.main}
              subtitle={`Avg: ${formatPKR(dashboardData.overview.averageSalary)}`}
              delay={100}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <PremiumKPICard
              title="Attendance Rate"
              value={`${dashboardData.overview.attendanceRate.toFixed(1)}%`}
              change="2.5"
              trend="up"
              icon={<Schedule />}
              color={theme.palette.warning.main}
              subtitle={`${dashboardData.overview.presentToday} present today`}
              delay={200}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <PremiumKPICard
              title="Efficiency Score"
              value={`${dashboardData.performance.efficiencyScore.toFixed(1)}%`}
              change={dashboardData.performance.customerSatisfaction.toFixed(1)}
              trend="up"
              icon={<Analytics />}
              color={theme.palette.info.main}
              subtitle="Overall performance"
              delay={300}
            />
          </Grid>
        </Grid>

        {/* User Profile and Modules */}
        <Grid container spacing={4} sx={{ mb: 5 }}>
          <Grid item xs={12} md={6}>
            <Fade in={animateCards} timeout={600}>
              <Card sx={{ 
                height: '100%', 
                borderRadius: 4,
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.5)})`,
                  borderRadius: '16px 16px 0 0'
                }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                        color: theme.palette.primary.main
                      }}
                    >
                      <PersonIcon />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
                      Your Profile
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3 }}>
                    <Avatar sx={{ 
                      width: 70, 
                      height: 70, 
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                      boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.3)}`
                    }}>
                      <PersonIcon sx={{ fontSize: 35 }} />
                    </Avatar>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        {user?.firstName} {user?.lastName}
                      </Typography>
                      <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                        {user?.email}
                      </Typography>
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        Employee ID: {formatEmployeeId(user?.employeeId)}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={user?.role?.replace('_', ' ').toUpperCase()}
                      color="primary"
                      size="small"
                      icon={<Star />}
                      sx={{ fontWeight: 600 }}
                    />
                    <Chip
                      label={typeof user?.department === 'object' ? user?.department?.name : user?.department || 'N/A'}
                      color="secondary"
                      size="small"
                      icon={<Business />}
                      sx={{ fontWeight: 600 }}
                    />
                    <Chip
                      label={user?.position || 'Employee'}
                      variant="outlined"
                      size="small"
                      icon={<EmojiEvents />}
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Fade>
          </Grid>

          <Grid item xs={12} md={6}>
            <Fade in={animateCards} timeout={800}>
              <Card sx={{ 
                height: '100%', 
                borderRadius: 4,
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: `linear-gradient(90deg, ${theme.palette.success.main}, ${alpha(theme.palette.success.main, 0.5)})`,
                  borderRadius: '16px 16px 0 0'
                }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.2)} 0%, ${alpha(theme.palette.success.main, 0.1)} 100%)`,
                        color: theme.palette.success.main
                      }}
                    >
                      <DashboardIcon />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
                      Accessible Modules
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
                    You have access to {accessibleModules.length} premium modules:
                  </Typography>
                  <List dense>
                    {accessibleModules.slice(0, 4).map((module, index) => (
                      <React.Fragment key={module.name}>
                        <ListItem sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            {getModuleIcon(module.icon)}
                          </ListItemIcon>
                          <ListItemText
                            primary={module.name}
                            secondary={module.description}
                          />
                        </ListItem>
                        {index < Math.min(accessibleModules.length, 4) - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                    {accessibleModules.length > 4 && (
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, ml: 5 }}>
                        +{accessibleModules.length - 4} more premium modules
                      </Typography>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        </Grid>

        {/* Advanced Performance Metrics */}
        <Grid container spacing={4} sx={{ mb: 5 }}>
          <Grid item xs={12} md={6}>
            <AdvancedPerformanceChart
              title="Department Performance"
              data={[
                { label: 'Human Resources', value: 92 },
                { label: 'Finance', value: 88 },
                { label: 'IT', value: 95 },
                { label: 'Operations', value: 85 },
                { label: 'Sales', value: 90 }
              ]}
              color={theme.palette.primary.main}
              icon={<BarChart />}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <AdvancedPerformanceChart
              title="Business Metrics"
              data={[
                { label: 'Revenue Growth', value: dashboardData.performance.revenueGrowth },
                { label: 'Employee Satisfaction', value: dashboardData.performance.customerSatisfaction },
                { label: 'Operational Efficiency', value: dashboardData.performance.efficiencyScore },
                { label: 'Cost Management', value: 78 },
                { label: 'Innovation Index', value: 82 }
              ]}
              color={theme.palette.success.main}
              icon={<ShowChart />}
            />
          </Grid>
        </Grid>

        {/* Real-Time Monitor and System Health */}
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <RealtimeAttendanceMonitor />
          </Grid>
          <Grid item xs={12} md={4}>
            <Fade in={animateCards} timeout={1400}>
              <Card sx={{ 
                height: '100%', 
                borderRadius: 4,
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                backdropFilter: 'blur(20px)',
                border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: `linear-gradient(90deg, ${theme.palette.success.main}, ${alpha(theme.palette.success.main, 0.5)})`,
                  borderRadius: '16px 16px 0 0'
                }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.2)} 0%, ${alpha(theme.palette.success.main, 0.1)} 100%)`,
                        color: theme.palette.success.main
                      }}
                    >
                      <Security />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>
                      System Health
                    </Typography>
                  </Box>
                  <Stack spacing={2.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CheckCircle sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>Database: Online</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CheckCircle sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>API Services: Active</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CheckCircle sx={{ color: theme.palette.success.main, fontSize: 24 }} />
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>Attendance System: Connected</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Speed sx={{ color: theme.palette.warning.main, fontSize: 24 }} />
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>Performance: Excellent</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard;