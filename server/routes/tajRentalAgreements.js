const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TajRentalAgreement = require('../models/tajResidencia/TajRentalAgreement');
const permissions = require('../middleware/permissions');
const { createFileServerRoute } = require('../utils/fileServer');
const {
  getCached,
  setCached,
  clearCached,
  CACHE_KEYS
} = require('../utils/tajUtilitiesOptimizer');

// Export file router separately (without auth middleware, handles auth internally)
const fileRouter = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/taj-rental-agreements');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'taj-agreement-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and common document formats
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Allowed types: Images, PDF, Word documents, and text files (max 10MB)'), false);
    }
  }
});

const withPermission = (action) =>
  [permissions.checkSubRolePermission('finance', 'taj_rental_agreements', action)];

const validateAgreementPayload = (body) => {
  const errors = [];

  // Required fields validation
  if (!body.propertyName || !body.propertyName.trim()) {
    errors.push('Property name is required');
  }

  if (!body.propertyAddress || !body.propertyAddress.trim()) {
    errors.push('Property address is required');
  }

  if (!body.tenantName || !body.tenantName.trim()) {
    errors.push('Tenant name is required');
  }

  if (!body.tenantContact || !body.tenantContact.trim()) {
    errors.push('Tenant contact is required');
  }

  if (!body.monthlyRent || isNaN(body.monthlyRent) || body.monthlyRent <= 0) {
    errors.push('Monthly rent is required and must be a positive number');
  }

  if (!body.startDate) {
    errors.push('Start date is required');
  }

  if (!body.endDate) {
    errors.push('End date is required');
  }

  // Date validation
  if (body.startDate && body.endDate) {
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (startDate >= endDate) {
      errors.push('End date must be after start date');
    }
  }

  if (body.securityDeposit && (isNaN(body.securityDeposit) || body.securityDeposit < 0)) {
    errors.push('Security deposit must be a positive number');
  }

  if (body.annualRentIncreaseValue && isNaN(body.annualRentIncreaseValue)) {
    errors.push('Annual rent increase value must be numeric');
  }

  return errors;
};

