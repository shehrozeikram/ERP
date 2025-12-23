const express = require('express');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');
const UserLoginLog = require('../models/general/UserLoginLog');
const UserActivityLog = require('../models/general/UserActivityLog');
const { asyncHandler } = require('../middleware/errorHandler');

// @route   GET /api/tracking/logins
// @desc    Get login history with filters
// @access  Private (Admin/Higher Management)
router.get('/logins', authMiddleware, authorize('super_admin', 'higher_management', 'admin'), asyncHandler(async (req, res) => {
  const {
    userId,
    startDate,
    endDate,
    ipAddress,
    status,
    page = 1,
    limit = 50
  } = req.query;

  // Build query
  const query = {};
  
  if (userId) {
    query.userId = userId;
  }
  
  if (ipAddress) {
    query.ipAddress = { $regex: ipAddress, $options: 'i' };
  }
  
  if (status) {
    query.status = status;
  }
  
  if (startDate || endDate) {
    query.loginTime = {};
    if (startDate) {
      // Handle both YYYY-MM-DD format and full ISO date strings
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of day
      query.loginTime.$gte = start;
    }
    if (endDate) {
      // Handle both YYYY-MM-DD format and full ISO date strings
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day
      query.loginTime.$lte = end;
    }
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Execute query
  const [logs, total] = await Promise.all([
    UserLoginLog.find(query)
      .populate('userId', 'firstName lastName email employeeId')
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    UserLoginLog.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

// @route   GET /api/tracking/activities
// @desc    Get user activity history with filters
// @access  Private (Admin/Higher Management)
router.get('/activities', authMiddleware, authorize('super_admin', 'higher_management', 'admin'), asyncHandler(async (req, res) => {
  const {
    userId,
    module,
    actionType,
    startDate,
    endDate,
    ipAddress,
    page = 1,
    limit = 100
  } = req.query;

  // Build query
  const query = {};
  
  if (userId) {
    query.userId = userId;
  }
  
  if (module) {
    query.module = module;
  }
  
  if (actionType) {
    query.actionType = actionType;
  }
  
  if (ipAddress) {
    query.ipAddress = { $regex: ipAddress, $options: 'i' };
  }
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) {
      // Handle both YYYY-MM-DD format and full ISO date strings
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of day
      query.timestamp.$gte = start;
    }
    if (endDate) {
      // Handle both YYYY-MM-DD format and full ISO date strings
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day
      query.timestamp.$lte = end;
    }
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Execute query
  const [logs, total] = await Promise.all([
    UserActivityLog.find(query)
      .populate('userId', 'firstName lastName email employeeId')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    UserActivityLog.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
}));

// @route   GET /api/tracking/sessions
// @desc    Get active sessions
// @access  Private (Admin/Higher Management)
router.get('/sessions', authMiddleware, authorize('super_admin', 'higher_management', 'admin'), asyncHandler(async (req, res) => {
  const activeSessions = await UserLoginLog.findActiveSessions();
  
  res.json({
    success: true,
    data: {
      sessions: activeSessions,
      count: activeSessions.length
    }
  });
}));

// @route   GET /api/tracking/stats
// @desc    Get tracking statistics
// @access  Private (Admin/Higher Management)
router.get('/stats', authMiddleware, authorize('super_admin', 'higher_management', 'admin'), asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const dateQuery = {};
  if (startDate || endDate) {
    dateQuery.loginTime = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of day
      dateQuery.loginTime.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day
      dateQuery.loginTime.$lte = end;
    }
  }

  const [
    totalLogins,
    activeSessions,
    uniqueUsers,
    recentActivities
  ] = await Promise.all([
    UserLoginLog.countDocuments(dateQuery),
    UserLoginLog.countDocuments({ ...dateQuery, status: 'active' }),
    UserLoginLog.distinct('userId', dateQuery).then(ids => ids.length),
    UserActivityLog.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
  ]);

  res.json({
    success: true,
    data: {
      totalLogins,
      activeSessions,
      uniqueUsers,
      recentActivities24h: recentActivities
    }
  });
}));

// @route   GET /api/tracking/user/:userId
// @desc    Get tracking data for a specific user
// @access  Private (Admin/Higher Management)
router.get('/user/:userId', authMiddleware, authorize('super_admin', 'higher_management', 'admin'), asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = 50 } = req.query;

  const [loginHistory, activities] = await Promise.all([
    UserLoginLog.findUserHistory(userId, parseInt(limit)),
    UserActivityLog.findUserActivities(userId, parseInt(limit))
  ]);

  res.json({
    success: true,
    data: {
      loginHistory,
      activities
    }
  });
}));

module.exports = router;

