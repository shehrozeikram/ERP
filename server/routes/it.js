const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware, authorize } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// Import IT models
const ITAsset = require('../models/it/ITAsset');
const AssetAssignment = require('../models/it/AssetAssignment');
const AssetMaintenanceLog = require('../models/it/AssetMaintenanceLog');
const SoftwareInventory = require('../models/it/SoftwareInventory');
const LicenseAssignment = require('../models/it/LicenseAssignment');
const SoftwareVendor = require('../models/it/SoftwareVendor');
const NetworkDevice = require('../models/it/NetworkDevice');
const DeviceLog = require('../models/it/DeviceLog');
const IncidentReport = require('../models/it/IncidentReport');
const ITVendor = require('../models/it/ITVendor');
const VendorContract = require('../models/it/VendorContract');
const ContractRenewal = require('../models/it/ContractRenewal');
const User = require('../models/User');
const PasswordWallet = require('../models/it/PasswordWallet');

// Import related models for population
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');

// Import integration services
const ITHrIntegrationService = require('../services/itHrIntegrationService');
const ITFinanceIntegrationService = require('../services/itFinanceIntegrationService');
const ITProcurementIntegrationService = require('../services/itProcurementIntegrationService');

const router = express.Router();

// Helper function to generate asset tag
const generateAssetTag = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `IT-${timestamp}-${random}`;
};

// Apply authentication middleware to all routes
router.use(authMiddleware);

// ===============================
// ASSET MANAGEMENT ROUTES
// ===============================

// @route   GET /api/it/assets
// @desc    Get all IT assets with filtering and pagination
// @access  Private (IT, Admin)
router.get('/assets', 
  checkPermission('it_assets_view'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      assigned,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    // Apply filters
    if (category) query.category = category;
    if (status) query.status = status;
    if (assigned === 'true') query['assignedTo.employee'] = { $exists: true, $ne: null };
    if (assigned === 'false') query.$or = [
      { 'assignedTo.employee': { $exists: false } },
      { 'assignedTo.employee': null }
    ];

    // Apply search
    if (search) {
      query.$or = [
        { assetName: { $regex: search, $options: 'i' } },
        { assetTag: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const assets = await ITAsset.find(query)
      .populate('assignedTo.employee', 'firstName lastName employeeId')
      .populate('assignedTo.assignedBy', 'firstName lastName')
      .populate('supplier', 'vendorName')
      .populate('createdBy', 'firstName lastName')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ITAsset.countDocuments(query);

    res.json({
      success: true,
      data: assets,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  })
);

// @route   GET /api/it/assets/:id
// @desc    Get single IT asset by ID
// @access  Private (IT, Admin)
router.get('/assets/:id',
  checkPermission('it_assets_view'),
  asyncHandler(async (req, res) => {
    const asset = await ITAsset.findById(req.params.id)
      .populate('assignedTo.employee', 'firstName lastName employeeId department')
      .populate('assignedTo.assignedBy', 'firstName lastName')
      .populate('supplier', 'vendorName contactInfo')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    // Get asset assignments history
    const assignments = await AssetAssignment.find({ asset: asset._id })
      .populate('employee', 'firstName lastName employeeId')
      .populate('assignedBy', 'firstName lastName')
      .sort({ assignedDate: -1 });

    // Get maintenance logs
    const maintenanceLogs = await AssetMaintenanceLog.find({ asset: asset._id })
      .populate('assignedTo', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        asset,
        assignments,
        maintenanceLogs
      }
    });
  })
);

// @route   POST /api/it/assets
// @desc    Create new IT asset
// @access  Private (IT, Admin)
router.post('/assets',
  checkPermission('it_assets_create'),
  [
    body('assetName').trim().notEmpty().withMessage('Asset name is required'),
    body('category').isIn(['Laptop', 'Desktop', 'Server', 'Printer', 'Scanner', 'Router', 'Switch', 'Access Point', 'Firewall', 'UPS', 'Monitor', 'Keyboard', 'Mouse', 'Webcam', 'Headset', 'Projector', 'Tablet', 'Smartphone', 'Other']).withMessage('Invalid category'),
    body('brand').trim().notEmpty().withMessage('Brand is required'),
    body('model').trim().notEmpty().withMessage('Model is required'),
    body('purchaseDate').isISO8601().withMessage('Valid purchase date is required'),
    body('purchasePrice').isNumeric().withMessage('Purchase price must be a number'),
    body('assetTag').optional().trim(),
    body('supplier').optional()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Generate asset tag if not provided
    const assetTag = req.body.assetTag || generateAssetTag();

    const assetData = {
      ...req.body,
      assetTag,
      createdBy: req.user.id
    };

    // Handle supplier field - if it's a string and not a valid ObjectId, set to null
    if (assetData.supplier && !mongoose.Types.ObjectId.isValid(assetData.supplier)) {
      assetData.supplier = null;
    }

    const asset = new ITAsset(assetData);
    await asset.save();

    const populatedAsset = await ITAsset.findById(asset._id)
      .populate('supplier', 'vendorName')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Asset created successfully',
      data: populatedAsset
    });
  })
);

// @route   PUT /api/it/assets/:id
// @desc    Update IT asset
// @access  Private (IT, Admin)
router.put('/assets/:id',
  checkPermission('it_assets_update'),
  asyncHandler(async (req, res) => {
    const asset = await ITAsset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    const updatedAsset = await ITAsset.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    ).populate('supplier', 'vendorName')
     .populate('assignedTo.employee', 'firstName lastName employeeId')
     .populate('createdBy', 'firstName lastName')
     .populate('updatedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Asset updated successfully',
      data: updatedAsset
    });
  })
);

// @route   DELETE /api/it/assets/:id
// @desc    Soft delete IT asset
// @access  Private (IT, Admin)
router.delete('/assets/:id',
  checkPermission('it_assets_delete'),
  asyncHandler(async (req, res) => {
    const asset = await ITAsset.findById(req.params.id);

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    await ITAsset.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedBy: req.user.id }
    );

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  })
);

// ===============================
// ASSET ASSIGNMENT ROUTES
// ===============================

// @route   POST /api/it/assets/:id/assign
// @desc    Assign asset to employee
// @access  Private (IT, Admin)
router.post('/assets/:id/assign',
  checkPermission('it_assets_assign'),
  [
    body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
    body('assignmentReason').isIn(['New Employee', 'Replacement', 'Upgrade', 'Temporary', 'Project', 'Other']).withMessage('Valid assignment reason is required'),
    body('conditionAtAssignment').isIn(['Excellent', 'Good', 'Fair', 'Poor']).withMessage('Valid condition is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { employeeId, assignmentReason, conditionAtAssignment, expectedReturnDate, notes, accessories } = req.body;

    // Check if asset exists and is available
    const asset = await ITAsset.findById(req.params.id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }

    if (asset.assignedTo.employee) {
      return res.status(400).json({
        success: false,
        message: 'Asset is already assigned to another employee'
      });
    }

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Create assignment record
    const assignment = new AssetAssignment({
      asset: asset._id,
      employee: employeeId,
      assignedBy: req.user.id,
      assignmentReason,
      conditionAtAssignment,
      expectedReturnDate,
      notes,
      accessories
    });

    await assignment.save();

    // Update asset assignment
    await ITAsset.findByIdAndUpdate(asset._id, {
      'assignedTo.employee': employeeId,
      'assignedTo.assignedDate': new Date(),
      'assignedTo.assignedBy': req.user.id,
      'assignedTo.notes': notes
    });

    const populatedAssignment = await AssetAssignment.findById(assignment._id)
      .populate('asset', 'assetTag assetName category brand model')
      .populate('employee', 'firstName lastName employeeId department')
      .populate('assignedBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Asset assigned successfully',
      data: populatedAssignment
    });
  })
);

