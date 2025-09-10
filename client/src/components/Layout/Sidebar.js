import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Avatar,
  Collapse,
  useTheme,
  useMediaQuery,
  Badge,
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Dashboard,
  People,
  AccountBalance,
  ShoppingCart,
  PointOfSale,
  ContactSupport,
  ExpandLess,
  ExpandMore,
  Person,
  Settings,
  Logout,
  AdminPanelSettings
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getModuleMenuItems } from '../../utils/permissions';
import NotificationService from '../../services/notificationService';
import { useNotifications } from '../../contexts/NotificationContext';

const drawerWidth = 280;

// Dynamic menu items based on user permissions
const getMenuItems = (userRole) => {
  return getModuleMenuItems(userRole).map(module => ({
    text: module.text,
    icon: getIconComponent(module.icon),
    path: module.path,
    subItems: module.subItems
  }));
};

// Icon mapping function
const getIconComponent = (iconName) => {
  const iconMap = {
    Dashboard: <Dashboard />,
    People: <People />,
    AccountBalance: <AccountBalance />,
    ShoppingCart: <ShoppingCart />,
    PointOfSale: <PointOfSale />,
    ContactSupport: <ContactSupport />,
    AdminPanelSettings: <AdminPanelSettings />
  };
  return iconMap[iconName] || <Dashboard />;
};



