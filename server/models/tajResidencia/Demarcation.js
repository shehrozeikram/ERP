const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const demarcationSchema = new mongoose.Schema({
  // Demarcation Number
  demarcationNumber: {
    type: String,
    required: [true, 'Demarcation number is required'],
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
  
  // Reference to Khasra Mapping
  khasraMapping: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KhasraMapping'
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'visit_scheduled', 'visit_completed', 'measurement_done', 'pillars_installed', 'encroachment_checked', 'sketch_created', 'alignment_done', 'report_generated', 'completed', 'on_hold', 'rejected'],
    default: 'draft'
  },
  
  // Current Step in Workflow
  currentStep: {
    type: String,
    enum: ['patwari_qanoongo_visit', 'ground_measurement', 'boundary_pillars', 'encroachment_detection', 'ground_sketch', 'society_alignment', 'demarcation_report'],
    default: 'patwari_qanoongo_visit'
  },
  
  // Patwari and Qanoongo Visit
  patwariQanoongoVisit: {
    visitDate: {
      type: Date,
      required: [true, 'Visit date is required']
    },
    visitTime: String,
    visitDuration: Number, // in minutes
    
    // Patwari Details
    patwari: {
      name: {
        type: String,
        required: [true, 'Patwari name is required'],
        trim: true
      },
      designation: String,
      office: String,
      contactNumber: String,
      cnic: String,
      present: {
        type: Boolean,
        default: false
      }
    },
    
    // Qanoongo Details
    qanoongo: {
      name: {
        type: String,
        required: [true, 'Qanoongo name is required'],
        trim: true
      },
      designation: String,
      office: String,
      contactNumber: String,
      cnic: String,
      present: {
        type: Boolean,
        default: false
      }
    },
    
    // Society Representatives
    societyRepresentatives: [{
      name: String,
      designation: String,
      contactNumber: String,
      present: {
        type: Boolean,
        default: false
      }
    }],
    
    // Land Owner/Representative
    landOwnerRepresentative: {
      name: String,
      cnic: String,
      contactNumber: String,
      relationship: String, // owner, representative, attorney, etc.
      present: {
        type: Boolean,
        default: false
      }
    },
    
    // Visit Purpose and Observations
    visitPurpose: {
      type: String,
      trim: true
    },
    observations: {
      type: String,
      trim: true
    },
    weatherConditions: {
      type: String,
      enum: ['clear', 'cloudy', 'rainy', 'foggy', 'other'],
      default: 'clear'
    },
    siteAccessibility: {
      type: String,
      enum: ['accessible', 'partially_accessible', 'difficult_access', 'inaccessible'],
      default: 'accessible'
    },
    visitNotes: {
      type: String,
      trim: true
    },
    visitCompleted: {
      type: Boolean,
      default: false
    },
    visitReportUrl: String,
    photos: [{
      description: String,
      photoUrl: String,
      takenAt: Date
    }]
  },
  
  // Ground Measurement
  groundMeasurement: {
    measurementDate: {
      type: Date
    },
    measurementTime: String,
    measuredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    measurementMethod: {
      type: String,
      enum: ['gps', 'total_station', 'tape_measurement', 'chain_measurement', 'drone_survey', 'satellite', 'other'],
      default: 'total_station'
    },
    equipmentUsed: [{
      equipmentName: String,
      equipmentType: String,
      serialNumber: String,
      calibrationDate: Date,
      calibrationValid: {
        type: Boolean,
        default: true
      }
    }],
    
    // Measurements for each Khasra
    khasraMeasurements: [{
      khasraNumber: {
        type: String,
        required: true,
        trim: true
      },
      recordedArea: {
        value: {
          type: Number,
          required: true,
          min: [0, 'Area cannot be negative']
        },
        unit: {
          type: String,
          enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
          default: 'kanal'
        }
      },
      measuredArea: {
        value: {
          type: Number,
          required: true,
          min: [0, 'Area cannot be negative']
        },
        unit: {
          type: String,
          enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
          default: 'kanal'
        }
      },
      discrepancy: {
        value: Number,
        percentage: Number,
        type: {
          type: String,
          enum: ['excess', 'deficit', 'match'],
          default: 'match'
        },
        explanation: String
      },
      coordinates: [{
        pointNumber: Number,
        latitude: Number,
        longitude: Number,
        elevation: Number,
        description: String
      }],
      boundaryLength: {
        value: Number,
        unit: {
          type: String,
          enum: ['feet', 'meter', 'yard'],
          default: 'feet'
        }
      },
      measurementNotes: {
        type: String,
        trim: true
      }
    }],
    
    // Total Area Summary
    totalRecordedArea: {
      value: Number,
      unit: {
        type: String,
        enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
        default: 'kanal'
      }
    },
    totalMeasuredArea: {
      value: Number,
      unit: {
        type: String,
        enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
        default: 'kanal'
      }
    },
    overallDiscrepancy: {
      value: Number,
      percentage: Number,
      type: {
        type: String,
        enum: ['excess', 'deficit', 'match'],
        default: 'match'
      }
    },
    
    measurementCompleted: {
      type: Boolean,
      default: false
    },
    measurementReportUrl: String,
    measurementNotes: {
      type: String,
      trim: true
    }
  },
  
  // Boundary Pillars
  boundaryPillars: {
    pillarsInstalled: {
      type: Boolean,
      default: false
    },
    installationDate: Date,
    installedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Pillar Details
    pillars: [{
      pillarNumber: {
        type: String,
        required: true,
        trim: true
      },
      location: {
        type: String,
        enum: ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'corner', 'intermediate'],
        required: true
      },
      coordinates: {
        latitude: Number,
        longitude: Number,
        elevation: Number
      },
      pillarType: {
        type: String,
        enum: ['concrete', 'stone', 'iron', 'wooden', 'cement_block', 'other'],
        default: 'concrete'
      },
      pillarSize: {
        height: Number, // in feet or meters
        width: Number,
        depth: Number,
        unit: {
          type: String,
          enum: ['feet', 'meter'],
          default: 'feet'
        }
      },
      pillarMarking: {
        type: String,
        trim: true
      }, // e.g., "TR-001" for Taj Residencia pillar 001
      installationDate: Date,
      installedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      condition: {
        type: String,
        enum: ['good', 'damaged', 'missing', 'needs_repair', 'replaced'],
        default: 'good'
      },
      verificationStatus: {
        type: String,
        enum: ['verified', 'pending', 'rejected'],
        default: 'pending'
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verifiedDate: Date,
      photos: [{
        description: String,
        photoUrl: String,
        takenAt: Date
      }],
      notes: {
        type: String,
        trim: true
      }
    }],
    
    // Pillar Summary
    totalPillars: {
      type: Number,
      default: 0
    },
    verifiedPillars: {
      type: Number,
      default: 0
    },
    damagedPillars: {
      type: Number,
      default: 0
    },
    missingPillars: {
      type: Number,
      default: 0
    },
    
    installationNotes: {
      type: String,
      trim: true
    }
  },
  
  // Encroachment Detection
  encroachmentDetection: {
    checked: {
      type: Boolean,
      default: false
    },
    checkDate: Date,
    checkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Encroachments Found
    encroachments: [{
      encroachmentNumber: {
        type: String,
        required: true,
        trim: true
      },
      location: {
        direction: {
          type: String,
          enum: ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'multiple'],
          required: true
        },
        coordinates: {
          latitude: Number,
          longitude: Number
        },
        description: String
      },
      encroachmentType: {
        type: String,
        enum: ['structure', 'fence', 'wall', 'crop', 'tree', 'path', 'other'],
        required: true
      },
      encroachmentArea: {
        value: Number,
        unit: {
          type: String,
          enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
          default: 'square_feet'
        }
      },
      encroachedBy: {
        name: String,
        cnic: String,
        contactNumber: String,
        address: String
      },
      severity: {
        type: String,
        enum: ['minor', 'moderate', 'major', 'critical'],
        default: 'moderate'
      },
      detectedDate: {
        type: Date,
        default: Date.now
      },
      detectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      resolutionStatus: {
        type: String,
        enum: ['open', 'under_investigation', 'resolved', 'escalated', 'legal_action', 'removed'],
        default: 'open'
      },
      resolutionNotes: {
        type: String,
        trim: true
      },
      resolvedDate: Date,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      photos: [{
        description: String,
        photoUrl: String,
        takenAt: Date
      }],
      notes: {
        type: String,
        trim: true
      }
    }],
    
    // Encroachment Summary
    totalEncroachments: {
      type: Number,
      default: 0
    },
    totalEncroachmentArea: {
      value: Number,
      unit: {
        type: String,
        enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
        default: 'square_feet'
      }
    },
    criticalEncroachments: {
      type: Number,
      default: 0
    },
    
    checkNotes: {
      type: String,
      trim: true
    }
  },
  
  // Ground Sketch
  groundSketch: {
    sketchCreated: {
      type: Boolean,
      default: false
    },
    createdDate: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Sketch Details
    sketchType: {
      type: String,
      enum: ['hand_drawn', 'digital', 'cad', 'gis', 'satellite_overlay', 'other'],
      default: 'hand_drawn'
    },
    sketchScale: String, // e.g., "1:5000"
    sketchDimensions: {
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ['feet', 'meter', 'inch', 'cm'],
        default: 'meter'
      }
    },
    
    // Sketch Elements
    sketchElements: {
      boundaries: {
        type: Boolean,
        default: true
      },
      pillars: {
        type: Boolean,
        default: true
      },
      structures: {
        type: Boolean,
        default: true
      },
      roads: {
        type: Boolean,
        default: true
      },
      waterBodies: {
        type: Boolean,
        default: true
      },
      trees: {
        type: Boolean,
        default: false
      },
      encroachments: {
        type: Boolean,
        default: true
      },
      adjacentProperties: {
        type: Boolean,
        default: true
      },
      coordinates: {
        type: Boolean,
        default: true
      }
    },
    
    // Sketch Files
    sketchFiles: [{
      fileType: {
        type: String,
        enum: ['image', 'pdf', 'cad', 'gis', 'other'],
        default: 'image'
      },
      fileName: String,
      fileUrl: String,
      uploadedDate: Date,
      description: String
    }],
    
    // Sketch Verification
    verified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedDate: Date,
    verificationNotes: {
      type: String,
      trim: true
    },
    
    sketchNotes: {
      type: String,
      trim: true
    }
  },
  
  // Society Alignment
  societyAlignment: {
    alignmentDone: {
      type: Boolean,
      default: false
    },
    alignmentDate: Date,
    alignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Alignment Details
    alignmentType: {
      type: String,
      enum: ['plot_layout', 'road_alignment', 'boundary_alignment', 'infrastructure_alignment', 'master_plan', 'other'],
      default: 'plot_layout'
    },
    masterPlanReference: String,
    alignmentPlanUrl: String,
    
    // Alignment Coordinates
    alignmentCoordinates: [{
      pointNumber: Number,
      latitude: Number,
      longitude: Number,
      elevation: Number,
      description: String,
      alignmentType: String // plot, road, boundary, etc.
    }],
    
    // Alignment Verification
    verified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedDate: Date,
    verificationNotes: {
      type: String,
      trim: true
    },
    
    alignmentNotes: {
      type: String,
      trim: true
    }
  },
  
  // Demarcation Report
  demarcationReport: {
    reportGenerated: {
      type: Boolean,
      default: false
    },
    reportDate: Date,
    reportNumber: String,
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Report Structure
    reportSections: {
      executiveSummary: {
        included: {
          type: Boolean,
          default: true
        },
        content: String
      },
      visitDetails: {
        included: {
          type: Boolean,
          default: true
        },
        content: String
      },
      measurementDetails: {
        included: {
          type: Boolean,
          default: true
        },
        content: String
      },
      boundaryPillars: {
        included: {
          type: Boolean,
          default: true
        },
        content: String
      },
      encroachments: {
        included: {
          type: Boolean,
          default: true
        },
        content: String
      },
      groundSketch: {
        included: {
          type: Boolean,
          default: true
        },
        content: String
      },
      societyAlignment: {
        included: {
          type: Boolean,
          default: true
        },
        content: String
      },
      recommendations: {
        included: {
          type: Boolean,
          default: true
        },
        content: String
      },
      conclusions: {
        included: {
          type: Boolean,
          default: true
        },
        content: String
      }
    },
    
    // Report Files
    reportFiles: [{
      fileType: {
        type: String,
        enum: ['pdf', 'word', 'excel', 'other'],
        default: 'pdf'
      },
      fileName: String,
      fileUrl: String,
      uploadedDate: Date,
      description: String
    }],
    
    // Report Approval
    approved: {
      type: Boolean,
      default: false
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedDate: Date,
    approvalNotes: {
      type: String,
      trim: true
    },
    
    reportNotes: {
      type: String,
      trim: true
    }
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
      enum: ['visit_report', 'measurement_certificate', 'pillar_verification', 'encroachment_report', 'sketch_approval', 'alignment_certificate', 'demarcation_certificate', 'other'],
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
demarcationSchema.index({ demarcationNumber: 1 });
demarcationSchema.index({ landIdentification: 1 });
demarcationSchema.index({ recordVerification: 1 });
demarcationSchema.index({ khasraMapping: 1 });
demarcationSchema.index({ status: 1 });
demarcationSchema.index({ currentStep: 1 });
demarcationSchema.index({ 'patwariQanoongoVisit.visitDate': 1 });
demarcationSchema.index({ createdBy: 1 });
demarcationSchema.index({ assignedTo: 1 });
demarcationSchema.index({ createdAt: -1 });

// Pagination plugin
demarcationSchema.plugin(mongoosePaginate);

const Demarcation = mongoose.model('Demarcation', demarcationSchema);

module.exports = Demarcation;