// @route   POST /api/it/assets/:id/return
// @desc    Return assigned asset
// @access  Private (IT, Admin)
router.post('/assets/:id/return',
  checkPermission('it_assets_return'),
  [
    body('conditionAtReturn').isIn(['Excellent', 'Good', 'Fair', 'Poor', 'Damaged']).withMessage('Valid condition is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { conditionAtReturn, returnNotes } = req.body;

    // Find active assignment
    const assignment = await AssetAssignment.findOne({
      asset: req.params.id,
      status: 'Active'
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'No active assignment found for this asset'
      });
    }

    // Update assignment
    assignment.status = 'Returned';
    assignment.actualReturnDate = new Date();
    assignment.conditionAtReturn = conditionAtReturn;
    assignment.returnNotes = returnNotes;
    await assignment.save();

    // Update asset
    await ITAsset.findByIdAndUpdate(req.params.id, {
      'assignedTo.employee': null,
      'assignedTo.assignedDate': null,
      'assignedTo.assignedBy': null,
      'assignedTo.returnDate': new Date(),
      'assignedTo.notes': returnNotes,
      condition: conditionAtReturn
    });

    const populatedAssignment = await AssetAssignment.findById(assignment._id)
      .populate('asset', 'assetTag assetName category brand model')
      .populate('employee', 'firstName lastName employeeId')
      .populate('assignedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Asset returned successfully',
      data: populatedAssignment
    });
  })
);

// ===============================
// SOFTWARE INVENTORY ROUTES
// ===============================

// @route   GET /api/it/software
// @desc    Get all software inventory
// @access  Private (IT, Admin)
router.get('/software',
  checkPermission('it_software_view'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      category,
      licenseType,
      expiring,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    // Apply filters
    if (category) query.category = category;
    if (licenseType) query.licenseType = licenseType;
    
    // Expiring filter
    if (expiring === 'true') {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      query.expiryDate = { $lte: futureDate, $gte: new Date() };
    }

    // Apply search
    if (search) {
      query.$or = [
        { softwareName: { $regex: search, $options: 'i' } },
        { version: { $regex: search, $options: 'i' } },
        { vendor: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const software = await SoftwareInventory.find(query)
      .populate('vendor', 'vendorName contactInfo')
      .populate('createdBy', 'firstName lastName')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Add virtual fields to each software item
    const softwareWithVirtuals = software.map(item => ({
      ...item.toObject(),
      utilizationPercentage: item.utilizationPercentage,
      expiryStatus: item.expiryStatus,
      renewalStatus: item.renewalStatus
    }));

    const total = await SoftwareInventory.countDocuments(query);

    res.json({
      success: true,
      data: softwareWithVirtuals,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  })
);

// @route   POST /api/it/software
// @desc    Create new software inventory
// @access  Private (IT, Admin)
router.post('/software',
  checkPermission('it_software_create'),
  [
    body('softwareName').trim().notEmpty().withMessage('Software name is required'),
    body('version').trim().notEmpty().withMessage('Version is required'),
    body('category').isIn(['Operating System', 'Office Suite', 'Design Software', 'Development Tools', 'Database Software', 'Security Software', 'Antivirus', 'Backup Software', 'Communication Tools', 'Project Management', 'Accounting Software', 'ERP Software', 'Other']).withMessage('Invalid category'),
    body('licenseType').isIn(['Perpetual', 'Subscription', 'Volume', 'Site License', 'Concurrent', 'Open Source']).withMessage('Invalid license type'),
    body('purchaseDate').isISO8601().withMessage('Valid purchase date is required'),
    body('purchasePrice').isNumeric().withMessage('Purchase price must be a number'),
    body('licenseCount.total').isInt({ min: 1 }).withMessage('Total license count must be at least 1')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const softwareData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Handle invalid vendor ObjectId
    if (softwareData.vendor && !mongoose.Types.ObjectId.isValid(softwareData.vendor)) {
      softwareData.vendor = null;
    }

    const software = new SoftwareInventory(softwareData);
    await software.save();

    const populatedSoftware = await SoftwareInventory.findById(software._id)
      .populate('vendor', 'vendorName contactInfo')
      .populate('createdBy', 'firstName lastName');

    // Add virtual fields to response
    const softwareResponse = {
      ...populatedSoftware.toObject(),
      utilizationPercentage: populatedSoftware.utilizationPercentage,
      expiryStatus: populatedSoftware.expiryStatus,
      renewalStatus: populatedSoftware.renewalStatus
    };

    res.status(201).json({
      success: true,
      message: 'Software added successfully',
      data: softwareResponse
    });
  })
);

// @route   GET /api/it/software/:id
// @desc    Get single software item by ID
// @access  Private (IT, Admin)
router.get('/software/:id',
  checkPermission('it_software_view'),
  asyncHandler(async (req, res) => {
    const software = await SoftwareInventory.findById(req.params.id)
      .populate('vendor', 'vendorName contactInfo')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!software) {
      return res.status(404).json({
        success: false,
        message: 'Software not found'
      });
    }

    // Get license assignments
    const licenseAssignments = await LicenseAssignment.find({ software: software._id })
      .populate('employee', 'firstName lastName employeeId')
      .populate('assignedBy', 'firstName lastName')
      .sort({ assignedDate: -1 });

    // Add virtual fields to software response
    const softwareResponse = {
      ...software.toObject(),
      utilizationPercentage: software.utilizationPercentage,
      expiryStatus: software.expiryStatus,
      renewalStatus: software.renewalStatus
    };

    res.json({
      success: true,
      data: {
        software: softwareResponse,
        licenseAssignments
      }
    });
  })
);

// @route   PUT /api/it/software/:id
// @desc    Update software inventory
// @access  Private (IT, Admin)
router.put('/software/:id',
  checkPermission('it_software_update'),
  asyncHandler(async (req, res) => {
    const software = await SoftwareInventory.findById(req.params.id);

    if (!software) {
      return res.status(404).json({
        success: false,
        message: 'Software not found'
      });
    }

    const updateData = { ...req.body, updatedBy: req.user.id };
    
    // Handle invalid vendor ObjectId
    if (updateData.vendor && !mongoose.Types.ObjectId.isValid(updateData.vendor)) {
      updateData.vendor = null;
    }

    const updatedSoftware = await SoftwareInventory.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('vendor', 'vendorName contactInfo')
     .populate('createdBy', 'firstName lastName')
     .populate('updatedBy', 'firstName lastName');

    // Add virtual fields to response
    const softwareResponse = {
      ...updatedSoftware.toObject(),
      utilizationPercentage: updatedSoftware.utilizationPercentage,
      expiryStatus: updatedSoftware.expiryStatus,
      renewalStatus: updatedSoftware.renewalStatus
    };

    res.json({
      success: true,
      message: 'Software updated successfully',
      data: softwareResponse
    });
  })
);

// @route   DELETE /api/it/software/:id
// @desc    Soft delete software inventory
// @access  Private (IT, Admin)
router.delete('/software/:id',
  checkPermission('it_software_delete'),
  asyncHandler(async (req, res) => {
    const software = await SoftwareInventory.findById(req.params.id);

    if (!software) {
      return res.status(404).json({
        success: false,
        message: 'Software not found'
      });
    }

    await SoftwareInventory.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedBy: req.user.id }
    );

    res.json({
      success: true,
      message: 'Software deleted successfully'
    });
  })
);

