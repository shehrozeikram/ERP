const mongoose = require('mongoose');
const crypto = require('crypto');

const QUESTION_TYPES = [
  'text',
  'textarea',
  'number',
  'single_choice',
  'multiple_choice',
  'rating',
  'yes_no',
  'date'
];

const questionOptionSchema = new mongoose.Schema({
  label: { type: String, trim: true, required: true },
  value: { type: String, trim: true, required: true }
}, { _id: false });

const questionSchema = new mongoose.Schema({
  key: {
    type: String,
    trim: true,
    required: true
  },
  type: {
    type: String,
    enum: QUESTION_TYPES,
    required: true
  },
  label: {
    type: String,
    trim: true,
    required: true,
    maxlength: 500
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  required: {
    type: Boolean,
    default: false
  },
  options: {
    type: [questionOptionSchema],
    default: []
  },
  min: { type: Number, default: 1 },
  max: { type: Number, default: 5 },
  order: { type: Number, default: 0 }
}, { _id: false });

const surveySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Survey title is required'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ''
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'closed'],
    default: 'draft'
  },
  kind: {
    type: String,
    enum: ['survey', 'poll'],
    default: 'survey'
  },
  showResultsToVoters: {
    type: Boolean,
    default: true
  },
  questions: {
    type: [questionSchema],
    default: []
  },
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  publishedAt: Date,
  closesAt: Date,
  allowMultipleResponses: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

surveySchema.index({ status: 1, createdAt: -1 });
surveySchema.index({ targetUsers: 1, status: 1 });
surveySchema.index({ createdBy: 1 });
surveySchema.index({ kind: 1, status: 1 });

surveySchema.statics.generateQuestionKey = () => `q_${crypto.randomBytes(6).toString('hex')}`;

module.exports = mongoose.model('Survey', surveySchema);
module.exports.QUESTION_TYPES = QUESTION_TYPES;
