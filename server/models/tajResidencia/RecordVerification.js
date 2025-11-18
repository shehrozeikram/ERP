const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const recordVerificationSchema = new mongoose.Schema({
  // Verification Number
  verificationNumber: {
    type: String,
    required: [true, 'Verification number is required'],
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
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'jamabandi_reviewed', 'fard_obtained', 'khatauni_verified', 'tehsildar_verified', 'arc_checked', 'disputes_identified', 'fraud_checked', 'completed', 'on_hold', 'rejected'],
    default: 'draft'
  },
  
  // Current Step in Workflow
  currentStep: {
    type: String,
    enum: ['jamabandi_review', 'fard_verification', 'khatauni_verification', 'tehsildar_verification', 'arc_check', 'dispute_identification', 'fraud_detection', 'completion'],
    default: 'jamabandi_review'
  },
  
  // Jamabandi (Revenue Record) Details
  jamabandi: {
    jamabandiYear: {
      type: String,
      required: [true, 'Jamabandi year is required'],
      trim: true
    },
    jamabandiNumber: {
      type: String,
      trim: true
    },
    reviewedDate: {
      type: Date
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recordDetails: {
      ownerName: String,
      fatherName: String,
      cnic: String,
      area: {
        value: Number,
        unit: {
          type: String,
          enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
          default: 'kanal'
        }
      },
      landType: String,
      cultivationStatus: String,
      revenueRate: Number,
      totalRevenue: Number
    },
    discrepancies: [{
      field: String,
      description: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      resolution: String,
      resolved: {
        type: Boolean,
        default: false
      }
    }],
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationNotes: {
      type: String,
      trim: true
    },
    documentUrl: String
  },
  
  // Fard (Land Record Extract) Details
  fard: {
    fardNumber: {
      type: String,
      trim: true
    },
    fardDate: {
      type: Date
    },
    obtainedDate: {
      type: Date
    },
    obtainedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    issuedBy: {
      name: String,
      designation: String,
      office: String,
      contactNumber: String
    },
    fardDetails: {
      mauzaName: String,
      mauzaNumber: String,
      khasraNumbers: [String],
      totalArea: {
        value: Number,
        unit: {
          type: String,
          enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
          default: 'kanal'
        }
      },
      ownershipDetails: [{
        ownerName: String,
        fatherName: String,
        cnic: String,
        share: String,
        area: {
          value: Number,
          unit: String
        }
      }],
      encumbrances: [{
        type: String,
        description: String,
        amount: Number,
        date: Date
      }],
      mutations: [{
        mutationNumber: String,
        mutationDate: Date,
        fromOwner: String,
        toOwner: String,
        reason: String
      }]
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationDate: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationNotes: {
      type: String,
      trim: true
    },
    documentUrl: String
  },
  
  // Khatauni (Record of Rights) Details
  khatauni: {
    khatauniNumber: {
      type: String,
      trim: true
    },
    khatauniYear: {
      type: String,
      trim: true
    },
    verifiedDate: {
      type: Date
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    khatauniDetails: {
      khatuniNumber: String,
      ownerName: String,
      fatherName: String,
      cnic: String,
      area: {
        value: Number,
        unit: {
          type: String,
          enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
          default: 'kanal'
        }
      },
      khasraNumbers: [{
        khasraNumber: String,
        area: {
          value: Number,
          unit: String
        },
        landType: String
      }],
      cultivationDetails: {
        cropType: String,
        cultivationStatus: String,
        irrigationType: String
      },
      revenueDetails: {
        revenueRate: Number,
        totalRevenue: Number,
        paymentStatus: String
      }
    },
    discrepancies: [{
      field: String,
      description: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      resolution: String,
      resolved: {
        type: Boolean,
        default: false
      }
    }],
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationNotes: {
      type: String,
      trim: true
    },
    documentUrl: String
  },
  
  // Tehsildar Verification
  tehsildarVerification: {
    tehsildarName: {
      type: String,
      trim: true
    },
    tehsildarOffice: {
      type: String,
      trim: true
    },
    tehsildarContact: {
      type: String,
      trim: true
    },
    verificationDate: {
      type: Date
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationType: {
      type: String,
      enum: ['oral', 'written', 'official_letter', 'stamp_paper', 'affidavit'],
      default: 'written'
    },
    verificationDetails: {
      recordAccuracy: {
        type: String,
        enum: ['accurate', 'minor_discrepancies', 'major_discrepancies', 'inaccurate'],
        default: 'accurate'
      },
      ownershipConfirmed: {
        type: Boolean,
        default: false
      },
      areaConfirmed: {
        type: Boolean,
        default: false
      },
      boundariesConfirmed: {
        type: Boolean,
        default: false
      },
      encumbrancesConfirmed: {
        type: Boolean,
        default: false
      },
      remarks: {
        type: String,
        trim: true
      }
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationNotes: {
      type: String,
      trim: true
    },
    documentUrl: String
  },
  
  // ARC (Automated Record Center) Check - Punjab
  arcCheck: {
    arcNumber: {
      type: String,
      trim: true
    },
    checkedDate: {
      type: Date
    },
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    arcDetails: {
      mauzaCode: String,
      mauzaName: String,
      khasraNumbers: [String],
      ownerName: String,
      cnic: String,
      area: {
        value: Number,
        unit: {
          type: String,
          enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
          default: 'kanal'
        }
      },
      recordStatus: {
        type: String,
        enum: ['active', 'inactive', 'disputed', 'mutated', 'encumbered'],
        default: 'active'
      },
      lastUpdated: Date,
      mutations: [{
        mutationNumber: String,
        mutationDate: Date,
        fromOwner: String,
        toOwner: String
      }]
    },
    discrepancies: [{
      field: String,
      description: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      },
      resolution: String,
      resolved: {
        type: Boolean,
        default: false
      }
    }],
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationNotes: {
      type: String,
      trim: true
    },
    documentUrl: String,
    screenshotUrl: String
  },
  
  // Dispute Identification
  disputes: [{
    disputeType: {
      type: String,
      enum: ['ownership', 'boundary', 'area', 'encumbrance', 'mutation', 'revenue', 'other'],
      required: true
    },
    disputeDescription: {
      type: String,
      required: [true, 'Dispute description is required'],
      trim: true
    },
    partiesInvolved: [{
      name: String,
      cnic: String,
      contactNumber: String,
      role: {
        type: String,
        enum: ['claimant', 'defendant', 'witness', 'other'],
        default: 'claimant'
      }
    }],
    disputeDate: Date,
    identifiedDate: {
      type: Date,
      default: Date.now
    },
    identifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    impact: {
      type: String,
      trim: true
    },
    resolutionStatus: {
      type: String,
      enum: ['open', 'under_investigation', 'resolved', 'escalated', 'legal_action'],
      default: 'open'
    },
    resolutionNotes: {
      type: String,
      trim: true
    },
    documents: [{
      documentType: String,
      documentUrl: String,
      uploadedDate: Date
    }]
  }],
  
  // Fraud Detection
  fraudChecks: [{
    checkType: {
      type: String,
      enum: ['document_authenticity', 'signature_verification', 'stamp_verification', 'record_tampering', 'identity_verification', 'ownership_chain', 'other'],
      required: true
    },
    checkDescription: {
      type: String,
      required: [true, 'Check description is required'],
      trim: true
    },
    checkedDate: {
      type: Date,
      default: Date.now
    },
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    findings: {
      type: String,
      enum: ['clean', 'suspicious', 'fraudulent'],
      default: 'clean'
    },
    findingsDetails: {
      type: String,
      trim: true
    },
    redFlags: [{
      flag: String,
      description: String,
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
      }
    }],
    recommendations: {
      type: String,
      trim: true
    },
    actionTaken: {
      type: String,
      trim: true
    },
    documents: [{
      documentType: String,
      documentUrl: String,
      uploadedDate: Date
    }]
  }],
  
  // Forms and Checklists
  formsChecklist: [{
    formName: {
      type: String,
      required: [true, 'Form name is required'],
      trim: true
    },
    formType: {
      type: String,
      enum: ['jamabandi', 'fard', 'khatauni', 'tehsildar_certificate', 'arc_report', 'noc', 'affidavit', 'other'],
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
  
  // Verification Checklist
  verificationChecklist: {
    jamabandiReviewed: {
      type: Boolean,
      default: false
    },
    fardObtained: {
      type: Boolean,
      default: false
    },
    khatauniVerified: {
      type: Boolean,
      default: false
    },
    tehsildarVerified: {
      type: Boolean,
      default: false
    },
    arcChecked: {
      type: Boolean,
      default: false
    },
    disputesIdentified: {
      type: Boolean,
      default: false
    },
    fraudChecked: {
      type: Boolean,
      default: false
    },
    allDocumentsVerified: {
      type: Boolean,
      default: false
    },
    ownershipConfirmed: {
      type: Boolean,
      default: false
    },
    areaConfirmed: {
      type: Boolean,
      default: false
    },
    boundariesConfirmed: {
      type: Boolean,
      default: false
    }
  },
  
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
recordVerificationSchema.index({ verificationNumber: 1 });
recordVerificationSchema.index({ landIdentification: 1 });
recordVerificationSchema.index({ status: 1 });
recordVerificationSchema.index({ currentStep: 1 });
recordVerificationSchema.index({ createdBy: 1 });
recordVerificationSchema.index({ assignedTo: 1 });
recordVerificationSchema.index({ createdAt: -1 });

// Pagination plugin
recordVerificationSchema.plugin(mongoosePaginate);

const RecordVerification = mongoose.model('RecordVerification', recordVerificationSchema);

module.exports = RecordVerification;

