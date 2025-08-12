#!/usr/bin/env node

/**
 * Download Salamander Grand Piano samples from GitHub
 * Source: https://github.com/sfzinstruments/SalamanderGrandPiano
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_URL = 'https://github.com/sfzinstruments/SalamanderGrandPiano.git';
const OUTPUT_DIR = join(__dirname, '..', 'temp', 'salamander-piano');
const SAMPLES_DIR = join(__dirname, '..', 'apps', 'frontend', 'public', 'samples', 'salamander-piano');

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath);
      reject(err);
    });
  });
}

async function main() {
  console.log('🎹 Salamander Grand Piano Download Tool\n');

  // Create directories
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(SAMPLES_DIR, { recursive: true });

  // Option 1: Try to clone the repository (might be large)
  console.log('📥 Attempting to download Salamander Grand Piano samples...');
  console.log('   This is a large download (~1.6GB), please be patient...\n');

  try {
    // Check if git is available
    await execAsync('which git');

    // Clone with depth 1 to save bandwidth
    console.log('🔄 Cloning repository (shallow clone)...');
    const cloneCmd = `git clone --depth 1 "${REPO_URL}" "${OUTPUT_DIR}"`;
    
    await execAsync(cloneCmd, {
      stdio: 'inherit'
    });

    console.log('✅ Repository cloned successfully!');

    // Find the audio samples
    const audioDir = join(OUTPUT_DIR, 'Samples');
    
    try {
      const files = await fs.readdir(audioDir);
      const flacFiles = files.filter(f => f.endsWith('.flac'));
      
      console.log(`\n📦 Found ${flacFiles.length} FLAC files`);

      // Since these are FLAC files, we need to convert them to MP3 for web use
      console.log('\n🔄 Converting FLAC to MP3 (requires ffmpeg)...');
      
      // Check if ffmpeg is available
      try {
        await execAsync('which ffmpeg');
      } catch (error) {
        console.error('❌ ffmpeg is not installed!');
        console.log('Please install ffmpeg:');
        console.log('  brew install ffmpeg');
        return;
      }

      // Convert a subset of samples for testing (every 3rd note)
      const selectedNotes = [
        'A0', 'C1', 'Eb1', 'Gb1', 'A1',
        'C2', 'Eb2', 'Gb2', 'A2',
        'C3', 'Eb3', 'Gb3', 'A3',
        'C4', 'Eb4', 'Gb4', 'A4',
        'C5', 'Eb5', 'Gb5', 'A5',
        'C6', 'Eb6', 'Gb6', 'A6',
        'C7', 'Eb7', 'Gb7', 'A7', 'C8'
      ];

      for (const noteName of selectedNotes) {
        // Find files for this note (multiple velocity layers)
        const noteFiles = flacFiles.filter(f => f.startsWith(noteName));
        
        if (noteFiles.length > 0) {
          // Use the medium velocity layer (usually v8 or similar)
          const mediumVelocity = noteFiles.find(f => f.includes('v8')) || noteFiles[Math.floor(noteFiles.length / 2)];
          
          if (mediumVelocity) {
            const inputPath = join(audioDir, mediumVelocity);
            const outputFile = `${noteName}.mp3`;
            const outputPath = join(SAMPLES_DIR, outputFile);
            
            console.log(`  Converting ${noteName}...`);
            
            // Convert to MP3 with web-optimized settings
            const ffmpegCmd = `ffmpeg -i "${inputPath}" -acodec mp3 -ab 128k -ar 44100 "${outputPath}" -y`;
            
            try {
              await execAsync(ffmpegCmd);
            } catch (error) {
              console.error(`  ❌ Failed to convert ${noteName}:`, error.message);
            }
          }
        }
      }

      console.log('\n✅ Conversion complete!');
      console.log(`📁 Samples saved to: ${SAMPLES_DIR}`);

      // Create metadata file
      const metadata = {
        instrument: 'Salamander Grand Piano',
        source: 'https://github.com/sfzinstruments/SalamanderGrandPiano',
        license: 'CC-BY 3.0',
        samples: selectedNotes.reduce((acc, note) => {
          acc[note] = `${note}.mp3`;
          return acc;
        }, {}),
        created: new Date().toISOString()
      };

      await fs.writeFile(
        join(SAMPLES_DIR, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      console.log('📄 Created metadata.json');

      // Clean up temp directory
      console.log('\n🧹 Cleaning up temporary files...');
      await execAsync(`rm -rf "${OUTPUT_DIR}"`);
      
      console.log('\n✅ Done! Salamander Grand Piano samples are ready for use.');

    } catch (error) {
      console.error('❌ Error processing audio files:', error);
    }

  } catch (error) {
    console.error('❌ Failed to download samples:', error.message);
    
    // Alternative: Direct download from Internet Archive
    console.log('\n🔄 Trying alternative source (Internet Archive)...');
    console.log('   Note: This would require manual download and extraction.');
    console.log('   Visit: https://archive.org/details/SalamanderGrandPianoV3');
  }
}

main().catch(console.error);