const express = require('express');
const router = express.Router();
const Candidate = require('../models/hr/Candidate');
const Application = require('../models/hr/Application');

// Health check endpoint for debugging
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Public candidates route is working',
    timestamp: new Date(),
    routes: [
      'GET /:candidateId',
      'PUT /:candidateId',
      'GET /:candidateId/applications',
      'POST /:candidateId/accept-offer',
      'POST /:candidateId/decline-offer'
    ]
  });
});

// Debug endpoint to check candidate status and applications
router.get('/debug/:candidateId', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.candidateId);
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
        candidateId: req.params.candidateId
      });
    }

    const applications = await Application.find({ candidate: req.params.candidateId });
    
    res.json({
      success: true,
      candidate: {
        id: candidate._id,
        name: candidate.firstName + ' ' + candidate.lastName,
        status: candidate.status,
        email: candidate.email
      },
      applications: applications.map(app => ({
        id: app._id,
        status: app.status,
        jobPosting: app.jobPosting
      })),
      canAcceptOffer: candidate.status === 'offered' && applications.some(app => ['offer_sent', 'shortlisted'].includes(app.status))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error debugging candidate',
      error: error.message
    });
  }
});

// Get candidate profile by ID (public)
router.get('/:candidateId', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.candidateId)
      .select('-__v -internalNotes -evaluationNotes -salaryHistory');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      data: candidate
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching candidate profile',
      error: error.message
    });
  }
});

// Update candidate profile (public)
router.put('/:candidateId', async (req, res) => {
  try {
    const {
      name,
      phone,
      experience,
      education,
      skills,
      expectedSalary,
      availability,
      address
    } = req.body;

    const candidate = await Candidate.findById(req.params.candidateId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Update allowed fields
    if (name) candidate.name = name;
    if (phone) candidate.phone = phone;
    if (experience) candidate.experience = experience;
    if (education) candidate.education = education;
    if (skills) candidate.skills = skills;
    if (expectedSalary) candidate.expectedSalary = expectedSalary;
    if (availability) candidate.availability = availability;
    if (address) candidate.address = address;

    candidate.lastUpdated = new Date();
    await candidate.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: candidate
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating candidate profile',
      error: error.message
    });
  }
});

// Get candidate's application history (public)
router.get('/:candidateId/applications', async (req, res) => {
  try {
    const applications = await Application.find({ 
      candidate: req.params.candidateId 
    })
    .populate('jobPosting', 'title company department location')
    .select('status jobPosting appliedAt')
    .sort({ appliedAt: -1 });

    res.json({
      success: true,
      data: applications
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching application history',
      error: error.message
    });
  }
});

// Upload candidate document (public)
router.post('/:candidateId/documents', async (req, res) => {
  try {
    const { documentType, documentUrl, documentName } = req.body;

    if (!documentType || !documentUrl) {
      return res.status(400).json({
        success: false,
        message: 'Document type and URL are required'
      });
    }

    const candidate = await Candidate.findById(req.params.candidateId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Add document to candidate
    candidate.documents.push({
      type: documentType,
      name: documentName || documentType,
      url: documentUrl,
      uploadedAt: new Date()
    });

    await candidate.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: candidate.documents[candidate.documents.length - 1]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error uploading document',
      error: error.message
    });
  }
});

