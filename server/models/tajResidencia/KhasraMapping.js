const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const khasraMappingSchema = new mongoose.Schema({
  // Mapping Number
  mappingNumber: {
    type: String,
    required: [true, 'Mapping number is required'],
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
    enum: ['draft', 'shajra_obtained', 'boundaries_understood', 'area_verified', 'adjacent_mapped', 'overlap_checked', 'completed', 'on_hold', 'rejected'],
    default: 'draft'
  },
  
  // Current Step in Workflow
  currentStep: {
    type: String,
    enum: ['shajra_obtaining', 'boundary_understanding', 'area_verification', 'adjacent_khasras', 'overlap_detection', 'completion'],
    default: 'shajra_obtaining'
  },
  
  // Shajra (Map) Details
  shajra: {
    shajraNumber: {
      type: String,
      trim: true
    },
    shajraYear: {
      type: String,
      trim: true
    },
    obtainedDate: {
      type: Date
    },
    obtainedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    obtainedFrom: {
      name: String,
      designation: String,
      office: String,
      contactNumber: String
    },
    shajraType: {
      type: String,
      enum: ['revenue_map', 'survey_map', 'satellite_map', 'cadastral_map', 'other'],
      default: 'revenue_map'
    },
    mapScale: {
      type: String,
      trim: true
    },
    mapDate: Date,
    isOriginal: {
      type: Boolean,
      default: false
    },
    isCertified: {
      type: Boolean,
      default: false
    },
    certifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    certificationDate: Date,
    documentUrl: String,
    notes: {
      type: String,
      trim: true
    }
  },
  
  // Khasra Details
  khasras: [{
    khasraNumber: {
      type: String,
      required: [true, 'Khasra number is required'],
      trim: true
    },
    khatuniNumber: {
      type: String,
      trim: true
    },
    mauzaName: {
      type: String,
      trim: true
    },
    
    // Boundaries
    boundaries: {
      north: {
        khasraNumber: String,
        ownerName: String,
        description: String,
        verified: {
          type: Boolean,
          default: false
        }
      },
      south: {
        khasraNumber: String,
        ownerName: String,
        description: String,
        verified: {
          type: Boolean,
          default: false
        }
      },
      east: {
        khasraNumber: String,
        ownerName: String,
        description: String,
        verified: {
          type: Boolean,
          default: false
        }
      },
      west: {
        khasraNumber: String,
        ownerName: String,
        description: String,
        verified: {
          type: Boolean,
          default: false
        }
      }
    },
    
    // Area Information
    area: {
      recordedArea: {
        value: {
          type: Number,
          required: [true, 'Recorded area value is required'],
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
          min: [0, 'Area cannot be negative']
        },
        unit: {
          type: String,
          enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
          default: 'kanal'
        },
        measurementMethod: {
          type: String,
          enum: ['gps', 'total_station', 'tape', 'map_calculation', 'other'],
          default: 'map_calculation'
        },
        measuredDate: Date,
        measuredBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
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
      isVerified: {
        type: Boolean,
        default: false
      }
    },
    
    // Map Coordinates (if available)
    mapCoordinates: {
      latitude: Number,
      longitude: Number,
      coordinates: [{
        lat: Number,
        lng: Number
      }],
      polygonPoints: [{
        sequence: Number,
        latitude: Number,
        longitude: Number,
        description: String
      }]
    },
    
    // Land Type and Use
    landType: {
      type: String,
      enum: ['agricultural', 'residential', 'commercial', 'industrial', 'mixed_use', 'vacant', 'barren', 'forest', 'water_body', 'other'],
      default: 'agricultural'
    },
    currentUse: String,
    
    // Mapping Status
    mappingStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'disputed'],
      default: 'pending'
    },
    mappedDate: Date,
    mappedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    mappingNotes: {
      type: String,
      trim: true
    }
  }],
  
  // Adjacent Khasras
  adjacentKhasras: [{
    khasraNumber: {
      type: String,
      required: [true, 'Adjacent khasra number is required'],
      trim: true
    },
    direction: {
      type: String,
      enum: ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'],
      required: [true, 'Direction is required']
    },
    ownerName: {
      type: String,
      trim: true
    },
    ownerCNIC: {
      type: String,
      trim: true
    },
    contactNumber: String,
    area: {
      value: Number,
      unit: {
        type: String,
        enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
        default: 'kanal'
      }
    },
    landType: String,
    boundaryStatus: {
      type: String,
      enum: ['clear', 'disputed', 'unclear', 'encroached'],
      default: 'clear'
    },
    boundaryMarkers: [{
      markerType: {
        type: String,
        enum: ['pillar', 'tree', 'wall', 'fence', 'natural', 'other'],
        default: 'pillar'
      },
      description: String,
      condition: {
        type: String,
        enum: ['good', 'damaged', 'missing', 'needs_repair'],
        default: 'good'
      },
      location: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    }],
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
  
  // Overlap Detection
  overlaps: [{
    overlapType: {
      type: String,
      enum: ['area_overlap', 'boundary_overlap', 'ownership_overlap', 'record_overlap', 'other'],
      required: [true, 'Overlap type is required']
    },
    description: {
      type: String,
      required: [true, 'Overlap description is required'],
      trim: true
    },
    affectedKhasras: [{
      khasraNumber: String,
      ownerName: String,
      area: {
        value: Number,
        unit: String
      }
    }],
    overlapArea: {
      value: Number,
      unit: {
        type: String,
        enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
        default: 'kanal'
      }
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
      enum: ['open', 'under_investigation', 'resolved', 'escalated', 'legal_action'],
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
    }
  }],
  
  // Map Verification
  mapVerification: {
    verifiedOnMap: {
      type: Boolean,
      default: false
    },
    verificationDate: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verificationMethod: {
      type: String,
      enum: ['physical_inspection', 'gps_verification', 'satellite_imagery', 'survey', 'other'],
      default: 'physical_inspection'
    },
    mapAccuracy: {
      type: String,
      enum: ['accurate', 'minor_discrepancies', 'major_discrepancies', 'inaccurate'],
      default: 'accurate'
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
    verificationNotes: {
      type: String,
      trim: true
    }
  },
  
  // Mapping Notes
  mappingNotes: [{
    noteType: {
      type: String,
      enum: ['boundary', 'area', 'adjacent', 'overlap', 'general', 'other'],
      default: 'general'
    },
    note: {
      type: String,
      required: [true, 'Note is required'],
      trim: true
    },
    khasraNumber: String,
    createdDate: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    attachments: [{
      documentType: String,
      documentUrl: String,
      uploadedDate: Date
    }]
  }],
  
  // Forms and Documents
  formsChecklist: [{
    formName: {
      type: String,
      required: [true, 'Form name is required'],
      trim: true
    },
    formType: {
      type: String,
      enum: ['shajra', 'boundary_certificate', 'area_certificate', 'adjacent_consent', 'overlap_report', 'mapping_certificate', 'other'],
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
khasraMappingSchema.index({ mappingNumber: 1 });
khasraMappingSchema.index({ landIdentification: 1 });
khasraMappingSchema.index({ recordVerification: 1 });
khasraMappingSchema.index({ status: 1 });
khasraMappingSchema.index({ currentStep: 1 });
khasraMappingSchema.index({ 'khasras.khasraNumber': 1 });
khasraMappingSchema.index({ createdBy: 1 });
khasraMappingSchema.index({ assignedTo: 1 });
khasraMappingSchema.index({ createdAt: -1 });

// Pagination plugin
khasraMappingSchema.plugin(mongoosePaginate);

const KhasraMapping = mongoose.model('KhasraMapping', khasraMappingSchema);

module.exports = KhasraMapping;

