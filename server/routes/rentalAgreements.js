const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const RentalAgreement = require('../models/hr/RentalAgreement');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/rental-agreements');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'agreement-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all rental agreements
router.get('/', authMiddleware, permissions.checkPermission('admin'), async (req, res) => {
  try {
    const agreements = await RentalAgreement.find()
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json(agreements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get rental agreement by ID
router.get('/:id', authMiddleware, permissions.checkPermission('admin'), async (req, res) => {
  try {
    const agreement = await RentalAgreement.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');
    
    if (!agreement) {
      return res.status(404).json({ message: 'Rental agreement not found' });
    }
    
    res.json(agreement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new rental agreement
router.post('/', authMiddleware, permissions.checkPermission('admin'), upload.single('agreementImage'), async (req, res) => {
  try {
    const agreementData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Add image path if uploaded
    if (req.file) {
      agreementData.agreementImage = `/uploads/rental-agreements/${req.file.filename}`;
    }

    const agreement = new RentalAgreement(agreementData);
    
    await agreement.save();
    await agreement.populate('createdBy', 'firstName lastName');
    
    res.status(201).json(agreement);
  } catch (error) {
    // Delete uploaded file if agreement creation fails
    if (req.file) {
      const filePath = path.join(__dirname, '../uploads/rental-agreements', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(400).json({ message: error.message });
  }
});

// Update rental agreement
router.put('/:id', authMiddleware, permissions.checkPermission('admin'), upload.single('agreementImage'), async (req, res) => {
  try {
    const agreement = await RentalAgreement.findById(req.params.id);
    
    if (!agreement) {
      return res.status(404).json({ message: 'Rental agreement not found' });
    }

    const updateData = { ...req.body };

    // Handle image upload
    if (req.file) {
      // Delete old image if exists
      if (agreement.agreementImage) {
        const oldImagePath = path.join(__dirname, '..', agreement.agreementImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      updateData.agreementImage = `/uploads/rental-agreements/${req.file.filename}`;
    }

    const updatedAgreement = await RentalAgreement.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');
    
    res.json(updatedAgreement);
  } catch (error) {
    // Delete uploaded file if update fails
    if (req.file) {
      const filePath = path.join(__dirname, '../uploads/rental-agreements', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.status(400).json({ message: error.message });
  }
});

// Delete rental agreement
router.delete('/:id', authMiddleware, permissions.checkPermission('admin'), async (req, res) => {
  try {
    const agreement = await RentalAgreement.findById(req.params.id);
    
    if (!agreement) {
      return res.status(404).json({ message: 'Rental agreement not found' });
    }

    // Delete associated image file
    if (agreement.agreementImage) {
      const imagePath = path.join(__dirname, '..', agreement.agreementImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await RentalAgreement.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Rental agreement deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
