import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  Tabs,
  Tab,
  Avatar,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Tooltip
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Assessment as ReportIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { format, subMonths, startOfYear, endOfYear, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from 'date-fns';
import axios from 'axios';
import api from '../../../services/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Debug authentication issues
const debugAuthentication = () => {
  console.log('🔍 Debugging Authentication...');
  
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  console.log('Token exists:', !!token);
  console.log('User exists:', !!user);
  
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Token payload:', payload);
      console.log('Token expires:', new Date(payload.exp * 1000));
      console.log('Token expired:', Date.now() > payload.exp * 1000);
    } catch (error) {
      console.error('Error decoding token:', error);
    }
  }
  
  return { hasToken: !!token, hasUser: !!user, token, user };
};

const LeaveReports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // Filter states
  const [filters, setFilters] = useState({
    year: 2025, // Default to 2025 where the data exists
    month: 'all',
    department: 'all',
    leaveType: 'all',
    status: 'all',
    dateRange: 'year', // 'year', 'month', 'quarter', 'custom'
    startDate: '',
    endDate: ''
  });
  
  // Data states
  const [statistics, setStatistics] = useState({});
  const [departmentStats, setDepartmentStats] = useState([]);
  const [employeeStats, setEmployeeStats] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadReportData();
  }, [filters, tabValue]);

  const loadInitialData = async () => {
    try {
      console.log('🔍 Loading initial leave report data...');
      
      // Debug authentication
      const authDebug = debugAuthentication();
      console.log('Auth debug:', authDebug);
      
      const [typesRes, deptRes] = await Promise.all([
        api.get('/leaves/types'),
        api.get('/hr/departments')
      ]);
      
      setLeaveTypes(typesRes.data.data);
      setDepartments(deptRes.data.data);
    } catch (error) {
      console.error('Error loading initial data:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        code: error.code
      });
      
      let errorMessage = 'Failed to load initial data';
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
        errorMessage = 'Cannot connect to server. Please check if the backend is running.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication expired. Please login again.';
      }
      
      setError(errorMessage);
    }
  };

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔍 Loading leave report data with filters:', filters);
      
      // Build query parameters
      const params = new URLSearchParams({
        year: filters.year
      });
      
      if (filters.month && filters.month !== 'all') {
        params.append('month', filters.month);
      }
      
      if (filters.department && filters.department !== 'all') {
        params.append('department', filters.department);
      }
      
      // Load all report data in parallel
      const [
        statsRes,
        deptStatsRes,
        empStatsRes,
        trendsRes
      ] = await Promise.all([
        api.get(`/leaves/statistics?${params}`),
        api.get(`/leaves/reports/department-stats?${params}`),
        api.get(`/leaves/reports/employee-stats?${params}&limit=50`),
        api.get(`/leaves/reports/monthly-trends?${params}`)
      ]);
      
      console.log('📊 Report data loaded successfully');
      console.log('Statistics:', statsRes.data.data);
      console.log('Department Stats:', deptStatsRes.data.data);
      console.log('Employee Stats:', empStatsRes.data.data);
      console.log('Monthly Trends:', trendsRes.data.data);
      
      // Transform statistics from array format to object format
      const statsArray = Array.isArray(statsRes.data.data) ? statsRes.data.data : [];
      const transformedStats = {
        totalRequests: 0,
        approvedRequests: 0,
        pendingRequests: 0,
        rejectedRequests: 0,
        totalDays: 0,
        approvedDays: 0,
        pendingDays: 0,
        rejectedDays: 0
      };
      
      // Aggregate data from all status groups
      statsArray.forEach(stat => {
        transformedStats.totalRequests += stat.totalRequests || 0;
        transformedStats.totalDays += stat.totalDays || 0;
        
        if (stat._id === 'approved') {
          transformedStats.approvedRequests = stat.totalRequests || 0;
          transformedStats.approvedDays = stat.totalDays || 0;
        } else if (stat._id === 'pending') {
          transformedStats.pendingRequests = stat.totalRequests || 0;
          transformedStats.pendingDays = stat.totalDays || 0;
        } else if (stat._id === 'rejected') {
          transformedStats.rejectedRequests = stat.totalRequests || 0;
          transformedStats.rejectedDays = stat.totalDays || 0;
        }
      });
      
      setStatistics(transformedStats);
      setDepartmentStats(Array.isArray(deptStatsRes.data.data) ? deptStatsRes.data.data : []);
      setEmployeeStats(Array.isArray(empStatsRes.data.data) ? empStatsRes.data.data : []);
      
      // Map monthly trends data to match frontend expectations
      const mappedTrends = Array.isArray(trendsRes.data.data) ? trendsRes.data.data.map(trend => ({
        month: trend.month,
        monthName: trend.monthName,
        requests: trend.totalRequests || 0,
        days: trend.totalDays || 0,
        trend: 0 // Default trend value since we don't have previous data for comparison
      })) : [];
      setMonthlyTrends(mappedTrends);
      
    } catch (error) {
      console.error('Error loading report data:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      let errorMessage = 'Failed to load report data';
      if (error.response?.status === 401) {
        errorMessage = 'Authentication expired. Please login again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to view leave reports.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      year: 2025, // Default to 2025 where the data exists
      month: 'all',
      department: 'all',
      leaveType: 'all',
      status: 'all',
      dateRange: 'year',
      startDate: '',
      endDate: ''
    });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const exportReport = async (format = 'excel') => {
    try {
      setLoading(true);
      
      if (format === 'excel') {
        await exportToExcel();
      } else if (format === 'pdf') {
        await exportToPDF();
      }
      
    } catch (error) {
      console.error('Error exporting report:', error);
      setError('Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      // Prepare data for Excel export
      const workbook = XLSX.utils.book_new();
      
      // Overview Summary Sheet
      const overviewData = [
        ['Leave Reports Summary', ''],
        ['Generated Date', new Date().toLocaleDateString()],
        ['Year', filters.year],
        ['Department', filters.department === 'all' ? 'All Departments' : filters.department],
        ['Leave Type', filters.leaveType === 'all' ? 'All Types' : filters.leaveType],
        ['Status', filters.status === 'all' ? 'All Status' : filters.status],
        ['', ''],
        ['Metric', 'Value'],
        ['Total Requests', statistics.totalRequests || 0],
        ['Approved Requests', statistics.approvedRequests || 0],
        ['Pending Requests', statistics.pendingRequests || 0],
        ['Rejected Requests', statistics.rejectedRequests || 0],
        ['Total Days', statistics.totalDays || 0],
        ['Approved Days', statistics.approvedDays || 0],
        ['Pending Days', statistics.pendingDays || 0],
        ['Rejected Days', statistics.rejectedDays || 0],
        ['Approval Rate', statistics.totalRequests > 0 ? 
          Math.round((statistics.approvedRequests / statistics.totalRequests) * 100) + '%' : '0%']
      ];
      
      const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
      XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');
      
      // Department Analysis Sheet
      if (Array.isArray(departmentStats) && departmentStats.length > 0) {
        const deptData = [
          ['Department', 'Total Requests', 'Approved Requests', 'Pending Requests', 'Rejected Requests', 'Total Days', 'Approval Rate']
        ];
        
        departmentStats.forEach(dept => {
          const approvalRate = dept.totalRequests > 0 ? 
            Math.round((dept.approvedRequests / dept.totalRequests) * 100) + '%' : '0%';
          deptData.push([
            dept.name || dept._id,
            dept.totalRequests || 0,
            dept.approvedRequests || 0,
            dept.pendingRequests || 0,
            dept.rejectedRequests || 0,
            dept.totalDays || 0,
            approvalRate
          ]);
        });
        
        const deptSheet = XLSX.utils.aoa_to_sheet(deptData);
        XLSX.utils.book_append_sheet(workbook, deptSheet, 'Department Analysis');
      }
      
      // Employee Analysis Sheet
      if (Array.isArray(employeeStats) && employeeStats.length > 0) {
        const empData = [
          ['Employee Name', 'Employee ID', 'Department', 'Total Requests', 'Approved Requests', 'Pending Requests', 'Rejected Requests', 'Total Days', 'Approval Rate']
        ];
        
        employeeStats.forEach(emp => {
          const approvalRate = emp.totalRequests > 0 ? 
            Math.round((emp.approvedRequests / emp.totalRequests) * 100) + '%' : '0%';
          empData.push([
            emp.employeeName || 'N/A',
            emp.employeeId || 'N/A',
            emp.department || 'N/A',
            emp.totalRequests || 0,
            emp.approvedRequests || 0,
            emp.pendingRequests || 0,
            emp.rejectedRequests || 0,
            emp.totalDays || 0,
            approvalRate
          ]);
        });
        
        const empSheet = XLSX.utils.aoa_to_sheet(empData);
        XLSX.utils.book_append_sheet(workbook, empSheet, 'Employee Analysis');
      }
      
      // Monthly Trends Sheet
      if (Array.isArray(monthlyTrends) && monthlyTrends.length > 0) {
        const trendsData = [
          ['Month', 'Total Requests', 'Total Days', 'Approved Requests', 'Pending Requests', 'Rejected Requests']
        ];
        
        monthlyTrends.forEach(month => {
          trendsData.push([
            month.monthName || `Month ${month.month}`,
            month.requests || 0,
            month.days || 0,
            month.approvedRequests || 0,
            month.pendingRequests || 0,
            month.rejectedRequests || 0
          ]);
        });
        
        const trendsSheet = XLSX.utils.aoa_to_sheet(trendsData);
        XLSX.utils.book_append_sheet(workbook, trendsSheet, 'Monthly Trends');
      }
      
      // Generate filename
      const filename = `Leave_Reports_${filters.year}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Save the file
      XLSX.writeFile(workbook, filename);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw error;
    }
  };

  const exportToPDF = async () => {
    try {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text('Leave Reports', 20, 20);
      
      // Add generation info
      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 35);
      doc.text(`Year: ${filters.year}`, 20, 45);
      doc.text(`Department: ${filters.department === 'all' ? 'All Departments' : filters.department}`, 20, 55);
      
      let yPosition = 70;
      
      // Overview Summary
      doc.setFontSize(16);
      doc.text('Overview Summary', 20, yPosition);
      yPosition += 15;
      
      const overviewData = [
        ['Metric', 'Value'],
        ['Total Requests', statistics.totalRequests || 0],
        ['Approved Requests', statistics.approvedRequests || 0],
        ['Pending Requests', statistics.pendingRequests || 0],
        ['Rejected Requests', statistics.rejectedRequests || 0],
        ['Total Days', statistics.totalDays || 0],
        ['Approved Days', statistics.approvedDays || 0],
        ['Pending Days', statistics.pendingDays || 0],
        ['Rejected Days', statistics.rejectedDays || 0],
        ['Approval Rate', statistics.totalRequests > 0 ? 
          Math.round((statistics.approvedRequests / statistics.totalRequests) * 100) + '%' : '0%']
      ];
      
      doc.autoTable({
        startY: yPosition,
        head: [overviewData[0]],
        body: overviewData.slice(1),
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        margin: { left: 20, right: 20 }
      });
      
      yPosition = doc.lastAutoTable.finalY + 20;
      
      // Department Analysis
      if (Array.isArray(departmentStats) && departmentStats.length > 0) {
        doc.setFontSize(16);
        doc.text('Department Analysis', 20, yPosition);
        yPosition += 15;
        
        const deptData = [
          ['Department', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Total Days', 'Approval Rate']
        ];
        
        departmentStats.forEach(dept => {
          const approvalRate = dept.totalRequests > 0 ? 
            Math.round((dept.approvedRequests / dept.totalRequests) * 100) + '%' : '0%';
          deptData.push([
            dept.name || dept._id,
            dept.totalRequests || 0,
            dept.approvedRequests || 0,
            dept.pendingRequests || 0,
            dept.rejectedRequests || 0,
            dept.totalDays || 0,
            approvalRate
          ]);
        });
        
        doc.autoTable({
          startY: yPosition,
          head: [deptData[0]],
          body: deptData.slice(1),
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185] },
          margin: { left: 20, right: 20 }
        });
        
        yPosition = doc.lastAutoTable.finalY + 20;
      }
      
      // Employee Analysis
      if (Array.isArray(employeeStats) && employeeStats.length > 0) {
        doc.setFontSize(16);
        doc.text('Employee Analysis', 20, yPosition);
        yPosition += 15;
        
        const empData = [
          ['Employee Name', 'Employee ID', 'Department', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Total Days', 'Approval Rate']
        ];
        
        employeeStats.forEach(emp => {
          const approvalRate = emp.totalRequests > 0 ? 
            Math.round((emp.approvedRequests / emp.totalRequests) * 100) + '%' : '0%';
          empData.push([
            emp.employeeName || 'N/A',
            emp.employeeId || 'N/A',
            emp.department || 'N/A',
            emp.totalRequests || 0,
            emp.approvedRequests || 0,
            emp.pendingRequests || 0,
            emp.rejectedRequests || 0,
            emp.totalDays || 0,
            approvalRate
          ]);
        });
        
        doc.autoTable({
          startY: yPosition,
          head: [empData[0]],
          body: empData.slice(1),
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185] },
          margin: { left: 20, right: 20 }
        });
        
        yPosition = doc.lastAutoTable.finalY + 20;
      }
      
      // Monthly Trends
      if (Array.isArray(monthlyTrends) && monthlyTrends.length > 0) {
        doc.setFontSize(16);
        doc.text('Monthly Trends', 20, yPosition);
        yPosition += 15;
        
        const trendsData = [
          ['Month', 'Total Requests', 'Total Days', 'Approved', 'Pending', 'Rejected']
        ];
        
        monthlyTrends.forEach(month => {
          trendsData.push([
            month.monthName || `Month ${month.month}`,
            month.requests || 0,
            month.days || 0,
            month.approvedRequests || 0,
            month.pendingRequests || 0,
            month.rejectedRequests || 0
          ]);
        });
        
        doc.autoTable({
          startY: yPosition,
          head: [trendsData[0]],
          body: trendsData.slice(1),
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185] },
          margin: { left: 20, right: 20 }
        });
      }
      
      // Generate filename and save
      const filename = `Leave_Reports_${filters.year}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw error;
    }
  };

  const getEmployeeInitials = (employee) => {
    return `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const calculateTrend = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getTrendIcon = (trend) => {
    if (trend && trend > 0) return <TrendingUpIcon color="error" />;
    if (trend && trend < 0) return <TrendingDownIcon color="success" />;
    return null;
  };

  const getTrendColor = (trend) => {
    if (trend && trend > 0) return 'error.main';
    if (trend && trend < 0) return 'success.main';
    return 'text.secondary';
  };

  if (loading && Object.keys(statistics).length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        {/* Header Skeleton */}
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="text" width="25%" height={60} />
          <Skeleton variant="text" width="40%" height={30} />
        </Box>

        {/* Filters Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <Box display="flex" gap={1}>
                  <Skeleton variant="rectangular" width="50%" height={36} sx={{ borderRadius: 1 }} />
                  <Skeleton variant="rectangular" width="50%" height={36} sx={{ borderRadius: 1 }} />
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Statistics Cards Skeleton */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Grid item xs={12} md={4} key={item}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
                    <Skeleton variant="circular" width={48} height={48} sx={{ mr: 2 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="70%" height={20} />
                      <Skeleton variant="text" width="50%" height={16} />
                    </Box>
                  </Box>
                  <Skeleton variant="text" width="80%" height={32} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Tabs Skeleton */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Box display="flex">
                <Skeleton variant="rectangular" width={120} height={48} sx={{ mr: 2 }} />
                <Skeleton variant="rectangular" width={120} height={48} sx={{ mr: 2 }} />
                <Skeleton variant="rectangular" width={120} height={48} />
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Reports Table Skeleton */}
        <Card>
          <CardContent>
            <Skeleton variant="text" width="20%" height={32} sx={{ mb: 2 }} />
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><Skeleton variant="text" width="60%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="50%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="70%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="40%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="60%" /></TableCell>
                    <TableCell><Skeleton variant="text" width="50%" /></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((row) => (
                    <TableRow key={row}>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Skeleton variant="circular" width={32} height={32} sx={{ mr: 2 }} />
                          <Box>
                            <Skeleton variant="text" width={120} height={20} />
                            <Skeleton variant="text" width={80} height={16} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 12 }} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={100} height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={60} height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={80} height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width={70} height={20} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Leave Reports
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Grid container spacing={2}>
            {/* Date Range Filter */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                >
                  <MenuItem value="year">Full Year</MenuItem>
                  <MenuItem value="month">Current Month</MenuItem>
                  <MenuItem value="quarter">Current Quarter</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Year Filter */}
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Year"
                type="number"
                value={filters.year}
                onChange={(e) => handleFilterChange('year', parseInt(e.target.value))}
                inputProps={{ min: 2020, max: 2030 }}
              />
            </Grid>

            {/* Month Filter - only show if not custom range */}
            {filters.dateRange !== 'custom' && (
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={filters.month}
                    onChange={(e) => handleFilterChange('month', e.target.value)}
                  >
                    <MenuItem value="all">All Months</MenuItem>
                    {Array.from({ length: 12 }, (_, i) => (
                      <MenuItem key={i + 1} value={i + 1}>
                        {format(new Date(2024, i), 'MMMM')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Custom Date Range - only show if custom is selected */}
            {filters.dateRange === 'custom' && (
              <>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    label="Start Date"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    label="End Date"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}

            {/* Department Filter */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                >
                  <MenuItem value="all">All Departments</MenuItem>
                  {Array.isArray(departments) && departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Leave Type Filter */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Leave Type</InputLabel>
                <Select
                  value={filters.leaveType}
                  onChange={(e) => handleFilterChange('leaveType', e.target.value)}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  {Array.isArray(leaveTypes) && leaveTypes.map((type) => (
                    <MenuItem key={type._id} value={type._id}>
                      {type.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Status Filter */}
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Rejected">Rejected</MenuItem>
                  <MenuItem value="Cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', gap: 1, height: '100%', alignItems: 'end' }}>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={loadReportData}
                  fullWidth
                >
                  Refresh
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={clearFilters}
                  fullWidth
                >
                  Clear
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={() => exportReport('excel')}
        >
          Export Excel
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => exportReport('pdf')}
        >
          Export PDF
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Department Analysis" />
          <Tab label="Employee Analysis" />
          <Tab label="Monthly Trends" />
        </Tabs>
      </Box>

      {/* Overview Tab - Overview Cards + Detailed Records */}
      {tabValue === 0 && (
        <>
          {/* Overview Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Total Requests
                  </Typography>
                  <Typography variant="h4" color="primary">
                    {statistics.totalRequests || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This Year
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="success.main" gutterBottom>
                    Approved Requests
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {statistics.approvedRequests || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {statistics.totalRequests > 0 ? 
                      Math.round((statistics.approvedRequests / statistics.totalRequests) * 100) : 0}% Approval Rate
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="warning.main" gutterBottom>
                    Pending Requests
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {statistics.pendingRequests || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Awaiting Approval
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="error.main" gutterBottom>
                    Total Days
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {statistics.totalDays || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Leave Days Taken
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Detailed Records */}
          <Grid container spacing={3}>
            {/* Recent Leave Requests */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Leave Requests
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Days</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.isArray(employeeStats) && employeeStats.slice(0, 5).map((emp) => (
                        <TableRow key={emp._id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 24, height: 24 }}>
                                {getEmployeeInitials(emp)}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {emp.employeeName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {emp.employeeId}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>Annual Leave</TableCell>
                          <TableCell align="right">{emp.totalDays}</TableCell>
                          <TableCell>
                            <Chip 
                              label="Approved" 
                              color="success" 
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Department Summary */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Department Summary
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Department</TableCell>
                        <TableCell align="right">Requests</TableCell>
                        <TableCell align="right">Days</TableCell>
                        <TableCell align="right">Approval Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.isArray(departmentStats) && departmentStats.map((dept) => (
                        <TableRow key={dept._id}>
                          <TableCell>{dept.name}</TableCell>
                          <TableCell align="right">{dept.totalRequests}</TableCell>
                          <TableCell align="right">{dept.totalDays}</TableCell>
                          <TableCell align="right">
                            {dept.totalRequests > 0 ? 
                              Math.round((dept.approvedRequests / dept.totalRequests) * 100) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        </>
      )}

      {/* Department Analysis Tab */}
      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Department Analysis
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Department</TableCell>
                    <TableCell align="right">Total Requests</TableCell>
                    <TableCell align="right">Approved</TableCell>
                    <TableCell align="right">Pending</TableCell>
                    <TableCell align="right">Total Days</TableCell>
                    <TableCell align="right">Avg Days/Request</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.isArray(departmentStats) && departmentStats.map((dept) => (
                    <TableRow key={dept._id}>
                      <TableCell>{dept.name}</TableCell>
                      <TableCell align="right">{dept.totalRequests}</TableCell>
                      <TableCell align="right">{dept.approvedRequests}</TableCell>
                      <TableCell align="right">{dept.pendingRequests}</TableCell>
                      <TableCell align="right">{dept.totalDays}</TableCell>
                      <TableCell align="right">
                        {dept.totalRequests > 0 ? 
                          (dept.totalDays / dept.totalRequests).toFixed(1) : 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Employee Analysis Tab */}
      {tabValue === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Employee Analysis
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell align="right">Total Requests</TableCell>
                    <TableCell align="right">Total Days</TableCell>
                    <TableCell align="right">Annual Used</TableCell>
                    <TableCell align="right">Casual Used</TableCell>
                    <TableCell align="right">Medical Used</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.isArray(employeeStats) && employeeStats.map((emp) => (
                    <TableRow key={emp._id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {getEmployeeInitials(emp)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {emp.firstName} {emp.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {emp.employeeId}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="right">{emp.totalRequests}</TableCell>
                      <TableCell align="right">{emp.totalDays}</TableCell>
                      <TableCell align="right">{emp.annualUsed}</TableCell>
                      <TableCell align="right">{emp.casualUsed}</TableCell>
                      <TableCell align="right">{emp.medicalUsed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly Trends Tab */}
      {tabValue === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Monthly Trends
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Requests</TableCell>
                    <TableCell align="right">Days</TableCell>
                    <TableCell align="right">Trend</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.isArray(monthlyTrends) && monthlyTrends.map((month, index) => (
                    <TableRow key={month.month}>
                      <TableCell>{month.monthName || format(new Date(2024, month.month - 1), 'MMMM')}</TableCell>
                      <TableCell align="right">{month.requests || 0}</TableCell>
                      <TableCell align="right">{month.days || 0}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          {getTrendIcon(month.trend)}
                          <Typography 
                            variant="body2" 
                            color={getTrendColor(month.trend)}
                          >
                            {month.trend && month.trend > 0 ? '+' : ''}{month.trend ? month.trend.toFixed(1) : '0.0'}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default LeaveReports;
