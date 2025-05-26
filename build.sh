#!/bin/bash
set -e

echo "Starting BassNotion backend build..."

# Disable Nx Cloud
export NX_CLOUD_ACCESS_TOKEN=""
export NX_REJECT_UNKNOWN_LOCAL_CACHE=0

# Install dependencies
echo "Installing dependencies..."
pnpm install --no-frozen-lockfile

# Build contracts library explicitly
echo "Building contracts library..."
cd libs/contracts && pnpm build && cd ../..

# Verify contracts library was built
echo "Verifying contracts library build..."
ls -la libs/contracts/dist/

# Re-install to ensure workspace linking
echo "Re-linking workspace dependencies..."
pnpm install --no-frozen-lockfile

# Build the backend only (not e2e tests)
echo "Building backend..."
npx nx build @bassnotion/backend --prod --skip-nx-cache --verbose --force

echo "Build completed successfully!" 