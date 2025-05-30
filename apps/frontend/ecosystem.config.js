module.exports = {
  apps: [
    {
      name: 'frontend',
      script: 'pnpm',
      args: 'dev',
      env: {
        PORT: 3001,
        NODE_ENV: 'development',
      },
    },
  ],
};