// Accept job offer (public)
router.post('/:candidateId/accept-offer', async (req, res) => {
  try {
    console.log('Accept offer request received:', {
      candidateId: req.params.candidateId,
      candidateIdLength: req.params.candidateId ? req.params.candidateId.length : 0,
      candidateIdType: typeof req.params.candidateId,
      body: req.body,
      timestamp: new Date()
    });

    const { acceptanceDate, startDate, termsAccepted = true } = req.body;

    if (!termsAccepted) {
      return res.status(400).json({
        success: false,
        message: 'Terms acceptance is required'
      });
    }

    // Validate candidate ID format
    if (!req.params.candidateId || !/^[0-9a-fA-F]{24}$/.test(req.params.candidateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid candidate ID format. ID must be a valid MongoDB ObjectId.'
      });
    }

    const candidate = await Candidate.findById(req.params.candidateId);

    if (!candidate) {
      console.log('Candidate not found for ID:', req.params.candidateId);
      return res.status(404).json({
        success: false,
        message: 'Candidate not found',
        debug: {
          candidateId: req.params.candidateId,
          timestamp: new Date()
        }
      });
    }

    console.log('Candidate found:', {
      id: candidate._id,
      name: candidate.firstName + ' ' + candidate.lastName,
      status: candidate.status
    });

    // Check if candidate has an active offer
    if (candidate.status === 'offer_accepted') {
      return res.status(409).json({
        success: false,
        message: 'This job offer has already been accepted. You cannot accept it again.',
        data: {
          candidateId: candidate._id,
          status: 'already_accepted',
          acceptedAt: candidate.offer?.offerAcceptedAt
        }
      });
    }
    
    if (candidate.status !== 'offered') {
      return res.status(400).json({
        success: false,
        message: 'Candidate does not have an active job offer. Current status: ' + candidate.status
      });
    }

    // Check if candidate has offer details
    if (!candidate.offer) {
      return res.status(400).json({
        success: false,
        message: 'Candidate does not have offer details. Please contact HR for assistance.'
      });
    }

    // Check if offer has expired
    if (candidate.offer.offerExpiryDate && new Date() > candidate.offer.offerExpiryDate) {
      return res.status(400).json({
        success: false,
        message: 'This job offer has expired'
      });
    }

    // Find the application for this candidate
    // First try to find an application with offer_sent status
    let application = await Application.findOne({
      candidate: req.params.candidateId,
      status: 'offer_sent'
    });

    // If no offer_sent application found, look for shortlisted applications
    if (!application) {
      application = await Application.findOne({
        candidate: req.params.candidateId,
        status: 'shortlisted'
      });
    }

    // If still no application found, check if there are any applications for this candidate
    if (!application) {
      const allApplications = await Application.find({ candidate: req.params.candidateId });
      console.log('All applications for candidate:', allApplications.map(app => ({
        id: app._id,
        status: app.status,
        jobPosting: app.jobPosting
      })));
      
      // Check if offer was already accepted
      const acceptedApplication = allApplications.find(app => app.status === 'offer_accepted');
      if (acceptedApplication) {
        return res.status(409).json({
          success: false,
          message: 'This job offer has already been accepted. You cannot accept it again.',
          data: {
            applicationId: acceptedApplication._id,
            acceptedAt: acceptedApplication.offerAcceptedAt,
            status: 'already_accepted'
          }
        });
      }
    }

    console.log('Application search result:', {
      candidateId: req.params.candidateId,
      applicationFound: !!application,
      applicationStatus: application ? application.status : 'N/A'
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Job offer not found or already processed. The candidate needs to have an application with status "offer_sent" or "shortlisted" to accept an offer. Please contact HR for assistance.',
        debug: {
          candidateId: req.params.candidateId,
          candidateStatus: candidate.status,
          hasOffer: !!candidate.offer,
          offerExpiryDate: candidate.offer?.offerExpiryDate,
          expectedApplicationStatuses: ['offer_sent', 'shortlisted'],
          note: 'Check if the offer was already accepted or if there are no active applications'
        }
      });
    }

    // Update application status to offer accepted
    application.status = 'offer_accepted';
    application.offerAcceptedAt = new Date();
    application.offerAcceptanceDetails = {
      acceptanceDate: acceptanceDate || new Date(),
      startDate: startDate,
      termsAccepted: termsAccepted
    };

    await application.save();

    // Update candidate status
    candidate.status = 'offer_accepted';
    candidate.lastUpdated = new Date();
    await candidate.save();

    // TODO: Send confirmation email to HR team
    // TODO: Update job posting application count if needed

    res.json({
      success: true,
      message: 'Job offer accepted successfully',
      data: {
        applicationId: application._id,
        candidateId: candidate._id,
        status: 'offer_accepted',
        acceptedAt: application.offerAcceptedAt
      }
    });

  } catch (error) {
    console.error('Error accepting job offer:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting job offer',
      error: error.message
    });
  }
});

// Decline job offer (public)
router.post('/:candidateId/decline-offer', async (req, res) => {
  try {
    const { offerId, declineReason, feedback } = req.body;

    if (!offerId) {
      return res.status(400).json({
        success: false,
        message: 'Offer ID is required'
      });
    }

    const candidate = await Candidate.findById(req.params.candidateId);

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Find the application with the offer
    const application = await Application.findOne({
      candidate: req.params.candidateId,
      _id: offerId,
      status: { $in: ['offer_sent', 'shortlisted'] }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Job offer not found or already processed'
      });
    }

    // Update application status to offer declined
    application.status = 'offer_declined';
    application.offerDeclinedAt = new Date();
    application.offerDeclineDetails = {
      declineReason: declineReason || 'No reason provided',
      feedback: feedback,
      declinedAt: new Date()
    };

    await application.save();

    // Update candidate status
    candidate.status = 'offer_declined';
    candidate.lastUpdated = new Date();
    await candidate.save();

    // TODO: Send notification email to HR team
    // TODO: Update job posting application count if needed

    res.json({
      success: true,
      message: 'Job offer declined successfully',
      data: {
        applicationId: application._id,
        candidateId: candidate._id,
        status: 'offer_declined',
        declinedAt: application.offerDeclinedAt
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error declining job offer',
      error: error.message
    });
  }
});

module.exports = router;