// ===============================
// NETWORK DEVICE ROUTES
// ===============================

// @route   GET /api/it/network
// @desc    Get all network devices
// @access  Private (IT, Admin)
router.get('/network',
  checkPermission('it_network_view'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      deviceType,
      status,
      location,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    // Apply filters
    if (deviceType) query.deviceType = deviceType;
    if (status) query.status = status;
    if (location) {
      const locationParts = location.split(',');
      if (locationParts.length > 0) query['location.building'] = locationParts[0];
      if (locationParts.length > 1) query['location.floor'] = locationParts[1];
      if (locationParts.length > 2) query['location.room'] = locationParts[2];
    }

    // Apply search
    if (search) {
      query.$or = [
        { deviceName: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { 'ipAddress.primary': { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const devices = await NetworkDevice.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await NetworkDevice.countDocuments(query);

    res.json({
      success: true,
      data: devices,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  })
);

// @route   POST /api/it/network
// @desc    Create new network device
// @access  Private (IT, Admin)
router.post('/network',
  checkPermission('it_network_create'),
  [
    body('deviceName').trim().notEmpty().withMessage('Device name is required'),
    body('deviceType').isIn(['Router', 'Switch', 'Firewall', 'Access Point', 'Server', 'NAS', 'Printer', 'Camera', 'UPS', 'Modem', 'Load Balancer', 'Proxy Server', 'DNS Server', 'DHCP Server', 'Mail Server', 'Web Server', 'Database Server', 'Other']).withMessage('Invalid device type'),
    body('brand').trim().notEmpty().withMessage('Brand is required'),
    body('model').trim().notEmpty().withMessage('Model is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const deviceData = {
      ...req.body,
      createdBy: req.user.id
    };

    const device = new NetworkDevice(deviceData);
    await device.save();

    const populatedDevice = await NetworkDevice.findById(device._id)
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Network device added successfully',
      data: populatedDevice
    });
  })
);

// @route   GET /api/it/network/:id
// @desc    Get single network device by ID
// @access  Private (IT, Admin)
router.get('/network/:id',
  checkPermission('it_network_view'),
  asyncHandler(async (req, res) => {
    const device = await NetworkDevice.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Network device not found'
      });
    }

    // Get device logs
    const deviceLogs = await DeviceLog.find({ device: device._id })
      .populate('createdBy', 'firstName lastName')
      .sort({ timestamp: -1 })
      .limit(20);

    res.json({
      success: true,
      data: {
        device,
        deviceLogs
      }
    });
  })
);

// @route   PUT /api/it/network/:id
// @desc    Update network device
// @access  Private (IT, Admin)
router.put('/network/:id',
  checkPermission('it_network_update'),
  asyncHandler(async (req, res) => {
    const device = await NetworkDevice.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Network device not found'
      });
    }

    const updatedDevice = await NetworkDevice.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.id },
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName')
     .populate('updatedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Network device updated successfully',
      data: updatedDevice
    });
  })
);

// @route   DELETE /api/it/network/:id
// @desc    Soft delete network device
// @access  Private (IT, Admin)
router.delete('/network/:id',
  checkPermission('it_network_delete'),
  asyncHandler(async (req, res) => {
    const device = await NetworkDevice.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Network device not found'
      });
    }

    await NetworkDevice.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedBy: req.user.id }
    );

    res.json({
      success: true,
      message: 'Network device deleted successfully'
    });
  })
);

// @route   POST /api/it/network/:id/log
// @desc    Add device log entry
// @access  Private (IT, Admin)
router.post('/network/:id/log',
  checkPermission('it_network_update'),
  [
    body('eventType').trim().notEmpty().withMessage('Event type is required'),
    body('description').trim().notEmpty().withMessage('Description is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const device = await NetworkDevice.findById(req.params.id);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Network device not found'
      });
    }

    const logData = {
      ...req.body,
      device: req.params.id,
      createdBy: req.user.id,
      timestamp: new Date()
    };

    const deviceLog = new DeviceLog(logData);
    await deviceLog.save();

    const populatedLog = await DeviceLog.findById(deviceLog._id)
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Device log added successfully',
      data: populatedLog
    });
  })
);

// ===============================
// VENDOR MANAGEMENT ROUTES
// ===============================

