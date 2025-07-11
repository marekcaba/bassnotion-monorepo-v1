#!/bin/bash
set -e

echo "=== BassNotion Frontend Setup Script ==="
echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo "Installing npm dependencies..."
npm install --no-optional --no-audit --no-fund

# Verify critical frontend dependencies
echo "Verifying critical dependencies..."

# Always install @formkit/auto-animate explicitly to ensure it's available
echo "Installing @formkit/auto-animate explicitly..."
npm install @formkit/auto-animate@^0.8.2 --no-optional --no-audit --no-fund

if [ ! -d "node_modules/@radix-ui" ]; then
  echo "Installing Radix UI components explicitly..."
  npm install @radix-ui/react-dialog @radix-ui/react-alert-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-toast --no-optional --no-audit --no-fund
fi

if [ ! -d "node_modules/motion" ]; then
  echo "Installing motion library explicitly..."
  npm install motion@^12.15.0 --no-optional --no-audit --no-fund
fi

echo "Frontend dependencies verification complete."

echo "Building contracts library..."
cd ../../libs/contracts
echo "Contracts directory: $(pwd)"

# Check if package.json exists
if [ ! -f "package.json" ]; then
  echo "ERROR: package.json not found in contracts directory"
  exit 1
fi

echo "Contracts package.json content:"
cat package.json

# Install dependencies with verbose logging
echo "Installing contracts dependencies..."
npm install --no-optional --no-audit --no-fund --verbose

# Check if dependencies were installed (use ls instead of npm list to avoid version conflicts)
echo "Checking if node_modules directory exists:"
ls -la node_modules/ || echo "node_modules not found"

# Verify zod is available by checking the directory
if [ ! -d "node_modules/zod" ]; then
  echo "WARNING: zod not found in node_modules, installing explicitly..."
  npm install zod@^3.25.32 --no-optional --no-audit --no-fund
fi

# Verify typescript is available
if [ ! -d "node_modules/typescript" ]; then
  echo "WARNING: typescript not found in node_modules, installing explicitly..."
  npm install typescript@5.3.3 --no-optional --no-audit --no-fund
fi

echo "Key dependencies check:"
echo "Zod: $([ -d "node_modules/zod" ] && echo "✓ Found" || echo "✗ Missing")"
echo "TypeScript: $([ -d "node_modules/typescript" ] && echo "✓ Found" || echo "✗ Missing")"

echo "Building contracts..."
npm run build

# Verify build output
if [ ! -f "dist/src/index.js" ]; then
  echo "ERROR: Contracts build failed - dist/src/index.js not found"
  echo "Contents of dist directory:"
  ls -la dist/ || echo "dist directory does not exist"
  exit 1
fi

echo "Contracts build successful, files:"
ls -la dist/

cd ../../apps/frontend
echo "Back to frontend directory: $(pwd)"

echo "Setting up contracts library..."
mkdir -p node_modules/@bassnotion/contracts

# Copy all files from contracts library
cp -r ../../libs/contracts/* node_modules/@bassnotion/contracts/

# Verify the copy worked
if [ ! -f "node_modules/@bassnotion/contracts/dist/src/index.js" ]; then
  echo "ERROR: Contracts copy failed - dist/src/index.js not found in node_modules"
  exit 1
fi

echo "Contracts library copied successfully:"
ls -la node_modules/@bassnotion/contracts/
echo "Contracts dist files:"
ls -la node_modules/@bassnotion/contracts/dist/

echo "Final dependency verification:"
echo "@formkit/auto-animate: $([ -d "node_modules/@formkit/auto-animate" ] && echo "✓ Found" || echo "✗ Missing")"
echo "@formkit/auto-animate/react: $([ -f "node_modules/@formkit/auto-animate/react/index.js" ] && echo "✓ Found" || echo "✗ Missing")"
echo "@radix-ui: $([ -d "node_modules/@radix-ui" ] && echo "✓ Found" || echo "✗ Missing")"
echo "motion: $([ -d "node_modules/motion" ] && echo "✓ Found" || echo "✗ Missing")"

echo "Contracts library setup complete!" 