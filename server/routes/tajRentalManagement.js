const express = require('express');
const router = express.Router();
const TajProperty = require('../models/tajResidencia/TajProperty');
const TajRentalAgreement = require('../models/tajResidencia/TajRentalAgreement');
const { authMiddleware } = require('../middleware/auth');

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
    reference: payment.reference,
    notes: payment.notes,
    status: payment.status || 'Draft',
    statusUpdatedAt: payment.statusUpdatedAt,
    recordedAt: payment.recordedAt
  }));

  const paymentTotals = payments.reduce((acc, payment) => {
    acc.total += payment.totalAmount || 0;
    if ((payment.status || '').toLowerCase() === 'unpaid') {
      acc.unpaid += payment.totalAmount || 0;
    }
    return acc;
  }, { total: 0, unpaid: 0 });

  return {
    _id: property._id,
    srNo: property.srNo,
    propertyCode: property.plotNumber || (property.srNo ? `PR-${property.srNo}` : property._id.toString()),
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
    payments,
    paymentTotals
  };
};

const fetchPersonalRentProperties = async ({ status, search }) => {
  const filters = { categoryType: 'Personal Rent' };
  if (status) {
    filters.status = status;
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

  const properties = await TajProperty.find(filters)
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
    const { mapped, summary } = await fetchPersonalRentProperties(req.query || {});
    res.json({
      success: true,
      data: {
        summary,
        properties: mapped
      }
    });
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
    const { mapped, summary } = await fetchPersonalRentProperties(req.query || {});
    res.json({ success: true, data: mapped, summary });
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
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    
    res.json({ success: true, data: mapRentalPropertyResponse(property) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== PAYMENT ROUTES ==========

// Add payment to property
router.post('/properties/:id/payments', authMiddleware, async (req, res) => {
  try {
    const { amount, arrears, paymentDate, periodFrom, periodTo, invoiceNumber, paymentMethod, reference, notes } = req.body;

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

    property.rentalPayments.push({
      amount: paymentAmount,
      arrears: arrearsAmount,
      totalAmount: totalAmount,
      paymentDate: paymentDate || new Date(),
      periodFrom: periodFrom ? new Date(periodFrom) : undefined,
      periodTo: periodTo ? new Date(periodTo) : undefined,
      invoiceNumber: invoiceNumber || '',
      paymentMethod: paymentMethod || 'Bank Transfer',
      reference: reference || '',
      notes: notes || '',
      status: 'Draft',
      statusUpdatedAt: new Date(),
      recordedBy: req.user.id
    });

    await property.save();
    await property.populate('rentalAgreement', 'agreementNumber propertyName monthlyRent startDate endDate tenantName tenantContact tenantIdCard');
    res.json({ success: true, data: mapRentalPropertyResponse(property.toObject()) });
  } catch (error) {
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

// Generate invoice number
const generateInvoiceNumber = (propertyType, year, month, index) => {
  const prefix = propertyType === 'Play Ground' ? 'PG' : 'TAJ';
  return `${prefix}-${year}-${month}-${index}`;
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

    const invoiceData = {
      propertyType: property.propertyType || 'House',
      tenantName: property.tenantName || 'N/A',
      address: property.fullAddress || `${property.street || ''} ${property.sector || ''}`.trim(),
      periodFrom: payment.periodFrom || payment.paymentDate,
      periodTo: payment.periodTo || payment.paymentDate,
      invoiceNumber: payment.invoiceNumber || generateInvoiceNumber(
        property.propertyType,
        new Date(payment.paymentDate).getFullYear(),
        new Date(payment.paymentDate).getMonth() + 1,
        property.rentalPayments.indexOf(payment) + 1
      ),
      invoicingDate: payment.paymentDate,
      dueDate: payment.periodTo || payment.paymentDate,
      charges: [
        {
          description: 'UTILIZATION CHARGES',
          amount: payment.amount
        }
      ],
      amount: payment.amount,
      arrears: payment.arrears || 0,
      totalAmount: payment.totalAmount || (payment.amount + (payment.arrears || 0)),
      property: property
    };

    res.json({ success: true, data: invoiceData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get available agreements for dropdown
router.get('/agreements/available', authMiddleware, async (req, res) => {
  try {
    const agreements = await TajRentalAgreement.find({ status: 'Active' })
      .select('agreementNumber propertyName propertyAddress tenantName tenantContact tenantIdCard monthlyRent annualRentIncreaseType annualRentIncreaseValue increasedRent startDate endDate status')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: agreements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

