const UserActivityLog = require('../models/general/UserActivityLog');
const { getClientIP, getUserAgent } = require('../utils/requestHelpers');

// Module mapping for better readability
const MODULE_MAP = {
  // HR Module
  'hr': 'HR',
  'hr/employees': 'HR - Employees',
  'hr/departments': 'HR - Departments',
  'hr/attendance': 'HR - Attendance',
  'hr/payroll': 'HR - Payroll',
  'hr/leaves': 'HR - Leaves',
  'hr/loans': 'HR - Loans',
  'hr/settlements': 'HR - Settlements',
  'hr/increments': 'HR - Increments',
  'hr/reports': 'HR - Reports',
  'hr/arrears': 'HR - Arrears',
  'hr/evaluation-appraisal': 'HR - Evaluation',
  
  // Finance Module
  'finance': 'Finance',
  'taj-utilities': 'Taj Utilities',
  'taj-utilities/electricity': 'Taj Utilities - Electricity',
  'taj-utilities/cam-charges': 'Taj Utilities - CAM Charges',
  'taj-utilities/rental-management': 'Taj Utilities - Rental',
  'taj-utilities/properties': 'Taj Utilities - Properties',
  'taj-utilities/residents': 'Taj Utilities - Residents',
  'taj-utilities/invoices': 'Taj Utilities - Invoices',
  'taj-utilities/receipts': 'Taj Utilities - Receipts',
  'taj-utilities/charges-slabs': 'Taj Utilities - Charges Slabs',
  'taj-utilities/water-utility-slabs': 'Taj Utilities - Water Slabs',
  'taj-residencia': 'Taj Residencia',
  
  // CRM Module
  'crm': 'CRM',
  'crm/leads': 'CRM - Leads',
  'crm/contacts': 'CRM - Contacts',
  'crm/companies': 'CRM - Companies',
  'crm/campaigns': 'CRM - Campaigns',
  'crm/opportunities': 'CRM - Opportunities',
  
  // Procurement Module
  'procurement': 'Procurement',
  
  // Sales Module
  'sales': 'Sales',
  
  // IT Module
  'it': 'IT',
  'it/assets': 'IT - Assets',
  'it/software': 'IT - Software',
  'it/network': 'IT - Network',
  'it/incidents': 'IT - Incidents',
  'it/vendors': 'IT - Vendors',
  'it/contracts': 'IT - Contracts',
  'it/passwords': 'IT - Passwords',
  
  // Admin Module
  'admin': 'Admin',
  'auth/users': 'Admin - User Management',
  'auth/roles': 'Admin - Roles',
  
  // Audit Module
  'audit': 'Audit',
  'audit/findings': 'Audit - Findings',
  'audit/corrective-actions': 'Audit - Corrective Actions',
  'audit/trail': 'Audit - Trail',
  'audit/reports': 'Audit - Reports',
  'audit/schedules': 'Audit - Schedules',
  
  // General Module
  'document-tracking': 'Document Tracking',
  'indents': 'Indents',
  'tracking': 'User Tracking',
  'evaluation-documents': 'Evaluation Documents',
  
  'sub-roles': 'Admin - Sub Roles',
  'user-sub-roles': 'Admin - User Sub Roles',
  'roles': 'Admin - Roles',
  'vehicles': 'Vehicle Management',
  'groceries': 'Grocery Management',
  'petty-cash': 'Petty Cash',
  'events': 'Event Management',
  'staff-management': 'Staff Management',
  'staff-assignments': 'Staff Assignments',
  
  // Other
  'positions': 'Positions',
  'banks': 'Banks',
  'companies': 'Companies',
  'projects': 'Projects',
  'sections': 'Sections',
  'designations': 'Designations',
  'locations': 'Locations',
  'cities': 'Cities',
  'provinces': 'Provinces',
  'countries': 'Countries',
  'payslips': 'Payslips',
  'notifications': 'Notifications',
  'courses': 'Courses',
  'enrollments': 'Enrollments',
  'training-programs': 'Training Programs',
  'job-postings': 'Job Postings',
  'candidates': 'Candidates',
  'applications': 'Applications',
  'utility-bills': 'Utility Bills',
  'rental-agreements': 'Rental Agreements',
  'taj-rental-agreements': 'Taj Rental Agreements',
  'rental-management': 'Rental Management',
  'payment-settlements': 'Payment Settlements'
};

