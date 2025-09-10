import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import eventService from '../../../services/eventService';

const EventDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addParticipantDialog, setAddParticipantDialog] = useState(false);
  const [participantData, setParticipantData] = useState({
    participantId: '',
    notes: ''
  });

  const fetchEventDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventResponse, participantsResponse] = await Promise.all([
        eventService.getEvent(id),
        eventService.getEventParticipants(id)
      ]);

      setEvent(eventResponse.data);
      setParticipants(participantsResponse.data || []);
    } catch (err) {
      setError('Failed to fetch event details');
      console.error('Error fetching event details:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEventDetails();
  }, [fetchEventDetails]);

  const handleDelete = async () => {
    try {
      await eventService.deleteEvent(id);
      navigate('/admin/events');
    } catch (err) {
      setError('Failed to delete event');
      console.error('Error deleting event:', err);
    }
  };

  const handleAddParticipant = async () => {
    try {
      await eventService.addParticipant(id, participantData);
      setAddParticipantDialog(false);
      setParticipantData({ participantId: '', notes: '' });
      fetchEventDetails();
    } catch (err) {
      setError('Failed to add participant');
      console.error('Error adding participant:', err);
    }
  };

  const handleUpdateParticipantStatus = async (participantId, status) => {
    try {
      await eventService.updateParticipantStatus(id, participantId, { status });
      fetchEventDetails();
    } catch (err) {
      setError('Failed to update participant status');
      console.error('Error updating participant:', err);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    try {
      await eventService.removeParticipant(id, participantId);
      fetchEventDetails();
    } catch (err) {
      setError('Failed to remove participant');
      console.error('Error removing participant:', err);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Planned': 'default',
      'Confirmed': 'primary',
      'In Progress': 'warning',
      'Completed': 'success',
      'Cancelled': 'error',
      'Invited': 'default',
      'Attended': 'success',
      'Declined': 'error'
    };
    return colors[status] || 'default';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time) => {
    return time || 'N/A';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading event details...</Typography>
      </Box>
    );
  }

  if (!event) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography color="error">Event not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Event Details
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchEventDetails} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/admin/events/${id}/edit`)}
            sx={{ mr: 1 }}
          >
            Edit Event
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
          >
            Delete Event
          </Button>
        </Box>
      </Box>

      {error && (
        <Box mb={3}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Event Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                {event.title}
              </Typography>
              
              <Box display="flex" gap={2} mb={2}>
                <Chip label={event.category} color="primary" variant="outlined" />
                <Chip label={event.status} color={getStatusColor(event.status)} />
              </Box>

              <Typography variant="body1" paragraph>
                {event.description}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Event ID
                  </Typography>
                  <Typography variant="body1">
                    {event.eventId}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(event.eventDate)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Time
                  </Typography>
                  <Typography variant="body1">
                    {formatTime(event.startTime)} - {formatTime(event.endTime)}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Location
                  </Typography>
                  <Typography variant="body1">
                    {event.location}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Organizer
                  </Typography>
                  <Typography variant="body1">
                    {event.organizer?.firstName} {event.organizer?.lastName}
                    {event.organizer?.employeeId && ` (${event.organizer.employeeId})`}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Participants
                  </Typography>
                  <Typography variant="body1">
                    {event.currentParticipants || 0} / {event.maxParticipants || 0}
                  </Typography>
                </Grid>
              </Grid>

              {event.resources && event.resources.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Required Resources
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {event.resources.map((resource, index) => (
                      <Chip key={index} label={resource} size="small" />
                    ))}
                  </Box>
                </>
              )}

              {event.notes && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Notes
                  </Typography>
                  <Typography variant="body1">
                    {event.notes}
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Participants */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Participants ({participants.length})
                </Typography>
                <Button
                  size="small"
                  startIcon={<PersonAddIcon />}
                  onClick={() => setAddParticipantDialog(true)}
                >
                  Add
                </Button>
              </Box>

              {participants.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={2}>
                  No participants yet
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Participant</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {participants.map((participant) => (
                        <TableRow key={participant._id}>
                          <TableCell>
                            <Typography variant="body2">
                              {participant.participantId?.firstName} {participant.participantId?.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {participant.participantId?.employeeId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={participant.status}
                              color={getStatusColor(participant.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box display="flex" gap={1}>
                              <FormControl size="small" sx={{ minWidth: 80 }}>
                                <Select
                                  value={participant.status}
                                  onChange={(e) => handleUpdateParticipantStatus(participant._id, e.target.value)}
                                  size="small"
                                >
                                  <MenuItem value="Invited">Invited</MenuItem>
                                  <MenuItem value="Confirmed">Confirmed</MenuItem>
                                  <MenuItem value="Declined">Declined</MenuItem>
                                  <MenuItem value="Attended">Attended</MenuItem>
                                </Select>
                              </FormControl>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveParticipant(participant._id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add Participant Dialog */}
      <Dialog
        open={addParticipantDialog}
        onClose={() => setAddParticipantDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Participant</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Employee ID"
              value={participantData.participantId}
              onChange={(e) => setParticipantData(prev => ({
                ...prev,
                participantId: e.target.value
              }))}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Notes"
              value={participantData.notes}
              onChange={(e) => setParticipantData(prev => ({
                ...prev,
                notes: e.target.value
              }))}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddParticipantDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddParticipant}
            variant="contained"
            disabled={!participantData.participantId.trim()}
          >
            Add Participant
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventDetails;
