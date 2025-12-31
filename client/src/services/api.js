import axios from 'axios';

// Determine API URL based on environment
const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    // In production, use the same domain as the frontend
    return window.location.origin + '/api';
  } else {
    // In development, use localhost
    return process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  }
};

const API_URL = getApiUrl();

// Only log in development to avoid console noise in production
if (process.env.NODE_ENV !== 'production') {
console.log('🔧 API URL configured:', API_URL);
console.log('🔧 Environment:', process.env.NODE_ENV);
console.log('🔧 Origin:', window.location.origin);
}

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds timeout for large data fetches
  withCredentials: false, // Don't send cookies, we use token in header
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData, let browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Endpoints that should not trigger auto-redirect on 401
const SKIP_AUTO_REDIRECT_ENDPOINTS = [
  '/auth/me',
  '/auth/profile',
  '/hr/employees',
  '/hr/departments',
  '/hr/positions',
  '/attendance-proxy',
  '/zkbio/'
];

// Response interceptor to handle auth errors and rate limiting
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle rate limiting (429) - don't retry, just reject
    if (error.response?.status === 429) {
      // Log rate limit error in development
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⏱️ Rate limit exceeded:', error.config?.url);
      }
      // Don't retry rate limit errors - return immediately
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const shouldSkipRedirect = SKIP_AUTO_REDIRECT_ENDPOINTS.some(endpoint => url.includes(endpoint));
      
      // Don't try to refresh token for refresh endpoint or login endpoint
      const isAuthEndpoint = url.includes('/auth/refresh-token') || url.includes('/auth/login') || url.includes('/auth/register');
      
      // Try to refresh token if it's not an auth endpoint and we have a token
      if (!isAuthEndpoint && !shouldSkipRedirect && localStorage.getItem('token')) {
        // Attempt to refresh token once
        try {
          const refreshResponse = await api.post('/auth/refresh-token');
          const { token: newToken, user: updatedUser } = refreshResponse.data.data;
          
          if (newToken) {
            localStorage.setItem('token', newToken);
            
            // Retry the original request with new token
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api.request(error.config);
          }
        } catch (refreshError) {
          // Refresh failed, proceed with normal 401 handling
          if (process.env.NODE_ENV !== 'production') {
            console.log('🔐 Token refresh failed, logging out:', refreshError.message);
          }
        }
      }
      
      if (shouldSkipRedirect) {
        // Don't log for /auth/me to reduce console noise
        if (process.env.NODE_ENV !== 'production' && !url.includes('/auth/me')) {
          console.log('🔐 401 error on endpoint, letting component handle it:', url);
        }
        return Promise.reject(error);
      }
      
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        if (process.env.NODE_ENV !== 'production') {
      console.log('🔐 401 error, redirecting to login:', url);
        }
      localStorage.removeItem('token');
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api; 