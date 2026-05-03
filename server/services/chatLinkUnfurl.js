const axios = require('axios');
const net = require('net');

const MAX_BYTES = 400 * 1024;
const TIMEOUT_MS = 6000;

function isPrivateOrReservedHost(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  if (h === '0.0.0.0') return true;
  // IPv4 literal
  if (net.isIP(h)) {
    if (h.startsWith('10.')) return true;
    if (h.startsWith('127.')) return true;
    if (h.startsWith('169.254.')) return true;
    const m = h.match(/^192\.168\./);
    if (m) return true;
    const m172 = h.match(/^172\.(\d+)\./);
    if (m172) {
      const n = parseInt(m172[1], 10);
      if (n >= 16 && n <= 31) return true;
    }
    if (h.startsWith('::1') || h === '::') return true;
  }
  return false;
}

function extractMeta(html, url) {
  const pick = (re) => {
    const m = html.match(re);
    return m ? m[1].trim().slice(0, 500) : '';
  };
  const title =
    pick(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    pick(/name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i) ||
    pick(/<title[^>]*>([^<]+)<\/title>/i);
  const description =
    pick(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
    pick(/name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const image =
    pick(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    pick(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  const siteName = pick(/property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) || '';
  try {
    const u = new URL(url);
    return {
      url,
      title: title || u.hostname,
      description: description || '',
      image: image || '',
      siteName: siteName || u.hostname,
      fetchedAt: new Date()
    };
  } catch {
    return { url, title: title || '', description, image, siteName, fetchedAt: new Date() };
  }
}

/**
 * Fetch Open Graph / basic meta for a public http(s) URL. Blocks obvious SSRF targets.
 */
async function unfurlUrl(rawUrl) {
  let urlObj;
  try {
    urlObj = new URL(String(rawUrl).trim());
  } catch {
    return null;
  }
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return null;
  if (isPrivateOrReservedHost(urlObj.hostname)) return null;

  const url = urlObj.toString();
  const res = await axios.get(url, {
    timeout: TIMEOUT_MS,
    maxRedirects: 3,
    maxContentLength: MAX_BYTES,
    maxBodyLength: MAX_BYTES,
    headers: {
      'User-Agent': 'SGC-ERP-ChatLinkBot/1.0',
      Accept: 'text/html,application/xhtml+xml'
    },
    validateStatus: (s) => s >= 200 && s < 400
  });
  const html = typeof res.data === 'string' ? res.data : '';
  if (!html) return { url, title: urlObj.hostname, description: '', image: '', siteName: urlObj.hostname, fetchedAt: new Date() };
  return extractMeta(html.slice(0, 500000), url);
}

function extractHttpUrls(text, limit = 3) {
  const re = /https?:\/\/[^\s<>"']+/gi;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(text || '')) !== null) {
    const u = m[0].replace(/[),.;]+$/, '');
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= limit) break;
  }
  return out;
}

async function unfurlFromText(text, limit = 3) {
  const urls = extractHttpUrls(text, limit);
  const previews = [];
  for (const u of urls) {
    try {
      const p = await unfurlUrl(u);
      if (p) previews.push(p);
    } catch {
      /* skip failed unfurl */
    }
  }
  return previews;
}

module.exports = {
  unfurlUrl,
  unfurlFromText,
  extractHttpUrls
};
