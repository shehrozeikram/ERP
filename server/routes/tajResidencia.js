const express = require('express');
const router = express.Router();
const LandIdentification = require('../models/tajResidencia/LandIdentification');
const RecordVerification = require('../models/tajResidencia/RecordVerification');
const KhasraMapping = require('../models/tajResidencia/KhasraMapping');
const Demarcation = require('../models/tajResidencia/Demarcation');
const OwnerDueDiligence = require('../models/tajResidencia/OwnerDueDiligence');
const NegotiationBayana = require('../models/tajResidencia/NegotiationBayana');
const { authMiddleware } = require('../middleware/auth');
const { createCRUDHandlers } = require('./tajResidenciaHandlers');

// Land Identification Routes
const landIdentificationHandlers = createCRUDHandlers(LandIdentification, 'Land Identification', {
  numberField: 'identificationNumber',
  numberPrefix: 'LI',
  searchFields: [
    'identificationNumber',
    'mauzaIdentification.mauzaName',
    'patwariContact.patwariName',
    'ownerDetails.ownerName'
  ],
  populateFields: [
    { path: 'createdBy', select: 'fullName email' },
    { path: 'updatedBy', select: 'fullName email' },
    { path: 'assignedTo', select: 'fullName email' }
  ],
  customFilters: {
    district: 'mauzaIdentification.district',
    tehsil: 'mauzaIdentification.tehsil'
  }
});

router.get('/land-identification', authMiddleware, landIdentificationHandlers.getAll);
router.get('/land-identification/:id', authMiddleware, async (req, res) => {
  try {
    const item = await LandIdentification.findById(req.params.id)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('workflowHistory.performedBy', 'fullName email')
      .populate('rolesInvolved.personId', 'fullName email');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Land identification not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching land identification:', error);
    res.status(500).json({ success: false, message: 'Error fetching land identification', error: error.message });
  }
});
router.post('/land-identification', authMiddleware, landIdentificationHandlers.create);
router.put('/land-identification/:id', authMiddleware, landIdentificationHandlers.update);
router.delete('/land-identification/:id', authMiddleware, landIdentificationHandlers.remove);
router.post('/land-identification/:id/workflow', authMiddleware, landIdentificationHandlers.updateWorkflow);

// Record Verification Routes
const recordVerificationHandlers = createCRUDHandlers(RecordVerification, 'Record Verification', {
  numberField: 'verificationNumber',
  numberPrefix: 'RV',
  searchFields: [
    'verificationNumber',
    'jamabandi.recordDetails.ownerName',
    'fard.fardDetails.mauzaName'
  ],
  populateFields: [
    { path: 'landIdentification', select: 'identificationNumber mauzaIdentification' },
    { path: 'createdBy', select: 'fullName email' },
    { path: 'updatedBy', select: 'fullName email' },
    { path: 'assignedTo', select: 'fullName email' }
  ]
});

router.get('/record-verification', authMiddleware, recordVerificationHandlers.getAll);
router.get('/record-verification/:id', authMiddleware, async (req, res) => {
  try {
    const item = await RecordVerification.findById(req.params.id)
      .populate('landIdentification')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('workflowHistory.performedBy', 'fullName email')
      .populate('disputes.identifiedBy', 'fullName email')
      .populate('fraudChecks.checkedBy', 'fullName email');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Record verification not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching record verification:', error);
    res.status(500).json({ success: false, message: 'Error fetching record verification', error: error.message });
  }
});
router.post('/record-verification', authMiddleware, recordVerificationHandlers.create);
router.put('/record-verification/:id', authMiddleware, recordVerificationHandlers.update);
router.delete('/record-verification/:id', authMiddleware, recordVerificationHandlers.remove);
router.post('/record-verification/:id/workflow', authMiddleware, recordVerificationHandlers.updateWorkflow);

// Khasra Mapping Routes
const khasraMappingHandlers = createCRUDHandlers(KhasraMapping, 'Khasra Mapping', {
  numberField: 'mappingNumber',
  numberPrefix: 'KM',
  searchFields: [
    'mappingNumber',
    'khasras.khasraNumber',
    'shajra.shajraNumber'
  ],
  populateFields: [
    { path: 'landIdentification', select: 'identificationNumber mauzaIdentification' },
    { path: 'recordVerification', select: 'verificationNumber' },
    { path: 'createdBy', select: 'fullName email' },
    { path: 'updatedBy', select: 'fullName email' },
    { path: 'assignedTo', select: 'fullName email' }
  ]
});

