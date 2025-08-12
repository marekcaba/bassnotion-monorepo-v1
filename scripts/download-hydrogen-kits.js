#!/usr/bin/env node

/**
 * Story 3.16: Script to download and prepare Hydrogen drum kits
 *
 * This script:
 * 1. Downloads popular Hydrogen drum kits
 * 2. Converts them to web-compatible formats
 * 3. Organizes them for Supabase upload
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory structure
const TEMP_DIR = path.join(__dirname, '../temp/hydrogen-kits');
const OUTPUT_DIR = path.join(
  __dirname,
  '../apps/frontend/public/drum-kits/hydrogen',
);
const METADATA_FILE = path.join(OUTPUT_DIR, 'index.json');

// Hydrogen drum kit sources (official SourceForge repository)
const HYDROGEN_KITS = [
  {
    id: 'classic-808',
    name: 'Classic TR-808 Kit',
    description: 'Authentic Roland TR-808 electronic drum sounds',
    category: 'electronic',
    url: 'https://sourceforge.net/projects/hydrogen/files/Sound%20Libraries/Main%20sound%20libraries/Classic-808.h2drumkit/download',
    size: 3 * 1024 * 1024, // 3MB estimate
  },
  {
    id: 'tr808909',
    name: 'TR-808/909 Hybrid Kit',
    description: 'Combined Roland TR-808 and TR-909 samples',
    category: 'electronic',
    url: 'https://sourceforge.net/projects/hydrogen/files/Sound%20Libraries/Main%20sound%20libraries/TR808909.h2drumkit/download',
    size: 4 * 1024 * 1024, // 4MB estimate
  },
  {
    id: 'boss-dr110',
    name: 'Boss DR-110 Kit',
    description: 'Classic Boss DR-110 drum machine sounds',
    category: 'vintage',
    url: 'https://sourceforge.net/projects/hydrogen/files/Sound%20Libraries/Main%20sound%20libraries/Boss_DR-110.h2drumkit/download',
    size: 2 * 1024 * 1024, // 2MB estimate
  },
  {
    id: 'techno-1',
    name: 'Techno Kit 1',
    description: 'Modern techno and electronic dance music kit',
    category: 'electronic',
    url: 'https://sourceforge.net/projects/hydrogen/files/Sound%20Libraries/Main%20sound%20libraries/Techno-1.h2drumkit/download',
    size: 5 * 1024 * 1024, // 5MB estimate
  },
  {
    id: 'hip-hop-1',
    name: 'Hip-Hop Kit 1',
    description: 'Urban hip-hop drum kit with deep bass',
    category: 'urban',
    url: 'https://sourceforge.net/projects/hydrogen/files/Sound%20Libraries/Main%20sound%20libraries/HipHop-1.h2drumkit/download',
    size: 6 * 1024 * 1024, // 6MB estimate
  },
  {
    id: 'colombo-acoustic',
    name: 'Colombo Acoustic Kit',
    description: 'Professional acoustic drum kit recordings',
    category: 'acoustic',
    url: 'https://sourceforge.net/projects/hydrogen/files/Sound%20Libraries/Main%20sound%20libraries/ColomboAcousticDrumkit.h2drumkit/download',
    size: 15 * 1024 * 1024, // 15MB estimate
  },
  {
    id: 'yamaha-vintage',
    name: 'Yamaha Vintage Kit',
    description: 'Classic Yamaha vintage drum sounds',
    category: 'vintage',
    url: 'https://sourceforge.net/projects/hydrogen/files/Sound%20Libraries/Main%20sound%20libraries/YamahaVintageKit.h2drumkit/download',
    size: 8 * 1024 * 1024, // 8MB estimate
  },
  {
    id: 'electric-empire',
    name: 'Electric Empire Kit',
    description: 'Synthesized drum and percussion sounds',
    category: 'electronic',
    url: 'https://sourceforge.net/projects/hydrogen/files/Sound%20Libraries/Main%20sound%20libraries/ElectricEmpireKit.h2drumkit/download',
    size: 7 * 1024 * 1024, // 7MB estimate
  },
];

// Ensure directories exist
function ensureDirectories() {
  [TEMP_DIR, OUTPUT_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Download a file with proper redirect handling
async function downloadFile(url, filepath) {
  try {
    // Use child_process to call curl with redirect following
    await execAsync(`curl -L -o "${filepath}" "${url}"`);
    console.log(`Downloaded: ${path.basename(filepath)}`);
  } catch (error) {
    console.error(`Failed to download ${url}:`, error.message);
    throw error;
  }
}

// Extract H2 drumkit (which is essentially a tar.gz file)
async function extractDrumkit(filepath, outputDir) {
  try {
    await execAsync(`tar -xzf "${filepath}" -C "${outputDir}"`);
    console.log(`Extracted: ${path.basename(filepath)}`);
  } catch (error) {
    console.error(`Failed to extract ${filepath}:`, error);
    throw error;
  }
}

// Convert samples to web-friendly format
async function convertSamples(kitDir, kitId) {
  // Check for nested directory structure first
  let actualKitDir = kitDir;
  const subdirs = fs
    .readdirSync(kitDir)
    .filter((item) => fs.statSync(path.join(kitDir, item)).isDirectory());

  if (subdirs.length > 0) {
    // Try the first subdirectory
    const nestedPath = path.join(kitDir, subdirs[0]);
    const nestedXml = path.join(nestedPath, 'drumkit.xml');
    if (fs.existsSync(nestedXml)) {
      actualKitDir = nestedPath;
    }
  }

  const drumkitXml = path.join(actualKitDir, 'drumkit.xml');

  if (!fs.existsSync(drumkitXml)) {
    console.warn(`No drumkit.xml found in ${actualKitDir}`);
    return;
  }

  // Create output directory for this kit
  const outputKitDir = path.join(OUTPUT_DIR, kitId);
  if (!fs.existsSync(outputKitDir)) {
    fs.mkdirSync(outputKitDir, { recursive: true });
  }

  // Map common drum types
  const drumTypeMap = {
    kick: ['kick', 'bassdrum', 'bd'],
    snare: ['snare', 'sd'],
    hihat: ['hihat', 'hh', 'closed'],
    'open-hihat': ['open', 'oh'],
    crash: ['crash'],
    ride: ['ride'],
    tom1: ['tom1', 'hightom'],
    tom2: ['tom2', 'midtom'],
    tom3: ['tom3', 'lowtom', 'floortom'],
  };

  // Find and convert samples
  const samples = fs
    .readdirSync(actualKitDir)
    .filter((f) => f.endsWith('.wav') || f.endsWith('.flac'));

  for (const sample of samples) {
    const samplePath = path.join(actualKitDir, sample);
    const sampleName = sample.toLowerCase();

    // Determine drum type
    let drumType = 'unknown';
    for (const [type, keywords] of Object.entries(drumTypeMap)) {
      if (keywords.some((keyword) => sampleName.includes(keyword))) {
        drumType = type;
        break;
      }
    }

    // Determine velocity layer
    let velocity = 'v1';
    if (sampleName.includes('soft') || sampleName.includes('low')) {
      velocity = 'v1';
    } else if (sampleName.includes('med')) {
      velocity = 'v2';
    } else if (sampleName.includes('hard') || sampleName.includes('high')) {
      velocity = 'v3';
    }

    const outputFilename = `${drumType}-${velocity}.wav`;
    const outputPath = path.join(outputKitDir, outputFilename);

    try {
      // Convert to 16-bit 44.1kHz WAV for web compatibility
      await execAsync(
        `ffmpeg -i "${samplePath}" -acodec pcm_s16le -ar 44100 "${outputPath}" -y`,
      );
      console.log(`Converted: ${sample} -> ${outputFilename}`);
    } catch (error) {
      console.error(`Failed to convert ${sample}:`, error.message);
    }
  }
}

// Process a drum kit
async function processDrumKit(kit) {
  console.log(`\nProcessing: ${kit.name}`);

  const downloadPath = path.join(TEMP_DIR, `${kit.id}.h2drumkit`);
  const extractPath = path.join(TEMP_DIR, kit.id);

  try {
    // Download
    console.log(`Downloading from: ${kit.url}`);
    await downloadFile(kit.url, downloadPath);

    // Extract
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath);
    }
    await extractDrumkit(downloadPath, extractPath);

    // Convert samples
    await convertSamples(extractPath, kit.id);

    // Clean up temp files
    fs.unlinkSync(downloadPath);

    return {
      ...kit,
      status: 'success',
    };
  } catch (error) {
    console.error(`Failed to process ${kit.name}:`, error);
    return {
      ...kit,
      status: 'failed',
      error: error.message,
    };
  }
}

// Generate metadata index
function generateMetadata(results) {
  const metadata = {
    generated: new Date().toISOString(),
    kits: results
      .filter((r) => r.status === 'success')
      .map((kit) => ({
        id: kit.id,
        name: kit.name,
        description: kit.description,
        source: 'hydrogen',
        style: kit.category,
        quality: 'studio',
        sampleCount: 0, // Will be updated after counting files
        size: kit.size,
      })),
  };

  // Count samples for each kit
  metadata.kits.forEach((kit) => {
    const kitDir = path.join(OUTPUT_DIR, kit.id);
    if (fs.existsSync(kitDir)) {
      const samples = fs.readdirSync(kitDir).filter((f) => f.endsWith('.wav'));
      kit.sampleCount = samples.length;
    }
  });

  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  console.log(`\nGenerated metadata: ${METADATA_FILE}`);
}

// Process existing downloads without re-downloading
async function processExistingKits() {
  console.log('🔄 Processing existing downloads...\n');

  const results = [];

  for (const kit of HYDROGEN_KITS) {
    const extractPath = path.join(TEMP_DIR, kit.id);

    if (fs.existsSync(extractPath)) {
      console.log(`Processing existing: ${kit.name}`);

      try {
        await convertSamples(extractPath, kit.id);
        results.push({
          ...kit,
          status: 'success',
        });
      } catch (error) {
        console.error(`Failed to process ${kit.name}:`, error);
        results.push({
          ...kit,
          status: 'failed',
          error: error.message,
        });
      }
    } else {
      console.log(`Not found: ${kit.name} - will download`);
      const result = await processDrumKit(kit);
      results.push(result);
    }
  }

  return results;
}

// Main function
async function main() {
  console.log('🥁 Hydrogen Drum Kit Downloader\n');

  // Check if ffmpeg is installed
  try {
    await execAsync('ffmpeg -version');
  } catch (error) {
    console.error(
      'Error: ffmpeg is required but not found. Please install ffmpeg first.',
    );
    process.exit(1);
  }

  ensureDirectories();

  // Process existing downloads first, then download any missing ones
  const results = await processExistingKits();

  generateMetadata(results);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`Total kits: ${HYDROGEN_KITS.length}`);
  console.log(
    `Successful: ${results.filter((r) => r.status === 'success').length}`,
  );
  console.log(`Failed: ${results.filter((r) => r.status === 'failed').length}`);

  console.log('\n✅ Done! Drum kits are ready in:', OUTPUT_DIR);
  console.log('\nNext steps:');
  console.log('1. Review the converted samples');
  console.log('2. Upload to Supabase audio-samples bucket');
  console.log('3. Update the drum kit metadata in the app');
}

// Run the script
main().catch(console.error);
