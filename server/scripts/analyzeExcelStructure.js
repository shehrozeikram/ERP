const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function analyzeExcelStructure(filePath) {
  try {
    console.log(`🔍 Analyzing Excel file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const workbook = xlsx.readFile(filePath);
    
    console.log('\n📋 Sheet Information:');
    console.log('=====================');
    console.log(`Total sheets: ${workbook.SheetNames.length}`);
    workbook.SheetNames.forEach((sheetName, index) => {
      console.log(`${index + 1}. ${sheetName}`);
    });

    // Analyze each sheet
    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      console.log(`\n📊 Sheet ${sheetIndex + 1}: "${sheetName}"`);
      console.log('=' .repeat(50));
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Get sheet dimensions
      const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1');
      const maxRow = range.e.r;
      const maxCol = range.e.c;
      
      console.log(`Dimensions: ${maxRow + 1} rows × ${maxCol + 1} columns`);
      
      // Get headers (first row)
      const headers = [];
      for (let col = 0; col <= maxCol; col++) {
        const cellAddress = xlsx.utils.encode_cell({ r: 0, c: col });
        const cell = worksheet[cellAddress];
        headers.push(cell ? cell.v : `Column ${col + 1}`);
      }
      
      console.log('\n📋 Headers (Row 1):');
      headers.forEach((header, index) => {
        console.log(`${index + 1}. "${header}"`);
      });
      
      // Show first few data rows
      console.log('\n📄 Sample Data (First 5 rows):');
      for (let row = 1; row <= Math.min(5, maxRow); row++) {
        const rowData = [];
        for (let col = 0; col <= maxCol; col++) {
          const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          rowData.push(cell ? cell.v : '');
        }
        console.log(`Row ${row + 1}: [${rowData.map(val => `"${val}"`).join(', ')}]`);
      }
      
      // Show last few data rows
      if (maxRow > 5) {
        console.log('\n📄 Sample Data (Last 5 rows):');
        for (let row = Math.max(1, maxRow - 4); row <= maxRow; row++) {
          const rowData = [];
          for (let col = 0; col <= maxCol; col++) {
            const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            rowData.push(cell ? cell.v : '');
          }
          console.log(`Row ${row + 1}: [${rowData.map(val => `"${val}"`).join(', ')}]`);
        }
      }
      
      // Count non-empty cells in each column
      console.log('\n📊 Column Statistics:');
      for (let col = 0; col <= maxCol; col++) {
        let nonEmptyCount = 0;
        for (let row = 1; row <= maxRow; row++) {
          const cellAddress = xlsx.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
            nonEmptyCount++;
          }
        }
        console.log(`Column ${col + 1} ("${headers[col]}"): ${nonEmptyCount} non-empty values`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error analyzing Excel file:', error.message);
  }
}

// Main execution
function main() {
  const filePath = process.argv[2] || path.join(__dirname, 'Master_File_July-2025.xlsx');
  analyzeExcelStructure(filePath);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = analyzeExcelStructure; 