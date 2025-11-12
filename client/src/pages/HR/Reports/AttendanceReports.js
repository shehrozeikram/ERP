import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  alpha,
  Fade,
  Divider,
  TablePagination,
  Menu,
  Skeleton
} from '@mui/material';
import {
  AccessTime,
  Download,
  ArrowBack,
  TrendingUp,
  TrendingDown,
  People,
  AccountBalance,
  Receipt,
  GetApp,
  Search,
  CheckCircle,
  Cancel,
  Schedule,
  Event,
  ViewModule,
  ViewList
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { formatPKR } from '../../../utils/currency';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { getUserAllowedSubmodules } from '../../../utils/permissions';

const normalizeEmpCode = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';
  const withoutLeadingZeros = str.replace(/^0+/, '');
  return withoutLeadingZeros || '0';
};

const formatLeaveDays = (value) => {
  const num = Number(value);
  if (Number.isNaN(num) || num === 0) return '0d';
  return Number.isInteger(num) ? `${num}d` : `${num.toFixed(1)}d`;
};

const formatLeaveSummaryText = (summary) => {
  if (!summary) return '';
  const parts = [];

  if (summary.approvedDays) {
    parts.push(`Approved ${formatLeaveDays(summary.approvedDays)}`);
  }

  if (summary.pendingDays) {
    parts.push(`Pending ${formatLeaveDays(summary.pendingDays)}`);
  } else if (summary.pendingRequests) {
    parts.push(`Pending ${summary.pendingRequests} request${summary.pendingRequests > 1 ? 's' : ''}`);
  }

  if (summary.rejectedDays) {
    parts.push(`Rejected ${formatLeaveDays(summary.rejectedDays)}`);
  } else if (summary.rejectedRequests) {
    parts.push(`Rejected ${summary.rejectedRequests} request${summary.rejectedRequests > 1 ? 's' : ''}`);
  }

  if (summary.types && typeof summary.types === 'object') {
    const typeEntries = Object.entries(summary.types).filter(([, days]) => days);
    if (typeEntries.length) {
      const typeParts = typeEntries
        .sort((a, b) => b[1] - a[1])
        .map(([type, days]) => `${type} ${formatLeaveDays(days)}`);
      parts.push(typeParts.join(', '));
    }
  }

  if (summary.totalDays) {
    parts.push(`Total ${formatLeaveDays(summary.totalDays)}`);
  }

  if (summary.totalRequests) {
    parts.push(`${summary.totalRequests} request${summary.totalRequests > 1 ? 's' : ''}`);
  }

  if (!parts.length) return 'No leaves';
  return parts.join(' · ');
};