router.get('/khasra-mapping', authMiddleware, khasraMappingHandlers.getAll);
router.get('/khasra-mapping/:id', authMiddleware, async (req, res) => {
  try {
    const item = await KhasraMapping.findById(req.params.id)
      .populate('landIdentification')
      .populate('recordVerification')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('workflowHistory.performedBy', 'fullName email')
      .populate('khasras.mappedBy', 'fullName email')
      .populate('khasras.area.measuredArea.measuredBy', 'fullName email')
      .populate('adjacentKhasras.verifiedBy', 'fullName email')
      .populate('overlaps.detectedBy', 'fullName email')
      .populate('overlaps.resolvedBy', 'fullName email')
      .populate('mapVerification.verifiedBy', 'fullName email')
      .populate('mappingNotes.createdBy', 'fullName email');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Khasra mapping not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching khasra mapping:', error);
    res.status(500).json({ success: false, message: 'Error fetching khasra mapping', error: error.message });
  }
});
router.post('/khasra-mapping', authMiddleware, khasraMappingHandlers.create);
router.put('/khasra-mapping/:id', authMiddleware, khasraMappingHandlers.update);
router.delete('/khasra-mapping/:id', authMiddleware, khasraMappingHandlers.remove);
router.post('/khasra-mapping/:id/workflow', authMiddleware, khasraMappingHandlers.updateWorkflow);

// Demarcation Routes
const demarcationHandlers = createCRUDHandlers(Demarcation, 'Demarcation', {
  numberField: 'demarcationNumber',
  numberPrefix: 'DM',
  searchFields: [
    'demarcationNumber',
    'patwariQanoongoVisit.patwari.name',
    'patwariQanoongoVisit.qanoongo.name'
  ],
  populateFields: [
    { path: 'landIdentification', select: 'identificationNumber mauzaIdentification' },
    { path: 'recordVerification', select: 'verificationNumber' },
    { path: 'khasraMapping', select: 'mappingNumber' },
    { path: 'createdBy', select: 'fullName email' },
    { path: 'updatedBy', select: 'fullName email' },
    { path: 'assignedTo', select: 'fullName email' }
  ]
});

router.get('/demarcation', authMiddleware, demarcationHandlers.getAll);
router.get('/demarcation/:id', authMiddleware, async (req, res) => {
  try {
    const item = await Demarcation.findById(req.params.id)
      .populate('landIdentification')
      .populate('recordVerification')
      .populate('khasraMapping')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('workflowHistory.performedBy', 'fullName email')
      .populate('groundMeasurement.measuredBy', 'fullName email')
      .populate('boundaryPillars.installedBy', 'fullName email')
      .populate('boundaryPillars.pillars.installedBy', 'fullName email')
      .populate('boundaryPillars.pillars.verifiedBy', 'fullName email')
      .populate('encroachmentDetection.checkedBy', 'fullName email')
      .populate('encroachmentDetection.encroachments.detectedBy', 'fullName email')
      .populate('encroachmentDetection.encroachments.resolvedBy', 'fullName email')
      .populate('groundSketch.createdBy', 'fullName email')
      .populate('groundSketch.verifiedBy', 'fullName email')
      .populate('societyAlignment.alignedBy', 'fullName email')
      .populate('societyAlignment.verifiedBy', 'fullName email')
      .populate('demarcationReport.generatedBy', 'fullName email')
      .populate('demarcationReport.approvedBy', 'fullName email')
      .populate('formsChecklist.verifiedBy', 'fullName email');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Demarcation not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching demarcation:', error);
    res.status(500).json({ success: false, message: 'Error fetching demarcation', error: error.message });
  }
});
router.post('/demarcation', authMiddleware, demarcationHandlers.create);
router.put('/demarcation/:id', authMiddleware, demarcationHandlers.update);
router.delete('/demarcation/:id', authMiddleware, demarcationHandlers.remove);
router.post('/demarcation/:id/workflow', authMiddleware, demarcationHandlers.updateWorkflow);

