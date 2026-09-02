/**
 * approvalWhatsAppNotifier.js
 * Reusable utility - send WhatsApp notification to approvers when a document is routed to them.
 * Uses test_approval template (Utility). Tomorrow: add variables once Meta template is updated.
 */
const axios = require('axios');
const User  = require('../models/User');

const WA_PHONE_ID   = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WA_TOKEN      = process.env.WHATSAPP_ACCESS_TOKEN    || '';
const TEMPLATE_NAME = 'test_approval';
const TEMPLATE_LANG = 'en';
const GRAPH_URL     = `https://graph.facebook.com/v24.0/${WA_PHONE_ID}/messages`;

function normalisePhone(raw) {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = p.slice(1);
  if (p.length === 10 && p.startsWith('3')) p = '92' + p;
  return p.length >= 11 ? p : null;
}

/**
 * Notify one or many approvers by WhatsApp.
 * @param {string|string[]} userIds
 * @param {{ docType?: string, docNumber?: string, amount?: number }} context
 */
async function notifyApprovers(userIds, context = {}) {
  if (!WA_TOKEN || !WA_PHONE_ID) return;
  const ids = [].concat(userIds).filter(Boolean);
  if (!ids.length) return;

  const users = await User.find({ _id: { $in: ids } }).select('phone firstName').lean();
  const headers = { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' };

  for (const u of users) {
    const phone = normalisePhone(u.phone);
    if (!phone) { console.warn(`[ApprovalWA] No phone — ${u.firstName}`); continue; }
    try {
      await axios.post(GRAPH_URL, {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: { name: TEMPLATE_NAME, language: { code: TEMPLATE_LANG } }
        // Add components with variables here tomorrow once Meta template is updated
      }, { headers });
      console.log(`[ApprovalWA] Notified ${u.firstName} (${phone}) — ${context.docType || ''} ${context.docNumber || ''}`);
    } catch (err) {
      console.error(`[ApprovalWA] Failed for ${phone}:`, err.response?.data || err.message);
    }
  }
}

module.exports = { notifyApprovers };
