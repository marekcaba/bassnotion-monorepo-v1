#!/usr/bin/env node

/**
 * Direct download script for Hydrogen drum kits
 * Uses Node.js https module to handle SourceForge redirects
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../temp/hydrogen-direct-downloads');

// Ensure directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Direct download links for Hydrogen drum kits
// These are mirror links that work more reliably
const DIRECT_KITS = [
  {
    name: 'Classic-808',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Classic-808.h2drumkit?viasf=1',
    size: 434688
  },
  {
    name: 'TR808909',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/TR808909.h2drumkit?viasf=1',
    size: 2361344
  },
  {
    name: 'Boss_DR-110',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Boss_DR-110.h2drumkit?viasf=1',
    size: 205824
  },
  {
    name: 'YamahaVintageKit',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/YamahaVintageKit.h2drumkit?viasf=1',
    size: 5767168
  },
  {
    name: 'HipHop-1',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/HipHop-1.h2drumkit?viasf=1',
    size: 931840
  },
  {
    name: 'HipHop-2', 
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/HipHop-2.h2drumkit?viasf=1',
    size: 561152
  },
  {
    name: 'ElectricEmpireKit',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/ElectricEmpireKit.h2drumkit?viasf=1',
    size: 5308416
  },
  {
    name: 'K-27_Trash_Kit',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/K-27_Trash_Kit.h2drumkit?viasf=1',
    size: 1118208
  },
  {
    name: 'Techno-1',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Techno-1.h2drumkit?viasf=1',
    size: 2023424
  },
  {
    name: 'VariBreaks',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/VariBreaks.h2drumkit?viasf=1',
    size: 5066752
  },
  {
    name: 'DeathMetal',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/DeathMetal.h2drumkit?viasf=1',
    size: 2838528
  },
  {
    name: 'ColomboAcousticDrumkit',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/ColomboAcousticDrumkit.h2drumkit?viasf=1',
    size: 1548288
  },
  {
    name: 'Millo_MultiLayered3',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Millo_MultiLayered3.h2drumkit?viasf=1',
    size: 11010048
  },
  {
    name: 'Millo-Drums_v.1',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Millo-Drums_v.1.h2drumkit?viasf=1',
    size: 9502720
  },
  {
    name: 'Jazz_1',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Jazz_1.h2drumkit?viasf=1',
    size: 3452928
  },
  {
    name: 'Jazz_2',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Jazz_2.h2drumkit?viasf=1',
    size: 5263360
  },
  {
    name: 'Jazz_3',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Jazz_3.h2drumkit?viasf=1',
    size: 5595136
  },
  {
    name: 'Jazz_4',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Jazz_4.h2drumkit?viasf=1',
    size: 7847936
  },
  {
    name: 'Gimme A Hand 1.0',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Gimme%20A%20Hand%201.0.h2drumkit?viasf=1',
    size: 11730944
  },
  {
    name: 'Rubberband',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Rubberband.h2drumkit?viasf=1',
    size: 3268608
  },
  {
    name: 'ForzeeStereo',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/ForzeeStereo.h2drumkit?viasf=1',
    size: 136445952
  },
  {
    name: 'Dave Grohl',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/Dave%20Grohl.h2drumkit?viasf=1',
    size: 1261568
  },
  {
    name: 'John Bonham',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/John%20Bonham.h2drumkit?viasf=1',
    size: 983756
  },
  {
    name: 'BeatBuddy_Kit',
    url: 'https://master.dl.sourceforge.net/project/hydrogen/Sound%20Libraries/Main%20sound%20libraries/BeatBuddy_Kit.h2drumkit?viasf=1',
    size: 9227264
  }
];

// Download function
function downloadFile(kit) {
  return new Promise((resolve, reject) => {
    const filename = `${kit.name}.h2drumkit`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    // Skip if already downloaded
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      if (stats.size === kit.size) {
        console.log(`✓ Already downloaded: ${filename}`);
        return resolve(filepath);
      }
    }
    
    console.log(`⬇️  Downloading: ${kit.name} (${(kit.size / 1024 / 1024).toFixed(1)} MB)`);
    
    const file = fs.createWriteStream(filepath);
    let downloadedSize = 0;
    
    https.get(kit.url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          
          redirectResponse.on('data', (chunk) => {
            downloadedSize += chunk.length;
            const progress = ((downloadedSize / kit.size) * 100).toFixed(1);
            process.stdout.write(`\r  Progress: ${progress}%`);
          });
          
          redirectResponse.on('end', () => {
            file.close();
            console.log(`\n✓ Downloaded: ${filename}`);
            resolve(filepath);
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const progress = ((downloadedSize / kit.size) * 100).toFixed(1);
          process.stdout.write(`\r  Progress: ${progress}%`);
        });
        
        response.on('end', () => {
          file.close();
          console.log(`\n✓ Downloaded: ${filename}`);
          resolve(filepath);
        });
      }
    }).on('error', reject);
  });
}

// Main function
async function main() {
  console.log('🥁 Hydrogen Drum Kit Direct Downloader');
  console.log(`📊 Downloading ${DIRECT_KITS.length} drum kits\n`);
  
  const results = [];
  
  for (const kit of DIRECT_KITS) {
    try {
      const filepath = await downloadFile(kit);
      results.push({ ...kit, status: 'success', filepath });
    } catch (error) {
      console.error(`\n✗ Failed to download ${kit.name}:`, error.message);
      results.push({ ...kit, status: 'failed', error: error.message });
    }
  }
  
  // Summary
  console.log('\n\n📊 Summary:');
  console.log(`Total kits: ${DIRECT_KITS.length}`);
  console.log(`Successful: ${results.filter(r => r.status === 'success').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'failed').length}`);
  
  // Create index
  const index = {
    generated: new Date().toISOString(),
    kits: results.filter(r => r.status === 'success').map(r => ({
      name: r.name,
      file: `${r.name}.h2drumkit`,
      size: r.size,
      path: r.filepath
    }))
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'index.json'), 
    JSON.stringify(index, null, 2)
  );
  
  console.log('\n✅ Downloads complete!');
  console.log(`📁 Files saved to: ${OUTPUT_DIR}`);
  console.log('\n📋 Available kits for manual download:');
  console.log('Visit: https://sourceforge.net/projects/hydrogen/files/Sound%20Libraries/Main%20sound%20libraries/');
  console.log('\nMissing kits to download manually:');
  console.log('- The Black Pearl Kit.h2drumkit');
  console.log('- GMRockKit.h2drumkit');
  console.log('- Synthie-1.h2drumkit');
  console.log('- Ian Paice Drumkit.h2drumkit');
  console.log('- Ringo Starr Drumkit.h2drumkit');
  console.log('- Steve Gadd Drumkit.h2drumkit');
  console.log('- circAfrique v4.h2drumkit');
  console.log('- Big Mono.h2drumkit');
  console.log('- HardRock-1.h2drumkit');
  console.log('- oldschoolhiphop.h2drumkit');
  console.log('- TD-7.h2drumkit');
  console.log('- URBK01.h2drumkit');
  console.log('- BJA_Pacific.h2drumkit');
  console.log('- ES01.h2drumkit');
  console.log('- And Kurzweil kits');
}

// Run
main().catch(console.error);