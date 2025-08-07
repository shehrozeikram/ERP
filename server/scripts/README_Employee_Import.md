# Employee Import from Excel

This script allows you to import employee data from an Excel file into your SGC ERP system.

## 📋 Prerequisites

1. **Excel file format**: `.xlsx` file with headers in the first row
2. **Database connection**: MongoDB should be running and accessible
3. **Required packages**: `xlsx` package is already installed

## 📊 Expected Excel Format

### Required Headers (First Row)
Your Excel file should have these headers in the first row:

| Column | Description | Example | Required |
|--------|-------------|---------|----------|
| Employee ID | Unique employee identifier | EMP001 | ✅ Yes |
| First Name | Employee's first name | John | ✅ Yes |
| Last Name | Employee's last name | Doe | ✅ Yes |
| Email | Email address | john.doe@company.com | ❌ No |
| Phone | Phone number with country code | +92-300-1234567 | ❌ No |
| Date of Birth | Birth date (YYYY-MM-DD) | 1990-05-15 | ❌ No |
| Date of Joining | Joining date (YYYY-MM-DD) | 2023-01-15 | ❌ No |
| Gender | Male/Female/Other | Male | ❌ No |
| Nationality | Country of nationality | Pakistani | ❌ No |
| CNIC | Pakistani CNIC number | 35202-1234567-1 | ❌ No |
| Address | Home address | 123 Main Street | ❌ No |
| City | City name | Karachi | ❌ No |
| Province | Province/State | Sindh | ❌ No |
| Postal Code | Postal/ZIP code | 75000 | ❌ No |
| Emergency Contact | Emergency phone | +92-300-9876543 | ❌ No |
| Emergency Contact Name | Emergency contact name | Jane Doe | ❌ No |
| Emergency Contact Relation | Relationship | Wife | ❌ No |
| Basic Salary | Basic salary amount | 50000 | ❌ No |
| Gross Salary | Gross salary amount | 70000 | ❌ No |
| Medical Allowance | Medical allowance | 7000 | ❌ No |
| House Rent Allowance | House rent allowance | 16340 | ❌ No |
| Transport Allowance | Transport allowance | 5000 | ❌ No |
| Meal Allowance | Meal allowance | 3000 | ❌ No |
| Other Allowance | Other allowances | 1000 | ❌ No |
| Employment Type | Permanent/Contract/Temporary | Permanent | ❌ No |
| Status | Active/Inactive | Active | ❌ No |
| Work Location | Work location | Main Office | ❌ No |
| Shift | Day/Night | Day | ❌ No |
| Working Days | Days per week | 5 | ❌ No |
| Department | Department name | IT | ❌ No |
| Position | Job position | Software Engineer | ❌ No |
| Designation | Job designation | Senior | ❌ No |
| Bank Name | Bank name | ABC Bank | ❌ No |
| Account Number | Bank account number | 1234567890 | ❌ No |
| Account Title | Account holder name | John Doe | ❌ No |
| Blood Group | Blood group | A+ | ❌ No |
| Marital Status | Married/Single/Divorced | Married | ❌ No |
| Religion | Religion | Islam | ❌ No |
| Education | Education level | Bachelor's in Computer Science | ❌ No |
| Experience | Years of experience | 5 | ❌ No |

### Flexible Header Names
The script supports multiple variations of header names:

- **Employee ID**: `Employee ID`, `EmployeeID`, `ID`
- **First Name**: `First Name`, `FirstName`, `Name`
- **Last Name**: `Last Name`, `LastName`, `Surname`
- **Email**: `Email`, `Email Address`
- **Phone**: `Phone`, `Phone Number`, `Mobile`
- **Date of Birth**: `Date of Birth`, `DOB`, `Birth Date`
- **Date of Joining**: `Date of Joining`, `Joining Date`, `Hire Date`
- **Department**: `Department`, `Dept`
- **Position**: `Position`, `Job Title`, `Title`
- **Designation**: `Designation`, `Job Level`, `Level`

## 🚀 How to Use

### Step 1: Prepare Your Excel File
1. Create an Excel file (`.xlsx` format)
2. Add headers in the first row (see format above)
3. Add employee data in subsequent rows
4. Save the file (e.g., `master.xlsx`)

