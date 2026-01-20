const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ROLE_MODULE_ACCESS } = require('../config/permissions');

// Helper functions
const sendError = (res, status, message) => res.status(status).json({ success: false, message });
const isDbError = (error) => 
  error.name === 'MongoTimeoutError' || 
  error.name === 'MongoNetworkError' || 
  error.message?.includes('timeout') || 
  error.message?.includes('connection');

// Normalize role name for comparison (handle case and spaces)
const normalizeRole = (role) => {
  if (!role) return '';
  return String(role).toLowerCase().replace(/\s+/g, '_');
};

// Get role config from permissions, checking multiple variations
const getRoleConfig = (role) => {
  if (!role) return null;
  return ROLE_MODULE_ACCESS[role] || 
         ROLE_MODULE_ACCESS[normalizeRole(role)] ||
         ROLE_MODULE_ACCESS[role.toLowerCase()] ||
         null;
};

const verifyToken = (token) => {
  try {
    return { decoded: jwt.verify(token, process.env.JWT_SECRET), error: null };
  } catch (error) {
    return { decoded: null, error };
  }
};

const fetchUser = async (userId) => {
  try {
    return { user: await User.findById(userId).select('-password').maxTimeMS(5000), error: null };
  } catch (error) {
    return { user: null, error };
  }
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return sendError(res, 401, 'Access denied. No token provided.');

    // Verify JWT token
    const { decoded, error: jwtError } = verifyToken(token);
    if (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') return sendError(res, 401, 'Invalid token.');
      if (jwtError.name === 'TokenExpiredError') return sendError(res, 401, 'Token expired. Please login again.');
      throw jwtError;
    }
    
    // Fetch user from database
    const { user, error: dbError } = await fetchUser(decoded.userId);
    if (dbError) {
      if (isDbError(dbError)) {
        console.error('⚠️ Database error in auth middleware:', dbError.message);
        return sendError(res, 503, 'Service temporarily unavailable. Please try again in a moment.');
      }
      throw dbError;
    }
    
    if (!user) return sendError(res, 401, 'Invalid token. User not found.');
    if (!user.isActive) return sendError(res, 401, 'Account is deactivated. Please contact administrator.');

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return sendError(res, 500, 'Server error in authentication.');
  }
};

// Optional auth middleware for routes that can work with or without authentication
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  // Pre-normalize allowed roles once
  const normalizedAllowedRoles = roles.map(normalizeRole);
  const requiresHrManager = normalizedAllowedRoles.includes('hr_manager');
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }

    const userRole = req.user.role;
    
    // Super Admin and Higher Management have access to everything
    if (userRole === 'super_admin' || userRole === 'higher_management') {
      return next();
    }

    // Check exact match (normalized)
    if (normalizedAllowedRoles.includes(normalizeRole(userRole))) {
      return next();
    }
    
    // If route requires hr_manager, check if user's role has HR module access
    if (requiresHrManager) {
      const roleConfig = getRoleConfig(userRole);
      if (roleConfig?.modules?.includes('hr')) {
        return next();
      }
    }
    
    // Access denied
    return res.status(403).json({
      success: false,
      message: 'Access denied. Insufficient permissions.'
    });
  };
};

module.exports = {
  authMiddleware,
  optionalAuth,
  authorize
}; 