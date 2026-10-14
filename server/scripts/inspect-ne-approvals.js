require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.db.collection('nonemployeerecords');
  const docs = await col.find({ recordNumber: { $in: ['NE-0001', 'NE-0002'] } }).toArray();
  for (const d of docs) {
    console.log(JSON.stringify({
      recordNumber: d.recordNumber,
      status: d.workflowStatus,
      employeesLen: (d.employees || []).length,
      employeeName: d.employees?.[0]?.name || null,
      ceoApprovedAt: d.ceoApprovedAt,
      approvals: {
        hod: { by: !!d.hodApprovedBy, at: d.hodApprovedAt },
        avp: { by: !!d.avpApprovedBy, at: d.avpApprovedAt },
        chairman: { by: !!d.chairmanApprovedBy, at: d.chairmanApprovedAt, assigned: !!d.assignedChairman },
        srDirector: { by: !!d.srDirectorApprovedBy, at: d.srDirectorApprovedAt, assigned: !!d.assignedSrDirector },
        ceo: { by: !!d.ceoApprovedBy, at: d.ceoApprovedAt }
      }
    }, null, 2));
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
