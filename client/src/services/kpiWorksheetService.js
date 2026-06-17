import api from './api';

const base = '/kpi/worksheets';

export const fetchMyKpiWorksheet = (params) => api.get(`${base}/me`, { params });

export const fetchKpiWorksheetHistory = () => api.get(`${base}/history/me`);

export const updateKpiWorksheet = (id, body) => api.put(`${base}/${id}`, body);

export const fetchTeamKpiWorksheets = (params) => api.get(`${base}/team`, { params });

export const fetchEmployeeKpiWorksheet = (employeeId, params) =>
  api.get(`${base}/for-employee/${employeeId}`, { params });

export const fetchKpiSubmissions = (params) => api.get(`${base}/submissions`, { params });

export const runKpiMonthlyBootstrap = (body) => api.post(`${base}/run-monthly-bootstrap`, body || {});
