#!/bin/bash
set -e

echo "=== BassNotion Frontend Setup Script ==="
echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo "Installing npm dependencies..."
npm install --no-optional --no-audit --no-fund

echo "Building contracts library..."
cd ../../libs/contracts
echo "Contracts directory: $(pwd)"
npm install --no-optional --no-audit --no-fund
npm run build

# Verify build output
if [ ! -f "dist/index.js" ]; then
  echo "ERROR: Contracts build failed - dist/index.js not found"
  exit 1
fi

echo "Contracts build successful, files:"
ls -la dist/

cd ../../apps/frontend
echo "Back to frontend directory: $(pwd)"

echo "Setting up contracts library..."
mkdir -p node_modules/@bassnotion/contracts

# Copy all files from contracts library
cp -r ../../libs/contracts/* node_modules/@bassnotion/contracts/

# Verify the copy worked
if [ ! -f "node_modules/@bassnotion/contracts/dist/index.js" ]; then
  echo "ERROR: Contracts copy failed - dist/index.js not found in node_modules"
  exit 1
fi

echo "Contracts library copied successfully:"
ls -la node_modules/@bassnotion/contracts/
echo "Contracts dist files:"
ls -la node_modules/@bassnotion/contracts/dist/

echo "Contracts library setup complete!" 