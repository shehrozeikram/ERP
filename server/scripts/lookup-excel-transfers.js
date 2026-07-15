const XLSX = require('xlsx');
const path = require('path');

const run = () => {
  const file = path.join(__dirname, '../../docs/Land Transfer detail.xlsx');
  const workbook = XLSX.readFile(file);
  console.log('Sheet Names:', workbook.SheetNames);

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const targetRefs = [
    'LTN-000823', 'LTN-000825', 'LTN-000820', 'LTN-000822', 'LTN-000821',
    'LTN-000815', 'LTN-000818', 'LTN-000817', 'LTN-000816', 'LTN-000808',
    'LTN-000814', 'LTN-000811', 'LTN-000810', 'LTN-000813'
  ];

  console.log('\n--- LOOKING UP TARGET TRANSFERS IN EXCEL ---');
  for (const ref of targetRefs) {
    const rows = data.filter(row => String(row['Reference No.'] || '').startsWith(ref));
    if (rows.length > 0) {
      for (const row of rows) {
        console.log(`Ref: ${row['Reference No.']} | Moza: ${row['Moza']} | Deal: ${row['Deal No.']} | Seller: ${row['Seller Name']} | Purchaser: ${row['Purchaser Name']}`);
      }
    } else {
      console.log(`Could not find ref ${ref} in sheet`);
    }
  }

  // Let's check other sheets if any
  if (workbook.SheetNames.length > 1) {
    console.log('\nChecking other sheets...');
    for (let sIdx = 1; sIdx < workbook.SheetNames.length; sIdx++) {
      const otherSheetName = workbook.SheetNames[sIdx];
      const otherSheet = workbook.Sheets[otherSheetName];
      const otherData = XLSX.utils.sheet_to_json(otherSheet, { defval: null });
      console.log(`Sheet "${otherSheetName}" has ${otherData.length} rows.`);
      if (otherData.length > 0) {
        console.log('Sample columns:', Object.keys(otherData[0]));
      }
    }
  }
};

run();
