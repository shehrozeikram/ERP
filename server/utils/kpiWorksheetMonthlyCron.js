const cron = require('node-cron');
const { ensureWorksheetsForMonth } = require('./kpiWorksheetService');

let scheduled = false;

/**
 * First day of each month ~ 00:05 server time — create KPI worksheets for all active employees.
 * Disable: KPI_WORKSHEET_MONTHLY_CRON_ENABLED=false
 */
function startKpiWorksheetMonthlyCron() {
  if (scheduled) return;
  if (process.env.KPI_WORKSHEET_MONTHLY_CRON_ENABLED === 'false') {
    console.log('[KPIWorksheet] Monthly cron disabled');
    return;
  }

  const expr = process.env.KPI_WORKSHEET_MONTHLY_CRON || '5 0 1 * *';

  cron.schedule(expr, async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const result = await ensureWorksheetsForMonth(year, month);
      console.log(`[KPIWorksheet] Monthly bootstrap ${year}-${month}:`, result);
    } catch (err) {
      console.error('[KPIWorksheet] Monthly cron failed:', err.message);
    }
  });

  scheduled = true;
  console.log(`[KPIWorksheet] Monthly cron scheduled (${expr})`);
}

module.exports = { startKpiWorksheetMonthlyCron };
