const express = require('express');
const router = express.Router();
const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');
const PropertyReceipt = require('../models/tajResidencia/PropertyReceipt');
const TajProperty = require('../models/tajResidencia/TajProperty');
const TajResident = require('../models/tajResidencia/TajResident');
const User = require('../models/User');

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(date.getDate()).padStart(2, '0')}/${months[date.getMonth()]}/${date.getFullYear()}`;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeReference = (value) => String(value || '').trim();

const unauthorized = (res) =>
  res.status(200).json({
    code: 9,
    message: 'Unauthorized request'
  });

const isValidCredentialPayload = (req) => {
  const user = String(req.body?.user || req.query?.user || '').trim();
  const password = String(req.body?.password || req.query?.password || '').trim();
  const allowedUser = String(process.env.BANK_ISLAMIC_API_USER || '').trim();
  const allowedPassword = String(process.env.BANK_ISLAMIC_API_PASSWORD || '').trim();

  if (!allowedUser || !allowedPassword) {
    console.error('BANK_ISLAMIC_API_USER or BANK_ISLAMIC_API_PASSWORD missing');
    return false;
  }

  return user === allowedUser && password === allowedPassword;
};

const pickSystemUserId = async () => {
  const configuredId = String(process.env.BANK_ISLAMIC_SYSTEM_USER_ID || '').trim();
  if (configuredId) return configuredId;
  const fallbackUser = await User.findOne({ isActive: true }).select('_id').lean();
  return fallbackUser?._id || null;
};

const mapInvoicesForInquiry = (invoices) =>
  invoices.map((invoice) => {
    const baseAmount = Math.max(0, toNumber(invoice.grandTotal) - toNumber(invoice.totalPaid));
    const dueSurchargeAmount = Math.max(baseAmount, toNumber(invoice.balance || baseAmount));
    return {
      referenceNo: invoice.invoiceNumber,
      customer: invoice.customerName || invoice.property?.ownerName || invoice.property?.propertyName || '',
      issueDate: formatDate(invoice.invoiceDate),
      dueDate: formatDate(invoice.dueDate),
      amountDueDate: baseAmount.toFixed(2),
      amountAfterDate: dueSurchargeAmount.toFixed(2),
      status: invoice.paymentStatus === 'paid' ? 'P' : 'U'
    };
  });

const getUnpaidInvoicesByReference = async (referenceNo) => {
  const exactInvoice = await PropertyInvoice.findOne({ invoiceNumber: referenceNo })
    .select('_id property invoiceNumber invoiceDate dueDate grandTotal totalPaid balance paymentStatus customerName')
    .populate('property', 'ownerName propertyName')
    .lean();

  if (exactInvoice) {
    const propertyId = exactInvoice.property?._id || exactInvoice.property;
    if (!propertyId) return [exactInvoice];
    return PropertyInvoice.find({
      property: propertyId,
      paymentStatus: { $in: ['unpaid', 'partial_paid'] },
      balance: { $gt: 0 }
    })
      .select('_id property invoiceNumber invoiceDate dueDate grandTotal totalPaid balance paymentStatus customerName')
      .populate('property', 'ownerName propertyName')
      .sort({ dueDate: 1, invoiceDate: 1, createdAt: 1 })
      .lean();
  }

  // Optional support: referenceNo as residentId
  const resident = await TajResident.findOne({ residentId: referenceNo }).select('_id').lean();
  if (!resident?._id) return [];
  const properties = await TajProperty.find({ resident: resident._id }).select('_id').lean();
  if (!properties.length) return [];

  return PropertyInvoice.find({
    property: { $in: properties.map((p) => p._id) },
    paymentStatus: { $in: ['unpaid', 'partial_paid'] },
    balance: { $gt: 0 }
  })
    .select('_id property invoiceNumber invoiceDate dueDate grandTotal totalPaid balance paymentStatus customerName')
    .populate('property', 'ownerName propertyName')
    .sort({ dueDate: 1, invoiceDate: 1, createdAt: 1 })
    .lean();
};

const generateReceiptNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `REC-${year}-${month}-${random}`;
};

router.post('/inquiry', async (req, res) => {
  try {
    if (!isValidCredentialPayload(req)) return unauthorized(res);

    const referenceNo = normalizeReference(req.body?.referenceNo);
    if (!referenceNo) {
      return res.status(200).json({
        code: 2,
        message: 'Voucher is Invalid!'
      });
    }

    const unpaidInvoices = await getUnpaidInvoicesByReference(referenceNo);
    if (!unpaidInvoices.length) {
      const existing = await PropertyInvoice.findOne({ invoiceNumber: referenceNo })
        .select('paymentStatus dueDate')
        .lean();

      if (existing?.paymentStatus === 'paid') {
        return res.status(200).json({
          code: 1,
          message: 'Voucher already Paid!'
        });
      }

      return res.status(200).json({
        code: 2,
        message: 'Voucher is Invalid!'
      });
    }

    return res.status(200).json({
      code: 0,
      message: 'Success!',
      data: mapInvoicesForInquiry(unpaidInvoices)
    });
  } catch (error) {
    console.error('Bank Islamic inquiry error:', error);
    return res.status(500).json({
      code: 99,
      message: 'Internal server error'
    });
  }
});

router.post('/payment', async (req, res) => {
  try {
    if (!isValidCredentialPayload(req)) return unauthorized(res);

    const referenceNo = normalizeReference(req.body?.referenceNo);
    const amount = toNumber(req.body?.amount);
    const status = String(req.body?.status || '').trim().toUpperCase();
    const receivedDate = req.body?.receivedDate ? new Date(req.body.receivedDate) : new Date();
    const externalTxnId = normalizeReference(req.body?.transactionId || req.body?.bankReference);

    if (!referenceNo || amount <= 0 || status !== 'P') {
      return res.status(200).json({
        code: 2,
        message: 'Voucher is Invalid!'
      });
    }

    if (externalTxnId) {
      const duplicateReceipt = await PropertyReceipt.findOne({ bankReference: externalTxnId })
        .select('_id')
        .lean();
      if (duplicateReceipt) {
        return res.status(200).json({
          code: 0,
          message: 'Voucher Successfully Post'
        });
      }
    }

    const invoice = await PropertyInvoice.findOne({ invoiceNumber: referenceNo });
    if (!invoice) {
      return res.status(200).json({
        code: 2,
        message: 'Voucher is Invalid!'
      });
    }

    if (invoice.paymentStatus === 'paid' || toNumber(invoice.balance) <= 0) {
      return res.status(200).json({
        code: 1,
        message: 'Voucher already Paid!'
      });
    }

    const systemUserId = await pickSystemUserId();
    if (!systemUserId) {
      return res.status(500).json({
        code: 99,
        message: 'No active user available for posting'
      });
    }

    const payable = Math.max(0, toNumber(invoice.balance || invoice.grandTotal));
    const allocatedAmount = Math.min(amount, payable);
    if (!invoice.property) {
      return res.status(200).json({
        code: 2,
        message: 'Voucher is Invalid!'
      });
    }

    let receiptNumber = generateReceiptNumber();
    while (await PropertyReceipt.findOne({ receiptNumber }).select('_id').lean()) {
      receiptNumber = generateReceiptNumber();
    }

    const receipt = new PropertyReceipt({
      receiptNumber,
      property: invoice.property,
      receiptDate: Number.isNaN(receivedDate.getTime()) ? new Date() : receivedDate,
      amount: allocatedAmount,
      bankName: 'BankIslami',
      bankReference: externalTxnId || `BI-${referenceNo}-${Date.now()}`,
      description: `BankIslami payment for ${referenceNo}`,
      paymentMethod: 'Online',
      allocations: [
        {
          invoice: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceType: (invoice.chargeTypes || []).join(', '),
          balance: payable,
          allocatedAmount,
          remaining: Math.max(0, payable - allocatedAmount)
        }
      ],
      status: 'Posted',
      createdBy: systemUserId
    });
    await receipt.save();

    invoice.payments.push({
      amount: allocatedAmount,
      paymentDate: receipt.receiptDate,
      paymentMethod: 'Online',
      bankName: 'BankIslami',
      reference: receipt.bankReference,
      receiptId: receipt._id,
      recordedBy: systemUserId
    });
    await invoice.save();

    return res.status(200).json({
      code: 0,
      message: 'Voucher Successfully Post'
    });
  } catch (error) {
    console.error('Bank Islamic payment error:', error);
    return res.status(500).json({
      code: 99,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
