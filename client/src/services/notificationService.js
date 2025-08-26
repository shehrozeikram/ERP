import api from './api';

class NotificationService {
  /**
   * Get notifications for the current user
   */
  static async getNotifications(options = {}) {
    try {
      const response = await api.get('/notifications', { params: options });
      return response.data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount() {
    try {
      const response = await api.get('/notifications/unread-count');
      return response.data.data?.unreadCount || 0;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notifications as read (optimized batch operation)
   */
  static async markAsRead(notificationIds) {
    try {
      const response = await api.put('/notifications/mark-read', {
        notificationIds: Array.isArray(notificationIds) ? notificationIds : [notificationIds]
      });
      return response.data;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  /**
   * Mark notification as archived
   */
  static async markAsArchived(notificationId) {
    try {
      const response = await api.post(`/notifications/${notificationId}/archive`);
      return response.data;
    } catch (error) {
      console.error('Error archiving notification:', error);
      throw error;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  static async markAllAsRead() {
    try {
      const response = await api.post('/notifications/read-all');
      return response.data;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Archive all read notifications
   */
  static async archiveAllRead() {
    try {
      const response = await api.post('/notifications/archive-all');
      return response.data;
    } catch (error) {
      console.error('Error archiving all read notifications:', error);
      throw error;
    }
  }

  /**
   * Delete notification (removes user from recipients)
   */
  static async deleteNotification(notificationId) {
    try {
      const response = await api.delete(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get notification by ID
   */
  static async getNotificationById(notificationId) {
    try {
      const response = await api.get(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting notification by ID:', error);
      throw error;
    }
  }

  /**
   * Get count of unread candidate hired notifications for Employee submodule badge
   */
  static async getCandidateHiredNotificationCount() {
    try {
      const response = await api.get('/notifications', { 
        params: { 
          type: 'candidate_hired',
          status: 'unread',
          limit: 1 // We only need the count, not the actual notifications
        } 
      });
      
      // Return the count of unread candidate hired notifications
      return response.data.data?.length || 0;
    } catch (error) {
      console.error('Error getting candidate hired notification count:', error);
      return 0;
    }
  }

  /**
   * Mark all candidate_hired notifications as read for the current user
   */
  static async markAllCandidateHiredAsRead() {
    try {
      const response = await api.post('/notifications/mark-candidate-hired-read');
      return response.data;
    } catch (error) {
      console.error('Error marking candidate hired notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get module-specific notification counts (NEW)
   */
  static async getModuleCounts() {
    try {
      const response = await api.get('/notifications/module-counts');
      return response.data;
    } catch (error) {
      console.error('Error fetching module counts:', error);
      return { data: {} };
    }
  }
}

export default NotificationService;
