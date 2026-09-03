/**
 * approvalWhatsAppNotifier.js
 * Utility to send WhatsApp approval notifications to approvers when a document is routed to them.
 * Sends the Meta approved template 'test_approval' via Meta Graph API, normalizes Pakistani phone numbers,
 * and records outbound messages in the WhatsAppOutgoingMessage collection.
 */
const axios = require('axios');
const User = require('../models/User');
const WhatsAppOutgoingMessage = require('../models/finance/WhatsAppOutgoingMessage');

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '955563940979265';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

function normalizePhone(raw) {
  let p = (raw && String(raw).replace(/\D/g, '')) || '';
  if (!p) return null;
  if (p.startsWith('0')) p = p.slice(1);
  if (p.length === 10 && p.startsWith('3')) p = '92' + p;
  else if (p.length === 10) p = '92' + p;
  return p.length >= 11 ? p : null;
}

/**
 * Notify one or many approvers by WhatsApp.
 * @param {string|string[]|object[]} userIds - User ID, array of IDs, or User objects
 * @param {{ docType?: string, docNumber?: string, amount?: number, message?: string }} context
 */
async function notifyApprovers(userIds, context = {}) {
  try {
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.warn('[ApprovalWA] WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing.');
      return;
    }

    const rawIds = Array.isArray(userIds) ? userIds : [userIds];
    const ids = rawIds
      .map((item) => (item && typeof item === 'object' ? item._id || item.id : item))
      .filter(Boolean);

    if (!ids.length) return;

    const users = await User.find({ _id: { $in: ids } }).select('phone firstName lastName').lean();
    if (!users.length) return;

    const docType = context.docType || 'Document';
    const docNumber = context.docNumber || '';
    const docInfo = [docType, docNumber].filter(Boolean).join(' ');
    const graphUrl = `https://graph.facebook.com/v24.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const headers = {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    };

    for (const u of users) {
      const phone = normalizePhone(u.phone);
      if (!phone) {
        console.warn(`[ApprovalWA] Invalid phone for user ${u.firstName || u._id}: ${u.phone}`);
        continue;
      }

      // Send approved Meta template 'test_approval'
      const templatePayload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: 'test_approval',
          language: { code: 'en' }
        }
      };

      try {
        const apiRes = await axios.post(graphUrl, templatePayload, { headers });
        const messageId = apiRes.data?.messages?.[0]?.id || null;
        console.log(`[ApprovalWA] Successfully sent test_approval to ${u.firstName || ''} (${phone}), messageId: ${messageId}`);

        // Record outgoing message in DB for tracking
        await WhatsAppOutgoingMessage.create({
          to: phone,
          text: `[Approval Notification] ${docInfo || 'Pending Document'}`,
          messageId,
          sentAt: new Date(),
          sentBy: u._id,
          status: messageId ? 'sent' : 'sending',
          statusUpdatedAt: new Date()
        }).catch((dbErr) => console.warn('[ApprovalWA] DB record warning:', dbErr.message));

      } catch (sendErr) {
        const errDetail = sendErr.response?.data?.error?.message || sendErr.message;
        console.error(`[ApprovalWA] Send failed for ${u.firstName || ''} (${phone}): ${errDetail}`);
      }
    }
  } catch (err) {
    console.error('[ApprovalWA] Error in notifyApprovers:', err.message);
  }
}

module.exports = { notifyApprovers };



