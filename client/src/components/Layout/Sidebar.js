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
  Analytics,
  Security,
  Computer,
  LocationCity,
  Description,
  Folder
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getModuleMenuItems } from '../../utils/permissions';
import NotificationService from '../../services/notificationService';
import { useNotifications } from '../../contexts/NotificationContext';
import { getImageUrl, handleImageError } from '../../utils/imageService';

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
  Analytics: <Analytics />,
  Security: <Security />,
  Computer: <Computer />,
  LocationCity: <LocationCity />,
  Description: <Description />,
  Folder: <Folder />
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

  // Helper function to get allowed submodules from sub-role
  const getAllowedSubmodules = (subRole) => {
    if (!subRole.permissions) return [];
    return subRole.permissions.map(permission => permission.submodule);
  };

  // Helper function to map menu item paths to submodule names
  const getSubmoduleFromPath = (path) => {
    const pathToSubmoduleMap = {
      // Admin Module
      '/admin/dashboard': 'payment_settlement', // Dashboard uses payment_settlement permission
      '/admin/users': 'user_management',
      '/admin/sub-roles': 'sub_roles',
      '/admin/roles': 'sub_roles', // Role management uses same permission as sub-roles
      '/admin/vehicle-management': 'vehicle_management',
      '/admin/groceries': 'grocery_management',
      '/admin/petty-cash': 'petty_cash_management',
      '/admin/events': 'event_management',
      '/admin/staff-management': 'staff_management',
      '/admin/utility-bills': 'utility_bills_management',
      '/admin/rental-agreements': 'rental_agreements',
      '/admin/rental-management': 'rental_management',
      '/admin/payment-settlement': 'payment_settlement',
      
      // HR Module
      '/hr/employees': 'employee_management',
      '/hr/departments': 'employee_management',
      '/hr/attendance': 'attendance_management',
      '/hr/attendance-record': 'attendance_management',
      '/hr/attendance/report': 'attendance_management',
      '/hr/biometric': 'attendance_management',
      '/hr/payroll': 'payroll_management',
      '/hr/loans': 'loan_management',
      '/hr/settlements': 'settlement_management',
      '/hr/increments': 'employee_management',
      '/hr/leaves': 'leave_management',
      '/hr/talent-acquisition': 'talent_acquisition',
      '/hr/learning': 'learning_development',
      '/hr/organizational-development': 'organizational_development',
      '/hr/fbr-tax': 'fbr_tax_management',
      '/hr/evaluation-appraisal/dashboard': 'evaluation_appraisal',
      '/hr/evaluation-appraisal/documents': 'evaluation_appraisal',
      '/hr/evaluation-appraisal/authorities': 'evaluation_appraisal',
      '/hr/reports': 'reports',
      
      // General Module - Documents Tracking
      '/documents-tracking': 'document_tracking',
      '/general/indents': 'indents',
      '/general/indents/dashboard': 'indents',
      '/general/indents/create': 'indents',
      
      // Finance Module
      '/finance/accounts': 'chart_of_accounts',
      '/finance/journal-entries': 'journal_entries',
      '/finance/general-ledger': 'general_ledger',
      '/finance/accounts-receivable': 'accounts_receivable',
      '/finance/accounts-payable': 'accounts_payable',
      '/finance/banking': 'banking',
      '/finance/taj-utilities-charges': 'taj_utilities_charges',
      '/finance/taj-utilities-charges/cam-charges': 'taj_cam_charges',
      '/finance/taj-utilities-charges/electricity-bills': 'taj_electricity_bills',
      '/finance/taj-utilities-charges/rental-agreements': 'taj_rental_agreements',
      '/finance/taj-utilities-charges/rental-management': 'taj_rental_management',
      '/finance/taj-utilities-charges/taj-residents': 'taj_residents',
      '/finance/taj-utilities-charges/taj-properties': 'taj_properties',
      '/finance/taj-utilities-charges/charges-slabs': 'taj_utilities_charges',
      '/finance/taj-utilities-charges/receipts': 'taj_receipts',
      '/finance/taj-utilities-charges/invoices': 'taj_invoices',
      '/finance/reports': 'financial_reports',
      
      // Procurement Module
      '/procurement/purchase-orders': 'purchase_orders',
      '/procurement/vendors': 'vendors',
      '/procurement/inventory': 'inventory',
      '/procurement/reports': 'procurement_reports',
      
      // Sales Module
      '/sales/orders': 'sales_orders',
      '/sales/customers': 'customers',
      '/sales/products': 'products',
      '/sales/reports': 'sales_reports',
      
      // CRM Module
      '/crm/leads': 'leads',
      '/crm/contacts': 'contacts',
      '/crm/campaigns': 'campaigns',
      '/crm/companies': 'companies',
      '/crm/opportunities': 'opportunities',
      '/crm/reports': 'crm_reports',
      
      // Audit Module
      '/audit/list': 'audit_management',
      '/audit/findings': 'audit_findings',
      '/audit/corrective-actions': 'corrective_actions',
      '/audit/trail': 'audit_trail',
      '/audit/reports': 'audit_reports',
      '/audit/schedules': 'audit_schedules',
      '/audit/pre-audit': 'pre_audit',
      
      // IT Module
      '/it/assets': 'asset_management',
      '/it/software': 'software_licenses',
      '/it/network': 'network_devices',
      '/it/vendors': 'it_vendors',
      '/it/passwords': 'password_wallet',
      '/it/reports': 'it_reports',
      
      // Taj Residencia Module
      '/taj-residencia/land-acquisition': 'land_acquisition',
      '/taj-residencia/land-acquisition/land-identification': 'land_identification',
      '/taj-residencia/land-acquisition/record-verification': 'record_verification',
      '/taj-residencia/land-acquisition/khasra-mapping': 'khasra_mapping',
      '/taj-residencia/land-acquisition/demarcation': 'demarcation',
      '/taj-residencia/land-acquisition/owner-due-diligence': 'owner_due_diligence',
      '/taj-residencia/land-acquisition/negotiation-bayana': 'negotiation_bayana',
      '/taj-residencia/land-acquisition/registry': 'registry',
      '/taj-residencia/land-acquisition/mutation': 'mutation',
      '/taj-residencia/land-acquisition/society-internal-processing': 'society_internal_processing',
      '/taj-residencia/land-acquisition/gis-map-alignment': 'gis_map_alignment',
      '/taj-residencia/land-acquisition/land-conversion': 'land_conversion',
      '/taj-residencia/land-acquisition/compensation-management': 'compensation_management',
      '/taj-residencia/land-acquisition/encroachment-dispute': 'encroachment_dispute',
      '/taj-residencia/land-acquisition/reporting-framework': 'reporting_framework'
    };
    return pathToSubmoduleMap[path];
  };

  // Helper function to get module name from module path
  const getModuleNameFromPath = (path) => {
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/hr')) return 'hr';
    if (path.startsWith('/finance')) return 'finance';
    if (path.startsWith('/procurement')) return 'procurement';
    if (path.startsWith('/sales')) return 'sales';
    if (path.startsWith('/crm')) return 'crm';
    if (path.startsWith('/audit')) return 'audit';
    if (path.startsWith('/it')) return 'it';
    if (path.startsWith('/taj-residencia')) return 'taj_residencia';
    if (path.startsWith('/documents-tracking')) return 'general';
    if (path.startsWith('/general/indents')) return 'general';
    return null;
  };

  // Filter menu items based on user's sub-roles
  const getFilteredMenuItems = useCallback((userRole) => {
    const baseMenuItems = getMenuItems(userRole);
    
    // If user has sub-roles, show only items they have permissions for
    if (user?.subRoles && user.subRoles.length > 0) {
      // Get modules that user has sub-roles for
      const userSubRoleModules = new Set();
      user.subRoles.forEach(subRole => {
        if (subRole && subRole.module) {
          userSubRoleModules.add(subRole.module);
        }
      });
      
      return baseMenuItems.map(module => {
        const moduleName = getModuleNameFromPath(module.path);
        
        // If user has sub-roles, only show modules that match their sub-role modules
        // This ensures users with only HR sub-roles don't see Admin/General modules
        if (userSubRoleModules.size > 0 && !userSubRoleModules.has(moduleName)) {
          return null; // Filter out this module
        }
        
        if (module.subItems) {
          // Special handling for HR module: hr_manager should only see Evaluation & Appraisal
          // BUT only if they don't have HR sub-roles with full access
          if (module.path === '/hr' && userRole === 'hr_manager') {
            // Check if user has HR sub-role with full access (not just evaluation_appraisal)
            const hasHRSubRole = user.subRoles.some(subRole => 
              subRole && subRole.module === 'hr'
            );
            
            // If user has HR sub-role, show all HR submodules (don't filter to only Evaluation & Appraisal)
            if (hasHRSubRole) {
              // Show all subItems for HR module
              return module;
            } else {
              // No HR sub-role, apply the default filter (only Evaluation & Appraisal)
              const filteredSubItems = module.subItems.filter(subItem => {
                return subItem.path === '/hr/evaluation-appraisal/dashboard' || 
                       subItem.path?.startsWith('/hr/evaluation-appraisal');
              });
              return {
                ...module,
                subItems: filteredSubItems
              };
            }
          }
          
          // Filter submenu items based on sub-role permissions
          const allowedSubmenuItems = module.subItems.filter(submenuItem => {
            // Get the submodule name from the path
            const submoduleName = getSubmoduleFromPath(submenuItem.path);
            
            // Check if user has sub-role permission for this submenu
            const hasPermission = user.subRoles.some(subRole => {
              if (!subRole || subRole.module !== moduleName) {
                return false;
              }
              
              const allowedSubmodules = getAllowedSubmodules(subRole);
              
              // If no specific submodule mapping exists, allow if user has sub-role for this module
              if (!submoduleName) {
                return true;
              }
              
              // Check if subRole has permission for this submodule
              return allowedSubmodules.includes(submoduleName);
            });
            
            return hasPermission;
          });
          
          return {
            ...module,
            subItems: allowedSubmenuItems
          };
        }
        return module;
      }).filter(module => {
        // Remove null modules (filtered out)
        if (!module) {
          return false;
        }
        
        // Remove modules that have no allowed submenu items
        if (module.subItems) {
          return module.subItems.length > 0;
        }
        return true;
      });
    }
    
    // If user has NO sub-roles, return base menu items (main role permissions)
    // But filter HR module for hr_manager to only show Evaluation & Appraisal
    return baseMenuItems.map(module => {
      if (module.subItems && module.path === '/hr' && userRole === 'hr_manager') {
        const filteredSubItems = module.subItems.filter(subItem => {
          // Only show Evaluation & Appraisal submodule
          return subItem.path === '/hr/evaluation-appraisal/dashboard' || 
                 subItem.path?.startsWith('/hr/evaluation-appraisal');
        });
        return {
          ...module,
          subItems: filteredSubItems
        };
      }
      return module;
    });
  }, [user]);

  // Fetch candidate hired notification count for Employee submodule badge
  const fetchCandidateHiredCount = useCallback(async () => {
    if (user) {
      try {
        const count = await NotificationService.getCandidateHiredNotificationCount();
        setCandidateHiredCount(count);
      } catch (error) {
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

  const handleSubmenuToggle = (text, subItems) => {
    setOpenSubmenu(prev => {
      // If state is undefined, use isSubmenuActive to determine current state
      const currentState = prev[text] !== undefined ? prev[text] : (subItems ? isSubmenuActive(subItems) : false);
      return {
        ...prev,
        [text]: !currentState
      };
    });
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
            src={getImageUrl(user?.profileImage)}
            onError={(e) => handleImageError(e)}
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
        {getFilteredMenuItems(user?.role).map((item) => (
          <Box key={item.text}>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  if (item.subItems) {
                    handleSubmenuToggle(item.text, item.subItems);
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
                  (openSubmenu[item.text] !== undefined ? openSubmenu[item.text] : isSubmenuActive(item.subItems)) ? <ExpandLess /> : <ExpandMore />
                )}
              </ListItemButton>
            </ListItem>

            {/* Submenu */}
            {item.subItems && (
              <Collapse in={openSubmenu[item.text] !== undefined ? openSubmenu[item.text] : isSubmenuActive(item.subItems)} timeout="auto" unmountOnExit>
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
                                // Mark all candidate_hired notifications as read
                                await NotificationService.markAllCandidateHiredAsRead();
                                // Store the count that was cleared for success message
                                setLastClearedCount(countToClear);
                                // Refresh the count
                                setCandidateHiredCount(0);
                                // Show success message
                                setShowSuccessMessage(true);
                                
                                // Trigger a refresh of the top notification count
                                // This will update the header notification badge
                                window.dispatchEvent(new CustomEvent('refreshNotifications'));
                              } catch (error) {
                                // Error handling - could add user notification here if needed
                              } finally {
                                setIsMarkingRead(false);
                              }
                            }
                            
                            // Handle navigation
                            if (subItem.subItems) {
                              handleSubmenuToggle(subItem.text, subItem.subItems);
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
                        <Collapse in={openSubmenu[subItem.text] !== undefined ? openSubmenu[subItem.text] : isSubmenuActive(subItem.subItems)} timeout="auto" unmountOnExit>
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