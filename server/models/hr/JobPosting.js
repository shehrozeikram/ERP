const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const jobPostingSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: true,
    trim: true
  },
  jobCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  position: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Position',
    required: true
  },
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  },
  
  // Job Details
  description: {
    type: String,
    required: true
  },
  requirements: {
    type: String,
    required: true
  },
  responsibilities: {
    type: String,
    required: true
  },
  qualifications: {
    type: String,
    required: true
  },
  
  // Employment Details
  employmentType: {
    type: String,
    enum: ['full_time', 'part_time', 'contract', 'internship', 'temporary'],
    default: 'full_time'
  },
  experienceLevel: {
    type: String,
    enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'executive'],
    required: true
  },
  educationLevel: {
    type: String,
    enum: ['high_school', 'diploma', 'bachelors', 'masters', 'phd', 'other'],
    required: true
  },
  
  // Compensation
  salaryRange: {
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'PKR'
    }
  },
  benefits: [{
    type: String
  }],
  
  // Application Details
  applicationDeadline: {
    type: Date,
    required: true
  },
  positionsAvailable: {
    type: Number,
    default: 1,
    min: 1
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'published', 'closed', 'cancelled'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Metadata
  tags: [{
    type: String,
    trim: true
  }],
  keywords: [{
    type: String,
    trim: true
  }],
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  publishedAt: Date,
  closedAt: Date,
  
  // Statistics
  views: {
    type: Number,
    default: 0
  },
  applications: {
    type: Number,
    default: 0
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

// Virtual for formatted salary range
jobPostingSchema.virtual('formattedSalaryRange').get(function() {
  const formatter = new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: this.salaryRange.currency || 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return `${formatter.format(this.salaryRange.min)} - ${formatter.format(this.salaryRange.max)}`;
});

// Virtual for employment type label
jobPostingSchema.virtual('employmentTypeLabel').get(function() {
  const labels = {
    full_time: 'Full Time',
    part_time: 'Part Time',
    contract: 'Contract',
    internship: 'Internship',
    temporary: 'Temporary'
  };
  return labels[this.employmentType] || this.employmentType;
});

// Virtual for experience level label
jobPostingSchema.virtual('experienceLevelLabel').get(function() {
  const labels = {
    entry: 'Entry Level',
    junior: 'Junior',
    mid: 'Mid Level',
    senior: 'Senior',
    lead: 'Lead',
    manager: 'Manager',
    director: 'Director',
    executive: 'Executive'
  };
  return labels[this.experienceLevel] || this.experienceLevel;
});

// Virtual for education level label
jobPostingSchema.virtual('educationLevelLabel').get(function() {
  const labels = {
    high_school: 'High School',
    diploma: 'Diploma',
    bachelors: 'Bachelor\'s Degree',
    masters: 'Master\'s Degree',
    phd: 'PhD',
    other: 'Other'
  };
  return labels[this.educationLevel] || this.educationLevel;
});

// Virtual for status label
jobPostingSchema.virtual('statusLabel').get(function() {
  const labels = {
    draft: 'Draft',
    published: 'Published',
    closed: 'Closed',
    cancelled: 'Cancelled'
  };
  return labels[this.status] || this.status;
});

// Virtual for days until deadline
jobPostingSchema.virtual('daysUntilDeadline').get(function() {
  const now = new Date();
  const deadline = new Date(this.applicationDeadline);
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for deadline status
jobPostingSchema.virtual('deadlineStatus').get(function() {
  const days = this.daysUntilDeadline;
  if (days < 0) return 'expired';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'normal';
});

// Pre-save middleware to update timestamps
jobPostingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-generate job code if not provided
  if (!this.jobCode) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.jobCode = `JOB${year}${random}`;
  }
  
  next();
});

// Add pagination plugin
jobPostingSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('JobPosting', jobPostingSchema); 