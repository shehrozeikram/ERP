/**
 * Merge multipart line attachments into cash approval items[].
 * Fields: lineAttachment_<lineIndex>_<fileIndex> (or legacy lineAttachment_<lineIndex>)
 * Body:   existingLineAttachments_<lineIndex> = JSON array of URLs to keep
 */

const MAX_LINE_ATTACHMENTS = 50;

function parseLineAttachmentField(fieldname) {
  const m = /^lineAttachment_(\d+)(?:_(\d+))?$/.exec(fieldname || '');
  if (!m) return null;
  return {
    lineIdx: parseInt(m[1], 10),
    fileIdx: m[2] != null ? parseInt(m[2], 10) : 0
  };
}

function readExistingUrls(body, lineIdx, row) {
  const key = `existingLineAttachments_${lineIdx}`;
  if (body[key] != null && body[key] !== '') {
    try {
      const parsed = JSON.parse(body[key]);
      delete body[key];
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      delete body[key];
    }
  }
  if (Array.isArray(row?.attachments) && row.attachments.length) {
    return row.attachments.map((a) => (typeof a === 'string' ? a : a?.url)).filter(Boolean);
  }
  return [];
}

function attachmentFromUrl(url, fileMeta = {}) {
  return {
    filename: fileMeta.filename || '',
    originalName: fileMeta.originalName || '',
    url,
    mimeType: fileMeta.mimeType || '',
    uploadedAt: fileMeta.uploadedAt || new Date()
  };
}

/**
 * @param {Express.Multer.File[]} files
 * @param {object[]} items
 * @param {object} body - req.body (mutated: existingLineAttachments_* keys removed)
 * @param {{ publicPath: string }} opts - e.g. '/uploads/procurement/cash-approvals/'
 */
function mergeCashApprovalLineUploads(files, items, body, opts) {
  if (!Array.isArray(items)) return items;
  const publicPath = opts.publicPath.endsWith('/') ? opts.publicPath : `${opts.publicPath}/`;
  const newByLine = new Map();

  for (const f of files || []) {
    const parsed = parseLineAttachmentField(f.fieldname);
    if (!parsed) continue;
    const url = `${publicPath}${f.filename}`;
    if (!newByLine.has(parsed.lineIdx)) newByLine.set(parsed.lineIdx, []);
    newByLine.get(parsed.lineIdx).push({
      fileIdx: parsed.fileIdx,
      url,
      meta: {
        filename: f.filename,
        originalName: f.originalname,
        mimeType: f.mimetype,
        uploadedAt: new Date()
      }
    });
  }

  const mergedLineIdx = new Set();

  for (const [lineIdx, entries] of newByLine) {
    if (!items[lineIdx]) continue;
    mergedLineIdx.add(lineIdx);
    entries.sort((a, b) => a.fileIdx - b.fileIdx);
    const existing = readExistingUrls(body, lineIdx, items[lineIdx]);
    const newAttachments = entries.map((e) => attachmentFromUrl(e.url, e.meta));
    const kept = existing.map((url) => attachmentFromUrl(url));
    items[lineIdx].attachments = [...kept, ...newAttachments].slice(0, MAX_LINE_ATTACHMENTS);
  }

  Object.keys(body).forEach((key) => {
    const m = /^existingLineAttachments_(\d+)$/.exec(key);
    if (!m) return;
    const lineIdx = parseInt(m[1], 10);
    if (mergedLineIdx.has(lineIdx)) {
      delete body[key];
      return;
    }
    const rawVal = body[key];
    delete body[key];
    if (!items[lineIdx]) return;
    try {
      const urls = JSON.parse(rawVal);
      if (Array.isArray(urls)) {
        items[lineIdx].attachments = urls
          .filter(Boolean)
          .slice(0, MAX_LINE_ATTACHMENTS)
          .map((url) => attachmentFromUrl(url));
      }
    } catch {
      /* ignore */
    }
  });

  return items;
}

module.exports = {
  MAX_LINE_ATTACHMENTS,
  mergeCashApprovalLineUploads
};
