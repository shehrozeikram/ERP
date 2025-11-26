import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Stack,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  History as HistoryIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  FileDownload as FileDownloadIcon,
  QrCode as QrCodeIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import documentTrackingService, { getQRCodeUrl, downloadQRCode, exportToCSV } from '../../services/documentTrackingService';
import evaluationTrackingService from '../../services/evaluationTrackingService';
import MovementDialog from '../../components/DocumentTracking/MovementDialog';

// Status color mapping
const getStatusColor = (status) => {
  const colors = {
    'Registered': 'default',
    'In Review': 'info',
    'In Approval': 'warning',
    'Sent': 'primary',
    'Completed': 'success',
    'Archived': 'secondary',
    'Missing': 'error'
  };
  return colors[status] || 'default';
};

const getEvaluationStatusColor = (status) => {
  const colors = {
    sent: 'primary',
    submitted: 'info',
    in_approval: 'warning',
    approved: 'success',
    rejected: 'error',
    completed: 'success'
  };
  return colors[status] || 'default';
};

// Priority color mapping
const getPriorityColor = (priority) => {
  const colors = {
    'Low': 'default',
    'Medium': 'info',
    'High': 'warning',
    'Urgent': 'error'
  };
  return colors[priority] || 'default';
};

const DocumentsTracking = () => {
  const { users = [], departments = [] } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [timelineDialogOpen, setTimelineDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [editingDocument, setEditingDocument] = useState(null);
  const [movementLoading, setMovementLoading] = useState(false);
  const [evaluationDocs, setEvaluationDocs] = useState([]);
  const [evaluationLoading, setEvaluationLoading] = useState(true);
  const [evaluationError, setEvaluationError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    type: '',
    owner: '',
    status: 'Registered',
    priority: 'Medium',
    physicalLocation: {
      building: '',
      floor: '',
      room: '',
      shelf: '',
      cabinet: '',
      notes: ''
    },
    description: '',
    tags: [],
    dueDate: ''
  });

  // Load documents
  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const filters = {
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        department: departmentFilter || undefined
      };
      const response = await documentTrackingService.getDocuments(filters);
      setDocuments(response.data || []);
      setTotalItems(response.pagination?.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load documents');
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, statusFilter, categoryFilter, departmentFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const loadEvaluationDocs = async () => {
      try {
        setEvaluationLoading(true);
        setEvaluationError('');
        const response = await evaluationTrackingService.getAll();
        setEvaluationDocs(response.data || []);
      } catch (err) {
        setEvaluationError('Failed to load evaluation documents');
      } finally {
        setEvaluationLoading(false);
      }
    };

    loadEvaluationDocs();
  }, []);

  // Get unique categories from documents
  const categories = useMemo(() => {
    const cats = new Set();
    documents.forEach(doc => {
      if (doc.category) cats.add(doc.category);
    });
    return Array.from(cats).sort();
  }, [documents]);

  // Handle dialog open/close
  const handleOpenDialog = (document = null) => {
    if (document) {
      setEditingDocument(document);
      setFormData({
        name: document.name || '',
        category: document.category || '',
        type: document.type || '',
        owner: document.owner?._id || document.owner || '',
        status: document.status || 'Registered',
        priority: document.priority || 'Medium',
        physicalLocation: {
          building: document.physicalLocation?.building || '',
          floor: document.physicalLocation?.floor || '',
          room: document.physicalLocation?.room || '',
          shelf: document.physicalLocation?.shelf || '',
          cabinet: document.physicalLocation?.cabinet || '',
          notes: document.physicalLocation?.notes || ''
        },
        description: document.description || '',
        tags: document.tags || [],
        dueDate: document.dueDate ? dayjs(document.dueDate).format('YYYY-MM-DD') : ''
      });
    } else {
      setEditingDocument(null);
      setFormData({
        name: '',
        category: '',
        type: '',
        owner: '',
        status: 'Registered',
        priority: 'Medium',
        physicalLocation: {
          building: '',
          floor: '',
          room: '',
          shelf: '',
          cabinet: '',
          notes: ''
        },
        description: '',
        tags: [],
        dueDate: ''
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDocument(null);
  };

  const handleOpenViewDialog = async (document) => {
    try {
      const response = await documentTrackingService.getDocument(document._id);
      setSelectedDocument(response.data);
      setViewDialogOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load document details');
    }
  };

  const handleOpenTimelineDialog = async (document) => {
    try {
      const response = await documentTrackingService.getDocumentTimeline(document._id);
      setSelectedDocument(response.data);
      setTimelineDialogOpen(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load timeline');
    }
  };

  // Handle form submit
  const handleSubmit = async () => {
    try {
      setError('');
      const submitData = {
        ...formData,
        dueDate: formData.dueDate || undefined
      };

      if (editingDocument) {
        await documentTrackingService.updateDocument(editingDocument._id, submitData);
        setSuccess('Document updated successfully');
      } else {
        await documentTrackingService.createDocument(submitData);
        setSuccess('Document created successfully');
      }

      handleCloseDialog();
      loadDocuments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save document');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      setError('');
      await documentTrackingService.deleteDocument(selectedDocument._id);
      setSuccess('Document deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedDocument(null);
      loadDocuments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete document');
    }
  };

  // Handle movement
  const handleOpenMovementDialog = (document) => {
    setSelectedDocument(document);
    setMovementDialogOpen(true);
  };

  const handleCloseMovementDialog = () => {
    setMovementDialogOpen(false);
    setSelectedDocument(null);
  };

  const handleMoveDocument = async (movementData) => {
    try {
      setMovementLoading(true);
      setError('');
      await documentTrackingService.moveDocument(selectedDocument._id, movementData);
      setSuccess('Document moved successfully');
      setMovementDialogOpen(false);
      setSelectedDocument(null);
      loadDocuments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to move document');
    } finally {
      setMovementLoading(false);
    }
  };

  // Handle receive/acknowledge
  const handleAcknowledgeReceipt = async (document) => {
    try {
      setError('');
      await documentTrackingService.acknowledgeReceipt(document._id);
      setSuccess('Document receipt acknowledged');
      loadDocuments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to acknowledge receipt');
    }
  };

  // Check if current user is the holder
  const isCurrentHolder = (document) => {
    return document.currentHolder?.user?._id === currentUser?.id || 
           document.currentHolder?.user === currentUser?.id;
  };

  // Handle export to CSV
  const handleExportCSV = async () => {
    try {
      setError('');
      const filters = {
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        department: departmentFilter || undefined
      };
      const blob = await exportToCSV(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `documents-${dayjs().format('YYYY-MM-DD')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccess('Documents exported successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export documents');
    }
  };

  // Handle QR code download
  const handleDownloadQRCode = async (document) => {
    try {
      setError('');
      const blob = await downloadQRCode(document._id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-${document.trackingId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccess('QR code downloaded successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download QR code');
    }
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '—';
    return dayjs(date).format('DD-MMM-YYYY');
  };

  // Format physical location
  const formatLocation = (location) => {
    if (!location) return '—';
    const parts = [];
    if (location.building) parts.push(`Bldg: ${location.building}`);
    if (location.floor) parts.push(`Floor: ${location.floor}`);
    if (location.room) parts.push(`Room: ${location.room}`);
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Documents Tracking
          </Typography>
          <Typography color="text.secondary">
            Manage and track document movements across departments
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadDocuments} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button 
            variant="outlined" 
            startIcon={<FileDownloadIcon />} 
            onClick={handleExportCSV}
            disabled={loading}
          >
            Export CSV
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            New Document
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="Registered">Registered</MenuItem>
                <MenuItem value="In Review">In Review</MenuItem>
                <MenuItem value="In Approval">In Approval</MenuItem>
                <MenuItem value="Sent">Sent</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Archived">Archived</MenuItem>
                <MenuItem value="Missing">Missing</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {categories.map(cat => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Department</InputLabel>
              <Select
                value={departmentFilter}
                label="Department"
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="">All</MenuItem>
                {departments.map(dept => (
                  <MenuItem key={dept._id} value={dept._id}>{dept.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setCategoryFilter('');
                setDepartmentFilter('');
                setPage(0);
              }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Evaluation & Appraisal Docs preview */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
          <Box>
            <Typography variant="h6">
              Evaluation & Appraisal Documents
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Live documents currently moving through Evaluation & Appraisal workflow.
            </Typography>
          </Box>
          <Button variant="outlined" onClick={() => navigate('/documents-tracking/evaluation')}>
            View All
          </Button>
        </Stack>
        {evaluationError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setEvaluationError('')}>
            {evaluationError}
          </Alert>
        )}
        {evaluationLoading ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : evaluationDocs.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3 }} align="center">
            No evaluation documents found
          </Typography>
        ) : (
          <TableContainer sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Current Holder</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {evaluationDocs.slice(0, 5).map((doc) => (
                  <TableRow key={doc._id}>
                    <TableCell>
                      <Typography fontWeight={600}>{doc.employeeName || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.formType === 'blue_collar' ? 'Blue Collar' : 'White Collar'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={getEvaluationStatusColor(doc.status)}
                        label={doc.status?.replace('_', ' ').toUpperCase()}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {doc.currentHolder?.name || 'System'}
                      </Typography>
                      {doc.currentHolder?.designation && (
                        <Typography variant="caption" color="text.secondary">{doc.currentHolder.designation}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {dayjs(doc.updatedAt).format('DD MMM YYYY')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Documents Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tracking ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Current Holder</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    <Typography color="text.secondary">No documents found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc._id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {doc.trackingId}
                      </Typography>
                    </TableCell>
                    <TableCell>{doc.name}</TableCell>
                    <TableCell>{doc.category}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell>
                      <Chip
                        label={doc.status}
                        size="small"
                        color={getStatusColor(doc.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={doc.priority}
                        size="small"
                        color={getPriorityColor(doc.priority)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {doc.owner?.firstName} {doc.owner?.lastName}
                    </TableCell>
                    <TableCell>
                      {doc.currentHolder?.user?.firstName} {doc.currentHolder?.user?.lastName}
                      {doc.currentHolder?.department && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {doc.currentHolder.department.name}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatLocation(doc.physicalLocation)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {formatDate(doc.dueDate)}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="View">
                          <IconButton size="small" onClick={() => handleOpenViewDialog(doc)}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Timeline">
                          <IconButton size="small" onClick={() => handleOpenTimelineDialog(doc)}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {isCurrentHolder(doc) && (
                          <Tooltip title="Acknowledge Receipt">
                            <IconButton 
                              size="small" 
                              color="success"
                              onClick={() => handleAcknowledgeReceipt(doc)}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Send Document">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => handleOpenMovementDialog(doc)}
                          >
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenDialog(doc)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalItems}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingDocument ? 'Edit Document' : 'New Document'}
          <IconButton
            onClick={handleCloseDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Document Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth required>
                <InputLabel>Owner</InputLabel>
                <Select
                  value={formData.owner}
                  label="Owner"
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                >
                  {users.map(user => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.firstName} {user.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <MenuItem value="Registered">Registered</MenuItem>
                  <MenuItem value="In Review">In Review</MenuItem>
                  <MenuItem value="In Approval">In Approval</MenuItem>
                  <MenuItem value="Sent">Sent</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                  <MenuItem value="Archived">Archived</MenuItem>
                  <MenuItem value="Missing">Missing</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  label="Priority"
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Due Date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>Physical Location</Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Building"
                value={formData.physicalLocation.building}
                onChange={(e) => setFormData({
                  ...formData,
                  physicalLocation: { ...formData.physicalLocation, building: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Floor"
                value={formData.physicalLocation.floor}
                onChange={(e) => setFormData({
                  ...formData,
                  physicalLocation: { ...formData.physicalLocation, floor: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Room"
                value={formData.physicalLocation.room}
                onChange={(e) => setFormData({
                  ...formData,
                  physicalLocation: { ...formData.physicalLocation, room: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Shelf"
                value={formData.physicalLocation.shelf}
                onChange={(e) => setFormData({
                  ...formData,
                  physicalLocation: { ...formData.physicalLocation, shelf: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Cabinet"
                value={formData.physicalLocation.cabinet}
                onChange={(e) => setFormData({
                  ...formData,
                  physicalLocation: { ...formData.physicalLocation, cabinet: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Location Notes"
                value={formData.physicalLocation.notes}
                onChange={(e) => setFormData({
                  ...formData,
                  physicalLocation: { ...formData.physicalLocation, notes: e.target.value }
                })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingDocument ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Document Details
          <IconButton
            onClick={() => setViewDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedDocument && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                  Basic Information
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">Tracking ID</Typography>
                <Typography variant="body1" fontWeight={600}>{selectedDocument.trackingId}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">Name</Typography>
                <Typography variant="body1">{selectedDocument.name}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Category</Typography>
                <Typography variant="body1">{selectedDocument.category}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Type</Typography>
                <Typography variant="body1">{selectedDocument.type}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Chip label={selectedDocument.status} size="small" color={getStatusColor(selectedDocument.status)} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Priority</Typography>
                <Chip label={selectedDocument.priority} size="small" color={getPriorityColor(selectedDocument.priority)} variant="outlined" />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary">Due Date</Typography>
                <Typography variant="body1">{formatDate(selectedDocument.dueDate)}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Description</Typography>
                <Typography variant="body1">{selectedDocument.description || '—'}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mt: 2 }}>
                  Ownership & Location
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">Owner</Typography>
                <Typography variant="body1">
                  {selectedDocument.owner?.firstName} {selectedDocument.owner?.lastName}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="caption" color="text.secondary">Current Holder</Typography>
                <Typography variant="body1">
                  {selectedDocument.currentHolder?.user?.firstName} {selectedDocument.currentHolder?.user?.lastName}
                </Typography>
                {selectedDocument.currentHolder?.department && (
                  <Typography variant="caption" color="text.secondary">
                    {selectedDocument.currentHolder.department.name}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">Physical Location</Typography>
                <Typography variant="body1">
                  {selectedDocument.physicalLocation?.building && `Building: ${selectedDocument.physicalLocation.building}`}
                  {selectedDocument.physicalLocation?.floor && `, Floor: ${selectedDocument.physicalLocation.floor}`}
                  {selectedDocument.physicalLocation?.room && `, Room: ${selectedDocument.physicalLocation.room}`}
                  {selectedDocument.physicalLocation?.shelf && `, Shelf: ${selectedDocument.physicalLocation.shelf}`}
                  {selectedDocument.physicalLocation?.cabinet && `, Cabinet: ${selectedDocument.physicalLocation.cabinet}`}
                  {!selectedDocument.physicalLocation?.building && '—'}
                </Typography>
                {selectedDocument.physicalLocation?.notes && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    {selectedDocument.physicalLocation.notes}
                  </Typography>
                )}
              </Grid>
              {selectedDocument.trackingId && (
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      QR Code
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                      <Box
                        component="img"
                        src={getQRCodeUrl(selectedDocument._id)}
                        alt="QR Code"
                        sx={{ 
                          width: 200, 
                          height: 200, 
                          border: 1, 
                          borderColor: 'divider',
                          p: 1,
                          bgcolor: 'white'
                        }}
                      />
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Scan to view document details
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() => handleDownloadQRCode(selectedDocument)}
                          sx={{ mt: 1 }}
                        >
                          Download QR Code
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          {selectedDocument && (
            <>
              {selectedDocument.trackingId && (
                <Button
                  variant="outlined"
                  startIcon={<QrCodeIcon />}
                  onClick={() => handleDownloadQRCode(selectedDocument)}
                >
                  Download QR
                </Button>
              )}
              <Button variant="contained" onClick={() => {
                setViewDialogOpen(false);
                handleOpenDialog(selectedDocument);
              }}>
                Edit
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Timeline Dialog */}
      <Dialog open={timelineDialogOpen} onClose={() => setTimelineDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Document Timeline
          <IconButton
            onClick={() => setTimelineDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedDocument && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedDocument.document?.name || selectedDocument.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
                Tracking ID: {selectedDocument.document?.trackingId || selectedDocument.trackingId}
              </Typography>
              {selectedDocument.movements && selectedDocument.movements.length > 0 ? (
                <Box>
                  {selectedDocument.movements.map((movement, index) => (
                    <Box key={movement._id} sx={{ mb: 3, pb: 2, borderBottom: index < selectedDocument.movements.length - 1 ? 1 : 0, borderColor: 'divider' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            {movement.movementType}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            From: {movement.fromUser?.firstName} {movement.fromUser?.lastName}
                            {movement.fromDepartment && ` (${movement.fromDepartment.name})`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            To: {movement.toUser?.firstName} {movement.toUser?.lastName}
                            {movement.toDepartment && ` (${movement.toDepartment.name})`}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <strong>Reason:</strong> {movement.reason}
                          </Typography>
                          {movement.comments && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {movement.comments}
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Chip label={movement.statusBefore} size="small" variant="outlined" />
                            <Typography variant="body2">→</Typography>
                            <Chip label={movement.statusAfter} size="small" color={getStatusColor(movement.statusAfter)} />
                          </Stack>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(movement.timestamp)}
                          </Typography>
                          {movement.acknowledgedAt && (
                            <Typography variant="caption" color="success.main" display="block">
                              Acknowledged: {formatDate(movement.acknowledgedAt)}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography color="text.secondary">No movement history available</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimelineDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Document</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedDocument?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Movement Dialog */}
      <MovementDialog
        open={movementDialogOpen}
        onClose={handleCloseMovementDialog}
        onSubmit={handleMoveDocument}
        document={selectedDocument}
        users={users}
        departments={departments}
        loading={movementLoading}
        error={error}
      />
    </Box>
  );
};

export default DocumentsTracking;

