const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const landIdentificationSchema = new mongoose.Schema({
  // Identification Number
  identificationNumber: {
    type: String,
    required: [true, 'Identification number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'patwari_contacted', 'mauza_identified', 'khasra_extracted', 'survey_completed', 'owner_details_collected', 'risk_assessed', 'completed', 'on_hold', 'rejected'],
    default: 'draft'
  },
  
  // Current Step in Workflow
  currentStep: {
    type: String,
    enum: ['patwari_contact', 'mauza_identification', 'khasra_extraction', 'land_type_classification', 'initial_survey', 'owner_preliminary_details', 'risk_identification', 'completion'],
    default: 'patwari_contact'
  },
  
  // Patwari Contact Information
  patwariContact: {
    patwariName: {
      type: String,
      required: [true, 'Patwari name is required'],
      trim: true
    },
    patwariContactNumber: {
      type: String,
      required: [true, 'Patwari contact number is required'],
      trim: true
    },
    patwariCNIC: {
      type: String,
      trim: true
    },
    patwariDesignation: {
      type: String,
      trim: true
    },
    tehsil: {
      type: String,
      required: [true, 'Tehsil is required'],
      trim: true
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true
    },
    province: {
      type: String,
      required: [true, 'Province is required'],
      enum: ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Jammu and Kashmir'],
      default: 'Punjab'
    },
    contactDate: {
      type: Date,
      required: [true, 'Contact date is required']
    },
    contactMethod: {
      type: String,
      enum: ['phone', 'in_person', 'official_letter', 'email'],
      default: 'phone'
    },
    contactNotes: {
      type: String,
      trim: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedDate: Date
  },
  
  // Mauza Identification
  mauzaIdentification: {
    mauzaName: {
      type: String,
      required: [true, 'Mauza name is required'],
      trim: true
    },
    mauzaNumber: {
      type: String,
      trim: true
    },
    mauzaCode: {
      type: String,
      trim: true
    },
    unionCouncil: {
      type: String,
      trim: true
    },
    tehsil: {
      type: String,
      required: [true, 'Tehsil is required'],
      trim: true
    },
    district: {
      type: String,
      required: [true, 'District is required'],
      trim: true
    },
    province: {
      type: String,
      required: [true, 'Province is required'],
      enum: ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Jammu and Kashmir'],
      default: 'Punjab'
    },
    identifiedDate: {
      type: Date
    },
    identifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    verificationNotes: {
      type: String,
      trim: true
    }
  },
  
  // Khasra Details
  khasraDetails: [{
    khasraNumber: {
      type: String,
      required: [true, 'Khasra number is required'],
      trim: true
    },
    khatuniNumber: {
      type: String,
      trim: true
    },
    area: {
      value: {
        type: Number,
        required: [true, 'Area value is required'],
        min: [0, 'Area cannot be negative']
      },
      unit: {
        type: String,
        enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
        default: 'kanal'
      }
    },
    location: {
      type: String,
      trim: true
    },
    boundaries: {
      north: String,
      south: String,
      east: String,
      west: String
    },
    extractedDate: {
      type: Date
    },
    extractedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationNotes: {
      type: String,
      trim: true
    }
  }],
  
  // Land Type Classification
  landType: {
    primaryType: {
      type: String,
      enum: ['agricultural', 'residential', 'commercial', 'industrial', 'mixed_use', 'vacant', 'barren', 'forest', 'water_body', 'other'],
      required: [true, 'Primary land type is required']
    },
    secondaryType: {
      type: String,
      trim: true
    },
    currentUse: {
      type: String,
      trim: true
    },
    zoningStatus: {
      type: String,
      enum: ['approved', 'pending', 'not_zoned', 'under_review'],
      default: 'pending'
    },
    classificationDate: {
      type: Date
    },
    classifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    classificationNotes: {
      type: String,
      trim: true
    }
  },
  
  // Initial Survey
  initialSurvey: {
    surveyDate: {
      type: Date
    },
    surveyedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    surveyTeam: [{
      name: String,
      designation: String,
      role: String
    }],
    physicalInspection: {
      conducted: {
        type: Boolean,
        default: false
      },
      inspectionDate: Date,
      accessRoad: {
        type: String,
        enum: ['yes', 'no', 'partial', 'under_construction'],
        default: 'no'
      },
      accessRoadDetails: String,
      topography: {
        type: String,
        enum: ['flat', 'sloping', 'hilly', 'mixed'],
        default: 'flat'
      },
      soilCondition: {
        type: String,
        enum: ['fertile', 'barren', 'rocky', 'sandy', 'clay', 'mixed'],
        default: 'fertile'
      },
      waterAvailability: {
        type: String,
        enum: ['available', 'not_available', 'partial', 'under_construction'],
        default: 'not_available'
      },
      electricityAvailability: {
        type: String,
        enum: ['available', 'not_available', 'partial', 'under_construction'],
        default: 'not_available'
      },
      gasAvailability: {
        type: String,
        enum: ['available', 'not_available', 'partial', 'under_construction'],
        default: 'not_available'
      },
      nearbyFacilities: [{
        facility: String,
        distance: String,
        notes: String
      }],
      environmentalFactors: [{
        factor: String,
        impact: String,
        notes: String
      }],
      photographs: [{
        url: String,
        description: String,
        takenDate: Date
      }],
      surveyReport: {
        type: String,
        trim: true
      }
    }
  },
  
  // Owner Preliminary Details
  ownerDetails: [{
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true
    },
    ownerCNIC: {
      type: String,
      required: [true, 'Owner CNIC is required'],
      trim: true
    },
    ownerContactNumber: {
      type: String,
      trim: true
    },
    ownerAddress: {
      street: String,
      city: String,
      district: String,
      province: String,
      postalCode: String
    },
    ownershipType: {
      type: String,
      enum: ['sole_owner', 'joint_owner', 'heirs', 'power_of_attorney', 'trust', 'company', 'government'],
      default: 'sole_owner'
    },
    ownershipPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    relationship: {
      type: String,
      trim: true
    },
    isPrimaryOwner: {
      type: Boolean,
      default: false
    },
    collectedDate: {
      type: Date
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    verificationNotes: {
      type: String,
      trim: true
    }
  }],
  
  // Risk Identification
  risks: [{
    riskType: {
      type: String,
      enum: ['legal', 'title', 'encroachment', 'dispute', 'environmental', 'access', 'utility', 'zoning', 'financial', 'other'],
      required: [true, 'Risk type is required']
    },
    riskDescription: {
      type: String,
      required: [true, 'Risk description is required'],
      trim: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    probability: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    impact: {
      type: String,
      trim: true
    },
    mitigationStrategy: {
      type: String,
      trim: true
    },
    identifiedDate: {
      type: Date,
      default: Date.now
    },
    identifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['open', 'mitigated', 'closed', 'monitoring'],
      default: 'open'
    },
    resolutionNotes: {
      type: String,
      trim: true
    }
  }],
  
  // Forms Required
  formsRequired: [{
    formName: {
      type: String,
      required: [true, 'Form name is required'],
      trim: true
    },
    formType: {
      type: String,
      enum: ['fard', 'mutation', 'registry', 'noc', 'survey_report', 'ownership_certificate', 'tax_clearance', 'other'],
      default: 'other'
    },
    status: {
      type: String,
      enum: ['required', 'submitted', 'verified', 'rejected', 'pending_verification'],
      default: 'required'
    },
    submittedDate: Date,
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
  
  // Roles Involved
  rolesInvolved: [{
    role: {
      type: String,
      enum: ['land_acquisition_manager', 'patwari', 'surveyor', 'legal_officer', 'finance_officer', 'field_officer', 'verification_officer', 'senior_manager', 'other'],
      required: [true, 'Role is required']
    },
    personName: {
      type: String,
      required: [true, 'Person name is required'],
      trim: true
    },
    personId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    contactNumber: String,
    involvementDate: Date,
    responsibilities: [String],
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
landIdentificationSchema.index({ identificationNumber: 1 });
landIdentificationSchema.index({ status: 1 });
landIdentificationSchema.index({ currentStep: 1 });
landIdentificationSchema.index({ 'mauzaIdentification.mauzaName': 1 });
landIdentificationSchema.index({ 'mauzaIdentification.district': 1 });
landIdentificationSchema.index({ 'mauzaIdentification.tehsil': 1 });
landIdentificationSchema.index({ 'patwariContact.patwariName': 1 });
landIdentificationSchema.index({ createdBy: 1 });
landIdentificationSchema.index({ assignedTo: 1 });
landIdentificationSchema.index({ createdAt: -1 });

// Pagination plugin
landIdentificationSchema.plugin(mongoosePaginate);

const LandIdentification = mongoose.model('LandIdentification', landIdentificationSchema);

module.exports = LandIdentification;

