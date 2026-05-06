import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  Popover,
  Checkbox,
  Card,
  CardContent,
  CardMedia
} from '@mui/material';
import {
  Add as AddIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  DoneAll as DoneAllIcon,
  Edit as EditIcon,
  PushPin as PushPinIcon,
  Reply as ReplyIcon,
  Search as SearchIcon,
  Send as SendIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Download as DownloadIcon,
  GppMaybe as GppMaybeIcon,
  Groups as GroupsIcon,
  EmojiEmotions as EmojiEmotionsIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import ChatService from '../../services/chatService';
import NotificationService from '../../services/notificationService';
import { getImageUrl, handleImageError } from '../../utils/imageService';

/** Sidebar / FAB listen to refresh total chat unread. */
const EVT_CHAT_UNREAD_CHANGED = 'sgc:chat-unread-changed';
/** NotificationProvider refetches bell / module counts. */
const EVT_APP_NOTIFICATIONS_REFRESH = 'sgc:app-notifications-refresh';

async function markChatPushNotificationsRead(conversationId) {
  try {
    const notificationsRes = await NotificationService.getNotifications({
      status: 'unread',
      type: 'chat_message',
      limit: 100
    });
    const list = notificationsRes.data || [];
    const ids = list
      .filter((n) => {
        const cid = n.metadata?.additionalData?.conversationId ?? n.metadata?.entityId;
        return cid != null && String(cid) === String(conversationId);
      })
      .map((n) => n._id)
      .filter(Boolean);
    if (ids.length) {
      await NotificationService.markAsRead(ids);
    }
  } catch {
    /* non-fatal */
  }
}

/** Picker grid — one button opens this full set */
const EMOJI_PICKER_LIST = [
  '👍', '👎', '❤️', '🩷', '💙', '💚', '🔥', '😂', '🤣', '😊', '😍', '🥰', '😘', '😭', '😢', '😮', '🤔', '🙄', '😴', '🤝', '👏', '🙌', '💪', '✅', '❌', '⭐', '💯', '🎉', '✨', '👀', '🙏', '💬', '📌', '📎', '🔔', '🏆', '🎯', '💡', '🧠', '☕', '🍕', '✈️', '📅', '⏰', '🔒', '🔑'
];
const ADMIN_ROLES = new Set(['super_admin', 'admin', 'developer']);

/** WhatsApp-style outgoing bubble (not theme primary blue) */
const WA_OUT_LIGHT = '#DCF8C6';
const WA_OUT_DARK = '#056162';
const WA_OUT_TEXT_LIGHT = 'rgba(0, 0, 0, 0.87)';
const WA_OUT_TEXT_DARK = '#E8EDF0';
const WA_OUT_MUTED_LIGHT = 'rgba(0, 0, 0, 0.55)';
const WA_OUT_MUTED_DARK = 'rgba(232, 237, 240, 0.72)';
const WA_OUT_LINK_LIGHT = '#075E54';
const WA_READ_TICK = '#34B7F1';

function linkifyText(text) {
  if (!text) return null;
  const parts = String(text).split(/(https?:\/\/[^\s]+)/gi);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function renderFormattedChatText(text, mentions = []) {
  if (!text) return null;
  const mentionLabels = (Array.isArray(mentions) ? mentions : [])
    .map((m) => String(m?.label || '').trim())
    .filter(Boolean);

  const renderWithMentions = (plainText, keyPrefix) => {
    if (!plainText) return null;
    if (!mentionLabels.length) return <span key={`${keyPrefix}-plain`}>{plainText}</span>;
    const escaped = mentionLabels
      .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length);
    const rx = new RegExp(`(@(?:${escaped.join('|')}))`, 'gi');
    const bits = plainText.split(rx);
    return bits.map((bit, idx) => {
      const isMention = /^@.+/.test(bit) && mentionLabels.some((lbl) => bit.toLowerCase() === `@${lbl}`.toLowerCase());
      if (isMention) {
        return (
          <strong key={`${keyPrefix}-m-${idx}`} style={{ fontWeight: 700 }}>
            {bit}
          </strong>
        );
      }
      return <span key={`${keyPrefix}-t-${idx}`}>{bit}</span>;
    });
  };

  const parts = String(text).split(/(https?:\/\/[^\s]+)/gi);
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a key={`url-${i}`} href={part} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
          {part}
        </a>
      );
    }
    // WhatsApp-like bold syntax: *bold text* (also supports **bold**).
    const chunks = part.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
    return (
      <React.Fragment key={`txt-${i}`}>
        {chunks.map((chunk, j) => {
          const isBold = /^\*\*[^*\n]+\*\*$/.test(chunk) || /^\*[^*\n]+\*$/.test(chunk);
          if (isBold) {
            const textValue = chunk.startsWith('**') ? chunk.slice(2, -2) : chunk.slice(1, -1);
            return (
              <strong key={`b-${i}-${j}`} style={{ fontWeight: 700 }}>
                {renderWithMentions(textValue, `b-${i}-${j}`)}
              </strong>
            );
          }
          return <React.Fragment key={`s-${i}-${j}`}>{renderWithMentions(chunk, `s-${i}-${j}`)}</React.Fragment>;
        })}
      </React.Fragment>
    );
  });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Shorter time inside bubbles (less width, reads like typical chat apps). */
function formatMessageTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDayLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const y = (x) => x.getFullYear() * 400 + x.getMonth() * 40 + x.getDate();
  if (y(d) === y(today)) return 'Today';
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (y(d) === y(yest)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

const getDepartmentLabel = (userObj) =>
  (userObj?.department || userObj?.departmentName || userObj?.departmentCode || '').trim() || 'No Department';

const getEmployeeName = (userObj) =>
  userObj?.fullName || [userObj?.firstName, userObj?.lastName].filter(Boolean).join(' ').trim() || userObj?.email || 'Employee';

const groupUsersByDepartment = (users = []) => {
  const sorted = [...users].sort((a, b) => {
    const deptCmp = getDepartmentLabel(a).localeCompare(getDepartmentLabel(b), undefined, { sensitivity: 'base' });
    if (deptCmp !== 0) return deptCmp;
    return getEmployeeName(a).localeCompare(getEmployeeName(b), undefined, { sensitivity: 'base' });
  });

  const groups = [];
  sorted.forEach((u) => {
    const department = getDepartmentLabel(u);
    const existing = groups.find((g) => g.department === department);
    if (existing) existing.members.push(u);
    else groups.push({ department, members: [u] });
  });
  return groups;
};

function newClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const ChatPage = () => {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { conversationId: routeConvId } = useParams();
  const { user } = useAuth();
  const meId = user?.id || user?._id;

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState(routeConvId || null);
  const [meta, setMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [typing, setTyping] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [dirSearch, setDirSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuMsg, setMenuMsg] = useState(null);
  const [onlineMap, setOnlineMap] = useState({});
  const [groupDialog, setGroupDialog] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupPick, setGroupPick] = useState([]);
  const [groupDir, setGroupDir] = useState([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionUsers, setMentionUsers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionAnchorPos, setMentionAnchorPos] = useState({ start: -1, end: -1 });
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const [pendingMentions, setPendingMentions] = useState([]);
  const [emojiMenu, setEmojiMenu] = useState(null);
  const composerRef = useRef(null);
  const listEndRef = useRef(null);

  const participantNameById = useMemo(() => {
    const map = new Map();
    (meta?.participants || []).forEach((p) => {
      const id = String(p.id ?? p._id ?? '');
      if (!id) return;
      const name =
        p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.email || 'Member';
      map.set(id, name);
    });
    return map;
  }, [meta?.participants]);
  const typingTimerRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const socketRef = useRef(null);
  const mentionRequestSeqRef = useRef(0);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const rows = await ChatService.listConversations();
      setConversations(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (routeConvId) setActiveId(routeConvId);
    else setActiveId(null);
  }, [routeConvId]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const loadMeta = useCallback(async (cid) => {
    if (!cid) return;
    try {
      const m = await ChatService.getConversation(cid);
      setMeta(m);
    } catch (e) {
      console.error(e);
      setMeta(null);
    }
  }, []);

  const loadMessages = useCallback(
    async (cid, { before, append } = {}) => {
      if (!cid) return;
      setLoadingThread(!append);
      try {
        const data = await ChatService.listMessages(cid, { before, limit: 40 });
        const incoming = data.messages || [];
        if (append) {
          setMessages((prev) => {
            const merged = [...incoming, ...prev];
            const seen = new Set();
            return merged.filter((m) => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            });
          });
        } else {
          setMessages(incoming);
        }
        setHasMore(!!data.hasMore);
        scrollToBottom();
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingThread(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!activeId || !meId) return undefined;
    const convId = activeId;
    let cancelled = false;
    loadMeta(convId);
    loadMessages(convId, {});

    ChatService.markRead(convId)
      .then(async () => {
        if (cancelled) return;
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
        );
        window.dispatchEvent(new Event(EVT_CHAT_UNREAD_CHANGED));
        await markChatPushNotificationsRead(convId);
        if (!cancelled) {
          window.dispatchEvent(new Event(EVT_APP_NOTIFICATIONS_REFRESH));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeId, meId, loadMeta, loadMessages]);

  useEffect(() => {
    if (!activeId || !meta) return undefined;
    const ids =
      meta.kind === 'group'
        ? (meta.participants || []).map((p) => p.id).filter((id) => String(id) !== String(meId))
        : meta.otherUser?.id
          ? [meta.otherUser.id]
          : [];
    if (!ids.length) return undefined;
    let cancelled = false;
    const poll = async () => {
      try {
        const map = await ChatService.getPresence(ids);
        if (!cancelled) setOnlineMap(map || {});
      } catch {
        if (!cancelled) setOnlineMap({});
      }
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeId, meta, meId]);

  useEffect(() => {
    if (!user) return undefined;
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    const baseURL =
      process.env.NODE_ENV === 'production'
        ? window.location.origin
        : (process.env.REACT_APP_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');
    const socket = io(baseURL, {
      path: '/socket-notifications',
      transports: ['websocket', 'polling'],
      auth: { token }
    });
    socketRef.current = socket;

    const onMsg = (payload) => {
      const { conversationId, message } = payload || {};
      if (!conversationId || !message) return;
      setConversations((prev) => {
        if (!prev.some((c) => c.id === conversationId)) {
          setTimeout(() => loadConversations(), 0);
          return prev;
        }
        return prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessageAt: message.createdAt,
                lastMessageSnippet: message.isDeletedForEveryone ? '' : message.body || 'Attachment',
                lastMessageSender: message.sender,
                unreadCount:
                  message.sender === String(meId)
                    ? c.unreadCount
                    : conversationId === activeId
                      ? c.unreadCount
                      : (c.unreadCount || 0) + 1
              }
            : c
        );
      });
      if (conversationId === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) {
            return prev.map((m) => (m.id === message.id ? { ...m, ...message } : m));
          }
          return [...prev, message];
        });
        if (message.sender !== String(meId)) {
          void ChatService.markRead(conversationId, message.id)
            .then(async () => {
              await markChatPushNotificationsRead(conversationId);
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === conversationId ? { ...c, unreadCount: 0 } : c
                )
              );
              window.dispatchEvent(new Event(EVT_CHAT_UNREAD_CHANGED));
              window.dispatchEvent(new Event(EVT_APP_NOTIFICATIONS_REFRESH));
            })
            .catch(() => {});
        }
        scrollToBottom();
      }
    };

    const onUpd = (payload) => {
      const { conversationId, message } = payload || {};
      if (conversationId === activeId && message) {
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, ...message } : m)));
      }
    };

    const onDel = (payload) => {
      const { conversationId, messageId, scope } = payload || {};
      if (conversationId === activeId) {
        if (scope === 'for_me' || scope === 'forme') {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, body: '', isDeletedForEveryone: true, attachments: [], reactions: [] }
                : m
            )
          );
        }
      }
      loadConversations();
    };

    const onRead = (payload) => {
      if (payload?.conversationId === activeId && payload.userId !== String(meId)) {
        loadMeta(activeId);
      }
    };

    const onReact = (payload) => {
      if (payload?.conversationId !== activeId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.messageId ? { ...m, reactions: payload.reactions || [] } : m))
      );
    };

    const onStar = (payload) => {
      if (payload?.conversationId !== activeId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, starredBy: payload.starredBy || [], isStarred: !!payload.starred }
            : m
        )
      );
    };

    const onTyping = (payload) => {
      if (payload?.conversationId === activeId && payload.userId !== String(meId)) {
        setTyping(!!payload.typing);
        if (payload.typing) {
          clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setTyping(false), 4000);
        }
      }
    };

    socket.on('chat:message', onMsg);
    socket.on('chat:message:updated', onUpd);
    socket.on('chat:message:deleted', onDel);
    socket.on('chat:read', onRead);
    socket.on('chat:reaction', onReact);
    socket.on('chat:star', onStar);
    socket.on('chat:typing', onTyping);

    const onPin = (payload) => {
      if (payload?.conversationId === activeId) loadMeta(activeId);
    };
    socket.on('chat:pin', onPin);

    const onConvUpd = () => {
      loadConversations();
      if (activeId) loadMeta(activeId);
    };
    socket.on('chat:conversation:updated', onConvUpd);

    return () => {
      socket.off('chat:message', onMsg);
      socket.off('chat:message:updated', onUpd);
      socket.off('chat:message:deleted', onDel);
      socket.off('chat:read', onRead);
      socket.off('chat:reaction', onReact);
      socket.off('chat:star', onStar);
      socket.off('chat:typing', onTyping);
      socket.off('chat:pin', onPin);
      socket.off('chat:conversation:updated', onConvUpd);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, meId, activeId, loadConversations, loadMeta]);

  const emitTyping = (isTyping) => {
    const s = socketRef.current;
    if (!s || !activeId) return;
    const now = Date.now();
    if (isTyping && now - lastTypingEmitRef.current < 800) return;
    lastTypingEmitRef.current = now;
    s.emit('chat:typing', { conversationId: activeId, typing: isTyping });
  };

  const extractMentionContext = (text, caretPos) => {
    const before = String(text || '').slice(0, Math.max(0, caretPos));
    const at = before.lastIndexOf('@');
    if (at < 0) return null;
    const beforeAt = at > 0 ? before[at - 1] : ' ';
    if (!/\s|[([{,.!?;:'"`-]/.test(beforeAt)) return null;
    const token = before.slice(at + 1);
    if (token.includes('\n')) return null;
    if (token.length > 72) return null;
    // Allow spaces in mention search (Cursor-like), trim only for query.
    const query = token.replace(/^\s+/, '').slice(0, 64);
    return { start: at, end: caretPos, query };
  };

  const handleDraftChange = async (e) => {
    const v = e.target.value;
    const caret = e.target.selectionStart ?? v.length;
    setDraft(v);
    const ctx = extractMentionContext(v, caret);
    if (ctx) {
      setMentionAnchorPos({ start: ctx.start, end: ctx.end });
      setMentionQuery(ctx.query);
      setMentionOpen(true);
      setMentionHighlightIndex(0);
      const seq = ++mentionRequestSeqRef.current;
      try {
        const rows = await ChatService.directory(ctx.query, 12);
        if (mentionRequestSeqRef.current === seq) {
          setMentionUsers(rows);
        }
      } catch {
        if (mentionRequestSeqRef.current === seq) {
          setMentionUsers([]);
        }
      }
    } else {
      setMentionOpen(false);
      setMentionUsers([]);
      setMentionQuery('');
      setMentionAnchorPos({ start: -1, end: -1 });
    }
    emitTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 2500);
  };

  const insertMention = (u) => {
    const label = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim();
    const v = String(draft || '');
    const start = mentionAnchorPos.start >= 0 ? mentionAnchorPos.start : v.lastIndexOf('@');
    const end = mentionAnchorPos.end >= 0 ? mentionAnchorPos.end : (composerRef.current?.selectionStart ?? v.length);
    const prefix = start >= 0 ? v.slice(0, start) : v;
    const suffix = end >= 0 ? v.slice(end) : '';
    const next = `${prefix}@${label} ${suffix}`;
    setDraft(next);
    setPendingMentions((prev) => {
      if (prev.some((p) => String(p.userId) === String(u.id))) return prev;
      return [...prev, { userId: u.id, label }];
    });
    setMentionOpen(false);
    setMentionUsers([]);
    setMentionQuery('');
    setMentionAnchorPos({ start: -1, end: -1 });
    requestAnimationFrame(() => {
      const pos = (prefix + `@${label} `).length;
      if (composerRef.current) {
        composerRef.current.focus();
        composerRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const selectConversation = (id) => {
    setActiveId(id);
    navigate(`/chat/${id}`);
    if (isSm) {
      /* thread visible */
    }
  };

  const openNewChatDialog = async () => {
    setPickerOpen(true);
    try {
      const rows = await ChatService.directory(dirSearch, 30);
      setDirectory(rows);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const t = setTimeout(async () => {
      try {
        const rows = await ChatService.directory(dirSearch, 30);
        setDirectory(rows);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [dirSearch, pickerOpen]);

  const startWithUser = async (otherUserId) => {
    try {
      const conv = await ChatService.openConversation(otherUserId);
      setPickerOpen(false);
      await loadConversations();
      selectConversation(conv.id);
    } catch (e) {
      console.error(e);
    }
  };

  const sendNow = async () => {
    const text = draft.trim();
    if (!activeId || (!text && !editTarget)) return;
    if (editTarget) {
      try {
        const updated = await ChatService.editMessage(editTarget.id, text);
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        setEditTarget(null);
        setDraft('');
      } catch (e) {
        console.error(e);
      }
      return;
    }
    const clientMessageId = newClientId();
    const optimistic = {
      id: `temp-${clientMessageId}`,
      conversation: activeId,
      sender: String(meId),
      body: text,
      clientMessageId,
      replyTo: replyTo
        ? {
            message: replyTo.id,
            preview: (replyTo.body || '').slice(0, 200),
            senderName: replyTo.senderName || 'User'
          }
        : null,
      attachments: [],
      createdAt: new Date().toISOString(),
      editedAt: null,
      reactions: [],
      starredBy: [],
      isStarred: false,
      isDeletedForEveryone: false,
      deliveredAt: null
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    setReplyTo(null);
    scrollToBottom();
    try {
      const { message, duplicate } = await ChatService.sendMessage(activeId, {
        body: text,
        clientMessageId,
        replyToMessageId: replyTo?.id || undefined,
        mentions: pendingMentions
      });
      setPendingMentions([]);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== optimistic.id);
        if (duplicate && withoutTemp.some((m) => m.id === message.id)) return withoutTemp;
        const has = withoutTemp.some((m) => m.id === message.id);
        if (has) return withoutTemp.map((m) => (m.id === message.id ? { ...m, ...message } : m));
        return [...withoutTemp, message];
      });
      loadConversations();
    } catch (e) {
      console.error(e);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(text);
    }
  };

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeId) return;
    try {
      const up = await ChatService.uploadAttachment(activeId, file);
      const clientMessageId = newClientId();
      const { message } = await ChatService.sendMessage(activeId, {
        body: file.name,
        clientMessageId,
        attachments: [up]
      });
      setMessages((prev) => [...prev.filter((m) => m.id !== message.id), message]);
      loadConversations();
      scrollToBottom();
    } catch (err) {
      console.error(err);
    }
  };

  const runSearch = async () => {
    if (!activeId || !searchQ.trim()) return;
    try {
      const hits = await ChatService.searchMessages(activeId, searchQ.trim());
      setSearchHits(hits);
    } catch (e) {
      console.error(e);
    }
  };

  const exportChat = async () => {
    if (!activeId) return;
    try {
      const blob = await ChatService.exportConversation(activeId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${activeId}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const openMenu = (e, msg) => {
    setMenuAnchor(e.currentTarget);
    setMenuMsg(msg);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuMsg(null);
  };

  const pinnedFromMeta = useMemo(() => {
    if (!meta?.pinnedMessage) return null;
    return meta.pinnedMessage;
  }, [meta]);

  const submitGroup = async () => {
    if (!groupTitle.trim() || groupPick.length < 1) return;
    try {
      const conv = await ChatService.createGroup(groupTitle.trim(), groupPick);
      setGroupDialog(false);
      setGroupPick([]);
      await loadConversations();
      selectConversation(conv.id);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleGroupMember = (userId) => {
    if (String(userId) === String(meId)) return;
    setGroupPick((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const showThread = !isSm || !!activeId;
  const isGroup = meta?.kind === 'group';
  const headerTitle =
    isGroup && meta?.title
      ? meta.title
      : meta?.otherUser?.fullName ||
        `${meta?.otherUser?.firstName || ''} ${meta?.otherUser?.lastName || ''}`.trim() ||
        'Chat';
  const onlineOthersCount =
    meta?.kind === 'group'
      ? (meta.participants || []).filter(
          (p) => String(p.id) !== String(meId) && onlineMap[String(p.id)]
        ).length
      : meta?.otherUser && onlineMap[String(meta.otherUser.id)]
        ? 1
        : 0;
  const onlineChipLabel = !isGroup
    ? !meta?.otherUser
      ? '—'
      : onlineMap[String(meta.otherUser.id)]
        ? 'Online'
        : 'Offline'
    : `${onlineOthersCount} online`;
  const groupedGroupMembers = useMemo(
    () => groupUsersByDepartment(groupDir.filter((u) => String(u.id) !== String(meId))),
    [groupDir, meId]
  );
  const groupedDirectory = useMemo(
    () => groupUsersByDepartment(directory.filter((u) => String(u.id) !== String(meId))),
    [directory, meId]
  );

  return (
    <Box sx={{ height: 'calc(100vh - 140px)', display: 'flex', gap: 0, mx: -3, mt: -2 }}>
      <Paper
        elevation={0}
        sx={{
          width: isSm ? (showThread ? '100%' : '100%') : 320,
          display: isSm && showThread && activeId ? 'none' : 'flex',
          flexDirection: 'column',
          borderRight: 1,
          borderColor: 'divider',
          borderRadius: 0
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="h6">Messages</Typography>
          <Box>
            <Tooltip title="New group">
              <IconButton color="secondary" onClick={async () => { setGroupDialog(true); setGroupPick([]); setGroupTitle(''); try { setGroupDir(await ChatService.directory('', 40)); } catch (e) { console.error(e); } }} size="small">
                <GroupsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="New chat">
              <IconButton color="primary" onClick={openNewChatDialog} size="small">
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Divider />
        {loadingList ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <List dense sx={{ overflow: 'auto', flex: 1 }}>
            {conversations.map((c) => (
              <ListItemButton
                key={c.id}
                selected={c.id === activeId}
                onClick={() => selectConversation(c.id)}
                alignItems="flex-start"
              >
                <ListItemAvatar>
                  <Badge badgeContent={c.unreadCount > 0 ? c.unreadCount : 0} color="primary" invisible={!c.unreadCount}>
                    <Avatar
                      src={c.kind === 'direct' ? getImageUrl(c.otherUser?.profileImage) : undefined}
                      onError={handleImageError}
                      sx={{ width: 40, height: 40 }}
                    >
                      {c.kind === 'group' ? (c.title || 'G')[0] : (c.otherUser?.firstName || '?')[0]}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={c.displayTitle || c.otherUser?.fullName || `${c.otherUser?.firstName || ''} ${c.otherUser?.lastName || ''}`}
                  secondary={
                    <Typography component="span" variant="body2" color="text.secondary" noWrap>
                      {c.lastMessageSnippet || '—'}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
            {!conversations.length && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No conversations yet. Start one with +.
              </Typography>
            )}
          </List>
        )}
      </Paper>

      {(!isSm || (isSm && showThread && activeId)) && (
        <Paper elevation={0} sx={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 0, minWidth: 0 }}>
          {!activeId ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
              <Typography>Select a conversation</Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                {isSm && (
                  <Button size="small" onClick={() => navigate('/chat')}>
                    Back
                  </Button>
                )}
                <Avatar src={!isGroup ? getImageUrl(meta?.otherUser?.profileImage) : undefined} onError={handleImageError}>
                  {isGroup ? (meta?.title || 'G')[0] : (meta?.otherUser?.firstName || '?')[0]}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" noWrap>
                    {headerTitle}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {!isGroup
                        ? `${meta?.otherUser?.department || ''} · ${meta?.otherUser?.position || ''}`
                        : `${meta?.participants?.length || 0} members`}
                    </Typography>
                    <Chip
                      size="small"
                      label={onlineChipLabel}
                      color={!isGroup && onlineMap[String(meta?.otherUser?.id)] ? 'success' : isGroup && onlineOthersCount > 0 ? 'success' : 'default'}
                      variant={(!isGroup && onlineMap[String(meta?.otherUser?.id)]) || (isGroup && onlineOthersCount > 0) ? 'filled' : 'outlined'}
                    />
                  </Box>
                </Box>
                {ADMIN_ROLES.has(user?.role) && (
                  <Button component={RouterLink} to="/chat/moderation" size="small" startIcon={<GppMaybeIcon />}>
                    Moderation
                  </Button>
                )}
                <Tooltip title="Search in chat">
                  <IconButton onClick={() => setSearchOpen(true)} size="small">
                    <SearchIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Export transcript">
                  <IconButton onClick={exportChat} size="small">
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
              </Box>

              {isGroup && (meta?.participants || []).length > 0 && (
                <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 600 }}>
                    Members
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(meta.participants || []).map((p) => {
                      const pid = String(p.id ?? p._id);
                      const nm =
                        p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.email || 'Member';
                      const on = onlineMap[pid];
                      return (
                        <Chip
                          key={pid}
                          size="small"
                          label={nm}
                          variant={on ? 'filled' : 'outlined'}
                          color={on ? 'success' : 'default'}
                          sx={{ maxWidth: 200 }}
                        />
                      );
                    })}
                  </Box>
                </Box>
              )}

              {pinnedFromMeta && (
                <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PushPinIcon fontSize="small" color="action" />
                  <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                    {pinnedFromMeta.body || 'Pinned message'}
                  </Typography>
                  <Button size="small" onClick={() => ChatService.setPin(activeId, null).then(() => loadMeta(activeId))}>
                    Unpin
                  </Button>
                </Box>
              )}

              <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50' }}>
                {hasMore && (
                  <Button size="small" onClick={() => loadMessages(activeId, { before: messages[0]?.id, append: true })} sx={{ mb: 1 }}>
                    Load older
                  </Button>
                )}
                {loadingThread && !messages.length ? (
                  <CircularProgress size={28} />
                ) : (
                  messages.map((m, idx) => {
                    const mine = m.sender === String(meId);
                    const prev = messages[idx - 1];
                    const next = messages[idx + 1];
                    const showDay = !prev || formatDayLabel(prev.createdAt) !== formatDayLabel(m.createdAt);
                    const sameSenderNext =
                      next &&
                      String(next.sender) === String(m.sender) &&
                      formatDayLabel(next.createdAt) === formatDayLabel(m.createdAt);
                    const messageRowGap = sameSenderNext ? 0.5 : 1.15;
                    const bubbleBodySx = {
                      fontSize: '0.875rem',
                      lineHeight: 1.55,
                      letterSpacing: '0.01em'
                    };
                    const peerReadAt = meta?.peerReadMessageCreatedAt;
                    const isDark = theme.palette.mode === 'dark';
                    const outBg = isDark ? WA_OUT_DARK : WA_OUT_LIGHT;
                    const outFg = isDark ? WA_OUT_TEXT_DARK : WA_OUT_TEXT_LIGHT;
                    const outMuted = isDark ? WA_OUT_MUTED_DARK : WA_OUT_MUTED_LIGHT;
                    const outLink = isDark ? '#90CAF9' : WA_OUT_LINK_LIGHT;
                    const hasAttach = (m.attachments || []).length > 0;
                    const hasPreviews = (m.linkPreviews || []).length > 0;
                    const trimmedBody = (m.body || '').trim();
                    const useInlineTime =
                      !m.isDeletedForEveryone && !!trimmedBody && !hasAttach && !hasPreviews;
                    const readB =
                      peerReadAt && new Date(m.createdAt).getTime() <= new Date(peerReadAt).getTime();
                    const del = !!m.deliveredAt || !!readB;
                    const tickEl =
                      mine && !m.isDeletedForEveryone ? (
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.25 }}>
                          {String(m.id).startsWith('temp-') ? (
                            <DoneAllIcon sx={{ fontSize: 15, opacity: 0.4, color: outMuted }} />
                          ) : !del ? (
                            <DoneAllIcon sx={{ fontSize: 15, opacity: 0.45, color: outMuted }} />
                          ) : !readB ? (
                            <DoneAllIcon sx={{ fontSize: 15, opacity: 0.75, color: outMuted }} />
                          ) : (
                            <DoneAllIcon sx={{ fontSize: 15, color: WA_READ_TICK }} />
                          )}
                        </Box>
                      ) : null;
                    const captionMetaSx = {
                      opacity: 0.82,
                      color: mine ? outMuted : 'text.secondary',
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      letterSpacing: '0.02em'
                    };
                    const metaRight = (
                      <Box
                        component="span"
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        {m.editedAt && (
                          <Typography component="span" variant="caption" sx={captionMetaSx}>
                            edited
                          </Typography>
                        )}
                        <Typography component="span" variant="caption" sx={captionMetaSx}>
                          {formatMessageTime(m.createdAt)}
                        </Typography>
                        {tickEl}
                      </Box>
                    );

                    return (
                      <Box key={m.id}>
                        {showDay && (
                          <Typography align="center" variant="caption" color="text.secondary" sx={{ my: 1.25, display: 'block' }}>
                            {formatDayLabel(m.createdAt)}
                          </Typography>
                        )}
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: mine ? 'flex-end' : 'flex-start',
                            mb: messageRowGap
                          }}
                        >
                          <Paper
                            elevation={0}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              openMenu(e, m);
                            }}
                            sx={{
                              maxWidth: { xs: '90%', sm: 440, md: 520 },
                              px: { xs: 1.75, sm: 2 },
                              py: { xs: 1.125, sm: 1.25 },
                              borderRadius: '12px',
                              border: '1px solid',
                              borderColor: mine
                                ? isDark
                                  ? 'rgba(255,255,255,0.14)'
                                  : 'rgba(0,0,0,0.08)'
                                : 'divider',
                              boxShadow: mine
                                ? isDark
                                  ? '0 1px 2px rgba(0,0,0,0.35)'
                                  : '0 1px 2px rgba(0,0,0,0.06)'
                                : isDark
                                  ? '0 1px 0 rgba(255,255,255,0.04) inset'
                                  : '0 1px 2px rgba(0,0,0,0.04)',
                              bgcolor: mine ? outBg : isDark ? 'grey.800' : 'grey.50',
                              color: mine ? outFg : 'text.primary'
                            }}
                          >
                            {isGroup && (
                              <Typography
                                variant="caption"
                                component="div"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  mb: 0.75,
                                  lineHeight: 1.25,
                                  letterSpacing: '0.02em',
                                  color: mine ? outMuted : 'text.secondary'
                                }}
                              >
                                {mine ? 'You' : participantNameById.get(String(m.sender)) || 'Member'}
                              </Typography>
                            )}
                            {m.replyTo?.preview && (
                              <Box
                                sx={{
                                  mb: 0.5,
                                  pl: 1,
                                  borderLeft: 3,
                                  borderColor: mine ? (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)') : 'primary.main',
                                  opacity: 0.9
                                }}
                              >
                                <Typography variant="caption" fontWeight="bold" display="block">
                                  {m.replyTo.senderName}
                                </Typography>
                                <Typography variant="caption" noWrap>
                                  {m.replyTo.preview}
                                </Typography>
                              </Box>
                            )}
                            {m.isDeletedForEveryone ? (
                              <Typography
                                variant="body2"
                                fontStyle="italic"
                                sx={{ ...bubbleBodySx, color: mine ? outMuted : 'text.secondary' }}
                              >
                                This message was deleted
                              </Typography>
                            ) : (
                              <>
                                {useInlineTime ? (
                                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                                    <Typography
                                      variant="body2"
                                      component="div"
                                      sx={{
                                        ...bubbleBodySx,
                                        flex: 1,
                                        minWidth: 0,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        ...(mine
                                          ? {
                                              '& a': { color: outLink, fontWeight: 600, textDecoration: 'underline' }
                                            }
                                          : {
                                              '& a': { color: 'primary.main', fontWeight: 500 }
                                            })
                                      }}
                                    >
                                      {renderFormattedChatText(m.body, m.mentions)}
                                    </Typography>
                                    {metaRight}
                                  </Box>
                                ) : trimmedBody ? (
                                  <Typography
                                    variant="body2"
                                    component="div"
                                    sx={{
                                      ...bubbleBodySx,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      ...(mine
                                        ? {
                                            '& a': { color: outLink, fontWeight: 600, textDecoration: 'underline' }
                                          }
                                        : {
                                            '& a': { color: 'primary.main', fontWeight: 500 }
                                          })
                                    }}
                                  >
                                    {renderFormattedChatText(m.body, m.mentions)}
                                  </Typography>
                                ) : null}
                                {/* Mentions are rendered inline inside message body text; no duplicate chip row. */}
                                {(m.linkPreviews || []).map((lp) => (
                                  <Card key={lp.url} variant="outlined" sx={{ mt: 0.75, bgcolor: 'background.paper' }}>
                                    {lp.image ? (
                                      <CardMedia component="img" height="120" image={lp.image} alt="" sx={{ objectFit: 'cover' }} />
                                    ) : null}
                                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                                      <Typography variant="caption" color="text.secondary">
                                        {lp.siteName || 'Link'}
                                      </Typography>
                                      <Typography variant="subtitle2" component="a" href={lp.url} target="_blank" rel="noopener noreferrer">
                                        {lp.title || lp.url}
                                      </Typography>
                                      {lp.description ? (
                                        <Typography variant="caption" color="text.secondary" display="block">
                                          {lp.description.slice(0, 180)}
                                        </Typography>
                                      ) : null}
                                    </CardContent>
                                  </Card>
                                ))}
                              </>
                            )}
                            {(m.attachments || []).map((a) => (
                              <Box key={a.url} sx={{ mt: 0.5 }}>
                                <Box
                                  component="a"
                                  href={getImageUrl(a.url) || a.url}
                                  download={a.filename}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{ color: mine ? outLink : 'primary.main', fontWeight: 600 }}
                                >
                                  {a.filename || 'File'}
                                </Box>
                              </Box>
                            ))}
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mt: useInlineTime ? 0.35 : 0.5,
                                minHeight: 28,
                                gap: 0.5,
                                width: '100%',
                                borderTop: useInlineTime ? 'none' : '1px solid',
                                borderColor: useInlineTime ? 'transparent' : mine ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : 'divider',
                                pt: useInlineTime ? 0 : 0.5,
                                mx: useInlineTime ? 0 : { xs: -0.25, sm: -0.5 },
                                px: useInlineTime ? 0 : { xs: 0.25, sm: 0.5 }
                              }}
                            >
                              {mine ? (
                                <>
                                  {!useInlineTime && (
                                    <>
                                      <Box sx={{ flex: 1, minWidth: 4 }} />
                                      {metaRight}
                                    </>
                                  )}
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      flexShrink: 0,
                                      ...(useInlineTime ? { ml: 'auto' } : {})
                                    }}
                                  >
                                    {!m.isDeletedForEveryone && (
                                      <Tooltip title="Reply">
                                        <IconButton
                                          size="small"
                                          onClick={() =>
                                            setReplyTo({
                                              ...m,
                                              senderName: mine
                                                ? 'You'
                                                : (participantNameById.get(String(m.sender)) || 'User')
                                            })
                                          }
                                          sx={{ color: outMuted, p: 0.45 }}
                                        >
                                          <ReplyIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    <Tooltip title="React">
                                      <IconButton
                                        size="small"
                                        aria-label="pick emoji reaction"
                                        onClick={(e) => setEmojiMenu({ anchorEl: e.currentTarget, messageId: m.id })}
                                        sx={{ color: outMuted, p: 0.45 }}
                                      >
                                        <EmojiEmotionsIcon sx={{ fontSize: 18 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <IconButton
                                      size="small"
                                      onClick={() => ChatService.toggleStar(m.id).catch(console.error)}
                                      sx={{ color: outMuted, p: 0.45 }}
                                    >
                                      {m.isStarred ? <StarIcon sx={{ fontSize: 18 }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
                                    </IconButton>
                                  </Box>
                                </>
                              ) : (
                                <>
                                  <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                    {!m.isDeletedForEveryone && (
                                      <Tooltip title="Reply">
                                        <IconButton
                                          size="small"
                                          onClick={() =>
                                            setReplyTo({
                                              ...m,
                                              senderName: mine
                                                ? 'You'
                                                : (participantNameById.get(String(m.sender)) || 'User')
                                            })
                                          }
                                          sx={{ p: 0.45 }}
                                        >
                                          <ReplyIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    <Tooltip title="React">
                                      <IconButton
                                        size="small"
                                        aria-label="pick emoji reaction"
                                        onClick={(e) => setEmojiMenu({ anchorEl: e.currentTarget, messageId: m.id })}
                                        sx={{ p: 0.45 }}
                                      >
                                        <EmojiEmotionsIcon sx={{ fontSize: 18 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <IconButton
                                      size="small"
                                      onClick={() => ChatService.toggleStar(m.id).catch(console.error)}
                                      sx={{ p: 0.45 }}
                                    >
                                      {m.isStarred ? <StarIcon sx={{ fontSize: 18 }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
                                    </IconButton>
                                  </Box>
                                  {!useInlineTime && (
                                    <>
                                      <Box sx={{ flex: 1, minWidth: 4 }} />
                                      {metaRight}
                                    </>
                                  )}
                                </>
                              )}
                            </Box>
                            {(m.reactions || []).length > 0 && (
                              <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {Object.entries(
                                  (m.reactions || []).reduce((acc, r) => {
                                    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                    return acc;
                                  }, {})
                                ).map(([emoji, count]) => (
                                  <Chip
                                    key={emoji}
                                    size="small"
                                    label={`${emoji} ${count}`}
                                    variant="outlined"
                                    sx={
                                      mine
                                        ? {
                                            borderColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)',
                                            color: outFg
                                          }
                                        : undefined
                                    }
                                  />
                                ))}
                              </Box>
                            )}
                          </Paper>
                        </Box>
                      </Box>
                    );
                  })
                )}
                <div ref={listEndRef} />
                {typing && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                    Typing…
                  </Typography>
                )}
              </Box>

              {replyTo && (
                <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ReplyIcon fontSize="small" />
                  <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                    Replying to {(replyTo.body || '').slice(0, 120)}
                  </Typography>
                  <IconButton size="small" onClick={() => setReplyTo(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
              {editTarget && (
                <Box sx={{ px: 2, py: 1, bgcolor: 'warning.light', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EditIcon fontSize="small" />
                  <Typography variant="caption" sx={{ flex: 1 }}>
                    Editing message
                  </Typography>
                  <Button size="small" onClick={() => { setEditTarget(null); setDraft(''); }}>
                    Cancel
                  </Button>
                </Box>
              )}

              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <label htmlFor="chat-file-input">
                  <input hidden id="chat-file-input" type="file" onChange={onPickFile} />
                  <IconButton component="span" size="small">
                    <AttachFileIcon />
                  </IconButton>
                </label>
                <TextField
                  fullWidth
                  multiline
                  minRows={1}
                  maxRows={6}
                  size="small"
                  inputRef={composerRef}
                  placeholder={editTarget ? 'Edit message…' : 'Message… (@ to mention)'}
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={(e) => {
                    if (mentionOpen && mentionUsers.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setMentionHighlightIndex((idx) => (idx + 1) % mentionUsers.length);
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setMentionHighlightIndex((idx) => (idx - 1 + mentionUsers.length) % mentionUsers.length);
                        return;
                      }
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        const pick = mentionUsers[Math.max(0, Math.min(mentionHighlightIndex, mentionUsers.length - 1))];
                        if (pick) insertMention(pick);
                        return;
                      }
                    }
                    if (mentionOpen && e.key === 'Escape') {
                      e.preventDefault();
                      setMentionOpen(false);
                      return;
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendNow();
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton color="primary" onClick={sendNow} disabled={!draft.trim() && !editTarget}>
                          <SendIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
            </>
          )}
        </Paper>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuMsg) {
              navigator.clipboard.writeText(menuMsg.body || '');
            }
            closeMenu();
          }}
        >
          Copy text
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuMsg) setReplyTo({ ...menuMsg, senderName: meta?.otherUser?.fullName });
            closeMenu();
          }}
        >
          Reply
        </MenuItem>
        {menuMsg?.sender === String(meId) && !menuMsg?.isDeletedForEveryone && (
          <MenuItem
            onClick={() => {
              if (menuMsg) {
                setEditTarget(menuMsg);
                setDraft(menuMsg.body || '');
              }
              closeMenu();
            }}
          >
            Edit
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (menuMsg && activeId) ChatService.setPin(activeId, menuMsg.id).then(() => loadMeta(activeId));
            closeMenu();
          }}
        >
          Pin message
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuMsg) ChatService.deleteMessage(menuMsg.id, 'forMe').catch(console.error);
            closeMenu();
          }}
        >
          Delete for me
        </MenuItem>
        {menuMsg?.sender === String(meId) && (
          <MenuItem
            onClick={() => {
              if (menuMsg) ChatService.deleteMessage(menuMsg.id, 'forEveryone').catch(console.error);
              closeMenu();
            }}
          >
            Delete for everyone
          </MenuItem>
        )}
      </Menu>

      <Menu
        anchorEl={emojiMenu?.anchorEl || null}
        open={Boolean(emojiMenu?.anchorEl)}
        onClose={() => setEmojiMenu(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{ sx: { maxHeight: 360, width: 320 } }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.25, p: 1 }}>
          {EMOJI_PICKER_LIST.map((em) => (
            <IconButton
              key={em}
              size="small"
              sx={{ fontSize: '1.2rem', p: 0.5 }}
              onClick={() => {
                if (emojiMenu?.messageId) {
                  ChatService.toggleReaction(emojiMenu.messageId, em).catch(console.error);
                }
                setEmojiMenu(null);
              }}
            >
              {em}
            </IconButton>
          ))}
        </Box>
      </Menu>

      <Popover
        open={mentionOpen && !!composerRef.current}
        anchorEl={composerRef.current}
        onClose={() => setMentionOpen(false)}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <List dense sx={{ minWidth: 220, maxHeight: 240, overflow: 'auto' }}>
          {mentionUsers.map((u, idx) => (
            <ListItemButton
              key={u.id}
              selected={idx === mentionHighlightIndex}
              onMouseEnter={() => setMentionHighlightIndex(idx)}
              onClick={() => insertMention(u)}
            >
              <ListItemAvatar>
                <Avatar src={getImageUrl(u.profileImage)} sx={{ width: 28, height: 28 }}>
                  {(u.firstName || '?')[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={u.fullName || `${u.firstName} ${u.lastName}`}
                secondary={mentionQuery ? `@${mentionQuery}  ·  ${u.email}` : u.email}
              />
            </ListItemButton>
          ))}
        </List>
      </Popover>

      <Dialog open={groupDialog} onClose={() => setGroupDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>New group</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="dense"
            label="Group name"
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 1 }}>
            Select at least one member (you are added automatically).
          </Typography>
          <List dense sx={{ maxHeight: 280, overflow: 'auto' }}>
            {groupedGroupMembers.map((grp) => (
              <React.Fragment key={grp.department}>
                <ListSubheader disableSticky sx={{ bgcolor: 'action.hover', lineHeight: 1.9, fontWeight: 700 }}>
                  {grp.department}
                </ListSubheader>
                {grp.members.map((u) => (
                  <ListItemButton key={u.id} onClick={() => toggleGroupMember(u.id)} dense>
                    <Checkbox edge="start" checked={groupPick.includes(u.id)} tabIndex={-1} disableRipple />
                    <ListItemText primary={getEmployeeName(u)} secondary={u.email} />
                  </ListItemButton>
                ))}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGroupDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitGroup} disabled={!groupTitle.trim() || groupPick.length < 1}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New message</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="dense"
            placeholder="Search people…"
            value={dirSearch}
            onChange={(e) => setDirSearch(e.target.value)}
          />
          <List>
            {groupedDirectory.map((grp) => (
              <React.Fragment key={grp.department}>
                <ListSubheader disableSticky sx={{ bgcolor: 'action.hover', lineHeight: 1.9, fontWeight: 700 }}>
                  {grp.department}
                </ListSubheader>
                {grp.members.map((u) => (
                  <ListItemButton key={u.id} onClick={() => startWithUser(u.id)}>
                    <ListItemAvatar>
                      <Avatar src={getImageUrl(u.profileImage)} onError={handleImageError}>
                        {(u.firstName || '?')[0]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={getEmployeeName(u)} secondary={u.email} />
                  </ListItemButton>
                ))}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Search in conversation</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="dense"
            placeholder="Keyword…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
          <Button sx={{ mt: 1 }} onClick={runSearch}>
            Search
          </Button>
          <List dense>
            {searchHits.map((h) => (
              <ListItemButton key={h.id} onClick={() => { setSearchOpen(false); }}>
                <ListItemText primary={(h.body || '').slice(0, 160)} secondary={formatTime(h.createdAt)} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatPage;
