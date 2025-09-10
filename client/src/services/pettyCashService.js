import api from './api';

const pettyCashService = {
  // Fund methods
  getFunds: async (params = {}) => {
    const response = await api.get('/petty-cash/funds', { params });
    return response.data;
  },

  getFund: async (id) => {
    const response = await api.get(`/petty-cash/funds/${id}`);
    return response.data;
  },

  createFund: async (fundData) => {
    const response = await api.post('/petty-cash/funds', fundData);
    return response.data;
  },

  updateFund: async (id, fundData) => {
    const response = await api.put(`/petty-cash/funds/${id}`, fundData);
    return response.data;
  },

  updateFundBalance: async (id, balanceData) => {
    const response = await api.put(`/petty-cash/funds/${id}/balance`, balanceData);
    return response.data;
  },

  deleteFund: async (id) => {
    const response = await api.delete(`/petty-cash/funds/${id}`);
    return response.data;
  },

  // Expense methods
  getExpenses: async (params = {}) => {
    const response = await api.get('/petty-cash/expenses', { params });
    return response.data;
  },

  getPendingExpenses: async () => {
    const response = await api.get('/petty-cash/expenses/pending');
    return response.data;
  },

  getExpense: async (id) => {
    const response = await api.get(`/petty-cash/expenses/${id}`);
    return response.data;
  },

  createExpense: async (expenseData) => {
    const response = await api.post('/petty-cash/expenses', expenseData);
    return response.data;
  },

  updateExpense: async (id, expenseData) => {
    const response = await api.put(`/petty-cash/expenses/${id}`, expenseData);
    return response.data;
  },

  approveExpense: async (id, approvalData) => {
    const response = await api.put(`/petty-cash/expenses/${id}/approve`, approvalData);
    return response.data;
  },

  deleteExpense: async (id) => {
    const response = await api.delete(`/petty-cash/expenses/${id}`);
    return response.data;
  }
};

export default pettyCashService;
