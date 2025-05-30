#!/bin/bash

# Script to start backend server for E2E testing

echo "🚀 Starting BassNotion Backend for E2E Testing..."

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