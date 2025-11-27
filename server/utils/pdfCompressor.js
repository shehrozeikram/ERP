const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

/**
 * Compress PDF file using Ghostscript (if available)
 * @param {string} inputPath - Path to input PDF file
 * @param {string} outputPath - Path to save compressed PDF
 * @returns {Promise<string>} - Path to compressed PDF
 */
async function compressPDF(inputPath, outputPath) {
  try {
    // Check if Ghostscript is available
    try {
      await execPromise('gs --version');
    } catch {
      fs.copyFileSync(inputPath, outputPath);
      return outputPath;
    }

    // Compress PDF using Ghostscript
    const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;
    await execPromise(gsCommand);
    
    // Use compressed version if it's smaller, otherwise use original
    if (fs.existsSync(outputPath)) {
      const originalSize = fs.statSync(inputPath).size;
      const compressedSize = fs.statSync(outputPath).size;
      
      if (compressedSize >= originalSize) {
        fs.copyFileSync(inputPath, outputPath);
      }
    } else {
      fs.copyFileSync(inputPath, outputPath);
    }
    
    return outputPath;
  } catch (error) {
    // On error, copy original file
    fs.copyFileSync(inputPath, outputPath);
    return outputPath;
  }
}

module.exports = { compressPDF };

