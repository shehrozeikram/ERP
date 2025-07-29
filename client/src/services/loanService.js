import api from './api';

const LOAN_API_BASE = '/loans';

export const loanService = {
  // Get all loans with filters and pagination
  getLoans: async (params = {}) => {
    try {
      const response = await api.get(LOAN_API_BASE, { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get loan by ID
  getLoanById: async (id) => {
    try {
      const response = await api.get(`${LOAN_API_BASE}/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Create new loan application
  createLoan: async (loanData) => {
    try {
      const response = await api.post(LOAN_API_BASE, loanData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Update loan application
  updateLoan: async (id, loanData) => {
    try {
      const response = await api.put(`${LOAN_API_BASE}/${id}`, loanData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Approve loan
  approveLoan: async (id, data = {}) => {
    try {
      const response = await api.patch(`${LOAN_API_BASE}/${id}/approve`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Reject loan
  rejectLoan: async (id, rejectionReason) => {
    try {
      const response = await api.patch(`${LOAN_API_BASE}/${id}/reject`, { rejectionReason });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Disburse loan
  disburseLoan: async (id, disbursementData) => {
    try {
      const response = await api.patch(`${LOAN_API_BASE}/${id}/disburse`, disbursementData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Process loan payment
  processPayment: async (id, paymentData) => {
    try {
      const response = await api.patch(`${LOAN_API_BASE}/${id}/payment`, paymentData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Add note to loan
  addNote: async (id, content) => {
    try {
      const response = await api.post(`${LOAN_API_BASE}/${id}/notes`, { content });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get loan statistics
  getLoanStatistics: async () => {
    try {
      const response = await api.get(`${LOAN_API_BASE}/stats/overview`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get employee loans
  getEmployeeLoans: async (employeeId) => {
    try {
      const response = await api.get(`${LOAN_API_BASE}/employee/${employeeId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get loan schedule
  getLoanSchedule: async (id) => {
    try {
      const response = await api.get(`${LOAN_API_BASE}/${id}/schedule`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Delete loan (only if pending)
  deleteLoan: async (id) => {
    try {
      const response = await api.delete(`${LOAN_API_BASE}/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Calculate loan EMI
  calculateEMI: (principal, rate, time) => {
    const monthlyRate = rate / 100 / 12;
    if (monthlyRate === 0) {
      return principal / time;
    }
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, time)) / (Math.pow(1 + monthlyRate, time) - 1);
  },

  // Calculate total payable
  calculateTotalPayable: (emi, time) => {
    return emi * time;
  },

  // Format currency
  formatCurrency: (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₨0';
    }
    
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  },

  // Get loan status color
  getStatusColor: (status) => {
    const statusColors = {
      'Pending': '#ff9800',
      'Approved': '#2196f3',
      'Rejected': '#f44336',
      'Disbursed': '#4caf50',
      'Active': '#9c27b0',
      'Completed': '#4caf50',
      'Defaulted': '#f44336'
    };
    return statusColors[status] || '#757575';
  },

  // Get loan type options
  getLoanTypeOptions: () => [
    { value: 'Personal', label: 'Personal Loan' },
    { value: 'Housing', label: 'Housing Loan' },
    { value: 'Vehicle', label: 'Vehicle Loan' },
    { value: 'Education', label: 'Education Loan' },
    { value: 'Medical', label: 'Medical Loan' },
    { value: 'Emergency', label: 'Emergency Loan' },
    { value: 'Other', label: 'Other' }
  ],

  // Get disbursement method options
  getDisbursementMethodOptions: () => [
    { value: 'Bank Transfer', label: 'Bank Transfer' },
    { value: 'Cash', label: 'Cash' },
    { value: 'Check', label: 'Check' },
    { value: 'Direct Deposit', label: 'Direct Deposit' }
  ],

  // Get payment method options
  getPaymentMethodOptions: () => [
    { value: 'Salary Deduction', label: 'Salary Deduction' },
    { value: 'Direct Payment', label: 'Direct Payment' },
    { value: 'Bank Transfer', label: 'Bank Transfer' },
    { value: 'Cash', label: 'Cash' }
  ],

  // Validate loan data
  validateLoanData: (data) => {
    const errors = {};

    if (!data.employee) {
      errors.employee = 'Employee is required';
    }

    if (!data.loanType) {
      errors.loanType = 'Loan type is required';
    }

    if (!data.loanAmount || data.loanAmount < 1000) {
      errors.loanAmount = 'Loan amount must be at least 1,000 PKR';
    }

    if (!data.interestRate || data.interestRate < 0) {
      errors.interestRate = 'Interest rate must be a positive number';
    }

    if (!data.loanTerm || data.loanTerm < 1 || data.loanTerm > 120) {
      errors.loanTerm = 'Loan term must be between 1 and 120 months';
    }

    if (!data.purpose || data.purpose.trim() === '') {
      errors.purpose = 'Loan purpose is required';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};

export default loanService; 