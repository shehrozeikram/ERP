#!/usr/bin/env node
/**
 * Lists applications whose documents.cv metadata exists but the file is not on disk
 * (same resolution as the download API). Run on the server with production env.
 *
 *   cd /var/www/sgc-erp && NODE_ENV=production node scripts/list-missing-application-cvs.js
 *
 * Options:
 *   --json   one JSON array to stdout
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const repoRoot = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(repoRoot, '.env') });

const { getMongoUri, getMongooseClientOptions } = require('../server/config/database');
const Application = require('../server/models/hr/Application');
const {
  resolveApplicationDocumentPath,
  documentHasRegisteredFile
} = require('../server/utils/applicationDocumentPath');

const asJson = process.argv.includes('--json');

async function main() {
  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('MongoDB URI is not configured.');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));

  const apps = await Application.find({
    'documents.cv': { $exists: true, $ne: null }
  })
    .select('applicationId documents.cv')
    .lean();

  const missing = [];
  const ok = [];
  let skippedEmptyMeta = 0;

  for (const app of apps) {
    const doc = app.documents?.cv;
    if (!documentHasRegisteredFile(doc)) {
      skippedEmptyMeta += 1;
      continue;
    }
    const resolved = resolveApplicationDocumentPath(doc);
    const row = {
      applicationId: app.applicationId,
      filename: doc.filename,
      path: doc.path
    };
    if (resolved) ok.push(row);
    else missing.push(row);
  }

  await mongoose.disconnect();

  const withRealMeta = ok.length + missing.length;

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          totalCvDocumentsInDb: apps.length,
          withFilenameOrPath: withRealMeta,
          skippedEmptyMeta,
          onDisk: ok.length,
          missingOnDisk: missing.length,
          missingRows: missing
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Applications with documents.cv in DB: ${apps.length}`);
  if (skippedEmptyMeta) console.log(`Skipped (no filename/path): ${skippedEmptyMeta}`);
  console.log(`With file metadata: ${withRealMeta}`);
  console.log(`Resolved on disk: ${ok.length}`);
  console.log(`Missing on disk: ${missing.length}`);
  if (missing.length) {
    console.log('\nMissing (restore file or ask candidate to re-apply):');
    missing.slice(0, 200).forEach((r) => {
      console.log(`  ${r.applicationId || '(no id)'}  ${r.filename || r.path || ''}`);
    });
    if (missing.length > 200) console.log(`  ... and ${missing.length - 200} more`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
