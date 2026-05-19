const axios = require('axios');
const RecoveryAssignment = require('../models/finance/RecoveryAssignment');
const WhatsAppOutgoingMessage = require('../models/finance/WhatsAppOutgoingMessage');
const { recordRecoveryOutboundActivity } = require('./recoveryWhatsAppActivity');

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

/**
 * Core WhatsApp send (single recipient). Used by routes and auto follow-up cron.
 * @returns {Promise<{ ok: true, data, sentAs, messageId, toNumber } | { ok: false, message, statusCode, toNumber }>}
 */
async function executeRecoveryWhatsAppSend(payload, user, options = {}) {
  const { isAutoFollowUp = false } = options;
  const {
    to,
    body: textBody,
    template,
    assignmentId,
    campaignName,
    campaignMessage,
    campaignId,
    mediaType,
    mediaUrl,
    mediaId,
    replyToText,
    replyToMessageId
  } = payload || {};
  let phone = (to && String(to).replace(/\D/g, '')) || '923214554035';
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (phone.length === 10 && phone.startsWith('3')) phone = '92' + phone;
  else if (phone.length === 10) phone = '92' + phone;
  const toNumber = phone;
  const token = WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, message: 'WhatsApp access token not configured (WHATSAPP_ACCESS_TOKEN)', statusCode: 500, toNumber };
  }
  const graphUrl = `https://graph.facebook.com/v24.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const messageBody = textBody != null ? String(textBody).trim() : '';

  const sendPayload = (graphBody) =>
    axios.post(graphUrl, graphBody, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

  const tajDiscountPayload = {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'template',
    template: {
      name: 'taj_discount_on_installments',
      language: { code: 'en' },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: {
                link: 'https://itihaasbuilders.com/images/marketing/image.jpeg'
              }
            }
          ]
        }
      ]
    }
  };

  const helloWorldPayload = {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'template',
    template: { name: 'hello_world', language: { code: 'en_US' } }
  };

  const textPayload = {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'text',
    text: { body: messageBody }
  };

  try {
    let graphBody;
    let sentAs = 'template';

    if (campaignId) {
      const RecoveryCampaign = require('../models/finance/RecoveryCampaign');
      const campaign = await RecoveryCampaign.findById(campaignId).lean();
      if (campaign && campaign.whatsappTemplateName) {
        const langCode = (campaign.whatsappLanguageCode || '').trim() || 'en';
        const tplName = campaign.whatsappTemplateName;
        const tpl = { name: tplName, language: { code: langCode } };
        if (tplName === 'taj_discount_on_installments') {
          tpl.components = [
            {
              type: 'header',
              parameters: [{ type: 'image', image: { link: 'https://itihaasbuilders.com/images/marketing/image.jpeg' } }]
            }
          ];
        }
        graphBody = {
          messaging_product: 'whatsapp',
          to: toNumber,
          type: 'template',
          template: tpl
        };
        sentAs = tplName;
      }
    }

    if (!graphBody && mediaType && (mediaId || mediaUrl)) {
      const mediaTypeLower = String(mediaType).toLowerCase();
      const mediaRef = mediaId ? { id: String(mediaId) } : { link: String(mediaUrl).trim() };
      const payloads = {
        image: { messaging_product: 'whatsapp', to: toNumber, type: 'image', image: { ...mediaRef, ...(messageBody && { caption: messageBody }) } },
        document: { messaging_product: 'whatsapp', to: toNumber, type: 'document', document: { ...mediaRef, ...(messageBody && { caption: messageBody }) } },
        audio: { messaging_product: 'whatsapp', to: toNumber, type: 'audio', audio: { ...mediaRef } },
        video: { messaging_product: 'whatsapp', to: toNumber, type: 'video', video: { ...mediaRef, ...(messageBody && { caption: messageBody }) } }
      };
      graphBody = payloads[mediaTypeLower] || payloads.document;
      sentAs = mediaTypeLower;
    }

    if (!graphBody) {
      if (template === 'taj_discount_on_installments') {
        graphBody = tajDiscountPayload;
        sentAs = 'taj_discount_on_installments';
      } else if (messageBody) {
        graphBody = textPayload;
        sentAs = 'text';
      } else {
        graphBody = helloWorldPayload;
      }
    }

    const apiRes = await sendPayload(graphBody);
    const data = apiRes.data;
    const messageId = data?.messages?.[0]?.id || null;
    console.log('[WhatsApp] Sent to', toNumber, 'messageId:', messageId, 'sentAs:', sentAs);

    if (sentAs === 'text' || ['image', 'document', 'audio', 'video'].includes(sentAs)) {
      const displayText = messageBody || (sentAs === 'text' ? '' : `(${sentAs})`);
      const createPayload = {
        to: toNumber,
        text: displayText,
        messageId,
        sentAt: new Date(),
        sentBy: user?._id,
        status: messageId ? 'sent' : 'sending',
        statusUpdatedAt: new Date()
      };
      if (replyToText != null && String(replyToText).trim()) {
        createPayload.replyToText = String(replyToText).trim().slice(0, 2000);
      }
      if (replyToMessageId != null && String(replyToMessageId).trim()) {
        createPayload.replyToMessageId = String(replyToMessageId).trim().slice(0, 128);
      }
      if (sentAs !== 'text') {
        if (mediaUrl) createPayload.mediaUrl = String(mediaUrl).trim();
        createPayload.mediaType = String(sentAs);
      }
      await WhatsAppOutgoingMessage.create(createPayload);
    } else {
      const RecoveryCampaign = require('../models/finance/RecoveryCampaign');
      let displayText = '';
      if (campaignId) {
        const campaign = await RecoveryCampaign.findById(campaignId).lean();
        const preview =
          (campaignMessage && String(campaignMessage).trim()) ||
          (campaign && String(campaign.messagePreview || '').trim());
        if (preview) {
          displayText = `[Campaign] ${preview}`;
        } else {
          const cname = (campaignName && String(campaignName).trim()) || 'Campaign';
          const tpl =
            (campaign && campaign.whatsappTemplateName) ||
            (typeof sentAs === 'string' && sentAs !== 'template' ? sentAs : '');
          displayText = tpl ? `[Campaign] ${cname} · ${tpl}` : `[Campaign] ${cname}`;
        }
      } else if (campaignName) {
        const preview = campaignMessage && String(campaignMessage).trim();
        displayText = preview
          ? `[Campaign] ${preview}`
          : `[Campaign] ${String(campaignName).trim()}${sentAs && sentAs !== 'template' ? ` · ${sentAs}` : ''}`;
      } else {
        displayText = `(WhatsApp template: ${sentAs})`;
      }
      const outLabel = isAutoFollowUp ? '[Auto follow-up] ' : '';
      await WhatsAppOutgoingMessage.create({
        to: toNumber,
        text: outLabel + displayText,
        messageId,
        sentAt: new Date(),
        sentBy: user?._id,
        status: messageId ? 'sent' : 'sending',
        statusUpdatedAt: new Date()
      });
    }

    let campaignLabel = campaignName && String(campaignName).trim();
    if (!campaignLabel && campaignId) {
      const RecoveryCampaign = require('../models/finance/RecoveryCampaign');
      const c = await RecoveryCampaign.findById(campaignId).select('whatsappTemplateName messagePreview').lean();
      campaignLabel =
        (c?.messagePreview && String(c.messagePreview).trim().slice(0, 80)) ||
        c?.whatsappTemplateName ||
        'Campaign';
    }

    if (assignmentId) {
      try {
        const update = {};
        if (campaignLabel) {
          update.lastCampaignSentAt = new Date();
          update.lastCampaignName = campaignLabel;
        }
        if (Object.keys(update).length) {
          await RecoveryAssignment.findByIdAndUpdate(assignmentId, update, { new: false });
        }
      } catch (e) {
        console.warn('Failed to update assignment campaign info', e.message);
      }
    }

    await recordRecoveryOutboundActivity({
      assignmentId,
      phone: toNumber,
      isAutoFollowUp
    });

    return { ok: true, data, sentAs, messageId, toNumber };
  } catch (err) {
    const errData = err.response?.data?.error;
    const msg = errData?.message || err.response?.data?.message || err.message;
    const code = errData?.code ? ` (code ${errData.code})` : '';
    console.error('[WhatsApp] Send failed to', toNumber, err.response?.data || err.message);
    return {
      ok: false,
      message: `${msg || 'WhatsApp API error'}${code}`,
      statusCode: err.response?.status || 500,
      toNumber
    };
  }
}

module.exports = { executeRecoveryWhatsAppSend };
