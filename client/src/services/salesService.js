import api from './api';

const salesService = {
  // Dashboard & reports
  getDashboard: (params = {}) => api.get('/sales/dashboard', { params }),
  getReports: (params = {}) => api.get('/sales/reports', { params }),

  // Orders
  getOrders: (params = {}) => api.get('/sales/orders', { params }),
  getOrder: (orderId) => api.get(`/sales/orders/${orderId}`),
  createOrder: (data) => api.post('/sales/orders', data),
  updateOrder: (orderId, data) => api.put(`/sales/orders/${orderId}`, data),
  updateOrderStatus: (orderId, data) => api.patch(`/sales/orders/${orderId}/status`, data),
  deleteOrder: (orderId) => api.delete(`/sales/orders/${orderId}`),

  // Customers
  getCustomers: (params = {}) => api.get('/sales/customers', { params }),
  getCustomer: (customerId) => api.get(`/sales/customers/${customerId}`),
  createCustomer: (data) => api.post('/sales/customers', data),
  updateCustomer: (customerId, data) => api.put(`/sales/customers/${customerId}`, data),
  deleteCustomer: (customerId) => api.delete(`/sales/customers/${customerId}`),

  // Products
  getProducts: (params = {}) => api.get('/sales/products', { params }),
  createProduct: (data) => api.post('/sales/products', data),
  updateProduct: (productId, data) => api.put(`/sales/products/${productId}`, data),
  deleteProduct: (productId) => api.delete(`/sales/products/${productId}`)
};

export default salesService;

