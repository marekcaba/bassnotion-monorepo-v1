import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDrumSamples() {
  try {
    console.log('Checking drum samples in Supabase storage...\n');
    
    // First, list root directory
    console.log('Checking root directory:');
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from('audio-samples')
      .list('', {
        limit: 100,
        offset: 0
      });
      
    if (rootFiles && rootFiles.length > 0) {
      console.log('Root contents:');
      rootFiles.forEach(f => console.log(`  - ${f.name}`));
    }
    
    // Check drums directory
    console.log('\nChecking drums directory:');
    const { data: drumsFiles, error: drumsError } = await supabase.storage
      .from('audio-samples')
      .list('drums', {
        limit: 100,
        offset: 0
      });
      
    if (drumsFiles && drumsFiles.length > 0) {
      console.log('Drums contents:');
      drumsFiles.forEach(f => console.log(`  - ${f.name}`));
      
      // Check for GMRockKit in any subdirectory
      for (const item of drumsFiles) {
        if (item.name.includes('GMRockKit') || item.name === 'GMRockKit') {
          console.log(`\nFound GMRockKit in: drums/${item.name}`);
          
          // List contents
          const { data: kitFiles } = await supabase.storage
            .from('audio-samples')
            .list(`drums/${item.name}`, {
              limit: 100,
              offset: 0
            });
            
          if (kitFiles && kitFiles.length > 0) {
            console.log('GMRockKit files:');
            kitFiles.forEach(f => console.log(`  - ${f.name}`));
          }
        }
      }
    }
    
    // Check drums/hydrogen-kits
    console.log('\nChecking drums/hydrogen-kits directory:');
    const { data: hydrogenKits, error: hkError } = await supabase.storage
      .from('audio-samples')
      .list('drums/hydrogen-kits', {
        limit: 100,
        offset: 0
      });
      
    if (hydrogenKits && hydrogenKits.length > 0) {
      console.log('Hydrogen kits found:');
      hydrogenKits.forEach(f => console.log(`  - ${f.name}`));
      
      // Check mp3 subdirectory
      console.log('\nChecking drums/hydrogen-kits/mp3:');
      const { data: mp3Kits } = await supabase.storage
        .from('audio-samples')
        .list('drums/hydrogen-kits/mp3', {
          limit: 100,
          offset: 0
        });
        
      if (mp3Kits && mp3Kits.length > 0) {
        console.log('MP3 kits found:');
        mp3Kits.forEach(f => console.log(`  - ${f.name}`));
        
        // Check rock directory (GMRockKit would be in here)
        console.log('\nChecking drums/hydrogen-kits/mp3/rock:');
        const { data: rockFiles } = await supabase.storage
          .from('audio-samples')
          .list('drums/hydrogen-kits/mp3/rock', {
            limit: 100,
            offset: 0
          });
          
        if (rockFiles && rockFiles.length > 0) {
          console.log('Rock kit files found:');
          rockFiles.forEach(f => console.log(`  - ${f.name}`));
          
          // Find kick, snare, hihat files
          const kicks = rockFiles.filter(f => f.name.toLowerCase().includes('kick'));
          const snares = rockFiles.filter(f => f.name.toLowerCase().includes('snare'));
          const hihats = rockFiles.filter(f => 
            f.name.toLowerCase().includes('hh') || 
            f.name.toLowerCase().includes('hihat')
          );
          
          console.log('\nActual file names for DrummerWidget:');
          console.log('KICKS:', kicks.map(f => f.name).join(', '));
          console.log('SNARES:', snares.map(f => f.name).join(', '));
          console.log('HI-HATS:', hihats.map(f => f.name).join(', '));
          
          // Check inside dave-grohl directory
          console.log('\nChecking drums/hydrogen-kits/mp3/rock/dave-grohl:');
          const { data: groholFiles } = await supabase.storage
            .from('audio-samples')
            .list('drums/hydrogen-kits/mp3/rock/dave-grohl', {
              limit: 100,
              offset: 0
            });
            
          if (groholFiles && groholFiles.length > 0) {
            console.log('Dave Grohl kit files:');
            groholFiles.forEach(f => console.log(`  - ${f.name}`));
            
            const dgKicks = groholFiles.filter(f => f.name.toLowerCase().includes('kick'));
            const dgSnares = groholFiles.filter(f => f.name.toLowerCase().includes('snare'));
            const dgHihats = groholFiles.filter(f => 
              f.name.toLowerCase().includes('hh') || 
              f.name.toLowerCase().includes('hihat')
            );
            
            console.log('\nDave Grohl kit mappings:');
            console.log('KICKS:', dgKicks.map(f => f.name).join(', '));
            console.log('SNARES:', dgSnares.map(f => f.name).join(', '));
            console.log('HI-HATS:', dgHihats.map(f => f.name).join(', '));
            
            console.log('\n\nCORRECT PATH for DrummerWidget:');
            console.log(`currentKitPath should be: 'drums/hydrogen-kits/mp3/rock/dave-grohl'`);
            console.log('\nExample file URLs:');
            if (dgKicks[0]) {
              console.log(`Kick: ${process.env.SUPABASE_URL}/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/rock/dave-grohl/${dgKicks[0].name}`);
            }
          }
        }
      }
    }
    
    // Also check the original path that the widget is trying to use
    console.log('\n\nChecking the path the widget uses: hydrogen-kits/mp3/GMRockKit');
    const { data: files, error } = await supabase.storage
      .from('audio-samples')
      .list('hydrogen-kits/mp3/GMRockKit', {
        limit: 100,
        offset: 0
      });
      
    if (error) {
      console.error('Error listing files:', error);
      return;
    }
    
    console.log(`Found ${files?.length || 0} files in GMRockKit:\n`);
    
    // Sort and display files
    if (files && files.length > 0) {
      const sortedFiles = files.sort((a, b) => a.name.localeCompare(b.name));
      
      // Group by drum type
      const kicks = sortedFiles.filter(f => f.name.toLowerCase().includes('kick'));
      const snares = sortedFiles.filter(f => f.name.toLowerCase().includes('snare'));
      const hihats = sortedFiles.filter(f => 
        f.name.toLowerCase().includes('hh') || 
        f.name.toLowerCase().includes('hihat')
      );
      const others = sortedFiles.filter(f => 
        !f.name.toLowerCase().includes('kick') &&
        !f.name.toLowerCase().includes('snare') &&
        !f.name.toLowerCase().includes('hh') &&
        !f.name.toLowerCase().includes('hihat')
      );
      
      console.log('KICKS:');
      kicks.forEach(f => console.log(`  - ${f.name}`));
      
      console.log('\nSNARES:');
      snares.forEach(f => console.log(`  - ${f.name}`));
      
      console.log('\nHI-HATS:');
      hihats.forEach(f => console.log(`  - ${f.name}`));
      
      console.log('\nOTHERS:');
      others.forEach(f => console.log(`  - ${f.name}`));
      
      // Check for the specific files that are failing
      console.log('\n\nChecking for specific files that failed:');
      const checkFiles = ['kick_Rockit1.mp3', 'snare_Rockit1.mp3', 'hhc_Rockit.mp3'];
      
      for (const fileName of checkFiles) {
        const exists = files.some(f => f.name === fileName);
        console.log(`${fileName}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
        
        // Find similar files
        if (!exists) {
          const similar = files.filter(f => 
            f.name.toLowerCase().includes(fileName.split('_')[0].toLowerCase())
          );
          if (similar.length > 0) {
            console.log(`  Similar files: ${similar.map(f => f.name).join(', ')}`);
          }
        }
      }
      
      // Generate correct file mappings
      console.log('\n\nSuggested file mappings for DrummerWidget:');
      const kickFile = kicks[0]?.name || 'kick.mp3';
      const snareFile = snares[0]?.name || 'snare.mp3';
      const hihatFile = hihats[0]?.name || 'hihat.mp3';
      
      console.log(`variations.kick = ['${kickFile}'${kicks[1] ? `, '${kicks[1].name}'` : ''}];`);
      console.log(`variations.snare = ['${snareFile}'${snares[1] ? `, '${snares[1].name}'` : ''}];`);
      console.log(`variations.hihat = ['${hihatFile}'${hihats[1] ? `, '${hihats[1].name}'` : ''}];`);
      
    } else {
      console.log('No files found in GMRockKit directory');
      
      // Try listing parent directory
      console.log('\nChecking parent directory hydrogen-kits/mp3/...');
      const { data: parentFiles } = await supabase.storage
        .from('audio-samples')
        .list('hydrogen-kits/mp3', {
          limit: 100,
          offset: 0
        });
        
      if (parentFiles && parentFiles.length > 0) {
        console.log('Found directories:');
        parentFiles.forEach(f => console.log(`  - ${f.name}`));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDrumSamples();