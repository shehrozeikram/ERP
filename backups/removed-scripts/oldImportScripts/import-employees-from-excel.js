const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Designation = require('../models/hr/Designation');
const Bank = require('../models/hr/Bank');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');
require('dotenv').config();

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Helper function to find or create reference
const findOrCreateReference = async (Model, field, value, createData = {}) => {
  if (!value) return null;
  
  try {
    // Try to find existing
    let ref = await Model.findOne({ 
      [field]: { $regex: new RegExp(value, 'i') } 
    });
    
    if (!ref) {
      // Create new if not found
      ref = await Model.create({ [field]: value, ...createData });
      console.log(`✅ Created new ${Model.modelName}: ${value}`);
    }
    
    return ref._id;
  } catch (error) {
    console.error(`❌ Error with ${Model.modelName}: ${error.message}`);
    return null;
  }
};

// Main import function
const importEmployeesFromExcel = async (filePath) => {
  try {
    console.log('📊 Reading Excel file...');
    
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📋 Found ${data.length} rows in Excel file`);
    
    if (data.length === 0) {
      console.log('❌ No data found in Excel file');
      return;
    }
    
    // Show sample data structure
    console.log('\n📋 Sample data structure:');
    console.log(Object.keys(data[0]));
    
    let successCount = 0;
    let errorCount = 0;
    let updateCount = 0;
    let createCount = 0;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Prepare employee data
        const employeeData = {
          // Basic Information
          firstName: row.firstName || row['First Name'] || row['First Name*'],
          lastName: row.lastName || row['Last Name'] || row['Last Name*'],
          email: row.email || row['Email*'],
          phone: row.phone || row['Phone'] || row['Phone*'],
          dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : undefined,
          gender: row.gender || row['Gender*'],
          idCard: row.idCard || row['ID Card'] || row['ID Card*'],
          nationality: row.nationality || row['Nationality*'],
          
          // Employment Information
          appointmentDate: row.appointmentDate ? new Date(row.appointmentDate) : undefined,
          probationPeriodMonths: row.probationPeriodMonths || row['Probation Period (Months)'] || 0,
          employmentStatus: row.employmentStatus || row['Employment Status'] || 'Active',
          
          // Salary Information
          salary: {
            basic: parseFloat(row.basicSalary || row['Basic Salary'] || row['Basic Salary*']) || 0,
            houseRent: parseFloat(row.houseRent || row['House Rent']) || 0,
            medical: parseFloat(row.medical || row['Medical']) || 0,
            conveyance: parseFloat(row.conveyance || row['Conveyance']) || 0,
            otherAllowances: parseFloat(row.otherAllowances || row['Other Allowances']) || 0
          },
          
          // Address Information
          address: {
            street: row.street || row['Street Address'] || '',
            city: null, // Will be set below
            state: null, // Will be set below
            country: null // Will be set below
          },
          
          // Emergency Contact
          emergencyContact: {
            name: row.emergencyContactName || row['Emergency Contact Name'] || '',
            relationship: row.emergencyContactRelation || row['Emergency Contact Relation'] || '',
            phone: row.emergencyContactPhone || row['Emergency Contact Phone'] || '',
            email: row.emergencyContactEmail || row['Emergency Contact Email'] || ''
          },
          
          // Additional Information
          qualification: row.qualification || row['Qualification'] || '',
          religion: row.religion || row['Religion'] || 'Islam',
          maritalStatus: row.maritalStatus || row['Marital Status'] || 'Single',
          spouseName: row.spouseName || row['Spouse Name'] || '',
          
          // Bank Information
          bankName: null, // Will be set below
          accountNumber: row.accountNumber || row['Account Number'] || '',
          foreignBankAccount: row.foreignBankAccount || row['Foreign Bank Account'] || ''
        };
        
        // Find or create references
        if (row.city || row['City']) {
          employeeData.address.city = await findOrCreateReference(City, 'name', row.city || row['City']);
        }
        
        if (row.state || row['State'] || row['Province']) {
          employeeData.address.state = await findOrCreateReference(Province, 'name', row.state || row['State'] || row['Province']);
        }
        
        if (row.country || row['Country']) {
          employeeData.address.country = await findOrCreateReference(Country, 'name', row.country || row['Country']);
        }
        
        if (row.bankName || row['Bank Name']) {
          employeeData.bankName = await findOrCreateReference(Bank, 'name', row.bankName || row['Bank Name']);
        }
        
        if (row.department || row['Department']) {
          employeeData.department = await findOrCreateReference(Department, 'name', row.department || row['Department']);
        }
        
        if (row.designation || row['Designation']) {
          employeeData.designation = await findOrCreateReference(Designation, 'name', row.designation || row['Designation']);
        }
        
        // Check if employee exists
        const existingEmployee = await Employee.findOne({ 
          $or: [
            { email: employeeData.email },
            { idCard: employeeData.idCard },
            { employeeId: row.employeeId || row['Employee ID'] }
          ]
        });
        
        if (existingEmployee) {
          // Update existing employee
          await Employee.findByIdAndUpdate(existingEmployee._id, employeeData, { new: true });
          updateCount++;
          console.log(`✅ Updated employee: ${employeeData.firstName} ${employeeData.lastName}`);
        } else {
          // Create new employee
          await Employee.create(employeeData);
          createCount++;
          console.log(`✅ Created new employee: ${employeeData.firstName} ${employeeData.lastName}`);
        }
        
        successCount++;
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing row ${i + 1}:`, error.message);
        console.error('Row data:', row);
      }
    }
    
    console.log('\n🎉 Import completed!');
    console.log(`📊 Summary:`);
    console.log(`   Total rows processed: ${data.length}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Updated: ${updateCount}`);
    console.log(`   Created: ${createCount}`);
    
  } catch (error) {
    console.error('❌ Import error:', error);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    
    // Check if file path is provided
    const filePath = process.argv[2];
    
    if (!filePath) {
      console.log('❌ Please provide Excel file path');
      console.log('Usage: node import-employees-from-excel.js <excel-file-path>');
      console.log('Example: node import-employees-from-excel.js Master_File_July-2025.xlsx');
      process.exit(1);
    }
    
    await importEmployeesFromExcel(filePath);
    
  } catch (error) {
    console.error('❌ Main error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

main();
