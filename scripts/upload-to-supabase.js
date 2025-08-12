#!/usr/bin/env node

/**
 * Story 3.16: Script to upload audio samples to Supabase
 *
 * This script uploads drum kits, metronome clicks, and metadata to Supabase storage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../apps/backend/.env.local') });

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Directories
const DRUM_KITS_DIR = path.join(
  __dirname,
  '../apps/frontend/public/drum-kits/hydrogen',
);
const SOUNDFONTS_DIR = path.join(
  __dirname,
  '../apps/frontend/public/soundfonts',
);
const METADATA_DIR = path.join(
  __dirname,
  '../apps/frontend/public/sample-metadata',
);

// Upload a file to Supabase storage
async function uploadFile(localPath, bucketPath) {
  try {
    const fileBuffer = fs.readFileSync(localPath);
    const fileName = path.basename(localPath);

    const { data, error } = await supabase.storage
      .from('audio-samples')
      .upload(bucketPath, fileBuffer, {
        contentType: getContentType(fileName),
        upsert: true,
      });

    if (error) {
      throw error;
    }

    console.log(`✅ Uploaded: ${bucketPath}`);
    return data;
  } catch (error) {
    console.error(`❌ Failed to upload ${bucketPath}:`, error.message);
    return null;
  }
}

// Get content type based on file extension
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.wav':
      return 'audio/wav';
    case '.mp3':
      return 'audio/mpeg';
    case '.json':
      return 'application/json';
    case '.sf2':
      return 'audio/x-soundfont';
    default:
      return 'application/octet-stream';
  }
}

// Upload metadata files
async function uploadMetadata() {
  console.log('\n📋 Uploading metadata files...\n');

  const metadataFiles = ['metronome-samples.json', 'admin-drum-kits.json'];

  for (const file of metadataFiles) {
    const localPath = path.join(METADATA_DIR, file);
    if (fs.existsSync(localPath)) {
      const bucketPath = `metadata/${file}`;
      await uploadFile(localPath, bucketPath);
    }
  }

  // Upload drum kit indexes
  const drumIndexPath = path.join(DRUM_KITS_DIR, 'index.json');
  if (fs.existsSync(drumIndexPath)) {
    await uploadFile(drumIndexPath, 'drums/hydrogen-kits/index.json');
  }
}

// Upload drum kits
async function uploadDrumKits() {
  console.log('\n🥁 Uploading drum kits...\n');

  if (!fs.existsSync(DRUM_KITS_DIR)) {
    console.log('No drum kits found. Run download-hydrogen-kits.js first.');
    return;
  }

  const kits = fs.readdirSync(DRUM_KITS_DIR).filter((item) => {
    const itemPath = path.join(DRUM_KITS_DIR, item);
    return fs.statSync(itemPath).isDirectory();
  });

  for (const kit of kits) {
    console.log(`\nUploading kit: ${kit}`);
    const kitDir = path.join(DRUM_KITS_DIR, kit);
    const samples = fs.readdirSync(kitDir).filter((f) => f.endsWith('.wav'));

    for (const sample of samples) {
      const localPath = path.join(kitDir, sample);
      const bucketPath = `drums/hydrogen-kits/${kit}/${sample}`;
      await uploadFile(localPath, bucketPath);
    }
  }
}

// Upload example metronome clicks (simulated)
async function uploadMetronomeClicks() {
  console.log('\n🎵 Creating example metronome clicks...\n');

  // In a real scenario, these would be actual audio files
  // For now, we'll create placeholder metadata
  const metronomeIndex = {
    samples: [
      {
        id: 'default-electronic',
        name: 'Electronic Click',
        description: 'Standard electronic metronome click',
        category: 'electronic',
        url: 'electronic-click.wav',
        isDefault: true,
      },
      {
        id: 'wood-block',
        name: 'Wood Block',
        description: 'Classic wood block sound',
        category: 'wood',
        url: 'wood-block.wav',
      },
      {
        id: 'metal-click',
        name: 'Metal Click',
        description: 'Sharp metal click sound',
        category: 'metal',
        url: 'metal-click.wav',
      },
    ],
  };

  // Upload metronome index
  const indexPath = path.join(METADATA_DIR, 'metronome-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(metronomeIndex, null, 2));
  await uploadFile(indexPath, 'metronome/index.json');
}

// Upload keyboard soundfonts
async function uploadSoundfonts() {
  console.log('\n🎹 Uploading keyboard soundfonts...\n');

  if (!fs.existsSync(SOUNDFONTS_DIR)) {
    console.log('No soundfonts found. Run download-keyboard-sounds.js first.');
    return;
  }

  const soundfonts = fs.readdirSync(SOUNDFONTS_DIR).filter((item) => {
    const itemPath = path.join(SOUNDFONTS_DIR, item);
    return fs.statSync(itemPath).isDirectory();
  });

  for (const soundfont of soundfonts) {
    console.log(`\nChecking soundfont: ${soundfont}`);
    const soundfontDir = path.join(SOUNDFONTS_DIR, soundfont);
    const files = fs
      .readdirSync(soundfontDir)
      .filter((f) => f.endsWith('.sf2'));

    if (files.length > 0) {
      console.log(`Found ${files.length} soundfont files`);

      // Note: SF2 files are large, so we might want to serve them from CDN instead
      console.log(
        `⚠️  Soundfont ${soundfont} is large. Consider serving from CDN instead.`,
      );

      // Uncomment to actually upload:
      // for (const file of files) {
      //   const localPath = path.join(soundfontDir, file);
      //   const bucketPath = `keyboards/${soundfont}/${file}`;
      //   await uploadFile(localPath, bucketPath);
      // }
    }
  }
}

// Create admin samples structure
async function createAdminSampleStructure() {
  console.log('\n📁 Creating admin sample structure...\n');

  // Create placeholder for admin drum samples
  const adminDrumIndex = {
    kits: [
      {
        id: 'admin-acoustic',
        name: 'Admin Acoustic Kit',
        description: 'Platform-curated acoustic drum kit',
        source: 'admin',
        style: 'acoustic',
        quality: 'studio',
        sampleCount: 0,
        size: 0,
      },
    ],
  };

  const adminIndexPath = path.join(METADATA_DIR, 'admin-drums-index.json');
  fs.writeFileSync(adminIndexPath, JSON.stringify(adminDrumIndex, null, 2));
  await uploadFile(adminIndexPath, 'drums/admin-samples/index.json');
}

// Main function
async function main() {
  console.log('🚀 Supabase Audio Sample Uploader\n');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Bucket: audio-samples\n`);

  // Check bucket exists
  const { data: buckets, error: bucketsError } =
    await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error('Failed to list buckets:', bucketsError);
    process.exit(1);
  }

  const audioBucket = buckets.find((b) => b.name === 'audio-samples');
  if (!audioBucket) {
    console.error('audio-samples bucket not found. Run the migration first.');
    process.exit(1);
  }

  console.log('✅ audio-samples bucket found\n');

  // Upload different types of content
  await uploadMetadata();
  await createAdminSampleStructure();
  await uploadMetronomeClicks();
  await uploadDrumKits();
  await uploadSoundfonts();

  console.log('\n✅ Upload complete!');
  console.log('\nNext steps:');
  console.log(
    '1. Upload actual audio samples (WAV files) for metronome clicks',
  );
  console.log('2. Upload admin-curated drum samples');
  console.log('3. Configure CDN for large soundfont files');
  console.log('4. Test sample loading in the application');
}

// Run the script
main().catch(console.error);
