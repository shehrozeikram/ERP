export function getEmployeeStatusLabel(employee = {}) {
  if (employee.employmentStatus) return employee.employmentStatus;
  return employee.isActive ? 'Active' : 'Inactive';
}

export function getEmployeeStatusColor(employee = {}) {
  const status = getEmployeeStatusLabel(employee);
  if (status === 'Active' || status === 'Reinstated') return 'success';
  if (status === 'Draft') return 'warning';
  if (status === 'Retired') return 'default';
  return 'error';
}

export function isEmployedEmployee(employee = {}) {
  if (employee.employmentStatus === 'Reinstated') return true;
  return employee.isActive === true && employee.employmentStatus === 'Active';
}

/** Left the organization — matches Employee List inactive filter (includes Inactive status). */
export function isSeparatedEmployee(employee = {}) {
  return !isEmployedEmployee(employee) && employee.employmentStatus !== 'Draft';
}
