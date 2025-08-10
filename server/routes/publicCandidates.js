const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const Candidate = require('../models/hr/Candidate');

const router = express.Router();

// @route   GET /api/public/candidates/:id
// @desc    Get candidate by ID (public access for offer acceptance)
// @access  Public
router.get('/:id', 
  asyncHandler(async (req, res) => {
    const candidate = await Candidate.findById(req.params.id)
      .populate('jobPosting')
      .populate('application');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Only return basic information needed for offer acceptance
    const publicCandidate = {
      _id: candidate._id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      phone: candidate.phone,
      yearsOfExperience: candidate.yearsOfExperience,
      status: candidate.status,
      offer: candidate.offer,
      jobPosting: candidate.jobPosting
    };

    res.json({
      success: true,
      data: publicCandidate
    });
  })
);

// @route   POST /api/public/candidates/:id/accept-offer
// @desc    Candidate accepts job offer (public access)
// @access  Public
router.post('/:id/accept-offer', 
  asyncHandler(async (req, res) => {
    const candidate = await Candidate.findById(req.params.id)
      .populate('jobPosting');

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Check if candidate has an active offer
    if (candidate.status !== 'offered' || !candidate.offer) {
      return res.status(400).json({
        success: false,
        message: 'No active job offer found for this candidate'
      });
    }

    // Check if offer has expired
    if (candidate.offer.offerExpiryDate && new Date() > candidate.offer.offerExpiryDate) {
      return res.status(400).json({
        success: false,
        message: 'This job offer has expired'
      });
    }

    // Update candidate status to offer accepted
    candidate.status = 'offer_accepted';
    candidate.offer.offerAcceptedAt = new Date();
    candidate.offer.offerAcceptedBy = candidate._id; // Self-acceptance

    await candidate.save();

    // Send offer acceptance confirmation email
    try {
      const EmailService = require('../services/emailService');
      const emailResult = await EmailService.sendOfferAcceptanceConfirmation(candidate, candidate.jobPosting);
      
      if (emailResult.success) {
        console.log(`✅ Offer acceptance confirmation sent successfully to ${candidate.email}`);
      } else {
        console.error(`❌ Failed to send offer acceptance confirmation:`, emailResult.error);
      }
    } catch (emailError) {
      console.error('❌ Error sending offer acceptance confirmation:', emailError);
    }

    res.json({
      success: true,
      message: 'Job offer accepted successfully! Confirmation email sent.',
      data: candidate
    });
  })
);

module.exports = router;
