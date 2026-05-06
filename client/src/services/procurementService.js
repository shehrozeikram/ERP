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
  getQuotationById: async (id) => {
    const response = await api.get(`/procurement/quotations/${id}`);
    return response.data;
  },
  uploadQuotationAttachment: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/procurement/quotations/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
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
  getRequisitionAssignees: async () => {
    const response = await api.get('/procurement/requisitions/assignees');
    return response.data;
  },
  assignRequisition: async (id, data) => {
    const response = await api.put(`/procurement/requisitions/${id}/assign`, data);
    return response.data;
  },
  rejectRequisition: async (id, observation) => {
    const response = await api.put(`/procurement/requisitions/${id}/reject`, { observation });
    return response.data;
  },
  getAssignmentManagers: async () => {
    const response = await api.get('/procurement/requisitions/assignment-managers');
    return response.data;
  },
  updateAssignmentManagers: async (userIds = []) => {
    const response = await api.put('/procurement/requisitions/assignment-managers', { userIds });
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
  getVendorCategories: async () => {
    const response = await api.get('/procurement/vendors/categories');
    return response.data;
  },
  createVendor: async (data) => {
    const response = await api.post('/procurement/vendors', data);
    return response.data;
  },
  updateVendor: async (id, data) => {
    const response = await api.put(`/procurement/vendors/${id}`, data);
    return response.data;
  },

  // Cash Approvals
  getCashApprovals: async (params = {}) => {
    const response = await api.get('/cash-approvals', { params });
    return response.data;
  },
  getCashApprovalById: async (id) => {
    const response = await api.get(`/cash-approvals/${id}`);
    return response.data;
  },
  getCashApprovalStats: async () => {
    const response = await api.get('/cash-approvals/statistics');
    return response.data;
  },
  getCashApprovalsPendingFinance: async () => {
    const response = await api.get('/cash-approvals/pending-finance');
    return response.data;
  },
  createCashApproval: async (data) => {
    const response = await api.post('/cash-approvals', data);
    return response.data;
  },
  updateCashApproval: async (id, data) => {
    const response = await api.put(`/cash-approvals/${id}`, data);
    return response.data;
  },
  deleteCashApproval: async (id) => {
    const response = await api.delete(`/cash-approvals/${id}`);
    return response.data;
  },
  // Workflow actions
  caSendToAudit: async (id, body) => {
    const payload = typeof body === 'string' ? { comments: body } : (body || {});
    const response = await api.put(`/cash-approvals/${id}/send-to-audit`, payload);
    return response.data;
  },
  caApprove: async (id, body) => {
    const payload = typeof body === 'string' ? { comments: body } : (body || {});
    const response = await api.put(`/cash-approvals/${id}/approve`, payload);
    return response.data;
  },
  caReject: async (id, body) => {
    const payload = typeof body === 'string' ? { rejectionComments: body, comments: body } : (body || {});
    const response = await api.put(`/cash-approvals/${id}/reject`, payload);
    return response.data;
  },
  caAuditApprove: async (id, body) => {
    const payload = typeof body === 'string' ? { comments: body, approvalComments: body } : (body || {});
    const response = await api.put(`/cash-approvals/${id}/audit-approve`, payload);
    return response.data;
  },
  caForwardToAuditDirector: async (id, comments) => {
    const response = await api.put(`/cash-approvals/${id}/forward-to-audit-director`, { comments });
    return response.data;
  },
  caAuditReject: async (id, body) => {
    const payload = typeof body === 'string' ? { rejectionComments: body, comments: body } : (body || {});
    const response = await api.put(`/cash-approvals/${id}/audit-reject`, payload);
    return response.data;
  },
  caAuditReturn: async (id, body) => {
    const payload = typeof body === 'string' ? { returnComments: body, comments: body } : (body || {});
    const response = await api.put(`/cash-approvals/${id}/audit-return`, payload);
    return response.data;
  },
  caForwardToCeo: async (id, comments) => {
    const response = await api.put(`/cash-approvals/${id}/forward-to-ceo`, { comments });
    return response.data;
  },
  caCeoSecretariatReturn: async (id, body) => {
    const payload = typeof body === 'string' ? { comments: body, returnComments: body } : (body || {});
    const response = await api.put(`/cash-approvals/${id}/ceo-secretariat-return`, payload);
    return response.data;
  },
  caCeoSecretariatReject: async (id, body) => {
    const response = await api.put(`/cash-approvals/${id}/ceo-secretariat-reject`, body || {});
    return response.data;
  },
  getCashApprovalsCeoSecretariat: async () => {
    const response = await api.get('/cash-approvals/ceo-secretariat');
    return response.data;
  },
  caCeoApprove: async (id, data) => {
    const response = await api.put(`/cash-approvals/${id}/ceo-approve`, data);
    return response.data;
  },
  caCeoReject: async (id, comments) => {
    const response = await api.put(`/cash-approvals/${id}/ceo-reject`, { comments });
    return response.data;
  },
  caCeoReturn: async (id, comments) => {
    const response = await api.put(`/cash-approvals/${id}/ceo-return`, { comments });
    return response.data;
  },
  caIssueAdvance: async (id, data) => {
    const response = await api.put(`/cash-approvals/${id}/issue-advance`, data);
    return response.data;
  },
  caSendToProcurement: async (id, remarks) => {
    const response = await api.put(`/cash-approvals/${id}/send-to-procurement`, { remarks });
    return response.data;
  },
  caComplete: async (id, remarks) => {
    const response = await api.put(`/cash-approvals/${id}/complete`, { remarks });
    return response.data;
  },
  caCancel: async (id, reason) => {
    const response = await api.put(`/cash-approvals/${id}/cancel`, { reason });
    return response.data;
  }
};

export default procurementService;
