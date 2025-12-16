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
  FormControlLabel
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as ViewIcon,
  Block as BlockIcon,
  CheckCircle as ActivateIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  PhotoCamera as CameraIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material';
import { authService } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { ROLES, MODULE_KEYS } from '../../utils/permissions';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [selectedUser, setSelectedUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [departments, setDepartments] = useState(['HR', 'Finance', 'Procurement', 'Sales', 'CRM', 'IT', 'Operations']);
  const [subRoles, setSubRoles] = useState([]);

  // Fetch sub-roles for a specific module
  const fetchSubRoles = async (role) => {
    try {
      // Map role names to module names
      const roleToModuleMap = {
        'admin': 'admin',
        'hr_manager': 'hr',
        'finance_manager': 'finance',
        'procurement_manager': 'procurement',
        'sales_manager': 'sales',
        'crm_manager': 'crm',
        'audit_manager': 'audit',
        'it_manager': 'it',
        'taj_residencia_manager': 'taj_residencia',
        'appraisal_manager': 'hr'
      };
      
      const module = roleToModuleMap[role];
      if (!module) {
        setSubRoles([]);
        return;
      }
      
      const response = await api.get(`/auth/sub-roles/${module}`);
      setSubRoles(response.data.data.subRoles);
    } catch (error) {
      console.error('Error fetching sub-roles:', error);
      setSubRoles([]);
    }
  };

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
  const roles = ['super_admin', 'admin', 'hr_manager', 'finance_manager', 'procurement_manager', 'sales_manager', 'crm_manager', 'audit_manager', 'auditor', 'it_manager', 'taj_residencia_manager', 'employee'];

  const roleColors = {
    super_admin: 'error',
    admin: 'secondary',
    hr_manager: 'primary',
    finance_manager: 'success',
    procurement_manager: 'warning',
    sales_manager: 'info',
    crm_manager: 'secondary',
    audit_manager: 'warning',
    auditor: 'info',
    it_manager: 'primary',
    taj_residencia_manager: 'secondary',
    employee: 'default'
  };

  const loadUsers = useCallback(async () => {
    try {
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search,
        department: departmentFilter,
        role: roleFilter,
        status: statusFilter
      };

      const response = await authService.getUsers(params);
      setUsers(response.data.data.users);
      setTotalUsers(response.data.data.pagination.total);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, [page, rowsPerPage, search, departmentFilter, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [page, rowsPerPage, search, departmentFilter, roleFilter, statusFilter, loadUsers]);

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

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await authService.updateUserRole(userId, newRole);
      console.log('User role updated successfully');
      loadUsers();
    } catch (error) {
      console.error('Failed to update user role:', error);
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
      loadUsers();
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
      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
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
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              label="Role"
            >
              <MenuItem value="">All Roles</MenuItem>
              {roles.map((role) => (
                <MenuItem key={role} value={role}>
                  {role.replace('_', ' ').toUpperCase()}
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
                <TableCell>Role</TableCell>
                <TableCell>Sub-Roles</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow 
                  key={user._id}
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
                    <Chip
                      label={user.role.replace('_', ' ').toUpperCase()}
                      color={roleColors[user.role]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {user.subRoles?.map((subRole) => (
                        <Chip 
                          key={subRole._id} 
                          label={subRole.name} 
                          size="small" 
                          color="secondary"
                          variant="outlined"
                        />
                      ))}
                      {(!user.subRoles || user.subRoles.length === 0) && (
                        <Typography variant="caption" color="text.secondary">
                          None
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
              onUpdateRole={handleUpdateRole}
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
            subRoles={subRoles}
            onRoleChange={fetchSubRoles}
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
    </Box>
  );
};

// Edit User Form Component
const EditUserForm = ({ user, onSave, onCancel, departments }) => {
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
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
        <InputLabel>Role</InputLabel>
        <Select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          label="Role"
        >
          {['super_admin', 'higher_management', 'admin', 'hr_manager', 'finance_manager', 'procurement_manager', 'sales_manager', 'crm_manager', 'audit_manager', 'auditor', 'it_manager', 'taj_residencia_manager', 'appraisal_manager', 'employee'].map((role) => (
            <MenuItem key={role} value={role}>
              {role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
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
const ViewUserDetails = ({ user, onUpdateRole, onClose }) => {
  const [selectedRole, setSelectedRole] = useState(user.role);

  const handleRoleUpdate = () => {
    onUpdateRole(user._id, selectedRole);
    onClose();
  };

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

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Update Role
        </Typography>
        <FormControl fullWidth>
          <InputLabel>Role</InputLabel>
          <Select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            label="Role"
          >
            {['admin', 'hr_manager', 'finance_manager', 'procurement_manager', 'sales_manager', 'crm_manager', 'audit_manager', 'auditor', 'it_manager', 'taj_residencia_manager', 'employee'].map((role) => (
              <MenuItem key={role} value={role}>
                {role.replace('_', ' ').toUpperCase()}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button 
          variant="contained" 
          onClick={handleRoleUpdate}
          disabled={selectedRole === user.role}
        >
          Update Role
        </Button>
      </DialogActions>
    </Box>
  );
};

// Create User Form Component
const CreateUserForm = ({ onSave, onCancel, departments, subRoles, onRoleChange }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    department: '',
    position: '',
    employeeId: '',
    role: 'employee',
    phone: '',
    subRoles: [],
    profileImage: ''
  });

  const [errors, setErrors] = useState({});
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

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
    
    // Check required fields with better error handling
    if (!formData.firstName || formData.firstName.trim() === '') {
      newErrors.firstName = 'First name is required';
    }
    
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
    
    if (!formData.department || formData.department === '') {
      newErrors.department = 'Department is required';
    }
    
    if (!formData.position || formData.position.trim() === '') {
      newErrors.position = 'Position is required';
    }
    
    if (!formData.employeeId || formData.employeeId.trim() === '') {
      newErrors.employeeId = 'Employee ID is required';
    }

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
        <TextField
          fullWidth
          label="First Name"
          value={formData.firstName}
          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
          margin="normal"
          required
          error={!!errors.firstName}
          helperText={errors.firstName}
          variant="outlined"
          InputLabelProps={{
            shrink: true,
          }}
        />
        <TextField
          fullWidth
          label="Last Name (Optional)"
          value={formData.lastName}
          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
          margin="normal"
          error={!!errors.lastName}
          helperText={errors.lastName}
          variant="outlined"
          InputLabelProps={{
            shrink: true,
          }}
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
          onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
          margin="normal"
          required
          error={!!errors.employeeId}
          helperText={errors.employeeId}
          variant="outlined"
          InputLabelProps={{
            shrink: true,
          }}
        />
        <TextField
          fullWidth
          label="Position"
          value={formData.position}
          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          margin="normal"
          required
          error={!!errors.position}
          helperText={errors.position}
          variant="outlined"
          InputLabelProps={{
            shrink: true,
          }}
        />
        
        <FormControl fullWidth margin="normal" error={!!errors.department}>
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
        {errors.department && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
            {errors.department}
          </Typography>
        )}
      </FormControl>
      <FormControl fullWidth margin="normal">
        <InputLabel>Role</InputLabel>
        <Select
          value={formData.role}
          onChange={(e) => {
            setFormData({ ...formData, role: e.target.value, subRoles: [] });
            onRoleChange(e.target.value);
          }}
          label="Role"
        >
          {['super_admin', 'higher_management', 'admin', 'hr_manager', 'finance_manager', 'procurement_manager', 'sales_manager', 'crm_manager', 'audit_manager', 'auditor', 'it_manager', 'taj_residencia_manager', 'appraisal_manager', 'employee'].map((role) => (
            <MenuItem key={role} value={role}>
              {role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* Sub-Role Selection - Only show for roles that support sub-roles */}
      {['admin', 'hr_manager', 'finance_manager', 'procurement_manager', 'sales_manager', 'crm_manager', 'audit_manager', 'it_manager', 'taj_residencia_manager'].includes(formData.role) && (
        <FormControl fullWidth margin="normal">
          <InputLabel>Sub-Roles (Optional)</InputLabel>
          <Select
            multiple
            value={formData.subRoles}
            onChange={(e) => setFormData({ ...formData, subRoles: e.target.value })}
            label="Sub-Roles (Optional)"
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((subRoleId) => {
                  const subRole = subRoles.find(sr => sr._id === subRoleId);
                  return <Chip key={subRoleId} label={subRole?.name} size="small" />;
                })}
              </Box>
            )}
          >
            {subRoles
              .filter(subRole => {
                // Map role names to module names for filtering
                const roleToModuleMap = {
                  'admin': 'admin',
                  'hr_manager': 'hr',
                  'finance_manager': 'finance',
                  'procurement_manager': 'procurement',
                  'sales_manager': 'sales',
                  'crm_manager': 'crm',
                  'audit_manager': 'audit',
                  'it_manager': 'it',
                  'taj_residencia_manager': 'taj_residencia'
                };
                return subRole.module === roleToModuleMap[formData.role];
              })
              .map((subRole) => (
                <MenuItem key={subRole._id} value={subRole._id}>
                  <Box>
                    <Typography variant="body1">{subRole.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {subRole.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      )}
      
      <TextField
        fullWidth
        label="Phone (Optional)"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        margin="normal"
        variant="outlined"
        InputLabelProps={{
          shrink: true,
        }}
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