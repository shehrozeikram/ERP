import api from './api';

const centralizedStoreService = {
  getCatalog: async () => {
    const res = await api.get('/admin/centralized-store/catalog');
    return res.data;
  },
  getAll: async () => {
    const res = await api.get('/admin/centralized-store');
    return res.data;
  },
  updateStore: async (body) => {
    const res = await api.put('/admin/centralized-store', body);
    return res.data;
  },
  seedDefaults: async () => {
    const res = await api.post('/admin/centralized-store/seed-defaults');
    return res.data;
  },
  createCategory: async (body) => {
    const res = await api.post('/admin/centralized-store/categories', body);
    return res.data;
  },
  updateCategory: async (id, body) => {
    const res = await api.put(`/admin/centralized-store/categories/${id}`, body);
    return res.data;
  },
  deleteCategory: async (id) => {
    const res = await api.delete(`/admin/centralized-store/categories/${id}`);
    return res.data;
  },
  createItem: async (body) => {
    const res = await api.post('/admin/centralized-store/items', body);
    return res.data;
  },
  updateItem: async (id, body) => {
    const res = await api.put(`/admin/centralized-store/items/${id}`, body);
    return res.data;
  },
  deleteItem: async (id) => {
    const res = await api.delete(`/admin/centralized-store/items/${id}`);
    return res.data;
  }
};

export default centralizedStoreService;
