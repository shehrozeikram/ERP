// Import centralized permissions from server config
// Note: In production, this should be shared via a common package or API endpoint

// Role Definitions (matching server config)
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  HR_MANAGER: 'hr_manager',
  FINANCE_MANAGER: 'finance_manager',
  PROCUREMENT_MANAGER: 'procurement_manager',
  SALES_MANAGER: 'sales_manager',
  CRM_MANAGER: 'crm_manager',
  AUDIT_MANAGER: 'audit_manager',
  AUDITOR: 'auditor',
  IT_MANAGER: 'it_manager',
  EMPLOYEE: 'employee'
};

// Module Definitions (matching server config)
export const MODULE_KEYS = {
  DASHBOARD: 'dashboard',
  HR: 'hr',
  FINANCE: 'finance',
  PROCUREMENT: 'procurement',
  SALES: 'sales',
  CRM: 'crm',
  AUDIT: 'audit',
  IT: 'it',
  ADMIN: 'admin'
};

// Role-based Module Access (matching server config)
export const PERMISSIONS = {
  // Super Admin has access to everything
  [ROLES.SUPER_ADMIN]: {
    canAccessAll: true,
    modules: Object.values(MODULE_KEYS),
    description: 'Full system access'
  },
  
  // Admin has access to admin module only
  [ROLES.ADMIN]: {
    canAccessAll: false,
    modules: [MODULE_KEYS.ADMIN],
    description: 'Admin module access only'
  },
  
  // HR Manager has access to HR module and admin events
  [ROLES.HR_MANAGER]: {
    canAccessAll: false,
    modules: [MODULE_KEYS.HR, MODULE_KEYS.ADMIN],
    description: 'HR module management and event management'
  },
  
  // Finance Manager has access to Finance module
  [ROLES.FINANCE_MANAGER]: {
    canAccessAll: false,
    modules: [MODULE_KEYS.FINANCE],
    description: 'Finance module management'
  },
  
  // Procurement Manager has access to Procurement module
  [ROLES.PROCUREMENT_MANAGER]: {
    canAccessAll: false,
    modules: [MODULE_KEYS.PROCUREMENT],
    description: 'Procurement module management'
  },
  
  // Sales Manager has access to Sales and CRM modules
  [ROLES.SALES_MANAGER]: {
    canAccessAll: false,
    modules: [MODULE_KEYS.CRM, MODULE_KEYS.SALES],
    description: 'Sales and CRM access'
  },
  
  // CRM Manager has access to CRM module
  [ROLES.CRM_MANAGER]: {
    canAccessAll: false,
    modules: [MODULE_KEYS.CRM],
    description: 'CRM module management'
  },
  
  // Audit Manager has access to Audit module
  [ROLES.AUDIT_MANAGER]: {
    canAccessAll: false,
    modules: [MODULE_KEYS.AUDIT],
    description: 'Audit module management'
  },
  
  // Auditor has limited access to Audit module
  [ROLES.AUDITOR]: {
    canAccessAll: false,
    modules: [MODULE_KEYS.AUDIT],
    description: 'Audit execution and reporting'
  },
  
  // IT Manager has access to IT module
  [ROLES.IT_MANAGER]: {
    canAccessAll: false,
    modules: [MODULE_KEYS.IT],
    description: 'IT module management'
  },
  
  // Employee has limited access
  [ROLES.EMPLOYEE]: {
    canAccessAll: false,
    modules: [],
    description: 'Basic access'
  }
};

// Helper Functions
export const hasModuleAccess = (userRole, module) => {
  const roleAccess = PERMISSIONS[userRole];
  if (!roleAccess) return false;
  
  if (roleAccess.canAccessAll) return true;
  return roleAccess.modules.includes(module);
};

export const getUserModules = (userRole) => {
  const roleAccess = PERMISSIONS[userRole];
  if (!roleAccess) return [];
  
  if (roleAccess.canAccessAll) {
    return Object.values(MODULE_KEYS);
  }
  
  return roleAccess.modules;
};

