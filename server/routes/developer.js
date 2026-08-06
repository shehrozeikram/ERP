/**
 * Developer Module Routes
 * Accessible only to: super_admin, developer
 * Provides:
 *  - GET /api/developer/server-stats  — CPU, memory, disk, uptime, MongoDB, PM2
 *  - GET /api/developer/financials     — Comprehensive ERP financial value dashboard
 */

const express = require('express');
const os = require('os');
const { exec } = require('child_process');
const mongoose = require('mongoose');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// ─── Role Guard ───────────────────────────────────────────────────────────────
const ALLOWED_ROLES = ['super_admin', 'developer'];

const devGuard = (req, res, next) => {
  const role = req.user?.role;
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(403).json({ success: false, message: 'Access restricted to Developer / Super Admin only.' });
  }
  next();
};

router.use(devGuard);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const execPromise = (cmd) =>
  new Promise((resolve) => exec(cmd, (err, stdout) => resolve({ err, stdout: stdout || '' })));

const fmtBytes = (bytes) => {
  const gb = bytes / (1024 ** 3);
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
};

const getCpuUsage = () =>
  new Promise((resolve) => {
    const start = os.cpus();
    setTimeout(() => {
      const end = os.cpus();
      let totalIdle = 0, totalTick = 0;
      for (let i = 0; i < start.length; i++) {
        const s = start[i].times, e = end[i].times;
        for (const t in e) totalTick += e[t] - s[t];
        totalIdle += e.idle - s.idle;
      }
      resolve(Math.max(0, Math.round((1 - totalIdle / totalTick) * 100)));
    }, 500);
  });

// ─── GET /api/developer/server-stats ─────────────────────────────────────────
router.get('/server-stats', asyncHandler(async (req, res) => {
  const [cpuUsage, diskResult, pm2Result] = await Promise.all([
    getCpuUsage(),
    execPromise("df -h / 2>/dev/null || df -h . 2>/dev/null"),
    execPromise('pm2 jlist 2>/dev/null')
  ]);

  // Memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // Disk parsing
  let diskInfo = { total: 'N/A', used: 'N/A', free: 'N/A', usedPercent: 0 };
  try {
    const lines = diskResult.stdout.trim().split('\n');
    const parts = lines[lines.length - 1].trim().split(/\s+/);
    // macOS: Filesystem Size Used Avail Capacity Mounted
    // Linux: Filesystem Size Used Avail Use% Mounted
    if (parts.length >= 5) {
      diskInfo = {
        total: parts[1],
        used: parts[2],
        free: parts[3],
        usedPercent: parseInt(String(parts[4]).replace('%', '')) || 0
      };
    }
  } catch (_) {}

  // PM2 processes
  let pm2Processes = [];
  try {
    pm2Processes = JSON.parse(pm2Result.stdout || '[]').map(p => ({
      name: p.name,
      status: p.pm2_env?.status || 'unknown',
      pid: p.pid,
      cpu: p.monit?.cpu ?? 0,
      memory: p.monit?.memory ? fmtBytes(p.monit.memory) : 'N/A',
      uptime: p.pm2_env?.pm_uptime ? new Date(p.pm2_env.pm_uptime).toISOString() : null,
      restarts: p.pm2_env?.restart_time ?? 0,
      mode: p.pm2_env?.exec_mode || 'fork'
    }));
  } catch (_) {}

  // MongoDB stats
  let mongoStats = {};
  try {
    mongoStats = await mongoose.connection.db.command({ dbStats: 1 });
  } catch (_) {}

  // Node.js process memory
  const procMem = process.memoryUsage();
  const uptimeSecs = os.uptime();
  const days = Math.floor(uptimeSecs / 86400);
  const hours = Math.floor((uptimeSecs % 86400) / 3600);
  const mins = Math.floor((uptimeSecs % 3600) / 60);

  res.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      os: {
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname()
      },
      uptime: {
        raw: uptimeSecs,
        formatted: `${days}d ${hours}h ${mins}m`,
        days, hours, mins
      },
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown'
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        totalFmt: fmtBytes(totalMem),
        usedFmt: fmtBytes(usedMem),
        freeFmt: fmtBytes(freeMem),
        usedPercent: Math.round((usedMem / totalMem) * 100)
      },
      disk: diskInfo,
      nodeProcess: {
        version: process.version,
        env: process.env.NODE_ENV || 'development',
        pid: process.pid,
        heapUsed: fmtBytes(procMem.heapUsed),
        heapTotal: fmtBytes(procMem.heapTotal),
        rss: fmtBytes(procMem.rss),
        external: fmtBytes(procMem.external || 0),
        heapUsedPercent: Math.round((procMem.heapUsed / procMem.heapTotal) * 100)
      },
      mongodb: {
        db: mongoStats.db || 'N/A',
        collections: mongoStats.collections || 0,
        documents: mongoStats.objects || 0,
        storageSize: mongoStats.storageSize ? fmtBytes(mongoStats.storageSize) : 'N/A',
        dataSize: mongoStats.dataSize ? fmtBytes(mongoStats.dataSize) : 'N/A',
        indexSize: mongoStats.indexSize ? fmtBytes(mongoStats.indexSize) : 'N/A',
        avgObjSize: mongoStats.avgObjSize ? `${Math.round(mongoStats.avgObjSize)} B` : 'N/A'
      },
      pm2: pm2Processes
    }
  });
}));

