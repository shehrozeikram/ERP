const mongoose = require('mongoose');

const kpiEvaluationSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  cycle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KPICycle',
    required: true
  },
  kpiItems: [{
    templateItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    title: String,
    description: String,
    weight: Number,
    measurementType: String,
    selfScore: {
      type: Number,
      min: 0,
      max: 100 // Scale will depend on measurementType, usually 0-5 or 0-100
    },
    selfComment: String,
    evaluatorScore: {
      type: Number,
      min: 0,
      max: 100
    },
    evaluatorComment: String,
    finalItemScore: Number
  }],
  totalSelfScore: {
    type: Number,
    default: 0
  },
  totalEvaluatorScore: {
    type: Number,
    default: 0
  },
  finalWeightedScore: {
    type: Number,
    default: 0
  },
  ratingLabel: {
    type: String,
    enum: ['Exceptional', 'Exceeds Expectations', 'Meets Expectations', 'Needs Improvement', 'Unsatisfactory', 'Not Rated'],
    default: 'Not Rated'
  },
  status: {
    type: String,
    enum: ['draft', 'self_submitted', 'under_review', 'completed'],
    default: 'draft'
  },
  evaluator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  evaluationDate: Date,
  hrRemarks: String
}, {
  timestamps: true
});

// Calculate scores before saving
kpiEvaluationSchema.pre('save', function(next) {
  if (this.kpiItems && this.kpiItems.length > 0) {
    let totalWeight = 0;
    let weightedSelfScore = 0;
    let weightedEvaluatorScore = 0;

    this.kpiItems.forEach(item => {
      totalWeight += item.weight;
      
      // Assume scores are entered 1-5 for rating_1_to_5
      if (item.selfScore !== undefined && item.selfScore !== null) {
        weightedSelfScore += (item.selfScore * item.weight);
      }
      
      if (item.evaluatorScore !== undefined && item.evaluatorScore !== null) {
        item.finalItemScore = item.evaluatorScore;
        weightedEvaluatorScore += (item.evaluatorScore * item.weight);
      } else if (item.selfScore !== undefined && item.selfScore !== null) {
        item.finalItemScore = item.selfScore;
      }
    });

    if (totalWeight > 0) {
      this.totalSelfScore = parseFloat((weightedSelfScore / totalWeight).toFixed(2));
      this.totalEvaluatorScore = parseFloat((weightedEvaluatorScore / totalWeight).toFixed(2));
      
      // Final score is evaluator score if present, else self score
      this.finalWeightedScore = this.totalEvaluatorScore > 0 ? this.totalEvaluatorScore : this.totalSelfScore;
      
      // Set Rating Label based on 1-5 scale (adjust if using percentage)
      // Assuming 1-5 scale for now based on standard practices
      const score = this.finalWeightedScore;
      if (score === 0) {
        this.ratingLabel = 'Not Rated';
      } else if (score >= 4.5) {
        this.ratingLabel = 'Exceptional';
      } else if (score >= 3.5) {
        this.ratingLabel = 'Exceeds Expectations';
      } else if (score >= 2.5) {
        this.ratingLabel = 'Meets Expectations';
      } else if (score >= 1.5) {
        this.ratingLabel = 'Needs Improvement';
      } else {
        this.ratingLabel = 'Unsatisfactory';
      }
    }
  }
  next();
});

module.exports = mongoose.model('KPIEvaluation', kpiEvaluationSchema);
