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
  Paper
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

const EmployeeView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [updatingPayrolls, setUpdatingPayrolls] = useState(false);

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
      const response = await api.get(`/hr/employees/${id}`);
      setEmployee(response.data.data);
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
    if (value && typeof value === 'object' && value.name) return value.name;
    if (value && typeof value === 'object' && value.title) return value.title;
    return 'Unknown';
  };

  const handleUpdatePayrolls = async () => {
    try {
      setUpdatingPayrolls(true);
      const response = await api.post(`/hr/employees/${id}/update-payrolls`);
      setSnackbar({
        open: true,
        message: response.data.message,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error updating payrolls:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update payrolls',
        severity: 'error'
      });
    } finally {
      setUpdatingPayrolls(false);
    }
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<UpdateIcon />}
            onClick={handleUpdatePayrolls}
            disabled={updatingPayrolls}
          >
            {updatingPayrolls ? 'Updating...' : 'Update Payrolls'}
          </Button>
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
                  {safeRenderText(employee.department)} • {safeRenderText(employee.position)}
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
                  <Typography variant="body2" color="textSecondary">Position</Typography>
                  <Typography variant="body1">{safeRenderText(employee.position)}</Typography>
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
        {(employee.placementCompany || employee.placementProject || employee.placementDepartment) && (
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
                  {employee.placementProject && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Project</Typography>
                      <Typography variant="body1">{safeRenderText(employee.placementProject)}</Typography>
                    </Grid>
                  )}
                  {employee.placementDepartment && (
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
                  {employee.placementDesignation && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">Designation</Typography>
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
                    Basic (60%): {formatPKR(employee.salary?.basic || Math.round((employee.salary?.gross || 0) * 0.6))}
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
      </Grid>

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
    </Box>
  );
};

export default EmployeeView; 