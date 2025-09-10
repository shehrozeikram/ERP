import api from './api';

const eventService = {
  // Get all events with optional filters
  getEvents: async (params = {}) => {
    const response = await api.get('/events', { params });
    return response.data;
  },

  // Get single event
  getEvent: async (id) => {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },

  // Create new event
  createEvent: async (eventData) => {
    const response = await api.post('/events', eventData);
    return response.data;
  },

  // Update event
  updateEvent: async (id, eventData) => {
    const response = await api.put(`/events/${id}`, eventData);
    return response.data;
  },

  // Delete event
  deleteEvent: async (id) => {
    const response = await api.delete(`/events/${id}`);
    return response.data;
  },

  // Update event status
  updateEventStatus: async (id, status) => {
    const response = await api.put(`/events/${id}/status`, { status });
    return response.data;
  },

  // Get event participants
  getEventParticipants: async (eventId) => {
    const response = await api.get(`/events/${eventId}/participants`);
    return response.data;
  },

  // Add participant to event
  addParticipant: async (eventId, participantData) => {
    const response = await api.post(`/events/${eventId}/participants`, participantData);
    return response.data;
  },

  // Update participant status
  updateParticipantStatus: async (eventId, participantId, statusData) => {
    const response = await api.put(`/events/${eventId}/participants/${participantId}`, statusData);
    return response.data;
  },

  // Remove participant from event
  removeParticipant: async (eventId, participantId) => {
    const response = await api.delete(`/events/${eventId}/participants/${participantId}`);
    return response.data;
  }
};

export default eventService;
