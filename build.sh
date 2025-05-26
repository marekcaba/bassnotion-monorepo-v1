#!/bin/bash
set -e

echo "Starting BassNotion backend build..."

# Disable Nx Cloud
export NX_CLOUD_ACCESS_TOKEN=""
export NX_REJECT_UNKNOWN_LOCAL_CACHE=0

# Install dependencies
echo "Installing dependencies..."
pnpm install --no-frozen-lockfile

# Build contracts library first
echo "Building contracts library..."
cd libs/contracts && pnpm build && cd ../..

# Build the backend
echo "Building backend..."
npx nx build @bassnotion/backend --prod --skip-nx-cache --verbose --force

echo "Build completed successfully!" 