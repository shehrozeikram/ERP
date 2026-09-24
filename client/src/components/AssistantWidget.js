import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Fab,
  Paper,
  Typography,
  TextField,
  IconButton,
  Chip,
  CircularProgress,
  Divider,
  Zoom,
  Collapse,
  Stack
} from '@mui/material';
import {
  SmartToy as AssistantIcon,
  Close as CloseIcon,
  Send as SendIcon,
  OpenInNew as OpenIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import aiAssistantService from '../services/aiAssistantService';

const TYPE_LABELS = {
  indent: 'Indent',
  purchase_order: 'PO',
  cash_approval: 'Cash Approval',
  bill: 'Bill / AP',
  voucher: 'Voucher'
};

const TYPE_COLORS = {
  indent: 'info',
  purchase_order: 'primary',
  cash_approval: 'secondary',
  bill: 'warning',
  voucher: 'success'
};

const formatAmount = (amount) => {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return String(amount);
  }
};

const formatDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return null;
  }
};

const ResultCard = ({ item, onOpen }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 1.25,
      mb: 1,
      cursor: 'pointer',
      '&:hover': { bgcolor: 'action.hover' }
    }}
    onClick={() => onOpen(item)}
  >
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
      <Chip
        size="small"
        label={TYPE_LABELS[item.type] || item.type}
        color={TYPE_COLORS[item.type] || 'default'}
      />
      <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
        {item.number}
      </Typography>
      <IconButton size="small" aria-label="open document">
        <OpenIcon fontSize="small" />
      </IconButton>
    </Stack>
    <Typography variant="caption" color="text.secondary" display="block">
      {[item.status, item.company, formatAmount(item.amount), formatDate(item.date)]
        .filter(Boolean)
        .join(' · ')}
    </Typography>
    {item.subtitle ? (
      <Typography variant="caption" color="text.secondary" noWrap display="block">
        {item.subtitle}
      </Typography>
    ) : null}
  </Paper>
);

const AssistantWidget = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Ask for an Indent, PO, Cash Approval, Bill, or Voucher — e.g. “find PO-000275” or “pending cash approvals”.'
    }
  ]);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  if (!isAuthenticated) return null;

  const handleOpen = (item) => {
    if (item?.path) {
      setOpen(false);
      navigate(item.path);
    }
  };

  const handleSend = async () => {
    const query = input.trim();
    if (!query || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    setLoading(true);

    try {
      const res = await aiAssistantService.ask(query);
      const results = res?.data?.results || [];
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res?.message || 'Here are the results.',
          results
        }
      ]);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Search failed. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', text: msg, results: [] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Zoom in className="app-print-hide">
        <Fab
          className="app-print-hide"
          color="secondary"
          aria-label="document assistant"
          onClick={() => setOpen((v) => !v)}
          sx={{
            position: 'fixed',
            right: 24,
            bottom: 96,
            zIndex: (theme) => theme.zIndex.drawer + 2,
            '@media print': { display: 'none !important' }
          }}
        >
          {open ? <CloseIcon /> : <AssistantIcon />}
        </Fab>
      </Zoom>

      <Collapse in={open} className="app-print-hide">
        <Paper
          elevation={8}
          className="app-print-hide"
          sx={{
            position: 'fixed',
            right: 24,
            bottom: 160,
            width: { xs: 'calc(100vw - 32px)', sm: 380 },
            maxWidth: 420,
            height: 480,
            maxHeight: '70vh',
            zIndex: (theme) => theme.zIndex.drawer + 3,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            '@media print': { display: 'none !important' }
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              bgcolor: 'secondary.main',
              color: 'secondary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Document Assistant
            </Typography>
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              sx={{ color: 'inherit' }}
              aria-label="close assistant"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box
            ref={listRef}
            sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5, bgcolor: 'background.default' }}
          >
            {messages.map((m, idx) => (
              <Box
                key={idx}
                sx={{
                  mb: 1.5,
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <Box
                  sx={{
                    maxWidth: '92%',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: m.role === 'user' ? 'primary.main' : 'background.paper',
                    color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    boxShadow: 1
                  }}
                >
                  <Typography variant="body2">{m.text}</Typography>
                  {m.results?.length > 0 ? (
                    <Box sx={{ mt: 1 }}>
                      <Divider sx={{ mb: 1 }} />
                      {m.results.map((item) => (
                        <ResultCard key={`${item.type}-${item.id}`} item={item} onOpen={handleOpen} />
                      ))}
                    </Box>
                  ) : null}
                </Box>
              </Box>
            ))}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                <CircularProgress size={22} />
              </Box>
            ) : null}
          </Box>

          <Box sx={{ p: 1.25, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Find PO-…, IND-…, CA-…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={loading}
            />
            <IconButton
              color="secondary"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="send"
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      </Collapse>
    </>
  );
};

export default AssistantWidget;
