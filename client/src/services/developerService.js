import api from './api';

const BASE = '/developer';

export const getServerStats = () => api.get(`${BASE}/server-stats`);

export const getFinancials = () => api.get(`${BASE}/financials`);

const developerService = { getServerStats, getFinancials };
export default developerService;
