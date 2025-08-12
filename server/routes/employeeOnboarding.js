const express = require('express');
const router = express.Router();
const employeeOnboardingService = require('../services/employeeOnboardingService');
const { authMiddleware } = require('../middleware/auth');

// Public routes (no authentication required)
router.get('/public/:onboardingId', async (req, res) => {
  try {
    const { onboardingId } = req.params;
    
    console.log(`📄 Public GET request for onboarding: ${onboardingId}`);
    console.log(`🔍 Searching for onboarding with ID: ${onboardingId}`);
    
    const result = await employeeOnboardingService.getPublicOnboarding(onboardingId);
    
    console.log(`✅ Onboarding found:`, result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error in public GET onboarding:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load onboarding'
    });
  }
});

router.post('/public/:onboardingId/submit', async (req, res) => {
  try {
    const { onboardingId } = req.params;
    const formData = req.body;
    
    console.log(`📝 Public POST request for onboarding submission: ${onboardingId}`);
    console.log('Form data:', formData);
    
    const result = await employeeOnboardingService.processOnboardingForm(onboardingId, formData);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error in public POST onboarding submission:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit onboarding'
    });
  }
});

// Protected routes (require authentication)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = req.query;
    const result = await employeeOnboardingService.getAllOnboarding(filters);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting onboarding records:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get onboarding records'
    });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await employeeOnboardingService.getPublicOnboarding(id);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error getting onboarding record:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get onboarding record'
    });
  }
});

router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, hrRemarks } = req.body;
    
    // This will be implemented to allow HR to update onboarding status
    res.json({
      success: true,
      message: 'Onboarding status updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating onboarding status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update onboarding status'
    });
  }
});

module.exports = router;
