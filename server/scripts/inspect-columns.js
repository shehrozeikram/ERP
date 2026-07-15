const XLSX = require('xlsx');
const path = require('path');

const run = () => {
  const file = path.join(__dirname, '../../docs/Land Transfer detail.xlsx');
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
  
  if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('Sample Row:', data[0]);
  }
};

run();