// Owner Due Diligence Routes
const ownerDueDiligenceHandlers = createCRUDHandlers(OwnerDueDiligence, 'Owner Due Diligence', {
  numberField: 'dueDiligenceNumber',
  numberPrefix: 'ODD',
  searchFields: [
    'dueDiligenceNumber',
    'cnicChecks.cnicVerifications.ownerName',
    'cnicChecks.cnicVerifications.cnic',
    'multipleHeirs.heirs.name'
  ],
  populateFields: [
    { path: 'landIdentification', select: 'identificationNumber mauzaIdentification' },
    { path: 'recordVerification', select: 'verificationNumber' },
    { path: 'createdBy', select: 'fullName email' },
    { path: 'updatedBy', select: 'fullName email' },
    { path: 'assignedTo', select: 'fullName email' }
  ]
});

router.get('/owner-due-diligence', authMiddleware, ownerDueDiligenceHandlers.getAll);
router.get('/owner-due-diligence/:id', authMiddleware, async (req, res) => {
  try {
    const item = await OwnerDueDiligence.findById(req.params.id)
      .populate('landIdentification')
      .populate('recordVerification')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('workflowHistory.performedBy', 'fullName email')
      .populate('cnicChecks.checkedBy', 'fullName email')
      .populate('cnicChecks.cnicVerifications.verifiedBy', 'fullName email')
      .populate('nadraFamilyTree.verifiedBy', 'fullName email')
      .populate('multipleHeirs.identifiedBy', 'fullName email')
      .populate('multipleHeirs.heirs.verifiedBy', 'fullName email')
      .populate('powerOfAttorney.verifiedBy', 'fullName email')
      .populate('powerOfAttorney.poaDocuments.verifiedBy', 'fullName email')
      .populate('disputeHistory.checkedBy', 'fullName email')
      .populate('deathCases.verifiedBy', 'fullName email')
      .populate('deathCases.deathCases.verifiedBy', 'fullName email')
      .populate('ownerInterview.conductedBy', 'fullName email')
      .populate('formsChecklist.verifiedBy', 'fullName email');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Owner due diligence not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching owner due diligence:', error);
    res.status(500).json({ success: false, message: 'Error fetching owner due diligence', error: error.message });
  }
});
router.post('/owner-due-diligence', authMiddleware, ownerDueDiligenceHandlers.create);
router.put('/owner-due-diligence/:id', authMiddleware, ownerDueDiligenceHandlers.update);
router.delete('/owner-due-diligence/:id', authMiddleware, ownerDueDiligenceHandlers.remove);
router.post('/owner-due-diligence/:id/workflow', authMiddleware, ownerDueDiligenceHandlers.updateWorkflow);

// Negotiation & Bayana Routes
const negotiationBayanaHandlers = createCRUDHandlers(NegotiationBayana, 'Negotiation & Bayana', {
  numberField: 'negotiationNumber',
  numberPrefix: 'NB',
  searchFields: [
    'negotiationNumber',
    'offerSheet.offerNumber',
    'bayana.bayanaNumber'
  ],
  populateFields: [
    { path: 'landIdentification', select: 'identificationNumber mauzaIdentification' },
    { path: 'ownerDueDiligence', select: 'dueDiligenceNumber' },
    { path: 'createdBy', select: 'fullName email' },
    { path: 'updatedBy', select: 'fullName email' },
    { path: 'assignedTo', select: 'fullName email' }
  ]
});

router.get('/negotiation-bayana', authMiddleware, negotiationBayanaHandlers.getAll);
router.get('/negotiation-bayana/:id', authMiddleware, async (req, res) => {
  try {
    const item = await NegotiationBayana.findById(req.params.id)
      .populate('landIdentification')
      .populate('ownerDueDiligence')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('workflowHistory.performedBy', 'fullName email')
      .populate('marketRateStudy.conductedBy', 'fullName email')
      .populate('marketRateStudy.studyReport.approvedBy', 'fullName email')
      .populate('offerSheet.preparedBy', 'fullName email')
      .populate('token.receivedBy', 'fullName email')
      .populate('verbalSettlementRisks.identifiedBy', 'fullName email')
      .populate('formsChecklist.verifiedBy', 'fullName email');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Negotiation & Bayana record not found' });
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching negotiation & bayana:', error);
    res.status(500).json({ success: false, message: 'Error fetching negotiation & bayana', error: error.message });
  }
});
router.post('/negotiation-bayana', authMiddleware, negotiationBayanaHandlers.create);
router.put('/negotiation-bayana/:id', authMiddleware, negotiationBayanaHandlers.update);
router.delete('/negotiation-bayana/:id', authMiddleware, negotiationBayanaHandlers.remove);
router.post('/negotiation-bayana/:id/workflow', authMiddleware, negotiationBayanaHandlers.updateWorkflow);

module.exports = router;
