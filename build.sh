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

# Build with TypeScript
echo "Running TypeScript compilation..."
echo "Current working directory: $(pwd)"
echo "TypeScript config:"
cat tsconfig.json

pnpm build || {
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
  echo "Contents of dist/index.js:"
  head -20 libs/contracts/dist/index.js || echo "Could not read index.js"
  echo "Contents of dist/index.d.ts:"
  head -20 libs/contracts/dist/index.d.ts || echo "Could not read index.d.ts"
else
  echo "ERROR: Contracts library dist folder was not created!"
  exit 1
fi

# Re-install to ensure workspace linking
echo "Re-linking workspace dependencies..."
pnpm install --no-frozen-lockfile

# Verify workspace linking
echo "Verifying workspace linking..."
echo "Backend node_modules/@bassnotion/contracts:"
ls -la apps/backend/node_modules/@bassnotion/ 2>/dev/null || echo "No @bassnotion directory found"
echo "Root node_modules/@bassnotion/contracts:"
ls -la node_modules/@bassnotion/ 2>/dev/null || echo "No @bassnotion directory found"

# If workspace linking failed, create manual symlink
if [ ! -d "node_modules/@bassnotion/contracts" ]; then
  echo "Workspace linking failed, creating manual symlink..."
  mkdir -p node_modules/@bassnotion
  ln -sf "$(pwd)/libs/contracts" node_modules/@bassnotion/contracts
  echo "Manual symlink created:"
  ls -la node_modules/@bassnotion/contracts
fi

# Build the backend only (not e2e tests)
echo "Building backend..."
npx nx build @bassnotion/backend --prod --skip-nx-cache --verbose --force

echo "Build completed successfully!" 