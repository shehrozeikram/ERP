const cron = require('node-cron');
const { runRecoveryWhatsAppFollowUp } = require('./recoveryWhatsAppFollowUp');

let scheduled = false;

function startRecoveryWhatsAppFollowUpCron() {
  if (scheduled) return;
  if (process.env.RECOVERY_WHATSAPP_FOLLOW_UP_CRON_ENABLED === 'false') {
    console.log('[RecoveryWhatsAppFollowUp] Cron disabled (RECOVERY_WHATSAPP_FOLLOW_UP_CRON_ENABLED=false)');
    return;
  }

  const expr = process.env.RECOVERY_WHATSAPP_FOLLOW_UP_CRON || '0 * * * *';

  cron.schedule(expr, async () => {
    try {
      await runRecoveryWhatsAppFollowUp();
    } catch (err) {
      console.error('[RecoveryWhatsAppFollowUp] Cron run failed:', err.message);
    }
  });

  scheduled = true;
  console.log(`[RecoveryWhatsAppFollowUp] Cron scheduled (${expr})`);
}

module.exports = { startRecoveryWhatsAppFollowUpCron };
