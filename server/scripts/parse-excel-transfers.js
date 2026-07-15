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

const SARSAIS_PER_MARLA = 9;
const MARLA_PER_KANAL = 20;
const SARSAIS_PER_KANAL = MARLA_PER_KANAL * SARSAIS_PER_MARLA;

const toSarsais = (a) => {
  return a.kanal * SARSAIS_PER_KANAL + a.marla * SARSAIS_PER_MARLA + a.sarsai;
};

const fromSarsais = (total) => {
  let remaining = Math.max(0, Math.round(Number(total) || 0));
  const kanal = Math.floor(remaining / SARSAIS_PER_KANAL);
  remaining %= SARSAIS_PER_KANAL;
  const marla = Math.floor(remaining / SARSAIS_PER_MARLA);
  const sarsai = remaining % SARSAIS_PER_MARLA;
  return { kanal, marla, sarsai };
};

async function run() {
  const file = path.join(__dirname, '../../docs/Land Transfer detail.xlsx');
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
  
  console.log(`Read ${data.length} rows.`);

  const summary = {};

  for (const row of data) {
    const rawName = row['Purchaser Name'];
    const name = rawName ? String(rawName).trim() : 'Blank';
    const area = parseArea(row['Land']);
    const sarsais = toSarsais(area);

    if (!summary[name]) {
      summary[name] = 0;
    }
    summary[name] += sarsais;
  }

  console.log('--- EXCEL PURCHASER SUMMARY ---');
  let grandTotalSarsais = 0;
  for (const [name, sarsais] of Object.entries(summary)) {
    const area = fromSarsais(sarsais);
    const decimal = area.kanal + area.marla / 20 + area.sarsai / 180;
    grandTotalSarsais += sarsais;
    console.log(`${name}: ${area.kanal}K ${area.marla}M ${area.sarsai}S (Decimal: ${decimal.toFixed(1)})`);
  }

  const grandArea = fromSarsais(grandTotalSarsais);
  const grandDecimal = grandArea.kanal + grandArea.marla / 20 + grandArea.sarsai / 180;
  console.log(`GRAND TOTAL: ${grandArea.kanal}K ${grandArea.marla}M ${grandArea.sarsai}S (Decimal: ${grandDecimal.toFixed(1)})`);
}

run();
