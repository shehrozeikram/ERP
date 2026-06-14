const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionKey: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { _id: false });

const surveyResponseSchema = new mongoose.Schema({
  survey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    required: true
  },
  respondent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: {
    type: [answerSchema],
    default: []
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

surveyResponseSchema.index({ survey: 1, respondent: 1 });
surveyResponseSchema.index({ survey: 1, submittedAt: -1 });

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);
