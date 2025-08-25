/**
 * Check users and authentication status in cloud database
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');

async function checkUsersAndAuth() {
  try {
    console.log('🔍 Checking Users and Authentication Status...');
    console.log('---');
    
    // Connect to cloud database
    await connectDB();
    
    console.log('📊 Database Connection Info:');
    console.log('Host:', mongoose.connection.host);
    console.log('Database Name:', mongoose.connection.name);
    
    console.log('---');
    console.log('👥 Users Collection Status:');
    
    const db = mongoose.connection.db;
    
    // Check users collection
    const userCount = await db.collection('users').countDocuments();
    console.log('Total Users:', userCount + ' records');
    
    // Check active users
    const activeUserCount = await db.collection('users').countDocuments({ isActive: true });
    console.log('Active Users:', activeUserCount + ' records');
    
    // Check users by role
    const adminUsers = await db.collection('users').countDocuments({ role: 'admin', isActive: true });
    const hrUsers = await db.collection('users').countDocuments({ role: 'hr_manager', isActive: true });
    const regularUsers = await db.collection('users').countDocuments({ role: 'employee', isActive: true });
    
    console.log('Admin Users:', adminUsers + ' records');
    console.log('HR Manager Users:', hrUsers + ' records');
    console.log('Employee Users:', regularUsers + ' records');
    
    if (userCount > 0) {
      console.log('---');
      console.log('📋 Sample Users:');
      
      const sampleUsers = await db.collection('users').find({ isActive: true }).limit(5).toArray();
      sampleUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. Email: ${user.email || 'N/A'}`);
        console.log(`     Role: ${user.role || 'N/A'}`);
        console.log(`     Active: ${user.isActive ? 'Yes' : 'No'}`);
        console.log(`     Created: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}`);
        console.log('');
      });
    }
    
    console.log('---');
    console.log('🔐 Authentication Check:');
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET ? 'Yes' : 'No');
    console.log('JWT_EXPIRE:', process.env.JWT_EXPIRE || 'Not set');
    
    // Check if there are any users that can access payroll
    const payrollAccessUsers = await db.collection('users').countDocuments({
      role: { $in: ['admin', 'hr_manager'] },
      isActive: true
    });
    
    console.log('Users with Payroll Access:', payrollAccessUsers + ' records');
    
    if (payrollAccessUsers === 0) {
      console.log('⚠️  WARNING: No users found with payroll access permissions!');
      console.log('   You need at least one user with role "admin" or "hr_manager"');
    } else {
      console.log('✅ Users with payroll access found');
    }
    
    console.log('---');
    console.log('📊 Payroll Access Summary:');
    console.log('   Total Users:', userCount);
    console.log('   Active Users:', activeUserCount);
    console.log('   Payroll Access Users:', payrollAccessUsers);
    console.log('   Available for Authentication:', payrollAccessUsers > 0 ? 'Yes' : 'No');
    
    console.log('---');
    console.log('✅ Users and authentication check complete');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  } finally {
    await disconnectDB();
  }
}

// Run the check
if (require.main === module) {
  checkUsersAndAuth();
}

module.exports = { checkUsersAndAuth };
