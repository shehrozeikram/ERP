import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Menu,
  MenuItem
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
  Info
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../../contexts/NotificationContext';

const Notifications = ({ onNotificationAction }) => {
  const { 
    getNotifications, 
    markAsRead, 
    isLoading 
  } = useNotifications();
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const notifications = getNotifications();
  const loading = isLoading();

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markAsRead([notificationId]);
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
      await markAsRead([notificationId]);
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
      await markAsRead([notificationId]);
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
