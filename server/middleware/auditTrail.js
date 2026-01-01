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
    '/socket.io/'
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
    }
  }

  // Determine module based on route
  let module = 'general';
  if (req.path.includes('/hr/')) module = 'hr';
  else if (req.path.includes('/finance/')) module = 'finance';
  else if (req.path.includes('/procurement/')) module = 'procurement';
  else if (req.path.includes('/admin/')) module = 'admin';
  else if (req.path.includes('/sales/')) module = 'sales';
  else if (req.path.includes('/crm/')) module = 'crm';
  else if (req.path.includes('/auth/')) module = 'auth';
  else if (req.path.includes('/audit/')) module = 'audit';

  // Extract entity information from URL with more sophisticated detection
  const pathParts = req.path.split('/').filter(part => part);
  let entityType = 'Unknown';
  let entityId = null;
  let entityName = null;

  // Enhanced entity type detection
  if (pathParts.length >= 2) {
    const resource = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
    
    // Map resource names to proper entity types
    const entityMapping = {
      'employees': 'Employee',
      'employee': 'Employee',
      'payroll': 'Payroll',
      'payrolls': 'Payroll',
      'departments': 'Department',
      'department': 'Department',
      'positions': 'Position',
      'position': 'Position',
      'companies': 'Company',
      'company': 'Company',
      'projects': 'Project',
      'project': 'Project',
      'sections': 'Section',
      'section': 'Section',
      'designations': 'Designation',
      'designation': 'Designation',
      'locations': 'Location',
      'location': 'Location',
      'banks': 'Bank',
      'bank': 'Bank',
      'increments': 'Increment',
      'increment': 'Increment',
      'users': 'User',
      'user': 'User',
      'audits': 'Audit',
      'audit': 'Audit',
      'findings': 'AuditFinding',
      'finding': 'AuditFinding',
      'actions': 'CorrectiveAction',
      'action': 'CorrectiveAction',
      'trail': 'AuditTrail',
      'schedules': 'AuditSchedule',
      'schedule': 'AuditSchedule',
      'reports': 'Report',
      'report': 'Report',
      'transactions': 'FinancialTransaction',
      'transaction': 'FinancialTransaction',
      'invoices': 'Invoice',
      'invoice': 'Invoice',
      'budgets': 'Budget',
      'budget': 'Budget',
      'orders': 'PurchaseOrder',
      'order': 'PurchaseOrder',
      'suppliers': 'Supplier',
      'supplier': 'Supplier',
      'leads': 'Lead',
      'lead': 'Lead',
      'opportunities': 'Opportunity',
      'opportunity': 'Opportunity',
      'customers': 'Customer',
      'customer': 'Customer',
      'contacts': 'Contact',
      'contact': 'Contact'
    };

    entityType = entityMapping[resource] || resource.charAt(0).toUpperCase() + resource.slice(1);
    
    // Check if last part looks like an ID
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && (lastPart.length === 24 && /^[0-9a-fA-F]{24}$/.test(lastPart))) {
      entityId = lastPart;
    }
  }

  // Generate realistic entity names based on entity type
  if (entityType && !entityName) {
    entityName = generateEntityName(entityType, entityId);
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

  // Add request body for non-GET requests (be careful with sensitive data)
  if (req.method !== 'GET' && req.body) {
    // Filter out sensitive fields
    const sanitizedBody = { ...req.body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'pin'];
    
    sensitiveFields.forEach(field => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '[REDACTED]';
      }
    });

    auditData.requestBody = sanitizedBody;
  }

  // Log the activity
  await AuditTrail.logAction(auditData);
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

// Helper function to generate realistic entity names
const generateEntityName = (entityType, entityId) => {
  const nameTemplates = {
    'Employee': ['Employee Record', 'Staff Member', 'Team Member'],
    'Payroll': ['Monthly Payroll', 'Salary Record', 'Payroll Report'],
    'Department': ['Department Information', 'Team Department', 'Organizational Unit'],
    'Position': ['Job Position', 'Role Definition', 'Position Details'],
    'Company': ['Company Profile', 'Organization Details', 'Business Entity'],
    'Project': ['Project Information', 'Business Project', 'Development Project'],
    'Section': ['Section Details', 'Department Section', 'Organizational Section'],
    'Designation': ['Job Designation', 'Role Title', 'Position Designation'],
    'Location': ['Office Location', 'Work Location', 'Business Address'],
    'Bank': ['Bank Account', 'Financial Institution', 'Banking Details'],
    'Increment': ['Salary Increment', 'Pay Raise', 'Compensation Increase'],
    'User': ['User Account', 'System User', 'Account Profile'],
    'Audit': ['Audit Record', 'Compliance Audit', 'System Audit'],
    'AuditFinding': ['Audit Finding', 'Compliance Issue', 'Audit Observation'],
    'CorrectiveAction': ['Corrective Action', 'Remedial Action', 'Action Plan'],
    'AuditTrail': ['Audit Log', 'Activity Log', 'System Trail'],
    'AuditSchedule': ['Audit Schedule', 'Compliance Calendar', 'Audit Plan'],
    'Report': ['System Report', 'Business Report', 'Analytics Report'],
    'FinancialTransaction': ['Financial Transaction', 'Payment Record', 'Money Transfer'],
    'Invoice': ['Business Invoice', 'Payment Invoice', 'Billing Document'],
    'Budget': ['Department Budget', 'Financial Budget', 'Cost Budget'],
    'PurchaseOrder': ['Purchase Order', 'Procurement Order', 'Buying Order'],
    'Supplier': ['Vendor Information', 'Supplier Profile', 'Business Partner'],
    'Lead': ['Sales Lead', 'Business Prospect', 'Potential Customer'],
    'Opportunity': ['Sales Opportunity', 'Business Opportunity', 'Revenue Opportunity'],
    'Customer': ['Customer Profile', 'Client Information', 'Business Customer'],
    'Contact': ['Contact Information', 'Communication Contact', 'Business Contact']
  };

  const templates = nameTemplates[entityType] || [`${entityType} Record`, `${entityType} Information`];
  return templates[Math.floor(Math.random() * templates.length)];
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
