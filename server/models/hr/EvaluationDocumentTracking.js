const mongoose = require('mongoose');

const holderSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['system', 'evaluator', 'approver'],
    default: 'system'
  },
  name: String,
  email: String,
  designation: String,
  receivedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const timelineEntrySchema = new mongoose.Schema({
  status: String,
  action: String,
  comments: String,
  holder: holderSchema,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const evaluationDocumentTrackingSchema = new mongoose.Schema({
  evaluationDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EvaluationDocument',
    unique: true,
    required: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  employeeName: String,
  formType: String,
  module: {
    type: String,
    default: 'Evaluation & Appraisal'
  },
  status: {
    type: String,
    default: 'sent'
  },
  currentHolder: holderSchema,
  timeline: [timelineEntrySchema],
  totalDuration: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

evaluationDocumentTrackingSchema.index({ evaluationDocument: 1 });
evaluationDocumentTrackingSchema.index({ employee: 1 });
evaluationDocumentTrackingSchema.index({ status: 1 });
evaluationDocumentTrackingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EvaluationDocumentTracking', evaluationDocumentTrackingSchema);

































































