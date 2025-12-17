const express = require('express');
const router = express.Router();
const trakkerService = require('../services/trakkerService');
const Vehicle = require('../models/hr/Vehicle');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/trakker/vehicle/:vehicleId/location
 * Get last location of a vehicle by vehicle ID
 */
router.get(
  '/vehicle/:vehicleId/location',
  permissions.checkSubRolePermission('admin', 'vehicle_management', 'read'),
  async (req, res) => {
    try {
      const { vehicleId } = req.params;

      // Find vehicle in database
      const vehicle = await Vehicle.findOne({ vehicleId });

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'Vehicle not found'
        });
      }

      // Check if vehicle has Trakker tracking configured
      if (!vehicle.trakkerPhone || !vehicle.trakkerDeviceId) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle does not have Trakker tracking configured. Please add Trakker phone and device ID.',
          data: {
            vehicleId: vehicle.vehicleId,
            vehicleName: `${vehicle.make} ${vehicle.model}`,
            hasTrakkerPhone: !!vehicle.trakkerPhone,
            hasTrakkerDeviceId: !!vehicle.trakkerDeviceId
          }
        });
      }

      // Fetch location from Trakker API
      const result = await trakkerService.getVehicleLastLocation(
        vehicle.trakkerPhone,
        vehicle.trakkerDeviceId
      );

      if (!result.success) {
        return res.status(result.statusCode || 500).json({
          success: false,
          message: 'Failed to fetch vehicle location from Trakker',
          error: result.error
        });
      }

      // Trakker API returns an array of vehicles, find the matching one
      // Try to match by DeviceIMEIs (device ID) or RegNo (license plate)
      let locationData = null;
      if (Array.isArray(result.data) && result.data.length > 0) {
        // Try to find matching vehicle by DeviceIMEIs (device ID) or RegNo (license plate)
        locationData = result.data.find(v => 
          v.DeviceIMEIs === vehicle.trakkerDeviceId || 
          v.RegNo === vehicle.licensePlate
        ) || result.data[0]; // If no match, use first vehicle
      } else if (result.data) {
        // If it's not an array, use the data directly
        locationData = result.data;
      }

      res.json({
        success: true,
        message: 'Vehicle location fetched successfully',
        data: {
          vehicle: {
            vehicleId: vehicle.vehicleId,
            make: vehicle.make,
            model: vehicle.model,
            licensePlate: vehicle.licensePlate
          },
          location: locationData,
          allVehicles: Array.isArray(result.data) ? result.data : [result.data]
        }
      });
    } catch (error) {
      console.error('Error in get vehicle location:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching vehicle location',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/trakker/location
 * Get location by directly providing phone and deviceId (for testing or direct access)
 */
router.get(
  '/location',
  permissions.checkSubRolePermission('admin', 'vehicle_management', 'read'),
  async (req, res) => {
    try {
      const { phone, deviceId } = req.query;

      if (!phone || !deviceId) {
        return res.status(400).json({
          success: false,
          message: 'Phone and deviceId are required'
        });
      }

      const result = await trakkerService.getVehicleLastLocation(phone, deviceId);

      if (!result.success) {
        return res.status(result.statusCode || 500).json({
          success: false,
          message: 'Failed to fetch location from Trakker',
          error: result.error
        });
      }

      res.json({
        success: true,
        message: 'Location fetched successfully',
        data: result.data
      });
    } catch (error) {
      console.error('Error in get location:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching location',
        error: error.message
      });
    }
  }
);

/**
 * POST /api/trakker/test-token
 * Test Trakker authentication (for debugging)
 */
router.post(
  '/test-token',
  permissions.checkSubRolePermission('admin', 'vehicle_management', 'read'),
  async (req, res) => {
    try {
      const token = await trakkerService.getToken();
      
      res.json({
        success: true,
        message: 'Token fetched successfully',
        data: {
          token: token.substring(0, 50) + '...', // Only show first 50 chars for security
          cached: !!trakkerService.tokenCache.token
        }
      });
    } catch (error) {
      console.error('Error testing token:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching token',
        error: error.message
      });
    }
  }
);

module.exports = router;

