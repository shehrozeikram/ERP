import api from './api';

// ==================== STAFF TYPE SERVICES ====================

export const getStaffTypes = async (options = {}) => {
  const params = new URLSearchParams();
  if (options.includeInactive) params.append('includeInactive', 'true');
  if (options.populateTargets) params.append('populateTargets', 'true');
  if (options.sortBy) params.append('sortBy', options.sortBy);
  if (options.sortOrder) params.append('sortOrder', options.sortOrder);

  const response = await api.get(`/staff-management/staff-types?${params}`);
  return response.data;
};

export const createStaffType = async (staffTypeData) => {
  const response = await api.post('/staff-management/staff-types', staffTypeData);
  return response.data;
};

export const updateStaffType = async (staffTypeId, updateData) => {
  const response = await api.put(`/staff-management/staff-types/${staffTypeId}`, updateData);
  return response.data;
};

// ==================== ASSIGNMENT SERVICES ====================

export const getAssignments = async (filters = {}) => {
  const params = new URLSearchParams();
  
  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      params.append(key, filters[key]);
    }
  });

  const response = await api.get(`/staff-management/assignments?${params}`);
  return response.data;
};

export const createAssignment = async (assignmentData) => {
  const response = await api.post('/staff-management/assignments', assignmentData);
  return response.data;
};

export const updateAssignment = async (assignmentId, updateData) => {
  const response = await api.put(`/staff-management/assignments/${assignmentId}`, updateData);
  return response.data;
};

export const cancelAssignment = async (assignmentId, reason) => {
  const response = await api.delete(`/staff-management/assignments/${assignmentId}`, {
    data: { reason }
  });
  return response.data;
};

// ==================== ASSIGNMENT TARGET SERVICES ====================

export const getAssignmentTargets = async (staffTypeId) => {
  const response = await api.get(`/staff-management/assignment-targets/${staffTypeId}`);
  return response.data;
};

// ==================== DASHBOARD SERVICES ====================

export const getDashboardData = async () => {
  const response = await api.get('/staff-management/dashboard');
  return response.data;
};

// ==================== SEARCH SERVICES ====================

export const searchAssignments = async (searchTerm, filters = {}) => {
  const params = new URLSearchParams();
  params.append('q', searchTerm);
  
  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      params.append(key, filters[key]);
    }
  });

  const response = await api.get(`/staff-management/search?${params}`);
  return response.data;
};

// ==================== EMPLOYEE ASSIGNMENT SERVICES ====================

export const getEmployeeAssignments = async (employeeId) => {
  const response = await api.get(`/staff-management/employee-assignments/${employeeId}`);
  return response.data;
};

export const getStaffTypeAssignments = async (staffTypeId, status = 'Active') => {
  const response = await api.get(`/staff-management/staff-type-assignments/${staffTypeId}?status=${status}`);
  return response.data;
};

export const getTargetAssignments = async (targetType, targetId, status = 'Active') => {
  const params = new URLSearchParams();
  params.append('targetType', targetType);
  params.append('targetId', targetId);
  params.append('status', status);

  const response = await api.get(`/staff-management/target-assignments?${params}`);
  return response.data;
};

// ==================== BULK OPERATIONS ====================

export const bulkUpdateAssignments = async (assignmentIds, updateData) => {
  const response = await api.post('/staff-management/bulk-update', {
    assignmentIds,
    updateData
  });
  return response.data;
};
