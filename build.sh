#!/bin/bash
set -e

echo "Starting BassNotion backend build..."

# Disable Nx Cloud
export NX_CLOUD_ACCESS_TOKEN=""
export NX_REJECT_UNKNOWN_LOCAL_CACHE=0

# Install dependencies
echo "Installing dependencies..."
pnpm install --no-frozen-lockfile

# Build all TypeScript project references first
echo "Building TypeScript project references..."
npx tsc --build

# Verify contracts library was built
echo "Verifying contracts library build..."
ls -la libs/contracts/dist/

# Build the backend
echo "Building backend..."
npx nx build @bassnotion/backend --prod --skip-nx-cache --verbose --force

echo "Build completed successfully!" 