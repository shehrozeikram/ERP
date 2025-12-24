const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDB } = require('./config/database');
const app = express();
const server = http.createServer(app);

// Load models to ensure they are registered
require('./models/hr/VehicleLogBook');
require('./models/hr/VehicleMaintenance');
require('./models/hr/Vehicle');

// Load IT models
require('./models/it/PasswordWallet');

// Connect to MongoDB
connectDB();

// Import routes
const authRoutes = require('./routes/auth');
const hrRoutes = require('./routes/hr');
const payrollRoutes = require('./routes/payroll');
const attendanceRoutes = require('./routes/attendance');
const biometricRoutes = require('./routes/biometric');
const financeRoutes = require('./routes/finance');
const financeAdvancedRoutes = require('./routes/financeAdvanced');
const procurementRoutes = require('./routes/procurement');
const salesRoutes = require('./routes/sales');
const crmRoutes = require('./routes/crm');
const campaignRoutes = require('./routes/campaigns');
const reportsRoutes = require('./routes/reports');
const positionRoutes = require('./routes/positions');
const bankRoutes = require('./routes/banks');
const companyRoutes = require('./routes/companies');
const projectRoutes = require('./routes/projects');
const sectionRoutes = require('./routes/sections');
const designationRoutes = require('./routes/designations');
const locationRoutes = require('./routes/locations');
const cityRoutes = require('./routes/cities');
const provinceRoutes = require('./routes/provinces');
const countryRoutes = require('./routes/countries');
const loanRoutes = require('./routes/loans');
const finalSettlementRoutes = require('./routes/finalSettlements');
const hrReportsRoutes = require('./routes/hrReports');
const payrollReportsRoutes = require('./routes/payrollReports');
const attendanceReportsRoutes = require('./routes/attendanceReports');
const payslipRoutes = require('./routes/payslips');
const jobPostingRoutes = require('./routes/jobPostings');
// const publicJobPostingRoutes = require('./routes/publicJobPostings');
const candidateRoutes = require('./routes/candidates');
// const publicCandidateRoutes = require('./routes/publicCandidates');
const candidateApprovalRoutes = require('./routes/candidateApprovals');
const publicApprovalRoutes = require('./routes/publicApprovals');
const applicationRoutes = require('./routes/applications');
const notificationRoutes = require('./routes/notifications');
// const publicApplicationRoutes = require('./routes/publicApplications');
const easyApplyRoutes = require('./routes/easyApply');
const courseRoutes = require('./routes/courses');
const enrollmentRoutes = require('./routes/enrollments');
const trainingProgramRoutes = require('./routes/trainingPrograms');
const zktecoRoutes = require('./routes/zkteco');
const hiringRoutes = require('./routes/hiring');
const employeeOnboardingRoutes = require('./routes/employeeOnboarding');
const zkbioTimeRoutes = require('./routes/zkbioTimeRoutes');
const { router: imageProxyRoutes, setZKBioTimeWebSocketProxy } = require('./routes/imageProxy');
const vehicleRoutes = require('./routes/vehicles');
const vehicleMaintenanceRoutes = require('./routes/vehicleMaintenance');
const vehicleLogBookRoutes = require('./routes/vehicleLogBook');
const trakkerRoutes = require('./routes/trakker');
const groceryRoutes = require('./routes/groceries');
const supplierRoutes = require('./routes/suppliers');
const pettyCashRoutes = require('./routes/pettyCash');
const eventRoutes = require('./routes/events');
const staffAssignmentRoutes = require('./routes/staffAssignments');
const attendanceProxyRoutes = require('./routes/attendanceProxy');
const utilityBillRoutes = require('./routes/utilityBills');
const itRoutes = require('./routes/it');
const arrearsRoutes = require('./routes/arrears');
const rentalAgreementRoutes = require('./routes/rentalAgreements');
const tajRentalAgreementRoutes = require('./routes/tajRentalAgreements');
const rentalManagementRoutes = require('./routes/rentalManagement');
const staffManagementRoutes = require('./routes/staffManagement');
const paymentSettlementRoutes = require('./routes/paymentSettlements');
const auditRoutes = require('./routes/audit');
const auditFindingsRoutes = require('./routes/auditFindings');
const auditTrailRoutes = require('./routes/auditTrail');
const subRoleRoutes = require('./routes/subRoles');
const userSubRoleRoutes = require('./routes/userSubRoles');
const tajResidenciaRoutes = require('./routes/tajResidencia');
const tajResidenciaComplaintsRoutes = require('./routes/tajResidenciaComplaints');
const tajRentalManagementRoutes = require('./routes/tajRentalManagement');
const camChargesRoutes = require('./routes/camCharges');
const electricityRoutes = require('./routes/electricity');
const tajPropertiesRoutes = require('./routes/tajProperties');
const propertyInvoicesRoutes = require('./routes/propertyInvoices');
const propertyReceiptsRoutes = require('./routes/propertyReceipts');
const chargesSlabsRoutes = require('./routes/chargesSlabs');
const waterUtilitySlabsRoutes = require('./routes/waterUtilitySlabs');
const tajResidentsRoutes = require('./routes/tajResidents');
const documentTrackingRoutes = require('./routes/documentTracking');
const evaluationDocumentsRoutes = require('./routes/evaluationDocuments');
const evaluationLevel0AuthoritiesRoutes = require('./routes/evaluationLevel0Authorities');
const indentsRoutes = require('./routes/indents');
const userTrackingRoutes = require('./routes/userTracking');
const activityLogger = require('./middleware/activityLogger');


