const XLSX = require('xlsx');
const path = require('path');

const parseArea = (str) => {
  if (!str) return { kanal: 0, marla: 0, sarsai: 0 };
  const s = String(str).toLowerCase().trim();
  let kanal = 0, marla = 0, sarsai = 0;
  const kMatch = s.match(/([\d.]+)\s*kanal/);
  if (kMatch) kanal = parseFloat(kMatch[1]);
  const mMatch = s.match(/([\d.]+)\s*marla/);
  if (mMatch) marla = parseFloat(mMatch[1]);
  const sMatch = s.match(/([\d.]+)\s*sarsai/);
  if (sMatch) sarsai = parseFloat(sMatch[1]);
  if (!kMatch && !mMatch && !sMatch && !isNaN(parseFloat(s))) {
    kanal = parseFloat(s);
  }
  return { kanal, marla, sarsai };
};

const run = () => {
  const file = path.join(__dirname, '../../docs/Land Transfer detail.xlsx');
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
  
  const blankRows = data.filter(row => !row['Purchaser Name']);
  console.log(`Found ${blankRows.length} blank purchaser rows.`);

  const dealSummary = {};
  const sellerSummary = {};
  const mozaSummary = {};

  for (const row of blankRows) {
    const deal = row['Deal No.'];
    const seller = row['Seller Name'];
    const moza = row['Moza'];
    const area = parseArea(row['Land']);
    const size = area.kanal + area.marla/20 + area.sarsai/180;

    dealSummary[deal] = (dealSummary[deal] || 0) + size;
    sellerSummary[seller] = (sellerSummary[seller] || 0) + size;
    mozaSummary[moza] = (mozaSummary[moza] || 0) + size;
  }

  console.log('\n--- BLANK BY DEAL ---');
  for (const [deal, size] of Object.entries(dealSummary)) {
    console.log(`Deal ${deal}: ${size.toFixed(2)} Kanals`);
  }

  console.log('\n--- BLANK BY SELLER ---');
  for (const [seller, size] of Object.entries(sellerSummary)) {
    console.log(`Seller ${seller}: ${size.toFixed(2)} Kanals`);
  }

  console.log('\n--- BLANK BY MOZA ---');
  for (const [moza, size] of Object.entries(mozaSummary)) {
    console.log(`Moza ${moza}: ${size.toFixed(2)} Kanals`);
  }
};

run();
