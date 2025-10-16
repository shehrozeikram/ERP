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
  Refresh as RefreshIcon,
  Print as PrintIcon
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

  const handlePrint = () => {
    if (!event) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Get the current date and time for the print header
    const printDate = new Date().toLocaleString();
    
    // Create the print content HTML with comprehensive styling
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Event Details - ${event?.title || 'N/A'}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              margin: 15px;
              color: #000;
              line-height: 1.5;
              font-size: 14px;
            }
            .header {
              text-align: center;
              border: 3px solid #000;
              padding: 20px;
              margin-bottom: 25px;
              background-color: #f9f9f9;
            }
            .header h1 {
              margin: 0 0 10px 0;
              color: #000;
              font-size: 24px;
              font-weight: bold;
            }
            .header .subtitle {
              color: #333;
              font-size: 16px;
              margin-bottom: 8px;
              font-weight: bold;
            }
            .print-date {
              color: #666;
              font-size: 12px;
            }
            .section {
              margin-bottom: 25px;
              page-break-inside: avoid;
              border: 1px solid #ccc;
              padding: 15px;
            }
            .section-title {
              background-color: #e0e0e0;
              padding: 10px 15px;
              margin: -15px -15px 15px -15px;
              border-bottom: 2px solid #000;
              font-weight: bold;
              font-size: 16px;
              color: #000;
              text-transform: uppercase;
            }
            .field-row {
              display: flex;
              margin-bottom: 8px;
              border-bottom: 1px dotted #999;
              padding-bottom: 5px;
              min-height: 20px;
            }
            .field-label {
              font-weight: bold;
              min-width: 180px;
              color: #000;
              font-size: 13px;
            }
            .field-value {
              flex: 1;
              color: #000;
              font-size: 13px;
              word-wrap: break-word;
            }
            .status-chip {
              display: inline-block;
              padding: 3px 8px;
              border: 1px solid #000;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              background-color: #f0f0f0;
            }
            .status-upcoming { background-color: #e3f2fd; }
            .status-ongoing { background-color: #fff3cd; }
            .status-completed { background-color: #e8f5e8; }
            .status-cancelled { background-color: #f8d7da; }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 2px solid #000;
              text-align: center;
              color: #333;
              font-size: 11px;
            }
            .important-info {
              background-color: #fff3cd;
              border: 1px solid #ffeaa7;
              padding: 10px;
              margin: 10px 0;
              font-weight: bold;
            }
            .record-id {
              font-family: monospace;
              background-color: #f8f9fa;
              padding: 2px 5px;
              border: 1px solid #ccc;
            }
            .participants-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            .participants-table th, .participants-table td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
              font-size: 12px;
            }
            .participants-table th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>EVENT DETAILS</h1>
            <div class="subtitle">Event: ${event?.title || 'N/A'}</div>
            <div class="print-date">Printed on: ${printDate}</div>
          </div>

          <!-- Event Summary -->
          <div class="section">
            <div class="section-title">📋 Event Summary</div>
            <div class="field-row">
              <div class="field-label">Event ID:</div>
              <div class="field-value"><span class="record-id">${event?._id || 'N/A'}</span></div>
            </div>
            <div class="field-row">
              <div class="field-label">Status:</div>
              <div class="field-value">
                <span class="status-chip status-${event?.status?.toLowerCase() || 'upcoming'}">${event?.status || 'N/A'}</span>
              </div>
            </div>
            <div class="field-row">
              <div class="field-label">Title:</div>
              <div class="field-value">${event?.title || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Type:</div>
              <div class="field-value">${event?.type || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Priority:</div>
              <div class="field-value">${event?.priority || 'N/A'}</div>
            </div>
          </div>

          <!-- Event Details -->
          <div class="section">
            <div class="section-title">📅 Event Details</div>
            <div class="field-row">
              <div class="field-label">Event Date:</div>
              <div class="field-value">${event?.eventDate ? formatDate(event.eventDate) : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Time:</div>
              <div class="field-value">${formatTime(event?.startTime)} - ${formatTime(event?.endTime)}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Location:</div>
              <div class="field-value">${event?.location || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Organizer:</div>
              <div class="field-value">${event?.organizer || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Description:</div>
              <div class="field-value">${event?.description || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Max Participants:</div>
              <div class="field-value">${event?.maxParticipants || 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Budget:</div>
              <div class="field-value">${event?.budget ? `PKR ${event.budget}` : 'N/A'}</div>
            </div>
          </div>

          <!-- Participants -->
          ${participants && participants.length > 0 ? `
          <div class="section">
            <div class="section-title">👥 Participants (${participants.length})</div>
            <table class="participants-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Department</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${participants.map(participant => `
                  <tr>
                    <td>${participant.participantId?.firstName || ''} ${participant.participantId?.lastName || ''}</td>
                    <td>${participant.participantId?.email || 'N/A'}</td>
                    <td>${participant.participantId?.phone || 'N/A'}</td>
                    <td>${participant.participantId?.department || 'N/A'}</td>
                    <td>${participant.notes || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : `
          <div class="section">
            <div class="section-title">👥 Participants</div>
            <div class="field-row">
              <div class="field-label">Participants:</div>
              <div class="field-value">No participants registered</div>
            </div>
          </div>
          `}

          <!-- System Information -->
          <div class="section">
            <div class="section-title">ℹ️ System Information</div>
            <div class="field-row">
              <div class="field-label">Created Date:</div>
              <div class="field-value">${event?.createdAt ? new Date(event.createdAt).toLocaleString() : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Last Updated:</div>
              <div class="field-value">${event?.updatedAt ? new Date(event.updatedAt).toLocaleString() : 'N/A'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Record Version:</div>
              <div class="field-value">${event?.__v || '0'}</div>
            </div>
          </div>

          <!-- Additional Information -->
          <div class="section">
            <div class="section-title">📝 Additional Information</div>
            <div class="important-info">
              This document contains all available information for Event ${event?.title || event?._id || 'N/A'}
            </div>
            <div class="field-row">
              <div class="field-label">Total Fields:</div>
              <div class="field-value">${Object.keys(event || {}).length} data fields</div>
            </div>
            <div class="field-row">
              <div class="field-label">Document Status:</div>
              <div class="field-value">Complete - All available data included</div>
            </div>
          </div>

          <div class="footer">
            <p><strong>Generated from SGC ERP System - Event Management Module</strong></p>
            <p>Event ID: <span class="record-id">${event?._id || 'N/A'}</span> | Printed: ${printDate}</p>
            <p>This is a complete record printout containing all available information</p>
          </div>
        </body>
      </html>
    `;

    // Write the content to the new window
    printWindow.document.write(printContent);
    printWindow.document.close();

    // Wait for content to load, then trigger print
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
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
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ mr: 1 }}
          >
            Print
          </Button>
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
                    {event.organizer || 'N/A'}
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
