import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  CircularProgress,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Badge,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  SvgIcon
} from '@mui/material';
import { TaskAlt as TaskIcon, Search as SearchIcon, Call as CallIcon, ChatBubbleOutline as ChatIcon, Close as CloseIcon, AttachFile as AttachFileIcon, Send as SendIcon, Done as DoneIcon, DoneAll as DoneAllIcon, Mic as MicIcon, Stop as StopIcon, InfoOutlined as FeedbackIcon } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';
import {
  fetchMyRecoveryTasks,
  fetchRecoveryAssignmentStats,
  updateRecoveryAssignmentFeedback,
  sendRecoveryWhatsApp,
  uploadWhatsAppMedia,
  fetchWhatsAppIncomingMessages,
  fetchWhatsAppNumbersWithMessages,
  markRecoveryWhatsAppRead,
  completeRecoveryTask
} from '../../../services/recoveryAssignmentService';
import { fetchRecoveryCampaigns } from '../../../services/recoveryCampaignService';
import { fetchRecoveryTasks } from '../../../services/recoveryTaskService';
import { useAuth } from '../../../contexts/AuthContext';

function WhatsAppIcon(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </SvgIcon>
  );
}

const formatCurrency = (val) => {
  const n = Number(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0 });
};

const formatDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ASSIGNED_ACTION_LABELS = { whatsapp: 'WhatsApp message', call: 'Call', both: 'Both' };

function normalizeWhatsAppNumber(mobile) {
  if (!mobile) return '';
  let n = String(mobile).replace(/\D/g, '').trim();
  if (n.startsWith('0')) n = n.slice(1);
  if (n.length === 10 && n.startsWith('3')) n = '92' + n;
  else if (n.length === 10) n = '92' + n;
  return n || '';
}

