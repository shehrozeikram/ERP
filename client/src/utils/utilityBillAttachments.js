import {
  isAttachmentPdf,
  normalizeUploadPath,
  resolveUploadFileHref
} from './uploadPaths';

export { normalizeUploadPath, resolveUploadFileHref, isAttachmentPdf };

/** Normalize store item id for multipart field names and server matching. */
export function getStoreItemId(storeItem) {
  if (!storeItem) return '';
  if (typeof storeItem === 'object' && storeItem._id != null) return String(storeItem._id);
  return String(storeItem);
}

/** Collect attachment URLs for a utility bill line (new array + legacy single URL). */
export function getLineAttachmentUrls(line) {
  if (!line) return [];
  if (Array.isArray(line.attachmentUrls) && line.attachmentUrls.length) {
    return line.attachmentUrls.filter(Boolean);
  }
  if (line.attachmentUrl) return [line.attachmentUrl];
  if (Array.isArray(line.attachments) && line.attachments.length) {
    return line.attachments
      .map((a) => (typeof a === 'string' ? a : a?.url))
      .filter(Boolean);
  }
  return [];
}

export function lineHasAttachments(line) {
  return getLineAttachmentUrls(line).length > 0;
}

/** Slides for LineAttachmentsView / carousel (url + href + isPdf). */
export function buildLineAttachmentSlides(line, resolveHref = resolveUploadFileHref) {
  const urls = getLineAttachmentUrls(line);
  const attList = Array.isArray(line?.attachments) ? line.attachments : [];

  return urls
    .map((url, i) => {
      const att = attList.find((a) => a && (a.url === url || a === url)) || attList[i];
      const mime = att && typeof att === 'object' ? att.mimeType || '' : '';
      const normalized = normalizeUploadPath(url);
      const href = resolveHref(normalized || url, mime);
      if (!href) return null;
      return {
        url: normalized,
        href,
        isPdf: isAttachmentPdf(normalized || url, mime)
      };
    })
    .filter(Boolean);
}

const isImageLikePath = (value = '') => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(value || ''));

/**
 * Flat list of image attachments for workflow views (header bill image + all line images).
 * Line URLs are included so audit/finance see the same files as bill detail.
 */
export function collectUtilityBillWorkflowImages(bill, resolveImage = resolveUploadFileHref) {
  const images = [];
  const pushImage = (src, name = 'Bill Image') => {
    if (!src) return;
    const resolved = resolveImage(src);
    if (!resolved) return;
    if (!images.some((img) => img.src === resolved)) {
      images.push({ src: resolved, name });
    }
  };

  pushImage(bill?.billImage, 'Bill Image');
  pushImage(bill?.attachment, 'Bill Attachment');

  (bill?.billLines || []).forEach((line, lineIdx) => {
    const lineLabel = line?.itemName || line?.description || `Line ${lineIdx + 1}`;
    getLineAttachmentUrls(line).forEach((url, attIdx) => {
      if (isImageLikePath(url) || !/\.pdf$/i.test(url)) {
        const suffix = getLineAttachmentUrls(line).length > 1 ? ` (${attIdx + 1})` : '';
        pushImage(url, `${lineLabel}${suffix}`);
      }
    });
  });

  const list = Array.isArray(bill?.attachments) ? bill.attachments : [];
  list.forEach((att, idx) => {
    const src = att?.filePath || att?.path || att?.url || '';
    const mime = String(att?.mimeType || '').toLowerCase();
    if (src && (mime.startsWith('image/') || isImageLikePath(src))) {
      pushImage(src, att?.originalName || att?.fileName || `Attachment ${idx + 1}`);
    }
  });

  return images;
}
