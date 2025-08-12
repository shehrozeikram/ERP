const mongoose = require('mongoose');

const joiningDocumentSchema = new mongoose.Schema({
  approvalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CandidateApproval',
    required: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  employeeName: { type: String },
  position: { type: String },
  department: { type: String },
  guardianRelation: { type: String },
  guardianName: { type: String },
  cnic: { type: String },
  contactNo: { type: String },
  dutyLocation: { type: String },
  dutyDate: { type: Date },
  dutyTime: { type: String },
  verificationDepartment: { type: String },
  hodName: { type: String },
  joiningRemarks: { type: String },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  hrRemarks: { type: String },
  hrApprovedAt: { type: Date },
  hrApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

joiningDocumentSchema.index({ approvalId: 1 });
joiningDocumentSchema.index({ candidateId: 1 });
joiningDocumentSchema.index({ status: 1 });

module.exports = mongoose.model('JoiningDocument', joiningDocumentSchema);
