const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const Project = require('../models/hr/Project');
const Department = require('../models/hr/Department');
require('dotenv').config();

// Helper function to find column index
const findColumnIndex = (headers, possibleNames) => {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h && h.toString().toLowerCase().includes(name.toLowerCase()));
    if (index !== -1) return index;
  }
  return -1;
};

// Main function
const assignDepartmentsToProjects = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to database');

    // Step 1: Read Excel file
    const filePath = path.join(__dirname, 'Department Wise Lists.xls');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found at: ${filePath}`);
    }

    console.log('📊 Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    console.log(`📋 Found ${sheetNames.length} sheet(s): ${sheetNames.join(', ')}`);

    // Step 2: Collect Project-Department mappings
    const projectDepartmentMap = new Map(); // projectName -> Set of departmentNames

    for (const sheetName of sheetNames) {
      console.log(`\n📄 Processing sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (data.length < 3) {
        console.log(`⚠️ Sheet ${sheetName} has no data rows, skipping...`);
        continue;
      }

      // Row 2: Headers (0-indexed, so row 2 is index 2)
      const headers = data[2].map(h => (h || '').toString().trim());
      console.log(`📋 Headers found: ${headers.join(', ')}`);

      // Find column indices
      const projectIndex = findColumnIndex(headers, ['project']);
      const departmentIndex = findColumnIndex(headers, ['department']);

      if (projectIndex === -1 || departmentIndex === -1) {
        console.log(`⚠️ Project or Department column not found in sheet ${sheetName}, skipping...`);
        continue;
      }

      console.log(`📍 Column indices - Project: ${projectIndex}, Department: ${departmentIndex}`);

      // Process data rows (skip rows 0, 1, and 2 - title, company name, and headers)
      let rowCount = 0;
      for (let i = 3; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const projectName = projectIndex !== -1 ? (row[projectIndex] || '').toString().trim() : '';
        const departmentName = departmentIndex !== -1 ? (row[departmentIndex] || '').toString().trim() : '';

        if (!projectName || !departmentName) continue;

        // Add to map
        if (!projectDepartmentMap.has(projectName)) {
          projectDepartmentMap.set(projectName, new Set());
        }
        projectDepartmentMap.get(projectName).add(departmentName);
        rowCount++;
      }

      console.log(`✅ Processed ${rowCount} rows from sheet ${sheetName}`);
    }

    console.log(`\n📊 Found ${projectDepartmentMap.size} unique projects with departments`);

    // Step 3: Display summary
    console.log('\n📋 Project-Department Mappings:');
    for (const [projectName, departments] of projectDepartmentMap.entries()) {
      console.log(`\n   ${projectName}:`);
      departments.forEach(dept => console.log(`      - ${dept}`));
    }

    // Step 4: Update projects in database
    console.log('\n🔄 Updating projects in database...');
    let updatedCount = 0;
    let createdCount = 0;
    let notFoundCount = 0;
    const errors = [];

    for (const [projectName, departmentNames] of projectDepartmentMap.entries()) {
      try {
        // Find project (case insensitive)
        let project = await Project.findOne({ 
          name: { $regex: new RegExp(`^${projectName.trim()}$`, 'i') } 
        });

        if (!project) {
          console.log(`⚠️ Project "${projectName}" not found in database, skipping...`);
          notFoundCount++;
          continue;
        }

        // Get department IDs
        const departmentIds = [];
        for (const deptName of departmentNames) {
          const department = await Department.findOne({ 
            name: { $regex: new RegExp(`^${deptName.trim()}$`, 'i') } 
          });
          if (department) {
            departmentIds.push(department._id);
          } else {
            console.log(`⚠️ Department "${deptName}" not found in database`);
          }
        }

        if (departmentIds.length === 0) {
          console.log(`⚠️ No valid departments found for project "${projectName}", skipping...`);
          continue;
        }

        // Update project with departments
        project.departments = departmentIds;
        await project.save();

        console.log(`✅ Updated project "${project.name}": ${departmentIds.length} department(s)`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Error updating project "${projectName}":`, error.message);
        errors.push({ project: projectName, error: error.message });
      }
    }

    // Step 5: Summary
    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updatedCount} project(s)`);
    console.log(`   ⚠️ Not found: ${notFoundCount} project(s)`);
    console.log(`   ❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(err => console.log(`   - ${err.project}: ${err.error}`));
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

assignDepartmentsToProjects();

