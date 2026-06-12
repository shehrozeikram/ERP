import api from './api';

const BASE = '/taj-residencia/land-acquisition';

export const getMapStatus = () => api.get(`${BASE}/map-status`);

export default { getMapStatus };