// Import services
const attendanceService = require('./services/attendanceService');
const ChangeStreamService = require('./services/changeStreamService');
const ZKBioTimeWebSocketProxy = require('./services/zkbioTimeWebSocketProxy');
const itNotificationService = require('./services/itNotificationService');

// Initialize services
let changeStreamService = null;
let zkbioTimeWebSocketProxy = null;

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const { logRequest } = require('./middleware/auditTrail');

// Database connection already imported at the top

// Set environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';

// Check critical environment variables
console.log('🔧 Environment Check:');
console.log('   NODE_ENV:', NODE_ENV);
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ NOT SET');
console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ NOT SET');

if (!process.env.JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET environment variable is not set!');
  console.error('❌ This will cause login failures. Please set JWT_SECRET in your .env file.');
  process.exit(1);
}

// Database connection is handled at the top



// Initialize Change Stream service

// Security middleware
const getCSPDirectives = () => {
  const baseDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https:"],
    fontSrc: ["'self'", "https:", "data:"],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"]
  };

  // Add environment-specific image sources
  if (NODE_ENV === 'development') {
    baseDirectives.imgSrc = ["'self'", "data:", "http://localhost:3000", "https://localhost:3000", "http://localhost:5001", "https://localhost:5001"];
  } else {
    baseDirectives.imgSrc = ["'self'", "data:", "http://tovus.net", "https://tovus.net", "http://www.tovus.net", "https://www.tovus.net"];
    baseDirectives.upgradeInsecureRequests = [];
  }

  return baseDirectives;
};

app.use(helmet({
  contentSecurityPolicy: {
    directives: getCSPDirectives()
  }
}));
app.use(compression());

// Rate limiting (disabled for development)
if (NODE_ENV === 'production') {
  // Separate, more lenient rate limiter for file uploads (applied first)
  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 uploads per 15 minutes (more lenient for file operations)
    message: 'Too many file upload requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  });

  // General rate limiter - increased limit for better UX
  const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200, // Increased to 200 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for file upload endpoints (they have their own limiter)
    skip: (req) => {
      return req.path.includes('/upload-image') ||
             req.path.includes('/upload-file') ||
             req.method === 'OPTIONS';
    }
  });

  // Apply upload limiter FIRST to specific upload endpoints
  app.use('/api/hr/upload-image', uploadLimiter);
  
  // Then apply general limiter to all API routes (excluding uploads via skip function)
  app.use('/api/', generalLimiter);
  
  console.log('🔒 Rate limiting enabled for production');
  console.log('📤 File upload rate limiting: 50 uploads per 15 minutes');
  console.log('📊 General API rate limiting: 200 requests per 15 minutes');
} else {
  console.log('🔓 Rate limiting disabled for development');
}

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5001',
      'http://tovus.net',
      'https://tovus.net',
      'http://www.tovus.net',
      'https://www.tovus.net'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Audit trail middleware (should be early in the middleware stack)