const Sidebar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { getModuleCount } = useNotifications();
  const [openSubmenu, setOpenSubmenu] = useState({});
  const [candidateHiredCount, setCandidateHiredCount] = useState(0);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastClearedCount, setLastClearedCount] = useState(0);

  // Debug: Log menu items for admin
  React.useEffect(() => {
    if (user?.role === 'admin') {
      const menuItems = getMenuItems(user.role);
      console.log('Admin menu items:', menuItems);
    }
  }, [user?.role]);

  // Fetch candidate hired notification count for Employee submodule badge
  const fetchCandidateHiredCount = useCallback(async () => {
    if (user) {
      try {
        console.log('🔄 Fetching candidate hired notification count...');
        const count = await NotificationService.getCandidateHiredNotificationCount();
        console.log(`📊 Candidate hired notification count: ${count}`);
        setCandidateHiredCount(count);
      } catch (error) {
        console.error('❌ Error fetching candidate hired notification count:', error);
        setCandidateHiredCount(0);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchCandidateHiredCount();
    
    // Set up interval to refresh count every 5 minutes (reduced from 30 seconds)
    const interval = setInterval(fetchCandidateHiredCount, 300000);
    
    return () => clearInterval(interval);
  }, [fetchCandidateHiredCount]);

  const handleSubmenuToggle = (text) => {
    setOpenSubmenu(prev => ({
      ...prev,
      [text]: !prev[text]
    }));
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile) {
      // Close drawer on mobile after navigation
    }
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isSubmenuActive = (subItems) => {
    return subItems?.some(item => isActive(item.path));
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'primary.main',
          color: 'primary.contrastText'
        }}
      >
        <Typography variant="h6" noWrap component="div">
          SGC ERP System
        </Typography>
      </Box>

      {/* User Info */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar sx={{ mr: 2, bgcolor: 'secondary.main' }}>
            <Person />
          </Avatar>
          <Box>
            <Typography variant="subtitle2" noWrap>
              {user?.fullName || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.role || 'Employee'}
            </Typography>
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary" noWrap>
          {typeof user?.department === 'object' ? user?.department?.name : user?.department || 'Department'}
        </Typography>
      </Box>

      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {getMenuItems(user?.role).map((item) => (
          <Box key={item.text}>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  if (item.subItems) {
                    handleSubmenuToggle(item.text);
                  } else {
                    handleNavigation(item.path);
                  }
                }}
                selected={isActive(item.path)}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.light',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive(item.path) ? 'primary.contrastText' : 'inherit',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
                {item.subItems && (
                  isSubmenuActive(item.subItems) ? <ExpandLess /> : <ExpandMore />
                )}
              </ListItemButton>
            </ListItem>

            {/* Submenu */}
            {item.subItems && (
              <Collapse in={openSubmenu[item.text] || isSubmenuActive(item.subItems)} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {item.subItems.map((subItem) => (
                    <Box key={subItem.path}>
                                              <ListItemButton
                          sx={{ pl: 4 }}
                          onClick={async () => {
                            // Special handling for Employees section - mark notifications as read
                            if (subItem.text === 'Employees' && candidateHiredCount > 0) {
                              try {
                                setIsMarkingRead(true);
                                const countToClear = candidateHiredCount; // Store count before clearing
                                console.log('🔄 Marking candidate hired notifications as read...');
                                // Mark all candidate_hired notifications as read
                                await NotificationService.markAllCandidateHiredAsRead();
                                // Store the count that was cleared for success message
                                setLastClearedCount(countToClear);
                                // Refresh the count
                                setCandidateHiredCount(0);
                                // Show success message
                                setShowSuccessMessage(true);
                                console.log('✅ Candidate hired notifications marked as read');
                                
                                // Trigger a refresh of the top notification count
                                // This will update the header notification badge
                                window.dispatchEvent(new CustomEvent('refreshNotifications'));
                              } catch (error) {
                                console.error('❌ Error marking notifications as read:', error);
                              } finally {
                                setIsMarkingRead(false);
                              }
                            }
                            
                            // Handle navigation
                            if (subItem.subItems) {
                              handleSubmenuToggle(subItem.text);
                            } else {
                              handleNavigation(subItem.path);
                            }
                          }}
                          selected={isActive(subItem.path)}
                        >
                        <ListItemText 
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              {subItem.text}
                              {/* Show notification badge for Employees submenu item */}
                              {subItem.text === 'Employees' && candidateHiredCount > 0 && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Tooltip title={`${candidateHiredCount} new employee(s) hired - requires onboarding`} arrow>
                                    <Badge 
                                      badgeContent={isMarkingRead ? '...' : candidateHiredCount} 
                                      color={isMarkingRead ? "default" : "error"}
                                      sx={{ 
                                        ml: 1,
                                        '& .MuiBadge-badge': {
                                          fontSize: '0.75rem',
                                          height: '20px',
                                          minWidth: '20px',
                                          borderRadius: '10px'
                                        }
                                      }}
                                    />
                                  </Tooltip>
                                </Box>
                              )}
                              
                              {/* Show module-specific notification badges */}
                              {subItem.text === 'Employees' && getModuleCount('employees') > 0 && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Tooltip title={`${getModuleCount('employees')} employee notifications`} arrow>
                                    <Badge 
                                      badgeContent={getModuleCount('employees')} 
                                      color="error"
                                      sx={{ 
                                        ml: 1,
                                        '& .MuiBadge-badge': {
                                          fontSize: '0.75rem',
                                          height: '20px',
                                          minWidth: '20px',
                                          borderRadius: '10px'
                                        }
                                      }}
                                    />
                                  </Tooltip>
                                </Box>
                              )}
                              
                              {subItem.text === 'Departments' && getModuleCount('hr') > 0 && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Tooltip title={`${getModuleCount('hr')} HR notifications`} arrow>
                                    <Badge 
                                      badgeContent={getModuleCount('hr')} 
                                      color="error"
                                      sx={{ 
                                        ml: 1,
                                        '& .MuiBadge-badge': {
                                          fontSize: '0.75rem',
                                          height: '20px',
                                          minWidth: '20px',
                                          borderRadius: '10px'
                                        }
                                      }}
                                    />
                                  </Tooltip>
                                </Box>
                              )}
                              
                              {subItem.text === 'Payroll' && getModuleCount('finance') > 0 && (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Tooltip title={`${getModuleCount('finance')} finance notifications`} arrow>
                                    <Badge 
                                      badgeContent={getModuleCount('finance')} 
                                      color="error"
                                      sx={{ 
                                        ml: 1,
                                        '& .MuiBadge-badge': {
                                          fontSize: '0.75rem',
                                          height: '20px',
                                          minWidth: '20px',
                                          borderRadius: '10px'
                                        }
                                      }}
                                    />
                                  </Tooltip>
                                </Box>
                              )}
                            </Box>
                          } 
                        />
                        {subItem.subItems && (
                          isSubmenuActive(subItem.subItems) ? <ExpandLess /> : <ExpandMore />
                        )}
                      </ListItemButton>

                      {/* Sub-submenu */}
                      {subItem.subItems && (
                        <Collapse in={openSubmenu[subItem.text] || isSubmenuActive(subItem.subItems)} timeout="auto" unmountOnExit>
                          <List component="div" disablePadding>
                            {subItem.subItems.map((subSubItem) => (
                              <ListItemButton
                                key={subSubItem.path}
                                sx={{ pl: 6 }}
                                onClick={() => handleNavigation(subSubItem.path)}
                                selected={isActive(subSubItem.path)}
                              >
                                <ListItemText primary={subSubItem.text} />
                              </ListItemButton>
                            ))}
                          </List>
                        </Collapse>
                      )}
                    </Box>
                  ))}
                </List>
              </Collapse>
            )}
          </Box>
        ))}

        
      </List>

      {/* Footer Actions */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={() => navigate('/profile')}>
              <ListItemIcon>
                <Settings />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={logout}>
              <ListItemIcon>
                <Logout />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      {/* Success Message Snackbar */}
      <Snackbar
        open={showSuccessMessage}
        autoHideDuration={3000}
        onClose={() => setShowSuccessMessage(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowSuccessMessage(false)} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          ✅ {lastClearedCount} employee notification(s) cleared! Top notification count updated.
        </Alert>
      </Snackbar>
    </Drawer>
  );
};

export default Sidebar; 