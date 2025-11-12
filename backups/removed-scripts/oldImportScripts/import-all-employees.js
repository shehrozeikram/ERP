const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Designation = require('../models/hr/Designation');
const Position = require('../models/hr/Position');
const Bank = require('../models/hr/Bank');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');
const User = require('../models/User');
require('dotenv').config();

// Convert Excel serial number to date
const excelSerialToDate = (serial) => {
  if (!serial || isNaN(serial)) return null;
  
  // Excel serial date starts from 1900-01-01, but there's a leap year bug
  // So we need to adjust for dates after 1900-02-28
  const excelEpoch = new Date(1900, 0, 1);
  const date = new Date(excelEpoch.getTime() + (serial - 2) * 24 * 60 * 60 * 1000);
  
  return date;
};

// Convert date string to Date object
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  // If it's a number, treat as Excel serial
  if (!isNaN(dateStr)) {
    return excelSerialToDate(parseFloat(dateStr));
  }
  
  // Try parsing as date string
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

// Parse name into first and last name
const parseName = (fullName) => {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const nameParts = fullName.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  return { firstName, lastName };
};

// Find or create reference data
const findOrCreateReference = async (Model, data, fieldName) => {
  if (!data || !data.trim()) return null;
  
  try {
    let item;
    
    // Special handling for different models
    if (Model.modelName === 'Designation') {
      item = await Model.findOne({ title: { $regex: new RegExp(data.trim(), 'i') } });
      if (!item) {
        const departmentId = await findOrCreateReference(Department, 'General', 'Department');
        // Generate a shorter code (max 10 characters)
        const shortCode = data.trim().toUpperCase().replace(/\s+/g, '_').substring(0, 10);
        item = new Model({ 
          title: data.trim(),
          department: departmentId,
          code: shortCode,
          level: 'Mid'
        });
        await item.save();
        console.log(`   ✅ Created new ${fieldName}: ${data.trim()}`);
      }
    } else if (Model.modelName === 'Department') {
      item = await Model.findOne({ name: { $regex: new RegExp(data.trim(), 'i') } });
      if (!item) {
        item = new Model({ 
          name: data.trim(),
          code: data.trim().toUpperCase().replace(/\s+/g, '_')
        });
        await item.save();
        console.log(`   ✅ Created new ${fieldName}: ${data.trim()}`);
      }
    } else {
      item = await Model.findOne({ name: { $regex: new RegExp(data.trim(), 'i') } });
      if (!item) {
        item = new Model({ name: data.trim() });
        await item.save();
        console.log(`   ✅ Created new ${fieldName}: ${data.trim()}`);
      }
    }
    
    return item._id;
  } catch (error) {
    console.log(`   ⚠️  Error with ${fieldName}: ${error.message}`);
    return null;
  }
};

