const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const trainingProgramSchema = new mongoose.Schema({
  // Program Details
  programId: {
    type: String,
    required: false,
    unique: true,
    trim: true
  },
  
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  shortDescription: {
    type: String,
    trim: true,
    maxlength: 200
  },
  
  // Program Structure
  type: {
    type: String,
    enum: ['certification', 'skill_path', 'onboarding', 'compliance', 'leadership', 'custom'],
    required: true
  },
  
  category: {
    type: String,
    enum: ['technical', 'soft_skills', 'leadership', 'compliance', 'productivity', 'safety', 'customer_service', 'sales', 'other'],
    required: true
  },
  
  // Program Content
  courses: [{
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    isRequired: {
      type: Boolean,
      default: true
    },
    estimatedDuration: Number, // in minutes
    prerequisites: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    }]
  }],
  
  // Program Requirements
  totalDuration: {
    type: Number, // in minutes
    default: 0
  },
  
  estimatedWeeks: {
    type: Number,
    default: 1
  },
  
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  
  // Completion Requirements
  completionCriteria: {
    allCoursesRequired: {
      type: Boolean,
      default: true
    },
    minimumScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 70
    },
    timeLimit: {
      type: Number, // in days, null means no limit
      default: null
    }
  },
  
  // Program Status
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'archived'],
    default: 'draft'
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Enrollment
  isPublic: {
    type: Boolean,
    default: false
  },
  
  maxEnrollments: {
    type: Number,
    default: null // null means unlimited
  },
  
  currentEnrollments: {
    type: Number,
    default: 0
  },
  
  // Target Audience
  targetRoles: [{
    type: String,
    trim: true
  }],
  
  targetDepartments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],
  
  targetExperienceLevel: {
    type: String,
    enum: ['entry', 'mid', 'senior', 'all'],
    default: 'all'
  },
  
  // Program Metadata
  thumbnail: {
    url: String,
    fileName: String
  },
  
  featured: {
    type: Boolean,
    default: false
  },
  
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  
  // Certification
  providesCertification: {
    type: Boolean,
    default: false
  },
  
  certificationName: {
    type: String,
    trim: true
  },
  
  certificationValidFor: {
    type: Number, // in months
    default: null
  },
  
  // Costs and Budget
  cost: {
    type: Number,
    default: 0,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'PKR'
  },
  
  budgetCode: {
    type: String,
    trim: true
  },
  
  // Schedule
  startDate: Date,
  
  endDate: Date,
  
  enrollmentDeadline: Date,
  
  // Learning Path
  learningPath: [{
    phase: {
      type: String,
      required: true
    },
    description: String,
    courses: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    }],
    estimatedDuration: Number,
    order: Number
  }],
  
  // Prerequisites
  prerequisites: [{
    type: String,
    trim: true
  }],
  
  // Learning Objectives
  learningObjectives: [{
    type: String,
    trim: true
  }],
  
  // Outcomes
  expectedOutcomes: [{
    type: String,
    trim: true
  }],
  
  // Tags
  tags: [{
    type: String,
    trim: true
  }],
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  },
  
  publishedAt: Date,
  archivedAt: Date
}, {
  timestamps: true
});

// Virtual for program duration in hours
trainingProgramSchema.virtual('durationHours').get(function() {
  return Math.round((this.totalDuration / 60) * 10) / 10;
});

// Virtual for enrollment percentage
trainingProgramSchema.virtual('enrollmentPercentage').get(function() {
  if (!this.maxEnrollments) return null;
  return Math.round((this.currentEnrollments / this.maxEnrollments) * 100);
});

// Virtual for status label
trainingProgramSchema.virtual('statusLabel').get(function() {
  const labels = {
    draft: 'Draft',
    active: 'Active',
    inactive: 'Inactive',
    archived: 'Archived'
  };
  return labels[this.status] || this.status;
});

// Virtual for type label
trainingProgramSchema.virtual('typeLabel').get(function() {
  const labels = {
    certification: 'Certification Program',
    skill_path: 'Skill Development Path',
    onboarding: 'Onboarding Program',
    compliance: 'Compliance Training',
    leadership: 'Leadership Development',
    custom: 'Custom Program'
  };
  return labels[this.type] || this.type;
});

// Virtual for difficulty label
trainingProgramSchema.virtual('difficultyLabel').get(function() {
  const labels = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert'
  };
  return labels[this.difficulty] || this.difficulty;
});

// Virtual for category label
trainingProgramSchema.virtual('categoryLabel').get(function() {
  const labels = {
    technical: 'Technical Skills',
    soft_skills: 'Soft Skills',
    leadership: 'Leadership',
    compliance: 'Compliance',
    productivity: 'Productivity',
    safety: 'Safety',
    customer_service: 'Customer Service',
    sales: 'Sales',
    other: 'Other'
  };
  return labels[this.category] || this.category;
});

// Virtual for is enrollment open
trainingProgramSchema.virtual('isEnrollmentOpen').get(function() {
  if (!this.isActive || this.status !== 'active') return false;
  if (this.maxEnrollments && this.currentEnrollments >= this.maxEnrollments) return false;
  if (this.enrollmentDeadline && new Date() > new Date(this.enrollmentDeadline)) return false;
  return true;
});

// Virtual for days until enrollment deadline
trainingProgramSchema.virtual('daysUntilEnrollmentDeadline').get(function() {
  if (!this.enrollmentDeadline) return null;
  
  const now = new Date();
  const deadline = new Date(this.enrollmentDeadline);
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Pre-save middleware
trainingProgramSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-generate program ID if not provided
  if (!this.programId) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.programId = `PRG${year}${random}`;
  }
  
  // Calculate total duration from courses
  if (this.courses && this.courses.length > 0) {
    this.totalDuration = this.courses.reduce((total, courseItem) => {
      return total + (courseItem.estimatedDuration || 0);
    }, 0);
  }
  
  // Set published date when status changes to active
  if (this.isModified('status') && this.status === 'active' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Set archived date when status changes to archived
  if (this.isModified('status') && this.status === 'archived' && !this.archivedAt) {
    this.archivedAt = new Date();
  }
  
  next();
});

// Add pagination plugin
trainingProgramSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('TrainingProgram', trainingProgramSchema); 