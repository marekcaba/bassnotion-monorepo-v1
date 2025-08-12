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

// Parse command line arguments
const args = process.argv.slice(2);
const instrumentArg = args[0];
const validInstruments = ['salamander', 'wurlitzer', 'longpad', 'rhodes', 'all'];

if (!instrumentArg || !validInstruments.includes(instrumentArg)) {
  console.log('Usage: node upload-keyboards-batch.mjs <instrument>');
  console.log('Instruments: salamander, wurlitzer, longpad, rhodes, all');
  process.exit(1);
}

// Long Pad filename mapping
const longPadMapping = {
  '01. FILTER DOWN_Juno_C-1.mp3': 'C-1.mp3',
  '02. FILTER DOWN_Juno_Cs-1.mp3': 'Cs-1.mp3',
  '03. FILTER DOWN_Juno_D-1.mp3': 'D-1.mp3',
  '04. FILTER DOWN_Juno_Ds-1.mp3': 'Ds-1.mp3',
  '05. FILTER DOWN_Juno_E-1.mp3': 'E-1.mp3',
  '06. FILTER DOWN_Juno_F-1.mp3': 'F-1.mp3',
  '07. FILTER DOWN_Juno_Fs-1.mp3': 'Fs-1.mp3',
  '08. FILTER DOWN_Juno_G-1.mp3': 'G-1.mp3',
  '09. FILTER DOWN_Juno_Gs-1.mp3': 'Gs-1.mp3',
  '10. FILTER DOWN_Juno_A-1.mp3': 'A-1.mp3',
  '11. FILTER DOWN_Juno_As-1.mp3': 'As-1.mp3',
  '12. FILTER DOWN_Juno_B-1.mp3': 'B-1.mp3',
  '13. FILTER DOWN_Juno_C0.mp3': 'C0.mp3',
  '14. FILTER DOWN_Juno_Cs0.mp3': 'Cs0.mp3',
  '15. FILTER DOWN_Juno_D0.mp3': 'D0.mp3',
  '16. FILTER DOWN_Juno_Ds0.mp3': 'Ds0.mp3',
  '17. FILTER DOWN_Juno_E0.mp3': 'E0.mp3',
  '18. FILTER DOWN_Juno_F0.mp3': 'F0.mp3',
  '19. FILTER DOWN_Juno_Fs0.mp3': 'Fs0.mp3',
  '20. FILTER DOWN_Juno_G0.mp3': 'G0.mp3',
  '21. FILTER DOWN_Juno_Gs0.mp3': 'Gs0.mp3',
  '22. FILTER DOWN_Juno_A0.mp3': 'A0.mp3',
  '23. FILTER DOWN_Juno_As0.mp3': 'As0.mp3',
  '24. FILTER DOWN_Juno_B0.mp3': 'B0.mp3',
  '25. FILTER DOWN_Juno_C1.mp3': 'C1.mp3',
  '26. FILTER DOWN_Juno_Cs1.mp3': 'Cs1.mp3',
  '27. FILTER DOWN_Juno_D1.mp3': 'D1.mp3',
  '28. FILTER DOWN_Juno_Ds1.mp3': 'Ds1.mp3',
  '29. FILTER DOWN_Juno_E1.mp3': 'E1.mp3',
  '30. FILTER DOWN_Juno_F1.mp3': 'F1.mp3',
  '31. FILTER DOWN_Juno_Fs1.mp3': 'Fs1.mp3',
  '32. FILTER DOWN_Juno_G1.mp3': 'G1.mp3',
  '33. FILTER DOWN_Juno_Gs1.mp3': 'Gs1.mp3',
  '34. FILTER DOWN_Juno_A1.mp3': 'A1.mp3',
  '35. FILTER DOWN_Juno_As1.mp3': 'As1.mp3',
  '36. FILTER DOWN_Juno_B1.mp3': 'B1.mp3',
  '37. FILTER DOWN_Juno_C2.mp3': 'C2.mp3',
  '38. FILTER DOWN_Juno_Cs2.mp3': 'Cs2.mp3',
  '39. FILTER DOWN_Juno_D2.mp3': 'D2.mp3',
  '40. FILTER DOWN_Juno_Ds2.mp3': 'Ds2.mp3',
  '41. FILTER DOWN_Juno_E2.mp3': 'E2.mp3',
  '42. FILTER DOWN_Juno_F2.mp3': 'F2.mp3',
  '43. FILTER DOWN_Juno_Fs2.mp3': 'Fs2.mp3',
  '44. FILTER DOWN_Juno_G2.mp3': 'G2.mp3',
  '45. FILTER DOWN_Juno_Gs2.mp3': 'Gs2.mp3',
  '46. FILTER DOWN_Juno_A2.mp3': 'A2.mp3',
  '47. FILTER DOWN_Juno_As2.mp3': 'As2.mp3',
  '48. FILTER DOWN_Juno_B2.mp3': 'B2.mp3',
  '49. FILTER DOWN_Juno_C3.mp3': 'C3.mp3',
  '50. FILTER DOWN_Juno_Cs3.mp3': 'Cs3.mp3',
  '51. FILTER DOWN_Juno_D3.mp3': 'D3.mp3',
  '52. FILTER DOWN_Juno_Ds3.mp3': 'Ds3.mp3',
  '53. FILTER DOWN_Juno_E3.mp3': 'E3.mp3',
  '54. FILTER DOWN_Juno_F3.mp3': 'F3.mp3',
  '55. FILTER DOWN_Juno_Fs3.mp3': 'Fs3.mp3',
  '56. FILTER DOWN_Juno_G3.mp3': 'G3.mp3',
  '57. FILTER DOWN_Juno_Gs3.mp3': 'Gs3.mp3',
  '58. FILTER DOWN_Juno_A3.mp3': 'A3.mp3',
  '59. FILTER DOWN_Juno_As3.mp3': 'As3.mp3',
  '60. FILTER DOWN_Juno_B3.mp3': 'B3.mp3',
  '61. FILTER DOWN_Juno_C4.mp3': 'C4.mp3'
};

