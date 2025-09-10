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
        item = new Model({ 
          title: data.trim(),
          department: departmentId,
          code: data.trim().toUpperCase().replace(/\s+/g, '_'),
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

// Import single employee for testing
const importSingleEmployee = async (filePath, employeeIndex = 0) => {
  try {
    console.log('🚀 Starting single employee import test...\n');
    
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
    
    // Get the employee data (skip header row)
    const employeeRow = data[employeeIndex + 1];
    
    if (!employeeRow) {
      console.log(`❌ Employee at index ${employeeIndex} not found`);
      return;
    }
    
    console.log(`\n📋 Processing Employee ${employeeIndex + 1}:`);
    console.log(`   Name: ${employeeRow[2]}`); // Name column
    console.log(`   ID: ${employeeRow[1]}`); // ID column
    console.log(`   Department: ${employeeRow[10]}`); // Department column
    
    // Parse name
    const { firstName, lastName } = parseName(employeeRow[2]);
    
    // Prepare employee data
    const employeeData = {
      // Basic Information
      employeeId: employeeRow[1]?.toString() || `EMP${Date.now()}`,
      firstName: firstName,
      lastName: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@sgc.com`.replace(/\s+/g, ''),
      phone: employeeRow[17]?.toString() || '',
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
        phone: employeeRow[17]?.toString() || 'To be provided',
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
      
      // Allowances
      allowances: {
        conveyance: parseFloat(employeeRow[24]) || 0, // Covance Allowance
        house: parseFloat(employeeRow[25]) || 0, // House Allowance
        food: parseFloat(employeeRow[26]) || 0, // Food Allowance
        vehicle: parseFloat(employeeRow[27]) || 0, // Vehicle & Fuel Allowance
        medical: parseFloat(employeeRow[28]) || 0 // Medical Allowance
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
    
    console.log('\n📋 Prepared Employee Data:');
    console.log(`   Employee ID: ${employeeData.employeeId}`);
    console.log(`   Name: ${employeeData.firstName} ${employeeData.lastName}`);
    console.log(`   Email: ${employeeData.email}`);
    console.log(`   Phone: ${employeeData.phone}`);
    console.log(`   CNIC: ${employeeData.idCard}`);
    console.log(`   Department: ${employeeData.department}`);
    console.log(`   Designation: ${employeeData.position}`);
    console.log(`   Hire Date: ${employeeData.hireDate}`);
    console.log(`   Gross Salary: ${employeeData.salary.gross}`);
    console.log(`   Basic Salary: ${employeeData.salary.basic}`);
    console.log(`   Bank: ${employeeData.bankName}`);
    console.log(`   Account: ${employeeData.accountNumber}`);
    
    // Check if employee already exists
    const existingEmployee = await Employee.findOne({ 
      $or: [
        { employeeId: employeeData.employeeId },
        { email: employeeData.email },
        { idCard: employeeData.idCard }
      ]
    });
    
    if (existingEmployee) {
      console.log('\n⚠️  Employee already exists:');
      console.log(`   Existing ID: ${existingEmployee.employeeId}`);
      console.log(`   Existing Name: ${existingEmployee.firstName} ${existingEmployee.lastName}`);
      console.log('   Skipping creation...');
      return existingEmployee;
    }
    
    // Create employee
    console.log('\n🔄 Creating employee...');
    const employee = new Employee(employeeData);
    await employee.save();
    
    console.log('\n✅ Employee created successfully!');
    console.log(`   Employee ID: ${employee._id}`);
    console.log(`   Database ID: ${employee.employeeId}`);
    
    // Populate and show final result
    const populatedEmployee = await Employee.findById(employee._id)
      .populate('department', 'name')
      .populate('position', 'title')
      .populate('bankName', 'name')
      .populate('address.city', 'name')
      .populate('address.state', 'name')
      .populate('address.country', 'name');
    
    console.log('\n📋 Final Employee Data:');
    console.log(`   Name: ${populatedEmployee.firstName} ${populatedEmployee.lastName}`);
    console.log(`   Employee ID: ${populatedEmployee.employeeId}`);
    console.log(`   Email: ${populatedEmployee.email}`);
    console.log(`   Department: ${populatedEmployee.department?.name || 'N/A'}`);
    console.log(`   Designation: ${populatedEmployee.position?.title || 'N/A'}`);
    console.log(`   Bank: ${populatedEmployee.bankName?.name || 'N/A'}`);
    console.log(`   Gross Salary: ${populatedEmployee.salary.gross}`);
    console.log(`   Hire Date: ${populatedEmployee.hireDate}`);
    
    return populatedEmployee;
    
  } catch (error) {
    console.error('❌ Error importing employee:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the import
if (require.main === module) {
  const filePath = path.join(__dirname, 'Master_File_Aug_2025.xlsx');
  const employeeIndex = 0; // First employee
  
  importSingleEmployee(filePath, employeeIndex)
    .then((employee) => {
      if (employee) {
        console.log('\n🎉 Single employee import test completed successfully!');
        console.log('✅ You can now verify the data in your system');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Single employee import test failed:', error);
      process.exit(1);
    });
}

module.exports = { importSingleEmployee };
