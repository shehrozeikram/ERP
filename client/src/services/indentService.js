import api from './api';

const indentService = {
  // Get all indents with filters
  getIndents: async (params = {}) => {
    const response = await api.get('/indents', { params });
    return response.data;
  },

  // Get dashboard statistics
  getDashboardStats: async () => {
    const response = await api.get('/indents/dashboard');
    return response.data;
  },

  // Get single indent by ID
  getIndentById: async (id) => {
    const response = await api.get(`/indents/${id}`);
    return response.data;
  },

  // Create new indent
  createIndent: async (indentData) => {
    const response = await api.post('/indents', indentData);
    return response.data;
  },

  // Update indent
  updateIndent: async (id, indentData) => {
    const response = await api.put(`/indents/${id}`, indentData);
    return response.data;
  },

  // Delete indent
  deleteIndent: async (id) => {
    const response = await api.delete(`/indents/${id}`);
    return response.data;
  },

  // Submit indent for approval
  submitIndent: async (id) => {
    const response = await api.post(`/indents/${id}/submit`);
    return response.data;
  },

  // Approve indent
  approveIndent: async (id) => {
    const response = await api.post(`/indents/${id}/approve`);
    return response.data;
  },

  // Reject indent
  rejectIndent: async (id, rejectionReason) => {
    const response = await api.post(`/indents/${id}/reject`, { rejectionReason });
    return response.data;
  },

  // Add comment to indent
  addComment: async (id, comment) => {
    const response = await api.post(`/indents/${id}/comment`, { comment });
    return response.data;
  },

  // Get next indent number
  getNextIndentNumber: async () => {
    const response = await api.get('/indents/next-number');
    return response.data;
  },

  // Get next ERP Ref number
  getNextERPRef: async () => {
    const response = await api.get('/indents/next-erp-ref');
    return response.data;
  },

  // Store: Move indent to Procurement Requisitions (items not in stock). Reason required.
  moveToProcurement: async (id, reason) => {
    const response = await api.post(`/indents/${id}/move-to-procurement`, { reason: reason || '' });
    return response.data;
  }
};

export default indentService;

