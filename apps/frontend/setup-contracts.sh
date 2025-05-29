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

# Check if package.json exists
if [ ! -f "package.json" ]; then
  echo "ERROR: package.json not found in contracts directory"
  exit 1
fi

echo "Contracts package.json content:"
cat package.json

# Install dependencies with verbose logging
echo "Installing contracts dependencies..."
npm install --no-optional --no-audit --no-fund --verbose

# Check if zod was installed
echo "Checking installed packages:"
npm list

# Verify zod is available
if [ ! -d "node_modules/zod" ]; then
  echo "WARNING: zod not found in node_modules, installing explicitly..."
  npm install zod@^3.25.32 --no-optional --no-audit --no-fund
fi

echo "Building contracts..."
npm run build

# Verify build output
if [ ! -f "dist/index.js" ]; then
  echo "ERROR: Contracts build failed - dist/index.js not found"
  echo "Contents of dist directory:"
  ls -la dist/ || echo "dist directory does not exist"
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