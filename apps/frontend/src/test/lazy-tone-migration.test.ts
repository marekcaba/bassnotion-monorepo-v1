/**
 * Lazy Tone.js Migration Tests
 *
 * This test suite verifies that all files converted from static
 * `import * as Tone from 'tone'` to dynamic `await getTone()`
 * still work correctly.
 *
 * Run after each batch of file conversions:
 *   pnpm vitest run apps/frontend/src/test/lazy-tone-migration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  batchVerifyLazyToneFiles,
  reportBatchVerification,
  verifyTransportOperations,
  verifyAudioNodeCreation,
} from './utils/lazyToneTestUtils';

// Mock AudioContext for Node environment
beforeAll(() => {
  // @ts-ignore
  global.AudioContext = vi.fn().mockImplementation(() => ({
    state: 'running',
    sampleRate: 44100,
    currentTime: 0,
    destination: { maxChannelCount: 2 },
    createGain: vi.fn().mockReturnValue({
      gain: { value: 1, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createOscillator: vi.fn().mockReturnValue({
      frequency: { value: 440, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    decodeAudioData: vi.fn().mockResolvedValue({
      duration: 1,
      length: 44100,
      numberOfChannels: 2,
      sampleRate: 44100,
    }),
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }));
});

describe('Lazy Tone.js Migration', () => {
  /**
   * BATCH 1: Simple Instrument Components
   * These are leaf nodes with minimal dependencies
   */
  describe('Batch 1: Instrument Components', () => {
    const batch1Files = [
      {
        path: '@/domains/playback/modules/instruments/components/bass/BassArticulation',
        expectedExports: ['BassArticulation'],
      },
      {
        path: '@/domains/playback/modules/instruments/components/bass/BassEffectsChain',
        expectedExports: ['BassEffectsChain'],
      },
      {
        path: '@/domains/playback/modules/instruments/components/bass/BassSynthEngine',
        expectedExports: ['BassSynthEngine'],
      },
      {
        path: '@/domains/playback/modules/instruments/components/drums/DrumEffectsRack',
        expectedExports: ['DrumEffectsRack'],
      },
      {
        path: '@/domains/playback/modules/instruments/components/drums/DrumMixerChannel',
        expectedExports: ['DrumMixerChannel'],
      },
      {
        path: '@/domains/playback/modules/instruments/components/drums/DrumSampleEngine',
        expectedExports: ['DrumSampleEngine'],
      },
      {
        path: '@/domains/playback/modules/instruments/components/metronome/MetronomeCore',
        expectedExports: ['MetronomeCore'],
      },
    ];

    it.skip('should import all Batch 1 files without errors', async () => {
      // This test will be enabled after converting Batch 1 files
      const result = await batchVerifyLazyToneFiles(batch1Files);
      reportBatchVerification(result);
      expect(result.summary.failed).toBe(0);
    });
  });

  /**
   * BATCH 2: Mixing Components
   */
  describe('Batch 2: Mixing Components', () => {
    const batch2Files = [
      {
        path: '@/domains/playback/modules/tracks/mixing/Bus',
        expectedExports: ['Bus'],
      },
      {
        path: '@/domains/playback/modules/tracks/mixing/Channel',
        expectedExports: ['Channel'],
      },
      {
        path: '@/domains/playback/modules/tracks/mixing/Mixer',
        expectedExports: ['Mixer'],
      },
    ];

    it.skip('should import all Batch 2 files without errors', async () => {
      const result = await batchVerifyLazyToneFiles(batch2Files);
      reportBatchVerification(result);
      expect(result.summary.failed).toBe(0);
    });
  });

  /**
   * BATCH 3: Transport & Scheduling
   */
  describe('Batch 3: Transport & Scheduling', () => {
    const batch3Files = [
      {
        path: '@/domains/playback/modules/transport/core/Scheduler',
        expectedExports: ['Scheduler'],
      },
      {
        path: '@/domains/playback/modules/transport/core/Transport',
        expectedExports: ['default'], // or the actual export name
      },
      {
        path: '@/domains/playback/modules/transport/core/TransportController',
        expectedExports: ['TransportController'],
      },
      {
        path: '@/domains/playback/modules/transport/position/MusicalPositionManager',
        expectedExports: ['MusicalPositionManager'],
      },
      {
        path: '@/domains/playback/modules/transport/scheduling/strategies/EventDrivenStrategy',
        expectedExports: ['EventDrivenStrategy'],
      },
      {
        path: '@/domains/playback/modules/transport/scheduling/strategies/PollingStrategy',
        expectedExports: ['PollingStrategy'],
      },
    ];

    it.skip('should import all Batch 3 files without errors', async () => {
      const result = await batchVerifyLazyToneFiles(batch3Files);
      reportBatchVerification(result);
      expect(result.summary.failed).toBe(0);
    });
  });

  /**
   * BATCH 4: Core Services
   */
  describe('Batch 4: Core Services', () => {
    const batch4Files = [
      {
        path: '@/domains/playback/services/core/PlaybackEngine',
        expectedExports: ['PlaybackEngine'],
      },
      {
        path: '@/domains/playback/services/core/PlaybackSession',
        expectedExports: ['PlaybackSession'],
      },
      {
        path: '@/domains/playback/services/core/region-processing/cache/ScheduleCache',
        expectedExports: ['ScheduleCache'],
      },
      {
        path: '@/domains/playback/services/core/region-processing/scheduling-orchestrator/RegionScheduler',
        expectedExports: ['RegionScheduler'],
      },
      {
        path: '@/domains/playback/services/core/region-processing/sustain/SustainPedalManager',
        expectedExports: ['SustainPedalManager'],
      },
      {
        path: '@/domains/playback/services/core/region-processing/timing/TimePositionConverter',
        expectedExports: ['TimePositionConverter'],
      },
    ];

    it.skip('should import all Batch 4 files without errors', async () => {
      const result = await batchVerifyLazyToneFiles(batch4Files);
      reportBatchVerification(result);
      expect(result.summary.failed).toBe(0);
    });
  });

  /**
   * BATCH 5: Widget & Hook Components
   */
  describe('Batch 5: Widget Components', () => {
    const batch5Files = [
      {
        path: '@/domains/widgets/components/YouTubeWidgetPage/components/GlobalControls',
        expectedExports: ['GlobalControls'],
      },
      {
        path: '@/domains/widgets/hooks/useTransportSync',
        expectedExports: ['useTransportSync'],
      },
      {
        path: '@/domains/widgets/utils/transportSync',
        expectedExports: ['syncWithTransport'], // or actual export name
      },
      {
        path: '@/domains/playback/hooks/useTrackMixing',
        expectedExports: ['useTrackMixing'],
      },
    ];

    it.skip('should import all Batch 5 files without errors', async () => {
      const result = await batchVerifyLazyToneFiles(batch5Files);
      reportBatchVerification(result);
      expect(result.summary.failed).toBe(0);
    });
  });

  /**
   * Integration: Verify Tone.js core operations work after lazy loading
   */
  describe('Core Tone.js Operations', () => {
    it.skip('should perform Transport operations after lazy loading', async () => {
      const result = await verifyTransportOperations();
      expect(result).toBe(true);
    });

    it.skip('should create audio nodes after lazy loading', async () => {
      const result = await verifyAudioNodeCreation();
      expect(result).toBe(true);
    });
  });
});

/**
 * Standalone verification script
 * Can be run directly: npx ts-node apps/frontend/src/test/lazy-tone-migration.test.ts
 */
export async function runStandaloneVerification() {
  console.log('🔍 Running Lazy Tone.js Migration Verification...\n');

  const allFiles = [
    // Batch 1: Instruments
    {
      path: '@/domains/playback/modules/instruments/components/bass/BassArticulation',
      expectedExports: ['BassArticulation'],
    },
    // ... add all files from batches above
  ];

  const result = await batchVerifyLazyToneFiles(allFiles);
  reportBatchVerification(result);

  return result.summary.failed === 0;
}
