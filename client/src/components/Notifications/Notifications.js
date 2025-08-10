import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Badge,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle,
  Archive,
  Delete,
  MoreVert,
  Person,
  Work,
  AttachMoney,
  Schedule,
  Warning,
  Info,
  Error
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import NotificationService from '../../services/notificationService';

const Notifications = ({ onNotificationAction }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await NotificationService.getNotifications({
        status: 'unread',
        limit: 10
      });
      setNotifications(response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const count = await NotificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await NotificationService.markAsRead(notificationId);
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === notificationId 
            ? { ...notif, status: 'read' }
            : notif
        )
      );
      fetchUnreadCount();
      // Notify parent component to refresh unread count
      if (onNotificationAction) {
        onNotificationAction();
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAsArchived = async (notificationId) => {
    try {
      await NotificationService.markAsArchived(notificationId);
      // Remove from local state
      setNotifications(prev => 
        prev.filter(notif => notif._id !== notificationId)
      );
      fetchUnreadCount();
      // Notify parent component to refresh unread count
      if (onNotificationAction) {
        onNotificationAction();
      }
    } catch (err) {
      console.error('Error archiving notification:', err);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await NotificationService.markAsArchived(notificationId);
      // Remove from local state
      setNotifications(prev => 
        prev.filter(notif => notif._id !== notificationId)
      );
      fetchUnreadCount();
      // Notify parent component to refresh unread count
      if (onNotificationAction) {
        onNotificationAction();
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleMenuOpen = (event, notification) => {
    setAnchorEl(event.currentTarget);
    setSelectedNotification(notification);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedNotification(null);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'candidate_hired':
        return <Person color="success" />;
      case 'employee_status_change':
        return <Work color="primary" />;
      case 'attendance_update':
        return <Schedule color="info" />;
      case 'payroll_generated':
        return <AttachMoney color="success" />;
      case 'loan_approved':
        return <AttachMoney color="warning" />;
      case 'leave_request':
        return <Schedule color="info" />;
      case 'performance_review':
        return <Work color="primary" />;
      case 'training_assigned':
        return <Work color="secondary" />;
      case 'system_alert':
        return <Warning color="error" />;
      default:
        return <Info color="default" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatNotificationTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (err) {
      return 'recently';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 1 }}>
        {error}
      </Alert>
    );
  }

  if (notifications.length === 0) {
    return (
      <Box textAlign="center" p={3}>
        <NotificationsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          No new notifications
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
        <Typography variant="h6">Notifications</Typography>
        <Button 
          size="small" 
          onClick={fetchNotifications}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>
      
      <Divider />
      
      <List sx={{ p: 0 }}>
        {notifications.map((notification, index) => (
          <React.Fragment key={notification._id}>
            <ListItem 
              sx={{ 
                py: 1.5,
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <ListItemIcon>
                {getNotificationIcon(notification.type)}
              </ListItemIcon>
              
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="subtitle2" component="span">
                      {notification.title}
                    </Typography>
                    <Chip 
                      label={notification.priority} 
                      size="small" 
                      color={getPriorityColor(notification.priority)}
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatNotificationTime(notification.createdAt)}
                    </Typography>
                  </Box>
                }
              />
              
              <ListItemSecondaryAction>
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuOpen(e, notification)}
                >
                  <MoreVert />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            
            {index < notifications.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem 
          onClick={() => {
            if (selectedNotification) {
              handleMarkAsRead(selectedNotification._id);
            }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <CheckCircle fontSize="small" />
          </ListItemIcon>
          Mark as Read
        </MenuItem>
        
        <MenuItem 
          onClick={() => {
            if (selectedNotification) {
              handleMarkAsArchived(selectedNotification._id);
            }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <Archive fontSize="small" />
          </ListItemIcon>
          Archive
        </MenuItem>
        
        <MenuItem 
          onClick={() => {
            if (selectedNotification) {
              handleDelete(selectedNotification._id);
            }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Notifications;
