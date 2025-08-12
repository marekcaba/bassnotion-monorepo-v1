#!/usr/bin/env node

/**
 * Script to upload all Hydrogen drum kits to Supabase
 * Uploads the complete collection of 40 drum kits
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend
dotenv.config({ path: path.join(__dirname, '../apps/backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Paths
const PROCESSED_DIR = path.join(__dirname, '../temp/hydrogen-processed');
const METADATA_FILE = path.join(PROCESSED_DIR, 'complete-index.json');

// Check if metadata exists
if (!fs.existsSync(METADATA_FILE)) {
  console.error('❌ No metadata found. Run download-all-hydrogen-kits.js first');
  process.exit(1);
}

// Upload a single file to Supabase
async function uploadFile(localPath, bucketPath) {
  try {
    const fileBuffer = fs.readFileSync(localPath);
    const { data, error } = await supabase.storage
      .from('audio-samples')
      .upload(bucketPath, fileBuffer, {
        contentType: 'audio/wav',
        upsert: true
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`❌ Failed to upload ${bucketPath}:`, error.message);
    throw error;
  }
}

// Upload drum kit samples
async function uploadDrumKit(kit, basePath) {
  console.log(`\n📦 Uploading kit: ${kit.name}`);
  
  const kitPath = path.join(PROCESSED_DIR, kit.path);
  
  if (!fs.existsSync(kitPath)) {
    console.error(`❌ Kit directory not found: ${kitPath}`);
    return { kit: kit.id, status: 'failed', error: 'Directory not found' };
  }
  
  const files = fs.readdirSync(kitPath).filter(f => f.endsWith('.wav'));
  let uploadedCount = 0;
  
  for (const file of files) {
    const localPath = path.join(kitPath, file);
    const bucketPath = `drums/hydrogen-kits/${kit.category}/${kit.id}/${file}`;
    
    try {
      await uploadFile(localPath, bucketPath);
      uploadedCount++;
      process.stdout.write(`\r  ✓ Uploaded ${uploadedCount}/${files.length} samples`);
    } catch (error) {
      console.error(`\n  ❌ Failed to upload ${file}`);
    }
  }
  
  // Upload drumkit.xml if exists
  const drumkitXml = path.join(kitPath, 'drumkit.xml');
  if (fs.existsSync(drumkitXml)) {
    try {
      await uploadFile(
        drumkitXml, 
        `drums/hydrogen-kits/${kit.category}/${kit.id}/drumkit.xml`
      );
      console.log('\n  ✓ Uploaded drumkit.xml');
    } catch (error) {
      console.error('\n  ❌ Failed to upload drumkit.xml');
    }
  }
  
  console.log(`\n  ✅ Uploaded ${uploadedCount}/${files.length} samples`);
  
  return { 
    kit: kit.id, 
    status: 'success', 
    uploadedCount,
    totalCount: files.length 
  };
}

// Create category index files
async function createCategoryIndex(category, kits) {
  const categoryData = {
    category: category,
    kitCount: kits.length,
    kits: kits.map(kit => ({
      id: kit.id,
      name: kit.name,
      sampleCount: kit.sampleCount,
      size: kit.size
    })),
    generated: new Date().toISOString()
  };
  
  const indexPath = `drums/hydrogen-kits/${category}/index.json`;
  
  try {
    const { error } = await supabase.storage
      .from('audio-samples')
      .upload(indexPath, JSON.stringify(categoryData, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
      
    if (error) throw error;
    console.log(`✓ Created category index: ${category}`);
  } catch (error) {
    console.error(`❌ Failed to create category index for ${category}:`, error.message);
  }
}

// Create master index
async function createMasterIndex(metadata, results) {
  const masterIndex = {
    name: 'Hydrogen Complete Drum Collection',
    description: 'The full collection of 40 official Hydrogen drum kits',
    license: 'GPL2/GPL/CC - Free for commercial use',
    generated: new Date().toISOString(),
    totalKits: metadata.totalKits,
    totalSize: metadata.totalSize,
    categories: Object.keys(metadata.categories).map(cat => ({
      name: cat,
      count: metadata.categories[cat].count,
      path: `drums/hydrogen-kits/${cat}/`
    })),
    uploadResults: results
  };
  
  const indexPath = 'drums/hydrogen-kits/master-index.json';
  
  try {
    const { error } = await supabase.storage
      .from('audio-samples')
      .upload(indexPath, JSON.stringify(masterIndex, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
      
    if (error) throw error;
    console.log('✓ Created master index');
  } catch (error) {
    console.error('❌ Failed to create master index:', error.message);
  }
}

// Main upload function
async function main() {
  console.log('🚀 Hydrogen Drum Kit Uploader to Supabase');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}\n`);
  
  // Load metadata
  const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
  console.log(`📊 Found ${metadata.kits.length} kits to upload`);
  console.log(`💾 Total size: ${(metadata.totalSize / 1024 / 1024).toFixed(1)} MB\n`);
  
  // Check storage bucket exists
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error('❌ Failed to list buckets:', bucketError);
    process.exit(1);
  }
  
  const audioBucket = buckets.find(b => b.name === 'audio-samples');
  if (!audioBucket) {
    console.error('❌ audio-samples bucket not found in Supabase');
    console.log('Available buckets:', buckets.map(b => b.name).join(', '));
    process.exit(1);
  }
  
  console.log('✓ Found audio-samples bucket\n');
  
  // Upload kits
  const results = [];
  
  for (const kit of metadata.kits) {
    const result = await uploadDrumKit(kit, PROCESSED_DIR);
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n\n📁 Creating category indexes...');
  
  // Create category indexes
  for (const [category, data] of Object.entries(metadata.categories)) {
    const categoryKits = metadata.kits.filter(k => k.category === category);
    await createCategoryIndex(category, categoryKits);
  }
  
  // Create master index
  await createMasterIndex(metadata, results);
  
  // Summary
  console.log('\n\n📊 Upload Summary:');
  console.log(`Total kits: ${metadata.kits.length}`);
  console.log(`Successful: ${results.filter(r => r.status === 'success').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'failed').length}`);
  
  console.log('\n✅ Upload complete!');
  console.log('\n📱 Next steps:');
  console.log('1. Update DrumInstrumentProcessor to load from new structure');
  console.log('2. Update frontend to display all available kits');
  console.log('3. Test kit loading and playback');
}

// Run the script
main().catch(console.error);