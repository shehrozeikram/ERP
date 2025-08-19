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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider,
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
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const [employeeDetailsPage, setEmployeeDetailsPage] = useState({});
  const [employeeDetailsRowsPerPage, setEmployeeDetailsRowsPerPage] = useState(10);

  useEffect(() => {
    fetchPayrolls();
    fetchStats();
    fetchEmployees();
    fetchDepartments();
    fetchPositions();
  }, [page, rowsPerPage, filters]);

  // Group payrolls by month and year - fixed dependency array
  useEffect(() => {
    const filteredPayrolls = getFilteredPayrolls();
    
    if (filteredPayrolls.length > 0) {
      const grouped = filteredPayrolls.reduce((acc, payroll) => {
        const key = `${payroll.month}-${payroll.year}`;
        if (!acc[key]) {
          acc[key] = {
            month: payroll.month,
            year: payroll.year,
            monthName: months.find(m => m.value === payroll.month.toString().padStart(2, '0'))?.label || payroll.month,
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
      setPayrolls(response.data.data || []);
      setTotalItems(response.data.data?.length || 0);
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

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0); // Reset to first page when applying filters
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
  };

  const getFilteredPayrolls = () => {
    let filtered = payrolls;

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

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.employee?.firstName?.toLowerCase().includes(query) ||
        p.employee?.lastName?.toLowerCase().includes(query) ||
        p.employee?.employeeId?.toLowerCase().includes(query)
      );
    }

    // Filter by date range
    if (filters.startDate && filters.endDate) {
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      filtered = filtered.filter(p => {
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
      
      // Get all active employees - fixed to use correct field and value
      const activeEmployees = employees.filter(emp => emp.employmentStatus === 'Active');
      
      if (activeEmployees.length === 0) {
        setError('No active employees found. Please check if employees have "Active" employment status.');
        return;
      }

      // Check if payrolls already exist for this month - improved checking
      const month = parseInt(bulkCreateForm.month);
      const year = bulkCreateForm.year;
      
      const existingPayrolls = payrolls.filter(
        p => p.month === month && p.year === year
      );

      let employeesToProcess = [];

      if (existingPayrolls.length > 0) {
        // Extract employee IDs from existing payrolls - fix the comparison logic
        const existingEmployeeIds = existingPayrolls.map(p => {
          // Handle both populated and unpopulated employee references
          if (p.employee && typeof p.employee === 'object' && p.employee._id) {
            return p.employee._id.toString();
          } else if (p.employee) {
            return p.employee.toString();
          }
          return null;
        }).filter(id => id !== null);
        
        // Filter out employees who already have payrolls
        employeesToProcess = activeEmployees.filter(emp => {
          const empId = emp._id.toString();
          const hasPayroll = existingEmployeeIds.includes(empId);
          return !hasPayroll;
        });
        
        if (employeesToProcess.length === 0) {
          setError(`All active employees already have payrolls for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}. No new payrolls to create.`);
          return;
        }
        
        const confirmMessage = `${existingPayrolls.length} employees already have payrolls for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}. 
        
${employeesToProcess.length} employees still need payrolls created.

Do you want to create payrolls for the remaining ${employeesToProcess.length} employees?`;
        
        if (!window.confirm(confirmMessage)) {
          return;
        }
      } else {
        // No existing payrolls, create for all active employees
        employeesToProcess = activeEmployees;
      }

      // Show confirmation with employee count
      const confirmMessage = `Are you sure you want to create payrolls for ${employeesToProcess.length} employees for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }

      // Create payrolls for employees who don't have them
      const payrollPromises = employeesToProcess.map(async (employee) => {
        // Calculate start and end dates for the month
        const month = parseInt(bulkCreateForm.month);
        const year = bulkCreateForm.year;
        const startDate = new Date(year, month - 1, 1); // First day of month
        const endDate = new Date(year, month, 0); // Last day of month
        
        // Get employee salary structure
        const grossSalary = employee.salary.gross || 0;
        const basicSalary = Math.round(grossSalary * 0.6666); // 66.66% of gross (same as PayrollForm)
        
        // Get employee allowances (only active ones)
        const employeeAllowances = employee.allowances || {};
        const payrollAllowances = {
          conveyance: {
            isActive: employeeAllowances.conveyance?.isActive || false,
            amount: employeeAllowances.conveyance?.isActive ? employeeAllowances.conveyance.amount : 0
          },
          food: {
            isActive: employeeAllowances.food?.isActive || false,
            amount: employeeAllowances.food?.isActive ? employeeAllowances.food.amount : 0
          },
          vehicleFuel: {
            isActive: employeeAllowances.vehicleFuel?.isActive || false,
            amount: employeeAllowances.vehicleFuel?.isActive ? employeeAllowances.vehicleFuel.amount : 0
          },
          medical: {
            isActive: employeeAllowances.medical?.isActive || false,
            amount: employeeAllowances.medical?.isActive ? employeeAllowances.medical.amount : 0
          },
          special: {
            isActive: employeeAllowances.special?.isActive || false,
            amount: employeeAllowances.special?.isActive ? employeeAllowances.special.amount : 0
          },
          other: {
            isActive: employeeAllowances.other?.isActive || false,
            amount: employeeAllowances.other?.isActive ? employeeAllowances.other.amount : 0
          }
        };

        // Calculate total allowances (only active ones)
        const totalAllowances = Object.values(payrollAllowances).reduce((sum, allowance) => {
          return sum + (allowance.isActive ? allowance.amount : 0);
        }, 0);
        
        // Calculate total gross (basic + allowances)
        const totalGross = basicSalary + totalAllowances;

        // Calculate overtime (if any)
        const overtimeHours = 0; // Default to 0 for bulk create
        const overtimeRate = (basicSalary / 176); // Assuming 176 working hours per month
        const overtimeAmount = overtimeHours * overtimeRate;

        // Get loan deductions
        const vehicleLoanDeduction = employee.loans?.vehicleLoan?.monthlyInstallment || 0;
        const companyLoanDeduction = employee.loans?.companyLoan?.monthlyInstallment || 0;

        // Create payroll object
        const payrollData = {
          employee: employee._id,
          month: month,
          year: year,
          payPeriod: {
            startDate: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
            endDate: endDate.toISOString().split('T')[0], // YYYY-MM-DD format
            type: 'monthly'
          },
          basicSalary: basicSalary,
          grossSalary: totalGross, // Total gross (basic + allowances)
          allowances: payrollAllowances,
          overtime: {
            hours: overtimeHours,
            rate: overtimeRate,
            amount: overtimeAmount
          },
          bonuses: {
            performance: 0,
            other: 0
          },
          deductions: {
            pension: 0, // providentFund - Coming Soon (not included in total deductions)
            tax: 0, // incomeTax
            insurance: 0, // healthInsurance
            other: 0, // otherDeductions
            eobi: 370 // Fixed EOBI amount for Pakistan
          },
          attendance: {
            totalDays: 22,
            presentDays: 22,
            absentDays: 0
          },
          leaveDeductions: {
            totalLeaveDays: 0
          },
          currency: 'PKR',
          notes: 'Bulk created payroll'
        };

        return api.post('/payroll', payrollData);
      });

      await Promise.all(payrollPromises);
      
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
      alert(`Successfully created payrolls for ${employeesToProcess.length} employees for ${months.find(m => m.value === bulkCreateForm.month)?.label} ${bulkCreateForm.year}!`);
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

  const handleUpdatePayrollAllowances = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all payrolls that need updating
      const payrollsToUpdate = payrolls.filter(p => {
        // Check if payroll has old allowance structure or missing allowances
        return !p.allowances || 
               !p.allowances.food || 
               !p.allowances.vehicleFuel ||
               p.allowances.food?.amount === 0 ||
               p.allowances.vehicleFuel?.amount === 0;
      });
      
      if (payrollsToUpdate.length === 0) {
        setError('All payrolls already have the correct allowances structure.');
        return;
      }
      
      const confirmMessage = `This will update ${payrollsToUpdate.length} payroll(s) with current employee allowances. This action cannot be undone. Continue?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
      
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const payroll of payrollsToUpdate) {
        try {
          // Get current employee allowances
          const employeeResponse = await api.get(`/hr/employees/${payroll.employee._id || payroll.employee}`);
          const employee = employeeResponse.data.data;
          
          if (employee && employee.allowances) {
            // Update payroll allowances
            const updatedAllowances = {
              conveyance: {
                isActive: employee.allowances.conveyance?.isActive || false,
                amount: employee.allowances.conveyance?.isActive ? employee.allowances.conveyance.amount : 0
              },
              food: {
                isActive: employee.allowances.food?.isActive || false,
                amount: employee.allowances.food?.isActive ? employee.allowances.food.amount : 0
              },
              vehicleFuel: {
                isActive: employee.allowances.vehicleFuel?.isActive || false,
                amount: employee.allowances.vehicleFuel?.isActive ? employee.allowances.vehicleFuel.amount : 0
              },
              medical: {
                isActive: employee.allowances.medical?.isActive || false,
                amount: employee.allowances.medical?.isActive ? employee.allowances.medical.amount : 0
              },
              special: {
                isActive: employee.allowances.special?.isActive || false,
                amount: employee.allowances.special?.isActive ? employee.allowances.special.amount : 0
              },
              other: {
                isActive: employee.allowances.other?.isActive || false,
                amount: employee.allowances.other?.isActive ? employee.allowances.other.amount : 0
              }
            };
            
            // Update the payroll
            await api.put(`/payroll/${payroll._id}`, {
              allowances: updatedAllowances
            });
            
            updatedCount++;
          }
        } catch (updateError) {
          console.error(`Error updating payroll ${payroll._id}:`, updateError);
          errorCount++;
        }
      }
      
      // Refresh data
      await fetchPayrolls();
      await fetchStats();
      
      if (errorCount > 0) {
        setError(`Updated ${updatedCount} payroll(s) successfully. ${errorCount} payroll(s) failed to update.`);
      } else {
        setError(null);
        alert(`Successfully updated ${updatedCount} payroll(s) with current employee allowances!`);
      }
      
    } catch (error) {
      console.error('Error updating payroll allowances:', error);
      setError('Failed to update payroll allowances');
    } finally {
      setLoading(false);
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
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleUpdatePayrollAllowances}
            sx={{ mr: 2 }}
            color="info"
            disabled={loading}
          >
            Update Allowances
          </Button>
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
            {monthlyPayrolls.length > rowsPerPage && (
              <span> • Use pagination below to navigate through all results</span>
            )}
          </Typography>
        )}
      </Box>

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
                              Monthly
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