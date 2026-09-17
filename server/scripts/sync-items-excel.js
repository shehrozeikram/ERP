require('dotenv').config();
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');

const UtilityStoreItem = require('../models/hr/UtilityStoreItem');
const UtilityStoreCategory = require('../models/hr/UtilityStoreCategory');
const PlacementCompany = require('../models/hr/Company');

async function sync() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL || 'mongodb://127.0.0.1:27017/sgc_erp';
  await mongoose.connect(uri);
  console.log('Connected to DB:', uri);

  const filePath = path.join(__dirname, '../../docs/Categories of Admin Store.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[1]; // ITEM tab
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  // Load companies
  const companies = await PlacementCompany.find();
  const companyMap = {};
  companies.forEach(c => {
    companyMap[c.name.toLowerCase().trim()] = c._id;
    // Map SGC alias
    if (c.name.toLowerCase().trim() === 'sardar group of companies') {
      companyMap['sgc'] = c._id;
    }
  });

  // Load categories
  const categories = await UtilityStoreCategory.find().populate('parentCategory');
  const categoryMap = {}; // name -> id
  const subCategoryMap = {}; // parentName_subName -> id

  categories.forEach(c => {
    if (!c.parentCategory) {
      categoryMap[c.name.toLowerCase().trim()] = c._id;
    } else {
      const pName = c.parentCategory.name.toLowerCase().trim();
      subCategoryMap[`${pName}_${c.name.toLowerCase().trim()}`] = c._id;
    }
  });

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const row of data) {
    const code = row['Code']?.trim();
    if (!code) continue;

    // Remove leading/trailing weird whitespace/invisible chars just in case
    const parentCatName = row['Category']?.replace(/^\s+|\s+$/g, '').toLowerCase();
    const subCatName = row['Sub Category']?.replace(/^\s+|\s+$/g, '').toLowerCase();
    
    let finalCatId = null;
    if (parentCatName) {
      if (subCatName && subCategoryMap[`${parentCatName}_${subCatName}`]) {
        finalCatId = subCategoryMap[`${parentCatName}_${subCatName}`];
      } else if (categoryMap[parentCatName]) {
        finalCatId = categoryMap[parentCatName];
      } else {
        // Fallback for slight mismatches
        const matchedParent = Object.keys(categoryMap).find(k => k.includes(parentCatName) || parentCatName.includes(k));
        if (matchedParent) {
           if (subCatName) {
             const matchedSub = Object.keys(subCategoryMap).find(k => k.startsWith(matchedParent + '_') && (k.includes(subCatName) || subCatName.includes(k.split('_')[1])));
             if (matchedSub) finalCatId = subCategoryMap[matchedSub];
             else finalCatId = categoryMap[matchedParent];
           } else {
             finalCatId = categoryMap[matchedParent];
           }
        }
      }
    }

    const accountName = row['Account']?.trim().toLowerCase();
    let companyId = null;
    if (accountName) {
      if (companyMap[accountName]) {
        companyId = companyMap[accountName];
      } else if (accountName === 'sgc' && companyMap['sardar group of companies']) {
        companyId = companyMap['sardar group of companies'];
      }
    }

    const type = row['Type']?.trim();
    const meterVal = row['Meter']?.toString().trim();
    const location = row['Location']?.toString().trim();
    const amountStr = row['Amount']?.toString().replace(/[^0-9.]/g, '');
    const amount = amountStr ? parseFloat(amountStr) : 0;
    const name = row['Item name']?.toString().trim();
    
    const updateObj = {};
    if (name) updateObj.name = name;
    if (finalCatId) updateObj.category = finalCatId;
    if (companyId) updateObj.company = companyId;
    if (type) updateObj.utilityType = type;
    if (location) updateObj.location = location;
    if (amount) updateObj.defaultAmount = amount;
    
    const referenceNumber = meterVal || '';
    updateObj.referenceNumber = referenceNumber;
    updateObj.meterNumber = ''; // Optionally clear meterNumber if we are moving it
    
    const result = await UtilityStoreItem.updateOne(
      { code }, 
      { $set: updateObj }, 
      { upsert: true }
    );
    
    if (result.upsertedCount > 0) {
      console.log('Created new item:', code, '|', name);
      updatedCount++;
    } else if (result.matchedCount > 0) {
      updatedCount++;
    } else {
      notFoundCount++;
    }
  }

  console.log(`\nFinished sync!`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Not Found: ${notFoundCount}`);
  process.exit(0);
}

sync().catch(err => {
  console.error(err);
  process.exit(1);
});
