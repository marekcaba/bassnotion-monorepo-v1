#!/usr/bin/env node

/**
 * Process and upload Hydrogen drum kits to Supabase
 * Extracts and converts the downloaded kits, then uploads to storage
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../apps/backend/.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Paths
const DOWNLOADS_DIR = path.join(__dirname, '../temp/hydrogen-direct-downloads');
const EXTRACT_DIR = path.join(__dirname, '../temp/hydrogen-extracted');
const PROCESSED_DIR = path.join(__dirname, '../temp/hydrogen-ready');

// Kit metadata
const KIT_METADATA = {
  'Classic-808': {
    id: 'classic-808',
    category: 'electronic',
    name: 'Classic TR-808',
  },
  TR808909: {
    id: 'tr808909',
    category: 'electronic',
    name: 'TR-808/909 Hybrid',
  },
  'Boss_DR-110': {
    id: 'boss-dr110',
    category: 'electronic',
    name: 'Boss DR-110',
  },
  YamahaVintageKit: {
    id: 'yamaha-vintage',
    category: 'acoustic',
    name: 'Yamaha Vintage Kit',
  },
  'HipHop-1': { id: 'hip-hop-1', category: 'hip-hop', name: 'Hip-Hop Kit 1' },
  'HipHop-2': { id: 'hip-hop-2', category: 'hip-hop', name: 'Hip-Hop Kit 2' },
  ElectricEmpireKit: {
    id: 'electric-empire',
    category: 'electronic',
    name: 'Electric Empire',
  },
  'K-27_Trash_Kit': {
    id: 'k27-trash',
    category: 'electronic',
    name: 'K-27 Trash Kit',
  },
  'Techno-1': { id: 'techno-1', category: 'electronic', name: 'Techno Kit 1' },
  VariBreaks: { id: 'varibreaks', category: 'electronic', name: 'VariBreaks' },
  DeathMetal: { id: 'death-metal', category: 'metal', name: 'Death Metal Kit' },
  ColomboAcousticDrumkit: {
    id: 'colombo-acoustic',
    category: 'acoustic',
    name: 'Colombo Acoustic',
  },
  Millo_MultiLayered3: {
    id: 'millo-multilayered',
    category: 'acoustic',
    name: 'Millo Multi-Layered',
  },
  'Millo-Drums_v.1': {
    id: 'millo-drums',
    category: 'acoustic',
    name: 'Millo Drums',
  },
  'Gimme A Hand 1.0': {
    id: 'gimme-jazz',
    category: 'jazz',
    name: 'Gimme That Jazz',
  },
  ForzeeStereo: {
    id: 'forzee-stereo',
    category: 'acoustic',
    name: 'Forzee Stereo Kit',
  },
  'Dave Grohl': { id: 'dave-grohl', category: 'rock', name: 'Dave Grohl Kit' },
  'John Bonham': {
    id: 'john-bonham',
    category: 'rock',
    name: 'John Bonham Kit',
  },
  BeatBuddy_Kit: {
    id: 'beatbuddy',
    category: 'hip-hop',
    name: 'BeatBuddy Kit',
  },
};

// Ensure directories exist
function ensureDirectories() {
  [EXTRACT_DIR, PROCESSED_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Extract drumkit
async function extractDrumkit(file, outputDir) {
  try {
    await execAsync(`tar -xzf "${file}" -C "${outputDir}"`);
    return true;
  } catch (error) {
    console.error(`Failed to extract ${path.basename(file)}:`, error.message);
    return false;
  }
}

// Process samples
async function processSamples(kitName, extractPath) {
  const metadata = KIT_METADATA[kitName];
  if (!metadata) {
    console.warn(`No metadata for kit: ${kitName}`);
    return null;
  }

  const outputDir = path.join(PROCESSED_DIR, metadata.category, metadata.id);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Find actual kit directory
  let kitDir = extractPath;
  const subdirs = fs
    .readdirSync(extractPath)
    .filter((item) => fs.statSync(path.join(extractPath, item)).isDirectory());

  if (subdirs.length > 0) {
    const testPath = path.join(extractPath, subdirs[0]);
    if (fs.existsSync(path.join(testPath, 'drumkit.xml'))) {
      kitDir = testPath;
    }
  }

  // Copy drumkit.xml
  const drumkitXml = path.join(kitDir, 'drumkit.xml');
  if (fs.existsSync(drumkitXml)) {
    fs.copyFileSync(drumkitXml, path.join(outputDir, 'drumkit.xml'));
  }

  // Find and process audio files
  const audioFiles = fs
    .readdirSync(kitDir)
    .filter((f) => /\.(wav|flac|ogg|mp3)$/i.test(f));

  let processedCount = 0;

  for (const file of audioFiles) {
    const inputPath = path.join(kitDir, file);
    const outputFile = file.replace(/\.(wav|flac|ogg|mp3)$/i, '.wav');
    const outputPath = path.join(outputDir, outputFile);

    try {
      // Convert to 16-bit 44.1kHz WAV
      await execAsync(
        `ffmpeg -i "${inputPath}" -acodec pcm_s16le -ar 44100 "${outputPath}" -y`,
      );
      processedCount++;
    } catch (error) {
      console.error(`Failed to convert ${file}:`, error.message);
    }
  }

  return {
    ...metadata,
    sampleCount: processedCount,
    path: `${metadata.category}/${metadata.id}/`,
  };
}

// Upload to Supabase
async function uploadKit(kit) {
  const kitDir = path.join(PROCESSED_DIR, kit.path);
  const files = fs.readdirSync(kitDir);

  let uploadedCount = 0;

  for (const file of files) {
    const localPath = path.join(kitDir, file);
    const bucketPath = `drums/hydrogen-collection/${kit.path}${file}`;

    try {
      const fileBuffer = fs.readFileSync(localPath);
      const contentType = file.endsWith('.xml') ? 'text/xml' : 'audio/wav';

      const { error } = await supabase.storage
        .from('audio-samples')
        .upload(bucketPath, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (error) throw error;
      uploadedCount++;
      process.stdout.write(
        `\r  Uploaded ${uploadedCount}/${files.length} files`,
      );
    } catch (error) {
      console.error(`\n  Failed to upload ${file}:`, error.message);
    }
  }

  console.log(`\n  ✓ Uploaded ${uploadedCount} files for ${kit.name}`);

  return uploadedCount;
}

// Main function
async function main() {
  console.log('🎵 Hydrogen Drum Kit Processor & Uploader');
  console.log('==========================================\n');

  ensureDirectories();

  // Get downloaded files
  const downloads = fs
    .readdirSync(DOWNLOADS_DIR)
    .filter((f) => f.endsWith('.h2drumkit'));

  console.log(`Found ${downloads.length} drum kits to process\n`);

  // Filter valid downloads (> 100KB)
  const validDownloads = downloads.filter((file) => {
    const stats = fs.statSync(path.join(DOWNLOADS_DIR, file));
    return stats.size > 100000;
  });

  console.log(`Valid kits: ${validDownloads.length}\n`);

  const processedKits = [];

  // Process each kit
  for (const file of validDownloads) {
    const kitName = file.replace('.h2drumkit', '');
    console.log(`\n📦 Processing: ${kitName}`);

    const downloadPath = path.join(DOWNLOADS_DIR, file);
    const extractPath = path.join(EXTRACT_DIR, kitName);

    // Create extraction directory
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    // Extract
    const extracted = await extractDrumkit(downloadPath, extractPath);
    if (!extracted) continue;

    // Process samples
    const kitInfo = await processSamples(kitName, extractPath);
    if (kitInfo) {
      console.log(`  ✓ Processed ${kitInfo.sampleCount} samples`);
      processedKits.push(kitInfo);
    }
  }

  // Upload to Supabase
  console.log('\n\n🚀 Uploading to Supabase...\n');

  for (const kit of processedKits) {
    console.log(`\n📤 Uploading: ${kit.name}`);
    await uploadKit(kit);
  }

  // Create master index
  const masterIndex = {
    name: 'Hydrogen Drum Collection',
    description: 'Curated collection of Hydrogen drum kits',
    license: 'GPL2/GPL/CC - Free for commercial use',
    generated: new Date().toISOString(),
    totalKits: processedKits.length,
    categories: {},
    kits: processedKits,
  };

  // Group by category
  processedKits.forEach((kit) => {
    if (!masterIndex.categories[kit.category]) {
      masterIndex.categories[kit.category] = {
        count: 0,
        kits: [],
      };
    }
    masterIndex.categories[kit.category].count++;
    masterIndex.categories[kit.category].kits.push(kit.id);
  });

  // Upload master index
  try {
    const { error } = await supabase.storage
      .from('audio-samples')
      .upload(
        'drums/hydrogen-collection/index.json',
        JSON.stringify(masterIndex, null, 2),
        {
          contentType: 'application/json',
          upsert: true,
        },
      );

    if (error) throw error;
    console.log('\n✓ Uploaded master index');
  } catch (error) {
    console.error('Failed to upload master index:', error.message);
  }

  // Summary
  console.log('\n\n📊 Summary:');
  console.log(`Processed: ${processedKits.length} kits`);
  console.log(`Categories: ${Object.keys(masterIndex.categories).join(', ')}`);
  console.log('\n✅ Complete! Drum kits are now available in Supabase.');
}

// Run
main().catch(console.error);
