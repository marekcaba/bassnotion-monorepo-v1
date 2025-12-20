#!/usr/bin/env npx ts-node
/**
 * Verify Lazy Tone.js Migration
 *
 * Quick verification script to run after converting files.
 * Usage:
 *   npx ts-node apps/frontend/scripts/verify-lazy-tone.ts [file-path]
 *
 * Examples:
 *   npx ts-node apps/frontend/scripts/verify-lazy-tone.ts         # Verify all
 *   npx ts-node apps/frontend/scripts/verify-lazy-tone.ts batch1  # Verify Batch 1
 */

import { execSync } from 'child_process';

// Files organized by conversion batch
const BATCHES = {
  batch1: {
    name: 'Instrument Components',
    files: [
      'src/domains/playback/modules/instruments/components/bass/BassArticulation.ts',
      'src/domains/playback/modules/instruments/components/bass/BassEffectsChain.ts',
      'src/domains/playback/modules/instruments/components/bass/BassSynthEngine.ts',
      'src/domains/playback/modules/instruments/components/drums/DrumEffectsRack.ts',
      'src/domains/playback/modules/instruments/components/drums/DrumMixerChannel.ts',
      'src/domains/playback/modules/instruments/components/drums/DrumSampleEngine.ts',
      'src/domains/playback/modules/instruments/components/metronome/MetronomeCore.ts',
    ],
  },
  batch2: {
    name: 'Mixing Components',
    files: [
      'src/domains/playback/modules/tracks/mixing/Bus.ts',
      'src/domains/playback/modules/tracks/mixing/Channel.ts',
      'src/domains/playback/modules/tracks/mixing/Mixer.ts',
    ],
  },
  batch3: {
    name: 'Transport & Scheduling',
    files: [
      'src/domains/playback/modules/transport/core/Scheduler.ts',
      'src/domains/playback/modules/transport/core/Transport.ts',
      'src/domains/playback/modules/transport/core/TransportController.ts',
      'src/domains/playback/modules/transport/position/MusicalPositionManager.ts',
      'src/domains/playback/modules/transport/scheduling/strategies/EventDrivenStrategy.ts',
      'src/domains/playback/modules/transport/scheduling/strategies/PollingStrategy.ts',
    ],
  },
  batch4: {
    name: 'Core Services',
    files: [
      'src/domains/playback/services/core/PlaybackEngine.ts',
      'src/domains/playback/services/core/PlaybackSession.ts',
      'src/domains/playback/services/core/region-processing/cache/ScheduleCache.ts',
      'src/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler.ts',
      'src/domains/playback/services/core/region-processing/sustain/SustainPedalManager.ts',
      'src/domains/playback/services/core/region-processing/timing/TimePositionConverter.ts',
    ],
  },
  batch5: {
    name: 'Widget Components',
    files: [
      'src/domains/widgets/components/YouTubeWidgetPage/components/GlobalControls.tsx',
      'src/domains/widgets/hooks/useTransportSync.ts',
      'src/domains/widgets/utils/transportSync.ts',
      'src/domains/playback/hooks/useTrackMixing.ts',
    ],
  },
  misc: {
    name: 'Miscellaneous',
    files: [
      'src/domains/playback/modules/tempo/MusicalTruthAuthority.ts',
      'src/domains/playback/modules/instruments/implementations/drums/DrumProcessor.ts',
      'src/domains/playback/services/core/region-processing/diagnostics/DiagnosticLogger.ts',
      'src/domains/playback/utils/ensureAudioContext.ts',
    ],
  },
};

function verifyFile(filePath: string): { success: boolean; error?: string } {
  try {
    // Check 1: File has no static Tone import
    const content = require('fs').readFileSync(
      `apps/frontend/${filePath}`,
      'utf-8'
    );

    if (content.includes("import * as Tone from 'tone'")) {
      return {
        success: false,
        error: 'Still has static import',
      };
    }

    // Check 2: TypeScript compiles without errors
    try {
      execSync(`pnpm tsc --noEmit apps/frontend/${filePath} 2>&1`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });
    } catch (e) {
      const error = e as { stdout?: string };
      return {
        success: false,
        error: `TypeScript error: ${error.stdout?.slice(0, 200)}`,
      };
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: `File read error: ${(e as Error).message}`,
    };
  }
}

function verifyBatch(batchKey: string): void {
  const batch = BATCHES[batchKey as keyof typeof BATCHES];
  if (!batch) {
    console.error(`Unknown batch: ${batchKey}`);
    console.log('Available batches:', Object.keys(BATCHES).join(', '));
    process.exit(1);
  }

  console.log(`\n📦 Verifying ${batch.name} (${batchKey})\n`);
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const file of batch.files) {
    const result = verifyFile(file);
    const status = result.success ? '✅' : '❌';
    const shortPath = file.replace('src/domains/playback/', '');

    console.log(`${status} ${shortPath}`);
    if (result.error) {
      console.log(`   └─ ${result.error}`);
    }

    if (result.success) passed++;
    else failed++;
  }

  console.log('='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
}

function verifyAll(): void {
  console.log('\n🔍 LAZY TONE.JS MIGRATION VERIFICATION\n');
  console.log('='.repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [key, batch] of Object.entries(BATCHES)) {
    console.log(`\n📦 ${batch.name}`);
    console.log('-'.repeat(40));

    for (const file of batch.files) {
      const result = verifyFile(file);
      const status = result.success ? '✅' : '❌';
      const shortPath = file.split('/').slice(-2).join('/');

      console.log(`${status} ${shortPath}`);
      if (result.error) {
        console.log(`   └─ ${result.error}`);
      }

      if (result.success) totalPassed++;
      else totalFailed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(
    `\n📊 TOTAL: ${totalPassed} passed, ${totalFailed} failed out of ${totalPassed + totalFailed} files\n`
  );

  if (totalFailed > 0) {
    process.exit(1);
  }
}

// Main execution
const arg = process.argv[2];

if (!arg || arg === 'all') {
  verifyAll();
} else if (arg in BATCHES) {
  verifyBatch(arg);
} else {
  console.log('Usage: verify-lazy-tone.ts [batch1|batch2|batch3|batch4|batch5|misc|all]');
  process.exit(1);
}
