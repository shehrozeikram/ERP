const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const AuditTrail = require('../models/audit/AuditTrail');

// ================================
// AUDIT TRAIL ROUTES
// ================================

// @route   GET /api/audit/trail
// @desc    Get audit trail logs with filtering and pagination
// @access  Private (Super Admin, Audit Manager)
router.get('/', 
  authorize('super_admin', 'audit_manager'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 50,
      action,
      module,
      entityType,
      userId,
      riskLevel,
      isSuspicious,
      startDate,
      endDate,
      search,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filters = {};
    
    if (action) filters.action = action;
    if (module) filters.module = module;
    if (entityType) filters.entityType = entityType;
    if (userId) filters.userId = userId;
    if (riskLevel) filters.riskLevel = riskLevel;
    if (isSuspicious !== undefined) filters.isSuspicious = isSuspicious === 'true';
    
    if (startDate || endDate) {
      filters.timestamp = {};
      if (startDate) filters.timestamp.$gte = new Date(startDate);
      if (endDate) filters.timestamp.$lte = new Date(endDate);
    }

    // Search functionality
    if (search) {
      filters.$or = [
        { description: { $regex: search, $options: 'i' } },
        { entityName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [trailEntries, totalCount] = await Promise.all([
      AuditTrail.find(filters)
        .populate('userId', 'firstName lastName email role department profileImage avatar image photo')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      AuditTrail.countDocuments(filters)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        trailEntries,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage,
          hasPrevPage,
          limit: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/audit/trail/statistics
// @desc    Get audit trail statistics
// @access  Private (Super Admin, Audit Manager)
router.get('/statistics', 
  authorize('super_admin', 'audit_manager'),
  asyncHandler(async (req, res) => {
    const { module, action, startDate, endDate, userId } = req.query;
    
    const filters = {};
    if (module) filters.module = module;
    if (action) filters.action = action;
    if (userId) filters.userId = userId;
    if (startDate || endDate) {
      filters.timestamp = {};
      if (startDate) filters.timestamp.$gte = new Date(startDate);
      if (endDate) filters.timestamp.$lte = new Date(endDate);
    }

    const statistics = await AuditTrail.getStatistics(filters);

    // Additional statistics by module and action
    const moduleStats = await AuditTrail.aggregate([
      { $match: { timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, ...filters } },
      {
        $group: {
          _id: '$module',
          count: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const actionStats = await AuditTrail.aggregate([
      { $match: { timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, ...filters } },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const riskStats = await AuditTrail.aggregate([
      { $match: { timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, ...filters } },
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        ...statistics,
        moduleBreakdown: moduleStats,
        actionBreakdown: actionStats,
        riskBreakdown: riskStats
      }
    });
  })
);

// @route   GET /api/audit/trail/user/:userId
// @desc    Get user activity summary
// @access  Private (Super Admin, Audit Manager)
router.get('/trail/user/:userId', 
  authorize('super_admin', 'audit_manager'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const activitySummary = await AuditTrail.getUserActivitySummary(userId, parseInt(days));

    res.json({
      success: true,
      data: activitySummary
    });
  })
);

// @route   GET /api/audit/trail/anomalies
// @desc    Detect anomalies in audit trail
// @access  Private (Super Admin, Audit Manager)
router.get('/trail/anomalies', 
  authorize('super_admin', 'audit_manager'),
  asyncHandler(async (req, res) => {
    const { hours = 24 } = req.query;

    const anomalies = await AuditTrail.detectAnomalies(parseInt(hours));

    res.json({
      success: true,
      data: anomalies
    });
  })
);

// @route   GET /api/audit/trail/entity/:entityType/:entityId
// @desc    Get audit trail for a specific entity
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/trail/entity/:entityType/:entityId', 
  authorize('super_admin', 'audit_manager', 'auditor'),
  asyncHandler(async (req, res) => {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [trailEntries, totalCount] = await Promise.all([
      AuditTrail.find({
        entityType,
        entityId
      })
        .populate('userId', 'firstName lastName email role department profileImage avatar image photo')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditTrail.countDocuments({
        entityType,
        entityId
      })
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        trailEntries,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  })
);

// @route   GET /api/audit/trail/export
// @desc    Export audit trail to CSV
// @access  Private (Super Admin, Audit Manager)
router.get('/trail/export', 
  authorize('super_admin', 'audit_manager'),
  asyncHandler(async (req, res) => {
    const {
      startDate,
      endDate,
      module,
      action,
      entityType,
      userId,
      riskLevel,
      format = 'csv'
    } = req.query;

    // Build filter object
    const filters = {};
    
    if (module) filters.module = module;
    if (action) filters.action = action;
    if (entityType) filters.entityType = entityType;
    if (userId) filters.userId = userId;
    if (riskLevel) filters.riskLevel = riskLevel;
    
    if (startDate || endDate) {
      filters.timestamp = {};
      if (startDate) filters.timestamp.$gte = new Date(startDate);
      if (endDate) filters.timestamp.$lte = new Date(endDate);
    }

    const trailEntries = await AuditTrail.find(filters)
      .populate('userId', 'firstName lastName email role department')
      .sort({ timestamp: -1 })
      .limit(10000); // Limit to prevent memory issues

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Timestamp,User,Email,Role,Department,Action,Module,Entity Type,Entity Name,Description,IP Address,Risk Level,Status\n';
      
      const csvRows = trailEntries.map(entry => {
        const user = entry.userId || {};
        return [
          entry.timestamp.toISOString(),
          `"${user.firstName || ''} ${user.lastName || ''}"`.replace(/""/g, '""'),
          `"${user.email || ''}"`.replace(/""/g, '""'),
          `"${user.role || ''}"`.replace(/""/g, '""'),
          `"${user.department || ''}"`.replace(/""/g, '""'),
          entry.action,
          entry.module,
          entry.entityType,
          `"${entry.entityName || ''}"`.replace(/""/g, '""'),
          `"${entry.description || ''}"`.replace(/""/g, '""'),
          entry.ipAddress || '',
          entry.riskLevel,
          entry.status
        ].join(',');
      });

      const csvContent = csvHeader + csvRows.join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } else {
      // Return JSON format
      res.json({
        success: true,
        data: trailEntries,
        exportInfo: {
          totalRecords: trailEntries.length,
          exportedAt: new Date(),
          filters: filters
        }
      });
    }
  })
);

// @route   GET /api/audit/trail/realtime
// @desc    Get real-time audit trail updates (for dashboard)
// @access  Private (Super Admin, Audit Manager)
router.get('/realtime', 
  authorize('super_admin', 'audit_manager'),
  asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;

    // Get recent activities (last 24 hours)
    const recentActivities = await AuditTrail.find({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
      .populate('userId', 'firstName lastName email role profileImage avatar image photo')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    // Get suspicious activities
    const suspiciousActivities = await AuditTrail.find({
      isSuspicious: true,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
      .populate('userId', 'firstName lastName email role profileImage avatar image photo')
      .sort({ timestamp: -1 })
      .limit(10);

    // Get high-risk activities
    const highRiskActivities = await AuditTrail.find({
      riskLevel: { $in: ['high', 'critical'] },
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
      .populate('userId', 'firstName lastName email role profileImage avatar image photo')
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        recentActivities,
        suspiciousActivities,
        highRiskActivities
      }
    });
  })
);

module.exports = router;
