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
    modules: ['hr'],
    description: 'HR module management'
  },
  
  // Finance Manager has access to Finance module
  finance_manager: {
    canAccessAll: false,
    modules: ['finance'],
    description: 'Finance module management'
  },
  
  // Procurement Manager has access to Procurement module
  procurement_manager: {
    canAccessAll: false,
    modules: ['procurement'],
    description: 'Procurement module management'
  },
  
  // Sales Manager has access to Sales and CRM modules
  sales_manager: {
    canAccessAll: false,
    modules: ['crm', 'sales'],
    description: 'Sales and CRM access'
  },
  
  // CRM Manager has access to CRM module
  crm_manager: {
    canAccessAll: false,
    modules: ['crm'],
    description: 'CRM module management'
  },
  
  // Employee has limited access
  employee: {
    canAccessAll: false,
    modules: [],
    description: 'Basic access'
  }
};

// Module configurations with their routes and permissions
export const MODULES = {
  dashboard: {
    name: 'Dashboard',
    path: '/dashboard',
    icon: 'Dashboard',
    description: 'Executive-level business intelligence dashboard',
    roles: ['admin']
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
      { name: 'Attendance Record', path: '/hr/attendance-record' },
      { name: 'Attendance Report', path: '/hr/attendance/report' },
      { name: 'Biometric Integration', path: '/hr/biometric' },
      { name: 'Payroll', path: '/hr/payroll' },
      { name: 'Loan Management', path: '/hr/loans' },
      { name: 'Final Settlement', path: '/hr/settlements' },
      { 
        name: 'Increment Management', 
        path: '/hr/increments',
        icon: 'TrendingUp',
        subItems: [
          { name: 'All Increments', path: '/hr/increments' },
          { name: 'Create Increment', path: '/hr/increments/create' },
          { name: 'Increment History', path: '/hr/increments/history' }
        ]
      },
      { 
        name: 'Leave Management', 
        path: '/hr/leaves',
        icon: 'EventNote',
        subItems: [
          { name: 'All Leaves', path: '/hr/leaves' },
          { name: 'Leave Approval', path: '/hr/leaves/approval' },
          { name: 'Leave Calendar', path: '/hr/leaves/calendar' },
          { name: 'Leave Reports', path: '/hr/leaves/reports' }
        ]
      },
      { 
        name: 'Talent Acquisition', 
        path: '/hr/talent-acquisition',
        subItems: [
          { name: 'Talent Dashboard', path: '/hr/talent-acquisition' },
          { name: 'Job Postings', path: '/hr/talent-acquisition/job-postings' },
          { name: 'Candidates', path: '/hr/talent-acquisition/candidates' },
          { name: 'Applications', path: '/hr/talent-acquisition/applications' },
          { name: 'Candidate Approvals', path: '/hr/candidate-approvals' },
          { name: 'Reports & Analytics', path: '/hr/talent-acquisition/reports' }
        ]
      },
      { 
        name: 'Learning & Development', 
        path: '/hr/learning',
        subItems: [
          { name: 'Learning Dashboard', path: '/hr/learning' },
          { name: 'Courses', path: '/hr/learning/courses' },
          { name: 'Enrollments', path: '/hr/learning/enrollments' },
          { name: 'Training Programs', path: '/hr/learning/programs' },
          { name: 'Reports & Analytics', path: '/hr/learning/reports' }
        ]
      },
      { 
        name: 'Organizational Development', 
        path: '/hr/organizational-development',
        subItems: [
          { name: 'OD Dashboard', path: '/hr/organizational-development' },
          { name: 'Organizational Chart', path: '/hr/organizational-development/org-chart' },
          { name: 'Job Analysis', path: '/hr/organizational-development/job-analysis' },
          { name: 'Succession Planning', path: '/hr/organizational-development/succession' },
          { name: 'Performance Management', path: '/hr/organizational-development/performance' },
          { name: 'Change Management', path: '/hr/organizational-development/change' },
          { name: 'Reports & Analytics', path: '/hr/organizational-development/reports' }
        ]
      },
      { name: 'FBR Tax Management', path: '/hr/fbr-tax' },
      { name: 'Reports', path: '/hr/reports' }
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
    roles: ['admin', 'crm_manager', 'sales_manager'],
    subItems: [
      { name: 'CRM Dashboard', path: '/crm' },
      { name: 'Leads', path: '/crm/leads' },
      { name: 'Contacts', path: '/crm/contacts' },
      { name: 'Campaigns', path: '/crm/campaigns' },
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
      { name: 'User Management', path: '/admin/users' },
      { name: 'Vehicle Management', path: '/admin/vehicles' },
      { name: 'Grocery Management', path: '/admin/groceries' },
      { name: 'Petty Cash Management', path: '/admin/petty-cash' },
      { name: 'Event Management', path: '/admin/events' },
      { name: 'Staff Management', path: '/admin/staff-management' },
      { name: 'Utility Bills Management', path: '/admin/utility-bills' },
      { name: 'Rental Agreements', path: '/admin/rental-agreements' },
      { name: 'Rental Management', path: '/admin/rental-management' }
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
        path: subItem.path,
        subItems: subItem.subItems ? subItem.subItems.map(subSubItem => ({
          text: subSubItem.name,
          path: subSubItem.path
        })) : undefined
      })) : undefined,
      description: module.description
    };
  });
};

export const isRouteAccessible = (userRole, path) => {
  if (!userRole || !path) return false;
  
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
      
      // Check if path starts with module path (for dynamic routes)
      if (path.startsWith(module.path + '/')) return true;
    }
  }
  
  return false;
}; 