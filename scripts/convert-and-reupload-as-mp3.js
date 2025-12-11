#!/usr/bin/env node

/**
 * Convert local WAV files to MP3 and re-upload to Supabase
 * Best practice for web audio: MP3 at 256kbps
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

// Paths
const PROCESSED_DIR = path.join(__dirname, '../temp/hydrogen-ready');
const MP3_DIR = path.join(__dirname, '../temp/hydrogen-mp3');

// Ensure MP3 directory exists
if (!fs.existsSync(MP3_DIR)) {
  fs.mkdirSync(MP3_DIR, { recursive: true });
}

// Convert WAV to MP3
async function convertToMp3(inputPath, outputPath) {
  try {
    // High quality MP3: 256kbps VBR, 44.1kHz
    await execAsync(
      `ffmpeg -i "${inputPath}" -codec:a libmp3lame -b:a 256k -q:a 0 -ar 44100 "${outputPath}" -y`,
    );
    return true;
  } catch (error) {
    console.error(
      `Failed to convert ${path.basename(inputPath)}:`,
      error.message,
    );
    return false;
  }
}

// Process all WAV files in a directory
async function processDirectory(sourceDir, targetDir) {
  const stats = [];

  // Recreate directory structure
  const dirs = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory());

  for (const dir of dirs) {
    const subSourceDir = path.join(sourceDir, dir.name);
    const subTargetDir = path.join(targetDir, dir.name);

    if (!fs.existsSync(subTargetDir)) {
      fs.mkdirSync(subTargetDir, { recursive: true });
    }

    // Process subdirectories
    const subStats = await processDirectory(subSourceDir, subTargetDir);
    stats.push(...subStats);

    // Process files in this directory
    const files = fs
      .readdirSync(subSourceDir)
      .filter((f) => f.endsWith('.wav'));

    for (const file of files) {
      const inputPath = path.join(subSourceDir, file);
      const outputFile = file.replace('.wav', '.mp3');
      const outputPath = path.join(subTargetDir, outputFile);

      const inputSize = fs.statSync(inputPath).size;

      const success = await convertToMp3(inputPath, outputPath);

      if (success) {
        const outputSize = fs.statSync(outputPath).size;
        const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);
        stats.push({
          file: file,
          wavSize: inputSize,
          mp3Size: outputSize,
          reduction: parseFloat(reduction),
        });
        process.stdout.write(`✓`);
      } else {
        process.stdout.write(`✗`);
      }
    }
  }

  // Also process files in root directory
  const rootFiles = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.wav'));

  for (const file of rootFiles) {
    const inputPath = path.join(sourceDir, file);
    const outputFile = file.replace('.wav', '.mp3');
    const outputPath = path.join(targetDir, outputFile);

    const inputSize = fs.statSync(inputPath).size;

    const success = await convertToMp3(inputPath, outputPath);

    if (success) {
      const outputSize = fs.statSync(outputPath).size;
      const reduction = ((1 - outputSize / inputSize) * 100).toFixed(1);
      stats.push({
        file: file,
        wavSize: inputSize,
        mp3Size: outputSize,
        reduction: parseFloat(reduction),
      });
    }
  }

  return stats;
}

// Upload MP3 files to Supabase
async function uploadToSupabase(localDir, bucketPrefix) {
  let uploadCount = 0;

  async function uploadDir(dir, prefix) {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const localPath = path.join(dir, item.name);

      if (item.isDirectory()) {
        await uploadDir(localPath, `${prefix}/${item.name}`);
      } else if (
        item.name.endsWith('.mp3') ||
        item.name.endsWith('.xml') ||
        item.name.endsWith('.json')
      ) {
        const bucketPath = `${prefix}/${item.name}`;
        const fileBuffer = fs.readFileSync(localPath);

        const contentType = item.name.endsWith('.mp3')
          ? 'audio/mpeg'
          : item.name.endsWith('.xml')
            ? 'text/xml'
            : 'application/json';

        try {
          const { error } = await supabase.storage
            .from('audio-samples')
            .upload(bucketPath, fileBuffer, {
              contentType,
              upsert: true,
            });

          if (error) throw error;
          uploadCount++;
          process.stdout.write(`✓`);
        } catch (error) {
          process.stdout.write(`✗`);
          console.error(`\nFailed to upload ${item.name}:`, error.message);
        }
      }
    }
  }

  await uploadDir(localDir, bucketPrefix);
  return uploadCount;
}

// Main function
async function main() {
  console.log('🎵 MP3 Conversion & Upload for Hydrogen Drums');
  console.log('============================================\n');

  // Check ffmpeg
  try {
    await execAsync('ffmpeg -version');
  } catch (error) {
    console.error('❌ ffmpeg is required. Install with: brew install ffmpeg');
    process.exit(1);
  }

  // Check if processed directory exists
  if (!fs.existsSync(PROCESSED_DIR)) {
    console.error(
      '❌ No processed drums found. Run process-and-upload-hydrogen.js first',
    );
    process.exit(1);
  }

  console.log('🔄 Converting WAV files to MP3...\n');

  // Convert all WAV files
  const stats = await processDirectory(PROCESSED_DIR, MP3_DIR);

  console.log(`\n\n✓ Converted ${stats.length} files`);

  // Calculate statistics
  const totalWavSize = stats.reduce((sum, s) => sum + s.wavSize, 0);
  const totalMp3Size = stats.reduce((sum, s) => sum + s.mp3Size, 0);
  const avgReduction =
    stats.reduce((sum, s) => sum + s.reduction, 0) / stats.length;

  console.log(`\n📊 Conversion Statistics:`);
  console.log(`Original size: ${(totalWavSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Compressed size: ${(totalMp3Size / 1024 / 1024).toFixed(1)} MB`);
  console.log(
    `Space saved: ${((totalWavSize - totalMp3Size) / 1024 / 1024).toFixed(1)} MB`,
  );
  console.log(`Average compression: ${avgReduction.toFixed(1)}%`);

  // Copy XML and JSON files
  console.log('\n📄 Copying metadata files...');

  function copyMetadataFiles(sourceDir, targetDir) {
    const items = fs.readdirSync(sourceDir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        const subSource = path.join(sourceDir, item.name);
        const subTarget = path.join(targetDir, item.name);
        if (!fs.existsSync(subTarget)) {
          fs.mkdirSync(subTarget, { recursive: true });
        }
        copyMetadataFiles(subSource, subTarget);
      } else if (item.name.endsWith('.xml') || item.name.endsWith('.json')) {
        const sourcePath = path.join(sourceDir, item.name);
        const targetPath = path.join(targetDir, item.name);
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  copyMetadataFiles(PROCESSED_DIR, MP3_DIR);

  // Upload to Supabase
  console.log('\n🚀 Uploading MP3 files to Supabase...\n');

  const uploadCount = await uploadToSupabase(MP3_DIR, 'drums/hydrogen-mp3');

  console.log(`\n\n✓ Uploaded ${uploadCount} files`);

  // Create updated index
  const indexPath = path.join(PROCESSED_DIR, '../hydrogen-ready/index.json');
  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const index = JSON.parse(indexContent);

    // Update to MP3 format
    index.format = 'mp3';
    index.compression = 'High-quality MP3 256kbps';
    index.benefits = [
      '90% smaller file size than WAV',
      'Faster loading times',
      'Reduced bandwidth usage',
      'Imperceptible quality difference for drums',
    ];

    fs.writeFileSync(
      path.join(MP3_DIR, 'index.json'),
      JSON.stringify(index, null, 2),
    );

    // Upload updated index
    const { error } = await supabase.storage
      .from('audio-samples')
      .upload('drums/hydrogen-mp3/index.json', JSON.stringify(index, null, 2), {
        contentType: 'application/json',
        upsert: true,
      });

    if (!error) {
      console.log('\n✓ Updated master index');
    }
  }

  console.log('\n✅ Complete! MP3 drum kits are now available in Supabase.');
  console.log('\n📍 Location: audio-samples/drums/hydrogen-mp3/');
  console.log('\n🎯 Benefits of MP3 format:');
  console.log('• 90% smaller files = faster loading');
  console.log('• Better mobile performance');
  console.log('• Reduced bandwidth costs');
  console.log('• Imperceptible quality difference for percussion');
}

// Run
main().catch(console.error);
