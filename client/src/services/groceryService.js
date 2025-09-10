import api from './api';

const groceryService = {
  // Get all grocery items with optional filters
  getGroceries: async (params = {}) => {
    const response = await api.get('/groceries', { params });
    return response.data;
  },

  // Get low stock items
  getLowStockItems: async () => {
    const response = await api.get('/groceries/low-stock');
    return response.data;
  },

  // Get expired items
  getExpiredItems: async () => {
    const response = await api.get('/groceries/expired');
    return response.data;
  },

  // Get single grocery item
  getGrocery: async (id) => {
    const response = await api.get(`/groceries/${id}`);
    return response.data;
  },

  // Create new grocery item
  createGrocery: async (groceryData) => {
    const response = await api.post('/groceries', groceryData);
    return response.data;
  },

  // Update grocery item
  updateGrocery: async (id, groceryData) => {
    const response = await api.put(`/groceries/${id}`, groceryData);
    return response.data;
  },

  // Update stock level
  updateStock: async (id, stockData) => {
    const response = await api.put(`/groceries/${id}/stock`, stockData);
    return response.data;
  },

  // Delete grocery item
  deleteGrocery: async (id) => {
    const response = await api.delete(`/groceries/${id}`);
    return response.data;
  },

  // Supplier methods
  getSuppliers: async (params = {}) => {
    const response = await api.get('/suppliers', { params });
    return response.data;
  },

  getActiveSuppliers: async () => {
    const response = await api.get('/suppliers/active');
    return response.data;
  },

  getSupplier: async (id) => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  createSupplier: async (supplierData) => {
    const response = await api.post('/suppliers', supplierData);
    return response.data;
  },

  updateSupplier: async (id, supplierData) => {
    const response = await api.put(`/suppliers/${id}`, supplierData);
    return response.data;
  },

  deleteSupplier: async (id) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  }
};

export default groceryService;
