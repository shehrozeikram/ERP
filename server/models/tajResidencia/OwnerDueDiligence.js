const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const ownerDueDiligenceSchema = new mongoose.Schema({
  // Due Diligence Number
  dueDiligenceNumber: {
    type: String,
    required: [true, 'Due diligence number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  
  // Reference to Land Identification
  landIdentification: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandIdentification',
    required: [true, 'Land identification reference is required']
  },
  
  // Reference to Record Verification
  recordVerification: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecordVerification'
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'cnic_checked', 'nadra_verified', 'heirs_identified', 'poa_verified', 'disputes_checked', 'death_cases_verified', 'interview_completed', 'completed', 'on_hold', 'rejected'],
    default: 'draft'
  },
  
  // Current Step in Workflow
  currentStep: {
    type: String,
    enum: ['cnic_checks', 'nadra_family_tree', 'multiple_heirs', 'power_of_attorney', 'dispute_history', 'death_cases', 'owner_interview', 'completion'],
    default: 'cnic_checks'
  },
  
  // CNIC Checks
  cnicChecks: {
    checked: {
      type: Boolean,
      default: false
    },
    checkDate: Date,
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // CNIC Verifications
    cnicVerifications: [{
      ownerName: {
        type: String,
        required: true,
        trim: true
      },
      cnic: {
        type: String,
        required: true,
        trim: true
      },
      cnicIssueDate: Date,
      cnicExpiryDate: Date,
      cnicType: {
        type: String,
        enum: ['original', 'renewed', 'duplicate', 'smart_card'],
        default: 'original'
      },
      verificationMethod: {
        type: String,
        enum: ['nadra_online', 'nadra_office', 'manual_check', 'third_party', 'other'],
        default: 'nadra_online'
      },
      verificationDate: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verificationStatus: {
        type: String,
        enum: ['valid', 'invalid', 'expired', 'suspicious', 'pending'],
        default: 'pending'
      },
      verificationNotes: {
        type: String,
        trim: true
      },
      redFlags: [{
        flagType: {
          type: String,
          enum: ['expired', 'mismatch', 'duplicate', 'suspicious_activity', 'blacklisted', 'other'],
          default: 'other'
        },
        description: String,
        severity: {
          type: String,
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'medium'
        }
      }],
      documents: [{
        documentType: String,
        documentUrl: String,
        uploadedDate: Date
      }]
    }],
    
    checkNotes: {
      type: String,
      trim: true
    }
  },
  
  // NADRA Family Tree
  nadraFamilyTree: {
    verified: {
      type: Boolean,
      default: false
    },
    verificationDate: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Family Tree Details
    familyTree: {
      primaryOwner: {
        name: String,
        cnic: String,
        relationship: {
          type: String,
          enum: ['self', 'father', 'mother', 'spouse', 'son', 'daughter', 'brother', 'sister', 'other'],
          default: 'self'
        }
      },
      familyMembers: [{
        name: {
          type: String,
          required: true,
          trim: true
        },
        cnic: String,
        relationship: {
          type: String,
          enum: ['father', 'mother', 'spouse', 'son', 'daughter', 'brother', 'sister', 'grandfather', 'grandmother', 'uncle', 'aunt', 'cousin', 'other'],
          required: true
        },
        dateOfBirth: Date,
        dateOfDeath: Date,
        isAlive: {
          type: Boolean,
          default: true
        },
        isLegalHeir: {
          type: Boolean,
          default: false
        },
        nadraVerified: {
          type: Boolean,
          default: false
        },
        verificationDate: Date,
        notes: {
          type: String,
          trim: true
        }
      }],
      treeStructure: {
        type: String,
        trim: true
      }, // JSON or text representation
      nadraReportUrl: String,
      verificationNotes: {
        type: String,
        trim: true
      }
    },
    
    verificationNotes: {
      type: String,
      trim: true
    }
  },
  
  // Multiple Heirs
  multipleHeirs: {
    identified: {
      type: Boolean,
      default: false
    },
    identificationDate: Date,
    identifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Heirs Details
    heirs: [{
      heirNumber: {
        type: String,
        required: true,
        trim: true
      },
      name: {
        type: String,
        required: true,
        trim: true
      },
      cnic: {
        type: String,
        required: true,
        trim: true
      },
      relationship: {
        type: String,
        enum: ['son', 'daughter', 'spouse', 'father', 'mother', 'brother', 'sister', 'grandson', 'granddaughter', 'other'],
        required: true
      },
      share: {
        numerator: {
          type: Number,
          default: 1
        },
        denominator: {
          type: Number,
          default: 1
        },
        percentage: Number
      },
      dateOfBirth: Date,
      dateOfDeath: Date,
      isAlive: {
        type: Boolean,
        default: true
      },
      contactNumber: String,
      address: {
        street: String,
        city: String,
        district: String,
        province: String,
        postalCode: String
      },
      consentStatus: {
        type: String,
        enum: ['consented', 'not_consented', 'pending', 'disputed', 'deceased'],
        default: 'pending'
      },
      consentDate: Date,
      consentDocumentUrl: String,
      verified: {
        type: Boolean,
        default: false
      },
      verifiedDate: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      notes: {
        type: String,
        trim: true
      }
    }],
    
    // Heir Summary
    totalHeirs: {
      type: Number,
      default: 0
    },
    consentedHeirs: {
      type: Number,
      default: 0
    },
    disputedHeirs: {
      type: Number,
      default: 0
    },
    deceasedHeirs: {
      type: Number,
      default: 0
    },
    
    identificationNotes: {
      type: String,
      trim: true
    }
  },
  
  // Power of Attorney Verification
  powerOfAttorney: {
    verified: {
      type: Boolean,
      default: false
    },
    verificationDate: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // POA Details
    poaDocuments: [{
      poaNumber: {
        type: String,
        required: true,
        trim: true
      },
      principalName: {
        type: String,
        required: true,
        trim: true
      },
      principalCNIC: {
        type: String,
        required: true,
        trim: true
      },
      attorneyName: {
        type: String,
        required: true,
        trim: true
      },
      attorneyCNIC: {
        type: String,
        required: true,
        trim: true
      },
      poaType: {
        type: String,
        enum: ['general', 'special', 'irrevocable', 'limited', 'other'],
        default: 'general'
      },
      executionDate: Date,
      expiryDate: Date,
      isExpired: {
        type: Boolean,
        default: false
      },
      notarized: {
        type: Boolean,
        default: false
      },
      notaryName: String,
      notaryLicense: String,
      notarizationDate: Date,
      stampPaperValue: Number,
      stampPaperNumber: String,
      registrationNumber: String,
      registrationOffice: String,
      registrationDate: Date,
      verificationStatus: {
        type: String,
        enum: ['verified', 'pending', 'rejected', 'expired', 'suspicious'],
        default: 'pending'
      },
      verifiedDate: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verificationNotes: {
        type: String,
        trim: true
      },
      redFlags: [{
        flagType: {
          type: String,
          enum: ['expired', 'not_notarized', 'suspicious_signature', 'mismatch', 'duplicate', 'other'],
          default: 'other'
        },
        description: String,
        severity: {
          type: String,
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'medium'
        }
      }],
      documentUrl: String,
      notes: {
        type: String,
        trim: true
      }
    }],
    
    verificationNotes: {
      type: String,
      trim: true
    }
  },
  
  // Dispute History
  disputeHistory: {
    checked: {
      type: Boolean,
      default: false
    },
    checkDate: Date,
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Disputes
    disputes: [{
      disputeNumber: {
        type: String,
        required: true,
        trim: true
      },
      disputeType: {
        type: String,
        enum: ['ownership', 'inheritance', 'partition', 'boundary', 'encumbrance', 'mutation', 'revenue', 'legal', 'other'],
        required: true
      },
      disputeDescription: {
        type: String,
        required: true,
        trim: true
      },
      partiesInvolved: [{
        name: String,
        cnic: String,
        role: {
          type: String,
          enum: ['plaintiff', 'defendant', 'witness', 'other'],
          default: 'other'
        }
      }],
      disputeDate: Date,
      courtName: String,
      caseNumber: String,
      caseStatus: {
        type: String,
        enum: ['pending', 'ongoing', 'resolved', 'dismissed', 'appealed', 'settled'],
        default: 'pending'
      },
      resolutionDate: Date,
      resolutionDetails: {
        type: String,
        trim: true
      },
      impact: {
        type: String,
        enum: ['none', 'low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      documents: [{
        documentType: String,
        documentUrl: String,
        uploadedDate: Date
      }],
      notes: {
        type: String,
        trim: true
      }
    }],
    
    // Dispute Summary
    totalDisputes: {
      type: Number,
      default: 0
    },
    activeDisputes: {
      type: Number,
      default: 0
    },
    resolvedDisputes: {
      type: Number,
      default: 0
    },
    criticalDisputes: {
      type: Number,
      default: 0
    },
    
    checkNotes: {
      type: String,
      trim: true
    }
  },
  
  // Death Cases / Widow Inheritance
  deathCases: {
    verified: {
      type: Boolean,
      default: false
    },
    verificationDate: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Death Cases
    deathCases: [{
      caseNumber: {
        type: String,
        required: true,
        trim: true
      },
      deceasedName: {
        type: String,
        required: true,
        trim: true
      },
      deceasedCNIC: {
        type: String,
        required: true,
        trim: true
      },
      dateOfDeath: {
        type: Date,
        required: true
      },
      placeOfDeath: String,
      deathCertificateNumber: String,
      deathCertificateIssuedBy: String,
      deathCertificateDate: Date,
      deathCertificateUrl: String,
      
      // Widow/Widower Details
      survivingSpouse: {
        name: String,
        cnic: String,
        dateOfBirth: Date,
        contactNumber: String,
        address: String,
        isAlive: {
          type: Boolean,
          default: true
        },
        inheritanceRights: {
          type: String,
          enum: ['full', 'partial', 'none', 'disputed'],
          default: 'partial'
        }
      },
      
      // Legal Heirs
      legalHeirs: [{
        name: String,
        cnic: String,
        relationship: {
          type: String,
          enum: ['spouse', 'son', 'daughter', 'father', 'mother', 'brother', 'sister', 'other'],
          required: true
        },
        share: {
          numerator: Number,
          denominator: Number,
          percentage: Number
        },
        isAlive: {
          type: Boolean,
          default: true
        }
      }],
      
      // Inheritance Documents
      inheritanceDocuments: [{
        documentType: {
          type: String,
          enum: ['succession_certificate', 'probate', 'will', 'inheritance_deed', 'other'],
          default: 'other'
        },
        documentNumber: String,
        issuedBy: String,
        issueDate: Date,
        documentUrl: String
      }],
      
      // Mutation Status
      mutationStatus: {
        type: String,
        enum: ['not_applied', 'applied', 'in_process', 'completed', 'rejected'],
        default: 'not_applied'
      },
      mutationNumber: String,
      mutationDate: Date,
      
      verified: {
        type: Boolean,
        default: false
      },
      verifiedDate: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verificationNotes: {
        type: String,
        trim: true
      },
      notes: {
        type: String,
        trim: true
      }
    }],
    
    // Summary
    totalDeathCases: {
      type: Number,
      default: 0
    },
    verifiedDeathCases: {
      type: Number,
      default: 0
    },
    
    verificationNotes: {
      type: String,
      trim: true
    }
  },
  
  // Owner Interview Checklist
  ownerInterview: {
    conducted: {
      type: Boolean,
      default: false
    },
    interviewDate: Date,
    interviewTime: String,
    interviewLocation: String,
    conductedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Interview Participants
    participants: [{
      name: String,
      cnic: String,
      relationship: {
        type: String,
        enum: ['owner', 'heir', 'attorney', 'witness', 'other'],
        default: 'owner'
      },
      present: {
        type: Boolean,
        default: false
      }
    }],
    
    // Interview Checklist
    checklist: {
      identityVerification: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      ownershipConfirmation: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      cnicVerification: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      familyTreeConfirmation: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      heirsConsent: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      poaVerification: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      disputeDisclosure: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      deathCaseDisclosure: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      landDetailsConfirmation: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      saleIntent: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      priceExpectation: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      encumbrancesDisclosure: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      },
      documentsProvided: {
        checked: {
          type: Boolean,
          default: false
        },
        notes: String
      }
    },
    
    // Interview Questions and Answers
    qa: [{
      question: {
        type: String,
        required: true,
        trim: true
      },
      answer: {
        type: String,
        trim: true
      },
      category: {
        type: String,
        enum: ['identity', 'ownership', 'heirs', 'disputes', 'encumbrances', 'sale', 'other'],
        default: 'other'
      }
    }],
    
    // Interview Observations
    observations: {
      type: String,
      trim: true
    },
    
    // Red Flags
    redFlags: [{
      flagType: {
        type: String,
        enum: ['inconsistent_story', 'reluctance_to_disclose', 'suspicious_behavior', 'document_mismatch', 'other'],
        default: 'other'
      },
      description: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      }
    }],
    
    interviewNotes: {
      type: String,
      trim: true
    },
    interviewRecordingUrl: String,
    interviewTranscriptUrl: String
  },
  
  // Forms and Documents Checklist
  formsChecklist: [{
    formName: {
      type: String,
      required: [true, 'Form name is required'],
      trim: true
    },
    formType: {
      type: String,
      enum: ['cnic_copy', 'nadra_report', 'family_tree', 'poa', 'death_certificate', 'succession_certificate', 'heir_consent', 'interview_report', 'other'],
      default: 'other'
    },
    status: {
      type: String,
      enum: ['required', 'obtained', 'verified', 'rejected', 'pending_verification'],
      default: 'required'
    },
    obtainedDate: Date,
    verifiedDate: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    documentUrl: String,
    notes: {
      type: String,
      trim: true
    }
  }],
  
  // Workflow History
  workflowHistory: [{
    step: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedDate: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      trim: true
    },
    previousStatus: String,
    newStatus: String
  }],
  
  // General Information
  description: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Risk Assessment
  riskAssessment: {
    overallRisk: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    riskFactors: [{
      factor: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      description: String
    }],
    recommendations: {
      type: String,
      trim: true
    }
  },
  
  // Created and Updated Information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
ownerDueDiligenceSchema.index({ dueDiligenceNumber: 1 });
ownerDueDiligenceSchema.index({ landIdentification: 1 });
ownerDueDiligenceSchema.index({ recordVerification: 1 });
ownerDueDiligenceSchema.index({ status: 1 });
ownerDueDiligenceSchema.index({ currentStep: 1 });
ownerDueDiligenceSchema.index({ 'cnicChecks.cnicVerifications.cnic': 1 });
ownerDueDiligenceSchema.index({ 'multipleHeirs.heirs.cnic': 1 });
ownerDueDiligenceSchema.index({ createdBy: 1 });
ownerDueDiligenceSchema.index({ assignedTo: 1 });
ownerDueDiligenceSchema.index({ createdAt: -1 });

// Pagination plugin
ownerDueDiligenceSchema.plugin(mongoosePaginate);

const OwnerDueDiligence = mongoose.model('OwnerDueDiligence', ownerDueDiligenceSchema);

module.exports = OwnerDueDiligence;

