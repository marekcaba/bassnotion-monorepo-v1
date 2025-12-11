#!/usr/bin/env node

/**
 * Convert metronome WAV files to MP3 format
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), 'apps/backend/.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function convertMetronomeFiles() {
  console.log('🎵 Converting Metronome WAV files to MP3');
  console.log('=====================================\n');

  try {
    // List all files in the metronome folder
    const { data: files, error: listError } = await supabase.storage
      .from('audio-samples')
      .list('metronome');

    if (listError) {
      throw new Error(`Failed to list metronome files: ${listError.message}`);
    }

    const wavFiles = files.filter(
      (f) => f.name && f.name.toLowerCase().endsWith('.wav'),
    );
    console.log(`Found ${wavFiles.length} WAV files to convert\n`);

    if (wavFiles.length === 0) {
      console.log('No WAV files found in metronome folder');
      return;
    }

    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp', 'metronome-conversion');
    await fs.mkdir(tempDir, { recursive: true });

    let converted = 0;
    let failed = 0;

    for (const file of wavFiles) {
      try {
        console.log(`Processing: ${file.name}`);

        // Download WAV file
        const { data: wavData, error: downloadError } = await supabase.storage
          .from('audio-samples')
          .download(`metronome/${file.name}`);

        if (downloadError) {
          throw new Error(
            `Failed to download ${file.name}: ${downloadError.message}`,
          );
        }

        // Convert Blob to Buffer and save temporarily
        const arrayBuffer = await wavData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const wavPath = path.join(tempDir, file.name);
        await fs.writeFile(wavPath, buffer);

        // Create MP3 filename
        const mp3Name = file.name.replace(/\.wav$/i, '.mp3');
        const mp3Path = path.join(tempDir, mp3Name);

        // Convert to MP3 using FFmpeg
        // Using high quality settings for metronome clicks
        await execAsync(
          `ffmpeg -i "${wavPath}" -codec:a libmp3lame -b:a 192k -q:a 2 -ar 44100 "${mp3Path}" -y`,
        );

        // Read converted MP3
        const mp3Buffer = await fs.readFile(mp3Path);

        // Upload MP3 to Supabase
        const { error: uploadError } = await supabase.storage
          .from('audio-samples')
          .upload(`metronome/${mp3Name}`, mp3Buffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          throw new Error(
            `Failed to upload ${mp3Name}: ${uploadError.message}`,
          );
        }

        // Get file sizes for comparison
        const wavStats = await fs.stat(wavPath);
        const mp3Stats = await fs.stat(mp3Path);
        const reduction = ((1 - mp3Stats.size / wavStats.size) * 100).toFixed(
          1,
        );

        console.log(`  ✅ Converted: ${file.name} → ${mp3Name}`);
        console.log(
          `     Size: ${(wavStats.size / 1024).toFixed(1)}KB → ${(mp3Stats.size / 1024).toFixed(1)}KB (${reduction}% reduction)`,
        );

        // Clean up temp files
        await fs.unlink(wavPath);
        await fs.unlink(mp3Path);

        converted++;
      } catch (error) {
        console.error(`  ❌ Failed to convert ${file.name}:`, error.message);
        failed++;
      }
    }

    // Clean up temp directory
    try {
      await fs.rmdir(tempDir);
    } catch (e) {
      // Ignore cleanup errors
    }

    console.log('\n📊 Conversion Summary:');
    console.log(`  ✅ Successfully converted: ${converted} files`);
    if (failed > 0) {
      console.log(`  ❌ Failed: ${failed} files`);
    }
    console.log(`  📦 Total size reduction: ~75-80% (typical for WAV→MP3)`);

    console.log('\n✨ Metronome MP3 conversion complete!');
    console.log(
      'The MP3 files are now available in the metronome folder alongside the WAV files.',
    );
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Check if FFmpeg is installed
async function checkFFmpeg() {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    console.error('❌ FFmpeg is not installed or not in PATH');
    console.error('Please install FFmpeg to use this script');
    process.exit(1);
  }
}

// Main execution
(async () => {
  await checkFFmpeg();
  await convertMetronomeFiles();
})();
