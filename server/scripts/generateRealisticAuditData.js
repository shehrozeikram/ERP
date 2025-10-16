const mongoose = require('mongoose');
const AuditTrail = require('../models/audit/AuditTrail');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Realistic audit trail data generator
const generateRealisticAuditData = async () => {
  try {
    console.log('🚀 Generating realistic audit trail data...');

    // Get existing users
    const users = await User.find({}).limit(20);
    if (users.length === 0) {
      console.log('❌ No users found. Please create users first.');
      return;
    }

    // Clear existing audit trail data
    await AuditTrail.deleteMany({});
    console.log('✅ Cleared existing audit trail data');

    const auditEntries = [];
    const now = new Date();

    // Generate realistic activities for the last 30 days
    for (let daysBack = 0; daysBack < 30; daysBack++) {
      const baseDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      
      // Generate activities for each day (more activities during business hours)
      const activitiesPerDay = Math.floor(Math.random() * 200) + 50; // 50-250 activities per day
      
      for (let i = 0; i < activitiesPerDay; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const hour = Math.floor(Math.random() * 24);
        const minute = Math.floor(Math.random() * 60);
        const second = Math.floor(Math.random() * 60);
        
        // More activities during business hours (9 AM - 6 PM)
        const businessHourMultiplier = (hour >= 9 && hour <= 18) ? 0.7 : 0.3;
        if (Math.random() > businessHourMultiplier) continue;
        
        const timestamp = new Date(baseDate.getTime() + (hour * 60 * 60 * 1000) + (minute * 60 * 1000) + (second * 1000));
        
        // Generate realistic activity
        const activity = generateRealisticActivity(user, timestamp);
        if (activity) {
          auditEntries.push(activity);
        }
      }
    }

    // Insert all audit entries
    if (auditEntries.length > 0) {
      await AuditTrail.insertMany(auditEntries);
      console.log(`✅ Generated ${auditEntries.length} realistic audit trail entries`);
    }

    // Generate some suspicious activities
    await generateSuspiciousActivities(users);
    
    console.log('🎉 Realistic audit trail data generation completed!');
  } catch (error) {
    console.error('❌ Error generating audit trail data:', error);
  } finally {
    mongoose.disconnect();
  }
};

