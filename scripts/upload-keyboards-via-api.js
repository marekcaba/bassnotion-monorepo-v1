#!/usr/bin/env node

/**
 * Upload Professional Keyboard Samples via Backend API
 * Uses authenticated backend endpoint for secure uploads
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, '..');
const SAMPLES_DIR = path.join(BASE_DIR, 'public', 'samples', 'keyboards');
const API_URL = 'http://localhost:3000/api/v1';

// For this script, we'll need a way to authenticate
// In production, this would be a proper admin user token
// For now, we'll create a simple auth mechanism

async function getAuthToken() {
  // This is a placeholder - in production, you'd get this from:
  // 1. Environment variable with admin credentials
  // 2. Interactive login
  // 3. Service account credentials
  
  console.log('⚠️  Note: You need to be logged in as an authenticated user');
  console.log('   Please ensure the backend is running and you have a valid JWT token');
  
  // For now, we'll need to manually provide a token
  const token = process.env.BASSNOTION_ADMIN_TOKEN;
  
  if (!token) {
    console.error('❌ No authentication token found');
    console.error('   Set BASSNOTION_ADMIN_TOKEN environment variable with a valid JWT');
    console.error('   You can get this from the browser DevTools after logging in');
    process.exit(1);
  }
  
  return token;
}

async function uploadSample(token, filePath, remotePath, contentType) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const base64Buffer = fileBuffer.toString('base64');
    
    console.log(`📤 Uploading: ${remotePath}`);
    
    const response = await fetch(`${API_URL}/audio-samples/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        path: remotePath,
        buffer: base64Buffer,
        contentType,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    const result = await response.json();
    console.log(`✅ Uploaded: ${remotePath}`);
    
    return result;
  } catch (error) {
    console.error(`❌ Upload failed for ${remotePath}:`, error.message);
    throw error;
  }
}

async function uploadBatch(token, samples) {
  try {
    console.log(`📦 Uploading batch of ${samples.length} samples...`);
    
    const response = await fetch(`${API_URL}/audio-samples/upload-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ samples }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    const result = await response.json();
    console.log(`✅ Batch upload complete: ${result.summary.successful}/${result.summary.total} successful`);
    
    return result;
  } catch (error) {
    console.error(`❌ Batch upload failed:`, error.message);
    throw error;
  }
}

async function createMetadata(token, path, metadata) {
  try {
    console.log(`📋 Creating metadata: ${path}`);
    
    const response = await fetch(`${API_URL}/audio-samples/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ path, metadata }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    console.log(`✅ Metadata created: ${path}`);
  } catch (error) {
    console.error(`❌ Metadata creation failed:`, error.message);
    throw error;
  }
}

async function uploadKeyboardSamples(token, keyboardId, keyboardDir) {
  console.log(`\n🎹 Uploading keyboard: ${keyboardId}`);
  
  const samplesDir = path.join(keyboardDir, 'samples');
  const metadataPath = path.join(keyboardDir, 'metadata.json');
  
  // Check if samples exist
  try {
    await fs.access(samplesDir);
    await fs.access(metadataPath);
  } catch {
    console.warn(`⚠️  No samples found for ${keyboardId}, skipping...`);
    return { success: false, uploaded: 0 };
  }
  
  // Load metadata
  const metadataContent = await fs.readFile(metadataPath, 'utf8');
  const metadata = JSON.parse(metadataContent);
  
  // Prepare batch upload
  const sampleFiles = await fs.readdir(samplesDir);
  const samples = [];
  
  for (const sampleFile of sampleFiles) {
    if (!sampleFile.endsWith('.mp3')) continue;
    
    const localPath = path.join(samplesDir, sampleFile);
    const remotePath = `keyboards/${keyboardId}/${sampleFile}`;
    const buffer = await fs.readFile(localPath);
    
    samples.push({
      path: remotePath,
      buffer: buffer.toString('base64'),
      contentType: 'audio/mpeg',
    });
  }
  
  // Upload in batches of 5 to avoid payload size limits
  const batchSize = 5;
  let totalUploaded = 0;
  
  for (let i = 0; i < samples.length; i += batchSize) {
    const batch = samples.slice(i, i + batchSize);
    try {
      const result = await uploadBatch(token, batch);
      totalUploaded += result.summary.successful;
    } catch (error) {
      console.error(`❌ Batch upload failed:`, error.message);
    }
  }
  
  // Update metadata with URLs
  metadata.uploadedAt = new Date().toISOString();
  metadata.cdnBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://htuztkrbuewheehjspcz.supabase.co'}/storage/v1/object/public/audio-samples/keyboards/${keyboardId}`;
  
  // Upload metadata
  await createMetadata(token, `metadata/keyboards/${keyboardId}.json`, metadata);
  
  console.log(`✅ Uploaded ${totalUploaded} samples for ${keyboardId}`);
  return { success: totalUploaded > 0, uploaded: totalUploaded, metadata };
}

async function main() {
  console.log('🎹 Professional Keyboard Upload via Backend API');
  console.log('=============================================\n');
  
  console.log('🔐 Secure Upload Architecture');
  console.log('• Uses authenticated backend endpoint');
  console.log('• Service role key stays server-side');
  console.log('• JWT authentication required');
  console.log('• Professional studio-quality samples\n');
  
  // Get authentication token
  const token = await getAuthToken();
  
  // Check if samples directory exists
  try {
    await fs.access(SAMPLES_DIR);
  } catch {
    console.error(`❌ Samples directory not found: ${SAMPLES_DIR}`);
    console.error('Please run: node scripts/create-sample-soundfonts.js first');
    process.exit(1);
  }
  
  // Find available keyboards
  const keyboardDirs = await fs.readdir(SAMPLES_DIR);
  const validKeyboards = [];
  
  for (const dir of keyboardDirs) {
    const fullPath = path.join(SAMPLES_DIR, dir);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      validKeyboards.push(dir);
    }
  }
  
  if (validKeyboards.length === 0) {
    console.error('❌ No keyboard samples found to upload');
    process.exit(1);
  }
  
  console.log(`\n🎹 Found ${validKeyboards.length} keyboards to upload:`);
  validKeyboards.forEach(keyboard => console.log(`• ${keyboard}`));
  
  // Upload keyboards
  const keyboardMetadata = {};
  let totalUploaded = 0;
  
  for (const keyboardId of validKeyboards) {
    const keyboardDir = path.join(SAMPLES_DIR, keyboardId);
    const result = await uploadKeyboardSamples(token, keyboardId, keyboardDir);
    
    if (result.success) {
      keyboardMetadata[keyboardId] = result.metadata;
      totalUploaded += result.uploaded;
    }
  }
  
  // Create master index
  if (Object.keys(keyboardMetadata).length > 0) {
    const masterIndex = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      description: 'Professional keyboard instruments for web audio platforms',
      architecture: 'Secure backend upload with CDN distribution',
      instruments: Object.values(keyboardMetadata),
      statistics: {
        totalInstruments: Object.keys(keyboardMetadata).length,
        totalSamples: totalUploaded,
      },
    };
    
    await createMetadata(token, 'metadata/keyboard-instruments.json', masterIndex);
    
    console.log(`\n📊 Upload Summary:`);
    console.log(`✅ Keyboards uploaded: ${Object.keys(keyboardMetadata).length}`);
    console.log(`✅ Total samples: ${totalUploaded}`);
    console.log(`✅ Master index: metadata/keyboard-instruments.json`);
    
    console.log(`\n🎯 Next Steps:`);
    console.log(`1. Ensure backend is running: pnpm dev:backend`);
    console.log(`2. Visit: http://localhost:3001/test-harmony`);
    console.log(`3. Click Play and listen for professional samples`);
    console.log(`4. Check console for: "Loading professional samples from Supabase"`);
    
    console.log('\n🌐 CDN URLs:');
    Object.entries(keyboardMetadata).forEach(([id, metadata]) => {
      console.log(`• ${metadata.name}: ${metadata.cdnBase}/`);
    });
  } else {
    console.error('❌ No keyboards were successfully uploaded');
    process.exit(1);
  }
  
  console.log('\n🎹 Professional keyboard samples deployed securely!');
}

main().catch(error => {
  console.error('❌ Upload script failed:', error);
  process.exit(1);
});