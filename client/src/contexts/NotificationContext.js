import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import NotificationService from '../services/notificationService';
import { io } from 'socket.io-client';

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

const EVT_CHAT_UNREAD_CHANGED = 'sgc:chat-unread-changed';
const EVT_APP_NOTIFICATIONS_REFRESH = 'sgc:app-notifications-refresh';
const CHAT_SOUND_PREF_PREFIX = 'sgc:chat-sound-enabled:';

const isChatSoundEnabled = (userId) => {
  if (typeof window === 'undefined') return true;
  const key = `${CHAT_SOUND_PREF_PREFIX}${String(userId || '')}`;
  const saved = window.localStorage.getItem(key);
  if (saved == null) return true;
  return saved !== '0' && saved !== 'false';
};

const playIncomingChatSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();

    // Very close tri-tone-style notification (Apple-like timing/envelope).
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.008);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.62);
    master.connect(ctx.destination);

    const playTone = (freq, start, duration, type = 'sine', level = 1) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(0.62 * level, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.26 * level, start + duration * 0.35);
      env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(env);
      env.connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.01);
      return osc;
    };

    // Tri-tone contour (short-short-long) with a tiny bright layer.
    const t0 = ctx.currentTime;
    playTone(830.61, t0, 0.12, 'sine', 1); // G#5
    playTone(1046.5, t0 + 0.135, 0.12, 'sine', 0.95); // C6
    const last = playTone(1318.51, t0 + 0.27, 0.2, 'sine', 0.9); // E6

    // Subtle upper harmonics to mimic phone timbre.
    playTone(1661.22, t0 + 0.002, 0.1, 'triangle', 0.22);
    playTone(2093.0, t0 + 0.138, 0.1, 'triangle', 0.2);
    playTone(2637.02, t0 + 0.275, 0.14, 'triangle', 0.18);

    last.onended = () => ctx.close().catch(() => {});
  } catch {
    // Browser may block autoplay until user interaction.
  }
};

export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { isAuthenticated, user } = useAuth();

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

  // Chat page marks conversation + push notifications read — refresh bell counts
  React.useEffect(() => {
    if (!isAuthenticated) return undefined;
    const onRefresh = () => {
      fetchNotifications(true);
    };
    window.addEventListener('sgc:app-notifications-refresh', onRefresh);
    return () => window.removeEventListener('sgc:app-notifications-refresh', onRefresh);
  }, [isAuthenticated, fetchNotifications]);

  // Real-time socket updates for new notifications
  React.useEffect(() => {
    if (!isAuthenticated) return undefined;

    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const baseURL = process.env.NODE_ENV === 'production'
      ? window.location.origin
      : (process.env.REACT_APP_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');

    const socket = io(baseURL, {
      path: '/socket-notifications',
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    const myUserId = String(user?.id || user?._id || '');

    const onNotificationNew = (notification) => {
      if (notification && notification._id) {
        addNotification(notification);
      } else {
        fetchNotifications(true);
      }
    };

    const onChatMessage = (payload) => {
      const senderId = String(payload?.message?.sender || '');
      if (!senderId || senderId === myUserId) return;
      window.dispatchEvent(new Event(EVT_CHAT_UNREAD_CHANGED));
      window.dispatchEvent(new Event(EVT_APP_NOTIFICATIONS_REFRESH));
      if (isChatSoundEnabled(myUserId)) {
        playIncomingChatSound();
      }
    };

    const onChatConversationUpdated = () => {
      window.dispatchEvent(new Event(EVT_CHAT_UNREAD_CHANGED));
    };

    socket.on('notification:new', onNotificationNew);
    socket.on('chat:message', onChatMessage);
    socket.on('chat:conversation:updated', onChatConversationUpdated);

    return () => {
      socket.off('notification:new', onNotificationNew);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:conversation:updated', onChatConversationUpdated);
      socket.disconnect();
    };
  }, [isAuthenticated, user, addNotification, fetchNotifications]);

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
