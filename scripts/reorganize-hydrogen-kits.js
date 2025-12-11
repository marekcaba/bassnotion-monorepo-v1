#!/usr/bin/env node

/**
 * Reorganize Hydrogen kits into a single structure:
 * audio-samples/drums/hydrogen-kits/
 * ├── wav/
 * │   ├── electronic/
 * │   ├── acoustic/
 * │   └── ...
 * ├── mp3/
 * │   ├── electronic/
 * │   ├── acoustic/
 * │   └── ...
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

// List all files in a path
async function listAllFiles(prefix) {
  const files = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from('audio-samples')
      .list(prefix, { limit, offset });

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const item of data) {
      if (item.name && !item.id) {
        // It's a file
        files.push(`${prefix}/${item.name}`);
      } else if (item.id) {
        // It's a directory, recurse
        const subFiles = await listAllFiles(`${prefix}/${item.name}`);
        files.push(...subFiles);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return files;
}

// Move a file in Supabase
async function moveFile(sourcePath, targetPath) {
  try {
    // Download the file
    const { data, error: downloadError } = await supabase.storage
      .from('audio-samples')
      .download(sourcePath);

    if (downloadError) throw downloadError;

    // Get the buffer
    const buffer = await data.arrayBuffer();

    // Determine content type
    const contentType = sourcePath.endsWith('.mp3')
      ? 'audio/mpeg'
      : sourcePath.endsWith('.wav')
        ? 'audio/wav'
        : sourcePath.endsWith('.xml')
          ? 'text/xml'
          : 'application/json';

    // Upload to new location
    const { error: uploadError } = await supabase.storage
      .from('audio-samples')
      .upload(targetPath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Delete from old location
    const { error: deleteError } = await supabase.storage
      .from('audio-samples')
      .remove([sourcePath]);

    if (deleteError) {
      console.warn(
        `⚠️  Could not delete ${sourcePath}: ${deleteError.message}`,
      );
    }

    return true;
  } catch (error) {
    console.error(`❌ Failed to move ${sourcePath}: ${error.message}`);
    return false;
  }
}

// Main reorganization
async function main() {
  console.log('🔄 Reorganizing Hydrogen Drum Kits');
  console.log('==================================\n');

  try {
    // Get all files from both locations
    console.log('📂 Scanning current file structure...\n');

    const wavFiles = await listAllFiles('drums/hydrogen-collection');
    const mp3Files = await listAllFiles('drums/hydrogen-mp3');

    console.log(`Found ${wavFiles.length} files in hydrogen-collection (WAV)`);
    console.log(`Found ${mp3Files.length} files in hydrogen-mp3 (MP3)\n`);

    let movedCount = 0;

    // Move WAV files
    console.log('📦 Moving WAV files...\n');
    for (const file of wavFiles) {
      // Skip if it's already in the right place
      if (file.includes('/wav/')) continue;

      // Determine new path
      const newPath = file
        .replace('drums/hydrogen-collection/', 'drums/hydrogen-kits/wav/')
        .replace('drums/hydrogen-collection', 'drums/hydrogen-kits/wav');

      process.stdout.write(`Moving ${path.basename(file)}... `);

      const success = await moveFile(file, newPath);
      if (success) {
        movedCount++;
        console.log('✓');
      } else {
        console.log('✗');
      }
    }

    // Move MP3 files
    console.log('\n📦 Moving MP3 files...\n');
    for (const file of mp3Files) {
      // Skip if it's already in the right place
      if (file.includes('/mp3/')) continue;

      // Determine new path
      const newPath = file
        .replace('drums/hydrogen-mp3/', 'drums/hydrogen-kits/mp3/')
        .replace('drums/hydrogen-mp3', 'drums/hydrogen-kits/mp3');

      process.stdout.write(`Moving ${path.basename(file)}... `);

      const success = await moveFile(file, newPath);
      if (success) {
        movedCount++;
        console.log('✓');
      } else {
        console.log('✗');
      }
    }

    // Create master index
    console.log('\n📝 Creating master index...\n');

    const masterIndex = {
      name: 'Hydrogen Drum Kits Collection',
      description:
        'Complete collection of Hydrogen drum kits in both WAV and MP3 formats',
      license: 'GPL2/GPL/CC - Free for commercial use',
      generated: new Date().toISOString(),
      formats: {
        wav: {
          path: 'drums/hydrogen-kits/wav/',
          description: 'Uncompressed audio, best quality',
          use_cases: ['Studio production', 'High-quality exports', 'Archival'],
        },
        mp3: {
          path: 'drums/hydrogen-kits/mp3/',
          description: 'Compressed audio, optimized for web',
          bitrate: '256kbps',
          compression: '~80% size reduction',
          use_cases: ['Web playback', 'Mobile apps', 'Quick loading'],
        },
      },
      categories: [
        'electronic',
        'acoustic',
        'hip-hop',
        'rock',
        'metal',
        'jazz',
      ],
      recommendation:
        'Use MP3 format for web playback, WAV for high-quality exports',
    };

    const { error } = await supabase.storage
      .from('audio-samples')
      .upload(
        'drums/hydrogen-kits/index.json',
        JSON.stringify(masterIndex, null, 2),
        {
          contentType: 'application/json',
          upsert: true,
        },
      );

    if (error) {
      console.error('❌ Failed to create master index:', error.message);
    } else {
      console.log('✓ Created master index');
    }

    // Summary
    console.log('\n\n📊 Reorganization Summary:');
    console.log(`Files moved: ${movedCount}`);
    console.log('\n✅ Complete! New structure:');
    console.log('📁 audio-samples/drums/hydrogen-kits/');
    console.log('   ├── 📁 wav/     (original quality)');
    console.log('   ├── 📁 mp3/     (web optimized)');
    console.log('   └── 📄 index.json');

    console.log('\n🎯 Next steps:');
    console.log(
      '1. Update DrumInstrumentProcessor to use drums/hydrogen-kits/mp3/',
    );
    console.log('2. Delete old folders: hydrogen-collection and hydrogen-mp3');
    console.log('3. Test loading from new structure');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run
main().catch(console.error);
