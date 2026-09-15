const mongoose = require('mongoose');

const nonEmployeeRecordSchema = new mongoose.Schema({
  recordNumber: { type: String, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String },
  cnic: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  role: { type: String, required: true, default: 'Housemaid' }, // e.g. Housemaid, Security Guard
  expectedWages: { type: Number, default: 0 },
  justification: { type: String },
  
  // Workflow tracking
  workflowStatus: { 
    type: String, 
    enum: ['Draft', 'Pending HOD HR', 'Pending AVP', 'Forwarded to CEO', 'Approved by CEO', 'Rejected by CEO', 'Returned'],
    default: 'Pending HOD HR'
  },
  
  initiator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  initiatedAt: { type: Date, default: Date.now },
  requesterSignature: { type: String },
  assignedHod: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  hodApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hodApprovedAt: { type: Date },
  hodComments: { type: String },
  hodSignature: { type: String },

  assignedAvp: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  avpApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  avpApprovedAt: { type: Date },
  avpComments: { type: String },
  avpSignature: { type: String },

  ceoApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ceoApprovedAt: { type: Date },
  ceoComments: { type: String },
  ceoSignature: { type: String },
  
  rejectionComments: { type: String },
  returnComments: { type: String },
  
  // Attachments (e.g. CNIC copy, photo)
  attachments: [{
    filename: String,
    originalName: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

// Auto-generate recordNumber before saving
nonEmployeeRecordSchema.pre('save', async function (next) {
  if (this.isNew && !this.recordNumber) {
    try {
      const lastRecord = await this.constructor.findOne({}, 'recordNumber').sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastRecord && lastRecord.recordNumber) {
        const parts = lastRecord.recordNumber.split('-');
        if (parts.length > 1) {
          nextNum = parseInt(parts[1], 10) + 1;
        }
      }
      this.recordNumber = `NE-${nextNum.toString().padStart(4, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('NonEmployeeRecord', nonEmployeeRecordSchema);
