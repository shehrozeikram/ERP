import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create axios instance with default config
const itApi = axios.create({
  baseURL: `${API_BASE_URL}/it`,
  timeout: 30000,
});

// Add request interceptor to include auth token
itApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
itApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const itService = {
  // Dashboard
  getDashboard: () => itApi.get('/dashboard'),

  // Assets
  getAssets: (params = {}) => itApi.get('/assets', { params }),
  getAsset: (id) => itApi.get(`/assets/${id}`),
  createAsset: (data) => itApi.post('/assets', data),
  updateAsset: (id, data) => itApi.put(`/assets/${id}`, data),
  deleteAsset: (id) => itApi.delete(`/assets/${id}`),
  assignAsset: (id, data) => itApi.post(`/assets/${id}/assign`, data),
  returnAsset: (id, data) => itApi.post(`/assets/${id}/return`, data),

  // Asset Assignments
  getAssetAssignments: (params = {}) => itApi.get('/assets/assignments', { params }),
  getAssetAssignment: (id) => itApi.get(`/assets/assignments/${id}`),

  // Asset Maintenance
  getMaintenanceLogs: (params = {}) => itApi.get('/assets/maintenance', { params }),
  getMaintenanceLog: (id) => itApi.get(`/assets/maintenance/${id}`),
  createMaintenanceLog: (data) => itApi.post('/assets/maintenance', data),
  updateMaintenanceLog: (id, data) => itApi.put(`/assets/maintenance/${id}`, data),
  deleteMaintenanceLog: (id) => itApi.delete(`/assets/maintenance/${id}`),

  // Software Inventory
  getSoftware: (params = {}) => itApi.get('/software', { params }),
  getSoftwareItem: (id) => itApi.get(`/software/${id}`),
  createSoftware: (data) => itApi.post('/software', data),
  updateSoftware: (id, data) => itApi.put(`/software/${id}`, data),
  deleteSoftware: (id) => itApi.delete(`/software/${id}`),

  // License Assignments
  getLicenseAssignments: (params = {}) => itApi.get('/software/licenses', { params }),
  getLicenseAssignment: (id) => itApi.get(`/software/licenses/${id}`),
  assignLicense: (data) => itApi.post('/software/licenses', data),
  updateLicenseAssignment: (id, data) => itApi.put(`/software/licenses/${id}`, data),
  revokeLicense: (id, data) => itApi.post(`/software/licenses/${id}/revoke`, data),

  // Software Vendors
  getSoftwareVendors: (params = {}) => itApi.get('/software/vendors', { params }),
  getSoftwareVendor: (id) => itApi.get(`/software/vendors/${id}`),
  createSoftwareVendor: (data) => itApi.post('/software/vendors', data),
  updateSoftwareVendor: (id, data) => itApi.put(`/software/vendors/${id}`, data),
  deleteSoftwareVendor: (id) => itApi.delete(`/software/vendors/${id}`),

  // Network Devices
  getNetworkDevices: (params = {}) => itApi.get('/network', { params }),
  getNetworkDevice: (id) => itApi.get(`/network/${id}`),
  createNetworkDevice: (data) => itApi.post('/network', data),
  updateNetworkDevice: (id, data) => itApi.put(`/network/${id}`, data),
  deleteNetworkDevice: (id) => itApi.delete(`/network/${id}`),

  // Device Logs
  getDeviceLogs: (params = {}) => itApi.get('/network/logs', { params }),
  getDeviceLog: (id) => itApi.get(`/network/logs/${id}`),
  createDeviceLog: (data) => itApi.post('/network/logs', data),
  updateDeviceLog: (id, data) => itApi.put(`/network/logs/${id}`, data),

  // Incident Reports
  getIncidents: (params = {}) => itApi.get('/incidents', { params }),
  getIncident: (id) => itApi.get(`/incidents/${id}`),
  createIncident: (data) => itApi.post('/incidents', data),
  updateIncident: (id, data) => itApi.put(`/incidents/${id}`, data),
  resolveIncident: (id, data) => itApi.post(`/incidents/${id}/resolve`, data),

  // IT Vendors
  getITVendors: (params = {}) => itApi.get('/vendors', { params }),
  getITVendor: (id) => itApi.get(`/vendors/${id}`),
  createITVendor: (data) => itApi.post('/vendors', data),
  updateITVendor: (id, data) => itApi.put(`/vendors/${id}`, data),
  deleteITVendor: (id) => itApi.delete(`/vendors/${id}`),

  // Vendor Contracts
  getVendorContracts: (vendorId) => itApi.get(`/vendors/${vendorId}/contracts`),
  getVendorContract: (contractId) => itApi.get(`/contracts/${contractId}`),
  createVendorContract: (vendorId, data) => itApi.post(`/vendors/${vendorId}/contract`, data),
  updateVendorContract: (contractId, data) => itApi.put(`/contracts/${contractId}`, data),
  deleteVendorContract: (contractId) => itApi.delete(`/contracts/${contractId}`),

  // Contract Renewals
  getContractRenewals: (params = {}) => itApi.get('/vendors/renewals', { params }),
  getContractRenewal: (id) => itApi.get(`/vendors/renewals/${id}`),
  createContractRenewal: (data) => itApi.post('/vendors/renewals', data),
  updateContractRenewal: (id, data) => itApi.put(`/vendors/renewals/${id}`, data),
  approveContractRenewal: (id, data) => itApi.post(`/vendors/renewals/${id}/approve`, data),

  // Password Wallet
  getAllPasswords: () => itApi.get('/passwords'),
  getVendorPasswords: (vendorId) => itApi.get(`/vendors/${vendorId}/passwords`),
  getPassword: (passwordId) => itApi.get(`/passwords/${passwordId}`),
  createPassword: (vendorId, data) => itApi.post(`/vendors/${vendorId}/passwords`, data),
  createPasswordWithoutVendor: (data) => itApi.post('/passwords', data),
  updatePassword: (passwordId, data) => itApi.put(`/passwords/${passwordId}`, data),
  deletePassword: (passwordId) => itApi.delete(`/passwords/${passwordId}`),
  getExpiringPasswords: (days = 30) => itApi.get(`/passwords/expiring?days=${days}`),
  decryptPassword: (passwordId, masterPassword) => itApi.post(`/passwords/${passwordId}/decrypt`, { masterPassword }),

  // Reports
  getAssetReport: (params = {}) => itApi.get('/reports/assets', { params }),
  getSoftwareReport: (params = {}) => itApi.get('/reports/software', { params }),
  getNetworkReport: (params = {}) => itApi.get('/reports/network', { params }),
  getVendorReport: (params = {}) => itApi.get('/reports/vendors', { params }),

  // Statistics
  getAssetStatistics: () => itApi.get('/statistics/assets'),
  getSoftwareStatistics: () => itApi.get('/statistics/software'),
  getNetworkStatistics: () => itApi.get('/statistics/network'),
  getVendorStatistics: () => itApi.get('/statistics/vendors'),

  // File Upload
  uploadFile: (file, type = 'asset') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return itApi.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Export
  exportAssets: (params = {}) => itApi.get('/export/assets', { 
    params,
    responseType: 'blob'
  }),
  exportSoftware: (params = {}) => itApi.get('/export/software', { 
    params,
    responseType: 'blob'
  }),
  exportNetwork: (params = {}) => itApi.get('/export/network', { 
    params,
    responseType: 'blob'
  }),
  exportVendors: (params = {}) => itApi.get('/export/vendors', { 
    params,
    responseType: 'blob'
  }),

  // Reports & Analytics
  getAssetUtilizationReport: (params = {}) => itApi.get('/reports/asset-utilization', { params }),
  getLicenseExpiryReport: (params = {}) => itApi.get('/reports/license-expiry', { params }),
  getNetworkUptimeReport: (params = {}) => itApi.get('/reports/network-uptime', { params }),
  getVendorPerformanceReport: (params = {}) => itApi.get('/reports/vendor-performance', { params }),
  getITFinancialReport: (params = {}) => itApi.get('/reports/financial', { params }),
  getITProcurementReport: (params = {}) => itApi.get('/reports/procurement', { params }),
  getDashboardStats: () => itApi.get('/dashboard/stats'),
  getAssetDepreciationReport: (params = {}) => itApi.get('/reports/asset-depreciation', { params }),
  getMaintenanceScheduleReport: (params = {}) => itApi.get('/reports/maintenance-schedule', { params }),

  // HR Integration
  getEmployeeAssets: (employeeId) => itApi.get(`/hr/employee/${employeeId}/assets`),
  getDepartmentAssets: (departmentId) => itApi.get(`/hr/department/${departmentId}/assets`),

  // Notifications
  getNotifications: () => itApi.get('/notifications'),
  markNotificationRead: (id) => itApi.put(`/notifications/${id}/read`),
  markAllNotificationsRead: () => itApi.put('/notifications/read-all'),
};

export default itService;
