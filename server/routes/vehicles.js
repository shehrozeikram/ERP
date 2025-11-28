const express = require('express');
const router = express.Router();
const Vehicle = require('../models/hr/Vehicle');
const Employee = require('../models/hr/Employee');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/vehicles - Get all vehicles with simple filtering
router.get('/', permissions.checkSubRolePermission('admin', 'vehicle_management', 'read'), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { vehicleId: { $regex: search, $options: 'i' } },
        { make: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { licensePlate: { $regex: search, $options: 'i' } }
      ];
    }

    const vehicles = await Vehicle.find(filter)
      .populate('assignedDriver', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vehicle.countDocuments(filter);

    res.json({
      success: true,
      data: vehicles,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicles',
      error: error.message
    });
  }
});

// GET /api/vehicles/available - Get available vehicles only
router.get('/available', permissions.checkSubRolePermission('admin', 'vehicle_management', 'read'), async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ status: 'Available' })
      .select('vehicleId make model year licensePlate color capacity')
      .sort({ vehicleId: 1 });

    res.json({
      success: true,
      data: vehicles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching available vehicles',
      error: error.message
    });
  }
});

// GET /api/vehicles/next-id - Get next available Vehicle ID
router.get('/next-id', permissions.checkSubRolePermission('admin', 'vehicle_management', 'create'), async (req, res) => {
  try {
    // Find the highest numeric Vehicle ID
    const vehicles = await Vehicle.find({})
      .select('vehicleId')
      .sort({ vehicleId: -1 })
      .limit(1);

    let nextId = 1;
    
    if (vehicles.length > 0 && vehicles[0].vehicleId) {
      // Extract numeric part from Vehicle ID (e.g., "VH001" -> 1, "VH123" -> 123)
      const match = vehicles[0].vehicleId.match(/\d+/);
      if (match) {
        nextId = parseInt(match[0]) + 1;
      }
    }

    // Format as VH001, VH002, etc.
    const formattedId = `VH${String(nextId).padStart(3, '0')}`;

    res.json({
      success: true,
      data: { nextVehicleId: formattedId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating next Vehicle ID',
      error: error.message
    });
  }
});

// GET /api/vehicles/:id - Get single vehicle
router.get('/:id', permissions.checkSubRolePermission('admin', 'vehicle_management', 'read'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('assignedDriver', 'firstName lastName employeeId department position')
      .populate('createdBy', 'firstName lastName');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      data: vehicle
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicle',
      error: error.message
    });
  }
});

// POST /api/vehicles - Create new vehicle
router.post('/', permissions.checkSubRolePermission('admin', 'vehicle_management', 'create'), async (req, res) => {
  try {
    // Auto-generate Vehicle ID if not provided
    let vehicleId = req.body.vehicleId;
    if (!vehicleId) {
      // Find the highest numeric Vehicle ID
      const vehicles = await Vehicle.find({})
        .select('vehicleId')
        .sort({ vehicleId: -1 })
        .limit(1);

      let nextId = 1;
      
      if (vehicles.length > 0 && vehicles[0].vehicleId) {
        // Extract numeric part from Vehicle ID (e.g., "VH001" -> 1, "VH123" -> 123)
        const match = vehicles[0].vehicleId.match(/\d+/);
        if (match) {
          nextId = parseInt(match[0]) + 1;
        }
      }

      // Format as VH001, VH002, etc.
      vehicleId = `VH${String(nextId).padStart(3, '0')}`;
    }

    const vehicleData = {
      ...req.body,
      vehicleId,
      createdBy: req.user._id
    };

    // Remove purchasePrice if it exists (field is being removed)
    delete vehicleData.purchasePrice;

    const vehicle = new Vehicle(vehicleData);
    await vehicle.save();

    const populatedVehicle = await Vehicle.findById(vehicle._id)
      .populate('assignedDriver', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data: populatedVehicle
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID or License Plate already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating vehicle',
      error: error.message
    });
  }
});

// PUT /api/vehicles/:id - Update vehicle
router.put('/:id', permissions.checkSubRolePermission('admin', 'vehicle_management', 'update'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('assignedDriver', 'firstName lastName employeeId')
     .populate('createdBy', 'firstName lastName');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      data: vehicle
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID or License Plate already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating vehicle',
      error: error.message
    });
  }
});

// PUT /api/vehicles/:id/assign - Assign driver to vehicle
router.put('/:id/assign', permissions.checkSubRolePermission('admin', 'vehicle_management', 'update'), async (req, res) => {
  try {
    const { driverId } = req.body;

    // Check if driver exists
    if (driverId) {
      const driver = await Employee.findById(driverId);
      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }
    }

    const vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { assignedDriver: driverId || null },
      { new: true, runValidators: true }
    ).populate('assignedDriver', 'firstName lastName employeeId')
     .populate('createdBy', 'firstName lastName');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      message: driverId ? 'Driver assigned successfully' : 'Driver unassigned successfully',
      data: vehicle
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning driver',
      error: error.message
    });
  }
});

// DELETE /api/vehicles/:id - Delete vehicle
router.delete('/:id', permissions.checkSubRolePermission('admin', 'vehicle_management', 'delete'), async (req, res) => {
  try {
    const vehicle = await Vehicle.findByIdAndDelete(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting vehicle',
      error: error.message
    });
  }
});

module.exports = router;