app.use(logRequest);

// Body parsing middleware (increased for large file uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files with CORS headers
app.use('/uploads', (req, res, next) => {
  // Set CORS headers for all requests
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Set proper content type for images
    const ext = path.extname(filePath).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    } else if (filePath.toLowerCase().endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(filePath) + '"');
    }
  }
}));

app.use('/images', express.static(path.join(__dirname, '../client/public/images')));

// Note: React build files are now served by nginx, not by Node.js

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'SGC ERP System is running',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// Public test route for tracking (before auth middleware)
app.get('/api/tracking/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'User tracking routes are working', 
    path: req.path, 
    originalUrl: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Public route for profile images (must be before authenticated routes)
app.get('/api/hr/image/:filename(*)', (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Security: Validate filename to prevent directory traversal attacks
    // Only allow alphanumeric, dots, dashes, and underscores in filename
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }
    
    // Ensure we only serve files from profile-images directory
    const imagePath = path.join(__dirname, 'uploads', 'profile-images', filename);
    
    // Additional security: Verify the resolved path is actually in the profile-images directory
    const profileImagesDir = path.join(__dirname, 'uploads', 'profile-images');
    const resolvedPath = path.resolve(imagePath);
    const resolvedDir = path.resolve(profileImagesDir);
    
    if (!resolvedPath.startsWith(resolvedDir)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      // Log missing file for debugging (only in development)
      if (NODE_ENV === 'development') {
        console.log(`⚠️  Image not found: ${filename} at ${imagePath}`);
      }
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Set proper headers
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Send the file
    res.sendFile(imagePath);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({
      success: false,
      message: 'Error serving image'
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/hr', authMiddleware, activityLogger, hrRoutes);
app.use('/api/payroll', authMiddleware, activityLogger, payrollRoutes);
app.use('/api/attendance', authMiddleware, activityLogger, attendanceRoutes);
app.use('/api/biometric', authMiddleware, activityLogger, biometricRoutes);
app.use('/api/finance', authMiddleware, activityLogger, financeAdvancedRoutes);
app.use('/api/procurement', authMiddleware, activityLogger, procurementRoutes);
app.use('/api/sales', authMiddleware, activityLogger, salesRoutes);
app.use('/api/crm', authMiddleware, activityLogger, crmRoutes);
app.use('/api/campaigns', authMiddleware, activityLogger, campaignRoutes);
app.use('/api/reports', authMiddleware, activityLogger, reportsRoutes);
app.use('/api/positions', authMiddleware, activityLogger, positionRoutes);
app.use('/api/banks', authMiddleware, activityLogger, bankRoutes);
app.use('/api/companies', authMiddleware, activityLogger, companyRoutes);
app.use('/api/projects', authMiddleware, activityLogger, projectRoutes);
app.use('/api/sections', authMiddleware, activityLogger, sectionRoutes);
app.use('/api/designations', authMiddleware, activityLogger, designationRoutes);
app.use('/api/locations', authMiddleware, activityLogger, locationRoutes);
app.use('/api/cities', authMiddleware, activityLogger, cityRoutes);
app.use('/api/provinces', authMiddleware, activityLogger, provinceRoutes);
app.use('/api/countries', authMiddleware, activityLogger, countryRoutes);
app.use('/api/loans', authMiddleware, activityLogger, loanRoutes);
app.use('/api/final-settlements', authMiddleware, activityLogger, finalSettlementRoutes);
app.use('/api/leaves', authMiddleware, activityLogger, require('./routes/leaves'));
app.use('/api/hr/reports/payroll', authMiddleware, activityLogger, payrollReportsRoutes);
app.use('/api/hr/reports/attendance', authMiddleware, activityLogger, attendanceReportsRoutes);
app.use('/api/hr/reports', authMiddleware, activityLogger, hrReportsRoutes);
app.use('/api/payslips', authMiddleware, activityLogger, payslipRoutes);
// Public routes (no authentication required)
app.use('/api/job-postings/apply', require('./routes/publicJobPostings'));
app.use('/api/applications/public', require('./routes/publicApplications'));
app.use('/api/applications/easy-apply', easyApplyRoutes);
app.use('/api/public-approvals', require('./routes/publicApprovals')); // Public approval endpoints
app.use('/api/hiring', hiringRoutes); // Hiring system endpoints (includes public routes)
app.use('/api/employee-onboarding', employeeOnboardingRoutes); // Employee onboarding endpoints

// Protected routes (authentication required)
app.use('/api/job-postings', authMiddleware, activityLogger, jobPostingRoutes);
// Mount candidate routes with authentication
app.use('/api/candidates', authMiddleware, activityLogger, candidateRoutes);
app.use('/api/public/candidates', require('./routes/publicCandidates')); // Public candidate routes
app.use('/api/candidate-approvals', authMiddleware, activityLogger, candidateApprovalRoutes);
app.use('/api/applications', authMiddleware, activityLogger, applicationRoutes);
app.use('/api/notifications', authMiddleware, activityLogger, notificationRoutes);
app.use('/api/courses', authMiddleware, activityLogger, courseRoutes);
app.use('/api/enrollments', authMiddleware, activityLogger, enrollmentRoutes);
app.use('/api/training-programs', authMiddleware, activityLogger, trainingProgramRoutes);
app.use('/api/zkteco', zktecoRoutes);
app.use('/api/zkbio', zkbioTimeRoutes);
app.use('/api/images', imageProxyRoutes);
app.use('/api/vehicles', authMiddleware, activityLogger, vehicleRoutes);
app.use('/api/vehicle-maintenance', authMiddleware, activityLogger, vehicleMaintenanceRoutes);
app.use('/api/vehicle-logbook', authMiddleware, activityLogger, vehicleLogBookRoutes);
app.use('/api/trakker', trakkerRoutes);
app.use('/api/groceries', authMiddleware, activityLogger, groceryRoutes);
app.use('/api/suppliers', authMiddleware, activityLogger, supplierRoutes);
app.use('/api/petty-cash', authMiddleware, activityLogger, pettyCashRoutes);
app.use('/api/events', authMiddleware, activityLogger, eventRoutes);
app.use('/api/staff-assignments', authMiddleware, activityLogger, staffAssignmentRoutes);
app.use('/api/staff-management', authMiddleware, activityLogger, staffManagementRoutes);
app.use('/api/attendance-proxy', attendanceProxyRoutes);
app.use('/api/utility-bills', authMiddleware, activityLogger, utilityBillRoutes);
app.use('/api/hr/arrears', authMiddleware, activityLogger, arrearsRoutes);
// Register file routes separately (without authMiddleware, handles auth internally with query token)
app.use('/api/rental-agreements', rentalAgreementRoutes.fileRouter);
app.use('/api/rental-agreements', authMiddleware, activityLogger, rentalAgreementRoutes);
app.use('/api/taj-rental-agreements', tajRentalAgreementRoutes.fileRouter);
app.use('/api/taj-rental-agreements', authMiddleware, activityLogger, tajRentalAgreementRoutes);
app.use('/api/rental-management', authMiddleware, activityLogger, rentalManagementRoutes);
app.use('/api/payment-settlements', authMiddleware, activityLogger, paymentSettlementRoutes);
app.use('/api/it', authMiddleware, activityLogger, itRoutes);
// Audit sub-routes (must come before main audit route)
app.use('/api/audit/findings', authMiddleware, activityLogger, auditFindingsRoutes);
app.use('/api/audit/corrective-actions', authMiddleware, activityLogger, require('./routes/correctiveActions'));
app.use('/api/audit/trail', authMiddleware, activityLogger, auditTrailRoutes);
app.use('/api/audit/reports', authMiddleware, activityLogger, require('./routes/auditReports'));
app.use('/api/audit/schedules', authMiddleware, activityLogger, require('./routes/auditSchedules'));

// Main audit routes (must come after sub-routes)
app.use('/api/audit', authMiddleware, activityLogger, auditRoutes);

// Sub-role management routes
app.use('/api/sub-roles', subRoleRoutes);
app.use('/api/user-sub-roles', userSubRoleRoutes);
app.use('/api/roles', authMiddleware, activityLogger, require('./routes/roles'));

// Taj Residencia routes
app.use('/api/taj-residencia', authMiddleware, activityLogger, tajResidenciaRoutes);
app.use('/api', tajResidenciaComplaintsRoutes);
app.use('/api/taj-utilities/rental-management', authMiddleware, activityLogger, tajRentalManagementRoutes);
app.use('/api/taj-utilities/cam-charges', authMiddleware, activityLogger, camChargesRoutes);
app.use('/api/taj-utilities/electricity', authMiddleware, activityLogger, electricityRoutes);
app.use('/api/taj-utilities/properties', authMiddleware, activityLogger, tajPropertiesRoutes);
app.use('/api/taj-utilities/invoices', authMiddleware, activityLogger, propertyInvoicesRoutes);
app.use('/api/taj-utilities/receipts', authMiddleware, activityLogger, propertyReceiptsRoutes);
app.use('/api/taj-utilities/charges-slabs', authMiddleware, activityLogger, chargesSlabsRoutes);
app.use('/api/taj-utilities/water-utility-slabs', authMiddleware, activityLogger, waterUtilitySlabsRoutes);
app.use('/api/taj-utilities/residents', authMiddleware, activityLogger, tajResidentsRoutes);
app.use('/api/document-tracking', authMiddleware, activityLogger, documentTrackingRoutes);
app.use('/api/evaluation-documents', authMiddleware, activityLogger, evaluationDocumentsRoutes);
app.use('/api/indents', authMiddleware, activityLogger, indentsRoutes);
app.use('/api/evaluation-level0-authorities', authMiddleware, activityLogger, evaluationLevel0AuthoritiesRoutes);
app.use('/api/tracking', authMiddleware, userTrackingRoutes); // Don't add activityLogger to tracking routes to avoid recursion
// Public evaluation documents route (token-based access)
app.use('/api/public/evaluation-documents', require('./routes/publicEvaluationDocuments'));

// 404 handler (only for API routes) - must be after all API routes
// Use app.all to catch all HTTP methods, but only for unmatched API routes
app.all('/api/*', (req, res, next) => {
  // If we reach here, the route wasn't matched by any previous route
  res.status(404).json({
    success: false,
    message: 'API route not found',
    path: req.path,
    method: req.method
  });
});

// Error handling middleware
app.use(errorHandler);

// Serve React app for client-side routing (must be after API routes)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
} else {
  // Catch-all route for non-API requests in development - return 404 for any non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes - let them be handled by the API 404 handler above
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.status(404).json({ 
      error: 'API endpoint not found',
      message: 'This route is not handled by the backend API',
      availableRoutes: '/api/*'
    });
  });
}

const PORT = process.env.PORT || 5001;

// Initialize Change Stream service after MongoDB connection
mongoose.connection.once('open', async () => {
  try {
    // Initialize services in parallel for faster startup
    console.log('🚀 Initializing services in parallel...');
    
    const initPromises = [
      // Initialize Change Stream service
      (async () => {
        console.log('🚀 Initializing Change Stream service...');
        changeStreamService = new ChangeStreamService();
        await changeStreamService.start();
        console.log('✅ Change Stream service initialized successfully');
      })(),
      
      // Initialize ZKBio Time WebSocket Proxy (non-blocking)
      (async () => {
        console.log('🔌 Initializing ZKBio Time WebSocket Proxy...');
        zkbioTimeWebSocketProxy = new ZKBioTimeWebSocketProxy();
        zkbioTimeWebSocketProxy.initializeSocketIO(server);
        setZKBioTimeWebSocketProxy(zkbioTimeWebSocketProxy);
        console.log('✅ ZKBio Time WebSocket Proxy initialized');
        
        // Connect WebSockets asynchronously (non-blocking)
        setTimeout(async () => {
          console.log('🧪 Testing ZKBio Time connection...');
          const connectionTest = await zkbioTimeWebSocketProxy.testConnection();
          
          if (connectionTest) {
            console.log('✅ Connection test passed, starting WebSocket connections...');
          } else {
            console.log('⚠️  Connection test failed, will attempt WebSocket connections anyway...');
          }
          
          // Connect all WebSockets in parallel instead of sequentially
          zkbioTimeWebSocketProxy.connectToZKBioTime();
          zkbioTimeWebSocketProxy.connectToChartWebSocket();
          zkbioTimeWebSocketProxy.connectToDeviceWebSocket();
          zkbioTimeWebSocketProxy.connectToDepartmentWebSocket();
          
          // Start periodic retry mechanism
          setTimeout(() => {
            zkbioTimeWebSocketProxy.startPeriodicRetry();
          }, 2000);
        }, 500); // Reduced from 2000ms to 500ms
      })(),
      
      // Start IT Notification Service (non-blocking)
      (async () => {
        console.log('🔔 Starting IT Notification Service...');
        itNotificationService.start();
        console.log('✅ IT Notification Service started successfully');
      })()
    ];
    
    // Wait for all critical services to initialize
    await Promise.all(initPromises);
    console.log('✅ All services initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    // Don't block server startup if services fail
  }
});

// Scheduled Sync Service is already initialized as singleton

// Initialize Anniversary Leave Scheduler
const AnniversaryLeaveScheduler = require('./services/anniversaryLeaveScheduler');

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 SGC ERP Server running on port ${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`🌐 API Base URL: http://0.0.0.0:${PORT}/api`);
  console.log(`🔒 Server bound to all interfaces (0.0.0.0)`);
  
  // Start Anniversary Leave Scheduler
  try {
    AnniversaryLeaveScheduler.start();
    console.log('✅ Anniversary Leave Scheduler started successfully');
  } catch (error) {
    console.error('❌ Failed to start Anniversary Leave Scheduler:', error);
  }
  
  // Automatically sync any missed attendance records on startup
  // Note: This is disabled since we're using real-time WebSocket connection
  // The ZKTeco device sends data in real-time, so no scheduled sync is needed
  
  // try {
  //   console.log('🔄 Checking for missed attendance records...');
  //   const today = new Date();
  //   const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  //   
  //   const syncResult = await attendanceService.syncZKTecoAttendance(yesterday, today);
  //   if (syncResult.success) {
  //     console.log(`✅ Auto-sync completed: ${syncResult.data.created} created, ${syncResult.data.updated} updated`);
  //   } else {
  //     console.log('⚠️ Auto-sync failed, but continuing...');
  //   }
  // } catch (error) {
  //   console.error('⚠️ Auto-sync error (continuing anyway):', error.message);
  // }
  

});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Stop Change Stream service
  if (changeStreamService) {
    changeStreamService.stop();
    console.log('✅ Change Stream service stopped');
  }
  
  // Stop ZKBio Time WebSocket Proxy
  if (zkbioTimeWebSocketProxy) {
    zkbioTimeWebSocketProxy.disconnect();
    console.log('✅ ZKBio Time WebSocket Proxy stopped');
  }
  
  // Stop ZKBio Time background service
  zkbioTimeBackgroundService.stop();
  console.log('✅ ZKBio Time background service stopped');
  
  // Stop IT Notification Service
  itNotificationService.stop();
  console.log('✅ IT Notification Service stopped');
  
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  
  // Stop Change Stream service
  if (changeStreamService) {
    changeStreamService.stop();
    console.log('✅ Change Stream service stopped');
  }
  
  // Stop ZKBio Time WebSocket Proxy
  if (zkbioTimeWebSocketProxy) {
    zkbioTimeWebSocketProxy.disconnect();
    console.log('✅ ZKBio Time WebSocket Proxy stopped');
  }
  
  // Stop ZKBio Time background service
  zkbioTimeBackgroundService.stop();
  console.log('✅ ZKBio Time background service stopped');
  
  // Stop IT Notification Service
  itNotificationService.stop();
  console.log('✅ IT Notification Service stopped');
  
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
}); 