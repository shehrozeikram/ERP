const express = require('express');
const router = express.Router();
const StaffManagementService = require('../services/staffManagementService');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// ==================== STAFF TYPE ROUTES ====================

/**
 * GET /api/staff-management/staff-types
 * Get all staff types with optional filtering
 */
router.get('/staff-types', authMiddleware, async (req, res) => {
  try {
    const {
      includeInactive = false,
      populateTargets = false,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const staffTypes = await StaffManagementService.getStaffTypes({
      includeInactive: includeInactive === 'true',
      populateTargets: populateTargets === 'true',
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      data: staffTypes,
      count: staffTypes.length
    });
  } catch (error) {
    console.error('Error fetching staff types:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch staff types'
    });
  }
});

/**
 * POST /api/staff-management/staff-types
 * Create a new staff type
 */
router.post('/staff-types', authMiddleware, checkPermission('hr_manager'), async (req, res) => {
  try {
    const staffType = await StaffManagementService.createStaffType(req.body, req.user._id);
    
    res.status(201).json({
      success: true,
      message: 'Staff type created successfully',
      data: staffType
    });
  } catch (error) {
    console.error('Error creating staff type:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create staff type'
    });
  }
});

/**
 * PUT /api/staff-management/staff-types/:id
 * Update staff type
 */
router.put('/staff-types/:id', authMiddleware, checkPermission('hr_manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const staffType = await StaffManagementService.updateStaffType(id, req.body, req.user._id);
    
    res.json({
      success: true,
      message: 'Staff type updated successfully',
      data: staffType
    });
  } catch (error) {
    console.error('Error updating staff type:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update staff type'
    });
  }
});

// ==================== STAFF ASSIGNMENT ROUTES ====================

/**
 * GET /api/staff-management/assignments
 * Get staff assignments with advanced filtering
 */
router.get('/assignments', authMiddleware, async (req, res) => {
  try {
    const filters = {
      employeeId: req.query.employeeId,
      staffTypeId: req.query.staffTypeId,
      targetType: req.query.targetType,
      targetId: req.query.targetId,
      status: req.query.status || 'Active',
      includeCompleted: req.query.includeCompleted === 'true',
      sortBy: req.query.sortBy || 'startDate',
      sortOrder: req.query.sortOrder || 'desc',
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100) // Max 100 per page
    };

    const result = await StaffManagementService.getAssignments(filters);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assignments'
    });
  }
});

/**
 * POST /api/staff-management/assignments
 * Create new staff assignment
 */
router.post('/assignments', authMiddleware, checkPermission('hr_manager'), async (req, res) => {
  try {
    const assignment = await StaffManagementService.createAssignment(req.body, req.user._id);
    
    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create assignment'
    });
  }
});

/**
 * PUT /api/staff-management/assignments/:id
 * Update staff assignment
 */
router.put('/assignments/:id', authMiddleware, checkPermission('hr_manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await StaffManagementService.updateAssignment(id, req.body, req.user._id);
    
    res.json({
      success: true,
      message: 'Assignment updated successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update assignment'
    });
  }
});

/**
 * DELETE /api/staff-management/assignments/:id
 * Cancel/delete staff attachment
 */
router.delete('/assignments/:id', authMiddleware, checkPermission('hr_manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const assignment = await StaffManagementService.updateAssignment(
      id, 
      { status: 'Cancelled', notes: reason }, 
      req.user._id
    );
    
    res.json({
      success: true,
      message: 'Assignment cancelled successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Error cancelling assignment:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to cancel assignment'
    });
  }
});

// ==================== DASHBOARD AND ANALYTICS ROUTES ====================

/**
 * GET /api/staff-management/dashboard
 * Get dashboard data for staff management
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const dashboardData = await StaffManagementService.getDashboardData();
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard data'
    });
  }
});

/**
 * GET /api/staff-management/assignment-targets/:staffTypeId
 * Get available assignment targets for a staff type
 */
router.get('/assignment-targets/:staffTypeId', authMiddleware, async (req, res) => {
  try {
    const { staffTypeId } = req.params;
    const targets = await StaffManagementService.getAssignmentTargets(staffTypeId);
    
    res.json({
      success: true,
      data: targets
    });
  } catch (error) {
    console.error('Error fetching assignment targets:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assignment targets'
    });
  }
});

// ==================== SEARCH AND FILTERING ROUTES ====================

/**
 * GET /api/staff-management/search
 * Search assignments with full-text search
 */
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q: searchTerm, ...filters } = req.query;
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search term must be at least 2 characters'
      });
    }

    const results = await StaffManagementService.searchAssignments(searchTerm.trim(), filters);
    
    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('Error searching assignments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Search failed'
    });
  }
});

/**
 * POST /api/staff-management/bulk-update
 * Bulk update multiple assignments
 */
router.post('/bulk-update', authMiddleware, checkPermission('hr_manager'), async (req, res) => {
  try {
    const { assignmentIds, updateData } = req.body;
    
    if (!assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Assignment IDs are required'
      });
    }
    
    const result = await StaffManagementService.bulkUpdateAssignments(
      assignmentIds, 
      updateData, 
      req.user._id
    );
    
    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} assignments successfully`,
      data: result
    });
  } catch (error) {
    console.error('Error bulk updating assignments:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to bulk update assignments'
    });
  }
});

// ==================== SPECIALIZED QUERIES ====================

/**
 * GET /api/staff-management/employee-assignments/:employeeId
 * Get all assignments for a specific employee
 */
router.get('/employee-assignments/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const assignments = await StaffManagementService.getActiveByEmployee(employeeId);
    
    res.json({
      success: true,
      data: assignments,
      count: assignments.length
    });
  } catch (error) {
    console.error('Error fetching employee assignments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch employee assignments'
    });
  }
});

/**
 * GET /api/staff-management/staff-type-assignments/:staffTypeId
 * Get all assignments for a specific staff type
 */
router.get('/staff-type-assignments/:staffTypeId', authMiddleware, async (req, res) => {
  try {
    const { staffTypeId } = req.params;
    const { status = 'Active' } = req.query;
    
    const assignments = await StaffManagementService.getByStaffType(staffTypeId, status);
    
    res.json({
      success: true,
      data: assignments,
      count: assignments.length
    });
  } catch (error) {
    console.error('Error fetching staff type assignments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch staff type assignments'
    });
  }
});

/**
 * GET /api/staff-management/target-assignments
 * Get assignments by specific target
 */
router.get('/target-assignments', authMiddleware, async (req, res) => {
  try {
    const { targetType, targetId, status = 'Active' } = req.query;
    
    if (!targetType || !targetId) {
      return res.status(400).json({
        success: false,
        message: 'Target type and target ID are required'
      });
    }
    
    const assignments = await StaffManagementService.getByTarget(targetType, targetId, status);
    
    res.json({
      success: true,
      data: assignments,
      count: assignments.length
    });
  } catch (error) {
    console.error('Error fetching target assignments:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch target assignments'
    });
  }
});

module.exports = router;
