#!/usr/bin/env node

/**
 * Direct Upload to Supabase using Service Role Key
 * For admin use only - uses service role key directly
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment from backend .env.local
const envPath = path.join(__dirname, '..', 'apps', 'backend', '.env.local');
let envVars = {};

try {
  const envContent = await fs.readFile(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (error) {
  console.error('❌ Failed to load environment variables:', error.message);
  process.exit(1);
}

const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase configuration in backend .env.local');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BASE_DIR = path.join(__dirname, '..');
const SAMPLES_DIR = path.join(BASE_DIR, 'public', 'samples', 'keyboards');
const BUCKET_NAME = 'audio-samples';

async function uploadFile(localPath, remotePath, contentType = 'audio/mpeg') {
  try {
    const fileBuffer = await fs.readFile(localPath);

    console.log(`📤 Uploading: ${remotePath}`);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(remotePath, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    console.log(`✅ Uploaded: ${remotePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Upload failed for ${remotePath}:`, error.message);
    return false;
  }
}

async function uploadKeyboardSamples(keyboardId, keyboardDir) {
  console.log(`\n🎹 Uploading keyboard: ${keyboardId}`);

  const samplesDir = path.join(keyboardDir, 'samples');
  const metadataPath = path.join(keyboardDir, 'metadata.json');

  // Check if samples exist
  try {
    await fs.access(samplesDir);
  } catch {
    console.warn(`⚠️  No samples found for ${keyboardId}, skipping...`);
    return { success: false, uploaded: 0 };
  }

  // Upload individual sample files
  const sampleFiles = await fs.readdir(samplesDir);
  let uploadedCount = 0;

  for (const sampleFile of sampleFiles) {
    if (!sampleFile.endsWith('.mp3')) continue;

    const localPath = path.join(samplesDir, sampleFile);
    const remotePath = `keyboards/${keyboardId}/${sampleFile}`;

    if (await uploadFile(localPath, remotePath, 'audio/mpeg')) {
      uploadedCount++;
    }
  }

  // Upload metadata if exists
  try {
    await fs.access(metadataPath);
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(metadataContent);
    
    // Add CDN URLs to metadata
    metadata.cdnBase = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/keyboards/${keyboardId}`;
    metadata.uploadedAt = new Date().toISOString();
    
    const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
    await uploadFile(
      metadataPath,
      `keyboards/${keyboardId}/metadata.json`,
      'application/json'
    );
  } catch {
    console.log('ℹ️  No metadata file found');
  }

  console.log(`✅ Uploaded ${uploadedCount} samples for ${keyboardId}`);
  return { success: uploadedCount > 0, uploaded: uploadedCount };
}

async function main() {
  console.log('🎹 Direct Professional Keyboard Upload to Supabase');
  console.log('================================================\n');

  console.log('🔐 Using Service Role Key for Direct Upload');
  console.log(`🌐 Supabase URL: ${SUPABASE_URL}`);
  console.log(`📦 Target Bucket: ${BUCKET_NAME}\n`);

  // Test connection
  console.log('🔗 Testing Supabase connection...');
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('keyboards/', { limit: 1 });
      
    if (error) {
      console.warn('⚠️  List operation failed:', error.message);
      console.log('📝 Proceeding with upload anyway...');
    } else {
      console.log('✅ Connected to Supabase storage');
    }
  } catch (error) {
    console.warn('⚠️  Connection test failed:', error.message);
    console.log('📝 Proceeding with upload...');
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
  validKeyboards.forEach((keyboard) => console.log(`• ${keyboard}`));

  // Upload keyboards
  let totalUploaded = 0;
  const results = [];

  for (const keyboardId of validKeyboards) {
    const keyboardDir = path.join(SAMPLES_DIR, keyboardId);
    const result = await uploadKeyboardSamples(keyboardId, keyboardDir);
    
    if (result.success) {
      totalUploaded += result.uploaded;
      results.push({
        keyboard: keyboardId,
        uploaded: result.uploaded,
        url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/keyboards/${keyboardId}/`
      });
    }
  }

  // Create master index
  if (totalUploaded > 0) {
    console.log('\n📋 Creating master index...');
    
    const masterIndex = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      description: 'Professional keyboard instruments for BassNotion',
      keyboards: results.map(r => ({
        id: r.keyboard,
        url: r.url,
        sampleCount: r.uploaded
      })),
      totalSamples: totalUploaded
    };
    
    const indexBuffer = Buffer.from(JSON.stringify(masterIndex, null, 2));
    await uploadFile(
      Buffer.from(JSON.stringify(masterIndex, null, 2)),
      'metadata/keyboard-instruments.json',
      'application/json'
    );
  }

  console.log(`\n📊 Upload Summary:`);
  console.log(`✅ Total samples uploaded: ${totalUploaded}`);
  
  if (results.length > 0) {
    console.log('\n🌐 CDN URLs:');
    results.forEach(r => {
      console.log(`• ${r.keyboard}: ${r.url}`);
    });
    
    console.log(`\n🎯 Next Steps:`);
    console.log(`1. Visit: http://localhost:3001/test-harmony`);
    console.log(`2. Click Play to test professional samples`);
    console.log(`3. Check console for: "Loading professional samples from Supabase"`);
    
    console.log('\n📋 Sample URLs for testing:');
    console.log(`${results[0].url}C4.mp3`);
  }
  
  console.log('\n🎹 Upload complete!');
}

main().catch((error) => {
  console.error('❌ Upload script failed:', error);
  process.exit(1);
});