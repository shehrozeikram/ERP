const mongoose = require('mongoose');
const Supplier = require('../models/hr/Supplier');
const AccountsPayable = require('../models/finance/AccountsPayable');
const VendorAdvance = require('../models/finance/VendorAdvance');

async function listAuditFinanceVendors({ search = '', status = '', page = 1, limit = 500 } = {}) {
  const supplierQuery = {};
  if (status) supplierQuery.status = status;
  const trimmed = String(search || '').trim();
  if (trimmed) {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    supplierQuery.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { supplierId: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { contactPerson: { $regex: escaped, $options: 'i' } }
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
  const skip = (pageNum - 1) * limitNum;

  const [suppliers, total] = await Promise.all([
    Supplier.find(supplierQuery).sort({ name: 1 }).skip(skip).limit(limitNum).lean(),
    Supplier.countDocuments(supplierQuery)
  ]);

  const supplierIds = suppliers.map((s) => s._id);
  const financeAgg = supplierIds.length
    ? await AccountsPayable.aggregate([
      { $match: { 'vendor.vendorId': { $in: supplierIds } } },
      {
        $group: {
          _id: '$vendor.vendorId',
          totalBilled: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$amountPaid' },
          totalAdvanceApplied: { $sum: '$advanceApplied' },
          billCount: { $sum: 1 },
          lastActivity: { $max: '$updatedAt' }
        }
      }
    ])
    : [];

  const financeMap = new Map(financeAgg.map((row) => [String(row._id), row]));
  const vendors = suppliers.map((s) => {
    const fin = financeMap.get(String(s._id));
    const totalBilled = fin?.totalBilled || 0;
    const totalPaid = fin?.totalPaid || 0;
    const totalAdvanceApplied = fin?.totalAdvanceApplied || 0;
    const outstanding = Math.round((totalBilled - totalPaid - totalAdvanceApplied) * 100) / 100;
    return {
      _id: s._id,
      supplierId: s.supplierId,
      name: s.name,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email,
      status: s.status,
      vendorCategory: s.vendorCategory,
      finance: {
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalAdvanceApplied: Math.round(totalAdvanceApplied * 100) / 100,
        outstanding,
        billCount: fin?.billCount || 0,
        lastActivity: fin?.lastActivity || null
      }
    };
  });

  return {
    vendors,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1
    }
  };
}

async function getAuditFinanceVendorDetail(supplierId, { billStatus = '' } = {}) {
  if (!mongoose.Types.ObjectId.isValid(supplierId)) {
    const err = new Error('Invalid vendor ID');
    err.status = 400;
    throw err;
  }

  const supplier = await Supplier.findById(supplierId).lean();
  if (!supplier) {
    const err = new Error('Vendor not found');
    err.status = 404;
    throw err;
  }

  const vendorObjectId = new mongoose.Types.ObjectId(supplierId);
  const billQuery = { 'vendor.vendorId': vendorObjectId };
  if (billStatus) billQuery.status = billStatus;

  const [bills, advances] = await Promise.all([
    AccountsPayable.find(billQuery).sort({ billDate: -1 }).limit(200).lean(),
    VendorAdvance.find({ 'vendor.vendorId': vendorObjectId }).sort({ paymentDate: -1 }).limit(50).lean()
  ]);

  const totalBilled = bills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const totalPaid = bills.reduce((s, b) => s + (b.amountPaid || 0), 0);
  const totalAdvanceApplied = bills.reduce((s, b) => s + (b.advanceApplied || 0), 0);
  const advanceBalance = advances.reduce(
    (s, a) => s + Math.max(0, (a.amount || 0) - (a.appliedAmount || 0)),
    0
  );

  return {
    supplier: {
      _id: supplier._id,
      supplierId: supplier.supplierId,
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      status: supplier.status,
      vendorCategory: supplier.vendorCategory,
      paymentTerms: supplier.paymentTerms,
      address: supplier.address,
      ntnCnic: supplier.ntnCnic
    },
    summary: {
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalAdvanceApplied: Math.round(totalAdvanceApplied * 100) / 100,
      outstanding: Math.round((totalBilled - totalPaid - totalAdvanceApplied) * 100) / 100,
      advanceBalance: Math.round(advanceBalance * 100) / 100,
      billCount: bills.length
    },
    bills: bills.map((b) => ({
      _id: b._id,
      billNumber: b.billNumber,
      vendorInvoiceNumber: b.vendorInvoiceNumber,
      billDate: b.billDate,
      dueDate: b.dueDate,
      totalAmount: b.totalAmount,
      amountPaid: b.amountPaid,
      advanceApplied: b.advanceApplied,
      balanceDue: b.balanceDue ?? Math.round((b.totalAmount - (b.amountPaid || 0) - (b.advanceApplied || 0)) * 100) / 100,
      status: b.status,
      referenceType: b.referenceType,
      department: b.department
    })),
    advances: advances.map((a) => ({
      _id: a._id,
      amount: a.amount,
      appliedAmount: a.appliedAmount,
      balance: Math.round(((a.amount || 0) - (a.appliedAmount || 0)) * 100) / 100,
      paymentDate: a.paymentDate,
      reference: a.reference,
      status: a.status
    }))
  };
}

module.exports = {
  listAuditFinanceVendors,
  getAuditFinanceVendorDetail
};
