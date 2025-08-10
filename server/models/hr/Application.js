const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const applicationSchema = new mongoose.Schema({
  // Application Details
  applicationId: {
    type: String,
    required: false,
    unique: true,
    trim: true
  },
  
  // References
  jobPosting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: false // Optional for public applications
  },
  
  // Affiliate Code
  affiliateCode: {
    type: String,
    required: true,
    trim: true
  },
  
  // Application Status
  status: {
    type: String,
    enum: ['applied', 'screening', 'shortlisted', 'interview_scheduled', 'interviewed', 'technical_test', 'reference_check', 'offer_sent', 'offer_accepted', 'offer_declined', 'hired', 'rejected', 'withdrawn'],
    default: 'applied'
  },
  
  // Application Type
  applicationType: {
    type: String,
    enum: ['standard', 'easy_apply', 'referral', 'campus_recruitment'],
    default: 'standard'
  },
  
  // Application Details
  coverLetter: {
    type: String,
    trim: true
  },
  expectedSalary: {
    type: Number,
    min: 0
  },
  availability: {
    type: String,
    enum: ['immediate', '2_weeks', '1_month', '2_months', '3_months', 'negotiable'],
    default: 'negotiable'
  },
  
  // Public Application Data
  personalInfo: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    dateOfBirth: Date,
    gender: String,
    address: String,
    city: String,
    country: String
  },
  
  professionalInfo: {
    currentPosition: String,
    currentCompany: String,
    yearsOfExperience: String,
    expectedSalary: String,
    noticePeriod: String,
    availability: String,
    availableFrom: Date
  },
  
  education: {
    highestEducation: String,
    institution: String,
    graduationYear: String,
    gpa: String
  },
  
  skills: {
    technicalSkills: String,
    certifications: String,
    languages: String
  },
  
  socialLinks: {
    linkedin: String,
    github: String,
    portfolio: String
  },
  
  additionalInfo: {
    howDidYouHear: String,
    whyJoinUs: String,
    questions: String
  },
  
  // Evaluation System (Manual Control)
  evaluation: {
    // Manual Status Control (Primary)
    manualStatus: {
      type: String,
      enum: ['pending', 'under_review', 'shortlisted', 'rejected', 'interviewed', 'offered', 'hired'],
      default: 'pending'
    },
    manualStatusReason: String,
    manuallyUpdatedAt: Date,
    manuallyUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Legacy Auto-Evaluation Fields (Kept for backward compatibility)
    requirementsMatch: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    experienceMatch: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    skillsMatch: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    isShortlisted: {
      type: Boolean,
      default: false
    },
    shortlistReason: String,
    evaluationNotes: String,
    evaluatedAt: Date,
    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Documents
  resume: {
    filename: String,
    path: String,
    uploadedAt: Date
  },
  coverLetterFile: {
    filename: String,
    path: String,
    uploadedAt: Date
  },
  portfolio: {
    filename: String,
    path: String,
    uploadedAt: Date
  },
  additionalDocuments: [{
    filename: String,
    path: String,
    description: String,
    uploadedAt: Date
  }],
  
  // Easy Apply Documents
  documents: {
    cv: {
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      mimetype: String
    }
  },
  
  // Interview Information
  interviews: [{
    type: {
      type: String,
      enum: ['phone', 'video', 'in_person', 'technical', 'panel', 'final'],
      required: true
    },
    scheduledDate: {
      type: Date,
      required: true
    },
    duration: {
      type: Number, // in minutes
      default: 60
    },
    interviewers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    location: String,
    meetingLink: String,
    notes: String,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
      default: 'scheduled'
    },
    feedback: {
      technicalSkills: {
        type: Number,
        min: 1,
        max: 5
      },
      communicationSkills: {
        type: Number,
        min: 1,
        max: 5
      },
      culturalFit: {
        type: Number,
        min: 1,
        max: 5
      },
      overallRating: {
        type: Number,
        min: 1,
        max: 5
      },
      strengths: [String],
      weaknesses: [String],
      recommendations: String,
      notes: String
    },
    completedAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  
  // Technical Tests
  technicalTests: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    assignedDate: {
      type: Date,
      required: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['assigned', 'in_progress', 'completed', 'expired'],
      default: 'assigned'
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    feedback: String,
    completedAt: Date,
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  
  // Reference Checks
  referenceChecks: [{
    referenceName: {
      type: String,
      required: true
    },
    referencePosition: String,
    referenceCompany: String,
    referenceEmail: String,
    referencePhone: String,
    status: {
      type: String,
      enum: ['pending', 'contacted', 'completed', 'failed'],
      default: 'pending'
    },
    feedback: {
      reliability: {
        type: Number,
        min: 1,
        max: 5
      },
      workQuality: {
        type: Number,
        min: 1,
        max: 5
      },
      teamwork: {
        type: Number,
        min: 1,
        max: 5
      },
      overallRating: {
        type: Number,
        min: 1,
        max: 5
      },
      comments: String,
      wouldRecommend: {
        type: Boolean
      }
    },
    contactedAt: Date,
    completedAt: Date,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Offer Information
  offer: {
    salary: {
      type: Number,
      min: 0
    },
    benefits: [String],
    startDate: Date,
    offerDate: Date,
    expiryDate: Date,
    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'declined', 'expired'],
      default: 'draft'
    },
    notes: String,
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: Date,
    respondedAt: Date
  },
  
  // Notes and Comments
  notes: [{
    content: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['general', 'interview', 'technical', 'reference', 'offer', 'other'],
      default: 'general'
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
  
  // Timeline
  timeline: [{
    action: {
      type: String,
      required: true
    },
    description: String,
    date: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
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

// Create compound index to prevent duplicate applications from same email for same job
applicationSchema.index({ jobPosting: 1, 'personalInfo.email': 1 }, { unique: true });

// Virtual for status label
applicationSchema.virtual('statusLabel').get(function() {
  const labels = {
    applied: 'Applied',
    screening: 'Screening',
    shortlisted: 'Shortlisted',
    interview_scheduled: 'Interview Scheduled',
    interviewed: 'Interviewed',
    technical_test: 'Technical Test',
    reference_check: 'Reference Check',
    offer_sent: 'Offer Sent',
    offer_accepted: 'Offer Accepted',
    offer_declined: 'Offer Declined',
    hired: 'Hired',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn'
  };
  return labels[this.status] || this.status;
});

// Virtual for availability label
applicationSchema.virtual('availabilityLabel').get(function() {
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

// Virtual for days since application
applicationSchema.virtual('daysSinceApplication').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = now - created;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for next interview
applicationSchema.virtual('nextInterview').get(function() {
  const upcomingInterviews = this.interviews.filter(interview => 
    interview.status === 'scheduled' && new Date(interview.scheduledDate) > new Date()
  );
  
  if (upcomingInterviews.length === 0) return null;
  
  return upcomingInterviews.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))[0];
});

// Virtual for latest interview
applicationSchema.virtual('latestInterview').get(function() {
  const completedInterviews = this.interviews.filter(interview => 
    interview.status === 'completed'
  );
  
  if (completedInterviews.length === 0) return null;
  
  return completedInterviews.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
});

// Pre-save middleware
applicationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-generate application ID if not provided
  if (!this.applicationId) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.applicationId = `APP${year}${random}`;
  }
  
  // Add to timeline when status changes
  if (this.isModified('status')) {
    this.timeline.push({
      action: `Status changed to ${this.status}`,
      description: `Application status updated to ${this.status}`,
      date: new Date(),
      performedBy: this.updatedBy
    });
  }
  
  next();
});

// Add pagination plugin
applicationSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Application', applicationSchema); 