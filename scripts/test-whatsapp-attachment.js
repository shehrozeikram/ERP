#!/usr/bin/env node
/**
 * Test script: Send WhatsApp image attachment to 923441518890
 * Run: node scripts/test-whatsapp-attachment.js
 *
 * Uses a public image URL (Meta must be able to fetch it).
 * If this succeeds, attachment sending works; deploy and test with your upload flow.
 */
require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: '.env.production' });
}

const axios = require('axios');

const TO = '923441518890';
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const IMAGE_URL = 'https://itihaasbuilders.com/images/marketing/image.jpeg';

if (!TOKEN) {
  console.error('❌ WHATSAPP_ACCESS_TOKEN not set in .env');
  process.exit(1);
}
if (!PHONE_ID) {
  console.error('❌ WHATSAPP_PHONE_NUMBER_ID not set in .env');
  process.exit(1);
}

const apiUrl = `https://graph.facebook.com/v24.0/${PHONE_ID}/messages`;

let toNumber = String(TO).replace(/\D/g, '');
if (toNumber.startsWith('0')) toNumber = toNumber.slice(1);
if (toNumber.length === 10 && toNumber.startsWith('3')) toNumber = '92' + toNumber;
else if (toNumber.length === 10) toNumber = '92' + toNumber;

const payload = {
  messaging_product: 'whatsapp',
  to: toNumber,
  type: 'image',
  image: {
    link: IMAGE_URL,
    caption: 'Test attachment from SGC ERP – if you receive this, attachment sending works.'
  }
};

console.log('📤 Sending image attachment to', toNumber);
axios
  .post(apiUrl, payload, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  })
  .then((res) => {
    const msgId = res.data?.messages?.[0]?.id;
    console.log('✅ Sent! messageId:', msgId);
    console.log('   Check WhatsApp on', toNumber, 'for the image.');
  })
  .catch((err) => {
    const data = err.response?.data?.error;
    const msg = data?.message || data?.error_data?.details || err.message;
    console.error('❌ Failed:', msg);
    process.exit(1);
  });
