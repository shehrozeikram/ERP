import api from './api';

const procurementService = {
  // Purchase Orders
  getPurchaseOrders: async (params = {}) => {
    const response = await api.get('/procurement/purchase-orders', { params });
    return response.data;
  },
  getPOStats: async () => {
    const response = await api.get('/procurement/purchase-orders/statistics');
    return response.data;
  },
  getPOById: async (id) => {
    const response = await api.get(`/procurement/purchase-orders/${id}`);
    return response.data;
  },
  createPO: async (data) => {
    const response = await api.post('/procurement/purchase-orders', data);
    return response.data;
  },
  updatePO: async (id, data) => {
    const response = await api.put(`/procurement/purchase-orders/${id}`, data);
    return response.data;
  },
  submitPO: async (id) => {
    const response = await api.put(`/procurement/purchase-orders/${id}/submit`);
    return response.data;
  },
  auditApprovePO: async (id, remarks) => {
    const response = await api.put(`/procurement/purchase-orders/${id}/audit-approve`, { remarks });
    return response.data;
  },
  financeApprovePO: async (id, remarks) => {
    const response = await api.put(`/procurement/purchase-orders/${id}/finance-approve`, { remarks });
    return response.data;
  },
  rejectPO: async (id, remarks) => {
    const response = await api.put(`/procurement/purchase-orders/${id}/reject`, { remarks });
    return response.data;
  },
  receivePOItems: async (id, items) => {
    const response = await api.put(`/procurement/purchase-orders/${id}/receive`, { items });
    return response.data;
  },

  // Quotations
  getQuotations: async (params = {}) => {
    const response = await api.get('/procurement/quotations', { params });
    return response.data;
  },
  createQuotation: async (data) => {
    const response = await api.post('/procurement/quotations', data);
    return response.data;
  },
  updateQuotation: async (id, data) => {
    const response = await api.put(`/procurement/quotations/${id}`, data);
    return response.data;
  },
  createPOFromQuotation: async (id) => {
    const response = await api.post(`/procurement/quotations/${id}/create-po`);
    return response.data;
  },

  // Requisitions (Indents for Procurement)
  getRequisitions: async (params = {}) => {
    const response = await api.get('/procurement/requisitions', { params });
    return response.data;
  },

  // Vendors
  getVendors: async (params = {}) => {
    const response = await api.get('/procurement/vendors', { params });
    return response.data;
  },
  getVendorStats: async () => {
    const response = await api.get('/procurement/vendors/statistics');
    return response.data;
  },
  createVendor: async (data) => {
    const response = await api.post('/procurement/vendors', data);
    return response.data;
  },
  updateVendor: async (id, data) => {
    const response = await api.put(`/procurement/vendors/${id}`, data);
    return response.data;
  }
};

export default procurementService;
