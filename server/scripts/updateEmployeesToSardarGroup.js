const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

// Import models
const Employee = require('../models/hr/Employee');
const PlacementCompany = require('../models/hr/Company');

// Database connection
const { connectDB } = require('../config/database');

const updateEmployeesToSardarGroup = async () => {
  try {
    console.log('🚀 Starting Employee Company Update to Sardar Group...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected successfully');

    // First, let's check current companies
    const currentCompanies = await PlacementCompany.find({});
    console.log(`📊 Found ${currentCompanies.length} companies in the system:`);
    currentCompanies.forEach(company => {
      console.log(`   - ${company.name} (${company.code}) - Active: ${company.isActive}`);
    });

    // Find or create Sardar Group company
    let sardarGroup = await PlacementCompany.findOne({ 
      $or: [
        { name: { $regex: /sardar group/i } },
        { code: { $regex: /sardar/i } }
      ]
    });

    if (!sardarGroup) {
      console.log('🏢 Creating Sardar Group company...');
      sardarGroup = new PlacementCompany({
        name: 'Sardar Group',
        code: 'SARDAR',
        type: 'Private Limited',
        industry: 'Real Estate & Construction',
        isActive: true,
        description: 'Sardar Group of Companies - Parent Company'
      });
      await sardarGroup.save();
      console.log('✅ Sardar Group company created successfully');
    } else {
      console.log('✅ Sardar Group company found:', sardarGroup.name);
    }

    // Find all employees
    const employees = await Employee.find({});
    console.log(`📊 Found ${employees.length} employees to update`);

    let updatedCount = 0;
    let errors = [];

    for (const employee of employees) {
      try {
        console.log(`\n👤 Processing Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})`);
        
        // Check current company
        let currentCompany = null;
        if (employee.placementCompany) {
          currentCompany = await PlacementCompany.findById(employee.placementCompany);
          console.log(`   Current Company: ${currentCompany ? currentCompany.name : 'None'}`);
        } else {
          console.log(`   Current Company: None`);
        }

        // Update employee to Sardar Group
        await Employee.findByIdAndUpdate(employee._id, {
          placementCompany: sardarGroup._id
        });

        console.log(`✅ Updated ${employee.firstName} ${employee.lastName} to Sardar Group`);
        updatedCount++;

      } catch (error) {
        console.error(`❌ Error processing employee ${employee.firstName} ${employee.lastName}:`, error.message);
        errors.push({ 
          employeeId: employee.employeeId, 
          name: `${employee.firstName} ${employee.lastName}`, 
          error: error.message 
        });
      }
    }

    // Now let's deactivate all other companies except Sardar Group
    console.log('\n🏢 Deactivating all other companies...');
    const otherCompanies = await PlacementCompany.find({ 
      _id: { $ne: sardarGroup._id } 
    });

    let deactivatedCount = 0;
    for (const company of otherCompanies) {
      try {
        await PlacementCompany.findByIdAndUpdate(company._id, { isActive: false });
        console.log(`✅ Deactivated company: ${company.name}`);
        deactivatedCount++;
      } catch (error) {
        console.error(`❌ Error deactivating company ${company.name}:`, error.message);
      }
    }

    // Summary
    console.log('\n📊 Update Summary:');
    console.log(`✅ Total employees processed: ${employees.length}`);
    console.log(`✅ Employees updated to Sardar Group: ${updatedCount}`);
    console.log(`✅ Other companies deactivated: ${deactivatedCount}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(error => {
        console.log(`   ${error.name} (${error.employeeId}): ${error.error}`);
      });
    }

    // Final company status
    const finalCompanies = await PlacementCompany.find({});
    console.log('\n🏢 Final Company Status:');
    finalCompanies.forEach(company => {
      console.log(`   - ${company.name} (${company.code}) - Active: ${company.isActive}`);
    });

    console.log('\n🎉 Employee company update completed successfully!');

  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
};

// Run the update
if (require.main === module) {
  updateEmployeesToSardarGroup();
}

module.exports = updateEmployeesToSardarGroup; 