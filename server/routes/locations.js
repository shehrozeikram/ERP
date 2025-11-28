const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const Location = require('../models/hr/Location');

// Apply authentication middleware
router.use(authMiddleware);

// Get all locations with optional filters
router.get('/', permissions.checkSubRolePermission('admin', 'staff_management', 'read'), async (req, res) => {
  try {
    const { search, type, status, page = 1, limit = 10 } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [locations, total] = await Promise.all([
      Location.find(query)
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Location.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: locations,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch locations' });
  }
});

// Get single location
router.get('/:id', permissions.checkSubRolePermission('admin', 'staff_management', 'read'), async (req, res) => {
  try {
    const location = await Location.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    res.json({ success: true, data: location });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid location ID' });
    }
    console.error('Error fetching location:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch location' });
  }
});

// Create new location
router.post('/', permissions.checkSubRolePermission('admin', 'staff_management', 'create'), async (req, res) => {
  try {
    // Check for duplicate name
    const existingLocation = await Location.findOne({ name: req.body.name?.trim() });
    if (existingLocation) {
      return res.status(400).json({
        success: false,
        message: 'A location with this name already exists'
      });
    }

    const locationData = {
      ...req.body,
      createdBy: req.user.id,
      status: req.body.status || 'Active'
    };

    const location = new Location(locationData);
    await location.save();
    await location.populate('createdBy', 'firstName lastName');

    res.status(201).json({ success: true, data: location });
  } catch (error) {
    console.error('Error creating location:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return res.status(400).json({
        success: false,
        message: `A location with this ${field} already exists`
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({ success: false, message: 'Failed to create location' });
  }
});

// Update location
router.put('/:id', permissions.checkSubRolePermission('admin', 'staff_management', 'update'), async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    res.json({ success: true, data: location });
  } catch (error) {
    console.error('Error updating location:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid location ID' });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({ success: false, message: 'Failed to update location' });
  }
});

// Delete location
router.delete('/:id', permissions.checkSubRolePermission('admin', 'staff_management', 'delete'), async (req, res) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id);
    
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    res.json({ success: true, message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid location ID' });
    }
    res.status(500).json({ success: false, message: 'Failed to delete location' });
  }
});

// Update location status
router.put('/:id/status', permissions.checkSubRolePermission('admin', 'staff_management', 'update'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Active', 'Inactive', 'Under Maintenance'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const location = await Location.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }

    res.json({ success: true, data: location });
  } catch (error) {
    console.error('Error updating location status:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid location ID' });
    }
    res.status(500).json({ success: false, message: 'Failed to update location status' });
  }
});

module.exports = router;