const AuditTrail = require('../models/audit/AuditTrail');

/**
 * Audit Trail Middleware
 * Automatically logs user activities across the application
 */

// Middleware to log all requests
const logRequest = (req, res, next) => {
  // Skip logging for certain paths
  const skipPaths = [
    '/api/audit/trail',
    '/api/health',
    '/api/ping',
    '/socket.io/',
    '/api/chat'
  ];

  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Store original methods
  const originalSend = res.send;
  const originalJson = res.json;

  // Track response
  let responseBody = null;
  let responseStatus = null;

  // Override res.send to capture response
  res.send = function(body) {
    responseBody = body;
    responseStatus = res.statusCode;
    return originalSend.call(this, body);
  };

  // Override res.json to capture response
  res.json = function(body) {
    responseBody = body;
    responseStatus = res.statusCode;
    return originalJson.call(this, body);
  };

  // Log after response is sent
  res.on('finish', async () => {
    try {
      await logActivity(req, res, responseBody, responseStatus);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  });

  next();
};

const MAX_REQUEST_BODY_CHARS = 4000;

const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== 'object') return undefined;

  let sanitized;
  try {
    sanitized = JSON.parse(JSON.stringify(body));
  } catch {
    return undefined;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'pin', 'otp', 'authorization'];
  const redact = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(redact);
      return;
    }
    Object.keys(obj).forEach((field) => {
      const lower = field.toLowerCase();
      if (sensitiveFields.some((s) => lower.includes(s))) {
        obj[field] = '[REDACTED]';
      } else if (obj[field] && typeof obj[field] === 'object') {
        redact(obj[field]);
      }
    });
  };
  redact(sanitized);

  const serialized = JSON.stringify(sanitized);
  if (serialized.length <= MAX_REQUEST_BODY_CHARS) return sanitized;

  return {
    _truncated: true,
    preview: serialized.slice(0, MAX_REQUEST_BODY_CHARS),
    originalLength: serialized.length
  };
};

