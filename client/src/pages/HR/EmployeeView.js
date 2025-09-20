import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Divider,
  Paper,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Work as WorkIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  Assignment as AssignmentIcon,
  Phone as EmergencyIcon,
  AttachMoney as SalaryIcon,
  Update as UpdateIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { formatPKR } from '../../utils/currency';
import api from '../../services/api';
import { useData } from '../../contexts/DataContext';
import ArrearsDialog from '../../components/ArrearsDialog';

const EmployeeView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchEmployees } = useData();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [updatingPayrolls, setUpdatingPayrolls] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusDialog, setStatusDialog] = useState({ open: false, newStatus: null });
  const [arrearsDialog, setArrearsDialog] = useState({ open: false });

  const fetchEmployee = async () => {
    if (!id) return;
    
    // Validate ID format before making request
    if (id && !/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error('❌ Invalid employee ID format:', id);
      setSnackbar({
        open: true,
        message: `Invalid employee ID format: ${id}. Please check the URL.`,
        severity: 'error'
      });
      return;
    }
    
    try {
      setLoading(true);
      
      // Fetch employee data and arrears data in parallel
      const [employeeResponse, arrearsResponse, statsResponse] = await Promise.all([
        api.get(`/hr/employees/${id}`),
        api.get(`/hr/arrears/${id}`),
        api.get(`/hr/arrears/stats/${id}`)
      ]);
      
      const employeeData = employeeResponse.data.data;
      const arrearsData = arrearsResponse.data.data || [];
      const statsData = statsResponse.data.data || {};
      
      // Process arrears data for display
      employeeData.arrearsMonths = arrearsData.map(arrear => ({
        _id: arrear._id,
        monthName: arrear.monthName,
        year: arrear.year,
        month: arrear.month,
        amount: arrear.amount,
        status: arrear.status,
        description: arrear.description,
        type: arrear.type,
        createdDate: arrear.createdDate,
        updatedDate: arrear.updatedDate
      }));
      
      // Set arrears statistics
      employeeData.totalArrears = statsData.totalArrears || 0;
      employeeData.arrearsPaid = statsData.totalPaid || 0;
      employeeData.arrearsPending = statsData.totalPending || 0;
      employeeData.arrearsOverdue = statsData.overdueMonths || 0;
      employeeData.monthsWithArrears = statsData.monthsWithArrears || 0;
      
      // Calculate current month arrears (most recent month)
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const currentMonthArrear = arrearsData.find(a => 
        a.month === currentMonth && a.year === currentYear && a.status !== 'Paid'
      );
      employeeData.currentMonthArrears = currentMonthArrear ? currentMonthArrear.amount : 0;
      
      // Set overall arrears status
      if (statsData.totalOverdue > 0) {
        employeeData.arrearsStatus = 'Overdue';
      } else if (statsData.totalPending > 0) {
        employeeData.arrearsStatus = 'Pending';
      } else if (statsData.totalPaid > 0 && statsData.totalPending === 0) {
        employeeData.arrearsStatus = 'Paid';
      } else {
        employeeData.arrearsStatus = 'None';
      }
      
      setEmployee(employeeData);
    } catch (error) {
      console.error('Error fetching employee:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching employee details',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (isActive) => {
    return isActive ? 'success' : 'error';
  };

  const getStatusText = (isActive) => {
    return isActive ? 'Active' : 'Inactive';
  };

  const safeRenderText = (value) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (value && typeof value === 'object') {
      // Handle populated objects
      if (value.name) return value.name;
      if (value.title) return value.title;
      if (value.code) return value.code;
      // Handle arrays or other object types
      if (Array.isArray(value)) return value.join(', ');
      // If it's an object but no recognizable properties, return a fallback
      return 'N/A';
    }
    return 'N/A';
  };


  const handleToggleStatus = () => {
    const newStatus = !employee.isActive;
    setStatusDialog({ open: true, newStatus });
  };

  const handleConfirmStatusChange = async () => {
    try {
      setUpdatingStatus(true);
      const response = await api.put(`/hr/employees/${id}`, {
        isActive: statusDialog.newStatus
      });
      
      setEmployee(response.data.data);
      setSnackbar({
        open: true,
        message: `Employee ${statusDialog.newStatus ? 'activated' : 'deactivated'} successfully`,
        severity: 'success'
      });
      // Refresh the employee data immediately
      await fetchEmployees(true);
    } catch (error) {
      console.error('Error updating employee status:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update employee status',
        severity: 'error'
      });
    } finally {
      setUpdatingStatus(false);
      setStatusDialog({ open: false, newStatus: null });
    }
  };

  const handleCancelStatusChange = () => {
    setStatusDialog({ open: false, newStatus: null });
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading employee details...</Typography>
      </Box>
    );
  }

  if (!employee) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error">Employee not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/hr/employees')}
          >
            Back to List
          </Button>
          <Typography variant="h4">Employee Details</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={employee?.isActive || false}
                  onChange={handleToggleStatus}
                  disabled={updatingStatus}
                  color="primary"
                  size="medium"
                />
              }
              label={
                <Typography variant="body2" fontWeight="medium" color={employee?.isActive ? 'success.main' : 'error.main'}>
                  {updatingStatus ? 'Updating...' : (employee?.isActive ? 'Active' : 'Inactive')}
                </Typography>
              }
              sx={{ margin: 0 }}
            />
          </Box>
          {/* <Button
            variant="outlined"
            startIcon={<UpdateIcon />}
            onClick={handleUpdatePayrolls}
            disabled={updatingPayrolls}
          >
            {updatingPayrolls ? 'Updating...' : 'Update Payrolls'}
          </Button> */}
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/hr/employees/${id}/edit`)}
          >
            Edit Employee
          </Button>
        </Box>
      </Box>

      {/* Employee Header Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item>
              <Avatar 
                src={employee.profileImage}
                sx={{ width: 100, height: 100, fontSize: '2rem' }}
              >
                {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
              </Avatar>
            </Grid>
            <Grid item xs>
              <Typography variant="h5" gutterBottom>
                {employee.firstName} {employee.lastName}
              </Typography>
              <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Employee ID: {employee.employeeId}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  label={getStatusText(employee.isActive)}
                  color={getStatusColor(employee.isActive)}
                  size="small"
                />
                <Typography variant="body2" color="textSecondary">
                  {safeRenderText(employee.department)} • {safeRenderText(employee.placementDesignation)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <Grid container spacing={3}>
        {/* Personal Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon />
                Personal Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Email</Typography>
                  <Typography variant="body1">{employee.email}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Phone</Typography>
                  <Typography variant="body1">{employee.phone}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Date of Birth</Typography>
                  <Typography variant="body1">{formatDate(employee.dateOfBirth)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Gender</Typography>
                  <Typography variant="body1">{employee.gender}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">ID Card</Typography>
                  <Typography variant="body1">{employee.idCard}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Nationality</Typography>
                  <Typography variant="body1">{employee.nationality}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Religion</Typography>
                  <Typography variant="body1">{employee.religion}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Marital Status</Typography>
                  <Typography variant="body1">{employee.maritalStatus}</Typography>
                </Grid>
                {employee.maritalStatus === 'Married' && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Spouse Name</Typography>
                    <Typography variant="body1">{employee.spouseName}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Employment Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WorkIcon />
                Employment Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Department</Typography>
                  <Typography variant="body1">{safeRenderText(employee.department)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Designation</Typography>
                  <Typography variant="body1">{safeRenderText(employee.placementDesignation)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Qualification</Typography>
                  <Typography variant="body1">{employee.qualification}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Bank Name</Typography>
                  <Typography variant="body1">{safeRenderText(employee.bankName)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Bank Account Number</Typography>
                  <Typography variant="body1">{safeRenderText(employee.accountNumber)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Hire Date</Typography>
                  <Typography variant="body1">{formatDate(employee.hireDate)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Appointment Date</Typography>
                  <Typography variant="body1">{formatDate(employee.appointmentDate)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Probation Period</Typography>
                  <Typography variant="body1">{employee.probationPeriodMonths} months</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">End of Probation</Typography>
                  <Typography variant="body1">{formatDate(employee.endOfProbationDate)}</Typography>
                </Grid>
                {employee.confirmationDate && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Confirmation Date</Typography>
                    <Typography variant="body1">{formatDate(employee.confirmationDate)}</Typography>
                  </Grid>
                )}
                {employee.foreignBankAccount && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Foreign Bank Account</Typography>
                    <Typography variant="body1">{employee.foreignBankAccount}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Placement Information */}
        {(employee.placementCompany || employee.placementProject || employee.placementSection || employee.placementLocation) && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentIcon />
                  Placement Information
                </Typography>
                <Grid container spacing={2}>
                  {employee.placementCompany && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Company</Typography>
                      <Typography variant="body1">{safeRenderText(employee.placementCompany)}</Typography>
                    </Grid>
                  )}
                   {employee.placementCompany && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Sector</Typography>
                      <Typography variant="body1">{safeRenderText(employee.placementSector)}</Typography>
                    </Grid>
                  )}
                  {employee.placementProject && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Project</Typography>
                      <Typography variant="body1">{safeRenderText(employee.placementProject)}</Typography>
                    </Grid>
                  )}
                  {employee.placementProject && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Department</Typography>
                      <Typography variant="body1">{safeRenderText(employee.placementDepartment)}</Typography>
                    </Grid>
                  )}
                  {employee.placementSection && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Section</Typography>
                      <Typography variant="body1">{safeRenderText(employee.placementSection)}</Typography>
                    </Grid>
                  )}
                  {employee.placementSection && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Designation/Position</Typography>
                      <Typography variant="body1">{safeRenderText(employee.placementDesignation)}</Typography>
                    </Grid>
                  )}
                  {employee.oldDesignation && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Old Designation</Typography>
                      <Typography variant="body1">{safeRenderText(employee.oldDesignation)}</Typography>
                    </Grid>
                  )}
                  {employee.placementLocation && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Location</Typography>
                      <Typography variant="body1">{safeRenderText(employee.placementLocation)}</Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Address Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationIcon />
                Address Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary">Street Address</Typography>
                  <Typography variant="body1">{employee.address?.street}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">City</Typography>
                  <Typography variant="body1">{safeRenderText(employee.address?.city)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">State/Province</Typography>
                  <Typography variant="body1">{safeRenderText(employee.address?.state)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Country</Typography>
                  <Typography variant="body1">{safeRenderText(employee.address?.country)}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Emergency Contact */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmergencyIcon />
                Emergency Contact
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Name</Typography>
                  <Typography variant="body1">{employee.emergencyContact?.name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Relationship</Typography>
                  <Typography variant="body1">{employee.emergencyContact?.relationship}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">Phone</Typography>
                  <Typography variant="body1">{employee.emergencyContact?.phone}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Salary Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SalaryIcon />
                Salary Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Gross Salary: {formatPKR(employee.salary?.gross || 0)}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Basic (66.66%): {formatPKR(employee.salary?.basic || Math.round((employee.salary?.gross || 0) * 0.6666))}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    House Rent (30%): {formatPKR(employee.salary?.houseRent || Math.round((employee.salary?.gross || 0) * 0.3))}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="textSecondary">
                    Medical (10%): {formatPKR(employee.salary?.medical || Math.round((employee.salary?.gross || 0) * 0.1))}
                  </Typography>
                </Grid>
              </Grid>
              <Typography variant="body2" color="textSecondary">
                Monthly compensation
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Arrears Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentIcon />
                Arrears Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6" color="warning.main" gutterBottom>
                    Total Outstanding: {formatPKR(employee.totalArrears || 0)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Current Month
                  </Typography>
                  <Typography variant="body1" color="warning.main" fontWeight="medium">
                    {formatPKR(employee.currentMonthArrears || 0)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Previous Months
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    {formatPKR((employee.totalArrears || 0) - (employee.currentMonthArrears || 0))}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Total Paid
                  </Typography>
                  <Typography variant="body1" color="success.main" fontWeight="medium">
                    {formatPKR(employee.arrearsPaid || 0)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={employee.arrearsStatus || 'None'}
                    color={
                      employee.arrearsStatus === 'Paid' ? 'success' :
                      employee.arrearsStatus === 'Pending' ? 'warning' :
                      employee.arrearsStatus === 'Overdue' ? 'error' : 'default'
                    }
                    size="small"
                  />
                </Grid>
              </Grid>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Outstanding payments and adjustments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Arrears Management Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AssignmentIcon />
            Arrears Management
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Detailed month-wise arrears tracking and management
          </Typography>
          
          {/* Arrears Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                <Typography variant="h6">{formatPKR(employee.totalArrears || 0)}</Typography>
                <Typography variant="body2">Total Outstanding</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
                <Typography variant="h6">{employee.monthsWithArrears || 0}</Typography>
                <Typography variant="body2">Months with Arrears</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
                <Typography variant="h6">{formatPKR(employee.arrearsPaid || 0)}</Typography>
                <Typography variant="body2">Total Paid</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light', color: 'error.contrastText' }}>
                <Typography variant="h6">{employee.arrearsOverdue || 0}</Typography>
                <Typography variant="body2">Overdue Months</Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Month-wise Arrears Table */}
          <Box sx={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Month/Year</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Amount</th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Description</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Created Date</th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employee.arrearsMonths && employee.arrearsMonths.length > 0 ? (
                  employee.arrearsMonths.map((arrear, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px' }}>
                        <Typography variant="body2" fontWeight="medium">
                          {arrear.monthName} {arrear.year}
                        </Typography>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Chip
                          label={arrear.type || 'Other'}
                          color="primary"
                          size="small"
                          variant="outlined"
                        />
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <Typography variant="body2" color="warning.main" fontWeight="medium">
                          {formatPKR(arrear.amount)}
                        </Typography>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <Chip
                          label={arrear.status}
                          color={
                            arrear.status === 'Paid' ? 'success' :
                            arrear.status === 'Pending' ? 'warning' :
                            arrear.status === 'Overdue' ? 'error' : 'default'
                          }
                          size="small"
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Typography variant="body2" color="textSecondary">
                          {arrear.description || 'Monthly arrears'}
                        </Typography>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Typography variant="body2" color="textSecondary">
                          {formatDate(arrear.createdDate)}
                        </Typography>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button size="small" variant="outlined" color="primary">
                            Edit
                          </Button>
                          <Button size="small" variant="outlined" color="success">
                            Mark Paid
                          </Button>
                        </Box>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ padding: '24px', textAlign: 'center' }}>
                      <Typography variant="body2" color="textSecondary">
                        No arrears records found
                      </Typography>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Box>

          {/* Add New Arrears Button */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AssignmentIcon />}
              onClick={() => setArrearsDialog({ open: true })}
            >
              Add New Arrears
            </Button>
          </Box>
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

      {/* Status Change Confirmation Dialog */}
      <Dialog
        open={statusDialog.open}
        onClose={handleCancelStatusChange}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Confirm Status Change
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {statusDialog.newStatus ? 'activate' : 'deactivate'} {' '}
            <strong>{employee?.firstName} {employee?.lastName}</strong>?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {statusDialog.newStatus 
              ? 'This will make the employee active and they will be able to access the system.'
              : 'This will deactivate the employee and they will no longer be able to access the system.'
            }
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelStatusChange} disabled={updatingStatus}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmStatusChange} 
            variant="contained" 
            color={statusDialog.newStatus ? 'success' : 'error'}
            disabled={updatingStatus}
          >
            {updatingStatus ? 'Updating...' : (statusDialog.newStatus ? 'Activate' : 'Deactivate')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Arrears Dialog */}
      <ArrearsDialog
        open={arrearsDialog.open}
        onClose={() => setArrearsDialog({ open: false })}
        employee={employee}
        onSuccess={(message) => {
          setSnackbar({
            open: true,
            message,
            severity: 'success'
          });
          // Refresh employee data
          fetchEmployee();
        }}
      />
    </Box>
  );
};

export default EmployeeView; 