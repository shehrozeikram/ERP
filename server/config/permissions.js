/**
 * Centralized Permissions Configuration
 * Single source of truth for all roles and permissions
 */

// Role Definitions
const ROLES = {
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

// Permission Actions
const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  VIEW: 'view',
  MANAGE: 'manage'
};

// Module Definitions
const MODULES = {
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

// Submodule Definitions for each module
const SUBMODULES = {
  [MODULES.ADMIN]: [
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
  [MODULES.HR]: [
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
  [MODULES.FINANCE]: [
    'chart_of_accounts',
    'journal_entries',
    'general_ledger',
    'accounts_receivable',
    'accounts_payable',
    'banking',
    'financial_reports'
  ],
  [MODULES.PROCUREMENT]: [
    'purchase_orders',
    'vendors',
    'inventory',
    'procurement_reports'
  ],
  [MODULES.SALES]: [
    'sales_orders',
    'customers',
    'products',
    'sales_reports'
  ],
  [MODULES.CRM]: [
    'leads',
    'contacts',
    'campaigns',
    'companies',
    'opportunities',
    'crm_reports'
  ],
  [MODULES.AUDIT]: [
    'audit_management',
    'audit_findings',
    'corrective_actions',
    'audit_trail',
    'audit_reports',
    'audit_schedules'
  ],
  [MODULES.IT]: [
    'asset_management',
    'software_licenses',
    'network_devices',
    'it_vendors',
    'password_wallet',
    'it_reports'
  ]
};

// Role-based Module Access
const ROLE_MODULE_ACCESS = {
  [ROLES.SUPER_ADMIN]: {
    canAccessAll: true,
    modules: Object.values(MODULES),
    description: 'Full system access'
  },
  
  [ROLES.ADMIN]: {
    canAccessAll: false,
    modules: [MODULES.ADMIN],
    description: 'Admin module access only'
  },
  
  [ROLES.HR_MANAGER]: {
    canAccessAll: false,
    modules: [MODULES.HR, MODULES.ADMIN],
    description: 'HR module management and event management'
  },
  
  [ROLES.FINANCE_MANAGER]: {
    canAccessAll: false,
    modules: [MODULES.FINANCE],
    description: 'Finance module management'
  },
  
  [ROLES.PROCUREMENT_MANAGER]: {
    canAccessAll: false,
    modules: [MODULES.PROCUREMENT],
    description: 'Procurement module management'
  },
  
  [ROLES.SALES_MANAGER]: {
    canAccessAll: false,
    modules: [MODULES.CRM, MODULES.SALES],
    description: 'Sales and CRM access'
  },
  
  [ROLES.CRM_MANAGER]: {
    canAccessAll: false,
    modules: [MODULES.CRM],
    description: 'CRM module management'
  },
  
  [ROLES.AUDIT_MANAGER]: {
    canAccessAll: false,
    modules: [MODULES.AUDIT],
    description: 'Audit module management'
  },
  
  [ROLES.AUDITOR]: {
    canAccessAll: false,
    modules: [MODULES.AUDIT],
    description: 'Audit execution and reporting'
  },
  
  [ROLES.IT_MANAGER]: {
    canAccessAll: false,
    modules: [MODULES.IT],
    description: 'IT module management'
  },
  
  [ROLES.EMPLOYEE]: {
    canAccessAll: false,
    modules: [],
    description: 'Basic access'
  }
};

// Specific Permission Mappings
const PERMISSION_MAPPINGS = {
  // HR Module Permissions
  'hr.employee.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.employee.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.employee.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.employee.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'hr.payroll.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.payroll.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER],
  'hr.payroll.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.payroll.approve': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  
  'hr.attendance.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.attendance.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.attendance.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  
  'hr.leave.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.EMPLOYEE],
  'hr.leave.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.leave.approve': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  
  'hr.loan.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.EMPLOYEE],
  'hr.loan.approve': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.loan.disburse': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER],
  
  'hr.settlement.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.settlement.approve': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.settlement.process': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.FINANCE_MANAGER],
  
  // Finance Module Permissions
  'finance.invoice.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE_MANAGER],
  'finance.invoice.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE_MANAGER],
  'finance.invoice.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE_MANAGER],
  'finance.invoice.approve': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE_MANAGER],
  
  'finance.payment.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE_MANAGER],
  'finance.payment.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE_MANAGER],
  'finance.payment.approve': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE_MANAGER],
  
  // Procurement Module Permissions
  'procurement.purchase.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER],
  'procurement.purchase.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER],
  'procurement.purchase.approve': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER],
  
  'procurement.supplier.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER],
  'procurement.supplier.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER],
  'procurement.supplier.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_MANAGER],
  
  // CRM Module Permissions
  'crm.lead.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CRM_MANAGER, ROLES.SALES_MANAGER],
  'crm.lead.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CRM_MANAGER, ROLES.SALES_MANAGER],
  'crm.lead.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CRM_MANAGER, ROLES.SALES_MANAGER],
  
  'crm.customer.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CRM_MANAGER, ROLES.SALES_MANAGER],
  'crm.customer.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CRM_MANAGER, ROLES.SALES_MANAGER],
  'crm.customer.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CRM_MANAGER, ROLES.SALES_MANAGER],
  
  // IT Module Permissions
  'it.assets.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.assets.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.assets.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.assets.assign': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.assets.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'it.software.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.software.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.software.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.software.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'it.network.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.network.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.network.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.network.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'it.vendors.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.vendors.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.vendors.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.vendors.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'it.passwords.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.passwords.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.passwords.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.IT_MANAGER],
  'it.passwords.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  // Admin Module Permissions
  'admin.users.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.users.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.users.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.users.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.vehicles.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.vehicles.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.vehicles.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.vehicles.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.groceries.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.groceries.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.groceries.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.groceries.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.suppliers.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.suppliers.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.suppliers.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.suppliers.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.petty_cash.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.petty_cash.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.petty_cash.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.petty_cash.approve': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.events.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'admin.events.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'admin.events.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'admin.events.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.staff_assignment.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.staff_assignment.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.staff_assignment.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.staff_assignment.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.locations.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.locations.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.locations.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.locations.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.utility.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.utility.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.utility.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.utility.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.rental.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.rental.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.rental.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.rental.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.rental_agreement.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.rental_agreement.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.rental_agreement.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.rental_agreement.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.rental_management.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.rental_management.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.rental_management.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.rental_management.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  'admin.payment_settlement.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.payment_settlement.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.payment_settlement.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.payment_settlement.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  'admin.payment_settlement.approve': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  
  // Audit Module Permissions
  'audit.schedule.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER],
  'audit.schedule.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER, ROLES.AUDITOR],
  'audit.schedule.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER],
  'audit.schedule.delete': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER],
  
  'audit.findings.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER, ROLES.AUDITOR],
  'audit.findings.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER, ROLES.AUDITOR],
  'audit.findings.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER, ROLES.AUDITOR],
  
  'audit.reports.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER, ROLES.AUDITOR],
  'audit.reports.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER, ROLES.AUDITOR],
  
  'audit.corrective_actions.create': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER],
  'audit.corrective_actions.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER, ROLES.AUDITOR],
  'audit.corrective_actions.update': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AUDIT_MANAGER],
  
  // Talent Acquisition Permissions
  'hr.talent_acquisition': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.job_postings': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.candidates': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER],
  'hr.applications': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR_MANAGER]
};

