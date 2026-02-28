import api from './api';

const storeService = {
  // ─── Store CRUD ─────────────────────────────────────────────────────────────

  /** List all stores. Pass { hierarchy: true } to get full tree. */
  getStores: async (params = {}) => {
    const response = await api.get('/stores', { params });
    return response.data;
  },

  /** Get full hierarchy tree (main stores with their sub-stores) */
  getHierarchy: async () => {
    const response = await api.get('/stores', { params: { hierarchy: true } });
    return response.data;
  },

  /** Get sub-stores only */
  getSubStores: async (parentId) => {
    const params = { type: 'sub', activeOnly: 'true' };
    if (parentId) params.parent = parentId;
    const response = await api.get('/stores', { params });
    return response.data;
  },

  /** Get a single store by ID (includes children and flatLocations) */
  getStoreById: async (id) => {
    const response = await api.get(`/stores/${id}`);
    return response.data;
  },

  /** Get flat rack/shelf/bin location list for a specific store */
  getLocations: async (storeId) => {
    const response = await api.get(`/stores/${storeId}/locations`);
    return response.data;
  },

  /** Create a new store (main or sub) */
  createStore: async (data) => {
    const response = await api.post('/stores', data);
    return response.data;
  },

  /** Update store details */
  updateStore: async (id, data) => {
    const response = await api.put(`/stores/${id}`, data);
    return response.data;
  },

  /** Add a rack to a store */
  addRack: async (storeId, rackData) => {
    const response = await api.post(`/stores/${storeId}/racks`, rackData);
    return response.data;
  },

  /** Add a shelf to a rack */
  addShelf: async (storeId, rackId, shelfData) => {
    const response = await api.post(`/stores/${storeId}/racks/${rackId}/shelves`, shelfData);
    return response.data;
  },

  /** Add a bin to a shelf */
  addBin: async (storeId, rackId, shelfId, binData) => {
    const response = await api.post(`/stores/${storeId}/racks/${rackId}/shelves/${shelfId}/bins`, binData);
    return response.data;
  },

  /** Replace entire racks array for a store */
  updateRacks: async (storeId, racks) => {
    const response = await api.put(`/stores/${storeId}/racks`, { racks });
    return response.data;
  },

  /** Soft-delete (deactivate) a store */
  deleteStore: async (id) => {
    const response = await api.delete(`/stores/${id}`);
    return response.data;
  },

  /** Get stock summary for a store */
  getStockSummary: async (storeId) => {
    const response = await api.get(`/stores/${storeId}/stock-summary`);
    return response.data;
  },

  // ─── Barcode Lookup ─────────────────────────────────────────────────────────

  /** Look up an inventory item by scanned barcode value */
  lookupBarcode: async (barcode) => {
    const response = await api.get(`/stores/barcode/${encodeURIComponent(barcode)}`);
    return response.data;
  },

  /** Get barcode data for an inventory item (for label printing) */
  getItemBarcode: async (inventoryItemId) => {
    const response = await api.get(`/procurement/inventory/${inventoryItemId}/barcode`);
    return response.data;
  },

  // ─── Stock Balance ───────────────────────────────────────────────────────────

  /** Get project-wise stock balances for a store */
  getStockBalance: async (storeId, projectId, itemId) => {
    const params = { project: projectId };
    if (storeId) params.storeId = storeId;
    if (itemId) params.item = itemId;
    const response = await api.get('/procurement/stock-balance', { params });
    return response.data;
  }
};

export default storeService;
