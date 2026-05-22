/**
 * Employee advance receivable accounts (Advances to employees) under parent 1120.
 */
const mongoose = require('mongoose');
const Account = require('../models/finance/Account');
const Employee = require('../models/hr/Employee');
const User = require('../models/User');
const { ensureStaffAdvanceAccount } = require('./staffAdvanceAccount');

const EMPLOYEE_ADVANCE_DETAIL_TYPE = 'Advances to Employees';

const employeeDisplayName = (employee) => {
  const n = [employee?.firstName, employee?.lastName].filter(Boolean).join(' ').trim();
  return n || employee?.employeeId || 'Employee';
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Resolve the GL account for an employee advance (employee link → child of 1120 → by code/name).
 */
const resolveEmployeeAdvanceAccount = async (employee, { createdBy } = {}) => {
  if (!employee) return null;

  if (employee.employeeAdvanceAccount) {
    const linked =
      typeof employee.employeeAdvanceAccount === 'object' && employee.employeeAdvanceAccount.accountNumber
        ? employee.employeeAdvanceAccount
        : await Account.findById(employee.employeeAdvanceAccount);
    if (linked?.isActive) return linked;
  }

  const parent = await ensureStaffAdvanceAccount(createdBy);
  const parentId = parent._id;
  const empCode = String(employee.employeeId || '').trim();

  if (empCode) {
    const exactChild = await Account.findOne({
      parentAccount: parentId,
      accountNumber: `1120-${empCode}`,
      isActive: true
    });
    if (exactChild) return exactChild;

    const looseChild = await Account.findOne({
      parentAccount: parentId,
      accountNumber: new RegExp(escapeRegex(empCode), 'i'),
      isActive: true
    });
    if (looseChild) return looseChild;
  }

  const fullName = employeeDisplayName(employee);
  if (fullName) {
    const byName = await Account.findOne({
      parentAccount: parentId,
      name: new RegExp(escapeRegex(fullName), 'i'),
      isActive: true
    });
    if (byName) return byName;
  }

  return null;
};

/**
 * Create (if missing) a per-employee advance account under 1120 and persist on Employee.
 */
const ensureEmployeeAdvanceAccount = async (employee, createdBy) => {
  const existing = await resolveEmployeeAdvanceAccount(employee, { createdBy });
  if (existing) {
    if (!employee.employeeAdvanceAccount) {
      employee.employeeAdvanceAccount = existing._id;
      employee.employeeAdvanceAccountNumber = existing.accountNumber;
      await employee.save();
    }
    return existing;
  }

  const parent = await ensureStaffAdvanceAccount(createdBy);
  const empCode = String(employee.employeeId || employee._id).trim().replace(/\s+/g, '');
  const accountNumber = `1120-${empCode}`.slice(0, 24);
  const name = `Advance to ${employeeDisplayName(employee)}`;

  let acc = await Account.findOne({ accountNumber });
  if (!acc) {
    acc = await Account.create({
      accountNumber,
      name,
      type: 'Asset',
      category: 'Current Asset',
      detailType: EMPLOYEE_ADVANCE_DETAIL_TYPE,
      parentAccount: parent._id,
      description: `Employee advance receivable — ${employeeDisplayName(employee)}`,
      isActive: true,
      allowTransactions: true,
      module: 'finance',
      metadata: { createdBy }
    });
  }

  employee.employeeAdvanceAccount = acc._id;
  employee.employeeAdvanceAccountNumber = acc.accountNumber;
  await employee.save();

  return acc;
};

/**
 * Resolve ERP user for an HR employee (employee.user ref, or match by employeeId / email).
 */
const resolveLinkedUserForEmployee = async (employee) => {
  if (!employee) return null;

  if (employee.user && typeof employee.user === 'object') {
    return employee.user.isActive !== false ? employee.user : null;
  }
  if (employee.user) {
    const u = await User.findById(employee.user).select('_id firstName lastName email employeeId isActive').lean();
    if (u?.isActive !== false) return u;
  }

  const empCode = String(employee.employeeId || '').trim();
  if (empCode) {
    const byCode = await User.findOne({ employeeId: empCode, isActive: true })
      .select('_id firstName lastName email employeeId isActive')
      .lean();
    if (byCode) return byCode;
  }

  const email = String(employee.email || '').trim().toLowerCase();
  if (email) {
    const byEmail = await User.findOne({ email, isActive: true })
      .select('_id firstName lastName email employeeId isActive')
      .lean();
    if (byEmail) return byEmail;
  }

  return null;
};

/**
 * List active employees for General cash approval "Advance to" picker.
 */
const listEmployeesForAdvancePicker = async ({ search = '', limit = 500, createdBy } = {}) => {
  const cap = Math.min(parseInt(limit, 10) || 500, 2000);
  // Match HR/payroll: employmentStatus Active (isActive alone excludes many valid employees).
  const query = {
    isDeleted: false,
    employmentStatus: 'Active'
  };
  if (search) {
    const rx = new RegExp(escapeRegex(search.trim()), 'i');
    query.$or = [
      { firstName: rx },
      { lastName: rx },
      { employeeId: rx },
      { email: rx }
    ];
  }

  let employees = await Employee.find(query)
    .select('firstName lastName employeeId email user placementDepartment employeeAdvanceAccount employeeAdvanceAccountNumber')
    .populate('placementDepartment', 'name code')
    .populate('employeeAdvanceAccount', 'accountNumber name detailType type')
    .sort({ firstName: 1, lastName: 1 })
    .limit(cap)
    .lean();

  if (!employees.length && !search) {
    employees = await Employee.find({
      isDeleted: false,
      isActive: { $ne: false },
      employmentStatus: { $nin: ['Terminated', 'Resigned', 'Retired', 'Inactive'] }
    })
      .select('firstName lastName employeeId email user placementDepartment employeeAdvanceAccount employeeAdvanceAccountNumber')
      .populate('placementDepartment', 'name code')
      .populate('employeeAdvanceAccount', 'accountNumber name detailType type')
      .sort({ firstName: 1, lastName: 1 })
      .limit(cap)
      .lean();
  }

  const empCodes = employees.map((e) => String(e.employeeId || '').trim()).filter(Boolean);
  const userIds = employees.map((e) => e.user).filter(Boolean);
  const usersByEmpId = new Map();
  const usersById = new Map();

  if (empCodes.length || userIds.length) {
    const or = [];
    if (empCodes.length) or.push({ employeeId: { $in: empCodes } });
    if (userIds.length) or.push({ _id: { $in: userIds } });
    const users = await User.find({ isActive: true, $or: or })
      .select('_id firstName lastName email employeeId isActive')
      .lean();
    users.forEach((u) => {
      usersById.set(String(u._id), u);
      if (u.employeeId) usersByEmpId.set(String(u.employeeId).trim(), u);
    });
  }

  return employees.map((emp) => {
    const advanceAccount =
      emp.employeeAdvanceAccount && typeof emp.employeeAdvanceAccount === 'object'
        ? {
          _id: emp.employeeAdvanceAccount._id,
          accountNumber: emp.employeeAdvanceAccount.accountNumber || emp.employeeAdvanceAccountNumber,
          name: emp.employeeAdvanceAccount.name,
          detailType: emp.employeeAdvanceAccount.detailType || EMPLOYEE_ADVANCE_DETAIL_TYPE
        }
        : emp.employeeAdvanceAccountNumber
          ? {
            accountNumber: emp.employeeAdvanceAccountNumber,
            name: 'Advances to employees'
          }
          : null;

    const linkedUser =
      (emp.user && usersById.get(String(emp.user))) ||
      usersByEmpId.get(String(emp.employeeId || '').trim()) ||
      null;

    return {
      _id: emp._id,
      employeeId: emp.employeeId,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      departmentName: emp.placementDepartment?.name || '',
      userId: linkedUser?._id ? String(linkedUser._id) : null,
      hasUser: Boolean(linkedUser),
      advanceAccount,
      hasAdvanceAccount: Boolean(advanceAccount),
      willCreateAdvanceAccount: !advanceAccount
    };
  });
};

/**
 * Validate and resolve advance recipient for a general cash approval save.
 */
const resolveGeneralAdvanceRecipient = async (body, createdBy) => {
  const employeeId = String(
    body.advanceToEmployee ||
    body.advanceToEmployeeId ||
    ''
  ).trim();

  if (!employeeId) {
    const err = new Error('Advance to (employee) is required');
    err.statusCode = 400;
    throw err;
  }

  const employee = await Employee.findById(employeeId)
    .populate('user', '_id firstName lastName email isActive')
    .populate('employeeAdvanceAccount', 'accountNumber name isActive');

  if (!employee || employee.isDeleted || !employee.isActive) {
    const err = new Error('Selected employee not found or inactive');
    err.statusCode = 400;
    throw err;
  }

  const linkedUser = await resolveLinkedUserForEmployee(employee);
  const userId = linkedUser?._id || null;

  let account = await resolveEmployeeAdvanceAccount(employee, { createdBy });
  if (!account) {
    account = await ensureEmployeeAdvanceAccount(employee, createdBy);
  }

  if (!account) {
    const err = new Error(
      `Could not resolve or create an Advances to employees account for ${employeeDisplayName(employee)}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const glFromBody = String(body.advanceGlAccount || '').trim();
  if (glFromBody && String(account._id) !== glFromBody) {
    const picked = await Account.findById(glFromBody);
    if (picked?.isActive) account = picked;
  }

  return {
    advanceToEmployee: employee._id,
    advanceTo: userId || undefined,
    advanceToName: employeeDisplayName(employee),
    advanceGlAccount: account._id,
    advanceGlAccountNumber: account.accountNumber
  };
};

/**
 * Resolve Employee from Mongo _id or HR employee code (e.g. "74") for finance payee queries.
 */
const resolveEmployeeForFinanceQuery = async (employeeIdOrCode) => {
  const token = String(employeeIdOrCode || '').trim();
  if (!token) return null;

  const select =
    '_id firstName lastName employeeId employeeAdvanceAccount employeeAdvanceAccountNumber user';
  const populate = [
    { path: 'employeeAdvanceAccount', select: 'accountNumber name' },
    { path: 'user', select: '_id' }
  ];

  if (mongoose.Types.ObjectId.isValid(token)) {
    const byId = await Employee.findById(token).select(select).populate(populate).lean();
    if (byId) return byId;
  }

  return Employee.findOne({ employeeId: token }).select(select).populate(populate).lean();
};

/**
 * Match cash approvals for an employee: direct link, GL advance account (1120-xxx), linked user, or name.
 */
const buildCashApprovalEmployeeFilter = async (employee) => {
  if (!employee?._id) return null;

  const or = [{ advanceToEmployee: employee._id }];
  const glAccountIds = new Set();

  const addGl = (id) => {
    if (id) glAccountIds.add(String(id));
  };

  if (employee.employeeAdvanceAccount) {
    addGl(
      typeof employee.employeeAdvanceAccount === 'object'
        ? employee.employeeAdvanceAccount._id
        : employee.employeeAdvanceAccount
    );
  }

  const empCode = String(employee.employeeId || '').trim();
  if (empCode) {
    const exact = await Account.findOne({
      accountNumber: `1120-${empCode}`,
      isActive: true
    })
      .select('_id')
      .lean();
    if (exact) addGl(exact._id);
  }

  if (employee.employeeAdvanceAccountNumber) {
    const stored = await Account.findOne({
      accountNumber: String(employee.employeeAdvanceAccountNumber).trim(),
      isActive: true
    })
      .select('_id')
      .lean();
    if (stored) addGl(stored._id);
  }

  glAccountIds.forEach((id) => or.push({ advanceGlAccount: id }));

  const glNumbers = new Set();
  if (employee.employeeAdvanceAccount?.accountNumber) {
    glNumbers.add(String(employee.employeeAdvanceAccount.accountNumber).trim());
  }
  if (employee.employeeAdvanceAccountNumber) {
    glNumbers.add(String(employee.employeeAdvanceAccountNumber).trim());
  }
  if (empCode) glNumbers.add(`1120-${empCode}`);
  glNumbers.forEach((num) => {
    if (num) or.push({ advanceGlAccountNumber: num });
  });

  let userId = employee.user?._id || employee.user;
  if (!userId && empCode) {
    const linkedUser = await User.findOne({ employeeId: empCode, isActive: true }).select('_id').lean();
    userId = linkedUser?._id;
  }
  if (userId) or.push({ advanceTo: userId });

  const name = employeeDisplayName(employee);
  if (name) {
    or.push({ advanceToName: new RegExp(`^${escapeRegex(name)}$`, 'i') });
  }

  return {
    status: { $nin: ['Draft', 'Cancelled', 'Rejected'] },
    $or: or
  };
};

module.exports = {
  EMPLOYEE_ADVANCE_DETAIL_TYPE,
  resolveEmployeeAdvanceAccount,
  ensureEmployeeAdvanceAccount,
  resolveLinkedUserForEmployee,
  listEmployeesForAdvancePicker,
  resolveGeneralAdvanceRecipient,
  resolveEmployeeForFinanceQuery,
  buildCashApprovalEmployeeFilter,
  employeeDisplayName
};
