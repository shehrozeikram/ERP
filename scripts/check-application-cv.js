#!/usr/bin/env node
/**
 * Inspect stored CV metadata for an application (by human applicationId, e.g. APP20261429)
 * and report whether resolveApplicationDocumentPath finds a file on this machine.
 *
 * Usage (repo root):
 *   node scripts/check-application-cv.js APP20261429
 *   NODE_ENV=production node scripts/check-application-cv.js APP20261429
 *
 * Uses the same Mongo URI rules as the API (see server/config/database.js).
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const repoRoot = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(repoRoot, '.env') });
const localPath = path.join(repoRoot, '.env.local');
if (process.env.NODE_ENV !== 'production' && fs.existsSync(localPath)) {
  require('dotenv').config({ path: localPath, override: true });
}

const { getMongoUri, getMongooseClientOptions } = require('../server/config/database');
const Application = require('../server/models/hr/Application');
const {
  resolveApplicationDocumentPath,
  documentHasRegisteredFile
} = require('../server/utils/applicationDocumentPath');

async function main() {
  const applicationId = process.argv[2];
  if (!applicationId) {
    console.error('Usage: node scripts/check-application-cv.js <applicationId>');
    process.exit(1);
  }

  const { uri, isLocal } = getMongoUri();
  if (!uri) {
    console.error('MongoDB URI is not configured.');
    process.exit(1);
  }

  await mongoose.connect(uri, getMongooseClientOptions(uri, isLocal));

  const app = await Application.findOne({ applicationId })
    .select('applicationId _id documents applicationType personalInfo.email')
    .lean();

  if (!app) {
    console.log('No application found with applicationId:', applicationId);
    await mongoose.disconnect();
    process.exit(2);
  }

  const doc = app.documents?.cv;
  const resolved =
    documentHasRegisteredFile(doc) ? resolveApplicationDocumentPath(doc) : null;

  const out = {
    _id: String(app._id),
    applicationId: app.applicationId,
    applicationType: app.applicationType,
    email: app.personalInfo?.email,
    cv: doc || null,
    hasRegisteredFile: documentHasRegisteredFile(doc),
    resolvedPath: resolved
  };

  console.log(JSON.stringify(out, null, 2));

  if (resolved) {
    const st = fs.statSync(resolved);
    console.log('\nOK: file on disk', resolved, `(${st.size} bytes)`);
  } else if (documentHasRegisteredFile(doc)) {
    const raw = doc.filename
      ? String(doc.filename).trim()
      : String(doc.path || '').trim();
    const base = raw
      ? path.posix.basename(raw.replace(/\\/g, '/'))
      : '(no basename)';
    console.log('\nFILE_NOT_ON_DISK for basename:', base);
    const scanDirs = [
      path.join(repoRoot, 'server', 'uploads', 'cvs'),
      path.join(repoRoot, 'uploads', 'cvs'),
      path.resolve(process.cwd(), 'server', 'uploads', 'cvs')
    ];
    for (const d of [...new Set(scanDirs)]) {
      if (!fs.existsSync(d)) {
        console.log('  (dir missing)', d);
        continue;
      }
      const names = fs.readdirSync(d);
      const exact = names.filter((n) => n === base);
      const ci = names.filter((n) => n.toLowerCase() === String(base).toLowerCase());
      console.log('  dir', d, 'exactMatch:', exact.length, 'caseInsensitive:', ci.length);
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
