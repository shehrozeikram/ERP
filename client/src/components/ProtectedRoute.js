import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { isRouteAccessible, hasModuleAccess, hasModuleAccessViaRoleRef } from '../utils/permissions';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Box textAlign="center">
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6">Loading...</Typography>
        </Box>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has access to the current route
  // Pass roleRef and roles for RBAC permission checking
  const hasAccess = isRouteAccessible(
    user.role, 
    location.pathname, 
    user.subRoles, 
    user.roleRef, 
    user.roles
  );
  
  if (!hasAccess) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{ p: 3 }}
      >
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1">
            You don't have permission to access this page. 
            Please contact your administrator if you believe this is an error.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Current role: <strong>{user.roleRef?.name || user.roleRef?.displayName || user.role}</strong>
          </Typography>
          <Typography variant="body2">
            Required permissions: <strong>{requiredRole || 'Module access'}</strong>
          </Typography>
          <Typography variant="body2">
            Path: <strong>{location.pathname}</strong>
          </Typography>
        </Alert>
      </Box>
    );
  }

  // Check specific role requirement if provided
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userRole = user.role;

    // Check exact role match (legacy)
    if (allowedRoles.includes(userRole)) {
      // User has exact role match, allow access
    } else {
      // Map module-manager roles to module keys for permission check
      const roleToModule = {
        finance_manager: 'finance',
        tcm_manager: 'finance',
        hr_manager: 'hr',
        audit_manager: 'audit',
        procurement_manager: 'procurement',
        sales_manager: 'sales',
        crm_manager: 'crm',
        it_manager: 'it',
        taj_residencia_manager: 'taj_residencia',
        appraisal_manager: 'appraisal_manager'
      };

      let hasModuleAccessForRole = false;
      for (const role of allowedRoles) {
        const moduleKey = roleToModule[role];
        if (moduleKey) {
          if (hasModuleAccess(userRole, moduleKey) || hasModuleAccessViaRoleRef(user, moduleKey)) {
            hasModuleAccessForRole = true;
            break;
          }
        }
      }

      if (!hasModuleAccessForRole) {
        const displayRole = user.roleRef?.name || user.roleRef?.displayName || user.role;
        return (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="100vh"
            sx={{ p: 3 }}
          >
            <Alert severity="error" sx={{ maxWidth: 600 }}>
              <Typography variant="h6" gutterBottom>
                Insufficient Permissions
              </Typography>
              <Typography variant="body1">
                This page requires one of the following roles: <strong>{allowedRoles.join(', ')}</strong>.
                Your current role is <strong>{displayRole}</strong>.
              </Typography>
            </Alert>
          </Box>
        );
      }
    }
  }

  return children;
};

export default ProtectedRoute; 