// Helper Functions
const hasPermission = (userRole, permission) => {
  // Super admin has all permissions
  if (userRole === ROLES.SUPER_ADMIN) {
    return true;
  }
  
  const allowedRoles = PERMISSION_MAPPINGS[permission];
  return allowedRoles ? allowedRoles.includes(userRole) : false;
};

const hasModuleAccess = (userRole, module) => {
  const roleAccess = ROLE_MODULE_ACCESS[userRole];
  if (!roleAccess) return false;
  
  if (roleAccess.canAccessAll) return true;
  return roleAccess.modules.includes(module);
};

// New function to check module access with Role object
const hasModuleAccessWithRole = (roleObj, module) => {
  if (!roleObj) return false;
  
  // If it's a Role object with permissions
  if (roleObj.permissions && Array.isArray(roleObj.permissions)) {
    return roleObj.permissions.some(permission => permission.module === module);
  }
  
  // Fallback to string role
  return hasModuleAccess(roleObj.name || roleObj, module);
};

const getUserPermissions = (userRole) => {
  const roleAccess = ROLE_MODULE_ACCESS[userRole];
  if (!roleAccess) return [];
  
  if (roleAccess.canAccessAll) {
    return Object.keys(PERMISSION_MAPPINGS);
  }
  
  return Object.keys(PERMISSION_MAPPINGS).filter(permission => {
    const allowedRoles = PERMISSION_MAPPINGS[permission];
    return allowedRoles ? allowedRoles.includes(userRole) : false;
  });
};

