#!/bin/bash

# Simple test script to check if the server is running

# Exit on any error
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Server configuration
export PORT=3000
export NODE_ENV=development

echo "📡 Starting server on http://localhost:3000"

# Start the server in the background
npm run start:dev &
SERVER_PID=$!

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found!"
    echo "Please create .env.local with your environment variables"
    exit 1
fi

# Load environment variables
export NODE_ENV=development
export PORT=3000

# Start the server
echo "📡 Starting server on http://localhost:3000"
npm run start:dev 