// ─── GET /api/developer/financials ────────────────────────────────────────────
router.get('/financials', asyncHandler(async (req, res) => {
  // Load all required models
  const User = require('../models/User');
  const Payroll = require('../models/hr/Payroll');
  const PurchaseOrder = require('../models/procurement/PurchaseOrder');
  const AccountsPayable = require('../models/finance/AccountsPayable');
  const GoodsReceive = require('../models/procurement/GoodsReceive');
  const JournalEntry = require('../models/finance/JournalEntry');
  const FixedAsset = require('../models/finance/FixedAsset');
  const CashApproval = require('../models/procurement/CashApproval');
  const UserActivityLog = require('../models/general/UserActivityLog');
  const UserLoginLog = require('../models/general/UserLoginLog');

  // Taj Residencia
  const CAMCharge = require('../models/tajResidencia/CAMCharge');
  const WaterCharge = require('../models/tajResidencia/WaterCharge');
  const Electricity = require('../models/tajResidencia/Electricity');
  const LandPurchase = require('../models/tajResidencia/LandPurchase');
  const PropertyInvoice = require('../models/tajResidencia/PropertyInvoice');

  const NON_DEV_ROLES = { $nin: ['developer', 'super_admin'] };

  // Find earliest non-developer user (system go-live date)
  const firstUser = await User.findOne({ role: NON_DEV_ROLES }, { createdAt: 1 })
    .sort({ createdAt: 1 }).lean();

  const goLiveDate = firstUser?.createdAt || new Date('2024-01-01');

  // Count active non-developer users
  const [activeUsers, totalUsers] = await Promise.all([
    User.countDocuments({ role: NON_DEV_ROLES, isActive: true }),
    User.countDocuments({ role: NON_DEV_ROLES })
  ]);

  // ── Parallel financial aggregations ──────────────────────────────────────
  const [
    payrollAgg,
    poAgg,
    apAgg,
    grnAgg,
    jeAgg,
    fixedAssetAgg,
    cashApprovalAgg,
    camAgg,
    waterAgg,
    electricityAgg,
    landAgg,
    propertyInvoiceAgg,
    activityStats,
    loginStats
  ] = await Promise.all([
    // Payroll disbursed
    Payroll.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$netSalary', 0] } }, count: { $sum: 1 } } }
    ]),
    // Purchase Orders
    PurchaseOrder.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } }, count: { $sum: 1 } } }
    ]),
    // Accounts Payable (vendor bills)
    AccountsPayable.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } }, count: { $sum: 1 } } }
    ]),
    // Goods Received (GRN) - uses netAmount
    GoodsReceive.aggregate([
      { $match: { status: 'Received' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$netAmount', 0] } }, count: { $sum: 1 } } }
    ]),
    // Journal Entries (total debits processed)
    JournalEntry.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$totalDebits', 0] } }, count: { $sum: 1 } } }
    ]),
    // Fixed Assets registered
    FixedAsset.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$purchaseCost', 0] } }, count: { $sum: 1 } } }
    ]),
    // Cash Approvals
    CashApproval.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } }, count: { $sum: 1 } } }
    ]),
    // CAM Charges billed
    CAMCharge.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } }, count: { $sum: 1 } } }
    ]),
    // Water Charges
    WaterCharge.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } }, count: { $sum: 1 } } }
    ]),
    // Electricity Bills
    Electricity.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$totalBill', { $ifNull: ['$amount', 0] }] } }, count: { $sum: 1 } } }
    ]),
    // Land Purchases
    LandPurchase.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } }, count: { $sum: 1 } } }
    ]),
    // Property Invoices (charges sum)
    PropertyInvoice.aggregate([
      { $unwind: { path: '$charges', preserveNullAndEmptyArrays: true } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$charges.amount', 0] } }, count: { $sum: 1 } } }
    ]),
    // User activity stats
    UserActivityLog.aggregate([
      {
        $group: {
          _id: '$actionType',
          count: { $sum: 1 }
        }
      }
    ]),
    // Login stats
    UserLoginLog.aggregate([
      { $group: { _id: null, total: { $sum: 1 } } }
    ]).catch(() => [])
  ]);

  const val = (agg) => agg[0]?.total || 0;
  const cnt = (agg) => agg[0]?.count || 0;

  // ── Module financial totals ───────────────────────────────────────────────
  const hrTotal = val(payrollAgg);
  const procurementTotal = val(poAgg) + val(grnAgg);
  const financeTotal = val(apAgg) + val(jeAgg) + val(fixedAssetAgg) + val(cashApprovalAgg);
  const tajTotal = val(camAgg) + val(waterAgg) + val(electricityAgg) + val(landAgg) + val(propertyInvoiceAgg);
  const grandTotal = hrTotal + procurementTotal + financeTotal + tajTotal;

  // ── Monthly trend (last 12 months) across Payroll + PO + AP ───────────────
  const months12Ago = new Date();
  months12Ago.setMonth(months12Ago.getMonth() - 11);
  months12Ago.setDate(1);
  months12Ago.setHours(0, 0, 0, 0);

  const [monthlyPayroll, monthlyPO, monthlyAP] = await Promise.all([
    Payroll.aggregate([
      { $match: { createdAt: { $gte: months12Ago } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: { $ifNull: ['$netSalary', 0] } } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    PurchaseOrder.aggregate([
      { $match: { createdAt: { $gte: months12Ago } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    AccountsPayable.aggregate([
      { $match: { createdAt: { $gte: months12Ago } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ])
  ]);

  // Build a unified 12-month timeline
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const makeMap = (agg) => {
    const m = new Map();
    agg.forEach(r => m.set(`${r._id.year}-${r._id.month}`, r.total || 0));
    return m;
  };
  const payrollMap = makeMap(monthlyPayroll);
  const poMap = makeMap(monthlyPO);
  const apMap = makeMap(monthlyAP);

  const monthlyTrend = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    monthlyTrend.unshift({
      month: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      payroll: payrollMap.get(key) || 0,
      procurement: poMap.get(key) || 0,
      finance: apMap.get(key) || 0
    });
  }
  monthlyTrend.reverse();

  // ── Activity breakdown ────────────────────────────────────────────────────
  const totalActions = activityStats.reduce((s, a) => s + a.count, 0);
  const activityBreakdown = activityStats.reduce((acc, a) => {
    acc[a._id] = a.count;
    return acc;
  }, {});

  // Most active modules from activity logs
  const moduleActivity = await UserActivityLog.aggregate([
    { $group: { _id: '$module', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).catch(() => []);

  // Top active users
  const topUsers = await UserActivityLog.aggregate([
    { $group: { _id: '$userId', username: { $first: '$username' }, email: { $first: '$email' }, actions: { $sum: 1 } } },
    { $sort: { actions: -1 } },
    { $limit: 8 }
  ]).catch(() => []);

  res.json({
    success: true,
    data: {
      goLiveDate,
      activeUsers,
      totalUsers,
      totalActions,
      totalLogins: loginStats[0]?.total || 0,
      grandTotal,
      moduleFinancials: {
        hr: { total: hrTotal, payrollDisbursed: val(payrollAgg), payrollCount: cnt(payrollAgg) },
        procurement: {
          total: procurementTotal,
          purchaseOrdersTotal: val(poAgg),
          purchaseOrdersCount: cnt(poAgg),
          grnTotal: val(grnAgg),
          grnCount: cnt(grnAgg)
        },
        finance: {
          total: financeTotal,
          vendorBillsTotal: val(apAgg),
          vendorBillsCount: cnt(apAgg),
          journalEntriesTotal: val(jeAgg),
          journalEntriesCount: cnt(jeAgg),
          fixedAssetsTotal: val(fixedAssetAgg),
          fixedAssetsCount: cnt(fixedAssetAgg),
          cashApprovalsTotal: val(cashApprovalAgg),
          cashApprovalsCount: cnt(cashApprovalAgg)
        },
        tajResidencia: {
          total: tajTotal,
          camChargesTotal: val(camAgg),
          camChargesCount: cnt(camAgg),
          waterChargesTotal: val(waterAgg),
          waterChargesCount: cnt(waterAgg),
          electricityTotal: val(electricityAgg),
          electricityCount: cnt(electricityAgg),
          landPurchasesTotal: val(landAgg),
          landPurchasesCount: cnt(landAgg),
          propertyInvoicesTotal: val(propertyInvoiceAgg),
          propertyInvoicesCount: cnt(propertyInvoiceAgg)
        }
      },
      monthlyTrend,
      activityBreakdown,
      moduleActivity,
      topUsers
    }
  });
}));

module.exports = router;
