#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const rootEnvPath = path.join(__dirname, '../.env');
dotenv.config({ path: rootEnvPath });

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test upload a single file from each keyboard
async function testUpload() {
  console.log('🎹 Testing keyboard upload to Supabase...\n');

  const testFiles = [
    {
      name: 'Salamander C4',
      sourcePath: path.join(__dirname, '../apps/frontend/public/samples/salamander-mp3/v8/C4.mp3'),
      targetPath: 'Keyboards/salamander/test/C4.mp3'
    },
    {
      name: 'Wurlitzer C4',
      sourcePath: path.join(__dirname, '../apps/frontend/public/samples/wurlitzer-mp3/v3/C4.mp3'),
      targetPath: 'Keyboards/wurlitzer/test/C4.mp3'
    },
    {
      name: 'Rhodes C4',
      sourcePath: path.join(__dirname, '../apps/frontend/public/samples/rhodes-mp3/v2/C4.mp3'),
      targetPath: 'Keyboards/rhodes/test/C4.mp3'
    },
    {
      name: 'Long Pad C3',
      sourcePath: path.join(__dirname, '../apps/frontend/public/samples/long-pad-mp3/49. FILTER DOWN_Juno_C3.mp3'),
      targetPath: 'Keyboards/longpad/test/C3.mp3'
    }
  ];

  for (const file of testFiles) {
    console.log(`Uploading ${file.name}...`);
    
    if (!fs.existsSync(file.sourcePath)) {
      console.error(`❌ File not found: ${file.sourcePath}`);
      continue;
    }

    try {
      const fileContent = fs.readFileSync(file.sourcePath);
      
      const { data, error } = await supabase.storage
        .from('audio-samples')
        .upload(file.targetPath, fileContent, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (error) {
        console.error(`❌ Error: ${error.message}`);
      } else {
        console.log(`✅ Success! URL: ${supabaseUrl}/storage/v1/object/public/audio-samples/${file.targetPath}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

testUpload().catch(console.error);