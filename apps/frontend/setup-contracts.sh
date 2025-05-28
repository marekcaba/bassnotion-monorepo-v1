#!/bin/bash
set -e

echo "Installing npm dependencies..."
npm install

echo "Building contracts library..."
cd ../../libs/contracts
npm install
npm run build
cd ../../apps/frontend

echo "Setting up contracts library..."
mkdir -p node_modules/@bassnotion/contracts
cp -r ../../libs/contracts/* node_modules/@bassnotion/contracts/

echo "Contracts library copied:"
ls -la node_modules/@bassnotion/contracts/

echo "Dist folder contents:"
ls -la node_modules/@bassnotion/contracts/dist/

echo "Checking if dist/src exists:"
if [ -d "node_modules/@bassnotion/contracts/dist/src" ]; then
    echo "dist/src exists:"
    ls -la node_modules/@bassnotion/contracts/dist/src/
else
    echo "dist/src does not exist, showing all dist contents:"
    find node_modules/@bassnotion/contracts/dist/ -type f
fi

echo "Setup complete!" 