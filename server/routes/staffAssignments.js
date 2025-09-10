const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const StaffAssignment = require('../models/hr/StaffAssignment');
const Location = require('../models/hr/Location');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');

// Apply authentication middleware
router.use(authMiddleware);

// Get all staff assignments with optional filters
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      assignmentType, 
      status, 
      locationType,
      page = 1, 
      limit = 10 
    } = req.query;

    // Build query
    const query = {};
    
    if (assignmentType) query.assignmentType = assignmentType;
    if (status) query.status = status;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with population
    const assignments = await StaffAssignment.find(query)
      .populate('staffId', 'firstName lastName employeeId department position')
      .populate('locationId', 'name type address capacity currentOccupancy status')
      .populate('departmentId', 'name description')
      .populate('reportingManager', 'firstName lastName employeeId')
      .populate('assignedBy', 'firstName lastName')
      .sort({ startDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await StaffAssignment.countDocuments(query);

    // Filter by search term if provided
    let filteredAssignments = assignments;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredAssignments = assignments.filter(assignment => 
        assignment.staffId?.firstName?.toLowerCase().includes(searchLower) ||
        assignment.staffId?.lastName?.toLowerCase().includes(searchLower) ||
        assignment.staffId?.employeeId?.toLowerCase().includes(searchLower) ||
        assignment.locationId?.name?.toLowerCase().includes(searchLower) ||
        assignment.locationId?.address?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by location type if provided
    if (locationType) {
      filteredAssignments = filteredAssignments.filter(assignment => 
        assignment.locationId?.type === locationType
      );
    }

    res.json({
      success: true,
      data: filteredAssignments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching staff assignments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch staff assignments' });
  }
});

// Get staff assignments by type (guards, office staff, etc.)
router.get('/by-type/:assignmentType', async (req, res) => {
  try {
    const { assignmentType } = req.params;
    const { status = 'Active' } = req.query;

    const query = { 
      assignmentType,
      status 
    };

    const assignments = await StaffAssignment.find(query)
      .populate('staffId', 'firstName lastName employeeId department position')
      .populate('locationId', 'name type address capacity currentOccupancy status')
      .populate('departmentId', 'name description')
      .populate('reportingManager', 'firstName lastName employeeId')
      .populate('assignedBy', 'firstName lastName')
      .sort({ startDate: -1 });

    res.json({
      success: true,
      data: assignments,
      count: assignments.length,
      assignmentType,
      status
    });

  } catch (error) {
    console.error('Error fetching staff assignments by type:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch staff assignments by type',
      error: error.message 
    });
  }
});

// Get staff assignments summary by type
router.get('/summary', async (req, res) => {
  try {
    const summary = await StaffAssignment.aggregate([
      {
        $group: {
          _id: '$assignmentType',
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] }
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
          },
          suspended: {
            $sum: { $cond: [{ $eq: ['$status', 'Suspended'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error fetching staff assignments summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch staff assignments summary',
      error: error.message 
    });
  }
});

// Get single staff assignment
router.get('/:id', async (req, res) => {
  try {
    const assignment = await StaffAssignment.findById(req.params.id)
      .populate('staffId', 'firstName lastName employeeId department position')
      .populate('locationId', 'name type address capacity currentOccupancy status description')
      .populate('assignedBy', 'firstName lastName');

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Staff assignment not found' });
    }

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error('Error fetching staff assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch staff assignment' });
  }
});

// Create new staff assignment
router.post('/', permissions.checkPermission('staff_assignment_create'), async (req, res) => {
  try {
    const assignmentData = {
      ...req.body,
      assignedBy: req.user.id
    };

    // Check if staff already has an active assignment
    const existingAssignment = await StaffAssignment.findOne({
      staffId: assignmentData.staffId,
      status: 'Active'
    });

    if (existingAssignment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Staff member already has an active assignment' 
      });
    }

    // Check location capacity
    const location = await Location.findById(assignmentData.locationId);
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    if (location.currentOccupancy >= location.capacity) {
      return res.status(400).json({ 
        success: false, 
        message: 'Location is at full capacity' 
      });
    }

    const assignment = new StaffAssignment(assignmentData);
    await assignment.save();

    // Update location occupancy
    await Location.findByIdAndUpdate(assignmentData.locationId, {
      $inc: { currentOccupancy: 1 }
    });

    // Populate data for response
    await assignment.populate([
      { path: 'staffId', select: 'firstName lastName employeeId department position' },
      { path: 'locationId', select: 'name type address capacity currentOccupancy status' },
      { path: 'assignedBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    console.error('Error creating staff assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to create staff assignment' });
  }
});

// Update staff assignment
router.put('/:id', permissions.checkPermission('staff_assignment_update'), async (req, res) => {
  try {
    const assignment = await StaffAssignment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'staffId', select: 'firstName lastName employeeId department position' },
      { path: 'locationId', select: 'name type address capacity currentOccupancy status' },
      { path: 'assignedBy', select: 'firstName lastName' }
    ]);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Staff assignment not found' });
    }

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error('Error updating staff assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to update staff assignment' });
  }
});

