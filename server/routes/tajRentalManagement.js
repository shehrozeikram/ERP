const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TajProperty = require('../models/tajResidencia/TajProperty');
const TajRentalAgreement = require('../models/tajResidencia/TajRentalAgreement');
const { authMiddleware } = require('../middleware/auth');
const {
  getCached,
  setCached,
  clearCached,
  CACHE_KEYS
} = require('../utils/tajUtilitiesOptimizer');

const attachmentsDir = path.join(__dirname, '../uploads/payment-attachments');
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
}

const paymentAttachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attachmentsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const paymentAttachmentUpload = multer({
  storage: paymentAttachmentStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const cleanupAttachment = (file) => {
  if (file) {
    const filePath = path.join(attachmentsDir, file.filename);
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Failed to cleanup attachment:', err);
      }
    });
  }
};

const mapGeneralRentalProperty = (property) => ({
  id: property._id,
  srNo: property.srNo || null,
  propertyType: property.propertyType || 'House',
  propertyName: property.propertyName || property.plotNumber || 'Unnamed',
  plotNumber: property.plotNumber || '',
  sector: property.sector || '',
  street: property.street || '',
  block: property.block || '',
  floor: property.floor || '',
  unit: property.unit || '',
  fullAddress: property.fullAddress || property.address || '',
  project: property.project || '',
  categoryType: property.categoryType || 'Personal',
  ownerName: property.ownerName || '',
  contactNumber: property.contactNumber || '',
  tenantName: property.tenantName || property.rentalAgreement?.tenantName || '',
  tenantPhone: property.tenantPhone || property.rentalAgreement?.tenantContact || '',
  status: property.status || 'Pending',
  expectedRent: property.expectedRent || 0,
  securityDeposit: property.securityDeposit || 0,
  areaValue: property.areaValue || 0,
  areaUnit: property.areaUnit || 'Sq Ft',
  rentalAgreement: property.rentalAgreement
    ? {
        id: property.rentalAgreement._id,
        agreementNumber: property.rentalAgreement.agreementNumber,
        propertyName: property.rentalAgreement.propertyName,
        monthlyRent: property.rentalAgreement.monthlyRent,
        startDate: property.rentalAgreement.startDate,
        endDate: property.rentalAgreement.endDate
      }
    : null,
  createdAt: property.createdAt,
  updatedAt: property.updatedAt
});

