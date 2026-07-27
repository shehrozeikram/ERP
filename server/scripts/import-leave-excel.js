const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const path = require('path');
require('dotenv').config();

const Employee = require('../models/hr/Employee');
const LeaveType = require('../models/hr/LeaveType');
const LeaveRequest = require('../models/hr/LeaveRequest');
const LeaveBalance = require('../models/hr/LeaveBalance');
const User = require('../models/User');

const DEFAULT_LEAVE_TYPES = [
  { name: 'Annual Leave', code: 'AL', daysPerYear: 14, isPaid: true, color: '#3B82F6', carryForwardAllowed: true, maxCarryForwardDays: 7 },
  { name: 'Casual Leave', code: 'CL', daysPerYear: 10, isPaid: true, color: '#10B981', carryForwardAllowed: false },
  { name: 'Sick Leave', code: 'SL', daysPerYear: 8, isPaid: true, color: '#EF4444', carryForwardAllowed: false },
  { name: 'Compensatory Leave', code: 'CPL', daysPerYear: 0, isPaid: true, color: '#F59E0B', carryForwardAllowed: false },
  { name: 'Compassionate Leave', code: 'CML', daysPerYear: 3, isPaid: true, color: '#8B5CF6', carryForwardAllowed: false },
  { name: 'Umrah Leave', code: 'UL', daysPerYear: 15, isPaid: true, color: '#06B6D4', carryForwardAllowed: false },
  { name: 'Paternity Leave', code: 'PL', daysPerYear: 5, isPaid: true, color: '#EC4899', carryForwardAllowed: false },
  { name: 'Hajj Leave', code: 'HL', daysPerYear: 40, isPaid: true, color: '#6366F1', carryForwardAllowed: false },
  { name: 'Business Trip', code: 'BT', daysPerYear: 0, isPaid: true, color: '#64748B', carryForwardAllowed: false }
];

const PAY_CODE_TO_CODE = {
  'ANNUAL LEAVE': 'AL',
  'ANNUAL': 'AL',
  'CASUAL LEAVE': 'CL',
  'CASUAL': 'CL',
  'SICK LEAVE': 'SL',
  'SICK': 'SL',
  'MEDICAL LEAVE': 'SL',
  'COMPENSATORY LEAVE': 'CPL',
  'COMPASSIONATE LEAVE': 'CML',
  'UMRAH LEAVE': 'UL',
  'PATERNITY LEAVE': 'PL',
  'HAJJ LEAVE': 'HL',
  'BUSINESS TRIP': 'BT'
};

async function ensureLeaveTypes() {
  const typeMap = new Map();
  for (const ltDef of DEFAULT_LEAVE_TYPES) {
    let lt = await LeaveType.findOne({
      $or: [{ code: ltDef.code }, { name: ltDef.name }]
    });
    if (!lt) {
      lt = new LeaveType({ ...ltDef, isActive: true });
      await lt.save();
      console.log(`✨ Created LeaveType: ${lt.name} (${lt.code})`);
    }
    typeMap.set(ltDef.code, lt);
    typeMap.set(ltDef.name.toUpperCase(), lt);
  }
  return typeMap;
}

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

