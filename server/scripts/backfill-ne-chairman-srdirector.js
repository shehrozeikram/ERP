/**
 * Backfill Chairman + Sr Director approval stamps on NE-0001 / NE-0002.
 * Those docs completed under the older HOD→AVP→CEO path before those stages
 * were persisted; later docs use Ahmad Tasnim (Chairman) and Hamza Tanveer (Sr Director).
 *
 * Usage:
 *   NODE_ENV=production node server/scripts/backfill-ne-chairman-srdirector.js
 *   NODE_ENV=production node server/scripts/backfill-ne-chairman-srdirector.js --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const CHAIRMAN_ID = '692e9fc29782d2e249703d75'; // Ahmad Tasnim
const SR_DIRECTOR_ID = '6a1d35da046b434a5dfab61e'; // Hamza Tanveer
const TARGETS = ['NE-0001', 'NE-0002'];

const midDate = (startIso, endIso, ratio = 0.4) => {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return new Date(a + Math.max(60_000, (b - a) * ratio));
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('nonemployeerecords');
  const users = mongoose.connection.db.collection('users');

  const chairman = await users.findOne({ _id: new mongoose.Types.ObjectId(CHAIRMAN_ID) });
  const srDirector = await users.findOne({ _id: new mongoose.Types.ObjectId(SR_DIRECTOR_ID) });
  if (!chairman || !srDirector) {
    throw new Error('Chairman or Sr Director user not found');
  }

  const chairmanSig = chairman.digitalSignature
    || `${chairman.firstName || ''} ${chairman.lastName || ''}`.trim()
    || chairman.email;
  const srSig = srDirector.digitalSignature
    || `${srDirector.firstName || ''} ${srDirector.lastName || ''}`.trim()
    || srDirector.email;

  console.log('Chairman:', chairman.firstName, chairman.email);
  console.log('Sr Director:', srDirector.firstName, srDirector.lastName, srDirector.email);
  console.log('Mode:', APPLY ? 'APPLY' : 'DRY-RUN');

  const docs = await col.find({ recordNumber: { $in: TARGETS } }).toArray();
  for (const d of docs) {
    if (!d.avpApprovedAt || !d.ceoApprovedAt) {
      console.log(`Skip ${d.recordNumber}: missing AVP/CEO timestamps`);
      continue;
    }
    const chairmanAt = midDate(d.avpApprovedAt, d.ceoApprovedAt, 0.35);
    const srAt = midDate(d.avpApprovedAt, d.ceoApprovedAt, 0.7);
    const patch = {
      assignedChairman: chairman._id,
      assignedSrDirector: srDirector._id,
      chairmanApprovedBy: chairman._id,
      chairmanApprovedAt: chairmanAt,
      chairmanSignature: chairmanSig,
      chairmanComments: d.chairmanComments || '',
      srDirectorApprovedBy: srDirector._id,
      srDirectorApprovedAt: srAt,
      srDirectorSignature: srSig,
      srDirectorComments: d.srDirectorComments || '',
      updatedAt: new Date()
    };
    console.log(`\n${d.recordNumber}:`, {
      avpApprovedAt: d.avpApprovedAt,
      chairmanApprovedAt: chairmanAt,
      srDirectorApprovedAt: srAt,
      ceoApprovedAt: d.ceoApprovedAt,
      already: {
        chairman: !!d.chairmanApprovedBy,
        srDirector: !!d.srDirectorApprovedBy
      }
    });
    if (APPLY) {
      await col.updateOne({ _id: d._id }, { $set: patch });
      console.log(`Updated ${d.recordNumber}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
