const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const Event = require('../models/hr/Event');
const EventParticipant = require('../models/hr/EventParticipant');
const Employee = require('../models/hr/Employee');

// Apply authentication middleware
router.use(authMiddleware);

// Get all events with optional filters
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      category, 
      status, 
      eventDate, 
      page = 1, 
      limit = 10 
    } = req.query;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) query.category = category;
    if (status) query.status = status;
    if (eventDate) query.eventDate = new Date(eventDate);

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with population
    const events = await Event.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort({ eventDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      data: events,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
});

// Get single event
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({ success: true, data: event });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch event' });
  }
});

// Create new event
router.post('/', permissions.checkPermission('event_create'), async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      createdBy: req.user.id
    };

    const event = new Event(eventData);
    await event.save();

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ success: false, message: 'Failed to create event' });
  }
});

// Update event
router.put('/:id', permissions.checkPermission('event_update'), async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({ success: true, data: event });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ success: false, message: 'Failed to update event' });
  }
});

// Delete event
router.delete('/:id', permissions.checkPermission('event_delete'), async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Also delete all participants
    await EventParticipant.deleteMany({ eventId: req.params.id });

    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ success: false, message: 'Failed to delete event' });
  }
});

// Update event status
router.put('/:id/status', permissions.checkPermission('event_update'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['Planned', 'Confirmed', 'In Progress', 'Completed', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({ success: true, data: event });
  } catch (error) {
    console.error('Error updating event status:', error);
    res.status(500).json({ success: false, message: 'Failed to update event status' });
  }
});

// Get event participants
router.get('/:id/participants', async (req, res) => {
  try {
    const participants = await EventParticipant.find({ eventId: req.params.id })
      .populate('participantId', 'firstName lastName employeeId department position')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: participants });
  } catch (error) {
    console.error('Error fetching event participants:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch participants' });
  }
});

// Add participant to event
router.post('/:id/participants', permissions.checkPermission('event_update'), async (req, res) => {
  try {
    const { participantId, notes } = req.body;

    // Check if participant already exists
    const existingParticipant = await EventParticipant.findOne({
      eventId: req.params.id,
      participantId
    });

    if (existingParticipant) {
      return res.status(400).json({ success: false, message: 'Participant already added' });
    }

    // Check if event exists and get current participant count
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.currentParticipants >= event.maxParticipants) {
      return res.status(400).json({ success: false, message: 'Event is full' });
    }

    const participant = new EventParticipant({
      eventId: req.params.id,
      participantId,
      notes,
      createdBy: req.user.id
    });

    await participant.save();

    // Update event participant count
    await Event.findByIdAndUpdate(req.params.id, {
      $inc: { currentParticipants: 1 }
    });

    // Populate participant data
    await participant.populate('participantId', 'firstName lastName employeeId department position');

    res.status(201).json({ success: true, data: participant });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({ success: false, message: 'Failed to add participant' });
  }
});

// Update participant status
router.put('/:id/participants/:participantId', permissions.checkPermission('event_update'), async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!['Invited', 'Confirmed', 'Declined', 'Attended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const participant = await EventParticipant.findOneAndUpdate(
      { eventId: req.params.id, participantId: req.params.participantId },
      { 
        status, 
        notes,
        responseDate: status !== 'Invited' ? new Date() : undefined
      },
      { new: true }
    ).populate('participantId', 'firstName lastName employeeId department position');

    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }

    res.json({ success: true, data: participant });
  } catch (error) {
    console.error('Error updating participant:', error);
    res.status(500).json({ success: false, message: 'Failed to update participant' });
  }
});

// Remove participant from event
router.delete('/:id/participants/:participantId', permissions.checkPermission('event_update'), async (req, res) => {
  try {
    const participant = await EventParticipant.findOneAndDelete({
      eventId: req.params.id,
      participantId: req.params.participantId
    });

    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }

    // Update event participant count
    await Event.findByIdAndUpdate(req.params.id, {
      $inc: { currentParticipants: -1 }
    });

    res.json({ success: true, message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ success: false, message: 'Failed to remove participant' });
  }
});

module.exports = router;
