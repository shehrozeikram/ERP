module.exports = {
  apps: [
    {
      name: 'sgc-erp-backend',
      script: 'server/index.js',
      instances: 1, // Single instance for WebSocket compatibility
      exec_mode: 'fork', // Use fork mode instead of cluster for WebSocket support
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10
    }
  ]
};
