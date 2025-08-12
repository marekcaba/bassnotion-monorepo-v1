#!/usr/bin/env node

/**
 * Convert existing Salamander Grand Piano FLAC samples to MP3
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_DIR = join(__dirname, '..', 'temp', 'salamander-piano', 'Samples');
const OUTPUT_DIR = join(__dirname, '..', 'apps', 'frontend', 'public', 'samples', 'salamander-piano');

async function main() {
  console.log('🎹 Salamander Grand Piano Sample Converter\n');

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Check if ffmpeg is available
  try {
    await execAsync('which ffmpeg');
  } catch (error) {
    console.error('❌ ffmpeg is not installed!');
    console.log('Please install ffmpeg:');
    console.log('  brew install ffmpeg');
    return;
  }

  // Read all FLAC files
  const files = await fs.readdir(INPUT_DIR);
  const flacFiles = files.filter(f => f.endsWith('.flac'));
  
  console.log(`📦 Found ${flacFiles.length} FLAC files`);

  // Convert a subset of samples (every 3rd note, medium velocity)
  // Using sharp notation as that's what the files use
  const selectedNotes = [
    'A0', 'C1', 'D#1', 'F#1', 'A1',
    'C2', 'D#2', 'F#2', 'A2',
    'C3', 'D#3', 'F#3', 'A3',
    'C4', 'D#4', 'F#4', 'A4',
    'C5', 'D#5', 'F#5', 'A5',
    'C6', 'D#6', 'F#6', 'A6',
    'C7', 'D#7', 'F#7', 'A7', 'C8'
  ];

  console.log('\n🔄 Converting samples to MP3...');

  for (const noteName of selectedNotes) {
    // Find files for this note (multiple velocity layers)
    const noteFiles = flacFiles.filter(f => f.startsWith(noteName + 'v'));
    
    if (noteFiles.length > 0) {
      // Use velocity 8 (medium) or middle velocity
      const mediumVelocity = noteFiles.find(f => f.includes('v8')) || noteFiles[Math.floor(noteFiles.length / 2)];
      
      if (mediumVelocity) {
        const inputPath = join(INPUT_DIR, mediumVelocity);
        const outputFile = `${noteName}.mp3`;
        const outputPath = join(OUTPUT_DIR, outputFile);
        
        console.log(`  Converting ${noteName}...`);
        
        // Convert to MP3 with web-optimized settings
        const ffmpegCmd = `ffmpeg -i "${inputPath}" -acodec mp3 -ab 128k -ar 44100 "${outputPath}" -y`;
        
        try {
          await execAsync(ffmpegCmd, { stdio: 'pipe' });
        } catch (error) {
          console.error(`  ❌ Failed to convert ${noteName}:`, error.message);
        }
      }
    } else {
      console.log(`  ⚠️  No samples found for ${noteName}`);
    }
  }

  console.log('\n✅ Conversion complete!');
  console.log(`📁 Samples saved to: ${OUTPUT_DIR}`);

  // Create metadata file
  const metadata = {
    instrument: 'Salamander Grand Piano',
    source: 'https://github.com/sfzinstruments/SalamanderGrandPiano',
    license: 'CC-BY 3.0',
    format: 'mp3',
    sampleRate: 44100,
    bitrate: '128k',
    samples: selectedNotes.reduce((acc, note) => {
      acc[note] = `${note}.mp3`;
      return acc;
    }, {}),
    velocityLayer: 'medium (v8)',
    created: new Date().toISOString()
  };

  await fs.writeFile(
    join(OUTPUT_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log('📄 Created metadata.json');
  
  // List file sizes
  console.log('\n📊 Sample file sizes:');
  for (const note of selectedNotes) {
    try {
      const stats = await fs.stat(join(OUTPUT_DIR, `${note}.mp3`));
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`  ${note}: ${sizeMB} MB`);
    } catch (error) {
      // File might not exist
    }
  }

  console.log('\n✅ Done! Salamander Grand Piano samples are ready for use.');
}

main().catch(console.error);