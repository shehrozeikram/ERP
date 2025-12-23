import api from './api';

export const fetchLoginHistory = async (params = {}) => {
  const response = await api.get('/tracking/logins', { params });
  return response;
};

export const fetchActivityHistory = async (params = {}) => {
  const response = await api.get('/tracking/activities', { params });
  return response;
};

export const fetchActiveSessions = async () => {
  const response = await api.get('/tracking/sessions');
  return response;
};

export const fetchTrackingStats = async (params = {}) => {
  const response = await api.get('/tracking/stats', { params });
  return response;
};

export const fetchUserTracking = async (userId, params = {}) => {
  const response = await api.get(`/tracking/user/${userId}`, { params });
  return response;
};

