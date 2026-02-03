const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Enhanced connection options for Atlas
      maxPoolSize: 20, // Increased from 10 to handle more concurrent connections
      minPoolSize: 2, // Increased from 1 to maintain minimum connections
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000, // Reduced from 30000ms for faster failure detection
      socketTimeoutMS: 45000, // Reduced from 60000ms
      // SSL/TLS options
      tls: true,
      tlsAllowInvalidCertificates: false,
      // Retry options
      retryWrites: true,
      w: 'majority',
      // Connection timeout
      connectTimeoutMS: 10000, // Reduced from 30000ms for faster connection attempts
      // Heartbeat settings
      heartbeatFrequencyMS: 10000,
      // Buffer settings
      bufferCommands: true,
      // Connection pool monitoring
      monitorCommands: false, // Disable in production for performance
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Sync Employee indexes (email partial index, employeeId partial unique for non-deleted only)
    try {
      const Employee = require('../models/hr/Employee');
      await Employee.syncIndexes();
    } catch (syncErr) {
      console.warn('⚠️ Employee index sync skipped:', syncErr.message);
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      await disconnectDB();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
  }
};

module.exports = { connectDB, disconnectDB }; 