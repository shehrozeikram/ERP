/**
 * Centralized File Server Utility
 * Handles secure file serving with authentication and permissions
 */

const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { checkSubRoleAccess } = require('../config/permissions');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';

/**
 * Authenticate user from token (query parameter or Authorization header)
 */
const authenticateUser = async (req) => {
  const token = req.query.token || req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return { error: { status: 401, message: 'Access denied. No token provided.' } };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return { error: { status: 401, message: 'Invalid token. User not found or inactive.' } };
    }

    return { user };
  } catch (jwtError) {
    const message = jwtError.name === 'TokenExpiredError' 
      ? 'Token expired. Please login again.' 
      : 'Invalid token.';
    return { error: { status: 401, message } };
  }
};

/**
 * Validate filename to prevent directory traversal attacks
 */
const validateFilename = (filename) => {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return { error: { status: 400, message: 'Invalid filename format' } };
  }
  return { valid: true };
};

/**
 * Validate file path is within allowed directory
 */
const validateFilePath = (filePath, allowedDir) => {
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(allowedDir);
  
  if (!resolvedPath.startsWith(resolvedDir)) {
    return { error: { status: 403, message: 'Access denied. Invalid file path.' } };
  }
  
  return { valid: true };
};

/**
 * Get MIME type and content disposition for file
 */
const getFileHeaders = (filePath, filename) => {
  const ext = path.extname(filePath).toLowerCase();
  const isPDF = ext === '.pdf';
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin'
  };

  if (isPDF) {
    headers['Content-Type'] = 'application/pdf';
    headers['Content-Disposition'] = `inline; filename="${filename}"`;
  } else {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    headers['Content-Type'] = mimeTypes[ext] || 'application/octet-stream';
    headers['Cache-Control'] = 'public, max-age=31536000'; // 1 year cache for images
  }

  return headers;
};

/**
 * Create file serving route handler
 * @param {Object} config - Configuration object
 * @param {string} config.uploadDir - Directory where files are stored (relative to server root)
 * @param {string} config.module - Permission module (e.g., 'admin', 'finance')
 * @param {string} config.submodule - Permission submodule (e.g., 'rental_agreements')
 * @param {string} config.routePath - Route path (e.g., '/file/:filename')
 * @returns {Function} Express route handler
 */
