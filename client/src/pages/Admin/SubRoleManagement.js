import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Switch,
  FormControlLabel,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Checkbox,
  ListItemText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const SubRoleManagement = () => {
  const { user } = useAuth();
  const [subRoles, setSubRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSubRole, setSelectedSubRole] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    module: '',
    permissions: []
  });
  
  const [availableSubmodules, setAvailableSubmodules] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [assignDialogUsers, setAssignDialogUsers] = useState([]);

  const modules = [
    { value: 'admin', label: 'Admin' },
    { value: 'hr', label: 'HR' },
    { value: 'finance', label: 'Finance' },
    { value: 'procurement', label: 'Procurement' },
    { value: 'sales', label: 'Sales' },
    { value: 'crm', label: 'CRM' },
    { value: 'audit', label: 'Audit' },
    { value: 'it', label: 'IT' }
  ];

  const actions = [
    { value: 'create', label: 'Create' },
    { value: 'read', label: 'Read' },
    { value: 'update', label: 'Update' },
    { value: 'delete', label: 'Delete' },
    { value: 'approve', label: 'Approve' }
  ];

  useEffect(() => {
    fetchSubRoles();
    fetchUsers();
  }, []);

  const fetchSubRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sub-roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch sub-roles');
      
      const data = await response.json();
      setSubRoles(data.data.subRoles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/auth/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const data = await response.json();
      setUsers(data.data.users);
    } catch (err) {
      setError('Failed to fetch users');
    }
  };

  const fetchSubmodules = async (module) => {
    try {
      const response = await fetch(`/api/sub-roles/modules/${module}/submodules`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch submodules');
      
      const data = await response.json();
      setAvailableSubmodules(data.data.submodules);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateSubRole = async () => {
    try {
      const response = await fetch('/api/sub-roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create sub-role');
      }
      
      setSuccess('Sub-role created successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchSubRoles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditSubRole = async () => {
    try {
      const response = await fetch(`/api/sub-roles/${selectedSubRole._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update sub-role');
      }
      
      setSuccess('Sub-role updated successfully');
      setEditDialogOpen(false);
      resetForm();
      fetchSubRoles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSubRole = async (subRoleId) => {
    if (!window.confirm('Are you sure you want to delete this sub-role?')) return;
    
    try {
      const response = await fetch(`/api/sub-roles/${subRoleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete sub-role');
      }
      
      setSuccess('Sub-role deleted successfully');
      fetchSubRoles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAssignSubRole = async () => {
    try {
      for (const userId of assignDialogUsers) {
        const response = await fetch('/api/user-sub-roles/assign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            userId,
            subRoleId: selectedSubRole._id
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to assign sub-role');
        }
      }
      
      setSuccess('Sub-role assigned successfully');
      setAssignDialogOpen(false);
      setAssignDialogUsers([]);
      setSelectedSubRole(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUserToggle = (userId) => {
    setAssignDialogUsers(prev => {
      return prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      module: '',
      permissions: []
    });
    setSelectedSubRole(null);
  };

  const handleModuleChange = (module) => {
    setFormData({ ...formData, module, permissions: [] });
    fetchSubmodules(module);
  };

  const handlePermissionToggle = (submodule, action) => {
    const updatedPermissions = [...formData.permissions];
    const existingPermission = updatedPermissions.find(p => p.submodule === submodule);
    
    if (existingPermission) {
      if (existingPermission.actions.includes(action)) {
        existingPermission.actions = existingPermission.actions.filter(a => a !== action);
        if (existingPermission.actions.length === 0) {
          updatedPermissions.splice(updatedPermissions.indexOf(existingPermission), 1);
        }
      } else {
        existingPermission.actions.push(action);
      }
    } else {
      updatedPermissions.push({ submodule, actions: [action] });
    }
    
    setFormData({ ...formData, permissions: updatedPermissions });
  };

  const hasPermission = (submodule, action) => {
    const permission = formData.permissions.find(p => p.submodule === submodule);
    return permission ? permission.actions.includes(action) : false;
  };

  const openEditDialog = (subRole) => {
    setSelectedSubRole(subRole);
    setFormData({
      name: subRole.name,
      description: subRole.description,
      module: subRole.module,
      permissions: subRole.permissions
    });
    fetchSubmodules(subRole.module);
    setEditDialogOpen(true);
  };

  const openAssignDialog = (subRole) => {
    setSelectedSubRole(subRole);
    setAssignDialogUsers([]); // Reset selected users when opening dialog
    setAssignDialogOpen(true);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Sub-Role Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Sub-Role
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Module</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {subRoles.map((subRole) => (
              <TableRow key={subRole._id}>
                <TableCell>{subRole.name}</TableCell>
                <TableCell>
                  <Chip label={subRole.module} color="primary" size="small" />
                </TableCell>
                <TableCell>{subRole.description}</TableCell>
                <TableCell>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {subRole.permissions.map((permission, index) => (
                      <Chip
                        key={index}
                        label={`${permission.submodule}: ${permission.actions.join(', ')}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>{subRole.createdBy?.firstName} {subRole.createdBy?.lastName}</TableCell>
                <TableCell>
                  <Tooltip title="Edit">
                    <IconButton onClick={() => openEditDialog(subRole)}>
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Assign to Users">
                    <IconButton onClick={() => openAssignDialog(subRole)}>
                      <AssignmentIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton onClick={() => handleDeleteSubRole(subRole._id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Sub-Role Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Sub-Role</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Sub-Role Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Module</InputLabel>
                <Select
                  value={formData.module}
                  onChange={(e) => handleModuleChange(e.target.value)}
                  label="Module"
                >
                  {modules.map((module) => (
                    <MenuItem key={module.value} value={module.value}>
                      {module.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            {formData.module && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Permissions
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Submodule</TableCell>
                        {actions.map((action) => (
                          <TableCell key={action.value} align="center">
                            {action.label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {availableSubmodules.map((submodule) => (
                        <TableRow key={submodule}>
                          <TableCell>{submodule.replace(/_/g, ' ').toUpperCase()}</TableCell>
                          {actions.map((action) => (
                            <TableCell key={action.value} align="center">
                              <Switch
                                checked={hasPermission(submodule, action.value)}
                                onChange={() => handlePermissionToggle(submodule, action.value)}
                                size="small"
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateSubRole} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Sub-Role Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Sub-Role</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Sub-Role Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Module</InputLabel>
                <Select
                  value={formData.module}
                  onChange={(e) => handleModuleChange(e.target.value)}
                  label="Module"
                >
                  {modules.map((module) => (
                    <MenuItem key={module.value} value={module.value}>
                      {module.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            {formData.module && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Permissions
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Submodule</TableCell>
                        {actions.map((action) => (
                          <TableCell key={action.value} align="center">
                            {action.label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {availableSubmodules.map((submodule) => (
                        <TableRow key={submodule}>
                          <TableCell>{submodule.replace(/_/g, ' ').toUpperCase()}</TableCell>
                          {actions.map((action) => (
                            <TableCell key={action.value} align="center">
                              <Switch
                                checked={hasPermission(submodule, action.value)}
                                onChange={() => handlePermissionToggle(submodule, action.value)}
                                size="small"
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSubRole} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Sub-Role Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Sub-Role to Users</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            Assign "{selectedSubRole?.name}" to:
          </Typography>
          
          {/* Debug Info */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Debug: assignDialogUsers = [{assignDialogUsers.join(', ')}]
          </Typography>
          
          {/* Selected Users Display */}
          {assignDialogUsers.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Selected Users ({assignDialogUsers.length}):
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {assignDialogUsers.map((userId) => {
                  const user = users.find(u => (u._id || u.id) === userId);
                  return user ? (
                    <Chip 
                      key={userId} 
                      label={`${user.firstName} ${user.lastName}`} 
                      size="small" 
                      onDelete={() => handleUserToggle(userId)}
                    />
                  ) : null;
                })}
              </Box>
            </Box>
          )}
          
          {/* User List with Checkboxes */}
          <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
            {users.map((user, index) => (
              <Box 
                key={`user-${user._id || user.id}-${index}`} 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  p: 1, 
                  borderBottom: '1px solid #f0f0f0',
                  '&:hover': { backgroundColor: '#f5f5f5' }
                }}
              >
                <Checkbox 
                  checked={assignDialogUsers.includes(user._id || user.id)}
                  onChange={() => {
                    const userId = user._id || user.id;
                    handleUserToggle(userId);
                  }}
                />
                <Box sx={{ ml: 1 }}>
                  <Typography variant="body1">
                    {user.firstName} {user.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAssignDialogOpen(false);
            setAssignDialogUsers([]);
          }}>Cancel</Button>
          <Button 
            onClick={handleAssignSubRole} 
            variant="contained"
            disabled={assignDialogUsers.length === 0}
          >
            Assign to {assignDialogUsers.length} User{assignDialogUsers.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SubRoleManagement;
