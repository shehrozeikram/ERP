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
    
    console.log('🌐 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
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
    // Handle DD/MM/YYYY format
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

// Helper function to generate short code (max 10 chars)
const generateCode = (name, maxLength = 10) => {
  if (!name) return '';
  // Remove special chars, take first letters of words, uppercase
  const code = name.trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, maxLength);
  return code || name.substring(0, maxLength).toUpperCase().replace(/\s+/g, '');
};

// Helper function to create or find department
const getOrCreateDepartment = async (departmentName) => {
  if (!departmentName || departmentName.trim() === '') return null;
  
  try {
    let department = await Department.findOne({ name: departmentName.trim() });
    if (!department) {
      const code = generateCode(departmentName, 10);
      department = new Department({
        name: departmentName.trim(),
        code: code, // Optional, but generate if possible
        isActive: true
      });
      await department.save();
      console.log(`✅ Created new department: ${departmentName} (code: ${code})`);
    }
    return department._id;
  } catch (error) {
    console.error(`❌ Error creating/finding department ${departmentName}:`, error.message);
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
    console.error(`❌ Error creating/finding section ${sectionName}:`, error.message);
    return null;
  }
};

// Helper function to create or find designation
const getOrCreateDesignation = async (designationName, departmentId) => {
  if (!designationName || designationName.trim() === '') return null;
  if (!departmentId) {
    console.error(`❌ Cannot create designation ${designationName}: Department is required`);
    return null;
  }
  
  try {
    // Try to find existing designation with same title and department
    let designation = await Designation.findOne({ 
      title: designationName.trim(), 
      department: departmentId 
    });
    
    if (!designation) {
      // Generate unique code
      let code = generateCode(designationName, 10);
      let counter = 1;
      
      // Ensure code is unique
      while (await Designation.findOne({ code: code })) {
        code = (generateCode(designationName, 8) + counter).substring(0, 10);
        counter++;
        if (counter > 99) break; // Safety limit
      }
      
      designation = new Designation({
        title: designationName.trim(),
        code: code,
        department: departmentId,
        isActive: true
      });
      await designation.save();
      console.log(`✅ Created new designation: ${designationName} (code: ${code})`);
    }
    return designation._id;
  } catch (error) {
    console.error(`❌ Error creating/finding designation ${designationName}:`, error.message);
    // Try to find existing designation as fallback
    try {
      const existingDesignation = await Designation.findOne({ 
        title: designationName.trim(),
        department: departmentId 
      });
      if (existingDesignation) return existingDesignation._id;
    } catch (e) {
      // Ignore
    }
    return null;
  }
};

// Helper function to create or find bank
const getOrCreateBank = async (bankName) => {
  if (!bankName || bankName.trim() === '') return null;
  
  try {
    // Try to find by name first (case-insensitive)
    let bank = await Bank.findOne({ 
      $or: [
        { name: { $regex: new RegExp(`^${bankName.trim()}$`, 'i') } },
        { name: bankName.trim() }
      ]
    });
    
    if (!bank) {
      // Try to find by code
      const code = generateCode(bankName, 10);
      bank = await Bank.findOne({ code: code });
      
      if (!bank) {
        // Create new bank with unique code
        let uniqueCode = code;
        let counter = 1;
        while (await Bank.findOne({ code: uniqueCode })) {
          uniqueCode = (code.substring(0, 8) + counter).substring(0, 10);
          counter++;
        }
        
        bank = new Bank({
          name: bankName.trim(),
          code: uniqueCode,
          country: 'Pakistan',
          type: 'Commercial',
          isActive: true
        });
        await bank.save();
        console.log(`✅ Created new bank: ${bankName} (code: ${uniqueCode})`);
      }
    }
    return bank._id;
  } catch (error) {
    console.error(`❌ Error creating/finding bank ${bankName}:`, error.message);
    // Try to find existing bank as fallback
    try {
      const existingBank = await Bank.findOne({ name: { $regex: new RegExp(bankName.trim(), 'i') } });
      if (existingBank) return existingBank._id;
    } catch (e) {
      // Ignore
    }
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
        code: projectName.trim().toUpperCase().replace(/\s+/g, '_'),
        isActive: true
      });
      await project.save();
      console.log(`✅ Created new project: ${projectName}`);
    }
    return project._id;
  } catch (error) {
    console.error(`❌ Error creating/finding project ${projectName}:`, error.message);
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
        isActive: true
      });
      await location.save();
      console.log(`✅ Created new location: ${locationName}`);
    }
    return location._id;
  } catch (error) {
    console.error(`❌ Error creating/finding location ${locationName}:`, error.message);
    return null;
  }
};

