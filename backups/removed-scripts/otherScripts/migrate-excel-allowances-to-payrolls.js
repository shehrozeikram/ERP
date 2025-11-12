const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const Payroll = require('../models/hr/Payroll');

async function migrateExcelAllowancesToPayrolls() {
  try {
    // Connect to cloud database
    const MONGODB_URI = 'mongodb+srv://shehroze:Cricket%23007@erp.fss65hf.mongodb.net/sgc_erp?retryWrites=true&w=majority';
    await mongoose.connect(MONGODB_URI);
    
    console.log('🔄 Migrating Excel Allowances to Payrolls Collection:');
    console.log('==================================================');
    
    // Get all employees with excel allowance values
    const employeesWithExcelAllowances = await Employee.find({
      $or: [
        { excelConveyanceAllowance: { $gt: 0 } },
        { excelHouseAllowance: { $gt: 0 } },
        { excelFoodAllowance: { $gt: 0 } },
        { excelVehicleFuelAllowance: { $gt: 0 } },
        { excelMedicalAllowance: { $gt: 0 } }
      ]
    }).select('_id employeeId firstName lastName excelConveyanceAllowance excelHouseAllowance excelFoodAllowance excelVehicleFuelAllowance excelMedicalAllowance');
    
    console.log(`📊 Found ${employeesWithExcelAllowances.length} employees with Excel allowance values`);
    
    let totalUpdatedPayrolls = 0;
    let totalSkippedPayrolls = 0;
    
    for (const employee of employeesWithExcelAllowances) {
      console.log(`\n👤 Processing Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.employeeId})`);
      
      // Get all payrolls for this employee
      const payrolls = await Payroll.find({ employee: employee._id });
      
      if (payrolls.length === 0) {
        console.log(`   ⚠️  No payrolls found for this employee`);
        continue;
      }
      
      console.log(`   📋 Found ${payrolls.length} payroll record(s)`);
      
      // Prepare excel allowance values
      const excelAllowances = {
        conveyance: employee.excelConveyanceAllowance || 0,
        houseRent: employee.excelHouseAllowance || 0,
        food: employee.excelFoodAllowance || 0,
        vehicleFuel: employee.excelVehicleFuelAllowance || 0,
        medical: employee.excelMedicalAllowance || 0
      };
      
      console.log(`   💰 Excel Allowances:`);
      console.log(`      Conveyance: Rs. ${excelAllowances.conveyance}`);
      console.log(`      House Rent: Rs. ${excelAllowances.houseRent}`);
      console.log(`      Food: Rs. ${excelAllowances.food}`);
      console.log(`      Vehicle & Fuel: Rs. ${excelAllowances.vehicleFuel}`);
      console.log(`      Medical: Rs. ${excelAllowances.medical}`);
      
      // Update each payroll for this employee
      for (const payroll of payrolls) {
        let hasChanges = false;
        
        // Update allowances object with excel values
        if (!payroll.allowances) {
          payroll.allowances = {};
        }
        
        // Update each allowance type
        if (excelAllowances.conveyance > 0) {
          if (!payroll.allowances.conveyance) {
            payroll.allowances.conveyance = { isActive: false, amount: 0 };
          }
          payroll.allowances.conveyance.amount = excelAllowances.conveyance;
          payroll.allowances.conveyance.isActive = true;
          hasChanges = true;
        }
        
        if (excelAllowances.houseRent > 0) {
          if (!payroll.allowances.houseRent) {
            payroll.allowances.houseRent = { isActive: false, amount: 0 };
          }
          payroll.allowances.houseRent.amount = excelAllowances.houseRent;
          payroll.allowances.houseRent.isActive = true;
          hasChanges = true;
        }
        
        if (excelAllowances.food > 0) {
          if (!payroll.allowances.food) {
            payroll.allowances.food = { isActive: false, amount: 0 };
          }
          payroll.allowances.food.amount = excelAllowances.food;
          payroll.allowances.food.isActive = true;
          hasChanges = true;
        }
        
        if (excelAllowances.vehicleFuel > 0) {
          if (!payroll.allowances.vehicleFuel) {
            payroll.allowances.vehicleFuel = { isActive: false, amount: 0 };
          }
          payroll.allowances.vehicleFuel.amount = excelAllowances.vehicleFuel;
          payroll.allowances.vehicleFuel.isActive = true;
          hasChanges = true;
        }
        
        if (excelAllowances.medical > 0) {
          if (!payroll.allowances.medical) {
            payroll.allowances.medical = { isActive: false, amount: 0 };
          }
          payroll.allowances.medical.amount = excelAllowances.medical;
          payroll.allowances.medical.isActive = true;
          hasChanges = true;
        }
        
        if (hasChanges) {
          // Also update direct allowance fields for backward compatibility
          payroll.conveyanceAllowance = excelAllowances.conveyance;
          payroll.houseRentAllowance = excelAllowances.houseRent;
          payroll.foodAllowance = excelAllowances.food;
          payroll.vehicleFuelAllowance = excelAllowances.vehicleFuel;
          payroll.medicalAllowance = excelAllowances.medical;
          
          await payroll.save({ validateBeforeSave: false });
          totalUpdatedPayrolls++;
          
          console.log(`      ✅ Updated payroll ${payroll.month}/${payroll.year}`);
        } else {
          totalSkippedPayrolls++;
          console.log(`      ⏭️  Skipped payroll ${payroll.month}/${payroll.year} (no changes needed)`);
        }
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log('====================');
    console.log(`✅ Total Payrolls Updated: ${totalUpdatedPayrolls}`);
    console.log(`⏭️  Total Payrolls Skipped: ${totalSkippedPayrolls}`);
    console.log(`👥 Total Employees Processed: ${employeesWithExcelAllowances.length}`);
    
    console.log('\n🎯 Migration Complete!');
    console.log('======================');
    console.log('All Excel allowance values have been migrated to:');
    console.log('• allowances.conveyance.amount');
    console.log('• allowances.houseRent.amount');
    console.log('• allowances.food.amount');
    console.log('• allowances.vehicleFuel.amount');
    console.log('• allowances.medical.amount');
    console.log('');
    console.log('Direct allowance fields have also been updated for backward compatibility.');
    
    await mongoose.disconnect();
    console.log('\n🎉 Excel allowances migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    if (error.errors) {
      console.error('Validation Errors:', error.errors);
    }
  }
}

migrateExcelAllowancesToPayrolls();
