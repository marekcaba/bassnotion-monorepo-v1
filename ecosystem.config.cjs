module.exports = {
  apps: [
    {
      name: 'bassnotion-backend',
      script: 'pnpm',
      args: 'nx serve @bassnotion/backend',
      cwd: '/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1',
      env_file: './apps/backend/.env.local',
      env: {
        NODE_ENV: 'development',
        PORT: '3000',
        // Prevent NX daemon conflicts
        NX_DAEMON: 'true',
        NX_SKIP_NX_CACHE: 'false',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-error.log',
      combine_logs: true,
      // Add delay to prevent simultaneous startup
      increment_var: 'PORT',
    },
    {
      name: 'bassnotion-frontend',
      script: 'pnpm',
      args: 'nx serve @bassnotion/frontend',
      cwd: '/Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1',
      env_file: './apps/frontend/.env.local',
      env: {
        NODE_ENV: 'development',
        PORT: '3001',
        // Prevent NX daemon conflicts
        NX_DAEMON: 'true',
        NX_SKIP_NX_CACHE: 'false',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 6000, // Longer delay than backend
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/frontend-out.log',
      error_file: './logs/frontend-error.log',
      combine_logs: true,
      // Add delay to prevent simultaneous startup
      increment_var: 'PORT',
    },
  ],
};