const generateRealisticActivity = (user, timestamp) => {
  const activities = [
    // HR Activities
    {
      action: 'login',
      module: 'auth',
      entityType: 'User',
      entityId: user._id,
      entityName: `${user.firstName} ${user.lastName}`,
      description: 'User logged into the system',
      riskLevel: 'low',
      category: 'system_access',
      tags: ['authentication', 'login']
    },
    {
      action: 'read',
      module: 'hr',
      entityType: 'Employee',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Employee Profile',
      description: 'Viewed employee profile information',
      riskLevel: 'low',
      category: 'data_access',
      tags: ['employee', 'profile']
    },
    {
      action: 'update',
      module: 'hr',
      entityType: 'Employee',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Employee Record',
      description: 'Updated employee personal information',
      riskLevel: 'medium',
      category: 'data_modification',
      tags: ['employee', 'update'],
      oldValues: { phone: '+92-300-1234567' },
      newValues: { phone: '+92-300-7654321' },
      changedFields: [
        { field: 'phone', oldValue: '+92-300-1234567', newValue: '+92-300-7654321' }
      ]
    },
    {
      action: 'create',
      module: 'hr',
      entityType: 'Employee',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'New Employee',
      description: 'Created new employee record',
      riskLevel: 'medium',
      category: 'data_modification',
      tags: ['employee', 'creation']
    },
    {
      action: 'read',
      module: 'hr',
      entityType: 'Payroll',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Monthly Payroll',
      description: 'Viewed payroll information',
      riskLevel: 'high',
      category: 'data_access',
      tags: ['payroll', 'salary']
    },
    {
      action: 'update',
      module: 'hr',
      entityType: 'Payroll',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Salary Adjustment',
      description: 'Updated employee salary',
      riskLevel: 'high',
      category: 'data_modification',
      tags: ['payroll', 'salary'],
      oldValues: { basicSalary: 50000 },
      newValues: { basicSalary: 55000 },
      changedFields: [
        { field: 'basicSalary', oldValue: 50000, newValue: 55000 }
      ]
    },
    {
      action: 'read',
      module: 'hr',
      entityType: 'Attendance',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Daily Attendance',
      description: 'Checked attendance records',
      riskLevel: 'low',
      category: 'data_access',
      tags: ['attendance']
    },
    {
      action: 'create',
      module: 'hr',
      entityType: 'Leave',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Leave Application',
      description: 'Submitted leave application',
      riskLevel: 'low',
      category: 'business_process',
      tags: ['leave', 'application']
    },
    {
      action: 'approve',
      module: 'hr',
      entityType: 'Leave',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Leave Approval',
      description: 'Approved leave application',
      riskLevel: 'medium',
      category: 'business_process',
      tags: ['leave', 'approval']
    },

    // Finance Activities
    {
      action: 'read',
      module: 'finance',
      entityType: 'FinancialTransaction',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Payment Record',
      description: 'Viewed financial transaction',
      riskLevel: 'high',
      category: 'data_access',
      tags: ['finance', 'transaction']
    },
    {
      action: 'create',
      module: 'finance',
      entityType: 'Invoice',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'New Invoice',
      description: 'Created new invoice',
      riskLevel: 'medium',
      category: 'data_modification',
      tags: ['invoice', 'finance']
    },
    {
      action: 'update',
      module: 'finance',
      entityType: 'Invoice',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Invoice Update',
      description: 'Updated invoice details',
      riskLevel: 'medium',
      category: 'data_modification',
      tags: ['invoice', 'update']
    },
    {
      action: 'read',
      module: 'finance',
      entityType: 'Budget',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Department Budget',
      description: 'Viewed budget information',
      riskLevel: 'medium',
      category: 'data_access',
      tags: ['budget', 'finance']
    },

    // Procurement Activities
    {
      action: 'create',
      module: 'procurement',
      entityType: 'PurchaseOrder',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Purchase Order #PO-2024-001',
      description: 'Created new purchase order',
      riskLevel: 'medium',
      category: 'business_process',
      tags: ['procurement', 'purchase']
    },
    {
      action: 'approve',
      module: 'procurement',
      entityType: 'PurchaseOrder',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Purchase Order Approval',
      description: 'Approved purchase order',
      riskLevel: 'high',
      category: 'business_process',
      tags: ['procurement', 'approval']
    },
    {
      action: 'read',
      module: 'procurement',
      entityType: 'Supplier',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Supplier Information',
      description: 'Viewed supplier details',
      riskLevel: 'low',
      category: 'data_access',
      tags: ['supplier', 'vendor']
    },

    // Admin Activities
    {
      action: 'update',
      module: 'admin',
      entityType: 'User',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'User Account',
      description: 'Updated user permissions',
      riskLevel: 'critical',
      category: 'configuration_change',
      tags: ['user', 'permissions', 'admin']
    },
    {
      action: 'create',
      module: 'admin',
      entityType: 'User',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'New User Account',
      description: 'Created new user account',
      riskLevel: 'high',
      category: 'data_modification',
      tags: ['user', 'creation', 'admin']
    },
    {
      action: 'delete',
      module: 'admin',
      entityType: 'User',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Deleted User Account',
      description: 'Deleted user account',
      riskLevel: 'critical',
      category: 'data_modification',
      tags: ['user', 'deletion', 'admin']
    },
    {
      action: 'read',
      module: 'admin',
      entityType: 'SystemLog',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'System Logs',
      description: 'Viewed system logs',
      riskLevel: 'high',
      category: 'data_access',
      tags: ['logs', 'system', 'admin']
    },

    // Sales Activities
    {
      action: 'create',
      module: 'sales',
      entityType: 'Lead',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'New Sales Lead',
      description: 'Created new sales lead',
      riskLevel: 'low',
      category: 'business_process',
      tags: ['sales', 'lead']
    },
    {
      action: 'update',
      module: 'sales',
      entityType: 'Opportunity',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Sales Opportunity',
      description: 'Updated opportunity status',
      riskLevel: 'medium',
      category: 'business_process',
      tags: ['sales', 'opportunity']
    },

    // CRM Activities
    {
      action: 'create',
      module: 'crm',
      entityType: 'Customer',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'New Customer',
      description: 'Added new customer',
      riskLevel: 'low',
      category: 'data_modification',
      tags: ['customer', 'crm']
    },
    {
      action: 'read',
      module: 'crm',
      entityType: 'Customer',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Customer Profile',
      description: 'Viewed customer profile',
      riskLevel: 'low',
      category: 'data_access',
      tags: ['customer', 'profile']
    },

    // Audit Activities
    {
      action: 'read',
      module: 'audit',
      entityType: 'AuditTrail',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Audit Trail',
      description: 'Viewed audit trail',
      riskLevel: 'high',
      category: 'data_access',
      tags: ['audit', 'compliance']
    },
    {
      action: 'export',
      module: 'audit',
      entityType: 'AuditReport',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Audit Report Export',
      description: 'Exported audit report',
      riskLevel: 'high',
      category: 'data_access',
      tags: ['audit', 'export', 'report']
    },

    // General Activities
    {
      action: 'logout',
      module: 'auth',
      entityType: 'User',
      entityId: user._id,
      entityName: `${user.firstName} ${user.lastName}`,
      description: 'User logged out of the system',
      riskLevel: 'low',
      category: 'system_access',
      tags: ['authentication', 'logout']
    }
  ];

  const selectedActivity = activities[Math.floor(Math.random() * activities.length)];
  
  return {
    ...selectedActivity,
    userId: user._id,
    userEmail: user.email,
    userRole: user.role,
    userDepartment: user.department?.name || 'General',
    ipAddress: generateRandomIP(),
    userAgent: generateRandomUserAgent(),
    requestMethod: getRandomRequestMethod(selectedActivity.action),
    requestUrl: generateRandomURL(selectedActivity.module),
    sessionId: generateRandomSessionId(),
    status: Math.random() > 0.95 ? 'failed' : 'success', // 5% failure rate
    isSuspicious: Math.random() > 0.98, // 2% suspicious rate
    timestamp
  };
};

