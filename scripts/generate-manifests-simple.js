#!/usr/bin/env node

/**
 * Simple manifest generator - analyzes existing files and creates mappings
 * No renaming needed!
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../apps/backend/.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Simple pattern matching for common drum types
const PATTERNS = {
  kick: /kick|bass.?drum|bd|kik|kk|bombo/i,
  snare: /snare|sn(?!ap)|sd|snr|caixa/i,
  'hihat-closed':
    /closed.*h(i.?)?hat|h(i.?)?hat.*closed|hhc|chh|c.?hh|hat.*cl/i,
  'hihat-open': /open.*h(i.?)?hat|h(i.?)?hat.*open|hho|ohh|o.?hh|hat.*op/i,
  crash: /crash|crsh|cr(?!ack)/i,
  ride: /ride|rd/i,
  'tom-high': /high.*tom|tom.*high|tom.*1|ht|t1/i,
  'tom-mid': /mid.*tom|tom.*mid|tom.*2|mt|t2/i,
  'tom-low': /low.*tom|tom.*low|tom.*3|lt|t3|floor.*tom|ft/i,
  clap: /clap|clp|cp|palma/i,
  cowbell: /cow.?bell|cb|campana/i,
  rimshot: /rim.?shot|rim|rs/i,
};

async function analyzeKit(category, kitId) {
  console.log(`\n🥁 Analyzing ${category}/${kitId}...`);

  // List all files in the kit
  const { data: files, error } = await supabase.storage
    .from('audio-samples')
    .list(`drums/hydrogen-kits/mp3/${category}/${kitId}`);

  if (error || !files) {
    console.error(`  ❌ Error listing files:`, error);
    return null;
  }

  // Filter audio files
  const audioFiles = files.filter((f) => f.name && f.name.endsWith('.mp3'));
  console.log(`  Found ${audioFiles.length} samples`);

  // Create mapping
  const mapping = {};
  const unmapped = [];

  for (const file of audioFiles) {
    let mapped = false;

    // Try to match against patterns
    for (const [drumType, pattern] of Object.entries(PATTERNS)) {
      if (file.name.match(pattern)) {
        if (!mapping[drumType]) {
          mapping[drumType] = [];
        }

        // Extract velocity hint from filename
        let velocity = 2; // default medium
        if (file.name.match(/soft|low|p|1/i)) velocity = 1;
        else if (file.name.match(/hard|high|f|3/i)) velocity = 3;

        mapping[drumType].push({
          file: file.name,
          velocity: velocity,
        });

        mapped = true;
        break;
      }
    }

    if (!mapped) {
      unmapped.push(file.name);
    }
  }

  // Sort by velocity
  for (const drumType in mapping) {
    mapping[drumType].sort((a, b) => a.velocity - b.velocity);
  }

  // Create manifest
  const manifest = {
    id: kitId,
    name: kitId.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    category: category,
    version: '1.0',
    generated: new Date().toISOString(),
    mapping: mapping,
    unmapped: unmapped,
    stats: {
      total: audioFiles.length,
      mapped: audioFiles.length - unmapped.length,
      coverage:
        (
          ((audioFiles.length - unmapped.length) / audioFiles.length) *
          100
        ).toFixed(1) + '%',
    },
  };

  console.log(
    `  ✓ Mapped ${manifest.stats.mapped}/${manifest.stats.total} samples (${manifest.stats.coverage})`,
  );

  if (unmapped.length > 0) {
    console.log(
      `  ⚠️  Unmapped: ${unmapped.slice(0, 5).join(', ')}${unmapped.length > 5 ? '...' : ''}`,
    );
  }

  return manifest;
}

async function main() {
  console.log('🎯 Generating Drum Kit Manifests');
  console.log('================================');
  console.log('This will analyze filenames and create mappings.');
  console.log('No files will be renamed!\n');

  const categories = [
    'electronic',
    'acoustic',
    'hip-hop',
    'rock',
    'metal',
    'jazz',
  ];
  const allManifests = [];

  for (const category of categories) {
    // List kits in category
    const { data: kits } = await supabase.storage
      .from('audio-samples')
      .list(`drums/hydrogen-kits/mp3/${category}`);

    if (!kits) continue;

    for (const kit of kits) {
      if (kit.id) {
        // It's a directory
        const manifest = await analyzeKit(category, kit.name);

        if (manifest) {
          allManifests.push(manifest);

          // Upload manifest
          const { error } = await supabase.storage
            .from('audio-samples')
            .upload(
              `drums/hydrogen-kits/mp3/${category}/${kit.name}/manifest.json`,
              JSON.stringify(manifest, null, 2),
              { contentType: 'application/json', upsert: true },
            );

          if (error) {
            console.error(`  ❌ Failed to upload manifest:`, error.message);
          }
        }
      }
    }
  }

  // Create master index
  console.log('\n📋 Creating master index...');

  const masterIndex = {
    version: '1.0',
    generated: new Date().toISOString(),
    kits: allManifests.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      samples: m.stats.total,
      coverage: m.stats.coverage,
      path: `drums/hydrogen-kits/mp3/${m.category}/${m.id}/`,
    })),
    stats: {
      totalKits: allManifests.length,
      totalSamples: allManifests.reduce((sum, m) => sum + m.stats.total, 0),
      avgCoverage:
        (
          allManifests.reduce(
            (sum, m) => sum + parseFloat(m.stats.coverage),
            0,
          ) / allManifests.length
        ).toFixed(1) + '%',
    },
  };

  // Upload master index
  await supabase.storage
    .from('audio-samples')
    .upload(
      'drums/hydrogen-kits/manifests.json',
      JSON.stringify(masterIndex, null, 2),
      { contentType: 'application/json', upsert: true },
    );

  console.log('\n✅ Complete!');
  console.log(`Generated manifests for ${allManifests.length} kits`);
  console.log(`Average mapping coverage: ${masterIndex.stats.avgCoverage}`);

  console.log('\n🎯 How to use in your app:');
  console.log('```typescript');
  console.log('// Load manifest');
  console.log(
    "const manifest = await fetch('...drums/hydrogen-kits/mp3/electronic/classic-808/manifest.json')",
  );
  console.log('');
  console.log("// Get kick samples (whatever they're named)");
  console.log('const kicks = manifest.mapping.kick;');
  console.log(
    '// Plays: bd-01.mp3, bassdrum.mp3, or whatever the file is named',
  );
  console.log('```');
}

main().catch(console.error);
