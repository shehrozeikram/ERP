const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const TajComplaint = require('../models/tajResidencia/Complaint');

const router = express.Router();

const STATUS_OPTIONS = [
  'New',
  'Contacted',
  'Completed',
  'Hold',
  'Approval Required',
  'Others',
  'Not Applicable'
];

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

const generateTrackingCode = () => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `TR-${timestamp}-${random}`;
};

const createUniqueTrackingCode = async () => {
  let code = generateTrackingCode();
  let exists = await TajComplaint.exists({ trackingCode: code });
  while (exists) {
    code = generateTrackingCode();
    exists = await TajComplaint.exists({ trackingCode: code });
  }
  return code;
};

// Public endpoint to register complaint
router.post(
  '/public/taj-complaints',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email address'),
    body('phone')
      .optional({ checkFalsy: true })
      .matches(/^[\+]?[0-9\s-]{7,20}$/)
      .withMessage('Invalid phone number'),
    body('title').trim().notEmpty().withMessage('Complaint title is required'),
    body('description')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Please provide more details (at least 10 characters)'),
    body('priority')
      .optional()
      .isIn(PRIORITY_OPTIONS)
      .withMessage('Invalid priority selected')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const trackingCode = await createUniqueTrackingCode();
      const complaint = await TajComplaint.create({
        trackingCode,
        title: req.body.title,
        description: req.body.description,
        category: req.body.category || 'General',
        priority: req.body.priority || 'Medium',
        location: req.body.location || '',
        reporter: {
          name: req.body.name,
          email: req.body.email || '',
          phone: req.body.phone || ''
        },
        lastUpdatedBy: 'Public Portal',
        history: [
          {
            status: 'New',
            changedByName: 'Public Portal',
            notes: 'Complaint registered via public portal'
          }
        ]
      });

      return res.json({
        success: true,
        message: 'Complaint registered successfully',
        data: {
          trackingCode: complaint.trackingCode,
          status: complaint.status
        }
      });
    } catch (error) {
      console.error('Error registering complaint:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to register complaint',
        error: error.message
      });
    }
  }
);

// Public endpoint to fetch complaints by tracking code or reporter details
router.get('/public/taj-complaints', async (req, res) => {
  const { trackingCode, phone, email } = req.query;

  if (!trackingCode && !phone && !email) {
    return res.status(400).json({
      success: false,
      message: 'Please provide trackingCode, phone, or email to search.'
    });
  }

  try {
    const query = {};
    if (trackingCode) {
      query.trackingCode = trackingCode.trim().toUpperCase();
    } else {
      if (phone) {
        query['reporter.phone'] = phone.trim();
      }
      if (email) {
        query['reporter.email'] = email.trim().toLowerCase();
      }
    }

    const complaints = await TajComplaint.find(query).sort({ createdAt: -1 }).limit(50).lean();

    if (!complaints.length) {
      return res.status(404).json({
        success: false,
        message: 'No complaints found for the provided details.'
      });
    }

    return res.json({
      success: true,
      data: complaints
    });
  } catch (error) {
    console.error('Error fetching public complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: error.message
    });
  }
});

// Protected endpoint: list complaints for kanban board
router.get(
  '/taj-residencia/complaints',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        status,
        search = '',
        page = 1,
        limit = 200
      } = req.query;

      const query = {};
      if (status && STATUS_OPTIONS.includes(status)) {
        query.status = status;
      }
      if (search) {
        query.$or = [
          { title: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') },
          { 'reporter.name': new RegExp(search, 'i') },
          { trackingCode: new RegExp(search, 'i') }
        ];
      }

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);

    const [data, total] = await Promise.all([
      TajComplaint.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      TajComplaint.countDocuments(query)
    ]);

      return res.json({
        success: true,
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total
        }
      });
    } catch (error) {
      console.error('Error fetching complaints:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch complaints',
        error: error.message
      });
    }
  }
);

// Protected endpoint: update status
router.patch(
  '/taj-residencia/complaints/:id/status',
  authMiddleware,
  [
    body('status')
      .notEmpty()
      .isIn(STATUS_OPTIONS)
      .withMessage('Invalid status value')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    try {
      const complaint = await TajComplaint.findById(req.params.id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
      }

      const actorName = req.user?.fullName || req.user?.name || req.user?.email || 'SGC ERP User';

      complaint.status = req.body.status;
      complaint.lastUpdatedBy = actorName;
      complaint.lastUpdatedById = req.user?.id;
      complaint.history.push({
        status: req.body.status,
        changedBy: req.user?.id,
        changedByName: actorName,
        notes: req.body.notes || `Status updated to ${req.body.status}`
      });

      await complaint.save();

      return res.json({
        success: true,
        message: 'Status updated',
        data: complaint
      });
    } catch (error) {
      console.error('Error updating status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update complaint status',
        error: error.message
      });
    }
  }
);

module.exports = router;

