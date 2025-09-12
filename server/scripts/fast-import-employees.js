const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Import models
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Section = require('../models/hr/Section');
const Designation = require('../models/hr/Designation');
const Bank = require('../models/hr/Bank');
const Project = require('../models/hr/Project');
const Location = require('../models/hr/Location');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');
const User = require('../models/User');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Database connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }
    
    console.log('🌐 Connecting to cloud MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Cloud MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Helper function to convert Excel date numbers to JavaScript Date
const excelDateToJSDate = (excelDate) => {
  if (!excelDate || excelDate === 0) return null;
  const excelEpoch = new Date(1900, 0, 1);
  const jsDate = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
  return jsDate;
};

// Helper function to parse date strings
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  if (typeof dateStr === 'number') {
    return excelDateToJSDate(dateStr);
  }
  
  if (typeof dateStr === 'string') {
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
    }
    
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
};

// Helper function to split full name into first and last name
const splitName = (fullName) => {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const nameParts = fullName.trim().split(' ');
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '' };
  } else {
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    return { firstName, lastName };
  }
};

// Fast bulk create function
const bulkCreateEntities = async (Model, data, uniqueField, codeField = null) => {
  const existing = await Model.find({ [uniqueField]: { $in: data } });
  const existingMap = new Map(existing.map(item => [item[uniqueField], item._id]));
  
  const toCreate = data.filter(item => !existingMap.has(item));
  if (toCreate.length > 0) {
    const newItems = toCreate.map(item => {
      const itemData = { [uniqueField]: item, isActive: true };
      if (codeField) {
        // Generate short code (max 10 chars)
        const shortCode = item.toUpperCase().replace(/\s+/g, '').substring(0, 10);
        itemData[codeField] = shortCode;
      }
      return itemData;
    });
    const created = await Model.insertMany(newItems);
    created.forEach(item => existingMap.set(item[uniqueField], item._id));
  }
  
  return existingMap;
};