const summarizeGeneralRentalProperties = (properties = []) => {
  const statusCounts = properties.reduce((acc, property) => {
    const key = property.status || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const totalExpectedRent = properties.reduce((sum, property) => sum + (property.expectedRent || 0), 0);
  const totalSecurityDeposit = properties.reduce((sum, property) => sum + (property.securityDeposit || 0), 0);

  return {
    totalProperties: properties.length,
    statusBreakdown: {
      available: statusCounts.Available || 0,
      rented: statusCounts.Rented || 0,
      reserved: statusCounts.Reserved || 0,
      underMaintenance: statusCounts['Under Maintenance'] || statusCounts['Under maintenance'] || 0,
      pending: statusCounts.Pending || 0
    },
    rent: {
      expectedTotal: totalExpectedRent,
      securityDepositTotal: totalSecurityDeposit,
      expectedAverage: properties.length ? totalExpectedRent / properties.length : 0
    }
  };
};

const mapRentalPropertyResponse = (property) => {
  const areaValue = property.areaValue ?? property.area?.value ?? 0;
  const areaUnit = property.areaUnit ?? property.area?.unit ?? 'Sq Ft';
  const payments = (property.rentalPayments || []).map((payment) => ({
    _id: payment._id,
    amount: payment.amount || 0,
    arrears: payment.arrears || 0,
    totalAmount: payment.totalAmount || ((payment.amount || 0) + (payment.arrears || 0)),
    paymentDate: payment.paymentDate,
    periodFrom: payment.periodFrom,
    periodTo: payment.periodTo,
    invoiceNumber: payment.invoiceNumber,
    paymentMethod: payment.paymentMethod,
    bankName: payment.bankName || '',
    attachmentUrl: payment.attachmentUrl || '',
    reference: payment.reference,
    notes: payment.notes,
    status: payment.status || 'Draft',
    statusUpdatedAt: payment.statusUpdatedAt,
    recordedAt: payment.recordedAt
  }));

  const baseRent =
    property.rentalAgreement?.monthlyRent ||
    property.rentalAgreement?.increasedRent ||
    property.expectedRent ||
    0;
  const totalPaidAmount = payments.reduce(
    (sum, payment) => sum + (payment.totalAmount || payment.amount || 0),
    0
  );
  const recordedArrears = payments.reduce((sum, payment) => sum + (payment.arrears || 0), 0);
  const manualPendingArrears = [property.pendingRent, property.pendingAmount, property.pendingArrears].find(
    (value) => value !== undefined && value !== null
  );
  const rentArrears =
    manualPendingArrears !== undefined
      ? Number(manualPendingArrears) || 0
      : recordedArrears;
  const totalDue = baseRent + rentArrears;

  const paymentTotals = payments.reduce((acc, payment) => {
    const amount = payment.totalAmount || payment.amount || 0;
    acc.total += amount;
    if ((payment.status || '').toLowerCase() === 'unpaid') {
      acc.unpaid += amount;
    }
    return acc;
  }, { total: 0, unpaid: 0 });

  paymentTotals.paid = totalPaidAmount;
  paymentTotals.due = totalDue;

  let paymentStatus = 'unpaid';
  if (totalDue <= 0 && totalPaidAmount <= 0) {
    paymentStatus = 'unpaid';
  } else if (totalPaidAmount >= totalDue && totalDue > 0) {
    paymentStatus = 'paid';
  } else if (totalPaidAmount > 0) {
    paymentStatus = 'partial_paid';
  }

  const paymentsWithStatus = payments.map((payment) => ({
    ...payment,
    status: paymentStatus
  }));

  return {
    _id: property._id,
    srNo: property.srNo,
    propertyCode: property.srNo ? `PR-${property.srNo}` : (property.plotNumber || property._id.toString()),
    propertyType: property.propertyType || 'House',
    propertyName: property.propertyName || property.plotNumber || 'Unnamed',
    ownerName: property.ownerName || '',
    contactNumber: property.contactNumber || '',
    categoryType: property.categoryType || 'Personal Rent',
    status: property.status || 'Pending',
    plotNumber: property.plotNumber || '',
    project: property.project || '',
    street: property.street || '',
    sector: property.sector || '',
    block: property.block || '',
    floor: property.floor || '',
    unit: property.unit || '',
    city: property.city || '',
    fullAddress: property.fullAddress || property.address || '',
    expectedRent: property.expectedRent || 0,
    securityDeposit: property.securityDeposit || 0,
    area: { value: areaValue, unit: areaUnit },
    tenantName: property.tenantName || '',
    tenantPhone: property.tenantPhone || '',
    tenantEmail: property.tenantEmail || '',
    tenantCNIC: property.tenantCNIC || '',
    rentalAgreement: property.rentalAgreement ? {
      _id: property.rentalAgreement._id,
      agreementNumber: property.rentalAgreement.agreementNumber,
      propertyName: property.rentalAgreement.propertyName,
      monthlyRent: property.rentalAgreement.monthlyRent,
      startDate: property.rentalAgreement.startDate,
      endDate: property.rentalAgreement.endDate
    } : null,
    payments: paymentsWithStatus,
    paymentTotals,
    rentAmount: baseRent,
    rentArrears,
    totalPaidAmount,
    paymentStatus
  };
};

const fetchPersonalRentProperties = async ({ status, search, sector, categoryType }) => {
  const filters = { categoryType: 'Personal Rent' };
  if (status) {
    filters.status = status;
  }
  if (sector) {
    filters.sector = sector;
  }
  if (categoryType) {
    filters.categoryType = categoryType;
  }
  if (search) {
    const pattern = new RegExp(search, 'i');
    filters.$or = [
      { propertyName: pattern },
      { ownerName: pattern },
      { plotNumber: pattern },
      { project: pattern },
      { street: pattern },
      { sector: pattern }
    ];
  }

  // OPTIMIZATION: Select only needed fields and use lean
  const properties = await TajProperty.find(filters)
    .select('_id srNo propertyType propertyName plotNumber rdaNumber street sector block floor unit categoryType address fullAddress project ownerName contactNumber status expectedRent securityDeposit areaValue areaUnit rentalAgreement resident createdAt updatedAt')
    .populate('rentalAgreement', 'agreementNumber propertyName monthlyRent startDate endDate tenantName tenantContact tenantIdCard annualRentIncreaseType annualRentIncreaseValue increasedRent')
    .sort({ srNo: 1 })
    .lean();

  const mapped = properties.map(mapRentalPropertyResponse);
  const summary = summarizeGeneralRentalProperties(mapped);
  return { mapped, summary };
};

// ========== PROPERTY ROUTES ==========

// General rental properties sourced from TajProperty master data
router.get('/general-properties', authMiddleware, async (req, res) => {
  try {
    // OPTIMIZATION: Check cache first (only if no filters/search)
    const hasFilters = req.query.status || req.query.search || req.query.sector || req.query.categoryType;
    const cacheKey = hasFilters ? null : CACHE_KEYS.RENTAL_MANAGEMENT_PROPERTIES;
    
    if (cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) {
        console.log('📋 Returning cached rental management properties');
        return res.json(cached);
      }
    }
    
    const { mapped, summary } = await fetchPersonalRentProperties(req.query || {});
    const response = {
      success: true,
      data: {
        summary,
        properties: mapped
      }
    };
    
    // OPTIMIZATION: Cache response if no filters
    if (cacheKey) {
      setCached(cacheKey, response);
    }
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load general rental properties',
      error: error.message
    });
  }
});

