const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

export const ASSET_TAG_QR_BRAND_COLOR = '#179cde';

export const ASSET_TAG_CENTER_LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="tovusBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1db4ef"/>
      <stop offset="100%" stop-color="#0f86cc"/>
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="60" fill="url(#tovusBlue)"/>
  <circle cx="60" cy="60" r="45" fill="none" stroke="#ffffff" stroke-width="3.2" opacity="0.92"/>
  <path d="M38 40h44v10H65v33H55V50H38z" fill="#ffffff"/>
  <text
    x="60"
    y="98"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="11"
    font-weight="700"
    letter-spacing="1.4"
    fill="#ffffff"
  >TOVUS</text>
</svg>
`)}`;

/** Printed QR size on labels (millimetres). */
export const ASSET_TAG_QR_PRINT_SIZE_MM = {
  single: 36,
  bulk: 28
};

/**
 * Branded SGC / TOVUS QR — previous visual style, rendered at high resolution
 * for better camera scanning (short URL + larger print size on the label).
 */
export async function buildAssetTagQrDataUrl(scanUrl) {
  if (!scanUrl) return '';

  const { default: QRCodeStyling } = await import('qr-code-styling');
  const qrCode = new QRCodeStyling({
    width: 1024,
    height: 1024,
    type: 'canvas',
    data: scanUrl,
    image: ASSET_TAG_CENTER_LOGO_DATA_URI,
    margin: 10,
    qrOptions: {
      errorCorrectionLevel: 'H'
    },
    dotsOptions: {
      color: ASSET_TAG_QR_BRAND_COLOR,
      type: 'dots'
    },
    cornersSquareOptions: {
      color: ASSET_TAG_QR_BRAND_COLOR,
      type: 'extra-rounded'
    },
    cornersDotOptions: {
      color: ASSET_TAG_QR_BRAND_COLOR,
      type: 'dot'
    },
    backgroundOptions: {
      color: '#ffffff'
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.22,
      margin: 2
    }
  });

  const rawData = await qrCode.getRawData('png');
  if (!rawData) return '';

  const blob = rawData instanceof Blob ? rawData : new Blob([rawData], { type: 'image/png' });
  const dataUrl = await blobToDataUrl(blob);
  return typeof dataUrl === 'string' ? dataUrl : '';
}

export const assetTagQrImageSx = (sizeMm) => ({
  width: `${sizeMm}mm`,
  height: `${sizeMm}mm`,
  display: 'block'
});
