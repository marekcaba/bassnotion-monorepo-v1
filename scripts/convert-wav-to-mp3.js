#!/usr/bin/env node

/**
 * Convert WAV files to MP3 for better web performance
 * Uses high-quality MP3 encoding (256 kbps VBR)
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
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Configuration
const BUCKET = 'audio-samples';
const BASE_PATH = 'drums/hydrogen-collection';
const LOCAL_TEMP = path.join(__dirname, '../temp/mp3-conversion');

// MP3 encoding settings
const MP3_SETTINGS = {
  bitrate: '256k',      // High quality VBR
  quality: '0',         // Best quality algorithm
  sampleRate: '44100'   // Standard web audio sample rate
};

// Ensure directory exists
if (!fs.existsSync(LOCAL_TEMP)) {
  fs.mkdirSync(LOCAL_TEMP, { recursive: true });
}

// List all files in a directory recursively
async function listFiles(prefix) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, {
      limit: 1000,
      offset: 0
    });
    
  if (error) throw error;
  
  const files = [];
  
  for (const item of data) {
    if (item.name.endsWith('.wav')) {
      files.push({
        path: `${prefix}/${item.name}`,
        name: item.name
      });
    } else if (item.id && !item.name.includes('.')) {
      // It's a directory, recurse
      const subFiles = await listFiles(`${prefix}/${item.name}`);
      files.push(...subFiles);
    }
  }
  
  return files;
}

// Download file from Supabase
async function downloadFile(filePath, localPath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath);
    
  if (error) throw error;
  
  const buffer = await data.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(buffer));
}

// Convert WAV to MP3
async function convertToMp3(inputPath, outputPath) {
  const command = `ffmpeg -i "${inputPath}" -codec:a libmp3lame -b:a ${MP3_SETTINGS.bitrate} -q:a ${MP3_SETTINGS.quality} -ar ${MP3_SETTINGS.sampleRate} "${outputPath}" -y`;
  
  try {
    await execAsync(command);
    return true;
  } catch (error) {
    console.error(`Conversion failed: ${error.message}`);
    return false;
  }
}

// Upload MP3 to Supabase
async function uploadMp3(localPath, bucketPath) {
  const fileBuffer = fs.readFileSync(localPath);
  
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(bucketPath, fileBuffer, {
      contentType: 'audio/mpeg',
      upsert: true
    });
    
  if (error) throw error;
}

// Get file size in MB
function getFileSizeMB(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / 1024 / 1024).toFixed(2);
}

// Main conversion process
async function main() {
  console.log('🎵 WAV to MP3 Converter for Hydrogen Drums');
  console.log('==========================================\n');
  
  try {
    // Check ffmpeg is installed
    await execAsync('ffmpeg -version');
  } catch (error) {
    console.error('❌ ffmpeg is required but not found');
    console.error('Install with: brew install ffmpeg');
    process.exit(1);
  }
  
  console.log('📂 Fetching WAV files from Supabase...\n');
  
  // Get all WAV files
  const wavFiles = await listFiles(BASE_PATH);
  console.log(`Found ${wavFiles.length} WAV files to convert\n`);
  
  let totalSaved = 0;
  let successCount = 0;
  
  // Process each file
  for (let i = 0; i < wavFiles.length; i++) {
    const file = wavFiles[i];
    const progress = `[${i + 1}/${wavFiles.length}]`;
    
    process.stdout.write(`${progress} Converting ${file.name}... `);
    
    try {
      // Download WAV
      const localWavPath = path.join(LOCAL_TEMP, `temp_${i}.wav`);
      await downloadFile(file.path, localWavPath);
      const wavSize = getFileSizeMB(localWavPath);
      
      // Convert to MP3
      const localMp3Path = path.join(LOCAL_TEMP, `temp_${i}.mp3`);
      const converted = await convertToMp3(localWavPath, localMp3Path);
      
      if (converted) {
        const mp3Size = getFileSizeMB(localMp3Path);
        const savings = parseFloat(wavSize) - parseFloat(mp3Size);
        totalSaved += savings;
        
        // Upload MP3
        const mp3BucketPath = file.path.replace('.wav', '.mp3');
        await uploadMp3(localMp3Path, mp3BucketPath);
        
        // Clean up temp files
        fs.unlinkSync(localWavPath);
        fs.unlinkSync(localMp3Path);
        
        console.log(`✓ (${wavSize}MB → ${mp3Size}MB, saved ${savings.toFixed(2)}MB)`);
        successCount++;
      } else {
        console.log('✗ (conversion failed)');
      }
    } catch (error) {
      console.log(`✗ (${error.message})`);
    }
  }
  
  // Update index files to reference MP3s
  console.log('\n📝 Updating index files...');
  
  const { data: indexData, error: indexError } = await supabase.storage
    .from(BUCKET)
    .download(`${BASE_PATH}/index.json`);
    
  if (!indexError && indexData) {
    const indexContent = await indexData.text();
    const updatedIndex = indexContent.replace(/\.wav/g, '.mp3');
    
    await supabase.storage
      .from(BUCKET)
      .upload(`${BASE_PATH}/index.json`, updatedIndex, {
        contentType: 'application/json',
        upsert: true
      });
      
    console.log('✓ Updated master index');
  }
  
  // Summary
  console.log('\n\n📊 Conversion Summary:');
  console.log(`Total files: ${wavFiles.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${wavFiles.length - successCount}`);
  console.log(`Space saved: ${totalSaved.toFixed(2)} MB`);
  console.log(`Average compression: ${((totalSaved / successCount) * 100 / (totalSaved / successCount + 1)).toFixed(0)}%`);
  
  console.log('\n✅ Conversion complete!');
  console.log('\n🎯 Next steps:');
  console.log('1. Update DrumInstrumentProcessor to load .mp3 files');
  console.log('2. Consider keeping WAV files as backup or for high-quality exports');
  console.log('3. Test audio playback with the new MP3 files');
  
  // Cleanup temp directory
  fs.rmSync(LOCAL_TEMP, { recursive: true, force: true });
}

// Run
main().catch(console.error);