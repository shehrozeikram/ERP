# 📊 Excel Template Structure for Employee Import

## 🎯 **Required Excel Structure**

Your Excel file should have these columns (exact names):

### **Basic Information (Required)**
| Column Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `firstName` | Employee's first name | ✅ Yes | "John" |
| `lastName` | Employee's last name | ✅ Yes | "Doe" |
| `email` | Employee's email address | ✅ Yes | "john.doe@company.com" |
| `phone` | Phone number | ✅ Yes | "+92-300-1234567" |
| `dateOfBirth` | Date of birth | ✅ Yes | "1990-05-15" |
| `gender` | Gender (male/female/other) | ✅ Yes | "male" |
| `idCard` | ID Card number | ✅ Yes | "35202-1234567-1" |
| `nationality` | Nationality | ✅ Yes | "Pakistani" |

### **Employment Information**
| Column Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `appointmentDate` | Date of appointment | ✅ Yes | "2023-01-15" |
| `probationPeriodMonths` | Probation period in months | ❌ No | 3 |
| `employmentStatus` | Employment status | ❌ No | "Active" |
| `department` | Department name | ❌ No | "IT Department" |
| `designation` | Job designation | ❌ No | "Software Engineer" |

### **Salary Information**
| Column Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `basicSalary` | Basic salary amount | ✅ Yes | 50000 |
| `houseRent` | House rent allowance | ❌ No | 15000 |
| `medical` | Medical allowance | ❌ No | 5000 |
| `conveyance` | Conveyance allowance | ❌ No | 3000 |
| `otherAllowances` | Other allowances | ❌ No | 2000 |

### **Address Information**
| Column Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `street` | Street address | ❌ No | "123 Main Street" |
| `city` | City name | ❌ No | "Lahore" |
| `state` | State/Province name | ❌ No | "Punjab" |
| `country` | Country name | ❌ No | "Pakistan" |

### **Emergency Contact**
| Column Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `emergencyContactName` | Emergency contact name | ❌ No | "Jane Doe" |
| `emergencyContactRelation` | Relationship | ❌ No | "Spouse" |
| `emergencyContactPhone` | Emergency contact phone | ❌ No | "+92-300-9876543" |
| `emergencyContactEmail` | Emergency contact email | ❌ No | "jane.doe@email.com" |

### **Additional Information**
| Column Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `qualification` | Educational qualification | ❌ No | "Bachelor's in Computer Science" |
| `religion` | Religion | ❌ No | "Islam" |
| `maritalStatus` | Marital status | ❌ No | "Married" |
| `spouseName` | Spouse name | ❌ No | "Jane Doe" |

### **Bank Information**
| Column Name | Description | Required | Example |
|-------------|-------------|----------|---------|
| `bankName` | Bank name | ❌ No | "HBL Bank" |
| `accountNumber` | Bank account number | ❌ No | "1234-5678-9012-3456" |
| `foreignBankAccount` | Foreign bank account | ❌ No | "DE89 3704 0044 0532 0130 00" |

---

## 📋 **Sample Excel Row**

| firstName | lastName | email | phone | dateOfBirth | gender | idCard | nationality | basicSalary | department | designation |
|-----------|----------|-------|-------|-------------|--------|--------|-------------|-------------|------------|-------------|
| John | Doe | john.doe@company.com | +92-300-1234567 | 1990-05-15 | male | 35202-1234567-1 | Pakistani | 50000 | IT Department | Software Engineer |

---

## 🚀 **How to Use**

### **1. Prepare Your Excel File**
- Use the exact column names above
- Make sure required fields are filled
- Save as `.xlsx` format

### **2. Run the Import Script**
```bash
# From your project root
node server/scripts/import-employees-from-excel.js "path/to/your/excel/file.xlsx"

# Example with your existing file
node server/scripts/import-employees-from-excel.js server/scripts/Master_File_July-2025.xlsx
```

### **3. What Happens**
- ✅ **Existing employees**: Updated with new data
- ✅ **New employees**: Created automatically
- ✅ **References**: Departments, cities, banks created if they don't exist
- ✅ **Validation**: All data is validated before import

---

## ⚠️ **Important Notes**

1. **Column names must match exactly** (case-sensitive)
2. **Required fields** must be filled for each employee
3. **Dates** should be in YYYY-MM-DD format
4. **Numbers** should be numeric (not text)
5. **The script will create missing references** (departments, cities, etc.)

---

## 🎯 **Ready to Import?**

Just prepare your Excel file with these column names and run the import script! The system will handle everything else automatically. 🚀