// Helper function to extract module name from endpoint
const extractModule = (endpoint) => {
  if (!endpoint || endpoint === '/' || endpoint === '') {
    return 'Dashboard';
  }
  
  // Remove leading/trailing slashes and split
  const cleanPath = endpoint.replace(/^\/api\//, '').replace(/^\//, '').replace(/\/$/, '');
  const parts = cleanPath.split('/').filter(p => p);
  
  if (parts.length === 0) return 'Dashboard';
  
  // HR-specific endpoint mappings (common HR routes that might not have /hr prefix)
  const hrEndpoints = ['employees', 'departments', 'payroll', 'attendance', 'leaves', 'loans', 'increments'];
  if (hrEndpoints.includes(parts[0])) {
    return 'HR - ' + parts[0].split('-').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
  }
  
  // Special handling for audit routes - check if it starts with 'audit'
  if (parts[0] === 'audit' && parts.length >= 2) {
    const auditSubPath = `${parts[0]}/${parts[1]}`;
    if (MODULE_MAP[auditSubPath]) {
      return MODULE_MAP[auditSubPath];
    }
    // If specific sub-route not found, return generic Audit
    return MODULE_MAP['audit'] || 'Audit';
  }
  
  // Special handling for CRM routes - check if it starts with 'crm'
  if (parts[0] === 'crm' && parts.length >= 2) {
    const crmSubPath = `${parts[0]}/${parts[1]}`;
    if (MODULE_MAP[crmSubPath]) {
      return MODULE_MAP[crmSubPath];
    }
    // If specific sub-route not found, return generic CRM
    return MODULE_MAP['crm'] || 'CRM';
  }
  
  // Special handling for IT routes - check if it starts with 'it'
  if (parts[0] === 'it' && parts.length >= 2) {
    const itSubPath = `${parts[0]}/${parts[1]}`;
    if (MODULE_MAP[itSubPath]) {
      return MODULE_MAP[itSubPath];
    }
    // If specific sub-route not found, return generic IT
    return MODULE_MAP['it'] || 'IT';
  }
  
  // Special handling for Admin routes - check for auth/users, roles, sub-roles, etc.
  if (parts[0] === 'auth' && parts.length >= 2) {
    const authSubPath = `${parts[0]}/${parts[1]}`;
    if (MODULE_MAP[authSubPath]) {
      return MODULE_MAP[authSubPath];
    }
    // If specific sub-route not found, return generic Admin
    return MODULE_MAP['admin'] || 'Admin';
  }
  
  // Check for admin-related routes
  if (['sub-roles', 'user-sub-roles', 'roles'].includes(parts[0])) {
    if (MODULE_MAP[parts[0]]) {
      return MODULE_MAP[parts[0]];
    }
    return MODULE_MAP['admin'] || 'Admin';
  }
  
  // Try to match full path first (e.g., 'taj-utilities/electricity', 'audit/findings', 'hr/employees')
  // This must come before single-part matching to catch sub-routes
  if (parts.length >= 2) {
    const twoPartPath = `${parts[0]}/${parts[1]}`;
    if (MODULE_MAP[twoPartPath]) {
      return MODULE_MAP[twoPartPath];
    }
  }
  
  // Try single part (e.g., 'hr', 'finance', 'audit')
  if (parts.length >= 1) {
    const singlePart = parts[0];
    if (MODULE_MAP[singlePart]) {
      return MODULE_MAP[singlePart];
    }
    // If not in map, format it nicely
    return singlePart.split('-').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
  }
  
  return 'Dashboard';
};

// Helper function to determine action type from HTTP method
const getActionType = (method, endpoint) => {
  const methodMap = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
  };
  
  // Special cases
  if (endpoint?.includes('/login')) return 'login';
  if (endpoint?.includes('/logout')) return 'logout';
  if (endpoint?.includes('/export')) return 'export';
  if (endpoint?.includes('/approve')) return 'approve';
  if (endpoint?.includes('/reject')) return 'reject';
  
  return methodMap[method] || 'other';
};

// Activity logging middleware
const activityLogger = async (req, res, next) => {
  // Always call next() first to not block the request
  next();
  
  // Get the full path for checking
  const checkPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
  
  // Skip logging for certain endpoints
  const skipEndpoints = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/logout',
    '/socket.io',
    '/uploads',
    '/api/tracking' // Skip tracking endpoints to avoid recursion
  ];
  
  const shouldSkip = skipEndpoints.some(endpoint => checkPath.startsWith(endpoint));
  
  if (shouldSkip) {
    return;
  }
  
  // Check if user is authenticated
  if (!req.user) {
    // This is expected for public routes, so don't log as error
    return;
  }
  
  // Capture user info and request details before async execution
  // This prevents issues with req object being modified or unavailable in async context
  const userId = req.user._id;
  const userEmail = req.user.email || '';
  const username = (req.user.firstName || '') + ' ' + (req.user.lastName || '');
  // Use originalUrl to get the full path including base path for nested routes
  // Remove query string if present
  const fullPath = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
  const path = fullPath;
  const method = req.method;
  const params = req.params || {};
  const body = req.body || {};
  const query = req.query || {};
  
  // Log activity asynchronously (don't block request)
  // Use setImmediate to ensure it runs after response is sent
  setImmediate(async () => {
    try {
      const ipAddress = getClientIP(req);
      const userAgent = getUserAgent(req);
      const module = extractModule(path);
      const actionType = getActionType(method, path);
      
      // Prepare details object (limit size to prevent large logs)
      const details = {
        method,
        endpoint: path,
        query: Object.keys(query).length > 0 ? query : null,
        body: method !== 'GET' && Object.keys(body).length > 0 ? sanitizeBody(body) : null
      };
      
      await UserActivityLog.create({
        userId,
        username,
        email: userEmail,
        actionType,
        module,
        endpoint: path,
        requestMethod: method,
        ipAddress,
        userAgent: userAgent.substring(0, 500),
        details,
        description: generateDescription(method, path, details),
        resourceId: params.id || body.id || null,
        resourceType: extractResourceType(path)
      });
    } catch (error) {
      // Silently fail to not disrupt request flow
      // Errors are logged by the error handler middleware if needed
    }
  });
};

// Helper function to sanitize body (remove sensitive data)
const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  const sanitized = { ...body };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });
  
  return sanitized;
};

// Helper function to generate description
const generateDescription = (method, endpoint, details) => {
  const action = method === 'GET' ? 'Viewed' :
                 method === 'POST' ? 'Created' :
                 method === 'PUT' || method === 'PATCH' ? 'Updated' :
                 method === 'DELETE' ? 'Deleted' : 'Accessed';
  
  const resource = extractResourceType(endpoint) || 'resource';
  return `${action} ${resource}`;
};

// Helper function to extract resource type from endpoint
const extractResourceType = (endpoint) => {
  if (!endpoint) return null;
  
  const parts = endpoint.split('/').filter(p => p && p !== 'api');
  if (parts.length > 0) {
    const resource = parts[parts.length - 1];
    // Convert to readable format
    return resource.split('-').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
  }
  return null;
};

module.exports = activityLogger;

