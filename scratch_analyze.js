const xlsx = require('xlsx');

const workbook = xlsx.readFile('./docs/Leave01.xlsx');
console.log('Sheets found:', workbook.SheetNames);

const sheetName = '20260725';
if (workbook.SheetNames.includes(sheetName)) {
  const sheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`\nSheet '${sheetName}' has ${rawData.length} rows.`);
  
  if (rawData.length > 0) {
    console.log('Columns:', Object.keys(rawData[0]));
    
    // Sample first 3 rows
    console.log('\nFirst 3 rows:');
    console.log(rawData.slice(0, 3));
    
    // Some basic analysis
    let missingEmpId = 0;
    let missingDates = 0;
    const leaveTypes = new Set();
    const employees = new Set();
    
    rawData.forEach(row => {
      if (!row['Employee ID']) missingEmpId++;
      if (!row['Start Time'] || !row['End Time']) missingDates++;
      if (row['Pay Code']) leaveTypes.add(row['Pay Code']);
      if (row['Employee ID']) employees.add(row['Employee ID']);
    });
    
    console.log('\n--- Analysis ---');
    console.log(`Unique Employees: ${employees.size}`);
    console.log(`Leave Types found: ${Array.from(leaveTypes).join(', ')}`);
    console.log(`Rows missing Employee ID: ${missingEmpId}`);
    console.log(`Rows missing Start/End Time: ${missingDates}`);
  }
} else {
  console.log(`Sheet '${sheetName}' not found.`);
}
