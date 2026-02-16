import React, { useState, useEffect, useCallback } from 'react';
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
  TablePagination,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
  Switch,
  FormControlLabel,
  Autocomplete
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as ViewIcon,
  Block as BlockIcon,
  CheckCircle as ActivateIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  PhotoCamera as CameraIcon,
  CloudUpload as UploadIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import RoleAssignmentDialog from '../../components/Admin/RoleAssignmentDialog';

const UserManagement = () => {
  const { user, refreshUser: refreshAuthUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [selectedUser, setSelectedUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [departments, setDepartments] = useState(['HR', 'Finance', 'Procurement', 'Sales', 'CRM', 'IT', 'Operations']);

  // Fetch departments from API
  const fetchDepartments = async () => {
    try {
      const response = await api.get('/hr/departments');
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      // Fallback to hardcoded departments if API fails
      setDepartments(['HR', 'Finance', 'Procurement', 'Sales', 'CRM', 'IT', 'Operations']);
    }
  };

  const loadUsers = useCallback(async (options = {}) => {
    try {
      const pageToUse = options.page !== undefined ? options.page : page;
      const params = {
        page: pageToUse + 1,
        limit: rowsPerPage,
        search,
        department: departmentFilter,
        status: statusFilter
      };

      const response = await authService.getUsers(params);
      setUsers(response.data.data.users || []);
      setTotalUsers(response.data.data.pagination?.total ?? 0);
      if (options.page !== undefined) {
        setPage(pageToUse);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, [page, rowsPerPage, search, departmentFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [page, rowsPerPage, search, departmentFilter, statusFilter, loadUsers]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleEditUser = async (userData) => {
    try {
      const userId = selectedUser._id || selectedUser.id;
      await authService.updateUser(userId, userData);
      console.log('User updated successfully');
      setEditDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleUpdateStatus = async (userId, isActive) => {
    try {
      await authService.updateUserStatus(userId, isActive);
      console.log(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
      loadUsers();
    } catch (error) {
      console.error('Failed to update user status:', error);
    }
  };

  const handleCreateUser = async (userData) => {
    try {
      setError(null);
      console.log('Sending user data to backend:', userData);
      const response = await authService.createUser(userData);
      console.log('User created successfully:', response);
      setSuccess('User created successfully!');
      setCreateDialogOpen(false);
      setPage(0);
      await loadUsers({ page: 0 });
    } catch (error) {
      console.error('Failed to create user:', error);
      
      // Show detailed error information
      if (error.response && error.response.data) {
        console.error('Backend error details:', error.response.data);
        
        // If there are validation errors from backend, show them
        if (error.response.data.errors) {
          console.error('Backend validation errors:', error.response.data.errors);
          setError(`Validation failed: ${error.response.data.errors.map(err => err.msg).join(', ')}`);
        } else {
          setError(error.response.data.message || 'Failed to create user. Please try again.');
        }
      } else {
        setError('Failed to create user. Please try again.');
      }
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await authService.deleteUser(userId);
      console.log('User deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      const currentPage = page;
      const newTotal = Math.max(0, totalUsers - 1);
      const maxPage = Math.max(0, Math.ceil(newTotal / rowsPerPage) - 1);
      if (currentPage > maxPage) {
        setPage(maxPage);
        await loadUsers({ page: maxPage });
      } else {
        await loadUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleAssignRole = async (userId, roleId, roleIds = null) => {
    console.log('handleAssignRole called:', { userId, roleId, roleIds });
    try {
      if (!userId) {
        console.error('User ID is missing in handleAssignRole');
        setError('User ID is missing');
        return;
      }
      
      if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
        // Multiple roles assignment
        console.log('Assigning multiple roles:', roleIds);
        await api.put(`/auth/users/${userId}/roles`, { roles: roleIds });
        setSuccess('Roles assigned successfully!');
      } else if (roleId) {
        // Single role assignment (roleRef)
        console.log('Assigning single role:', roleId);
        await api.put(`/auth/users/${userId}/role-ref`, { roleRef: roleId });
        setSuccess('Role assigned successfully!');
      } else {
        console.error('No role selected');
        setError('Please select a role to assign');
        return;
      }
      setRoleDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
      
      // If the assigned user is the current logged-in user, refresh their profile
      if (userId === user?._id || userId === user?.id) {
        console.log('Refreshing current user profile after role assignment');
        await refreshAuthUser();
      }
    } catch (error) {
      console.error('Failed to assign role:', error);
      console.error('Error details:', error.response?.data);
      setError(error.response?.data?.message || error.message || 'Failed to assign role');
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (user?.role !== 'super_admin' && user?.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access denied. Admin privileges required.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Success/Error Alerts */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box>
        <Typography variant="h4">
          User Management
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Total Users: {totalUsers} | 
          Active: {users.filter(u => u.isActive).length} | 
          Inactive: {users.filter(u => !u.isActive).length}
        </Typography>
      </Box>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setCreateDialogOpen(true)}
      >
        Create New User
      </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Search Users"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Department</InputLabel>
            <Select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              label="Department"
            >
              <MenuItem value="">All Departments</MenuItem>
              {departments.map((dept) => (
                <MenuItem key={dept.name || dept} value={dept.name || dept}>
                  {dept.name || dept}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All Users</MenuItem>
              <MenuItem value="active">Active Only</MenuItem>
              <MenuItem value="inactive">Inactive Only</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Users Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Employee ID</TableCell>
                <TableCell>Department</TableCell>
                  <TableCell>Assigned Role</TableCell>
                  <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user, index) => (
                <TableRow 
                  key={user._id || `user-${index}`}
                  sx={{
                    opacity: user.isActive ? 1 : 0.6,
                    backgroundColor: user.isActive ? 'inherit' : 'rgba(0, 0, 0, 0.02)'
                  }}
                >
                  <TableCell>
                    <Typography variant="body2">
                      {user.firstName} {user.lastName}
                    </Typography>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.employeeId}</TableCell>
                  <TableCell>{user.department}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {user.roleRef && (
                        <Chip
                          label={user.roleRef.displayName || user.roleRef.name}
                          color="primary"
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {user.roles && user.roles.length > 0 && (
                        <>
                          {user.roles.map((role) => (
                            <Chip
                              key={role._id}
                              label={role.displayName || role.name}
                              color="secondary"
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </>
                      )}
                      {(!user.roleRef && (!user.roles || user.roles.length === 0)) && (
                        <Typography variant="caption" color="text.secondary">
                          No role assigned
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.isActive ? 'Active' : 'Inactive'}
                      color={user.isActive ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedUser(user);
                        setViewDialogOpen(true);
                      }}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedUser(user);
                        setEditDialogOpen(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => {
                        setSelectedUser(user);
                        setRoleDialogOpen(true);
                      }}
                      title="Assign Role"
                    >
                      <SecurityIcon />
                    </IconButton>
                                         {user.isActive ? (
                       <IconButton
                         size="small"
                         color="error"
                         onClick={() => handleUpdateStatus(user._id, false)}
                       >
                         <BlockIcon />
                       </IconButton>
                     ) : (
                       <IconButton
                         size="small"
                         color="success"
                         onClick={() => handleUpdateStatus(user._id, true)}
                       >
                         <ActivateIcon />
                       </IconButton>
                     )}
                     <IconButton
                       size="small"
                       color="error"
                       onClick={() => {
                         setSelectedUser(user);
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
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={totalUsers}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <EditUserForm
              user={selectedUser}
              onSave={handleEditUser}
              onCancel={() => setEditDialogOpen(false)}
              departments={departments}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>User Details</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <ViewUserDetails
              user={selectedUser}
              onClose={() => setViewDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <CreateUserForm
            onSave={handleCreateUser}
            onCancel={() => setCreateDialogOpen(false)}
            departments={departments}
          />
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to delete this user?
              </Typography>
              <Typography variant="h6" color="error" gutterBottom>
                {selectedUser.firstName} {selectedUser.lastName}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Email: {selectedUser.email}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Employee ID: {selectedUser.employeeId}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Role: {selectedUser.role.replace('_', ' ').toUpperCase()}
              </Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                This action cannot be undone. The user will be permanently deleted from the system.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => handleDeleteUser(selectedUser?._id || selectedUser?.id)}
            color="error"
            variant="contained"
          >
            Delete User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Assignment Dialog */}
      <RoleAssignmentDialog
        open={roleDialogOpen}
        onClose={() => setRoleDialogOpen(false)}
        user={selectedUser}
        onSave={handleAssignRole}
      />
    </Box>
  );
};

// Edit User Form Component
const EditUserForm = ({ user, onSave, onCancel, departments }) => {
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    department: user.department,
    isActive: user.isActive
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      <TextField
        fullWidth
        label="First Name"
        value={formData.firstName}
        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
        margin="normal"
        required
      />
      <TextField
        fullWidth
        label="Last Name"
        value={formData.lastName}
        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
        margin="normal"
        required
      />
      <FormControl fullWidth margin="normal">
        <InputLabel>Department</InputLabel>
        <Select
          value={formData.department}
          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          label="Department"
        >
          {departments.map((dept) => (
            <MenuItem key={dept.name || dept} value={dept.name || dept}>
              {dept.name || dept}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControlLabel
        control={
          <Switch
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          />
        }
        label="Active"
        sx={{ mt: 2 }}
      />
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="contained">Save Changes</Button>
      </DialogActions>
    </Box>
  );
};

// View User Details Component
const ViewUserDetails = ({ user, onClose }) => {
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="h6" gutterBottom>
        {user.firstName} {user.lastName}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Email: {user.email}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Employee ID: {user.employeeId}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Department: {user.department}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Position: {user.position}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Status: {user.isActive ? 'Active' : 'Inactive'}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Last Login: {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
      </Typography>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Box>
  );
};

// Create User Form Component
const CreateUserForm = ({ onSave, onCancel, departments }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    department: '',
    position: '',
    employeeId: '',
    phone: '',
    profileImage: '',
    employee: null // Store selected employee ID
  });

  const [errors, setErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeSearchValue, setEmployeeSearchValue] = useState('');

  // Fetch employees without user accounts
  useEffect(() => {
    const fetchEmployeesWithoutUsers = async () => {
      try {
        setLoadingEmployees(true);
        const response = await api.get('/hr/employees?getAll=true&withoutUser=true');
        const allEmployees = response.data.data || [];
        setEmployees(Array.isArray(allEmployees) ? allEmployees : []);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployeesWithoutUsers();
  }, []);

  // Handle employee selection
  const handleEmployeeSelect = (employee) => {
    if (employee) {
      setSelectedEmployeeId(employee._id);
      
      // Get department name from placementDepartment (populated by API)
      const departmentName = employee.placementDepartment?.name || 
                            (typeof employee.placementDepartment === 'string' ? employee.placementDepartment : '') ||
                            employee._departmentName || '';
      
      // Get position name from placementDesignation (populated by API)
      const positionName = employee.placementDesignation?.title || 
                          employee.placementDesignation?.name ||
                          (typeof employee.placementDesignation === 'string' ? employee.placementDesignation : '') ||
                          employee._positionName || '';
      
      // Clean and validate phone number
      let phoneNumber = '';
      if (employee.phone) {
        // Remove spaces, dashes, parentheses, and other non-digit characters except +
        const cleaned = employee.phone.toString().replace(/[\s\-\(\)\.]/g, '');
        // Check if it matches the validation pattern: optional +, then 1-9, then 0-15 digits
        if (/^[\+]?[1-9][\d]{0,15}$/.test(cleaned)) {
          phoneNumber = cleaned;
        } else {
          // If it doesn't match, try to fix common formats
          // Remove leading zeros and ensure it starts with 1-9
          const fixed = cleaned.replace(/^\+?0+/, '').replace(/^\+/, '');
          if (/^[1-9][\d]{0,15}$/.test(fixed)) {
            phoneNumber = fixed;
          }
          // If still invalid, leave empty (phone is optional)
        }
      }
      
      console.log('Setting form data from employee:', {
        employeeId: employee.employeeId,
        placementDepartment: employee.placementDepartment,
        placementDesignation: employee.placementDesignation,
        departmentName,
        positionName,
        originalPhone: employee.phone,
        cleanedPhone: phoneNumber
      });
      
      setFormData({
        ...formData,
        firstName: employee.firstName || '',
        lastName: employee.lastName || '',
        employeeId: employee.employeeId || '',
        phone: phoneNumber,
        department: departmentName,
        position: positionName,
        employee: employee._id,
        profileImage: employee.profileImage || ''
      });
    } else {
      // Reset form when no employee is selected
      setSelectedEmployeeId('');
      setFormData({
        ...formData,
        firstName: '',
        lastName: '',
        employeeId: '',
        phone: '',
        department: '',
        position: '',
        employee: null,
        profileImage: ''
      });
    }
  };

  // Filter employees based on search (fuzzy search)
  const filteredEmployees = employees.filter(employee => {
    if (!employeeSearchValue) return true;
    
    const searchTerm = employeeSearchValue.toLowerCase();
    const employeeId = (employee.employeeId || '').toLowerCase();
    const firstName = (employee.firstName || '').toLowerCase();
    const lastName = (employee.lastName || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();
    const idCard = (employee.idCard || '').toLowerCase();
    const email = (employee.email || '').toLowerCase();
    const phone = (employee.phone || '').toLowerCase();
    const department = (employee.department?.name || employee.department || '').toLowerCase();
    
    return (
      employeeId.includes(searchTerm) ||
      firstName.includes(searchTerm) ||
      lastName.includes(searchTerm) ||
      fullName.includes(searchTerm) ||
      idCard.includes(searchTerm) ||
      email.includes(searchTerm) ||
      phone.includes(searchTerm) ||
      department.includes(searchTerm)
    );
  });

  // Handle image upload
  const handleImageUpload = async (file) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('profileImage', file);

      const response = await api.post('/hr/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setFormData(prevFormData => ({ 
          ...prevFormData, 
          profileImage: response.data.data.imagePath 
        }));
        setImagePreview(URL.createObjectURL(file));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  };

  // Handle file input change
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      handleImageUpload(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Employee selection is required
    if (!selectedEmployeeId) {
      newErrors.employee = 'Please select an employee';
    }
    
    // Email and password are always required
    if (!formData.email || formData.email.trim() === '') {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password || formData.password.trim() === '') {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    // Check if department and position are set (they should be auto-filled from employee)
    if (!formData.department || formData.department.trim() === '') {
      newErrors.department = 'Department is required. Please select an employee with a department assigned.';
    }
    
    if (!formData.position || formData.position.trim() === '') {
      newErrors.position = 'Position is required. Please select an employee with a position assigned.';
    }

    console.log('Form data during validation:', {
      department: formData.department,
      position: formData.position,
      employeeId: formData.employeeId
    });
    console.log('Validation errors:', newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form data before validation:', formData);
    if (validateForm()) {
      onSave(formData);
    } else {
      console.log('Validation failed. Please check the form fields.');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, minHeight: '400px' }}>
      {/* Show validation errors if any */}
      {Object.keys(errors).length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Please fix the following errors:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Employee Selection with Fuzzy Search */}
        <Autocomplete
          fullWidth
          options={filteredEmployees}
          getOptionLabel={(option) => {
            if (!option) return '';
            const name = `${option.firstName || ''} ${option.lastName || ''}`.trim();
            const dept = option.department?.name || option.department || '';
            return `${option.employeeId || ''} - ${name}${dept ? ` (${dept})` : ''}`;
          }}
          value={employees.find(emp => emp._id === selectedEmployeeId) || null}
          onChange={(event, newValue) => handleEmployeeSelect(newValue)}
          onInputChange={(event, newInputValue) => {
            setEmployeeSearchValue(newInputValue);
          }}
          loading={loadingEmployees}
          disabled={loadingEmployees}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Employee"
              required
              error={!!errors.employee}
              helperText={errors.employee || 'Search by employee code, name, CNIC, email, phone, or department'}
              placeholder="Type to search..."
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option._id}>
              <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <Typography variant="body1">
                  <strong>{option.employeeId}</strong> - {option.firstName} {option.lastName || ''}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  {option.idCard && (
                    <Chip 
                      label={`CNIC: ${option.idCard}`} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  )}
                  {option.email && (
                    <Chip 
                      label={`Email: ${option.email}`} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  )}
                  {option.phone && (
                    <Chip 
                      label={`Phone: ${option.phone}`} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  )}
                  {(option.department?.name || option.department) && (
                    <Chip 
                      label={`Dept: ${option.department?.name || option.department}`} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
          )}
          noOptionsText={
            loadingEmployees 
              ? 'Loading employees...' 
              : employeeSearchValue 
                ? `No employees found matching "${employeeSearchValue}"`
                : 'No employees without user accounts found'
          }
          sx={{ mt: 2 }}
        />

        {/* Auto-filled fields (read-only when employee is selected) */}
        <TextField
          fullWidth
          label="First Name"
          value={formData.firstName}
          margin="normal"
          variant="outlined"
          InputLabelProps={{ shrink: true }}
          InputProps={{ readOnly: true }}
          sx={{ backgroundColor: 'action.disabledBackground' }}
        />
        <TextField
          fullWidth
          label="Last Name"
          value={formData.lastName}
          margin="normal"
          variant="outlined"
          InputLabelProps={{ shrink: true }}
          InputProps={{ readOnly: true }}
          sx={{ backgroundColor: 'action.disabledBackground' }}
        />
        <TextField
          fullWidth
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          margin="normal"
          required
          error={!!errors.email}
          helperText={errors.email}
          variant="outlined"
          InputLabelProps={{
            shrink: true,
          }}
        />
        <TextField
          fullWidth
          label="Password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          margin="normal"
          required
          error={!!errors.password}
          helperText={errors.password}
          variant="outlined"
          InputLabelProps={{
            shrink: true,
          }}
        />
        <TextField
          fullWidth
          label="Employee ID"
          value={formData.employeeId}
          margin="normal"
          variant="outlined"
          InputLabelProps={{ shrink: true }}
          InputProps={{ readOnly: true }}
          sx={{ backgroundColor: 'action.disabledBackground' }}
        />
        <TextField
          fullWidth
          label="Position"
          value={formData.position}
          margin="normal"
          variant="outlined"
          InputLabelProps={{ shrink: true }}
          InputProps={{ readOnly: true }}
          sx={{ backgroundColor: 'action.disabledBackground' }}
        />
        
        <FormControl fullWidth margin="normal">
          <InputLabel>Department</InputLabel>
          <Select
            value={formData.department}
            label="Department"
            disabled
            sx={{ backgroundColor: 'action.disabledBackground' }}
          >
            <MenuItem value={formData.department}>{formData.department || 'N/A'}</MenuItem>
          </Select>
        </FormControl>
      
      <TextField
        fullWidth
        label="Phone"
        value={formData.phone}
        margin="normal"
        variant="outlined"
        InputLabelProps={{ shrink: true }}
        InputProps={{ readOnly: true }}
        sx={{ backgroundColor: 'action.disabledBackground' }}
      />
      </Box>
      
      {/* Profile Image Upload Section */}
      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Profile Image (Optional)
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {imagePreview ? (
            <Box sx={{ position: 'relative' }}>
              <img
                src={imagePreview}
                alt="Profile preview"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #e0e0e0'
                }}
              />
              <IconButton
                size="small"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                  setFormData(prevFormData => ({ 
                    ...prevFormData, 
                    profileImage: '' 
                  }));
                }}
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  backgroundColor: 'error.main',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'error.dark',
                  },
                  width: 24,
                  height: 24,
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box
              sx={{
                width: 80,
                height: 80,
                border: '2px dashed #ccc',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: '#e0e0e0',
                },
              }}
              onClick={() => document.getElementById('profile-image-upload').click()}
            >
              <CameraIcon sx={{ color: '#666' }} />
            </Box>
          )}
          
          <Box>
            <input
              id="profile-image-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => document.getElementById('profile-image-upload').click()}
              disabled={uploading}
              size="small"
            >
              {uploading ? 'Uploading...' : 'Upload Image'}
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary' }}>
              Max 5MB, JPG/PNG/GIF
            </Typography>
          </Box>
        </Box>
      </Box>
      
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="contained">Create User</Button>
      </DialogActions>
    </Box>
  );
};

export default UserManagement; 