const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const RentalAgreement = require('../models/hr/RentalAgreement');
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const { compressPDF } = require('../utils/pdfCompressor');

// Configure multer for image and PDF uploads
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
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext && file.mimetype === 'application/pdf') {
      ext = '.pdf';
    }
    cb(null, 'agreement-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit (increased for large PDFs)
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'), false);
    }
  }
});

// Get all rental agreements
router.get('/', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_agreements', 'read'), async (req, res) => {
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
router.get('/:id', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_agreements', 'read'), async (req, res) => {
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
router.post('/', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_agreements', 'create'), upload.single('agreementImage'), async (req, res) => {
  const startTime = Date.now();
  console.log('📥 POST /rental-agreements - Request received');
  console.log('📋 Body:', { agreementNumber: req.body.agreementNumber, propertyName: req.body.propertyName, status: req.body.status, hasFile: !!req.file });
  
  try {
    const agreementData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Handle file upload (image or PDF)
    if (req.file) {
      console.log('📎 Processing file upload:', req.file.filename, req.file.mimetype);
      const originalPath = req.file.path;
      const fileExt = path.extname(req.file.filename).toLowerCase();
      const isPDF = fileExt === '.pdf' || req.file.mimetype === 'application/pdf';
      
      if (isPDF) {
        console.log('📄 PDF detected, attempting compression...');
        try {
          const compressedPath = path.join(
            path.dirname(originalPath),
            path.basename(originalPath, '.pdf') + '-compressed.pdf'
          );
          
          // Compress with 20 second timeout to prevent request timeout
          await Promise.race([
            compressPDF(originalPath, compressedPath, 20000),
            new Promise((resolve) => setTimeout(() => resolve(), 20000))
          ]);
          
          if (fs.existsSync(compressedPath)) {
            const compressedSize = fs.statSync(compressedPath).size;
            const originalSize = fs.statSync(originalPath).size;
            
            if (compressedSize < originalSize && compressedSize > 0) {
              fs.unlinkSync(originalPath);
              fs.renameSync(compressedPath, originalPath);
              console.log('✅ PDF compressed successfully');
            } else {
              if (fs.existsSync(compressedPath)) {
                fs.unlinkSync(compressedPath);
              }
              console.log('ℹ️  Compression did not reduce size, using original');
            }
          }
        } catch (error) {
          console.error('❌ PDF compression error:', error.message);
          // Continue with original file if compression fails
        }
      } else {
        console.log('🖼️  Image file, skipping compression');
      }
      
      agreementData.agreementImage = `/uploads/rental-agreements/${req.file.filename}`;
    } else {
      console.log('ℹ️  No file uploaded');
    }

    console.log('💾 Saving agreement to database...');
    const agreement = new RentalAgreement(agreementData);
    
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
    res.status(201).json(agreement);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error after ${duration}ms:`, error.message);
    console.error('Stack:', error.stack);
    
    // Delete uploaded file if agreement creation fails
    if (req.file) {
      try {
        const filePath = path.join(__dirname, '../uploads/rental-agreements', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        // Also check for compressed version
        const compressedPath = filePath.replace('.pdf', '-compressed.pdf');
        if (fs.existsSync(compressedPath)) {
          fs.unlinkSync(compressedPath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError.message);
      }
    }
    
    const statusCode = error.message.includes('timeout') ? 504 : 
                      error.message.includes('duplicate') || error.message.includes('unique') ? 409 : 400;
    res.status(statusCode).json({ message: error.message });
  }
});

// Update rental agreement
router.put('/:id', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_agreements', 'update'), upload.single('agreementImage'), async (req, res) => {
  try {
    const agreement = await RentalAgreement.findById(req.params.id);
    
    if (!agreement) {
      return res.status(404).json({ message: 'Rental agreement not found' });
    }

    const updateData = { ...req.body };

    // Handle file upload (image or PDF)
    if (req.file) {
      // Delete old file if exists
      if (agreement.agreementImage) {
        const oldFilePath = path.join(__dirname, '..', agreement.agreementImage);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      
      const originalPath = req.file.path;
      const fileExt = path.extname(req.file.filename).toLowerCase();
      const isPDF = fileExt === '.pdf' || req.file.mimetype === 'application/pdf';
      
      if (isPDF) {
        try {
          const compressedPath = path.join(
            path.dirname(originalPath),
            path.basename(originalPath, '.pdf') + '-compressed.pdf'
          );
          
          // Compress with 20 second timeout to prevent request timeout
          await Promise.race([
            compressPDF(originalPath, compressedPath, 20000),
            new Promise((resolve) => setTimeout(() => resolve(), 20000))
          ]);
          
          if (fs.existsSync(compressedPath)) {
            const compressedSize = fs.statSync(compressedPath).size;
            const originalSize = fs.statSync(originalPath).size;
            
            if (compressedSize < originalSize && compressedSize > 0) {
              fs.unlinkSync(originalPath);
              fs.renameSync(compressedPath, originalPath);
            } else {
              if (fs.existsSync(compressedPath)) {
                fs.unlinkSync(compressedPath);
              }
            }
          }
        } catch (error) {
          console.error('PDF compression error:', error.message);
          // Continue with original file if compression fails
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
      // Also check for compressed version
      const compressedPath = filePath.replace('.pdf', '-compressed.pdf');
      if (fs.existsSync(compressedPath)) {
        fs.unlinkSync(compressedPath);
      }
    }
    res.status(400).json({ message: error.message });
  }
});

// Delete rental agreement
router.delete('/:id', authMiddleware, permissions.checkSubRolePermission('admin', 'rental_agreements', 'delete'), async (req, res) => {
  try {
    const agreement = await RentalAgreement.findById(req.params.id);
    
    if (!agreement) {
      return res.status(404).json({ message: 'Rental agreement not found' });
    }

    // Delete associated file
    if (agreement.agreementImage) {
      const filePath = path.join(__dirname, '..', agreement.agreementImage);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await RentalAgreement.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Rental agreement deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
