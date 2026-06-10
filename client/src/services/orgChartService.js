import api from './api';

const orgChartService = {
  getTree: async () => {
    const res = await api.get('/hr/org-chart/tree');
    return res.data;
  },
  getNodes: async () => {
    const res = await api.get('/hr/org-chart/nodes');
    return res.data;
  },
  getCanvas: async () => {
    const res = await api.get('/hr/org-chart/canvas');
    return res.data;
  },
  updatePosition: async (id, body) => {
    const res = await api.patch(`/hr/org-chart/nodes/${id}/position`, body);
    return res.data;
  },
  autoLayout: async () => {
    const res = await api.post('/hr/org-chart/auto-layout');
    return res.data;
  },
  getMeta: async () => {
    const res = await api.get('/hr/org-chart/meta');
    return res.data;
  },
  createNode: async (body) => {
    const res = await api.post('/hr/org-chart/nodes', body);
    return res.data;
  },
  updateNode: async (id, body) => {
    const res = await api.put(`/hr/org-chart/nodes/${id}`, body);
    return res.data;
  },
  moveNode: async (id, body) => {
    const res = await api.patch(`/hr/org-chart/nodes/${id}/move`, body);
    return res.data;
  },
  reorderNode: async (id, direction) => {
    const res = await api.patch(`/hr/org-chart/nodes/${id}/reorder`, { direction });
    return res.data;
  },
  deleteNode: async (id, cascade = false) => {
    const res = await api.delete(`/hr/org-chart/nodes/${id}`, {
      params: cascade ? { cascade: 'true' } : {}
    });
    return res.data;
  },
  seed: async (force = false) => {
    const res = await api.post('/hr/org-chart/seed', { force });
    return res.data;
  }
};

export default orgChartService;
