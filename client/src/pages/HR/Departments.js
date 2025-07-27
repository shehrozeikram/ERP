import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Alert,
  Snackbar,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import api from '../../services/authService';

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Validation schema
  const validationSchema = Yup.object({
    name: Yup.string().required('Department name is required'),
    code: Yup.string().required('Department code is required'),
    description: Yup.string(),
    location: Yup.string(),
    budget: Yup.number().positive('Budget must be positive')
  });

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/hr/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching departments',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees for manager selection
  const fetchEmployees = async () => {
    try {
      const response = await api.get('/hr/employees');
      const employeesData = response.data.data || [];
      console.log('Fetched employees:', employeesData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  const formik = useFormik({
    initialValues: {
      name: '',
      code: '',
      description: '',
      location: '',
      budget: '',
      manager: null,
      parentDepartment: null
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        setLoading(true);
        
        // Clean up the values to handle empty strings
        const cleanedValues = {
          ...values,
          manager: values.manager || null,
          parentDepartment: values.parentDepartment || null,
          budget: values.budget ? parseFloat(values.budget) : null
        };
        
        console.log('Submitting department data:', cleanedValues);
        
        if (isEditing) {
          await api.put(`/hr/departments/${selectedDepartment._id}`, cleanedValues);
          setSnackbar({
            open: true,
            message: 'Department updated successfully',
            severity: 'success'
          });
        } else {
          await api.post('/hr/departments', cleanedValues);
          setSnackbar({
            open: true,
            message: 'Department created successfully',
            severity: 'success'
          });
        }
        
        fetchDepartments();
        handleCloseDialog();
      } catch (error) {
        console.error('Error saving department:', error);
        setSnackbar({
          open: true,
          message: error.response?.data?.message || 'Error saving department',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    }
  });

  const handleOpenDialog = (department = null) => {
    if (department) {
      setSelectedDepartment(department);
      setIsEditing(true);
      formik.setValues({
        name: department.name || '',
        code: department.code || '',
        description: department.description || '',
        location: department.location || '',
        budget: department.budget || '',
        manager: department.manager?._id || department.manager || null,
        parentDepartment: department.parentDepartment?._id || department.parentDepartment || null
      });
    } else {
      setSelectedDepartment(null);
      setIsEditing(false);
      formik.resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedDepartment(null);
    setIsEditing(false);
    formik.resetForm();
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/hr/departments/${selectedDepartment._id}`);
      setSnackbar({
        open: true,
        message: 'Department deleted successfully',
        severity: 'success'
      });
      fetchDepartments();
      setDeleteDialogOpen(false);
      setSelectedDepartment(null);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error deleting department',
        severity: 'error'
      });
    }
  };

  const getEmployeeCount = (departmentName) => {
    return employees.filter(emp => emp.department === departmentName).length;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading departments...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Department Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Department
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Departments
              </Typography>
              <Typography variant="h4">
                {departments.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Employees
              </Typography>
              <Typography variant="h4">
                {employees.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Average Budget
              </Typography>
              <Typography variant="h4">
                ${departments.length > 0 
                  ? Math.round(departments.reduce((sum, dept) => sum + (dept.budget || 0), 0) / departments.length).toLocaleString()
                  : '0'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Departments
              </Typography>
              <Typography variant="h4">
                {departments.filter(dept => dept.isActive !== false).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Departments Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Department</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Manager</TableCell>
              <TableCell>Employees</TableCell>
              <TableCell>Budget</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {departments.map((department) => (
              <TableRow key={department._id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BusinessIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Box>
                      <Typography variant="subtitle2">
                        {department.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {department.description}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{department.code}</TableCell>
                <TableCell>{department.location}</TableCell>
                <TableCell>
                  {department.manager ? 
                    (typeof department.manager === 'object' ? 
                      `${department.manager.firstName} ${department.manager.lastName}` : 
                      department.manager
                    ) : 
                    'Not assigned'
                  }
                </TableCell>
                <TableCell>
                  <Chip 
                    label={getEmployeeCount(department.name)} 
                    color="primary" 
                    size="small" 
                  />
                </TableCell>
                <TableCell>
                  ${department.budget?.toLocaleString() || '0'}
                </TableCell>
                <TableCell>
                  <Chip
                    label={department.isActive !== false ? 'Active' : 'Inactive'}
                    color={department.isActive !== false ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(department)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      setSelectedDepartment(department);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Department Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {isEditing ? 'Edit Department' : 'Add New Department'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={formik.handleSubmit} sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="name"
                  label="Department Name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  error={formik.touched.name && Boolean(formik.errors.name)}
                  helperText={formik.touched.name && formik.errors.name}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="code"
                  label="Department Code"
                  value={formik.values.code}
                  onChange={formik.handleChange}
                  error={formik.touched.code && Boolean(formik.errors.code)}
                  helperText={formik.touched.code && formik.errors.code}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="description"
                  label="Description"
                  multiline
                  rows={3}
                  value={formik.values.description}
                  onChange={formik.handleChange}
                  error={formik.touched.description && Boolean(formik.errors.description)}
                  helperText={formik.touched.description && formik.errors.description}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="location"
                  label="Location"
                  value={formik.values.location}
                  onChange={formik.handleChange}
                  error={formik.touched.location && Boolean(formik.errors.location)}
                  helperText={formik.touched.location && formik.errors.location}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="budget"
                  label="Annual Budget"
                  type="number"
                  value={formik.values.budget}
                  onChange={formik.handleChange}
                  error={formik.touched.budget && Boolean(formik.errors.budget)}
                  helperText={formik.touched.budget && formik.errors.budget}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Department Manager</InputLabel>
                                     <Select
                     name="manager"
                     value={formik.values.manager || ''}
                     onChange={formik.handleChange}
                     label="Department Manager"
                   >
                     <MenuItem value="">No Manager</MenuItem>
                     {employees.filter(emp => emp.isActive).map((employee) => (
                       <MenuItem key={employee._id} value={employee._id}>
                         {employee.firstName} {employee.lastName} - {employee.position}
                       </MenuItem>
                     ))}
                   </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Parent Department</InputLabel>
                                     <Select
                     name="parentDepartment"
                     value={formik.values.parentDepartment || ''}
                     onChange={formik.handleChange}
                     label="Parent Department"
                   >
                     <MenuItem value="">No Parent Department</MenuItem>
                     {departments.map((dept) => (
                       <MenuItem key={dept._id} value={dept._id}>
                         {dept.name}
                       </MenuItem>
                     ))}
                   </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={formik.handleSubmit} 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the department "{selectedDepartment?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

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

export default Departments; 