/**
 * Seed CEO office fixed assets from handwritten FAR logs (June 2024).
 * Run: node server/scripts/seed-ceo-office-fixed-assets.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const FixedAsset = require('../models/finance/FixedAsset');

const IMPORT_TAG = 'FAR log import — CEO office (Jun 2024)';

const HQ_BUILDING = 'Sardar Plaza Head Quarter';

const clean = (value) => {
  const text = String(value || '').trim();
  if (!text || /^n\/?a$/i.test(text)) return '';
  return text;
};

const mapCategory = (category, assetName = '') => {
  const c = String(category || '').trim().toLowerCase();
  const name = String(assetName || '').trim().toLowerCase();
  if (c.includes('furniture')) return 'furniture';
  if (c.includes('computer') || c.includes('it')) return 'computer';
  if (
    c.includes('fixture')
    || /lcd|cpu|keyboard|mouse|gaming pad|ac\b/i.test(name)
  ) {
    return /lcd|cpu|keyboard|mouse|gaming pad/i.test(name) ? 'computer' : 'equipment';
  }
  if (c.includes('equipment')) return 'equipment';
  return 'furniture';
};

const parsePurchaseDate = (value) => {
  const raw = clean(value);
  if (!raw) return null;

  const monthMap = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12
  };

  const named = raw.match(/^(\d{1,2})[-\s]+([a-z]+)[-\s]+(\d{2,4})$/i);
  if (named) {
    const day = Number(named[1]);
    const month = monthMap[named[2].toLowerCase()];
    let year = Number(named[3]);
    if (year < 100) year += 2000;
    if (month) return new Date(year, month - 1, day);
  }

  const numeric = raw.match(/^(\d{1,2})[-.](\d{1,2})[-.]?(\d{2,4})?$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = numeric[3] ? Number(numeric[3]) : 2024;
    if (year < 100) year += 2000;
    // Handwritten 2.6.26 on several rows likely meant 2-6-24.
    if (year === 2026 && month === 6 && day <= 3) year = 2024;
    return new Date(year, month - 1, day);
  }

  return null;
};

const buildLocation = (floor, room) => {
  const parts = [HQ_BUILDING, clean(floor), clean(room)].filter(Boolean);
  return parts.join(', ');
};

const ASSETS = [
  // Image 1 — rows 1-18 (row 1 is 5 separate sofa chairs)
  ...[1, 2, 3, 4, 5].map((n) => ({
    sourceSheet: 'sheet-1',
    sourceSr: `1-${n}`,
    name: `Sofa chair ${n}`,
    category: 'Furniture',
    brand: 'Imported',
    model: 'N/A',
    manufacturer: 'Local',
    condition: 'New',
    purchaseDate: '2-June-24',
    floor: '2nd',
    room: 'CEO H.O.',
    remarks: `Blue sofa chair ${n} of 5 — set with Black Marble table (addon steel glass base 5ft long)`
  })),
  {
    sourceSheet: 'sheet-1',
    sourceSr: 2,
    name: 'Marble table',
    category: 'Fixture',
    brand: 'Imported',
    model: 'N/A',
    manufacturer: 'Imported',
    condition: 'New',
    purchaseDate: '2-June-24',
    floor: '2nd',
    room: 'CEO H.O.'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 3,
    name: 'Lamp',
    category: 'Fixture',
    brand: 'Imported',
    model: 'N/A',
    manufacturer: 'Imported',
    condition: 'New',
    purchaseDate: '2-6-24',
    floor: '2nd',
    room: 'CEO H.O.'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 4,
    name: 'Scan Mirror',
    category: 'Fixture',
    brand: 'Imported',
    model: 'N/A',
    manufacturer: 'Imported',
    condition: 'New',
    purchaseDate: '2-6-24',
    floor: '2nd',
    room: 'CEO H.O.',
    remarks: '6/2 Scan Mirror'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 5,
    name: 'Coat Hanger',
    category: 'Furniture',
    brand: 'Local',
    model: 'N/A',
    manufacturer: 'Local',
    condition: 'New',
    purchaseDate: '2-6-24',
    floor: '2nd',
    room: 'CEO H.O.',
    remarks: 'Coat Hanger Br color'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 6,
    name: 'Wooden Sofa Small',
    category: 'Furniture',
    brand: 'Imported',
    model: 'N/A',
    manufacturer: 'Imported',
    condition: 'New',
    floor: '2nd',
    room: 'H.O.',
    remarks: '2 wooden sofa skin palm table round'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 7,
    name: 'Round table Leather glass',
    category: 'Furniture',
    brand: 'Local',
    model: 'N/A',
    manufacturer: 'Local',
    condition: 'New',
    floor: '2nd',
    room: 'H.O.',
    remarks: 'Brown glass table leather skin'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 8,
    name: 'Wooden table skin color',
    category: 'Furniture',
    brand: 'Imported',
    model: 'N/A',
    manufacturer: 'Imported',
    condition: 'New',
    purchaseDate: '2-6-24',
    floor: '2nd',
    room: 'CEO H.O.',
    remarks: '1+1 Leather sofa wooden glass'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 9,
    name: 'Glass/wooden table',
    category: 'Furniture',
    brand: 'Imported',
    model: 'N/A',
    manufacturer: 'Imported',
    condition: 'New',
    purchaseDate: '2-6-24',
    floor: '2nd',
    room: 'CEO H.O.',
    remarks: 'Brown/white wooden glass'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 10,
    name: 'Ashtray computer tray',
    category: 'Fixture',
    brand: 'Local',
    model: 'N/A',
    manufacturer: 'Local',
    condition: 'New',
    purchaseDate: '2-6-24',
    floor: '2nd',
    room: 'CEO H.O.',
    remarks: 'Small Ashtray computer tray'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 11,
    name: 'LCD',
    category: 'Fixture',
    brand: 'ASUS',
    model: 'FYLHTF',
    manufacturer: 'ASUS',
    condition: 'New',
    floor: '2nd',
    room: 'CEO H.O.',
    remarks: 'with 2 racks B.C. 32 inch Black lcd'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 12,
    name: 'Gaming CPU',
    category: 'Fixture',
    brand: 'Boost',
    model: 'N/A',
    manufacturer: 'Boost',
    condition: 'New',
    floor: '2nd',
    room: 'CEO H.O.',
    remarks: 'Black color Gaming CPU Dell'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 13,
    name: 'Keyboard',
    category: 'Fixture',
    brand: 'Dell',
    model: 'RT7D50',
    manufacturer: 'Dell',
    condition: 'New',
    floor: '2nd',
    room: 'CEO H.O.',
    remarks: 'Black Keyboard'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 14,
    name: 'Mouse',
    category: 'Fixture',
    brand: 'Local',
    model: 'N/A',
    manufacturer: 'Local',
    condition: 'New',
    floor: '2nd',
    room: 'CEO H.O.',
    remarks: 'Black Mouse'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 15,
    name: 'Gaming Pad',
    category: 'Fixture',
    brand: 'XBOX',
    model: 'N/A',
    manufacturer: 'XBOX',
    condition: 'New',
    purchaseDate: '2-6-24',
    floor: '2nd',
    room: 'CEO',
    remarks: 'Black Gaming Pad'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 16,
    name: 'White tea Table',
    category: 'Furniture',
    brand: 'Local',
    model: 'N/A',
    manufacturer: 'Local',
    condition: 'Old',
    purchaseDate: '2-6-24',
    floor: '2nd',
    room: 'CEO',
    remarks: 'white wooden tea table'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 17,
    name: 'Haier AC',
    category: 'Fixture',
    brand: 'Haier',
    model: 'HSU18LFAE3E3',
    manufacturer: 'Haier',
    condition: 'Old',
    purchaseDate: '2-6-24',
    floor: '2nd',
    room: 'CEO',
    remarks: '1.5 ton Haier AC skin color'
  },
  {
    sourceSheet: 'sheet-1',
    sourceSr: 18,
    name: 'Coat Hanger',
    category: 'Furniture',
    brand: 'Imported',
    model: 'N/A',
    manufacturer: 'Imported',
    condition: 'New',
    floor: '2nd',
    room: 'CEO',
    remarks: 'Brown color wooden coat hanger'
  },

  // Image 2 — rows 1-6
  {
    sourceSheet: 'sheet-2',
    sourceSr: 1,
    name: 'Wooden Drawer',
    category: 'Furniture',
    brand: 'Local',
    model: 'N/A',
    manufacturer: 'Local',
    condition: 'Old',
    floor: '2nd',
    room: 'CEO Office',
    remarks: '4 wheel water dispenser Drawer with 3 drawers'
  },
  {
    sourceSheet: 'sheet-2',
    sourceSr: 2,
    name: 'Wooden table small',
    category: 'Furniture',
    brand: 'Local',
    model: 'N/A',
    manufacturer: 'Local',
    condition: 'Old',
    floor: '2nd',
    room: 'CEO Office',
    remarks: 'Wooden small Round table'
  },
  {
    sourceSheet: 'sheet-2',
    sourceSr: 3,
    name: 'Steel table',
    category: 'Furniture',
    brand: 'Local',
    model: 'N/A',
    manufacturer: 'Local',
    condition: 'New',
    floor: '2nd',
    room: 'CEO Office',
    remarks: 'Black & Golden Leather table'
  },
  {
    sourceSheet: 'sheet-2',
    sourceSr: 4,
    name: 'CEO Ex. Chair',
    category: 'Furniture',
    brand: 'Imported',
    model: 'N/A',
    manufacturer: 'Imported',
    condition: 'New',
    floor: '2nd',
    room: 'CEO Office',
    remarks: 'Mehran chair'
  },
  {
    sourceSheet: 'sheet-2',
    sourceSr: 5,
    name: 'CEO Ex. Table',
    category: 'Furniture',
    brand: 'Imported',
    model: 'N/A',
    manufacturer: 'Imported',
    condition: 'New',
    floor: '2nd',
    room: 'CEO Office',
    remarks: 'Brown color 10ft table'
  }
];

const toAssetDoc = (row) => {
  const purchaseDate = parsePurchaseDate(row.purchaseDate);
  const remarks = clean(row.remarks);
  const description = [IMPORT_TAG, remarks].filter(Boolean).join(' — ');
  return {
    name: clean(row.name),
    category: mapCategory(row.category, row.name),
    brand: clean(row.brand),
    model: clean(row.model),
    manufacturer: clean(row.manufacturer),
    condition: clean(row.condition),
    purchaseDate: purchaseDate || undefined,
    purchaseCost: 0,
    residualValue: 0,
    depreciationMethod: 'none',
    usefulLifeYears: 0,
    depreciationRate: 0,
    location: buildLocation(row.floor, row.room),
    description,
    characteristics: remarks,
    status: 'active'
  };
};

const nextAssetNumber = async () => {
  const assets = await FixedAsset.find({ assetNumber: /^FA-/ }).select('assetNumber').lean();
  let max = 0;
  assets.forEach((asset) => {
    const match = String(asset.assetNumber || '').match(/(\d+)$/);
    if (!match) return;
    const n = Number(match[1]);
    if (!Number.isNaN(n) && n > max) max = n;
  });
  return `FA-${String(max + 1).padStart(5, '0')}`;
};

async function run() {
  const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI
    : (process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI);

  if (!uri) {
    console.error('No MongoDB URI found in environment variables');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const legacySofa = await FixedAsset.findOne({
    name: 'Sofa chair (5)',
    description: { $regex: IMPORT_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
  }).select('_id assetNumber').lean();
  if (legacySofa) {
    await FixedAsset.deleteOne({ _id: legacySofa._id });
    console.log(`Removed legacy combined entry ${legacySofa.assetNumber} — Sofa chair (5)`);
  }

  let created = 0;
  let skipped = 0;

  for (const row of ASSETS) {
    const importKey = `${row.sourceSheet}:${row.sourceSr}`;
    const existing = await FixedAsset.findOne({
      description: { $regex: IMPORT_TAG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') },
      name: clean(row.name),
      location: buildLocation(row.floor, row.room)
    }).select('_id assetNumber name').lean();

    if (existing) {
      skipped += 1;
      console.log(`Skip ${importKey} — already exists as ${existing.assetNumber} (${existing.name})`);
      continue;
    }

    const doc = toAssetDoc(row);
    doc.assetNumber = await nextAssetNumber();
    const asset = await FixedAsset.create(doc);
    created += 1;
    console.log(`Created ${importKey} -> ${asset.assetNumber} — ${asset.name}`);
  }

  console.log(`Done. Created: ${created}, Skipped: ${skipped}, Total in import set: ${ASSETS.length}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
