import React, { useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Avatar,
  Collapse,
  useTheme,
  useMediaQuery
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
  const [openSubmenu, setOpenSubmenu] = useState({});

  // Debug: Log menu items for admin
  React.useEffect(() => {
    if (user?.role === 'admin') {
      const menuItems = getMenuItems(user.role);
      console.log('Admin menu items:', menuItems);
    }
  }, [user?.role]);

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
                        onClick={() => {
                          if (subItem.subItems) {
                            handleSubmenuToggle(subItem.text);
                          } else {
                            handleNavigation(subItem.path);
                          }
                        }}
                        selected={isActive(subItem.path)}
                      >
                        <ListItemText primary={subItem.text} />
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
    </Drawer>
  );
};

export default Sidebar; 