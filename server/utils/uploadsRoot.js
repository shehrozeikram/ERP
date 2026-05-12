const path = require('path');
const fs = require('fs');

/**
 * Root directory for file uploads (CVs live in <root>/cvs).
 * Set SGC_UPLOADS_DIR (or UPLOADS_DIR) on production to a path outside the git checkout
 * so Easy Apply files survive deploys, e.g. /var/lib/sgc-erp/uploads
 */
function getUploadsRoot() {
  const fromEnv = process.env.SGC_UPLOADS_DIR || process.env.UPLOADS_DIR;
  if (fromEnv && String(fromEnv).trim()) {
    return path.resolve(String(fromEnv).trim());
  }
  return path.resolve(__dirname, '..', 'uploads');
}

function getCvsUploadDir() {
  const dir = path.join(getUploadsRoot(), 'cvs');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    console.error('[uploads] Failed to create CV directory:', dir, e.message);
  }
  return dir;
}

module.exports = { getUploadsRoot, getCvsUploadDir };