// @route   GET /api/it/vendors
// @desc    Get all IT vendors
// @access  Private (IT, Admin)
router.get('/vendors',
  checkPermission('it_vendors_view'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      vendorType,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    // Apply filters
    if (vendorType) query.vendorType = vendorType;
    if (status) query['relationship.status'] = status;

    // Apply search
    if (search) {
      query.$or = [
        { vendorName: { $regex: search, $options: 'i' } },
        { 'contactInfo.primaryContact.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const vendors = await ITVendor.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ITVendor.countDocuments(query);

    res.json({
      success: true,
      data: vendors,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  })
);

// @route   POST /api/it/vendors
// @desc    Create new IT vendor
// @access  Private (IT, Admin)
router.post('/vendors',
  checkPermission('it_vendors_create'),
  [
    body('vendorName').trim().notEmpty().withMessage('Vendor name is required'),
    body('vendorType').isIn(['Hardware Supplier', 'Software Vendor', 'Service Provider', 'Consultant', 'Maintenance Provider', 'Cloud Provider', 'Security Provider', 'Network Provider', 'Training Provider', 'Other']).withMessage('Invalid vendor type')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const vendorData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Sanitize financialInfo.paymentHistory - ensure it's an array
    if (vendorData.financialInfo && vendorData.financialInfo.paymentHistory !== undefined) {
      if (typeof vendorData.financialInfo.paymentHistory === 'string' && vendorData.financialInfo.paymentHistory === '') {
        vendorData.financialInfo.paymentHistory = [];
      } else if (!Array.isArray(vendorData.financialInfo.paymentHistory)) {
        vendorData.financialInfo.paymentHistory = [];
      }
    }

    const vendor = new ITVendor(vendorData);
    await vendor.save();

    const populatedVendor = await ITVendor.findById(vendor._id)
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: populatedVendor
    });
  })
);

// @route   GET /api/it/vendors/:id/contracts
// @desc    Get all contracts for a vendor
// @access  Private (IT, Admin)
router.get('/vendors/:id/contracts',
  checkPermission('it_vendors_view'),
  asyncHandler(async (req, res) => {
    try {

      const vendor = await ITVendor.findById(req.params.id);
      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      const contracts = await VendorContract.find({ vendor: req.params.id })
        .populate('vendor', 'vendorName contactInfo')
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName')
        .sort({ startDate: -1 });

      res.json({
        success: true,
        data: {
          data: contracts,
          pagination: {
            current: 1,
            pages: 1,
            total: contracts.length
          }
        }
      });
    } catch (error) {
      console.error('Error in contracts route:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  })
);

// @route   GET /api/it/vendors/:id
// @desc    Get single IT vendor by ID
// @access  Private (IT, Admin)
router.get('/vendors/:id',
  checkPermission('it_vendors_view'),
  asyncHandler(async (req, res) => {
    const vendor = await ITVendor.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Get vendor contracts
    const contracts = await VendorContract.find({ vendor: vendor._id })
      .populate('vendor', 'vendorName')
      .populate('createdBy', 'firstName lastName')
      .sort({ startDate: -1 });

    res.json({
      success: true,
      data: {
        vendor,
        contracts
      }
    });
  })
);

// @route   PUT /api/it/vendors/:id
// @desc    Update IT vendor
// @access  Private (IT, Admin)
router.put('/vendors/:id',
  checkPermission('it_vendors_update'),
  asyncHandler(async (req, res) => {
    const vendor = await ITVendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const updateData = { ...req.body, updatedBy: req.user.id };

    // Sanitize financialInfo.paymentHistory - ensure it's an array
    if (updateData.financialInfo && updateData.financialInfo.paymentHistory !== undefined) {
      if (typeof updateData.financialInfo.paymentHistory === 'string' && updateData.financialInfo.paymentHistory === '') {
        updateData.financialInfo.paymentHistory = [];
      } else if (!Array.isArray(updateData.financialInfo.paymentHistory)) {
        updateData.financialInfo.paymentHistory = [];
      }
    }

    const updatedVendor = await ITVendor.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName')
     .populate('updatedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Vendor updated successfully',
      data: updatedVendor
    });
  })
);

// @route   DELETE /api/it/vendors/:id
// @desc    Soft delete IT vendor
// @access  Private (IT, Admin)
router.delete('/vendors/:id',
  checkPermission('it_vendors_delete'),
  asyncHandler(async (req, res) => {
    const vendor = await ITVendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    await ITVendor.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedBy: req.user.id }
    );

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  })
);

// @route   POST /api/it/vendors/:id/contract
// @desc    Create vendor contract
// @access  Private (IT, Admin)
router.post('/vendors/:id/contract',
  checkPermission('it_vendors_update'),
  [
    body('contractNumber').trim().notEmpty().withMessage('Contract number is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    body('terms').trim().notEmpty().withMessage('Contract terms are required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const vendor = await ITVendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const contractData = {
      ...req.body,
      vendor: req.params.id,
      createdBy: req.user.id
    };

    const contract = new VendorContract(contractData);
    await contract.save();

    const populatedContract = await VendorContract.findById(contract._id)
      .populate('vendor', 'vendorName contactInfo')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Contract created successfully',
      data: populatedContract
    });
  })
);

// ===============================
// VENDOR CONTRACT ROUTES
// ===============================


// @route   GET /api/it/contracts/:contractId
// @desc    Get single contract by ID
// @access  Private (IT, Admin)
router.get('/contracts/:contractId',
  checkPermission('it_vendors_view'),
  asyncHandler(async (req, res) => {
    const contract = await VendorContract.findById(req.params.contractId)
      .populate('vendor', 'vendorName contactInfo')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    res.json({
      success: true,
      data: contract
    });
  })
);

// @route   PUT /api/it/contracts/:contractId
// @desc    Update vendor contract
// @access  Private (IT, Admin)
router.put('/contracts/:contractId',
  checkPermission('it_vendors_update'),
  [
    body('contractNumber').optional().trim().notEmpty().withMessage('Contract number is required'),
    body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
    body('endDate').optional().isISO8601().withMessage('Valid end date is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const contract = await VendorContract.findById(req.params.contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    const updatedContract = await VendorContract.findByIdAndUpdate(
      req.params.contractId,
      updateData,
      { new: true, runValidators: true }
    ).populate('vendor', 'vendorName contactInfo')
     .populate('createdBy', 'firstName lastName')
     .populate('updatedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Contract updated successfully',
      data: updatedContract
    });
  })
);

// @route   DELETE /api/it/contracts/:contractId
// @desc    Delete vendor contract
// @access  Private (IT, Admin)
router.delete('/contracts/:contractId',
  checkPermission('it_vendors_update'),
  asyncHandler(async (req, res) => {
    const contract = await VendorContract.findById(req.params.contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    await VendorContract.findByIdAndDelete(req.params.contractId);

    res.json({
      success: true,
      message: 'Contract deleted successfully'
    });
  })
);

// ===============================
// PASSWORD WALLET ROUTES
// ===============================

// @route   GET /api/it/vendors/:id/passwords
// @desc    Get all passwords for a vendor
// @access  Private (IT, Admin)
router.get('/vendors/:id/passwords',
  checkPermission('it_vendors_view'),
  asyncHandler(async (req, res) => {
    const vendor = await ITVendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const passwords = await PasswordWallet.find({ 
      isActive: true 
    })
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Don't include encrypted passwords in response
    const sanitizedPasswords = passwords.map(password => {
      const passwordObj = password.toObject();
      delete passwordObj.encryptedPassword;
      delete passwordObj._decryptedPassword;
      return passwordObj;
    });

    res.json({
      success: true,
      data: sanitizedPasswords
    });
  })
);

// @route   GET /api/it/passwords
// @desc    Get all passwords across all vendors
// @access  Private (IT, Admin)
router.get('/passwords',
  checkPermission('it_passwords_view'),
  asyncHandler(async (req, res) => {
    try {
      if (!PasswordWallet) {
        return res.status(500).json({
          success: false,
          message: 'PasswordWallet model not loaded'
        });
      }
      
    const passwords = await PasswordWallet.find({ isActive: true })
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

      // Don't include encrypted passwords in response
      const sanitizedPasswords = passwords.map(password => {
        const passwordObj = password.toObject();
        delete passwordObj.encryptedPassword;
        delete passwordObj._decryptedPassword;
        return passwordObj;
      });

      res.json({
        success: true,
        data: {
          data: sanitizedPasswords,
          pagination: {
            current: 1,
            pages: 1,
            total: sanitizedPasswords.length
          }
        }
      });
    } catch (error) {
      console.error('Error fetching all passwords:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch passwords',
        error: error.message
      });
    }
  })
);

// @route   GET /api/it/passwords/expiring
// @desc    Get passwords expiring soon
// @access  Private (IT, Admin)
router.get('/passwords/expiring',
  checkPermission('it_vendors_view'),
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const expiringPasswords = await PasswordWallet.findExpiringSoon(days)
      .populate('createdBy', 'firstName lastName')
      .sort({ expiryDate: 1 });

    // Don't include encrypted passwords in response
    const sanitizedPasswords = expiringPasswords.map(password => {
      const passwordObj = password.toObject();
      delete passwordObj.encryptedPassword;
      delete passwordObj._decryptedPassword;
      return passwordObj;
    });

    res.json({
      success: true,
      data: sanitizedPasswords
    });
  })
);

