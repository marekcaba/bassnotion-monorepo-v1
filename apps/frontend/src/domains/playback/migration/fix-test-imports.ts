#!/usr/bin/env node
/**
 * Script to fix test file imports for god objects
 * Phase 6.1.4: Fix breaking changes in test files
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

interface ImportMapping {
  old: string;
  new: string;
  description: string;
}

const importMappings: ImportMapping[] = [
  // MetronomeInstrumentProcessor
  {
    old: '../plugins/MetronomeInstrumentProcessor',
    new: '../MetronomeInstrumentProcessor.js',
    description:
      'Fix MetronomeInstrumentProcessor imports in its own test directory',
  },
  {
    old: '../plugins/MetronomeInstrumentProcessor',
    new: '../../modules/instruments/implementations/metronome/MetronomeInstrumentProcessor.js',
    description: 'Fix MetronomeInstrumentProcessor imports in service tests',
  },

  // MidiParserProcessor
  {
    old: '../plugins/MidiParserProcessor',
    new: '../../modules/midi/MidiParserProcessor.js',
    description: 'Fix MidiParserProcessor imports',
  },

  // GlobalSampleCache
  {
    old: '../storage/GlobalSampleCache',
    new: '../../modules/storage/cache/GlobalSampleCache.js',
    description: 'Fix GlobalSampleCache imports',
  },

  // AudioEngine
  {
    old: '../core/AudioEngine.js',
    new: '../../modules/audio-engine/core/AudioEngine.js',
    description: 'Fix AudioEngine imports',
  },

  // SupabaseAssetClient
  {
    old: '../SupabaseAssetClient',
    new: '../SupabaseAssetClientFacade.js',
    description: 'Use facade instead of original SupabaseAssetClient',
  },

  // Instrument processors that moved
  {
    old: '../plugins/BassInstrumentProcessor',
    new: '../../modules/instruments/implementations/bass/BassInstrumentProcessor.js',
    description: 'Fix BassInstrumentProcessor imports',
  },
  {
    old: '../plugins/DrumInstrumentProcessor',
    new: '../../modules/instruments/implementations/drums/DrumInstrumentProcessor.js',
    description: 'Fix DrumInstrumentProcessor imports',
  },

  // Removed/relocated plugins
  {
    old: '../plugins/InstrumentAssetOptimizer',
    new: '../../modules/optimization/InstrumentAssetOptimizer.js',
    description: 'Fix InstrumentAssetOptimizer imports',
  },
  {
    old: '../plugins/InstrumentLifecycleManager',
    new: '../../modules/lifecycle/InstrumentLifecycleManager.js',
    description: 'Fix InstrumentLifecycleManager imports',
  },
  {
    old: '../plugins/MusicalContextAnalyzer',
    new: '../../modules/intelligence/MusicalContextAnalyzer.js',
    description: 'Fix MusicalContextAnalyzer imports',
  },
  {
    old: '../plugins/MusicalExpressionEngine',
    new: '../../modules/intelligence/MusicalExpressionEngine.js',
    description: 'Fix MusicalExpressionEngine imports',
  },
];

function fixTestImports(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;

    for (const mapping of importMappings) {
      // Check various import patterns
      const patterns = [
        new RegExp(`from ['"]${mapping.old}['"]`, 'g'),
        new RegExp(`from ['"]${mapping.old}\\.js['"]`, 'g'),
        new RegExp(`import\\(['"]${mapping.old}['"]\\)`, 'g'),
        new RegExp(`require\\(['"]${mapping.old}['"]\\)`, 'g'),
      ];

      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          content = content.replace(pattern, (match) => {
            return match.replace(mapping.old, mapping.new.replace('.js', ''));
          });
          modified = true;
          console.log(`  ✓ Fixed import: ${mapping.old} → ${mapping.new}`);
        }
      }
    }

    if (modified) {
      writeFileSync(filePath, content);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`  ✗ Error processing ${filePath}:`, error);
    return false;
  }
}

// Find all test files
console.log('🔍 Finding test files with import issues...\n');

const testFiles = execSync(
  'find apps/frontend/src/domains/playback -name "*.test.ts" -o -name "*.test.tsx" | grep -E "__tests__|\.test\."',
  { encoding: 'utf-8' },
)
  .split('\n')
  .filter((f) => f.trim());

console.log(`Found ${testFiles.length} test files to check\n`);

let fixedCount = 0;
const errorCount = 0;

// Process each test file
for (const file of testFiles) {
  if (!file.trim()) continue;

  console.log(`Processing: ${file}`);
  const result = fixTestImports(file);

  if (result) {
    fixedCount++;
  }
}

// Also check for specific problem files mentioned in the error output
const additionalFiles = [
  'apps/frontend/src/domains/playback/services/monitoring/CacheMonitor.ts',
  'apps/frontend/src/domains/playback/services/__tests__/InitialSamplePreloader.test.ts',
  'apps/frontend/src/domains/playback/services/__tests__/BassInstrumentProcessor.behavior.test.ts',
  'apps/frontend/src/domains/playback/services/__tests__/MusicalContextAnalyzer.behavior.test.ts',
];

console.log('\n🔍 Checking additional files...\n');

for (const file of additionalFiles) {
  if (
    execSync(`test -f "${file}" && echo "exists"`, {
      encoding: 'utf-8',
    }).trim() === 'exists'
  ) {
    console.log(`Processing: ${file}`);
    const result = fixTestImports(file);
    if (result) {
      fixedCount++;
    }
  }
}

console.log('\n📊 Summary:');
console.log(`✅ Fixed imports in ${fixedCount} files`);
console.log(`❌ Errors in ${errorCount} files`);

// List files that might have missing dependencies
console.log('\n⚠️  Files that may reference removed/missing plugins:');
const missingPlugins = [
  'SyncProcessor',
  'N8nAssetPipelineProcessor',
  'PerformanceTunerOptimizer',
  'TrackManagerProcessor',
  'AnalyticsEngine',
];

for (const plugin of missingPlugins) {
  const cmd = `grep -r "from.*${plugin}" apps/frontend/src/domains/playback --include="*.test.*" | wc -l`;
  const count = parseInt(execSync(cmd, { encoding: 'utf-8' }).trim());
  if (count > 0) {
    console.log(`  - ${plugin}: ${count} references found`);
  }
}

console.log('\n✅ Import fixing complete!');
console.log('Next step: Run tests to identify remaining issues');
