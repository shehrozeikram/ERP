/**
 * Client-side image compression using the HTML Canvas API.
 *
 * Images are scaled down so the longest side does not exceed `maxSidePx`,
 * then re-encoded as JPEG at `quality` (0–1). PDFs are returned unchanged.
 *
 * Typical result: a 3 MB phone photo → ~80–150 KB compressed image.
 */

const MAX_SIDE_PX = 1600;   // longest edge in pixels after resize
const JPEG_QUALITY = 0.75;  // 0 = worst, 1 = lossless (for JPEG)
const MAX_ATTACHMENTS = 50;

export { MAX_ATTACHMENTS };

/**
 * @param {File} file - original File object (image or PDF)
 * @param {{ maxSidePx?: number, quality?: number }} [opts]
 * @returns {Promise<File>} compressed File (or original if PDF / already small)
 */
export async function compressImage(file, opts = {}) {
  const maxSide = opts.maxSidePx ?? MAX_SIDE_PX;
  const quality = opts.quality ?? JPEG_QUALITY;

  // PDFs cannot be compressed via Canvas — return as-is
  if (file.type === 'application/pdf') return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        if (width >= height) {
          height = Math.round((height / width) * maxSide);
          width = maxSide;
        } else {
          width = Math.round((width / height) * maxSide);
          height = maxSide;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // fallback to original on failure
            return;
          }
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg', lastModified: Date.now() }
          );
          // Only use compressed version if it actually saved space
          resolve(compressed.size < file.size ? compressed : file);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fallback to original on decode failure
    };

    img.src = objectUrl;
  });
}

/**
 * Compress multiple files in parallel (batches of 6 to avoid overwhelming the browser).
 * @param {File[]} files
 * @param {{ maxSidePx?: number, quality?: number, onProgress?: (done: number, total: number) => void }} [opts]
 * @returns {Promise<File[]>}
 */
export async function compressImages(files, opts = {}) {
  const { onProgress, ...compressOpts } = opts;
  const results = new Array(files.length);
  const BATCH = 6;

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const compressed = await Promise.all(batch.map((f) => compressImage(f, compressOpts)));
    compressed.forEach((f, j) => { results[i + j] = f; });
    if (onProgress) onProgress(Math.min(i + BATCH, files.length), files.length);
  }

  return results;
}
