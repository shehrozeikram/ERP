#!/usr/bin/env node
/**
 * Test script: Send a WhatsApp message to 923214554035 (or 03214554035)
 * Run: node scripts/test-whatsapp-send.js
 * For production token: NODE_ENV=production node scripts/test-whatsapp-send.js
 */
require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: '.env.production' });
}

const axios = require('axios');

const TO = '923214554035'; // 03214554035 normalized
const BODY = 'Test reply from SGC ERP – if you receive this, the reply feature is working.';
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

if (!TOKEN) {
  console.error('❌ WHATSAPP_ACCESS_TOKEN not set in .env');
  process.exit(1);
}
if (!PHONE_ID) {
  console.error('❌ WHATSAPP_PHONE_NUMBER_ID not set in .env');
  process.exit(1);
}

const url = `https://graph.facebook.com/v24.0/${PHONE_ID}/messages`;

// Normalize: ensure 923214554035 format for Pakistan
let toNumber = String(TO).replace(/\D/g, '');
if (toNumber.startsWith('0')) toNumber = toNumber.slice(1);
if (toNumber.length === 10 && toNumber.startsWith('3')) toNumber = '92' + toNumber;
else if (toNumber.length === 10) toNumber = '92' + toNumber;

const payload = {
  messaging_product: 'whatsapp',
  to: toNumber,
  type: 'text',
  text: { body: BODY }
};

console.log('📤 Sending test message to', toNumber, '...');

axios
  .post(url, payload, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  })
  .then((res) => {
    const msgId = res.data?.messages?.[0]?.id;
    console.log('✅ Sent! messageId:', msgId);
    console.log('   Check WhatsApp on', toNumber, 'to confirm receipt.');
  })
  .catch((err) => {
    console.error('❌ Send failed:', err.response?.data || err.message);
    process.exit(1);
  });
