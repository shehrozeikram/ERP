const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const RecoveryAssignment = require('../models/finance/RecoveryAssignment');

const router = express.Router();

const EXCEL_TO_DB_FIELD_MAP = {
  'Order Code': 'orderCode',
  'Customer Name': 'customerName',
  'Booking Date': 'bookingDate',
  'Sector': 'sector',
  'Size': 'size',
  'CNIC': 'cnic',
  'MobileNumber': 'mobileNumber',
  'CustomerAddress': 'customerAddress',
  'NextOfKinCNIC': 'nextOfKinCNIC',
  'Plot No.': 'plotNo',
  'Status': 'status',
  'Sale Price': 'salePrice',
  'Received': 'received',
  'Currently Due': 'currentlyDue'
};

const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + val * 86400000);
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const parseNumber = (val) => {
  if (val === '' || val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const mapExcelRowToDoc = (row) => {
  const doc = {};
  Object.entries(EXCEL_TO_DB_FIELD_MAP).forEach(([excelKey, dbKey]) => {
    const val = row[excelKey];
    if (val === undefined) return;
    if (dbKey === 'bookingDate') doc[dbKey] = parseDate(val);
    else if (['salePrice', 'received', 'currentlyDue'].includes(dbKey)) doc[dbKey] = parseNumber(val);
    else doc[dbKey] = val != null ? String(val).trim() : '';
  });
  return doc;
};

// @route   GET /api/finance/recovery-assignments
// @desc    List recovery assignments with pagination and search
// @access  Private (Finance and Admin)
router.get(
  '/',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, sector, status } = req.query;
    const query = {};

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      query.$or = [
        { orderCode: searchRegex },
        { customerName: searchRegex },
        { cnic: searchRegex },
        { plotNo: searchRegex },
        { customerAddress: searchRegex },
        { mobileNumber: searchRegex }
      ];
    }
    if (sector && sector.trim()) query.sector = new RegExp(sector.trim(), 'i');
    if (status && status.trim()) query.status = new RegExp(status.trim(), 'i');

    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * (Math.min(100, Math.max(1, parseInt(limit, 10) || 50)));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const [records, total] = await Promise.all([
      RecoveryAssignment.find(query).sort({ orderCode: 1 }).skip(skip).limit(limitNum).lean(),
      RecoveryAssignment.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: records,
      pagination: { page: parseInt(page, 10) || 1, limit: limitNum, total }
    });
  })
);

// @route   POST /api/finance/recovery-assignments/import
// @desc    Import records from Excel (bulk insert)
// @access  Private (Finance and Admin)
router.post(
  '/import',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No records to import'
      });
    }

    const docs = records.map((row) => mapExcelRowToDoc(row)).filter((d) => d.orderCode || d.customerName);
    if (docs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid records to import'
      });
    }

    const BATCH_SIZE = 1000;
    let inserted = 0;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      await RecoveryAssignment.insertMany(batch);
      inserted += batch.length;
    }

    res.json({
      success: true,
      message: `Imported ${inserted} recovery assignments successfully`,
      data: { inserted }
    });
  })
);

// @route   GET /api/finance/recovery-assignments/stats
// @desc    Get summary stats (counts, sectors, statuses)
// @access  Private (Finance and Admin)
router.get(
  '/stats',
  authorize('super_admin', 'admin', 'finance_manager'),
  asyncHandler(async (req, res) => {
    const [total, sectors, statuses] = await Promise.all([
      RecoveryAssignment.countDocuments(),
      RecoveryAssignment.distinct('sector').then((arr) => arr.filter(Boolean).sort()),
      RecoveryAssignment.distinct('status').then((arr) => arr.filter(Boolean).sort())
    ]);

    res.json({
      success: true,
      data: { total, sectors, statuses }
    });
  })
);

module.exports = router;
