const xlsx = require('xlsx');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Import models
const Employee = require('../models/hr/Employee');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Designation = require('../models/hr/Designation');
const Bank = require('../models/hr/Bank');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');

// Database connection
require('dotenv').config();

class SardarEmployeeImporterSimple {
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
      
      // Convert to JSON with header row (Row 3 has the actual headers)
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length < 4) {
        throw new Error('Excel file must have at least 4 rows (title, headers, and data)');
      }

      // Headers are in Row 3 (index 2)
      const headers = data[2];
      // Data starts from Row 4 (index 3) and ends before the last row (which is totals)
      const rows = data.slice(3, -1); // Exclude the last row which contains totals

      console.log(`📊 Found ${rows.length} rows of employee data`);
      console.log(`📋 Headers: ${headers.join(', ')}`);

      return { headers, rows };
    } catch (error) {
      console.error('❌ Error reading Excel file:', error.message);
      throw error;
    }
  }

  // Map Excel columns to employee fields based on Sardar file structure
  mapExcelRowToEmployee(headers, row) {
    const employee = {};
    
    // Create a map of header names to values
    const rowData = {};
    headers.forEach((header, index) => {
      if (header && row[index] !== undefined) {
        rowData[header.toString().trim()] = row[index];
      }
    });

    // Map fields based on Sardar file structure
    employee.employeeId = this.cleanValue(rowData['ID']);
    employee.firstName = this.cleanValue(rowData['Name']);
    employee.lastName = ''; // Will be extracted from Name field
    employee.guardianName = this.cleanValue(rowData['Guardian Name']);
    employee.cnic = this.cleanValue(rowData['CNIC']);
    employee.bankName = this.cleanValue(rowData['Bank']);
    employee.accountNumber = this.cleanValue(rowData['Account No']);
    employee.dateOfJoining = this.parseExcelDate(rowData['DOJ']);
    employee.dateOfBirth = this.parseExcelDate(rowData['DOB']);
    employee.phone = this.cleanValue(rowData['Contact No']);

    // Extract first and last name from Name field
    if (employee.firstName) {
      const nameParts = employee.firstName.split(' ');
      if (nameParts.length >= 2) {
        employee.firstName = nameParts[0];
        employee.lastName = nameParts.slice(1).join(' ');
      }
    }

    // Salary information
    employee.salary = {
      basic: this.parseNumber(rowData['Basic']),
      gross: this.parseNumber(rowData['Gross Salary']),
      medical: this.parseNumber(rowData['Medical Allowance']),
      houseRent: this.parseNumber(rowData['House Allowance']),
      transport: this.parseNumber(rowData['Vehicle & Fuel Allowance']),
      meal: this.parseNumber(rowData['Food Allowance']),
      other: this.parseNumber(rowData['Covance Allowance'])
    };

    // Employment details
    employee.employmentType = 'Full-time';
    employee.employmentStatus = 'Active';
    employee.workLocation = this.cleanValue(rowData['Location']);

    // Department and Position (will be resolved later)
    employee.departmentName = this.cleanValue(rowData['Department']);
    employee.sectionName = this.cleanValue(rowData['Section']);
    employee.designationName = this.cleanValue(rowData['Designation']);
    employee.projectName = this.cleanValue(rowData['Project']);

    // Additional fields
    employee.arrears = this.parseNumber(rowData['Arears']);
    employee.incomeTax = this.parseNumber(rowData['Income Tax']);
    employee.companyLoan = this.parseNumber(rowData['Company Loan']);
    employee.vehicleLoan = this.parseNumber(rowData['Vehicle Loan']);
    employee.eobiDeduction = this.parseNumber(rowData['EOBI Ded']);
    employee.netPayable = this.parseNumber(rowData['Net Payable']);

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

  parseExcelDate(value) {
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

  async getDefaultReferences() {
    // Get or create default references for required fields
    let defaultBank = await Bank.findOne({ name: { $regex: /allied/i } });
    if (!defaultBank) {
      defaultBank = await Bank.findOne();
    }
    if (!defaultBank) {
      defaultBank = new Bank({
        name: 'Default Bank',
        code: 'DEF',
        isActive: true
      });
      await defaultBank.save();
    }

    let defaultCity = await City.findOne({ name: { $regex: /islamabad/i } });
    if (!defaultCity) {
      defaultCity = await City.findOne();
    }
    if (!defaultCity) {
      defaultCity = new City({
        name: 'Islamabad',
        code: 'ISB',
        isActive: true
      });
      await defaultCity.save();
    }

    let defaultProvince = await Province.findOne({ name: { $regex: /punjab/i } });
    if (!defaultProvince) {
      defaultProvince = await Province.findOne();
    }
    if (!defaultProvince) {
      defaultProvince = new Province({
        name: 'Punjab',
        code: 'PUN',
        isActive: true
      });
      await defaultProvince.save();
    }

    let defaultCountry = await Country.findOne({ name: { $regex: /pakistan/i } });
    if (!defaultCountry) {
      defaultCountry = await Country.findOne();
    }
    if (!defaultCountry) {
      defaultCountry = new Country({
        name: 'Pakistan',
        code: 'PAK',
        isActive: true
      });
      await defaultCountry.save();
    }

    return { defaultBank, defaultCity, defaultProvince, defaultCountry };
  }

  async resolveDepartment(departmentName) {
    if (!departmentName) return null;
    
    try {
      // Try to find existing department
      let department = await Department.findOne({ 
        name: { $regex: new RegExp(departmentName, 'i') } 
      });
      
      if (!department) {
        // Create new department with unique code
        const timestamp = Date.now();
        const uniqueCode = `${departmentName.substring(0, 3).toUpperCase()}${timestamp.toString().slice(-3)}`;
        
        console.log(`📝 Creating new department: ${departmentName} with code ${uniqueCode}`);
        department = new Department({
          name: departmentName,
          code: uniqueCode,
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
      // Try to find existing position
      let position = await Position.findOne({ 
        title: { $regex: new RegExp(positionName, 'i') } 
      });
      
      if (!position) {
        // Create new position with unique code
        const timestamp = Date.now();
        const uniqueCode = `${positionName.substring(0, 3).toUpperCase()}${timestamp.toString().slice(-3)}`;
        
        console.log(`📝 Creating new position: ${positionName} with code ${uniqueCode}`);
        position = new Position({
          title: positionName,
          code: uniqueCode,
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
      console.log('🚀 Starting Sardar employee import process...');
      
      // Get default references
      const { defaultBank, defaultCity, defaultProvince, defaultCountry } = await this.getDefaultReferences();
      
      // Read Excel file
      const { headers, rows } = this.readExcelFile(filePath);
      this.stats.total = rows.length;

      console.log('\n📋 Processing employees...');
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          // Map Excel row to employee data
          const employeeData = this.mapExcelRowToEmployee(headers, row);
          
          if (!employeeData.employeeId) {
            console.log(`⚠️ Skipping row ${i + 1}: No employee ID found`);
            this.stats.skipped++;
            continue;
          }

          // Add required fields with default values
          employeeData.email = `${employeeData.firstName?.toLowerCase() || 'employee'}.${employeeData.employeeId}@sardar.com`;
          employeeData.gender = 'male'; // Default gender
          employeeData.nationality = 'Pakistani';
          employeeData.idCard = employeeData.cnic || `CNIC-${employeeData.employeeId}`;
          employeeData.qualification = 'Bachelor\'s Degree'; // Default qualification
          employeeData.probationPeriodMonths = 3; // Default probation period
          employeeData.appointmentDate = employeeData.dateOfJoining || new Date();
          employeeData.hireDate = employeeData.dateOfJoining || new Date();

          // Address information
          employeeData.address = {
            street: 'Default Street',
            city: defaultCity._id,
            state: defaultProvince._id,
            country: defaultCountry._id
          };

          // Emergency contact
          employeeData.emergencyContact = {
            name: employeeData.guardianName || 'Emergency Contact',
            relationship: 'Family',
            phone: employeeData.phone || '0300-0000000'
          };

          // Bank information
          employeeData.bankName = defaultBank._id;

          // Resolve references
          if (employeeData.departmentName) {
            employeeData.department = await this.resolveDepartment(employeeData.departmentName);
            delete employeeData.departmentName;
          }
          
          if (employeeData.designationName) {
            employeeData.position = await this.resolvePosition(employeeData.designationName);
            delete employeeData.designationName;
          }

          // Ensure we have required fields
          if (!employeeData.department) {
            employeeData.department = await this.resolveDepartment('General');
          }
          
          if (!employeeData.position) {
            employeeData.position = await this.resolvePosition('Employee');
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
  const importer = new SardarEmployeeImporterSimple();
  
  try {
    // Connect to database
    await importer.connectToDatabase();
    
    // Get file path from command line argument or use default
    const filePath = process.argv[2] || path.join(__dirname, 'Master_File_July-2025.xlsx');
    
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

module.exports = SardarEmployeeImporterSimple; 