// Function to log activity
const logActivity = async (req, res, responseBody, responseStatus) => {
  // Only log if user is authenticated and has _id
  if (!req.user || !req.user._id) {
    return;
  }

  // Determine action based on HTTP method and specific routes
  let action = 'read';
  let riskLevel = 'low';
  let isSuspicious = false;

  // More sophisticated action detection
  if (req.path.includes('/login')) {
    action = 'login';
    riskLevel = 'low';
  } else if (req.path.includes('/logout')) {
    action = 'logout';
    riskLevel = 'low';
  } else if (req.path.includes('/approve')) {
    action = 'approve';
    riskLevel = 'high';
  } else if (req.path.includes('/reject')) {
    action = 'reject';
    riskLevel = 'high';
  } else if (req.path.includes('/export')) {
    action = 'export';
    riskLevel = 'medium';
  } else if (req.path.includes('/import')) {
    action = 'import';
    riskLevel = 'medium';
  } else {
    switch (req.method) {
      case 'POST':
        action = 'create';
        riskLevel = 'medium';
        break;
      case 'PUT':
      case 'PATCH':
        action = 'update';
        riskLevel = 'medium';
        break;
      case 'DELETE':
        action = 'delete';
        riskLevel = 'high';
        break;
      case 'GET':
        action = 'read';
        riskLevel = 'low';
        break;
      default:
        // HEAD/OPTIONS/etc. — ignore
        return;
    }
  }

  // Skip routine page/list/detail reads to control volume and storage growth.
  // Keep meaningful actions only (mutations, auth, export/import, approve/reject).
  if (action === 'read') {
    return;
  }

  // Determine module based on route
  let module = 'general';
  if (req.path.includes('/hr/') || req.path.startsWith('/api/hr')) module = 'hr';
  else if (req.path.includes('/finance/') || req.path.startsWith('/api/finance')) module = 'finance';
  else if (req.path.includes('/procurement/') || req.path.startsWith('/api/procurement')) module = 'procurement';
  else if (req.path.includes('/admin/') || req.path.startsWith('/api/admin')) module = 'admin';
  else if (req.path.includes('/sales/') || req.path.startsWith('/api/sales')) module = 'sales';
  else if (req.path.includes('/crm/') || req.path.startsWith('/api/crm')) module = 'crm';
  else if (req.path.includes('/auth/') || req.path.startsWith('/api/auth')) module = 'auth';
  else if (req.path.includes('/audit/') || req.path.startsWith('/api/audit') || req.path.startsWith('/api/pre-audit')) module = 'audit';
  else if (req.path.includes('/taj-residencia/') || req.path.includes('/land-acquisition')) module = 'taj-residencia';
  else if (req.path.includes('/centralized-store') || req.path.includes('/store')) module = 'store';

  // Resolve entity from URL (or route-provided override)
  const resolved = resolveEntityFromPath(req.path, req.params);
  let entityType = req.auditEntityType || resolved.entityType || titleCase(module) || 'System';
  let entityId = resolved.entityId;
  let entityName = resolved.entityName || null;

  if (action === 'login' || action === 'logout') {
    entityType = 'User';
    entityName = req.user?.email || 'User session';
  }

  // Determine category based on action and entity
  let category = 'data_modification';
  if (action === 'read') {
    category = 'data_access';
  } else if (req.path.includes('/auth/')) {
    category = 'system_access';
  } else if (req.path.includes('/config') || req.path.includes('/settings')) {
    category = 'configuration_change';
  }

  // Detect suspicious activities
  if (responseStatus >= 400 && responseStatus < 500) {
    isSuspicious = true;
    riskLevel = 'high';
  } else if (responseStatus >= 500) {
    isSuspicious = true;
    riskLevel = 'critical';
  }

  // High-risk operations
  if (action === 'delete' || 
      (action === 'create' && (module === 'finance' || module === 'hr')) ||
      (action === 'update' && entityType === 'User')) {
    riskLevel = 'high';
  }

  // Create more descriptive descriptions
  let description = generateDescription(action, entityType, entityName, req.path, req.query);

  // Prepare audit trail data
  const auditData = {
    action,
    module,
    userId: req.user._id || req.user.id,
    userEmail: req.user.email || 'unknown',
    userRole: req.user.role || 'unknown',
    userDepartment: req.user.department || null,
    entityType,
    entityId,
    entityName,
    description,
    details: {
      method: req.method,
      path: req.path,
      query: req.query,
      responseStatus
    },
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    requestMethod: req.method,
    requestUrl: req.originalUrl,
    riskLevel,
    status: responseStatus < 400 ? 'success' : 'failed',
    isSuspicious,
    category,
    tags: [module, action]
  };

  // Add truncated/sanitized request body for non-GET requests
  if (req.method !== 'GET' && req.body) {
    auditData.requestBody = sanitizeRequestBody(req.body);
  }

  // Log without blocking the response path further
  setImmediate(() => {
    AuditTrail.logAction(auditData).catch((err) => {
      console.error('Error saving audit trail entry:', err.message);
    });
  });
};

// Middleware for specific entity operations
const logEntityOperation = (entityType, operation = null) => {
  return (req, res, next) => {
    // Store entity info for logging
    req.auditEntityType = entityType;
    req.auditOperation = operation;
    next();
  };
};

// Middleware for financial operations (higher risk)
const logFinancialOperation = (req, res, next) => {
  req.auditRiskLevel = 'high';
  req.auditCategory = 'financial_transaction';
  next();
};

// Middleware for HR operations (medium risk)
const logHROperation = (req, res, next) => {
  req.auditRiskLevel = 'medium';
  req.auditCategory = 'hr_operation';
  next();
};

// Middleware for admin operations (high risk)
const logAdminOperation = (req, res, next) => {
  req.auditRiskLevel = 'high';
  req.auditCategory = 'admin_operation';
  next();
};

// Function to manually log specific activities
const logSpecificActivity = async (req, activityData) => {
  if (!req.user) {
    throw new Error('User not authenticated');
  }

  const auditData = {
    action: activityData.action || 'custom',
    module: activityData.module || 'general',
    userId: req.user._id,
    userEmail: req.user.email,
    userRole: req.user.role,
    userDepartment: req.user.department,
    entityType: activityData.entityType || 'Custom',
    entityId: activityData.entityId,
    entityName: activityData.entityName,
    description: activityData.description,
    details: activityData.details,
    oldValues: activityData.oldValues,
    newValues: activityData.newValues,
    changedFields: activityData.changedFields,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    requestMethod: req.method,
    requestUrl: req.originalUrl,
    riskLevel: activityData.riskLevel || 'medium',
    status: 'success',
    isSuspicious: activityData.isSuspicious || false,
    category: activityData.category || 'business_process',
    tags: activityData.tags || [],
    relatedEntities: activityData.relatedEntities || []
  };

  return await AuditTrail.logAction(auditData);
};

