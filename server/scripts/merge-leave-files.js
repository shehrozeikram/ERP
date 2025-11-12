const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Script to merge Leave_20251028152804.xlsx and leave-data-formatted.csv
 * Removes duplicates and creates a single CSV file
 */

// Helper function to normalize date format
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  
  // Handle different date formats
  // Format: DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
  const datePart = dateStr.toString().split(' ')[0];
  const parts = datePart.split('/');
  
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${day}/${month}/${year}`;
  }
  
  return dateStr.toString();
}

// Helper function to normalize leave type
function normalizeLeaveType(type) {
  if (!type) return '';
  const normalized = type.toString().trim();
  // Capitalize first letter
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

// Helper function to create a unique key for duplicate detection
function createUniqueKey(record) {
  // Use already normalized values from the record
  const employeeId = (record['Employee ID'] || '').toString().trim();
  const startDate = (record['Start Date'] || '').toString().trim();
  const endDate = (record['End Date'] || '').toString().trim();
  const leaveType = (record['Leave Type'] || '').toString().trim();
  
  // Normalize dates to just date part (remove time if present)
  const startDateOnly = startDate.split(' ')[0].trim();
  const endDateOnly = endDate.split(' ')[0].trim();
  
  return `${employeeId}|${startDateOnly}|${endDateOnly}|${leaveType}`;
}

// Read Excel file
function readExcelFile(filePath) {
  console.log(`📊 Reading Excel file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found: ${filePath}`);
  }
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Read as array of arrays to handle header row properly
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  // Find header row (usually row 1, after "Leave" row)
  let headerRowIndex = 0;
  for (let i = 0; i < rawData.length; i++) {
    if (rawData[i] && rawData[i][0] && rawData[i][0].toString().toLowerCase().includes('employee')) {
      headerRowIndex = i;
      break;
    }
  }
  
  const headers = rawData[headerRowIndex];
  const dataRows = rawData.slice(headerRowIndex + 1);
  
  // Convert to objects
  const data = dataRows
    .filter(row => row && row[0] && row[0].toString().trim()) // Filter empty rows
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header && header.toString().trim()) {
          record[header.toString().trim()] = row[index] || '';
        }
      });
      return record;
    });
  
  console.log(`   ✅ Found ${data.length} rows in Excel file`);
  
  // Show sample structure
  if (data.length > 0) {
    console.log(`   📋 Excel columns: ${Object.keys(data[0]).join(', ')}`);
  }
  
  return data;
}

// Read CSV file
function readCSVFile(filePath) {
  console.log(`📊 Reading CSV file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [];
  }
  
  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Simple CSV parsing (handles quoted fields)
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add last value
    
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    data.push(record);
  }
  
  console.log(`   ✅ Found ${data.length} rows in CSV file`);
  
  return data;
}

// Normalize date from Excel format (YYYY-MM-DD HH:mm:ss) to CSV format (DD/MM/YYYY)
function normalizeDateFromExcel(dateStr) {
  if (!dateStr) return '';
  
  const str = dateStr.toString().trim();
  
  // Handle Excel date format: YYYY-MM-DD HH:mm:ss or YYYY-MM-DD
  if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
    const datePart = str.split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  
  // Handle CSV format: DD/MM/YYYY
  return normalizeDate(str);
}

// Normalize leave type from Pay Code
function normalizeLeaveTypeFromPayCode(payCode) {
  if (!payCode) return '';
  
  const code = payCode.toString().trim().toLowerCase();
  
  // Map Pay Code to Leave Type
  if (code.includes('casual')) return 'Casual';
  if (code.includes('annual')) return 'Annual';
  if (code.includes('sick')) return 'Sick';
  if (code.includes('medical')) return 'Sick';
  
  return payCode.toString().trim();
}

