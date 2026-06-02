import { getImageUrl } from './imageService';

/** Normalize stored upload paths (static files live under /uploads, not /api/uploads). */
export function normalizeUploadPath(relativePath) {
  if (!relativePath) return '';
  let p = String(relativePath).trim();
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  p = p.replace(/^\/?api\/uploads\//i, '/uploads/');
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

const stripApiBaseSuffix = (baseUrl) => String(baseUrl || '').replace(/\/api\/?$/, '');

const getApiBase = () => {
  if (process.env.NODE_ENV === 'production') {
    return `${window.location.origin}/api`;
  }
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  if (apiUrl.startsWith('http')) {
    return apiUrl.replace(/\/$/, '');
  }
  return `${window.location.origin}/api`;
};

function extractCashApprovalLineFilename(normalizedPath) {
  const unified = normalizedPath.match(/^\/uploads\/cash-approvals\/line-files\/([^/]+)$/i);
  if (unified) return unified[1];
  const legacy = normalizedPath.match(/^\/uploads\/(general|procurement)\/cash-approvals\/([^/]+)$/i);
  if (legacy) return legacy[2];
  return null;
}

/** Build authenticated API URL for cash approval line attachments. */
function resolveCashApprovalLineFileApiHref(normalizedPath) {
  const filename = extractCashApprovalLineFilename(normalizedPath);
  if (!filename) return null;
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const apiBase = getApiBase();
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${apiBase}/cash-approvals/line-files/${encodeURIComponent(filename)}${q}`;
}

/** Absolute href for /uploads/* files (cash approval, utility bills, etc.). */
export function resolveUploadFileHref(url, mimeType = '') {
  const normalized = normalizeUploadPath(url);
  if (!normalized) return null;
  if (normalized.startsWith('http')) return normalized;

  const cashApiHref = resolveCashApprovalLineFileApiHref(normalized);
  if (cashApiHref) return cashApiHref;

  let href = getImageUrl(normalized);
  const needsAbsolute =
    !href ||
    (href.startsWith('/') && !href.startsWith('//')) ||
    href === normalized;

  if (needsAbsolute) {
    let base = stripApiBaseSuffix(process.env.REACT_APP_API_URL || '');
    if (!base || !base.startsWith('http')) {
      base =
        process.env.NODE_ENV === 'development'
          ? 'http://localhost:5001'
          : window.location.origin;
    }
    href = `${base.replace(/\/$/, '')}${normalized}`;
  }

  return href;
}

export function isAttachmentPdf(url, mimeType = '') {
  if (mimeType === 'application/pdf') return true;
  return /\.pdf$/i.test(normalizeUploadPath(url));
}
