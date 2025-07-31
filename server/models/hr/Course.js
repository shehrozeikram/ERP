const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const courseSchema = new mongoose.Schema({
  // Course Details
  courseId: {
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
  
  // Course Categories
  category: {
    type: String,
    enum: ['technical', 'soft_skills', 'leadership', 'compliance', 'productivity', 'safety', 'customer_service', 'sales', 'other'],
    required: true
  },
  
  subcategory: {
    type: String,
    trim: true
  },
  
  tags: [{
    type: String,
    trim: true
  }],
  
  // Course Content
  duration: {
    type: Number, // in minutes
    required: true,
    min: 1
  },
  
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner'
  },
  
  learningObjectives: [{
    type: String,
    trim: true
  }],
  
  prerequisites: [{
    type: String,
    trim: true
  }],
  
  // Course Materials
  materials: [{
    title: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['video', 'document', 'presentation', 'quiz', 'assignment', 'link'],
      required: true
    },
    url: String,
    filePath: String,
    fileName: String,
    fileSize: Number,
    duration: Number, // for videos
    order: {
      type: Number,
      default: 0
    },
    isRequired: {
      type: Boolean,
      default: true
    },
    description: String
  }],
  
  // Assessment
  hasAssessment: {
    type: Boolean,
    default: false
  },
  
  passingScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 70
  },
  
  maxAttempts: {
    type: Number,
    default: 3,
    min: 1
  },
  
  // Course Status
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'maintenance'],
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
  
  // Course Metadata
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
  
  // Completion Certificate
  providesCertificate: {
    type: Boolean,
    default: false
  },
  
  certificateTemplate: {
    type: String,
    trim: true
  },
  
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

// Virtual for course duration in hours
courseSchema.virtual('durationHours').get(function() {
  return Math.round((this.duration / 60) * 10) / 10;
});

// Virtual for enrollment percentage
courseSchema.virtual('enrollmentPercentage').get(function() {
  if (!this.maxEnrollments) return null;
  return Math.round((this.currentEnrollments / this.maxEnrollments) * 100);
});

// Virtual for course status label
courseSchema.virtual('statusLabel').get(function() {
  const labels = {
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    maintenance: 'Under Maintenance'
  };
  return labels[this.status] || this.status;
});

// Virtual for difficulty label
courseSchema.virtual('difficultyLabel').get(function() {
  const labels = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert'
  };
  return labels[this.difficulty] || this.difficulty;
});

// Virtual for category label
courseSchema.virtual('categoryLabel').get(function() {
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

// Pre-save middleware
courseSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-generate course ID if not provided
  if (!this.courseId) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.courseId = `CRS${year}${random}`;
  }
  
  // Set published date when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Set archived date when status changes to archived
  if (this.isModified('status') && this.status === 'archived' && !this.archivedAt) {
    this.archivedAt = new Date();
  }
  
  next();
});

// Add pagination plugin
courseSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Course', courseSchema); 