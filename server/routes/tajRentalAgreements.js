const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TajRentalAgreement = require('../models/tajResidencia/TajRentalAgreement');
const permissions = require('../middleware/permissions');

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

    const agreementData = {
      ...req.body,
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


