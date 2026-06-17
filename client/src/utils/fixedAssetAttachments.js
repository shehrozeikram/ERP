import { resolveUploadFileHref, isAttachmentPdf } from './uploadPaths';

export function getFirstImageAttachment(asset) {
  return (asset?.attachments || []).find((att) => String(att.mimetype || '').startsWith('image/')) || null;
}

export function getFirstAttachment(asset) {
  return (asset?.attachments || [])[0] || null;
}

export function getAttachmentHref(attachment) {
  if (!attachment?.path) return null;
  return resolveUploadFileHref(attachment.path, attachment.mimetype);
}

export function isImageAttachment(attachment) {
  return String(attachment?.mimetype || '').startsWith('image/');
}

export function isPdfAttachment(attachment) {
  return isAttachmentPdf(attachment?.path, attachment?.mimetype);
}