// Define keyboard instruments
const keyboards = {
  salamander: {
    name: 'salamander',
    sourcePath: path.join(__dirname, '../apps/frontend/public/samples/salamander-mp3'),
    targetPath: 'Keyboards/salamander',
    description: 'Salamander Grand Piano - 16 velocity layers'
  },
  wurlitzer: {
    name: 'wurlitzer',
    sourcePath: path.join(__dirname, '../apps/frontend/public/samples/wurlitzer-mp3'),
    targetPath: 'Keyboards/wurlitzer',
    description: 'Wurlitzer Electric Piano - Variable velocity layers'
  },
  longpad: {
    name: 'longpad',
    sourcePath: path.join(__dirname, '../apps/frontend/public/samples/long-pad-mp3'),
    targetPath: 'Keyboards/longpad',
    description: 'Long Pad Synthesizer - Single velocity layer'
  },
  rhodes: {
    name: 'rhodes',
    sourcePath: path.join(__dirname, '../apps/frontend/public/samples/rhodes-mp3'),
    targetPath: 'Keyboards/rhodes',
    description: 'Fender Rhodes Electric Piano - 4 velocity layers'
  }
};

// Get all files recursively
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else if (file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.json')) {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

// Upload files in batches
async function uploadBatch(files, batchSize = 10) {
  const results = { uploaded: 0, failed: 0 };
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const promises = batch.map(({ file, targetPath }) => uploadFile(file, targetPath));
    
    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        results.uploaded++;
      } else {
        results.failed++;
        console.error(`\n❌ Failed: ${batch[index].targetPath}`);
      }
    });
    
    // Progress update
    console.log(`\n   Progress: ${i + batch.length}/${files.length} files processed`);
    
    // Small delay between batches
    if (i + batchSize < files.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

// Upload a single file
async function uploadFile(filePath, targetPath) {
  try {
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    let contentType = 'application/octet-stream';
    
    if (fileName.endsWith('.mp3')) contentType = 'audio/mpeg';
    else if (fileName.endsWith('.wav')) contentType = 'audio/wav';
    else if (fileName.endsWith('.json')) contentType = 'application/json';
    
    const { data, error } = await supabase.storage
      .from('audio-samples')
      .upload(targetPath, fileContent, {
        contentType,
        upsert: true
      });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error(`\n❌ Error uploading ${targetPath}:`, error.message);
    return false;
  }
}

// Upload a single keyboard instrument
async function uploadKeyboard(keyboard) {
  console.log(`\n📁 Processing ${keyboard.name}...`);
  console.log(`   ${keyboard.description}`);
  
  if (!fs.existsSync(keyboard.sourcePath)) {
    console.error(`❌ Source path not found: ${keyboard.sourcePath}`);
    return;
  }

  // Get all files
  const allFiles = getAllFiles(keyboard.sourcePath);
  console.log(`   Found ${allFiles.length} files`);

  // Prepare upload list
  const uploadList = allFiles.map(file => {
    const fileName = path.basename(file);
    let relativePath = path.relative(keyboard.sourcePath, file);
    
    // For Long Pad, rename files
    if (keyboard.name === 'longpad' && longPadMapping[fileName]) {
      const dirPath = path.dirname(relativePath);
      const newFileName = longPadMapping[fileName];
      relativePath = dirPath ? path.join(dirPath, newFileName) : newFileName;
    }
    
    const targetPath = path.join(keyboard.targetPath, relativePath).replace(/\\/g, '/');
    
    return { file, targetPath };
  });

  // Upload in batches
  console.log(`   Starting batch upload...`);
  const results = await uploadBatch(uploadList, 10);
  
  console.log(`   ✅ Uploaded: ${results.uploaded} files`);
  if (results.failed > 0) {
    console.log(`   ❌ Failed: ${results.failed} files`);
  }
}

// Main function
async function main() {
  console.log('🎹 Keyboard Batch Upload to Supabase\n');
  
  const instrumentsToUpload = instrumentArg === 'all' 
    ? Object.values(keyboards)
    : [keyboards[instrumentArg]];
  
  for (const keyboard of instrumentsToUpload) {
    await uploadKeyboard(keyboard);
  }
  
  console.log('\n🎉 Upload complete!');
  
  // Display sample URLs
  console.log('\n📍 Sample URLs for testing:');
  console.log(`   Salamander C4: ${supabaseUrl}/storage/v1/object/public/audio-samples/Keyboards/salamander/v8/C4.mp3`);
  console.log(`   Wurlitzer C4: ${supabaseUrl}/storage/v1/object/public/audio-samples/Keyboards/wurlitzer/v3/C4.mp3`);
  console.log(`   Rhodes C4: ${supabaseUrl}/storage/v1/object/public/audio-samples/Keyboards/rhodes/v2/C4.mp3`);
  console.log(`   Long Pad C3: ${supabaseUrl}/storage/v1/object/public/audio-samples/Keyboards/longpad/C3.mp3`);
}

main().catch(console.error);