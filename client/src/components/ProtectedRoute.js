import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { isRouteAccessible, hasModuleAccess, PERMISSIONS } from '../utils/permissions';

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
  const hasAccess = isRouteAccessible(user.role, location.pathname, user.subRoles);
  
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
            Current role: <strong>{user.role}</strong>
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
    
    // Check exact role match
    if (allowedRoles.includes(userRole)) {
      // User has exact role match, allow access
    } else {
      // Check if user's role has module access for audit_manager or hr_manager requirements
      let hasModuleAccessForRole = false;
      
      // If route requires audit_manager, check if user has audit module access
      if (allowedRoles.includes('audit_manager')) {
        hasModuleAccessForRole = hasModuleAccess(userRole, 'audit');
      }
      
      // If route requires hr_manager, check if user has hr module access
      if (allowedRoles.includes('hr_manager') && !hasModuleAccessForRole) {
        hasModuleAccessForRole = hasModuleAccess(userRole, 'hr');
      }
      
      // If no match found, deny access
      if (!hasModuleAccessForRole) {
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
                Your current role is <strong>{user.role}</strong>.
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