#!/usr/bin/env node

/**
 * Downloads the FULL Salamander Grand Piano library with ALL notes and velocity layers
 * This is a professional-grade Yamaha C5 Grand Piano sample library
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_URL = 'https://github.com/sfzinstruments/SalamanderGrandPiano.git';
const TEMP_DIR = join(__dirname, '..', 'temp', 'SalamanderGrandPiano-Full');
const OUTPUT_DIR = join(__dirname, '..', 'apps', 'frontend', 'public', 'samples', 'salamander-piano-full');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

async function main() {
  console.log('🎹 Salamander Grand Piano Full Library Downloader\n');
  console.log('This will download the COMPLETE library with all velocity layers.');
  console.log('Expected size: ~1.2GB compressed, ~2GB uncompressed\n');

  // Clean up any existing temp directory
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore if doesn't exist
  }

  // Clone the repository
  console.log('📥 Cloning Salamander Grand Piano repository...');
  console.log('   This may take a few minutes due to the large file size...\n');
  
  await ensureDir(dirname(TEMP_DIR));
  
  try {
    const { stdout, stderr } = await execAsync(
      `git clone --depth=1 "${REPO_URL}" "${TEMP_DIR}"`,
      { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
    );
    
    if (stderr && !stderr.includes('Cloning into')) {
      console.error('Git stderr:', stderr);
    }
    
    console.log('✅ Repository cloned successfully!\n');
  } catch (error) {
    console.error('❌ Failed to clone repository:', error.message);
    process.exit(1);
  }

  // Check what we have
  console.log('📊 Analyzing downloaded samples...\n');
  
  const samplesDir = join(TEMP_DIR, 'Samples');
  const allFiles = await fs.readdir(samplesDir);
  const flacFiles = allFiles.filter(f => f.endsWith('.flac'));
  
  console.log(`Found ${flacFiles.length} FLAC files\n`);

  // Analyze velocity layers
  const velocityMap = new Map();
  const noteMap = new Map();
  
  for (const file of flacFiles) {
    // Parse filename: e.g., "A0v1.flac" -> note: A0, velocity: 1
    const match = file.match(/^([A-G]#?\d)v(\d+)\.flac$/);
    if (match) {
      const note = match[1];
      const velocity = parseInt(match[2]);
      
      if (!noteMap.has(note)) {
        noteMap.set(note, []);
      }
      noteMap.get(note).push(velocity);
      
      if (!velocityMap.has(velocity)) {
        velocityMap.set(velocity, 0);
      }
      velocityMap.set(velocity, velocityMap.get(velocity) + 1);
    }
  }

  console.log('📋 Velocity layers found:');
  const velocities = Array.from(velocityMap.keys()).sort((a, b) => a - b);
  for (const vel of velocities) {
    console.log(`   v${vel}: ${velocityMap.get(vel)} samples`);
  }
  
  console.log(`\n📋 Total unique notes: ${noteMap.size}`);
  console.log(`📋 Velocity layers per note: ${velocities.length}\n`);

  // Show sample of notes
  const notes = Array.from(noteMap.keys()).sort();
  console.log('🎵 Sample notes available:');
  console.log(`   First 5: ${notes.slice(0, 5).join(', ')}`);
  console.log(`   Last 5: ${notes.slice(-5).join(', ')}\n`);

  // Create output directory structure
  await ensureDir(OUTPUT_DIR);
  
  // Create velocity layer directories
  console.log('📁 Creating directory structure...\n');
  for (const vel of velocities) {
    await ensureDir(join(OUTPUT_DIR, `v${vel}`));
  }

  // Create metadata
  const metadata = {
    instrument: 'Salamander Grand Piano',
    source: 'https://github.com/sfzinstruments/SalamanderGrandPiano',
    license: 'CC-BY 3.0',
    version: 'Full',
    velocityLayers: velocities.length,
    totalSamples: flacFiles.length,
    notes: notes,
    velocityMapping: {
      pp: velocities.slice(0, 2),     // v1-v2
      p: velocities.slice(2, 5),      // v3-v5
      mp: velocities.slice(5, 8),     // v6-v8
      mf: velocities.slice(8, 11),    // v9-v11
      f: velocities.slice(11, 14),    // v12-v14
      ff: velocities.slice(14, 16)    // v15-v16
    },
    created: new Date().toISOString()
  };

  await fs.writeFile(
    join(OUTPUT_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log('✅ Metadata created');
  console.log('\n📋 Next steps:');
  console.log('   1. Run convert-full-salamander-samples.js to convert to MP3');
  console.log('   2. Implement velocity-based sample switching');
  console.log('   3. Upload to Supabase or serve locally\n');

  // Show disk space estimate
  const sampleCount = flacFiles.length;
  const avgFlacSize = 0.4; // MB per file (estimate)
  const avgMp3Size = 0.15; // MB per file at 128kbps (estimate)
  
  console.log('💾 Disk space estimates:');
  console.log(`   FLAC files: ~${(sampleCount * avgFlacSize).toFixed(0)}MB`);
  console.log(`   MP3 files (128kbps): ~${(sampleCount * avgMp3Size).toFixed(0)}MB`);
  console.log(`   Total (both): ~${(sampleCount * (avgFlacSize + avgMp3Size)).toFixed(0)}MB\n`);

  // Copy FLAC files to organized structure
  console.log('📦 Organizing FLAC files by velocity...');
  
  let copiedCount = 0;
  for (const file of flacFiles) {
    const match = file.match(/^([A-G]#?\d)v(\d+)\.flac$/);
    if (match) {
      const note = match[1];
      const velocity = match[2];
      
      const sourcePath = join(TEMP_DIR, 'Samples', file);
      const destPath = join(OUTPUT_DIR, `v${velocity}`, `${note}.flac`);
      
      await fs.copyFile(sourcePath, destPath);
      copiedCount++;
      
      if (copiedCount % 50 === 0) {
        process.stdout.write(`\r   Copied ${copiedCount}/${flacFiles.length} files...`);
      }
    }
  }
  
  console.log(`\r   ✅ Copied ${copiedCount} files successfully!      \n`);
  
  console.log('🎉 Download complete!');
  console.log(`📂 Full library available at:\n   ${OUTPUT_DIR}\n`);
}

main().catch(console.error);