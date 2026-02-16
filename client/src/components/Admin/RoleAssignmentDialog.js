import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Chip,
  Alert,
  Divider,
  Checkbox,
  FormControlLabel,
  FormGroup
} from '@mui/material';
import api from '../../services/api';

const RoleAssignmentDialog = ({ open, onClose, user, onSave }) => {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]); // For multiple roles
  const [useMultipleRoles, setUseMultipleRoles] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rolePermissions, setRolePermissions] = useState([]);

  // Debug: Log user object when dialog opens
  useEffect(() => {
    if (open) {
      console.log('RoleAssignmentDialog opened with user:', user);
    }
  }, [open, user]);

  useEffect(() => {
    if (open && user) {
      fetchRoles();
      if (user.roleRef) {
        const roleRefId = typeof user.roleRef === 'object' ? user.roleRef._id : user.roleRef;
        setSelectedRole(roleRefId);
        fetchRolePermissions(roleRefId);
      } else {
        setSelectedRole('');
        setRolePermissions([]);
      }
      // Check if user has multiple roles
      if (user.roles && user.roles.length > 0) {
        setSelectedRoles(user.roles.map(r => typeof r === 'object' ? r._id : r));
        setUseMultipleRoles(true);
      } else {
        setSelectedRoles([]);
        setUseMultipleRoles(false);
      }
    }
  }, [open, user]);

  const fetchRoles = async () => {
    try {
      const response = await api.get('/roles', { params: { isActive: true } });
      setRoles(response.data.data?.roles || []);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  const fetchRolePermissions = async (roleId) => {
    if (!roleId) {
      setRolePermissions([]);
      return;
    }
    try {
      setLoading(true);
      const response = await api.get(`/roles/${roleId}`);
      const role = response.data.data?.role;
      console.log('Fetched role permissions:', role?.permissions);
      if (role?.permissions && Array.isArray(role.permissions) && role.permissions.length > 0) {
        setRolePermissions(role.permissions);
      } else {
        setRolePermissions([]);
      }
    } catch (error) {
      console.error('Failed to fetch role permissions:', error);
      setRolePermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (roleId) => {
    console.log('Role changed:', roleId);
    setSelectedRole(roleId);
    if (roleId) {
      fetchRolePermissions(roleId);
    } else {
      setRolePermissions([]);
    }
  };

  const handleRoleToggle = (roleId) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleId)) {
        return prev.filter(id => id !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  };

  const handleSave = () => {
    console.log('handleSave called', { user, useMultipleRoles, selectedRole, selectedRoles });
    
    if (!user) {
      console.error('User object is missing');
      alert('User object is missing. Please try again.');
      return;
    }
    
    const userId = user._id || user.id;
    if (!userId) {
      console.error('User ID is missing', user);
      alert('User ID is missing. Please try again.');
      return;
    }
    
    if (useMultipleRoles) {
      if (selectedRoles.length === 0) {
        alert('Please select at least one role');
        return;
      }
      console.log('Saving multiple roles:', { userId, selectedRoles });
      onSave(userId, null, selectedRoles);
    } else {
      if (!selectedRole) {
        alert('Please select a role');
        return;
      }
      console.log('Saving single role:', { userId, selectedRole });
      onSave(userId, selectedRole);
    }
  };

  const getModuleDisplayName = (module) => {
    const names = {
      'hr': 'HR',
      'finance': 'Finance',
      'procurement': 'Procurement',
      'sales': 'Sales',
      'crm': 'CRM',
      'audit': 'Audit',
      'it': 'IT',
      'taj_residencia': 'Taj Residencia',
      'admin': 'Admin',
      'dashboard': 'Dashboard'
    };
    return names[module] || module.charAt(0).toUpperCase() + module.slice(1);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Assign Role - {user?.firstName || ''} {user?.lastName || ''}
          </Typography>
          {user?.email && (
            <Chip 
              label={user.email} 
              size="small" 
              color="primary" 
              variant="outlined"
            />
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={useMultipleRoles}
                onChange={(e) => {
                  setUseMultipleRoles(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedRoles([]);
                  }
                }}
              />
            }
            label="Assign Multiple Roles"
            sx={{ mb: 2 }}
          />

          {useMultipleRoles ? (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Select Roles (Multiple)
              </Typography>
              <FormGroup>
                {roles.map((role) => (
                  <FormControlLabel
                    key={role._id}
                    control={
                      <Checkbox
                        checked={selectedRoles.includes(role._id)}
                        onChange={() => handleRoleToggle(role._id)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">
                          {role.displayName || role.name}
                        </Typography>
                        {role.description && (
                          <Typography variant="caption" color="text.secondary">
                            {role.description}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
              {selectedRoles.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Combined Permissions Preview
                  </Typography>
                  {selectedRoles.map(roleId => {
                    const role = roles.find(r => r._id === roleId);
                    if (!role) return null;
                    return (
                      <Box key={roleId} sx={{ mb: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {role.displayName || role.name}:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {role.permissions?.map((perm, idx) => (
                            <Chip
                              key={idx}
                              label={`${getModuleDisplayName(perm.module)}: ${perm.actions?.join(', ') || 'none'}`}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          ) : (
            <FormControl fullWidth sx={{ mb: 3 }}>
              <Select
                value={selectedRole || ''}
                onChange={(e) => {
                  const roleId = e.target.value;
                  console.log('Role selected from dropdown:', roleId);
                  handleRoleChange(roleId);
                }}
                displayEmpty
                renderValue={(v) => {
                  if (!v) return 'Select role';
                  const r = roles.find(role => role._id === v);
                  return r ? (r.displayName || r.name) : 'Select role';
                }}
                inputProps={{ 'aria-label': 'Select role' }}
              >
                <MenuItem value="">
                  <em>No Role Assigned</em>
                </MenuItem>
                {roles.map((role) => (
                  <MenuItem key={role._id} value={role._id}>
                    {role.displayName || role.name}
                    {role.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        - {role.description}
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Select>
              {selectedRole && (
                <Typography variant="caption" color="success.main" sx={{ mt: 0.5, ml: 1.5 }}>
                  ✓ Role selected: {roles.find(r => r._id === selectedRole)?.displayName || selectedRole}
                </Typography>
              )}
            </FormControl>
          )}

          {selectedRole && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                Role Permissions Preview
              </Typography>
              {loading ? (
                <Typography variant="body2" color="text.secondary">
                  Loading permissions...
                </Typography>
              ) : rolePermissions.length > 0 ? (
                <Box>
                  {rolePermissions.map((perm, index) => {
                    // Check if there are any permissions (module-level actions or submodule actions)
                    const hasModuleActions = perm.actions && Array.isArray(perm.actions) && perm.actions.length > 0;
                    const hasSubmodulePermissions = perm.submodules && 
                      Array.isArray(perm.submodules) && 
                      perm.submodules.some(sub => sub.actions && Array.isArray(sub.actions) && sub.actions.length > 0);
                    
                    const hasAnyPermissions = hasModuleActions || hasSubmodulePermissions;
                    
                    return (
                      <Box key={index} sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                          {getModuleDisplayName(perm.module)}
                        </Typography>
                        
                        {/* Show module-level actions if any */}
                        {hasModuleActions && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>
                              Module Permissions:
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 1 }}>
                              {perm.actions.map((action) => (
                                <Chip
                                  key={action}
                                  label={action.charAt(0).toUpperCase() + action.slice(1)}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                        
                        {/* Show submodules with their actions */}
                        {hasSubmodulePermissions && (
                          <Box sx={{ mt: hasModuleActions ? 1.5 : 0 }}>
                            <Typography variant="caption" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>
                              Submodule Permissions:
                            </Typography>
                            <Box sx={{ ml: 1 }}>
                              {perm.submodules.map((submodule, subIdx) => {
                                if (!submodule.submodule || !submodule.actions || submodule.actions.length === 0) {
                                  return null;
                                }
                                return (
                                  <Box key={subIdx} sx={{ mb: 1 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>
                                      • {submodule.submodule.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 2 }}>
                                      {submodule.actions.map((action) => (
                                        <Chip
                                          key={action}
                                          label={action.charAt(0).toUpperCase() + action.slice(1)}
                                          size="small"
                                          color="secondary"
                                          variant="outlined"
                                        />
                                      ))}
                                    </Box>
                                  </Box>
                                );
                              })}
                            </Box>
                          </Box>
                        )}
                        
                        {/* Show message if no permissions at all */}
                        {!hasAnyPermissions && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                            No permissions assigned for this module
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Alert severity="info">
                  This role has no permissions assigned.
                </Alert>
              )}
            </>
          )}

          {!useMultipleRoles && !selectedRole && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No role selected. User will have no custom permissions.
            </Alert>
          )}
          {useMultipleRoles && selectedRoles.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No roles selected. User will have no custom permissions.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Assign Role button clicked', {
              user,
              userId: user?._id || user?.id,
              useMultipleRoles,
              selectedRole,
              selectedRoles
            });
            handleSave();
          }} 
          variant="contained"
          disabled={
            !user || 
            (!user._id && !user.id) || 
            (useMultipleRoles ? (selectedRoles.length === 0) : (!selectedRole || selectedRole === ''))
          }
        >
          {useMultipleRoles ? 'Assign Roles' : 'Assign Role'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoleAssignmentDialog;
