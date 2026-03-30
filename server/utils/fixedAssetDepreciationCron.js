const cron = require('node-cron');

async function runFixedAssetDepreciation(targetYear, targetMonth) {
  const FixedAsset    = require('../models/finance/FixedAsset');
  const FinanceHelper = require('./financeHelper');

  const now   = new Date();
  const year  = targetYear  || now.getFullYear();
  const month = targetMonth || now.getMonth() + 1;
  const period = `${year}-${String(month).padStart(2, '0')}`;

  console.log(`[FixedAssetDepr] Running depreciation for period ${period}`);

  const assets = await FixedAsset.find({ status: 'active', depreciationMethod: { $ne: 'none' } });
  const results = { posted: 0, skipped: 0, errors: [] };

  for (const asset of assets) {
    try {
      // Skip if already posted for this period
      const existing = asset.depreciationSchedule.find(d => d.period === period && d.status === 'posted');
      if (existing) { results.skipped++; continue; }

      const monthly = asset.calcMonthlyDepreciation();
      if (monthly <= 0) { results.skipped++; continue; }

      const remainingDepreciable = asset.purchaseCost - asset.residualValue - asset.accumulatedDepreciation;
      const depreciationAmt = Math.min(monthly, Math.max(0, remainingDepreciable));
      if (depreciationAmt <= 0) {
        asset.status = 'fully_depreciated';
        await asset.save();
        results.skipped++;
        continue;
      }

      let journalEntry = null;
      if (asset.depreciationExpenseAccount && asset.accumulatedDeprecAccount) {
        journalEntry = await FinanceHelper.createAndPostJournalEntry({
          date:          new Date(year, month - 1, 28),
          reference:     `DEP-${asset.assetNumber}-${period}`,
          description:   `Auto Depreciation – ${asset.name} (${period})`,
          department:    'finance',
          module:        'finance',
          referenceId:   asset._id,
          referenceType: 'depreciation',
          journalCode:   'DEPR',
          lines: [
            { account: asset.depreciationExpenseAccount, description: `Depreciation expense – ${asset.name}`, debit: depreciationAmt, department: 'finance', costCenter: asset.costCenter },
            { account: asset.accumulatedDeprecAccount,   description: `Accum. depreciation – ${asset.name}`, credit: depreciationAmt, department: 'finance', costCenter: asset.costCenter }
          ]
        });
      }

      asset.accumulatedDepreciation = Math.round((asset.accumulatedDepreciation + depreciationAmt) * 100) / 100;
      asset.currentBookValue        = Math.round((asset.purchaseCost - asset.accumulatedDepreciation) * 100) / 100;
      asset.lastDepreciationDate    = new Date(year, month - 1, 28);
      if (asset.currentBookValue <= asset.residualValue) asset.status = 'fully_depreciated';

      const schedIdx = asset.depreciationSchedule.findIndex(d => d.period === period);
      const line = {
        period, year, month,
        amount: depreciationAmt,
        bookValue: asset.currentBookValue,
        accumulatedDepreciation: asset.accumulatedDepreciation,
        journalEntry: journalEntry?._id,
        postedAt: journalEntry ? new Date() : undefined,
        status: journalEntry ? 'posted' : 'pending'
      };
      if (schedIdx >= 0) asset.depreciationSchedule[schedIdx] = line;
      else asset.depreciationSchedule.push(line);

      await asset.save();
      results.posted++;
    } catch (err) {
      results.errors.push({ asset: asset.assetNumber, error: err.message });
    }
  }

  console.log(`[FixedAssetDepr] Done – posted: ${results.posted}, skipped: ${results.skipped}, errors: ${results.errors.length}`);
  return results;
}

function startFixedAssetDepreciationCron() {
  // Run on the 1st of every month at 07:00 AM PKT
  cron.schedule('0 7 1 * *', () => runFixedAssetDepreciation(), { timezone: 'Asia/Karachi' });
  console.log('[FixedAssetDepr] Cron scheduled: 1st of month at 07:00 AM PKT');
}

module.exports = { startFixedAssetDepreciationCron, runFixedAssetDepreciation };
