const Payroll = require('../models/hr/Payroll');
const Employee = require('../models/hr/Employee');
const EmployeeIncrement = require('../models/hr/EmployeeIncrement');
const PayrollMonthlyComparisonReport = require('../models/hr/PayrollMonthlyComparisonReport');
const { syncComparisonReportStatusFromApproval } = require('./payrollAuthorityPayrollStatus');

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EMPLOYEE_REPORT_SELECT =
  'firstName lastName employeeId joiningDate hireDate appointmentDate terminationDate terminationReason employmentStatus placementDepartment department updatedAt isLateEntryForPayroll isLateTerminationEntryForPayroll salary';
const EMPLOYEE_POPULATE = [
  { path: 'placementDepartment', select: 'name' },
  { path: 'department', select: 'name' }
];

const prevPeriod = (month, year) => {
  if (month <= 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
};

const monthRange = (month, year) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

const employeeName = (emp) =>
  [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() || emp?.employeeId || '—';

const employeeDepartment = (emp) =>
  emp?.placementDepartment?.name || emp?.department?.name || '—';

const mapEmployeeRow = (emp, extra = {}) => ({
  employeeId: emp?.employeeId || '—',
  name: employeeName(emp),
  department: employeeDepartment(emp),
  joiningDate: emp?.joiningDate || emp?.hireDate || emp?.appointmentDate || null,
  terminationDate: emp?.terminationDate || null,
  employmentStatus: emp?.employmentStatus || '',
  reason: emp?.terminationReason || '',
  isLateEntryForPayroll: emp?.isLateEntryForPayroll || false,
  isLateTerminationEntryForPayroll: emp?.isLateTerminationEntryForPayroll || false,
  grossSalary: emp?.salary?.gross || 0,
  ...extra
});

const mapIncrementRow = (increment) => {
  const emp = increment?.employee;
  return {
    employeeId: emp?.employeeId || '—',
    name: employeeName(emp),
    department: employeeDepartment(emp),
    incrementType: increment?.incrementType || '—',
    previousSalary: Number(increment?.previousSalary) || 0,
    newSalary: Number(increment?.newSalary) || 0,
    incrementAmount: Number(increment?.incrementAmount) || 0,
    incrementPercentage: Number(increment?.incrementPercentage) || 0,
    effectiveDate: increment?.effectiveDate || null,
    status: increment?.status || '',
    reason: increment?.reason || ''
  };
};

const aggregatePayrollTotals = (payrolls = []) => {
  const totals = payrolls.reduce(
    (acc, row) => {
      acc.totalGrossSalary += Number(row.grossSalary) || 0;
      acc.totalNetSalary += Number(row.netSalary) || 0;
      acc.totalBasicSalary += Number(row.basicSalary) || 0;
      return acc;
    },
    { totalGrossSalary: 0, totalNetSalary: 0, totalBasicSalary: 0 }
  );
  return {
    payrollCount: payrolls.length,
    ...totals
  };
};

const uniqueEmployeesById = (rows = []) => {
  const map = new Map();
  rows.forEach((row) => {
    const id = String(row?.employee?._id || row?.employee || '');
    if (!id) return;
    if (!map.has(id)) map.set(id, row);
  });
  return [...map.values()];
};

const buildPayrollMonthlyComparisonReport = async (month, year) => {
  const prev = prevPeriod(month, year);
  const { start, end } = monthRange(month, year);

  const [currentPayrolls, previousPayrolls, hirings, separationsByDate, salaryIncrements] = await Promise.all([
    Payroll.find({ month, year })
      .populate({ path: 'employee', select: EMPLOYEE_REPORT_SELECT, populate: EMPLOYEE_POPULATE })
      .lean(),
    Payroll.find({ month: prev.month, year: prev.year })
      .populate({ path: 'employee', select: EMPLOYEE_REPORT_SELECT, populate: EMPLOYEE_POPULATE })
      .lean(),
    Employee.find({
      $or: [
        { joiningDate: { $gte: start, $lte: end } },
        { hireDate: { $gte: start, $lte: end } },
        { appointmentDate: { $gte: start, $lte: end } },
        { isLateEntryForPayroll: true }
      ]
    })
      .select(EMPLOYEE_REPORT_SELECT)
      .populate(EMPLOYEE_POPULATE)
      .sort({ joiningDate: 1, hireDate: 1, appointmentDate: 1 })
      .lean(),
    Employee.find({
      $or: [
        { terminationDate: { $gte: start, $lte: end } },
        { isLateTerminationEntryForPayroll: true }
      ]
    })
      .select(EMPLOYEE_REPORT_SELECT)
      .populate(EMPLOYEE_POPULATE)
      .sort({ terminationDate: 1 })
      .lean(),
    EmployeeIncrement.find({
      effectiveDate: { $gte: start, $lte: end },
      status: { $in: ['approved', 'implemented'] }
    })
      .populate({
        path: 'employee',
        select: EMPLOYEE_REPORT_SELECT,
        populate: EMPLOYEE_POPULATE
      })
      .sort({ effectiveDate: 1 })
      .lean()
  ]);

  const currentUnique = uniqueEmployeesById(currentPayrolls);
  const previousUnique = uniqueEmployeesById(previousPayrolls);

  const currentIdSet = new Set(
    currentUnique.map((p) => String(p.employee?._id || p.employee))
  );
  const previousIdSet = new Set(
    previousUnique.map((p) => String(p.employee?._id || p.employee))
  );

  const addedIds = [...currentIdSet].filter((id) => id && !previousIdSet.has(id));
  const removedIds = [...previousIdSet].filter((id) => id && !currentIdSet.has(id));

  const [addedEmployees, removedEmployees] = await Promise.all([
    addedIds.length
      ? Employee.find({ _id: { $in: addedIds } })
        .select(EMPLOYEE_REPORT_SELECT)
        .populate(EMPLOYEE_POPULATE)
        .lean()
      : [],
    removedIds.length
      ? Employee.find({ _id: { $in: removedIds } })
        .select(EMPLOYEE_REPORT_SELECT)
        .populate(EMPLOYEE_POPULATE)
        .lean()
      : []
  ]);

  const separationMap = new Map();
  separationsByDate.forEach((emp) => separationMap.set(String(emp._id), mapEmployeeRow(emp)));
  removedEmployees.forEach((emp) => {
    const id = String(emp._id);
    if (!separationMap.has(id)) {
      separationMap.set(id, mapEmployeeRow(emp, { note: 'Not on current month payroll' }));
    }
  });

  const current = aggregatePayrollTotals(currentUnique);
  const previous = aggregatePayrollTotals(previousUnique);
  const headcountChange = current.payrollCount - previous.payrollCount;
  const headcountChangePercent = previous.payrollCount > 0
    ? Math.round((headcountChange / previous.payrollCount) * 1000) / 10
    : (current.payrollCount > 0 ? 100 : 0);

  const reinstatedEmployees = [];
  const reinstatedSeen = new Set();

  currentUnique.forEach((row) => {
    const emp = row.employee;
    if (!emp?._id || emp.employmentStatus !== 'Reinstated') return;

    const id = String(emp._id);
    if (reinstatedSeen.has(id)) return;

    const returnedToPayroll = !previousIdSet.has(id);
    const updatedAt = emp.updatedAt ? new Date(emp.updatedAt) : null;
    const statusUpdatedThisMonth = updatedAt
      && !Number.isNaN(updatedAt.getTime())
      && updatedAt >= start
      && updatedAt <= end;

    if (!returnedToPayroll && !statusUpdatedThisMonth) return;

    reinstatedSeen.add(id);
    reinstatedEmployees.push(mapEmployeeRow(emp, {
      note: returnedToPayroll
        ? 'Employee reinstated on payroll this month'
        : 'Employee status set to Reinstated this month',
      employmentStatus: 'Reinstated'
    }));
  });

  return {
    month,
    year,
    periodLabel: `${MONTH_NAMES[month]} ${year}`,
    previousPeriod: {
      month: prev.month,
      year: prev.year,
      label: `${MONTH_NAMES[prev.month]} ${prev.year}`
    },
    current,
    previous,
    comparison: {
      headcountChange,
      headcountChangePercent,
      grossSalaryChange: current.totalGrossSalary - previous.totalGrossSalary,
      netSalaryChange: current.totalNetSalary - previous.totalNetSalary
    },
    hirings: hirings.map((emp) => mapEmployeeRow(emp)),
    separations: [...separationMap.values()],
    salaryIncrements: salaryIncrements.map((row) => mapIncrementRow(row)),
    reinstatedEmployees,
    newOnPayroll: addedEmployees.map((emp) => mapEmployeeRow(emp, { note: 'Added to payroll vs last month' })),
    removedFromPayroll: removedEmployees.map((emp) => mapEmployeeRow(emp, { note: 'On last month payroll, not this month' }))
  };
};

const savePayrollMonthlyComparisonReport = async (month, year, actorId) => {
  const report = await buildPayrollMonthlyComparisonReport(month, year);
  const doc = await PayrollMonthlyComparisonReport.findOneAndUpdate(
    { month, year },
    {
      month,
      year,
      report,
      generatedBy: actorId,
      generatedAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await syncComparisonReportStatusFromApproval(month, year);
  const refreshed = await PayrollMonthlyComparisonReport.findById(doc._id).lean();
  return {
    report: refreshed?.report || report,
    savedAt: refreshed?.generatedAt || doc.generatedAt,
    status: refreshed?.status || doc.status || 'Draft',
    _id: doc._id
  };
};

const formatComparisonDocResponse = (doc) => ({
  report: doc.report,
  generatedAt: doc.generatedAt,
  status: doc.status || 'Draft',
  approvedAt: doc.approvedAt || null,
  fromCache: true,
  _id: doc._id
});

const getPayrollMonthlyComparisonReport = async (month, year, { regenerate = false } = {}) => {
  if (!regenerate) {
    const existing = await PayrollMonthlyComparisonReport.findOne({ month, year }).lean();
    if (existing?.report) {
      return formatComparisonDocResponse(existing);
    }
  }
  const payrollCount = await Payroll.countDocuments({ month, year });
  if (!payrollCount) {
    const err = new Error('No payroll records found for this month. Generate payroll first.');
    err.statusCode = 404;
    throw err;
  }
  const built = await buildPayrollMonthlyComparisonReport(month, year);
  return { report: built, status: 'Draft', fromCache: false };
};

module.exports = {
  MONTH_NAMES,
  buildPayrollMonthlyComparisonReport,
  savePayrollMonthlyComparisonReport,
  getPayrollMonthlyComparisonReport
};
