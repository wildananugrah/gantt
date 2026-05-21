// PM2 ecosystem file for the Hono server.
// Runs Bun directly with the repo-root .env loaded via --env-file.
//
// Usage (from packages/server/):
//   pm2 start ecosystem.config.cjs
//   pm2 stop gantt-server
//   pm2 restart gantt-server --update-env
//   pm2 logs gantt-server
//   pm2 delete gantt-server

module.exports = {
  apps: [
    {
      name: 'gantt-server',
      interpreter: 'bun',
      interpreter_args: '--env-file=../../.env',
      script: 'src/index.ts',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
    },
  ],
};
