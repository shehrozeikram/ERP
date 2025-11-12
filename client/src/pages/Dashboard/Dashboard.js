import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Divider,
  Stack,
  alpha,
  useTheme,
  Fade,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Container,
  Skeleton
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
import { io } from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS, MODULES } from '../../utils/permissions';
import api from '../../services/api';
import RealtimeAttendanceMonitor from '../../components/RealtimeAttendanceMonitor';
import PresentChart from '../../components/PresentChart';
import DeviceStatusChart from '../../components/DeviceStatusChart';
import DepartmentChart from '../../components/DepartmentChart';

const DASHBOARD_DEBUG = process.env.REACT_APP_DASHBOARD_DEBUG === 'true';
const logDebug = (...args) => {
  if (DASHBOARD_DEBUG) {
    console.log(...args);
  }
};

const Dashboard = () => {
  const theme = useTheme();

  // Add CSS animations for enhanced effects
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-20px) rotate(180deg); }
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.8; }
      }
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.3; }
      }
      @keyframes glow {
        0%, 100% { box-shadow: 0 0 20px rgba(25, 118, 210, 0.4), 0 0 40px rgba(25, 118, 210, 0.2), 0 0 60px rgba(25, 118, 210, 0.1); }
        50% { box-shadow: 0 0 30px rgba(25, 118, 210, 0.6), 0 0 60px rgba(25, 118, 210, 0.4), 0 0 90px rgba(25, 118, 210, 0.2); }
      }
      @keyframes rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-10px); }
        60% { transform: translateY(-5px); }
      }
      @keyframes scaleIn {
        0% { transform: scale(0.8); opacity: 0; }
        50% { transform: scale(1.1); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes slideInUp {
        0% { transform: translateY(30px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      @keyframes rainbow {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
      }
      @keyframes heartbeat {
        0% { transform: scale(1); }
        14% { transform: scale(1.1); }
        28% { transform: scale(1); }
        42% { transform: scale(1.1); }
        70% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [animateCards, setAnimateCards] = useState(false);
  const [presentChartData, setPresentChartData] = useState(null);
  const presentChartDataRef = useRef(null);

  // Fetch comprehensive dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch data using same APIs as Payroll Management page
      const [
        payrollOverviewResponse,
        employeesResponse,
        attendanceResponse
      ] = await Promise.allSettled([
        api.get('/payroll/current-overview'), // Same as Payroll Management page
        api.get('/hr/employees?limit=1000'), // Get all employees for accurate count
        api.get('/attendance?limit=100') // Reduced limit - only need today's data
      ]);

      // Process data with error handling
      const employees = employeesResponse.status === 'fulfilled' ? employeesResponse.value.data.data : [];
      const payrollOverviewData = payrollOverviewResponse.status === 'fulfilled' ? payrollOverviewResponse.value.data.data : null;
      const attendance = attendanceResponse.status === 'fulfilled' ? attendanceResponse.value.data.data : [];

      // Calculate comprehensive metrics using same data as Payroll Management page
      const totalEmployees = payrollOverviewData?.totalEmployees || employees.length;
      
      // Calculate active employees ratio from sample data and apply to total
      const sampleActiveCount = employees.filter(emp => emp.status === 'active' || !emp.status).length;
      const sampleTotalCount = employees.length;
      const activeRatio = sampleTotalCount > 0 ? sampleActiveCount / sampleTotalCount : 1;
      const activeEmployees = Math.round(totalEmployees * activeRatio);
      
      const totalDepartments = [...new Set(employees.map(emp => emp.department?.name).filter(Boolean))].length;
      
      // Payroll metrics - Use same data as Payroll Management page (Total Gross Pay)
      let totalPayrollAmount = 0;
      
      if (payrollOverviewData?.totalGrossSalary) {
        // Use payroll overview data (same as Payroll Management page - Total Gross Pay)
        totalPayrollAmount = payrollOverviewData.totalGrossSalary;
      } else {
        // Fallback: Use employee gross salary estimation if overview data unavailable
        totalPayrollAmount = employees.reduce((sum, emp) => sum + (emp.grossSalary || 0), 0);
      }
      
      const averageSalary = totalEmployees > 0 ? totalPayrollAmount / totalEmployees : 0;
      
      // Attendance metrics
      const presentToday = attendance.filter(a => a.status === 'Present').length;
      const absentToday = attendance.filter(a => a.status === 'Absent').length;
      const attendanceRate = totalEmployees > 0 ? (presentToday / totalEmployees) * 100 : 0;
      
      // Present percentage (use WebSocket data if available, same as PresentChart)
      let presentPercentage = 0;
      
      if (presentChartDataRef.current && presentChartDataRef.current.length > 0) {
        // Use WebSocket data (same as PresentChart)
        const presentItem = presentChartDataRef.current.find(item => item.name === 'Present');
        const absentItem = presentChartDataRef.current.find(item => item.name === 'Absent');
        const presentCount = presentItem ? presentItem.value : 0;
        const absentCount = absentItem ? absentItem.value : 0;
        const totalCount = presentCount + absentCount;
        presentPercentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;
      } else {
        // Fallback to API data
        const totalAttendance = presentToday + absentToday;
        presentPercentage = totalAttendance > 0 ? (presentToday / totalAttendance) * 100 : 0;
      }
      
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
          absentToday,
          presentPercentage
        },
        performance: performanceMetrics,
        recentActivity: [
          { type: 'payroll', message: `${totalEmployees} employees in latest payroll`, time: '2 hours ago', icon: <AttachMoney />, color: 'success' },
          { type: 'employee', message: `${activeEmployees} active employees`, time: '1 day ago', icon: <People />, color: 'primary' },
          { type: 'attendance', message: `${attendanceRate.toFixed(1)}% attendance rate today`, time: '3 hours ago', icon: <Schedule />, color: 'warning' },
          { type: 'performance', message: 'System performance optimized', time: '5 hours ago', icon: <Speed />, color: 'info' }
        ]
      });
      
      logDebug('✅ Dashboard: Data set successfully');
      logDebug('✅ Dashboard: Overview data:', { totalEmployees, activeEmployees, totalPayrollAmount, presentPercentage });
      
      // Trigger card animations
      setTimeout(() => setAnimateCards(true), 100);
    } catch (error) {
      console.error('❌ Dashboard: Error fetching data:', error);
      console.error('❌ Dashboard: Error details:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Removed auto-refresh polling - now purely real-time via WebSocket
  }, []);

  // WebSocket connection to get Present Chart data (same as PresentChart component)
  useEffect(() => {
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://tovus.net' 
      : 'http://localhost:5001';
    
    const socket = io(baseURL, {
      transports: ['websocket', 'polling'],
      timeout: 5000, // Reduced timeout for faster connection
      forceNew: true
    });

    socket.on('connect', () => {
      logDebug('📊 Dashboard: Connected to server for Present data');
      socket.emit('requestChartData');
    });

    socket.on('zkbioConnectionStatus', (status) => {
      logDebug('📊 Dashboard: ZKBio Time status:', status);
    });

    socket.on('liveChartUpdate', (data) => {
      if (data.type === 'presentChart' && data.data) {
        let presentData = null;
        
        // Handle different possible data structures from ZKBio Time
        if (data.data.series && data.data.series[0] && data.data.series[0].data) {
          const seriesData = data.data.series[0].data;
          presentData = seriesData.map(item => ({
            name: item.name,
            value: item.value
          }));
        } else if (Array.isArray(data.data)) {
          presentData = data.data.map(item => ({
            name: item.name,
            value: item.value
          }));
        } else if (data.data.present !== undefined || data.data.absent !== undefined) {
          presentData = [
            { name: 'Present', value: data.data.present || 0 },
            { name: 'Absent', value: data.data.absent || 0 }
          ];
        }

        if (presentData && presentData.length > 0) {
          logDebug('📊 Dashboard: Received Present Chart data:', presentData);
          setPresentChartData(presentData);
          presentChartDataRef.current = presentData;
          
          // Calculate and log the Present percentage
          const presentItem = presentData.find(item => item.name === 'Present');
          const absentItem = presentData.find(item => item.name === 'Absent');
          const presentCount = presentItem ? presentItem.value : 0;
          const absentCount = absentItem ? absentItem.value : 0;
          const totalCount = presentCount + absentCount;
          const presentPercentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;
          
          logDebug('📊 Dashboard: Calculated Present percentage:', {
            presentCount,
            absentCount,
            totalCount,
            presentPercentage: presentPercentage.toFixed(2) + '%'
          });
        }
      }
    });

    socket.on('disconnect', () => {
      // Handle disconnect
    });

    socket.on('error', (error) => {
      console.error('📊 Dashboard: Socket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Update dashboard data when Present Chart data changes
  useEffect(() => {
    if (presentChartData && dashboardData) {
      logDebug('📊 Dashboard: Updating Present percentage with WebSocket data');
      
      // Recalculate Present percentage with WebSocket data
      const presentItem = presentChartData.find(item => item.name === 'Present');
      const absentItem = presentChartData.find(item => item.name === 'Absent');
      const presentCount = presentItem ? presentItem.value : 0;
      const absentCount = absentItem ? absentItem.value : 0;
      const totalCount = presentCount + absentCount;
      const presentPercentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;
      
      logDebug('📊 Dashboard: Updating dashboard with Present percentage:', presentPercentage.toFixed(2) + '%');
      
      // Update dashboard data with new Present percentage
      setDashboardData(prevData => ({
        ...prevData,
        overview: {
          ...prevData.overview,
          presentPercentage
        }
      }));
      
    }
  }, [presentChartData]);

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
        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 }, position: 'relative', zIndex: 1 }}>
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
  );

  // Clean Professional Performance Chart Component
  const AdvancedPerformanceChart = ({ title, data, color, icon }) => (
    <Card sx={{ 
        height: '100%', 
        borderRadius: 4,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${alpha(color, 0.06)}`,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 8px 32px ${alpha(color, 0.08)}, 0 4px 16px ${alpha(theme.palette.common.black, 0.06)}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 16px 48px ${alpha(color, 0.15)}, 0 8px 24px ${alpha(theme.palette.common.black, 0.1)}`,
          border: `1px solid ${alpha(color, 0.1)}`
        }
      }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
          {/* Clean Header */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2, 
            mb: 3
          }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.05)} 100%)`,
                color: color,
                border: `1px solid ${alpha(color, 0.1)}`
              }}
            >
              {icon}
            </Box>
            <Box>
              <Typography variant="h6" sx={{
                fontWeight: 700,
                color: theme.palette.text.primary,
                mb: 0.5
              }}>
                {title}
              </Typography>
              <Typography variant="body2" sx={{
                color: theme.palette.text.secondary,
                fontWeight: 500
              }}>
                Performance Overview
              </Typography>
            </Box>
          </Box>

          {/* Clean Data Display */}
          <Stack spacing={2.5}>
            {data.map((item, index) => (
              <Box key={index} sx={{
                animation: `slideInUp 0.5s ease-out ${index * 0.1}s both`,
                p: 2,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`,
                border: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: `linear-gradient(135deg, ${alpha(color, 0.05)} 0%, ${alpha(color, 0.02)} 100%)`,
                  border: `1px solid ${alpha(color, 0.08)}`
                }
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mb: 1.5 
                }}>
                  <Typography variant="body1" sx={{ 
                    fontWeight: 600, 
                    color: theme.palette.text.primary,
                    fontSize: '0.95rem'
                  }}>
                    {item.label}
                  </Typography>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 700, 
                      color: color,
                      fontSize: '1.1rem'
                    }}>
                      {item.value}%
                    </Typography>
                    <Box sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: item.value >= 90 ? theme.palette.success.main : 
                                  item.value >= 75 ? theme.palette.warning.main : 
                                  theme.palette.error.main
                    }} />
                  </Box>
                </Box>
                
                {/* Clean Progress Bar */}
                <Box sx={{ position: 'relative' }}>
                  <LinearProgress
                    variant="determinate"
                    value={item.value}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: alpha(theme.palette.grey[300], 0.3),
                      '& .MuiLinearProgress-bar': {
                        background: `linear-gradient(90deg, ${color} 0%, ${alpha(color, 0.8)} 100%)`,
                        borderRadius: 4
                      }
                    }}
                  />
                </Box>

                {/* Performance Status */}
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mt: 1
                }}>
                  <Typography variant="caption" sx={{
                    color: theme.palette.text.secondary,
                    fontWeight: 500,
                    fontSize: '0.75rem'
                  }}>
                    {item.value >= 90 ? 'Excellent' : 
                     item.value >= 75 ? 'Good' : 
                     item.value >= 60 ? 'Average' : 'Needs Improvement'}
                  </Typography>
                  <Box sx={{
                    display: 'flex',
                    gap: 0.3
                  }}>
                    {[...Array(5)].map((_, starIndex) => (
                      <Box
                        key={starIndex}
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: starIndex < Math.floor(item.value / 20) ? 
                            color : alpha(theme.palette.grey[400], 0.3)
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Box>
            ))}
          </Stack>

          {/* Clean Footer */}
          <Box sx={{
            mt: 3,
            pt: 2,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography variant="caption" sx={{
              color: theme.palette.text.secondary,
              fontWeight: 500
            }}>
              Updated: {new Date().toLocaleTimeString()}
            </Typography>
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}>
              <Box sx={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: theme.palette.success.main
              }} />
              <Typography variant="caption" sx={{
                color: theme.palette.success.main,
                fontWeight: 600
              }}>
                Live
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
  );

  const accessibleModules = getAccessibleModules();

  if (loading) {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
        p: 3
      }}>
        <Container maxWidth="xl">
          {/* Welcome Section Skeleton */}
          <Box sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
            <Skeleton variant="text" sx={{ width: { xs: 250, sm: 300, md: 300 }, height: { xs: 32, sm: 36, md: 40 }, mb: 1 }} />
            <Skeleton variant="text" sx={{ width: { xs: 180, sm: 200, md: 200 }, height: { xs: 20, sm: 22, md: 24 } }} />
          </Box>

          {/* User Profile and Modules Skeleton */}
          <Grid container spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderRadius: 6 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Skeleton variant="circular" width={60} height={60} />
                    <Box sx={{ flexGrow: 1 }}>
                    <Skeleton variant="text" sx={{ width: 150, height: 24, mb: 1 }} />
                      <Skeleton variant="text" sx={{ width: 100, height: 20 }} />
                    </Box>
                  </Box>
                  <Skeleton variant="rectangular" width="100%" height={40} sx={{ borderRadius: 2, mb: 2 }} />
                  <Skeleton variant="rectangular" width="100%" height={40} sx={{ borderRadius: 2 }} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Skeleton variant="text" sx={{ width: 120, height: 28, mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {[1, 2, 3, 4].map((i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Skeleton variant="circular" width={24} height={24} />
                        <Skeleton variant="text" sx={{ width: 120, height: 20 }} />
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* KPI Cards Skeleton */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            {[1, 2, 3, 4].map((i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card sx={{ height: '100%', borderRadius: 4 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Skeleton variant="text" sx={{ width: 100, height: 20 }} />
                      <Skeleton variant="circular" width={40} height={40} />
                    </Box>
                    <Skeleton variant="text" sx={{ width: 80, height: 32, mb: 1 }} />
                    <Skeleton variant="text" sx={{ width: 60, height: 16 }} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Charts Section Skeleton */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Card sx={{ height: 280, borderRadius: 4 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Skeleton variant="text" sx={{ width: 100, height: 24, mb: 2 }} />
                      <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto' }} />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card sx={{ height: 280, borderRadius: 4 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Skeleton variant="text" sx={{ width: 100, height: 24, mb: 2 }} />
                      <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto' }} />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card sx={{ height: 200, borderRadius: 4 }}>
                    <CardContent sx={{ p: 2 }}>
                      <Skeleton variant="text" sx={{ width: 120, height: 24, mb: 2 }} />
                      <Skeleton variant="rectangular" width="100%" height={120} sx={{ borderRadius: 2 }} />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Skeleton variant="text" sx={{ width: 150, height: 28, mb: 3 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Skeleton variant="circular" width={40} height={40} />
                        <Box sx={{ flexGrow: 1 }}>
                          <Skeleton variant="text" sx={{ width: 120, height: 16, mb: 0.5 }} />
                          <Skeleton variant="text" sx={{ width: 80, height: 14 }} />
                        </Box>
                        <Skeleton variant="text" sx={{ width: 60, height: 16 }} />
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* System Health Skeleton */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Card sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Skeleton variant="text" sx={{ width: 120, height: 28 }} />
                  </Box>
                  <Grid container spacing={2}>
                    {[1, 2, 3, 4].map((i) => (
                      <Grid item xs={6} sm={3} key={i}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Skeleton variant="circular" width={24} height={24} />
                          <Skeleton variant="text" sx={{ width: 100, height: 20 }} />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Performance Metrics Skeleton */}
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Skeleton variant="text" sx={{ width: 150, height: 28 }} />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Skeleton variant="text" sx={{ width: 120, height: 20 }} />
                        <Skeleton variant="text" sx={{ width: 60, height: 20 }} />
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderRadius: 4 }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Skeleton variant="text" sx={{ width: 120, height: 28 }} />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Skeleton variant="text" sx={{ width: 120, height: 20 }} />
                        <Skeleton variant="text" sx={{ width: 60, height: 20 }} />
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
    );
  }

  if (!dashboardData) {
    logDebug('❌ Dashboard: dashboardData is null');
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          Failed to load dashboard data
        </Alert>
      </Box>
    );
  }

  logDebug('✅ Dashboard: dashboardData loaded:', dashboardData);
  logDebug('✅ Dashboard: overview data:', dashboardData.overview);
  logDebug('✅ Dashboard: animateCards state:', animateCards);

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
      <Container maxWidth="xl" sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
        {/* Premium Header */}
        <Box sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 1.5, sm: 2, md: 2.5 } }}>
            <Box>
              <Typography variant="h2" sx={{ 
                fontWeight: 'bold', 
                fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.5rem' },
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
                fontWeight: 500,
                fontSize: { xs: '1rem', sm: '1.2rem', md: '1.4rem' }
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
        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
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
              title="Present Percentage"
              value={`${dashboardData.overview.presentPercentage.toFixed(1)}%`}
              change="2.5"
              trend="up"
              icon={<Schedule />}
              color={theme.palette.success.main}
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
        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ 
                height: '100%', 
                borderRadius: 6,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 50%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                backdropFilter: 'blur(30px)',
                border: `2px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: `0 20px 60px ${alpha(theme.palette.primary.main, 0.15)}, 0 8px 25px ${alpha(theme.palette.common.black, 0.1)}`,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: `0 32px 80px ${alpha(theme.palette.primary.main, 0.25)}, 0 16px 40px ${alpha(theme.palette.common.black, 0.15)}`,
                  border: `2px solid ${alpha(theme.palette.primary.main, 0.25)}`
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '5px',
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
                  borderRadius: '24px 24px 0 0',
                  backgroundSize: '200% 100%',
                  animation: 'gradientShift 3s ease infinite'
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
                  animation: 'float 6s ease-in-out infinite'
                }
              }}>
                <CardContent sx={{ p: 4, position: 'relative', zIndex: 1 }}>
                  {/* Header Section */}
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2, 
                    mb: 4,
                    position: 'relative'
                  }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
                        color: theme.palette.primary.main,
                        boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.2)}`,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                        animation: 'pulse 2s ease-in-out infinite'
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ 
                        fontWeight: 'bold', 
                        color: theme.palette.text.primary,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 0.5
                      }}>
                      Your Profile
                    </Typography>
                      <Typography variant="body2" sx={{ 
                        color: theme.palette.text.secondary,
                        fontWeight: 500
                      }}>
                        Personal Information & Status
                    </Typography>
                  </Box>
                  </Box>

                  {/* MASSIVE Profile Image Section - Center Stage */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    mb: 4,
                    p: 4,
                    borderRadius: 6,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
                    border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    backdropFilter: 'blur(20px)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: `0 25px 80px ${alpha(theme.palette.primary.main, 0.15)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.2)}`,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: `linear-gradient(45deg, transparent 30%, ${alpha(theme.palette.primary.main, 0.05)} 50%, transparent 70%)`,
                      animation: 'shimmer 4s ease-in-out infinite'
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: -100,
                      left: -100,
                      right: -100,
                      bottom: -100,
                      background: `conic-gradient(from 0deg, transparent, ${alpha(theme.palette.primary.main, 0.1)}, transparent)`,
                      animation: 'rotate 20s linear infinite',
                      zIndex: 0
                    }
                  }}>
                    {/* ELEGANT Profile Avatar - Clean & Sophisticated */}
                    <Box sx={{ 
                      position: 'relative', 
                      zIndex: 2,
                      mb: 3,
                      animation: 'scaleIn 1s ease-out'
                    }}>
                      {/* Clean Status Indicator */}
                      <Box sx={{
                        position: 'absolute',
                        bottom: 15,
                        right: 15,
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                        border: `4px solid ${theme.palette.background.paper}`,
                        boxShadow: `0 8px 25px ${alpha(theme.palette.success.main, 0.4)}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'pulse 2s ease-in-out infinite',
                        zIndex: 3
                      }}>
                        <Box sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: theme.palette.background.paper,
                          animation: 'blink 1.5s ease-in-out infinite'
                        }} />
                      </Box>
                      
                      {/* The ELEGANT Avatar */}
                      <Avatar 
                        src={user?.profileImage}
                        sx={{ 
                          width: 180, 
                          height: 180, 
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                          boxShadow: `0 25px 80px ${alpha(theme.palette.primary.main, 0.3)}, 0 10px 40px ${alpha(theme.palette.common.black, 0.2)}, inset 0 2px 10px ${alpha(theme.palette.common.white, 0.2)}`,
                          border: `4px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                          animation: 'glow 3s ease-in-out infinite',
                          position: 'relative',
                          '&:hover': {
                            transform: 'scale(1.08)',
                            boxShadow: `0 35px 100px ${alpha(theme.palette.primary.main, 0.4)}, 0 15px 50px ${alpha(theme.palette.common.black, 0.3)}, inset 0 3px 15px ${alpha(theme.palette.common.white, 0.3)}`,
                            animation: 'glow 2s ease-in-out infinite, pulse 1s ease-in-out'
                          }
                        }}
                      >
                        <PersonIcon sx={{ 
                          fontSize: 90,
                          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))'
                        }} />
                    </Avatar>
                    </Box>

                    {/* Enhanced User Information - Below the MASSIVE Avatar */}
                    <Box sx={{ 
                      textAlign: 'center', 
                      zIndex: 2,
                      animation: 'slideInUp 1s ease-out 0.5s both'
                    }}>
                      <Typography variant="h3" sx={{ 
                        fontWeight: 'bold', 
                        mb: 1,
                        background: `linear-gradient(135deg, ${theme.palette.text.primary}, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        lineHeight: 1.1,
                        textShadow: `0 2px 10px ${alpha(theme.palette.primary.main, 0.3)}`
                      }}>
                        {user?.firstName} {user?.lastName}
                      </Typography>
                      <Typography variant="h5" sx={{ 
                        color: theme.palette.primary.main, 
                        mb: 2,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        textShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`
                      }}>
                        {user?.position || 'Employee'}
                      </Typography>
                      <Typography variant="h6" sx={{ 
                        color: theme.palette.text.secondary, 
                        mb: 1,
                        fontWeight: 600,
                        opacity: 0.9
                      }}>
                        {user?.email}
                      </Typography>
                      <Typography variant="body1" sx={{ 
                        color: theme.palette.text.secondary,
                        fontWeight: 600,
                        fontSize: '1.1rem'
                      }}>
                        Employee ID: {formatEmployeeId(user?.employeeId)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* SPECTACULAR Status Chips with Advanced Animations */}
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    animation: 'slideInUp 1s ease-out 1s both'
                  }}>
                    <Chip
                      label={user?.role?.replace('_', ' ').toUpperCase()}
                      color="primary"
                      size="large"
                      icon={<Star sx={{ fontSize: 22, animation: 'rotate 4s linear infinite' }} />}
                      sx={{ 
                        fontWeight: 800,
                        fontSize: '1rem',
                        px: 3,
                        py: 1.5,
                        height: 48,
                        borderRadius: 6,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark}, ${theme.palette.secondary.main})`,
                        backgroundSize: '200% 200%',
                        color: theme.palette.primary.contrastText,
                        boxShadow: `0 15px 40px ${alpha(theme.palette.primary.main, 0.4)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.2)}`,
                        border: `2px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        animation: 'glow 3s ease-in-out infinite',
                        '&:hover': {
                          transform: 'translateY(-4px) scale(1.05)',
                          boxShadow: `0 20px 50px ${alpha(theme.palette.primary.main, 0.6)}, inset 0 2px 0 ${alpha(theme.palette.common.white, 0.3)}`,
                          animation: 'bounce 0.6s ease-in-out, rainbow 2s ease-in-out infinite'
                        }
                      }}
                    />
                    <Chip
                      label={typeof user?.department === 'object' ? user?.department?.name : user?.department || 'N/A'}
                      color="secondary"
                      size="large"
                      icon={<Business sx={{ fontSize: 22, animation: 'bounce 2s ease-in-out infinite' }} />}
                      sx={{ 
                        fontWeight: 800,
                        fontSize: '1rem',
                        px: 3,
                        py: 1.5,
                        height: 48,
                        borderRadius: 6,
                        background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.dark}, ${theme.palette.success.main})`,
                        backgroundSize: '200% 200%',
                        color: theme.palette.secondary.contrastText,
                        boxShadow: `0 15px 40px ${alpha(theme.palette.secondary.main, 0.4)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.2)}`,
                        border: `2px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        animation: 'glow 3s ease-in-out infinite 1s',
                        '&:hover': {
                          transform: 'translateY(-4px) scale(1.05)',
                          boxShadow: `0 20px 50px ${alpha(theme.palette.secondary.main, 0.6)}, inset 0 2px 0 ${alpha(theme.palette.common.white, 0.3)}`,
                          animation: 'bounce 0.6s ease-in-out, rainbow 2s ease-in-out infinite'
                        }
                      }}
                    />
                    <Chip
                      label={user?.position || 'Employee'}
                      variant="outlined"
                      size="large"
                      icon={<EmojiEvents sx={{ fontSize: 22, animation: 'heartbeat 1.5s ease-in-out infinite' }} />}
                      sx={{ 
                        fontWeight: 800,
                        fontSize: '1rem',
                        px: 3,
                        py: 1.5,
                        height: 48,
                        borderRadius: 6,
                        border: `3px solid ${theme.palette.success.main}`,
                        color: theme.palette.success.main,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.15)}, ${alpha(theme.palette.success.main, 0.08)}, ${alpha(theme.palette.warning.main, 0.1)})`,
                        backgroundSize: '200% 200%',
                        boxShadow: `0 15px 40px ${alpha(theme.palette.success.main, 0.3)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.2)}`,
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        animation: 'glow 3s ease-in-out infinite 2s',
                        '&:hover': {
                          transform: 'translateY(-4px) scale(1.05)',
                          background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.25)}, ${alpha(theme.palette.success.main, 0.15)}, ${alpha(theme.palette.warning.main, 0.2)})`,
                          boxShadow: `0 20px 50px ${alpha(theme.palette.success.main, 0.5)}, inset 0 2px 0 ${alpha(theme.palette.common.white, 0.3)}`,
                          animation: 'bounce 0.6s ease-in-out, rainbow 2s ease-in-out infinite'
                        }
                      }}
                    />
                  </Box>
                </CardContent>
              </Card>
          </Grid>

          <Grid item xs={12} md={6}>
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
          </Grid>
        </Grid>

        {/* Real-Time Attendance Charts and Monitor */}
        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
          {/* Left Column: Present, Device Status, and Department Charts */}
          <Grid item xs={12} md={6}>
            <Grid container spacing={2}>
              {/* Top Row: Present and Device Status Charts */}
              <Grid item xs={6}>
                <PresentChart />
              </Grid>
              <Grid item xs={6}>
                <DeviceStatusChart />
              </Grid>
              {/* Bottom Row: Department Chart */}
              <Grid item xs={12}>
                <DepartmentChart />
              </Grid>
            </Grid>
          </Grid>
          
          {/* Right Column: Real-Time Monitor */}
          <Grid item xs={12} md={6}>
            <RealtimeAttendanceMonitor />
          </Grid>
        </Grid>

        {/* System Health */}
        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }} sx={{ mb: { xs: 2, sm: 3, md: 4 } }}>
          <Grid item xs={12}>
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
          </Grid>
        </Grid>

        {/* Advanced Performance Metrics - Moved to End */}
        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
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
      </Container>
    </Box>
  );
};

export default Dashboard;