import api from './api';

const BASE = '/developer';

export const getServerStats = () => api.get(`${BASE}/server-stats`);

export const getFinancials = () => api.get(`${BASE}/financials`);

export const getDeleteLogs = () => api.get(`${BASE}/delete-logs`);

const developerService = { getServerStats, getFinancials, getDeleteLogs };
export default developerService;