// Get personal rent properties (primary listing)
router.get('/properties', authMiddleware, async (req, res) => {
  try {
    // OPTIMIZATION: Check cache first (only if no filters/search)
    const hasFilters = req.query.status || req.query.search || req.query.sector || req.query.categoryType;
    const cacheKey = hasFilters ? null : CACHE_KEYS.RENTAL_MANAGEMENT_PROPERTIES;
    
    if (cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) {
        console.log('📋 Returning cached rental properties');
        return res.json(cached);
      }
    }
    
    const { mapped, summary } = await fetchPersonalRentProperties(req.query || {});
    const response = { success: true, data: mapped, summary };
    
    // OPTIMIZATION: Cache response if no filters
    if (cacheKey) {
      setCached(cacheKey, response);
    }
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch properties', error: error.message });
  }
});

// Get property by ID
router.get('/properties/:id', authMiddleware, async (req, res) => {
  try {
    const property = await TajProperty.findOne({
      _id: req.params.id,
      categoryType: 'Personal Rent'
    })
      .populate('rentalAgreement', 'agreementNumber propertyName monthlyRent startDate endDate tenantName tenantContact tenantIdCard annualRentIncreaseType annualRentIncreaseValue increasedRent')
      .lean();
    
    if (!property) {
      cleanupAttachment(req.file);
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    
    res.json({ success: true, data: mapRentalPropertyResponse(property) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== PAYMENT ROUTES ==========

// Add payment to property
router.post('/properties/:id/payments', authMiddleware, paymentAttachmentUpload.single('attachment'), async (req, res) => {
  try {
    const { amount, arrears, paymentDate, periodFrom, periodTo, invoiceNumber, paymentMethod, bankName, reference, notes } = req.body;

    const property = await TajProperty.findOne({
      _id: req.params.id,
      categoryType: 'Personal Rent'
    });
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const paymentAmount = Number(amount) || 0;
    const arrearsAmount = Number(arrears) || 0;
    const totalAmount = paymentAmount + arrearsAmount;

    const attachmentUrl = req.file ? `/uploads/payment-attachments/${req.file.filename}` : '';

    property.rentalPayments.push({
      amount: paymentAmount,
      arrears: arrearsAmount,
      totalAmount: totalAmount,
      paymentDate: paymentDate || new Date(),
      periodFrom: periodFrom ? new Date(periodFrom) : undefined,
      periodTo: periodTo ? new Date(periodTo) : undefined,
      invoiceNumber: invoiceNumber || '',
      paymentMethod: paymentMethod || 'Bank Transfer',
      bankName: bankName || '',
      attachmentUrl,
      reference: reference || '',
      notes: notes || '',
      status: 'Draft',
      statusUpdatedAt: new Date(),
      recordedBy: req.user.id
    });

    // Calculate payment status based on total payments vs expected rent
    const monthlyRent = property.rentalAgreement?.monthlyRent || property.expectedRent || 0;
    const totalPaid = property.rentalPayments.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);
    
    // Calculate overall payment status for the property
    let overallStatus = 'Unpaid';
    if (totalPaid >= monthlyRent && monthlyRent > 0) {
      overallStatus = 'Approved';
    } else if (totalPaid > 0) {
      overallStatus = 'Pending Approval';
    }
    
    // Update payment status for each payment - all payments share the same status
    // since they're cumulative towards the monthly rent
    property.rentalPayments.forEach((payment) => {
      payment.status = overallStatus;
      payment.statusUpdatedAt = new Date();
    });

    await property.save();
    await property.populate('rentalAgreement', 'agreementNumber propertyName monthlyRent startDate endDate tenantName tenantContact tenantIdCard');
    clearCached(CACHE_KEYS.RENTAL_MANAGEMENT_PROPERTIES); // Invalidate cache on payment update
    res.json({ success: true, data: mapRentalPropertyResponse(property.toObject()) });
  } catch (error) {
    cleanupAttachment(req.file);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update payment status
router.patch('/properties/:propertyId/payments/:paymentId/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['Draft', 'Unpaid', 'Pending Approval', 'Approved', 'Rejected', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status' });
    }

    const property = await TajProperty.findOne({
      _id: req.params.propertyId,
      categoryType: 'Personal Rent'
    });
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const payment = property.rentalPayments.id(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    payment.status = status;
    payment.statusUpdatedAt = new Date();
    property.markModified('rentalPayments');
    await property.save();

    await property.populate('rentalAgreement', 'agreementNumber propertyName monthlyRent startDate endDate tenantName tenantContact tenantIdCard');
    res.json({ success: true, data: mapRentalPropertyResponse(property.toObject()) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a specific payment from property
router.delete('/properties/:propertyId/payments/:paymentId', authMiddleware, async (req, res) => {
  try {
    const property = await TajProperty.findOne({
      _id: req.params.propertyId,
      categoryType: 'Personal Rent'
    });
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const payment = property.rentalPayments.id(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Delete attachment if exists
    if (payment.attachmentUrl) {
      const attachmentPath = path.join(__dirname, '..', payment.attachmentUrl);
      if (fs.existsSync(attachmentPath)) {
        fs.unlink(attachmentPath, (err) => {
          if (err) console.error('Failed to delete attachment:', err);
        });
      }
    }

    // Remove payment from array
    property.rentalPayments.pull(req.params.paymentId);
    property.markModified('rentalPayments');

    // Recalculate payment status based on remaining payments
    const monthlyRent = property.rentalAgreement?.monthlyRent || property.expectedRent || 0;
    const totalPaid = property.rentalPayments.reduce((sum, p) => sum + (p.totalAmount || p.amount || 0), 0);
    
    let overallStatus = 'Unpaid';
    if (totalPaid >= monthlyRent && monthlyRent > 0) {
      overallStatus = 'Approved';
    } else if (totalPaid > 0) {
      overallStatus = 'Pending Approval';
    }

    // Update payment status for all remaining payments
    property.rentalPayments.forEach((p) => {
      p.status = overallStatus;
      p.statusUpdatedAt = new Date();
    });

    await property.save();
    await property.populate('rentalAgreement', 'agreementNumber propertyName monthlyRent startDate endDate tenantName tenantContact tenantIdCard');
    
    res.json({ 
      success: true, 
      message: 'Payment deleted successfully',
      data: mapRentalPropertyResponse(property.toObject())
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate invoice number
const generateInvoiceNumber = (propertyType, year, month, index) => {
  const prefix = propertyType === 'Play Ground' ? 'PG' : 'TAJ';
  const paddedIndex = String(index).padStart(3, '0');
  const paddedMonth = String(month).padStart(2, '0');
  return `${prefix}-${year}-${paddedMonth}-${paddedIndex}`;
};

const buildInvoicePayload = (property, payment) => {
  const basePeriodFrom = payment.periodFrom || payment.paymentDate;
  const basePeriodTo = payment.periodTo || payment.paymentDate;
  const fallbackIndex = property.rentalPayments?.indexOf(payment) ?? -1;

  return {
    propertyType: property.propertyType || 'House',
    tenantName: property.tenantName || property.ownerName || 'N/A',
    address: property.fullAddress || `${property.street || ''} ${property.sector || ''}`.trim(),
    periodFrom: basePeriodFrom,
    periodTo: basePeriodTo,
    billMonth: basePeriodFrom ? dayjs(basePeriodFrom).format('MMMM YYYY') : null,
    invoiceNumber:
      payment.invoiceNumber ||
      generateInvoiceNumber(
        property.propertyType,
        new Date(payment.paymentDate).getFullYear(),
        new Date(payment.paymentDate).getMonth() + 1,
        fallbackIndex >= 0 ? fallbackIndex + 1 : 1
      ),
    invoicingDate: payment.paymentDate,
    dueDate: payment.periodTo || payment.paymentDate,
    charges: payment.charges || [
      {
        description: 'RENT CHARGES',
        amount: payment.amount
      }
    ],
    amount: payment.amount,
    arrears: payment.arrears || 0,
    totalAmount: payment.totalAmount || payment.amount + (payment.arrears || 0),
    autoGenerated: Boolean(payment.autoGenerated),
    sourcePaymentId: payment._id || null,
    property
  };
};

// Get invoice data for property payment
router.get('/properties/:id/invoice/:paymentId', authMiddleware, async (req, res) => {
  try {
    const property = await TajProperty.findOne({
      _id: req.params.id,
      categoryType: 'Personal Rent'
    }).populate('rentalAgreement');
    
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const payment = property.rentalPayments.id(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const invoiceData = buildInvoicePayload(property, payment);

    res.json({ success: true, data: invoiceData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/properties/:id/latest-invoice', authMiddleware, async (req, res) => {
  try {
    const property = await TajProperty.findOne({
      _id: req.params.id,
      categoryType: 'Personal Rent'
    }).populate('rentalAgreement');

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const payments = property.rentalPayments || [];

    let latestPayment;
    if (payments.length) {
      latestPayment = [...payments].sort(
        (a, b) =>
          new Date(b.paymentDate || b.periodTo || b.createdAt || 0) -
          new Date(a.paymentDate || a.periodTo || a.createdAt || 0)
      )[0];
    } else {
      const now = dayjs();
      const expectedRent =
        property.rentalAgreement?.monthlyRent ||
        property.rentalAgreement?.increasedRent ||
        property.expectedRent ||
        0;

      const estimatedArrears =
        property.pendingRent ||
        property.pendingAmount ||
        property.pendingArrears ||
        0;

      latestPayment = {
        amount: expectedRent,
        arrears: estimatedArrears,
        totalAmount: expectedRent + estimatedArrears,
        paymentDate: now.toDate(),
        periodFrom: now.startOf('month').toDate(),
        periodTo: now.endOf('month').toDate(),
        invoiceNumber: generateInvoiceNumber(property.propertyType, now.year(), now.month() + 1, 1),
        autoGenerated: true
      };
    }

    const invoiceData = buildInvoicePayload(property, latestPayment);
    res.json({ success: true, data: invoiceData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch latest rent invoice', error: error.message });
  }
});

// Get available agreements for dropdown
router.get('/agreements/available', authMiddleware, async (req, res) => {
  try {
    const agreements = await TajRentalAgreement.find({ status: 'Active' })
      .select('agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent securityDeposit annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate status')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: agreements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

