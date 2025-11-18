import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

// Utility function to get the appropriate redirect path based on user role
const getRedirectPath = (userRole) => {
  switch (userRole) {
    case 'super_admin':
      return '/dashboard';
    case 'admin':
      return '/admin/staff-management';
    case 'hr_manager':
      return '/hr';
    case 'finance_manager':
      return '/finance';
    case 'procurement_manager':
      return '/procurement';
    case 'sales_manager':
      return '/sales';
    case 'crm_manager':
      return '/crm';
    case 'employee':
      return '/profile'; // Employees have limited access, redirect to profile
    default:
      return '/profile'; // Default fallback
  }
};

const AuthContext = createContext();

// Get initial token once to avoid repeated localStorage access
const getInitialToken = () => {
  try {
    return localStorage.getItem('token');
  } catch (error) {
    return null;
  }
};

const initialState = {
  user: null,
  token: getInitialToken(),
  loading: true,
  error: null
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        loading: false,
        error: null
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        loading: false,
        error: action.payload
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        loading: false,
        error: null
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const navigate = useNavigate();

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          dispatch({ type: 'SET_LOADING', payload: true });
          
          // Log in development for debugging
          if (process.env.NODE_ENV !== 'production') {
            console.log('🔐 Checking authentication with token...');
          }
          
          const response = await authService.getProfile();
          
          // The server returns: { success: true, data: { user: ... } }
          // So the structure is: response.data.data.user
          const userData = response?.data?.data?.user;
          
          if (userData) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('✅ Authentication successful');
            }
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: {
                user: userData,
                token
              }
            });
          } else {
            // Log the full response for debugging (only in dev)
            if (process.env.NODE_ENV !== 'production') {
              console.error('❌ Invalid response structure');
              console.error('   Full response:', response);
              console.error('   Response data:', response?.data);
              console.error('   Expected path: response.data.data.user');
            }
            throw new Error('Invalid user data received');
          }
        } catch (error) {
          // Handle different error types
          const isAuthError = error.response?.status === 401 || error.response?.status === 403;
          const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.code === 'NETWORK_ERROR';
          
          if (isAuthError) {
            // Token is invalid or expired - clear it
            if (process.env.NODE_ENV !== 'production') {
              console.error('❌ Auth check failed: Invalid or expired token');
            }
            localStorage.removeItem('token');
            dispatch({ type: 'LOGIN_FAILURE', payload: 'Session expired' });
          } else if (isNetworkError) {
            // Network error or timeout - keep token for retry
            if (process.env.NODE_ENV !== 'production') {
              console.warn('⚠️ Auth check failed due to network error, keeping token for retry');
              console.warn('   Error details:', error.message || error.code);
            }
            dispatch({ type: 'SET_LOADING', payload: false });
          } else {
            // Other errors - treat as auth failure
            if (process.env.NODE_ENV !== 'production') {
              console.error('❌ Unexpected auth check error:', error);
              console.error('   Status:', error.response?.status);
              console.error('   Message:', error.message);
            }
            localStorage.removeItem('token');
            dispatch({ type: 'LOGIN_FAILURE', payload: 'Authentication check failed' });
          }
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log('ℹ️ No token found, user not authenticated');
        }
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      dispatch({ type: 'LOGIN_START' });
      const response = await authService.login(credentials);
      
      const { user, token } = response.data.data;
      
      localStorage.setItem('token', token);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user, token }
      });

      toast.success('Login successful!');
      navigate(getRedirectPath(user.role));
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      toast.error(message);
      return { success: false, error: message };
    }
  }, [navigate]);

  const register = useCallback(async (userData) => {
    try {
      dispatch({ type: 'LOGIN_START' });
      const response = await authService.register(userData);
      
      const { user, token } = response.data.data;
      
      localStorage.setItem('token', token);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user, token }
      });

      toast.success('Registration successful!');
      navigate(getRedirectPath(user.role));
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      toast.error(message);
      return { success: false, error: message };
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Logout error:', error);
      }
    } finally {
      localStorage.removeItem('token');
      dispatch({ type: 'LOGOUT' });
      toast.success('Logged out successfully');
      navigate('/login');
    }
  }, [navigate]);

  const updateProfile = useCallback(async (profileData) => {
    try {
      const response = await authService.updateProfile(profileData);
      dispatch({
        type: 'UPDATE_USER',
        payload: response.data.data.user
      });
      toast.success('Profile updated successfully');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed';
      toast.error(message);
      return { success: false, error: message };
    }
  }, []);

  const changePassword = useCallback(async (passwordData) => {
    try {
      await authService.changePassword(passwordData);
      toast.success('Password changed successfully');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed';
      toast.error(message);
      return { success: false, error: message };
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user: state.user,
    token: state.token,
    loading: state.loading,
    error: state.error,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    isAuthenticated: !!state.user && !!state.token
  }), [state.user, state.token, state.loading, state.error, login, register, logout, updateProfile, changePassword]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 