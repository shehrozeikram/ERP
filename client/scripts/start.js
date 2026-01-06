// Custom start script to suppress webpack dev server deprecation warnings
const { spawn } = require('child_process');
const path = require('path');

// Filter out specific deprecation warnings
const filterWarnings = (data) => {
  const output = data.toString();
  const lines = output.split('\n');
  
  const filteredLines = lines.filter(line => {
    // Filter out webpack dev server deprecation warnings
    if (line.includes('DEP_WEBPACK_DEV_SERVER_ON_AFTER_SETUP_MIDDLEWARE')) return false;
    if (line.includes('DEP_WEBPACK_DEV_SERVER_ON_BEFORE_SETUP_MIDDLEWARE')) return false;
    if (line.includes('onAfterSetupMiddleware')) return false;
    if (line.includes('onBeforeSetupMiddleware')) return false;
    if (line.includes('setupMiddlewares')) return false;
    return true;
  });
  
  return filteredLines.join('\n');
};

// Start react-scripts
const reactScripts = spawn('react-scripts', ['start'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: {
    ...process.env,
    // Suppress Node deprecation warnings
    NODE_OPTIONS: (process.env.NODE_OPTIONS || '') + ' --no-deprecation'
  }
});

// Filter stdout
reactScripts.stdout.on('data', (data) => {
  const filtered = filterWarnings(data);
  if (filtered.trim()) {
    process.stdout.write(filtered);
  }
});

// Filter stderr
reactScripts.stderr.on('data', (data) => {
  const filtered = filterWarnings(data);
  if (filtered.trim()) {
    process.stderr.write(filtered);
  }
});

reactScripts.on('close', (code) => {
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  reactScripts.kill('SIGINT');
});

process.on('SIGTERM', () => {
  reactScripts.kill('SIGTERM');
});

