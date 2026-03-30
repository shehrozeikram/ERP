import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  alpha,
  useTheme,
  Avatar,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  AccountBalance as AccountBalanceIcon,
  Business as BusinessIcon,
  Undo as ReverseIcon,
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  AttachFile as AttachIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon,
  InsertDriveFile as FileIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';

const JournalEntriesList = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const fileInputRef = useRef(null);
  
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  // Attachment dialog state
  const [attachDlg, setAttachDlg] = useState({ open: false, entry: null, uploading: false });
  const [attachError, setAttachError] = useState('');

  const openAttachDlg = (entry) => { setAttachDlg({ open: true, entry, uploading: false }); setAttachError(''); };
  const closeAttachDlg = () => setAttachDlg({ open: false, entry: null, uploading: false });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachDlg(d => ({ ...d, uploading: true }));
    setAttachError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/finance/journal-entries/${attachDlg.entry._id}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const updated = { ...attachDlg.entry, attachments: [...(attachDlg.entry.attachments || []), res.data.data] };
      setAttachDlg(d => ({ ...d, entry: updated, uploading: false }));
      setEntries(prev => prev.map(en => en._id === updated._id ? { ...en, attachments: updated.attachments } : en));
    } catch (err) {
      setAttachError(err.response?.data?.message || 'Upload failed');
      setAttachDlg(d => ({ ...d, uploading: false }));
    }
    e.target.value = '';
  };

  const handleDeleteAttachment = async (filename) => {
    if (!window.confirm('Delete this attachment?')) return;
    try {
      await api.delete(`/finance/journal-entries/${attachDlg.entry._id}/attachments/${filename}`);
      const updated = { ...attachDlg.entry, attachments: attachDlg.entry.attachments.filter(a => a.filename !== filename) };
      setAttachDlg(d => ({ ...d, entry: updated }));
      setEntries(prev => prev.map(en => en._id === updated._id ? { ...en, attachments: updated.attachments } : en));
    } catch (err) {
      setAttachError(err.response?.data?.message || 'Delete failed');
    }
  };

  useEffect(() => {
    fetchJournalEntries();
  }, []);

  const fetchJournalEntries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('limit', '100');
      params.append('page', '1');
      const response = await api.get(`/finance/journal-entries?${params}`);
      if (response.data.success) {
        setEntries(response.data.data.entries || []);
        setPagination(response.data.data.pagination || {});
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      setError('Failed to fetch journal entries');
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentIcon = (department) => {
    const iconMap = {
      'hr': <PeopleIcon />,
      'admin': <AdminIcon />,
      'procurement': <ShoppingCartIcon />,
      'sales': <BusinessIcon />,
      'finance': <AccountBalanceIcon />,
      'audit': <SecurityIcon />,
      'general': <AccountBalanceIcon />
    };
    return iconMap[department] || <AccountBalanceIcon />;
  };

  const getDepartmentColor = (department) => {
    const colorMap = {
      'hr': 'primary',
      'admin': 'secondary',
      'procurement': 'warning',
      'sales': 'success',
      'finance': 'info',
      'audit': 'error',
      'general': 'default'
    };
    return colorMap[department] || 'default';
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'draft': 'warning',
      'posted': 'success',
      'reversed': 'error',
      'cancelled': 'default'
    };
    return colorMap[status] || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading Journal Entries...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
              <AccountBalanceIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                Journal Entries
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Manage all journal entries and accounting transactions
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/finance/journal-entries/new')}
          >
            New Entry
          </Button>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Entries
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                {pagination.totalCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Posted Entries
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                {entries.filter(entry => entry.status === 'posted').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Draft Entries
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                {entries.filter(entry => entry.status === 'draft').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Journal Entries Table */}
      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Entry Number</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Module</TableCell>
                  <TableCell align="right">Total Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry._id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(entry.date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {entry.entryNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200 }}>
                        {entry.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={entry.department?.toUpperCase() || 'GENERAL'} 
                        size="small" 
                        color={getDepartmentColor(entry.department)}
                        icon={getDepartmentIcon(entry.department)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {entry.module?.toUpperCase() || 'GENERAL'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatPKR(entry.totalDebits)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={entry.status?.toUpperCase() || 'DRAFT'} 
                        size="small" 
                        color={getStatusColor(entry.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            onClick={() => navigate(`/finance/journal-entries/${entry._id}`)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Entry">
                          <IconButton 
                            size="small" 
                            onClick={() => navigate(`/finance/journal-entries/${entry._id}/edit`)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        {entry.status === 'posted' && !entry.isReversed && (
                          <Tooltip title="Reverse Entry">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={async () => {
                                const reason = window.prompt('Reason for reversal (optional):');
                                if (reason === null) return;
                                try {
                                  await import('../../services/api').then(m =>
                                    m.default.post(`/finance/journal-entries/${entry._id}/reverse`, { reason })
                                  );
                                  window.location.reload();
                                } catch (e) {
                                  alert(e.response?.data?.message || 'Reversal failed');
                                }
                              }}
                            >
                              <ReverseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {entry.isReversed && (
                          <Chip label="Reversed" size="small" color="error" variant="outlined" sx={{ fontSize: 10 }} />
                        )}
                        <Tooltip title={`Attachments (${(entry.attachments || []).length})`}>
                          <IconButton size="small" color={(entry.attachments || []).length > 0 ? 'primary' : 'default'}
                            onClick={() => openAttachDlg(entry)}>
                            <AttachIcon fontSize="small" />
                            {(entry.attachments || []).length > 0 && (
                              <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700, ml: 0.2 }}>
                                {entry.attachments.length}
                              </Typography>
                            )}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {entries.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="textSecondary">
                No journal entries found
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Create your first journal entry to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/finance/journal-entries/new')}
              >
                Create First Entry
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ── Attachment Dialog ── */}
      <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload}
        accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx,.txt" />

      <Dialog open={attachDlg.open} onClose={closeAttachDlg} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <AttachIcon color="primary" />
            <Typography fontWeight={700}>Attachments — {attachDlg.entry?.entryNumber}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {attachError && <Alert severity="error" onClose={() => setAttachError('')} sx={{ mb: 1 }}>{attachError}</Alert>}

          {(attachDlg.entry?.attachments || []).length === 0 && (
            <Box textAlign="center" py={3} color="text.disabled">
              <AttachIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
              <Typography variant="body2">No attachments yet. Upload a bank slip, voucher, or supporting document.</Typography>
            </Box>
          )}

          <List dense>
            {(attachDlg.entry?.attachments || []).map((a, i) => (
              <ListItem key={i} divider sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                <FileIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                <ListItemText
                  primary={<Typography variant="body2" fontWeight={600}>{a.originalName || a.filename}</Typography>}
                  secondary={a.uploadedAt ? new Date(a.uploadedAt).toLocaleDateString('en-PK') : ''}
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Download">
                    <IconButton size="small" component="a"
                      href={`${api.defaults.baseURL?.replace('/api', '') || ''}/uploads/finance/${a.filename}`}
                      target="_blank" download={a.originalName}>
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDeleteAttachment(a.filename)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 2 }}>
          <Button
            variant="outlined" startIcon={attachDlg.uploading ? <CircularProgress size={16} /> : <UploadIcon />}
            onClick={() => fileInputRef.current?.click()} disabled={attachDlg.uploading}
          >
            {attachDlg.uploading ? 'Uploading…' : 'Upload File'}
          </Button>
          <Button onClick={closeAttachDlg}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default JournalEntriesList;