// Delete staff assignment
router.delete('/:id', permissions.checkPermission('staff_assignment_delete'), async (req, res) => {
  try {
    const assignment = await StaffAssignment.findById(req.params.id);
    
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Staff assignment not found' });
    }

    // Update location occupancy
    if (assignment.status === 'Active') {
      await Location.findByIdAndUpdate(assignment.locationId, {
        $inc: { currentOccupancy: -1 }
      });
    }

    await StaffAssignment.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Staff assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete staff assignment' });
  }
});

// Transfer staff assignment
router.put('/:id/transfer', permissions.checkPermission('staff_assignment_update'), async (req, res) => {
  try {
    const { newLocationId, notes } = req.body;
    
    const assignment = await StaffAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Staff assignment not found' });
    }

    // Check new location capacity
    const newLocation = await Location.findById(newLocationId);
    if (!newLocation) {
      return res.status(404).json({ success: false, message: 'New location not found' });
    }

    if (newLocation.currentOccupancy >= newLocation.capacity) {
      return res.status(400).json({ 
        success: false, 
        message: 'New location is at full capacity' 
      });
    }

    // Update old location occupancy
    await Location.findByIdAndUpdate(assignment.locationId, {
      $inc: { currentOccupancy: -1 }
    });

    // Update assignment
    assignment.locationId = newLocationId;
    assignment.notes = notes || assignment.notes;
    await assignment.save();

    // Update new location occupancy
    await Location.findByIdAndUpdate(newLocationId, {
      $inc: { currentOccupancy: 1 }
    });

    // Populate data for response
    await assignment.populate([
      { path: 'staffId', select: 'firstName lastName employeeId department position' },
      { path: 'locationId', select: 'name type address capacity currentOccupancy status' },
      { path: 'assignedBy', select: 'firstName lastName' }
    ]);

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error('Error transferring staff assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to transfer staff assignment' });
  }
});

// Update assignment status
router.put('/:id/status', permissions.checkPermission('staff_assignment_update'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['Active', 'Completed', 'Transferred', 'Suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const assignment = await StaffAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Staff assignment not found' });
    }

    // Update location occupancy if status changes from/to Active
    if (assignment.status === 'Active' && status !== 'Active') {
      await Location.findByIdAndUpdate(assignment.locationId, {
        $inc: { currentOccupancy: -1 }
      });
    } else if (assignment.status !== 'Active' && status === 'Active') {
      const location = await Location.findById(assignment.locationId);
      if (location.currentOccupancy >= location.capacity) {
        return res.status(400).json({ 
          success: false, 
          message: 'Location is at full capacity' 
        });
      }
      await Location.findByIdAndUpdate(assignment.locationId, {
        $inc: { currentOccupancy: 1 }
      });
    }

    assignment.status = status;
    await assignment.save();

    // Populate data for response
    await assignment.populate([
      { path: 'staffId', select: 'firstName lastName employeeId department position' },
      { path: 'locationId', select: 'name type address capacity currentOccupancy status' },
      { path: 'assignedBy', select: 'firstName lastName' }
    ]);

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error('Error updating assignment status:', error);
    res.status(500).json({ success: false, message: 'Failed to update assignment status' });
  }
});

module.exports = router;
