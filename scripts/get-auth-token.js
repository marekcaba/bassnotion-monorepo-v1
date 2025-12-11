#!/usr/bin/env node

/**
 * Get Authentication Token for Admin Operations
 * This script logs in a user and returns the JWT token
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/v1';

async function getAuthToken(email, password) {
  try {
    console.log('🔐 Authenticating user...');

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${error}`);
    }

    const data = await response.json();

    if (!data.accessToken) {
      throw new Error('No access token in response');
    }

    console.log('✅ Authentication successful!');
    console.log('\n📋 To use the token for uploads:');
    console.log(`export BASSNOTION_ADMIN_TOKEN="${data.accessToken}"`);
    console.log('\nThen run:');
    console.log('node scripts/upload-keyboards-via-api.js');

    return data.accessToken;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Backend is running: pnpm dev:backend');
    console.error('2. You have valid credentials');
    process.exit(1);
  }
}

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Usage: node scripts/get-auth-token.js <email> <password>');
    console.log('\nExample:');
    console.log(
      'node scripts/get-auth-token.js admin@bassnotion.com YourPassword123!',
    );
    process.exit(1);
  }

  await getAuthToken(email, password);
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
