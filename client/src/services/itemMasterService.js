import api from './api';

const base = '/items';

export const fetchItemCategories = () => api.get(`${base}/categories`);

export const fetchItems = (params = {}) => api.get(base, { params });

export const fetchItemMasterManageList = () => api.get(`${base}/manage-list`);

export const createItemCategory = (category, categoryPath, accountId) =>
  api.post(`${base}/categories`, { category, ...(categoryPath ? { categoryPath } : {}), ...(accountId ? { accountId } : {}) });

export const createItemMaster = (payload) => api.post(base, payload);

export const updateItemMaster = (id, payload) => api.put(`${base}/${id}`, payload);

export const deactivateItemMaster = (id) => api.delete(`${base}/${id}`);
