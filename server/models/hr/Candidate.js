const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const candidateSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  nationality: {
    type: String,
    required: true
  },
  
  // Address Information
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  
  // Professional Information
  currentPosition: {
    type: String,
    trim: true
  },
  currentCompany: {
    type: String,
    trim: true
  },
  yearsOfExperience: {
    type: Number,
    min: 0,
    default: 0
  },
  expectedSalary: {
    type: Number,
    min: 0
  },
  noticePeriod: {
    type: Number,
    min: 0,
    default: 30
  },
  
  // Education
  education: [{
    degree: {
      type: String,
      required: true
    },
    institution: {
      type: String,
      required: true
    },
    field: {
      type: String,
      required: true
    },
    graduationYear: {
      type: Number,
      required: true
    },
    gpa: {
      type: Number,
      min: 0,
      max: 4
    }
  }],
  
  // Work Experience
  workExperience: [{
    company: {
      type: String,
      required: true
    },
    position: {
      type: String,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: Date,
    isCurrent: {
      type: Boolean,
      default: false
    },
    description: String,
    achievements: [String]
  }],
  
  // Skills
  skills: [{
    name: {
      type: String,
      required: true
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate'
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      default: 0
    }
  }],
  
  // Certifications
  certifications: [{
    name: {
      type: String,
      required: true
    },
    issuingOrganization: {
      type: String,
      required: true
    },
    issueDate: {
      type: Date,
      required: true
    },
    expiryDate: Date,
    credentialId: String
  }],
  
  // Languages
  languages: [{
    language: {
      type: String,
      required: true
    },
    proficiency: {
      type: String,
      enum: ['basic', 'conversational', 'fluent', 'native'],
      required: true
    }
  }],
  
  // Documents
  resume: {
    filename: String,
    path: String,
    uploadedAt: Date
  },
  coverLetter: {
    filename: String,
    path: String,
    uploadedAt: Date
  },
  portfolio: {
    filename: String,
    path: String,
    uploadedAt: Date
  },
  
  // References
  references: [{
    name: {
      type: String,
      required: true
    },
    position: {
      type: String,
      required: true
    },
    company: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    relationship: {
      type: String,
      required: true
    }
  }],
  
  // Application Status
  status: {
    type: String,
    enum: ['active', 'shortlisted', 'interviewed', 'passed', 'approval_pending', 'approval_in_progress', 'approved', 'offered', 'hired', 'rejected', 'withdrawn'],
    default: 'active'
  },
  
  // Email Delivery Tracking
  emailNotifications: [{
    type: {
      type: String,
      enum: ['shortlist', 'interview', 'offer', 'rejection', 'other'],
      required: true
    },
    jobPosting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobPosting',
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    deliveredAt: Date,
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'bounced'],
      default: 'pending'
    },
    messageId: String,
    errorMessage: String,
    emailContent: {
      subject: String,
      htmlContent: String,
      textContent: String
    }
  }],
  
  // Source Information
  source: {
    type: String,
    enum: ['website', 'job_board', 'referral', 'social_media', 'recruitment_agency', 'direct_application', 'other', 'application_shortlisted'],
    required: true
  },
  sourceDetails: String,
  
  // Job and Application References
  jobPosting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting'
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  },
  
  // Notes and Comments
  notes: [{
    content: {
      type: String,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Availability
  availability: {
    type: String,
    enum: ['immediate', '2_weeks', '1_month', '2_months', '3_months', 'negotiable'],
    default: 'negotiable'
  },
  
  // Preferences
  preferredWorkType: {
    type: String,
    enum: ['on_site', 'remote', 'hybrid'],
    default: 'on_site'
  },
  preferredLocations: [String],
  
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

// Virtual for full name
candidateSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
candidateSchema.virtual('age').get(function() {
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Virtual for status label
candidateSchema.virtual('statusLabel').get(function() {
  const labels = {
    active: 'Active',
    shortlisted: 'Shortlisted',
    interviewed: 'Interviewed',
    passed: 'Passed Interview',
    approval_pending: 'Approval Pending',
    approval_in_progress: 'Approval In Progress',
    approved: 'Approved',
    offered: 'Offered',
    hired: 'Hired',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn'
  };
  return labels[this.status] || this.status;
});

// Virtual for source label
candidateSchema.virtual('sourceLabel').get(function() {
  const labels = {
    website: 'Company Website',
    job_board: 'Job Board',
    referral: 'Employee Referral',
    social_media: 'Social Media',
    recruitment_agency: 'Recruitment Agency',
    direct_application: 'Direct Application',
    application_shortlisted: 'Application Shortlisted',
    other: 'Other'
  };
  return labels[this.source] || this.source;
});

// Virtual for availability label
candidateSchema.virtual('availabilityLabel').get(function() {
  const labels = {
    immediate: 'Immediate',
    '2_weeks': '2 Weeks',
    '1_month': '1 Month',
    '2_months': '2 Months',
    '3_months': '3 Months',
    negotiable: 'Negotiable'
  };
  return labels[this.availability] || this.availability;
});

// Virtual for preferred work type label
candidateSchema.virtual('preferredWorkTypeLabel').get(function() {
  const labels = {
    on_site: 'On-Site',
    remote: 'Remote',
    hybrid: 'Hybrid'
  };
  return labels[this.preferredWorkType] || this.preferredWorkType;
});

// Pre-save middleware
candidateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Add pagination plugin
candidateSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Candidate', candidateSchema); 