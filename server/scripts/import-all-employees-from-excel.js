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
  
  // Excel date starts from 1900-01-01, but Excel incorrectly treats 1900 as a leap year
  // So we need to adjust for this
  const excelEpoch = new Date(1900, 0, 1);
  const jsDate = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
  return jsDate;
};

// Helper function to parse date strings
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  
  // If it's already a number (Excel date), convert it
  if (typeof dateStr === 'number') {
    return excelDateToJSDate(dateStr);
  }
  
  // If it's a string, try to parse it
  if (typeof dateStr === 'string') {
    // Handle DD/MM/YYYY format
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
    }
    
    // Try standard date parsing
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
};

// Helper function to create or find department
const getOrCreateDepartment = async (departmentName) => {
  if (!departmentName || departmentName.trim() === '') return null;
  
  try {
    let department = await Department.findOne({ name: departmentName.trim() });
    if (!department) {
      department = new Department({
        name: departmentName.trim(),
        code: departmentName.trim().toUpperCase().replace(/\s+/g, '_'),
        isActive: true
      });
      await department.save();
      console.log(`✅ Created new department: ${departmentName}`);
    }
    return department._id;
  } catch (error) {
    console.error(`❌ Error creating/finding department ${departmentName}:`, error);
    return null;
  }
};

// Helper function to create or find section
const getOrCreateSection = async (sectionName, departmentId) => {
  if (!sectionName || sectionName.trim() === '') return null;
  
  try {
    let section = await Section.findOne({ name: sectionName.trim() });
    if (!section) {
      section = new Section({
        name: sectionName.trim(),
        department: departmentId,
        isActive: true
      });
      await section.save();
      console.log(`✅ Created new section: ${sectionName}`);
    }
    return section._id;
  } catch (error) {
    console.error(`❌ Error creating/finding section ${sectionName}:`, error);
    return null;
  }
};

// Helper function to create or find designation
const getOrCreateDesignation = async (designationName) => {
  if (!designationName || designationName.trim() === '') return null;
  
  try {
    let designation = await Designation.findOne({ title: designationName.trim() });
    if (!designation) {
      designation = new Designation({
        title: designationName.trim(),
        level: 'Mid', // Default level
        isActive: true
      });
      await designation.save();
      console.log(`✅ Created new designation: ${designationName}`);
    }
    return designation._id;
  } catch (error) {
    console.error(`❌ Error creating/finding designation ${designationName}:`, error);
    return null;
  }
};

// Helper function to create or find bank
const getOrCreateBank = async (bankName) => {
  if (!bankName || bankName.trim() === '') return null;
  
  try {
    let bank = await Bank.findOne({ name: bankName.trim() });
    if (!bank) {
      bank = new Bank({
        name: bankName.trim(),
        type: 'Commercial',
        isActive: true
      });
      await bank.save();
      console.log(`✅ Created new bank: ${bankName}`);
    }
    return bank._id;
  } catch (error) {
    console.error(`❌ Error creating/finding bank ${bankName}:`, error);
    return null;
  }
};

// Helper function to create or find project
const getOrCreateProject = async (projectName) => {
  if (!projectName || projectName.trim() === '') return null;
  
  try {
    let project = await Project.findOne({ name: projectName.trim() });
    if (!project) {
      project = new Project({
        name: projectName.trim(),
        company: 'Sardar Group Of Companies',
        isActive: true
      });
      await project.save();
      console.log(`✅ Created new project: ${projectName}`);
    }
    return project._id;
  } catch (error) {
    console.error(`❌ Error creating/finding project ${projectName}:`, error);
    return null;
  }
};

// Helper function to create or find location
const getOrCreateLocation = async (locationName) => {
  if (!locationName || locationName.trim() === '') return null;
  
  try {
    let location = await Location.findOne({ name: locationName.trim() });
    if (!location) {
      location = new Location({
        name: locationName.trim(),
        type: 'Office',
        isActive: true
      });
      await location.save();
      console.log(`✅ Created new location: ${locationName}`);
    }
    return location._id;
  } catch (error) {
    console.error(`❌ Error creating/finding location ${locationName}:`, error);
    return null;
  }
};

// Helper function to get default country
const getDefaultCountry = async () => {
  try {
    let country = await Country.findOne({ name: 'Pakistan' });
    if (!country) {
      country = new Country({
        name: 'Pakistan',
        code: 'PK',
        isActive: true
      });
      await country.save();
      console.log('✅ Created default country: Pakistan');
    }
    return country._id;
  } catch (error) {
    console.error('❌ Error creating/finding default country:', error);
    return null;
  }
};

