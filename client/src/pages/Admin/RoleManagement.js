import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormGroup,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  People as PeopleIcon
} from '@mui/icons-material';

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [viewingRole, setViewingRole] = useState(null);
  const [roleUsers, setRoleUsers] = useState([]);
  const [availableModules, setAvailableModules] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: [],
    isActive: true
  });

  useEffect(() => {
    fetchRoles();
    fetchAvailableModules();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/roles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch roles');
      
      const data = await response.json();
      setRoles(data.data.roles);
    } catch (err) {
      setError('Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableModules = async () => {
    try {
      const response = await fetch('/api/roles/modules/available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch available modules');
      
      const data = await response.json();
      setAvailableModules(data.data.modules);
    } catch (err) {
      setError('Failed to fetch available modules');
    }
  };

  const fetchRoleUsers = async (roleId) => {
    try {
      const response = await fetch(`/api/roles/${roleId}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch role users');
      
      const data = await response.json();
      setRoleUsers(data.data.users);
    } catch (err) {
      setError('Failed to fetch role users');
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      displayName: '',
      description: '',
      permissions: [],
      isActive: true
    });
    setDialogOpen(true);
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description,
      permissions: role.permissions || [],
      isActive: role.isActive
    });
    setDialogOpen(true);
  };

  const handleViewRole = (role) => {
    setViewingRole(role);
    setViewDialogOpen(true);
  };

  const handleViewUsers = async (role) => {
    setViewingRole(role);
    await fetchRoleUsers(role._id);
    setUsersDialogOpen(true);
  };

  const handleSaveRole = async () => {
    try {
      const url = editingRole ? `/api/roles/${editingRole._id}` : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save role');
      }
      
      setSuccess(editingRole ? 'Role updated successfully' : 'Role created successfully');
      setDialogOpen(false);
      fetchRoles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`Are you sure you want to delete the role "${role.displayName}"?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/roles/${role._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete role');
      }
      
      setSuccess('Role deleted successfully');
      fetchRoles();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePermissionChange = (moduleKey, submodule, action, checked) => {
    setFormData(prev => {
      const newPermissions = [...prev.permissions];
      let modulePermission = newPermissions.find(p => p.module === moduleKey);
      
      if (!modulePermission) {
        modulePermission = {
          module: moduleKey,
          submodules: [],
          actions: []
        };
        newPermissions.push(modulePermission);
      }
      
      if (checked) {
        if (!modulePermission.submodules.includes(submodule)) {
          modulePermission.submodules.push(submodule);
        }
        if (!modulePermission.actions.includes(action)) {
          modulePermission.actions.push(action);
        }
      } else {
        modulePermission.submodules = modulePermission.submodules.filter(s => s !== submodule);
        modulePermission.actions = modulePermission.actions.filter(a => a !== action);
      }
      
      // Remove module permission if no submodules or actions
      if (modulePermission.submodules.length === 0 || modulePermission.actions.length === 0) {
        return {
          ...prev,
          permissions: newPermissions.filter(p => p.module !== moduleKey)
        };
      }
      
      return {
        ...prev,
        permissions: newPermissions
      };
    });
  };

  const isPermissionChecked = (moduleKey, submodule, action) => {
    const modulePermission = formData.permissions.find(p => p.module === moduleKey);
    return modulePermission && 
           modulePermission.submodules.includes(submodule) && 
           modulePermission.actions.includes(action);
  };

  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         role.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         role.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterActive === 'all' || 
                         (filterActive === 'active' && role.isActive) ||
                         (filterActive === 'inactive' && !role.isActive);
    
    return matchesSearch && matchesFilter;
  });

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      permissions: [],
      isActive: true
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Role Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateRole}
        >
          Create Role
        </Button>
      </Box>

      {/* Search and Filter */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          label="Search roles"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterActive}
            label="Status"
            onChange={(e) => setFilterActive(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Roles Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Users</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRoles.map((role) => (
              <TableRow key={role._id}>
                <TableCell>
                  <Typography variant="body1" fontWeight="medium">
                    {role.name}
                  </Typography>
                </TableCell>
                <TableCell>{role.displayName}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {role.description || 'No description'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {role.permissions?.map((permission, index) => (
                      <Chip
                        key={index}
                        label={`${permission.module} (${permission.submodules.length})`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                    {(!role.permissions || role.permissions.length === 0) && (
                      <Typography variant="caption" color="text.secondary">
                        No permissions
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={role.isActive ? 'Active' : 'Inactive'}
                    color={role.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    startIcon={<PeopleIcon />}
                    onClick={() => handleViewUsers(role)}
                  >
                    {role.userCount || 0}
                  </Button>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => handleViewRole(role)}>
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Role">
                      <IconButton 
                        size="small" 
                        onClick={() => handleEditRole(role)}
                        disabled={role.isSystemRole}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Role">
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => handleDeleteRole(role)}
                        disabled={role.isSystemRole}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Role Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingRole ? 'Edit Role' : 'Create New Role'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Role Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={editingRole}
              fullWidth
              required
            />
            <TextField
              label="Display Name"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              }
              label="Active"
            />
            
            <Divider />
            
            <Typography variant="h6">Permissions</Typography>
            {availableModules.map((module) => (
              <Accordion key={module.key}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">
                    {module.name} ({module.submodules.length} submodules)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {module.submodules.map((submodule) => (
                      <Box key={submodule} sx={{ ml: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          {submodule.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Typography>
                        <FormGroup row>
                          {['create', 'read', 'update', 'delete', 'approve'].map((action) => (
                            <FormControlLabel
                              key={action}
                              control={
                                <Checkbox
                                  checked={isPermissionChecked(module.key, submodule, action)}
                                  onChange={(e) => handlePermissionChange(module.key, submodule, action, e.target.checked)}
                                />
                              }
                              label={action.charAt(0).toUpperCase() + action.slice(1)}
                            />
                          ))}
                        </FormGroup>
                      </Box>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveRole} variant="contained">
            {editingRole ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Role Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Role Details</DialogTitle>
        <DialogContent>
          {viewingRole && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                <Typography variant="body1">{viewingRole.name}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Display Name</Typography>
                <Typography variant="body1">{viewingRole.displayName}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography variant="body1">{viewingRole.description || 'No description'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                <Chip
                  label={viewingRole.isActive ? 'Active' : 'Inactive'}
                  color={viewingRole.isActive ? 'success' : 'default'}
                  size="small"
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Permissions</Typography>
                {viewingRole.permissions?.map((permission, index) => (
                  <Box key={index} sx={{ mt: 1 }}>
                    <Typography variant="body2" fontWeight="medium">
                      {permission.module}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Submodules: {permission.submodules.join(', ')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Actions: {permission.actions.join(', ')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Users Dialog */}
      <Dialog open={usersDialogOpen} onClose={() => setUsersDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Users with Role: {viewingRole?.displayName}</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roleUsers.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>{user.firstName} {user.lastName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.isActive ? 'Active' : 'Inactive'}
                        color={user.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {roleUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No users assigned to this role
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUsersDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
      >
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RoleManagement;
