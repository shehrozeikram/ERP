import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip
} from '@mui/material';
import { MODULES } from '../../utils/permissions';

const ROLE_TEMPLATES = [
  {
    name: 'viewer',
    displayName: 'Viewer',
    description: 'Read-only access to all modules',
    permissions: Object.keys(MODULES)
      .filter(key => MODULES[key] && typeof MODULES[key] === 'object')
      .map(key => ({
        module: key,
        actions: ['read'],
        submodules: []
      }))
  },
  {
    name: 'editor',
    displayName: 'Editor',
    description: 'Read and write access to all modules',
    permissions: Object.keys(MODULES)
      .filter(key => MODULES[key] && typeof MODULES[key] === 'object')
      .map(key => ({
        module: key,
        actions: ['read', 'create', 'update'],
        submodules: []
      }))
  },
  {
    name: 'manager',
    displayName: 'Manager',
    description: 'Full access including delete and approve',
    permissions: Object.keys(MODULES)
      .filter(key => MODULES[key] && typeof MODULES[key] === 'object')
      .map(key => ({
        module: key,
        actions: ['read', 'create', 'update', 'delete', 'approve'],
        submodules: []
      }))
  },
  {
    name: 'hr_viewer',
    displayName: 'HR Viewer',
    description: 'Read-only access to HR module',
    permissions: [{
      module: 'hr',
      actions: ['read'],
      submodules: []
    }]
  },
  {
    name: 'hr_manager',
    displayName: 'HR Manager',
    description: 'Full access to HR module',
    permissions: [{
      module: 'hr',
      actions: ['read', 'create', 'update', 'delete', 'approve'],
      submodules: []
    }]
  },
  {
    name: 'finance_viewer',
    displayName: 'Finance Viewer',
    description: 'Read-only access to Finance module',
    permissions: [{
      module: 'finance',
      actions: ['read'],
      submodules: []
    }]
  },
  {
    name: 'finance_manager',
    displayName: 'Finance Manager',
    description: 'Full access to Finance module',
    permissions: [{
      module: 'finance',
      actions: ['read', 'create', 'update', 'delete', 'approve'],
      submodules: []
    }]
  },
  {
    name: 'procurement_viewer',
    displayName: 'Procurement Viewer',
    description: 'Read-only access to Procurement module',
    permissions: [{
      module: 'procurement',
      actions: ['read'],
      submodules: []
    }]
  },
  {
    name: 'procurement_manager',
    displayName: 'Procurement Manager',
    description: 'Full access to Procurement module',
    permissions: [{
      module: 'procurement',
      actions: ['read', 'create', 'update', 'delete', 'approve'],
      submodules: []
    }]
  }
];

const RoleTemplates = ({ onSelectTemplate }) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Role Templates
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Start with a pre-configured template or create a custom role
      </Typography>
      <Grid container spacing={2}>
        {ROLE_TEMPLATES.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.name}>
            <Paper
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  borderColor: 'primary.main',
                  cursor: 'pointer'
                }
              }}
              onClick={() => onSelectTemplate(template)}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {template.displayName}
                </Typography>
                <Chip
                  label={`${template.permissions.length} module${template.permissions.length !== 1 ? 's' : ''}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {template.description}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                fullWidth
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTemplate(template);
                }}
              >
                Use Template
              </Button>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default RoleTemplates;
export { ROLE_TEMPLATES };