async function importLeaves() {
  const isDryRun = process.argv.includes('--dry-run');
  const excelFilePath = process.argv[2] && !process.argv[2].startsWith('--') 
    ? path.resolve(process.argv[2]) 
    : path.join(__dirname, '../../docs/Leave_20260725123529.xlsx');

  console.log(`🚀 Starting Leave Import Script`);
  console.log(`📁 File: ${excelFilePath}`);
  console.log(`⚙️ Mode: ${isDryRun ? 'DRY RUN (No database writes)' : 'LIVE IMPORT'}`);

  const mongoUri = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp_local';
  await mongoose.connect(mongoUri);
  console.log(`✅ Connected to MongoDB database: ${mongoose.connection.name}`);

  // 1. Ensure Leave Types
  const leaveTypeMap = await ensureLeaveTypes();

  // 2. Fetch admin/system user for createdBy
  const adminUser = await User.findOne({ role: { $in: ['super_admin', 'admin'] } });
  const adminId = adminUser ? adminUser._id : new mongoose.Types.ObjectId();

  // 3. Load all employees into lookup maps
  const allEmployees = await Employee.find({}).select('_id employeeId empCode emp_code zkbioId firstName lastName email cnic').lean();
  console.log(`👥 Loaded ${allEmployees.length} employees from database`);

  const empLookupMap = new Map();
  allEmployees.forEach(e => {
    const codes = [e.employeeId, e.empCode, e.emp_code, e.zkbioId].filter(Boolean).map(c => String(c).trim());
    codes.forEach(code => empLookupMap.set(code, e));
    codes.forEach(code => {
      // also handle padded / unpadded numeric strings (e.g. "04328" vs "4328")
      if (/^\d+$/.test(code)) {
        empLookupMap.set(String(parseInt(code, 10)), e);
        empLookupMap.set(code.padStart(4, '0'), e);
        empLookupMap.set(code.padStart(5, '0'), e);
      }
    });
  });

  // 4. Read Excel File
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelFilePath);
  const ws = wb.worksheets[0];

  let totalRows = 0;
  let matchedRows = 0;
  let skippedRows = 0;
  let importedCount = 0;

  const leaveRequestsToInsert = [];
  const empIdsWithNewLeaves = new Set();

  ws.eachRow((row, rowNumber) => {
    if (rowNumber < 4) return; // Header rows
    totalRows++;

    const vals = row.values;
    if (!vals || vals.length < 6) {
      skippedRows++;
      return;
    }

    const rawEmpId = String(vals[1] || '').trim();
    const rawName = String(vals[2] || '').trim();
    const rawDept = String(vals[3] || '').trim();
    const startDate = parseExcelDate(vals[4]);
    const endDate = parseExcelDate(vals[5]);
    const applyReason = String(vals[6] || '').trim() || 'Leave Record Import';
    const applyTime = parseExcelDate(vals[7]) || startDate || new Date();
    const rawPayCode = String(vals[8] || '').trim();
    const rawStatus = String(vals[9] || 'Approved').trim();

    if (!rawEmpId || !startDate || !endDate) {
      skippedRows++;
      return;
    }

    const emp = empLookupMap.get(rawEmpId) || empLookupMap.get(String(parseInt(rawEmpId, 10)));
    if (!emp) {
      skippedRows++;
      return;
    }
    matchedRows++;

    const code = PAY_CODE_TO_CODE[rawPayCode.toUpperCase()] || 'CL';
    const leaveTypeObj = leaveTypeMap.get(code) || leaveTypeMap.get('CASUAL LEAVE');

    // Calculate total days
    const timeDiff = endDate.getTime() - startDate.getTime();
    const totalDays = Math.max(0.5, Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1);

    const normStatus = rawStatus.toLowerCase() === 'approved' ? 'approved' : rawStatus.toLowerCase();
    const leaveYear = startDate.getFullYear();

    leaveRequestsToInsert.push({
      employee: emp._id,
      leaveType: leaveTypeObj._id,
      startDate,
      endDate,
      totalDays,
      reason: applyReason,
      status: normStatus,
      appliedDate: applyTime,
      approvedDate: normStatus === 'approved' ? applyTime : null,
      approvedBy: normStatus === 'approved' ? adminId : null,
      leaveYear,
      workYear: 0,
      createdBy: adminId,
      notes: `Imported from ${path.basename(excelFilePath)} (Dept: ${rawDept})`
    });

    empIdsWithNewLeaves.add(emp._id.toString());
  });

  console.log(`📊 Parsing Complete:`);
  console.log(`   Total Excel Rows: ${totalRows}`);
  console.log(`   Matched Rows: ${matchedRows}`);
  console.log(`   Skipped / Unmatched Rows: ${skippedRows}`);

  if (!isDryRun && leaveRequestsToInsert.length > 0) {
    console.log(`💾 Inserting ${leaveRequestsToInsert.length} Leave Requests in batches...`);
    const BATCH_SIZE = 500;
    for (let i = 0; i < leaveRequestsToInsert.length; i += BATCH_SIZE) {
      const batch = leaveRequestsToInsert.slice(i, i + BATCH_SIZE);
      await LeaveRequest.insertMany(batch, { ordered: false });
      importedCount += batch.length;
      console.log(`   Imported ${importedCount} / ${leaveRequestsToInsert.length}...`);
    }

    console.log(`🔄 Updating Leave Balances for ${empIdsWithNewLeaves.size} employees...`);
    let balanceUpdatedCount = 0;
    for (const empIdStr of empIdsWithNewLeaves) {
      try {
        const empId = new mongoose.Types.ObjectId(empIdStr);
        const year = 2026;
        
        // Sum approved leave days per leave type for 2026
        const approvedLeaves = await LeaveRequest.find({
          employee: empId,
          status: 'approved',
          leaveYear: year
        }).populate('leaveType', 'code name');

        let annualUsed = 0, casualUsed = 0, sickUsed = 0;

        approvedLeaves.forEach(l => {
          const code = l.leaveType?.code || '';
          if (code === 'AL' || code === 'ANNUAL') annualUsed += l.totalDays || 0;
          else if (code === 'SL' || code === 'SICK') sickUsed += l.totalDays || 0;
          else if (code === 'CL' || code === 'CASUAL') casualUsed += l.totalDays || 0;
        });

        let balance = await LeaveBalance.findOne({ employee: empId, year });
        if (!balance) {
          balance = new LeaveBalance({
            employee: empId,
            year,
            workYear: 0,
            annual: { allocated: 14, used: annualUsed, remaining: Math.max(0, 14 - annualUsed) },
            casual: { allocated: 10, used: casualUsed, remaining: Math.max(0, 10 - casualUsed) },
            sick: { allocated: 8, used: sickUsed, remaining: Math.max(0, 8 - sickUsed) }
          });
        } else {
          balance.annual.used = annualUsed;
          balance.annual.remaining = Math.max(0, balance.annual.allocated - annualUsed);
          balance.casual.used = casualUsed;
          balance.casual.remaining = Math.max(0, balance.casual.allocated - casualUsed);
          balance.sick.used = sickUsed;
          balance.sick.remaining = Math.max(0, balance.sick.allocated - sickUsed);
        }
        await balance.save();

        // Also update Employee document leaveBalance for backward compatibility
        await Employee.updateOne(
          { _id: empId },
          {
            $set: {
              leaveBalance: {
                annual: { allocated: 14, used: annualUsed, remaining: Math.max(0, 14 - annualUsed), carriedForward: 0, advance: 0 },
                casual: { allocated: 10, used: casualUsed, remaining: Math.max(0, 10 - casualUsed), carriedForward: 0, advance: 0 },
                sick: { allocated: 8, used: sickUsed, remaining: Math.max(0, 8 - sickUsed), carriedForward: 0, advance: 0 },
                medical: { allocated: 8, used: sickUsed, remaining: Math.max(0, 8 - sickUsed), carriedForward: 0, advance: 0 }
              }
            }
          }
        );

        balanceUpdatedCount++;
      } catch (balErr) {
        console.error(`❌ Failed to update balance for emp ${empIdStr}:`, balErr.message);
      }
    }

    console.log(`✅ Successfully updated ${balanceUpdatedCount} employee leave balances!`);
  }

  console.log(`\n🎉 DONE! ${isDryRun ? 'Dry run completed successfully.' : 'Live import completed successfully!'}`);
  await mongoose.disconnect();
}

importLeaves().catch(err => {
  console.error('❌ Script execution error:', err);
  process.exit(1);
});
