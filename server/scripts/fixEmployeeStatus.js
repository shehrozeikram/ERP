const mongoose = require('mongoose');
require('dotenv').config();

async function fixEmployeeStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    
    const db = mongoose.connection.db;
    
    console.log('🔧 Fixing employee status...');
    
    // Update all employees where isActive is null or undefined to true
    const result = await db.collection('employees').updateMany(
      { 
        $or: [
          { isActive: null },
          { isActive: { $exists: false } }
        ]
      },
      { 
        $set: { 
          isActive: true,
          employmentStatus: 'Active'
        } 
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} employees`);
    
    // Verify the fix
    const totalEmployees = await db.collection('employees').countDocuments();
    const activeEmployees = await db.collection('employees').countDocuments({
      isActive: true,
      employmentStatus: 'Active'
    });
    
    console.log(`📊 Total employees: ${totalEmployees}`);
    console.log(`📊 Active employees: ${activeEmployees}`);
    
    // Check distribution again
    const activeDistribution = await db.collection('employees').aggregate([
      {
        $group: {
          _id: '$isActive',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    console.log('✅ isActive distribution after fix:', activeDistribution);
    
    const statusDistribution = await db.collection('employees').aggregate([
      {
        $group: {
          _id: '$employmentStatus',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    console.log('✅ Employment status distribution after fix:', statusDistribution);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

fixEmployeeStatus(); 