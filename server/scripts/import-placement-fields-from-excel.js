const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Import models
const Employee = require('../models/hr/Employee');
const PlacementCompany = require('../models/hr/Company');
const Sector = require('../models/hr/Sector');
const Project = require('../models/hr/Project');
const Department = require('../models/hr/Department');
const Section = require('../models/hr/Section');
const Designation = require('../models/hr/Designation');
const Location = require('../models/hr/Location');
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

// Helper function to find or create Company
const getOrCreateCompany = async (companyName) => {
  if (!companyName || companyName.trim() === '') return null;
  
  try {
    let company = await PlacementCompany.findOne({ name: companyName.trim() });
    if (!company) {
      // Generate code from name
      const code = companyName.trim().toUpperCase().replace(/\s+/g, '_').substring(0, 10);
      company = new PlacementCompany({
        name: companyName.trim(),
        code: code,
        type: 'Private Limited',
        isActive: true
      });
      await company.save();
      console.log(`✅ Created new company: ${companyName}`);
    }
    return company._id;
  } catch (error) {
    console.error(`❌ Error creating/finding company ${companyName}:`, error.message);
    return null;
  }
};

// Helper function to find or create Sector
const getOrCreateSector = async (sectorName) => {
  if (!sectorName || sectorName.trim() === '' || sectorName.trim().toLowerCase() === 'n/a') return null;
  
  try {
    let sector = await Sector.findOne({ name: sectorName.trim() });
    if (!sector) {
      // Get a default user for createdBy (or use first admin)
      const defaultUser = await User.findOne({ role: 'super_admin' });
      if (!defaultUser) {
        console.error(`⚠️ No super_admin user found, cannot create sector: ${sectorName}`);
        return null;
      }
      sector = new Sector({
        name: sectorName.trim(),
        industry: 'General',
        isActive: true,
        createdBy: defaultUser._id
      });
      await sector.save();
      console.log(`✅ Created new sector: ${sectorName}`);
    }
    return sector._id;
  } catch (error) {
    console.error(`❌ Error creating/finding sector ${sectorName}:`, error.message);
    return null;
  }
};

