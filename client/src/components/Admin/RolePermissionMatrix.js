import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Paper,
  Grid,
  Button,
  Chip,
  Divider,
  Collapse
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { MODULES, SUBMODULES } from '../../utils/permissions';

const PERMISSION_ACTIONS = [
  { value: 'read', label: 'Read' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'approve', label: 'Approve' }
];

const RolePermissionMatrix = ({ permissions = [], onChange }) => {
  const [modulePermissions, setModulePermissions] = useState({});
  const [expandedModules, setExpandedModules] = useState({});

  useEffect(() => {
    // Initialize from existing permissions
    const initial = {};
    if (permissions && Array.isArray(permissions)) {
      permissions.forEach(perm => {
        if (perm.module) {
          // Convert submodules array to object format: { submodule: [actions] }
          const submoduleMap = {};
          if (perm.submodules && Array.isArray(perm.submodules)) {
            // If submodules is an array of strings (legacy format), convert to object
            perm.submodules.forEach(submodule => {
              if (typeof submodule === 'string') {
                submoduleMap[submodule] = perm.actions || [];
              } else if (submodule.submodule) {
                submoduleMap[submodule.submodule] = submodule.actions || [];
              }
            });
          }
          
          initial[perm.module] = {
            submodules: submoduleMap,
            // Keep actions for backward compatibility (module-level actions)
            actions: perm.actions || []
          };
        }
      });
    }
    setModulePermissions(initial);
    
    // Auto-expand modules that have permissions
    const expanded = {};
    Object.keys(initial).forEach(module => {
      if (Object.keys(initial[module].submodules || {}).length > 0) {
        expanded[module] = true;
      }
    });
    setExpandedModules(expanded);
  }, [permissions]);

  const handleModuleToggle = (module) => {
    setModulePermissions(prev => {
      const newPerms = { ...prev };
      const moduleSubmodules = SUBMODULES[module] || [];
      
      if (newPerms[module]) {
        delete newPerms[module];
        setExpandedModules(prevExp => {
          const newExp = { ...prevExp };
          delete newExp[module];
          return newExp;
        });
      } else {
        // Initialize with all submodules (empty actions for each)
        const submoduleMap = {};
        moduleSubmodules.forEach(submodule => {
          submoduleMap[submodule] = [];
        });
        newPerms[module] = {
          submodules: submoduleMap,
          actions: []
        };
        // Auto-expand when module is selected
        setExpandedModules(prevExp => ({
          ...prevExp,
          [module]: true
        }));
      }
      notifyChange(newPerms);
      return newPerms;
    });
  };

  const handleSubmoduleActionToggle = (module, submodule, action) => {
    setModulePermissions(prev => {
      const modulePerms = prev[module] || { submodules: {}, actions: [] };
      const submoduleActions = modulePerms.submodules[submodule] || [];
      
      const newActions = submoduleActions.includes(action)
        ? submoduleActions.filter(a => a !== action)
        : [...submoduleActions, action];
      
      const newPerms = {
        ...prev,
        [module]: {
          ...modulePerms,
          submodules: {
            ...modulePerms.submodules,
            [submodule]: newActions
          }
        }
      };
      notifyChange(newPerms);
      return newPerms;
    });
  };

  const handleSelectAllSubmoduleActions = (module, submodule) => {
    const allActions = PERMISSION_ACTIONS.map(a => a.value);
    const currentActions = modulePermissions[module]?.submodules[submodule] || [];
    const hasAll = allActions.every(action => currentActions.includes(action));
    
    setModulePermissions(prev => {
      const modulePerms = prev[module] || { submodules: {}, actions: [] };
      const newPerms = {
        ...prev,
        [module]: {
          ...modulePerms,
          submodules: {
            ...modulePerms.submodules,
            [submodule]: hasAll ? [] : allActions
          }
        }
      };
      notifyChange(newPerms);
      return newPerms;
    });
  };

  const toggleModuleExpand = (module) => {
    setExpandedModules(prev => ({
      ...prev,
      [module]: !prev[module]
    }));
  };

  const notifyChange = (perms) => {
    // Format permissions: convert submodule object to array format.
    // Include all selected modules (even with no actions yet) so parent state preserves
    // selection and expansion; otherwise useEffect re-sync would clear newly selected modules.
    const formattedPermissions = Object.keys(perms).map(module => {
      const modulePerms = perms[module];
      const submodulesArray = Object.keys(modulePerms.submodules || {}).map(submodule => ({
        submodule,
        actions: modulePerms.submodules[submodule] || []
      }));
      return {
        module,
        actions: modulePerms.actions || [],
        submodules: submodulesArray
      };
    });
    if (onChange) {
      onChange(formattedPermissions);
    }
  };

  const getModuleDisplayName = (moduleKey) => {
    const module = MODULES[moduleKey];
    return module?.name || moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
  };

  const getSubmoduleDisplayName = (submoduleKey) => {
    // Convert snake_case to Title Case
    return submoduleKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const availableModules = Object.keys(MODULES)
    .filter(key => MODULES[key] && typeof MODULES[key] === 'object' && key !== 'dashboard')
    .map(key => ({
      key,
      name: getModuleDisplayName(key)
    }));

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Permission Matrix
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select modules to see their submodules. Assign permissions to specific submodules as needed.
      </Typography>

      <Grid container spacing={2}>
        {availableModules.map(({ key, name }) => {
          const isModuleSelected = !!modulePermissions[key];
          const isExpanded = expandedModules[key] || false;
          const moduleSubmodules = SUBMODULES[key] || [];
          const modulePerms = modulePermissions[key] || { submodules: {}, actions: [] };
          
          // Count total permissions across all submodules
          const totalSubmodulePermissions = Object.values(modulePerms.submodules || {})
            .reduce((sum, actions) => sum + (actions?.length || 0), 0);
          const selectedSubmodulesCount = Object.keys(modulePerms.submodules || {})
            .filter(submodule => (modulePerms.submodules[submodule] || []).length > 0).length;

          return (
            <Grid item xs={12} key={key}>
              <Paper
                sx={{
                  p: 2,
                  border: isModuleSelected ? '2px solid' : '1px solid',
                  borderColor: isModuleSelected ? 'primary.main' : 'divider',
                  backgroundColor: isModuleSelected ? 'action.selected' : 'background.paper'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: isModuleSelected ? 1 : 0 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isModuleSelected}
                        onChange={() => handleModuleToggle(key)}
                      />
                    }
                    label={
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {name}
                      </Typography>
                    }
                  />
                  {isModuleSelected && (
                    <>
                      <Chip
                        label={`${selectedSubmodulesCount} submodule${selectedSubmodulesCount !== 1 ? 's' : ''} with ${totalSubmodulePermissions} permission${totalSubmodulePermissions !== 1 ? 's' : ''}`}
                        size="small"
                        color="primary"
                        sx={{ ml: 1 }}
                      />
                      {moduleSubmodules.length > 0 && (
                        <Button
                          size="small"
                          onClick={() => toggleModuleExpand(key)}
                          startIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          sx={{ ml: 'auto' }}
                        >
                          {isExpanded ? 'Collapse' : 'Expand'} Submodules
                        </Button>
                      )}
                    </>
                  )}
                </Box>

                {isModuleSelected && moduleSubmodules.length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Collapse in={isExpanded}>
                      <Box sx={{ pl: 4, pt: 1 }}>
                        <Grid container spacing={2}>
                          {moduleSubmodules.map(submodule => {
                            const submoduleActions = modulePerms.submodules[submodule] || [];
                            const hasAllActions = PERMISSION_ACTIONS.every(a => 
                              submoduleActions.includes(a.value)
                            );

                            return (
                              <Grid item xs={12} key={submodule}>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 2,
                                    backgroundColor: submoduleActions.length > 0 
                                      ? 'action.hover' 
                                      : 'background.paper'
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                      {getSubmoduleDisplayName(submodule)}
                                    </Typography>
                                    {submoduleActions.length > 0 && (
                                      <Chip
                                        label={`${submoduleActions.length} permission${submoduleActions.length !== 1 ? 's' : ''}`}
                                        size="small"
                                        color="secondary"
                                        sx={{ ml: 1 }}
                                      />
                                    )}
                                    <Button
                                      size="small"
                                      onClick={() => handleSelectAllSubmoduleActions(key, submodule)}
                                      sx={{ ml: 'auto' }}
                                    >
                                      {hasAllActions ? 'Deselect All' : 'Select All'}
                                    </Button>
                                  </Box>
                                  <FormGroup>
                                    <Grid container spacing={1}>
                                      {PERMISSION_ACTIONS.map(action => (
                                        <Grid item xs={6} sm={4} md={3} key={action.value}>
                                          <FormControlLabel
                                            control={
                                              <Checkbox
                                                checked={submoduleActions.includes(action.value)}
                                                onChange={() => handleSubmoduleActionToggle(key, submodule, action.value)}
                                                size="small"
                                              />
                                            }
                                            label={action.label}
                                          />
                                        </Grid>
                                      ))}
                                    </Grid>
                                  </FormGroup>
                                </Paper>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Box>
                    </Collapse>
                  </>
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default RolePermissionMatrix;
