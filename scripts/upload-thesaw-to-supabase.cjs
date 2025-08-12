#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://htuztkrbuewheehjspcz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SOURCE_DIR = path.join(__dirname, '../temp/thesaw-mp3');
const BUCKET_NAME = 'audio-samples';
const TARGET_PATH = 'Keyboards/thesaw';

async function uploadFile(filePath, targetPath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const fullPath = `${targetPath}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fullPath, fileBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });
    
    if (error) {
      console.error(`❌ Failed to upload ${fileName}:`, error.message);
      return false;
    }
    
    console.log(`✅ Uploaded ${fileName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error uploading ${path.basename(filePath)}:`, error.message);
    return false;
  }
}

async function uploadAllSamples() {
  console.log('🎹 Uploading The Saw samples to Supabase...\n');
  
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
    console.error('Please run convert-thesaw-samples.cjs first');
    process.exit(1);
  }
  
  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.mp3'));
  console.log(`Found ${files.length} MP3 files to upload\n`);
  
  let successCount = 0;
  
  for (const file of files) {
    const filePath = path.join(SOURCE_DIR, file);
    const success = await uploadFile(filePath, TARGET_PATH);
    if (success) successCount++;
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✅ Upload complete! ${successCount}/${files.length} files uploaded successfully`);
  console.log(`🌐 Files available at: ${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${TARGET_PATH}/`);
}

uploadAllSamples().catch(console.error);