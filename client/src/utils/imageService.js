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
  
  // Construct full URL based on environment
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? window.location.origin 
    : window.location.origin; // Uses proxy in development
  
  return `${baseUrl}${imagePath}`;
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
