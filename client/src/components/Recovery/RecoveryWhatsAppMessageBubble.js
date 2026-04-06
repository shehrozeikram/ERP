import React from 'react';
import { Box, Typography, Tooltip, IconButton } from '@mui/material';
import {
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  DeleteOutline as DeleteOutlineIcon,
  AttachFile as AttachFileIcon,
  Done as DoneIcon,
  DoneAll as DoneAllIcon
} from '@mui/icons-material';

function toReadableTemplateText(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  return text
    .replace(/\(.*?\)\s*$/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Split stored message into quoted preview (WhatsApp-style) and main body. */
export function parseQuotedReply(m) {
  const rt = m?.replyToText;
  if (rt != null && String(rt).trim()) {
    return {
      quoted: String(rt).trim(),
      bodyText: String(m?.text || '').trim()
    };
  }
  const raw = String(m?.text || '').trim();
  const legacy = /^Replying to:\s*"([\s\S]*?)"\s*\n([\s\S]*)$/i.exec(raw);
  if (legacy) {
    return { quoted: legacy[1].trim(), bodyText: legacy[2].trim() };
  }
  return { quoted: null, bodyText: raw };
}

function getBubbleText(m) {
  const raw = String(m?.text || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('[Campaign]')) return raw;
  const campaignRaw = raw.replace(/^\[Campaign\]\s*/i, '').trim();
  if (!campaignRaw) return 'Campaign message sent';
  // If this is natural sentence text, keep it exactly as stored.
  if (!/[_-]/.test(campaignRaw)) return campaignRaw;
  const parts = campaignRaw.split('·').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${toReadableTemplateText(parts[0])}: ${toReadableTemplateText(parts[1])}`;
  }
  return toReadableTemplateText(parts[0] || campaignRaw);
}

/**
 * Single bubble for recovery WhatsApp thread (My Tasks / Assignments / Completed).
 * Hover shows Reply / Forward / Delete like WhatsApp Web.
 */
export default function RecoveryWhatsAppMessageBubble({
  m,
  idx,
  showReply = true,
  showReadReceipts = true,
  onReply,
  onForward,
  onDelete
}) {
  const isCampaign =
    Boolean(m?.isCampaignStub) ||
    (typeof m?.text === 'string' && m.text.trim().startsWith('[Campaign]'));
  const isOutgoing = m.direction === 'out';
  const { quoted, bodyText } = parseQuotedReply(m);
  const bubbleText = getBubbleText({ ...m, text: bodyText });
  const canDelete =
    isOutgoing &&
    !m?.isCampaignStub &&
    m?._id &&
    !String(m._id).startsWith('stub-campaign');
  const deleteTooltip = canDelete
    ? "Remove from your team chat only — does not delete on the customer's WhatsApp"
    : m.direction === 'in'
      ? "Customer messages can't be removed from this view"
      : 'Cannot delete';
  return (
    <Box
      sx={{
        alignSelf: m.direction === 'out' ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        px: 1.5,
        py: 1,
        borderRadius: 2,
        borderTopRightRadius: m.direction === 'out' ? 0.5 : 2,
        borderTopLeftRadius: m.direction === 'in' ? 0.5 : 2,
        bgcolor: m.direction === 'out' ? (isCampaign ? '#c8e6c9' : '#DCF8C6') : 'white',
        boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
        '&:hover .wa-msg-actions': { opacity: 1 }
      }}
    >
      {isCampaign && m.direction === 'out' && (
        <Typography variant="caption" sx={{ display: 'block', color: 'success.dark', fontWeight: 700, mb: 0.5 }}>
          Campaign
        </Typography>
      )}
      {quoted && (
        <Box
          sx={{
            mb: 1,
            pl: 1,
            borderLeft: '3px solid',
            borderColor: m.direction === 'out' ? 'rgba(11, 20, 26, 0.28)' : '#8696a0',
            bgcolor: m.direction === 'out' ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.04)',
            borderRadius: '0 6px 6px 0',
            py: 0.5,
            pr: 0.75,
            maxWidth: '100%'
          }}
        >
          <Typography
            variant="body2"
            sx={{
              wordBreak: 'break-word',
              color: 'text.secondary',
              fontSize: '0.8125rem',
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {quoted}
          </Typography>
        </Box>
      )}
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
              if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
            }}
          />
          <Box sx={{ display: 'none', alignItems: 'center', gap: 0.5 }}>
            <AttachFileIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography
              component="a"
              href={m.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              sx={{ color: 'primary.main', textDecoration: 'underline' }}
            >
              View image
            </Typography>
          </Box>
          {bubbleText && (
            <Typography variant="body2" sx={{ wordBreak: 'break-word', mt: 0.5 }}>
              {bubbleText}
            </Typography>
          )}
        </Box>
      ) : m.mediaUrl && m.mediaType === 'video' ? (
        <Box>
          <Box component="video" src={m.mediaUrl} controls sx={{ maxWidth: 260, maxHeight: 200, borderRadius: 1, display: 'block' }} />
          {bubbleText && (
            <Typography variant="body2" sx={{ wordBreak: 'break-word', mt: 0.5 }}>
              {bubbleText}
            </Typography>
          )}
        </Box>
      ) : m.mediaUrl && m.mediaType === 'audio' ? (
        <Box>
          <Box component="audio" src={m.mediaUrl} controls sx={{ maxWidth: 260, display: 'block' }} />
          {bubbleText && (
            <Typography variant="body2" sx={{ wordBreak: 'break-word', mt: 0.5 }}>
              {bubbleText}
            </Typography>
          )}
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
            {bubbleText && (
              <Typography variant="body2" sx={{ wordBreak: 'break-word', mt: 0.25 }}>
                {bubbleText}
              </Typography>
            )}
          </Box>
        </Box>
      ) : (
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          {bubbleText || (quoted ? '' : '(media)')}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25, mt: 0.25, flexWrap: 'wrap' }}>
        <Box
          className="wa-msg-actions"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            opacity: 0,
            transition: 'opacity 0.15s ease',
            mr: 0.25
          }}
        >
          {showReply && (
            <Tooltip title="Reply">
              <IconButton size="small" sx={{ p: 0.25 }} onClick={() => onReply?.(m)}>
                <ReplyIcon sx={{ fontSize: 14, opacity: 0.75 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Forward (copy text)">
            <IconButton size="small" sx={{ p: 0.25 }} onClick={() => onForward?.(m)}>
              <ForwardIcon sx={{ fontSize: 14, opacity: 0.75 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={deleteTooltip}>
            <span>
              <IconButton size="small" sx={{ p: 0.25 }} disabled={!canDelete} onClick={() => onDelete?.(m)}>
                <DeleteOutlineIcon sx={{ fontSize: 14, opacity: canDelete ? 0.75 : 0.35 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Typography variant="caption" sx={{ opacity: 0.7, lineHeight: 1 }}>
          {m.time ? new Date(m.time).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '—'}
        </Typography>
        {showReadReceipts && m.direction === 'out' &&
          (m.status === 'read' ? (
            <DoneAllIcon sx={{ fontSize: 14, color: '#53bdeb' }} />
          ) : m.status === 'delivered' ? (
            <DoneAllIcon sx={{ fontSize: 14, color: 'rgba(0,0,0,0.45)' }} />
          ) : m.status === 'sending' ? (
            <DoneIcon sx={{ fontSize: 14, color: 'rgba(0,0,0,0.3)' }} />
          ) : (
            <DoneIcon sx={{ fontSize: 14, color: 'rgba(0,0,0,0.45)' }} />
          ))}
      </Box>
    </Box>
  );
}