router.get('/', withPermission('read'), async (req, res) => {
  try {
    // OPTIMIZATION: Check cache first
    const cached = getCached(CACHE_KEYS.RENTAL_AGREEMENTS_LIST);
    if (cached) {
      console.log('📋 Returning cached rental agreements list');
      return res.json(cached);
    }
    
    // First, update any agreements that should be expired
    const now = new Date();
    await TajRentalAgreement.updateMany(
      {
        status: 'Active',
        endDate: { $lt: now }
      },
      {
        $set: { status: 'Expired' }
      }
    );
    
    // OPTIMIZATION: Select only needed fields and use lean
    const agreements = await TajRentalAgreement.find()
      .select('_id agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate terms agreementImage status createdBy createdAt updatedAt')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    const response = agreements;
    
    // OPTIMIZATION: Cache the response
    setCached(CACHE_KEYS.RENTAL_AGREEMENTS_LIST, response);

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Serve Taj rental agreement file (must be before /:id route)
// Uses centralized file server utility for optimized, secure file serving
fileRouter.get('/file/:filename', createFileServerRoute({
  uploadDir: 'uploads/taj-rental-agreements',
  module: 'finance',
  submodule: 'taj_rental_agreements'
}));

router.get('/:id', withPermission('read'), async (req, res) => {
  try {
    const agreement = await TajRentalAgreement.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!agreement) {
      return res.status(404).json({ message: 'Rental agreement not found' });
    }

    clearCached(CACHE_KEYS.RENTAL_AGREEMENTS_LIST); // Invalidate cache on update
    res.json(agreement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', withPermission('create'), (req, res, next) => {
  upload.single('agreementImage')(req, res, (err) => {
    if (err) {
      // Handle multer errors (file size, file type, etc.)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 10MB limit' });
      }
      // Handle other upload errors (file type rejection, etc.)
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  const startTime = Date.now();
  console.log('📥 POST /taj-rental-agreements - Request received');
  console.log('📋 Body:', { propertyName: req.body.propertyName, tenantName: req.body.tenantName, hasFile: !!req.file });
  
  try {

    const errors = validateAgreementPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors.join(', ') });
    }

    console.log('🔢 Generating agreement number...');
    // Auto-generate unique agreement number (optimized - single query)
    let agreementNumber;
    const lastAgreement = await Promise.race([
      TajRentalAgreement.findOne().sort({ createdAt: -1 }).select('agreementNumber').lean(),
      new Promise((resolve) => setTimeout(() => resolve(null), 5000))
    ]);
    
    if (lastAgreement && lastAgreement.agreementNumber) {
      // Try to extract numeric part from last agreement number
      const match = lastAgreement.agreementNumber.toString().match(/(\d+)$/);
      if (match) {
        const lastNumber = parseInt(match[1], 10);
        agreementNumber = `AGR-${String(lastNumber + 1).padStart(6, '0')}`;
      } else {
        agreementNumber = 'AGR-000001';
      }
    } else {
      // First agreement or timeout
      agreementNumber = 'AGR-000001';
    }
    
    // Quick uniqueness check (single attempt, fallback to timestamp if conflict)
    const exists = await Promise.race([
      TajRentalAgreement.findOne({ agreementNumber }).select('_id').lean(),
      new Promise((resolve) => setTimeout(() => resolve(null), 2000))
    ]);
    
    if (exists) {
      // Fallback: use timestamp-based unique number
      agreementNumber = `AGR-${Date.now()}`;
    }

    console.log('🔑 Generating unique code...');
    // Generate unique code (optimized - single check)
    let uniqueCode = req.body.code;
    if (!uniqueCode) {
      uniqueCode = `TRA-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      // Single check for uniqueness (fallback if exists)
      const codeExists = await Promise.race([
        TajRentalAgreement.findOne({ code: uniqueCode }).select('_id').lean(),
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
      
      if (codeExists) {
        uniqueCode = `TRA-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      }
    }

    const agreementData = {
      ...req.body,
      agreementNumber: agreementNumber,
      code: uniqueCode,
      createdBy: req.user.id
    };

    if (req.file) {
      console.log('📎 Processing file upload:', req.file.filename, req.file.mimetype);
      agreementData.agreementImage = `/uploads/taj-rental-agreements/${req.file.filename}`;
    } else {
      console.log('ℹ️  No file uploaded');
    }

    console.log('💾 Saving agreement to database...');
    const agreement = new TajRentalAgreement(agreementData);
    
    // Add timeout to database save operation (30 seconds)
    await Promise.race([
      agreement.save(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database save timeout')), 30000))
    ]);
    
    console.log('✅ Agreement saved, populating createdBy...');
    await Promise.race([
      agreement.populate('createdBy', 'firstName lastName'),
      new Promise((resolve) => setTimeout(() => resolve(), 5000))
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ Request completed in ${duration}ms`);
    clearCached(CACHE_KEYS.RENTAL_AGREEMENTS_LIST); // Invalidate cache on creation
    res.status(201).json(agreement);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error after ${duration}ms:`, error.message);
    console.error('Stack:', error.stack);
    
    // Delete uploaded file if agreement creation fails
    if (req.file) {
      try {
        const filePath = path.join(__dirname, '../uploads/taj-rental-agreements', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError.message);
      }
    }
    
    const statusCode = error.message.includes('timeout') ? 504 : 
                      error.name === 'ValidationError' ? 400 : 500;
    const errorMessage = error.message || 'Failed to create rental agreement';
    res.status(statusCode).json({ message: errorMessage });
  }
});

router.put('/:id', withPermission('update'), (req, res, next) => {
  upload.single('agreementImage')(req, res, (err) => {
    if (err) {
      // Handle multer errors (file size, file type, etc.)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 10MB limit' });
      }
      // Handle other upload errors (file type rejection, etc.)
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const agreement = await TajRentalAgreement.findById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ message: 'Rental agreement not found' });
    }

    const errors = validateAgreementPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors.join(', ') });
    }

    const updateData = { ...req.body };

    // Auto-update status when dates change (findByIdAndUpdate bypasses pre-save)
    const newEndDate = req.body.endDate ? new Date(req.body.endDate) : null;
    if (newEndDate && agreement.status !== 'Terminated') {
      const now = new Date();
      const endDateOnly = new Date(newEndDate.getFullYear(), newEndDate.getMonth(), newEndDate.getDate());
      const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (endDateOnly < nowOnly) {
        updateData.status = 'Expired';
      } else {
        updateData.status = 'Active'; // Extending endDate to future → set Active
      }
    }

    if (req.file) {
      if (agreement.agreementImage) {
        const oldPath = path.join(__dirname, '..', agreement.agreementImage);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      updateData.agreementImage = `/uploads/taj-rental-agreements/${req.file.filename}`;
    }

    const updatedAgreement = await TajRentalAgreement.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');

    clearCached(CACHE_KEYS.RENTAL_AGREEMENTS_LIST);
    clearCached(CACHE_KEYS.RENTAL_MANAGEMENT_PROPERTIES);
    clearCached(CACHE_KEYS.RENTAL_MANAGEMENT_PROPERTIES_LIST); // Properties show agreement status
    res.json(updatedAgreement);
  } catch (error) {
    if (req.file) {
      const filePath = path.join(__dirname, '../uploads/taj-rental-agreements', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', withPermission('delete'), async (req, res) => {
  try {
    const agreement = await TajRentalAgreement.findById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ message: 'Rental agreement not found' });
    }

    if (agreement.agreementImage) {
      const imagePath = path.join(__dirname, '..', agreement.agreementImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await TajRentalAgreement.findByIdAndDelete(req.params.id);
    clearCached(CACHE_KEYS.RENTAL_AGREEMENTS_LIST); // Invalidate cache on deletion
    res.json({ message: 'Rental agreement deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
module.exports.fileRouter = fileRouter;