// Main import function
const importEmployeesFromExcel = async () => {
  try {
    console.log('🚀 Starting FAST employee import from Excel...');
    
    // Step 1: Delete all existing employees
    console.log('🗑️ Deleting all existing employees...');
    const deleteResult = await Employee.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} existing employees`);
    
    // Step 2: Read Excel file
    const filePath = path.join(__dirname, 'Master_File_Aug_2025.xlsx');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found at: ${filePath}`);
    }
    
    console.log('📊 Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON starting from row 2 (skip header rows)
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      range: 2, // Start from row 2 (0-indexed)
      header: 1 // Use first row as headers
    });
    
    console.log(`📋 Found ${data.length - 1} employee records to import`);
    
    // Step 3: Get default location IDs
    console.log('🌍 Setting up default location data...');
    const defaultCountry = await Country.findOneAndUpdate(
      { name: 'Pakistan' },
      { name: 'Pakistan', code: 'PK', isActive: true },
      { upsert: true, new: true }
    );
    
    const defaultProvince = await Province.findOneAndUpdate(
      { name: 'Punjab' },
      { name: 'Punjab', code: 'PB', isActive: true },
      { upsert: true, new: true }
    );
    
    const defaultCity = await City.findOneAndUpdate(
      { name: 'Rawalpindi' },
      { name: 'Rawalpindi', code: 'RWP', isActive: true },
      { upsert: true, new: true }
    );
    
    // Step 4: Collect all unique values
    console.log('⚡ Collecting unique values...');
    const uniqueDepartments = new Set();
    const uniqueSections = new Set();
    const uniqueDesignations = new Set();
    const uniqueBanks = new Set();
    const uniqueProjects = new Set();
    const uniqueLocations = new Set();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const headers = data[0];
      const employeeData = {};
      headers.forEach((header, index) => {
        if (header && header.trim()) {
          employeeData[header.trim()] = row[index];
        }
      });
      
      if (employeeData['Department']) uniqueDepartments.add(employeeData['Department']);
      if (employeeData['Section']) uniqueSections.add(employeeData['Section']);
      if (employeeData['Designation']) uniqueDesignations.add(employeeData['Designation']);
      if (employeeData['Bank']) uniqueBanks.add(employeeData['Bank']);
      if (employeeData['Project']) uniqueProjects.add(employeeData['Project']);
      if (employeeData['Location']) uniqueLocations.add(employeeData['Location']);
    }
    
    // Step 5: Bulk create all entities
    console.log('⚡ Bulk creating entities...');
    const departmentMap = await bulkCreateEntities(Department, [...uniqueDepartments], 'name', 'code');
    const designationMap = await bulkCreateEntities(Designation, [...uniqueDesignations], 'title');
    const bankMap = await bulkCreateEntities(Bank, [...uniqueBanks], 'name');
    const projectMap = await bulkCreateEntities(Project, [...uniqueProjects], 'name');
    const locationMap = await bulkCreateEntities(Location, [...uniqueLocations], 'name');
    
    // Create sections with department references
    const sectionData = [];
    for (const section of uniqueSections) {
      // Find department for this section (use first department as default)
      const firstDeptId = departmentMap.values().next().value;
      sectionData.push({ name: section, department: firstDeptId, isActive: true });
    }
    
    const existingSections = await Section.find({ name: { $in: [...uniqueSections] } });
    const existingSectionMap = new Map(existingSections.map(item => [item.name, item._id]));
    
    const sectionsToCreate = sectionData.filter(s => !existingSectionMap.has(s.name));
    if (sectionsToCreate.length > 0) {
      const createdSections = await Section.insertMany(sectionsToCreate);
      createdSections.forEach(item => existingSectionMap.set(item.name, item._id));
    }
    
    // Step 6: Process employees in batches
    console.log('⚡ Processing employees in batches...');
    const employees = [];
    const batchSize = 100;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const headers = data[0];
      
      // Extract data from row
      const employeeData = {};
      headers.forEach((header, index) => {
        if (header && header.trim()) {
          employeeData[header.trim()] = row[index];
        }
      });
      
      // Skip if no ID or Name
      if (!employeeData['ID'] || !employeeData['Name']) {
        continue;
      }
      
      // Split name
      const { firstName, lastName } = splitName(employeeData['Name']);
      
      // Get IDs from maps
      const departmentId = departmentMap.get(employeeData['Department']);
      const sectionId = existingSectionMap.get(employeeData['Section']);
      const designationId = designationMap.get(employeeData['Designation']);
      const bankId = bankMap.get(employeeData['Bank']);
      const projectId = projectMap.get(employeeData['Project']);
      const locationId = locationMap.get(employeeData['Location']);
      
      // Create employee object
      const employee = {
        employeeId: employeeData['ID'].toString(),
        firstName: firstName || 'Unknown',
        lastName: lastName || '',
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}.${employeeData['ID']}@sgc.com`,
        phone: employeeData['Contact No'] || '0000000000',
        dateOfBirth: parseDate(employeeData['DOB']) || new Date('1990-01-01'),
        gender: 'male',
        idCard: employeeData['CNIC'] || `CNIC-${employeeData['ID']}`,
        nationality: 'Pakistani',
        religion: 'Islam',
        maritalStatus: 'Single',
        address: {
          street: employeeData['Address'] || 'Not Provided',
          city: defaultCity._id,
          state: defaultProvince._id,
          country: defaultCountry._id
        },
        emergencyContact: {
          name: employeeData['Guardian Name'] || 'Not Provided',
          relationship: 'Guardian',
          phone: employeeData['Contact No'] || '0000000000'
        },
        qualification: employeeData['Qualification'] || 'Not Specified',
        guardianName: employeeData['Guardian Name'] || '',
        branchCode: employeeData['Branch Code'] || '',
        accountNumber: employeeData['Account No'] || '',
        bankName: bankId,
        hireDate: parseDate(employeeData['DOJ']) || parseDate(employeeData['Date Of joining']),
        joiningDate: parseDate(employeeData['Date Of joining']),
        appointmentDate: parseDate(employeeData['Date of Appiontment']),
        confirmationDate: parseDate(employeeData['Conformation Date']),
        probationPeriod: parseInt(employeeData['Probation Period']) || 3,
        probationPeriodMonths: parseInt(employeeData['Probation Period']) || 3,
        placementDepartment: departmentId,
        placementSection: sectionId,
        placementDesignation: designationId,
        placementProject: projectId,
        placementLocation: locationId,
        department: departmentId,
        position: designationId,
        employmentType: 'Full-time',
        employmentStatus: 'Active',
        isActive: true,
        isDeleted: false,
        // Salary fields
        excelGrossSalary: parseFloat(employeeData['Gross Salary']) || 0,
        arrears: parseFloat(employeeData['Arears']) || 0,
        excelConveyanceAllowance: parseFloat(employeeData['Covance Allowance']) || 0,
        excelHouseAllowance: parseFloat(employeeData['House Allowance']) || 0,
        excelFoodAllowance: parseFloat(employeeData['Food Allowance']) || 0,
        excelVehicleFuelAllowance: parseFloat(employeeData['Vehicle & Fuel Allowance']) || 0,
        excelMedicalAllowance: parseFloat(employeeData['Medical Allowance']) || 0,
        totalEarnings: parseFloat(employeeData['Total Earnings']) || 0,
        incomeTax: parseFloat(employeeData['Income Tax']) || 0,
        companyLoan: parseFloat(employeeData['Company Loan']) || 0,
        vehicleLoan: parseFloat(employeeData['Vehicle Loan']) || 0,
        eobiDeduction: parseFloat(employeeData['EOBI Ded']) || 0,
        netPayable: parseFloat(employeeData['Net Payable']) || 0,
        // Update existing salary structure
        salary: {
          gross: parseFloat(employeeData['Gross Salary']) || 0,
          basic: Math.round((parseFloat(employeeData['Gross Salary']) || 0) * 0.6)
        },
        // Update allowances structure
        allowances: {
          conveyance: {
            isActive: parseFloat(employeeData['Covance Allowance']) > 0,
            amount: parseFloat(employeeData['Covance Allowance']) || 0
          },
          food: {
            isActive: parseFloat(employeeData['Food Allowance']) > 0,
            amount: parseFloat(employeeData['Food Allowance']) || 0
          },
          vehicleFuel: {
            isActive: parseFloat(employeeData['Vehicle & Fuel Allowance']) > 0,
            amount: parseFloat(employeeData['Vehicle & Fuel Allowance']) || 0
          },
          medical: {
            isActive: parseFloat(employeeData['Medical Allowance']) > 0,
            amount: parseFloat(employeeData['Medical Allowance']) || 0
          },
          special: {
            isActive: parseFloat(employeeData['House Allowance']) > 0,
            amount: parseFloat(employeeData['House Allowance']) || 0
          }
        },
        // Update loans structure
        loans: {
          companyLoan: {
            isActive: parseFloat(employeeData['Company Loan']) > 0,
            amount: parseFloat(employeeData['Company Loan']) || 0,
            monthlyInstallment: parseFloat(employeeData['Company Loan']) || 0,
            outstandingBalance: parseFloat(employeeData['Company Loan']) || 0
          },
          vehicleLoan: {
            isActive: parseFloat(employeeData['Vehicle Loan']) > 0,
            amount: parseFloat(employeeData['Vehicle Loan']) || 0,
            monthlyInstallment: parseFloat(employeeData['Vehicle Loan']) || 0,
            outstandingBalance: parseFloat(employeeData['Vehicle Loan']) || 0
          }
        },
        // Update EOBI
        eobi: {
          isActive: parseFloat(employeeData['EOBI Ded']) > 0,
          amount: parseFloat(employeeData['EOBI Ded']) || 0
        }
      };
      
      employees.push(employee);
      
      // Process in batches
      if (employees.length >= batchSize) {
        console.log(`📝 Processing batch of ${employees.length} employees...`);
        await Employee.insertMany(employees, { ordered: false });
        employees.length = 0; // Clear array
      }
    }
    
    // Insert remaining employees
    if (employees.length > 0) {
      console.log(`📝 Processing final batch of ${employees.length} employees...`);
      await Employee.insertMany(employees, { ordered: false });
    }
    
    console.log('\n🎉 FAST Employee import completed successfully!');
    console.log(`✅ All employees imported with unique email addresses`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await importEmployeesFromExcel();
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
main();
