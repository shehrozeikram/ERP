const express = require('express');
const app = express();

// Simple test server to verify routes
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route working', timestamp: new Date().toISOString() });
});

// Test job postings route
app.get('/api/job-postings', (req, res) => {
  res.json({ 
    message: 'Job postings route working', 
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    url: req.url
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Test server running',
    timestamp: new Date().toISOString(),
    routes: [
      '/api/test',
      '/api/job-postings',
      '/health'
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path,
    url: req.url,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`🧪 Test server running on port ${PORT}`);
  console.log(`📊 Test routes:`);
  console.log(`   - GET /health`);
  console.log(`   - GET /api/test`);
  console.log(`   - GET /api/job-postings`);
  console.log(`🌐 Test URL: http://localhost:${PORT}/health`);
});

module.exports = app;