const createFileServerRoute = (config) => {
  const { uploadDir, module, submodule } = config;
  
  // Use the exact same path construction as upload routes for consistency
  // Upload routes use: path.join(__dirname, '../uploads/rental-agreements')
  // Where __dirname is server/routes/
  // Since fileServer.js is in server/utils/, we need to go: utils -> server -> uploads/...
  // Use path.join (not path.resolve) to match upload route exactly
  const fullUploadDir = path.join(__dirname, '..', uploadDir);
  
  // Also calculate the alternative path (as used in routes) for fallback
  // This matches: path.join(__dirname, '../uploads/...') from server/routes/
  const routesDir = path.join(__dirname, '..', 'routes');
  const alternativeUploadDir = path.join(routesDir, '..', uploadDir);
  
  // Ensure directory exists
  if (!fs.existsSync(fullUploadDir)) {
    try {
      fs.mkdirSync(fullUploadDir, { recursive: true });
    } catch (err) {
      console.error('Failed to create upload directory:', fullUploadDir, err.message);
    }
  }

  return async (req, res) => {
    try {
      // Authenticate user
      const authResult = await authenticateUser(req);
      if (authResult.error) {
        if (isDevelopment) {
          console.log('❌ Authentication failed:', authResult.error.message);
        }
        return res.status(authResult.error.status).json({
          success: false,
          message: authResult.error.message
        });
      }

      const { user } = authResult;

      // Check permissions
      const hasAccess = await checkSubRoleAccess(user.id, module, submodule, 'read');
      if (!hasAccess) {
        if (isDevelopment) {
          console.log('❌ Permission denied for user:', user.email);
        }
        return res.status(403).json({
          success: false,
          message: 'Insufficient sub-role permissions to perform this action'
        });
      }

      // Get and validate filename
      const filename = req.params.filename;
      const filenameValidation = validateFilename(filename);
      if (filenameValidation.error) {
        if (isDevelopment) {
          console.log('❌ Invalid filename:', filename);
        }
        return res.status(filenameValidation.error.status).json({
          success: false,
          message: filenameValidation.error.message
        });
      }

      // Build file path - use path.join to match upload route behavior
      const filePath = path.join(fullUploadDir, filename);
      
      // Validate file path is within allowed directory (use resolved paths for security)
      const pathValidation = validateFilePath(path.resolve(filePath), path.resolve(fullUploadDir));
      if (pathValidation.error) {
        if (isDevelopment) {
          console.log('❌ Path traversal attempt detected');
        }
        return res.status(pathValidation.error.status).json({
          success: false,
          message: pathValidation.error.message
        });
      }

      // Check if file exists - try multiple path resolutions for production compatibility
      let filePathToUse = path.join(fullUploadDir, filename);
      let fileExists = fs.existsSync(filePathToUse);
      
      // Fallback: Try alternative path (matching exact upload route path construction)
      if (!fileExists && alternativeUploadDir !== fullUploadDir) {
        const alternativePath = path.join(alternativeUploadDir, filename);
        
        if (fs.existsSync(alternativePath)) {
          filePathToUse = alternativePath;
          fileExists = true;
          console.log('✅ File found using alternative path (matching upload route):', alternativePath);
        }
      }
      
      if (!fileExists) {
        // Enhanced logging for production debugging
        const resolvedDir = path.resolve(fullUploadDir);
        console.log('❌ File not found');
        console.log('📄 Requested filename:', filename);
        console.log('📁 Primary file path:', filePathToUse);
        console.log('📁 Resolved directory:', resolvedDir);
        console.log('📁 Directory exists:', fs.existsSync(resolvedDir));
        console.log('📁 __dirname:', __dirname);
        console.log('📁 uploadDir config:', uploadDir);
        
        // Try to list files for debugging
        try {
          if (fs.existsSync(resolvedDir)) {
            const files = fs.readdirSync(resolvedDir);
            console.log('📁 Available files in directory:', files.slice(0, 10));
            console.log('📁 Total files:', files.length);
            
            // Check if file exists with different case or similar name
            const matchingFiles = files.filter(f => 
              f.toLowerCase() === filename.toLowerCase() || 
              f.includes(filename.split('-').pop()) // Check if filename matches pattern
            );
            if (matchingFiles.length > 0) {
              console.log('🔍 Similar files found:', matchingFiles);
            }
          } else {
            console.log('❌ Directory does not exist:', resolvedDir);
            // Try alternative directory
            const altDir = path.resolve(__dirname, '..', 'routes', '..', uploadDir);
            console.log('📁 Trying alternative directory:', altDir);
            console.log('📁 Alternative directory exists:', fs.existsSync(altDir));
            if (fs.existsSync(altDir)) {
              const altFiles = fs.readdirSync(altDir);
              console.log('📁 Files in alternative directory:', altFiles.slice(0, 10));
            }
          }
        } catch (err) {
          console.log('⚠️ Error reading directory:', err.message);
        }
        
        return res.status(404).json({
          success: false,
          message: 'File not found on server'
        });
      }

      // Set headers and send file
      const headers = getFileHeaders(filePathToUse, filename);
      Object.keys(headers).forEach(key => {
        res.setHeader(key, headers[key]);
      });

      if (isDevelopment) {
        console.log('✅ Serving file:', filename);
        console.log('📁 File path:', filePathToUse);
      }

      res.sendFile(filePathToUse);
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(500).json({
        success: false,
        message: 'Error serving file'
      });
    }
  };
};

module.exports = {
  createFileServerRoute,
  authenticateUser,
  validateFilename,
  validateFilePath,
  getFileHeaders
};

