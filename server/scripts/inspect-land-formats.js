const XLSX = require('xlsx');
const path = require('path');

const run = () => {
  const file = path.join(__dirname, '../../docs/Land Transfer detail.xlsx');
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
  
  const formats = new Set();
  for (const row of data) {
    if (row['Land']) {
      formats.add(String(row['Land']).trim());
    }
  }

  console.log('Unique Land formats (first 50):');
  console.log(Array.from(formats).slice(0, 50));
};

run();
