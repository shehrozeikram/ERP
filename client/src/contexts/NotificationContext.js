import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import NotificationService from '../services/notificationService';

// Optimized notification state structure
const initialState = {
  notifications: [],
  unreadCount: 0,
  moduleCounts: {
    employees: 0,
    hr: 0,
    finance: 0,
    crm: 0,
    sales: 0,
    procurement: 0
  },
  loading: false,
  lastUpdated: null
};

// Efficient reducer with minimal state updates
const notificationReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_NOTIFICATIONS':
      return { 
        ...state, 
        notifications: action.payload.notifications,
        unreadCount: action.payload.unreadCount,
        moduleCounts: action.payload.moduleCounts,
        lastUpdated: Date.now()
      };
    
    case 'UPDATE_MODULE_COUNT':
      return {
        ...state,
        moduleCounts: {
          ...state.moduleCounts,
          [action.payload.module]: action.payload.count
        }
      };
    
    case 'DECREASE_COUNTS':
      const { notificationIds, modules } = action.payload;
      const updatedNotifications = state.notifications.filter(
        n => !notificationIds.includes(n._id)
      );
      
      // Calculate new counts
      const newUnreadCount = Math.max(0, state.unreadCount - notificationIds.length);
      const decreasedModuleCounts = { ...state.moduleCounts };
      
      modules.forEach(module => {
        if (decreasedModuleCounts[module] > 0) {
          decreasedModuleCounts[module] = Math.max(0, decreasedModuleCounts[module] - 1);
        }
      });
      
      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: newUnreadCount,
        moduleCounts: decreasedModuleCounts
      };
    
    case 'ADD_NOTIFICATION':
      const newNotification = action.payload;
      const newNotifications = [newNotification, ...state.notifications];
      const newCount = state.unreadCount + 1;
      
      // Update module count
      const module = newNotification.metadata?.module || 'other';
      const increasedModuleCounts = { ...state.moduleCounts };
      if (increasedModuleCounts[module]) {
        increasedModuleCounts[module] += 1;
      }
      
      return {
        ...state,
        notifications: newNotifications.slice(0, 50), // Keep only latest 50
        unreadCount: newCount,
        moduleCounts: increasedModuleCounts
      };
    
    case 'CLEAR_ALL':
      return { ...initialState };
    
    default:
      return state;
  }
};

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { user, isAuthenticated } = useAuth();

  // Memoized selectors for performance
  const selectors = useMemo(() => ({
    getUnreadCount: () => state.unreadCount,
    getModuleCount: (module) => state.moduleCounts[module] || 0,
    getNotifications: () => state.notifications,
    isLoading: () => state.loading,
    getLastUpdated: () => state.lastUpdated
  }), [state]);

  // Optimized fetch function with caching
  const fetchNotifications = useCallback(async (force = false) => {
    if (!isAuthenticated) return;
    
    // Cache for 30 seconds to avoid unnecessary API calls
    const now = Date.now();
    if (!force && state.lastUpdated && (now - state.lastUpdated) < 30000) {
      return;
    }

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const [notificationsRes, countsRes] = await Promise.all([
        NotificationService.getNotifications({ status: 'unread', limit: 50 }),
        NotificationService.getModuleCounts()
      ]);

      dispatch({
        type: 'SET_NOTIFICATIONS',
        payload: {
          notifications: notificationsRes.data || [],
          unreadCount: notificationsRes.pagination?.unreadCount || 0,
          moduleCounts: countsRes.data || {}
        }
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [isAuthenticated, state.lastUpdated]);

  // Fast notification marking with optimistic updates
  const markAsRead = useCallback(async (notificationIds, modules = []) => {
    if (!notificationIds.length) return;

    // Optimistic update
    dispatch({
      type: 'DECREASE_COUNTS',
      payload: { notificationIds, modules }
    });

    try {
      await NotificationService.markAsRead(notificationIds);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      // Revert optimistic update on error
      fetchNotifications(true);
    }
  }, [fetchNotifications]);

  // Fast module-specific marking
  const markModuleAsRead = useCallback(async (module) => {
    const moduleNotifications = state.notifications.filter(
      n => n.metadata?.module === module
    );
    
    if (moduleNotifications.length > 0) {
      const notificationIds = moduleNotifications.map(n => n._id);
      await markAsRead(notificationIds, [module]);
    }
  }, [state.notifications, markAsRead]);

  // Add new notification (for real-time updates)
  const addNotification = useCallback((notification) => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  // Auto-refresh every 5 minutes when authenticated (reduced from 30 seconds)
  React.useEffect(() => {
    if (!isAuthenticated) {
      clearAll();
      return;
    }

    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(), 300000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications, clearAll]);

  // Context value memoized to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    ...selectors,
    fetchNotifications,
    markAsRead,
    markModuleAsRead,
    addNotification,
    clearAll
  }), [selectors, fetchNotifications, markAsRead, markModuleAsRead, addNotification, clearAll]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
