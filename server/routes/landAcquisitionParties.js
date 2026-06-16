const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const LandParty = require('../models/tajResidencia/LandParty');
const { PARTY_TYPES } = require('../models/tajResidencia/LandParty');

const router = express.Router();

const normalizeCnic = (value) => String(value || '').replace(/\D/g, '');

const formatCnic = (value) => {
  const digits = normalizeCnic(value);
  if (digits.length !== 13) return String(value || '').trim();
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

const isValidCnic = (value) => /^\d{13}$/.test(normalizeCnic(value));

const isValidPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
};

const normalizePhone = (value) => String(value || '').replace(/\s+/g, '').trim();

const parsePartyDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parsePartyType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  return PARTY_TYPES.includes(type) ? type : null;
};

const validatePartyPayload = (body, { requireType = false } = {}) => {
  const partyType = parsePartyType(body.partyType);
  const name = String(body.name || '').trim();
  const cnic = formatCnic(body.cnic);
  const phoneNumber = normalizePhone(body.phoneNumber);

  if (requireType && !partyType) {
    const err = new Error('Valid party type is required (seller, buyer, or dealer)');
    err.status = 400;
    throw err;
  }

  if (!name) {
    const err = new Error('Name is required');
    err.status = 400;
    throw err;
  }

  if (!isValidCnic(cnic)) {
    const err = new Error('CNIC must be 13 digits (e.g. 12345-1234567-1)');
    err.status = 400;
    throw err;
  }

  if (!isValidPhone(phoneNumber)) {
    const err = new Error('Phone number must be 10 to 13 digits');
    err.status = 400;
    throw err;
  }

  return {
    partyType,
    name,
    cnic,
    phoneNumber,
    partyDate: parsePartyDate(body.partyDate) || new Date()
  };
};

const serializeParty = (doc) => ({
  ...doc,
  cnic: formatCnic(doc.cnic)
});

// GET /api/taj-residencia/land-acquisition/parties
router.get('/parties', asyncHandler(async (req, res) => {
  const partyType = parsePartyType(req.query.type);
  const search = String(req.query.search || '').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

  if (!partyType) {
    return res.status(400).json({ success: false, message: 'Party type is required' });
  }

  const filter = { partyType, isActive: true };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { cnic: { $regex: search.replace(/\D/g, ''), $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LandParty.find(filter)
      .sort({ partyDate: -1, name: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LandParty.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: items.map(serializeParty),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1
    }
  });
}));

// GET /api/taj-residencia/land-acquisition/parties/:id
router.get('/parties/:id', asyncHandler(async (req, res) => {
  const item = await LandParty.findOne({ _id: req.params.id, isActive: true }).lean();
  if (!item) {
    return res.status(404).json({ success: false, message: 'Party not found' });
  }
  res.json({ success: true, data: serializeParty(item) });
}));

// POST /api/taj-residencia/land-acquisition/parties
router.post('/parties', asyncHandler(async (req, res) => {
  const payload = validatePartyPayload(req.body, { requireType: true });

  const duplicate = await LandParty.findOne({
    partyType: payload.partyType,
    cnic: payload.cnic,
    isActive: true
  }).lean();

  if (duplicate) {
    return res.status(400).json({
      success: false,
      message: `A ${payload.partyType} with this CNIC already exists`
    });
  }

  const item = await LandParty.create({
    ...payload,
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  res.status(201).json({
    success: true,
    data: serializeParty(item.toObject()),
    message: 'Party registered successfully'
  });
}));

// PUT /api/taj-residencia/land-acquisition/parties/:id
router.put('/parties/:id', asyncHandler(async (req, res) => {
  const existing = await LandParty.findOne({ _id: req.params.id, isActive: true });
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Party not found' });
  }

  const payload = validatePartyPayload({
    ...req.body,
    partyType: req.body.partyType || existing.partyType
  }, { requireType: true });

  const duplicate = await LandParty.findOne({
    _id: { $ne: existing._id },
    partyType: payload.partyType,
    cnic: payload.cnic,
    isActive: true
  }).lean();

  if (duplicate) {
    return res.status(400).json({
      success: false,
      message: `A ${payload.partyType} with this CNIC already exists`
    });
  }

  existing.name = payload.name;
  existing.cnic = payload.cnic;
  existing.phoneNumber = payload.phoneNumber;
  existing.partyDate = payload.partyDate;
  existing.partyType = payload.partyType;
  existing.updatedBy = req.user._id;
  await existing.save();

  res.json({
    success: true,
    data: serializeParty(existing.toObject()),
    message: 'Party updated successfully'
  });
}));

// DELETE /api/taj-residencia/land-acquisition/parties/:id
router.delete('/parties/:id', asyncHandler(async (req, res) => {
  const item = await LandParty.findOne({ _id: req.params.id, isActive: true });
  if (!item) {
    return res.status(404).json({ success: false, message: 'Party not found' });
  }

  item.isActive = false;
  item.updatedBy = req.user._id;
  await item.save();

  res.json({ success: true, message: 'Party deleted successfully' });
}));

module.exports = router;