// Export all role values for validation
const ROLE_VALUES = Object.values(ROLES);

// Export all module values for validation
const MODULE_VALUES = Object.values(MODULES);

// Export all action values for validation
const ACTION_VALUES = Object.values(ACTIONS);

// Sub-role Helper Functions
const getUserSubRoles = async (userId) => {
  const UserSubRole = require('../models/UserSubRole');
  return await UserSubRole.findActiveByUser(userId);
};

const hasSubRolePermission = async (userId, module, submodule, action) => {
  const UserSubRole = require('../models/UserSubRole');
  
  // Get user's active sub-role assignments
  const userSubRoles = await UserSubRole.findActiveByUser(userId);
  
  if (!userSubRoles || userSubRoles.length === 0) return false;
  
  // Check if user has the specific permission in their sub-roles
  for (const userSubRole of userSubRoles) {
    const subRole = userSubRole.subRole;
    if (subRole && subRole.module === module && subRole.hasPermission(submodule, action)) {
      return true;
    }
  }
  
  return false;
};

const getUserAllowedSubmodules = async (userId, module) => {
  const User = require('../models/User');
  const UserSubRole = require('../models/UserSubRole');
  
  const user = await User.findById(userId);
  if (!user) return [];
  
  // Super admin has access to everything
  if (user.role === ROLES.SUPER_ADMIN) {
    return SUBMODULES[module] || [];
  }
  
  // Get user's active sub-role assignments
  const userSubRoles = await UserSubRole.findActiveByUser(userId);
  
  // If user has sub-roles, return only the submodules they have permissions for
  if (userSubRoles && userSubRoles.length > 0) {
    const allowedSubmodules = new Set();
    
    for (const userSubRole of userSubRoles) {
      const subRole = userSubRole.subRole;
      if (subRole && subRole.module === module) {
        subRole.getAllowedSubmodules().forEach(submodule => {
          allowedSubmodules.add(submodule);
        });
      }
    }
    
    return Array.from(allowedSubmodules);
  }
  
  // If user has NO sub-roles, return all submodules for their main role
  if (hasModuleAccess(user.role, module)) {
    return SUBMODULES[module] || [];
  }
  
  return [];
};

const checkSubRoleAccess = async (userId, module, submodule, action) => {
  const User = require('../models/User');
  const UserSubRole = require('../models/UserSubRole');
  
  const user = await User.findById(userId);
  if (!user) return false;
  
  // Super admin has access to everything
  if (user.role === ROLES.SUPER_ADMIN) return true;
  
  // Get user's active sub-role assignments
  const userSubRoles = await UserSubRole.findActiveByUser(userId);
  
  // If user has sub-roles, check specific sub-role permissions
  if (userSubRoles && userSubRoles.length > 0) {
    return await hasSubRolePermission(userId, module, submodule, action);
  }
  
  // If user has NO sub-roles, check if they have module access
  return hasModuleAccess(user.role, module);
};

module.exports = {
  ROLES,
  ACTIONS,
  MODULES,
  SUBMODULES,
  ROLE_MODULE_ACCESS,
  PERMISSION_MAPPINGS,
  hasPermission,
  hasModuleAccess,
  hasModuleAccessWithRole,
  getUserPermissions,
  getUserSubRoles,
  hasSubRolePermission,
  getUserAllowedSubmodules,
  checkSubRoleAccess,
  ROLE_VALUES,
  MODULE_VALUES,
  ACTION_VALUES
};
