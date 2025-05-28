#!/bin/bash

# Build script for BassNotion Backend
echo "Starting BassNotion Backend build process..."

# Set environment variables for production build
export NODE_ENV=production

# Build the backend using Nx
echo "Building backend with Nx..."
npx nx build @bassnotion/backend --prod --skip-nx-cache --verbose --force

echo "Build completed successfully!" 