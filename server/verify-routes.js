#!/usr/bin/env node

const http = require('http');

const testRoutes = [
  '/api/health',
  '/api/job-postings',
  '/api/candidates',
  '/api/applications',
  '/api/hiring'
];

const baseUrl = 'http://localhost:5001';

async function testRoute(route) {
  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}${route}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          route,
          status: res.statusCode,
          success: res.statusCode === 200,
          data: data
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({
        route,
        status: 'ERROR',
        success: false,
        error: err.message
      });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        route,
        status: 'TIMEOUT',
        success: false,
        error: 'Request timeout'
      });
    });
  });
}

async function testAllRoutes() {
  console.log('🧪 Testing Talent Acquisition Routes...\n');
  
  for (const route of testRoutes) {
    const result = await testRoute(route);
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${route}: ${result.status}`);
    
    if (!result.success) {
      console.log(`   Error: ${result.error || result.data}`);
    }
  }
  
  console.log('\n🎯 Route testing completed!');
}

// Run the test
testAllRoutes();