// Helper function to find or create Project
const getOrCreateProject = async (projectName) => {
  if (!projectName || projectName.trim() === '') return null;
  
  try {
    let project = await Project.findOne({ name: projectName.trim() });
    if (!project) {
      project = new Project({
        name: projectName.trim(),
        status: 'Active',
        priority: 'Medium'
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

// Helper function to find or create Department
const getOrCreateDepartment = async (departmentName) => {
  if (!departmentName || departmentName.trim() === '') return null;
  
  try {
    let department = await Department.findOne({ name: departmentName.trim() });
    if (!department) {
      const code = departmentName.trim().toUpperCase().replace(/\s+/g, '_').substring(0, 10);
      department = new Department({
        name: departmentName.trim(),
        code: code,
        isActive: true
      });
      await department.save();
      console.log(`✅ Created new department: ${departmentName}`);
    }
    return department._id;
  } catch (error) {
    console.error(`❌ Error creating/finding department ${departmentName}:`, error.message);
    return null;
  }
};

// Helper function to find or create Section
const getOrCreateSection = async (sectionName, departmentId) => {
  if (!sectionName || sectionName.trim() === '') return null;
  if (!departmentId) return null;
  
  try {
    // First try to find by name and department
    let section = await Section.findOne({ name: sectionName.trim(), department: departmentId });
    
    // If not found, try to find by name only
    if (!section) {
      section = await Section.findOne({ name: sectionName.trim() });
    }
    
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
    // If duplicate key error, try to find existing one
    if (error.code === 11000) {
      const existing = await Section.findOne({ name: sectionName.trim() });
      if (existing) {
        return existing._id;
      }
    }
    console.error(`❌ Error creating/finding section ${sectionName}:`, error.message);
    return null;
  }
};

// Helper function to find or create Designation
const getOrCreateDesignation = async (designationName, departmentId) => {
  if (!designationName || designationName.trim() === '') return null;
  if (!departmentId) return null;
  
  try {
    // First try to find by title and department
    let designation = await Designation.findOne({ title: designationName.trim(), department: departmentId });
    
    // If not found, try to find by title only (might exist in different department)
    if (!designation) {
      designation = await Designation.findOne({ title: designationName.trim() });
    }
    
    if (!designation) {
      // Generate unique code
      const baseCode = designationName.trim().toUpperCase().replace(/\s+/g, '_').substring(0, 8);
      let code = baseCode;
      let counter = 1;
      
      // Ensure unique code
      while (await Designation.findOne({ code })) {
        code = `${baseCode}${counter}`.substring(0, 10);
        counter++;
      }
      
      designation = new Designation({
        title: designationName.trim(),
        code: code,
        department: departmentId,
        level: 'Entry',
        isActive: true
      });
      await designation.save();
      console.log(`✅ Created new designation: ${designationName}`);
    }
    return designation._id;
  } catch (error) {
    // If duplicate key error, try to find existing one
    if (error.code === 11000) {
      const existing = await Designation.findOne({ title: designationName.trim() });
      if (existing) {
        return existing._id;
      }
    }
    console.error(`❌ Error creating/finding designation ${designationName}:`, error.message);
    return null;
  }
};

// Helper function to find or create Location
const getOrCreateLocation = async (locationName) => {
  if (!locationName || locationName.trim() === '') return null;
  
  try {
    let location = await Location.findOne({ name: locationName.trim() });
    if (!location) {
      location = new Location({
        name: locationName.trim(),
        type: 'Office',
        status: 'Active'
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

// Normalize employee code (handle string/number, trim, etc.)
const normalizeEmployeeCode = (code) => {
  if (!code) return null;
  if (typeof code === 'number') return code.toString().trim();
  return code.toString().trim();
};

// Find column index by name (case-insensitive, handles variations)
const findColumnIndex = (headers, possibleNames) => {
  const normalizedHeaders = headers.map(h => (h || '').toString().trim().toLowerCase());
  for (const name of possibleNames) {
    const index = normalizedHeaders.indexOf(name.toLowerCase());
    if (index !== -1) return index;
  }
  return -1;
};

// Main import function
const importPlacementFields = async () => {
  try {
    console.log('🚀 Starting placement fields import from Excel...');
    
    // Step 1: Read Excel file
    const filePath = path.join(__dirname, 'Department Wise Lists.xls');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found at: ${filePath}`);
    }
    
    console.log('📊 Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    console.log(`📋 Found ${sheetNames.length} sheet(s): ${sheetNames.join(', ')}`);
    
    // Step 2: Collect all employee data from all sheets
    const employeeDataMap = new Map(); // employeeCode -> { Company, Sector, Project, Department, Section, Designation, Location }
    
    for (const sheetName of sheetNames) {
      console.log(`\n📄 Processing sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (data.length < 3) {
        console.log(`⚠️ Sheet ${sheetName} has no data rows, skipping...`);
        continue;
      }
      
      // Row 0: Title (e.g., "Sardar Group Of Companies")
      // Row 1: Company name (e.g., "SGC-Head Office")
      // Row 2: Actual headers
      const headers = data[2].map(h => (h || '').toString().trim());
      console.log(`📋 Headers found: ${headers.join(', ')}`);
      
      // Find column indices
      const employeeCodeIndex = findColumnIndex(headers, ['id', 'employee code', 'employee id', 'employeeid', 'emp code', 'emp id']);
      const companyIndex = findColumnIndex(headers, ['company']);
      const sectorIndex = findColumnIndex(headers, ['sector']);
      const projectIndex = findColumnIndex(headers, ['project']);
      const departmentIndex = findColumnIndex(headers, ['department']);
      const sectionIndex = findColumnIndex(headers, ['section']);
      const designationIndex = findColumnIndex(headers, ['designation']);
      const locationIndex = findColumnIndex(headers, ['location']);
      
      if (employeeCodeIndex === -1) {
        console.log(`⚠️ Employee Code (ID) column not found in sheet ${sheetName}, skipping...`);
        continue;
      }
      
      console.log(`📍 Column indices - Employee Code: ${employeeCodeIndex}, Company: ${companyIndex}, Sector: ${sectorIndex}, Project: ${projectIndex}, Department: ${departmentIndex}, Section: ${sectionIndex}, Designation: ${designationIndex}, Location: ${locationIndex}`);
      
      // Process data rows (skip rows 0, 1, and 2 - title, company name, and headers)
      let rowCount = 0;
      for (let i = 3; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        const employeeCode = normalizeEmployeeCode(row[employeeCodeIndex]);
        if (!employeeCode) continue;
        
        const placementData = {
          company: companyIndex !== -1 ? (row[companyIndex] || '').toString().trim() : '',
          sector: sectorIndex !== -1 ? (row[sectorIndex] || '').toString().trim() : '',
          project: projectIndex !== -1 ? (row[projectIndex] || '').toString().trim() : '',
          department: departmentIndex !== -1 ? (row[departmentIndex] || '').toString().trim() : '',
          section: sectionIndex !== -1 ? (row[sectionIndex] || '').toString().trim() : '',
          designation: designationIndex !== -1 ? (row[designationIndex] || '').toString().trim() : '',
          location: locationIndex !== -1 ? (row[locationIndex] || '').toString().trim() : ''
        };
        
        // Store in map (if same employee code appears in multiple sheets, last one wins)
        employeeDataMap.set(employeeCode, placementData);
        rowCount++;
      }
      
      console.log(`✅ Processed ${rowCount} rows from sheet ${sheetName}`);
    }
    
    console.log(`\n📊 Total unique employee codes found: ${employeeDataMap.size}`);
    
    // Step 3: Convert to array and process in chunks
    const allEmployeeData = Array.from(employeeDataMap.entries());
    const CHUNK_SIZE = 100;
    const totalChunks = Math.ceil(allEmployeeData.length / CHUNK_SIZE);
    
    console.log(`\n📦 Processing in chunks of ${CHUNK_SIZE} employees`);
    console.log(`📊 Total chunks: ${totalChunks}`);
    
    // Step 4: Process each chunk
    let totalSuccessCount = 0;
    let totalNotFoundCount = 0;
    let totalErrorCount = 0;
    const allErrors = [];
    
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const startIndex = chunkIndex * CHUNK_SIZE;
      const endIndex = Math.min(startIndex + CHUNK_SIZE, allEmployeeData.length);
      const chunkData = allEmployeeData.slice(startIndex, endIndex);
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 Processing Chunk ${chunkIndex + 1}/${totalChunks} (Employees ${startIndex + 1}-${endIndex})`);
      console.log(`${'='.repeat(60)}`);
      
      // Process each employee in this chunk
      let chunkSuccessCount = 0;
      let chunkNotFoundCount = 0;
      let chunkErrorCount = 0;
      
      for (const [employeeCode, placementData] of chunkData) {
      try {
        // Find employee by employeeId
        const employee = await Employee.findOne({ employeeId: employeeCode });
        
        if (!employee) {
          console.log(`⚠️ Employee with code ${employeeCode} not found, skipping...`);
          chunkNotFoundCount++;
          allErrors.push({ employeeCode, error: 'Employee not found' });
          continue;
        }
        
        // Resolve reference IDs
        const companyId = placementData.company ? await getOrCreateCompany(placementData.company) : null;
        const sectorId = placementData.sector ? await getOrCreateSector(placementData.sector) : null;
        const projectId = placementData.project ? await getOrCreateProject(placementData.project) : null;
        const departmentId = placementData.department ? await getOrCreateDepartment(placementData.department) : null;
        const sectionId = placementData.section && departmentId ? await getOrCreateSection(placementData.section, departmentId) : null;
        const designationId = placementData.designation && departmentId ? await getOrCreateDesignation(placementData.designation, departmentId) : null;
        const locationId = placementData.location ? await getOrCreateLocation(placementData.location) : null;
        
        // Update only the 7 placement fields
        const updateData = {};
        if (companyId) updateData.placementCompany = companyId;
        if (sectorId) updateData.placementSector = sectorId;
        if (projectId) updateData.placementProject = projectId;
        if (departmentId) updateData.placementDepartment = departmentId;
        if (sectionId) updateData.placementSection = sectionId;
        if (designationId) updateData.placementDesignation = designationId;
        if (locationId) updateData.placementLocation = locationId;
        
        if (Object.keys(updateData).length > 0) {
          await Employee.findByIdAndUpdate(employee._id, updateData);
          console.log(`✅ Updated employee ${employeeCode} (${employee.firstName} ${employee.lastName})`);
          chunkSuccessCount++;
        } else {
          console.log(`⚠️ No valid placement data for employee ${employeeCode}, skipping...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing employee ${employeeCode}:`, error.message);
        chunkErrorCount++;
        allErrors.push({ employeeCode, error: error.message });
      }
      }
      
      // Chunk summary
      totalSuccessCount += chunkSuccessCount;
      totalNotFoundCount += chunkNotFoundCount;
      totalErrorCount += chunkErrorCount;
      
      console.log(`\n📊 Chunk ${chunkIndex + 1} Summary:`);
      console.log(`   ✅ Updated: ${chunkSuccessCount}`);
      console.log(`   ⚠️ Not found: ${chunkNotFoundCount}`);
      console.log(`   ❌ Errors: ${chunkErrorCount}`);
      console.log(`   📈 Progress: ${((chunkIndex + 1) / totalChunks * 100).toFixed(1)}% (${endIndex}/${allEmployeeData.length})`);
    }
    
    // Step 5: Generate final report
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${totalSuccessCount}`);
    console.log(`⚠️ Employees not found: ${totalNotFoundCount}`);
    console.log(`❌ Errors: ${totalErrorCount}`);
    console.log(`📋 Total processed: ${allEmployeeData.length}`);
    console.log(`📦 Total chunks processed: ${totalChunks}`);
    
    if (allErrors.length > 0 && allErrors.length <= 50) {
      console.log('\n❌ ERRORS (showing first 50):');
      allErrors.slice(0, 50).forEach(({ employeeCode, error }) => {
        console.log(`   - Employee ${employeeCode}: ${error}`);
      });
      if (allErrors.length > 50) {
        console.log(`   ... and ${allErrors.length - 50} more errors`);
      }
    } else if (allErrors.length > 50) {
      console.log(`\n❌ Total errors: ${allErrors.length} (too many to display)`);
    }
    
    console.log('\n✅ Import completed!');
    
  } catch (error) {
    console.error('❌ Import error:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await importPlacementFields();
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

main();

