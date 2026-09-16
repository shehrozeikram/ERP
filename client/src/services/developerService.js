import api from './api';

const BASE = '/developer';

export const getServerStats = () => api.get(`${BASE}/server-stats`);

export const getFinancials = () => api.get(`${BASE}/financials`);

export const triggerDatabaseBackup = () => api.get(`${BASE}/backup`, { responseType: 'blob' });

const developerService = { getServerStats, getFinancials, triggerDatabaseBackup };
export default developerService;
