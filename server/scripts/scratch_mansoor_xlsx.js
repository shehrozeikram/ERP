const xlsx = require('xlsx');
const path = require('path');

const filePath = path.resolve(__dirname, '../../docs/Leave01.xlsx');
const workbook = xlsx.readFile(filePath, { cellDates: true });
const sheetName = '20260725';
const sheet = workbook.Sheets[sheetName];
const rawData = xlsx.utils.sheet_to_json(sheet);

const mansoorData = rawData.filter(row => {
  const empNo = String(row['Emp No.'] || row['Emp No'] || row['Employee ID'] || row['ID'] || '').trim();
  const firstName = String(row['First Name'] || row['Name'] || '').toLowerCase();
  return (empNo === '3' || empNo === '00003') && firstName.includes('mansoor');
});

console.log(`Found ${mansoorData.length} rows for Mansoor`);
console.log(JSON.stringify(mansoorData, null, 2));

// Create a new workbook with only Mansoor's data
const newWb = xlsx.utils.book_new();
const newWs = xlsx.utils.json_to_sheet(mansoorData);
xlsx.utils.book_append_sheet(newWb, newWs, sheetName);
xlsx.writeFile(newWb, path.resolve(__dirname, '../../docs/Leave_Mansoor.xlsx'));
console.log('Saved to docs/Leave_Mansoor.xlsx');
