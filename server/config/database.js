const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Enhanced connection options for Atlas
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 30000, // Increased from 5000ms
      socketTimeoutMS: 60000, // Increased from 45000ms
      // SSL/TLS options
      ssl: true,
      sslValidate: true,
      // Retry options
      retryWrites: true,
      w: 'majority',
      // Connection timeout
      connectTimeoutMS: 30000, // Increased from 10000ms
      // Heartbeat settings
      heartbeatFrequencyMS: 10000,
      // Buffer settings (removed deprecated options)
      bufferCommands: false,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

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