// Helper function to get default country
const getDefaultCountry = async () => {
  let country = await Country.findOne({ name: 'Pakistan' });
  if (!country) {
    country = new Country({ name: 'Pakistan', code: 'PK' });
    await country.save();
  }
  return country._id;
};

// Helper function to get default province
const getDefaultProvince = async () => {
  let province = await Province.findOne({ name: 'Punjab' });
  if (!province) {
    const countryId = await getDefaultCountry();
    province = new Province({ name: 'Punjab', country: countryId });
    await province.save();
  }
  return province._id;
};

// Helper function to get default city
const getDefaultCity = async () => {
  let city = await City.findOne({ name: 'Lahore' });
  if (!city) {
    const provinceId = await getDefaultProvince();
    city = new City({ name: 'Lahore', province: provinceId });
    await city.save();
  }
  return city._id;
};

// Helper function to split name into first and last name
const splitName = (fullName) => {
  if (!fullName) return { firstName: '', lastName: '' };
  
  const nameParts = fullName.trim().split(/\s+/);
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
    console.log('🚀 Starting employee import from Master_File_Nov-2025.xlsx...');
    
    // Step 1: Read Excel file
    const filePath = path.join(__dirname, 'Master_File_Nov-2025 .xlsx');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found at: ${filePath}`);
    }
    
    console.log('📊 Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Try to find the header row by looking for common column names
    // Read first 10 rows to find headers
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      defval: null,
      header: 1 // Get raw data as array of arrays
    });
    
    console.log(`📋 Found ${rawData.length} rows in Excel file`);
    
    // Find header row (look for row containing "ID", "Name", "Employee", etc.)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      const rowStr = row.join(' ').toLowerCase();
      if (rowStr.includes('id') && (rowStr.includes('name') || rowStr.includes('employee'))) {
        headerRowIndex = i;
        console.log(`✅ Found header row at index ${i + 1}`);
        break;
      }
    }
    
    // Get headers from the found row
    const headers = rawData[headerRowIndex] || [];
    console.log('📊 Headers found:', headers.filter(h => h).join(', '));
    
    // Convert to JSON using the found header row
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      defval: null,
      range: headerRowIndex // Start from header row
    });
    
    console.log(`📋 Found ${data.length} employee records to import`);
    
    // Log available columns for debugging
    if (data.length > 0) {
      console.log('📊 Available columns in Excel file:');
      console.log('   ', Object.keys(data[0]).join(', '));
    }
    
    // Step 2: Get default location IDs
    console.log('🌍 Setting up default location data...');
    const defaultCountryId = await getDefaultCountry();
    const defaultProvinceId = await getDefaultProvince();
    const defaultCityId = await getDefaultCity();
    
    // Step 3: Process each employee
    let successCount = 0;
    let updateCount = 0;
    let createCount = 0;
    let skipCount = 0;
    const errors = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // Get employee ID - try different possible column names (case-insensitive)
        const rowKeys = Object.keys(row);
        const idKey = rowKeys.find(k => k && (k.toLowerCase().includes('id') || k.toLowerCase() === 'id'));
        const nameKey = rowKeys.find(k => k && (k.toLowerCase().includes('name') || k.toLowerCase() === 'name'));
        
        const employeeId = idKey ? row[idKey] : (row['ID'] || row['Employee ID'] || row['EmployeeID'] || row['Emp ID'] || row['id']);
        const name = nameKey ? row[nameKey] : (row['Name'] || row['Employee Name'] || row['Full Name'] || row['name']);
        
        // Skip if no ID or Name
        if (!employeeId || !name) {
          console.log(`⚠️ Skipping row ${i + 1}: Missing ID or Name`);
          skipCount++;
          continue;
        }
        
        // Split name
        const { firstName, lastName } = splitName(name);
        
        // Create or find related entities (order matters - department must be created before designation)
        const departmentId = await getOrCreateDepartment(row['Department'] || row['Dept']);
        const sectionId = await getOrCreateSection(row['Section'] || row['Sec'], departmentId);
        const designationId = await getOrCreateDesignation(row['Designation'] || row['Position'] || row['Title'], departmentId);
        const bankId = await getOrCreateBank(row['Bank'] || row['Bank Name']);
        const projectId = await getOrCreateProject(row['Project'] || row['Project Name']);
        const locationId = await getOrCreateLocation(row['Location'] || row['Loc']);
        
        // If bank or department failed, skip this employee
        if (!bankId) {
          console.log(`⚠️ Skipping row ${i + 1}: Bank creation failed`);
          skipCount++;
          continue;
        }
        
        if (!departmentId) {
          console.log(`⚠️ Skipping row ${i + 1}: Department creation failed`);
          skipCount++;
          continue;
        }
        
        // Build employee object - ONLY using existing fields from Employee model
        const employeeData = {
          employeeId: employeeId.toString().trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim() || '',
          email: row['Email'] || row['email'] || `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@sgc.com`,
          phone: row['Phone'] || row['Mobile'] || row['Contact'] || row['phone'] || row['Contact No'] || '0000000000',
          dateOfBirth: parseDate(row['DOB'] || row['Date of Birth'] || row['Birth Date']) || new Date('1990-01-01'),
          gender: (row['Gender'] || 'male').toLowerCase() === 'female' ? 'female' : 'male',
          idCard: row['CNIC'] || row['ID Card'] || row['CNIC Number'] || row['CNIC'] || `CNIC-${employeeId}`,
          nationality: row['Nationality'] || 'Pakistani',
          religion: row['Religion'] || 'Islam',
          maritalStatus: row['Marital Status'] || row['Marital'] || 'Single',
          qualification: row['Qualification'] || row['Education'] || 'Not Specified',
          guardianName: row['Guardian Name'] || row['Guardian'] || '',
          branchCode: row['Branch Code'] || '',
          accountNumber: row['Account Number'] || row['Account No'] || row['Bank Account'] || row['Account'] || '',
          bankName: bankId,
          bankAccountNumber: row['Account Number'] || row['Account No'] || row['Bank Account'] || row['Account'] || `ACC-${employeeId}`, // Default if missing
          spouseName: row['Spouse Name'] || row['Spouse'] || '',
          joiningDate: parseDate(row['Joining Date'] || row['Join Date'] || row['Date of Joining'] || row['DOJ']),
          appointmentDate: parseDate(row['Appointment Date'] || row['Appointment'] || row['Date of Appointment'] || row['DOJ'] || row['Joining Date'] || row['Join Date'] || row['Date of Joining']) || new Date(), // Use DOJ as fallback, or current date
          confirmationDate: parseDate(row['Confirmation Date'] || row['Confirmed']),
          probationPeriod: parseInt(row['Probation Period'] || row['Probation']) || 3,
          probationPeriodMonths: parseInt(row['Probation Period'] || row['Probation']) || 3,
          placementDepartment: departmentId,
          placementSection: sectionId,
          placementDesignation: designationId,
          placementProject: projectId,
          placementLocation: locationId,
          isActive: row['Status'] === 'Active' || row['Active'] === true || row['Status'] !== 'Inactive',
          employmentStatus: row['Employment Status'] || row['Status'] || 'Active',
          isDeleted: false,
          // Address fields (using existing structure)
          address: {
            street: row['Address'] || row['Street'] || 'Not Provided',
            city: defaultCityId,
            state: defaultProvinceId,
            country: defaultCountryId
          },
          // Emergency contact (using existing structure)
          emergencyContact: {
            name: row['Guardian Name'] || row['Emergency Contact'] || row['Guardian'] || 'Not Provided',
            relationship: row['Relationship'] || 'Guardian',
            phone: row['Emergency Phone'] || row['Contact No'] || row['Phone'] || '0000000000'
          }
        };
        
        // Check if employee already exists (by employeeId or CNIC)
        let existingEmployee = await Employee.findOne({ employeeId: employeeData.employeeId });
        
        // If not found by ID, check by CNIC (but only if CNIC is valid)
        if (!existingEmployee && employeeData.idCard && employeeData.idCard !== `CNIC-${employeeId}` && !employeeData.idCard.startsWith('CNIC-')) {
          existingEmployee = await Employee.findOne({ idCard: employeeData.idCard });
          if (existingEmployee) {
            console.log(`   Found existing employee by CNIC: ${employeeData.idCard} (updating employeeId ${existingEmployee.employeeId})`);
          }
        }
        
        if (existingEmployee) {
          // Update existing employee (preserve existing fields that aren't in new data)
          for (const key of Object.keys(employeeData)) {
            if (employeeData[key] !== null && employeeData[key] !== undefined && employeeData[key] !== '') {
              // Don't update employeeId if it's different
              if (key === 'employeeId' && existingEmployee.employeeId !== employeeData.employeeId) {
                console.log(`   ⚠️  Skipping employeeId update: ${existingEmployee.employeeId} -> ${employeeData.employeeId}`);
                continue;
              }
              // Check if CNIC already belongs to another employee
              if (key === 'idCard' && employeeData.idCard && employeeData.idCard !== existingEmployee.idCard) {
                const cnicOwner = await Employee.findOne({ idCard: employeeData.idCard, _id: { $ne: existingEmployee._id } });
                if (cnicOwner) {
                  console.log(`   ⚠️  CNIC ${employeeData.idCard} already belongs to employee ${cnicOwner.employeeId}, skipping CNIC update`);
                  continue;
                }
              }
              existingEmployee[key] = employeeData[key];
            }
          }
          await existingEmployee.save();
          updateCount++;
          if (updateCount % 10 === 0) {
            console.log(`📝 Updated ${updateCount} employees...`);
          }
        } else {
          // Check if CNIC already exists before creating
          if (employeeData.idCard && employeeData.idCard !== `CNIC-${employeeId}` && !employeeData.idCard.startsWith('CNIC-')) {
            const duplicateCNIC = await Employee.findOne({ idCard: employeeData.idCard });
            if (duplicateCNIC) {
              console.log(`   ⚠️  CNIC ${employeeData.idCard} already exists for employee ${duplicateCNIC.employeeId}, updating that employee instead`);
              Object.keys(employeeData).forEach(key => {
                if (key !== 'idCard' && employeeData[key] !== null && employeeData[key] !== undefined && employeeData[key] !== '') {
                  duplicateCNIC[key] = employeeData[key];
                }
              });
              await duplicateCNIC.save();
              updateCount++;
              successCount++;
              continue;
            }
          }
          
          // Create new employee - remove idCard if it would cause duplicate
          try {
            const employee = new Employee(employeeData);
            await employee.save();
            createCount++;
            if (createCount % 10 === 0) {
              console.log(`📝 Created ${createCount} employees...`);
            }
          } catch (saveError) {
            // If duplicate CNIC error, try without CNIC or generate unique one
            if (saveError.code === 11000 && saveError.keyPattern && saveError.keyPattern.idCard) {
              console.log(`   ⚠️  Duplicate CNIC detected, generating unique CNIC for employee ${employeeId}`);
              employeeData.idCard = `CNIC-${employeeId}-${Date.now()}`;
              try {
                const employee = new Employee(employeeData);
                await employee.save();
                createCount++;
                if (createCount % 10 === 0) {
                  console.log(`📝 Created ${createCount} employees...`);
                }
              } catch (retryError) {
                throw retryError; // Re-throw if still fails
              }
            } else {
              throw saveError; // Re-throw other errors
            }
          }
        }
        
        successCount++;
        
      } catch (error) {
        console.error(`❌ Error processing row ${i + 1}:`, error.message);
        errors.push({ row: i + 1, employeeId: row['ID'] || 'Unknown', error: error.message });
      }
    }
    
    // Step 4: Summary
    console.log('\n📊 Import Summary:');
    console.log(`✅ Total employees processed: ${successCount}`);
    console.log(`🆕 New employees created: ${createCount}`);
    console.log(`🔄 Existing employees updated: ${updateCount}`);
    console.log(`⏭️  Skipped (missing data): ${skipCount}`);
    console.log(`❌ Errors encountered: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Error Details (first 10):');
      errors.slice(0, 10).forEach(error => {
        console.log(`   Row ${error.row} (ID: ${error.employeeId}): ${error.error}`);
      });
      if (errors.length > 10) {
        console.log(`   ... and ${errors.length - 10} more errors`);
      }
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
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

main();

