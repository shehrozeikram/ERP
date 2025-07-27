import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { isRouteAccessible } from '../utils/permissions';

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
  const hasAccess = isRouteAccessible(user.role, location.pathname);
  console.log('Route access check:', {
    path: location.pathname,
    role: user.role,
    hasAccess,
    requiredRole
  });
  
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
  if (requiredRole && user.role !== requiredRole) {
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
            This page requires the <strong>{requiredRole}</strong> role.
            Your current role is <strong>{user.role}</strong>.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return children;
};

export default ProtectedRoute; 