// Import centralized permissions from server config
// Note: In production, this should be shared via a common package or API endpoint

// Role Definitions (matching server config)
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  HIGHER_MANAGEMENT: 'higher_management',
  ADMIN: 'admin',
  HR_MANAGER: 'hr_manager',
  FINANCE_MANAGER: 'finance_manager',
  PROCUREMENT_MANAGER: 'procurement_manager',
  SALES_MANAGER: 'sales_manager',
  CRM_MANAGER: 'crm_manager',
  AUDIT_MANAGER: 'audit_manager',
  AUDITOR: 'auditor',
  IT_MANAGER: 'it_manager',
  TAJ_RESIDENCIA_MANAGER: 'taj_residencia_manager',
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
  TAJ_RESIDENCIA: 'taj_residencia',
  DOCUMENTS_TRACKING: 'documents_tracking',
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
  
  // Higher Management has access to all departments
  [ROLES.HIGHER_MANAGEMENT]: {
    canAccessAll: true,
    modules: Object.values(MODULE_KEYS),
    description: 'Access to all departments and modules'
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
  
  // Taj Residencia Manager has access to Taj Residencia module
  [ROLES.TAJ_RESIDENCIA_MANAGER]: {
    canAccessAll: false,
    modules: [MODULE_KEYS.TAJ_RESIDENCIA],
    description: 'Taj Residencia module management'
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
    'financial_reports',
    'taj_utilities_charges',
    'taj_cam_charges',
    'taj_electricity_bills',
    'taj_rental_agreements',
    'taj_rental_management',
    'taj_residents'
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
  ],
  [MODULE_KEYS.TAJ_RESIDENCIA]: [
    'land_acquisition',
    'land_identification',
    'record_verification',
    'khasra_mapping',
    'demarcation',
    'owner_due_diligence',
    'negotiation_bayana',
    'registry',
    'mutation',
    'society_internal_processing',
    'gis_map_alignment',
    'land_conversion',
    'compensation_management',
    'encroachment_dispute',
    'reporting_framework',
    'complains_tickets'
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
    
    // Collect all submodules the user has permissions for
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
    
    // Check if user has the specific permission in their sub-roles
    for (const userSubRole of userSubRoles) {
      const subRole = userSubRole.subRole;
      if (subRole.module === module) {
        // If no specific submodule is provided, check if user has any permission for this module
        if (!submodule) {
          return subRole.permissions && subRole.permissions.length > 0;
        }
        
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
      { 
        name: 'Evaluation & Appraisal', 
        path: '/hr/evaluation-appraisal/dashboard',
        subItems: [
          { name: 'Dashboard', path: '/hr/evaluation-appraisal/dashboard' },
          { name: 'Documents', path: '/hr/evaluation-appraisal/documents' },
          { name: 'Authorities', path: '/hr/evaluation-appraisal/authorities' }
        ]
      },
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
      {
        name: 'Taj Utilities & Charges',
        path: '/finance/taj-utilities-charges',
        subItems: [
          {
            name: 'CAM Charges',
            path: '/finance/taj-utilities-charges/cam-charges'
          },
          {
            name: 'Electricity Bills',
            path: '/finance/taj-utilities-charges/electricity-bills'
          },
          {
            name: 'Rental Agreements',
            path: '/finance/taj-utilities-charges/rental-agreements'
          },
          {
            name: 'Rental Management',
            path: '/finance/taj-utilities-charges/rental-management'
          },
          {
            name: 'Taj Residents',
            path: '/finance/taj-utilities-charges/taj-residents'
          },
          {
            name: 'Taj Properties',
            path: '/finance/taj-utilities-charges/taj-properties'
          },
          {
            name: 'Charges Slabs',
            path: '/finance/taj-utilities-charges/charges-slabs'
          },
          {
            name: 'Receipts',
            path: '/finance/taj-utilities-charges/receipts'
          }
        ]
      },
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
          { name: 'Vehicle Location', path: '/admin/vehicle-management/location' },
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
  },

  taj_residencia: {
    name: 'Taj Residencia',
    path: '/taj-residencia',
    icon: 'LocationCity',
    description: 'Taj Residencia management module',
    roles: ['super_admin', 'taj_residencia_manager'],
    subItems: [
      {
        name: 'Land Acquisition',
        path: '/taj-residencia/land-acquisition',
        subItems: [
          { name: 'Land Identification', path: '/taj-residencia/land-acquisition/land-identification' },
          { name: 'Record Verification', path: '/taj-residencia/land-acquisition/record-verification' },
          { name: 'Khasra Mapping', path: '/taj-residencia/land-acquisition/khasra-mapping' },
          { name: 'Demarcation', path: '/taj-residencia/land-acquisition/demarcation' },
          { name: 'Owner Due-Diligence', path: '/taj-residencia/land-acquisition/owner-due-diligence' },
          { name: 'Negotiation & Bayana', path: '/taj-residencia/land-acquisition/negotiation-bayana' },
          { name: 'Registry (registry deed)', path: '/taj-residencia/land-acquisition/registry' },
          { name: 'Mutation (Intiqal)', path: '/taj-residencia/land-acquisition/mutation' },
          { name: 'Society Internal Land Department Processing', path: '/taj-residencia/land-acquisition/society-internal-processing' },
          { name: 'GIS/Map Alignment', path: '/taj-residencia/land-acquisition/gis-map-alignment' },
          { name: 'Land Conversion (Kanal → Plots)', path: '/taj-residencia/land-acquisition/land-conversion' },
          { name: 'Compensation Management', path: '/taj-residencia/land-acquisition/compensation-management' },
          { name: 'Encroachment & Dispute Handling', path: '/taj-residencia/land-acquisition/encroachment-dispute' },
          { name: 'Reporting Framework', path: '/taj-residencia/land-acquisition/reporting-framework' }
        ]
      },
      {
        name: 'Complains & Tickets',
        path: '/taj-residencia/complains-tickets'
      }
    ]
  },

  documents_tracking: {
    name: 'Documents Tracking',
    path: '/documents-tracking',
    icon: 'Description',
    description: 'Document tracking and movement management',
    roles: ['super_admin', 'admin', 'hr_manager'],
    subItems: [
      { name: 'Dashboard', path: '/documents-tracking/dashboard' },
      { name: 'Documents List', path: '/documents-tracking' }
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
      subItems: module.subItems ? module.subItems.map(subItem => {
        // Filter sub-items within sub-items (e.g., Authorities in Evaluation & Appraisal)
        const filteredSubItems = subItem.subItems ? subItem.subItems.filter(subSubItem => {
          // Hide Authorities for non-super_admin users
          if (subSubItem.path === '/hr/evaluation-appraisal/authorities' && userRole !== 'super_admin') {
            return false;
          }
          return true;
        }) : undefined;
        
        return {
          text: subItem.name,
          path: subItem.path,
          subItems: filteredSubItems ? filteredSubItems.map(subSubItem => ({
            text: subSubItem.name,
            path: subSubItem.path
          })) : undefined
        };
      }) : undefined,
      description: module.description
    };
  });
};

export const isRouteAccessible = (userRole, path, userSubRoles = []) => {
  if (!userRole || !path) return false;
  
  // Profile is always accessible
  if (path === '/profile') return true;
  
  // Authorities page in Evaluation & Appraisal is only accessible to super_admin
  if (path === '/hr/evaluation-appraisal/authorities' || path.startsWith('/hr/evaluation-appraisal/authorities/')) {
    return userRole === 'super_admin';
  }
  
  // Helper function to map paths to submodule names
  const getSubmoduleFromPath = (path) => {
    const pathToSubmoduleMap = {
      // Admin Module
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
      '/hr/evaluation-appraisal': 'evaluation_appraisal',
      '/hr/evaluation-appraisal/documents': 'evaluation_appraisal',
      '/hr/evaluation-appraisal/authorities': 'evaluation_appraisal',
      '/hr/evaluation-appraisal/edit': 'evaluation_appraisal',
      '/hr/reports': 'reports',
      
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
      '/finance/taj-utilities-charges/charges-slabs': 'taj_utilities_charges',
      '/finance/taj-utilities-charges/receipts': 'taj_receipts',
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
      '/taj-residencia/land-acquisition/reporting-framework': 'reporting_framework',
      '/taj-residencia/complains-tickets': 'complains_tickets'
    };
    
    // First try exact match
    if (pathToSubmoduleMap[path]) {
      return pathToSubmoduleMap[path];
    }
    
    // Handle dynamic routes (with :id or other params)
    // Check if path starts with any mapped path
    for (const [mappedPath, submodule] of Object.entries(pathToSubmoduleMap)) {
      // Remove trailing slashes for comparison
      const normalizedPath = path.replace(/\/$/, '');
      const normalizedMappedPath = mappedPath.replace(/\/$/, '');
      
      // Check if path starts with mapped path (for dynamic routes like /edit/:id)
      if (normalizedPath.startsWith(normalizedMappedPath + '/') || normalizedPath === normalizedMappedPath) {
        return submodule;
      }
    }
    
    return null;
  };

  // Helper function to get module name from path
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
    return null;
  };
  
  // Check if the path matches any module
  for (const [moduleKey, module] of Object.entries(MODULES)) {
    // If user has sub-roles, check specific sub-role permissions
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
              const moduleName = getModuleNameFromPath(path);
              
              // If no specific submodule mapping exists, check if user has any sub-role for this module
              if (!submoduleName) {
                return userSubRoles.some(subRole => subRole.module === moduleName);
              }
              
              // Check if user has sub-role permission for this specific submodule
              const hasSubRoleAccess = userSubRoles.some(subRole => {
                if (subRole.module === moduleName && subRole.permissions) {
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