#!/usr/bin/env node

/**
 * Generate drum kit manifests based on common Hydrogen naming patterns
 * FAANG-style solution for drum type mapping
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../apps/backend/.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Standard drum types for our platform
const DRUM_TYPES = {
  KICK: 'kick',
  SNARE: 'snare',
  HIHAT_CLOSED: 'hihat-closed',
  HIHAT_OPEN: 'hihat-open',
  HIHAT_PEDAL: 'hihat-pedal',
  TOM_HIGH: 'tom-high',
  TOM_MID: 'tom-mid',
  TOM_LOW: 'tom-low',
  TOM_FLOOR: 'tom-floor',
  CRASH: 'crash',
  CRASH_2: 'crash-2',
  RIDE: 'ride',
  RIDE_BELL: 'ride-bell',
  SPLASH: 'splash',
  CHINA: 'china',
  COWBELL: 'cowbell',
  CLAP: 'clap',
  TAMBOURINE: 'tambourine',
  SHAKER: 'shaker',
  RIMSHOT: 'rimshot',
  SIDESTICK: 'sidestick',
  PERCUSSION: 'percussion', // fallback
};

// Pattern matching rules (order matters - most specific first)
const PATTERN_RULES = [
  // Hihat patterns (must come before general 'hat' patterns)
  {
    type: DRUM_TYPES.HIHAT_CLOSED,
    patterns: [
      /closed[\s-_]*h(i)?[\s-_]*hat/i,
      /h(i)?[\s-_]*hat[\s-_]*closed/i,
      /hhc/i,
      /chh/i,
      /c[\s-_]*hh/i,
      /hihat(?!.*open)(?!.*pedal)/i, // hihat but not open or pedal
    ],
  },
  {
    type: DRUM_TYPES.HIHAT_OPEN,
    patterns: [
      /open[\s-_]*h(i)?[\s-_]*hat/i,
      /h(i)?[\s-_]*hat[\s-_]*open/i,
      /hho/i,
      /ohh/i,
      /o[\s-_]*hh/i,
    ],
  },
  {
    type: DRUM_TYPES.HIHAT_PEDAL,
    patterns: [/pedal/i, /foot[\s-_]*hat/i, /hhp/i],
  },

  // Kick patterns
  {
    type: DRUM_TYPES.KICK,
    patterns: [
      /kick/i,
      /bass[\s-_]*drum/i,
      /bassdrum/i,
      /\bbd\b/i,
      /\bb\.?d\.?\b/i,
      /kik/i,
      /\bkk\b/i,
    ],
  },

  // Snare patterns
  {
    type: DRUM_TYPES.SNARE,
    patterns: [/snare/i, /\bsn\b/i, /\bsd\b/i, /snr/i],
  },

  // Tom patterns
  {
    type: DRUM_TYPES.TOM_HIGH,
    patterns: [
      /high[\s-_]*tom/i,
      /tom[\s-_]*high/i,
      /tom[\s-_]*1/i,
      /\bht\b/i,
      /\bt1\b/i,
    ],
  },
  {
    type: DRUM_TYPES.TOM_MID,
    patterns: [
      /mid[\s-_]*tom/i,
      /tom[\s-_]*mid/i,
      /tom[\s-_]*2/i,
      /\bmt\b/i,
      /\bt2\b/i,
    ],
  },
  {
    type: DRUM_TYPES.TOM_LOW,
    patterns: [
      /low[\s-_]*tom/i,
      /tom[\s-_]*low/i,
      /tom[\s-_]*3/i,
      /\blt\b/i,
      /\bt3\b/i,
    ],
  },
  { type: DRUM_TYPES.TOM_FLOOR, patterns: [/floor[\s-_]*tom/i, /\bft\b/i] },

  // Cymbal patterns
  { type: DRUM_TYPES.CRASH_2, patterns: [/crash[\s-_]*2/i] },
  { type: DRUM_TYPES.CRASH, patterns: [/crash/i, /crsh/i, /\bcr\b/i] },
  { type: DRUM_TYPES.RIDE_BELL, patterns: [/bell/i, /ride[\s-_]*bell/i] },
  { type: DRUM_TYPES.RIDE, patterns: [/ride/i, /\brd\b/i] },
  { type: DRUM_TYPES.SPLASH, patterns: [/splash/i, /splsh/i] },
  { type: DRUM_TYPES.CHINA, patterns: [/china/i, /chn/i] },

  // Percussion patterns
  { type: DRUM_TYPES.COWBELL, patterns: [/cow[\s-_]*bell/i, /\bcb\b/i] },
  { type: DRUM_TYPES.CLAP, patterns: [/clap/i, /clp/i, /\bcp\b/i] },
  { type: DRUM_TYPES.TAMBOURINE, patterns: [/tamb/i, /tmb/i] },
  { type: DRUM_TYPES.SHAKER, patterns: [/shak/i, /shk/i] },
  { type: DRUM_TYPES.RIMSHOT, patterns: [/rim/i, /\brs\b/i] },
  { type: DRUM_TYPES.SIDESTICK, patterns: [/stick/i, /\bss\b/i] },
];

// Extract velocity from filename
function extractVelocity(filename) {
  // Check for velocity indicators
  const velocityMatch = filename.match(/v?(\d+)|soft|low|med|hard|high/i);

  if (velocityMatch) {
    if (velocityMatch[1]) {
      const v = parseInt(velocityMatch[1]);
      // Normalize to 1-3 range
      if (v <= 40) return 1;
      if (v <= 80) return 2;
      return 3;
    }
    if (/soft|low/i.test(velocityMatch[0])) return 1;
    if (/med/i.test(velocityMatch[0])) return 2;
    if (/hard|high/i.test(velocityMatch[0])) return 3;
  }

  return 2; // default medium
}

// Map a sample filename to drum type
function mapSampleToDrumType(filename) {
  const name = filename.toLowerCase();

  for (const rule of PATTERN_RULES) {
    for (const pattern of rule.patterns) {
      if (name.match(pattern)) {
        return {
          type: rule.type,
          velocity: extractVelocity(name),
          confidence: 0.9,
        };
      }
    }
  }

  // Fallback for unmapped samples
  return {
    type: DRUM_TYPES.PERCUSSION,
    velocity: 2,
    confidence: 0.3,
  };
}

// Kit configurations with expected drum types
const KIT_CONFIGS = {
  // Electronic kits
  'classic-808': {
    name: 'Classic TR-808',
    style: 'electronic',
    expectedDrums: [
      'kick',
      'snare',
      'hihat-closed',
      'hihat-open',
      'clap',
      'cowbell',
    ],
  },
  tr808909: {
    name: 'TR-808/909 Hybrid',
    style: 'electronic',
    expectedDrums: [
      'kick',
      'snare',
      'hihat-closed',
      'hihat-open',
      'crash',
      'ride',
    ],
  },
  'boss-dr110': {
    name: 'Boss DR-110',
    style: 'electronic',
    expectedDrums: ['kick', 'snare', 'hihat-closed', 'hihat-open'],
  },

  // Acoustic kits
  'yamaha-vintage': {
    name: 'Yamaha Vintage Kit',
    style: 'acoustic',
    expectedDrums: [
      'kick',
      'snare',
      'hihat-closed',
      'hihat-open',
      'tom-high',
      'tom-low',
      'crash',
      'ride',
    ],
  },
  'colombo-acoustic': {
    name: 'Colombo Acoustic',
    style: 'acoustic',
    expectedDrums: [
      'kick',
      'snare',
      'hihat-closed',
      'hihat-open',
      'tom-high',
      'tom-mid',
      'tom-low',
      'crash',
      'ride',
    ],
  },

  // Hip-hop kits
  'hip-hop-1': {
    name: 'Hip-Hop Kit 1',
    style: 'hip-hop',
    expectedDrums: ['kick', 'snare', 'hihat-closed', 'hihat-open', 'clap'],
  },

  // Rock kits
  'dave-grohl': {
    name: 'Dave Grohl Kit',
    style: 'rock',
    expectedDrums: [
      'kick',
      'snare',
      'hihat-closed',
      'hihat-open',
      'tom-high',
      'tom-mid',
      'tom-low',
      'crash',
      'crash-2',
      'ride',
    ],
  },

  // Default for unknown kits
  default: {
    name: 'Unknown Kit',
    style: 'unknown',
    expectedDrums: ['kick', 'snare', 'hihat-closed'],
  },
};

// Generate manifest for a kit
async function generateKitManifest(kitId, category, files) {
  const config = KIT_CONFIGS[kitId] || KIT_CONFIGS.default;
  const manifest = {
    id: kitId,
    name: config.name,
    category: category,
    style: config.style,
    version: '1.0',
    generated: new Date().toISOString(),
    mapping: {},
    unmapped: [],
    statistics: {
      totalSamples: files.length,
      mappedSamples: 0,
      confidence: 0,
    },
  };

  // Map each file
  for (const file of files) {
    const mapping = mapSampleToDrumType(file);

    if (mapping.confidence > 0.5) {
      if (!manifest.mapping[mapping.type]) {
        manifest.mapping[mapping.type] = [];
      }

      manifest.mapping[mapping.type].push({
        file: file,
        velocity: mapping.velocity,
        confidence: mapping.confidence,
      });

      manifest.statistics.mappedSamples++;
    } else {
      manifest.unmapped.push(file);
    }
  }

  // Calculate overall confidence
  manifest.statistics.confidence =
    manifest.statistics.mappedSamples / manifest.statistics.totalSamples;

  // Sort samples within each drum type by velocity
  for (const drumType in manifest.mapping) {
    manifest.mapping[drumType].sort((a, b) => a.velocity - b.velocity);
  }

  return manifest;
}

// List files in a Supabase directory
async function listFiles(prefix) {
  const files = [];
  const { data, error } = await supabase.storage
    .from('audio-samples')
    .list(prefix, { limit: 1000 });

  if (error) throw error;

  for (const item of data) {
    if (item.name && !item.id && item.name.endsWith('.mp3')) {
      files.push(item.name);
    }
  }

  return files;
}

// Main function
async function main() {
  console.log('🎯 Drum Kit Manifest Generator');
  console.log('==============================\n');

  const categories = [
    'acoustic',
    'electronic',
    'hip-hop',
    'rock',
    'metal',
    'jazz',
  ];
  const allManifests = [];

  for (const category of categories) {
    console.log(`\n📁 Processing ${category} kits...`);

    // List kits in category
    const { data: kits, error } = await supabase.storage
      .from('audio-samples')
      .list(`drums/hydrogen-kits/mp3/${category}`, { limit: 100 });

    if (error) {
      console.error(`Error listing ${category}:`, error);
      continue;
    }

    for (const kit of kits) {
      if (kit.id) {
        // It's a directory
        const kitId = kit.name;
        const files = await listFiles(
          `drums/hydrogen-kits/mp3/${category}/${kitId}`,
        );

        console.log(`  🥁 ${kitId}: ${files.length} samples`);

        const manifest = await generateKitManifest(kitId, category, files);
        allManifests.push(manifest);

        // Upload individual manifest
        const { error: uploadError } = await supabase.storage
          .from('audio-samples')
          .upload(
            `drums/hydrogen-kits/mp3/${category}/${kitId}/manifest.json`,
            JSON.stringify(manifest, null, 2),
            { contentType: 'application/json', upsert: true },
          );

        if (uploadError) {
          console.error(
            `    ❌ Failed to upload manifest:`,
            uploadError.message,
          );
        } else {
          console.log(
            `    ✓ Manifest uploaded (${manifest.statistics.mappedSamples}/${manifest.statistics.totalSamples} mapped)`,
          );
        }
      }
    }
  }

  // Create master manifest index
  const masterIndex = {
    version: '1.0',
    generated: new Date().toISOString(),
    totalKits: allManifests.length,
    drumTypes: Object.values(DRUM_TYPES),
    manifests: allManifests.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      style: m.style,
      samples: m.statistics.totalSamples,
      mapped: m.statistics.mappedSamples,
      confidence: m.statistics.confidence,
      path: `drums/hydrogen-kits/mp3/${m.category}/${m.id}/manifest.json`,
    })),
  };

  // Upload master index
  const { error: masterError } = await supabase.storage
    .from('audio-samples')
    .upload(
      'drums/hydrogen-kits/manifests.json',
      JSON.stringify(masterIndex, null, 2),
      { contentType: 'application/json', upsert: true },
    );

  if (masterError) {
    console.error('❌ Failed to upload master index:', masterError.message);
  } else {
    console.log('\n✓ Master manifest index uploaded');
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log(`Total kits processed: ${allManifests.length}`);

  const avgConfidence =
    allManifests.reduce((sum, m) => sum + m.statistics.confidence, 0) /
    allManifests.length;
  console.log(
    `Average mapping confidence: ${(avgConfidence * 100).toFixed(1)}%`,
  );

  const totalSamples = allManifests.reduce(
    (sum, m) => sum + m.statistics.totalSamples,
    0,
  );
  const totalMapped = allManifests.reduce(
    (sum, m) => sum + m.statistics.mappedSamples,
    0,
  );
  console.log(`Total samples: ${totalSamples}`);
  console.log(
    `Mapped samples: ${totalMapped} (${((totalMapped / totalSamples) * 100).toFixed(1)}%)`,
  );

  console.log('\n✅ Complete! Manifests are now available for all kits.');
  console.log('\n🎯 Next steps:');
  console.log('1. Review unmapped samples and improve pattern rules');
  console.log('2. Update DrumInstrumentProcessor to use manifests');
  console.log('3. Add UI for manual mapping corrections');
}

// Run
main().catch(console.error);