const generateSuspiciousActivities = async (users) => {
  console.log('🔍 Generating suspicious activities...');
  
  const suspiciousEntries = [];
  const now = new Date();

  // Generate some high-risk activities
  const highRiskUser = users[0]; // Use first user for suspicious activities
  
  // Multiple failed login attempts
  for (let i = 0; i < 10; i++) {
    const timestamp = new Date(now.getTime() - (Math.random() * 60 * 60 * 1000)); // Last hour
    suspiciousEntries.push({
      action: 'login',
      module: 'auth',
      entityType: 'User',
      entityId: highRiskUser._id,
      entityName: `${highRiskUser.firstName} ${highRiskUser.lastName}`,
      description: 'Failed login attempt',
      riskLevel: 'high',
      category: 'security_event',
      tags: ['authentication', 'failed', 'suspicious'],
      userId: highRiskUser._id,
      userEmail: highRiskUser.email,
      userRole: highRiskUser.role,
      userDepartment: highRiskUser.department?.name || 'General',
      ipAddress: generateRandomIP(),
      userAgent: generateRandomUserAgent(),
      requestMethod: 'POST',
      requestUrl: '/api/auth/login',
      sessionId: generateRandomSessionId(),
      status: 'failed',
      isSuspicious: true,
      timestamp
    });
  }

  // Bulk data access (suspicious pattern)
  for (let i = 0; i < 50; i++) {
    const timestamp = new Date(now.getTime() - (Math.random() * 30 * 60 * 1000)); // Last 30 minutes
    suspiciousEntries.push({
      action: 'read',
      module: 'hr',
      entityType: 'Employee',
      entityId: new mongoose.Types.ObjectId(),
      entityName: `Employee Record ${i + 1}`,
      description: 'Accessed multiple employee records in short time',
      riskLevel: 'critical',
      category: 'data_access',
      tags: ['employee', 'bulk_access', 'suspicious'],
      userId: highRiskUser._id,
      userEmail: highRiskUser.email,
      userRole: highRiskUser.role,
      userDepartment: highRiskUser.department?.name || 'General',
      ipAddress: generateRandomIP(),
      userAgent: generateRandomUserAgent(),
      requestMethod: 'GET',
      requestUrl: '/api/hr/employees',
      sessionId: generateRandomSessionId(),
      status: 'success',
      isSuspicious: true,
      timestamp
    });
  }

  // Unusual time access (outside business hours)
  const unusualTimeUser = users[1];
  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(now.getTime() - (Math.random() * 24 * 60 * 60 * 1000));
    timestamp.setHours(Math.random() > 0.5 ? 2 : 22); // 2 AM or 10 PM
    
    suspiciousEntries.push({
      action: 'read',
      module: 'finance',
      entityType: 'FinancialTransaction',
      entityId: new mongoose.Types.ObjectId(),
      entityName: 'Financial Data',
      description: 'Accessed financial data outside business hours',
      riskLevel: 'high',
      category: 'data_access',
      tags: ['finance', 'unusual_time', 'suspicious'],
      userId: unusualTimeUser._id,
      userEmail: unusualTimeUser.email,
      userRole: unusualTimeUser.role,
      userDepartment: unusualTimeUser.department?.name || 'General',
      ipAddress: generateRandomIP(),
      userAgent: generateRandomUserAgent(),
      requestMethod: 'GET',
      requestUrl: '/api/finance/transactions',
      sessionId: generateRandomSessionId(),
      status: 'success',
      isSuspicious: true,
      timestamp
    });
  }

  // Privilege escalation attempt
  const privilegeUser = users[2];
  suspiciousEntries.push({
    action: 'update',
    module: 'admin',
    entityType: 'User',
    entityId: privilegeUser._id,
    entityName: `${privilegeUser.firstName} ${privilegeUser.lastName}`,
    description: 'Attempted to change user role without authorization',
    riskLevel: 'critical',
    category: 'security_event',
    tags: ['privilege_escalation', 'unauthorized', 'suspicious'],
    userId: privilegeUser._id,
    userEmail: privilegeUser.email,
    userRole: privilegeUser.role,
    userDepartment: privilegeUser.department?.name || 'General',
    ipAddress: generateRandomIP(),
    userAgent: generateRandomUserAgent(),
    requestMethod: 'PUT',
    requestUrl: '/api/admin/users',
    requestBody: { role: 'super_admin' },
    sessionId: generateRandomSessionId(),
    status: 'failed',
    isSuspicious: true,
    timestamp: new Date(now.getTime() - (Math.random() * 60 * 60 * 1000))
  });

  if (suspiciousEntries.length > 0) {
    await AuditTrail.insertMany(suspiciousEntries);
    console.log(`✅ Generated ${suspiciousEntries.length} suspicious audit trail entries`);
  }
};

