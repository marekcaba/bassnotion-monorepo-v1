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

# Debug: Check if source files exist
echo "Checking contracts library structure..."
pwd
ls -la
echo "Source files:"
find src -name "*.ts" -type f 2>/dev/null || echo "No TypeScript files found in src/"

# Ensure dist directory exists
mkdir -p dist

# Build with verbose output
echo "Running TypeScript compilation..."
echo "Current working directory: $(pwd)"
echo "TypeScript config:"
cat tsconfig.json

pnpm build --verbose || {
  echo "TypeScript compilation failed. Checking for errors..."
  echo "Running tsc with noEmit to see errors:"
  npx tsc --noEmit
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