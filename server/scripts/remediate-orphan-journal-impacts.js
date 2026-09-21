#!/usr/bin/env node
/**
 * Production remediation: remove stale finance impact from journal entries
 * that were deleted with the old incomplete delete path.
 *
 * Default is DRY-RUN (no writes). Use --apply to persist fixes.
 *
 * Connection (pick one):
 *   --local     use MONGODB_URI_LOCAL from .env  (recommended on your laptop)
 *   --prod      use MONGODB_URI from .env
 *   --mongo=URI override connection string
 *
 * If you pass neither --local/--prod/--mongo:
 *   - uses MONGODB_URI_LOCAL when set (dev machine)
 *   - else MONGODB_URI
 *
 * Do NOT use NODE_ENV=production on your laptop unless MONGODB_URI is set.
 *
 * Examples:
 *   node server/scripts/remediate-orphan-journal-impacts.js --local
 *   node server/scripts/remediate-orphan-journal-impacts.js --local --apply --yes
 *   node server/scripts/remediate-orphan-journal-impacts.js --prod --apply --yes
 *   node server/scripts/remediate-orphan-journal-impacts.js --mongo="mongodb://..." --apply --yes
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');
const { remediateOrphanJournalImpacts } = require('../utils/remediateOrphanJournalImpacts');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const yes = args.includes('--yes');
const wantLocal = args.includes('--local');
const wantProd = args.includes('--prod');
const mongoArg = args.find((a) => a.startsWith('--mongo='));
const mongoOverride = mongoArg ? mongoArg.slice('--mongo='.length) : null;

function redactUri(uri) {
  if (!uri) return '(none)';
  try {
    return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
  } catch {
    return '(unparseable)';
  }
}

function resolveUri() {
  if (mongoOverride) {
    return {
      uri: mongoOverride,
      isLocal: /localhost|127\.0\.0\.1/.test(mongoOverride),
      source: '--mongo'
    };
  }
  if (wantLocal) {
    return {
      uri: process.env.MONGODB_URI_LOCAL || null,
      isLocal: true,
      source: 'MONGODB_URI_LOCAL (--local)'
    };
  }
  if (wantProd) {
    return {
      uri: process.env.MONGODB_URI || null,
      isLocal: false,
      source: 'MONGODB_URI (--prod)'
    };
  }
  // Default: prefer local on a typical laptop .env
  if (process.env.MONGODB_URI_LOCAL) {
    return {
      uri: process.env.MONGODB_URI_LOCAL,
      isLocal: true,
      source: 'MONGODB_URI_LOCAL (default)'
    };
  }
  if (process.env.MONGODB_URI) {
    return {
      uri: process.env.MONGODB_URI,
      isLocal: false,
      source: 'MONGODB_URI (default)'
    };
  }
  return { uri: null, isLocal: false, source: 'none' };
}

async function main() {
  const { uri, isLocal, source } = resolveUri();

  if (!uri) {
    console.error('No MongoDB URI configured.');
    console.error('');
    console.error('Your .env has MONGODB_URI_LOCAL but not MONGODB_URI.');
    console.error('On this machine run:');
    console.error('  node server/scripts/remediate-orphan-journal-impacts.js --local');
    console.error('');
    console.error('For real production DB, either:');
    console.error('  1) Add MONGODB_URI to .env and run with --prod');
    console.error('  2) Or pass: --mongo="mongodb://user:pass@host:27017/dbname"');
    console.error('  3) Or run the script on the production server where MONGODB_URI is set');
    process.exit(1);
  }

  if (apply && !isLocal && !yes) {
    console.error('Refusing to apply on a non-local DB without --yes');
    console.error('Re-run with: ... --apply --yes');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════');
  console.log(' Remediate orphan journal-entry financial impacts');
  console.log('═══════════════════════════════════════════════════');
  console.log(` Mode:     ${apply ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}`);
  console.log(` Source:   ${source}`);
  console.log(` Mongo:    ${redactUri(uri)}${isLocal ? ' [LOCAL]' : ' [REMOTE/PROD]'}`);
  console.log('───────────────────────────────────────────────────');

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));
  const dbName = mongoose.connection.name;
  console.log(` Connected DB: ${dbName}`);
  console.log(' Running…');

  const result = await remediateOrphanJournalImpacts({ apply });
  const { stats } = result;

  console.log('───────────────────────────────────────────────────');
  console.log(` Journal entries in DB:     ${result.journalEntryCount}`);
  console.log(` Posted JEs scanned:        ${stats.postedJournalCount}`);
  console.log(` Account balances to fix:   ${stats.accountsBalanceUpdated}`);
  console.log(` Orphan GL rows:            ${stats.orphanGlDeleted}`);
  console.log(` Posted JEs missing GL:     ${stats.glRepaired}`);
  console.log(` AR invoices touched:       ${stats.arInvoicesTouched}`);
  console.log(` AR orphan payments:        ${stats.arPaymentsRemoved}`);
  console.log(` AP apps to remove:         ${stats.apAppsRemoved}`);
  console.log(` AP bills touched:          ${stats.apBillsTouched}`);
  console.log(` Legacy AP payments:        ${stats.legacyApPaymentsRemoved}`);
  console.log(` Cash approvals cleared:    ${stats.cashApprovalsCleared}`);
  console.log(` Vendor advances cleared:   ${stats.vendorAdvancesCleared}`);
  console.log(` Banking tx removed:        ${stats.bankingTxRemoved}`);
  console.log(` Payroll apps removed:      ${stats.payrollAppsRemoved}`);
  console.log(` Payroll letters removed:   ${stats.payrollLettersRemoved}`);
  console.log(` Land links cleared:        ${stats.landLinksCleared}`);
  console.log(` GRN links cleared:         ${stats.grnLinksCleared}`);
  if (stats.errors.length) {
    console.log(' Errors:');
    stats.errors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log('───────────────────────────────────────────────────');
  if (!apply) {
    console.log(' Dry-run only. Re-run with --apply (and --yes for non-local) to write.');
  } else {
    console.log(' Apply complete. Regenerate Trial Balance in Finance UI to verify.');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Remediation failed:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