// Helper function to get default province
const getDefaultProvince = async () => {
  try {
    let province = await Province.findOne({ name: 'Punjab' });
    if (!province) {
      province = new Province({
        name: 'Punjab',
        code: 'PB',
        isActive: true
      });
      await province.save();
      console.log('✅ Created default province: Punjab');
    }
    return province._id;
  } catch (error) {
    console.error('❌ Error creating/finding default province:', error);
    return null;
  }
};

// Helper function to get default city
const getDefaultCity = async () => {
  try {
    let city = await City.findOne({ name: 'Rawalpindi' });
    if (!city) {
      city = new City({
        name: 'Rawalpindi',
        code: 'RWP',
        isActive: true
      });
      await city.save();
      console.log('✅ Created default city: Rawalpindi');
    }
    return city._id;
  } catch (error) {
    console.error('❌ Error creating/finding default city:', error);
    return null;
  }
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

// Main import function
const importEmployeesFromExcel = async () => {
  try {
    console.log('🚀 Starting comprehensive employee import from Excel...');
    
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
    const defaultCountryId = await getDefaultCountry();
    const defaultProvinceId = await getDefaultProvince();
    const defaultCityId = await getDefaultCity();
    
    // Step 4: Process each employee
    const employees = [];
    const errors = [];
    
    for (let i = 1; i < data.length; i++) { // Skip header row
      const row = data[i];
      const headers = data[0];
      
      try {
        // Extract data from row
        const employeeData = {};
        headers.forEach((header, index) => {
          if (header && header.trim()) {
            employeeData[header.trim()] = row[index];
          }
        });
        
        // Skip if no ID or Name
        if (!employeeData['ID'] || !employeeData['Name']) {
          console.log(`⚠️ Skipping row ${i + 1}: Missing ID or Name`);
          continue;
        }
        
        // Split name
        const { firstName, lastName } = splitName(employeeData['Name']);
        
        // Create or find related entities
        const departmentId = await getOrCreateDepartment(employeeData['Department']);
        const sectionId = await getOrCreateSection(employeeData['Section'], departmentId);
        const designationId = await getOrCreateDesignation(employeeData['Designation']);
        const bankId = await getOrCreateBank(employeeData['Bank']);
        const projectId = await getOrCreateProject(employeeData['Project']);
        const locationId = await getOrCreateLocation(employeeData['Location']);
        
        // Create employee object
        const employee = {
          employeeId: employeeData['ID'].toString(),
          firstName: firstName || 'Unknown',
          lastName: lastName || '',
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}.${employeeData['ID']}@sgc.com`, // Generate unique email with employee ID
          phone: employeeData['Contact No'] || '0000000000', // Default phone
          dateOfBirth: parseDate(employeeData['DOB']) || new Date('1990-01-01'), // Default DOB
          gender: 'male', // Default, can be updated later
          idCard: employeeData['CNIC'] || `CNIC-${employeeData['ID']}`, // Generate CNIC if missing
          nationality: 'Pakistani', // Default
          religion: 'Islam', // Default
          maritalStatus: 'Single', // Default
          address: {
            street: employeeData['Address'] || 'Not Provided',
            city: defaultCityId,
            state: defaultProvinceId,
            country: defaultCountryId
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
            basic: Math.round((parseFloat(employeeData['Gross Salary']) || 0) * 0.6) // 60% of gross
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
        
        if (i % 50 === 0) {
          console.log(`📝 Processed ${i} employees...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing row ${i + 1}:`, error.message);
        errors.push({ row: i + 1, error: error.message });
      }
    }
    
    // Step 4: Individual insert employees (for debugging)
    console.log(`💾 Inserting ${employees.length} employees into database...`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < employees.length; i++) {
      try {
        const employee = new Employee(employees[i]);
        await employee.save();
        successCount++;
        
        if (successCount % 50 === 0) {
          console.log(`📝 Successfully imported ${successCount} employees...`);
        }
      } catch (err) {
        failCount++;
        console.error(`❌ Failed to import employee ${i + 1} (ID: ${employees[i].employeeId}):`, err.message);
        
        if (failCount <= 5) { // Only show first 5 errors
          console.error('   Employee data:', JSON.stringify(employees[i], null, 2));
        }
      }
    }
    
    console.log(`✅ Individual import completed: ${successCount} success, ${failCount} failed`);
    
    // Step 5: Summary
    console.log('\n📊 Import Summary:');
    console.log(`✅ Total employees processed: ${employees.length}`);
    console.log(`❌ Processing errors encountered: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Error Details:');
      errors.forEach(error => {
        console.log(`   Row ${error.row}: ${error.error}`);
      });
    }
    
    console.log('\n🎉 Employee import completed successfully!');
    
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
