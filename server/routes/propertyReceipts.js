const express = require('express');
const router = express.Router();
const PropertyReceipt = require('../models/tajResidencia/PropertyReceipt');
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
const TajProperty = require('../models/tajResidencia/TajProperty');
const { authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;
const dayjs = require('dayjs');

// Generate receipt number
const generateReceiptNumber = () => {
  const year = dayjs().year();
  const month = String(dayjs().month() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REC-${year}-${month}-${random}`;
};

// Get invoices for property (for allocation) - ESSENTIAL ENDPOINT
router.get('/property/:propertyId/invoices', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const invoices = await PropertyInvoice.find({
      property: req.params.propertyId,
      paymentStatus: { $in: ['unpaid', 'partial_paid'] },
      balance: { $gt: 0 }
    })
    .select('invoiceNumber invoiceDate periodFrom periodTo dueDate chargeTypes charges subtotal totalArrears grandTotal totalPaid balance paymentStatus')
    .sort({ invoiceDate: 1 })
    .lean();

    const formattedInvoices = invoices.map(inv => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      periodFrom: inv.periodFrom,
      periodTo: inv.periodTo,
      dueDate: inv.dueDate,
      chargeTypes: inv.chargeTypes,
      charges: inv.charges,
      subtotal: inv.subtotal,
      totalArrears: inv.totalArrears,
      description: inv.charges?.map(c => c.description).join(', ') || 'Invoice',
      grandTotal: inv.grandTotal,
      totalPaid: inv.totalPaid,
      balance: inv.balance,
      paymentStatus: inv.paymentStatus
    }));

    res.json({ success: true, data: formattedInvoices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Create receipt with allocations
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { property, receiptDate, amount, bankName, bankReference, description, paymentMethod, allocations } = req.body;

    if (!property || !amount || !allocations || allocations.length === 0) {
      return res.status(400).json({ success: false, message: 'Property, amount, and allocations are required' });
    }

    // Validate allocations
    const totalAllocated = allocations.reduce((sum, alloc) => sum + (alloc.allocatedAmount || 0), 0);
    if (totalAllocated > amount) {
      return res.status(400).json({ success: false, message: 'Total allocated amount cannot exceed receipt amount' });
    }

    // Generate receipt number
    let receiptNumber = generateReceiptNumber();
    while (await PropertyReceipt.findOne({ receiptNumber })) {
      receiptNumber = generateReceiptNumber();
    }

    // Create receipt
    const receipt = new PropertyReceipt({
      receiptNumber,
      property,
      receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
      amount,
      bankName,
      bankReference,
      description,
      paymentMethod: paymentMethod || 'Bank Transfer',
      allocations: allocations.map(alloc => ({
        invoice: alloc.invoice,
        invoiceNumber: alloc.invoiceNumber,
        invoiceType: alloc.invoiceType,
        balance: alloc.balance,
        allocatedAmount: alloc.allocatedAmount,
        remaining: alloc.remaining
      })),
      status: 'Posted',
      createdBy: req.user.id
    });

    await receipt.save();

    // Update invoices with payments
    for (const alloc of receipt.allocations) {
      const invoice = await PropertyInvoice.findById(alloc.invoice);
      if (invoice) {
        invoice.payments.push({
          amount: alloc.allocatedAmount,
          paymentDate: receipt.receiptDate,
          paymentMethod: receipt.paymentMethod,
          bankName: receipt.bankName,
          reference: receipt.bankReference,
          receiptId: receipt._id,
          recordedBy: req.user.id
        });
        await invoice.save(); // Pre-save hook handles calculations
      }
    }

    await receipt.populate('property', 'propertyName plotNumber address ownerName');

    res.status(201).json({
      success: true,
      message: 'Receipt created successfully',
      data: receipt
    });
  } catch (error) {
    console.error('Error creating receipt:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Get all receipts
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { propertyId, search } = req.query;
    const filter = {};
    
    if (propertyId) filter.property = propertyId;
    if (search) {
      filter.$or = [
        { receiptNumber: new RegExp(search, 'i') },
        { bankReference: new RegExp(search, 'i') }
      ];
    }

    const receipts = await PropertyReceipt.find(filter)
      .populate('property', 'propertyName plotNumber address ownerName')
      .sort({ receiptDate: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, data: receipts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Get receipt by ID
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const receipt = await PropertyReceipt.findById(req.params.id)
      .populate('property', 'propertyName plotNumber address ownerName')
      .populate('allocations.invoice', 'invoiceNumber invoiceDate grandTotal balance');

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    res.json({ success: true, data: receipt });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}));

// Delete receipt (and reverse invoice payments)
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const receipt = await PropertyReceipt.findById(req.params.id);
    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (receipt.status === 'Posted') {
      // Remove payments from invoices
      for (const alloc of receipt.allocations) {
        const invoice = await PropertyInvoice.findById(alloc.invoice);
        if (invoice) {
          invoice.payments = invoice.payments.filter(
            p => p.receiptId?.toString() !== receipt._id.toString()
          );
          await invoice.save();
        }
      }
    }

    await PropertyReceipt.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Receipt deleted successfully' });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}));

module.exports = router;

