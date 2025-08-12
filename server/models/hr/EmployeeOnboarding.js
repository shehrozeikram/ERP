const mongoose = require('mongoose');

const employeeOnboardingSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  approvalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CandidateApproval',
    required: true
  },
  joiningDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JoiningDocument',
    required: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'approved'],
    default: 'pending'
  },
  onboardingData: {
    // Personal Information
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    dateOfBirth: Date,
    gender: String,
    idCard: String,
    nationality: String,
    religion: String,
    maritalStatus: String,
    
    // Address Information
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    
    // Emergency Contact
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
      address: String
    },
    
    // Employment Details
    position: String,
    department: String,
    startDate: Date,
    employmentType: String,
    salary: {
      gross: Number,
      basic: Number
    },
    
    // Bank Information
    bankDetails: {
      bankName: String,
      accountNumber: String,
      accountTitle: String,
      branchCode: String
    },
    
    // Documents
    documents: {
      cnic: String,
      passport: String,
      drivingLicense: String,
      educationalCertificates: [String],
      experienceCertificates: [String]
    },
    
    // Additional Information
    skills: [String],
    languages: [String],
    certifications: [String],
    notes: String
  },
  
  // Tracking
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hrRemarks: String,
  
  // Email tracking
  onboardingEmailSent: { type: Boolean, default: false },
  onboardingEmailSentAt: Date,
  reminderEmailsSent: { type: Number, default: 0 },
  lastReminderSentAt: Date
}, { timestamps: true });

// Indexes for better performance
employeeOnboardingSchema.index({ candidateId: 1 });
employeeOnboardingSchema.index({ approvalId: 1 });
employeeOnboardingSchema.index({ status: 1 });
employeeOnboardingSchema.index({ employeeId: 1 });

module.exports = mongoose.model('EmployeeOnboarding', employeeOnboardingSchema);
