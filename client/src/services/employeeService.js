import api from './api';

const employeeService = {
  // Get all employees
  getEmployees: async (params = {}) => {
    const response = await api.get('/hr/employees', { params });
    return response.data;
  },

  // Get single employee
  getEmployee: async (id) => {
    const response = await api.get(`/hr/employees/${id}`);
    return response.data;
  },

  // Create new employee
  createEmployee: async (employeeData) => {
    const response = await api.post('/hr/employees', employeeData);
    return response.data;
  },

  // Update employee
  updateEmployee: async (id, employeeData) => {
    const response = await api.put(`/hr/employees/${id}`, employeeData);
    return response.data;
  },

  // Delete employee
  deleteEmployee: async (id) => {
    const response = await api.delete(`/hr/employees/${id}`);
    return response.data;
  },

  // Get active employees only
  getActiveEmployees: async () => {
    const response = await api.get('/hr/employees?isActive=true');
    return response.data;
  },

  // Get employees by department
  getEmployeesByDepartment: async (departmentId) => {
    const response = await api.get(`/hr/employees?department=${departmentId}`);
    return response.data;
  },

  // Get employees by designation
  getEmployeesByDesignation: async (designationId) => {
    const response = await api.get(`/hr/employees?designation=${designationId}`);
    return response.data;
  },

  // Search employees
  searchEmployees: async (searchTerm) => {
    const response = await api.get(`/hr/employees/search?q=${searchTerm}`);
    return response.data;
  }
};

export default employeeService;
