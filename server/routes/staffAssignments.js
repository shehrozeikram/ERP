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

    // Text search
    if (search) {
      query.$or = [
        { 'staffId.firstName': { $regex: search, $options: 'i' } },
        { 'staffId.lastName': { $regex: search, $options: 'i' } },
        { 'staffId.employeeId': { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    // Location type filter
    if (locationType) {
      query['locationId.type'] = locationType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const assignments = await StaffAssignment.find(query)
      .populate('staffId', 'firstName lastName employeeId department position')
      .populate('locationId', 'name type address capacity currentOccupancy status')
      .populate('departmentId', 'name description')
      .populate('reportingManager', 'firstName lastName employeeId')
      .populate('assignedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await StaffAssignment.countDocuments(query);

    res.json({
      success: true,
      data: assignments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching staff assignments:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch staff assignments',
      error: error.message 
    });
  }
});

// Get assignments by type
router.get('/by-type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { status = 'Active' } = req.query;

    const assignments = await StaffAssignment.find({ 
      assignmentType: type,
      status: status 
    })
      .populate('staffId', 'firstName lastName employeeId department position')
      .populate('locationId', 'name type address capacity currentOccupancy status')
      .populate('departmentId', 'name description')
      .populate('reportingManager', 'firstName lastName employeeId')
      .populate('assignedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error(`Error fetching ${type} assignments:`, error);
    res.status(500).json({ 
      success: false, 
      message: `Failed to fetch ${type} assignments`,
      error: error.message 
    });
  }
});

// Get summary of assignments
router.get('/summary', async (req, res) => {
  try {
    const summary = await StaffAssignment.aggregate([
      {
        $group: {
          _id: '$assignmentType',
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Active'] }, 1, 0]
            }
          },
          inactive: {
            $sum: {
              $cond: [{ $ne: ['$status', 'Active'] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const totalStaff = summary.reduce((sum, item) => sum + item.total, 0);
    const activeStaff = summary.reduce((sum, item) => sum + item.active, 0);

    res.json({
      success: true,
      data: summary,
      overall: {
        totalStaff,
        activeStaff,
        utilizationRate: totalStaff > 0 ? Math.round((activeStaff / totalStaff) * 100) : 0
      }
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
      .populate('departmentId', 'name description')
      .populate('reportingManager', 'firstName lastName employeeId')
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
router.post('/', async (req, res) => {
  try {
    
    // Sanitize data - convert empty strings to null for ObjectId fields
    const cleanedData = {
      ...req.body,
      departmentId: req.body.departmentId === '' ? null : req.body.departmentId,
      locationId: req.body.locationId === '' ? null : req.body.locationId,
      reportingManager: req.body.reportingManager === '' ? null : req.body.reportingManager
    };

    const assignmentData = {
      ...cleanedData,
      assignedBy: req.user.id
    };
    

    // Validate required fields
    if (!assignmentData.staffId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Staff member is required' 
      });
    }

    if (!assignmentData.assignmentType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Assignment type is required' 
      });
    }

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

    // Check location capacity only if locationId is provided
    if (assignmentData.locationId) {
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
    }

    const assignment = new StaffAssignment(assignmentData);
    await assignment.save();

    // Update location occupancy only if locationId is provided
    if (assignmentData.locationId) {
      await Location.findByIdAndUpdate(assignmentData.locationId, {
        $inc: { currentOccupancy: 1}
      });
    }

    // Populate data for response
    const populatePaths = [
      { path: 'staffId', select: 'firstName lastName employeeId department position' },
      { path: 'assignedBy', select: 'firstName lastName' }
    ];
    
    if (assignmentData.locationId) {
      populatePaths.push({ path: 'locationId', select: 'name type address capacity currentOccupancy status' });
    }
    
    if (assignmentData.departmentId) {
      populatePaths.push({ path: 'departmentId', select: 'name description' });
    }
    
    if (assignmentData.reportingManager) {
      populatePaths.push({ path: 'reportingManager', select: 'firstName lastName employeeId' });
    }

    await assignment.populate(populatePaths);

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    console.error('Error creating staff assignment:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create staff assignment',
      error: error.message
    });
  }
});

// Update staff assignment
router.put('/:id', permissions.checkPermission('staff_assignment_update'), async (req, res) => {
  try {
    // Sanitize data - convert empty strings to null for ObjectId fields
    const sanitizedData = {
      ...req.body,
      departmentId: req.body.departmentId === '' ? null : req.body.departmentId,
      locationId: req.body.locationId === '' ? null : req.body.locationId,
      reportingManager: req.body.reportingManager === '' ? null : req.body.reportingManager
    };

    const assignment = await StaffAssignment.findByIdAndUpdate(
      req.params.id,
      sanitizedData,
      { new: true, runValidators: true }
    );

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Staff assignment not found' });
    }

    await assignment.populate([
      { path: 'staffId', select: 'firstName lastName employeeId department position' },
      { path: 'locationId', select: 'name type address capacity currentOccupancy status' },
      { path: 'assignedBy', select: 'firstName lastName' }
    ]);

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

    // If assignment has location, decrement occupancy
    if (assignment.locationId) {
      await Location.findByIdAndUpdate(assignment.locationId, {
        $inc: { currentOccupancy: -1}
      });
    }

    await StaffAssignment.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Staff assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to delete staff assignment' });
  }
});

module.exports = router;