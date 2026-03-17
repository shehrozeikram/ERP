#!/usr/bin/env node
/**
 * Test script: Send WhatsApp message to 923495208895 (Muhammad Afzal)
 * Run: node scripts/test-whatsapp-send.js
 *
 * Tries in order:
 * 1. Plain text (always works if API is configured)
 * 2. hello_world template (common fallback)
 * 3. taj_discount_on_installments with en, en_US, en_GB
 */
require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: '.env.production' });
}

const axios = require('axios');

const TO = '923495208895'; // Muhammad Afzal
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

let toNumber = String(TO).replace(/\D/g, '');
if (toNumber.startsWith('0')) toNumber = toNumber.slice(1);
if (toNumber.length === 10 && toNumber.startsWith('3')) toNumber = '92' + toNumber;
else if (toNumber.length === 10) toNumber = '92' + toNumber;

async function send(payload, label) {
  try {
    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const msgId = res.data?.messages?.[0]?.id;
    return { ok: true, msgId };
  } catch (err) {
    const data = err.response?.data;
    const msg = data?.error?.message || data?.error?.error_data?.details || err.message;
    return { ok: false, error: msg };
  }
}

async function main() {
  console.log('📤 Sending to Muhammad Afzal', toNumber);
  console.log('');

  // 1. Plain text
  console.log('1. Trying plain text...');
  const textRes = await send(
    {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'text',
      text: { body: 'Test from SGC ERP – WhatsApp API is working. (Muhammad Afzal)' }
    },
    'text'
  );
  if (textRes.ok) {
    console.log('   ✅ Sent! messageId:', textRes.msgId);
  } else {
    console.log('   ❌ Failed:', textRes.error);
  }
  console.log('');

  // 2. hello_world template
  console.log('2. Trying hello_world template (en_US)...');
  const helloRes = await send(
    {
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'template',
      template: { name: 'hello_world', language: { code: 'en_US' } }
    },
    'hello_world'
  );
  if (helloRes.ok) {
    console.log('   ✅ Sent! messageId:', helloRes.msgId);
  } else {
    console.log('   ❌ Failed:', helloRes.error);
  }
  console.log('');

  // 3. taj_discount_on_installments – try different language codes
  const langCodes = ['en', 'en_US', 'en_GB'];
  for (const code of langCodes) {
    console.log(`3. Trying taj_discount_on_installments (${code})...`);
    const tajRes = await send(
      {
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'template',
        template: {
          name: 'taj_discount_on_installments',
          language: { code },
          components: [
            {
              type: 'header',
              parameters: [
                {
                  type: 'image',
                  image: { link: 'https://itihaasbuilders.com/images/marketing/image.jpeg' }
                }
              ]
            }
          ]
        }
      },
      `taj_${code}`
    );
    if (tajRes.ok) {
      console.log('   ✅ Sent! messageId:', tajRes.msgId);
      console.log('');
      console.log(`   Use language code "${code}" in Recovery Campaigns for taj_discount_on_installments.`);
      break;
    } else {
      console.log('   ❌ Failed:', tajRes.error);
    }
  }

  console.log('');
  console.log('Done. Check WhatsApp on', toNumber, 'for received messages.');
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
