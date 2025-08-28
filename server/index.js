const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

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


// Import services
const ZKTecoWebSocketService = require('./services/zktecoWebSocketService');
const attendanceService = require('./services/attendanceService');
const ChangeStreamService = require('./services/changeStreamService');

// Initialize services
let zktecoWebSocketService;
let changeStreamService;

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// Import database configuration
const { connectDB } = require('./config/database');

// Database connection
console.log('MongoDB URI:', process.env.MONGODB_URI);
connectDB();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Send initial connection status
  socket.emit('connection_status', { 
    status: 'connected', 
    message: 'Connected to real-time attendance service',
    timestamp: new Date()
  });

  // Handle client joining attendance room
  socket.on('join_attendance', () => {
    socket.join('attendance');
    console.log(`👥 Client ${socket.id} joined attendance room`);
    socket.emit('room_joined', { room: 'attendance', message: 'Joined attendance updates room' });
  });

  // Handle client leaving attendance room
  socket.on('leave_attendance', () => {
    socket.leave('attendance');
    console.log(`👋 Client ${socket.id} left attendance room`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Initialize Change Stream service

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting (disabled for development)
if (process.env.NODE_ENV === 'production') {
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
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files
app.use('/uploads', express.static('uploads'));

// Note: React build files are now served by nginx, not by Node.js

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'SGC ERP System is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
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
app.use('/api/hr/reports', authMiddleware, hrReportsRoutes);
app.use('/api/payslips', authMiddleware, payslipRoutes);
// Public routes (no authentication required)
app.use('/api/job-postings/apply', require('./routes/publicJobPostings'));

// Catch-all route for non-API requests - return 404 for any non-API routes
app.get('*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    message: 'This route is not handled by the backend API',
    availableRoutes: '/api/*'
  });
});
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
    const changeStreamService = new ChangeStreamService();
    await changeStreamService.start();
    console.log('✅ Change Stream service initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Change Stream service:', error);
  }
  
  // Initialize ZKTeco WebSocket service
  try {
    console.log('🚀 Initializing ZKTeco WebSocket service...');
    zktecoWebSocketService = new ZKTecoWebSocketService(io);
    await zktecoWebSocketService.startWebSocketConnection();
    console.log('✅ ZKTeco WebSocket service initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize ZKTeco WebSocket service:', error);
  }
});

// Scheduled Sync Service is already initialized as singleton

server.listen(PORT, async () => {
  console.log(`🚀 SGC ERP Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔌 Socket.IO server running on port ${PORT}`);
  

  
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
  
  // Stop ZKTeco WebSocket service
  try {
    zktecoWebSocketService.stopWebSocketConnection();
    console.log('✅ ZKTeco WebSocket service stopped');
  } catch (error) {
    console.error('⚠️ Error stopping ZKTeco WebSocket service:', error);
  }
  
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
  
  // Stop ZKTeco WebSocket service
  try {
    zktecoWebSocketService.stopWebSocketConnection();
    console.log('✅ ZKTeco WebSocket service stopped');
  } catch (error) {
    console.error('⚠️ Error stopping ZKTeco WebSocket service:', error);
  }
  
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
}); 