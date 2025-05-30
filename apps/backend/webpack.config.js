const { composePlugins, withNx } = require('@nx/webpack');
const { join } = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

// Exportujeme funkci jako modul.exports
module.exports = composePlugins(withNx(), (config) => {
  config.target = 'node';
  // Externals je klíčové pro NestJS, aby se nevyžadovalo bundlování node_modules
  config.externals = [
    /^@nestjs\/platform-express$/,
    /^@nestjs\/common$/,
    /^@nestjs\/core$/,
    // Přidejte další NestJS balíčky, pokud se objeví chyby "Module not found"
    // u NestJS interních modulů, které by měly být externí.
  ];
  config.output.libraryTarget = 'commonjs2'; // Stále chceme CommonJS výstup

  config.resolve = {
    ...config.resolve,
    extensions: ['.ts', '.js', '.json'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: join(__dirname, 'tsconfig.json'),
      }),
    ],
    alias: {
      '@': join(__dirname, 'src'),
    },
  };

  // Enable source maps
  config.devtool = 'source-map';

  return config;
});
