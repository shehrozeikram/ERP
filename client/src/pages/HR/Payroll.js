import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Fab,
  Collapse,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ApproveIcon,
  Payment as PaymentIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  AccountBalance as AccountBalanceIcon,
  Receipt as ReceiptIcon,
  People as PeopleIcon,
  Undo as UndoIcon,
  ExpandMore as ExpandMoreIcon,
  GroupWork as GroupWorkIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { formatPKR } from '../../utils/currency';
import api from '../../services/authService';
import { PageLoading, TableSkeleton } from '../../components/LoadingSpinner';

// Months array moved outside component to prevent recreation on every render
const months = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

const Payroll = () => {
  const navigate = useNavigate();
  const [payrolls, setPayrolls] = useState([]);
  const [monthlyPayrolls, setMonthlyPayrolls] = useState([]);
  const [paginatedMonthlyPayrolls, setPaginatedMonthlyPayrolls] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    employeeId: '',
    department: '',
    position: '',
    startDate: '',
    endDate: '',
    searchQuery: ''
  });
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [bulkCreateDialogOpen, setBulkCreateDialogOpen] = useState(false);
  const [bulkCreateLoading, setBulkCreateLoading] = useState(false);
  const [bulkCreateForm, setBulkCreateForm] = useState({
    month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    year: new Date().getFullYear()
  });
  const [monthlyTaxUpdateLoading, setMonthlyTaxUpdateLoading] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const [generalPayrollExpanded, setGeneralPayrollExpanded] = useState(false);
  const [employeeDetailsPage, setEmployeeDetailsPage] = useState({});
  const [employeeDetailsRowsPerPage, setEmployeeDetailsRowsPerPage] = useState(10);
  const [generalPayrollPage, setGeneralPayrollPage] = useState(0);
  const [generalPayrollRowsPerPage, setGeneralPayrollRowsPerPage] = useState(10);
  const [currentOverview, setCurrentOverview] = useState(null);
  const [currentOverviewLoading, setCurrentOverviewLoading] = useState(false);

  useEffect(() => {
    fetchPayrolls();
    fetchStats();
    fetchEmployees();
    fetchDepartments();
    fetchPositions();
  }, [page, rowsPerPage, filters]);

  // Fetch current overview when component mounts and when general payroll is expanded
  useEffect(() => {
    fetchCurrentOverview();
  }, []);

  useEffect(() => {
    if (generalPayrollExpanded) {
      // Data is already loaded, just ensure it's fresh
      fetchCurrentOverview();
    }
  }, [generalPayrollExpanded]);

  // Group payrolls by month and year - fixed dependency array
  useEffect(() => {
    const filteredPayrolls = getFilteredPayrolls();
    
    // Debug logging
    if (filteredPayrolls.length > 0) {
      console.log('Processing payrolls:', filteredPayrolls.length);
      console.log('Sample payroll:', filteredPayrolls[0]);
    }
    
    if (filteredPayrolls.length > 0) {
      const grouped = filteredPayrolls.reduce((acc, payroll) => {
        // Ensure month and year exist before processing
        if (!payroll.month || !payroll.year) {
          console.warn('Payroll missing month or year:', payroll);
          return acc;
        }
        
        const key = `${payroll.month}-${payroll.year}`;
        if (!acc[key]) {
          acc[key] = {
            month: payroll.month,
            year: payroll.year,
            monthName: months.find(m => m.value === payroll.month?.toString().padStart(2, '0'))?.label || `Month ${payroll.month}`,
            payrolls: [],
            totalEmployees: 0,
            totalGrossSalary: 0,
            totalNetSalary: 0,
            totalBasicSalary: 0,
            statuses: new Set()
          };
        }
        acc[key].payrolls.push(payroll);
        acc[key].totalEmployees++;
        acc[key].totalGrossSalary += payroll.grossSalary || 0;
        acc[key].totalNetSalary += payroll.netSalary || 0;
        acc[key].totalBasicSalary += payroll.basicSalary || 0;
        acc[key].statuses.add(payroll.status);
        return acc;
      }, {});

      const monthlyArray = Object.values(grouped).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

      // Sort employees within each monthly group by Employee ID in ascending order
              monthlyArray.forEach(monthly => {
          monthly.payrolls.sort((a, b) => {
            // Convert Employee ID to number for proper numerical sorting
            const idA = parseInt(a.employee?.employeeId) || 0;
            const idB = parseInt(b.employee?.employeeId) || 0;
            return idA - idB; // Ascending order (1, 2, 3, ...)
          });
        });
        
        // Additional safety check - filter out any invalid entries
        monthlyArray.forEach(monthly => {
          monthly.payrolls = monthly.payrolls.filter(payroll => 
            payroll && payroll.month && payroll.year && payroll.employee
          );
        });

      setMonthlyPayrolls(monthlyArray);
      setTotalItems(monthlyArray.length);
    } else {
      setMonthlyPayrolls([]);
      setTotalItems(0);
    }
  }, [payrolls, filters]); // Added filters dependency

  // Handle pagination for monthly payrolls
  useEffect(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginated = monthlyPayrolls.slice(startIndex, endIndex);
    setPaginatedMonthlyPayrolls(paginated);
  }, [monthlyPayrolls, page, rowsPerPage]);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      
      // For monthly grouping, we need ALL payrolls, not paginated
      const params = new URLSearchParams({
        limit: 0, // Get all payrolls for proper monthly grouping
        ...filters
      });

      const response = await api.get(`/payroll?${params}`);
      const payrollData = response.data.data || [];
      
      // Validate payroll data before setting state
      const validatedPayrolls = payrollData.filter(payroll => 
        payroll && 
        typeof payroll.month === 'number' && 
        typeof payroll.year === 'number' && 
        payroll.employee
      );
      
      setPayrolls(validatedPayrolls);
      setTotalItems(validatedPayrolls.length);
    } catch (error) {
      console.error('Error fetching payrolls:', error);
      setError('Failed to load payrolls');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/payroll/stats');
      setStats(response.data.data || {});
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchCurrentOverview = async () => {
    try {
      setCurrentOverviewLoading(true);
      const response = await api.get('/payroll/current-overview');
      setCurrentOverview(response.data.data);
    } catch (error) {
      console.error('Error fetching current overview:', error);
      setError('Failed to load current payroll overview');
    } finally {
      setCurrentOverviewLoading(false);
    }
  };

  // Calculate current overview from employees data
  const calculateCurrentOverview = () => {
    if (!employees || employees.length === 0) return {};
    
    const activeEmployees = employees.filter(emp => emp.employmentStatus === 'Active');
    
    let totalBasicSalary = 0;
    let totalGrossSalary = 0;
    let totalNetSalary = 0;
    
    activeEmployees.forEach(emp => {
      if (emp.salary && emp.salary.gross) {
        const gross = emp.salary.gross;
        const basic = gross * 0.6666; // 66.66% of gross
        const medical = gross * 0.1; // 10% of gross (tax exempt)
        const houseRent = gross * 0.2334; // 23.34% of gross
        
        totalBasicSalary += basic;
        totalGrossSalary += gross;
        
        // Calculate net salary (gross - deductions)
        // For now, using gross as net (deductions will be calculated later)
        totalNetSalary += gross;
      }
    });
    
    return {
      totalEmployees: activeEmployees.length,
      totalBasicSalary: Math.round(totalBasicSalary),
      totalGrossSalary: Math.round(totalGrossSalary),
      totalNetSalary: Math.round(totalNetSalary)
    };
  };

  const fetchEmployees = async () => {
    try {
      // Fetch ALL employees using the new getAll parameter
      const response = await api.get('/hr/employees?getAll=true');
      setEmployees(response.data.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setError('Failed to load employees');
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/hr/departments?limit=0');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await api.get('/hr/positions?limit=0');
      setPositions(response.data.data || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const handleChangePage = (event, newPage) => {
    setPaginationLoading(true);
    setPage(newPage);
    // Small delay to show loading state
    setTimeout(() => setPaginationLoading(false), 300);
  };

  const handleChangeRowsPerPage = (event) => {
    setPaginationLoading(true);
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset to first page when changing rows per page
    // Small delay to show loading state
    setTimeout(() => setPaginationLoading(false), 300);
  };

  const handleEmployeeDetailsPageChange = (monthKey, newPage) => {
    setEmployeeDetailsPage(prev => ({
      ...prev,
      [monthKey]: newPage
    }));
  };

  const handleEmployeeDetailsRowsPerPageChange = (monthKey, newRowsPerPage) => {
    setEmployeeDetailsRowsPerPage(prev => ({
      ...prev,
      [monthKey]: parseInt(newRowsPerPage, 10)
    }));
    // Reset to first page when changing rows per page
    setEmployeeDetailsPage(prev => ({
      ...prev,
      [monthKey]: 0
    }));
  };

  const handleGeneralPayrollPageChange = (newPage) => {
    setGeneralPayrollPage(newPage);
  };

  const handleGeneralPayrollRowsPerPageChange = (newRowsPerPage) => {
    setGeneralPayrollRowsPerPage(parseInt(newRowsPerPage, 10));
    setGeneralPayrollPage(0); // Reset to first page when changing rows per page
  };

  const getPaginatedEmployeeDetails = (monthly) => {
    const monthKey = `${monthly.month}-${monthly.year}`;
    const currentPage = employeeDetailsPage[monthKey] || 0;
    const currentRowsPerPage = employeeDetailsRowsPerPage[monthKey] || 10;
    
    const startIndex = currentPage * currentRowsPerPage;
    const endIndex = startIndex + currentRowsPerPage;
    
    return {
      paginatedEmployees: monthly.payrolls.slice(startIndex, endIndex),
      currentPage,
      currentRowsPerPage,
      totalEmployees: monthly.payrolls.length,
      totalPages: Math.ceil(monthly.payrolls.length / currentRowsPerPage)
    };
  };

  const getPaginatedGeneralPayrollEmployees = () => {
    if (!currentOverview) {
      return {
        paginatedEmployees: [],
        currentPage: generalPayrollPage,
        currentRowsPerPage: generalPayrollRowsPerPage,
        totalEmployees: 0,
        totalPages: 0
      };
    }
    
    // Use filtered employees if search is active, otherwise use all employees
    const employeesToShow = currentOverview.isSearchActive && currentOverview.filteredEmployees 
      ? currentOverview.filteredEmployees 
      : (currentOverview.employees || []);
    
    const startIndex = generalPayrollPage * generalPayrollRowsPerPage;
    const endIndex = startIndex + generalPayrollRowsPerPage;
    
    return {
      paginatedEmployees: employeesToShow.slice(startIndex, endIndex),
      currentPage: generalPayrollPage,
      currentRowsPerPage: generalPayrollRowsPerPage,
      totalEmployees: employeesToShow.length,
      totalPages: Math.ceil(employeesToShow.length / generalPayrollRowsPerPage)
    };
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0); // Reset to first page when applying filters
    
    // Reset general payroll pagination when search query changes
    if (field === 'searchQuery') {
      setGeneralPayrollPage(0);
    }
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      employeeId: '',
      department: '',
      position: '',
      startDate: '',
      endDate: '',
      searchQuery: ''
    });
    setPage(0); // Reset to first page when clearing filters
    
    // Reset general payroll search state
    if (currentOverview) {
      setCurrentOverview(prev => ({
        ...prev,
        filteredEmployees: null,
        isSearchActive: false
      }));
    }
  };

  const getFilteredPayrolls = () => {
    // Safety check - ensure payrolls is an array and filter out invalid entries
    let filtered = (payrolls || []).filter(p => p && p.month && p.year && p.employee);

    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(p => p.status === filters.status);
    }

    // Filter by employee
    if (filters.employeeId) {
      filtered = filtered.filter(p => p.employee === filters.employeeId);
    }

    // Filter by department
    if (filters.department) {
      filtered = filtered.filter(p => p.employee?.department === filters.department);
    }

    // Filter by position
    if (filters.position) {
      filtered = filtered.filter(p => p.employee?.position === filters.position);
    }

    // Filter by search query - Updated to include both monthly and general payroll
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      
      // Filter monthly payrolls
      filtered = filtered.filter(p => 
        p.employee?.firstName?.toLowerCase().includes(query) ||
        p.employee?.lastName?.toLowerCase().includes(query) ||
        p.employee?.employeeId?.toLowerCase().includes(query) ||
        p.employee?.department?.toLowerCase().includes(query) ||
        p.employee?.position?.toLowerCase().includes(query)
      );
      
      // Also filter general payroll overview if it exists
      if (currentOverview && currentOverview.employees) {
        const filteredGeneralEmployees = currentOverview.employees.filter(emp => 
          emp.firstName?.toLowerCase().includes(query) ||
          emp.lastName?.toLowerCase().includes(query) ||
          emp.employeeId?.toLowerCase().includes(query) ||
          emp.placementDepartment?.name?.toLowerCase().includes(query) ||
          emp.designation?.name?.toLowerCase().includes(query)
        );
        
        // Update current overview with filtered results for search
        if (filters.searchQuery) {
          setCurrentOverview(prev => ({
            ...prev,
            filteredEmployees: filteredGeneralEmployees,
            isSearchActive: true
          }));
        } else {
          // Clear search state when query is empty
          setCurrentOverview(prev => ({
            ...prev,
            filteredEmployees: null,
            isSearchActive: false
          }));
        }
      }
    }

    // Filter by date range
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      filtered = filtered.filter(p => {
        // Safety check for month and year
        if (!p.month || !p.year) return false;
        const payrollDate = new Date(p.year, p.month - 1, 1);
        return payrollDate >= startDate && payrollDate <= endDate;
      });
    }

    return filtered;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'default';
      case 'approved': return 'warning';
      case 'paid': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'approved': return 'Approved';
      case 'paid': return 'Paid';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'PKR 0';
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format employee ID to 5 digits with leading zeros
  const formatEmployeeId = (employeeId) => {
    if (!employeeId) return '';
    return employeeId.toString().padStart(5, '0');
  };

  const handleApprove = async (payrollId) => {
    try {
      await api.patch(`/payroll/${payrollId}/approve`);
      fetchPayrolls();
      fetchStats();
    } catch (error) {
      console.error('Error approving payroll:', error);
      setError('Failed to approve payroll');
    }
  };

  const handleMarkAsPaid = async (payrollId) => {
    try {
      await api.patch(`/payroll/${payrollId}/mark-paid`);
      fetchPayrolls();
      fetchStats();
    } catch (error) {
      console.error('Error marking payroll as paid:', error);
      setError('Failed to mark payroll as paid');
    }
  };

  const handleMarkAsUnpaid = async (payrollId) => {
    try {
      await api.patch(`/payroll/${payrollId}/mark-unpaid`);
      fetchPayrolls();
      fetchStats();
    } catch (error) {
      console.error('Error marking payroll as unpaid:', error);
      setError('Failed to mark payroll as unpaid');
    }
  };

  const handleDelete = async (payrollId) => {
    if (window.confirm('Are you sure you want to delete this payroll?')) {
      try {
        await api.delete(`/payroll/${payrollId}`);
        fetchPayrolls();
        fetchStats();
      } catch (error) {
        console.error('Error deleting payroll:', error);
        setError('Failed to delete payroll');
      }
    }
  };

  const handleBulkCreate = async () => {
    try {
      setBulkCreateLoading(true);
      
      // Get month and year from form
      const month = parseInt(bulkCreateForm.month);
      const year = bulkCreateForm.year;
      
      // Check if payrolls already exist for this month
      const existingPayrolls = payrolls.filter(
        p => p.month === month && p.year === year
      );

      let forceRegenerate = false;
      
      if (existingPayrolls.length > 0) {
        const confirmMessage = `${existingPayrolls.length} payrolls already exist for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}. 
        
Do you want to:
1. Regenerate all payrolls (overwrite existing)?
2. Skip employees who already have payrolls?
3. Cancel?`;
        
        const choice = window.confirm(confirmMessage) ? 
          (window.confirm('Regenerate all payrolls? This will overwrite existing ones.') ? 'regenerate' : 'skip') : 
          'cancel';
        
        if (choice === 'cancel') {
          setBulkCreateLoading(false);
          return;
        }
        
        forceRegenerate = (choice === 'regenerate');
      } else {
        // No existing payrolls, create for all active employees
        const confirmMessage = `Create payrolls for all active employees for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}?`;
        if (!window.confirm(confirmMessage)) {
          setBulkCreateLoading(false);
          return;
        }
      }

      // Use the new bulk generation API endpoint
      const response = await api.post('/payroll', {
        month: month,
        year: year,
        forceRegenerate: forceRegenerate
      });
      
      setBulkCreateDialogOpen(false);
      setBulkCreateForm({
        month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
        year: new Date().getFullYear()
      });
      
      // Refresh data
      fetchPayrolls();
      fetchStats();
      
      setError(null);
      
      // Show success message
      if (response.data.success) {
        const summary = response.data.data.summary;
        const skippedCount = response.data.data.skippedEmployees ? response.data.data.skippedEmployees.length : 0;
        
        let message = `✅ Successfully generated ${summary.totalEmployees} payrolls for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}!\n\n`;
        message += `📊 Summary:\n`;
        message += `• Total Employees: ${summary.totalEmployees}\n`;
        message += `• Total Gross Salary: Rs. ${summary.totalGrossSalary.toLocaleString()}\n`;
        message += `• Total Net Salary: Rs. ${summary.totalNetSalary.toLocaleString()}\n`;
        message += `• Total Tax: Rs. ${summary.totalTax.toLocaleString()}\n`;
        
        if (skippedCount > 0) {
          message += `\n⏭️  Skipped: ${skippedCount} employees (already had payrolls)`;
        }
        
        if (response.data.data.errors && response.data.data.errors.length > 0) {
          message += `\n⚠️  Errors: ${response.data.data.errors.length} (see console for details)`;
        }
        
        alert(message);
      } else {
        alert('Payroll generation completed but with some issues. Please check the console for details.');
      }
    } catch (error) {
      console.error('Error creating bulk payrolls:', error);
      setError(`Failed to create bulk payrolls: ${error.message}`);
    } finally {
      setBulkCreateLoading(false);
    }
  };

  const toggleMonthExpansion = (monthKey) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
        // Reset pagination to first page when expanding
        setEmployeeDetailsPage(prev => ({
          ...prev,
          [monthKey]: 0
        }));
      }
      return newSet;
    });
  };

  const toggleGeneralPayrollExpansion = () => {
    setGeneralPayrollExpanded(prev => !prev);
    // Reset pagination when expanding
    if (!generalPayrollExpanded) {
      setGeneralPayrollPage(0);
    }
  };

  const getMonthStatusColor = (statuses) => {
    if (statuses.has('Paid')) return 'success';
    if (statuses.has('Approved')) return 'warning';
    if (statuses.has('Draft')) return 'default';
    return 'default';
  };

  const getMonthStatusLabel = (statuses) => {
    if (statuses.has('Paid')) return 'All Paid';
    if (statuses.has('Approved')) return 'Partially Approved';
    if (statuses.has('Draft')) return 'Draft';
    return 'Mixed';
  };



  const handleMonthlyTaxUpdate = async () => {
    try {
      setMonthlyTaxUpdateLoading(true);
      setError(null);
      
      const confirmMessage = 'This will update taxes for all payrolls in the current month using the latest FBR 2025-2026 tax slabs. This action cannot be undone. Continue?';
      if (!window.confirm(confirmMessage)) {
        return;
      }
      
      // Get current month and year
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      console.log(`🔄 Updating monthly taxes for ${currentMonth}/${currentYear}...`);
      
      // Call the monthly tax update API
      const response = await api.post('/payroll/current-month-tax-update');
      
      if (response.data.success) {
        const result = response.data.data;
        
        console.log('✅ Monthly tax update completed:', result);
        
        // Show success message
        alert(`Successfully updated taxes for ${result.totalCount} payrolls!\n\nUpdated: ${result.updatedCount}\nAlready Updated: ${result.totalCount - result.updatedCount}\nFailed: ${result.errorCount}`);
        
        // Refresh data
        await fetchPayrolls();
        await fetchStats();
        
        setError(null);
      } else {
        setError('Failed to update monthly taxes');
      }
      
    } catch (error) {
      console.error('Error updating monthly taxes:', error);
      setError(`Failed to update monthly taxes: ${error.message}`);
    } finally {
      setMonthlyTaxUpdateLoading(false);
    }
  };

  const handleRecalculateExistingPayrolls = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all existing payrolls
      const payrollsToRecalculate = payrolls.filter(p => p.status !== 'Deleted');
      
      if (payrollsToRecalculate.length === 0) {
        setError('No payrolls found to recalculate.');
        return;
      }
      
      const confirmMessage = `This will recalculate ${payrollsToRecalculate.length} existing payroll(s) to exclude Provident Fund from total deductions and net salary. This action cannot be undone. Continue?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
      
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const payroll of payrollsToRecalculate) {
        try {
          // Recalculate total deductions excluding Provident Fund
          const recalculatedTotalDeductions = (payroll.incomeTax || 0) + 
                                            (payroll.healthInsurance || 0) + 
                                            (payroll.vehicleLoanDeduction || 0) +
                                            (payroll.companyLoanDeduction || 0) +
                                            (payroll.eobi || 370) + 
                                            (payroll.otherDeductions || 0);
          
          // Recalculate net salary
          const recalculatedNetSalary = (payroll.grossSalary || 0) - recalculatedTotalDeductions;
          
          // Update payroll with recalculated values
          await api.put(`/payroll/${payroll._id}`, {
            totalDeductions: recalculatedTotalDeductions,
            netSalary: recalculatedNetSalary
          });
          
          updatedCount++;
        } catch (error) {
          console.error(`Error updating payroll ${payroll._id}:`, error);
          errorCount++;
        }
      }
      
      // Refresh data
      fetchPayrolls();
      fetchStats();
      
      setError(null);
      
      // Show success message
      if (errorCount === 0) {
        alert(`Successfully recalculated ${updatedCount} payroll(s)! Provident Fund is now excluded from total deductions and net salary.`);
      } else {
        alert(`Recalculated ${updatedCount} payroll(s) with ${errorCount} errors. Please check the console for details.`);
      }
    } catch (error) {
      console.error('Error recalculating payrolls:', error);
      setError(`Failed to recalculate payrolls: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && payrolls.length === 0) {
    return (
      <PageLoading 
        message="Loading payrolls..." 
        showSkeleton={true}
        skeletonType="table"
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Payroll Management
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setFilterDialogOpen(true)}
            sx={{ mr: 2 }}
          >
            Filters
          </Button>
          <Button
            variant="outlined"
            startIcon={<GroupWorkIcon />}
            onClick={() => setBulkCreateDialogOpen(true)}
            sx={{ mr: 2 }}
            color="secondary"
          >
            Bulk Create Payroll
          </Button>
          
          {/* <Button
            variant="outlined"
            startIcon={<TrendingUpIcon />}
            onClick={handleMonthlyTaxUpdate}
            sx={{ mr: 2 }}
            color="warning"
            disabled={monthlyTaxUpdateLoading}
          >
            {monthlyTaxUpdateLoading ? 'Updating Taxes...' : 'Update Monthly Taxes'}
          </Button> */}

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/hr/payroll/add')}
          >
            Create Payroll
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AccountBalanceIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Payrolls
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalPayrolls || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Gross Pay
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(stats.totalGrossSalary)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ReceiptIcon sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Net Pay
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(stats.totalNetSalary)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PeopleIcon sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Avg Net Pay
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(stats.averageNetSalary)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filter Summary */}
      {Object.values(filters).some(value => value !== '' && value !== null) && (
        <Box sx={{ 
          mb: 3, 
          p: 2, 
          bgcolor: 'primary.50', 
          borderRadius: 2, 
          border: '1px solid',
          borderColor: 'primary.200'
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 600 }}>
              🔍 Filtered Results
            </Typography>
            <Button 
              onClick={clearFilters} 
              size="small" 
              variant="outlined" 
              color="primary"
              startIcon={<ClearIcon />}
            >
              Clear Filters
            </Button>
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Showing {monthlyPayrolls.length} month(s) with filtered payroll data
          </Typography>
        </Box>
      )}

      {/* Quick Search Bar */}
      <Box sx={{ 
        mb: 3, 
        p: 3, 
        bgcolor: 'background.paper', 
        borderRadius: 3, 
        boxShadow: 1,
        border: '1px solid',
        borderColor: 'grey.200'
      }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Quick Search Employees"
              placeholder="Search by employee name, ID, department, or position..."
              value={filters.searchQuery}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="primary" sx={{ fontSize: '1.5rem' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {filters.searchQuery && (
                      <IconButton
                        size="small"
                        onClick={() => handleFilterChange('searchQuery', '')}
                        edge="end"
                        sx={{ color: 'error.main' }}
                      >
                        <ClearIcon />
                      </IconButton>
                    )}
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontSize: '1.1rem',
                  '&:hover fieldset': {
                    borderColor: 'primary.main',
                    borderWidth: '2px',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'primary.main',
                    borderWidth: '2px',
                  },
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: { xs: 'stretch', md: 'flex-end' } }}>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={() => setFilterDialogOpen(true)}
                fullWidth={false}
                sx={{ minWidth: 140 }}
              >
                Advanced Filters
              </Button>
              {filters.searchQuery && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<ClearIcon />}
                  onClick={clearFilters}
                  fullWidth={false}
                  sx={{ minWidth: 100 }}
                >
                  Clear
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>
        {filters.searchQuery && (
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            💡 Searching for: "{filters.searchQuery}" • Found {monthlyPayrolls.length} month(s) with matching results
            {currentOverview?.filteredEmployees && (
              <span> • {currentOverview.filteredEmployees.length} employee(s) in General Payroll</span>
            )}
            {monthlyPayrolls.length > rowsPerPage && (
              <span> • Use pagination below to navigate through all results</span>
            )}
          </Typography>
        )}
      </Box>

      {/* General Payroll Overview Card */}
      <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
        <CardContent>
          <Typography variant="h6" color="primary.main" sx={{ mb: 2, fontWeight: 600 }}>
            📋 General Payroll
            {filters.searchQuery && currentOverview?.isSearchActive && (
              <Chip 
                label={`🔍 ${currentOverview.filteredEmployees?.length || 0} results`}
                size="small" 
                color="primary" 
                variant="outlined"
                sx={{ ml: 2, fontSize: '0.75rem' }}
              />
            )}
          </Typography>
          
          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Pay Period</TableCell>
                    <TableCell>Employees</TableCell>
                    <TableCell>Total Basic Salary</TableCell>
                    <TableCell>Total Gross Pay</TableCell>
                    <TableCell>Total Net Pay</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow hover sx={{ bgcolor: 'background.paper' }}>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">
                          Current Payroll
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          General
                        </Typography>
                      </Box>
                    </TableCell>
                                              <TableCell>
                            <Typography variant="body2">
                              {currentOverviewLoading ? (
                                <CircularProgress size={16} />
                              ) : (
                                `${currentOverview?.isSearchActive && currentOverview?.filteredEmployees 
                                  ? currentOverview.filteredEmployees.length 
                                  : currentOverview?.totalEmployees || 0} Employees`
                              )}
                              {filters.searchQuery && currentOverview?.filteredEmployees && (
                                <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5 }}>
                                  🔍 Filtered by search
                                </Typography>
                              )}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {currentOverviewLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              formatCurrency(currentOverview?.totalBasicSalary || 0)
                            )}
                          </TableCell>
                          <TableCell>
                            {currentOverviewLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              formatCurrency(currentOverview?.totalGrossSalary || 0)
                            )}
                          </TableCell>
                          <TableCell>
                            {currentOverviewLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              formatCurrency(currentOverview?.totalNetSalary || 0)
                            )}
                          </TableCell>
                    <TableCell>
                      <Chip 
                        label="Active" 
                        size="small" 
                        color="success" 
                        variant="outlined"
                      />
                    </TableCell>
                                            <TableCell align="center">
                          <Tooltip title={generalPayrollExpanded ? "Hide Details" : "View Details"}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={toggleGeneralPayrollExpansion}
                            >
                              {generalPayrollExpanded ? <ExpandMoreIcon /> : <ViewIcon />}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
          
          {/* Expanded Employee Details for General Payroll */}
          <Collapse in={generalPayrollExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="h6" gutterBottom component="div">
                Employee Details - Current Payroll
                <Chip 
                  label="↑ Sorted by Employee ID" 
                  size="small" 
                  color="primary" 
                  variant="outlined"
                  sx={{ ml: 2, fontSize: '0.75rem', height: 24 }}
                />
              </Typography>
              
              {/* Employee Details Pagination Info */}
              {(() => {
                const paginationInfo = getPaginatedGeneralPayrollEmployees();
                return (
                  <Box sx={{ 
                    mb: 2, 
                    p: 2, 
                    bgcolor: 'grey.50', 
                    borderRadius: 2, 
                    border: '1px solid',
                    borderColor: 'grey.200'
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600 }}>
                          👥 Employee List
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Showing {paginationInfo.currentPage * paginationInfo.currentRowsPerPage + 1}-{Math.min((paginationInfo.currentPage + 1) * paginationInfo.currentRowsPerPage, paginationInfo.totalEmployees)} of {paginationInfo.totalEmployees} employees
                        </Typography>
                        <Typography variant="caption" color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          📊 Sorted by Employee ID (1, 2, 3...)
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="textSecondary">
                          Page {paginationInfo.currentPage + 1} of {paginationInfo.totalPages}
                        </Typography>
                        {paginationInfo.totalPages > 1 && (
                          <Chip 
                            label={`${paginationInfo.totalPages} pages`} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })()}

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Basic Salary</TableCell>
                    <TableCell>Gross Pay</TableCell>
                    <TableCell>Net Pay</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const paginationInfo = getPaginatedGeneralPayrollEmployees();
                    if (paginationInfo.paginatedEmployees.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" color="textSecondary">
                                No active employees found
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    return paginationInfo.paginatedEmployees.map((employee) => {
                      return (
                        <TableRow key={employee._id}>
                          <TableCell>
                            <Box>
                              <Typography variant="subtitle2">
                                {employee.firstName} {employee.lastName}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {employee.employeeId}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{formatCurrency(employee.basicSalary)}</TableCell>
                          <TableCell>{formatCurrency(employee.totalEarnings)}</TableCell>
                          <TableCell>{formatCurrency(employee.netSalary)}</TableCell>
                          <TableCell>
                            <Chip
                              label="Active"
                              color="success"
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="View Payroll Details">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => navigate(`/hr/payroll/view/employee/${employee._id}`)}
                              >
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>

              {/* General Payroll Employee Details Pagination Controls */}
              {(() => {
                const paginationInfo = getPaginatedGeneralPayrollEmployees();
                if (paginationInfo.totalPages <= 1) return null;
                
                return (
                  <Box sx={{ 
                    mt: 2, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="textSecondary">
                        Employees per page:
                      </Typography>
                      <FormControl size="small" sx={{ minWidth: 80 }}>
                        <Select
                          value={paginationInfo.currentRowsPerPage}
                          onChange={(e) => handleGeneralPayrollRowsPerPageChange(e.target.value)}
                          sx={{ height: 32 }}
                        >
                          <MenuItem value={5}>5</MenuItem>
                          <MenuItem value={10}>10</MenuItem>
                          <MenuItem value={25}>25</MenuItem>
                          <MenuItem value={50}>50</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Button
                        size="small"
                        onClick={() => handleGeneralPayrollPageChange(paginationInfo.currentPage - 1)}
                        disabled={paginationInfo.currentPage === 0}
                        variant="outlined"
                      >
                        Previous
                      </Button>
                      
                      <Typography variant="body2" sx={{ px: 2 }}>
                        {paginationInfo.currentPage + 1} of {paginationInfo.totalPages}
                      </Typography>
                      
                      <Button
                        size="small"
                        onClick={() => handleGeneralPayrollPageChange(paginationInfo.currentPage + 1)}
                        disabled={paginationInfo.currentPage === paginationInfo.totalPages - 1}
                        variant="outlined"
                      >
                        Next
                      </Button>
                    </Box>
                  </Box>
                );
              })()}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Monthly Payroll Summary Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        {/* Pagination Info */}
        <Box sx={{ 
          p: 2, 
          bgcolor: 'grey.50', 
          borderBottom: '1px solid',
          borderColor: 'grey.200',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Box>
            <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600 }}>
              📊 Monthly Payroll Summary
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Showing {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, totalItems)} of {totalItems} months
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="textSecondary">
              Page {page + 1} of {Math.ceil(totalItems / rowsPerPage)}
            </Typography>
            {totalItems > 0 && (
              <Chip 
                label={`${Math.ceil(totalItems / rowsPerPage)} pages`} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            )}
          </Box>
        </Box>
        
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Pay Period</TableCell>
                <TableCell>Employees</TableCell>
                <TableCell>Total Basic Salary</TableCell>
                <TableCell>Total Gross Pay</TableCell>
                <TableCell>Total Net Pay</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginationLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <CircularProgress size={24} sx={{ mb: 2 }} />
                      <Typography variant="body2" color="textSecondary">
                        Loading page {page + 1}...
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : paginatedMonthlyPayrolls.length > 0 ? (
                paginatedMonthlyPayrolls.map((monthly) => {
                  const monthKey = `${monthly.month}-${monthly.year}`;
                  const isExpanded = expandedMonths.has(monthKey);
                  
                  return (
                    <React.Fragment key={monthKey}>
                      <TableRow hover>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2">
                              {monthly.monthName} {monthly.year}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Payroll Period
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {monthly.totalEmployees} Employees
                          </Typography>
                        </TableCell>
                        <TableCell>{formatCurrency(monthly.totalBasicSalary)}</TableCell>
                        <TableCell>{formatCurrency(monthly.totalGrossSalary)}</TableCell>
                        <TableCell>{formatCurrency(monthly.totalNetSalary)}</TableCell>
                        <TableCell>
                          <Chip
                            label={getMonthStatusLabel(monthly.statuses)}
                            color={getMonthStatusColor(monthly.statuses)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <Tooltip title={isExpanded ? "Hide Details" : "View Details"}>
                              <IconButton
                                size="small"
                                onClick={() => toggleMonthExpansion(monthKey)}
                              >
                                {isExpanded ? <ExpandMoreIcon /> : <ViewIcon />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Employee Details */}
                      <TableRow>
                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ margin: 1 }}>
                              <Typography variant="h6" gutterBottom component="div">
                                Employee Details - {monthly.monthName} {monthly.year}
                                <Chip 
                                  label="↑ Sorted by Employee ID" 
                                  size="small" 
                                  color="primary" 
                                  variant="outlined"
                                  sx={{ ml: 2, fontSize: '0.75rem', height: 24 }}
                                />
                              </Typography>
                              
                              {/* Employee Details Pagination Info */}
                              {(() => {
                                const paginationInfo = getPaginatedEmployeeDetails(monthly);
                                return (
                                  <Box sx={{ 
                                    mb: 2, 
                                    p: 2, 
                                    bgcolor: 'grey.50', 
                                    borderRadius: 2, 
                                    border: '1px solid',
                                    borderColor: 'grey.200'
                                  }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                                      <Box>
                                        <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 600 }}>
                                          👥 Employee List
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                          Showing {paginationInfo.currentPage * paginationInfo.currentRowsPerPage + 1}-{Math.min((paginationInfo.currentPage + 1) * paginationInfo.currentRowsPerPage, paginationInfo.totalEmployees)} of {paginationInfo.totalEmployees} employees
                                        </Typography>
                                        <Typography variant="caption" color="primary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                          📊 Sorted by Employee ID (1, 2, 3...)
                                        </Typography>
                                      </Box>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" color="textSecondary">
                                          Page {paginationInfo.currentPage + 1} of {paginationInfo.totalPages}
                                        </Typography>
                                        {paginationInfo.totalPages > 1 && (
                                          <Chip 
                                            label={`${paginationInfo.totalPages} pages`} 
                                            size="small" 
                                            color="primary" 
                                            variant="outlined"
                                          />
                                        )}
                                      </Box>
                                    </Box>
                                  </Box>
                                );
                              })()}
                              
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Employee</TableCell>
                                    <TableCell>Basic Salary</TableCell>
                                    <TableCell>Gross Pay</TableCell>
                                    <TableCell>Net Pay</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(() => {
                                    const paginationInfo = getPaginatedEmployeeDetails(monthly);
                                    if (paginationInfo.paginatedEmployees.length === 0) {
                                      return (
                                        <TableRow>
                                          <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                            <Box sx={{ textAlign: 'center' }}>
                                              <Typography variant="body2" color="textSecondary">
                                                No employees found for this month
                                              </Typography>
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    }
                                    
                                    return paginationInfo.paginatedEmployees.map((payroll) => (
                                      <TableRow key={payroll._id}>
                                        <TableCell>
                                          <Box>
                                            <Typography variant="subtitle2">
                                              {payroll.employee?.firstName} {payroll.employee?.lastName}
                                            </Typography>
                                            <Typography variant="caption" color="textSecondary">
                                              {formatEmployeeId(payroll.employee?.employeeId)}
                                            </Typography>
                                          </Box>
                                        </TableCell>
                                        <TableCell>{formatCurrency(payroll.basicSalary)}</TableCell>
                                        <TableCell>{formatCurrency(payroll.grossSalary)}</TableCell>
                                        <TableCell>{formatCurrency(payroll.netSalary)}</TableCell>
                                        <TableCell>
                                          <Chip
                                            label={getStatusLabel(payroll.status)}
                                            color={getStatusColor(payroll.status)}
                                            size="small"
                                          />
                                        </TableCell>
                                        <TableCell align="center">
                                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                            <Tooltip title="View Details">
                                              <IconButton
                                                size="small"
                                                onClick={() => navigate(`/hr/payroll/view/${payroll._id}`)}
                                              >
                                                <ViewIcon />
                                              </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit Payroll">
                                              <IconButton
                                                size="small"
                                                onClick={() => navigate(`/hr/payroll/edit/${payroll._id}`)}
                                              >
                                                <EditIcon />
                                              </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete Payroll">
                                              <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleDelete(payroll._id)}
                                              >
                                                <DeleteIcon />
                                              </IconButton>
                                            </Tooltip>
                                          </Box>
                                        </TableCell>
                                      </TableRow>
                                    ));
                                  })()}
                                </TableBody>
                              </Table>
                              
                              {/* Employee Details Pagination Controls */}
                              {(() => {
                                const paginationInfo = getPaginatedEmployeeDetails(monthly);
                                if (paginationInfo.totalPages <= 1) return null;
                                
                                return (
                                  <Box sx={{ 
                                    mt: 2, 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: 2
                                  }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                      <Typography variant="body2" color="textSecondary">
                                        Employees per page:
                                      </Typography>
                                      <FormControl size="small" sx={{ minWidth: 80 }}>
                                        <Select
                                          value={paginationInfo.currentRowsPerPage}
                                          onChange={(e) => handleEmployeeDetailsRowsPerPageChange(`${monthly.month}-${monthly.year}`, e.target.value)}
                                          sx={{ height: 32 }}
                                        >
                                          <MenuItem value={5}>5</MenuItem>
                                          <MenuItem value={10}>10</MenuItem>
                                          <MenuItem value={25}>25</MenuItem>
                                          <MenuItem value={50}>50</MenuItem>
                                        </Select>
                                      </FormControl>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Button
                                        size="small"
                                        onClick={() => handleEmployeeDetailsPageChange(`${monthly.month}-${monthly.year}`, paginationInfo.currentPage - 1)}
                                        disabled={paginationInfo.currentPage === 0}
                                        variant="outlined"
                                      >
                                        Previous
                                      </Button>
                                      
                                      <Typography variant="body2" sx={{ px: 2 }}>
                                        {paginationInfo.currentPage + 1} of {paginationInfo.totalPages}
                                      </Typography>
                                      
                                      <Button
                                        size="small"
                                        onClick={() => handleEmployeeDetailsPageChange(`${monthly.month}-${monthly.year}`, paginationInfo.currentPage + 1)}
                                        disabled={paginationInfo.currentPage === paginationInfo.totalPages - 1}
                                        variant="outlined"
                                      >
                                        Next
                                      </Button>
                                    </Box>
                                  </Box>
                                );
                              })()}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" color="textSecondary" gutterBottom>
                        {loading ? 'Loading payrolls...' : 'No payrolls found'}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {loading 
                          ? 'Please wait while we fetch your payroll data...' 
                          : filters.searchQuery || Object.values(filters).some(v => v !== '' && v !== null)
                            ? 'Try adjusting your search criteria or filters'
                            : 'Create your first payroll to get started'
                        }
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalItems}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Months per page:"
          labelDisplayedRows={({ from, to, count }) => 
            `${from}-${to} of ${count !== -1 ? count : `more than ${to}`} months`
          }
          sx={{
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'grey.200',
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontWeight: 500,
            },
            '& .MuiTablePagination-select': {
              borderRadius: 1,
            }
          }}
        />
      </Paper>

      {/* Filter Dialog */}
      <Dialog open={filterDialogOpen} onClose={() => setFilterDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ 
          bgcolor: 'primary.main', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontSize: '1.25rem',
          fontWeight: 600
        }}>
          <FilterIcon sx={{ fontSize: '1.5rem' }} />
          Advanced Payroll Filters
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={3}>
            {/* Search Query - Full Width with Enhanced Design */}
            <Grid item xs={12}>
              <Box sx={{ 
                p: 3, 
                bgcolor: 'grey.50', 
                borderRadius: 3, 
                border: '2px solid',
                borderColor: 'primary.200',
                position: 'relative',
                mt: 2  // Add margin top to move it down
              }}>
                <Typography variant="h6" color="primary.main" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                  🔍 Quick Search
                </Typography>
                <TextField
                  fullWidth
                  label="Search by Employee Name or ID"
                  placeholder="Type employee name, last name, or employee ID..."
                  value={filters.searchQuery}
                  onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="primary" sx={{ fontSize: '1.5rem' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        {filters.searchQuery && (
                          <IconButton
                            size="medium"
                            onClick={() => handleFilterChange('searchQuery', '')}
                            edge="end"
                            sx={{ 
                              color: 'error.main',
                              '&:hover': { bgcolor: 'error.50' }
                            }}
                          >
                            <ClearIcon />
                          </IconButton>
                        )}
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      fontSize: '1.1rem',
                      '&:hover fieldset': {
                        borderColor: 'primary.main',
                        borderWidth: '2px',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'primary.main',
                        borderWidth: '2px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      fontSize: '1rem',
                      fontWeight: 500,
                    },
                    '& .MuiInputBase-input': {
                      fontSize: '1rem',
                    }
                  }}
                />
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  💡 Tip: You can search by first name, last name, or employee ID
                </Typography>
              </Box>
            </Grid>

            {/* Filter Section Header */}
            <Grid item xs={12}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1, 
                mb: 2,
                p: 2,
                bgcolor: 'secondary.50',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'secondary.200',
                mt: 3  // Add margin top to create more space
              }}>
                <FilterIcon color="secondary" />
                <Typography variant="h6" color="secondary.main" sx={{ fontWeight: 600 }}>
                  Advanced Filters
                </Typography>
              </Box>
            </Grid>

            {/* Status and Employee - Row 1 */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Payroll Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Payroll Status"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    }
                  }}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="Draft">Draft</MenuItem>
                  <MenuItem value="Approved">Approved</MenuItem>
                  <MenuItem value="Paid">Paid</MenuItem>
                  <MenuItem value="Cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Specific Employee</InputLabel>
                <Select
                  value={filters.employeeId}
                  onChange={(e) => handleFilterChange('employeeId', e.target.value)}
                  label="Specific Employee"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    }
                  }}
                >
                  <MenuItem value="">All Employees</MenuItem>
                  {employees.map(employee => (
                    <MenuItem key={employee._id} value={employee._id}>
                      {employee.firstName} {employee.lastName} ({formatEmployeeId(employee.employeeId)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Department and Position - Row 2 */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  label="Department"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    }
                  }}
                >
                  <MenuItem value="">All Departments</MenuItem>
                  {departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Position</InputLabel>
                <Select
                  value={filters.position}
                  onChange={(e) => handleFilterChange('position', e.target.value)}
                  label="Position"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    }
                  }}
                >
                  <MenuItem value="">All Positions</MenuItem>
                  {positions.map((pos) => (
                    <MenuItem key={pos._id} value={pos._id}>
                      {pos.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Date Range - Row 3 */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Start Date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="End Date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  }
                }}
              />
            </Grid>

            {/* Active Filters Display */}
            {Object.values(filters).some(value => value !== '' && value !== null) && (
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 2, 
                  border: '1px solid',
                  borderColor: 'grey.300'
                }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Active Filters:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {filters.status && (
                      <Chip 
                        label={`Status: ${filters.status}`} 
                        size="small" 
                        onDelete={() => handleFilterChange('status', '')}
                        color="primary"
                        variant="outlined"
                      />
                    )}
                    {filters.employeeId && (
                      <Chip 
                        label={`Employee: ${employees.find(e => e._id === filters.employeeId)?.firstName} ${employees.find(e => e._id === filters.employeeId)?.lastName}`} 
                        size="small" 
                        onDelete={() => handleFilterChange('employeeId', '')}
                        color="secondary"
                        variant="outlined"
                      />
                    )}
                    {filters.department && (
                      <Chip 
                        label={`Department: ${departments.find(d => d._id === filters.department)?.name}`} 
                        size="small" 
                        onDelete={() => handleFilterChange('department', '')}
                        color="info"
                        variant="outlined"
                      />
                    )}
                    {filters.position && (
                      <Chip 
                        label={`Position: ${positions.find(p => p._id === filters.position)?.name}`} 
                        size="small" 
                        onDelete={() => handleFilterChange('position', '')}
                        color="warning"
                        variant="outlined"
                      />
                    )}
                    {filters.searchQuery && (
                      <Chip 
                        label={`Search: "${filters.searchQuery}"`} 
                        size="small" 
                        onDelete={() => handleFilterChange('searchQuery', '')}
                        color="success"
                        variant="outlined"
                      />
                    )}
                    {filters.startDate && filters.endDate && (
                      <Chip 
                        label={`Date: ${filters.startDate} to ${filters.endDate}`} 
                        size="small" 
                        onDelete={() => { handleFilterChange('startDate', ''); handleFilterChange('endDate', ''); }}
                        color="default"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button 
            onClick={clearFilters} 
            startIcon={<ClearIcon />}
            variant="outlined"
            color="error"
            size="large"
          >
            Clear All Filters
          </Button>
          <Button 
            onClick={() => setFilterDialogOpen(false)} 
            variant="contained"
            startIcon={<FilterIcon />}
            size="large"
          >
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Create Payroll Dialog */}
      <Dialog open={bulkCreateDialogOpen} onClose={() => setBulkCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Create Payroll for All Employees</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  value={bulkCreateForm.month}
                  onChange={(e) => setBulkCreateForm(prev => ({ ...prev, month: e.target.value }))}
                  label="Month"
                >
                  {months.map((month) => (
                    <MenuItem key={month.value} value={month.value}>
                      {month.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Year"
                value={bulkCreateForm.year}
                onChange={(e) => setBulkCreateForm(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                inputProps={{ min: 2020, max: 2030 }}
              />
            </Grid>
            
            {/* Employee Count Information */}
            <Grid item xs={12}>
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Employee Information
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Employees: <strong>{employees.length}</strong>
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Active Employees: <strong>{employees.filter(emp => emp.employmentStatus === 'Active').length}</strong>
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Selected Period: <strong>{months.find(m => m.value === bulkCreateForm.month)?.label} {bulkCreateForm.year}</strong>
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Alert severity="info">
                This will create payroll records for <strong>ALL {employees.filter(emp => emp.employmentStatus === 'Active').length} active employees</strong> for {months.find(m => m.value === bulkCreateForm.month)?.label} {bulkCreateForm.year}. 
                Each employee will have a draft payroll with their basic salary and default values.
              </Alert>
            </Grid>
            
            {/* Warning about existing payrolls */}
            {(() => {
              const existingCount = payrolls.filter(
                p => p.month === parseInt(bulkCreateForm.month) && p.year === bulkCreateForm.year
              ).length;
              if (existingCount > 0) {
                const activeEmployeesCount = employees.filter(emp => emp.employmentStatus === 'Active').length;
                const remainingCount = activeEmployeesCount - existingCount;
                
                return (
                  <Grid item xs={12}>
                    <Alert severity="warning">
                      <strong>Existing Payrolls Found:</strong> {existingCount} payroll records already exist for {months.find(m => m.value === bulkCreateForm.month)?.label} {bulkCreateForm.year}. 
                      {remainingCount > 0 ? ` Only ${remainingCount} employees still need payrolls created.` : ' All active employees already have payrolls for this month.'}
                    </Alert>
                  </Grid>
                );
              }
              return null;
            })()}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleBulkCreate} 
            variant="contained" 
            disabled={bulkCreateLoading}
            startIcon={bulkCreateLoading ? <CircularProgress size={20} /> : <GroupWorkIcon />}
          >
            {bulkCreateLoading ? `Creating... (${employees.filter(emp => emp.employmentStatus === 'Active').length} employees)` : `Create All Payrolls (${employees.filter(emp => emp.employmentStatus === 'Active').length} employees)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => navigate('/hr/payroll/add')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default Payroll; 