const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../docs/Left Employees Jan 2026 to June 2026.xlsx');
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

let currentMonth = null;
let validRows = [];

for (let row of data) {
  if (row.length === 1 && typeof row[0] === 'string' && row[0].startsWith('Left Employees ')) {
    currentMonth = row[0].replace('Left Employees ', '').trim();
  }
  
  // Valid row starts with a number in column 0 (Sr No) and has an ID in column 1
  if (typeof row[0] === 'number' && row[1]) {
    validRows.push({
      monthGroup: currentMonth,
      srNo: row[0],
      employeeId: row[1],
      name: row[2],
      doj: row[3],
      remarks: row[7]
    });
  }
}

console.log('Total valid leavers found:', validRows.length);
console.log('Sample of 10:', validRows.slice(0, 10));
console.log('Sample from middle:', validRows.slice(100, 110));
