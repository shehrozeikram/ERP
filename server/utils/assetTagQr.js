const QRCode = require('qrcode');

/** High-contrast QR tuned for phone cameras at distance (print + screen). */
const ASSET_TAG_QR_OPTIONS = {
  width: 1024,
  margin: 4,
  errorCorrectionLevel: 'M',
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  }
};

async function generateAssetTagQrDataUrl(payload) {
  return QRCode.toDataURL(payload, ASSET_TAG_QR_OPTIONS);
}

module.exports = {
  ASSET_TAG_QR_OPTIONS,
  generateAssetTagQrDataUrl
};
