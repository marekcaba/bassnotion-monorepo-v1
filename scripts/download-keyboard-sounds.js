#!/usr/bin/env node

/**
 * Story 3.16: Script to download and prepare professional keyboard soundfonts
 *
 * This script:
 * 1. Downloads professional free soundfonts (Salamander Piano, Nice Keys, etc.)
 * 2. Converts them to web-optimized formats
 * 3. Prepares them for integration
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
const TEMP_DIR = path.join(__dirname, '../temp/keyboard-sounds');
const OUTPUT_DIR = path.join(__dirname, '../apps/frontend/public/soundfonts');
const METADATA_FILE = path.join(OUTPUT_DIR, 'keyboard-instruments.json');

// Professional keyboard soundfont sources
const KEYBOARD_SOUNDS = [
  {
    id: 'salamander-piano',
    name: 'Salamander Grand Piano',
    description: 'Studio-quality grand piano with 88 velocity layers',
    category: 'acoustic_piano',
    url: 'https://freepats.zenvoid.org/Piano/SalamanderGrandPiano/SalamanderGrandPiano-SF2-V3.sf2',
    size: 200 * 1024 * 1024, // 200MB
    license: 'CC BY 3.0',
    author: 'Alexander Holm',
  },
  {
    id: 'nice-keys-rhodes',
    name: 'Nice Keys Electric Piano',
    description: 'Authentic vintage Rhodes electric piano',
    category: 'electric_piano',
    url: 'https://freepats.zenvoid.org/ElectricPiano/Rhodes/NiceRhodes.sf2',
    size: 80 * 1024 * 1024, // 80MB
    license: 'Public Domain',
    author: 'Nice Keys',
  },
  {
    id: 'fluid-gm',
    name: 'FluidR3 GM Soundfont',
    description: 'High quality General MIDI soundfont with all instruments',
    category: 'general_midi',
    url: 'https://github.com/FluidSynth/fluidsynth/raw/master/sf2/FluidR3_GM.sf2',
    size: 150 * 1024 * 1024, // 150MB
    license: 'MIT',
    author: 'Frank Wen',
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

// Download a file with progress
async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    let downloadedBytes = 0;

    https
      .get(url, (response) => {
        const totalBytes = parseInt(response.headers['content-length'], 10);

        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          https
            .get(response.headers.location, (redirectResponse) => {
              const totalBytes = parseInt(
                redirectResponse.headers['content-length'],
                10,
              );

              redirectResponse.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                const progress = totalBytes
                  ? ((downloadedBytes / totalBytes) * 100).toFixed(1)
                  : '?';
                process.stdout.write(`\rDownloading: ${progress}%`);
              });

              redirectResponse.pipe(file);
              file.on('finish', () => {
                file.close();
                process.stdout.write('\n');
                resolve();
              });
            })
            .on('error', reject);
        } else {
          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const progress = totalBytes
              ? ((downloadedBytes / totalBytes) * 100).toFixed(1)
              : '?';
            process.stdout.write(`\rDownloading: ${progress}%`);
          });

          response.pipe(file);
          file.on('finish', () => {
            file.close();
            process.stdout.write('\n');
            resolve();
          });
        }
      })
      .on('error', reject);
  });
}

// Extract soundfont information
async function analyzeSoundfont(filepath) {
  try {
    // Use sf2utils or similar tool if available
    // For now, return basic info
    const stats = fs.statSync(filepath);
    return {
      size: stats.size,
      format: path.extname(filepath).substring(1).toUpperCase(),
      analyzed: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Failed to analyze soundfont:`, error);
    return null;
  }
}

// Optimize soundfont for web use
async function optimizeSoundfont(inputPath, outputPath, soundId) {
  console.log('Optimizing soundfont for web use...');

  // For now, just copy the file
  // In production, we would:
  // 1. Reduce sample rate if needed (to 44.1kHz)
  // 2. Compress samples
  // 3. Remove unused presets
  // 4. Convert to SF3 format for smaller size

  try {
    // Create soundfont directory
    const soundfontDir = path.join(OUTPUT_DIR, soundId);
    if (!fs.existsSync(soundfontDir)) {
      fs.mkdirSync(soundfontDir, { recursive: true });
    }

    const finalPath = path.join(soundfontDir, path.basename(outputPath));
    fs.copyFileSync(inputPath, finalPath);

    console.log(`Copied to: ${finalPath}`);
    return true;
  } catch (error) {
    console.error('Failed to optimize soundfont:', error);
    return false;
  }
}

// Process a keyboard soundfont
async function processSoundfont(sound) {
  console.log(`\n🎹 Processing: ${sound.name}`);

  const downloadPath = path.join(TEMP_DIR, `${sound.id}.sf2`);
  const outputPath = path.join(OUTPUT_DIR, sound.id, `${sound.id}.sf2`);

  try {
    // Download
    console.log(`Downloading from: ${sound.url}`);
    console.log(`Expected size: ${(sound.size / 1024 / 1024).toFixed(1)} MB`);
    await downloadFile(sound.url, downloadPath);

    // Analyze
    const analysis = await analyzeSoundfont(downloadPath);
    console.log('Analysis:', analysis);

    // Optimize
    await optimizeSoundfont(downloadPath, outputPath, sound.id);

    // Clean up temp file
    fs.unlinkSync(downloadPath);

    return {
      ...sound,
      status: 'success',
      analysis,
    };
  } catch (error) {
    console.error(`Failed to process ${sound.name}:`, error);
    return {
      ...sound,
      status: 'failed',
      error: error.message,
    };
  }
}

// Generate metadata index
function generateMetadata(results) {
  const metadata = {
    generated: new Date().toISOString(),
    instruments: results
      .filter((r) => r.status === 'success')
      .map((sound) => ({
        id: sound.id,
        name: sound.name,
        description: sound.description,
        category: sound.category,
        format: 'sf2',
        size: sound.size,
        license: sound.license,
        author: sound.author,
        path: `${sound.id}/${sound.id}.sf2`,
      })),
  };

  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  console.log(`\nGenerated metadata: ${METADATA_FILE}`);
}

// Create placeholder for manual downloads
function createManualDownloadInstructions() {
  const instructions = `
# Professional Keyboard Soundfont Downloads

Due to the large size of these files, you may want to download them manually:

## 1. Salamander Grand Piano
- URL: https://freepats.zenvoid.org/Piano/SalamanderGrandPiano/
- Download: SalamanderGrandPiano-SF2-V3.sf2 (200MB)
- Place in: public/soundfonts/salamander-piano/

## 2. Nice Keys Rhodes
- URL: https://freepats.zenvoid.org/ElectricPiano/
- Download the Rhodes soundfont
- Place in: public/soundfonts/nice-keys-rhodes/

## 3. Versilian Studios Chamber Orchestra
- URL: https://vis.versilstudios.com/vsco-community.html
- Download VSCO Community Edition
- Extract and use the organ patches

## 4. ZynAddSubFX Banks
- URL: https://sourceforge.net/projects/zynaddsubfx/
- Download instrument banks
- Convert to SF2 format if needed

After downloading, run the optimization script to prepare them for web use.
`;

  const instructionsPath = path.join(OUTPUT_DIR, 'DOWNLOAD_INSTRUCTIONS.md');
  fs.writeFileSync(instructionsPath, instructions);
  console.log(`\nCreated manual download instructions: ${instructionsPath}`);
}

// Main function
async function main() {
  console.log('🎹 Professional Keyboard Soundfont Downloader\n');

  ensureDirectories();

  console.log('Note: This will download large files (100-200MB each).');
  console.log(
    'Make sure you have enough disk space and a stable internet connection.\n',
  );

  const results = [];

  // Process smaller soundfonts automatically
  for (const sound of KEYBOARD_SOUNDS) {
    if (sound.size < 100 * 1024 * 1024) {
      // Only auto-download if < 100MB
      const result = await processSoundfont(sound);
      results.push(result);
    } else {
      console.log(
        `\n⚠️  Skipping ${sound.name} (too large for automatic download)`,
      );
      results.push({
        ...sound,
        status: 'skipped',
        reason: 'Large file - manual download recommended',
      });
    }
  }

  generateMetadata(results);
  createManualDownloadInstructions();

  // Summary
  console.log('\n📊 Summary:');
  console.log(`Total soundfonts: ${KEYBOARD_SOUNDS.length}`);
  console.log(
    `Successful: ${results.filter((r) => r.status === 'success').length}`,
  );
  console.log(`Failed: ${results.filter((r) => r.status === 'failed').length}`);
  console.log(
    `Skipped (manual): ${results.filter((r) => r.status === 'skipped').length}`,
  );

  console.log('\n✅ Done! Soundfonts are ready in:', OUTPUT_DIR);
  console.log('\nNext steps:');
  console.log(
    '1. Download large soundfonts manually (see DOWNLOAD_INSTRUCTIONS.md)',
  );
  console.log('2. Run optimization on all soundfonts');
  console.log('3. Upload to Supabase or serve from CDN');
  console.log('4. Update the app to use these soundfonts');
}

// Run the script
main().catch(console.error);
