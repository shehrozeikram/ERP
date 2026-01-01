import api from './api';

const paymentSettlementService = {
  // Get all payment settlements with pagination and filters
  getPaymentSettlements: async (params = {}) => {
    try {
      const response = await api.get('/payment-settlements', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get single payment settlement by ID
  getPaymentSettlement: async (id) => {
    try {
      const response = await api.get(`/payment-settlements/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new payment settlement
  createPaymentSettlement: async (settlementData, attachments = []) => {
    try {
      const formData = new FormData();
      
      // Append settlement data
      Object.keys(settlementData).forEach(key => {
        if (settlementData[key] !== null && settlementData[key] !== undefined) {
          formData.append(key, settlementData[key]);
        }
      });
      
      // Append attachments
      attachments.forEach((file, index) => {
        formData.append('attachments', file);
      });
      
      const response = await api.post('/payment-settlements', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update payment settlement
  updatePaymentSettlement: async (id, settlementData, attachments = []) => {
    try {
      const formData = new FormData();
      
      // Append settlement data
      Object.keys(settlementData).forEach(key => {
        if (settlementData[key] !== null && settlementData[key] !== undefined) {
          formData.append(key, settlementData[key]);
        }
      });
      
      // Append attachments
      attachments.forEach((file, index) => {
        formData.append('attachments', file);
      });
      
      const response = await api.put(`/payment-settlements/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete payment settlement
  deletePaymentSettlement: async (id) => {
    try {
      const response = await api.delete(`/payment-settlements/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update settlement status
  updateSettlementStatus: async (id, status) => {
    try {
      const response = await api.patch(`/payment-settlements/${id}/status`, { status });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update workflow status
  updateWorkflowStatus: async (id, data) => {
    try {
      const response = await api.patch(`/payment-settlements/${id}/workflow-status`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Approve payment settlement
  approvePayment: async (id, data) => {
    try {
      const response = await api.patch(`/payment-settlements/${id}/approve`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Reject payment settlement
  rejectPayment: async (id, data) => {
    try {
      const response = await api.patch(`/payment-settlements/${id}/reject`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get settlement statistics
  getSettlementStats: async () => {
    try {
      const response = await api.get('/payment-settlements/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete attachment from payment settlement
  deleteAttachment: async (settlementId, attachmentId) => {
    try {
      const response = await api.delete(`/payment-settlements/${settlementId}/attachments/${attachmentId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get attachment download URL with auth token
  getAttachmentUrl: (settlementId, attachmentId) => {
    const token = localStorage.getItem('token');
    return `${api.defaults.baseURL}/payment-settlements/${settlementId}/attachments/${attachmentId}/download?token=${token}`;
  },

  // Get attachment as blob URL for images
  getAttachmentBlobUrl: async (settlementId, attachmentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${api.defaults.baseURL}/payment-settlements/${settlementId}/attachments/${attachmentId}/download?token=${token}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch attachment');
      }
      
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      throw error;
    }
  }
};

export default paymentSettlementService;
