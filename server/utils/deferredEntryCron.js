const cron = require('node-cron');

async function runDeferredEntryRecognition() {
  const DeferredEntry = require('../models/finance/DeferredEntry');
  const FinanceHelper = require('./financeHelper');

  const now    = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  console.log(`[DeferredEntry] Running recognition for period ${period}`);

  const entries = await DeferredEntry.find({ status: 'active' });
  const results = { posted: 0, skipped: 0, errors: [] };

  for (const entry of entries) {
    const line = entry.schedule.find(s => s.period === period && s.status === 'pending');
    if (!line) { results.skipped++; continue; }

    if (line.scheduledDate > now) { results.skipped++; continue; }

    try {
      let journalEntry = null;
      const isRevenue = entry.type === 'deferred_revenue';

      journalEntry = await FinanceHelper.createAndPostJournalEntry({
        date:          new Date(),
        reference:     `DEFERRED-${entry._id}-${period}`,
        description:   `${isRevenue ? 'Revenue' : 'Expense'} Recognition – ${entry.name} (${period})`,
        department:    entry.department || 'finance',
        module:        'finance',
        referenceId:   entry._id,
        referenceType: 'deferred',
        journalCode:   isRevenue ? 'REV' : 'GEN',
        lines: isRevenue
          ? [
              { account: entry.deferredAccount,    description: `Deferred revenue recognition – ${entry.name}`, debit:  line.amount, department: entry.department },
              { account: entry.recognitionAccount, description: `Revenue recognized – ${entry.name}`,            credit: line.amount, department: entry.department }
            ]
          : [
              { account: entry.recognitionAccount, description: `Expense recognized – ${entry.name}`,            debit:  line.amount, department: entry.department },
              { account: entry.deferredAccount,    description: `Deferred expense recognition – ${entry.name}`, credit: line.amount, department: entry.department }
            ]
      });

      line.journalEntry = journalEntry._id;
      line.postedAt     = new Date();
      line.status       = 'posted';
      entry.markModified('schedule');
      await entry.save();
      results.posted++;
    } catch (err) {
      results.errors.push({ entry: entry.name, error: err.message });
    }
  }

  console.log(`[DeferredEntry] Done – posted: ${results.posted}, skipped: ${results.skipped}, errors: ${results.errors.length}`);
  return results;
}

function startDeferredEntryCron() {
  // Run on the 1st of every month at 07:30 AM PKT
  cron.schedule('30 7 1 * *', runDeferredEntryRecognition, { timezone: 'Asia/Karachi' });
  console.log('[DeferredEntry] Cron scheduled: 1st of month at 07:30 AM PKT');
}

module.exports = { startDeferredEntryCron, runDeferredEntryRecognition };
