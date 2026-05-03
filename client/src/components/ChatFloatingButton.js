import React, { useEffect, useState } from 'react';
import { Fab, Badge, Zoom } from '@mui/material';
import { Chat as ChatIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChatService from '../services/chatService';

const ChatFloatingButton = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  const hidden = !isAuthenticated || location.pathname.startsWith('/chat');

  useEffect(() => {
    if (!isAuthenticated || hidden) return undefined;
    let cancelled = false;
    const load = () => {
      ChatService.getUnreadSummary()
        .then((n) => {
          if (!cancelled) setUnread(typeof n === 'number' ? n : 0);
        })
        .catch(() => {
          if (!cancelled) setUnread(0);
        });
    };
    load();
    const t = setInterval(load, 90000);
    const onChatRead = () => load();
    window.addEventListener('sgc:chat-unread-changed', onChatRead);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener('sgc:chat-unread-changed', onChatRead);
    };
  }, [isAuthenticated, hidden, location.pathname]);

  if (hidden) return null;

  return (
    <Zoom in>
      <Fab
        color="primary"
        aria-label="open chat"
        onClick={() => navigate('/chat')}
        sx={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: (theme) => theme.zIndex.drawer + 2
        }}
      >
        <Badge color="error" badgeContent={unread > 0 ? unread : 0} max={99} invisible={!unread}>
          <ChatIcon />
        </Badge>
      </Fab>
    </Zoom>
  );
};

export default ChatFloatingButton;
