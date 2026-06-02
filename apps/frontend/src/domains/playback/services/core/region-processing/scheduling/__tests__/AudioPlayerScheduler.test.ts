/**
 * AudioPlayerScheduler — LAUNCH-02.5b unit tests.
 *
 * Verifies the structural correctness of the audio-stem scheduler:
 *   - setStem registers a buffer + gain per stem; replacement stops the
 *     previous source
 *   - schedule() creates an AudioBufferSource, connects to the stem gain,
 *     and calls source.start(audioTime, offsetSeconds)
 *   - schedule() returns false (event-bus fallback) when audioContext is
 *     missing, when no stemKey is provided, or when the stem is not
 *     registered
 *   - stopStem() and stopAll() stop active sources cleanly
 *   - dispose() drops everything
 *
 * Acoustic correctness (seam quality, crossfade artifacts) is deferred to
 * LAUNCH-02.5c per the epic's design.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioPlayerScheduler } from '../AudioPlayerScheduler.js';
import type { PatternEvent } from '../../event-routing/EventRouter.js';

vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

function createMockAudioBuffer(duration = 8.0): AudioBuffer {
  return {
    length: 44100 * duration,
    duration,
    sampleRate: 44100,
    numberOfChannels: 2,
    getChannelData: vi.fn(() => new Float32Array(44100 * duration)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

function createMockGainNode(): GainNode {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as GainNode;
}

function createMockSource(): AudioBufferSourceNode {
  return {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as ((this: AudioBufferSourceNode, ev: Event) => any) | null,
    addEventListener: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as AudioBufferSourceNode;
}

function createMockAudioContext(): AudioContext {
  return {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: {} as AudioDestinationNode,
    createBufferSource: vi.fn(() => createMockSource()),
    createGain: vi.fn(() => createMockGainNode()),
  } as unknown as AudioContext;
}

describe('AudioPlayerScheduler', () => {
  let scheduler: AudioPlayerScheduler;
  let audioContext: AudioContext;

  beforeEach(() => {
    scheduler = new AudioPlayerScheduler('test-instance');
    audioContext = createMockAudioContext();
    scheduler.setAudioContext(audioContext);
  });

  // ==========================================================================
  // Stem registration
  // ==========================================================================
  describe('setStem / hasStem / getStem', () => {
    it('registers a stem and exposes its buffer + gain via getStem', () => {
      const buffer = createMockAudioBuffer();
      const gain = createMockGainNode();
      scheduler.setStem('bass', buffer, gain);

      expect(scheduler.hasStem('bass')).toBe(true);
      const entry = scheduler.getStem('bass');
      expect(entry?.buffer).toBe(buffer);
      expect(entry?.gain).toBe(gain);
    });

    it('returns null from getStem when a stem is not registered', () => {
      expect(scheduler.hasStem('harmony')).toBe(false);
      expect(scheduler.getStem('harmony')).toBeNull();
    });

    it('replacing a stem stops the previous in-flight source', () => {
      const buffer1 = createMockAudioBuffer();
      const gain1 = createMockGainNode();
      scheduler.setStem('drums', buffer1, gain1);

      // Fire one event so an active source exists.
      const event: PatternEvent = {
        type: 'audio-stem',
        position: '0:0:0',
        data: { stemKey: 'drums' },
      };
      expect(scheduler.schedule(event, 0, 0)).toBe(true);

      // Replace — should call stopStem() on the previous source internally.
      const buffer2 = createMockAudioBuffer(4);
      const gain2 = createMockGainNode();
      scheduler.setStem('drums', buffer2, gain2);

      // The previous gain node should have received a ramp-to-zero from
      // stopStem() (5ms ramp). We don't assert exact call args, just that
      // some ramp call happened.
      expect(
        (gain1.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock
          .calls.length,
      ).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // schedule()
  // ==========================================================================
  describe('schedule()', () => {
    it('creates an AudioBufferSource, connects to the stem gain, and starts at audioTime', () => {
      const buffer = createMockAudioBuffer();
      const gain = createMockGainNode();
      scheduler.setStem('bass', buffer, gain);

      const event: PatternEvent = {
        type: 'audio-stem',
        position: '0:0:0',
        data: { stemKey: 'bass', offsetSeconds: 0.5 },
      };

      const result = scheduler.schedule(event, 1.234, 100);
      expect(result).toBe(true);
      expect(audioContext.createBufferSource).toHaveBeenCalledTimes(1);

      // Capture the source returned by the most recent createBufferSource call
      // so we can verify connect / start.
      const createMock = audioContext.createBufferSource as ReturnType<
        typeof vi.fn
      >;
      const source = createMock.mock.results[0]?.value as AudioBufferSourceNode;
      expect(source.buffer).toBe(buffer);
      expect(source.connect).toHaveBeenCalledWith(gain);
      expect(source.start).toHaveBeenCalledWith(1.234, 0.5);
    });

    it('defaults offsetSeconds to 0 when not provided', () => {
      const buffer = createMockAudioBuffer();
      const gain = createMockGainNode();
      scheduler.setStem('click', buffer, gain);

      const event: PatternEvent = {
        type: 'audio-stem',
        position: '0:0:0',
        data: { stemKey: 'click' },
      };
      scheduler.schedule(event, 2.0, 200);

      const createMock = audioContext.createBufferSource as ReturnType<
        typeof vi.fn
      >;
      const source = createMock.mock.results[0]?.value as AudioBufferSourceNode;
      expect(source.start).toHaveBeenCalledWith(2.0, 0);
    });

    it('returns false when no audioContext is set', () => {
      const lonely = new AudioPlayerScheduler('no-ctx');
      const event: PatternEvent = {
        type: 'audio-stem',
        position: '0:0:0',
        data: { stemKey: 'bass' },
      };
      expect(lonely.schedule(event, 0, 0)).toBe(false);
    });

    it('returns false when event.data.stemKey is missing', () => {
      const buffer = createMockAudioBuffer();
      const gain = createMockGainNode();
      scheduler.setStem('bass', buffer, gain);

      const event: PatternEvent = {
        type: 'audio-stem',
        position: '0:0:0',
        // intentionally no data.stemKey
      };
      expect(scheduler.schedule(event, 0, 0)).toBe(false);
    });

    it('returns false when the stem is not registered', () => {
      const event: PatternEvent = {
        type: 'audio-stem',
        position: '0:0:0',
        data: { stemKey: 'harmony' },
      };
      expect(scheduler.schedule(event, 0, 0)).toBe(false);
    });
  });

  // ==========================================================================
  // stopStem / stopAll / dispose
  // ==========================================================================
  describe('stopStem / stopAll / dispose', () => {
    it('stopStem stops every active source for that stem with a 5ms gain ramp', () => {
      const buffer = createMockAudioBuffer();
      const gain = createMockGainNode();
      scheduler.setStem('bass', buffer, gain);

      const event: PatternEvent = {
        type: 'audio-stem',
        position: '0:0:0',
        data: { stemKey: 'bass' },
      };
      scheduler.schedule(event, 0, 0);
      scheduler.schedule(event, 0, 0);

      const createMock = audioContext.createBufferSource as ReturnType<
        typeof vi.fn
      >;
      const sources = createMock.mock.results.map((r) => r.value);

      scheduler.stopStem('bass');

      sources.forEach((src: AudioBufferSourceNode) => {
        expect(src.stop).toHaveBeenCalled();
      });
      // Gain receives a setValueAtTime + linearRampToValueAtTime pair.
      expect(gain.gain.setValueAtTime).toHaveBeenCalled();
      expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        expect.any(Number),
      );
    });

    it('stopAll stops sources across every registered stem', () => {
      const bassBuffer = createMockAudioBuffer();
      const bassGain = createMockGainNode();
      const drumsBuffer = createMockAudioBuffer();
      const drumsGain = createMockGainNode();
      scheduler.setStem('bass', bassBuffer, bassGain);
      scheduler.setStem('drums', drumsBuffer, drumsGain);

      scheduler.schedule(
        { type: 'audio-stem', position: '0:0:0', data: { stemKey: 'bass' } },
        0,
        0,
      );
      scheduler.schedule(
        { type: 'audio-stem', position: '0:0:0', data: { stemKey: 'drums' } },
        0,
        0,
      );

      scheduler.stopAll();
      expect(bassGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        expect.any(Number),
      );
      expect(drumsGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        expect.any(Number),
      );
    });

    it('dispose clears all registrations and active sources', () => {
      const buffer = createMockAudioBuffer();
      const gain = createMockGainNode();
      scheduler.setStem('bass', buffer, gain);
      scheduler.schedule(
        { type: 'audio-stem', position: '0:0:0', data: { stemKey: 'bass' } },
        0,
        0,
      );

      scheduler.dispose();
      expect(scheduler.hasStem('bass')).toBe(false);
      // Schedule should now no-op cleanly.
      expect(
        scheduler.schedule(
          { type: 'audio-stem', position: '0:0:0', data: { stemKey: 'bass' } },
          0,
          0,
        ),
      ).toBe(false);
    });
  });

  // ==========================================================================
  // trackExternalSource (used by RegionScheduler infinite-loop branch)
  // ==========================================================================
  describe('trackExternalSource (for RegionScheduler infinite loops)', () => {
    it('registered external sources are stopped by stopStem', () => {
      const buffer = createMockAudioBuffer();
      const gain = createMockGainNode();
      scheduler.setStem('harmony', buffer, gain);

      const externalSource = createMockSource();
      scheduler.trackExternalSource('harmony', externalSource);

      scheduler.stopStem('harmony');
      expect(externalSource.stop).toHaveBeenCalled();
    });
  });
});
