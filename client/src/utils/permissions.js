// Role-based permissions configuration
export const PERMISSIONS = {
  // Admin has access to everything
  admin: {
    canAccessAll: true,
    modules: ['dashboard', 'hr', 'finance', 'procurement', 'sales', 'crm', 'admin'],
    description: 'Full system access'
  },
  
  // HR Manager has access to HR module
  hr_manager: {
    canAccessAll: false,
    modules: ['dashboard', 'hr'],
    description: 'HR module management'
  },
  
  // Finance Manager has access to Finance module
  finance_manager: {
    canAccessAll: false,
    modules: ['dashboard', 'finance'],
    description: 'Finance module management'
  },
  
  // Procurement Manager has access to Procurement module
  procurement_manager: {
    canAccessAll: false,
    modules: ['dashboard', 'procurement'],
    description: 'Procurement module management'
  },
  
  // Sales Manager has access to Sales module
  sales_manager: {
    canAccessAll: false,
    modules: ['dashboard', 'sales'],
    description: 'Sales module management'
  },
  
  // CRM Manager has access to CRM module
  crm_manager: {
    canAccessAll: false,
    modules: ['dashboard', 'crm'],
    description: 'CRM module management'
  },
  
  // Sales Representative has access to CRM and Sales modules
  sales_rep: {
    canAccessAll: false,
    modules: ['dashboard', 'crm', 'sales'],
    description: 'Sales and CRM access'
  },
  
  // Employee has limited access
  employee: {
    canAccessAll: false,
    modules: ['dashboard'],
    description: 'Basic access'
  }
};

// Module configurations with their routes and permissions
export const MODULES = {
  dashboard: {
    name: 'Dashboard',
    path: '/dashboard',
    icon: 'Dashboard',
    description: 'Main dashboard',
    roles: ['admin', 'hr_manager', 'finance_manager', 'procurement_manager', 'sales_manager', 'crm_manager', 'employee']
  },
  
  hr: {
    name: 'HR Module',
    path: '/hr',
    icon: 'People',
    description: 'Human Resources management',
    roles: ['admin', 'hr_manager'],
    subItems: [
      { name: 'HR Dashboard', path: '/hr' },
      { name: 'Employees', path: '/hr/employees' },
      { name: 'Departments', path: '/hr/departments' },
      { name: 'Attendance', path: '/hr/attendance' },
      { name: 'Biometric Integration', path: '/hr/biometric' },
      { name: 'Payroll', path: '/hr/payroll' }
    ]
  },
  
  finance: {
    name: 'Finance Module',
    path: '/finance',
    icon: 'AccountBalance',
    description: 'Financial management',
    roles: ['admin', 'finance_manager'],
    subItems: [
      { name: 'Finance Dashboard', path: '/finance' },
      { name: 'Accounts', path: '/finance/accounts' },
      { name: 'Transactions', path: '/finance/transactions' },
      { name: 'Reports', path: '/finance/reports' }
    ]
  },
  
  procurement: {
    name: 'Procurement Module',
    path: '/procurement',
    icon: 'ShoppingCart',
    description: 'Procurement management',
    roles: ['admin', 'procurement_manager'],
    subItems: [
      { name: 'Procurement Dashboard', path: '/procurement' },
      { name: 'Purchase Orders', path: '/procurement/purchase-orders' },
      { name: 'Vendors', path: '/procurement/vendors' },
      { name: 'Inventory', path: '/procurement/inventory' }
    ]
  },
  
  sales: {
    name: 'Sales Module',
    path: '/sales',
    icon: 'PointOfSale',
    description: 'Sales management',
    roles: ['admin', 'sales_manager'],
    subItems: [
      { name: 'Sales Dashboard', path: '/sales' },
      { name: 'Sales Orders', path: '/sales/orders' },
      { name: 'Customers', path: '/sales/customers' },
      { name: 'Products', path: '/sales/products' }
    ]
  },
  
  crm: {
    name: 'CRM Module',
    path: '/crm',
    icon: 'ContactSupport',
    description: 'Customer Relationship Management',
    roles: ['admin', 'crm_manager', 'sales_rep'],
    subItems: [
      { name: 'CRM Dashboard', path: '/crm' },
      { name: 'Leads', path: '/crm/leads' },
      { name: 'Contacts', path: '/crm/contacts' },
      { name: 'Companies', path: '/crm/companies' },
      { name: 'Opportunities', path: '/crm/opportunities' },
      { name: 'Reports', path: '/crm/reports' }
    ]
  },
  
  admin: {
    name: 'Admin Module',
    path: '/admin',
    icon: 'AdminPanelSettings',
    description: 'System administration',
    roles: ['admin'],
    subItems: [
      { name: 'User Management', path: '/admin/users' }
    ]
  }
};

// Utility functions for permission checking
export const hasPermission = (userRole, moduleName) => {
  if (!userRole || !moduleName) return false;
  
  const userPermissions = PERMISSIONS[userRole];
  if (!userPermissions) return false;
  
  // Admin has access to everything
  if (userPermissions.canAccessAll) return true;
  
  // Check if user has access to the specific module
  return userPermissions.modules.includes(moduleName);
};

export const canAccessModule = (userRole, moduleName) => {
  return hasPermission(userRole, moduleName);
};

export const getAccessibleModules = (userRole) => {
  if (!userRole) return [];
  
  const userPermissions = PERMISSIONS[userRole];
  if (!userPermissions) return [];
  
  if (userPermissions.canAccessAll) {
    return Object.keys(MODULES);
  }
  
  return userPermissions.modules;
};

export const getModuleMenuItems = (userRole) => {
  const accessibleModules = getAccessibleModules(userRole);
  
  return accessibleModules.map(moduleKey => {
    const module = MODULES[moduleKey];
    return {
      text: module.name,
      icon: module.icon,
      path: module.path,
      subItems: module.subItems ? module.subItems.map(subItem => ({
        text: subItem.name,
        path: subItem.path
      })) : undefined,
      description: module.description
    };
  });
};

export const isRouteAccessible = (userRole, path) => {
  if (!userRole || !path) return false;
  
  // Dashboard is always accessible
  if (path === '/dashboard') return true;
  
  // Profile is always accessible
  if (path === '/profile') return true;
  
  // Check if the path matches any module
  for (const [moduleKey, module] of Object.entries(MODULES)) {
    if (hasPermission(userRole, moduleKey)) {
      // Check if path matches the module or its sub-items
      if (path === module.path) return true;
      if (module.subItems) {
        for (const subItem of module.subItems) {
          if (path === subItem.path) return true;
        }
      }
    }
  }
  
  return false;
}; 