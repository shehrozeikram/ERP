import api from './api';

const crmService = {
  // ==================== DASHBOARD ====================

  // Get CRM dashboard data
  getDashboard: async () => {
    return api.get('/crm/dashboard');
  },

  // ==================== LEADS ====================

  // Get all leads with filters and pagination
  getLeads: async (params = {}) => {
    return api.get('/crm/leads', { params });
  },

  // Get lead by ID
  getLead: async (id) => {
    return api.get(`/crm/leads/${id}`);
  },

  // Create new lead
  createLead: async (leadData) => {
    return api.post('/crm/leads', leadData);
  },

  // Update lead
  updateLead: async (id, leadData) => {
    return api.put(`/crm/leads/${id}`, leadData);
  },

  // Delete lead
  deleteLead: async (id) => {
    return api.delete(`/crm/leads/${id}`);
  },

  // Add note to lead
  addLeadNote: async (id, noteData) => {
    return api.post(`/crm/leads/${id}/notes`, noteData);
  },

  // ==================== COMPANIES ====================

  // Get all companies with filters and pagination
  getCompanies: async (params = {}) => {
    return api.get('/crm/companies', { params });
  },

  // Get company by ID
  getCompany: async (id) => {
    return api.get(`/crm/companies/${id}`);
  },

  // Create new company
  createCompany: async (companyData) => {
    return api.post('/crm/companies', companyData);
  },

  // Update company
  updateCompany: async (id, companyData) => {
    return api.put(`/crm/companies/${id}`, companyData);
  },

  // Delete company
  deleteCompany: async (id) => {
    return api.delete(`/crm/companies/${id}`);
  },

  // ==================== CONTACTS ====================

  // Get all contacts with filters and pagination
  getContacts: async (params = {}) => {
    return api.get('/crm/contacts', { params });
  },

  // Get contact by ID
  getContact: async (id) => {
    return api.get(`/crm/contacts/${id}`);
  },

  // Create new contact
  createContact: async (contactData) => {
    return api.post('/crm/contacts', contactData);
  },

  // Update contact
  updateContact: async (id, contactData) => {
    return api.put(`/crm/contacts/${id}`, contactData);
  },

  // Delete contact
  deleteContact: async (id) => {
    return api.delete(`/crm/contacts/${id}`);
  },

  // ==================== OPPORTUNITIES ====================

  // Get all opportunities with filters and pagination
  getOpportunities: async (params = {}) => {
    return api.get('/crm/opportunities', { params });
  },

  // Get opportunity by ID
  getOpportunity: async (id) => {
    return api.get(`/crm/opportunities/${id}`);
  },

  // Create new opportunity
  createOpportunity: async (opportunityData) => {
    return api.post('/crm/opportunities', opportunityData);
  },

  // Update opportunity
  updateOpportunity: async (id, opportunityData) => {
    return api.put(`/crm/opportunities/${id}`, opportunityData);
  },

  // Delete opportunity
  deleteOpportunity: async (id) => {
    return api.delete(`/crm/opportunities/${id}`);
  },

  // Add activity to opportunity
  addOpportunityActivity: async (id, activityData) => {
    return api.post(`/crm/opportunities/${id}/activities`, activityData);
  },

  // ==================== USERS ====================

  // Get users for assignment dropdowns
  getUsers: async () => {
    return api.get('/crm/users');
  },

  // ==================== UTILITY FUNCTIONS ====================

  // Format currency
  formatCurrency: (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  // Format date
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  // Format date and time
  formatDateTime: (date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Get status color
  getStatusColor: (status) => {
    const colors = {
      // Lead status colors
      'New': '#2196F3',
      'Contacted': '#FF9800',
      'Qualified': '#4CAF50',
      'Proposal Sent': '#9C27B0',
      'Negotiation': '#FF5722',
      'Won': '#4CAF50',
      'Lost': '#F44336',
      'Unqualified': '#9E9E9E',

      // Company status colors
      'Active': '#4CAF50',
      'Inactive': '#9E9E9E',
      'Lead': '#2196F3',
      'Prospect': '#FF9800',
      'Customer': '#4CAF50',
      'Former Customer': '#F44336',

      // Contact status colors (different from company)
      'Contact_Active': '#4CAF50',
      'Contact_Inactive': '#9E9E9E',
      'Contact_Lead': '#2196F3',
      'Contact_Prospect': '#FF9800',

      // Opportunity stage colors
      'Prospecting': '#2196F3',
      'Qualification': '#FF9800',
      'Proposal': '#9C27B0',
      'Closed Won': '#4CAF50',
      'Closed Lost': '#F44336'
    };
    return colors[status] || '#9E9E9E';
  },

  // Get priority color
  getPriorityColor: (priority) => {
    const colors = {
      'Low': '#4CAF50',
      'Medium': '#FF9800',
      'High': '#FF5722',
      'Urgent': '#F44336'
    };
    return colors[priority] || '#9E9E9E';
  },

  // Get score color
  getScoreColor: (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    if (score >= 40) return '#FF5722';
    return '#F44336';
  },

  // Calculate lead score
  calculateLeadScore: (lead) => {
    let score = 0;
    
    // Company size score
    const companySizeScores = {
      '1-10': 10,
      '11-50': 20,
      '51-200': 30,
      '201-500': 40,
      '501-1000': 50,
      '1000+': 60
    };
    score += companySizeScores[lead.companySize] || 0;
    
    // Annual revenue score
    const revenueScores = {
      'Less than $1M': 10,
      '$1M - $10M': 20,
      '$10M - $50M': 30,
      '$50M - $100M': 40,
      '$100M+': 50
    };
    score += revenueScores[lead.annualRevenue] || 0;
    
    // Priority score
    const priorityScores = {
      'Low': 5,
      'Medium': 10,
      'High': 20,
      'Urgent': 30
    };
    score += priorityScores[lead.priority] || 0;
    
    // Contact count score
    score += Math.min(lead.contactCount * 5, 20);
    
    return Math.min(score, 100);
  },

  // Get probability percentage
  getProbabilityPercentage: (stage) => {
    const probabilities = {
      'Prospecting': 10,
      'Qualification': 25,
      'Proposal': 50,
      'Negotiation': 75,
      'Closed Won': 100,
      'Closed Lost': 0
    };
    return probabilities[stage] || 0;
  },

  // Validate email
  validateEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Validate phone
  validatePhone: (phone) => {
    const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone);
  },

  // Validate website URL
  validateWebsite: (website) => {
    const urlRegex = /^https?:\/\/.+/;
    return urlRegex.test(website);
  },

  // Generate initials from name
  getInitials: (firstName, lastName) => {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return first + last;
  },

  // Truncate text
  truncateText: (text, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  },

  // Get time ago
  getTimeAgo: (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffInSeconds / 31536000)}y ago`;
  },

  // Export data to CSV
  exportToCSV: (data, filename) => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export default crmService; 