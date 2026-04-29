import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  FormControl,
  Select,
  MenuItem
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  FunnelChart,
  Funnel,
  Treemap,
  TreemapItem,
  RadialBarChart,
  RadialBar
} from 'recharts';
import {
  TrendingUp as TrendingUpIcon,
  Biometric as BiometricIcon,
  Receipt,
  Close as CloseIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasModuleAccess, MODULE_KEYS } from '../../utils/permissions';
import { formatPKR } from '../../utils/currency';
import api from '../../services/authService';
import { PageLoading, CardsSkeleton } from '../../components/LoadingSpinner';

/** Hire date used for HR reporting (new hires, tenure charts). */
function getEmployeeHireDate(employee) {
  if (!employee?.hireDate) return null;
  const d = new Date(employee.hireDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getProbationEndDate(employee) {
  const baseDate = employee?.appointmentDate || employee?.hireDate || employee?.joiningDate;
  if (!baseDate) return null;
  const startDate = new Date(baseDate);
  if (Number.isNaN(startDate.getTime())) return null;

  const months = Number(employee?.probationPeriodMonths ?? employee?.probationPeriod ?? 0);
  if (!Number.isFinite(months) || months <= 0) return null;

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);
  return Number.isNaN(endDate.getTime()) ? null : endDate;
}

const HRDashboard = () => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    totalDepartments: 0,
    newThisMonth: 0,
    newThisYear: 0,
    resignations: 0,
    disciplinaryCases: 0,
    turnoverRate: 0,
    avgSalary: 0,
    totalSalary: 0,
    avgBasicSalary: 0,
    avgGrossSalary: 0,
    totalBasicSalary: 0,
    totalGrossSalary: 0
  });
  const [recentEmployees, setRecentEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [chartData, setChartData] = useState({
    departmentData: [],
    salaryRangeData: [],
    genderDistribution: [],
    monthlyHires: [],
    ageDistribution: [],
    experienceLevels: [],
    employmentStatusDistribution: [],
    employmentTypeDistribution: [],
    salaryVsExperience: [],
    departmentSalaryData: [],
    attendanceData: [],
    leaveBalanceData: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hireListDialogOpen, setHireListDialogOpen] = useState(false);
  const [statusListDialog, setStatusListDialog] = useState({ open: false, type: 'resignations' });
  const [newHireFilter, setNewHireFilter] = useState('month');
  const [employeesWithHireDate, setEmployeesWithHireDate] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [probationCompletedEmployees, setProbationCompletedEmployees] = useState([]);
  const [probationDialogOpen, setProbationDialogOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const isDisciplinaryTermination = (employee) => {
    const reason = (employee?.terminationReason || '').toLowerCase();
    return ['disciplin', 'misconduct', 'violation', 'warning', 'show cause', 'fraud', 'policy']
      .some(keyword => reason.includes(keyword));
  };

  const getRandomColor = () => {
    const colors = [
      '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#ff0000',
      '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
      '#800080', '#008000', '#000080', '#808000', '#800000'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Enhanced color palette for better visual appeal
  const getEnhancedColors = (type) => {
    switch(type) {
      case 'gender':
        return ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
      case 'employment':
        return ['#A8E6CF', '#DCEDC8', '#FFD3B6', '#FFAAA5', '#FF8B94'];
      case 'status':
        return ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'];
      default:
        return ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#ff0000'];
    }
  };

  const processChartData = (employees, deptStats) => {
    // Real Department distribution data
    const departmentData = deptStats.map(dept => ({
      name: dept.name,
      employees: dept.employeeCount,
      fill: getRandomColor()
    }));

    // Real Salary range distribution based on actual employee data
    const salaryRanges = [
      { range: '0-50K', min: 0, max: 50000, count: 0, avgYearsOfService: 0 },
      { range: '50K-100K', min: 50000, max: 100000, count: 0, avgYearsOfService: 0 },
      { range: '100K-150K', min: 100000, max: 150000, count: 0, avgYearsOfService: 0 },
      { range: '150K-200K', min: 150000, max: 200000, count: 0, avgYearsOfService: 0 },
      { range: '200K+', min: 200000, max: Infinity, count: 0, avgYearsOfService: 0 }
    ];

    employees.forEach(emp => {
      const grossSalary = (emp.salary?.basic || 0) + 
                         (emp.salary?.houseRent || 0) + 
                         (emp.salary?.medical || 0) + 
                         (emp.salary?.conveyance || 0) + 
                         (emp.salary?.special || 0) + 
                         (emp.salary?.other || 0);
      const range = salaryRanges.find(r => grossSalary >= r.min && grossSalary < r.max);
      if (range) {
        range.count++;
        const hireDate = getEmployeeHireDate(emp);
        if (hireDate) {
          const today = new Date();
          const yearsOfService = today.getFullYear() - hireDate.getFullYear();
          range.avgYearsOfService += yearsOfService;
        }
      }
    });

    const salaryRangeData = salaryRanges.map(range => ({
      range: range.range,
      count: range.count,
      avgYearsOfService: range.count > 0 ? Math.round(range.avgYearsOfService / range.count) : 0,
      fill: getRandomColor()
    }));

    // Real Gender distribution with actual salary data
    const genderStats = employees.reduce((acc, emp) => {
      const gender = emp.gender || 'other';
      if (!acc[gender]) {
        acc[gender] = { count: 0, totalSalary: 0, avgPerformance: 0 };
      }
      acc[gender].count++;
      const grossSalary = (emp.salary?.basic || 0) + 
                         (emp.salary?.houseRent || 0) + 
                         (emp.salary?.medical || 0) + 
                         (emp.salary?.conveyance || 0) + 
                         (emp.salary?.special || 0) + 
                         (emp.salary?.other || 0);
      acc[gender].totalSalary += grossSalary;
      acc[gender].avgPerformance += emp.performance?.rating || 3.5;
      return acc;
    }, {});

    const totalEmployees = employees.length;
    const genderDistribution = Object.entries(genderStats).map(([gender, stats], index) => ({
      name: gender.charAt(0).toUpperCase() + gender.slice(1),
      value: stats.count,
      percentage: Math.round((stats.count / totalEmployees) * 100),
      avgSalary: Math.round(stats.totalSalary / stats.count),
      avgPerformance: Math.round((stats.avgPerformance / stats.count) * 10) / 10,
      fill: getEnhancedColors('gender')[index % getEnhancedColors('gender').length]
    }));

    // Real Monthly hires based on actual hire dates
    const monthlyHires = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const hires = employees.filter(emp => {
        const hireDate = getEmployeeHireDate(emp);
        if (!hireDate) return false;
        return hireDate.getMonth() === month.getMonth() &&
               hireDate.getFullYear() === month.getFullYear();
      }).length;

      monthlyHires.push({
        month: monthName,
        hires,
        fill: getRandomColor()
      });
    }

    // Real Age distribution based on actual date of birth
    const ageRanges = [
      { range: '18-25', min: 18, max: 25, count: 0 },
      { range: '26-35', min: 26, max: 35, count: 0 },
      { range: '36-45', min: 36, max: 45, count: 0 },
      { range: '46-55', min: 46, max: 55, count: 0 },
      { range: '55+', min: 55, max: 100, count: 0 }
    ];

    employees.forEach(emp => {
      const birthDate = new Date(emp.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
      
      const range = ageRanges.find(r => actualAge >= r.min && actualAge <= r.max);
      if (range) range.count++;
    });

    const ageDistribution = ageRanges.map(range => ({
      range: range.range,
      count: range.count,
      percentage: Math.round((range.count / employees.length) * 100),
      fill: getRandomColor()
    }));

    // Real Experience levels based on years of service
    const experienceLevels = [
      { level: 'Entry (0-2 yrs)', count: 0, avgSalary: 0 },
      { level: 'Junior (3-5 yrs)', count: 0, avgSalary: 0 },
      { level: 'Mid (6-10 yrs)', count: 0, avgSalary: 0 },
      { level: 'Senior (11-15 yrs)', count: 0, avgSalary: 0 },
      { level: 'Expert (15+ yrs)', count: 0, avgSalary: 0 }
    ];

    employees.forEach(emp => {
      const hireDate = getEmployeeHireDate(emp);
      if (!hireDate) return;
      const today = new Date();
      const yearsOfService = today.getFullYear() - hireDate.getFullYear();

      let level;
      if (yearsOfService <= 2) level = experienceLevels[0];
      else if (yearsOfService <= 5) level = experienceLevels[1];
      else if (yearsOfService <= 10) level = experienceLevels[2];
      else if (yearsOfService <= 15) level = experienceLevels[3];
      else level = experienceLevels[4];

      level.count++;
      level.avgSalary += emp.salary || 0;
    });

    experienceLevels.forEach(level => {
      level.avgSalary = level.count > 0 ? Math.round(level.avgSalary / level.count) : 0;
      level.fill = getRandomColor();
    });

    // Real Employment status distribution
    const employmentStatusData = employees.reduce((acc, emp) => {
      const status = emp.employmentStatus || 'Active';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const employmentStatusDistribution = Object.entries(employmentStatusData).map(([status, count], index) => ({
      name: status,
      value: count,
      percentage: Math.round((count / totalEmployees) * 100),
      fill: getEnhancedColors('status')[index % getEnhancedColors('status').length]
    }));

    // Real Employment type distribution
    const employmentTypeData = employees.reduce((acc, emp) => {
      const type = emp.employmentType || 'Full-time';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const employmentTypeDistribution = Object.entries(employmentTypeData).map(([type, count], index) => ({
      name: type,
      value: count,
      percentage: Math.round((count / totalEmployees) * 100),
      fill: getEnhancedColors('employment')[index % getEnhancedColors('employment').length]
    }));

    // Real Salary vs Years of Service scatter plot
    const salaryVsExperience = employees
      .map(emp => {
        const hireDate = getEmployeeHireDate(emp);
        if (!hireDate) return null;
        const today = new Date();
        const yearsOfService = today.getFullYear() - hireDate.getFullYear();
        return {
          experience: yearsOfService,
          salary: emp.salary || 0,
          department: emp.placementDepartment?.name || 'General',
          performance: emp.performance?.rating || 3.5
        };
      })
      .filter(Boolean);

    // Real Department salary analysis
    const departmentSalaryData = deptStats.map(dept => {
      const deptEmployees = employees.filter(emp => emp.placementDepartment?.name === dept.name);
      const totalSalary = deptEmployees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
      const avgSalary = deptEmployees.length > 0 ? totalSalary / deptEmployees.length : 0;
      
      return {
        department: dept.name,
        employeeCount: dept.employeeCount,
        avgSalary: Math.round(avgSalary),
        totalSalary: totalSalary,
        fill: getRandomColor()
      };
    });

    // Real Attendance analysis (if available)
    const attendanceData = employees.map(emp => {
      const attendance = emp.attendance || {};
      const totalDays = attendance.totalDays || 0;
      const presentDays = attendance.presentDays || 0;
      const attendancePercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
      
      return {
        employee: `${emp.firstName} ${emp.lastName}`,
        attendance: Math.round(attendancePercentage),
        department: emp.placementDepartment?.name || 'General',
        salary: emp.salary || 0
      };
    }).filter(item => item.attendance > 0);

    // Real Leave balance analysis
    const leaveBalanceData = employees.map(emp => {
      const leaveBalance = emp.leaveBalance || {};
      const totalLeave = (leaveBalance.annual || 0) + (leaveBalance.sick || 0) + (leaveBalance.personal || 0);
      
      return {
        employee: `${emp.firstName} ${emp.lastName}`,
        annual: leaveBalance.annual || 0,
        sick: leaveBalance.sick || 0,
        personal: leaveBalance.personal || 0,
        total: totalLeave,
        department: emp.placementDepartment?.name || 'General'
      };
    });

    setChartData({
      departmentData,
      salaryRangeData,
      genderDistribution,
      monthlyHires,
      ageDistribution,
      experienceLevels,
      employmentStatusDistribution,
      employmentTypeDistribution,
      salaryVsExperience,
      departmentSalaryData,
      attendanceData,
      leaveBalanceData
    });
  };

  // Initial data fetch - only run once on mount
  useEffect(() => {
    fetchDashboardData();
  }, [user?.role]); // Re-evaluate when user role context loads

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch statistics first (more efficient)
      try {
        const statsResponse = await api.get('/hr/statistics');
        const statsData = statsResponse.data.data;
        
        if (statsData && statsData.overall) {
          setStats({
            totalEmployees: statsData.overall.totalEmployees || 0,
            activeEmployees: statsData.overall.activeEmployees || 0,
            totalDepartments: statsData.overall.totalDepartments || 0,
            newThisMonth: statsData.overall.newThisMonth || 0,
            newThisYear: statsData.overall.newThisYear || 0,
            avgSalary: statsData.overall.avgSalary || 0,
            totalSalary: statsData.overall.totalSalary || 0
          });
        }
      } catch (statsError) {
        console.log('Statistics endpoint not available, falling back to individual calls');
      }
      
      // Fetch employees
      const employeesResponse = await api.get('/hr/employees?limit=1000');
      const employees = employeesResponse.data.data || [];
      setAllEmployees(employees);
      const canAccessHRModule = hasModuleAccess(user?.role, MODULE_KEYS.HR);
      if (canAccessHRModule) {
        const today = new Date();
        const completedProbation = employees
          .filter((emp) => {
            const probationEnd = getProbationEndDate(emp);
            if (!probationEnd) return false;
            if (emp.confirmationDate) return false;
            if (['Draft', 'Resigned', 'Terminated', 'Retired'].includes(emp.employmentStatus)) return false;
            return probationEnd <= today;
          })
          .sort((a, b) => getProbationEndDate(b) - getProbationEndDate(a));

        setProbationCompletedEmployees(completedProbation);
        setProbationDialogOpen(completedProbation.length > 0);
      } else {
        setProbationCompletedEmployees([]);
        setProbationDialogOpen(false);
      }
      
      // Fetch departments
      const departmentsResponse = await api.get('/hr/departments');
      const departments = departmentsResponse.data.data || [];
      
      // If we don't have stats from the statistics endpoint, calculate them
      if (!stats.totalEmployees) {
        const activeEmployees = employees.filter(emp => emp.isActive);
        const now = new Date();
        const resignationsCount = employees.filter(emp => emp.employmentStatus === 'Resigned').length;
        const disciplinaryCasesCount = employees.filter(emp => isDisciplinaryTermination(emp)).length;
        const employeesLeftCount = employees.filter(emp =>
          ['Resigned', 'Terminated', 'Retired'].includes(emp.employmentStatus)
        ).length;
        const averageTotalEmployees = (employees.length + activeEmployees.length) / 2;
        const turnoverRate = averageTotalEmployees > 0
          ? Number(((employeesLeftCount / averageTotalEmployees) * 100).toFixed(2))
          : 0;
        const newThisMonthList = employees.filter(emp => {
          const hireDate = getEmployeeHireDate(emp);
          return hireDate &&
            hireDate.getMonth() === now.getMonth() &&
            hireDate.getFullYear() === now.getFullYear();
        });

        const totalBasicSalary = employees.reduce((sum, emp) => sum + (emp.salary?.basic || 0), 0);
        const totalGrossSalary = employees.reduce((sum, emp) => {
          const gross = (emp.salary?.basic || 0) + 
                       (emp.salary?.houseRent || 0) + 
                       (emp.salary?.medical || 0) + 
                       (emp.salary?.conveyance || 0) + 
                       (emp.salary?.special || 0) + 
                       (emp.salary?.other || 0);
          return sum + gross;
        }, 0);
        const avgBasicSalary = employees.length > 0 ? totalBasicSalary / employees.length : 0;
        const avgGrossSalary = employees.length > 0 ? totalGrossSalary / employees.length : 0;
        
        const newThisYearCount = employees.filter(emp => {
          const hireDate = getEmployeeHireDate(emp);
          return hireDate && hireDate.getFullYear() === now.getFullYear();
        }).length;

        setStats({
          totalEmployees: employees.length,
          activeEmployees: activeEmployees.length,
          totalDepartments: departments.length,
          newThisMonth: newThisMonthList.length,
          newThisYear: newThisYearCount,
          resignations: resignationsCount,
          disciplinaryCases: disciplinaryCasesCount,
          turnoverRate,
          avgBasicSalary: avgBasicSalary,
          avgGrossSalary: avgGrossSalary,
          totalBasicSalary: totalBasicSalary,
          totalGrossSalary: totalGrossSalary
        });
      }

      // Hire-date metrics from loaded employees (authoritative; /hr/statistics does not return these)
      const nowHire = new Date();
      const newThisMonthListData = employees.filter(emp => {
        const hireDate = getEmployeeHireDate(emp);
        return hireDate &&
          hireDate.getMonth() === nowHire.getMonth() &&
          hireDate.getFullYear() === nowHire.getFullYear();
      });
      const newThisYearListData = employees.filter(emp => {
        const hireDate = getEmployeeHireDate(emp);
        return hireDate && hireDate.getFullYear() === nowHire.getFullYear();
      });
      const newThisMonthHires = newThisMonthListData.length;
      const newThisYearHires = newThisYearListData.length;
      const resignationsCount = employees.filter(emp => emp.employmentStatus === 'Resigned').length;
      const disciplinaryCasesCount = employees.filter(emp => isDisciplinaryTermination(emp)).length;
      const activeEmployeesCount = employees.filter(emp => emp.isActive).length;
      const employeesLeftCount = employees.filter(emp =>
        ['Resigned', 'Terminated', 'Retired'].includes(emp.employmentStatus)
      ).length;
      const averageTotalEmployees = (employees.length + activeEmployeesCount) / 2;
      const turnoverRate = averageTotalEmployees > 0
        ? Number(((employeesLeftCount / averageTotalEmployees) * 100).toFixed(2))
        : 0;
      setStats(prev => ({
        ...prev,
        newThisMonth: newThisMonthHires,
        newThisYear: newThisYearHires,
        resignations: resignationsCount,
        disciplinaryCases: disciplinaryCasesCount,
        turnoverRate
      }));
      setEmployeesWithHireDate(
        [...employees]
          .filter(emp => getEmployeeHireDate(emp))
          .sort((a, b) => getEmployeeHireDate(b) - getEmployeeHireDate(a))
      );

      const recentHiresSorted = [...employees]
        .map(emp => ({ emp, hireDate: getEmployeeHireDate(emp) }))
        .filter(({ hireDate }) => hireDate)
        .sort((a, b) => b.hireDate - a.hireDate)
        .slice(0, 8)
        .map(({ emp }) => emp);
      setRecentEmployees(recentHiresSorted);

      // Department statistics
      const deptStats = departments.map(dept => ({
        ...dept,
        employeeCount: employees.filter(emp => emp.placementDepartment?.name === dept.name).length
      }));

      setDepartments(deptStats);
      
      // Process chart data
      processChartData(employees, deptStats);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      // More specific error messages
      if (error.response?.status === 401) {
        setError('Authentication required. Please log in to access HR data.');
      } else if (error.response?.status === 403) {
        setError('Access denied. You do not have permission to view HR data.');
      } else if (error.response?.status === 404) {
        setError('HR endpoints not found. Please check if the backend is running.');
      } else if (error.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(`Failed to load dashboard data: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PageLoading 
        message="Loading HR dashboard..." 
        showSkeleton={true}
        skeletonType="cards"
      />
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {error.includes('Authentication required') && (
                <Typography 
                  variant="body2" 
                  sx={{ cursor: 'pointer', textDecoration: 'underline', color: 'primary.main' }}
                  onClick={() => navigate('/login')}
                >
                  Login
                </Typography>
              )}
              <Typography 
                variant="body2" 
                sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => {
                  setError(null);
                  fetchDashboardData();
                }}
              >
                Retry
              </Typography>
            </Box>
          }
        >
          <Typography variant="body1" gutterBottom>
            {error}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {error.includes('Authentication required') 
              ? 'Please log in to access the HR dashboard.'
              : 'Please check your internet connection and try again.'
            }
          </Typography>
        </Alert>
      </Box>
    );
  }

  const nowForFilter = new Date();
  const filteredNewHires = employeesWithHireDate.filter(emp => {
    const hireDate = getEmployeeHireDate(emp);
    if (!hireDate) return false;
    if (newHireFilter === 'year') {
      return hireDate.getFullYear() === nowForFilter.getFullYear();
    }
    return (
      hireDate.getMonth() === nowForFilter.getMonth() &&
      hireDate.getFullYear() === nowForFilter.getFullYear()
    );
  });

  const filteredStatusEmployees = allEmployees
    .filter(emp => (
      statusListDialog.type === 'disciplinary'
        ? isDisciplinaryTermination(emp)
        : emp.employmentStatus === 'Resigned'
    ))
    .sort((a, b) => {
      const aDate = getEmployeeHireDate(a) || new Date(0);
      const bDate = getEmployeeHireDate(b) || new Date(0);
      return bDate - aDate;
    });

  const employeesLeftList = allEmployees
    .filter(emp => ['Resigned', 'Terminated', 'Retired'].includes(emp.employmentStatus))
    .sort((a, b) => {
      const aDate = getEmployeeHireDate(a) || new Date(0);
      const bDate = getEmployeeHireDate(b) || new Date(0);
      return bDate - aDate;
    });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        HR Dashboard
      </Typography>
      
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card
            sx={{ cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { boxShadow: 4 } }}
            onClick={() => navigate('/hr/employees')}
          >
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Employees
              </Typography>
              <Typography variant="h4">
                {stats.totalEmployees ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <Card
            sx={{ cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { boxShadow: 4 } }}
            onClick={() => navigate('/hr/employees')}
          >
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Employees
              </Typography>
              <Typography variant="h4">
                {stats.activeEmployees ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <Card
            sx={{ cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { boxShadow: 4 } }}
            onClick={() => navigate('/hr/departments')}
          >
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Departments
              </Typography>
              <Typography variant="h4">
                {stats.totalDepartments ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={2}>
          <Card
            sx={{ cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { boxShadow: 4 } }}
            onClick={() => setStatusListDialog({ open: true, type: 'resignations' })}
          >
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Resignations
              </Typography>
              <Typography variant="h4">
                {stats.resignations ?? 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card
            sx={{ cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { boxShadow: 4 } }}
            onClick={() => setStatusListDialog({ open: true, type: 'disciplinary' })}
          >
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Disciplinary Cases
              </Typography>
              <Typography variant="h4">
                {stats.disciplinaryCases ?? 0}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                (From termination reason)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card
            sx={{ cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { boxShadow: 4 } }}
            onClick={() => setStatusListDialog({ open: true, type: 'left' })}
          >
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Turnover Rate
              </Typography>
              <Typography variant="h4">
                {stats.turnoverRate ?? 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* New hires (by employee hire date) */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': { boxShadow: 4 }
            }}
            onClick={() => setHireListDialogOpen(true)}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    New Hires
                  </Typography>
                  <Typography variant="h4">
                    {filteredNewHires.length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {newHireFilter === 'year'
                      ? `${new Date().getFullYear()} (hire-date based)`
                      : 'This month (hire-date based)'}
                  </Typography>
                </Box>
                <Box>
                  <FormControl
                    size="small"
                    onClick={(e) => e.stopPropagation()}
                    sx={{ minWidth: 150 }}
                  >
                    <Select
                      value={newHireFilter}
                      onChange={(e) => setNewHireFilter(e.target.value)}
                    >
                      <MenuItem value="month">This Month</MenuItem>
                      <MenuItem value="year">This Year</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Recent hires (by hire date)
            </Typography>
            {recentEmployees.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No employees with a hire date yet.
              </Typography>
            ) : (
              <List dense disablePadding>
                {recentEmployees.map((emp) => {
                  const hd = getEmployeeHireDate(emp);
                  const label = hd
                    ? hd.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : '—';
                  return (
                    <ListItem key={emp._id} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        onClick={() => navigate(`/hr/employees/${emp._id}`)}
                        sx={{ borderRadius: 1 }}
                      >
                        <ListItemAvatar>
                          <Avatar src={emp.profileImage} sx={{ width: 36, height: 36 }}>
                            {(emp.firstName || '?')[0]}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee'}
                          secondary={
                            <>
                              {emp.placementDepartment?.name || emp.department?.name || '—'}
                              {' · '}
                              <Chip component="span" size="small" label={label} sx={{ height: 20, ml: 0.5 }} />
                            </>
                          }
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={hireListDialogOpen}
        onClose={() => setHireListDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 6 }}>
          {`New Hires - ${newHireFilter === 'year' ? 'This Year' : 'This Month'} (${filteredNewHires.length})`}
          <IconButton
            onClick={() => setHireListDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {filteredNewHires.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No employees found for this hire-date filter.
            </Typography>
          ) : (
            <List disablePadding>
              {filteredNewHires.map((emp) => {
                const hd = getEmployeeHireDate(emp);
                const label = hd
                  ? hd.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—';
                return (
                  <ListItem key={emp._id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate(`/hr/employees/${emp._id}`)} sx={{ borderRadius: 1 }}>
                      <ListItemAvatar>
                        <Avatar src={emp.profileImage}>
                          {(emp.firstName || '?')[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee'}
                        secondary={
                          <>
                            {emp.placementDepartment?.name || emp.department?.name || '—'}
                            {' · '}
                            <Chip component="span" size="small" label={label} sx={{ height: 20, ml: 0.5 }} />
                          </>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={statusListDialog.open}
        onClose={() => setStatusListDialog(prev => ({ ...prev, open: false }))}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 6 }}>
          {statusListDialog.type === 'disciplinary'
            ? `Disciplinary Cases (${filteredStatusEmployees.length})`
            : statusListDialog.type === 'left'
              ? `Employees Left (${employeesLeftList.length})`
              : `Resignations (${filteredStatusEmployees.length})`}
          <IconButton
            onClick={() => setStatusListDialog(prev => ({ ...prev, open: false }))}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {(statusListDialog.type === 'left' ? employeesLeftList : filteredStatusEmployees).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No employees found for this card.
            </Typography>
          ) : (
            <List disablePadding>
              {(statusListDialog.type === 'left' ? employeesLeftList : filteredStatusEmployees).map((emp) => {
                const hd = getEmployeeHireDate(emp);
                const hireLabel = hd
                  ? hd.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—';
                const reason = (emp.terminationReason || '').trim();
                return (
                  <ListItem key={emp._id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate(`/hr/employees/${emp._id}`)} sx={{ borderRadius: 1 }}>
                      <ListItemAvatar>
                        <Avatar src={emp.profileImage}>
                          {(emp.firstName || '?')[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee'}
                        secondary={
                          <>
                            {emp.placementDepartment?.name || emp.department?.name || '—'}
                            {' · '}
                            <Chip component="span" size="small" label={`Hire: ${hireLabel}`} sx={{ height: 20, ml: 0.5 }} />
                            {reason ? (
                              <Chip component="span" size="small" label={reason} sx={{ height: 20, ml: 0.5 }} />
                            ) : null}
                          </>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={probationDialogOpen}
        onClose={() => setProbationDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 6 }}>
          Probation Completed - Great Progress!
          <IconButton
            onClick={() => setProbationDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="success" sx={{ mb: 2 }}>
            Congratulations to the team! The following employees have successfully completed their probation period.
          </Alert>
          {probationCompletedEmployees.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No completed probation records found right now.
            </Typography>
          ) : (
            <List disablePadding>
              {probationCompletedEmployees.map((emp) => {
                const probationEndDate = getProbationEndDate(emp);
                const probationEndLabel = probationEndDate
                  ? probationEndDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—';
                return (
                  <ListItem key={emp._id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton onClick={() => navigate(`/hr/employees/${emp._id}`)} sx={{ borderRadius: 1 }}>
                      <ListItemAvatar>
                        <Avatar src={emp.profileImage}>
                          {(emp.firstName || '?')[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee'}
                        secondary={
                          <>
                            {emp.placementDepartment?.name || emp.department?.name || '—'}
                            {' · '}
                            <Chip component="span" size="small" label={`Probation ended: ${probationEndLabel}`} sx={{ height: 20, ml: 0.5 }} />
                          </>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
      </Dialog>

      {/* Charts Grid */}
      <Grid container spacing={3}>
        {/* Department Distribution */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
                🏢 Department Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData.departmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.3)" />
                  <XAxis dataKey="name" stroke="white" />
                  <YAxis stroke="white" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    formatter={(value) => [`${value} employees`, 'Count']}
                  />
                  <Bar dataKey="employees" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Gender Distribution */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1)'
            }} />
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ 
                color: 'white', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <span style={{ fontSize: '1.5rem' }}>👥</span>
                Gender Distribution & Salary Analysis
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={chartData.genderDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value, percentage, avgSalary, cx, cy, midAngle, innerRadius, outerRadius }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill="white" 
                          textAnchor={x > cx ? 'start' : 'end'} 
                          dominantBaseline="central"
                          fontSize="11"
                          fontWeight="600"
                          style={{
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'
                          }}
                        >
                          {`${name}\n${value} (${percentage}%)\n${formatPKR(avgSalary)}`}
                        </text>
                      );
                    }}
                    outerRadius={100}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={2000}
                    animationBegin={0}
                  >
                    {chartData.genderDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.fill}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255,255,255,0.95)', 
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '8px',
                      color: '#333',
                      padding: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                    formatter={(value, name, props) => [
                      <div style={{ color: '#333' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#1976d2', fontSize: '15px' }}>
                          {props.payload.name}
                        </div>
                        <div style={{ marginBottom: '3px' }}>Employees: <strong>{value}</strong> ({props.payload.percentage}%)</div>
                        <div style={{ marginBottom: '3px' }}>Avg Salary: <strong>{formatPKR(props.payload.avgSalary)}</strong></div>
                        <div>Performance: <strong>{props.payload.avgPerformance}/5</strong></div>
                      </div>,
                      ''
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ 
                mt: 2, 
                display: 'flex', 
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                gap: 1
              }}>
                {chartData.genderDistribution.map((item, index) => (
                  <Box key={index} sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    px: 1,
                    py: 0.5,
                    borderRadius: '8px'
                  }}>
                    <Box sx={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: '50%', 
                      backgroundColor: item.fill 
                    }} />
                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>
                      {item.name}: {item.percentage}%
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Employment Status */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            color: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #667eea, #764ba2, #f093fb)'
            }} />
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ 
                color: 'white', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <span style={{ fontSize: '1.5rem' }}>📋</span>
                Employment Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={chartData.employmentStatusDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value, percentage, cx, cy, midAngle, innerRadius, outerRadius }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill="white" 
                          textAnchor={x > cx ? 'start' : 'end'} 
                          dominantBaseline="central"
                          fontSize="12"
                          fontWeight="600"
                          style={{
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'
                          }}
                        >
                          {`${name}\n${value} (${percentage}%)`}
                        </text>
                      );
                    }}
                    outerRadius={100}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={2000}
                    animationBegin={500}
                  >
                    {chartData.employmentStatusDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.fill}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255,255,255,0.95)', 
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '8px',
                      color: '#333',
                      padding: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                    formatter={(value, name, props) => [
                      <div style={{ color: '#333' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#1976d2', fontSize: '15px' }}>
                          {props.payload.name}
                        </div>
                        <div style={{ marginBottom: '3px' }}>Employees: <strong>{value}</strong></div>
                        <div>Percentage: <strong>{props.payload.percentage}%</strong></div>
                      </div>,
                      ''
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ 
                mt: 2, 
                display: 'flex', 
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                gap: 1
              }}>
                {chartData.employmentStatusDistribution.map((item, index) => (
                  <Box key={index} sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    px: 1,
                    py: 0.5,
                    borderRadius: '8px'
                  }}>
                    <Box sx={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: '50%', 
                      backgroundColor: item.fill 
                    }} />
                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>
                      {item.name}: {item.percentage}%
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Employment Type */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            color: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #A8E6CF, #DCEDC8, #FFD3B6)'
            }} />
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ 
                color: 'white', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <span style={{ fontSize: '1.5rem' }}>💼</span>
                Employment Type Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={chartData.employmentTypeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value, percentage, cx, cy, midAngle, innerRadius, outerRadius }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill="white" 
                          textAnchor={x > cx ? 'start' : 'end'} 
                          dominantBaseline="central"
                          fontSize="12"
                          fontWeight="600"
                          style={{
                            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'
                          }}
                        >
                          {`${name}\n${value} (${percentage}%)`}
                        </text>
                      );
                    }}
                    outerRadius={100}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value"
                    animationDuration={2000}
                    animationBegin={1000}
                  >
                    {chartData.employmentTypeDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.fill}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255,255,255,0.95)', 
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '8px',
                      color: '#333',
                      padding: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                    formatter={(value, name, props) => [
                      <div style={{ color: '#333' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#1976d2', fontSize: '15px' }}>
                          {props.payload.name}
                        </div>
                        <div style={{ marginBottom: '3px' }}>Employees: <strong>{value}</strong></div>
                        <div>Percentage: <strong>{props.payload.percentage}%</strong></div>
                      </div>,
                      ''
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ 
                mt: 2, 
                display: 'flex', 
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                gap: 1
              }}>
                {chartData.employmentTypeDistribution.map((item, index) => (
                  <Box key={index} sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.5,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    px: 1,
                    py: 0.5,
                    borderRadius: '8px'
                  }}>
                    <Box sx={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: '50%', 
                      backgroundColor: item.fill 
                    }} />
                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 500 }}>
                      {item.name}: {item.percentage}%
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Salary vs Years of Service */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
                📈 Salary vs Years of Service
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.3)" />
                  <XAxis type="number" dataKey="experience" name="Years of Service" stroke="white" />
                  <YAxis type="number" dataKey="salary" name="Salary" stroke="white" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    formatter={(value, name) => [
                      name === 'experience' ? `${value} years` : formatPKR(value),
                      name === 'experience' ? 'Years of Service' : 'Salary'
                    ]}
                  />
                  <Scatter dataKey="salary" fill="#8884d8" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Experience Levels */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
                🎓 Experience Levels & Average Salary
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData.experienceLevels} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.3)" />
                  <XAxis type="number" stroke="white" />
                  <YAxis dataKey="level" type="category" stroke="white" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    formatter={(value, name) => [
                      name === 'count' ? `${value} employees` : formatPKR(value),
                      name === 'count' ? 'Count' : 'Avg Salary'
                    ]}
                  />
                  <Bar dataKey="count" fill="#82ca9d" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="avgSalary" fill="#ffc658" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Department Salary Analysis */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
                💰 Department Salary Analysis
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={chartData.departmentSalaryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.3)" />
                  <XAxis dataKey="department" stroke="white" />
                  <YAxis yAxisId="left" stroke="white" />
                  <YAxis yAxisId="right" orientation="right" stroke="white" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    formatter={(value, name) => [
                      name === 'employeeCount' ? `${value} employees` : formatPKR(value),
                      name === 'employeeCount' ? 'Employees' : 'Avg Salary'
                    ]}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="employeeCount" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="avgSalary" stroke="#ffc658" strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Monthly Hiring Trends */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
                📅 Monthly hiring trends (by hire date)
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData.monthlyHires}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.3)" />
                  <XAxis dataKey="month" stroke="white" />
                  <YAxis stroke="white" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    formatter={(value) => [`${value} hires`, 'New Hires']}
                  />
                  <Area type="monotone" dataKey="hires" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Salary Range Analysis */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
                💰 Salary Range & Years of Service
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={chartData.salaryRangeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.3)" />
                  <XAxis dataKey="range" stroke="white" />
                  <YAxis yAxisId="left" stroke="white" />
                  <YAxis yAxisId="right" orientation="right" stroke="white" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    formatter={(value, name, props) => [
                      name === 'count' ? `${value} employees` : `${value} years`,
                      name === 'count' ? 'Employees' : 'Avg Years of Service'
                    ]}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="avgYearsOfService" stroke="#ffc658" strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Leave Balance Summary */}
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: 'white' }}>
                🏖️ Leave Balance Summary
              </Typography>
              <Box sx={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="white" sx={{ mb: 2 }}>
                    {chartData.leaveBalanceData.length > 0 ? 
                      (() => {
                        const total = chartData.leaveBalanceData.reduce((sum, emp) => sum + (emp.total || 0), 0);
                        const avg = total / chartData.leaveBalanceData.length;
                        return isNaN(avg) ? 0 : Math.round(avg);
                      })() : 0}
                  </Typography>
                  <Typography variant="h6" color="white" sx={{ opacity: 0.9 }}>
                    Average Leave Days
                  </Typography>
                  <Typography variant="body2" color="white" sx={{ opacity: 0.7, mt: 1 }}>
                    Per Employee
                  </Typography>
                  <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="white">
                        {chartData.leaveBalanceData.length > 0 ? 
                          (() => {
                            const total = chartData.leaveBalanceData.reduce((sum, emp) => sum + (emp.annual || 0), 0);
                            const avg = total / chartData.leaveBalanceData.length;
                            return isNaN(avg) ? 0 : Math.round(avg);
                          })() : 0}
                      </Typography>
                      <Typography variant="caption" color="white" sx={{ opacity: 0.8 }}>
                        Annual
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="white">
                        {chartData.leaveBalanceData.length > 0 ? 
                          (() => {
                            const total = chartData.leaveBalanceData.reduce((sum, emp) => sum + (emp.sick || 0), 0);
                            const avg = total / chartData.leaveBalanceData.length;
                            return isNaN(avg) ? 0 : Math.round(avg);
                          })() : 0}
                      </Typography>
                      <Typography variant="caption" color="white" sx={{ opacity: 0.8 }}>
                        Sick
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" color="white">
                        {chartData.leaveBalanceData.length > 0 ? 
                          (() => {
                            const total = chartData.leaveBalanceData.reduce((sum, emp) => sum + (emp.personal || 0), 0);
                            const avg = total / chartData.leaveBalanceData.length;
                            return isNaN(avg) ? 0 : Math.round(avg);
                          })() : 0}
                      </Typography>
                      <Typography variant="caption" color="white" sx={{ opacity: 0.8 }}>
                        Personal
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default HRDashboard; 