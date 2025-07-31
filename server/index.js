const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();

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
const publicJobPostingRoutes = require('./routes/publicJobPostings');
const candidateRoutes = require('./routes/candidates');
const candidateApprovalRoutes = require('./routes/candidateApprovals');
const publicApprovalRoutes = require('./routes/publicApprovals');
const applicationRoutes = require('./routes/applications');
const publicApplicationRoutes = require('./routes/publicApplications');
const courseRoutes = require('./routes/courses');
const enrollmentRoutes = require('./routes/enrollments');
const trainingProgramRoutes = require('./routes/trainingPrograms');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// Database connection
console.log('MongoDB URI:', process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

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
app.use('/api/job-postings/apply', publicJobPostingRoutes);
app.use('/api/applications/public', publicApplicationRoutes);
app.use('/api/public-approvals', publicApprovalRoutes); // Public approval endpoints

// Protected routes (authentication required)
app.use('/api/job-postings', authMiddleware, jobPostingRoutes);
app.use('/api/candidates', authMiddleware, candidateRoutes);
app.use('/api/candidate-approvals', authMiddleware, candidateApprovalRoutes);
app.use('/api/applications', authMiddleware, applicationRoutes);
app.use('/api/courses', authMiddleware, courseRoutes);
app.use('/api/enrollments', authMiddleware, enrollmentRoutes);
app.use('/api/training-programs', authMiddleware, trainingProgramRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 SGC ERP Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 API Base URL: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
}); 