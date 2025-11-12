const mongoose = require('mongoose');

/**
 * Database Index Optimization Script for Leave Management
 * 
 * This script adds necessary indexes to improve query performance
 * for the leave management system.
 */

async function addLeaveManagementIndexes() {
  try {
    console.log('🚀 Adding database indexes for leave management optimization...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');
    
    const db = mongoose.connection.db;
    
    // LeaveRequest collection indexes
    console.log('📝 Adding LeaveRequest indexes...');
    
    await db.collection('leaverequests').createIndex(
      { employee: 1, status: 1, isActive: 1 },
      { name: 'employee_status_active_idx' }
    );
    
    await db.collection('leaverequests').createIndex(
      { employee: 1, leaveYear: 1, isActive: 1 },
      { name: 'employee_year_active_idx' }
    );
    
    await db.collection('leaverequests').createIndex(
      { startDate: 1, endDate: 1, isActive: 1 },
      { name: 'date_range_active_idx' }
    );
    
    await db.collection('leaverequests').createIndex(
      { status: 1, startDate: 1, isActive: 1 },
      { name: 'status_startdate_active_idx' }
    );
    
    await db.collection('leaverequests').createIndex(
      { leaveType: 1, status: 1, isActive: 1 },
      { name: 'leavetype_status_active_idx' }
    );
    
    // LeaveBalance collection indexes
    console.log('📊 Adding LeaveBalance indexes...');
    
    await db.collection('leavebalances').createIndex(
      { employee: 1, year: 1, isActive: 1 },
      { name: 'employee_year_active_idx', unique: true }
    );
    
    await db.collection('leavebalances').createIndex(
      { employee: 1, workYear: 1, isActive: 1 },
      { name: 'employee_workyear_active_idx', unique: true }
    );
    
    await db.collection('leavebalances').createIndex(
      { year: 1, isActive: 1 },
      { name: 'year_active_idx' }
    );
    
    await db.collection('leavebalances').createIndex(
      { expirationDate: 1, isActive: 1 },
      { name: 'expiration_active_idx' }
    );
    
    // Employee collection indexes
    console.log('👥 Adding Employee indexes...');
    
    await db.collection('employees').createIndex(
      { isActive: 1, isDeleted: 1 },
      { name: 'active_notdeleted_idx' }
    );
    
    await db.collection('employees').createIndex(
      { hireDate: 1, isActive: 1 },
      { name: 'hiredate_active_idx' }
    );
    
    await db.collection('employees').createIndex(
      { employeeId: 1, isActive: 1 },
      { name: 'employeeid_active_idx' }
    );
    
    // LeaveType collection indexes
    console.log('📋 Adding LeaveType indexes...');
    
    await db.collection('leavetypes').createIndex(
      { isActive: 1, name: 1 },
      { name: 'active_name_idx' }
    );
    
    await db.collection('leavetypes').createIndex(
      { code: 1, isActive: 1 },
      { name: 'code_active_idx' }
    );
    
    // AnnualLeaveBalance collection indexes (if exists)
    console.log('🗓️ Adding AnnualLeaveBalance indexes...');
    
    try {
      await db.collection('annualleavebalances').createIndex(
        { employeeId: 1, year: 1, isActive: 1 },
        { name: 'employee_year_active_idx', unique: true }
      );
      
      await db.collection('annualleavebalances').createIndex(
        { employeeId: 1, anniversaryDate: 1, isActive: 1 },
        { name: 'employee_anniversary_active_idx' }
      );
      
      await db.collection('annualleavebalances').createIndex(
        { year: 1, isActive: 1 },
        { name: 'year_active_idx' }
      );
    } catch (error) {
      console.log('⚠️ AnnualLeaveBalance collection not found, skipping...');
    }
    
    // LeaveTransaction collection indexes (if exists)
    console.log('📜 Adding LeaveTransaction indexes...');
    
    try {
      await db.collection('leavetransactions').createIndex(
        { employeeId: 1, year: 1, isActive: 1 },
        { name: 'employee_year_active_idx' }
      );
      
      await db.collection('leavetransactions').createIndex(
        { employeeId: 1, transactionType: 1, isActive: 1 },
        { name: 'employee_type_active_idx' }
      );
      
      await db.collection('leavetransactions').createIndex(
        { processedAt: 1, isActive: 1 },
        { name: 'processed_active_idx' }
      );
      
      await db.collection('leavetransactions').createIndex(
        { anniversaryDate: 1, isActive: 1 },
        { name: 'anniversary_active_idx' }
      );
    } catch (error) {
      console.log('⚠️ LeaveTransaction collection not found, skipping...');
    }
    
    console.log('✅ All indexes added successfully!');
    
    // Show index information
    console.log('\n📊 Index Summary:');
    
    const collections = ['leaverequests', 'leavebalances', 'employees', 'leavetypes'];
    
    for (const collectionName of collections) {
      try {
        const indexes = await db.collection(collectionName).indexes();
        console.log(`\n${collectionName}:`);
        indexes.forEach(index => {
          console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
        });
      } catch (error) {
        console.log(`  ⚠️ Collection ${collectionName} not found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error adding indexes:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the script if called directly
if (require.main === module) {
  addLeaveManagementIndexes()
    .then(() => {
      console.log('\n🎉 Database optimization completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Database optimization failed:', error);
      process.exit(1);
    });
}

module.exports = addLeaveManagementIndexes;
