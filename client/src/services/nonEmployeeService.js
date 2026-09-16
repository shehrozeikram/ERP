import api from './api';

const nonEmployeeService = {
  createRecord: async (formData) => {
    return api.post('/hr/non-employees', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  updateRecord: async (id, formData) => {
    return api.put(`/hr/non-employees/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  deleteRecord: async (id) => {
    return api.delete(`/hr/non-employees/${id}`);
  },

  getRecords: async () => {
    return api.get('/hr/non-employees');
  },

  getRecordById: async (id) => {
    return api.get(`/hr/non-employees/${id}`);
  },

  approveByHOD: async (id, payload = {}) => {
    return api.put(`/hr/non-employees/${id}/approve-hod`, payload);
  },

  rejectByHOD: async (id, payload = {}) => {
    return api.put(`/hr/non-employees/${id}/reject-hod`, payload);
  },

  approveByAVP: async (id, payload = {}) => {
    return api.put(`/hr/non-employees/${id}/approve-avp`, payload);
  },

  rejectByAVP: async (id, payload = {}) => {
    return api.put(`/hr/non-employees/${id}/reject-avp`, payload);
  },

  approveByChairman: async (id, payload = {}) => {
    return api.put(`/hr/non-employees/${id}/approve-chairman`, payload);
  },

  rejectByChairman: async (id, payload = {}) => {
    return api.put(`/hr/non-employees/${id}/reject-chairman`, payload);
  },

  getForCEO: async () => {
    return api.get('/hr/non-employees/ceo-dashboard');
  },

  approveByCEO: async (id, payload = {}) => {
    return api.put(`/hr/non-employees/${id}/approve-ceo`, payload);
  },

  rejectByCEO: async (id, payload = {}) => {
    return api.put(`/hr/non-employees/${id}/reject-ceo`, payload);
  },

  returnByCEO: async (id, payload = {}) => {
    return api.put(`/hr/non-employees/${id}/return-ceo`, payload);
  }
};

export default nonEmployeeService;
