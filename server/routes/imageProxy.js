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
function getZKBioSessionCookies() {
  if (zkbioTimeWebSocketProxy && zkbioTimeWebSocketProxy.sessionCookies) {
    console.log('✅ Using existing ZKBio Time session cookies from WebSocket proxy');
    return zkbioTimeWebSocketProxy.sessionCookies;
  }
  
  console.log('❌ No ZKBio Time session cookies available from WebSocket proxy');
  return null;
}

// Image proxy endpoint
router.get('/zkbio-image/:path(*)', async (req, res) => {
  try {
    const imagePath = req.params.path;
    const fullImageUrl = `http://45.115.86.139:85/${imagePath}`;
    
    console.log(`🖼️ Proxying image: ${fullImageUrl}`);
    
    // Get session cookies from WebSocket proxy
    const cookies = getZKBioSessionCookies();
    if (!cookies) {
      return res.status(401).json({ error: 'No ZKBio Time session cookies available' });
    }
    
    // Fetch image with authentication
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
    
  } catch (error) {
    console.error('❌ Error proxying image:', error.message);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

module.exports = {
  router,
  setZKBioTimeWebSocketProxy
};
