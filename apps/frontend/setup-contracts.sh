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

echo "Dist folder:"
ls -la node_modules/@bassnotion/contracts/dist/src/

echo "Setup complete!" 