// Submodule Definitions (matching server config)
export const SUBMODULES = {
  [MODULE_KEYS.ADMIN]: [
    'user_management',
    'sub_roles',
    'vehicle_management', 
    'grocery_management',
    'petty_cash_management',
    'event_management',
    'staff_management',
    'utility_bills_management',
    'rental_agreements',
    'rental_management',
    'payment_settlement'
  ],
  [MODULE_KEYS.HR]: [
    'employee_management',
    'attendance_management',
    'payroll_management',
    'leave_management',
    'loan_management',
    'settlement_management',
    'talent_acquisition',
    'learning_development',
    'organizational_development',
    'fbr_tax_management',
    'reports'
  ],
  [MODULE_KEYS.FINANCE]: [
    'chart_of_accounts',
    'journal_entries',
    'general_ledger',
    'accounts_receivable',
    'accounts_payable',
    'banking',
    'financial_reports'
  ],
  [MODULE_KEYS.PROCUREMENT]: [
    'purchase_orders',
    'vendors',
    'inventory',
    'procurement_reports'
  ],
  [MODULE_KEYS.SALES]: [
    'sales_orders',
    'customers',
    'products',
    'sales_reports'
  ],
  [MODULE_KEYS.CRM]: [
    'leads',
    'contacts',
    'campaigns',
    'companies',
    'opportunities',
    'crm_reports'
  ],
  [MODULE_KEYS.AUDIT]: [
    'audit_management',
    'audit_findings',
    'corrective_actions',
    'audit_trail',
    'audit_reports',
    'audit_schedules'
  ],
  [MODULE_KEYS.IT]: [
    'asset_management',
    'software_licenses',
    'network_devices',
    'it_vendors',
    'password_wallet',
    'it_reports'
  ]
};

