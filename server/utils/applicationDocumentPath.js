const path = require('path');
const fs = require('fs');
const { getUploadsRoot } = require('./uploadsRoot');

const UPLOADS_ROOT = getUploadsRoot();
const CVS_DIR = path.join(UPLOADS_ROOT, 'cvs');
const DEFAULT_SERVER_UPLOADS = path.resolve(__dirname, '../uploads');
const REPO_UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');
const REPO_CVS_DIR = path.join(REPO_UPLOADS_ROOT, 'cvs');

/** Everything after ".../uploads/" in a stored absolute path (cross-machine / old deploys). */
function relativeSegmentAfterUploads(storedPath) {
  if (!storedPath || typeof storedPath !== 'string') return null;
  const norm = storedPath.replace(/\\/g, '/');
  const lower = norm.toLowerCase();
  const marker = '/uploads/';
  const idx = lower.lastIndexOf(marker);
  if (idx === -1) return null;
  return norm.slice(idx + marker.length);
}

/** Join root + relative path only if relative has no path traversal. */
function safeJoinUnderRoot(root, relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return null;
  const trimmed = relativePath.replace(/^[/\\]+|[/\\]+$/g, '');
  if (!trimmed || trimmed.split(/[/\\]+/).some((p) => p === '..')) {
    return null;
  }
  const full = path.normalize(path.join(path.resolve(root), ...trimmed.split(/[/\\]+/)));
  const rootR = path.resolve(root);
  if (full !== rootR && !full.startsWith(`${rootR}${path.sep}`)) {
    return null;
  }
  return full;
}

function realpathIfExists(p) {
  const abs = path.resolve(p);
  try {
    if (fs.existsSync(abs)) {
      return fs.realpathSync(abs);
    }
  } catch (e) {
    /* ignore */
  }
  return abs;
}

/** Allow symlinked upload dirs (real path may differ from project path, e.g. /var vs /private/var). */
function isRealPathUnderAllowedUploadRoots(realPath, allowedRoots) {
  let p = path.resolve(realPath);
  try {
    if (fs.existsSync(p)) {
      p = fs.realpathSync(p);
    }
  } catch (e) {
    return false;
  }
  return allowedRoots.some((root) => {
    const base = realpathIfExists(root);
    if (!base) return false;
    return p === base || p.startsWith(`${base}${path.sep}`);
  });
}

function isFileUnderAllowedRoot(resolvedFile, allowedRoots) {
  let filePath = path.resolve(resolvedFile);
  try {
    if (fs.existsSync(filePath)) {
      filePath = fs.realpathSync(filePath);
    }
  } catch (e) {
    return false;
  }
  return allowedRoots.some((root) => {
    const base = realpathIfExists(root);
    if (filePath === base) return false;
    return filePath.startsWith(`${base}${path.sep}`);
  });
}

function collectAllowedUploadRoots() {
  const raw = [
    ...new Set([
      UPLOADS_ROOT,
      CVS_DIR,
      DEFAULT_SERVER_UPLOADS,
      path.join(DEFAULT_SERVER_UPLOADS, 'cvs'),
      REPO_UPLOADS_ROOT,
      REPO_CVS_DIR,
      path.resolve(process.cwd(), 'server', 'uploads'),
      path.join(path.resolve(process.cwd(), 'server', 'uploads'), 'cvs'),
      path.resolve(process.cwd(), 'uploads'),
      path.join(path.resolve(process.cwd(), 'uploads'), 'cvs')
    ])
  ].filter(Boolean);

  const expanded = new Set(raw);
  for (const r of raw) {
    try {
      const rp = realpathIfExists(r);
      if (rp) expanded.add(rp);
    } catch (e) {
      /* ignore */
    }
  }
  return [...expanded];
}

function collectCvScanDirectories() {
  return [
    ...new Set([
      CVS_DIR,
      path.join(DEFAULT_SERVER_UPLOADS, 'cvs'),
      path.join(UPLOADS_ROOT, 'cvs'),
      REPO_CVS_DIR,
      path.join(process.cwd(), 'server', 'uploads', 'cvs'),
      path.join(process.cwd(), 'uploads', 'cvs')
    ])
  ];
}

/**
 * Last segment of a stored path, safe on POSIX even when DB has Windows-style backslashes.
 */
function basenameFromStoredPath(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;
  const trimmed = rawName.trim();
  if (!trimmed) return null;
  const base = path.posix.basename(trimmed.replace(/\\/g, '/'));
  if (!base || base === '.' || base === '..') return null;
  return base;
}

function findFileCaseInsensitiveInCvDirs(baseName, allowedRoots) {
  const want = baseName.toLowerCase();
  for (const dir of collectCvScanDirectories()) {
    if (!dir || !fs.existsSync(dir)) continue;
    let resolvedDir;
    try {
      resolvedDir = fs.realpathSync(dir);
    } catch (e) {
      continue;
    }
    if (!isRealPathUnderAllowedUploadRoots(resolvedDir, allowedRoots)) {
      continue;
    }
    try {
      const entries = fs.readdirSync(resolvedDir);
      const hit = entries.find((f) => f.toLowerCase() === want);
      if (!hit) continue;
      const full = path.join(resolvedDir, hit);
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
      if (!isFileUnderAllowedRoot(full, allowedRoots)) continue;
      return full;
    } catch (e) {
      continue;
    }
  }
  return null;
}

function documentHasRegisteredFile(doc) {
  if (!doc || typeof doc !== 'object') return false;
  const fn = doc.filename != null && String(doc.filename).trim() !== '';
  const p = doc.path != null && String(doc.path).trim() !== '';
  return fn || p;
}

/** Resolve a stored application document (CV, resume, etc.) to a readable file path. */
function resolveApplicationDocumentPath(doc) {
  if (!doc || (!doc.filename && !doc.path)) return null;

  const rawName = doc.filename
    ? String(doc.filename).trim()
    : doc.path
      ? String(doc.path).trim()
      : '';
  const baseName = basenameFromStoredPath(rawName);
  if (!baseName) return null;

  const allowedRoots = collectAllowedUploadRoots();
  const candidates = [];

  const add = (p) => {
    if (!p) return;
    try {
      candidates.push(path.normalize(path.resolve(p)));
    } catch (e) {
      /* ignore */
    }
  };

  if (doc.path) {
    add(doc.path);
    const rel = relativeSegmentAfterUploads(doc.path);
    if (rel) {
      add(safeJoinUnderRoot(UPLOADS_ROOT, rel));
      add(safeJoinUnderRoot(DEFAULT_SERVER_UPLOADS, rel));
      add(safeJoinUnderRoot(REPO_UPLOADS_ROOT, rel));
    }
  }

  if (baseName) {
    add(path.join(CVS_DIR, baseName));
    add(path.join(UPLOADS_ROOT, baseName));
    add(path.join(DEFAULT_SERVER_UPLOADS, 'cvs', baseName));
    add(path.join(DEFAULT_SERVER_UPLOADS, baseName));
    add(path.join(REPO_CVS_DIR, baseName));
    add(path.join(REPO_UPLOADS_ROOT, baseName));
    add(path.join(process.cwd(), 'server', 'uploads', 'cvs', baseName));
    add(path.join(process.cwd(), 'uploads', 'cvs', baseName));
  }

  const seen = new Set();
  for (const p of candidates) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    if (!isFileUnderAllowedRoot(p, allowedRoots)) continue;
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return p;
      }
    } catch (e) {
      continue;
    }
  }

  return findFileCaseInsensitiveInCvDirs(baseName, allowedRoots);
}

module.exports = {
  resolveApplicationDocumentPath,
  documentHasRegisteredFile
};
