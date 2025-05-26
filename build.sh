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
cd libs/contracts

# Ensure dist directory exists
mkdir -p dist

# Build with verbose output
echo "Running TypeScript compilation..."
pnpm build --verbose || {
  echo "TypeScript compilation failed. Checking for errors..."
  npx tsc --noEmit --listFiles
  exit 1
}

cd ../..

# Verify contracts library was built
echo "Verifying contracts library build..."
if [ -d "libs/contracts/dist" ]; then
  ls -la libs/contracts/dist/
  echo "Contracts library built successfully!"
else
  echo "ERROR: Contracts library dist folder was not created!"
  exit 1
fi

# Re-install to ensure workspace linking
echo "Re-linking workspace dependencies..."
pnpm install --no-frozen-lockfile

# Build the backend only (not e2e tests)
echo "Building backend..."
npx nx build @bassnotion/backend --prod --skip-nx-cache --verbose --force

echo "Build completed successfully!" 