// Sub-role Helper Functions
export const getUserSubRoles = async () => {
  try {
    const response = await fetch('/api/user-sub-roles/user/me', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.data.userSubRoles || [];
  } catch (error) {
    console.error('Error fetching user sub-roles:', error);
    return [];
  }
};

export const getUserAllowedSubmodules = async (module) => {
  try {
    const userSubRoles = await getUserSubRoles();
    const allowedSubmodules = new Set();
    
    userSubRoles.forEach(userSubRole => {
      const subRole = userSubRole.subRole;
      if (subRole.module === module) {
        subRole.permissions.forEach(permission => {
          allowedSubmodules.add(permission.submodule);
        });
      }
    });
    
    return Array.from(allowedSubmodules);
  } catch (error) {
    console.error('Error getting allowed submodules:', error);
    return [];
  }
};

export const hasSubRolePermission = async (module, submodule, action) => {
  try {
    const userSubRoles = await getUserSubRoles();
    
    for (const userSubRole of userSubRoles) {
      const subRole = userSubRole.subRole;
      if (subRole.module === module) {
        const permission = subRole.permissions.find(p => p.submodule === submodule);
        if (permission && permission.actions.includes(action)) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking sub-role permission:', error);
    return false;
  }
};

// Legacy compatibility - keeping old structure for existing components
export const MODULES_LEGACY = {
  dashboard: {
    routes: ['/dashboard'],
    permissions: ['view']
  },
  hr: {
    routes: ['/hr/*'],
    permissions: ['view', 'create', 'update', 'delete']
  },
  finance: {
    routes: ['/finance/*'],
    permissions: ['view', 'create', 'update', 'delete']
  },
  procurement: {
    routes: ['/procurement/*'],
    permissions: ['view', 'create', 'update', 'delete']
  },
  sales: {
    routes: ['/sales/*'],
    permissions: ['view', 'create', 'update', 'delete']
  },
  crm: {
    routes: ['/crm/*'],
    permissions: ['view', 'create', 'update', 'delete']
  },
  audit: {
    routes: ['/audit/*'],
    permissions: ['view', 'create', 'update', 'delete']
  },
  it: {
    routes: ['/it/*'],
    permissions: ['view', 'create', 'update', 'delete']
  },
  admin: {
    routes: ['/admin/*'],
    permissions: ['view', 'create', 'update', 'delete']
  }
};

// Module configurations with their routes and permissions
export const MODULES = {
  dashboard: {
    name: 'Dashboard',
    path: '/dashboard',
    icon: 'Dashboard',
    description: 'Executive-level business intelligence dashboard',
    roles: ['super_admin', 'admin']
  },
  
  hr: {
    name: 'HR Module',
    path: '/hr',
    icon: 'People',
    description: 'Human Resources management',
    roles: ['super_admin', 'admin', 'hr_manager'],
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
    description: 'Comprehensive financial management and accounting',
    roles: ['super_admin', 'admin', 'finance_manager'],
    subItems: [
      { name: 'Finance Dashboard', path: '/finance' },
      { name: 'Chart of Accounts', path: '/finance/accounts' },
      { name: 'Journal Entries', path: '/finance/journal-entries' },
      { name: 'General Ledger', path: '/finance/general-ledger' },
      { name: 'Accounts Receivable', path: '/finance/accounts-receivable' },
      { name: 'Accounts Payable', path: '/finance/accounts-payable' },
      { name: 'Banking', path: '/finance/banking' },
      { name: 'Financial Reports', path: '/finance/reports' }
    ]
  },
  
  procurement: {
    name: 'Procurement Module',
    path: '/procurement',
    icon: 'ShoppingCart',
    description: 'Procurement management',
    roles: ['super_admin', 'admin', 'procurement_manager'],
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
    roles: ['super_admin', 'admin', 'sales_manager'],
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
    roles: ['super_admin', 'admin', 'crm_manager', 'sales_manager'],
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
    roles: ['super_admin', 'admin', 'hr_manager'],
    subItems: [
      { 
        name: 'User Management', 
        path: '/admin/users',
        subItems: [
          { name: 'Users', path: '/admin/users' },
          { name: 'Roles', path: '/admin/roles' },
          { name: 'Sub-Roles', path: '/admin/sub-roles' }
        ]
      },
      { 
        name: 'Vehicle Management', 
        path: '/admin/vehicle-management',
        subItems: [
          { name: 'Dashboard', path: '/admin/vehicle-management' },
          { name: 'Vehicles', path: '/admin/vehicle-management/vehicles' },
          { name: 'Maintenance', path: '/admin/vehicle-management/maintenance' },
          { name: 'Log Book', path: '/admin/vehicle-management/logbook' },
          { name: 'Reports', path: '/admin/vehicle-management/reports' }
        ]
      },
      { name: 'Grocery Management', path: '/admin/groceries' },
      { name: 'Petty Cash Management', path: '/admin/petty-cash' },
      { name: 'Event Management', path: '/admin/events' },
      { name: 'Staff Management', path: '/admin/staff-management' },
      { name: 'Utility Bills Management', path: '/admin/utility-bills' },
      { name: 'Rental Agreements', path: '/admin/rental-agreements' },
      { name: 'Rental Management', path: '/admin/rental-management' },
      { name: 'Payment Settlement', path: '/admin/payment-settlement' }
    ]
  },
  
  audit: {
    name: 'Audit Module',
    path: '/audit',
    icon: 'Security',
    description: 'Audit and compliance management',
    roles: ['super_admin', 'audit_manager', 'auditor'],
    subItems: [
      { name: 'Audit Dashboard', path: '/audit' },
      { name: 'Audit Management', path: '/audit/list' },
      { name: 'Audit Findings', path: '/audit/findings' },
      { name: 'Corrective Actions', path: '/audit/corrective-actions' },
      { name: 'Audit Trail', path: '/audit/trail' },
      { name: 'Audit Reports', path: '/audit/reports' },
      { name: 'Audit Schedules', path: '/audit/schedules' }
    ]
  },

  it: {
    name: 'IT Module',
    path: '/it',
    icon: 'Computer',
    description: 'IT Asset and Infrastructure Management',
    roles: ['super_admin', 'admin', 'it_manager'],
    subItems: [
      { name: 'IT Dashboard', path: '/it' },
      { name: 'Asset Management', path: '/it/assets' },
      { name: 'Software & Licenses', path: '/it/software' },
      { name: 'Network Devices', path: '/it/network' },
      { name: 'IT Vendors', path: '/it/vendors' },
      { name: 'Password Wallet', path: '/it/passwords' },
      { name: 'Reports & Analytics', path: '/it/reports' }
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

export const isRouteAccessible = (userRole, path, userSubRoles = []) => {
  if (!userRole || !path) return false;
  
  // Profile is always accessible
  if (path === '/profile') return true;
  
  // Helper function to map paths to submodule names
  const getSubmoduleFromPath = (path) => {
    const pathToSubmoduleMap = {
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
      '/admin/payment-settlement': 'payment_settlement'
    };
    return pathToSubmoduleMap[path];
  };
  
  // Check if the path matches any module
  for (const [moduleKey, module] of Object.entries(MODULES)) {
    // If user has sub-roles, ONLY check sub-role permissions (ignore main role)
    if (userSubRoles && userSubRoles.length > 0) {
      // Check if user has any sub-role for this module
      const hasSubRoleForModule = userSubRoles.some(subRole => 
        subRole.module === moduleKey
      );
      
      if (hasSubRoleForModule) {
        // Check if path matches the module or its sub-items
        if (path === module.path) {
          // For module root path, allow access if user has any sub-role for this module
          return true;
        }
        
        if (module.subItems) {
          for (const subItem of module.subItems) {
            if (path === subItem.path) {
              // Get the submodule name from the path
              const submoduleName = getSubmoduleFromPath(path);
              if (!submoduleName) return false;
              
              // Check if user has sub-role permission for this specific submodule
              const hasSubRoleAccess = userSubRoles.some(subRole => {
                if (subRole.module === moduleKey && subRole.permissions) {
                  return subRole.permissions.some(permission => 
                    permission.submodule === submoduleName
                  );
                }
                return false;
              });
              return hasSubRoleAccess;
            }
          }
        }
        
        // Check if path starts with module path (for dynamic routes)
        if (path.startsWith(module.path + '/')) {
          // For dynamic routes, check if user has any sub-role permissions for this module
          return true;
        }
      }
    } else {
      // If user has NO sub-roles, check main role permissions
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
  }
  
  return false;
}; 