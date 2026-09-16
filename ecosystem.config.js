module.exports = {
  apps: [
    {
      name: 'ai-trend-news-bot',
      script: 'dashboard.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    },
    {
      name: 'cloudflare-tunnel',
      script: 'cloudflared.exe',
      args: 'tunnel --protocol http2 --url http://localhost:4000',
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
