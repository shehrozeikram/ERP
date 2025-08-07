const xlsx = require('xlsx');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Import models
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Designation = require('../models/hr/Designation');
const Location = require('../models/hr/Location');
const Company = require('../models/hr/Company');

// Database connection
require('dotenv').config();

class EmployeeImporter {
  constructor() {
    this.stats = {
      total: 0,
      created: 0,
      updated: 0,
      errors: 0,
      skipped: 0
    };
    this.errors = [];
  }

  async connectToDatabase() {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }
  }

  async disconnectFromDatabase() {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }

  readExcelFile(filePath) {
    try {
      console.log(`📖 Reading Excel file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Get first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with header row
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length < 2) {
        throw new Error('Excel file must have at least a header row and one data row');
      }

      const headers = data[0];
      const rows = data.slice(1);

      console.log(`📊 Found ${rows.length} rows of data`);
      console.log(`📋 Headers: ${headers.join(', ')}`);

      return { headers, rows };
    } catch (error) {
      console.error('❌ Error reading Excel file:', error.message);
      throw error;
    }
  }

  // Map Excel columns to employee fields
  mapExcelRowToEmployee(headers, row) {
    const employee = {};
    
    // Create a map of header names to values
    const rowData = {};
    headers.forEach((header, index) => {
      if (header && row[index] !== undefined) {
        rowData[header.toString().trim().toLowerCase()] = row[index];
      }
    });

    console.log('🔍 Mapping row data:', rowData);

    // Map common fields (adjust these based on your Excel structure)
    employee.employeeId = this.cleanValue(rowData['employee id'] || rowData['employeeid'] || rowData['id']);
    employee.firstName = this.cleanValue(rowData['first name'] || rowData['firstname'] || rowData['name']);
    employee.lastName = this.cleanValue(rowData['last name'] || rowData['lastname'] || rowData['surname']);
    employee.email = this.cleanValue(rowData['email'] || rowData['email address']);
    employee.phone = this.cleanValue(rowData['phone'] || rowData['phone number'] || rowData['mobile']);
    employee.dateOfBirth = this.parseDate(rowData['date of birth'] || rowData['dob'] || rowData['birth date']);
    employee.dateOfJoining = this.parseDate(rowData['date of joining'] || rowData['joining date'] || rowData['hire date']);
    employee.gender = this.cleanValue(rowData['gender'] || rowData['sex']);
    employee.nationality = this.cleanValue(rowData['nationality'] || rowData['country']);
    employee.cnic = this.cleanValue(rowData['cnic'] || rowData['national id'] || rowData['id number']);
    employee.address = this.cleanValue(rowData['address'] || rowData['home address']);
    employee.city = this.cleanValue(rowData['city']);
    employee.province = this.cleanValue(rowData['province'] || rowData['state']);
    employee.postalCode = this.cleanValue(rowData['postal code'] || rowData['zip code']);
    employee.emergencyContact = this.cleanValue(rowData['emergency contact'] || rowData['emergency phone']);
    employee.emergencyContactName = this.cleanValue(rowData['emergency contact name'] || rowData['emergency name']);
    employee.emergencyContactRelation = this.cleanValue(rowData['emergency contact relation'] || rowData['emergency relation']);

    // Salary information
    employee.salary = {
      basic: this.parseNumber(rowData['basic salary'] || rowData['basic'] || rowData['salary']),
      gross: this.parseNumber(rowData['gross salary'] || rowData['gross'] || rowData['total salary']),
      medical: this.parseNumber(rowData['medical allowance'] || rowData['medical']),
      houseRent: this.parseNumber(rowData['house rent allowance'] || rowData['hra'] || rowData['house rent']),
      transport: this.parseNumber(rowData['transport allowance'] || rowData['transport']),
      meal: this.parseNumber(rowData['meal allowance'] || rowData['meal']),
      other: this.parseNumber(rowData['other allowance'] || rowData['other'])
    };

    // Employment details
    employee.employmentType = this.cleanValue(rowData['employment type'] || rowData['type'] || 'Permanent');
    employee.status = this.cleanValue(rowData['status'] || rowData['employee status'] || 'Active');
    employee.workLocation = this.cleanValue(rowData['work location'] || rowData['location']);
    employee.shift = this.cleanValue(rowData['shift'] || rowData['work shift']);
    employee.workingDays = this.parseNumber(rowData['working days'] || rowData['days per week'] || 5);

    // Department and Position (will be resolved later)
    employee.departmentName = this.cleanValue(rowData['department'] || rowData['dept']);
    employee.positionName = this.cleanValue(rowData['position'] || rowData['job title'] || rowData['title']);
    employee.designationName = this.cleanValue(rowData['designation'] || rowData['job level'] || rowData['level']);

    // Bank details
    employee.bankName = this.cleanValue(rowData['bank name'] || rowData['bank']);
    employee.accountNumber = this.cleanValue(rowData['account number'] || rowData['bank account']);
    employee.accountTitle = this.cleanValue(rowData['account title'] || rowData['account holder']);

    // Additional fields
    employee.bloodGroup = this.cleanValue(rowData['blood group'] || rowData['blood type']);
    employee.maritalStatus = this.cleanValue(rowData['marital status'] || rowData['marital']);
    employee.religion = this.cleanValue(rowData['religion']);
    employee.education = this.cleanValue(rowData['education'] || rowData['qualification']);
    employee.experience = this.parseNumber(rowData['experience'] || rowData['years of experience']);

    // Remove undefined values
    Object.keys(employee).forEach(key => {
      if (employee[key] === undefined || employee[key] === null || employee[key] === '') {
        delete employee[key];
      }
    });

    return employee;
  }

  cleanValue(value) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return value.toString().trim();
  }

  parseNumber(value) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const num = parseFloat(value.toString().replace(/[^\d.-]/g, ''));
    return isNaN(num) ? undefined : num;
  }

  parseDate(value) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    
    try {
      // Handle Excel date numbers
      if (typeof value === 'number') {
        return new Date((value - 25569) * 86400 * 1000);
      }
      
      // Handle string dates
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date;
    } catch (error) {
      return undefined;
    }
  }

  async resolveDepartment(departmentName) {
    if (!departmentName) return null;
    
    try {
      let department = await Department.findOne({ 
        name: { $regex: new RegExp(departmentName, 'i') } 
      });
      
      if (!department) {
        console.log(`📝 Creating new department: ${departmentName}`);
        department = new Department({
          name: departmentName,
          code: departmentName.substring(0, 3).toUpperCase(),
          description: `Department for ${departmentName}`,
          isActive: true
        });
        await department.save();
      }
      
      return department._id;
    } catch (error) {
      console.error(`❌ Error resolving department ${departmentName}:`, error.message);
      return null;
    }
  }

  async resolvePosition(positionName) {
    if (!positionName) return null;
    
    try {
      let position = await Position.findOne({ 
        title: { $regex: new RegExp(positionName, 'i') } 
      });
      
      if (!position) {
        console.log(`📝 Creating new position: ${positionName}`);
        position = new Position({
          title: positionName,
          code: positionName.substring(0, 3).toUpperCase(),
          description: `Position for ${positionName}`,
          isActive: true
        });
        await position.save();
      }
      
      return position._id;
    } catch (error) {
      console.error(`❌ Error resolving position ${positionName}:`, error.message);
      return null;
    }
  }

  async resolveDesignation(designationName) {
    if (!designationName) return null;
    
    try {
      let designation = await Designation.findOne({ 
        title: { $regex: new RegExp(designationName, 'i') } 
      });
      
      if (!designation) {
        console.log(`📝 Creating new designation: ${designationName}`);
        designation = new Designation({
          title: designationName,
          code: designationName.substring(0, 3).toUpperCase(),
          description: `Designation for ${designationName}`,
          isActive: true
        });
        await designation.save();
      }
      
      return designation._id;
    } catch (error) {
      console.error(`❌ Error resolving designation ${designationName}:`, error.message);
      return null;
    }
  }

  async createOrUpdateEmployee(employeeData) {
    try {
      // Check if employee already exists
      const existingEmployee = await Employee.findOne({ 
        employeeId: employeeData.employeeId 
      });

      if (existingEmployee) {
        console.log(`🔄 Updating existing employee: ${employeeData.employeeId}`);
        
        // Update existing employee
        Object.keys(employeeData).forEach(key => {
          if (key !== '_id' && employeeData[key] !== undefined) {
            existingEmployee[key] = employeeData[key];
          }
        });
        
        await existingEmployee.save();
        this.stats.updated++;
        return existingEmployee;
      } else {
        console.log(`➕ Creating new employee: ${employeeData.employeeId}`);
        
        // Create new employee
        const newEmployee = new Employee(employeeData);
        await newEmployee.save();
        this.stats.created++;
        return newEmployee;
      }
    } catch (error) {
      console.error(`❌ Error creating/updating employee ${employeeData.employeeId}:`, error.message);
      this.errors.push({
        employeeId: employeeData.employeeId,
        error: error.message
      });
      this.stats.errors++;
      return null;
    }
  }

  async importEmployees(filePath) {
    try {
      console.log('🚀 Starting employee import process...');
      
      // Read Excel file
      const { headers, rows } = this.readExcelFile(filePath);
      this.stats.total = rows.length;

      console.log('\n📋 Processing employees...');
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        console.log(`\n👤 Processing row ${i + 1}/${rows.length}`);
        
        try {
          // Map Excel row to employee data
          const employeeData = this.mapExcelRowToEmployee(headers, row);
          
          if (!employeeData.employeeId) {
            console.log(`⚠️ Skipping row ${i + 1}: No employee ID found`);
            this.stats.skipped++;
            continue;
          }

          // Resolve references
          if (employeeData.departmentName) {
            employeeData.department = await this.resolveDepartment(employeeData.departmentName);
            delete employeeData.departmentName;
          }
          
          if (employeeData.positionName) {
            employeeData.position = await this.resolvePosition(employeeData.positionName);
            delete employeeData.positionName;
          }
          
          if (employeeData.designationName) {
            employeeData.designation = await this.resolveDesignation(employeeData.designationName);
            delete employeeData.designationName;
          }

          // Create or update employee
          await this.createOrUpdateEmployee(employeeData);
          
        } catch (error) {
          console.error(`❌ Error processing row ${i + 1}:`, error.message);
          this.stats.errors++;
          this.errors.push({
            row: i + 1,
            error: error.message
          });
        }
      }

      // Print summary
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Import failed:', error.message);
      throw error;
    }
  }

  printSummary() {
    console.log('\n📊 Import Summary:');
    console.log('==================');
    console.log(`Total rows processed: ${this.stats.total}`);
    console.log(`Employees created: ${this.stats.created}`);
    console.log(`Employees updated: ${this.stats.updated}`);
    console.log(`Rows skipped: ${this.stats.skipped}`);
    console.log(`Errors: ${this.stats.errors}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.employeeId || `Row ${error.row}`}: ${error.error}`);
      });
    }
    
    console.log('\n✅ Import process completed!');
  }
}

// Main execution
async function main() {
  const importer = new EmployeeImporter();
  
  try {
    // Connect to database
    await importer.connectToDatabase();
    
    // Get file path from command line argument or use default
    const filePath = process.argv[2] || path.join(__dirname, 'master.xlsx');
    
    // Import employees
    await importer.importEmployees(filePath);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await importer.disconnectFromDatabase();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = EmployeeImporter; 