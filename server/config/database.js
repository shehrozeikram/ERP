const mongoose = require('mongoose');

/**
 * Choose database URI:
 * - Local dev: use MONGODB_URI_LOCAL when set and not in production (keeps production DB untouched).
 * - Production: use MONGODB_URI only (server production database).
 */
function getMongoUri() {
  const isProduction = process.env.NODE_ENV === 'production';
  const localUri = process.env.MONGODB_URI_LOCAL;
  if (!isProduction && localUri) {
    return { uri: localUri, isLocal: true };
  }
  return { uri: process.env.MONGODB_URI, isLocal: false };
}

const connectDB = async () => {
  try {
    const { uri, isLocal } = getMongoUri();
    if (!uri) {
      throw new Error(
        isLocal
          ? 'MONGODB_URI_LOCAL is not set (use it for local dev). Set MONGODB_URI for production.'
          : 'MONGODB_URI is not set'
      );
    }

    const baseOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 20,
      minPoolSize: isLocal ? 1 : 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
      bufferCommands: true,
      monitorCommands: false,
    };

    const atlasOptions = {
      tls: true,
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority',
    };

    const isAtlas = uri.includes('mongodb.net') || uri.includes('mongodb+srv');
    const options = isAtlas ? { ...baseOptions, ...atlasOptions } : baseOptions;

    const conn = await mongoose.connect(uri, options);

    console.log(
      isLocal
        ? `✅ MongoDB Connected (LOCAL): ${conn.connection.host}`
        : `✅ MongoDB Connected: ${conn.connection.host}`
    );

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