import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  AccountBalance as FinanceIcon,
  ShoppingCart as ProcurementIcon,
  PointOfSale as SalesIcon,
  ContactSupport as CRMIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSIONS, MODULES } from '../../utils/permissions';

const Dashboard = () => {
  const { user } = useAuth();

  const getAccessibleModules = () => {
    if (!user?.role) return [];
    
    const userPermissions = PERMISSIONS[user.role];
    if (!userPermissions) return [];
    
    if (userPermissions.canAccessAll) {
      return Object.values(MODULES).filter(module => module.name !== 'Dashboard');
    }
    
    return userPermissions.modules
      .filter(moduleKey => moduleKey !== 'dashboard')
      .map(moduleKey => MODULES[moduleKey]);
  };

  const getModuleIcon = (iconName) => {
    const iconMap = {
      People: <PeopleIcon />,
      AccountBalance: <FinanceIcon />,
      ShoppingCart: <ProcurementIcon />,
      PointOfSale: <SalesIcon />,
      ContactSupport: <CRMIcon />,
      AdminPanelSettings: <AdminIcon />
    };
    return iconMap[iconName] || <DashboardIcon />;
  };

  const accessibleModules = getAccessibleModules();

  return (
    <Box sx={{ p: 3 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome back, {user?.firstName}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's your personalized dashboard for the SGC ERP System
        </Typography>
      </Box>

      {/* User Info Card */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              avatar={
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <PersonIcon />
                </Avatar>
              }
              title="Your Profile"
              subheader="Account Information"
            />
            <CardContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6">
                  {user?.firstName} {user?.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Employee ID: {user?.employeeId}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={user?.role?.replace('_', ' ').toUpperCase()}
                  color="primary"
                  size="small"
                />
                <Chip
                  label={typeof user?.department === 'object' ? user?.department?.name : user?.department || 'N/A'}
                  color="secondary"
                  size="small"
                />
                <Chip
                  label={user?.position}
                  variant="outlined"
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              avatar={
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <DashboardIcon />
                </Avatar>
              }
              title="Your Permissions"
              subheader="Accessible Modules"
            />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                You have access to the following modules:
              </Typography>
              <List dense>
                {accessibleModules.map((module, index) => (
                  <React.Fragment key={module.name}>
                    <ListItem>
                      <ListItemIcon>
                        {getModuleIcon(module.icon)}
                      </ListItemIcon>
                      <ListItemText
                        primary={module.name}
                        secondary={module.description}
                      />
                    </ListItem>
                    {index < accessibleModules.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Stats */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Accessible Modules
              </Typography>
              <Typography variant="h3" color="primary">
                {accessibleModules.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Modules you can access
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Your Role
              </Typography>
              <Typography variant="h5" color="secondary">
                {user?.role?.replace('_', ' ').toUpperCase()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {PERMISSIONS[user?.role]?.description || 'User role'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Department
              </Typography>
              <Typography variant="h5" color="info.main">
                {typeof user?.department === 'object' ? user?.department?.name : user?.department || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your assigned department
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Role-specific Information */}
      {user?.role === 'admin' && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            System Administration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            As an administrator, you have full access to all modules and can manage users, 
            system settings, and monitor the entire ERP system.
          </Typography>
        </Box>
      )}

      {user?.role === 'hr_manager' && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            HR Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You can manage employees, departments, attendance, payroll, and biometric integrations.
          </Typography>
        </Box>
      )}

      {user?.role === 'finance_manager' && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Financial Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You can manage accounts, transactions, and generate financial reports.
          </Typography>
        </Box>
      )}

      {user?.role === 'procurement_manager' && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Procurement Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You can manage purchase orders, vendors, and inventory.
          </Typography>
        </Box>
      )}

      {user?.role === 'sales_manager' && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Sales Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You can manage sales orders, customers, and products.
          </Typography>
        </Box>
      )}

      {user?.role === 'crm_manager' && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Customer Relationship Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You can manage leads, contacts, and opportunities.
          </Typography>
        </Box>
      )}

      {user?.role === 'employee' && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>
            Employee Access
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You have basic access to view your dashboard and profile information.
            Contact your administrator for additional permissions.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default Dashboard; 