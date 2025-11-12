import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Assessment as ReportIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { format, eachDayOfInterval } from 'date-fns';

import api from '../../../services/api';

const currentYear = new Date().getFullYear();
const monthOptions = [
  { value: 'all', label: 'Full Year' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const years = Array.from({ length: 6 }, (_, index) => currentYear - index);

const calculateTrend = (current, previous) => {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
};

const getTrendIcon = (trend) => {
  if (trend > 0) return <TrendingUpIcon color="success" fontSize="small" />;
  if (trend < 0) return <TrendingDownIcon color="error" fontSize="small" />;
  return null;
};

const getTrendColor = (trend) => {
  if (trend > 0) return 'success.main';
  if (trend < 0) return 'error.main';
  return 'text.secondary';
};

const getEmployeeInitials = (name = '') => {
  if (!name) return 'NA';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const LeaveReports = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    year: currentYear,
    month: new Date().getMonth() + 1,
    department: 'all'
  });

  const [departments, setDepartments] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [employeeStats, setEmployeeStats] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const departmentNameById = useMemo(() => {
    const map = new Map();
    (departments || []).forEach((dept) => {
      if (!dept) return;
      const id = dept._id ? String(dept._id) : null;
      if (id) {
        const label = dept.name || dept.title || dept.code || dept.label || '';
        if (label) {
          map.set(id, label);
        }
      }
    });
    return map;
  }, [departments]);

  const resolveDepartmentName = useCallback(
    (...candidates) => {
      const normalize = (candidate) => {
        if (!candidate) return '';
        if (typeof candidate === 'string') {
          return candidate.trim();
        }
        if (candidate.name) {
          return String(candidate.name).trim();
        }
        if (candidate.department) {
          return normalize(candidate.department);
        }
        if (candidate._id) {
          const fromMap = departmentNameById.get(String(candidate._id));
          return fromMap ? fromMap.trim() : '';
        }
        return '';
      };

      for (const candidate of candidates) {
        const resolved = normalize(candidate);
        if (resolved) return resolved;
      }
      return '';
    },
    [departmentNameById]
  );

  const departmentLookup = useMemo(() => {
    const map = new Map();
    (employeeStats || []).forEach((emp) => {
      const employeeId = emp?.employeeId ? String(emp.employeeId).trim() : null;
      if (!employeeId) return;

      const deptName =
        resolveDepartmentName(
          emp.department,
          emp.departmentName,
          emp.employee?.department
        ) || 'N/A';

      map.set(employeeId, deptName);
    });
    return map;
  }, [employeeStats, resolveDepartmentName]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await api.get('/hr/departments');
        if (response.data?.success) {
          setDepartments(response.data.data || []);
        } else {
          setDepartments([]);
        }
      } catch (err) {
        console.error('Error loading departments:', err);
        setDepartments([]);
      }
    };

    loadDepartments();
  }, []);

  const loadReportData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.append('year', filters.year);
      if (filters.month !== 'all') {
        params.append('month', filters.month);
      }
      if (filters.department !== 'all') {
        params.append('department', filters.department);
      }

      const [statsRes, deptRes, empRes, trendsRes] = await Promise.all([
        api.get(`/leaves/statistics?${params.toString()}`),
        api.get(`/leaves/reports/department-stats?${params.toString()}`),
        api.get(`/leaves/reports/employee-stats?${params.toString()}&limit=200`),
        api.get(`/leaves/reports/monthly-trends?${params.toString()}`)
      ]);

      const statsArray = Array.isArray(statsRes.data.data) ? statsRes.data.data : [];
      const aggregatedStats = statsArray.reduce(
        (acc, item) => {
          const totalRequests = item.totalRequests || 0;
          const totalDays = item.totalDays || 0;

          acc.totalRequests += totalRequests;
          acc.totalDays += totalDays;

          switch (item._id) {
            case 'approved':
              acc.approvedRequests = totalRequests;
              acc.approvedDays = totalDays;
              break;
            case 'pending':
              acc.pendingRequests = totalRequests;
              acc.pendingDays = totalDays;
              break;
            case 'rejected':
              acc.rejectedRequests = totalRequests;
              acc.rejectedDays = totalDays;
              break;
            default:
              break;
          }

          return acc;
        },
        {
          totalRequests: 0,
          approvedRequests: 0,
          pendingRequests: 0,
          rejectedRequests: 0,
          totalDays: 0,
          approvedDays: 0,
          pendingDays: 0,
          rejectedDays: 0
        }
      );

      setStatistics(aggregatedStats);
      const deptDataRaw = Array.isArray(deptRes.data.data) ? deptRes.data.data : [];
      const deptData = deptDataRaw.map((dept) => {
        const name =
          resolveDepartmentName(
            dept.name,
            dept.departmentName,
            dept.department,
            typeof dept._id === 'string' ? dept._id : null,
            dept._id
          ) || 'N/A';

        return { ...dept, name };
      });
      setDepartmentStats(deptData);
      const employeeDataRaw = Array.isArray(empRes.data.data) ? empRes.data.data : [];
      const employeeData = employeeDataRaw.map((emp) => {
        const employeeId = emp.employeeId || emp.employee?.employeeId || '';
        const departmentName =
          resolveDepartmentName(
            emp.department,
            emp.departmentName,
            emp.employee?.department
          ) || 'N/A';

        return {
          ...emp,
          employeeId,
          department: departmentName
        };
      });
      setEmployeeStats(employeeData);

      const mappedTrends = Array.isArray(trendsRes.data.data)
        ? trendsRes.data.data
            .reduce((acc, item) => {
              const monthIndex = item._id?.month;
              if (!monthIndex) return acc;
              const existing = acc.get(monthIndex) || { month: monthIndex, totalRequests: 0, totalDays: 0 };
              existing.totalRequests += item.count || 0;
              existing.totalDays += item.totalDays || 0;
              acc.set(monthIndex, existing);
              return acc;
            }, new Map())
        : new Map();

      const trendArray = Array.from(mappedTrends.values()).sort((a, b) => a.month - b.month);
      setMonthlyTrends(trendArray);
    } catch (err) {
      console.error('Error loading leave report data:', err);
      setError(err?.response?.data?.message || 'Failed to load leave report data.');
      setStatistics(null);
      setDepartmentStats([]);
      setEmployeeStats([]);
      setMonthlyTrends([]);
    } finally {
      setLoading(false);
    }
  }, [filters.department, filters.month, filters.year, departmentNameById]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, filters.department, filters.month, filters.year, employeeStats]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      year: currentYear,
      month: new Date().getMonth() + 1,
      department: 'all'
    });
  };

  const filteredEmployees = useMemo(() => {
    const list = Array.isArray(employeeStats) ? employeeStats : [];
    if (!searchTerm.trim()) return list;

    const term = searchTerm.trim().toLowerCase();
    return list.filter((emp) => {
      const name = emp.employeeName || '';
      const id = emp.employeeId || '';
      const dept = emp.department || '';
      return (
        name.toLowerCase().includes(term) ||
        String(id).toLowerCase().includes(term) ||
        dept.toLowerCase().includes(term)
      );
    });
  }, [employeeStats, searchTerm]);

  const paginatedEmployees = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredEmployees.slice(start, start + rowsPerPage);
  }, [filteredEmployees, page, rowsPerPage]);

  const buildLeaveDetailRows = useCallback(async () => {
    try {
      const rows = [];
      const limit = 200;
      let page = 1;
      let totalPages = 1;

      const rangeStart =
        filters.month === 'all'
          ? new Date(filters.year, 0, 1)
          : new Date(filters.year, filters.month - 1, 1);
      const rangeEnd =
        filters.month === 'all'
          ? new Date(filters.year, 11, 31, 23, 59, 59, 999)
          : new Date(filters.year, filters.month, 0, 23, 59, 59, 999);

      const paramsBase = {
        limit,
        sortBy: 'startDate',
        sortOrder: 'asc',
        year: filters.year,
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString()
      };

      const selectedDepartmentName =
        filters.department !== 'all'
          ? departmentNameById.get(filters.department) || null
          : null;

      while (page <= totalPages) {
        const response = await api.get('/leaves/requests', {
          params: { ...paramsBase, page }
        });

        if (!response.data?.success) {
          break;
        }

        const data = Array.isArray(response.data.data) ? response.data.data : [];
        const pagination = response.data.pagination || {};
        totalPages = pagination.pages || page;

        data.forEach((leave) => {
          const employee = leave.employee || {};
          const employeeId = String(employee.employeeId || '').trim();

          const departmentName =
            departmentLookup.get(employeeId) ||
            selectedDepartmentName ||
            resolveDepartmentName(
              employee.department,
              employee.departmentName
            ) ||
            'N/A';

          if (selectedDepartmentName && departmentName !== selectedDepartmentName) {
            return;
          }

          const leaveTypeName = leave.leaveType?.name || leave.leaveType?.code || 'Leave';
          const status =
            leave.status && typeof leave.status === 'string'
              ? leave.status.charAt(0).toUpperCase() + leave.status.slice(1)
              : 'Pending';

          const leaveStart = new Date(leave.startDate);
          const leaveEnd = new Date(leave.endDate);
          const clampStart = new Date(
            Math.max(leaveStart.getTime(), rangeStart.getTime())
          );
          const clampEnd = new Date(
            Math.min(leaveEnd.getTime(), rangeEnd.getTime())
          );

          if (clampStart > clampEnd) {
            return;
          }

          const days = eachDayOfInterval({ start: clampStart, end: clampEnd });
          days.forEach((day) => {
            const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
            rows.push([
              employeeId,
              employeeName || 'N/A',
              departmentName,
              leaveTypeName,
              status,
              format(day, 'dd-MM-yyyy'),
              format(day, 'EEEE'),
              leave.totalDays || days.length,
              leave.appliedDate ? format(new Date(leave.appliedDate), 'dd-MM-yyyy') : ''
            ]);
          });
        });

        if (!pagination.pages || page >= pagination.pages) {
          break;
        }
        page += 1;
      }

      return rows;
    } catch (err) {
      console.error('Error building leave detail rows:', err);
      return [];
    }
  }, [
    filters.year,
    filters.month,
    filters.department,
    departmentLookup,
    departmentNameById,
    resolveDepartmentName
  ]);

  const trendRows = useMemo(() => {
    return monthlyTrends.map((monthData, index) => {
      const previous = index > 0 ? monthlyTrends[index - 1] : null;
      const trend = previous ? calculateTrend(monthData.totalDays, previous.totalDays) : 0;
      return {
        ...monthData,
        trend
      };
    });
  }, [monthlyTrends]);

  const summaryCards = useMemo(() => {
    if (!statistics) return [];
    const approvalRate = statistics.totalRequests
      ? Math.round((statistics.approvedRequests / statistics.totalRequests) * 100)
      : 0;

    return [
      {
        title: 'Total Leave Requests',
        value: statistics.totalRequests || 0,
        caption: 'Submitted within selected period',
        color: '#1976d2'
      },
      {
        title: 'Approved Requests',
        value: statistics.approvedRequests || 0,
        caption: `Approval Rate ${approvalRate}%`,
        color: '#2e7d32'
      },
      {
        title: 'Pending Requests',
        value: statistics.pendingRequests || 0,
        caption: 'Awaiting action',
        color: '#ed6c02'
      },
      {
        title: 'Total Leave Days',
        value: statistics.totalDays || 0,
        caption: 'Days consumed by employees',
        color: '#d32f2f'
      }
    ];
  }, [statistics]);

  const handleChangePage = (_event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const exportToExcel = useCallback(async () => {
    if (!statistics) {
      setError('No leave data available to export.');
      return;
    }

    try {
      const xlsx = await import('xlsx');
      const workbook = xlsx.utils.book_new();
      const detailHeaders = [
        'Employee ID',
        'Employee Name',
        'Department',
        'Leave Type',
        'Status',
        'Date',
        'Weekday',
        'Total Days',
        'Applied On'
      ];
      const leaveDetailRows = await buildLeaveDetailRows();
      const detailSheetData = [
        detailHeaders,
        ...(leaveDetailRows.length ? leaveDetailRows : [])
      ];
      const detailSheet = xlsx.utils.aoa_to_sheet(detailSheetData);
      xlsx.utils.book_append_sheet(workbook, detailSheet, 'Leave Details');

      const overviewData = [
        ['Leave Report Summary', ''],
        ['Generated Date', new Date().toLocaleDateString()],
        ['Year', filters.year],
        [
          'Month',
          filters.month === 'all'
            ? 'Full Year'
            : format(new Date(filters.year, filters.month - 1, 1), 'MMMM')
        ],
        ['Department', filters.department === 'all' ? 'All Departments' : filters.department],
        ['', ''],
        ['Metric', 'Value'],
        ['Total Requests', statistics.totalRequests || 0],
        ['Approved Requests', statistics.approvedRequests || 0],
        ['Pending Requests', statistics.pendingRequests || 0],
        ['Rejected Requests', statistics.rejectedRequests || 0],
        ['Total Days', statistics.totalDays || 0],
        ['Approved Days', statistics.approvedDays || 0],
        ['Pending Days', statistics.pendingDays || 0],
        ['Rejected Days', statistics.rejectedDays || 0]
      ];
      const overviewSheet = xlsx.utils.aoa_to_sheet(overviewData);
      xlsx.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

      if (departmentStats.length) {
        const deptData = [
          ['Department', 'Total Requests', 'Approved', 'Pending', 'Rejected', 'Total Days', 'Approval Rate']
        ];

        departmentStats.forEach((dept) => {
          const approvalRate = dept.totalRequests
            ? `${Math.round((dept.approvedRequests / dept.totalRequests) * 100)}%`
            : '0%';
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

        const deptSheet = xlsx.utils.aoa_to_sheet(deptData);
        xlsx.utils.book_append_sheet(workbook, deptSheet, 'Department Analysis');
      }

      if (employeeStats.length) {
        const empData = [
          [
            'Employee Name',
            'Employee ID',
            'Department',
            'Total Requests',
            'Approved',
            'Pending',
            'Rejected',
            'Total Days',
            'Approved Days'
          ]
        ];

        employeeStats.forEach((emp) => {
          empData.push([
            emp.employeeName || 'N/A',
            emp.employeeId || 'N/A',
            emp.department || 'N/A',
            emp.totalRequests || 0,
            emp.approvedRequests || 0,
            emp.pendingRequests || 0,
            emp.rejectedRequests || 0,
            emp.totalDays || 0,
            emp.approvedDays || 0
          ]);
        });

        const empSheet = xlsx.utils.aoa_to_sheet(empData);
        xlsx.utils.book_append_sheet(workbook, empSheet, 'Employee Analysis');
      }

      if (monthlyTrends.length) {
        const trendsData = [['Month', 'Total Requests', 'Total Days']];
        monthlyTrends.forEach((month) => {
          trendsData.push([
            format(new Date(filters.year, month.month - 1, 1), 'MMMM'),
            month.totalRequests || 0,
            month.totalDays || 0
          ]);
        });
        const trendsSheet = xlsx.utils.aoa_to_sheet(trendsData);
        xlsx.utils.book_append_sheet(workbook, trendsSheet, 'Monthly Trends');
      }

      const fileSuffix =
        filters.month === 'all'
          ? `${filters.year}-all`
          : `${filters.year}-${String(filters.month).padStart(2, '0')}`;
      const filename = `leave-report-${fileSuffix}.xlsx`;

      xlsx.writeFile(workbook, filename, { cellStyles: true });
    } catch (err) {
      console.error('Error exporting leave excel:', err);
      setError('Failed to export leave data. Please try again.');
    }
  }, [
    statistics,
    departmentStats,
    employeeStats,
    monthlyTrends,
    filters.year,
    filters.month,
    filters.department,
    buildLeaveDetailRows
  ]);

  return (
    <Box sx={{ p: 3 }}>
      <Card
        sx={{
          mb: 3,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha('#1976d2', 0.12)} 0%, ${alpha('#1976d2', 0.04)} 100%)`,
          border: `1px solid ${alpha('#1976d2', 0.16)}`
        }}
      >
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 72,
                height: 72,
                borderRadius: '16px',
                backgroundColor: alpha('#1976d2', 0.15),
                color: '#1976d2'
              }}
            >
              <ReportIcon fontSize="large" />
            </Box>
            <Box flex={1}>
              <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                Monthly Leave Report
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Monitor leave utilization patterns by department and employee using a dashboard aligned with the
                Monthly Attendance experience.
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth>
                <InputLabel>Year</InputLabel>
                <Select
                  value={filters.year}
                  label="Year"
                  onChange={(event) => handleFilterChange('year', event.target.value)}
                >
                  {years.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={filters.month}
                  label="Month"
                  onChange={(event) => handleFilterChange('month', event.target.value)}
                >
                  {monthOptions.map((month) => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={filters.department}
                  label="Department"
                  onChange={(event) => handleFilterChange('department', event.target.value)}
                >
                  <MenuItem value="all">All Departments</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Stack
                direction="row"
                spacing={1.5}
                justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon fontSize="small" />}
                  onClick={loadReportData}
                >
                  Refresh
                </Button>
                <Button
                  variant="text"
                  color="secondary"
                  size="small"
                  onClick={clearFilters}
                >
                  Reset
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {summaryCards.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {summaryCards.map((card) => (
            <Grid item xs={12} sm={6} md={3} key={card.title}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  border: `1px solid ${alpha(card.color, 0.2)}`,
                  background: `linear-gradient(135deg, ${alpha(card.color, 0.12)} 0%, ${alpha(
                    card.color,
                    0.04
                  )} 100%)`
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {card.title}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: card.color, mb: 1 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.caption}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
            sx={{ mb: 2 }}
          >
            <TextField
              fullWidth
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search employees by name, ID or department"
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon fontSize="small" />}
                onClick={exportToExcel}
                sx={{ px: 1.5, py: 0.4, minWidth: 0, fontWeight: 500 }}
              >
                Export Excel
              </Button>
            </Stack>
          </Stack>

          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Employee Leave Utilization
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Summary of approved, pending and rejected leave requests for each employee.
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell align="right">Requests</TableCell>
                  <TableCell align="right">Approved</TableCell>
                  <TableCell align="right">Pending</TableCell>
                  <TableCell align="right">Rejected</TableCell>
                  <TableCell align="right">Total Days</TableCell>
                  <TableCell align="right">Approved Days</TableCell>
                  <TableCell align="right">Approval %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {loading ? 'Loading leave data...' : 'No leave data available for the selected filters.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {paginatedEmployees.map((emp) => {
                  const approvalRate = emp.totalRequests
                    ? Math.round((emp.approvedRequests / emp.totalRequests) * 100)
                    : 0;
                  const name = emp.employeeName || 'N/A';

                  return (
                    <TableRow key={emp._id}>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {getEmployeeInitials(name)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {emp.employeeId || '—'}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>{emp.department || '—'}</TableCell>
                      <TableCell align="right">{emp.totalRequests || 0}</TableCell>
                      <TableCell align="right">{emp.approvedRequests || 0}</TableCell>
                      <TableCell align="right">{emp.pendingRequests || 0}</TableCell>
                      <TableCell align="right">{emp.rejectedRequests || 0}</TableCell>
                      <TableCell align="right">{emp.totalDays || 0}</TableCell>
                      <TableCell align="right">{emp.approvedDays || 0}</TableCell>
                      <TableCell align="right">{approvalRate}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            rowsPerPageOptions={[5, 10, 25, 50]}
            count={filteredEmployees.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Department Overview
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Compare leave utilisation across departments to identify hotspots and coverage risks.
              </Typography>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Department</TableCell>
                      <TableCell align="right">Requests</TableCell>
                      <TableCell align="right">Approved</TableCell>
                      <TableCell align="right">Pending</TableCell>
                      <TableCell align="right">Days</TableCell>
                      <TableCell align="right">Approval %</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {departmentStats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="text.secondary">
                            {loading ? 'Loading department data...' : 'No department statistics available.'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {departmentStats.map((dept) => {
                      const approvalRate = dept.totalRequests
                        ? Math.round((dept.approvedRequests / dept.totalRequests) * 100)
                        : 0;
                      return (
                        <TableRow key={dept._id}>
                          <TableCell>{dept.name || '—'}</TableCell>
                          <TableCell align="right">{dept.totalRequests || 0}</TableCell>
                          <TableCell align="right">{dept.approvedRequests || 0}</TableCell>
                          <TableCell align="right">{dept.pendingRequests || 0}</TableCell>
                          <TableCell align="right">{dept.totalDays || 0}</TableCell>
                          <TableCell align="right">{approvalRate}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                Monthly Leave Trend
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Track month-on-month leave volume and detect spikes that may impact operations.
              </Typography>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Requests</TableCell>
                    <TableCell align="right">Days</TableCell>
                    <TableCell align="right">Trend</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trendRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          {loading ? 'Calculating trends...' : 'Trend data will appear once leave records are available.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {trendRows.map((month) => (
                    <TableRow key={month.month}>
                      <TableCell>{format(new Date(filters.year, month.month - 1, 1), 'MMMM')}</TableCell>
                      <TableCell align="right">{month.totalRequests || 0}</TableCell>
                      <TableCell align="right">{month.totalDays || 0}</TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          justifyContent="flex-end"
                        >
                          {getTrendIcon(month.trend)}
                          <Typography variant="body2" color={getTrendColor(month.trend)}>
                            {month.trend > 0 ? '+' : ''}
                            {month.trend.toFixed(1)}%
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LeaveReports;