// Function to log login/logout activities
const logAuthActivity = async (req, user, action, success = true, details = {}) => {
  const auditData = {
    action,
    module: 'auth',
    userId: user._id,
    userEmail: user.email,
    userRole: user.role,
    userDepartment: user.department,
    entityType: 'User',
    entityId: user._id,
    entityName: `${user.firstName} ${user.lastName}`,
    description: `${action} attempt`,
    details: {
      success,
      ...details
    },
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    requestMethod: req.method,
    requestUrl: req.originalUrl,
    riskLevel: success ? 'low' : 'medium',
    status: success ? 'success' : 'failed',
    isSuspicious: !success,
    category: 'system_access',
    tags: ['authentication', action]
  };

  return await AuditTrail.logAction(auditData);
};

// Function to log data export activities
const logExportActivity = async (req, entityType, filters = {}, recordCount = 0) => {
  const auditData = {
    action: 'export',
    module: req.auditEntityType || 'general',
    userId: req.user._id,
    userEmail: req.user.email,
    userRole: req.user.role,
    userDepartment: req.user.department,
    entityType,
    entityName: `${entityType} Export`,
    description: `Exported ${recordCount} ${entityType} records`,
    details: {
      filters,
      recordCount,
      format: req.query.format || 'csv'
    },
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    requestMethod: req.method,
    requestUrl: req.originalUrl,
    riskLevel: recordCount > 1000 ? 'medium' : 'low',
    status: 'success',
    isSuspicious: false,
    category: 'data_access',
    tags: ['export', entityType]
  };

  return await AuditTrail.logAction(auditData);
};

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const SKIP_SEGMENTS = new Set([
  'api', 'v1', 'v2',
  'hr', 'finance', 'procurement', 'admin', 'sales', 'crm', 'auth', 'audit',
  'taj-residencia', 'land-acquisition', 'centralized-store',
  'search', 'filter', 'bulk', 'export', 'import', 'approve', 'reject',
  'login', 'logout', 'dashboard', 'stats', 'statistics', 'next-ref',
  'registered-totals', 'possessed-totals', 'pending-possession'
]);

const ENTITY_MAPPING = {
  employees: 'Employee',
  employee: 'Employee',
  payroll: 'Payroll',
  payrolls: 'Payroll',
  departments: 'Department',
  department: 'Department',
  positions: 'Position',
  position: 'Position',
  companies: 'Company',
  company: 'Company',
  projects: 'Project',
  project: 'Project',
  sections: 'Section',
  section: 'Section',
  designations: 'Designation',
  designation: 'Designation',
  locations: 'Location',
  location: 'Location',
  banks: 'Bank',
  bank: 'Bank',
  increments: 'Increment',
  increment: 'Increment',
  users: 'User',
  user: 'User',
  audits: 'Audit',
  findings: 'AuditFinding',
  finding: 'AuditFinding',
  'corrective-actions': 'CorrectiveAction',
  actions: 'CorrectiveAction',
  trail: 'AuditTrail',
  schedules: 'AuditSchedule',
  schedule: 'AuditSchedule',
  reports: 'Report',
  report: 'Report',
  transactions: 'FinancialTransaction',
  transaction: 'FinancialTransaction',
  invoices: 'Invoice',
  invoice: 'Invoice',
  budgets: 'Budget',
  budget: 'Budget',
  orders: 'PurchaseOrder',
  order: 'PurchaseOrder',
  'purchase-orders': 'PurchaseOrder',
  suppliers: 'Supplier',
  supplier: 'Supplier',
  vendors: 'Vendor',
  vendor: 'Vendor',
  leads: 'Lead',
  lead: 'Lead',
  opportunities: 'Opportunity',
  opportunity: 'Opportunity',
  customers: 'Customer',
  customer: 'Customer',
  contacts: 'Contact',
  contact: 'Contact',
  bills: 'Bill',
  bill: 'Bill',
  grns: 'GRN',
  grn: 'GRN',
  registries: 'LandRegistry',
  registry: 'LandRegistry',
  possessions: 'LandPossession',
  possession: 'LandPossession',
  exchanges: 'LandExchange',
  exchange: 'LandExchange',
  transfers: 'LandTransfer',
  transfer: 'LandTransfer',
  purchases: 'LandPurchase',
  purchase: 'LandPurchase',
  parties: 'LandParty',
  party: 'LandParty',
  mozas: 'LandMoza',
  moza: 'LandMoza',
  'pre-audit': 'PreAudit',
  vouchers: 'Voucher',
  voucher: 'Voucher',
  accounts: 'Account',
  account: 'Account'
};

