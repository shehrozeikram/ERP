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

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authService = {
  // Login user
  login: async (credentials) => {
    return api.post('/auth/login', credentials);
  },

  // Register user
  register: async (userData) => {
    return api.post('/auth/register', userData);
  },

  // Get current user profile
  getProfile: async () => {
    return api.get('/auth/me');
  },

  // Update user profile
  updateProfile: async (profileData) => {
    return api.put('/auth/profile', profileData);
  },

  // Change password
  changePassword: async (passwordData) => {
    return api.put('/auth/change-password', passwordData);
  },

  // Forgot password
  forgotPassword: async (email) => {
    return api.post('/auth/forgot-password', { email });
  },

  // Logout user
  logout: async () => {
    return api.post('/auth/logout');
  },

  // Admin: Get all users
  getUsers: async (params = {}) => {
    return api.get('/auth/users', { params });
  },

  // Admin: Get user by ID
  getUser: async (userId) => {
    return api.get(`/auth/users/${userId}`);
  },

  // Admin: Update user
  updateUser: async (userId, userData) => {
    return api.put(`/auth/users/${userId}`, userData);
  },

  // Admin: Update user role
  updateUserRole: async (userId, role) => {
    return api.patch(`/auth/users/${userId}/role`, { role });
  },

  // Admin: Update user status
  updateUserStatus: async (userId, isActive) => {
    return api.patch(`/auth/users/${userId}/status`, { isActive });
  },

  // Admin: Delete user
  deleteUser: async (userId) => {
    return api.delete(`/auth/users/${userId}`);
  }
};

export default api; 