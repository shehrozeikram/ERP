/**
 * Centralized Image Service
 * Handles image URL construction and validation across the application
 */

/**
 * Get the full image URL from a relative path
 * @param {string} imagePath - Relative image path (e.g., '/uploads/profile-images/filename.jpg')
 * @returns {string|null} - Full image URL or null if no path provided
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) return imagePath;
  
  // Extract filename from path (e.g., '/uploads/profile-images/filename.jpg' -> 'filename.jpg')
  const extractFilename = (path) => {
    if (!path) return null;
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  // Extract filename from path for profile images
  const filename = extractFilename(imagePath);
  
  // Use API endpoint to serve profile images in both dev and production
  // This ensures consistency and works through nginx proxy in production
  if (filename && imagePath.includes('/uploads/profile-images/')) {
    // Use API endpoint to serve image (works in both dev and production)
    // In production, this goes through nginx proxy (/api/ -> Node.js)
    const apiUrl = process.env.REACT_APP_API_URL || '/api';
    return `${apiUrl}/hr/image/${filename}`;
  }
  
  // For rental agreements and other uploads
  // In production: served through nginx proxy at /uploads/ -> Node.js
  // In development: use full backend URL to bypass React Router
  if (imagePath.startsWith('/uploads/')) {
    // Check if we're in production (hosted on tovus.net)
    const isProduction = window.location.hostname === 'tovus.net' || 
                         window.location.hostname === 'www.tovus.net' ||
                         process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // In production, use full URL to ensure proper routing through nginx
      return `${window.location.origin}${imagePath}`;
    }
    
    // In development, use full backend URL to bypass React Router
    // This ensures the request goes directly to the backend, not through React Router
    const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
    const baseUrl = backendUrl.replace('/api', ''); // Remove /api if present
    return `${baseUrl}${imagePath}`;
  }
  
  // For other image paths, use relative URL
  return imagePath;
};

/**
 * Get ZKBio Time image URL (for attendance images)
 * @param {string} imagePath - ZKBio image path
 * @returns {string|null} - Full ZKBio image URL or null if no path provided
 */
export const getZKBioImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) return imagePath;
  
  // ZKBio images are served through the API proxy
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? window.location.origin 
    : window.location.origin;
  
  return `${baseUrl}/api/images/zkbio-image${imagePath}`;
};

/**
 * Validate if an image path is valid
 * @param {string} imagePath - Image path to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidImagePath = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') return false;
  
  // Check if it's a valid image extension
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const hasValidExtension = validExtensions.some(ext => 
    imagePath.toLowerCase().endsWith(ext)
  );
  
  // Check if it's a valid path format
  const isValidPath = imagePath.startsWith('/') || imagePath.startsWith('http');
  
  return hasValidExtension && isValidPath;
};

/**
 * Get default avatar image URL
 * @returns {string} - Default avatar image URL
 */
export const getDefaultAvatarUrl = () => {
  return '/images/default-avatar.png'; // You can add a default avatar image
};

/**
 * Handle image load error by setting a fallback
 * @param {Event} event - Image error event
 * @param {string} fallbackSrc - Fallback image source
 */
export const handleImageError = (event, fallbackSrc = null) => {
  if (fallbackSrc) {
    event.target.src = getImageUrl(fallbackSrc);
  } else {
    event.target.style.display = 'none';
  }
};

/**
 * Image service configuration
 */
export const IMAGE_CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  UPLOAD_PATHS: {
    PROFILE_IMAGES: '/uploads/profile-images/',
    RENTAL_AGREEMENTS: '/uploads/rental-agreements/',
    TAJ_RENTAL_AGREEMENTS: '/uploads/taj-rental-agreements/',
    DOCUMENTS: '/uploads/documents/'
  }
};

export default {
  getImageUrl,
  getZKBioImageUrl,
  isValidImagePath,
  getDefaultAvatarUrl,
  handleImageError,
  IMAGE_CONFIG
};