// @route   GET /api/it/passwords/:passwordId
// @desc    Get single password by ID (with decrypted password)
// @access  Private (IT, Admin)
router.get('/passwords/:passwordId',
  checkPermission('it_passwords_view'),
  asyncHandler(async (req, res) => {
    const password = await PasswordWallet.findById(req.params.passwordId)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!password) {
      return res.status(404).json({
        success: false,
        message: 'Password not found'
      });
    }

    // Increment usage count
    await password.incrementUsage();

    // For now, we'll return the password object without the encrypted password
    // In a real implementation, you'd decrypt it here with proper authentication
    const passwordObj = password.toObject();
    delete passwordObj.encryptedPassword;
    delete passwordObj._decryptedPassword;

    res.json({
      success: true,
      data: passwordObj
    });
  })
);

// @route   POST /api/it/vendors/:id/passwords
// @desc    Create new password entry
// @access  Private (IT, Admin)
router.post('/vendors/:id/passwords',
  checkPermission('it_passwords_create'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('category').isIn([
      'Admin Panel', 'Database Access', 'Server Credentials', 'API Keys',
      'VPN Access', 'Cloud Services', 'Email Account', 'Software License',
      'Network Device', 'Domain/DNS', 'Payment Gateway', 'Third Party Service', 'Other'
    ]).withMessage('Invalid category'),
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').trim().notEmpty().withMessage('Password is required'),
    body('url').optional().trim().custom((value) => {
      if (!value || value.trim() === '') return true; // URL is optional
      // Allow both http and https URLs, and also allow URLs without protocol
      const urlRegex = /^(https?:\/\/.+|www\..+|.+\..+)/;
      if (!urlRegex.test(value.trim())) {
        throw new Error('Please provide a valid URL (e.g., https://example.com or www.example.com)');
      }
      return true;
    }),
    body('expiryDate').optional().isISO8601().withMessage('Invalid expiry date format')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const vendor = await ITVendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Remove password from body data since we handle it separately
    const { password: plainPassword, ...otherData } = req.body;
    
    const passwordData = {
      ...otherData,
      vendor: req.params.id,
      createdBy: req.user.id
    };

    const password = new PasswordWallet(passwordData);
    
    // Encrypt password directly if provided
    if (plainPassword) {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(12);
      password.encryptedPassword = await bcrypt.hash(plainPassword, salt);
    }
    
    await password.save();

    const populatedPassword = await PasswordWallet.findById(password._id)
      .populate('createdBy', 'firstName lastName');

    // Don't include encrypted password in response
    const passwordObj = populatedPassword.toObject();
    delete passwordObj.encryptedPassword;
    delete passwordObj._decryptedPassword;

    res.status(201).json({
      success: true,
      message: 'Password added successfully',
      data: passwordObj
    });
  })
);

// @route   POST /api/it/passwords
// @desc    Create new password entry (without vendor requirement)
// @access  Private (IT, Admin)
router.post('/passwords',
  checkPermission('it_passwords_create'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('category').isIn([
      'Admin Panel', 'Database Access', 'Server Credentials', 'API Keys',
      'VPN Access', 'Cloud Services', 'Email Account', 'Software License',
      'Network Device', 'Domain/DNS', 'Payment Gateway', 'Third Party Service', 'Other'
    ]).withMessage('Invalid category'),
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').trim().notEmpty().withMessage('Password is required'),
    body('url').optional().trim().custom((value) => {
      if (!value || value.trim() === '') return true; // URL is optional
      // Allow both http and https URLs, and also allow URLs without protocol
      const urlRegex = /^(https?:\/\/.+|www\..+|.+\..+)/;
      if (!urlRegex.test(value.trim())) {
        throw new Error('Please provide a valid URL (e.g., https://example.com or www.example.com)');
      }
      return true;
    }),
    body('expiryDate').optional().isISO8601().withMessage('Invalid expiry date format')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Remove password from body data since we handle it separately
    const { password: plainPassword, ...otherData } = req.body;
    
    const passwordData = {
      ...otherData,
      createdBy: req.user.id
    };

    // Create password wallet instance
    const passwordWallet = new PasswordWallet(passwordData);

    // Encrypt password directly
    const salt = await bcrypt.genSalt(12);
    passwordWallet.encryptedPassword = await bcrypt.hash(plainPassword, salt);

    // Save to database
    await passwordWallet.save();

    // Populate and return the created password
    const populatedPassword = await PasswordWallet.findById(passwordWallet._id)
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Password created successfully',
      data: populatedPassword
    });
  })
);

