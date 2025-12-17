const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

/**
 * Compress PDF file using Ghostscript (if available) with timeout
 * @param {string} inputPath - Path to input PDF file
 * @param {string} outputPath - Path to save compressed PDF
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000 = 30 seconds)
 * @returns {Promise<string>} - Path to compressed PDF
 */
async function compressPDF(inputPath, outputPath, timeoutMs = 30000) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      // If timeout, just copy the original file
      try {
        if (!fs.existsSync(outputPath)) {
          fs.copyFileSync(inputPath, outputPath);
        }
        console.warn('PDF compression timed out, using original file');
        resolve(outputPath);
      } catch (error) {
        resolve(outputPath);
      }
    }, timeoutMs);

  try {
    // Check if Ghostscript is available
    try {
        await Promise.race([
          execPromise('gs --version', { timeout: 5000 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('GS check timeout')), 5000))
        ]);
    } catch {
        clearTimeout(timeout);
      fs.copyFileSync(inputPath, outputPath);
        resolve(outputPath);
        return;
    }

      // Compress PDF using Ghostscript with timeout
    const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;
      
      try {
        await Promise.race([
          execPromise(gsCommand, { maxBuffer: 10 * 1024 * 1024 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Compression timeout')), timeoutMs - 5000))
        ]);
        
        clearTimeout(timeout);
    
    // Use compressed version if it's smaller, otherwise use original
    if (fs.existsSync(outputPath)) {
      const originalSize = fs.statSync(inputPath).size;
      const compressedSize = fs.statSync(outputPath).size;
      
          if (compressedSize >= originalSize || compressedSize === 0) {
        fs.copyFileSync(inputPath, outputPath);
      }
    } else {
      fs.copyFileSync(inputPath, outputPath);
    }
    
        resolve(outputPath);
      } catch (compressionError) {
        clearTimeout(timeout);
        // On compression error, copy original file
        if (!fs.existsSync(outputPath)) {
          fs.copyFileSync(inputPath, outputPath);
        }
        console.warn('PDF compression failed, using original file:', compressionError.message);
        resolve(outputPath);
      }
  } catch (error) {
      clearTimeout(timeout);
    // On error, copy original file
      if (!fs.existsSync(outputPath)) {
    fs.copyFileSync(inputPath, outputPath);
      }
      console.warn('PDF compression error, using original file:', error.message);
      resolve(outputPath);
  }
  });
}

module.exports = { compressPDF };

