const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Generate QR code for document tracking ID
 * @param {string} trackingId - Document tracking ID
 * @param {string} documentId - Document MongoDB ID
 * @returns {Promise<{qrCode: string, qrCodeImage: string}>}
 */
const generateQRCode = async (trackingId, documentId) => {
  try {
    // Create QR code data (URL to view document)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrData = `${frontendUrl}/documents-tracking?trackingId=${trackingId}`;

    // Generate QR code as data URL (base64)
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });

    // Save QR code image to file system
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'qr-codes');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `qr-${documentId}-${Date.now()}.png`;
    const filepath = path.join(uploadsDir, filename);

    // Convert data URL to buffer and save
    const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filepath, buffer);

    // Return relative path for storage
    const relativePath = `/uploads/qr-codes/${filename}`;

    return {
      qrCode: qrData,
      qrCodeImage: relativePath
    };
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate QR code buffer (for direct download)
 * @param {string} trackingId - Document tracking ID
 * @returns {Promise<Buffer>}
 */
const generateQRCodeBuffer = async (trackingId) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrData = `${frontendUrl}/documents-tracking?trackingId=${trackingId}`;

    const buffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });

    return buffer;
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw new Error('Failed to generate QR code');
  }
};

module.exports = {
  generateQRCode,
  generateQRCodeBuffer
};