// Helper functions
const generateRandomIP = () => {
  const ips = [
    '192.168.1.100', '192.168.1.101', '192.168.1.102', '192.168.1.103',
    '10.0.0.50', '10.0.0.51', '10.0.0.52',
    '172.16.0.10', '172.16.0.11', '172.16.0.12',
    '203.82.48.1', '203.82.48.2', // Pakistan IPs
    '39.40.1.1', '39.40.1.2'
  ];
  return ips[Math.floor(Math.random() * ips.length)];
};

const generateRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

const getRandomRequestMethod = (action) => {
  const methodMap = {
    'create': 'POST',
    'read': 'GET',
    'update': 'PUT',
    'delete': 'DELETE',
    'login': 'POST',
    'logout': 'POST',
    'approve': 'PUT',
    'reject': 'PUT',
    'export': 'GET',
    'import': 'POST'
  };
  return methodMap[action] || 'GET';
};

const generateRandomURL = (module) => {
  const urls = {
    'hr': ['/api/hr/employees', '/api/hr/payroll', '/api/hr/attendance', '/api/hr/leaves'],
    'finance': ['/api/finance/transactions', '/api/finance/invoices', '/api/finance/budget'],
    'procurement': ['/api/procurement/orders', '/api/procurement/suppliers'],
    'admin': ['/api/admin/users', '/api/admin/settings'],
    'sales': ['/api/sales/leads', '/api/sales/opportunities'],
    'crm': ['/api/crm/customers', '/api/crm/contacts'],
    'audit': ['/api/audit/trail', '/api/audit/reports'],
    'auth': ['/api/auth/login', '/api/auth/logout']
  };
  const moduleUrls = urls[module] || ['/api/general'];
  return moduleUrls[Math.floor(Math.random() * moduleUrls.length)];
};

const generateRandomSessionId = () => {
  return 'sess_' + Math.random().toString(36).substr(2, 16);
};

// Run the script
if (require.main === module) {
  generateRealisticAuditData();
}

module.exports = { generateRealisticAuditData };