// Normalize record to standard format
function normalizeRecord(record, source) {
  // Map different column names to standard format
  let employeeName = record['Employee Name'] || record['EmployeeName'] || record['Name'] || record['name'] || record['First Name'] || '';
  const employeeId = (record['Employee ID'] || record['EmployeeID'] || record['employeeId'] || record['ID'] || record['id'] || '').toString().trim();
  
  // If First Name exists but Employee Name doesn't, use First Name
  if (!employeeName && record['First Name']) {
    employeeName = record['First Name'];
  }
  
  // Handle dates - Excel uses "Start Time" and "End Time", CSV uses "Start Date" and "End Date"
  let startDate = record['Start Date'] || record['StartDate'] || record['startDate'] || '';
  let endDate = record['End Date'] || record['EndDate'] || record['endDate'] || '';
  
  if (source === 'Excel') {
    startDate = normalizeDateFromExcel(record['Start Time'] || record['StartTime'] || startDate);
    endDate = normalizeDateFromExcel(record['End Time'] || record['EndTime'] || endDate);
  } else {
    startDate = normalizeDate(startDate);
    endDate = normalizeDate(endDate);
  }
  
  // Handle leave type - Excel uses "Pay Code", CSV uses "Leave Type"
  let leaveType = record['Leave Type'] || record['LeaveType'] || record['leaveType'] || '';
  if (source === 'Excel' && record['Pay Code']) {
    leaveType = normalizeLeaveTypeFromPayCode(record['Pay Code']);
  } else {
    leaveType = normalizeLeaveType(leaveType);
  }
  
  // Calculate duration if not present
  let duration = record['Duration (Days)'] || record['Duration'] || record['duration'] || record['Days'] || record['days'] || '';
  if (!duration && startDate && endDate) {
    try {
      const startParts = startDate.split('/');
      const endParts = endDate.split('/');
      if (startParts.length === 3 && endParts.length === 3) {
        const start = new Date(startParts[2], startParts[1] - 1, startParts[0]);
        const end = new Date(endParts[2], endParts[1] - 1, endParts[0]);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
        duration = diffDays.toString();
      }
    } catch (e) {
      // Ignore calculation errors
    }
  }
  
  // Extract month and year from start date
  let month = record['Month'] || record['month'] || '';
  let year = record['Year'] || record['year'] || '';
  if (!month || !year) {
    try {
      const dateParts = startDate.split('/');
      if (dateParts.length === 3) {
        year = dateParts[2];
        month = `${year}-${dateParts[1].padStart(2, '0')}`;
      }
    } catch (e) {
      // Ignore extraction errors
    }
  }
  
  const normalized = {
    'Employee Name': employeeName,
    'Employee ID': employeeId,
    'Start Date': startDate,
    'End Date': endDate,
    'Leave Type': leaveType,
    'Reason': record['Reason'] || record['reason'] || record['Apply Reason'] || record['ApplyReason'] || '',
    'Enter Date': record['Enter Date'] || record['EnterDate'] || record['enterDate'] || record['Applied Date'] || record['AppliedDate'] || record['Apply Time'] || record['ApplyTime'] || '',
    'Duration (Days)': duration,
    'Month': month,
    'Year': year,
    'Source': source
  };
  
  return normalized;
}

// Merge and remove duplicates
function mergeAndRemoveDuplicates(excelData, csvData) {
  console.log('\n🔄 Merging files and removing duplicates...');
  
  const uniqueRecords = new Map();
  let duplicatesFound = 0;
  
  // Process Excel data first
  console.log(`   Processing ${excelData.length} Excel records...`);
  excelData.forEach((record, index) => {
    const normalized = normalizeRecord(record, 'Excel');
    const key = createUniqueKey(normalized);
    
    if (uniqueRecords.has(key)) {
      duplicatesFound++;
      // Keep the first occurrence (Excel data)
    } else {
      uniqueRecords.set(key, normalized);
    }
  });
  
  // Process CSV data
  console.log(`   Processing ${csvData.length} CSV records...`);
  csvData.forEach((record, index) => {
    const normalized = normalizeRecord(record, 'CSV');
    const key = createUniqueKey(normalized);
    
    if (uniqueRecords.has(key)) {
      duplicatesFound++;
      // Keep existing record (Excel takes precedence)
    } else {
      uniqueRecords.set(key, normalized);
    }
  });
  
  console.log(`   ✅ Found ${duplicatesFound} duplicate records`);
  console.log(`   ✅ Total unique records: ${uniqueRecords.size}`);
  
  return Array.from(uniqueRecords.values());
}

// Write to CSV file
function writeCSVFile(data, outputPath) {
  console.log(`\n💾 Writing merged data to: ${outputPath}`);
  
  if (data.length === 0) {
    console.log('   ⚠️  No data to write');
    return;
  }
  
  // Define headers
  const headers = [
    'Employee Name',
    'Employee ID',
    'Start Date',
    'End Date',
    'Leave Type',
    'Reason',
    'Enter Date',
    'Duration (Days)',
    'Month',
    'Year',
    'Source'
  ];
  
  // Create CSV content
  let csvContent = headers.map(h => `"${h}"`).join(',') + '\n';
  
  data.forEach(record => {
    const row = headers.map(header => {
      const value = record[header] || '';
      // Escape quotes and wrap in quotes
      return `"${value.toString().replace(/"/g, '""')}"`;
    });
    csvContent += row.join(',') + '\n';
  });
  
  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  console.log(`   ✅ Successfully wrote ${data.length} records to CSV file`);
}

// Main function
function main() {
  try {
    const scriptDir = __dirname;
    const excelPath = path.join(scriptDir, 'Leave_20251028152804.xlsx');
    const csvPath = path.join(scriptDir, 'leave-data-formatted.csv');
    const outputPath = path.join(scriptDir, 'merged-leave-data.csv');
    
    console.log('🚀 Starting merge process...\n');
    
    // Read files
    const excelData = readExcelFile(excelPath);
    const csvData = readCSVFile(csvPath);
    
    // Merge and remove duplicates
    const mergedData = mergeAndRemoveDuplicates(excelData, csvData);
    
    // Write output
    writeCSVFile(mergedData, outputPath);
    
    console.log('\n✅ Merge completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   Excel records: ${excelData.length}`);
    console.log(`   CSV records: ${csvData.length}`);
    console.log(`   Total unique records: ${mergedData.length}`);
    console.log(`   Output file: ${outputPath}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, mergeAndRemoveDuplicates, normalizeRecord };