const AttendanceReports = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { reportType } = useParams();
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [reportData, setReportData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [areas, setAreas] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [filterType, setFilterType] = useState('department'); // 'department', 'area', or 'group'
  const [page, setPage] = useState(0); // zero-based for MUI
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list' - default to list
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [leaveSummaryByEmployee, setLeaveSummaryByEmployee] = useState({});
  const [leaveSummaryError, setLeaveSummaryError] = useState(false);
  const [permissionSnackbarShown, setPermissionSnackbarShown] = useState(false);
  const [hrSubmodules, setHrSubmodules] = useState([]);
  const [hrPermissionsLoading, setHrPermissionsLoading] = useState(true);
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1, // Current month
    year: new Date().getFullYear(), // Current year
    department: '', // legacy single for non-monthly
    departmentId: '', // ZKBio dept id for monthly (single-select)
    areaId: '', // ZKBio area id for monthly (single-select)
    groupId: '', // ZKBio group id for monthly (single-select)
    format: 'json'
  });
  const activeRequestIdRef = useRef(0);

  const privilegedHrRoles = useMemo(() => ['super_admin', 'admin', 'hr_manager'], []);

  useEffect(() => {
    let mounted = true;

    const loadHrPermissions = async () => {
      if (!user) {
        if (mounted) {
          setHrSubmodules([]);
          setHrPermissionsLoading(false);
        }
        return;
      }

      if (privilegedHrRoles.includes(user.role)) {
        if (mounted) {
          setHrSubmodules(['*']);
          setHrPermissionsLoading(false);
        }
        return;
      }

      setHrPermissionsLoading(true);
      try {
        const allowedSubmodules = await getUserAllowedSubmodules('hr');
        if (mounted) {
          setHrSubmodules(Array.isArray(allowedSubmodules) ? allowedSubmodules : []);
        }
      } catch (error) {
        if (mounted) {
          setHrSubmodules([]);
        }
      } finally {
        if (mounted) {
          setHrPermissionsLoading(false);
        }
      }
    };

    loadHrPermissions();

    return () => {
      mounted = false;
    };
  }, [user, privilegedHrRoles]);

  const canAccessHrMonthly = useMemo(() => {
    if (!user) return false;
    if (privilegedHrRoles.includes(user.role)) return true;
    const requiredSubmodules = ['attendance_management', 'leave_management', 'reports', 'attendance_reports', 'hr_reports'];
    return hrSubmodules.some(sub => requiredSubmodules.includes(sub));
  }, [user, hrSubmodules, privilegedHrRoles]);

  useEffect(() => {
    if (canAccessHrMonthly) {
      setPermissionSnackbarShown(false);
    }
  }, [canAccessHrMonthly]);

  // Months array
  const months = [
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

  // Years array (last 5 years)
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Report configurations
  const reportConfigs = {
    monthly: {
      title: 'Monthly Attendance Report',
      description: 'Complete daily attendance records for all employees',
      icon: <AccessTime />,
      color: '#4caf50'
    },
    monthly_absent: {
      title: 'Monthly Absent Report',
      description: 'Monthly absence summary with present and absent percentages',
      icon: <AccessTime />,
      color: '#f44336'
    },
    department: {
      title: 'Department-wise Attendance',
      description: 'Attendance analysis grouped by department',
      icon: <People />,
      color: '#2196f3'
    },
    summary: {
      title: 'Attendance Summary',
      description: 'Employee attendance summary and statistics',
      icon: <TrendingUp />,
      color: '#ff9800'
    }
  };

  const currentConfig = reportConfigs[reportType] || reportConfigs.monthly;

  // Load departments
  const loadDepartments = useCallback(async () => {
    const requiresHrMonthly = reportType === 'monthly' || reportType === 'monthly_absent';

    if (requiresHrMonthly) {
      if (hrPermissionsLoading) {
        setLoadingDepartments(true);
        return;
      }
      if (!canAccessHrMonthly) {
        setDepartments(prev => (prev && prev.length ? prev : [{ id: '-1', name: 'All Departments' }]));
        setLoadingDepartments(false);
        return;
      }
    }

    setLoadingDepartments(true);
    try {
      if (reportType === 'monthly' || reportType === 'monthly_absent') {
        // Load departments from ZKBio for monthly report (IDs must match ZKBio)
        const resp = await api.get('/zkbio/zkbio/departments');
        if (resp.data?.success) {
          // Normalize to { id, name }
          const list = (resp.data.data || []).map(d => ({
            id: String(d.id || d.dept_id || d.code || d.dept_code),
            name: d.dept_name || d.name || d.title || `Dept ${d.id}`
          })).filter(d => d.id);
          setDepartments(list);
        } else {
          setDepartments([{ id: '-1', name: 'All Departments' }]);
        }
      } else {
        const response = await api.get('/hr/departments');
        if (response.data.success) {
          setDepartments(response.data.data || []);
        }
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      if (reportType === 'monthly' || reportType === 'monthly_absent') {
        if (error?.response?.status === 401) {
          console.warn('Falling back to minimal department list due to unauthorized access.');
          setDepartments(prev => (prev && prev.length ? prev : [{ id: '-1', name: 'All Departments' }]));
        } else {
          setDepartments([]);
        }
      }
    } finally {
      setLoadingDepartments(false);
    }
  }, [reportType, hrPermissionsLoading, canAccessHrMonthly]);

  // Load areas
  const loadAreas = useCallback(async () => {
    if (reportType !== 'monthly' && reportType !== 'monthly_absent') return;

    if (hrPermissionsLoading) {
      setLoadingAreas(true);
      return;
    }
    if (!canAccessHrMonthly) {
      setAreas(prev => (prev && prev.length ? prev : [{ id: '-1', name: 'All Areas' }]));
      setLoadingAreas(false);
      return;
    }

    setLoadingAreas(true);
    try {
      const resp = await api.get('/zkbio/zkbio/areas');
      if (resp.data?.success) {
        // Normalize to { id, name }
        const list = (resp.data.data || []).map(a => ({
          id: String(a.id || a.area_id || a.code || a.area_code),
          name: a.area_name || a.name || a.title || `Area ${a.id}`
        })).filter(a => a.id);
        setAreas(list);
      } else {
        setAreas([]);
      }
    } catch (error) {
      console.error('Error loading areas:', error);
      setAreas([]);
    } finally {
      setLoadingAreas(false);
    }
  }, [reportType, hrPermissionsLoading, canAccessHrMonthly]);

  const buildLeaveSummary = useCallback((leavesData, statsData, start_date, end_date) => {
    const summaryMap = {};

            if (Array.isArray(statsData)) {
              statsData.forEach(item => {
                const rawCode = item.employeeId || item.empCode || item._id || '';
                const trimmedCode = String(rawCode).trim();
                const normalizedCode = normalizeEmpCode(trimmedCode);
                if (!trimmedCode && !normalizedCode) return;
                const entry = {
                  totalDays: item.totalDays || 0,
                  approvedDays: item.approvedDays || 0,
                  pendingDays: 0,
                  rejectedDays: 0,
                  totalRequests: item.totalRequests || 0,
                  approvedRequests: item.approvedRequests || 0,
                  pendingRequests: item.pendingRequests || 0,
                  rejectedRequests: item.rejectedRequests || 0,
                  types: {},
                  _aggregated: true
                };
                if (trimmedCode) {
                  summaryMap[trimmedCode] = entry;
                }
                if (normalizedCode && normalizedCode !== trimmedCode) {
                  summaryMap[normalizedCode] = entry;
                }
              });
            }

          const monthStartDate = start_date ? new Date(`${start_date}T00:00:00`) : null;
          const monthEndDate = end_date ? new Date(`${end_date}T23:59:59`) : null;

    if (Array.isArray(leavesData)) {
          leavesData.forEach(leave => {
            const employee = leave.employee || {};
            const rawCode = employee.employeeId || employee.empCode || employee.code || employee.id || '';
            const trimmedCode = String(rawCode).trim();
            const normalizedCode = normalizeEmpCode(trimmedCode);
            const targetKey = trimmedCode || normalizedCode;
            if (!targetKey) return;

            const leaveTypeInfo = leave.leaveType || {};
            const leaveTypeName = leaveTypeInfo.name || leaveTypeInfo.code || 'Leave';
            const start = leave.startDate ? new Date(leave.startDate) : null;
            const end = leave.endDate ? new Date(leave.endDate) : null;
            if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

            let effectiveStart = start;
            let effectiveEnd = end;
            if (monthStartDate && effectiveStart < monthStartDate) {
              effectiveStart = monthStartDate;
            }
            if (monthEndDate && effectiveEnd > monthEndDate) {
              effectiveEnd = monthEndDate;
            }

            if (effectiveEnd < effectiveStart) return;

            let daysCount = (effectiveEnd - effectiveStart) / 86400000 + 1;
            if (leave.isHalfDay) {
              daysCount = 0.5;
            }
            if (daysCount <= 0) return;

            if (!summaryMap[targetKey]) {
              const entry = {
                totalDays: 0,
                approvedDays: 0,
                pendingDays: 0,
                rejectedDays: 0,
                totalRequests: 0,
                approvedRequests: 0,
                pendingRequests: 0,
                rejectedRequests: 0,
                types: {},
                _aggregated: false
              };
              summaryMap[targetKey] = entry;
              if (normalizedCode && normalizedCode !== targetKey) {
                summaryMap[normalizedCode] = entry;
              }
              if (trimmedCode && trimmedCode !== targetKey) {
                summaryMap[trimmedCode] = entry;
              }
            }

            const summaryEntry = summaryMap[targetKey];

            summaryEntry.types = summaryEntry.types || {};
            summaryEntry.types[leaveTypeName] = (summaryEntry.types[leaveTypeName] || 0) + daysCount;

            if (!summaryEntry._aggregated) {
              summaryEntry.totalDays = (summaryEntry.totalDays || 0) + daysCount;
              const status = (leave.status || '').toLowerCase();
              if (status === 'approved') {
                summaryEntry.approvedDays = (summaryEntry.approvedDays || 0) + daysCount;
                summaryEntry.approvedRequests = (summaryEntry.approvedRequests || 0) + 1;
              } else if (status === 'pending') {
                summaryEntry.pendingDays = (summaryEntry.pendingDays || 0) + daysCount;
                summaryEntry.pendingRequests = (summaryEntry.pendingRequests || 0) + 1;
              } else if (status === 'rejected') {
                summaryEntry.rejectedDays = (summaryEntry.rejectedDays || 0) + daysCount;
                summaryEntry.rejectedRequests = (summaryEntry.rejectedRequests || 0) + 1;
              }
              summaryEntry.totalRequests = (summaryEntry.totalRequests || 0) + 1;
            }
          });
    }

          const cleanedSummary = Object.entries(summaryMap).reduce((acc, [key, value]) => {
            const { _aggregated, ...rest } = value;
            acc[key] = rest;
            return acc;
          }, {});

    return cleanedSummary;
  }, []);

  const getWorkDayCellText = useCallback((row) => {
    if (row.isLeaveRecord) {
      return row.isHalfDayLeave ? 'Half-day Leave' : 'Leave';
    }
    if (row.workDay !== undefined && row.workDay !== null) {
      return row.workDay;
    }
    return '';
  }, []);

  const getLeaveCellText = useCallback((row) => {
    const rawCode = row.emp_code || row.emp_id || '';
    const normalizedCode = normalizeEmpCode(rawCode);
    const summary = normalizedCode
      ? leaveSummaryByEmployee[normalizedCode] || leaveSummaryByEmployee[String(rawCode).trim()]
      : undefined;
    const summaryText = summary ? formatLeaveSummaryText(summary) : '';
    const fallbackText = leaveSummaryError ? 'Leave data unavailable' : 'No leaves';

    if (row.isLeaveRecord) {
      const currentText = `${row.leaveType || 'Leave'}${row.leaveStatus ? ` (${String(row.leaveStatus).toUpperCase()})` : ''}${row.isHalfDayLeave ? ' - Half Day' : ''}`;
      if (summaryText) {
        return `${currentText} | Total: ${summaryText}`;
      }
      return leaveSummaryError ? `${currentText} | Summary unavailable` : currentText;
    }

    return fallbackText;
  }, [leaveSummaryByEmployee, leaveSummaryError]);

  const getCheckCellText = useCallback((value) => {
    if (value === null || value === undefined) return 'MISSING';
    const str = String(value).trim();
    return str !== '' ? str : 'MISSING';
  }, []);

  // Load report data
  const startEnd = useMemo(() => {
    const year = filters.year;
    const month = filters.month;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const start_date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const end_date = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    return { start_date, end_date };
  }, [filters.month, filters.year]);

  const loadReportData = useCallback(async () => {
    const requestId = Date.now();
    activeRequestIdRef.current = requestId;
    const requiresHrMonthly = reportType === 'monthly' || reportType === 'monthly_absent';

    if (requiresHrMonthly) {
      if (hrPermissionsLoading) {
        setLoading(true);
        return;
      }
      if (!canAccessHrMonthly) {
        if (!permissionSnackbarShown) {
          setSnackbar({
            open: true,
            message: 'You do not have permission to view Monthly Attendance reports. Please contact an administrator.',
            severity: 'warning'
          });
          setPermissionSnackbarShown(true);
        }
        setReportData(null);
        setLeaveRecords([]);
        setLeaveSummaryByEmployee({});
        setLeaveSummaryError(false);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      if (reportType === 'monthly' || reportType === 'monthly_absent') {
        const { start_date, end_date } = startEnd;

        let departmentsParam = '-1';
        let areasParam = '-1';

        if (filterType === 'department' && filters.departmentId) {
          departmentsParam = String(filters.departmentId);
        } else if (filterType === 'area' && filters.areaId) {
          areasParam = String(filters.areaId);
        }

        const exportEndpoint = reportType === 'monthly_absent'
          ? '/zkbio/zkbio/monthly-absent'
          : '/zkbio/zkbio/monthly-punch';

        const preferredPageSize = reportType === 'monthly'
          ? Math.max(rowsPerPage, 100)
          : rowsPerPage;

        const baseParams = {
          page: reportType === 'monthly' ? 1 : page + 1,
          page_size: preferredPageSize,
          start_date,
          end_date,
          departments: departmentsParam,
          areas: areasParam,
          groups: '-1',
          employees: '-1'
        };

        let leavesPromise = Promise.resolve([]);
        let statsPromise = Promise.resolve({ data: [], error: false });

        if (reportType === 'monthly') {
          setLeaveRecords([]);
          setLeaveSummaryByEmployee({});
          setLeaveSummaryError(false);

          leavesPromise = (async () => {
            try {
              const leaveResp = await api.get('/leaves/requests', {
                params: {
                  status: 'approved',
                  startDate: start_date,
                  endDate: end_date,
                  limit: 2000
                }
              });
              if (Array.isArray(leaveResp.data?.data)) {
                return leaveResp.data.data;
              }
              if (Array.isArray(leaveResp.data?.leaveRequests)) {
                return leaveResp.data.leaveRequests;
              }
              return [];
            } catch (leaveError) {
              console.warn('Warning: failed to load leave records for attendance report:', leaveError?.message || leaveError);
              return [];
            }
          })();

          statsPromise = (async () => {
            try {
              const statsResp = await api.get('/leaves/reports/employee-stats', {
                params: {
                  year: filters.year,
                  month: filters.month,
                  limit: 5000
                }
              });
              const statsData = Array.isArray(statsResp.data?.data) ? statsResp.data.data : [];
              return { data: statsData, error: false };
            } catch (statsError) {
              console.warn('Warning: failed to load leave summary stats for attendance report:', statsError?.message || statsError);
              return { data: [], error: true };
            }
          })();
        } else {
          setLeaveRecords([]);
          setLeaveSummaryByEmployee({});
          setLeaveSummaryError(false);
        }

        let effectivePageSize = preferredPageSize;
        let zkbioResp;
        try {
          zkbioResp = await api.get(exportEndpoint, { params: baseParams });
        } catch (primaryError) {
          const isMonthly = reportType === 'monthly';
          const shouldRetry =
            isMonthly &&
            preferredPageSize > rowsPerPage &&
            (primaryError?.message?.toLowerCase()?.includes('timeout') ||
              primaryError?.response?.status === 500);

          if (shouldRetry) {
            try {
              effectivePageSize = rowsPerPage;
              zkbioResp = await api.get(exportEndpoint, {
                params: { ...baseParams, page_size: rowsPerPage }
              });
            } catch (fallbackError) {
              throw fallbackError;
            }
          } else {
            throw primaryError;
          }
        }

        if (zkbioResp.data?.success) {
          if (reportType === 'monthly') {
            const totalCountFromApi = Number(zkbioResp.data.totalCount || 0);
            const initialMonthlyData = Array.isArray(zkbioResp.data.data) ? [...zkbioResp.data.data] : [];

            setReportData({ data: initialMonthlyData, count: totalCountFromApi, start_date, end_date });
            setTotalCount(totalCountFromApi || initialMonthlyData.length || 0);

            if (totalCountFromApi > initialMonthlyData.length && effectivePageSize > 0) {
              const totalPages = Math.ceil(totalCountFromApi / effectivePageSize);
              if (totalPages > 1) {
                (async () => {
                  try {
                    const mergedData = [...initialMonthlyData];
                    for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
                      if (activeRequestIdRef.current !== requestId) return;
                      try {
                        const resp = await api.get(exportEndpoint, {
                          params: { ...baseParams, page: nextPage, page_size: effectivePageSize }
                        });
                        if (Array.isArray(resp?.data?.data)) {
                          mergedData.push(...resp.data.data);
                        }
                      } catch (pageError) {
                        console.warn(
                          `Warning: failed to load monthly attendance page ${nextPage}:`,
                          pageError?.message || pageError
                        );
                        break;
                      }
                    }
                    if (activeRequestIdRef.current !== requestId) return;
                    setReportData({ data: mergedData, count: totalCountFromApi, start_date, end_date });
                  } catch (prefetchError) {
                    if (activeRequestIdRef.current !== requestId) return;
                    console.warn(
                      'Warning: failed to prefetch remaining monthly attendance pages:',
                      prefetchError?.message || prefetchError
                    );
                  }
                })();
              }
            }

            Promise.all([leavesPromise, statsPromise])
              .then(([leavesResult, statsResult]) => {
                if (activeRequestIdRef.current !== requestId) return;
                const statsData = statsResult?.data || [];
                const summary = buildLeaveSummary(leavesResult, statsData, start_date, end_date);
                setLeaveRecords(Array.isArray(leavesResult) ? leavesResult : []);
                setLeaveSummaryByEmployee(summary);
                setLeaveSummaryError(Boolean(statsResult?.error));
              })
              .catch(prefetchError => {
                if (activeRequestIdRef.current !== requestId) return;
                console.warn(
                  'Warning: failed to finalize leave data for attendance report:',
                  prefetchError?.message || prefetchError
                );
                setLeaveRecords([]);
                setLeaveSummaryByEmployee({});
                setLeaveSummaryError(true);
              });
          } else {
            setReportData({ data: zkbioResp.data.data, count: zkbioResp.data.totalCount, start_date, end_date });
            setTotalCount(Number(zkbioResp.data.totalCount || 0));
          }
        } else {
          setReportData(null);
          setSnackbar({ open: true, message: zkbioResp.data?.message || 'Failed to load monthly report', severity: 'error' });
        }
      } else {
        const response = await api.get(`/hr/reports/attendance/${reportType}`, {
          params: {
            month: filters.month,
            year: filters.year,
            department: filters.department,
            format: 'json'
          }
        });

        if (response.data.success) {
          setReportData(response.data.data);
        } else {
          setReportData(null);
          setSnackbar({ open: true, message: response.data.message || 'Failed to load report data', severity: 'error' });
        }

        setLeaveRecords([]);
        setLeaveSummaryByEmployee({});
      }
    } catch (error) {
      setReportData(null);
      setSnackbar({ open: true, message: error?.response?.data?.message || 'Error loading report data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [
    reportType,
    filters.month,
    filters.year,
    filters.department,
    filters.departmentId,
    filters.areaId,
    filterType,
    reportType === 'monthly' ? null : page,
    rowsPerPage,
    startEnd,
    buildLeaveSummary,
    canAccessHrMonthly,
    hrPermissionsLoading,
    permissionSnackbarShown
  ]);

  // Precompute dynamic day columns for monthly report
  const dayKeys = useMemo(() => {
    if (reportType !== 'monthly') return [];
    const s = reportData?.start_date || `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const start = new Date(s);
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const monthNum = filters.month;
    // Use MMDD format: month * 100 + day (e.g., November day 1 = 1101)
    return Array.from({ length: daysInMonth }, (_, i) => monthNum * 100 + (i + 1));
  }, [reportType, reportData?.start_date, filters.year, filters.month]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if ((reportType === 'monthly' || reportType === 'monthly_absent') && filterType === 'area') {
      loadAreas();
    }
  }, [loadAreas, reportType, filterType]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Reset filter values when filterType changes
  useEffect(() => {
    if (reportType === 'monthly' || reportType === 'monthly_absent') {
      setFilters(prev => ({
        ...prev,
        departmentId: filterType === 'department' ? prev.departmentId : '',
        areaId: filterType === 'area' ? prev.areaId : ''
      }));
    }
  }, [filterType, reportType]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Filtered data (supports Monthly and other report types)
  const filteredData = useMemo(() => {
    if (!reportData?.data || !Array.isArray(reportData.data)) return [];
    if (!searchTerm.trim()) return reportData.data;
    const term = searchTerm.toLowerCase();
    if (reportType === 'monthly') {
      return reportData.data.filter(row => {
        const nameMatch = `${row.first_name || ''} ${row.last_name || ''}`.toLowerCase().includes(term);
        const idMatch = String(row.emp_code || row.emp_id || '').toLowerCase().includes(term);
        const deptMatch = String(row.dept_name || '').toLowerCase().includes(term);
        // day fields 1001..1031
        let dayMatch = false;
        for (const key in row) {
          if (/^10\d{2}$/.test(key)) {
            const v = row[key];
            if (v && String(v).toLowerCase().includes(term)) { dayMatch = true; break; }
          }
        }
        return nameMatch || idMatch || deptMatch || dayMatch;
      });
    }
    if (reportType === 'monthly_absent') {
      return reportData.data.filter(row => {
        const nameMatch = String(row.first_name || '').toLowerCase().includes(term);
        const idMatch = String(row.emp_code || row.emp_id || '').toLowerCase().includes(term);
        const deptMatch = String(row.dept_name || '').toLowerCase().includes(term);
        return nameMatch || idMatch || deptMatch;
      });
    }
    // Default (non-monthly) fields
    return reportData.data.filter(row => (
      (row.employeeName && row.employeeName.toLowerCase().includes(term)) ||
      (row.employeeId && String(row.employeeId).toLowerCase().includes(term)) ||
      (row.department && row.department.toLowerCase().includes(term)) ||
      (row.status && row.status.toLowerCase().includes(term))
    ));
  }, [reportData, searchTerm, reportType]);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return '#4caf50';
      case 'Absent': return '#f44336';
      case 'Late': return '#ff9800';
      case 'Half Day': return '#9c27b0';
      case 'Leave': return '#2196f3';
      default: return '#757575';
    }
  };

  // Render summary cards
  const renderSummaryCards = () => {
    if (!reportData?.summary) return null;

    const summary = reportData.summary;
    const cards = [];

    if (reportType === 'monthly') {
      cards.push(
        {
          title: 'Total Records',
          value: summary.totalRecords || 0,
          icon: <Receipt />,
          color: '#2196f3'
        },
        {
          title: 'Total Work Hours',
          value: `${summary.totalWorkHours || 0}h`,
          icon: <AccessTime />,
          color: '#4caf50'
        },
        {
          title: 'Total Overtime',
          value: `${summary.totalOvertimeHours || 0}h`,
          icon: <Schedule />,
          color: '#ff9800'
        },
        {
          title: 'Present Days',
          value: summary.statusCounts?.Present || 0,
          icon: <CheckCircle />,
          color: '#4caf50'
        }
      );
    } else if (reportType === 'department') {
      cards.push(
        {
          title: 'Total Departments',
          value: summary.totalDepartments || 0,
          icon: <People />,
          color: '#2196f3'
        },
        {
          title: 'Total Records',
          value: summary.totalRecords || 0,
          icon: <Receipt />,
          color: '#4caf50'
        },
        {
          title: 'Total Work Hours',
          value: `${summary.totalWorkHours || 0}h`,
          icon: <AccessTime />,
          color: '#ff9800'
        },
        {
          title: 'Total Overtime',
          value: `${summary.totalOvertimeHours || 0}h`,
          icon: <Schedule />,
          color: '#9c27b0'
        }
      );
    } else if (reportType === 'summary') {
      cards.push(
        {
          title: 'Total Employees',
          value: summary.totalEmployees || 0,
          icon: <People />,
          color: '#2196f3'
        },
        {
          title: 'Present Days',
          value: summary.totalPresentDays || 0,
          icon: <CheckCircle />,
          color: '#4caf50'
        },
        {
          title: 'Absent Days',
          value: summary.totalAbsentDays || 0,
          icon: <Cancel />,
          color: '#f44336'
        },
        {
          title: 'Avg Attendance %',
          value: `${(summary.averageAttendancePercentage || 0).toFixed(1)}%`,
          icon: <TrendingUp />,
          color: '#ff9800'
        }
      );
    }

    return (
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {cards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Fade in timeout={300 + index * 100}>
              <Card
                sx={{
                  height: '100%',
                  background: `linear-gradient(135deg, ${alpha(card.color, 0.1)} 0%, ${alpha(card.color, 0.05)} 100%)`,
                  border: `2px solid ${alpha(card.color, 0.2)}`,
                  borderRadius: 3
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: '50%',
                      backgroundColor: alpha(card.color, 0.1),
                      color: card.color,
                      mb: 2
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    {card.title}
                  </Typography>
                </CardContent>
              </Card>
            </Fade>
          </Grid>
        ))}
      </Grid>
    );
  };

  // Transform data for list view (convert day columns to rows)
  const listViewData = useMemo(() => {
    if (reportType !== 'monthly' || viewMode !== 'list' || !reportData?.data || !Array.isArray(reportData.data)) return [];

    const monthStartStr = startEnd?.start_date || `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const defaultMonthEnd = new Date(filters.year, filters.month, 0);
    const monthEndStr = startEnd?.end_date || `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(defaultMonthEnd.getDate()).padStart(2, '0')}`;
    const monthStartDate = new Date(`${monthStartStr}T00:00:00`);
    const monthEndDate = new Date(`${monthEndStr}T23:59:59`);
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const deptLookup = new Map();
    reportData.data.forEach(row => {
      const code = String(row.emp_code || row.emp_id || '').trim();
      if (code && row.dept_name && !deptLookup.has(code)) {
        deptLookup.set(code, row.dept_name);
      }
    });

    // Check if data is already in list format (has date field)
    const firstRow = reportData.data[0];
    let attendanceRows = [];

    if (firstRow && (firstRow.date || firstRow.dateStr || firstRow.attendance_date)) {
      attendanceRows = reportData.data.map(row => ({
        emp_id: row.emp_id || row.emp_code || '',
        emp_code: row.emp_code || row.emp_id || '',
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        dept_name: row.dept_name || '',
        date: row.date || row.dateStr || row.attendance_date || '',
        dateObj: row.date ? new Date(row.date) : null,
        weekday: row.weekday || '',
        timetable: row.timetable || row.schedule || '',
        checkIn: row.check_in || row.checkIn || row.check_in_time || row.checkInTime || row.first_check_in || '',
        checkOut: row.check_out || row.checkOut || row.check_out_time || row.checkOutTime || row.last_check_out || '',
        clockIn: row.clock_in || row.clockIn || row.clock_in_time || row.clockInTime || row.check_in || row.checkIn || row.check_in_time || row.checkInTime || '',
        clockOut: row.clock_out || row.clockOut || row.clock_out_time || row.clockOutTime || row.check_out || row.checkOut || row.check_out_time || row.checkOutTime || '',
        dutyDuration: row.duty_duration || row.dutyDuration || row.duty_duration_time || row.dutyDurationTime || row.work_duration || row.workDuration || '',
        breakDuration: row.break_duration || row.breakDuration || '',
        workDay: row.work_day !== undefined ? row.work_day : (row.workDay !== undefined ? row.workDay : 1),
        workedHrs: row.worked_hrs || row.workedHrs || row.work_hours || row.workHours || '',
        totalHrs: row.total_hrs || row.totalHrs || row.total_hours || row.totalHours || '',
        breakOut: row.break_out || row.breakOut || '',
        breakIn: row.break_in || row.breakIn || '',
        breakHrs: row.break_hrs || row.breakHrs || '',
        totalBreakHrs: row.total_break_hrs || row.totalBreakHrs || '',
        totalOT: row.total_ot || row.totalOT || '',
        ruleTotalOT: row.rule_total_ot || row.ruleTotalOT || '',
        totalLeaves: row.total_leaves || row.totalLeaves || '',
        unscheduled: row.unscheduled || '',
        remaining: row.remaining || '',
        regularH: row.regular_h || row.regularH || '',
        lateInM: row.late_in_m || row.lateInM || '',
        earlyOutM: row.early_out_m || row.earlyOutM || '',
        absenceD: row.absence_d || row.absenceD || '',
        normalOTH: row.normal_ot_h || row.normalOTH || '',
        w: row.w || '',
        rawPunch: row.punch || row.rawPunch || '',
        isLeaveRecord: false
      }));
    } else {
      const startDate = new Date(monthStartDate);
      const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();

      // Calculate the last day to show based on today's date
      const today = new Date();
      const reportYear = filters.year;
      const reportMonth = filters.month;
      const isCurrentMonth = today.getFullYear() === reportYear && today.getMonth() + 1 === reportMonth;

      let lastDayToShow = daysInMonth; // Default to end of month

      if (isCurrentMonth) {
        const todayDay = today.getDate();
        const yesterdayDay = todayDay - 1;
        lastDayToShow = Math.max(1, yesterdayDay);
      }

      const transformed = [];

      reportData.data.forEach(empRow => {
        const monthNum = filters.month;

        for (let day = 1; day <= lastDayToShow; day++) {
          const dayKeyMMDD = String(monthNum * 100 + day);
          const dayKey1000 = String(1000 + day);
          const dayKey = dayKeyMMDD;

          let punchData = empRow[dayKey] || empRow[dayKey1000] || empRow[`day_${day}`] || empRow[`Day${day}`] || '';

          const checkInKey = `check_in_${dayKey}`;
          const checkOutKey = `check_out_${dayKey}`;
          const timetableKey = `timetable_${dayKey}`;
          const clockInKey = `clock_in_${dayKey}`;
          const clockOutKey = `clock_out_${dayKey}`;
          const dutyDurationKey = `duty_duration_${dayKey}`;
          const breakDurationKey = `break_duration_${dayKey}`;

          const checkInKeyAlt = `check_in_${day}`;
          const checkOutKeyAlt = `check_out_${day}`;
          const timetableKeyAlt = `timetable_${day}`;
          const clockInKeyAlt = `clock_in_${day}`;
          const clockOutKeyAlt = `clock_out_${day}`;
          const dutyDurationKeyAlt = `duty_duration_${day}`;
          const breakDurationKeyAlt = `break_duration_${day}`;

          let dayData = {};
          if (typeof punchData === 'object' && punchData !== null && !Array.isArray(punchData)) {
            dayData = punchData;
            punchData = dayData.punch || dayData.time || dayData.value || dayData.check_in || dayData.checkIn || '';
          }

          const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), day);
          const weekday = weekdays[currentDate.getDay()];
          const isSunday = currentDate.getDay() === 0;
          const isWorkingDay = !isSunday ? 1.0 : 0.0;

          const empTimetable = empRow.timetable || empRow.schedule || empRow.work_schedule ||
                              empRow.time_table || empRow.workSchedule ||
                              empRow.default_schedule || empRow.shift_timings || '';

          let checkIn = empRow[checkInKey] || empRow[checkInKeyAlt] || empRow[`check_${dayKey}_in`] ||
                       empRow[`check_in_time_${dayKey}`] || empRow[`check_in_time_${day}`] ||
                       dayData.check_in || dayData.checkIn ||
                       dayData.checkInTime || dayData.check_in_time || '';
          let checkOut = empRow[checkOutKey] || empRow[checkOutKeyAlt] || empRow[`check_${dayKey}_out`] ||
                        empRow[`check_out_time_${dayKey}`] || empRow[`check_out_time_${day}`] ||
                        dayData.check_out || dayData.checkOut ||
                        dayData.checkOutTime || dayData.check_out_time || '';
          let clockIn = empRow[clockInKey] || empRow[clockInKeyAlt] ||
                       empRow[`clock_in_time_${dayKey}`] || empRow[`clock_in_time_${day}`] ||
                       dayData.clock_in || dayData.clockIn || dayData.clockInTime || dayData.clock_in_time ||
                       checkIn || '';
          let clockOut = empRow[clockOutKey] || empRow[clockOutKeyAlt] ||
                        empRow[`clock_out_time_${dayKey}`] || empRow[`clock_out_time_${day}`] ||
                        dayData.clock_out || dayData.clockOut || dayData.clockOutTime || dayData.clock_out_time ||
                        checkOut || '';

          let timetable = empRow[timetableKey] || empRow[timetableKeyAlt] ||
                         dayData.timetable || dayData.schedule ||
                         dayData.time_table || dayData.workSchedule || '';

          if (!timetable) {
            timetable = empTimetable;
          }
          let dutyDuration = empRow[dutyDurationKey] || empRow[dutyDurationKeyAlt] ||
                            empRow[`duty_duration_time_${dayKey}`] || empRow[`duty_duration_time_${day}`] ||
                            empRow[`worked_hours_${dayKey}`] || empRow[`worked_hours_${day}`] ||
                            empRow[`worked_time_${dayKey}`] || empRow[`worked_time_${day}`] ||
                            empRow[`duty_hrs_${dayKey}`] || empRow[`duty_hrs_${day}`] ||
                            empRow[`worked_hours`] || empRow[`duty_duration`] || empRow[`dutyDuration`] ||
                            dayData.duty_duration || dayData.dutyDuration ||
                            dayData.dutyDurationHrs || dayData.duty_duration_hrs ||
                            dayData.worked_hours || dayData.workedHours || dayData.worked_time || '';
          let breakDuration = empRow[breakDurationKey] || empRow[breakDurationKeyAlt] ||
                             empRow[`break_duration_${dayKey}`] || empRow[`break_duration_${day}`] ||
                             dayData.break_duration || dayData.breakDuration ||
                             dayData.breakDurationHrs || dayData.break_duration_hrs || '';

          if ((!checkIn || checkIn === '') && (!checkOut || checkOut === '') && punchData && punchData !== null && punchData !== '') {
            const punchStr = String(punchData).trim();

            if (punchStr.includes('-')) {
              const parts = punchStr.split('-').map(s => s.trim());
              if (parts.length >= 2) {
                checkIn = parts[0];
                checkOut = parts[1];
                clockIn = parts[0];
                clockOut = parts[1];

                if (checkIn && checkOut && checkIn.match(/^\d{2}:\d{2}$/) && checkOut.match(/^\d{2}:\d{2}$/)) {
                  try {
                    const [inH, inM] = checkIn.split(':').map(Number);
                    const [outH, outM] = checkOut.split(':').map(Number);
                    const inMinutes = inH * 60 + inM;
                    const outMinutes = outH * 60 + outM;
                    let durationMinutes = outMinutes - inMinutes;

                    if (durationMinutes < 0) {
                      durationMinutes += 24 * 60;
                    }

                    const hours = Math.floor(durationMinutes / 60);
                    const minutes = durationMinutes % 60;
                    dutyDuration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                  } catch (e) {
                    // Ignore parsing errors
                  }
                }

                if (!timetable && checkIn && checkOut && checkIn.match(/^\d{2}:\d{2}$/) && checkOut.match(/^\d{2}:\d{2}$/)) {
                  try {
                    const inHour = parseInt(checkIn.split(':')[0], 10);
                    const outHour = parseInt(checkOut.split(':')[0], 10);
                    const inPeriod = inHour < 12 ? 'am' : 'pm';
                    const outPeriod = outHour < 12 ? 'am' : 'pm';
                    const inDisplayHour = inHour > 12 ? inHour - 12 : inHour === 0 ? 12 : inHour;
                    const outDisplayHour = outHour > 12 ? outHour - 12 : outHour === 0 ? 12 : outHour;
                    timetable = `${inDisplayHour}${inPeriod} to ${outDisplayHour}${outPeriod}`;
                  } catch (e) {
                    // Ignore parsing errors
                  }
                }
              }
            } else if (punchStr.match(/^\d{2}:\d{2}$/)) {
              checkIn = punchStr;
              clockIn = punchStr;
            }
          }

          if (checkIn && !checkOut) {
            // leave blank for now
          }

          if (!timetable && checkIn && checkOut && checkIn.match(/^\d{2}:\d{2}$/) && checkOut.match(/^\d{2}:\d{2}$/)) {
            try {
              const inHour = parseInt(checkIn.split(':')[0], 10);
              const outHour = parseInt(checkOut.split(':')[0], 10);
              const inPeriod = inHour < 12 ? 'am' : 'pm';
              const outPeriod = outHour < 12 ? 'am' : 'pm';
              const inDisplayHour = inHour > 12 ? inHour - 12 : inHour === 0 ? 12 : inHour;
              const outDisplayHour = outHour > 12 ? outHour - 12 : outHour === 0 ? 12 : outHour;
              timetable = `${inDisplayHour}${inPeriod} to ${outDisplayHour}${outPeriod}`;
            } catch (e) {
              // Ignore parsing errors
            }
          }

          if (!timetable) {
            const deptName = (empRow.dept_name || '').toLowerCase();
            const positionName = (empRow.position_name || '').toLowerCase();

            if (deptName.includes('sales') || deptName.includes('operations')) {
              timetable = 'Morning 8am to 5pm';
            } else if (deptName.includes('remote') || positionName.includes('remote')) {
              timetable = 'Flexible';
            } else {
              timetable = '9am to 6pm';
            }
          }

          if (timetable && timetable.toLowerCase().includes('flexible')) {
            if (!checkIn || checkIn === '') checkIn = '00:00';
            if (!checkOut || checkOut === '') checkOut = '23:59';
            if (!clockIn || clockIn === '') clockIn = '00:00';
            if (!clockOut || clockOut === '') clockOut = '23:59';
          }

          if ((!checkIn || checkIn === '') && (!checkOut || checkOut === '')) {
            if (isSunday) {
              checkIn = '00:00';
              checkOut = '00:00';
              clockIn = '00:00';
              clockOut = '00:00';
              dutyDuration = '';
            } else {
              checkIn = checkIn || '';
              checkOut = checkOut || '';
              clockIn = clockIn || '';
              clockOut = clockOut || '';
              dutyDuration = dutyDuration || '';
            }
          }

          if (!clockIn && checkIn) clockIn = checkIn;
          if (!clockOut && checkOut) clockOut = checkOut;

          let workedHrs = dutyDuration;
          let totalHrs = dutyDuration;

          let breakOut = dayData.break_out || dayData.breakOut || empRow[`break_out_${dayKey}`] || empRow[`break_out_${day}`] || '';
          let breakIn = dayData.break_in || dayData.breakIn || empRow[`break_in_${dayKey}`] || empRow[`break_in_${day}`] || '';
          let breakHrs = dayData.break_hrs || dayData.breakHrs || empRow[`break_hrs_${dayKey}`] || empRow[`break_hrs_${day}`] || '';
          let totalBreakHrs = dayData.total_break_hrs || dayData.totalBreakHrs || empRow[`total_break_hrs_${dayKey}`] || empRow[`total_break_hrs_${day}`] || '';
          let totalOT = dayData.total_ot || dayData.totalOT || empRow[`total_ot_${dayKey}`] || empRow[`total_ot_${day}`] || '';

          transformed.push({
            emp_id: empRow.emp_id || empRow.emp_code || '',
            emp_code: empRow.emp_code || empRow.emp_id || '',
            first_name: empRow.first_name || '',
            last_name: empRow.last_name || '',
            dept_name: empRow.dept_name || '',
            date: `${String(day).padStart(2, '0')}-${String(filters.month).padStart(2, '0')}-${filters.year}`,
            dateObj: currentDate,
            weekday,
            timetable: timetable || '',
            checkIn: checkIn || (isSunday ? '00:00' : ''),
            checkOut: checkOut || (isSunday ? '00:00' : ''),
            clockIn: clockIn || (isSunday ? '00:00' : ''),
            clockOut: clockOut || (isSunday ? '00:00' : ''),
            dutyDuration: dutyDuration || '',
            breakDuration: breakDuration || empRow.break_duration || '',
            workDay: isWorkingDay,
            workedHrs: workedHrs || '',
            totalHrs: totalHrs || '',
            breakOut: breakOut || '',
            breakIn: breakIn || '',
            breakHrs: breakHrs || '',
            totalBreakHrs: totalBreakHrs || '',
            totalOT: totalOT || empRow.paycode_2 || '',
            ruleTotalOT: empRow.paycode_1 || empRow.total_ot || '',
            totalLeaves: empRow.total_leaves || '',
            unscheduled: empRow.unscheduled || '',
            remaining: empRow.remaining || empRow.paycode_13 || '',
            regularH: empRow.regular_h || empRow.paycode_3 || '',
            lateInM: empRow.late_in_m || '',
            earlyOutM: empRow.early_out_m || '',
            absenceD: empRow.absence_d || '',
            normalOTH: empRow.normal_ot_h || '',
            w: empRow.w || '',
            rawPunch: punchData,
            isLeaveRecord: false
          });
        }
      });

      attendanceRows = transformed;
    }

    const leaveRows = [];
    const leaveDayKeySet = new Set();

    if (Array.isArray(leaveRecords) && leaveRecords.length > 0) {
      leaveRecords.forEach(leave => {
        const employee = leave.employee || {};
        const leaveTypeInfo = leave.leaveType || {};
        const empCode = String(employee.employeeId || employee.empCode || employee.code || employee.id || '').trim();
        const firstName = employee.firstName || employee.first_name || employee.name || '';
        const lastName = employee.lastName || employee.last_name || '';
        const departmentName = employee.department?.name || deptLookup.get(empCode) || '';
        const leaveTypeName = leaveTypeInfo.name || leaveTypeInfo.code || 'Leave';
        const leaveStatus = leave.status || '';
        const leaveReason = leave.reason || '';

        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return;
        }

        const startTime = Math.max(
          new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime(),
          monthStartDate.getTime()
        );
        const endTime = Math.min(
          new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime(),
          monthEndDate.getTime()
        );

        if (endTime < startTime) {
          return;
        }

        for (let time = startTime; time <= endTime; time += 86400000) {
          const currentDate = new Date(time);
          const formattedDate = `${String(currentDate.getDate()).padStart(2, '0')}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}`;
          const weekday = weekdays[currentDate.getDay()];
          const isHalfDay = Boolean(leave.isHalfDay);
          const halfLabel = isHalfDay
            ? leave.halfDayType === 'first_half'
              ? 'First Half'
              : leave.halfDayType === 'second_half'
                ? 'Second Half'
                : 'Half Day'
            : '';

          const normalizedEmpCode = normalizeEmpCode(empCode) || empCode;
          leaveDayKeySet.add(`${normalizedEmpCode}_${formattedDate}`);

          leaveRows.push({
            emp_id: empCode,
            emp_code: empCode,
            first_name: firstName,
            last_name: lastName,
            dept_name: departmentName,
            date: formattedDate,
            dateObj: currentDate,
            weekday,
            timetable: isHalfDay ? `Half-day Leave (${halfLabel})` : `Leave - ${leaveTypeName}`,
            checkIn: isHalfDay ? 'Half-day Leave' : 'Leave',
            checkOut: isHalfDay ? 'Half-day Leave' : 'Leave',
            dutyDuration: isHalfDay ? 'Leave (Half Day)' : 'Leave',
            breakDuration: '',
            workDay: isHalfDay ? 0.5 : 0,
            workedHrs: '',
            totalHrs: '',
            breakOut: '',
            breakIn: '',
            breakHrs: '',
            totalBreakHrs: '',
            totalOT: '',
            ruleTotalOT: '',
            totalLeaves: '',
            unscheduled: '',
            lateInM: '',
            earlyOutM: '',
            absenceD: '',
            rawPunch: '',
            isLeaveRecord: true,
            hasLeaveSummary: true,
            leaveType: leaveTypeName,
            leaveStatus,
            leaveReason,
            leaveRequestId: leave._id || `${empCode}-${time}`,
            isHalfDayLeave: isHalfDay
          });
        }
      });
    }

    if (leaveDayKeySet.size) {
      attendanceRows = attendanceRows.filter(row => {
        const rawCode = row.emp_code || row.emp_id || '';
        const normalizedCode = normalizeEmpCode(rawCode) || rawCode;
        const key = `${normalizedCode}_${row.date}`;
        return !leaveDayKeySet.has(key);
      });
    }

    let combinedRows = [...attendanceRows, ...leaveRows];

    const normalizedSummary = {};
    Object.entries(leaveSummaryByEmployee || {}).forEach(([key, value]) => {
      const normalizedKey = normalizeEmpCode(key);
      if (normalizedKey) {
        normalizedSummary[normalizedKey] = value;
      }
    });

    combinedRows.forEach(row => {
      if (row.isLeaveRecord) return;
      const normalizedCode = normalizeEmpCode(row.emp_code || row.emp_id || '');
      if (normalizedCode && normalizedSummary[normalizedCode]) {
          row.hasLeaveSummary = true;
      }
    });

    if (filterType === 'department' && filters.departmentId) {
      const targetDept = departments.find(
        dept => String(dept.id) === String(filters.departmentId)
      );
      const targetName = (targetDept?.name || '').trim().toLowerCase();
      combinedRows = combinedRows.filter(row => {
        const rowDept = (row.dept_name || '').trim().toLowerCase();
        if (!rowDept || rowDept === 'n/a') return false;
        if (!targetName) return true;
        return rowDept === targetName || rowDept.includes(targetName) || targetName.includes(rowDept);
      });
    }

    combinedRows.sort((a, b) => {
      const empA = String(a.emp_code || a.emp_id || '').toLowerCase();
      const empB = String(b.emp_code || b.emp_id || '').toLowerCase();
      if (empA && empB && empA !== empB) {
        return empA.localeCompare(empB, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (a.dateObj && b.dateObj) {
        return a.dateObj - b.dateObj;
      }
      return 0;
    });

    return combinedRows;
  }, [reportType, viewMode, reportData, filters.year, filters.month, startEnd?.start_date, startEnd?.end_date, leaveRecords, filterType, filters.departmentId, departments]);
  
  // Filter list view data
  const filteredListViewData = useMemo(() => {
    if (!listViewData.length) return [];
    if (!searchTerm.trim()) return listViewData;
    const term = searchTerm.toLowerCase();
    return listViewData.filter(row => {
      const nameMatch = (row.first_name || '').toLowerCase().includes(term);
      const empCodeStrRaw = row.emp_code || row.emp_id || '';
      const empCodeStr = normalizeEmpCode(empCodeStrRaw);
      const idMatch = [String(empCodeStrRaw || '').toLowerCase(), empCodeStr.toLowerCase()].some(code => code.includes(term));
      const deptMatch = (row.dept_name || '').toLowerCase().includes(term);
      const dateMatch = (row.date || '').toLowerCase().includes(term);
      const weekdayMatch = (row.weekday || '').toLowerCase().includes(term);
      const timetableMatch = (row.timetable || '').toLowerCase().includes(term);
      const leaveTypeMatch = (row.leaveType || '').toLowerCase().includes(term);
      const leaveStatusMatch = (row.leaveStatus || '').toLowerCase().includes(term);
      const leaveReasonMatch = (row.leaveReason || '').toLowerCase().includes(term);
      const leaveSummary = leaveSummaryByEmployee[empCodeStr] || leaveSummaryByEmployee[String(empCodeStrRaw || '').trim()];
      const leaveSummaryMatch = leaveSummary ? formatLeaveSummaryText(leaveSummary).toLowerCase().includes(term) : false;
      return nameMatch || idMatch || deptMatch || dateMatch || weekdayMatch || timetableMatch || leaveTypeMatch || leaveStatusMatch || leaveReasonMatch || leaveSummaryMatch;
    });
  }, [listViewData, searchTerm, leaveSummaryByEmployee]);

  // Render data table
  const renderDataTable = () => {
    if (!reportData?.data || !Array.isArray(reportData.data)) return null;

    const isMonthlyListView = reportType === 'monthly' && viewMode === 'list';
    const dataToShow = isMonthlyListView ? filteredListViewData : filteredData;
    // dayKeys is computed at component scope
    const paginatedMonthlyList = isMonthlyListView
      ? filteredListViewData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
      : [];
    const displayedCount = isMonthlyListView
      ? paginatedMonthlyList.length
      : dataToShow.length;
    const totalRecords = isMonthlyListView
      ? filteredListViewData.length
      : (totalCount || dataToShow.length);

    return (
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Detailed Data
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Showing {`${displayedCount} of ${totalRecords}`} records
              </Typography>
              {reportType === 'monthly' && (
                <>
                  <Button
                    variant={viewMode === 'grid' ? 'contained' : 'outlined'}
                    startIcon={<ViewModule />}
                    onClick={() => setViewMode('grid')}
                    sx={{ py: 0.8, mr: 1 }}
                    size="small"
                  >
                    Grid
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'contained' : 'outlined'}
                    startIcon={<ViewList />}
                    onClick={() => setViewMode('list')}
                    sx={{ py: 0.8, mr: 1 }}
                    size="small"
                  >
                    List
                  </Button>
                </>
              )}
              {(reportType === 'monthly' || reportType === 'monthly_absent') && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={(e) => setExportAnchorEl(e.currentTarget)}
                    sx={{ py: 0.8 }}
                  >
                    Export Excel
                  </Button>
                  <Menu
                    anchorEl={exportAnchorEl}
                    open={Boolean(exportAnchorEl)}
                    onClose={() => setExportAnchorEl(null)}
                  >
                    <MenuItem onClick={() => { setExportAnchorEl(null); exportExcel('current'); }}>Current page</MenuItem>
                    <MenuItem onClick={() => { setExportAnchorEl(null); exportExcel('all'); }}>All pages</MenuItem>
                  </Menu>
                </>
              )}
            </Box>
          </Box>
          
          {/* Search Bar */}
          <TextField
            fullWidth
            placeholder="Search by employee name, ID, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <Search sx={{ mr: 1, color: theme.palette.text.secondary }} />
              )
            }}
          />

          <TableContainer component={Paper} sx={{ borderRadius: 2, maxHeight: '70vh', overflowX: 'auto' }}>
            <Table
              stickyHeader
              size="small"
              sx={{
                '& .MuiTableCell-root': {
                  py: 0.75,
                  px: 1.25,
                  fontSize: 13,
                  lineHeight: 1.35
                },
                '& thead .MuiTableCell-root': {
                  fontSize: 12,
                  lineHeight: 1.3,
                  py: 0.9
                }
              }}
            >
              <TableHead>
                <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                  {reportType === 'monthly' && viewMode === 'list' && (
                    <>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>Employee ID</TableCell>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>First Name</TableCell>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>Department</TableCell>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>Weekday</TableCell>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>Timetable</TableCell>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>Check In</TableCell>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>Check Out</TableCell>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>Duty Duration</TableCell>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>Work Day</TableCell>
                      <TableCell sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 12, color: theme.palette.primary.main, whiteSpace: 'nowrap' }}>Leave</TableCell>
                    </>
                  )}
                  {reportType === 'monthly' && viewMode === 'grid' && (
                    <>
                      <TableCell sx={{ fontWeight: 'bold' }}>Employee ID</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Employee Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Department</TableCell>
                      {dayKeys.map((k, idx) => (
                        <TableCell key={k} sx={{ fontWeight: 'bold' }}>{idx + 1}</TableCell>
                      ))}
                    </>
                  )}
                  {reportType === 'monthly_absent' && (
                    <>
                      <TableCell sx={{ fontWeight: 'bold' }}>Employee ID</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>First Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Department</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Need Present Days</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Present Days</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Absence Days</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Holiday Days</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Present Percentage</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Absence Percentage</TableCell>
                    </>
                  )}
                  {reportType === 'department' && (
                    <>
                      <TableCell sx={{ fontWeight: 'bold' }}>Department</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Total Records</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Present</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Absent</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Late</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Leave</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Total Work Hours</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Avg Work Hours</TableCell>
                    </>
                  )}
                  {reportType === 'summary' && (
                    <>
                      <TableCell sx={{ fontWeight: 'bold' }}>Employee ID</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Employee Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Department</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Total Days</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Present</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Absent</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Late</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Leave</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Attendance %</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {isMonthlyListView ? (
                  paginatedMonthlyList.map((row, index) => (
                    <TableRow
                      key={`${row.emp_id}-${row.date}-${index}`}
                      hover
                      sx={{
                        backgroundColor: row.isLeaveRecord
                          ? alpha(theme.palette.warning.light, 0.12)
                          : undefined
                      }}
                    >
                      <TableCell sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                        {row.emp_code || row.emp_id || 'N/A'}
                      </TableCell>
                      <TableCell>{row.first_name || 'N/A'}</TableCell>
                      <TableCell>{row.dept_name || 'N/A'}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.weekday}</TableCell>
                      <TableCell>{row.timetable || ''}</TableCell>
                      <TableCell
                        sx={{
                          color: row.checkIn && String(row.checkIn).trim() !== '' ? 'inherit' : '#d32f2f',
                          fontWeight: row.checkIn && String(row.checkIn).trim() !== '' ? 500 : 700,
                          backgroundColor: row.checkIn && String(row.checkIn).trim() !== '' ? 'transparent' : 'rgba(244,67,54,0.12)',
                          borderRadius: 1,
                          textAlign: 'center',
                          letterSpacing: row.checkIn && String(row.checkIn).trim() !== '' ? 'normal' : '0.05em'
                        }}
                      >
                        {row.checkIn && String(row.checkIn).trim() !== '' ? row.checkIn : 'MISSING'}
                      </TableCell>
                      <TableCell
                        sx={{
                          color: row.checkOut && String(row.checkOut).trim() !== '' ? 'inherit' : '#d32f2f',
                          fontWeight: row.checkOut && String(row.checkOut).trim() !== '' ? 500 : 700,
                          backgroundColor: row.checkOut && String(row.checkOut).trim() !== '' ? 'transparent' : 'rgba(244,67,54,0.12)',
                          borderRadius: 1,
                          textAlign: 'center',
                          letterSpacing: row.checkOut && String(row.checkOut).trim() !== '' ? 'normal' : '0.05em'
                        }}
                      >
                        {row.checkOut && String(row.checkOut).trim() !== '' ? row.checkOut : 'MISSING'}
                      </TableCell>
                      <TableCell>{row.dutyDuration || ''}</TableCell>
                      <TableCell>{getWorkDayCellText(row)}</TableCell>
                      <TableCell sx={{ color: row.isLeaveRecord ? theme.palette.warning.dark : theme.palette.text.primary }}>
                        {getLeaveCellText(row)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  dataToShow.map((row, index) => (
                    <TableRow key={index} hover>
                      {reportType === 'monthly' && viewMode === 'grid' && (
                        <>
                          <TableCell sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                            {row.emp_code || row.emp_id || 'N/A'}
                          </TableCell>
                          <TableCell>{`${row.first_name || ''} ${row.last_name || ''}`.trim() || 'N/A'}</TableCell>
                          <TableCell>{row.dept_name || 'N/A'}</TableCell>
                          {dayKeys.map((k) => (
                            <TableCell key={k}>{row[String(k)] || ''}</TableCell>
                          ))}
                        </>
                      )}
                      {reportType === 'monthly_absent' && (
                        <>
                          <TableCell sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                            {row.emp_code || row.emp_id || 'N/A'}
                          </TableCell>
                          <TableCell>{row.first_name || 'N/A'}</TableCell>
                          <TableCell>{row.dept_name || 'N/A'}</TableCell>
                          <TableCell>{row.need_present || row.need_present_days || row.needPresentDays || 0}</TableCell>
                          <TableCell>{row.present || row.present_days || row.presentDays || 0}</TableCell>
                          <TableCell sx={{ color: '#f44336', fontWeight: 'bold' }}>
                            {row.absence || row.absence_days || row.absenceDays || row.absent_days || row.absentDays || 0}
                          </TableCell>
                          <TableCell>{row.holiday || row.holiday_days || row.holidayDays || 0}</TableCell>
                          <TableCell sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                            {row.present_rate || row.present_percentage || row.presentPercentage 
                              ? String(row.present_rate || row.present_percentage || row.presentPercentage).replace('%', '')
                              : '0.00'}
                            {row.present_rate ? '' : '%'}
                          </TableCell>
                          <TableCell sx={{ color: '#f44336', fontWeight: 'bold' }}>
                            {row.absence_rate || row.absence_percentage || row.absencePercentage 
                              ? String(row.absence_rate || row.absence_percentage || row.absencePercentage).replace('%', '')
                              : '0.00'}
                            {row.absence_rate ? '' : '%'}
                          </TableCell>
                        </>
                      )}
                      {reportType === 'department' && (
                        <>
                          <TableCell sx={{ fontWeight: 'bold' }}>{row.departmentName || 'N/A'}</TableCell>
                          <TableCell>{row.totalRecords || 0}</TableCell>
                          <TableCell sx={{ color: '#4caf50', fontWeight: 'bold' }}>{row.presentCount || 0}</TableCell>
                          <TableCell sx={{ color: '#f44336', fontWeight: 'bold' }}>{row.absentCount || 0}</TableCell>
                          <TableCell sx={{ color: '#ff9800', fontWeight: 'bold' }}>{row.lateCount || 0}</TableCell>
                          <TableCell sx={{ color: '#2196f3', fontWeight: 'bold' }}>{row.leaveCount || 0}</TableCell>
                          <TableCell>{row.totalWorkHours || 0}h</TableCell>
                          <TableCell>{row.averageWorkHours ? row.averageWorkHours.toFixed(1) : 0}h</TableCell>
                        </>
                      )}
                      {reportType === 'summary' && (
                        <>
                          <TableCell sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                            {row.employeeId || 'N/A'}
                          </TableCell>
                          <TableCell>{row.employeeName || 'N/A'}</TableCell>
                          <TableCell>{row.department || 'N/A'}</TableCell>
                          <TableCell>{row.totalDays || 0}</TableCell>
                          <TableCell sx={{ color: '#4caf50', fontWeight: 'bold' }}>{row.presentDays || 0}</TableCell>
                          <TableCell sx={{ color: '#f44336', fontWeight: 'bold' }}>{row.absentDays || 0}</TableCell>
                          <TableCell sx={{ color: '#ff9800', fontWeight: 'bold' }}>{row.lateDays || 0}</TableCell>
                          <TableCell sx={{ color: '#2196f3', fontWeight: 'bold' }}>{row.leaveDays || 0}</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>
                            {row.attendancePercentage ? `${row.attendancePercentage.toFixed(1)}%` : '0%'}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {(reportType === 'monthly' || reportType === 'monthly_absent') && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <TablePagination
                component="div"
                count={isMonthlyListView ? filteredListViewData.length : (totalCount || dataToShow.length)}
                page={page}
                onPageChange={(_e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[10, 20, 50, 100, 300]}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  const exportReport = useCallback(async (format) => {
    try {
      if (reportType === 'monthly') {
        // Build CSV from current reportData in memory
        if (!reportData?.data || !Array.isArray(reportData.data) || reportData.data.length === 0) {
          setSnackbar({ open: true, message: 'No data to export', severity: 'warning' });
          return;
        }
        const { start_date } = reportData;
        const start = new Date(start_date || `${filters.year}-${String(filters.month).padStart(2, '0')}-01`);
        const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        const keys = Array.from({ length: daysInMonth }, (_, i) => 1001 + i);
        const headers = ['emp_code', 'first_name', 'last_name', 'dept_name', ...keys.map((k, i) => `day_${i + 1}`)];
        const rows = reportData.data.map(row => {
          const base = [row.emp_code || row.emp_id || '', row.first_name || '', row.last_name || '', row.dept_name || ''];
          const days = keys.map(k => row[String(k)] || '');
          return [...base, ...days];
        });
        const csv = [headers.join(','), ...rows.map(r => r.map(v => (v == null ? '' : String(v).replaceAll('"', '""'))).map(v => /,|\n|"/.test(v) ? `"${v}"` : v).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `monthly-attendance-${filters.year}-${String(filters.month).padStart(2, '0')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      // Fallback to existing API export for other report types
      const response = await api.get(`/hr/reports/attendance/${reportType}`, {
        params: {
          month: filters.month,
          year: filters.year,
          department: filters.department,
          format: format
        },
        responseType: format === 'csv' ? 'blob' : 'json'
      });

      if (format === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${reportType}-attendance-${filters.month}-${filters.year}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      } else {
        setSnackbar({ open: true, message: 'PDF export coming soon!', severity: 'info' });
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      setSnackbar({ open: true, message: 'Error exporting report', severity: 'error' });
    }
  }, [reportType, reportData, filters.month, filters.year, filters.department]);

  const buildMonthlySheetData = useCallback(() => {
    if (!reportData?.data || !Array.isArray(reportData.data)) return { headers: [], rows: [] };
    const { start_date } = reportData;
    const start = new Date(start_date || `${filters.year}-${String(filters.month).padStart(2, '0')}-01`);
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const keys = Array.from({ length: daysInMonth }, (_, i) => 1001 + i);
    const headers = ['Employee ID', 'First Name', 'Last Name', 'Department', ...keys.map((_, i) => `${i + 1}`)];
    const rows = reportData.data.map(row => {
      const base = [row.emp_code || row.emp_id || '', row.first_name || '', row.last_name || '', row.dept_name || ''];
      const days = keys.map(k => row[String(k)] || '');
      return [...base, ...days];
    });
    return { headers, rows };
  }, [reportData, filters.year, filters.month]);

  const exportExcel = useCallback(async (scope = 'current') => {
    try {
      if (reportType !== 'monthly' && reportType !== 'monthly_absent') {
        setSnackbar({ open: true, message: 'Excel export is available for Monthly reports only.', severity: 'info' });
        return;
      }

      if ((reportType === 'monthly' || reportType === 'monthly_absent')) {
        if (hrPermissionsLoading) {
          setSnackbar({ open: true, message: 'Permissions are still loading. Please try again in a moment.', severity: 'info' });
          return;
        }
        if (!canAccessHrMonthly) {
          setSnackbar({ open: true, message: 'You do not have permission to export Monthly Attendance data.', severity: 'warning' });
          return;
        }
      }

      let headers = [];
      let rows = [];
      const isMonthlyListView = reportType === 'monthly' && viewMode === 'list';

      if (isMonthlyListView) {
        const listData = scope === 'current'
          ? filteredListViewData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
          : filteredListViewData;

        if (!listData.length) {
          setSnackbar({ open: true, message: 'No list data to export', severity: 'warning' });
          return;
        }

        headers = ['Employee ID', 'First Name', 'Department', 'Date', 'Weekday', 'Timetable', 'Check In', 'Check Out', 'Duty Duration', 'Work Day', 'Leave', '__highlight'];
        rows = listData.map(row => [
          row.emp_code || row.emp_id || '',
          row.first_name || '',
          row.dept_name || '',
          row.date || '',
          row.weekday || '',
          row.timetable || '',
          getCheckCellText(row.checkIn),
          getCheckCellText(row.checkOut),
          row.dutyDuration || '',
          getWorkDayCellText(row),
          getLeaveCellText(row),
          row.isLeaveRecord ? 'warn' : ''
        ]);
      } else if (scope === 'current') {
        if (reportData === null || !reportData?.data || !Array.isArray(reportData.data)) {
            setSnackbar({ open: true, message: 'No data to export', severity: 'warning' });
            return;
          }

        if (reportType === 'monthly_absent') {
          headers = ['Employee ID', 'First Name', 'Department', 'Need Present Days', 'Present Days', 'Absence Days', 'Holiday Days', 'Present Percentage', 'Absence Percentage'];
          rows = reportData.data.map(row => [
            row.emp_code || row.emp_id || '',
            row.first_name || '',
            row.dept_name || '',
            row.need_present || row.need_present_days || row.needPresentDays || 0,
            row.present || row.present_days || row.presentDays || 0,
            row.absence || row.absence_days || row.absenceDays || row.absent_days || row.absentDays || 0,
            row.holiday || row.holiday_days || row.holidayDays || 0,
            row.present_rate || row.present_percentage || row.presentPercentage 
              ? String(row.present_rate || row.present_percentage || row.presentPercentage).replace('%', '') + '%'
              : '0.00%',
            row.absence_rate || row.absence_percentage || row.absencePercentage 
              ? String(row.absence_rate || row.absence_percentage || row.absencePercentage).replace('%', '') + '%'
              : '0.00%'
          ]);
        } else {
          ({ headers, rows } = buildMonthlySheetData());
        }
      } else if (isMonthlyListView) {
        const listRows = filteredListViewData;
        if (!listRows.length) {
          setSnackbar({ open: true, message: 'No list data to export', severity: 'warning' });
          return;
        }
          headers = ['Employee ID', 'First Name', 'Department', 'Date', 'Weekday', 'Timetable', 'Check In', 'Check Out', 'Duty Duration', 'Work Day', 'Leave', '__highlight'];
        rows = listRows.map(row => [
          row.emp_code || row.emp_id || '',
          row.first_name || '',
          row.dept_name || '',
          row.date || '',
          row.weekday || '',
          row.timetable || '',
          getCheckCellText(row.checkIn),
          getCheckCellText(row.checkOut),
          row.dutyDuration || '',
            getWorkDayCellText(row),
            getLeaveCellText(row),
            row.isLeaveRecord ? 'warn' : ''
        ]);
      } else {
        // fetch all pages, build combined rows
        const { start_date, end_date } = startEnd;
        let departmentsParam = '-1';
        let areasParam = '-1';
        
        if (filterType === 'department') {
          departmentsParam = filters.departmentId ? String(filters.departmentId) : '-1';
        } else if (filterType === 'area') {
          areasParam = filters.areaId ? String(filters.areaId) : '-1';
        }

        const exportEndpoint = reportType === 'monthly_absent' 
          ? '/zkbio/zkbio/monthly-absent'
          : '/zkbio/zkbio/monthly-punch';

        const pageSize = 100;
        let current = 1;
        let total = 0;
        const all = [];
        while (true) {
          const resp = await api.get(exportEndpoint, {
            params: {
              page: current,
              page_size: pageSize,
              start_date,
              end_date,
              departments: departmentsParam,
              areas: areasParam,
              groups: '-1',
              employees: '-1'
            }
          });
          const data = resp.data?.data || [];
          if (current === 1) {
            setTotalCount(Number(resp.data?.totalCount || data.length || 0));
          }
          all.push(...data);
          total = Number(resp.data?.totalCount || 0);
          if (!data.length || all.length >= total) break;
          current += 1;
        }
        // Build headers and rows based on report type
        if (reportType === 'monthly_absent') {
          headers = ['Employee ID', 'First Name', 'Department', 'Need Present Days', 'Present Days', 'Absence Days', 'Holiday Days', 'Present Percentage', 'Absence Percentage'];
          rows = all.map(row => [
            row.emp_code || row.emp_id || '',
            row.first_name || '',
            row.dept_name || '',
            row.need_present || row.need_present_days || row.needPresentDays || 0,
            row.present || row.present_days || row.presentDays || 0,
            row.absence || row.absence_days || row.absenceDays || row.absent_days || row.absentDays || 0,
            row.holiday || row.holiday_days || row.holidayDays || 0,
            row.present_rate || row.present_percentage || row.presentPercentage 
              ? String(row.present_rate || row.present_percentage || row.presentPercentage).replace('%', '') + '%'
              : '0.00%',
            row.absence_rate || row.absence_percentage || row.absencePercentage 
              ? String(row.absence_rate || row.absence_percentage || row.absencePercentage).replace('%', '') + '%'
              : '0.00%'
          ]);
        } else {
          const { start_date: _sd } = reportData || {};
          const start = new Date(_sd || `${filters.year}-${String(filters.month).padStart(2, '0')}-01`);
          const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
          const keys = Array.from({ length: daysInMonth }, (_, i) => 1001 + i);
          headers = ['Employee ID', 'First Name', 'Last Name', 'Department', ...keys.map((_, i) => `${i + 1}`)];
          rows = all.map(row => {
            const base = [row.emp_code || row.emp_id || '', row.first_name || '', row.last_name || '', row.dept_name || ''];
            const days = keys.map(k => row[String(k)] || '');
            return [...base, ...days];
          });
        }
      }

      // Try dynamic import of xlsx; fallback to CSV
      try {
        const xlsx = await import('xlsx');
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
        if (headers.includes('__highlight')) {
          const sheetRange = xlsx.utils.decode_range(ws['!ref']);
          const highlightCol = headers.indexOf('__highlight');
          const checkInCol = headers.indexOf('Check In');
          const checkOutCol = headers.indexOf('Check Out');
          const leaveCol = headers.indexOf('Leave');
          for (let R = sheetRange.s.r + 1; R <= sheetRange.e.r; R += 1) {
            const highlightCellAddress = xlsx.utils.encode_cell({ r: R, c: highlightCol });
            const highlightValue = ws[highlightCellAddress]?.v;
            const checkInAddress = xlsx.utils.encode_cell({ r: R, c: checkInCol });
            const checkOutAddress = xlsx.utils.encode_cell({ r: R, c: checkOutCol });
            const leaveAddress = xlsx.utils.encode_cell({ r: R, c: leaveCol });

            const checkInMissing = ws[checkInAddress]?.v === 'MISSING';
            const checkOutMissing = ws[checkOutAddress]?.v === 'MISSING';

            if (highlightValue === 'warn') {
              [checkInAddress, checkOutAddress, leaveAddress].forEach(addr => {
                ws[addr] = ws[addr] || {};
                ws[addr].s = {
                  fill: { patternType: 'solid', fgColor: { rgb: 'FFF3E0' } },
                  font: { color: { rgb: 'E65100' }, bold: true }
                };
              });
            } else {
              [checkInAddress, checkOutAddress].forEach(addr => {
                const cellValue = ws[addr]?.v;
                if (cellValue === 'MISSING') {
                  ws[addr] = ws[addr] || {};
                  ws[addr].s = {
                    fill: { patternType: 'solid', fgColor: { rgb: 'FFEBEE' } },
                    font: { color: { rgb: 'C62828' }, bold: true }
                  };
                }
              });
            }
            const highlightCell = ws[highlightCellAddress];
            if (highlightCell) {
              delete highlightCell.v;
              delete highlightCell.w;
            }
          }
          xlsx.utils.sheet_del_col(ws, highlightCol);
          headers = headers.filter((_, idx) => idx !== highlightCol);
          rows = rows.map(row => row.filter((_, idx) => idx !== highlightCol));
        }
        const sheetName = reportType === 'monthly_absent' ? 'Monthly Absent' : 'Monthly';
        xlsx.utils.book_append_sheet(wb, ws, sheetName);
        const fname = reportType === 'monthly_absent'
          ? `monthly-absent-${filters.year}-${String(filters.month).padStart(2, '0')}-${scope}.xlsx`
          : `monthly-attendance-${filters.year}-${String(filters.month).padStart(2, '0')}-${scope}.xlsx`;
        xlsx.writeFile(wb, fname, { cellStyles: true });
      } catch (e) {
        // CSV fallback
        const csv = [headers.join(','), ...rows.map(r => r.map(v => (v == null ? '' : String(v).replaceAll('"', '""'))).map(v => /,|\n|"/.test(v) ? `"${v}"` : v).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `monthly-attendance-${filters.year}-${String(filters.month).padStart(2, '0')}-${scope}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting excel:', error);
      setSnackbar({ open: true, message: 'Error exporting Excel', severity: 'error' });
    }
  }, [reportType, reportData, filters.year, filters.month, filters.departmentId, filters.areaId, filterType, rowsPerPage, page, startEnd, buildMonthlySheetData, filteredListViewData, viewMode, getLeaveCellText, getWorkDayCellText, getCheckCellText]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/hr/reports')}
          sx={{ mb: 2 }}
        >
          Back to Reports
        </Button>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: alpha(currentConfig.color, 0.1),
              color: currentConfig.color,
              mr: 2
            }}
          >
            {currentConfig.icon}
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
              {currentConfig.title}
            </Typography>
            <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
              {currentConfig.description}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 4, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
            Report Filters
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={filters.month}
                  label="Month"
                  onChange={(e) => handleFilterChange('month', e.target.value)}
                >
                  {months.map((month) => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Year</InputLabel>
                <Select
                  value={filters.year}
                  label="Year"
                  onChange={(e) => handleFilterChange('year', e.target.value)}
                >
                  {years.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {(reportType === 'monthly' || reportType === 'monthly_absent') && (
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Filter By</InputLabel>
                  <Select
                    value={filterType}
                    label="Filter By"
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <MenuItem value="department">Department</MenuItem>
                    <MenuItem value="area">Area</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>
                  {reportType === 'monthly' || reportType === 'monthly_absent'
                    ? (filterType === 'department' ? 'Department' : filterType === 'area' ? 'Area' : 'Department')
                    : 'Department'}
                </InputLabel>
                {(reportType === 'monthly' || reportType === 'monthly_absent') ? (
                  filterType === 'department' ? (
                    <Select
                      value={filters.departmentId}
                      label="Department"
                      onChange={(e) => setFilters(prev => ({ ...prev, departmentId: e.target.value }))}
                      disabled={loadingDepartments}
                    >
                      <MenuItem value="">
                        <em>All Departments</em>
                      </MenuItem>
                      {departments.map((dept) => (
                        <MenuItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </MenuItem>
                      ))}
                    </Select>
                  ) : filterType === 'area' ? (
                    <Select
                      value={filters.areaId}
                      label="Area"
                      onChange={(e) => setFilters(prev => ({ ...prev, areaId: e.target.value }))}
                      disabled={loadingAreas}
                    >
                      <MenuItem value="">
                        <em>All Areas</em>
                      </MenuItem>
                      {areas.map((area) => (
                        <MenuItem key={area.id} value={area.id}>
                          {area.name}
                        </MenuItem>
                      ))}
                    </Select>
                  ) : null
                ) : (
                  <Select
                    value={filters.department}
                    label="Department"
                    onChange={(e) => handleFilterChange('department', e.target.value)}
                    disabled={loadingDepartments}
                  >
                    <MenuItem value="">
                      <em>All Departments</em>
                    </MenuItem>
                    {departments.map((dept) => (
                      <MenuItem key={dept._id} value={dept._id}>
                        {dept.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Loading State - Skeleton */}
      {loading && (
        <Box>
          {/* Summary Cards Skeleton */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[1, 2, 3, 4].map((index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    background: `linear-gradient(135deg, ${alpha('#2196f3', 0.1)} 0%, ${alpha('#2196f3', 0.05)} 100%)`,
                    border: `2px solid ${alpha('#2196f3', 0.2)}`,
                    borderRadius: 3
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    <Skeleton variant="circular" width={56} height={56} sx={{ mx: 'auto', mb: 2 }} />
                    <Skeleton variant="text" width={80} height={32} sx={{ mx: 'auto', mb: 1 }} />
                    <Skeleton variant="text" width={120} height={20} sx={{ mx: 'auto' }} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Table Skeleton */}
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Skeleton variant="text" width={150} height={32} />
                <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: 1 }} />
              </Box>
              
              {/* Search Bar Skeleton */}
              <Skeleton variant="rectangular" width="100%" height={56} sx={{ mb: 3, borderRadius: 1 }} />

              {/* Table Skeleton */}
              <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                      {[1, 2, 3, 4, 5, 6].map((col) => (
                        <TableCell key={col}>
                          <Skeleton variant="text" width={100} height={24} />
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((row) => (
                      <TableRow key={row}>
                        {[1, 2, 3, 4, 5, 6].map((col) => (
                          <TableCell key={col}>
                            <Skeleton variant="text" width={80} height={20} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination Skeleton */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Skeleton variant="rectangular" width={400} height={52} sx={{ borderRadius: 1 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Summary Cards */}
      {!loading && reportData && renderSummaryCards()}

      {/* Data Table */}
      {!loading && reportData && renderDataTable()}

      {/* No Data State */}
      {!loading && !reportData && (
        <Card sx={{ borderRadius: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              No Data Available
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              No attendance data found for {months.find(m => m.value === filters.month)?.label || filters.month}/{filters.year}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Please select a different month/year or check if attendance data has been recorded for this period.
            </Typography>
            <Button variant="contained" onClick={loadReportData}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

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

export default AttendanceReports;
