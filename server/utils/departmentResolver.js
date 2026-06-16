const mongoose = require('mongoose');
const Department = require('../models/hr/Department');
const Employee = require('../models/hr/Employee');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findActiveDepartment = async (filter) =>
  Department.findOne({ ...filter, isActive: true }).select('name').lean();

/**
 * Resolve a department string or ObjectId to the canonical active department name.
 * Falls back to the linked employee's placement department when provided.
 */
const resolveDepartmentNameForAuth = async (input, { employeeMongoId } = {}) => {
  const trimmed = String(input || '').trim();

  if (trimmed && mongoose.Types.ObjectId.isValid(trimmed)) {
    const byId = await findActiveDepartment({ _id: trimmed });
    if (byId?.name) return byId.name;
  }

  if (trimmed) {
    const exact = await findActiveDepartment({ name: trimmed });
    if (exact?.name) return exact.name;

    const ci = await findActiveDepartment({
      name: new RegExp(`^${escapeRegex(trimmed)}$`, 'i')
    });
    if (ci?.name) return ci.name;
  }

  if (employeeMongoId && mongoose.Types.ObjectId.isValid(employeeMongoId)) {
    const employee = await Employee.findById(employeeMongoId)
      .populate('placementDepartment', 'name isActive')
      .select('placementDepartment')
      .lean();

    const placement = employee?.placementDepartment;
    if (placement?._id) {
      const activePlacement = await findActiveDepartment({ _id: placement._id });
      if (activePlacement?.name) return activePlacement.name;

      const placementDoc = await Department.findById(placement._id).select('name').lean();
      if (placementDoc?.name) return placementDoc.name;
    }

    if (placement?.name) {
      const fromPlacementName = await resolveDepartmentNameForAuth(placement.name);
      if (fromPlacementName) return fromPlacementName;
    }
  }

  return null;
};

const departmentAuthValidator = async (value, { req }) => {
  if (!value || !String(value).trim()) {
    throw new Error('Department is required');
  }
  const resolved = await resolveDepartmentNameForAuth(value, {
    employeeMongoId: req.body?.employee
  });
  if (!resolved) {
    throw new Error('Invalid department');
  }
  req.body.department = resolved;
  return true;
};

const optionalDepartmentAuthValidator = async (value, { req }) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return true;
  }
  return departmentAuthValidator(value, { req });
};

module.exports = {
  resolveDepartmentNameForAuth,
  departmentAuthValidator,
  optionalDepartmentAuthValidator
};
