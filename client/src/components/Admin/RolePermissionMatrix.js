import React, { useState, useEffect, useMemo } from 'react';
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
  Collapse,
  Alert,
  Stack
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { MODULES, getCatalogSubmodules } from '../../utils/permissions';

const PERMISSION_ACTIONS = [
  { value: 'read', label: 'Read' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'approve', label: 'Approve' }
];

const parsePermissions = (permissions) => {
  const initial = {};
  if (!permissions || !Array.isArray(permissions)) return initial;

  permissions.forEach((perm) => {
    if (!perm.module) return;
    const submoduleMap = {};
    if (perm.submodules && Array.isArray(perm.submodules)) {
      perm.submodules.forEach((submodule) => {
        if (typeof submodule === 'string') {
          submoduleMap[submodule] = perm.actions || [];
        } else if (submodule?.submodule) {
          submoduleMap[submodule.submodule] = submodule.actions || [];
        }
      });
    }
    initial[perm.module] = {
      submodules: submoduleMap,
      actions: perm.actions || []
    };
  });
  return initial;
};

/** Merge saved role grants with current catalog so new submodules always appear. */
const mergeWithCatalog = (parsed) => {
  const merged = { ...parsed };
  Object.keys(merged).forEach((module) => {
    const catalog = getCatalogSubmodules(module);
    const existing = merged[module].submodules || {};
    const submoduleMap = { ...existing };
    catalog.forEach((key) => {
      if (!(key in submoduleMap)) submoduleMap[key] = [];
    });
    merged[module] = {
      ...merged[module],
      submodules: submoduleMap
    };
  });
  return merged;
};

