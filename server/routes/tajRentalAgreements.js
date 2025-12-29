const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TajRentalAgreement = require('../models/tajResidencia/TajRentalAgreement');
const permissions = require('../middleware/permissions');
const { createFileServerRoute } = require('../utils/fileServer');

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
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const withPermission = (action) =>
  [permissions.checkSubRolePermission('finance', 'taj_rental_agreements', action)];

const validateAgreementPayload = (body) => {
  const errors = [];

  if (body.startDate && body.endDate) {
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (startDate >= endDate) {
      errors.push('End date must be after start date');
    }
  }

  if (body.monthlyRent && (isNaN(body.monthlyRent) || body.monthlyRent <= 0)) {
    errors.push('Monthly rent must be a positive number');
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
    const agreements = await TajRentalAgreement.find()
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(agreements);
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

    res.json(agreement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', withPermission('create'), upload.single('agreementImage'), async (req, res) => {
  try {
    const errors = validateAgreementPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors.join(', ') });
    }

    // Auto-generate unique agreement number (last + 1)
    // Ignore user-provided agreementNumber and always auto-generate
    let agreementNumber;
    const lastAgreement = await TajRentalAgreement.findOne()
      .sort({ createdAt: -1 })
      .select('agreementNumber');
    
    if (lastAgreement && lastAgreement.agreementNumber) {
      // Try to extract numeric part from last agreement number
      // Handle formats like: AGR-000001, AGR-1, 1, etc.
      const match = lastAgreement.agreementNumber.toString().match(/(\d+)$/);
      if (match) {
        const lastNumber = parseInt(match[1], 10);
        agreementNumber = `AGR-${String(lastNumber + 1).padStart(6, '0')}`;
      } else {
        // If format doesn't match, check all agreements to find highest number
        const allAgreements = await TajRentalAgreement.find()
          .select('agreementNumber')
          .lean();
        
        let maxNumber = 0;
        allAgreements.forEach(ag => {
          if (ag.agreementNumber) {
            const match = ag.agreementNumber.toString().match(/(\d+)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNumber) maxNumber = num;
            }
          }
        });
        
        agreementNumber = `AGR-${String(maxNumber + 1).padStart(6, '0')}`;
      }
    } else {
      // First agreement
      agreementNumber = 'AGR-000001';
    }
    
    // Ensure uniqueness (in case of race condition or if number already exists)
    let counter = 1;
    let maxAttempts = 100;
    while (await TajRentalAgreement.findOne({ agreementNumber }) && maxAttempts > 0) {
      const match = agreementNumber.match(/(\d+)$/);
      if (match) {
        const currentNumber = parseInt(match[1], 10);
        agreementNumber = `AGR-${String(currentNumber + counter).padStart(6, '0')}`;
        counter++;
      } else {
        agreementNumber = `AGR-${String(counter).padStart(6, '0')}`;
        counter++;
      }
      maxAttempts--;
    }
    
    if (maxAttempts === 0) {
      // Fallback: use timestamp-based unique number
      agreementNumber = `AGR-${Date.now()}`;
    }

    // Generate unique code if not provided (to handle legacy code field unique index)
    let uniqueCode = req.body.code;
    if (!uniqueCode) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      uniqueCode = `TRA-${timestamp}-${random}`;
      
      // Ensure uniqueness
      let codeExists = true;
      while (codeExists) {
        const existing = await TajRentalAgreement.findOne({ code: uniqueCode });
        if (!existing) {
          codeExists = false;
        } else {
          uniqueCode = `TRA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }
      }
    }

    const agreementData = {
      ...req.body,
      agreementNumber: agreementNumber, // Override with auto-generated number
      code: uniqueCode,
      createdBy: req.user.id
    };

    if (req.file) {
      agreementData.agreementImage = `/uploads/taj-rental-agreements/${req.file.filename}`;
    }

    const agreement = new TajRentalAgreement(agreementData);
    await agreement.save();
    await agreement.populate('createdBy', 'firstName lastName');

    res.status(201).json(agreement);
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

router.put('/:id', withPermission('update'), upload.single('agreementImage'), async (req, res) => {
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
    res.json({ message: 'Rental agreement deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
module.exports.fileRouter = fileRouter;


