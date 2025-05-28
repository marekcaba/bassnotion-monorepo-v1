#!/bin/bash
set -e

echo "Building BassNotion Frontend..."

# Navigate to frontend directory
cd apps/frontend

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the application
echo "Building application..."
npm run build

echo "Build completed successfully!" 