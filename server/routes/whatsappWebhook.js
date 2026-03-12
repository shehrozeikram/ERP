/**
 * WhatsApp Cloud API Webhook
 * - GET: Meta verification (hub.verify_token, hub.challenge)
 * - POST: Incoming message events
 * Register: Meta for Developers → Your App → WhatsApp → Configuration
 * Set callback URL: https://yourdomain.com/api/webhooks/whatsapp
 * Set verify token: same as WHATSAPP_WEBHOOK_VERIFY_TOKEN in .env
 */
const express = require('express');
const router = express.Router();
const WhatsAppIncomingMessage = require('../models/finance/WhatsAppIncomingMessage');

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'sgc_whatsapp_verify_2025';

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp Webhook] Verified successfully');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Verification failed');
  }
});

router.post('/', async (req, res) => {
  res.status(200).send('OK');

  const body = req.body;
  console.log('[WhatsApp Webhook] POST received, object:', body?.object, 'keys:', body ? Object.keys(body) : []);

  let messages = [];
  if (body?.object === 'whatsapp_business_account' && body?.entry?.length) {
    for (const entry of body.entry) {
      for (const change of entry?.changes || []) {
        if (change?.field === 'messages' && change?.value?.messages?.length) {
          messages = messages.concat(change.value.messages);
        }
      }
    }
  }
  if (!messages.length && Array.isArray(body?.messages)) {
    messages = body.messages;
  }

  for (const msg of messages) {
    const from = msg?.from;
    const id = msg?.id;
    const type = msg?.type || 'unknown';
    let text = '';
    if (type === 'text') text = msg?.text?.body || '';
    if (type === 'button') text = msg?.button?.text || msg?.interactive?.button_reply?.title || '';

    console.log('[WhatsApp Incoming]', { from, id, type, text: text?.slice(0, 80) });

    try {
      await WhatsAppIncomingMessage.create({
        from,
        messageId: id,
        type,
        text,
        rawPayload: msg,
        receivedAt: new Date(Number(msg.timestamp) * 1000 || Date.now())
      });
    } catch (err) {
      console.error('[WhatsApp Webhook] Failed to save message:', err.message);
    }
  }
});

module.exports = router;
