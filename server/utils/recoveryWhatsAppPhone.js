/**
 * Single source of truth for recovery / WhatsApp phone matching.
 * Assignment mobiles, ConversationRead.phone, and (after webhook normalize) WhatsAppIncomingMessage.from
 * should all resolve to the same canonical digit string for lookups.
 */

function normalizePhoneForLookup(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/\D/g, '').trim();
  if (p.startsWith('0')) p = p.slice(1);
  if (p.length === 10 && p.startsWith('3')) p = '92' + p;
  else if (p.length === 10) p = '92' + p;
  return p || '';
}

/**
 * Possible `from` values that may exist in WhatsAppIncomingMessage (legacy rows + Meta formats).
 */
function variantsForRecoveryPhone(canonical) {
  if (!canonical) return [];
  const set = new Set([canonical]);
  if (canonical.startsWith('92') && canonical.length > 2) {
    const rest = canonical.slice(2);
    set.add(rest);
    set.add(`0${rest}`);
  } else if (canonical.length >= 10) {
    set.add(`92${canonical.replace(/^0+/, '')}`);
  }
  return [...set].filter(Boolean);
}

/** Normalize Meta webhook `from` before persisting. */
function normalizeWhatsAppIncomingFrom(from) {
  if (from == null || from === '') return '';
  const n = normalizePhoneForLookup(String(from).trim());
  if (n) return n;
  return String(from).replace(/\D/g, '') || '';
}

module.exports = {
  normalizePhoneForLookup,
  variantsForRecoveryPhone,
  normalizeWhatsAppIncomingFrom
};
