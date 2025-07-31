import api from './api';

class CandidateApprovalService {
  // Create new approval workflow
  async createApproval(approvalData) {
    try {
      const response = await api.post('/candidate-approvals', approvalData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  // Get all approval workflows
  async getApprovals(params = {}) {
    try {
      const response = await api.get('/candidate-approvals', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  // Get pending approvals for current user
  async getPendingApprovals() {
    try {
      const response = await api.get('/candidate-approvals/pending');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  // Get approval workflow by ID
  async getApprovalById(id) {
    try {
      const response = await api.get(`/candidate-approvals/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  // Approve at current level
  async approveApproval(id, approvalData) {
    try {
      // Check if user is authenticated by trying to get auth token
      const token = localStorage.getItem('token');
      
      if (token) {
        // Use authenticated endpoint
        const response = await api.post(`/candidate-approvals/${id}/approve`, approvalData);
        return response.data;
      } else {
        // Use public endpoint for email links
        const response = await api.post(`/candidate-approvals/public/${id}/approve-public`, {
          ...approvalData,
          approverEmail: approvalData.approverEmail || 'external.approver@company.com'
        });
        return response.data;
      }
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  // Reject at current level
  async rejectApproval(id, rejectionData) {
    try {
      const response = await api.post(`/candidate-approvals/${id}/reject`, rejectionData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  // Send reminder email
  async sendReminder(id) {
    try {
      const response = await api.post(`/candidate-approvals/${id}/remind`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }

  // Cancel approval workflow
  async cancelApproval(id) {
    try {
      const response = await api.delete(`/candidate-approvals/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  }
}

export default new CandidateApprovalService(); 