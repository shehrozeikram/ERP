const EMPLOYED_STATUSES = new Set(['Active', 'Reinstated']);
const INACTIVE_STATUSES = new Set(['Inactive', 'Terminated', 'Resigned', 'Retired']);

const syncIsActiveWithEmploymentStatus = (employmentStatus, isActive) => {
  if (EMPLOYED_STATUSES.has(employmentStatus)) return true;
  if (employmentStatus === 'Draft' || INACTIVE_STATUSES.has(employmentStatus)) return false;
  return isActive;
};

const applyEmploymentStatusSync = (employeeData = {}) => {
  if (!('employmentStatus' in employeeData)) return employeeData;
  return {
    ...employeeData,
    isActive: syncIsActiveWithEmploymentStatus(
      employeeData.employmentStatus,
      employeeData.isActive
    )
  };
};

module.exports = {
  EMPLOYED_STATUSES,
  syncIsActiveWithEmploymentStatus,
  applyEmploymentStatusSync
};