### Step 2: Place the File
Place your Excel file in the `server/scripts/` directory or provide the full path.

### Step 3: Run the Import Script

#### Option 1: Using default file name (master.xlsx)
```bash
cd server/scripts
node importEmployeesFromExcel.js
```

#### Option 2: Specify custom file path
```bash
cd server/scripts
node importEmployeesFromExcel.js /path/to/your/employees.xlsx
```

#### Option 3: From project root
```bash
node server/scripts/importEmployeesFromExcel.js server/scripts/master.xlsx
```

## 📈 What the Script Does

### 1. **Reads Excel File**
- Reads the first sheet of your Excel file
- Extracts headers and data rows
- Validates file format

### 2. **Maps Data**
- Maps Excel columns to employee fields
- Handles different header name variations
- Cleans and validates data

### 3. **Resolves References**
- **Departments**: Creates new departments if they don't exist
- **Positions**: Creates new positions if they don't exist
- **Designations**: Creates new designations if they don't exist

### 4. **Creates/Updates Employees**
- **New employees**: Creates new employee records
- **Existing employees**: Updates existing records (based on Employee ID)
- **Error handling**: Logs errors and continues processing

### 5. **Provides Summary**
- Total rows processed
- Employees created
- Employees updated
- Errors encountered
- Detailed error log

## 📊 Sample Output

```
🚀 Starting employee import process...
📖 Reading Excel file: /path/to/master.xlsx
📊 Found 50 rows of data
📋 Headers: Employee ID, First Name, Last Name, Email, Phone, Date of Birth...

📋 Processing employees...

👤 Processing row 1/50
🔍 Mapping row data: { 'employee id': 'EMP001', 'first name': 'John', ... }
📝 Creating new department: IT
📝 Creating new position: Software Engineer
📝 Creating new designation: Senior
➕ Creating new employee: EMP001

👤 Processing row 2/50
🔄 Updating existing employee: EMP002

...

📊 Import Summary:
==================
Total rows processed: 50
Employees created: 45
Employees updated: 5
Rows skipped: 0
Errors: 0

✅ Import process completed!
```

## ⚠️ Important Notes

### Data Validation
- **Employee ID is required**: Rows without Employee ID will be skipped
- **Dates**: Should be in YYYY-MM-DD format or Excel date format
- **Numbers**: Salary fields should be numeric values
- **Phone numbers**: Should include country code (+92 for Pakistan)

### Error Handling
- **Missing required fields**: Employee ID is the only required field
- **Invalid data**: Invalid dates, numbers, etc. will be set to undefined
- **Database errors**: Will be logged but won't stop the import process

### Duplicate Handling
- **Existing employees**: Will be updated based on Employee ID
- **New employees**: Will be created with new records
- **Departments/Positions/Designations**: Will be created if they don't exist

## 🔧 Customization

### Adding New Fields
To add support for new fields, modify the `mapExcelRowToEmployee` function in the script:

```javascript
// Add new field mapping
employee.newField = this.cleanValue(rowData['new field name']);
```

### Changing Field Mappings
To change how fields are mapped, modify the mapping logic:

```javascript
// Example: Change how email is mapped
employee.email = this.cleanValue(rowData['work email'] || rowData['email']);
```

### Custom Validation
Add custom validation in the `createOrUpdateEmployee` function:

```javascript
// Example: Validate email format
if (employeeData.email && !employeeData.email.includes('@')) {
  throw new Error('Invalid email format');
}
```

## 🆘 Troubleshooting

### Common Issues

1. **File not found**: Make sure the Excel file exists and path is correct
2. **Database connection failed**: Check MongoDB connection and credentials
3. **Invalid Excel format**: Ensure first row contains headers
4. **Permission errors**: Check file permissions and database access

### Debug Mode
To see detailed mapping information, the script already includes console logs for debugging.

## 📞 Support

If you encounter issues:
1. Check the console output for error messages
2. Verify your Excel file format matches the expected structure
3. Ensure database connection is working
4. Check that all required packages are installed

The script is designed to be robust and will continue processing even if some rows have errors. 