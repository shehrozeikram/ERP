/**
 * Cron job: auto-post recurring journal entries when nextRunDate <= today.
 * Runs daily at 06:00 AM.
 */
const cron = require('node-cron');

async function runDueRecurringJournals() {
  try {
    const RecurringJournal = require('../models/finance/RecurringJournal');
    const FinanceHelper    = require('./financeHelper');

    const now = new Date();
    const due = await RecurringJournal.find({
      isActive:    true,
      nextRunDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }]
    }).populate('lines.account', 'accountNumber name type');

    if (due.length === 0) return;

    console.log(`[RecurringJournal] ${due.length} journal(s) due for posting`);

    for (const rj of due) {
      try {
        const entry = await FinanceHelper.createAndPostJournalEntry({
          date:          now,
          reference:     `REC-${rj.name.substring(0, 16).replace(/\s/g, '-')}-${now.toISOString().split('T')[0]}`,
          description:   `[Recurring] ${rj.name}`,
          department:    rj.department || 'finance',
          module:        'manual',
          referenceType: 'manual',
          journalCode:   rj.journalCode || 'GEN',
          createdBy:     rj.createdBy,
          lines:         rj.lines.map(l => ({
            account:     l.account._id || l.account,
            description: l.description || rj.name,
            debit:       l.debit  || 0,
            credit:      l.credit || 0,
            department:  l.department || rj.department
          }))
        });

        rj.lastRunDate = now;
        rj.runCount   += 1;
        rj.nextRunDate = rj.computeNextRunDate(now);
        rj.postedEntries.push(entry._id);
        await rj.save();

        console.log(`[RecurringJournal] Posted: ${rj.name} → ${entry.entryNumber}`);
      } catch (err) {
        console.error(`[RecurringJournal] Failed to post "${rj.name}":`, err.message);
      }
    }
  } catch (err) {
    console.error('[RecurringJournal] Cron error:', err.message);
  }
}

function startRecurringJournalCron() {
  // Run daily at 06:00 AM
  cron.schedule('0 6 * * *', runDueRecurringJournals, { timezone: 'Asia/Karachi' });
  console.log('[RecurringJournal] Cron scheduled: daily at 06:00 AM PKT');
}

module.exports = { startRecurringJournalCron, runDueRecurringJournals };
