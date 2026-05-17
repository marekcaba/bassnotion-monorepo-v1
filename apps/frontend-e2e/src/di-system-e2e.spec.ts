/**
 * E2E Test for Dependency Injection System
 *
 * This test verifies that the DI system works correctly in a real browser
 * environment with actual audio context and playback functionality.
 */

import { test, expect } from './fixtures';

test.describe('Dependency Injection E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page with audio capabilities
    await page.goto('http://localhost:3001');

    // Wait for the page to load and audio to initialize
    await page.waitForTimeout(2000);

    // Ensure audio context is available
    await page.evaluate(() => {
      // webkitAudioContext is Safari's legacy alias; not in lib.dom.
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        throw new Error('AudioContext not available');
      }
    });
  });

  test('should have CoreServices available with AudioEngine', async ({
    page,
  }) => {
    // Check that CoreServices is available and has AudioEngine
    const coreServicesAvailable = await page.evaluate(() => {
      const services =
        (window as any).__coreServices || (window as any).__globalCoreServices;
      return {
        hasServices: !!services,
        hasAudioEngine: !!services?.getAudioEngine,
        audioEngineReady: !!services?.getAudioEngine?.()?.isReady?.(),
      };
    });

    expect(coreServicesAvailable.hasServices).toBe(true);
    expect(coreServicesAvailable.hasAudioEngine).toBe(true);
    expect(coreServicesAvailable.audioEngineReady).toBe(true);
  });

  test('should create instruments with DI in browser', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // Get AudioEngine from global services
        const services =
          (window as any).__coreServices ||
          (window as any).__globalCoreServices;
        const audioEngine = services?.getAudioEngine?.();

        if (!audioEngine) {
          return { success: false, error: 'No AudioEngine available' };
        }

        // Import instrument dynamically. The "/src/..." path is a
        // browser-runtime URL served by Next/Vite; TypeScript can't
        // statically resolve it, so we treat the import as `any`.
        const { BassInstrument } = (await import(
          /* @vite-ignore */
          '/src/domains/playback/modules/instruments/implementations/bass/BassInstrument.js' as any
        )) as any;

        // Create instrument with DI
        const bass = new (BassInstrument as any)(
          {
            id: 'test-bass',
            name: 'E2E Test Bass',
            type: 'bass',
          },
          audioEngine,
        );

        // Initialize
        await bass.initialize();

        return {
          success: true,
          initialized: bass.state.isInitialized,
          hasError: !!bass.state.error,
          instrumentId: bass.id,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.initialized).toBe(true);
    expect(result.hasError).toBe(false);
    expect(result.instrumentId).toBe('test-bass');
  });

  test('should create mixing components with DI in browser', async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      try {
        // Get AudioEngine from global services
        const services =
          (window as any).__coreServices ||
          (window as any).__globalCoreServices;
        const audioEngine = services?.getAudioEngine?.();

        // Import mixing components — browser-runtime URLs, treated
        // as `any` (see note in the other dynamic-import block).
        const { Channel } = (await import(
          /* @vite-ignore */
          '/src/domains/playback/modules/tracks/mixing/Channel.js' as any
        )) as any;
        const { Bus } = (await import(
          /* @vite-ignore */
          '/src/domains/playback/modules/tracks/mixing/Bus.js' as any
        )) as any;

        // Create components with DI
        const channel = new (Channel as any)({
          channelId: 'e2e-channel',
          name: 'E2E Test Channel',
          audioEngine,
        });

        const bus = new (Bus as any)({
          busId: 'e2e-bus',
          name: 'E2E Test Bus',
          type: 'master',
          audioEngine,
        });

        // Test basic operations
        channel.setVolume(0.8);
        bus.setGain(0.9);
        bus.connectChannel('e2e-channel', channel);

        return {
          success: true,
          channelId: channel.id,
          busId: bus.id,
          channelVolume: channel.getState().volume,
          connectedChannels: bus.getConnectedChannelIds(),
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.channelId).toBe('e2e-channel');
    expect(result.busId).toBe('e2e-bus');
    expect(result.channelVolume).toBe(0.8);
    expect(result.connectedChannels).toContain('e2e-channel');
  });

  test('should verify factory methods are working', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // Get AudioEngine from global services
        const services =
          (window as any).__coreServices ||
          (window as any).__globalCoreServices;
        const audioEngine = services?.getAudioEngine?.();

        if (!audioEngine) {
          return { success: false, error: 'No AudioEngine available' };
        }

        // Test factory methods directly
        const factoryTests = {
          createGain: !!audioEngine.createGain,
          createVolume: !!audioEngine.createVolume,
          createPanner: !!audioEngine.createPanner,
          createSampler: !!audioEngine.createSampler,
          createEQ3: !!audioEngine.createEQ3,
          getDestination: !!audioEngine.getDestination,
        };

        // Try to create nodes
        const gain = audioEngine.createGain?.(0.5);
        const panner = audioEngine.createPanner?.(0.2);
        const destination = audioEngine.getDestination?.();

        return {
          success: true,
          factoryMethods: factoryTests,
          nodeCreation: {
            gain: !!gain,
            panner: !!panner,
            destination: !!destination,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.factoryMethods.createGain).toBe(true);
    expect(result.factoryMethods.createVolume).toBe(true);
    expect(result.factoryMethods.createPanner).toBe(true);
    expect(result.factoryMethods.createSampler).toBe(true);
    expect(result.nodeCreation.gain).toBe(true);
    expect(result.nodeCreation.panner).toBe(true);
    expect(result.nodeCreation.destination).toBe(true);
  });

  test('should handle backward compatibility in browser', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // Import instrument
        const { BassInstrument } = (await import(
          /* @vite-ignore */
          '/src/domains/playback/modules/instruments/implementations/bass/BassInstrument.js' as any
        )) as any;

        // Create instrument WITHOUT audioEngine (backward compatibility)
        const bassNoAuth = new (BassInstrument as any)({
          id: 'bass-no-di',
          name: 'Bass No DI',
          type: 'bass',
        });

        // Should still work
        await bassNoAuth.initialize();

        return {
          success: true,
          initialized: bassNoAuth.state.isInitialized,
          id: bassNoAuth.id,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.initialized).toBe(true);
    expect(result.id).toBe('bass-no-di');
  });

  test('should verify DI system maintains audio functionality', async ({
    page,
  }) => {
    // This test ensures that the DI refactoring didn't break actual audio
    const result = await page.evaluate(async () => {
      try {
        // Get services
        const services =
          (window as any).__coreServices ||
          (window as any).__globalCoreServices;
        const audioEngine = services?.getAudioEngine?.();

        // Check if audio context is available
        if (!audioEngine || !audioEngine.isReady?.()) {
          return { success: false, error: 'AudioEngine not ready' };
        }

        // Import and create a bass instrument
        const { BassInstrument } = (await import(
          /* @vite-ignore */
          '/src/domains/playback/modules/instruments/implementations/bass/BassInstrument.js' as any
        )) as any;

        const bass = new (BassInstrument as any)(
          {
            id: 'e2e-bass',
            name: 'E2E Bass',
            type: 'bass',
          },
          audioEngine,
        );

        await bass.initialize();

        // Try to trigger a note (should not throw)
        bass.trigger({
          audioTime: audioEngine.now() + 0.1,
          timestamp: Date.now(),
          velocity: 0.8,
          data: { note: 'E1', fret: 0, string: 0 },
        });

        return {
          success: true,
          initialized: bass.state.isInitialized,
          playing: bass.state.isPlaying,
          audioEngineReady: audioEngine.isReady(),
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.initialized).toBe(true);
    expect(result.audioEngineReady).toBe(true);
  });
});
