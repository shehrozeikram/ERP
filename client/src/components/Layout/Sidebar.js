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
  alpha,
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
  AdminPanelSettings,
  Analytics
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
  AdminPanelSettings: <AdminPanelSettings />,
  Analytics: <Analytics />
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
        height: '100vh',
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          height: '100vh',
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
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

      {/* User Info - Fixed Position */}
      <Box sx={{ 
        p: 3, 
        borderBottom: '1px solid', 
        borderColor: 'divider',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.7)})`,
          borderRadius: '0 0 8px 8px'
        }
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar 
            src={user?.profileImage}
            sx={{ 
              mr: 2.5, 
              bgcolor: 'secondary.main',
              width: 56,
              height: 56,
              border: '3px solid',
              borderColor: 'primary.main',
              boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.25)}`,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: `0 12px 35px ${alpha(theme.palette.primary.main, 0.35)}`
              }
            }}
          >
            <Person />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography 
              variant="subtitle1" 
              noWrap
              sx={{ 
                fontWeight: 'bold',
                color: 'text.primary',
                fontSize: '1rem',
                mb: 0.5
              }}
            >
              {user?.fullName || 'User'}
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'primary.main',
                fontWeight: 600,
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {user?.role || 'Employee'}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          px: 1,
          py: 0.5,
          borderRadius: 2,
          background: alpha(theme.palette.primary.main, 0.08),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
        }}>
          <Box sx={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            bgcolor: 'success.main',
            boxShadow: `0 0 8px ${alpha(theme.palette.success.main, 0.6)}`
          }} />
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: '0.75rem'
            }}
          >
            {typeof user?.department === 'object' ? user?.department?.name : user?.department || 'Department'}
          </Typography>
        </Box>
      </Box>

      {/* Navigation Menu - Scrollable */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: alpha(theme.palette.grey[300], 0.1),
        },
        '&::-webkit-scrollbar-thumb': {
          background: alpha(theme.palette.primary.main, 0.3),
          borderRadius: '3px',
          '&:hover': {
            background: alpha(theme.palette.primary.main, 0.5),
          },
        },
      }}>
        <List sx={{ pt: 1 }}>
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
      </Box>

      {/* Footer Actions - Fixed at Bottom */}
      <Box sx={{ 
        p: 2, 
        borderTop: '1px solid', 
        borderColor: 'divider',
        flexShrink: 0,
        bgcolor: 'background.paper'
      }}>
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