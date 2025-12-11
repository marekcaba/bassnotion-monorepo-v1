#!/usr/bin/env node

/**
 * Script to download ALL Hydrogen drum kits from SourceForge
 * Total: 40 drum kits (~322 MB)
 *
 * License: All Hydrogen main sound libraries are under GPL2/GPL/CC license
 * allowing commercial use.
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory structure
const TEMP_DIR = path.join(__dirname, '../temp/hydrogen-kits-full');
const OUTPUT_DIR = path.join(__dirname, '../temp/hydrogen-processed');
const METADATA_FILE = path.join(OUTPUT_DIR, 'complete-index.json');

// Complete list of ALL Hydrogen drum kits from SourceForge
const ALL_HYDROGEN_KITS = [
  // Electronic & Techno Kits
  {
    id: 'classic-808',
    name: 'Classic TR-808 Kit',
    file: 'Classic-808.h2drumkit',
    size: 434688,
    category: 'electronic',
  },
  {
    id: 'tr808909',
    name: 'TR-808/909 Hybrid Kit',
    file: 'TR808909.h2drumkit',
    size: 2361344,
    category: 'electronic',
  },
  {
    id: 'boss-dr110',
    name: 'Boss DR-110',
    file: 'Boss_DR-110.h2drumkit',
    size: 205824,
    category: 'electronic',
  },
  {
    id: 'techno-1',
    name: 'Techno Kit 1',
    file: 'Techno-1.h2drumkit',
    size: 2023424,
    category: 'electronic',
  },
  {
    id: 'electric-empire',
    name: 'Electric Empire Kit',
    file: 'ElectricEmpireKit.h2drumkit',
    size: 5308416,
    category: 'electronic',
  },
  {
    id: 'k-27-trash',
    name: 'K-27 Trash Kit',
    file: 'K-27_Trash_Kit.h2drumkit',
    size: 1118208,
    category: 'electronic',
  },
  {
    id: 'varibreaks',
    name: 'VariBreaks',
    file: 'VariBreaks.h2drumkit',
    size: 5066752,
    category: 'electronic',
  },
  {
    id: 'the-black-pearl',
    name: 'The Black Pearl Kit',
    file: 'The Black Pearl Kit.h2drumkit',
    size: 1175552,
    category: 'electronic',
  },
  {
    id: 'death-metal',
    name: 'Death Metal Kit',
    file: 'DeathMetal.h2drumkit',
    size: 2838528,
    category: 'metal',
  },
  {
    id: 'metal-1',
    name: 'Metal Kit 1',
    file: 'Synthie-1.h2drumkit',
    size: 1863680,
    category: 'metal',
  },

  // Acoustic & Rock Kits
  {
    id: 'yamaha-vintage',
    name: 'Yamaha Vintage Kit',
    file: 'YamahaVintageKit.h2drumkit',
    size: 5767168,
    category: 'acoustic',
  },
  {
    id: 'colombia-acoustic',
    name: 'Colombia Acoustic Kit',
    file: 'ColomboAcousticDrumkit.h2drumkit',
    size: 1548288,
    category: 'acoustic',
  },
  {
    id: 'gm-kit',
    name: 'GM Kit',
    file: 'GMRockKit.h2drumkit',
    size: 1482752,
    category: 'rock',
  },
  {
    id: 'millo-multichannel',
    name: 'Millo Multi-Channel Kit',
    file: 'Millo_MultiLayered3.h2drumkit',
    size: 11010048,
    category: 'acoustic',
  },
  {
    id: 'millo-multilayered',
    name: 'Millo Multi-Layered Kit',
    file: 'Millo-Drums_v.1.h2drumkit',
    size: 9502720,
    category: 'acoustic',
  },
  {
    id: 'forzee-stereo',
    name: 'Forzee Stereo Kit',
    file: 'ForzeeStereo.h2drumkit',
    size: 136445952,
    category: 'acoustic',
  },
  {
    id: 'rubberband',
    name: 'Rubberband Kit',
    file: 'Rubberband.h2drumkit',
    size: 3268608,
    category: 'acoustic',
  },
  {
    id: 'gimme-jazz',
    name: 'Gimme That Jazz Kit',
    file: 'Gimme A Hand 1.0.h2drumkit',
    size: 11730944,
    category: 'jazz',
  },
  {
    id: 'jazz-1',
    name: 'Jazz Kit 1',
    file: 'Jazz_1.h2drumkit',
    size: 3452928,
    category: 'jazz',
  },
  {
    id: 'jazz-2',
    name: 'Jazz Kit 2',
    file: 'Jazz_2.h2drumkit',
    size: 5263360,
    category: 'jazz',
  },
  {
    id: 'jazz-3',
    name: 'Jazz Kit 3',
    file: 'Jazz_3.h2drumkit',
    size: 5595136,
    category: 'jazz',
  },
  {
    id: 'jazz-4',
    name: 'Jazz Kit 4',
    file: 'Jazz_4.h2drumkit',
    size: 7847936,
    category: 'jazz',
  },

  // Hip-Hop & Urban Kits
  {
    id: 'hip-hop-1',
    name: 'Hip-Hop Kit 1',
    file: 'HipHop-1.h2drumkit',
    size: 931840,
    category: 'hip-hop',
  },
  {
    id: 'hip-hop-2',
    name: 'Hip-Hop Kit 2',
    file: 'HipHop-2.h2drumkit',
    size: 561152,
    category: 'hip-hop',
  },
  {
    id: 'oldschool-hip-hop',
    name: 'Old School Hip-Hop',
    file: 'oldschoolhiphop.h2drumkit',
    size: 3035136,
    category: 'hip-hop',
  },
  {
    id: 'beatbuddy',
    name: 'BeatBuddy Kit',
    file: 'BeatBuddy_Kit.h2drumkit',
    size: 9227264,
    category: 'hip-hop',
  },

  // Signature Artist Kits
  {
    id: 'dave-grohl',
    name: 'Dave Grohl Kit',
    file: 'Dave Grohl.h2drumkit',
    size: 1261568,
    category: 'rock',
  },
  {
    id: 'john-bonham',
    name: 'John Bonham Kit',
    file: 'John Bonham.h2drumkit',
    size: 983756,
    category: 'rock',
  },
  {
    id: 'ian-paice',
    name: 'Ian Paice Drumkit',
    file: 'Ian Paice Drumkit.h2drumkit',
    size: 2535424,
    category: 'rock',
  },
  {
    id: 'ringo-starr',
    name: 'Ringo Starr Drumkit',
    file: 'Ringo Starr Drumkit.h2drumkit',
    size: 2158592,
    category: 'rock',
  },
  {
    id: 'steve-gadd',
    name: 'Steve Gadd Drumkit',
    file: 'Steve Gadd Drumkit.h2drumkit',
    size: 1753088,
    category: 'jazz',
  },

  // Latin & World Kits
  {
    id: 'circaflex',
    name: 'Circaflex Kit',
    file: 'circAfrique v4.h2drumkit',
    size: 6606848,
    category: 'world',
  },
  {
    id: 'big-mono',
    name: 'Big Mono Kit',
    file: 'Big Mono.h2drumkit',
    size: 3850240,
    category: 'vintage',
  },
  {
    id: 'hard-rock',
    name: 'Hard Rock Kit',
    file: 'HardRock-1.h2drumkit',
    size: 6488064,
    category: 'rock',
  },
  {
    id: 'kurzweil-acoustic',
    name: 'Kurzweil Acoustic Kit',
    file: 'Kurzweil_K2600R__Drumkit__AcousticDrums_1.h2drumkit',
    size: 7872512,
    category: 'acoustic',
  },
  {
    id: 'kurzweil-pure',
    name: 'Kurzweil Pure Kit',
    file: 'Kurzweil_K2600R__Drumkit__PureDrums.h2drumkit',
    size: 8998912,
    category: 'acoustic',
  },
  {
    id: 'roland-td7',
    name: 'Roland TD-7 Kit',
    file: 'TD-7.h2drumkit',
    size: 4038656,
    category: 'electronic',
  },
  {
    id: 'urban808',
    name: 'Urban 808 Kit',
    file: 'URBK01.h2drumkit',
    size: 7147520,
    category: 'urban',
  },
  {
    id: 'bjorklund',
    name: 'Bjorklund Kit',
    file: 'BJA_Pacific.h2drumkit',
    size: 9428992,
    category: 'experimental',
  },
  {
    id: 'es-01',
    name: 'ES-01 Kit',
    file: 'ES01.h2drumkit',
    size: 4567040,
    category: 'experimental',
  },
];

// Ensure directories exist
function ensureDirectories() {
  [TEMP_DIR, OUTPUT_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Download a file with proper redirect handling
async function downloadFile(kit) {
  const url = `https://sourceforge.net/projects/hydrogen/files/Sound%20Libraries/Main%20sound%20libraries/${encodeURIComponent(kit.file)}/download`;
  const filepath = path.join(TEMP_DIR, kit.file);

  // Skip if already downloaded with correct size
  if (fs.existsSync(filepath)) {
    const stats = fs.statSync(filepath);
    // Check if file size is reasonable (at least 100KB for a drum kit)
    if (stats.size > 100000) {
      console.log(`✓ Already downloaded: ${kit.file}`);
      return filepath;
    } else {
      // Remove invalid file
      fs.unlinkSync(filepath);
      console.log(
        `⚠️  Removing invalid download: ${kit.file} (${stats.size} bytes)`,
      );
    }
  }

  try {
    console.log(
      `⬇️  Downloading: ${kit.name} (${(kit.size / 1024 / 1024).toFixed(1)} MB)`,
    );
    // Use wget with user agent to handle SourceForge redirects better
    await execAsync(
      `wget --user-agent="Mozilla/5.0" -O "${filepath}" "${url}"`,
    );

    // Verify download
    const stats = fs.statSync(filepath);
    if (stats.size < 100000) {
      throw new Error(`Download too small: ${stats.size} bytes`);
    }

    console.log(`✓ Downloaded: ${kit.file}`);
    return filepath;
  } catch (error) {
    // Try alternative download method
    try {
      console.log(`⚠️  Retrying with curl...`);
      await execAsync(
        `curl -L -H "User-Agent: Mozilla/5.0" -o "${filepath}" "${url}"`,
      );

      const stats = fs.statSync(filepath);
      if (stats.size < 100000) {
        throw new Error(`Download too small: ${stats.size} bytes`);
      }

      console.log(`✓ Downloaded: ${kit.file}`);
      return filepath;
    } catch (retryError) {
      console.error(`✗ Failed to download ${kit.name}:`, error.message);
      throw error;
    }
  }
}

// Extract H2 drumkit
async function extractDrumkit(filepath, outputDir) {
  try {
    await execAsync(`tar -xzf "${filepath}" -C "${outputDir}"`);
    console.log(`✓ Extracted: ${path.basename(filepath)}`);
  } catch (error) {
    console.error(`✗ Failed to extract ${filepath}:`, error);
    throw error;
  }
}

// Convert samples to web-friendly format
async function convertSamples(kitDir, kit) {
  const outputKitDir = path.join(OUTPUT_DIR, kit.category, kit.id);

  // Create output directory
  if (!fs.existsSync(outputKitDir)) {
    fs.mkdirSync(outputKitDir, { recursive: true });
  }

  // Find the actual kit directory (sometimes nested)
  let actualKitDir = kitDir;
  const subdirs = fs
    .readdirSync(kitDir)
    .filter((item) => fs.statSync(path.join(kitDir, item)).isDirectory());

  if (subdirs.length > 0) {
    const nestedPath = path.join(kitDir, subdirs[0]);
    if (fs.existsSync(path.join(nestedPath, 'drumkit.xml'))) {
      actualKitDir = nestedPath;
    }
  }

  // Copy drumkit.xml for metadata
  const drumkitXml = path.join(actualKitDir, 'drumkit.xml');
  if (fs.existsSync(drumkitXml)) {
    fs.copyFileSync(drumkitXml, path.join(outputKitDir, 'drumkit.xml'));
  }

  // Find and convert samples
  const samples = fs
    .readdirSync(actualKitDir)
    .filter(
      (f) => f.endsWith('.wav') || f.endsWith('.flac') || f.endsWith('.ogg'),
    );

  let convertedCount = 0;

  for (const sample of samples) {
    const samplePath = path.join(actualKitDir, sample);
    const outputPath = path.join(
      outputKitDir,
      sample.replace(/\.(wav|flac|ogg)$/, '.wav'),
    );

    // Skip if already converted
    if (fs.existsSync(outputPath)) {
      convertedCount++;
      continue;
    }

    try {
      // Convert to 16-bit 44.1kHz WAV for web compatibility
      await execAsync(
        `ffmpeg -i "${samplePath}" -acodec pcm_s16le -ar 44100 "${outputPath}" -y`,
      );
      convertedCount++;
    } catch (error) {
      console.error(`✗ Failed to convert ${sample}:`, error.message);
    }
  }

  console.log(
    `✓ Converted ${convertedCount}/${samples.length} samples for ${kit.name}`,
  );
  return convertedCount;
}

// Process a drum kit
async function processDrumKit(kit) {
  console.log(`\n📦 Processing: ${kit.name}`);

  const downloadPath = path.join(TEMP_DIR, kit.file);
  const extractPath = path.join(TEMP_DIR, kit.id);

  try {
    // Download
    await downloadFile(kit);

    // Extract
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath);
    }
    await extractDrumkit(downloadPath, extractPath);

    // Convert samples
    const sampleCount = await convertSamples(extractPath, kit);

    return {
      ...kit,
      status: 'success',
      sampleCount,
    };
  } catch (error) {
    console.error(`✗ Failed to process ${kit.name}:`, error);
    return {
      ...kit,
      status: 'failed',
      error: error.message,
    };
  }
}

// Generate comprehensive metadata
function generateMetadata(results) {
  const metadata = {
    generated: new Date().toISOString(),
    totalKits: ALL_HYDROGEN_KITS.length,
    totalSize: ALL_HYDROGEN_KITS.reduce((sum, kit) => sum + kit.size, 0),
    categories: {},
    kits: [],
  };

  // Group by category
  results.forEach((kit) => {
    if (kit.status === 'success') {
      if (!metadata.categories[kit.category]) {
        metadata.categories[kit.category] = {
          count: 0,
          kits: [],
        };
      }

      metadata.categories[kit.category].count++;
      metadata.categories[kit.category].kits.push(kit.id);

      metadata.kits.push({
        id: kit.id,
        name: kit.name,
        category: kit.category,
        file: kit.file,
        size: kit.size,
        sampleCount: kit.sampleCount,
        path: `${kit.category}/${kit.id}/`,
      });
    }
  });

  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
  console.log(`\n✓ Generated metadata: ${METADATA_FILE}`);
}

// Main function
async function main() {
  console.log('🥁 Hydrogen Complete Drum Kit Collection Downloader');
  console.log(`📊 Total kits to download: ${ALL_HYDROGEN_KITS.length}`);
  console.log(
    `💾 Total size: ${(ALL_HYDROGEN_KITS.reduce((sum, kit) => sum + kit.size, 0) / 1024 / 1024).toFixed(1)} MB\n`,
  );

  // Check if ffmpeg is installed
  try {
    await execAsync('ffmpeg -version');
  } catch (error) {
    console.error(
      'Error: ffmpeg is required but not found. Please install ffmpeg first.',
    );
    console.error('macOS: brew install ffmpeg');
    console.error('Ubuntu: sudo apt install ffmpeg');
    process.exit(1);
  }

  ensureDirectories();

  const results = [];

  // Process kits in batches to avoid overwhelming the system
  const BATCH_SIZE = 5;

  for (let i = 0; i < ALL_HYDROGEN_KITS.length; i += BATCH_SIZE) {
    const batch = ALL_HYDROGEN_KITS.slice(i, i + BATCH_SIZE);
    console.log(
      `\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(ALL_HYDROGEN_KITS.length / BATCH_SIZE)}`,
    );

    const batchResults = await Promise.all(
      batch.map((kit) => processDrumKit(kit)),
    );

    results.push(...batchResults);
  }

  generateMetadata(results);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`Total kits: ${ALL_HYDROGEN_KITS.length}`);
  console.log(
    `Successful: ${results.filter((r) => r.status === 'success').length}`,
  );
  console.log(`Failed: ${results.filter((r) => r.status === 'failed').length}`);

  console.log('\n✅ Done! Drum kits are ready in:', OUTPUT_DIR);
  console.log('\nNext steps:');
  console.log('1. Review the converted samples');
  console.log('2. Run the upload script to push to Supabase');
  console.log('3. Update the DrumInstrumentProcessor to use the new kits');
}

// Run the script
main().catch(console.error);
