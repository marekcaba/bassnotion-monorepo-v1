#!/usr/bin/env node

/**
 * Converts full Salamander Grand Piano FLAC samples to MP3
 * Processes all velocity layers efficiently
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_DIR = join(__dirname, '..', 'apps', 'frontend', 'public', 'samples', 'salamander-piano-full');
const OUTPUT_DIR = join(__dirname, '..', 'apps', 'frontend', 'public', 'samples', 'salamander-mp3');

// Conversion settings
const MP3_BITRATE = '192k'; // Higher quality for multi-velocity
const SAMPLE_RATE = '44100';

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

async function convertFile(inputPath, outputPath) {
  const command = `ffmpeg -i "${inputPath}" -ab ${MP3_BITRATE} -ar ${SAMPLE_RATE} -y "${outputPath}"`;
  
  try {
    await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });
    return true;
  } catch (error) {
    console.error(`Failed to convert ${inputPath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🎹 Salamander Grand Piano FLAC to MP3 Converter\n');
  console.log(`📊 Settings:`);
  console.log(`   Bitrate: ${MP3_BITRATE}`);
  console.log(`   Sample Rate: ${SAMPLE_RATE}Hz\n`);

  // Check if ffmpeg is installed
  try {
    await execAsync('ffmpeg -version');
  } catch (error) {
    console.error('❌ ffmpeg is not installed. Please install it first:');
    console.error('   brew install ffmpeg');
    process.exit(1);
  }

  // Create output directory structure
  await ensureDir(OUTPUT_DIR);

  // Get all velocity directories
  const entries = await fs.readdir(INPUT_DIR, { withFileTypes: true });
  const velocityDirs = entries
    .filter(e => e.isDirectory() && e.name.startsWith('v'))
    .map(e => e.name)
    .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

  console.log(`📁 Found ${velocityDirs.length} velocity layers\n`);

  // Copy metadata
  const metadataPath = join(INPUT_DIR, 'metadata.json');
  if (await fs.access(metadataPath).then(() => true).catch(() => false)) {
    await fs.copyFile(metadataPath, join(OUTPUT_DIR, 'metadata.json'));
  }

  let totalConverted = 0;
  let totalFailed = 0;

  // Process each velocity layer
  for (const velDir of velocityDirs) {
    console.log(`\n🎵 Processing velocity layer ${velDir}...`);
    
    const inputVelDir = join(INPUT_DIR, velDir);
    const outputVelDir = join(OUTPUT_DIR, velDir);
    await ensureDir(outputVelDir);

    const files = await fs.readdir(inputVelDir);
    const flacFiles = files.filter(f => f.endsWith('.flac'));
    
    console.log(`   Found ${flacFiles.length} FLAC files`);

    let converted = 0;
    let failed = 0;

    for (const file of flacFiles) {
      const inputPath = join(inputVelDir, file);
      const outputFile = file.replace('.flac', '.mp3');
      const outputPath = join(outputVelDir, outputFile);

      process.stdout.write(`\r   Converting: ${converted}/${flacFiles.length} (${failed} failed)`);
      
      if (await convertFile(inputPath, outputPath)) {
        converted++;
        totalConverted++;
      } else {
        failed++;
        totalFailed++;
      }
    }

    console.log(`\r   ✅ Converted: ${converted}/${flacFiles.length} (${failed} failed)     `);
  }

  console.log(`\n📊 Conversion Summary:`);
  console.log(`   ✅ Total converted: ${totalConverted}`);
  console.log(`   ❌ Total failed: ${totalFailed}\n`);

  // Calculate file sizes
  console.log('💾 Calculating file sizes...');
  
  const getDirectorySize = async (dir) => {
    let totalSize = 0;
    const files = await fs.readdir(dir, { recursive: true, withFileTypes: true });
    
    for (const file of files) {
      if (file.isFile()) {
        const filePath = join(file.path, file.name);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  };

  const mp3Size = await getDirectorySize(OUTPUT_DIR);
  console.log(`   MP3 files: ${(mp3Size / (1024 * 1024)).toFixed(1)}MB\n`);

  // Create velocity mapping for easier implementation
  const velocityMap = {
    // MIDI velocity to sample velocity layer mapping
    '0-8': 'v1',      // ppp
    '9-16': 'v2',     
    '17-24': 'v3',    // pp
    '25-32': 'v4',
    '33-40': 'v5',    // p
    '41-48': 'v6',
    '49-56': 'v7',    // mp
    '57-64': 'v8',
    '65-72': 'v9',    // mf
    '73-80': 'v10',
    '81-88': 'v11',   // f
    '89-96': 'v12',
    '97-104': 'v13',  // ff
    '105-112': 'v14',
    '113-120': 'v15', // fff
    '121-127': 'v16'
  };

  await fs.writeFile(
    join(OUTPUT_DIR, 'velocity-mapping.json'),
    JSON.stringify(velocityMap, null, 2)
  );

  console.log('✅ Created velocity mapping file');
  console.log(`\n🎉 Conversion complete!`);
  console.log(`📂 MP3 files available at:\n   ${OUTPUT_DIR}\n`);
}

main().catch(console.error);