const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const server = http.createServer(app);

// Import routes
const authRoutes = require('./routes/auth');
const hrRoutes = require('./routes/hr');
const payrollRoutes = require('./routes/payroll');
const attendanceRoutes = require('./routes/attendance');
const biometricRoutes = require('./routes/biometric');
const financeRoutes = require('./routes/finance');
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
const groceryRoutes = require('./routes/groceries');
const supplierRoutes = require('./routes/suppliers');
const pettyCashRoutes = require('./routes/pettyCash');
const eventRoutes = require('./routes/events');
const staffAssignmentRoutes = require('./routes/staffAssignments');
const attendanceProxyRoutes = require('./routes/attendanceProxy');
const utilityBillRoutes = require('./routes/utilityBills');
const arrearsRoutes = require('./routes/arrears');
const rentalAgreementRoutes = require('./routes/rentalAgreements');
const rentalManagementRoutes = require('./routes/rentalManagement');


// Import services
const attendanceService = require('./services/attendanceService');
const ChangeStreamService = require('./services/changeStreamService');
const ZKBioTimeWebSocketProxy = require('./services/zkbioTimeWebSocketProxy');

// Initialize services
let changeStreamService = null;
let zkbioTimeWebSocketProxy = null;

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// Import database configuration
const { connectDB } = require('./config/database');

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

// Database connection
console.log('MongoDB URI:', process.env.MONGODB_URI);
connectDB();



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
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use('/api/', limiter);
  console.log('🔒 Rate limiting enabled for production');
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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files with CORS headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
}, express.static(path.join(__dirname, 'uploads')));

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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/hr', authMiddleware, hrRoutes);
app.use('/api/payroll', authMiddleware, payrollRoutes);
app.use('/api/attendance', authMiddleware, attendanceRoutes);
app.use('/api/biometric', authMiddleware, biometricRoutes);
app.use('/api/finance', authMiddleware, financeRoutes);
app.use('/api/procurement', authMiddleware, procurementRoutes);
app.use('/api/sales', authMiddleware, salesRoutes);
app.use('/api/crm', authMiddleware, crmRoutes);
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);
app.use('/api/positions', authMiddleware, positionRoutes);
app.use('/api/banks', authMiddleware, bankRoutes);
app.use('/api/companies', authMiddleware, companyRoutes);
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/sections', authMiddleware, sectionRoutes);
app.use('/api/designations', authMiddleware, designationRoutes);
app.use('/api/locations', authMiddleware, locationRoutes);
app.use('/api/cities', authMiddleware, cityRoutes);
app.use('/api/provinces', authMiddleware, provinceRoutes);
app.use('/api/countries', authMiddleware, countryRoutes);
app.use('/api/loans', authMiddleware, loanRoutes);
app.use('/api/final-settlements', authMiddleware, finalSettlementRoutes);
app.use('/api/leaves', authMiddleware, require('./routes/leaves'));
app.use('/api/hr/reports/payroll', authMiddleware, payrollReportsRoutes);
app.use('/api/hr/reports/attendance', authMiddleware, attendanceReportsRoutes);
app.use('/api/hr/reports', authMiddleware, hrReportsRoutes);
app.use('/api/payslips', authMiddleware, payslipRoutes);
// Public routes (no authentication required)
app.use('/api/job-postings/apply', require('./routes/publicJobPostings'));
app.use('/api/applications/public', require('./routes/publicApplications'));
app.use('/api/applications/easy-apply', easyApplyRoutes);
app.use('/api/public-approvals', require('./routes/publicApprovals')); // Public approval endpoints
app.use('/api/hiring', hiringRoutes); // Hiring system endpoints (includes public routes)
app.use('/api/employee-onboarding', employeeOnboardingRoutes); // Employee onboarding endpoints

