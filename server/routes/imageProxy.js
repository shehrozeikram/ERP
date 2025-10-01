/**
 * Image Proxy Route for ZKBio Time Images
 * This route proxies images from ZKBio Time with proper authentication
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

// Import the WebSocket proxy to get session cookies
let zkbioTimeWebSocketProxy = null;

// Function to set the WebSocket proxy reference
function setZKBioTimeWebSocketProxy(proxy) {
  zkbioTimeWebSocketProxy = proxy;
  console.log('✅ Image proxy connected to ZKBio Time WebSocket proxy');
}

// Function to get ZKBio Time session cookies from WebSocket proxy
async function getZKBioSessionCookies() {
  if (zkbioTimeWebSocketProxy && zkbioTimeWebSocketProxy.sessionCookies) {
    return zkbioTimeWebSocketProxy.sessionCookies;
  }
  
  // If no cookies, try to authenticate
  console.log('⚠️  No session cookies available, attempting to authenticate...');
  if (zkbioTimeWebSocketProxy) {
    const authSuccess = await zkbioTimeWebSocketProxy.authenticateWithZKBioTime();
    if (authSuccess && zkbioTimeWebSocketProxy.sessionCookies) {
      console.log('✅ Successfully authenticated for image proxy');
      return zkbioTimeWebSocketProxy.sessionCookies;
    }
  }
  
  console.log('❌ Failed to obtain ZKBio Time session cookies');
  return null;
}

// Image proxy endpoint with automatic retry
router.get('/zkbio-image/:path(*)', async (req, res) => {
  try {
    const imagePath = req.params.path;
    const fullImageUrl = `http://45.115.86.139:85/${imagePath}`;
    
    console.log(`🖼️ Proxying image: ${fullImageUrl}`);
    
    // Get session cookies from WebSocket proxy (with auto-authentication)
    let cookies = await getZKBioSessionCookies();
    if (!cookies) {
      console.log('❌ No authentication available for image proxy');
      return res.status(503).json({ 
        error: 'ZKBio Time authentication unavailable',
        message: 'Unable to authenticate with ZKBio Time server. Please try again later.'
      });
    }
    
    // Attempt to fetch image with authentication
    try {
      const imageResponse = await axios.get(fullImageUrl, {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'http://45.115.86.139:85/'
        },
        responseType: 'stream',
        timeout: 10000
      });
      
      // Set appropriate headers
      res.set({
        'Content-Type': imageResponse.headers['content-type'] || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*'
      });
      
      // Pipe the image data to response
      imageResponse.data.pipe(res);
      
    } catch (imageError) {
      // If we get a 401/403, try to re-authenticate and retry once
      if (imageError.response && (imageError.response.status === 401 || imageError.response.status === 403)) {
        console.log('🔄 Authentication expired, re-authenticating and retrying...');
        
        // Force re-authentication
        if (zkbioTimeWebSocketProxy) {
          zkbioTimeWebSocketProxy.sessionCookies = null;
          const authSuccess = await zkbioTimeWebSocketProxy.authenticateWithZKBioTime();
          
          if (authSuccess && zkbioTimeWebSocketProxy.sessionCookies) {
            // Retry with new cookies
            const retryResponse = await axios.get(fullImageUrl, {
              headers: {
                'Cookie': zkbioTimeWebSocketProxy.sessionCookies,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': 'http://45.115.86.139:85/'
              },
              responseType: 'stream',
              timeout: 10000
            });
            
            res.set({
              'Content-Type': retryResponse.headers['content-type'] || 'image/jpeg',
              'Cache-Control': 'public, max-age=3600',
              'Access-Control-Allow-Origin': '*'
            });
            
            retryResponse.data.pipe(res);
            console.log('✅ Image fetched successfully after re-authentication');
            return;
          }
        }
      }
      
      throw imageError;
    }
    
  } catch (error) {
    console.error('❌ Error proxying image:', error.message);
    
    // Send a more informative error response
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ 
        error: 'ZKBio Time server unavailable',
        message: 'Unable to connect to ZKBio Time server'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch image',
      message: error.message 
    });
  }
});

module.exports = {
  router,
  setZKBioTimeWebSocketProxy
};
