const express = require('express');
const router = express.Router();
const { searchDocuments } = require('../utils/aiDocumentSearch');

/**
 * POST /api/ai/assistant
 * Body: { query: string, limit?: number }
 * Permission-aware document finder. Never runs free-form Mongo from the LLM.
 * Auth applied at app.use('/api/ai', authMiddleware, ...).
 */
router.post('/assistant', async (req, res) => {
  try {
    const query = String(req.body?.query || req.body?.message || '').trim();
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }
    if (query.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Query is too long (max 500 characters)'
      });
    }

    const limit = req.body?.limit;
    const userId = req.user?._id || req.user?.id;
    console.log('[aiAssistant] query', {
      userId: userId ? String(userId) : null,
      role: req.user?.role,
      q: query.slice(0, 120)
    });

    const { intent, results, message, llmUsed } = await searchDocuments(req, query, { limit });

    return res.json({
      success: true,
      message,
      data: {
        intent,
        results,
        llmUsed: Boolean(llmUsed)
      }
    });
  } catch (error) {
    console.error('[aiAssistant] error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Assistant search failed'
    });
  }
});

module.exports = router;