// Protected routes (authentication required)
app.use('/api/job-postings', authMiddleware, jobPostingRoutes);
// Mount candidate routes with authentication
app.use('/api/candidates', authMiddleware, candidateRoutes);
app.use('/api/public/candidates', require('./routes/publicCandidates')); // Public candidate routes
app.use('/api/candidate-approvals', authMiddleware, candidateApprovalRoutes);
app.use('/api/applications', authMiddleware, applicationRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/courses', authMiddleware, courseRoutes);
app.use('/api/enrollments', authMiddleware, enrollmentRoutes);
app.use('/api/training-programs', authMiddleware, trainingProgramRoutes);
app.use('/api/zkteco', zktecoRoutes);
app.use('/api/zkbio', zkbioTimeRoutes);
app.use('/api/images', imageProxyRoutes);
app.use('/api/vehicles', authMiddleware, vehicleRoutes);
app.use('/api/groceries', authMiddleware, groceryRoutes);
app.use('/api/suppliers', authMiddleware, supplierRoutes);
app.use('/api/petty-cash', authMiddleware, pettyCashRoutes);
app.use('/api/events', authMiddleware, eventRoutes);
app.use('/api/staff-assignments', authMiddleware, staffAssignmentRoutes);
app.use('/api/attendance-proxy', attendanceProxyRoutes);
app.use('/api/utility-bills', authMiddleware, utilityBillRoutes);
app.use('/api/hr/arrears', authMiddleware, arrearsRoutes);
app.use('/api/rental-agreements', authMiddleware, rentalAgreementRoutes);
app.use('/api/rental-management', authMiddleware, rentalManagementRoutes);

// Catch-all route for non-API requests - return 404 for any non-API routes
app.get('*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    message: 'This route is not handled by the backend API',
    availableRoutes: '/api/*'
  });
});


// Error handling middleware
app.use(errorHandler);

// Serve React app for client-side routing (must be after API routes)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// 404 handler (only for API routes)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found'
  });
});

const PORT = process.env.PORT || 5001;

// Initialize Change Stream service after MongoDB connection
mongoose.connection.once('open', async () => {
  try {
    console.log('🚀 Initializing Change Stream service...');
    changeStreamService = new ChangeStreamService();
    await changeStreamService.start();
    console.log('✅ Change Stream service initialized successfully');
    
    // Initialize ZKBio Time WebSocket Proxy
    console.log('🔌 Initializing ZKBio Time WebSocket Proxy...');
    zkbioTimeWebSocketProxy = new ZKBioTimeWebSocketProxy();
    zkbioTimeWebSocketProxy.initializeSocketIO(server);
    
    // Connect image proxy to WebSocket proxy
    setZKBioTimeWebSocketProxy(zkbioTimeWebSocketProxy);
    
    // Test and connect to ZKBio Time WebSocket
    setTimeout(async () => {
      console.log('🧪 Testing ZKBio Time connection before starting WebSocket...');
      const connectionTest = await zkbioTimeWebSocketProxy.testConnection();
      
      if (connectionTest) {
        console.log('✅ Connection test passed, starting WebSocket connections...');
        zkbioTimeWebSocketProxy.connectToZKBioTime();
        // Start chart WebSocket connection after a short delay
        setTimeout(() => {
          zkbioTimeWebSocketProxy.connectToChartWebSocket();
        }, 1000);
        // Start device WebSocket connection after another delay
        setTimeout(() => {
          zkbioTimeWebSocketProxy.connectToDeviceWebSocket();
        }, 2000);
        // Start department WebSocket connection after another delay
        setTimeout(() => {
          zkbioTimeWebSocketProxy.connectToDepartmentWebSocket();
        }, 3000);
      } else {
        console.log('⚠️  Connection test failed, will attempt WebSocket connections anyway...');
        zkbioTimeWebSocketProxy.connectToZKBioTime();
        setTimeout(() => {
          zkbioTimeWebSocketProxy.connectToChartWebSocket();
        }, 1000);
        setTimeout(() => {
          zkbioTimeWebSocketProxy.connectToDeviceWebSocket();
        }, 2000);
        setTimeout(() => {
          zkbioTimeWebSocketProxy.connectToDepartmentWebSocket();
        }, 3000);
      }
      
      // Start periodic retry mechanism for disabled WebSockets
      setTimeout(() => {
        zkbioTimeWebSocketProxy.startPeriodicRetry();
      }, 4000); // Start after all WebSockets have had a chance to connect
    }, 2000); // Wait 2 seconds for server to be fully ready
    
    console.log('✅ ZKBio Time WebSocket Proxy initialized');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }
});

// Scheduled Sync Service is already initialized as singleton

server.listen(PORT, 'localhost', async () => {
  console.log(`🚀 SGC ERP Server running on port ${PORT}`);
  console.log(`📊 Environment: ${NODE_ENV}`);
  console.log(`🌐 API Base URL: http://0.0.0.0:${PORT}/api`);
  console.log(`🔒 Server bound to all interfaces (0.0.0.0)`);
  

  
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
  
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
}); 