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
  '13. FILTER DOWN_Juno_C.mp3': 'C0.mp3',
  '14. FILTER DOWN_Juno_Cs.mp3': 'Cs0.mp3',
  '15. FILTER DOWN_Juno_D.mp3': 'D0.mp3',
  '16. FILTER DOWN_Juno_Ds.mp3': 'Ds0.mp3',
  '17. FILTER DOWN_Juno_E.mp3': 'E0.mp3',
  '18. FILTER DOWN_Juno_F.mp3': 'F0.mp3',
  '19. FILTER DOWN_Juno_Fs.mp3': 'Fs0.mp3',
  '20. FILTER DOWN_Juno_G.mp3': 'G0.mp3',
  '21. FILTER DOWN_Juno_Gs.mp3': 'Gs0.mp3',
  '22. FILTER DOWN_Juno_A.mp3': 'A0.mp3',
  '23. FILTER DOWN_Juno_As.mp3': 'As0.mp3',
  '24. FILTER DOWN_Juno_B.mp3': 'B0.mp3',
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

async function fixLongPadUpload() {
  console.log('🎹 Fixing Long Pad upload with renamed files...\n');
  
  const sourcePath = path.join(__dirname, '../apps/frontend/public/samples/long-pad-mp3');
  
  // First, let's check current files in Supabase
  console.log('📋 Checking current files in Supabase...');
  const { data: existingFiles, error: listError } = await supabase.storage
    .from('audio-samples')
    .list('Keyboards/longpad', {
      limit: 100,
      offset: 0
    });
    
  if (listError) {
    console.error('❌ Error listing files:', listError);
    return;
  }
  
  console.log(`Found ${existingFiles?.length || 0} existing files in Supabase`);
  
  // Delete old files with complex names
  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles
      .filter(file => file.name.includes('FILTER DOWN'))
      .map(file => `Keyboards/longpad/${file.name}`);
      
    if (filesToDelete.length > 0) {
      console.log(`\n🗑️  Deleting ${filesToDelete.length} old files with complex names...`);
      const { error: deleteError } = await supabase.storage
        .from('audio-samples')
        .remove(filesToDelete);
        
      if (deleteError) {
        console.error('❌ Error deleting old files:', deleteError);
      } else {
        console.log('✅ Old files deleted');
      }
    }
  }
  
  // Upload with new names
  console.log('\n📤 Uploading Long Pad samples with simple names...');
  
  let uploaded = 0;
  let failed = 0;
  
  for (const [oldName, newName] of Object.entries(longPadMapping)) {
    const sourcePath = path.join(__dirname, '../apps/frontend/public/samples/long-pad-mp3', oldName);
    const targetPath = `Keyboards/longpad/${newName}`;
    
    process.stdout.write(`\r   Uploading ${newName}...                    `);
    
    if (!fs.existsSync(sourcePath)) {
      console.error(`\n❌ File not found: ${sourcePath}`);
      failed++;
      continue;
    }
    
    try {
      const fileContent = fs.readFileSync(sourcePath);
      
      const { error } = await supabase.storage
        .from('audio-samples')
        .upload(targetPath, fileContent, {
          contentType: 'audio/mpeg',
          upsert: true
        });
        
      if (error) {
        console.error(`\n❌ Error uploading ${newName}:`, error.message);
        failed++;
      } else {
        uploaded++;
      }
    } catch (error) {
      console.error(`\n❌ Error reading/uploading ${oldName}:`, error.message);
      failed++;
    }
  }
  
  console.log(`\n\n✅ Uploaded: ${uploaded} files`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed} files`);
  }
  
  console.log('\n🎉 Long Pad fix complete!');
  console.log(`\n📍 Test URL: ${supabaseUrl}/storage/v1/object/public/audio-samples/Keyboards/longpad/C3.mp3`);
}

fixLongPadUpload().catch(console.error);