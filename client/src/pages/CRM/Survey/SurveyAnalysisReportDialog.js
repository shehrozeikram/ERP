import React, { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
  Chip,
  Autocomplete
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Send as SendIcon
} from '@mui/icons-material';
import surveyService from '../../../services/surveyService';
import api from '../../../services/api';

const SurveyAnalysisReportDialog = ({ open, survey, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  
  const [findings, setFindings] = useState('');
  const [adviceToHigherManagement, setAdviceToHigherManagement] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [notVeryImportant, setNotVeryImportant] = useState('');
  const [attachments, setAttachments] = useState([]);
  
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [targetUsers, setTargetUsers] = useState([]);

  useEffect(() => {
    if (open) {
      surveyService.getAssignableUsers()
        .then(res => setAssignableUsers(res.data?.data || []))
        .catch(err => console.error('Failed to load assignable users', err));
    }
  }, [open]);

  useEffect(() => {
    if (open && survey) {
      if (survey.analysisReport) {
        setFindings(survey.analysisReport.findings || '');
        setAdviceToHigherManagement(survey.analysisReport.adviceToHigherManagement || '');
        setRecommendations(survey.analysisReport.recommendations || '');
        setNotVeryImportant(survey.analysisReport.notVeryImportant || '');
        setAttachments(survey.analysisReport.attachments || []);
      } else {
        setFindings('');
        setAdviceToHigherManagement('');
        setRecommendations('');
        setNotVeryImportant('');
        setAttachments([]);
        setTargetUsers([]);
      }
      setError('');
    }
  }, [open, survey]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await surveyService.uploadAnalysisAttachment(survey._id, formData);
      setAttachments(prev => [...prev, { name: res.data.name, url: res.data.url }]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  const removeAttachment = (indexToRemove) => {
    setAttachments(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleSave = async (isSend = false) => {
    if (isSend) {
      if (!window.confirm('Are you sure you want to send this report to higher management? They will be able to review it on their dashboard.')) {
        return;
      }
      setSending(true);
    } else {
      setSaving(true);
    }
    setError('');

    const payload = {
      findings,
      adviceToHigherManagement,
      recommendations,
      notVeryImportant,
      attachments
    };

    try {
      await surveyService.saveAnalysisReport(survey._id, payload);
      if (isSend) {
        await surveyService.sendAnalysisReport(survey._id, { targetUsers: targetUsers.map(u => u._id) });
      }
      onSaved(isSend);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save analysis report');
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const isSent = survey?.analysisReport?.isSentToManagement;

  const userLabel = (user) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email;
  };

  const getFullUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api$/, '') : '';
    return `${baseUrl}${url}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight={700}>
            Survey Analysis Report
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Survey: <strong>{survey?.title}</strong>
              {isSent && (
                <Chip 
                  size="small" 
                  color="success" 
                  label="Sent to Higher Management" 
                  sx={{ ml: 2, fontWeight: 700 }} 
                />
              )}
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Findings"
            multiline
            minRows={3}
            maxRows={6}
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            disabled={isSent || saving || sending}
            fullWidth
            placeholder="Summarize the main findings from the survey responses..."
          />

          <TextField
            label="Advice to Higher Management"
            multiline
            minRows={3}
            maxRows={6}
            value={adviceToHigherManagement}
            onChange={(e) => setAdviceToHigherManagement(e.target.value)}
            disabled={isSent || saving || sending}
            fullWidth
            placeholder="Provide your advice to higher management..."
          />

          <TextField
            label="Recommendations"
            multiline
            minRows={3}
            maxRows={6}
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            disabled={isSent || saving || sending}
            fullWidth
            placeholder="List actionable recommendations..."
          />

          <TextField
            label="Not Very Important"
            multiline
            minRows={2}
            maxRows={4}
            value={notVeryImportant}
            onChange={(e) => setNotVeryImportant(e.target.value)}
            disabled={isSent || saving || sending}
            fullWidth
            placeholder="List minor details or low-priority observations..."
          />

          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Attachments / Reports</Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
              {attachments.map((att, idx) => (
                <Chip
                  key={idx}
                  label={att.name || 'Attachment'}
                  onDelete={isSent ? undefined : () => removeAttachment(idx)}
                  deleteIcon={<DeleteIcon />}
                  component="a"
                  href={getFullUrl(att.url)}
                  target="_blank"
                  clickable
                  variant="outlined"
                  color="primary"
                />
              ))}
            </Stack>

            {!isSent && (
              <Button
                variant="outlined"
                component="label"
                startIcon={loading ? <CircularProgress size={16} /> : <AttachFileIcon />}
                disabled={loading || saving || sending}
                size="small"
              >
                Upload File
                <input type="file" hidden onChange={handleFileUpload} />
              </Button>
            )}
          </Box>

          {!isSent && (
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Send To (Higher Management)</Typography>
              <Autocomplete
                multiple
                options={assignableUsers}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                getOptionLabel={userLabel}
                value={targetUsers}
                onChange={(_, value) => setTargetUsers(value)}
                disabled={saving || sending}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option._id}
                      label={userLabel(option)}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search users to assign this report..."
                  />
                )}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={saving || sending}>
          {isSent ? 'Close' : 'Cancel'}
        </Button>
        
        {!isSent && (
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={() => handleSave(false)}
              disabled={saving || sending}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SendIcon />}
              onClick={() => handleSave(true)}
              disabled={saving || sending || targetUsers.length === 0}
            >
              {sending ? 'Sending...' : 'Send to Higher Management'}
            </Button>
          </Stack>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SurveyAnalysisReportDialog;
