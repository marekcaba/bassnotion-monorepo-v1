#!/usr/bin/env node

/**
 * Upload Hydrogen kits to final organized structure:
 * audio-samples/drums/hydrogen-kits/
 * ├── wav/
 * ├── mp3/
 * └── index.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../apps/backend/.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Local directories
const WAV_DIR = path.join(__dirname, '../temp/hydrogen-ready');
const MP3_DIR = path.join(__dirname, '../temp/hydrogen-mp3');

// Upload a directory recursively
async function uploadDirectory(localDir, bucketPrefix, format) {
  let uploadCount = 0;
  let errorCount = 0;

  async function uploadDir(dir, prefix) {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const localPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        // Recurse into subdirectory
        await uploadDir(localPath, `${prefix}/${item.name}`);
      } else {
        // Upload file
        const bucketPath = `${prefix}/${item.name}`;

        try {
          const fileBuffer = fs.readFileSync(localPath);

          // Determine content type
          let contentType = 'application/octet-stream';
          if (item.name.endsWith('.wav')) contentType = 'audio/wav';
          else if (item.name.endsWith('.mp3')) contentType = 'audio/mpeg';
          else if (item.name.endsWith('.xml')) contentType = 'text/xml';
          else if (item.name.endsWith('.json'))
            contentType = 'application/json';

          const { error } = await supabase.storage
            .from('audio-samples')
            .upload(bucketPath, fileBuffer, {
              contentType,
              upsert: true,
            });

          if (error) throw error;

          uploadCount++;
          process.stdout.write('✓');
        } catch (error) {
          errorCount++;
          process.stdout.write('✗');
          console.error(`\n❌ Failed to upload ${item.name}: ${error.message}`);
        }
      }
    }
  }

  console.log(`\n📤 Uploading ${format.toUpperCase()} files...`);
  await uploadDir(localDir, bucketPrefix);
  console.log(`\n✓ Uploaded ${uploadCount} files (${errorCount} errors)\n`);

  return { uploadCount, errorCount };
}

// Create kit metadata
function createKitMetadata() {
  return {
    name: 'Hydrogen Drum Kits Collection',
    description: 'Professional drum kits from the Hydrogen project',
    license: 'GPL2/GPL/CC - Free for commercial use',
    generated: new Date().toISOString(),
    formats: {
      wav: {
        path: 'wav/',
        description: 'Uncompressed 16-bit 44.1kHz WAV files',
        size: '~338 MB',
        use_cases: [
          'Studio production',
          'High-quality exports',
          'Professional mixing',
          'Archival storage',
        ],
      },
      mp3: {
        path: 'mp3/',
        description: 'High-quality MP3 256kbps VBR',
        size: '~56 MB',
        compression: '80% smaller than WAV',
        use_cases: [
          'Web playback',
          'Mobile applications',
          'Quick loading',
          'Bandwidth-conscious users',
        ],
      },
    },
    kits: {
      electronic: [
        'classic-808',
        'tr808909',
        'boss-dr110',
        'electric-empire',
        'k27-trash',
        'techno-1',
        'varibreaks',
      ],
      acoustic: [
        'yamaha-vintage',
        'colombo-acoustic',
        'millo-multilayered',
        'millo-drums',
        'forzee-stereo',
      ],
      'hip-hop': ['hip-hop-1', 'hip-hop-2', 'beatbuddy'],
      rock: ['dave-grohl', 'john-bonham'],
      metal: ['death-metal'],
      jazz: ['gimme-jazz'],
    },
    total_kits: 19,
    total_samples: 658,
    recommendation:
      'Use MP3 format for web playback to ensure fast loading times. WAV format is available for high-quality exports and professional use.',
  };
}

// Main function
async function main() {
  console.log('🎵 Hydrogen Kits Final Upload');
  console.log('=============================\n');

  // Check directories exist
  if (!fs.existsSync(WAV_DIR)) {
    console.error(
      '❌ WAV directory not found. Run process-and-upload-hydrogen.js first',
    );
    process.exit(1);
  }

  if (!fs.existsSync(MP3_DIR)) {
    console.error(
      '❌ MP3 directory not found. Run convert-and-reupload-as-mp3.js first',
    );
    process.exit(1);
  }

  console.log('📁 Creating organized structure in Supabase...\n');
  console.log('Target: audio-samples/drums/hydrogen-kits/');
  console.log('├── wav/');
  console.log('├── mp3/');
  console.log('└── index.json\n');

  // Upload WAV files
  const wavStats = await uploadDirectory(
    WAV_DIR,
    'drums/hydrogen-kits/wav',
    'wav',
  );

  // Upload MP3 files
  const mp3Stats = await uploadDirectory(
    MP3_DIR,
    'drums/hydrogen-kits/mp3',
    'mp3',
  );

  // Create and upload master index
  console.log('📝 Creating master index...');

  const metadata = createKitMetadata();

  try {
    const { error } = await supabase.storage
      .from('audio-samples')
      .upload(
        'drums/hydrogen-kits/index.json',
        JSON.stringify(metadata, null, 2),
        {
          contentType: 'application/json',
          upsert: true,
        },
      );

    if (error) throw error;
    console.log('✓ Uploaded master index\n');
  } catch (error) {
    console.error('❌ Failed to upload master index:', error.message);
  }

  // Summary
  console.log('\n📊 Upload Summary:');
  console.log(
    `WAV files: ${wavStats.uploadCount} uploaded, ${wavStats.errorCount} errors`,
  );
  console.log(
    `MP3 files: ${mp3Stats.uploadCount} uploaded, ${mp3Stats.errorCount} errors`,
  );
  console.log(`Total files: ${wavStats.uploadCount + mp3Stats.uploadCount}`);

  console.log('\n✅ Complete! Hydrogen kits are now organized at:');
  console.log('📍 audio-samples/drums/hydrogen-kits/');

  console.log('\n🎯 To use in your app:');
  console.log(
    '1. Load MP3s from: drums/hydrogen-kits/mp3/{category}/{kit-id}/',
  );
  console.log(
    '2. Example: drums/hydrogen-kits/mp3/electronic/classic-808/kick.mp3',
  );
  console.log('3. Index available at: drums/hydrogen-kits/index.json');

  console.log('\n🧹 Cleanup:');
  console.log('You can now delete the old folders:');
  console.log('- drums/hydrogen-collection/');
  console.log('- drums/hydrogen-mp3/');
}

// Run
main().catch(console.error);