// Import all employees from Excel
const importAllEmployeesFromExcel = async (filePath) => {
  try {
    console.log('🚀 Starting bulk employee import...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to MongoDB\n');
    
    // Read Excel file
    console.log('📊 Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON starting from row 2
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      range: 2,
      header: 1
    });
    
    console.log(`📋 Found ${data.length} rows in Excel file`);
    
    if (data.length <= 1) {
      console.log('❌ No employee data found');
      return;
    }
    
    // Get headers (first row after skipping header)
    const headers = data[0];
    
    // Get employee data (skip header row)
    const employeeRows = data.slice(1);
    
    console.log(`📊 Processing ${employeeRows.length} employees...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let updateCount = 0;
    let createCount = 0;
    const errors = [];
    
    // Process employees in batches to avoid memory issues
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < employeeRows.length; i += batchSize) {
      batches.push(employeeRows.slice(i, i + batchSize));
    }
    
    console.log(`📦 Processing in ${batches.length} batches of ${batchSize} employees each\n`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} employees)...`);
      
      for (let i = 0; i < batch.length; i++) {
        const employeeRow = batch[i];
        const globalIndex = batchIndex * batchSize + i;
        
        try {
          // Skip if no name or ID
          if (!employeeRow[2] || !employeeRow[1]) {
            console.log(`   ⚠️  Skipping row ${globalIndex + 1}: Missing name or ID`);
            continue;
          }
          
          // Parse name
          const { firstName, lastName } = parseName(employeeRow[2]);
          
          // Prepare employee data
          const employeeData = {
            // Basic Information
            employeeId: employeeRow[1]?.toString() || `EMP${Date.now()}_${globalIndex}`,
            firstName: firstName,
            lastName: lastName,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@sgc.com`.replace(/\s+/g, ''),
            phone: employeeRow[17]?.toString() || '+923000000000', // Default phone if missing
            dateOfBirth: parseDate(employeeRow[14]), // DOB
            gender: 'male', // Default, not in Excel
            idCard: employeeRow[4]?.toString() || '', // CNIC
            nationality: 'Pakistani', // Default
            religion: 'Islam', // Default
            maritalStatus: 'Single', // Default
            
            // Address Information
            address: {
              street: employeeRow[15]?.toString() || '', // Address
              city: await findOrCreateReference(City, 'Rawalpindi', 'City'),
              state: await findOrCreateReference(Province, 'Punjab', 'Province'),
              country: await findOrCreateReference(Country, 'Pakistan', 'Country')
            },
            
            // Emergency Contact (required fields)
            emergencyContact: {
              name: employeeRow[3]?.toString() || 'To be provided', // Guardian Name
              relationship: 'Guardian',
              phone: employeeRow[17]?.toString() || '+923000000000',
              email: null
            },
            
            // Appointment Date (required)
            appointmentDate: parseDate(employeeRow[20]) || parseDate(employeeRow[19]) || new Date(),
            
            // Employment Information
            department: await findOrCreateReference(Department, employeeRow[10], 'Department'),
            position: await findOrCreateReference(Designation, employeeRow[12], 'Designation'),
            hireDate: parseDate(employeeRow[19]) || parseDate(employeeRow[20]) || new Date(), // Date Of joining or Date of Appointment
            employmentType: 'Full-time',
            probationPeriodMonths: parseInt(employeeRow[18]) || 3,
            employmentStatus: 'Active',
            
            // Salary Information
            salary: {
              gross: parseFloat(employeeRow[22]) || 0, // Gross Salary
              basic: Math.round((parseFloat(employeeRow[22]) || 0) * 0.6) // 60% of gross as basic
            },
            currency: 'PKR',
            
            // Allowances - Convert to proper structure
            allowances: {
              conveyance: {
                isActive: (parseFloat(employeeRow[24]) || 0) > 0,
                amount: parseFloat(employeeRow[24]) || 0
              },
              food: {
                isActive: (parseFloat(employeeRow[26]) || 0) > 0,
                amount: parseFloat(employeeRow[26]) || 0
              },
              vehicleFuel: {
                isActive: (parseFloat(employeeRow[27]) || 0) > 0,
                amount: parseFloat(employeeRow[27]) || 0
              },
              medical: {
                isActive: (parseFloat(employeeRow[28]) || 0) > 0,
                amount: parseFloat(employeeRow[28]) || 0
              },
              special: {
                isActive: false,
                amount: 0
              },
              other: {
                isActive: false,
                amount: 0
              }
            },
            
            // Bank Information
            bankName: await findOrCreateReference(Bank, employeeRow[5], 'Bank'),
            accountNumber: employeeRow[7]?.toString() || '',
            branchCode: employeeRow[6]?.toString() || '',
            
            // Additional Information
            qualification: employeeRow[16]?.toString() || '',
            project: employeeRow[9]?.toString() || '',
            section: employeeRow[11]?.toString() || '',
            location: employeeRow[13]?.toString() || '',
            
            // Status
            isActive: true,
            isDeleted: false
          };
          
          // Check if employee already exists
          const existingEmployee = await Employee.findOne({ 
            $or: [
              { employeeId: employeeData.employeeId },
              { email: employeeData.email },
              { idCard: employeeData.idCard }
            ]
          });
          
          if (existingEmployee) {
            console.log(`   ⚠️  Employee already exists: ${employeeData.firstName} ${employeeData.lastName} (ID: ${existingEmployee.employeeId})`);
            updateCount++;
            continue;
          }
          
          // Insert directly into the collection to bypass pre-save middleware and preserve Excel ID
          const result = await Employee.collection.insertOne({
            ...employeeData,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          console.log(`   ✅ Created: ${employeeData.firstName} ${employeeData.lastName} (ID: ${employeeData.employeeId})`);
          createCount++;
          successCount++;
          
        } catch (error) {
          console.log(`   ❌ Error with employee ${globalIndex + 1}: ${error.message}`);
          errors.push({
            row: globalIndex + 1,
            name: employeeRow[2] || 'Unknown',
            error: error.message
          });
          errorCount++;
        }
      }
      
      console.log(`   📊 Batch ${batchIndex + 1} completed\n`);
    }
    
    // Summary
    console.log('🎉 Import completed!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Successfully processed: ${successCount}`);
    console.log(`   🆕 New employees created: ${createCount}`);
    console.log(`   🔄 Existing employees skipped: ${updateCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.slice(0, 10).forEach(error => {
        console.log(`   Row ${error.row}: ${error.name} - ${error.error}`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
    }
    
    return {
      success: true,
      totalProcessed: employeeRows.length,
      created: createCount,
      updated: updateCount,
      errors: errorCount,
      errorDetails: errors
    };
    
  } catch (error) {
    console.error('❌ Error during bulk import:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the import
if (require.main === module) {
  const filePath = path.join(__dirname, 'Master_File_Aug_2025.xlsx');
  
  importAllEmployeesFromExcel(filePath)
    .then((result) => {
      if (result) {
        console.log('\n🎉 Bulk employee import completed successfully!');
        console.log(`📊 Final Results: ${result.created} created, ${result.updated} skipped, ${result.errors} errors`);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Bulk employee import failed:', error);
      process.exit(1);
    });
}

module.exports = { importAllEmployeesFromExcel };
