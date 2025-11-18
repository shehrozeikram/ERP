const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const negotiationBayanaSchema = new mongoose.Schema({
  // Negotiation Number
  negotiationNumber: {
    type: String,
    required: [true, 'Negotiation number is required'],
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
  
  // Reference to Owner Due Diligence
  ownerDueDiligence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OwnerDueDiligence'
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'market_study_done', 'offer_sent', 'token_received', 'bayana_executed', 'negotiation_completed', 'cancelled', 'on_hold'],
    default: 'draft'
  },
  
  // Current Step in Workflow
  currentStep: {
    type: String,
    enum: ['market_rate_study', 'offer_sheet', 'token', 'bayana', 'payment_terms', 'completion'],
    default: 'market_rate_study'
  },
  
  // Market Rate Study
  marketRateStudy: {
    studyDate: {
      type: Date,
      default: Date.now
    },
    conductedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Market Analysis
    marketAnalysis: {
      location: {
        area: String,
        city: String,
        district: String,
        proximityToMainRoad: String,
        nearbyDevelopments: String,
        infrastructure: String
      },
      comparableProperties: [{
        propertyLocation: String,
        propertyType: String,
        area: {
          value: Number,
          unit: {
            type: String,
            enum: ['kanal', 'marla', 'acre', 'square_feet', 'square_meter', 'square_yard'],
            default: 'kanal'
          }
        },
        salePrice: Number,
        pricePerUnit: Number,
        saleDate: Date,
        notes: String
      }],
      marketTrends: {
        currentTrend: {
          type: String,
          enum: ['rising', 'stable', 'declining', 'volatile'],
          default: 'stable'
        },
        trendAnalysis: String,
        futureProjection: String
      },
      priceRange: {
        minimum: Number,
        maximum: Number,
        average: Number,
        recommended: Number
      },
      factors: [{
        factor: String,
        impact: {
          type: String,
          enum: ['positive', 'negative', 'neutral'],
          default: 'neutral'
        },
        description: String
      }]
    },
    
    // Study Report
    studyReport: {
      reportDate: Date,
      reportUrl: String,
      summary: String,
      recommendations: String,
      approved: {
        type: Boolean,
        default: false
      },
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      approvedDate: Date
    },
    
    studyNotes: {
      type: String,
      trim: true
    }
  },
  
  // Offer Sheet
  offerSheet: {
    offerDate: {
      type: Date,
      default: Date.now
    },
    offerNumber: String,
    preparedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Offer Details
    offerDetails: {
      offeredPrice: {
        value: {
          type: Number,
          required: [true, 'Offered price is required'],
          min: [0, 'Price cannot be negative']
        },
        currency: {
          type: String,
          default: 'PKR'
        },
        pricePerKanal: Number,
        pricePerMarla: Number
      },
      paymentTerms: {
        downPayment: {
          value: Number,
          percentage: Number
        },
        installments: [{
          installmentNumber: Number,
          amount: Number,
          dueDate: Date,
          description: String
        }],
        totalInstallments: Number,
        paymentSchedule: String
      },
      conditions: [{
        condition: {
          type: String,
          required: true,
          trim: true
        },
        mandatory: {
          type: Boolean,
          default: false
        },
        description: String
      }],
      validityPeriod: {
        startDate: Date,
        endDate: Date,
        days: Number
      },
      specialTerms: {
        type: String,
        trim: true
      }
    },
    
    // Offer Status
    offerStatus: {
      type: String,
      enum: ['draft', 'sent', 'under_review', 'accepted', 'rejected', 'counter_offered', 'expired'],
      default: 'draft'
    },
    sentDate: Date,
    responseDate: Date,
    responseNotes: String,
    
    // Counter Offer
    counterOffer: {
      received: {
        type: Boolean,
        default: false
      },
      counterPrice: {
        value: Number,
        currency: String
      },
      counterTerms: String,
      counterDate: Date,
      response: {
        type: String,
        enum: ['accepted', 'rejected', 'under_negotiation'],
        default: 'under_negotiation'
      }
    },
    
    offerNotes: {
      type: String,
      trim: true
    }
  },
  
  // Token
  token: {
    tokenReceived: {
      type: Boolean,
      default: false
    },
    tokenDate: Date,
    tokenAmount: {
      value: {
        type: Number,
        min: [0, 'Token amount cannot be negative']
      },
      currency: {
        type: String,
        default: 'PKR'
      }
    },
    tokenMode: {
      type: String,
      enum: ['cash', 'cheque', 'bank_transfer', 'online', 'other'],
      default: 'cash'
    },
    tokenReceiptNumber: String,
    tokenReceiptUrl: String,
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    tokenNotes: {
      type: String,
      trim: true
    },
    tokenRefundable: {
      type: Boolean,
      default: true
    },
    tokenRefundConditions: {
      type: String,
      trim: true
    }
  },
  
  // Bayana
  bayana: {
    bayanaExecuted: {
      type: Boolean,
      default: false
    },
    bayanaDate: Date,
    bayanaNumber: String,
    bayanaAmount: {
      value: {
        type: Number,
        required: function() {
          return this.bayana.bayanaExecuted === true;
        },
        min: [0, 'Bayana amount cannot be negative']
      },
      currency: {
        type: String,
        default: 'PKR'
      }
    },
    bayanaMode: {
      type: String,
      enum: ['cash', 'cheque', 'bank_transfer', 'online', 'other'],
      default: 'cash'
    },
    
    // Bayana Parties
    parties: {
      seller: {
        name: String,
        cnic: String,
        contactNumber: String,
        address: String,
        signature: String,
        signatureDate: Date
      },
      buyer: {
        name: String,
        cnic: String,
        contactNumber: String,
        address: String,
        signature: String,
        signatureDate: Date
      },
      witnesses: [{
        name: String,
        cnic: String,
        contactNumber: String,
        relationship: String,
        signature: String,
        signatureDate: Date
      }]
    },
    
    // Bayana Terms
    bayanaTerms: {
      totalPrice: {
        value: Number,
        currency: String
      },
      bayanaPercentage: Number,
      remainingAmount: {
        value: Number,
        currency: String
      },
      possessionDate: Date,
      registryDate: Date,
      conditions: [{
        condition: String,
        mandatory: Boolean,
        description: String
      }],
      cancellationTerms: {
        sellerCancellation: String,
        buyerCancellation: String,
        penaltyClause: String
      }
    },
    
    // Bayana Documents
    bayanaDocuments: [{
      documentType: {
        type: String,
        enum: ['bayana_agreement', 'token_receipt', 'identity_proof', 'land_documents', 'other'],
        default: 'other'
      },
      documentName: String,
      documentUrl: String,
      uploadedDate: Date
    }],
    
    bayanaNotes: {
      type: String,
      trim: true
    }
  },
  
  // Verbal Settlement Risks
  verbalSettlementRisks: {
    identified: {
      type: Boolean,
      default: false
    },
    identifiedDate: Date,
    identifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    // Risks
    risks: [{
      riskNumber: String,
      riskType: {
        type: String,
        enum: ['price_dispute', 'terms_dispute', 'possession_dispute', 'document_dispute', 'payment_dispute', 'other'],
        required: true
      },
      riskDescription: {
        type: String,
        required: true,
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
      mitigation: {
        type: String,
        trim: true
      },
      status: {
        type: String,
        enum: ['open', 'mitigated', 'resolved', 'escalated'],
        default: 'open'
      },
      notes: {
        type: String,
        trim: true
      }
    }],
    
    // Risk Mitigation
    riskMitigation: {
      writtenAgreement: {
        type: Boolean,
        default: false
      },
      witnessPresent: {
        type: Boolean,
        default: false
      },
      documentation: {
        type: Boolean,
        default: false
      },
      legalReview: {
        type: Boolean,
        default: false
      },
      otherMeasures: String
    },
    
    riskNotes: {
      type: String,
      trim: true
    }
  },
  
  // Land Agent Commission
  landAgentCommission: {
    agentInvolved: {
      type: Boolean,
      default: false
    },
    agentDetails: {
      name: String,
      cnic: String,
      contactNumber: String,
      licenseNumber: String,
      agencyName: String,
      address: String
    },
    
    // Commission Structure
    commission: {
      commissionType: {
        type: String,
        enum: ['percentage', 'fixed', 'negotiated', 'none'],
        default: 'percentage'
      },
      commissionRate: Number, // percentage if commissionType is percentage
      commissionAmount: {
        value: Number,
        currency: {
          type: String,
          default: 'PKR'
        }
      },
      commissionBasis: {
        type: String,
        enum: ['total_price', 'bayana_amount', 'per_kanal', 'per_marla', 'other'],
        default: 'total_price'
      },
      paymentTerms: {
        paymentSchedule: String,
        installments: [{
          installmentNumber: Number,
          amount: Number,
          dueDate: Date,
          paid: {
            type: Boolean,
            default: false
          },
          paidDate: Date
        }]
      },
      commissionAgreement: {
        agreementDate: Date,
        agreementUrl: String,
        terms: String
      }
    },
    
    commissionNotes: {
      type: String,
      trim: true
    }
  },
  
  // Payment Terms Structure
  paymentTermsStructure: {
    totalPrice: {
      value: {
        type: Number,
        required: [true, 'Total price is required'],
        min: [0, 'Price cannot be negative']
      },
      currency: {
        type: String,
        default: 'PKR'
      }
    },
    
    // Payment Breakdown
    paymentBreakdown: {
      token: {
        amount: Number,
        percentage: Number,
        paid: {
          type: Boolean,
          default: false
        },
        paidDate: Date
      },
      bayana: {
        amount: Number,
        percentage: Number,
        paid: {
          type: Boolean,
          default: false
        },
        paidDate: Date
      },
      installments: [{
        installmentNumber: {
          type: Number,
          required: true
        },
        amount: Number,
        percentage: Number,
        dueDate: Date,
        paid: {
          type: Boolean,
          default: false
        },
        paidDate: Date,
        paymentMode: {
          type: String,
          enum: ['cash', 'cheque', 'bank_transfer', 'online', 'other'],
          default: 'bank_transfer'
        },
        receiptNumber: String,
        receiptUrl: String,
        notes: String
      }],
      finalPayment: {
        amount: Number,
        percentage: Number,
        dueDate: Date,
        paid: {
          type: Boolean,
          default: false
        },
        paidDate: Date
      }
    },
    
    // Payment Schedule
    paymentSchedule: {
      scheduleType: {
        type: String,
        enum: ['lump_sum', 'installments', 'milestone_based', 'custom'],
        default: 'installments'
      },
      totalInstallments: Number,
      installmentFrequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'semi_annually', 'annually', 'custom'],
        default: 'monthly'
      },
      firstInstallmentDate: Date,
      lastInstallmentDate: Date,
      gracePeriod: Number, // in days
      latePaymentPenalty: {
        percentage: Number,
        fixedAmount: Number,
        description: String
      }
    },
    
    // Payment Tracking
    paymentTracking: {
      totalPaid: {
        value: Number,
        currency: String
      },
      totalPending: {
        value: Number,
        currency: String
      },
      paymentPercentage: Number,
      nextDueDate: Date,
      nextDueAmount: Number,
      overduePayments: [{
        installmentNumber: Number,
        amount: Number,
        dueDate: Date,
        daysOverdue: Number
      }]
    },
    
    paymentNotes: {
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
      enum: ['market_study_report', 'offer_sheet', 'token_receipt', 'bayana_agreement', 'commission_agreement', 'payment_receipt', 'other'],
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
negotiationBayanaSchema.index({ negotiationNumber: 1 });
negotiationBayanaSchema.index({ landIdentification: 1 });
negotiationBayanaSchema.index({ ownerDueDiligence: 1 });
negotiationBayanaSchema.index({ status: 1 });
negotiationBayanaSchema.index({ currentStep: 1 });
negotiationBayanaSchema.index({ 'offerSheet.offerStatus': 1 });
negotiationBayanaSchema.index({ 'bayana.bayanaExecuted': 1 });
negotiationBayanaSchema.index({ createdBy: 1 });
negotiationBayanaSchema.index({ assignedTo: 1 });
negotiationBayanaSchema.index({ createdAt: -1 });

// Pagination plugin
negotiationBayanaSchema.plugin(mongoosePaginate);

const NegotiationBayana = mongoose.model('NegotiationBayana', negotiationBayanaSchema);

module.exports = NegotiationBayana;

