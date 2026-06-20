/** Next number for one voucher series per company (BPV-SGC-000002 does not affect BPV-HPB-000001). */
async function getNextJournalEntryNumber(seriesCode, companyCode = '') {
  const JournalEntry = require('../models/finance/JournalEntry');
  const raw = String(seriesCode || 'JV').trim().toUpperCase().replace(/[^A-Z]/g, '');
  const code = raw.length >= 2 && raw.length <= 12 ? raw : 'JV';
  const cc = String(companyCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = cc.length >= 2 ? `${code}-${cc}-` : `${code}-`;
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${esc}(\\d+)$`, 'i');

  const docs = await JournalEntry.find({
    entryNumber: new RegExp(`^${esc}\\d+$`, 'i')
  })
    .select('entryNumber')
    .lean();

  let max = 0;
  for (const d of docs) {
    const m = String(d.entryNumber || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }

  return `${prefix}${String(max + 1).padStart(6, '0')}`;
}

module.exports = { getNextJournalEntryNumber };
