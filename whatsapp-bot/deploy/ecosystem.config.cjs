// PM2: mantiene el bot corriendo 24/7 y lo reinicia si se cae.
// Uso: pm2 start deploy/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'pcworkers-bot',
      script: 'src/index.js',
      cwd: __dirname + '/..',
      instances: 1, // dejar en 1: la memoria del bot es local
      autorestart: true,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
