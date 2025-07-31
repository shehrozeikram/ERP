const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const enrollmentSchema = new mongoose.Schema({
  // Enrollment Details
  enrollmentId: {
    type: String,
    required: false,
    unique: true,
    trim: true
  },
  
  // References
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  
  // Enrollment Status
  status: {
    type: String,
    enum: ['enrolled', 'in_progress', 'completed', 'dropped', 'expired'],
    default: 'enrolled'
  },
  
  // Progress Tracking
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  completedMaterials: [{
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    timeSpent: Number, // in minutes
    score: Number // for assessments
  }],
  
  // Time Tracking
  totalTimeSpent: {
    type: Number,
    default: 0 // in minutes
  },
  
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  
  // Assessment Results
  assessmentAttempts: [{
    attemptNumber: {
      type: Number,
      required: true
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    passed: {
      type: Boolean,
      required: true
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    answers: [{
      questionId: String,
      selectedAnswer: String,
      isCorrect: Boolean,
      timeSpent: Number
    }]
  }],
  
  // Completion Details
  startedAt: {
    type: Date,
    default: Date.now
  },
  
  completedAt: Date,
  
  certificateIssuedAt: Date,
  
  certificateUrl: String,
  
  // Enrollment Type
  enrollmentType: {
    type: String,
    enum: ['self_enrolled', 'assigned', 'required', 'recommended'],
    default: 'self_enrolled'
  },
  
  // Assignment Details
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  assignedAt: Date,
  
  dueDate: Date,
  
  // Notes and Feedback
  notes: [{
    content: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['general', 'feedback', 'reminder', 'achievement'],
      default: 'general'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Ratings and Reviews
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  review: {
    type: String,
    trim: true
  },
  
  reviewSubmittedAt: Date,
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for status label
enrollmentSchema.virtual('statusLabel').get(function() {
  const labels = {
    enrolled: 'Enrolled',
    in_progress: 'In Progress',
    completed: 'Completed',
    dropped: 'Dropped',
    expired: 'Expired'
  };
  return labels[this.status] || this.status;
});

// Virtual for enrollment type label
enrollmentSchema.virtual('enrollmentTypeLabel').get(function() {
  const labels = {
    self_enrolled: 'Self Enrolled',
    assigned: 'Assigned',
    required: 'Required',
    recommended: 'Recommended'
  };
  return labels[this.enrollmentType] || this.enrollmentType;
});

// Virtual for days since enrollment
enrollmentSchema.virtual('daysSinceEnrollment').get(function() {
  const now = new Date();
  const enrolled = new Date(this.createdAt);
  const diffTime = now - enrolled;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for days since last access
enrollmentSchema.virtual('daysSinceLastAccess').get(function() {
  const now = new Date();
  const lastAccess = new Date(this.lastAccessedAt);
  const diffTime = now - lastAccess;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for time spent in hours
enrollmentSchema.virtual('timeSpentHours').get(function() {
  return Math.round((this.totalTimeSpent / 60) * 10) / 10;
});

// Virtual for best assessment score
enrollmentSchema.virtual('bestAssessmentScore').get(function() {
  if (!this.assessmentAttempts || this.assessmentAttempts.length === 0) {
    return null;
  }
  
  const scores = this.assessmentAttempts.map(attempt => attempt.score);
  return Math.max(...scores);
});

// Virtual for is overdue
enrollmentSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return new Date() > new Date(this.dueDate) && this.status !== 'completed';
});

// Virtual for days until due
enrollmentSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null;
  
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Pre-save middleware
enrollmentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-generate enrollment ID if not provided
  if (!this.enrollmentId) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.enrollmentId = `ENR${year}${random}`;
  }
  
  // Set completion date when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Calculate progress based on completed materials
  if (this.isModified('completedMaterials')) {
    // This would need to be calculated based on the course's total materials
    // For now, we'll keep the progress field as is
  }
  
  next();
});

// Add pagination plugin
enrollmentSchema.plugin(mongoosePaginate);

// Compound index to prevent duplicate enrollments
enrollmentSchema.index({ employee: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema); 