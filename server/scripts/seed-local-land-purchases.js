require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');

const LandPurchase = require('../models/tajResidencia/LandPurchase');
const LandParty = require('../models/tajResidencia/LandParty');
const LandMoza = require('../models/tajResidencia/LandMoza');

const excelDateToJSDate = (serial) => {
  if (!serial) return new Date();
  if (typeof serial === 'number') {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  }
  const d = new Date(serial);
  return isNaN(d.getTime()) ? new Date() : d;
};

async function seedLandPurchases() {
  const mongoUri = process.env.MONGODB_LOCAL_URI || 'mongodb://127.0.0.1:27017/sgc_erp';
  await mongoose.connect(mongoUri);
  console.log('Connected to local MongoDB for purchases seed:', mongoUri);

  const file = path.join(__dirname, '../../docs/LAND PURCHASED DATA for IMPORT.xlsx');
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

  console.log(`Read ${data.length} rows from LAND PURCHASED DATA file.`);

  const mozas = await LandMoza.find({});
  const getMozaId = async (name) => {
    let n = (name || 'Unknown').trim();
    if (n.toLowerCase() === 'rupa') n = 'Rupa';
    let found = mozas.find(m => m.name.toLowerCase().trim() === n.toLowerCase());
    if (!found) {
      found = await LandMoza.create({ name: n, slug: n.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString().slice(-4) });
      mozas.push(found);
    }
    return found._id;
  };

  const getOrCreateParty = async (name, type, cnic) => {
    const n = String(name || `Unknown ${type}`).trim();
    const cleanCnic = cnic ? String(cnic).trim() : null;
    let p = null;
    if (cleanCnic) {
      p = await LandParty.findOne({ cnic: cleanCnic });
    }
    if (!p) {
      p = await LandParty.findOne({ name: { $regex: new RegExp(`^${n}$`, 'i') }, partyType: type });
    }
    if (!p) {
      const generatedCnic = cleanCnic || `00000-${Math.floor(1000000 + Math.random() * 9000000)}-${Math.floor(Math.random() * 10)}`;
      try {
        p = await LandParty.create({
          name: n,
          partyType: type,
          cnic: generatedCnic,
          phoneNumber: '00000000000'
        });
      } catch (e) {
        p = await LandParty.findOne({ name: { $regex: new RegExp(`^${n}$`, 'i') } });
      }
    }
    return p._id;
  };

  let count = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const dealNo = row['Deal No'];
    if (dealNo === null || dealNo === undefined) continue;

    const purchaseNo = row['Land Purchase #'] ? String(row['Land Purchase #']).trim() : `LP-${dealNo}-${i+1}`;
    const mozaId = await getMozaId(row['Moza']);
    const sellerId = await getOrCreateParty(row['Seller name'], 'seller', row['Seller CNIC']);
    const dealerId = row['Agent '] ? await getOrCreateParty(row['Agent '], 'dealer', row['Agent CNIC']) : null;

    const kanal = Number(row['Kanal']) || 0;
    const marla = Number(row['Marla']) || 0;
    const sarsai = Number(row['Sarsai']) || 0;
    const ratePerKanal = Number(row[' Rate / Kanal ']) || 0;
    const agreedAmount = Number(row['Land Purchase']) || 0;
    const totalSizeInKanal = kanal + (marla / 20) + (sarsai / 180);

    const purchaseDate = excelDateToJSDate(row['Date']);

    await LandPurchase.findOneAndUpdate(
      { purchaseNo },
      {
        purchaseNo,
        dealNo: Number(dealNo),
        purchaseDate,
        project: row['Project'] || 'Taj Residencia',
        seller: sellerId,
        dealer: dealerId,
        moza: mozaId,
        totalArea: { kanal, marla, sarsai },
        totalSizeInKanal,
        ratePerKanal,
        agreedAmount
      },
      { upsert: true, new: true }
    );
    count++;
  }

  console.log(`Successfully seeded ${count} LandPurchase records.`);
  await mongoose.disconnect();
}

seedLandPurchases().catch(err => {
  console.error('Error seeding purchases:', err);
  process.exit(1);
});
