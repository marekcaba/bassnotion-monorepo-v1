#!/usr/bin/env node

/**
 * Test conversion script - converts only 3 velocity layers for testing
 * v1 (pp), v8 (mf), v16 (ff)
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
const OUTPUT_DIR = join(__dirname, '..', 'apps', 'frontend', 'public', 'samples', 'salamander-3vel');

// Test with 3 velocity layers
const TEST_VELOCITIES = ['v1', 'v8', 'v16']; // pp, mf, ff

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

async function convertFile(inputPath, outputPath) {
  const command = `ffmpeg -i "${inputPath}" -ab 192k -ar 44100 -y "${outputPath}"`;
  
  try {
    await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });
    return true;
  } catch (error) {
    console.error(`Failed to convert ${inputPath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🎹 Salamander Piano Test Conversion (3 velocities)\n');
  console.log(`📊 Converting velocity layers: ${TEST_VELOCITIES.join(', ')}\n`);

  // Check if ffmpeg is installed
  try {
    await execAsync('ffmpeg -version');
  } catch (error) {
    console.error('❌ ffmpeg is not installed. Please install it first:');
    console.error('   brew install ffmpeg');
    process.exit(1);
  }

  // Create output directory
  await ensureDir(OUTPUT_DIR);

  let totalConverted = 0;

  // Process each test velocity layer
  for (const velDir of TEST_VELOCITIES) {
    console.log(`\n🎵 Processing velocity layer ${velDir}...`);
    
    const inputVelDir = join(INPUT_DIR, velDir);
    const outputVelDir = join(OUTPUT_DIR, velDir);
    await ensureDir(outputVelDir);

    const files = await fs.readdir(inputVelDir);
    const flacFiles = files.filter(f => f.endsWith('.flac'));
    
    console.log(`   Found ${flacFiles.length} FLAC files`);

    let converted = 0;

    for (const file of flacFiles) {
      const inputPath = join(inputVelDir, file);
      
      // Fix filename for sharp notes
      let outputFile = file.replace('.flac', '.mp3');
      outputFile = outputFile.replace('#', 's'); // Convert D#1.mp3 to Ds1.mp3
      
      const outputPath = join(outputVelDir, outputFile);

      process.stdout.write(`\r   Converting: ${converted}/${flacFiles.length}`);
      
      if (await convertFile(inputPath, outputPath)) {
        converted++;
        totalConverted++;
      }
    }

    console.log(`\r   ✅ Converted: ${converted}/${flacFiles.length}     `);
  }

  // Create metadata for the 3-velocity version
  const metadata = {
    instrument: 'Salamander Grand Piano (3-velocity test)',
    source: 'https://github.com/sfzinstruments/SalamanderGrandPiano',
    license: 'CC-BY 3.0',
    version: '3-velocity',
    velocityLayers: 3,
    velocityMapping: {
      '0-42': 'v1',     // pp (MIDI 0-42)
      '43-85': 'v8',    // mf (MIDI 43-85)
      '86-127': 'v16'   // ff (MIDI 86-127)
    },
    created: new Date().toISOString()
  };

  await fs.writeFile(
    join(OUTPUT_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log(`\n📊 Conversion Summary:`);
  console.log(`   ✅ Total converted: ${totalConverted} samples`);
  console.log(`   📂 Output directory: ${OUTPUT_DIR}\n`);
}

main().catch(console.error);