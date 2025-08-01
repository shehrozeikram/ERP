import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors (less aggressive)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only handle 401 errors for specific endpoints that should redirect
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      
      // Don't auto-redirect for employee operations, let components handle it
      if (url.includes('/hr/employees') || url.includes('/hr/departments') || url.includes('/hr/positions')) {
        console.log('🔐 401 error on HR endpoint, letting component handle it:', url);
        return Promise.reject(error);
      }
      
      // For other endpoints, redirect to login
      console.log('🔐 401 error, redirecting to login:', url);
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api; 