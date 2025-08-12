#!/usr/bin/env node

/**
 * Upload Salamander Grand Piano samples to Supabase storage
 */

import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', 'apps', 'frontend', '.env.local') });

const SAMPLES_DIR = join(__dirname, '..', 'apps', 'frontend', 'public', 'samples', 'salamander-piano');
const BUCKET_NAME = 'audio-samples';
const BUCKET_PATH = 'keyboards/salamander-piano';

async function main() {
  console.log('🎹 Salamander Grand Piano Supabase Uploader\n');

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in environment variables');
    console.log('Required:');
    console.log('  NEXT_PUBLIC_SUPABASE_URL');
    console.log('  SUPABASE_SERVICE_ROLE_KEY (or using anon key)');
    return;
  }

  console.log('🔗 Connecting to Supabase...');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Using: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Role Key' : 'Anon Key'}`);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Read sample files
  const files = await fs.readdir(SAMPLES_DIR);
  const mp3Files = files.filter(f => f.endsWith('.mp3'));
  
  console.log(`\n📦 Found ${mp3Files.length} MP3 files to upload`);

  // Upload metadata first
  const metadataPath = join(SAMPLES_DIR, 'metadata.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  
  console.log('\n📄 Uploading metadata...');
  const metadataUploadPath = `${BUCKET_PATH}/metadata.json`;
  
  const { error: metadataError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(metadataUploadPath, await fs.readFile(metadataPath), {
      contentType: 'application/json',
      cacheControl: '3600',
      upsert: true
    });

  if (metadataError) {
    console.error('❌ Failed to upload metadata:', metadataError);
    return;
  }

  console.log('✅ Metadata uploaded successfully');

  // Upload samples
  console.log('\n🔄 Uploading samples...');
  
  let successCount = 0;
  let failCount = 0;

  for (const filename of mp3Files) {
    const filePath = join(SAMPLES_DIR, filename);
    const uploadPath = `${BUCKET_PATH}/${filename}`;
    
    process.stdout.write(`  Uploading ${filename}... `);
    
    try {
      const fileBuffer = await fs.readFile(filePath);
      
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(uploadPath, fileBuffer, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.log('❌');
        console.error(`    Error: ${error.message}`);
        failCount++;
      } else {
        console.log('✅');
        successCount++;
      }
    } catch (error) {
      console.log('❌');
      console.error(`    Error: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n📊 Upload Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (successCount > 0) {
    // Create index file for all uploaded samples
    const indexData = {
      instrument: metadata.instrument,
      source: metadata.source,
      license: metadata.license,
      baseUrl: `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${BUCKET_PATH}`,
      samples: {},
      uploadedAt: new Date().toISOString()
    };

    // Add successfully uploaded samples to index
    for (const filename of mp3Files) {
      const noteName = filename.replace('.mp3', '');
      indexData.samples[noteName] = filename;
    }

    // Upload index
    console.log('\n📋 Uploading sample index...');
    const indexPath = `metadata/keyboard-instruments/salamander-piano.json`;
    
    const { error: indexError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(indexPath, JSON.stringify(indexData, null, 2), {
        contentType: 'application/json',
        cacheControl: '3600',
        upsert: true
      });

    if (indexError) {
      console.error('❌ Failed to upload index:', indexError);
    } else {
      console.log('✅ Index uploaded successfully');
    }

    console.log('\n✅ Upload complete!');
    console.log(`🌐 Samples available at:`);
    console.log(`   ${indexData.baseUrl}`);
  }

  // List what's in the bucket
  console.log('\n📂 Verifying uploaded files...');
  const { data: listData, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(BUCKET_PATH, {
      limit: 100,
      offset: 0
    });

  if (listError) {
    console.error('❌ Failed to list files:', listError);
  } else {
    console.log(`✅ Found ${listData.length} files in bucket`);
  }
}

main().catch(console.error);