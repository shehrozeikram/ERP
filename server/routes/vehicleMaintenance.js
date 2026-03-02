const express = require('express');
const router = express.Router();
const VehicleMaintenance = require('../models/hr/VehicleMaintenance');
const Vehicle = require('../models/hr/Vehicle');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/vehicle-maintenance - Get all maintenance records with filtering
router.get('/', async (req, res) => {
  try {
    const { 
      vehicleId, 
      status, 
      maintenanceType, 
      search, 
      page = 1,
      limit = 25,
      startDate,
      endDate
    } = req.query;
    
    // Build filter
    const filter = {};
    if (vehicleId) filter.vehicleId = vehicleId;
    if (status) filter.status = status;
    if (maintenanceType) filter.maintenanceType = maintenanceType;
    if (startDate || endDate) {
      filter.serviceDate = {};
      if (startDate) filter.serviceDate.$gte = new Date(startDate);
      if (endDate) filter.serviceDate.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { maintenanceId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { serviceProvider: { $regex: search, $options: 'i' } }
      ];
    }

    const maintenanceRecords = await VehicleMaintenance.find(filter)
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ serviceDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VehicleMaintenance.countDocuments(filter);

    res.json({
      success: true,
      data: maintenanceRecords,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching maintenance records',
      error: error.message
    });
  }
});

// GET /api/vehicle-maintenance/:id - Get single maintenance record
router.get('/:id', async (req, res) => {
  try {
    const maintenance = await VehicleMaintenance.findById(req.params.id)
      .populate('vehicleId', 'vehicleId make model licensePlate year color')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found'
      });
    }

    res.json({
      success: true,
      data: maintenance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching maintenance record',
      error: error.message
    });
  }
});

// GET /api/vehicle-maintenance/vehicle/:vehicleId - Get maintenance records for specific vehicle
router.get('/vehicle/:vehicleId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const maintenanceRecords = await VehicleMaintenance.find({ vehicleId: req.params.vehicleId })
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ serviceDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VehicleMaintenance.countDocuments({ vehicleId: req.params.vehicleId });

    res.json({
      success: true,
      data: maintenanceRecords,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicle maintenance records',
      error: error.message
    });
  }
});

// POST /api/vehicle-maintenance - Create new maintenance record
router.post('/', permissions.checkPermission('vehicle_create'), async (req, res) => {
  try {
    const maintenanceData = {
      ...req.body,
      createdBy: req.user._id
    };

    const maintenance = new VehicleMaintenance(maintenanceData);
    await maintenance.save();

    const populatedMaintenance = await VehicleMaintenance.findById(maintenance._id)
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Maintenance record created successfully',
      data: populatedMaintenance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating maintenance record',
      error: error.message
    });
  }
});

// PUT /api/vehicle-maintenance/:id - Update maintenance record
router.put('/:id', permissions.checkPermission('vehicle_update'), async (req, res) => {
  try {
    const maintenance = await VehicleMaintenance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found'
      });
    }

    res.json({
      success: true,
      message: 'Maintenance record updated successfully',
      data: maintenance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating maintenance record',
      error: error.message
    });
  }
});

// PUT /api/vehicle-maintenance/:id/status - Update maintenance status
router.put('/:id/status', permissions.checkPermission('vehicle_update'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['Scheduled', 'In Progress', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const updateData = { status };
    
    // If completing maintenance, set approvedBy and approvedAt
    if (status === 'Completed') {
      updateData.approvedBy = req.user._id;
      updateData.approvedAt = new Date();
    }

    const maintenance = await VehicleMaintenance.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('vehicleId', 'vehicleId make model licensePlate')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found'
      });
    }

    res.json({
      success: true,
      message: 'Maintenance status updated successfully',
      data: maintenance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating maintenance status',
      error: error.message
    });
  }
});

// DELETE /api/vehicle-maintenance/:id - Delete maintenance record
router.delete('/:id', permissions.checkPermission('vehicle_delete'), async (req, res) => {
  try {
    const maintenance = await VehicleMaintenance.findByIdAndDelete(req.params.id);

    if (!maintenance) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found'
      });
    }

    res.json({
      success: true,
      message: 'Maintenance record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting maintenance record',
      error: error.message
    });
  }
});

// GET /api/vehicle-maintenance/summary/overview - Get maintenance summary
router.get('/summary/overview', async (req, res) => {
  try {
    const totalMaintenance = await VehicleMaintenance.countDocuments();
    const pendingMaintenance = await VehicleMaintenance.countDocuments({ status: 'Scheduled' });
    const inProgressMaintenance = await VehicleMaintenance.countDocuments({ status: 'In Progress' });
    const completedMaintenance = await VehicleMaintenance.countDocuments({ status: 'Completed' });
    
    const totalCost = await VehicleMaintenance.aggregate([
      { $match: { status: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$cost' } } }
    ]);

    const totalPartsCost = await VehicleMaintenance.aggregate([
      { $match: { status: 'Completed' } },
      { $unwind: '$partsReplaced' },
      { $group: { _id: null, total: { $sum: '$partsReplaced.cost' } } }
    ]);

    const maintenanceByType = await VehicleMaintenance.aggregate([
      { $group: { _id: '$maintenanceType', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalMaintenance,
        pendingMaintenance,
        inProgressMaintenance,
        completedMaintenance,
        totalCost: totalCost[0]?.total || 0,
        totalPartsCost: totalPartsCost[0]?.total || 0,
        maintenanceByType
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching maintenance summary',
      error: error.message
    });
  }
});

module.exports = router;