const titleCase = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, '');
};

/**
 * Pick the real resource segment from a URL instead of blindly using
 * second-to-last (which often became "api", module name, or an ObjectId → Unknown/junk).
 */
const resolveEntityFromPath = (pathValue = '', params = {}) => {
  const parts = String(pathValue || '')
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));

  let entityId = null;
  const paramId = params.id || params._id || params.registryId || params.purchaseId;
  if (paramId && OBJECT_ID_RE.test(String(paramId))) {
    entityId = String(paramId);
  }

  // Walk from the end: skip ids and action verbs; first meaningful segment wins
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];
    if (OBJECT_ID_RE.test(part)) {
      if (!entityId) entityId = part;
      continue;
    }
    if (SKIP_SEGMENTS.has(part.toLowerCase())) continue;
    if (/^\d+$/.test(part)) continue;

    const key = part.toLowerCase();
    const entityType = ENTITY_MAPPING[key] || titleCase(part);
    return {
      entityType,
      entityId,
      entityName: entityId ? `${entityType} ${String(entityId).slice(-6)}` : entityType
    };
  }

  return {
    entityType: null,
    entityId,
    entityName: null
  };
};

// Helper function to generate more descriptive audit descriptions
const generateDescription = (action, entityType, entityName, path, query) => {
  const actionDescriptions = {
    'login': 'User logged into the system',
    'logout': 'User logged out of the system',
    'create': `Created new ${entityType.toLowerCase()}`,
    'read': `Viewed ${entityType.toLowerCase()} information`,
    'update': `Updated ${entityType.toLowerCase()} details`,
    'delete': `Deleted ${entityType.toLowerCase()} record`,
    'approve': `Approved ${entityType.toLowerCase()} request`,
    'reject': `Rejected ${entityType.toLowerCase()} request`,
    'export': `Exported ${entityType.toLowerCase()} data`,
    'import': `Imported ${entityType.toLowerCase()} data`
  };

  let description = actionDescriptions[action] || `${action.charAt(0).toUpperCase() + action.slice(1)} ${entityType.toLowerCase()}`;

  // Add more context based on path and query parameters
  if (path.includes('/search') || query.search) {
    description = `Searched for ${entityType.toLowerCase()} records`;
  } else if (path.includes('/filter') || Object.keys(query).length > 0) {
    description = `Filtered ${entityType.toLowerCase()} records`;
  } else if (path.includes('/bulk')) {
    description = `Performed bulk ${action} on ${entityType.toLowerCase()} records`;
  } else if (path.includes('/report')) {
    description = `Generated ${entityType.toLowerCase()} report`;
  } else if (path.includes('/dashboard')) {
    description = `Accessed ${entityType.toLowerCase()} dashboard`;
  } else if (path.includes('/settings') || path.includes('/config')) {
    description = `Modified ${entityType.toLowerCase()} configuration`;
  } else if (path.includes('/permissions') || path.includes('/access')) {
    description = `Updated ${entityType.toLowerCase()} access permissions`;
  }

  // Add entity name if available and specific
  if (entityName && !entityName.includes('Record') && !entityName.includes('Information')) {
    description += `: ${entityName}`;
  }

  return description;
};

module.exports = {
  logRequest,
  logEntityOperation,
  logFinancialOperation,
  logHROperation,
  logAdminOperation,
  logSpecificActivity,
  logAuthActivity,
  logExportActivity
};