const RolePermissionMatrix = ({ permissions = [], onChange }) => {
  const [modulePermissions, setModulePermissions] = useState({});
  const [expandedModules, setExpandedModules] = useState({});

  useEffect(() => {
    const initial = mergeWithCatalog(parsePermissions(permissions));
    setModulePermissions(initial);

    const expanded = {};
    Object.keys(initial).forEach((module) => {
      if (Object.keys(initial[module].submodules || {}).length > 0) {
        expanded[module] = true;
      }
    });
    setExpandedModules(expanded);
  }, [permissions]);

  const savedSubmoduleKeys = useMemo(() => {
    const map = {};
    (permissions || []).forEach((perm) => {
      if (!perm.module) return;
      const set = new Set();
      (perm.submodules || []).forEach((sm) => {
        if (typeof sm === 'string') set.add(sm);
        else if (sm?.submodule) set.add(sm.submodule);
      });
      map[perm.module] = set;
    });
    return map;
  }, [permissions]);

  const notifyChange = (perms) => {
    const formattedPermissions = Object.keys(perms).map((module) => {
      const modulePerms = perms[module];
      const catalog = getCatalogSubmodules(module);
      const catalogSet = new Set(catalog);
      const submoduleKeys = new Set([
        ...catalog,
        ...Object.keys(modulePerms.submodules || {})
      ]);
      const submodulesArray = [...submoduleKeys].map((submodule) => ({
        submodule,
        actions: modulePerms.submodules[submodule] || []
      }));
      // Prefer catalog order, then any legacy-only keys
      submodulesArray.sort((a, b) => {
        const ai = catalog.indexOf(a.submodule);
        const bi = catalog.indexOf(b.submodule);
        if (ai === -1 && bi === -1) return a.submodule.localeCompare(b.submodule);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      return {
        module,
        actions: modulePerms.actions || [],
        submodules: submodulesArray.filter(
          (s) => catalogSet.has(s.submodule) || (s.actions && s.actions.length > 0)
        )
      };
    });
    if (onChange) onChange(formattedPermissions);
  };

  const handleModuleToggle = (module) => {
    setModulePermissions((prev) => {
      const newPerms = { ...prev };
      const moduleSubmodules = getCatalogSubmodules(module);

      if (newPerms[module]) {
        delete newPerms[module];
        setExpandedModules((prevExp) => {
          const next = { ...prevExp };
          delete next[module];
          return next;
        });
      } else {
        const submoduleMap = {};
        moduleSubmodules.forEach((submodule) => {
          submoduleMap[submodule] = [];
        });
        newPerms[module] = { submodules: submoduleMap, actions: [] };
        setExpandedModules((prevExp) => ({ ...prevExp, [module]: true }));
      }
      notifyChange(newPerms);
      return newPerms;
    });
  };

  const handleSubmoduleActionToggle = (module, submodule, action) => {
    setModulePermissions((prev) => {
      const modulePerms = prev[module] || { submodules: {}, actions: [] };
      const submoduleActions = modulePerms.submodules[submodule] || [];
      const newActions = submoduleActions.includes(action)
        ? submoduleActions.filter((a) => a !== action)
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
    const allActions = PERMISSION_ACTIONS.map((a) => a.value);
    const currentActions = modulePermissions[module]?.submodules[submodule] || [];
    const hasAll = allActions.every((action) => currentActions.includes(action));

    setModulePermissions((prev) => {
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

  const grantReadToNewOrEmpty = (module) => {
    const catalog = getCatalogSubmodules(module);
    setModulePermissions((prev) => {
      const modulePerms = prev[module] || { submodules: {}, actions: [] };
      const submoduleMap = { ...modulePerms.submodules };
      catalog.forEach((key) => {
        const acts = submoduleMap[key] || [];
        if (acts.length === 0) submoduleMap[key] = ['read'];
      });
      const newPerms = {
        ...prev,
        [module]: { ...modulePerms, submodules: submoduleMap }
      };
      notifyChange(newPerms);
      return newPerms;
    });
  };

  const grantAllCatalogActions = (module) => {
    const catalog = getCatalogSubmodules(module);
    const allActions = PERMISSION_ACTIONS.map((a) => a.value);
    setModulePermissions((prev) => {
      const modulePerms = prev[module] || { submodules: {}, actions: [] };
      const submoduleMap = { ...modulePerms.submodules };
      catalog.forEach((key) => {
        submoduleMap[key] = [...allActions];
      });
      const newPerms = {
        ...prev,
        [module]: { ...modulePerms, submodules: submoduleMap }
      };
      notifyChange(newPerms);
      return newPerms;
    });
  };

  const toggleModuleExpand = (module) => {
    setExpandedModules((prev) => ({
      ...prev,
      [module]: !prev[module]
    }));
  };

  const getModuleDisplayName = (moduleKey) => {
    const module = MODULES[moduleKey];
    return module?.name || moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
  };

  const getSubmoduleDisplayName = (submoduleKey) =>
    submoduleKey
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  const availableModules = Object.keys(MODULES)
    .filter((key) => MODULES[key] && typeof MODULES[key] === 'object' && key !== 'dashboard')
    .map((key) => ({
      key,
      name: getModuleDisplayName(key)
    }));

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Permission Matrix
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select modules to see their submodules. New menu tabs are picked up automatically from the
        module catalog — grant them here, then save the role.
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        After adding a new sidebar tab under a module, open that module here and use{' '}
        <strong>Grant Read to New / Empty</strong> (or tick permissions manually), then save.
      </Alert>

      <Grid container spacing={2}>
        {availableModules.map(({ key, name }) => {
          const isModuleSelected = !!modulePermissions[key];
          const isExpanded = expandedModules[key] || false;
          const moduleSubmodules = getCatalogSubmodules(key);
          const modulePerms = modulePermissions[key] || { submodules: {}, actions: [] };
          const savedKeys = savedSubmoduleKeys[key] || new Set();

          const totalSubmodulePermissions = Object.values(modulePerms.submodules || {}).reduce(
            (sum, actions) => sum + (actions?.length || 0),
            0
          );
          const selectedSubmodulesCount = Object.keys(modulePerms.submodules || {}).filter(
            (submodule) => (modulePerms.submodules[submodule] || []).length > 0
          ).length;
          const newCount = moduleSubmodules.filter((sm) => !savedKeys.has(sm)).length;

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
                <Box sx={{ display: 'flex', alignItems: 'center', mb: isModuleSelected ? 1 : 0, flexWrap: 'wrap', gap: 1 }}>
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
                      />
                      {newCount > 0 && (
                        <Chip
                          label={`${newCount} new in catalog`}
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      )}
                      <Stack direction="row" spacing={1} sx={{ ml: 'auto' }} flexWrap="wrap" useFlexGap>
                        <Button size="small" variant="outlined" onClick={() => grantReadToNewOrEmpty(key)}>
                          Grant Read to New / Empty
                        </Button>
                        <Button size="small" variant="outlined" onClick={() => grantAllCatalogActions(key)}>
                          Grant All Actions
                        </Button>
                        {moduleSubmodules.length > 0 && (
                          <Button
                            size="small"
                            onClick={() => toggleModuleExpand(key)}
                            startIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          >
                            {isExpanded ? 'Collapse' : 'Expand'} Submodules
                          </Button>
                        )}
                      </Stack>
                    </>
                  )}
                </Box>

                {isModuleSelected && moduleSubmodules.length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Collapse in={isExpanded}>
                      <Box sx={{ pl: { xs: 1, sm: 4 }, pt: 1 }}>
                        <Grid container spacing={2}>
                          {moduleSubmodules.map((submodule) => {
                            const submoduleActions = modulePerms.submodules[submodule] || [];
                            const hasAllActions = PERMISSION_ACTIONS.every((a) =>
                              submoduleActions.includes(a.value)
                            );
                            const isNew = !savedKeys.has(submodule);

                            return (
                              <Grid item xs={12} key={submodule}>
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    p: 2,
                                    borderColor: isNew ? 'warning.main' : undefined,
                                    backgroundColor:
                                      submoduleActions.length > 0
                                        ? 'action.hover'
                                        : 'background.paper'
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                      {getSubmoduleDisplayName(submodule)}
                                    </Typography>
                                    {isNew && (
                                      <Chip label="NEW" size="small" color="warning" />
                                    )}
                                    {submoduleActions.length > 0 && (
                                      <Chip
                                        label={`${submoduleActions.length} permission${submoduleActions.length !== 1 ? 's' : ''}`}
                                        size="small"
                                        color="secondary"
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
                                      {PERMISSION_ACTIONS.map((action) => (
                                        <Grid item xs={6} sm={4} md={3} key={action.value}>
                                          <FormControlLabel
                                            control={
                                              <Checkbox
                                                checked={submoduleActions.includes(action.value)}
                                                onChange={() =>
                                                  handleSubmoduleActionToggle(key, submodule, action.value)
                                                }
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
