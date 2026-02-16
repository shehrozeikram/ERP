import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Paper,
  Chip,
  Grid
} from '@mui/material';
import { MODULES } from '../../utils/permissions';

const PERMISSION_ACTIONS = [
  { value: 'read', label: 'Read' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'approve', label: 'Approve' }
];

const PermissionAssignmentDialog = ({ open, onClose, user, onSave }) => {
  const [selectedModules, setSelectedModules] = useState({});
  const [modulePermissions, setModulePermissions] = useState({});

  useEffect(() => {
    if (user && open) {
      // Initialize from user's existing permissions
      const initialModules = {};
      const initialPermissions = {};
      
      if (user.permissions && Array.isArray(user.permissions)) {
        user.permissions.forEach(perm => {
          if (perm.module) {
            initialModules[perm.module] = true;
            initialPermissions[perm.module] = perm.actions || [];
          }
        });
      }
      
      setSelectedModules(initialModules);
      setModulePermissions(initialPermissions);
    } else {
      setSelectedModules({});
      setModulePermissions({});
    }
  }, [user, open]);

  const handleModuleToggle = (module) => {
    setSelectedModules(prev => ({
      ...prev,
      [module]: !prev[module]
    }));
    
    // If unchecking module, remove all its permissions
    if (selectedModules[module]) {
      setModulePermissions(prev => {
        const newPerms = { ...prev };
        delete newPerms[module];
        return newPerms;
      });
    } else {
      // If checking module, initialize with empty permissions
      setModulePermissions(prev => ({
        ...prev,
        [module]: []
      }));
    }
  };

  const handlePermissionToggle = (module, action) => {
    setModulePermissions(prev => {
      const currentActions = prev[module] || [];
      const newActions = currentActions.includes(action)
        ? currentActions.filter(a => a !== action)
        : [...currentActions, action];
      
      return {
        ...prev,
        [module]: newActions
      };
    });
  };

  const handleSelectAllPermissions = (module) => {
    const allActions = PERMISSION_ACTIONS.map(a => a.value);
    const currentActions = modulePermissions[module] || [];
    const hasAll = allActions.every(action => currentActions.includes(action));
    
    setModulePermissions(prev => ({
      ...prev,
      [module]: hasAll ? [] : allActions
    }));
  };

  const handleSave = () => {
    const permissions = Object.keys(selectedModules)
      .filter(module => selectedModules[module])
      .map(module => ({
        module,
        actions: modulePermissions[module] || []
      }))
      .filter(perm => perm.actions.length > 0); // Only include modules with at least one permission

    onSave(user._id, permissions);
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

  // Get available modules from MODULES object
  const availableModules = Object.keys(MODULES)
    .filter(key => MODULES[key] && typeof MODULES[key] === 'object' && MODULES[key].name)
    .map(key => ({
      key: key,
      name: MODULES[key].name || getModuleDisplayName(key)
    }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Manage Permissions - {user?.firstName} {user?.lastName}
          </Typography>
          <Chip 
            label={user?.email} 
            size="small" 
            color="primary" 
            variant="outlined"
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select modules and assign permissions. Check the boxes to grant access.
          </Typography>
          
          <Grid container spacing={2}>
            {availableModules.map(({ key, name }) => (
              <Grid item xs={12} key={key}>
                <Paper sx={{ p: 2, border: selectedModules[key] ? '2px solid' : '1px solid', 
                  borderColor: selectedModules[key] ? 'primary.main' : 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedModules[key] || false}
                          onChange={() => handleModuleToggle(key)}
                        />
                      }
                      label={
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {name}
                        </Typography>
                      }
                    />
                    {selectedModules[key] && (
                      <Button
                        size="small"
                        onClick={() => handleSelectAllPermissions(key)}
                        sx={{ ml: 'auto' }}
                      >
                        {modulePermissions[key]?.length === PERMISSION_ACTIONS.length 
                          ? 'Deselect All' 
                          : 'Select All'}
                      </Button>
                    )}
                  </Box>
                  
                  {selectedModules[key] && (
                    <Box sx={{ pl: 4, mt: 1 }}>
                      <FormGroup>
                        <Grid container spacing={1}>
                          {PERMISSION_ACTIONS.map(action => (
                            <Grid item xs={6} sm={4} md={3} key={action.value}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={(modulePermissions[key] || []).includes(action.value)}
                                    onChange={() => handlePermissionToggle(key, action.value)}
                                    size="small"
                                  />
                                }
                                label={action.label}
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </FormGroup>
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={Object.keys(selectedModules).filter(m => selectedModules[m]).length === 0}
        >
          Save Permissions
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PermissionAssignmentDialog;
