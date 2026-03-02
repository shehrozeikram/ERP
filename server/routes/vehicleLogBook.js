const express = require('express');
const router = express.Router();
const VehicleLogBook = require('../models/hr/VehicleLogBook');
const Vehicle = require('../models/hr/Vehicle');
const Employee = require('../models/hr/Employee');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/vehicle-logbook - Get all log book entries with filtering
router.get('/', async (req, res) => {
  try {
    const { 
      vehicleId, 
      driverId, 
      purpose, 
      status,
      search, 
      page = 1,
      limit = 25,
      startDate,
      endDate
    } = req.query;
    
    // Build filter
    const filter = {};
    if (vehicleId) filter.vehicleId = vehicleId;
    if (driverId) filter.driverId = driverId;
    if (purpose) filter.purpose = purpose;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { logId: { $regex: search, $options: 'i' } },
        { startLocation: { $regex: search, $options: 'i' } },
        { endLocation: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const logEntries = await VehicleLogBook.find(filter)
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('driverId', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ date: -1, startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VehicleLogBook.countDocuments(filter);

    res.json({
      success: true,
      data: logEntries,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching log book entries',
      error: error.message
    });
  }
});

// GET /api/vehicle-logbook/:id - Get single log book entry
router.get('/:id', async (req, res) => {
  try {
    const logEntry = await VehicleLogBook.findById(req.params.id)
      .populate('vehicleId', 'vehicleId make model licensePlate year color')
      .populate('driverId', 'firstName lastName employeeId department')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!logEntry) {
      return res.status(404).json({
        success: false,
        message: 'Log book entry not found'
      });
    }

    res.json({
      success: true,
      data: logEntry
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching log book entry',
      error: error.message
    });
  }
});

// GET /api/vehicle-logbook/vehicle/:vehicleId - Get log book entries for specific vehicle
router.get('/vehicle/:vehicleId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const logEntries = await VehicleLogBook.find({ vehicleId: req.params.vehicleId })
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('driverId', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ date: -1, startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VehicleLogBook.countDocuments({ vehicleId: req.params.vehicleId });

    res.json({
      success: true,
      data: logEntries,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicle log book entries',
      error: error.message
    });
  }
});

// GET /api/vehicle-logbook/driver/:driverId - Get log book entries for specific driver
router.get('/driver/:driverId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const logEntries = await VehicleLogBook.find({ driverId: req.params.driverId })
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('driverId', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ date: -1, startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VehicleLogBook.countDocuments({ driverId: req.params.driverId });

    res.json({
      success: true,
      data: logEntries,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching driver log book entries',
      error: error.message
    });
  }
});

// POST /api/vehicle-logbook - Create new log book entry
router.post('/', permissions.checkPermission('vehicle_create'), async (req, res) => {
  try {
    const logData = {
      ...req.body,
      createdBy: req.user._id
    };

    const logEntry = new VehicleLogBook(logData);
    await logEntry.save();

    const populatedLogEntry = await VehicleLogBook.findById(logEntry._id)
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('driverId', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Log book entry created successfully',
      data: populatedLogEntry
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating log book entry',
      error: error.message
    });
  }
});

// PUT /api/vehicle-logbook/:id - Update log book entry
router.put('/:id', permissions.checkPermission('vehicle_update'), async (req, res) => {
  try {
    const logEntry = await VehicleLogBook.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('driverId', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!logEntry) {
      return res.status(404).json({
        success: false,
        message: 'Log book entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Log book entry updated successfully',
      data: logEntry
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating log book entry',
      error: error.message
    });
  }
});

// PUT /api/vehicle-logbook/:id/status - Update log book entry status
router.put('/:id/status', permissions.checkPermission('vehicle_update'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['Active', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const updateData = { status };
    
    // If completing log entry, set approvedBy and approvedAt
    if (status === 'Completed') {
      updateData.approvedBy = req.user._id;
      updateData.approvedAt = new Date();
    }

    const logEntry = await VehicleLogBook.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('driverId', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!logEntry) {
      return res.status(404).json({
        success: false,
        message: 'Log book entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Log book entry status updated successfully',
      data: logEntry
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating log book entry status',
      error: error.message
    });
  }
});

// DELETE /api/vehicle-logbook/:id - Delete log book entry
router.delete('/:id', permissions.checkPermission('vehicle_delete'), async (req, res) => {
  try {
    const logEntry = await VehicleLogBook.findByIdAndDelete(req.params.id);

    if (!logEntry) {
      return res.status(404).json({
        success: false,
        message: 'Log book entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Log book entry deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting log book entry',
      error: error.message
    });
  }
});

// GET /api/vehicle-logbook/summary/overview - Get log book summary
router.get('/summary/overview', async (req, res) => {
  try {
    const totalEntries = await VehicleLogBook.countDocuments();
    const activeEntries = await VehicleLogBook.countDocuments({ status: 'Active' });
    const completedEntries = await VehicleLogBook.countDocuments({ status: 'Completed' });
    
    const totalDistance = await VehicleLogBook.aggregate([
      { $match: { status: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$distanceTraveled' } } }
    ]);

    const totalExpenses = await VehicleLogBook.aggregate([
      { $match: { status: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$totalExpenses' } } }
    ]);

    const totalFuelCost = await VehicleLogBook.aggregate([
      { $match: { status: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$fuelCost' } } }
    ]);

    const entriesByPurpose = await VehicleLogBook.aggregate([
      { $group: { _id: '$purpose', count: { $sum: 1 } } }
    ]);

    const topDrivers = await VehicleLogBook.aggregate([
      { $match: { status: 'Completed' } },
      { $group: { 
          _id: '$driverId', 
          totalDistance: { $sum: '$distanceTraveled' },
          totalEntries: { $sum: 1 }
        } 
      },
      { $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'driver'
        }
      },
      { $unwind: '$driver' },
      { $project: {
          driverName: { $concat: ['$driver.firstName', ' ', '$driver.lastName'] },
          totalDistance: 1,
          totalEntries: 1
        }
      },
      { $sort: { totalDistance: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      data: {
        totalEntries,
        activeEntries,
        completedEntries,
        totalDistance: totalDistance[0]?.total || 0,
        totalExpenses: totalExpenses[0]?.total || 0,
        totalFuelCost: totalFuelCost[0]?.total || 0,
        entriesByPurpose,
        topDrivers
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching log book summary',
      error: error.message
    });
  }
});

module.exports = router;