const MyTasks = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sectors: [], statuses: [] });
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dueSort, setDueSort] = useState('desc'); // desc = high to low currentlyDue
  const [notRecoveryMember, setNotRecoveryMember] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const [campaigns, setCampaigns] = useState([]);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappRow, setWhatsappRow] = useState(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackRow, setFeedbackRow] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({ callFeedback: '' });
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackViewOpen, setFeedbackViewOpen] = useState(false);
  const [feedbackViewRow, setFeedbackViewRow] = useState(null);
  const [sendingViaApi, setSendingViaApi] = useState(false);
  const [repliesDialogOpen, setRepliesDialogOpen] = useState(false);
  const [repliesRow, setRepliesRow] = useState(null);
  const [repliesMessages, setRepliesMessages] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [numbersWithMessages, setNumbersWithMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [replyText, setReplyText] = useState('');
  const [replyAttachment, setReplyAttachment] = useState(null);
  const replyFileInputRef = React.useRef(null);
  const [replySending, setReplySending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const recordingTimerRef = React.useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const unreadFilter = (searchParams.get('unread') === 'true' || searchParams.get('unread') === '1') ? 'unread' : 'all';
  const [completingId, setCompletingId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [searchDebounced, sectorFilter, statusFilter, unreadFilter, selectedTaskId, dueSort]
  });

  const loadMyTasks = useCallback(async () => {
    try {
      setLoading(true);
      setNotRecoveryMember(false);
      const taskFilter = tasks.find((t) => t._id === selectedTaskId) || null;
      // Time-bound task filter runs client-side; fetch one wide page when a task is selected.
      const apiParams = taskFilter
        ? { page: 1, limit: 200 }
        : pagination.getApiParams();
      const params = {
        ...apiParams,
        ...(searchDebounced.trim() && { search: searchDebounced.trim() }),
        ...(sectorFilter && { sector: sectorFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(unreadFilter === 'unread' && { unread: 'true' }),
        ...(dueSort && { dueSort })
      };
      const res = await fetchMyRecoveryTasks(params);
      const data = res.data?.data || [];
      const pag = res.data?.pagination || {};
      let rows = Array.isArray(data) ? data : [];

      // Apply time-bound task filter client-side
      if (taskFilter) {
        const t = taskFilter;
        const start = t.startDate ? new Date(t.startDate) : null;
        const end = t.endDate ? new Date(t.endDate) : null;

        rows = rows.filter((row) => {
          // Scope filter
          if (t.scopeType === 'sector') {
            if (t.sector && row.sector !== t.sector) return false;
          } else if (t.scopeType === 'slab') {
            const due = Number(row.currentlyDue) || 0;
            const min = Number(t.minAmount) || 0;
            const max = t.maxAmount != null ? Number(t.maxAmount) : null;
            if (!(due >= min && (max == null || due < max))) return false;
            if (t.sector && row.sector !== t.sector) return false;
          }

          // Date filter (by assignment createdAt)
          if (start || end) {
            const created = row.createdAt ? new Date(row.createdAt) : null;
            if (!created || isNaN(created.getTime())) return false;
            if (start && created < start) return false;
            if (end && created > end) return false;
          }

          return true;
        });
      }

      setRecords(rows);
      pagination.setTotal(taskFilter ? rows.length : pag.total || 0);
      if (res.data?.notRecoveryMember) setNotRecoveryMember(true);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to load your tasks',
        severity: 'error'
      });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pagination object is new each render; use page/rowsPerPage only to avoid infinite loop
  }, [searchDebounced, sectorFilter, statusFilter, unreadFilter, selectedTaskId, dueSort, tasks, pagination.page, pagination.rowsPerPage]);

  const loadNumbersWithMessages = useCallback(async () => {
    try {
      const res = await fetchWhatsAppNumbersWithMessages();
      const d = res?.data?.data || {};
      setNumbersWithMessages(Array.isArray(d.numbers) ? d.numbers : d.numbers || []);
      setUnreadCounts(typeof d.unreadCounts === 'object' ? d.unreadCounts : {});
    } catch {
      setNumbersWithMessages([]);
      setUnreadCounts({});
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchRecoveryAssignmentStats();
      const d = res.data?.data || {};
      setStats({ sectors: d.sectors || [], statuses: d.statuses || [] });
    } catch {
      setStats({ sectors: [], statuses: [] });
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetchRecoveryCampaigns({ activeOnly: 'true' });
      setCampaigns(res.data?.data || []);
    } catch {
      setCampaigns([]);
    }
  }, []);

  useEffect(() => {
    loadMyTasks();
  }, [loadMyTasks]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadNumbersWithMessages();
  }, [loadNumbersWithMessages]);

  // Load time-bound tasks for the current recovery member (used as a filter)
  const loadTasks = useCallback(async () => {
    try {
      // Fetch all tasks; filter client-side to current user's member
      const res = await fetchRecoveryTasks();
      const all = res.data?.data || [];
      if (!user?.employeeId) {
        setTasks(all);
        return;
      }
      const filtered = all.filter(
        (t) => t.assignedTo?.employee?.employeeId === user.employeeId
      );
      setTasks(filtered);
    } catch {
      setTasks([]);
    }
  }, [user?.employeeId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Periodically refresh unread counters so new incoming messages update the badges
  useEffect(() => {
    const interval = setInterval(() => {
      loadNumbersWithMessages();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadNumbersWithMessages]);

  const handleOpenWhatsApp = (row) => {
    setWhatsappRow(row);
    setSelectedCampaignId('');
    setSelectedAssignmentIds(row?._id ? [row._id] : []);
    setWhatsappDialogOpen(true);
  };

  const handleOpenBulkWhatsApp = () => {
    const selectedRows = records.filter((r) => selectedAssignmentIds.includes(r._id));
    if (selectedRows.length === 0) {
      setSnackbar({ open: true, message: 'Select at least one person', severity: 'warning' });
      return;
    }
    setWhatsappRow(selectedRows[0] || null);
    setSelectedCampaignId('');
    setWhatsappDialogOpen(true);
  };

  const handleCloseWhatsApp = () => {
    setWhatsappDialogOpen(false);
    setWhatsappRow(null);
    setSelectedAssignmentIds([]);
  };

  const handleOpenInWhatsApp = () => {
    if (!whatsappRow) return;
    const num = normalizeWhatsAppNumber(whatsappRow.mobileNumber);
    if (!num) {
      setSnackbar({ open: true, message: 'No valid mobile number', severity: 'warning' });
      return;
    }
    const campaign = campaigns.find((c) => c._id === selectedCampaignId);
    const message = ''; // Meta templates are sent via API; no pre-filled text for wa.me
    const url = `https://wa.me/${num}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
    window.open(url, '_blank');
    handleCloseWhatsApp();
    setSnackbar({ open: true, message: 'Opened WhatsApp', severity: 'success' });
  };

  const handleSendViaApi = async () => {
    if (sendingViaApi) return;
    setSendingViaApi(true);
    try {
      const selectedRows = selectedAssignmentIds.length > 0
        ? records.filter((r) => selectedAssignmentIds.includes(r._id))
        : (whatsappRow ? [whatsappRow] : []);
      if (selectedRows.length === 0) {
        throw new Error('No task selected');
      }
      const campaign = campaigns.find((c) => c._id === selectedCampaignId);
      if (!campaign?._id) {
        throw new Error('Please select a campaign');
      }
      let successCount = 0;
      let failedCount = 0;
      for (const row of selectedRows) {
        const num = normalizeWhatsAppNumber(row.mobileNumber);
        if (!num) {
          failedCount += 1;
          continue;
        }
        try {
          await sendRecoveryWhatsApp({
            to: num,
            assignmentId: row._id,
            campaignName: campaign.whatsappTemplateName
              ? `${campaign.whatsappTemplateName}${campaign.whatsappLanguageCode ? ` (${campaign.whatsappLanguageCode})` : ''}`
              : 'WhatsApp campaign',
            campaignId: campaign._id
          });
          successCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      await loadMyTasks();
      if (successCount > 0 && failedCount === 0) {
        setSnackbar({
          open: true,
          message: `Campaign sent to ${successCount} ${successCount === 1 ? 'person' : 'people'}.`,
          severity: 'success'
        });
      } else if (successCount > 0 && failedCount > 0) {
        setSnackbar({
          open: true,
          message: `Sent to ${successCount}, failed for ${failedCount}.`,
          severity: 'warning'
        });
      } else {
        throw new Error('Failed to send campaign to selected people');
      }
      handleCloseWhatsApp();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send via WhatsApp API';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setSendingViaApi(false);
    }
  };

  const handleOpenReplies = async (row) => {
    if (!row?.mobileNumber) {
      setSnackbar({ open: true, message: 'No mobile number', severity: 'warning' });
      return;
    }
    setRepliesRow(row);
    setRepliesDialogOpen(true);
    setRepliesMessages([]);
    setRepliesLoading(true);
    try {
      const res = await fetchWhatsAppIncomingMessages(row.mobileNumber);
      setRepliesMessages(res?.data?.data || []);
      // Mark as read when user opens the conversation
      const norm = normalizeWhatsAppNumber(row.mobileNumber);
      if (norm) {
        try {
          await markRecoveryWhatsAppRead(norm);
          setUnreadCounts((prev) => ({ ...prev, [norm]: 0 }));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to load messages', severity: 'error' });
      setRepliesMessages([]);
    } finally {
      setRepliesLoading(false);
    }
  };

  const handleCloseReplies = () => {
    setRepliesDialogOpen(false);
    setRepliesRow(null);
    setReplyText('');
    setReplyAttachment(null);
    loadNumbersWithMessages();
  };

  const handleReplyFileSelect = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const mime = (file.type || '').toLowerCase();
    const ok = mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('audio/') || mime.startsWith('video/');
    if (!ok) {
      setSnackbar({ open: true, message: 'Only images, PDF, audio, and video are allowed', severity: 'warning' });
      return;
    }
    const mediaType = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : mime.startsWith('video/') ? 'video' : 'document';
    setReplyAttachment({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null, mediaType });
    e.target.value = '';
  };

  const handleRemoveReplyAttachment = () => {
    if (replyAttachment?.preview) URL.revokeObjectURL(replyAttachment.preview);
    setReplyAttachment(null);
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordingTimerRef.current);
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('ogg') ? '.ogg' : '.webm';
        const file = new File([blob], `voice_note${ext}`, { type: mimeType });
        setReplyAttachment({ file, preview: null, mediaType: 'audio' });
        setIsRecording(false);
        setRecordingSecs(0);
      };
      mr.start(200);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSecs(0);
      recordingTimerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);
    } catch {
      setSnackbar({ open: true, message: 'Microphone access denied', severity: 'error' });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSendReply = async () => {
    const text = (replyText || '').trim();
    const toNumber = repliesRow?.mobileNumber ? normalizeWhatsAppNumber(repliesRow.mobileNumber) : '';
    if ((!text && !replyAttachment) || !toNumber) {
      setSnackbar({ open: true, message: 'Enter a message or add an attachment', severity: 'warning' });
      return;
    }
    try {
      setReplySending(true);
      let mediaId = null;
      let mediaUrl = null;
      let mediaType = null;
      if (replyAttachment?.file) {
        const uploadRes = await uploadWhatsAppMedia(replyAttachment.file);
        mediaId = uploadRes.data?.data?.mediaId || null;
        mediaUrl = uploadRes.data?.data?.url || null;
        mediaType = uploadRes.data?.data?.mediaType || replyAttachment.mediaType;
      }
      await sendRecoveryWhatsApp({
        to: toNumber,
        body: text || '',
        // Always pass mediaUrl (local URL for chat display) + mediaId (for Meta delivery)
        ...(mediaType && (mediaId || mediaUrl) && {
          mediaType,
          ...(mediaId ? { mediaId } : {}),
          ...(mediaUrl ? { mediaUrl } : {})
        })
      });
      setSnackbar({ open: true, message: 'Reply sent', severity: 'success' });
      setReplyText('');
      handleRemoveReplyAttachment();
      const res = await fetchWhatsAppIncomingMessages(repliesRow.mobileNumber);
      setRepliesMessages(res?.data?.data || []);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to send reply',
        severity: 'error'
      });
    } finally {
      setReplySending(false);
    }
  };

  const handleUnreadFilterChange = (e) => {
    const v = e.target.value || 'all';
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v === 'unread') next.set('unread', 'true');
      else next.delete('unread');
      return next;
    }, { replace: true });
  };

  const handleConfirmComplete = async () => {
    if (!completingId) return;
    const row = records.find((r) => r._id === completingId);
    const needsCallFeedback = row ? showCallFeedback(row) : false;
    const hasCallFeedback = row ? String(row.callFeedback || '').trim().length > 0 : false;
    if (needsCallFeedback && !hasCallFeedback) {
      setSnackbar({
        open: true,
        message: 'Call feedback is required before completing this task',
        severity: 'warning'
      });
      if (row) handleOpenFeedback(row);
      return;
    }
    try {
      await completeRecoveryTask(completingId);
      setSnackbar({ open: true, message: 'Task marked as completed', severity: 'success' });
      setCompletingId(null);
      loadMyTasks();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to complete task',
        severity: 'error'
      });
    }
  };

  const handleOpenFeedback = (row) => {
    setFeedbackRow(row);
    setFeedbackForm({
      callFeedback: row.callFeedback ?? ''
    });
    setFeedbackDialogOpen(true);
  };

  const handleCloseFeedback = () => {
    setFeedbackDialogOpen(false);
    setFeedbackRow(null);
  };

  const handleOpenFeedbackView = (row) => {
    setFeedbackViewRow(row || null);
    setFeedbackViewOpen(true);
  };

  const handleCloseFeedbackView = () => {
    setFeedbackViewOpen(false);
    setFeedbackViewRow(null);
  };

  const handleSaveFeedback = async () => {
    if (!feedbackRow) return;
    try {
      setFeedbackSaving(true);
      await updateRecoveryAssignmentFeedback(feedbackRow._id, {
        callFeedback: feedbackForm.callFeedback
      });
      setSnackbar({ open: true, message: 'Feedback saved', severity: 'success' });
      handleCloseFeedback();
      loadMyTasks();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to save feedback',
        severity: 'error'
      });
    } finally {
      setFeedbackSaving(false);
    }
  };

  const action = (row) => row.assignedToMember?.action || '';
  const showWhatsApp = (row) => {
    const a = action(row);
    return a === 'whatsapp' || a === 'both';
  };
  const showCallFeedback = (row) => {
    const a = action(row);
    return a === 'call' || a === 'both';
  };

  useEffect(() => {
    if (whatsappDialogOpen) loadCampaigns();
  }, [whatsappDialogOpen, loadCampaigns]);

  useEffect(() => {
    const visibleIds = new Set(records.map((r) => r._id));
    setSelectedAssignmentIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [records]);

  const selectedCampaign = campaigns.find((c) => c._id === selectedCampaignId);
  const previewMessage = ''; // Meta templates; no message preview
  const selectedRowsCount = selectedAssignmentIds.length;
  const allSelectableRows = records.filter((row) => showWhatsApp(row));
  const allSelected = allSelectableRows.length > 0 && selectedRowsCount === allSelectableRows.length;

  const selectedTask = useMemo(
    () => tasks.find((t) => t._id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <TaskIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" fontWeight={600}>
          My Tasks
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          {notRecoveryMember ? (
            <Alert severity="info">
              You are not set up as a recovery member. Ask an admin to add you under <strong>Recovery Members</strong> and assign you via <strong>Task Assignment</strong> to see your tasks here.
            </Alert>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search order, customer, CNIC, plot..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ minWidth: 260 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    )
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Sector</InputLabel>
                  <Select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value || '')} label="Sector">
                    <MenuItem value="">All</MenuItem>
                    {stats.sectors.map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Status</InputLabel>
                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value || '')} label="Status">
                    <MenuItem value="">All</MenuItem>
                    {stats.statuses.map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Task</InputLabel>
                  <Select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value || '')}
                    label="Task"
                  >
                    <MenuItem value="">All tasks</MenuItem>
                    {tasks.map((t) => (
                      <MenuItem key={t._id} value={t._id}>
                        {t.title || 'Task'} — {t.scopeType === 'sector'
                          ? (t.sector || 'All sectors')
                          : `${t.minAmount ?? 0}–${t.maxAmount ?? 'above'}`
                        }
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Unread messages</InputLabel>
                  <Select
                    value={unreadFilter}
                    onChange={handleUnreadFilterChange}
                    label="Unread messages"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="unread">Unread only</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Currently Due sort</InputLabel>
                  <Select value={dueSort} onChange={(e) => setDueSort(e.target.value || 'desc')} label="Currently Due sort">
                    <MenuItem value="desc">High → Low</MenuItem>
                    <MenuItem value="asc">Low → High</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary">
                  {pagination.total} task{pagination.total !== 1 ? 's' : ''} assigned
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}
                  disabled={selectedRowsCount === 0}
                  onClick={handleOpenBulkWhatsApp}
                  startIcon={<WhatsAppIcon />}
                >
                  Send campaign ({selectedRowsCount})
                </Button>
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : records.length === 0 ? (
                <Alert severity="info">No recovery tasks assigned. Assignments are based on sector and balance rules in Task Assignment.</Alert>
              ) : (
                <>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 320px)', minHeight: 500, overflowX: 'auto' }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox" sx={{ bgcolor: 'grey.50' }}>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAssignmentIds(allSelectableRows.map((r) => r._id));
                                } else {
                                  setSelectedAssignmentIds([]);
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 90, fontWeight: 600, bgcolor: 'grey.50' }}>Order Code</TableCell>
                          <TableCell sx={{ minWidth: 140, fontWeight: 600, bgcolor: 'grey.50' }}>Customer Name</TableCell>
                          <TableCell sx={{ minWidth: 110, fontWeight: 600, bgcolor: 'grey.50' }}>Booking Date</TableCell>
                          <TableCell sx={{ minWidth: 100, fontWeight: 600, bgcolor: 'grey.50' }}>Sector</TableCell>
                          <TableCell sx={{ minWidth: 110, fontWeight: 600, bgcolor: 'grey.50' }}>Mobile</TableCell>
                          <TableCell sx={{ minWidth: 90, fontWeight: 600, bgcolor: 'grey.50' }}>Status</TableCell>
                          <TableCell sx={{ minWidth: 120, fontWeight: 600, bgcolor: 'grey.50' }} align="right">Currently Due</TableCell>
                          <TableCell sx={{ minWidth: 120, fontWeight: 600, bgcolor: 'grey.50' }}>Action</TableCell>
                          <TableCell sx={{ minWidth: 140, fontWeight: 600, bgcolor: 'grey.50' }}>Campaign</TableCell>
                          <TableCell sx={{ minWidth: 140, fontWeight: 600, bgcolor: 'grey.50' }} align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {records.map((row) => (
                          <TableRow key={row._id} hover>
                            <TableCell padding="checkbox">
                              <input
                                type="checkbox"
                                disabled={!showWhatsApp(row)}
                                checked={selectedAssignmentIds.includes(row._id)}
                                onChange={(e) => {
                                  setSelectedAssignmentIds((prev) => {
                                    if (e.target.checked) return [...new Set([...prev, row._id])];
                                    return prev.filter((id) => id !== row._id);
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell>{row.orderCode ?? '—'}</TableCell>
                            <TableCell>{row.customerName ?? '—'}</TableCell>
                            <TableCell>{formatDate(row.bookingDate)}</TableCell>
                            <TableCell>{row.sector ?? '—'}</TableCell>
                            <TableCell>{row.mobileNumber ?? '—'}</TableCell>
                            <TableCell>{row.status ?? '—'}</TableCell>
                            <TableCell align="right">{formatCurrency(row.currentlyDue)}</TableCell>
                            <TableCell>
                              {row.assignedToMember
                                ? (ASSIGNED_ACTION_LABELS[row.assignedToMember.action] || row.assignedToMember.action || '—')
                                : '—'}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 160 }}>
                              {row.lastCampaignSentAt ? (
                                <Box
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    px: 0.9,
                                    py: 0.35,
                                    borderRadius: 999,
                                    bgcolor: '#25D366',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
                                    gap: 0.75,
                                    maxWidth: '100%'
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      bgcolor: 'white',
                                      opacity: 0.9
                                    }}
                                  />
                                  <Box sx={{ overflow: 'hidden' }}>
                                    <Typography
                                      variant="caption"
                                      sx={{ color: 'white', fontWeight: 600, lineHeight: 1 }}
                                    >
                                      Campaign sent
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        color: 'rgba(255,255,255,0.9)',
                                        lineHeight: 1.1,
                                        display: 'block',
                                        whiteSpace: 'nowrap',
                                        textOverflow: 'ellipsis',
                                        overflow: 'hidden'
                                      }}
                                    >
                                      {row.lastCampaignName || 'WhatsApp campaign'} ·{' '}
                                      {new Date(row.lastCampaignSentAt).toLocaleDateString('en-PK', {
                                        day: '2-digit',
                                        month: 'short'
                                      })}
                                    </Typography>
                                  </Box>
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  Not sent
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right" sx={{ overflow: 'visible', py: 1.25 }}>
                              {showWhatsApp(row) && (
                                <IconButton size="small" onClick={() => handleOpenWhatsApp(row)} title="Send WhatsApp">
                                  <WhatsAppIcon sx={{ color: '#25D366' }} />
                                </IconButton>
                              )}
                              <Badge
                                badgeContent={unreadCounts[normalizeWhatsAppNumber(row.mobileNumber)] || 0}
                                color="error"
                                invisible={!(unreadCounts[normalizeWhatsAppNumber(row.mobileNumber)] > 0)}
                              >
                                <IconButton size="small" onClick={() => handleOpenReplies(row)} title="View replies">
                                  <ChatIcon />
                                </IconButton>
                              </Badge>
                              <IconButton
                                size="small"
                                onClick={() => setCompletingId(row._id)}
                                title="Mark task as completed"
                              >
                                <TaskIcon fontSize="small" color="success" />
                              </IconButton>
                              {showCallFeedback(row) && (
                                <IconButton size="small" onClick={() => handleOpenFeedback(row)} title="Call feedback">
                                  <CallIcon fontSize="small" />
                                </IconButton>
                              )}
                              {String(row.callFeedback || '').trim() && (
                                <IconButton size="small" onClick={() => handleOpenFeedbackView(row)} title="View saved feedback">
                                  <FeedbackIcon fontSize="small" />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePaginationWrapper
                    page={pagination.page}
                    rowsPerPage={pagination.rowsPerPage}
                    total={pagination.total}
                    onPageChange={pagination.handleChangePage}
                    onRowsPerPageChange={pagination.handleChangeRowsPerPage}
                    rowsPerPageOptions={[25, 50, 100, 200]}
                  />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={whatsappDialogOpen} onClose={handleCloseWhatsApp} maxWidth="sm" fullWidth>
        <DialogTitle>Send WhatsApp message</DialogTitle>
        <DialogContent>
          {whatsappRow && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                To: {selectedRowsCount > 1
                  ? `${selectedRowsCount} selected people`
                  : `${whatsappRow.customerName} — ${whatsappRow.mobileNumber}`}
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Campaign (message template)</InputLabel>
                <Select
                  value={selectedCampaignId}
                  label="Campaign (message template)"
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                >
                  <MenuItem value="">Select campaign</MenuItem>
                  {campaigns.map((c) => (
                    <MenuItem key={c._id} value={c._id}>{c.whatsappTemplateName || '—'}{c.whatsappLanguageCode ? ` (${c.whatsappLanguageCode})` : ''}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {previewMessage && (
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Message preview"
                  value={previewMessage}
                  InputProps={{ readOnly: true }}
                  size="small"
                  sx={{ mb: 1 }}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWhatsApp}>Cancel</Button>
          <Button variant="contained" onClick={handleSendViaApi} disabled={sendingViaApi} sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}>
            {sendingViaApi ? <CircularProgress size={24} color="inherit" /> : `Send ${selectedRowsCount > 1 ? `to ${selectedRowsCount}` : 'message'}`}
          </Button>
          <Button variant="outlined" onClick={handleOpenInWhatsApp} disabled={selectedRowsCount > 1 || !normalizeWhatsAppNumber(whatsappRow?.mobileNumber)}>
            Open in WhatsApp
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={feedbackDialogOpen} onClose={handleCloseFeedback} maxWidth="sm" fullWidth>
        <DialogTitle>Feedback</DialogTitle>
        <DialogContent>
          {feedbackRow && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {feedbackRow.customerName} — {feedbackRow.orderCode}
              </Typography>
              {(showCallFeedback(feedbackRow)) && (
                <TextField
                  fullWidth
                  label="Call feedback"
                  value={feedbackForm.callFeedback}
                  onChange={(e) => setFeedbackForm((f) => ({ ...f, callFeedback: e.target.value }))}
                  multiline
                  rows={3}
                  size="small"
                  placeholder="Your feedback after the call..."
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFeedback}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveFeedback} disabled={feedbackSaving}>
            {feedbackSaving ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={feedbackViewOpen} onClose={handleCloseFeedbackView} maxWidth="sm" fullWidth>
        <DialogTitle>Call Feedback</DialogTitle>
        <DialogContent>
          {feedbackViewRow && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {feedbackViewRow.customerName} — {feedbackViewRow.orderCode}
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {String(feedbackViewRow.callFeedback || '').trim() || 'No call feedback available.'}
                </Typography>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFeedbackView}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={repliesDialogOpen} onClose={handleCloseReplies} maxWidth="sm" fullWidth PaperProps={{ sx: { minHeight: 480 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#075E54', color: 'white', py: 1.5, pr: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChatIcon />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>{repliesRow?.customerName || '—'}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>{repliesRow?.mobileNumber || '—'}</Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseReplies} size="small" sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#E5DDD5', display: 'flex', flexDirection: 'column', minHeight: 340 }}>
          {repliesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : repliesMessages.length === 0 ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body2" color="text.secondary">No messages yet. Start the conversation below.</Typography>
            </Box>
          ) : (
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {repliesMessages.map((m, idx) => (
                <Box
                  key={m._id || m.messageId || idx}
                  sx={{
                    alignSelf: m.direction === 'out' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    borderTopRightRadius: m.direction === 'out' ? 0.5 : 2,
                    borderTopLeftRadius: m.direction === 'in' ? 0.5 : 2,
                    bgcolor: m.direction === 'out' ? '#DCF8C6' : 'white',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                  }}
                >
                  {m.mediaUrl && m.mediaType === 'image' ? (
                    <Box>
                      <Box
                        component="img"
                        src={m.mediaUrl}
                        alt="media"
                        sx={{ maxWidth: 240, maxHeight: 200, borderRadius: 1, display: 'block', cursor: 'pointer' }}
                        onClick={() => window.open(m.mediaUrl, '_blank')}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
                        }}
                      />
                      <Box sx={{ display: 'none', alignItems: 'center', gap: 0.5 }}>
                        <AttachFileIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography component="a" href={m.mediaUrl} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ color: 'primary.main', textDecoration: 'underline' }}>
                          View image
                        </Typography>
                      </Box>
                      {m.text && <Typography variant="body2" sx={{ wordBreak: 'break-word', mt: 0.5 }}>{m.text}</Typography>}
                    </Box>
                  ) : m.mediaUrl && m.mediaType === 'video' ? (
                    <Box>
                      <Box component="video" src={m.mediaUrl} controls sx={{ maxWidth: 260, maxHeight: 200, borderRadius: 1, display: 'block' }} />
                      {m.text && <Typography variant="body2" sx={{ wordBreak: 'break-word', mt: 0.5 }}>{m.text}</Typography>}
                    </Box>
                  ) : m.mediaUrl && m.mediaType === 'audio' ? (
                    <Box>
                      <Box component="audio" src={m.mediaUrl} controls sx={{ maxWidth: 260, display: 'block' }} />
                      {m.text && <Typography variant="body2" sx={{ wordBreak: 'break-word', mt: 0.5 }}>{m.text}</Typography>}
                    </Box>
                  ) : m.mediaUrl ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AttachFileIcon sx={{ fontSize: 20, color: 'text.secondary', flexShrink: 0 }} />
                      <Box>
                        <Typography
                          component="a"
                          href={m.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="body2"
                          sx={{ color: 'primary.main', textDecoration: 'underline', wordBreak: 'break-all', display: 'block' }}
                        >
                          {m.mediaFilename || 'Download attachment'}
                        </Typography>
                        {m.text && <Typography variant="body2" sx={{ wordBreak: 'break-word', mt: 0.25 }}>{m.text}</Typography>}
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{m.text || '(media)'}</Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.3, mt: 0.25 }}>
                    <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1 }}>
                      {m.time ? new Date(m.time).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </Typography>
                    {m.direction === 'out' && (
                      m.status === 'read'
                        ? <DoneAllIcon sx={{ fontSize: 14, color: '#53bdeb' }} />
                        : m.status === 'delivered'
                          ? <DoneAllIcon sx={{ fontSize: 14, color: 'rgba(0,0,0,0.45)' }} />
                          : m.status === 'sending'
                            ? <DoneIcon sx={{ fontSize: 14, color: 'rgba(0,0,0,0.3)' }} />
                            : <DoneIcon sx={{ fontSize: 14, color: 'rgba(0,0,0,0.45)' }} />
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
          {repliesRow?.mobileNumber && (
            <Box sx={{ p: 1.5, bgcolor: '#F0F2F5', borderTop: '1px solid', borderColor: 'divider' }}>
              <input
                type="file"
                ref={replyFileInputRef}
                accept="image/*,application/pdf,audio/*,video/*"
                style={{ display: 'none' }}
                onChange={handleReplyFileSelect}
              />
              {/* Attachment preview */}
              {replyAttachment && !isRecording && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, p: 1, bgcolor: 'white', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  {replyAttachment.mediaType === 'audio'
                    ? <MicIcon sx={{ color: '#25D366', fontSize: 28 }} />
                    : replyAttachment.preview
                      ? <Box component="img" src={replyAttachment.preview} alt="Preview" sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1 }} />
                      : <AttachFileIcon sx={{ color: 'text.secondary', fontSize: 28 }} />}
                  <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>{replyAttachment.file?.name}</Typography>
                  <IconButton size="small" onClick={handleRemoveReplyAttachment} title="Remove"><CloseIcon fontSize="small" /></IconButton>
                </Box>
              )}
              {/* Recording indicator */}
              {isRecording && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, px: 1.5, py: 1, bgcolor: '#fff0f0', borderRadius: 2, border: '1px solid #ffcccc' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main', animation: 'pulse 1s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />
                  <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
                    Recording… {`${Math.floor(recordingSecs / 60)}:${String(recordingSecs % 60).padStart(2, '0')}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>Tap stop to send</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                {/* Attach button — hidden while recording */}
                {!isRecording && (
                  <IconButton onClick={() => replyFileInputRef.current?.click()} sx={{ color: '#54656F', alignSelf: 'center', flexShrink: 0 }} title="Attach file">
                    <AttachFileIcon />
                  </IconButton>
                )}
                {/* Text field — hidden while recording */}
                {!isRecording && (
                  <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder="Type a message..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                    variant="outlined"
                    size="small"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'white', borderRadius: 8, fontSize: '0.95rem',
                        '& fieldset': { borderRadius: 8, borderColor: 'rgba(0,0,0,0.12)' },
                        '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.2)' },
                        '&.Mui-focused fieldset': { borderWidth: 1, borderColor: '#25D366' }
                      }
                    }}
                  />
                )}
                {/* Right action button: Stop (recording) | Send (has content) | Mic (empty) */}
                {isRecording ? (
                  <IconButton onClick={handleStopRecording} sx={{ bgcolor: 'error.main', color: 'white', '&:hover': { bgcolor: 'error.dark' }, flexShrink: 0 }}>
                    <StopIcon />
                  </IconButton>
                ) : (replyText.trim() || replyAttachment) ? (
                  <IconButton
                    onClick={handleSendReply}
                    disabled={replySending}
                    sx={{ bgcolor: '#25D366', color: 'white', '&:hover': { bgcolor: '#1da851' }, '&.Mui-disabled': { bgcolor: 'grey.300', color: 'grey.500' }, alignSelf: 'flex-end', flexShrink: 0 }}
                  >
                    {replySending ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
                  </IconButton>
                ) : (
                  <IconButton onClick={handleStartRecording} sx={{ bgcolor: '#25D366', color: 'white', '&:hover': { bgcolor: '#1da851' }, flexShrink: 0 }} title="Record voice note">
                    <MicIcon />
                  </IconButton>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!completingId}
        onClose={() => setCompletingId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Mark task as completed?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will move the task out of <strong>My Tasks</strong> into <strong>Completed Tasks</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletingId(null)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleConfirmComplete}>
            Mark completed
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MyTasks;