// @route   PUT /api/it/passwords/:passwordId
// @desc    Update password entry
// @access  Private (IT, Admin)
router.put('/passwords/:passwordId',
  checkPermission('it_passwords_update'),
  [
    body('title').optional().trim().notEmpty().withMessage('Title is required'),
    body('category').optional().isIn([
      'Admin Panel', 'Database Access', 'Server Credentials', 'API Keys',
      'VPN Access', 'Cloud Services', 'Email Account', 'Software License',
      'Network Device', 'Domain/DNS', 'Payment Gateway', 'Third Party Service', 'Other'
    ]).withMessage('Invalid category'),
    body('username').optional().trim().notEmpty().withMessage('Username is required'),
    body('password').optional().trim().notEmpty().withMessage('Password is required'),
    body('url').optional().isURL().withMessage('Invalid URL format'),
    body('expiryDate').optional().isISO8601().withMessage('Invalid expiry date format')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const password = await PasswordWallet.findById(req.params.passwordId);
    if (!password) {
      return res.status(404).json({
        success: false,
        message: 'Password not found'
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    const updatedPassword = await PasswordWallet.findByIdAndUpdate(
      req.params.passwordId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName')
     .populate('updatedBy', 'firstName lastName');

    // Don't include encrypted password in response
    const passwordObj = updatedPassword.toObject();
    delete passwordObj.encryptedPassword;
    delete passwordObj._decryptedPassword;

    res.json({
      success: true,
      message: 'Password updated successfully',
      data: passwordObj
    });
  })
);

// @route   DELETE /api/it/passwords/:passwordId
// @desc    Delete password entry (soft delete)
// @access  Private (IT, Admin)
router.delete('/passwords/:passwordId',
  checkPermission('it_passwords_delete'),
  asyncHandler(async (req, res) => {
    const password = await PasswordWallet.findById(req.params.passwordId);
    if (!password) {
      return res.status(404).json({
        success: false,
        message: 'Password not found'
      });
    }

    // Soft delete by setting isActive to false
    await PasswordWallet.findByIdAndUpdate(
      req.params.passwordId,
      { isActive: false, updatedBy: req.user.id }
    );

    res.json({
      success: true,
      message: 'Password deleted successfully'
    });
  })
);

// @route   POST /api/it/passwords/:passwordId/decrypt
// @desc    Decrypt and return password (requires additional authentication)
// @access  Private (IT, Admin)
router.post('/passwords/:passwordId/decrypt',
  checkPermission('it_passwords_view'),
  [
    body('masterPassword').notEmpty().withMessage('Master password is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const password = await PasswordWallet.findById(req.params.passwordId);
    if (!password) {
      return res.status(404).json({
        success: false,
        message: 'Password not found'
      });
    }

    try {
      // In a real implementation, you'd verify the master password here
      // For now, we'll just return a placeholder
      const decryptedPassword = await password.decryptPassword(req.body.masterPassword);

      // Increment usage count
      await password.incrementUsage();

      res.json({
        success: true,
        data: {
          password: decryptedPassword,
          lastUsed: new Date()
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Failed to decrypt password'
      });
    }
  })
);

// ===============================
// HR INTEGRATION ROUTES
// ===============================

// @route   POST /api/it/hr/assign-asset
// @desc    Assign asset to employee with HR integration
// @access  Private (IT, Admin)
router.post('/hr/assign-asset',
  checkPermission('it_assets_assign'),
  [
    body('assetId').isMongoId().withMessage('Valid asset ID is required'),
    body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
    body('assignmentReason').isIn(['New Employee', 'Replacement', 'Upgrade', 'Temporary', 'Project', 'Transfer', 'Other']).withMessage('Valid assignment reason is required'),
    body('conditionAtAssignment').isIn(['Excellent', 'Good', 'Fair', 'Poor']).withMessage('Valid condition is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { assetId, employeeId, ...assignmentData } = req.body;
    const result = await ITHrIntegrationService.assignAssetToEmployee(
      assetId,
      employeeId,
      req.user.id,
      assignmentData
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/hr/return-asset
// @desc    Return asset from employee with HR integration
// @access  Private (IT, Admin)
router.post('/hr/return-asset',
  checkPermission('it_assets_return'),
  [
    body('assetId').isMongoId().withMessage('Valid asset ID is required'),
    body('employeeId').isMongoId().withMessage('Valid employee ID is required'),
    body('conditionAtReturn').isIn(['Excellent', 'Good', 'Fair', 'Poor', 'Damaged']).withMessage('Valid condition is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { assetId, employeeId, ...returnData } = req.body;
    const result = await ITHrIntegrationService.returnAssetFromEmployee(
      assetId,
      employeeId,
      req.user.id,
      returnData
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/hr/assign-license
// @desc    Assign software license to employee with HR integration
// @access  Private (IT, Admin)
router.post('/hr/assign-license',
  checkPermission('it_software_view'),
  [
    body('softwareId').isMongoId().withMessage('Valid software ID is required'),
    body('employeeId').isMongoId().withMessage('Valid employee ID is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { softwareId, employeeId, ...assignmentData } = req.body;
    const result = await ITHrIntegrationService.assignLicenseToEmployee(
      softwareId,
      employeeId,
      req.user.id,
      assignmentData
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   GET /api/it/hr/employee/:id/assets
// @desc    Get employee's IT assets and licenses
// @access  Private (IT, Admin, HR)
router.get('/hr/employee/:id/assets',
  checkPermission('it_assets_view'),
  asyncHandler(async (req, res) => {
    const result = await ITHrIntegrationService.getEmployeeITAssets(req.params.id);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   GET /api/it/hr/department/:id/assets
// @desc    Get department's IT assets and licenses
// @access  Private (IT, Admin, HR)
router.get('/hr/department/:id/assets',
  checkPermission('it_assets_view'),
  asyncHandler(async (req, res) => {
    const result = await ITHrIntegrationService.getDepartmentITAssets(req.params.id);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/hr/transfer-asset
// @desc    Transfer asset between employees
// @access  Private (IT, Admin)
router.post('/hr/transfer-asset',
  checkPermission('it_assets_assign'),
  [
    body('assetId').isMongoId().withMessage('Valid asset ID is required'),
    body('fromEmployeeId').isMongoId().withMessage('Valid from employee ID is required'),
    body('toEmployeeId').isMongoId().withMessage('Valid to employee ID is required'),
    body('conditionAtTransfer').isIn(['Excellent', 'Good', 'Fair', 'Poor']).withMessage('Valid condition is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { assetId, fromEmployeeId, toEmployeeId, ...transferData } = req.body;
    const result = await ITHrIntegrationService.transferAsset(
      assetId,
      fromEmployeeId,
      toEmployeeId,
      req.user.id,
      transferData
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// ===============================
// FINANCE INTEGRATION ROUTES
// ===============================

// @route   POST /api/it/finance/record-asset-purchase
// @desc    Record IT asset purchase in finance module
// @access  Private (IT, Admin, Finance)
router.post('/finance/record-asset-purchase',
  checkPermission('it_assets_create'),
  [
    body('assetName').trim().notEmpty().withMessage('Asset name is required'),
    body('purchasePrice').isNumeric().withMessage('Purchase price must be a number'),
    body('purchaseDate').isISO8601().withMessage('Valid purchase date is required'),
    body('supplier').trim().notEmpty().withMessage('Supplier is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const result = await ITFinanceIntegrationService.recordAssetPurchase(
      req.body,
      { createdBy: req.user.id }
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/finance/record-software-purchase
// @desc    Record software license purchase in finance module
// @access  Private (IT, Admin, Finance)
router.post('/finance/record-software-purchase',
  checkPermission('it_software_create'),
  [
    body('softwareName').trim().notEmpty().withMessage('Software name is required'),
    body('version').trim().notEmpty().withMessage('Version is required'),
    body('purchasePrice').isNumeric().withMessage('Purchase price must be a number'),
    body('purchaseDate').isISO8601().withMessage('Valid purchase date is required'),
    body('vendor').trim().notEmpty().withMessage('Vendor is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const result = await ITFinanceIntegrationService.recordSoftwarePurchase(
      req.body,
      { createdBy: req.user.id }
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/finance/calculate-depreciation
// @desc    Calculate and record asset depreciation
// @access  Private (IT, Admin, Finance)
router.post('/finance/calculate-depreciation',
  checkPermission('it_assets_view'),
  [
    body('assetId').isMongoId().withMessage('Valid asset ID is required'),
    body('depreciationPeriod').optional().isIn(['monthly', 'quarterly', 'yearly']).withMessage('Invalid depreciation period')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { assetId, depreciationPeriod } = req.body;
    const result = await ITFinanceIntegrationService.calculateAssetDepreciation(
      assetId,
      depreciationPeriod
    );

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/finance/record-vendor-payment
// @desc    Record vendor payment for IT services
// @access  Private (IT, Admin, Finance)
router.post('/finance/record-vendor-payment',
  checkPermission('it_vendors_update'),
  [
    body('contractId').isMongoId().withMessage('Valid contract ID is required'),
    body('paymentAmount').isNumeric().withMessage('Payment amount must be a number'),
    body('paymentDate').isISO8601().withMessage('Valid payment date is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const result = await ITFinanceIntegrationService.recordVendorPayment(
      req.body.contractId,
      { ...req.body, createdBy: req.user.id }
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   GET /api/it/finance/summary
// @desc    Get IT financial summary
// @access  Private (IT, Admin, Finance)
router.get('/finance/summary',
  checkPermission('it_reports_view'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const result = await ITFinanceIntegrationService.getITFinancialSummary(
      new Date(startDate),
      new Date(endDate)
    );

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/finance/monthly-depreciation
// @desc    Process monthly depreciation for all IT assets
// @access  Private (IT, Admin, Finance)
router.post('/finance/monthly-depreciation',
  checkPermission('it_assets_view'),
  asyncHandler(async (req, res) => {
    const result = await ITFinanceIntegrationService.recordMonthlyDepreciation();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// ===============================
// PROCUREMENT INTEGRATION ROUTES
// ===============================

// @route   POST /api/it/procurement/create-asset-order
// @desc    Create purchase order for IT asset
// @access  Private (IT, Admin, Procurement)
router.post('/procurement/create-asset-order',
  checkPermission('it_assets_create'),
  [
    body('assetName').trim().notEmpty().withMessage('Asset name is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('estimatedPrice').isNumeric().withMessage('Estimated price must be a number'),
    body('supplier').trim().notEmpty().withMessage('Supplier is required'),
    body('justification').trim().notEmpty().withMessage('Justification is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const result = await ITProcurementIntegrationService.createAssetPurchaseOrder(
      req.body,
      req.user.id
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/procurement/create-software-order
// @desc    Create purchase order for software license
// @access  Private (IT, Admin, Procurement)
router.post('/procurement/create-software-order',
  checkPermission('it_software_create'),
  [
    body('softwareName').trim().notEmpty().withMessage('Software name is required'),
    body('version').trim().notEmpty().withMessage('Version is required'),
    body('licenseType').trim().notEmpty().withMessage('License type is required'),
    body('estimatedPrice').isNumeric().withMessage('Estimated price must be a number'),
    body('vendor').trim().notEmpty().withMessage('Vendor is required'),
    body('justification').trim().notEmpty().withMessage('Justification is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const result = await ITProcurementIntegrationService.createSoftwarePurchaseOrder(
      req.body,
      req.user.id
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/procurement/create-renewal-order
// @desc    Create purchase order for license renewal
// @access  Private (IT, Admin, Procurement)
router.post('/procurement/create-renewal-order',
  checkPermission('it_software_update'),
  [
    body('softwareId').isMongoId().withMessage('Valid software ID is required'),
    body('renewalPrice').isNumeric().withMessage('Renewal price must be a number'),
    body('vendor').trim().notEmpty().withMessage('Vendor is required'),
    body('justification').trim().notEmpty().withMessage('Justification is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const result = await ITProcurementIntegrationService.createLicenseRenewalOrder(
      req.body,
      req.user.id
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/procurement/create-service-order
// @desc    Create purchase order for vendor services
// @access  Private (IT, Admin, Procurement)
router.post('/procurement/create-service-order',
  checkPermission('it_vendors_update'),
  [
    body('vendorId').isMongoId().withMessage('Valid vendor ID is required'),
    body('serviceDescription').trim().notEmpty().withMessage('Service description is required'),
    body('serviceType').trim().notEmpty().withMessage('Service type is required'),
    body('estimatedCost').isNumeric().withMessage('Estimated cost must be a number'),
    body('justification').trim().notEmpty().withMessage('Justification is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const result = await ITProcurementIntegrationService.createVendorServiceOrder(
      req.body,
      req.user.id
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/procurement/process-asset-order
// @desc    Process approved asset purchase order
// @access  Private (IT, Admin, Procurement)
router.post('/procurement/process-asset-order',
  checkPermission('it_assets_create'),
  [
    body('poId').isMongoId().withMessage('Valid purchase order ID is required'),
    body('serialNumber').trim().notEmpty().withMessage('Serial number is required'),
    body('assetTag').optional().trim(),
    body('condition').isIn(['Excellent', 'Good', 'Fair', 'Poor']).withMessage('Valid condition is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { poId, ...receivedData } = req.body;
    const result = await ITProcurementIntegrationService.processAssetPurchaseOrder(
      poId,
      receivedData
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/procurement/process-software-order
// @desc    Process approved software purchase order
// @access  Private (IT, Admin, Procurement)
router.post('/procurement/process-software-order',
  checkPermission('it_software_create'),
  [
    body('poId').isMongoId().withMessage('Valid purchase order ID is required'),
    body('licenseKey').trim().notEmpty().withMessage('License key is required'),
    body('expiryDate').isISO8601().withMessage('Valid expiry date is required'),
    body('licenseCount').isInt({ min: 1 }).withMessage('License count must be at least 1')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { poId, ...receivedData } = req.body;
    const result = await ITProcurementIntegrationService.processSoftwarePurchaseOrder(
      poId,
      receivedData
    );

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   GET /api/it/procurement/summary
// @desc    Get IT procurement summary
// @access  Private (IT, Admin, Procurement)
router.get('/procurement/summary',
  checkPermission('it_reports_view'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const result = await ITProcurementIntegrationService.getITProcurementSummary(
      new Date(startDate),
      new Date(endDate)
    );

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// @route   POST /api/it/procurement/auto-renewals
// @desc    Create auto-renewal orders for expiring licenses
// @access  Private (IT, Admin)
router.post('/procurement/auto-renewals',
  checkPermission('it_software_update'),
  asyncHandler(async (req, res) => {
    const result = await ITProcurementIntegrationService.createAutoRenewalOrders();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error
      });
    }
  })
);

// ===============================
// DASHBOARD & STATISTICS ROUTES
// ===============================

// @route   GET /api/it/dashboard
// @desc    Get IT dashboard statistics
// @access  Private (IT, Admin)
router.get('/dashboard',
  checkPermission('it_dashboard_view'),
  asyncHandler(async (req, res) => {
    const [
      assetStats,
      softwareStats,
      networkStats,
      vendorStats,
      recentIncidents,
      expiringLicenses,
      upcomingMaintenance
    ] = await Promise.all([
      ITAsset.getAssetStatistics().catch(() => ({ 
        overview: { totalAssets: 0, activeAssets: 0, assignedAssets: 0, totalValue: 0, averageValue: 0 }, 
        byCategory: [] 
      })),
      SoftwareInventory.getSoftwareStatistics().catch(() => ({ 
        overview: { totalSoftware: 0, totalLicenses: 0, usedLicenses: 0, availableLicenses: 0, totalCost: 0, averageCost: 0, expiringSoon: 0, expired: 0 }, 
        byCategory: [] 
      })),
      NetworkDevice.getNetworkStatistics().catch(() => ({ 
        overview: { totalDevices: 0, onlineDevices: 0, offlineDevices: 0, maintenanceDevices: 0, errorDevices: 0, averageUptime: 0, totalValue: 0 }, 
        byType: [] 
      })),
      ITVendor.getVendorStatistics().catch(() => ({ 
        overview: { totalVendors: 0, activeVendors: 0, preferredVendors: 0, blacklistedVendors: 0 }, 
        byService: [] 
      })),
      IncidentReport.find({ isActive: true })
        .populate('reportedBy.user', 'firstName lastName')
        .sort({ 'reportedBy.reportedDate': -1 })
        .limit(5)
        .catch(() => []),
      SoftwareInventory.findExpiringSoon(30).catch(() => []),
      AssetMaintenanceLog.findScheduledMaintenance()
        .limit(5)
        .catch(() => [])
    ]);

    res.json({
      success: true,
      data: {
        assets: assetStats,
        software: softwareStats,
        network: networkStats,
        vendors: vendorStats,
        recentIncidents,
        expiringLicenses,
        upcomingMaintenance
      }
    });
  })
);

// ===============================
// REPORT ROUTES
// ===============================

// @route   GET /api/it/reports/assets
// @desc    Get asset utilization report
// @access  Private (IT, Admin)
router.get('/reports/assets',
  checkPermission('it_reports_view'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, category, department } = req.query;

    const matchStage = { isActive: true };
    
    if (startDate || endDate) {
      matchStage.purchaseDate = {};
      if (startDate) matchStage.purchaseDate.$gte = new Date(startDate);
      if (endDate) matchStage.purchaseDate.$lte = new Date(endDate);
    }
    
    if (category) matchStage.category = category;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'employees',
          localField: 'assignedTo.employee',
          foreignField: '_id',
          as: 'assignedEmployee'
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: 'assignedEmployee.department',
          foreignField: '_id',
          as: 'department'
        }
      },
      {
        $match: department ? { 'department._id': new mongoose.Types.ObjectId(department) } : {}
      },
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          totalValue: { $sum: '$purchasePrice' },
          assignedAssets: {
            $sum: { $cond: [{ $ne: ['$assignedTo.employee', null] }, 1, 0] }
          },
          unassignedAssets: {
            $sum: { $cond: [{ $eq: ['$assignedTo.employee', null] }, 1, 0] }
          },
          categoryBreakdown: {
            $push: {
              category: '$category',
              value: '$purchasePrice',
              assigned: { $cond: [{ $ne: ['$assignedTo.employee', null] }, 1, 0] }
            }
          }
        }
      }
    ];

    const results = await ITAsset.aggregate(pipeline);
    
    res.json({
      success: true,
      data: results[0] || {
        totalAssets: 0,
        totalValue: 0,
        assignedAssets: 0,
        unassignedAssets: 0,
        categoryBreakdown: []
      }
    });
  })
);

// @route   GET /api/it/reports/asset-utilization
// @desc    Get asset utilization report (alternative endpoint)
// @access  Private (IT, Admin)
router.get('/reports/asset-utilization',
  checkPermission('it_reports_view'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, category, department } = req.query;

    const matchStage = { isActive: true };
    
    if (startDate || endDate) {
      matchStage.purchaseDate = {};
      if (startDate) matchStage.purchaseDate.$gte = new Date(startDate);
      if (endDate) matchStage.purchaseDate.$lte = new Date(endDate);
    }
    
    if (category) matchStage.category = category;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'employees',
          localField: 'assignedTo.employee',
          foreignField: '_id',
          as: 'assignedEmployee'
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: 'assignedEmployee.department',
          foreignField: '_id',
          as: 'department'
        }
      },
      {
        $match: department ? { 'department._id': new mongoose.Types.ObjectId(department) } : {}
      },
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          totalValue: { $sum: '$purchasePrice' },
          assignedAssets: {
            $sum: {
              $cond: [{ $ne: ['$assignedTo.employee', null] }, 1, 0]
            }
          },
          unassignedAssets: {
            $sum: {
              $cond: [{ $eq: ['$assignedTo.employee', null] }, 1, 0]
            }
          },
          categoryBreakdown: {
            $push: {
              category: '$category',
              assigned: {
                $cond: [{ $ne: ['$assignedTo.employee', null] }, 1, 0]
              },
              unassigned: {
                $cond: [{ $eq: ['$assignedTo.employee', null] }, 1, 0]
              },
              value: '$purchasePrice'
            }
          }
        }
      }
    ];

    const result = await ITAsset.aggregate(pipeline);

    // Process category breakdown
    const categoryStats = {};
    if (result.length > 0 && result[0].categoryBreakdown) {
      result[0].categoryBreakdown.forEach(item => {
        if (!categoryStats[item.category]) {
          categoryStats[item.category] = { assigned: 0, unassigned: 0, total: 0, value: 0 };
        }
        categoryStats[item.category].assigned += item.assigned;
        categoryStats[item.category].unassigned += item.unassigned;
        categoryStats[item.category].total += item.assigned + item.unassigned;
        categoryStats[item.category].value += item.value;
      });
    }

    res.json({
      success: true,
      data: result.length > 0 ? {
        summary: result[0],
        categoryStats
      } : {
        summary: {
          totalAssets: 0,
          totalValue: 0,
          assignedAssets: 0,
          unassignedAssets: 0,
          categoryBreakdown: []
        }
      }
    });
  })
);

// @route   GET /api/it/reports/license-expiry
// @desc    Get license expiry report
// @access  Private (IT, Admin)
router.get('/reports/license-expiry',
  checkPermission('it_reports_view'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, days = 30 } = req.query;

    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(days));

      // Get software with expiring licenses
      const expiringSoftware = await SoftwareInventory.find({
        isActive: true,
        expiryDate: { $lte: expiryDate, $gte: new Date() }
      })
        .populate('createdBy', 'firstName lastName')
        .sort({ expiryDate: 1 });

      // Get all software for statistics
      const allSoftware = await SoftwareInventory.find({ isActive: true });
      
      const totalLicenses = allSoftware.length;
      const expiringCount = expiringSoftware.length;
      const expiredCount = await SoftwareInventory.countDocuments({
        isActive: true,
        expiryDate: { $lt: new Date() }
      });

      // Group by vendor
      const vendorStats = expiringSoftware.reduce((acc, software) => {
        const vendorName = software.vendor?.vendorName || 'Unknown';
        if (!acc[vendorName]) {
          acc[vendorName] = { count: 0, software: [] };
        }
        acc[vendorName].count++;
        acc[vendorName].software.push(software);
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          summary: {
            totalLicenses,
            expiringCount,
            expiredCount,
            expiringInDays: parseInt(days)
          },
          vendorStats,
          expiringSoftware
        }
      });

    } catch (error) {
      console.error('License expiry report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate license expiry report'
      });
    }
  })
);

// @route   GET /api/it/reports/network-uptime
// @desc    Get network uptime report
// @access  Private (IT, Admin)
router.get('/reports/network-uptime',
  checkPermission('it_reports_view'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
      // Get network devices
      const devices = await NetworkDevice.find({ isActive: true })
        .populate('location', 'name')
        .sort({ name: 1 });

      // Calculate uptime statistics (mock data for now)
      const uptimeStats = devices.map(device => {
        // In a real implementation, you would calculate actual uptime from device logs
        const mockUptime = Math.random() * 100; // Mock uptime percentage
        return {
          deviceId: device._id,
          deviceName: device.name,
          deviceType: device.type,
          uptime: Math.round(mockUptime * 100) / 100,
          status: device.status,
          lastMaintenance: device.lastMaintenanceDate,
          location: device.location?.name || 'Unknown'
        };
      });

      const totalDevices = devices.length;
      const averageUptime = uptimeStats.reduce((sum, stat) => sum + stat.uptime, 0) / totalDevices;
      const devicesOnline = uptimeStats.filter(stat => stat.status === 'Online').length;
      const devicesOffline = totalDevices - devicesOnline;

      res.json({
        success: true,
        data: {
          summary: {
            totalDevices,
            devicesOnline,
            devicesOffline,
            averageUptime: Math.round(averageUptime * 100) / 100
          },
          deviceStats: uptimeStats
        }
      });

    } catch (error) {
      console.error('Network uptime report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate network uptime report'
      });
    }
  })
);

module.exports = router;
