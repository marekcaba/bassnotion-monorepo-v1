#!/usr/bin/env node

/**
 * Upload Professional Keyboard Samples to Supabase
 * FAANG-style CDN distribution for web audio platforms
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', 'apps', 'frontend', '.env.local');
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

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration in .env.local');
  console.error(
    'Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    await fs.access(metadataPath);
  } catch {
    console.warn(`⚠️  No samples found for ${keyboardId}, skipping...`);
    return { success: false, uploaded: 0 };
  }

  // Load metadata
  let metadata;
  try {
    const metadataContent = await fs.readFile(metadataPath, 'utf8');
    metadata = JSON.parse(metadataContent);
  } catch (error) {
    console.error(
      `❌ Failed to read metadata for ${keyboardId}:`,
      error.message,
    );
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

  // Update metadata with Supabase URLs
  metadata.supabaseUrls = {};
  for (const sample of metadata.samples) {
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/keyboards/${keyboardId}/${sample.filename}`;
    metadata.supabaseUrls[sample.note] = publicUrl;
  }

  metadata.uploadedAt = new Date().toISOString();
  metadata.cdnBase = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/keyboards/${keyboardId}`;

  console.log(`✅ Uploaded ${uploadedCount} samples for ${keyboardId}`);
  return { success: uploadedCount > 0, uploaded: uploadedCount, metadata };
}

async function createMasterIndex(keyboardMetadata) {
  console.log('\n📋 Creating master instrument index...');

  const masterIndex = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    description: 'Professional keyboard instruments for web audio platforms',
    architecture: 'FAANG-style CDN distribution',
    instruments: Object.values(keyboardMetadata),
    categories: {
      acoustic_piano: Object.values(keyboardMetadata).filter(
        (k) => k.category === 'acoustic_piano',
      ),
      electric_piano: Object.values(keyboardMetadata).filter(
        (k) => k.category === 'electric_piano',
      ),
      organ: Object.values(keyboardMetadata).filter(
        (k) => k.category === 'organ',
      ),
      synthesizer: Object.values(keyboardMetadata).filter(
        (k) => k.category === 'synthesizer',
      ),
    },
    statistics: {
      totalInstruments: Object.keys(keyboardMetadata).length,
      totalSamples: Object.values(keyboardMetadata).reduce(
        (sum, k) => sum + (k.samples?.length || 0),
        0,
      ),
      totalCategories: Object.keys(masterIndex.categories).length,
    },
  };

  // Upload master index
  const indexBuffer = Buffer.from(JSON.stringify(masterIndex, null, 2));

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload('metadata/keyboard-instruments.json', indexBuffer, {
      contentType: 'application/json',
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  console.log('✅ Master index uploaded to metadata/keyboard-instruments.json');

  // Also create a public endpoint reference
  const publicIndexUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/metadata/keyboard-instruments.json`;
  console.log(`🌐 Public index URL: ${publicIndexUrl}`);

  return masterIndex;
}

async function testUploadedSamples(keyboardMetadata) {
  console.log('\n🧪 Testing uploaded samples...');

  for (const [keyboardId, metadata] of Object.entries(keyboardMetadata)) {
    console.log(`\n🎹 Testing ${metadata.name}:`);

    // Test a few sample URLs
    const testSamples = metadata.samples.slice(0, 3);

    for (const sample of testSamples) {
      const url = metadata.supabaseUrls[sample.note];
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          console.log(
            `✅ ${sample.note}: ${response.headers.get('content-length')} bytes`,
          );
        } else {
          console.log(`❌ ${sample.note}: HTTP ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ ${sample.note}: ${error.message}`);
      }
    }
  }
}

async function main() {
  console.log('🎹 Professional Keyboard Upload to Supabase');
  console.log('==========================================\n');

  console.log('🏗️  FAANG-Style CDN Architecture');
  console.log('• Global edge distribution via Supabase');
  console.log('• Optimized for web audio streaming');
  console.log('• Professional studio-quality samples');
  console.log('• Compatible with modern web audio workflows\n');

  // Test Supabase connection
  console.log('🔗 Testing Supabase connection...');
  console.log(`📦 Using bucket: ${BUCKET_NAME}`);
  
  // Test with a simple list operation on the bucket
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('keyboards/', { limit: 1 });
      
    if (error) {
      console.warn('⚠️  Bucket list test failed:', error.message);
      console.log('📝 Proceeding with upload anyway (bucket may exist with restricted list permissions)');
    } else {
      console.log(`✅ Connected to Supabase storage`);
    }
  } catch (error) {
    console.warn('⚠️  Storage test error:', error.message);
    console.log('📝 Proceeding with upload...');
  }

  // Check if samples directory exists
  try {
    await fs.access(SAMPLES_DIR);
  } catch {
    console.error(`❌ Samples directory not found: ${SAMPLES_DIR}`);
    console.error(
      'Please run: node scripts/download-professional-keyboards.js first',
    );
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
    console.error(
      'Please run: node scripts/download-professional-keyboards.js first',
    );
    process.exit(1);
  }

  console.log(`\n🎹 Found ${validKeyboards.length} keyboards to upload:`);
  validKeyboards.forEach((keyboard) => console.log(`• ${keyboard}`));

  // Upload keyboards
  const keyboardMetadata = {};
  let totalUploaded = 0;

  for (const keyboardId of validKeyboards) {
    const keyboardDir = path.join(SAMPLES_DIR, keyboardId);
    const result = await uploadKeyboardSamples(keyboardId, keyboardDir);

    if (result.success) {
      keyboardMetadata[keyboardId] = result.metadata;
      totalUploaded += result.uploaded;
    }
  }

  // Create master index
  if (Object.keys(keyboardMetadata).length > 0) {
    const masterIndex = await createMasterIndex(keyboardMetadata);

    console.log(`\n📊 Upload Summary:`);
    console.log(
      `✅ Keyboards uploaded: ${Object.keys(keyboardMetadata).length}`,
    );
    console.log(`✅ Total samples: ${totalUploaded}`);
    console.log(`✅ Master index: metadata/keyboard-instruments.json`);

    // Test uploaded samples
    await testUploadedSamples(keyboardMetadata);

    console.log(`\n🎯 Next Steps:`);
    console.log(`1. Visit: http://localhost:3001/test-harmony`);
    console.log(`2. Click Play and listen for professional samples`);
    console.log(
      `3. Console should show: "Loading professional samples for: [instrument]"`,
    );
    console.log(
      `4. Should hear studio-quality piano/Rhodes/organ instead of basic synthesis`,
    );

    console.log('\n🌐 CDN URLs:');
    Object.entries(keyboardMetadata).forEach(([id, metadata]) => {
      console.log(`• ${metadata.name}: ${metadata.cdnBase}/`);
    });
  } else {
    console.error('❌ No keyboards were successfully uploaded');
    process.exit(1);
  }

  console.log(
    '\n🎹 Professional keyboard samples deployed to FAANG-style CDN!',
  );
}

main().catch((error) => {
  console.error('❌ Upload script failed:', error);
  process.exit(1);
});
