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

/** Apply status sync and set terminationDate when an employee leaves. */
const applyEmploymentStatusUpdate = (existing = {}, employeeData = {}) => {
  const synced = applyEmploymentStatusSync(employeeData);
  const previousStatus = existing?.employmentStatus;
  const nextStatus = synced.employmentStatus;

  if (
    nextStatus
    && INACTIVE_STATUSES.has(nextStatus)
    && previousStatus !== nextStatus
    && !synced.terminationDate
    && !existing?.terminationDate
  ) {
    synced.terminationDate = new Date();
  }

  return synced;
};

module.exports = {
  EMPLOYED_STATUSES,
  INACTIVE_STATUSES,
  syncIsActiveWithEmploymentStatus,
  applyEmploymentStatusSync,
  applyEmploymentStatusUpdate
};
