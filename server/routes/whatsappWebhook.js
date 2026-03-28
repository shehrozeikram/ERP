/**
 * WhatsApp Cloud API Webhook
 * - GET: Meta verification (hub.verify_token, hub.challenge)
 * - POST: Incoming message events
 * Register: Meta for Developers → Your App → WhatsApp → Configuration
 * Set callback URL: https://yourdomain.com/api/webhooks/whatsapp
 * Set verify token: same as WHATSAPP_WEBHOOK_VERIFY_TOKEN in .env
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const router = express.Router();
const WhatsAppIncomingMessage = require('../models/finance/WhatsAppIncomingMessage');
const WhatsAppOutgoingMessage = require('../models/finance/WhatsAppOutgoingMessage');

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'sgc_whatsapp_verify_2025';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

// Media types sent in webhook payload and their folder-safe names
const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'];

const whatsappMediaDir = path.join(__dirname, '../uploads/whatsapp-media');
if (!fs.existsSync(whatsappMediaDir)) fs.mkdirSync(whatsappMediaDir, { recursive: true });

/**
 * Resolve a Meta media_id → download the file → save locally → return local path info.
 * Meta media download URLs expire quickly and require Bearer auth, so we must
 * download at webhook time and serve from our own storage.
 */
async function downloadMetaMedia(mediaId, mimeType) {
  if (!WHATSAPP_ACCESS_TOKEN || !mediaId) return null;
  try {
    // Step 1: Get the temporary download URL from Meta
    const infoRes = await axios.get(`https://graph.facebook.com/v24.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` }
    });
    const downloadUrl = infoRes.data?.url;
    if (!downloadUrl) return null;

    // Step 2: Download the binary from Meta (with auth)
    const ext = mimeTypeToExt(mimeType);
    const filename = `wa_in_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(whatsappMediaDir, filename);

    const fileRes = await axios.get(downloadUrl, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      responseType: 'stream'
    });

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filePath);
      fileRes.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return { filename, filePath };
  } catch (err) {
    console.error('[WhatsApp Webhook] Media download failed:', err.message);
    return null;
  }
}

function mimeTypeToExt(mime) {
  if (!mime) return '.bin';
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'video/mp4': '.mp4', 'video/3gpp': '.3gp',
    'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a',
    'audio/amr': '.amr', 'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'image/webp': '.webp'
  };
  return map[mime.toLowerCase()] || '.' + (mime.split('/')[1] || 'bin').split(';')[0].trim();
}

function getMediaTypeLabel(type) {
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  if (type === 'audio' || type === 'voice') return 'audio';
  return 'document';
}

function getPublicBaseUrl() {
  return (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`).replace(/\/$/, '');
}

router.get('/', (req, res) => {
  const mode = (req.query['hub.mode'] || '').trim();
  const token = (req.query['hub.verify_token'] || '').trim();
  const challenge = req.query['hub.challenge'];

  const expectedToken = (VERIFY_TOKEN || '').trim();
  const tokenMatch = expectedToken && token === expectedToken;

  if (mode === 'subscribe' && tokenMatch && challenge != null) {
    console.log('[WhatsApp Webhook] Verified successfully');
    res.type('text/plain').status(200).send(String(challenge));
  } else {
    console.log('[WhatsApp Webhook] Verification failed', { mode, tokenPresent: !!token, tokenMatch, hasChallenge: challenge != null });
    res.status(403).send('Verification failed');
  }
});

router.post('/', async (req, res) => {
  res.status(200).send('OK');

  const body = req.body;
  console.log('[WhatsApp Webhook] POST received, object:', body?.object, 'keys:', body ? Object.keys(body) : []);

  let messages = [];
  let statuses = [];

  if (body?.object === 'whatsapp_business_account' && body?.entry?.length) {
    for (const entry of body.entry) {
      for (const change of entry?.changes || []) {
        if (change?.field === 'messages') {
          if (change?.value?.messages?.length) messages = messages.concat(change.value.messages);
          if (change?.value?.statuses?.length) statuses = statuses.concat(change.value.statuses);
        }
      }
    }
  }
  if (!messages.length && Array.isArray(body?.messages)) messages = body.messages;

  // Process delivery/read status updates for outgoing messages
  // Meta sends: sent → delivered → read in order, each as a separate webhook call
  const STATUS_ORDER = { sending: 0, sent: 1, delivered: 2, read: 3 };
  for (const s of statuses) {
    const wamid = s?.id;
    const newStatus = s?.status; // 'sent' | 'delivered' | 'read' | 'failed'
    if (!wamid || !newStatus) continue;
    try {
      const existing = await WhatsAppOutgoingMessage.findOne({ messageId: wamid }).select('status').lean();
      // Only advance status forward — never go backwards (e.g. ignore 'sent' after 'read')
      if (existing && (STATUS_ORDER[newStatus] ?? -1) > (STATUS_ORDER[existing.status] ?? -1)) {
        await WhatsAppOutgoingMessage.updateOne(
          { messageId: wamid },
          { $set: { status: newStatus, statusUpdatedAt: new Date(Number(s.timestamp) * 1000 || Date.now()) } }
        );
        console.log('[WhatsApp Status]', wamid, '→', newStatus);
      }
    } catch (err) {
      console.error('[WhatsApp Webhook] Status update failed:', err.message);
    }
  }

  for (const msg of messages) {
    const from = msg?.from;
    const id = msg?.id;
    const type = msg?.type || 'unknown';

    let text = '';
    if (type === 'text') text = msg?.text?.body || '';
    if (type === 'button') text = msg?.button?.text || msg?.interactive?.button_reply?.title || '';

    // Extract media info for image / video / audio / document / sticker / voice
    let mediaUrl = null;
    let mediaType = null;
    let mediaFilename = null;

    const mediaPayloadKey = MEDIA_TYPES.includes(type) ? type : (type === 'voice' ? 'audio' : null);
    if (mediaPayloadKey) {
      const mediaMeta = msg[type] || msg[mediaPayloadKey] || {};
      const metaMediaId = mediaMeta.id;
      const mimeType = mediaMeta.mime_type || '';
      mediaFilename = mediaMeta.filename || null;

      console.log('[WhatsApp Incoming]', { from, id, type, metaMediaId, mimeType });

      if (metaMediaId) {
        const downloaded = await downloadMetaMedia(metaMediaId, mimeType);
        if (downloaded) {
          const base = getPublicBaseUrl();
          // Public /api/whatsapp-media/ path — no auth, nginx always proxies /api/ reliably
          mediaUrl = `${base}/api/whatsapp-media/${downloaded.filename}`;
          mediaType = getMediaTypeLabel(type);
          if (!mediaFilename) mediaFilename = downloaded.filename;
        }
      }
    } else {
      console.log('[WhatsApp Incoming]', { from, id, type, text: text?.slice(0, 80) });
    }

    try {
      await WhatsAppIncomingMessage.create({
        from,
        messageId: id,
        type,
        text,
        mediaUrl,
        mediaType,
        mediaFilename,
        rawPayload: msg,
        receivedAt: new Date(Number(msg.timestamp) * 1000 || Date.now())
      });
    } catch (err) {
      console.error('[WhatsApp Webhook] Failed to save message:', err.message);
    }
  }
});

module.exports = router;
