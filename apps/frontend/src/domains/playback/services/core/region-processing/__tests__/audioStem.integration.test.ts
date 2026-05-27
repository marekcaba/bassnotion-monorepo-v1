/**
 * LAUNCH-02.5b integration test — EventRouter ⇄ AudioPlayerScheduler.
 *
 * The full PlaybackEngine ⇄ EventRouter ⇄ AudioPlayerScheduler chain is
 * expensive to construct (PlaybackEngine wires 10+ subsystems). This test
 * exercises the seam where the audio-stem story lives: the EventRouter
 * routes `instrumentType.startsWith('audio-')` events through a real
 * AudioPlayerScheduler instance, with frame-aligned audio times.
 *
 * What it covers:
 *   - Registering 4 stem buffers via AudioPlayerScheduler.setStem
 *   - Emitting 4 events through EventRouter (one per stem)
 *   - Each event reaches the AudioPlayerScheduler.schedule() path
 *   - Source.start(audioTime, offset) is called with the frame-rounded
 *     audio time computed by EventRouter
 *   - No event leaks to the event bus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EventRouter,
  type EventBus,
  type PatternEvent,
  type Scheduler,
} from '../event-routing/EventRouter.js';
import { AudioPlayerScheduler } from '../scheduling/AudioPlayerScheduler.js';

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

interface MockSource {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
  addEventListener: ReturnType<typeof vi.fn>;
}

function createMockSource(): MockSource {
  return {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
    addEventListener: vi.fn(),
  };
}

describe('Integration — EventRouter routes audio-* events to AudioPlayerScheduler', () => {
  let router: EventRouter;
  let audioPlayerScheduler: AudioPlayerScheduler;
  let audioContext: AudioContext;
  let createdSources: MockSource[];
  let mockEventBus: EventBus;
  let noopMidiScheduler: Scheduler;

  beforeEach(() => {
    createdSources = [];
    audioContext = {
      currentTime: 0,
      sampleRate: 48000,
      state: 'running',
      destination: {} as AudioDestinationNode,
      createBufferSource: vi.fn(() => {
        const s = createMockSource();
        createdSources.push(s);
        return s;
      }),
      createGain: vi.fn(() => createMockGainNode()),
    } as unknown as AudioContext;

    mockEventBus = { emit: vi.fn() };
    noopMidiScheduler = { schedule: vi.fn(() => true) };

    audioPlayerScheduler = new AudioPlayerScheduler('integration-test');
    audioPlayerScheduler.setAudioContext(audioContext);

    router = new EventRouter('integration-test');
    router.initialize(
      audioContext,
      48000,
      mockEventBus,
      noopMidiScheduler, // metronome
      noopMidiScheduler, // drums
      noopMidiScheduler, // harmony
      noopMidiScheduler, // bass
      noopMidiScheduler, // voice-cue
      vi.fn(), // trackTimingAccuracy
      audioPlayerScheduler, // 10th positional arg — under test
    );
  });

  it('routes all 4 audio stems through AudioPlayerScheduler with frame-aligned audio times', () => {
    // 1. Register all 4 stems.
    const buffers = {
      bass: createMockAudioBuffer(),
      drums: createMockAudioBuffer(),
      harmony: createMockAudioBuffer(),
      click: createMockAudioBuffer(),
    };
    const gains = {
      bass: createMockGainNode(),
      drums: createMockGainNode(),
      harmony: createMockGainNode(),
      click: createMockGainNode(),
    };
    audioPlayerScheduler.setStem('bass', buffers.bass, gains.bass);
    audioPlayerScheduler.setStem('drums', buffers.drums, gains.drums);
    audioPlayerScheduler.setStem('harmony', buffers.harmony, gains.harmony);
    audioPlayerScheduler.setStem('click', buffers.click, gains.click);

    // 2. Advance "transport" to anchor at 2.0s and emit one event per stem
    //    at transport-time 0.5s.
    router.setTransportStartTime(2.0);
    const stems = ['bass', 'drums', 'harmony', 'click'] as const;
    stems.forEach((stem) => {
      const event: PatternEvent = {
        type: 'audio-stem',
        position: '0:0:0',
        data: { stemKey: stem },
      };
      router.emitEvent(`audio-${stem}`, event, 0.5);
    });

    // 3. Each event must have produced exactly one source connected to the
    //    matching gain node and started at the frame-rounded audio time.
    expect(createdSources).toHaveLength(4);
    const expectedAudioTime = (() => {
      const audioTime = 2.0 + 0.5;
      const frame = Math.round(audioTime * 48000);
      return frame / 48000;
    })();

    stems.forEach((stem, idx) => {
      const src = createdSources[idx]!;
      expect(src.buffer).toBe(buffers[stem]);
      expect(src.connect).toHaveBeenCalledWith(gains[stem]);
      expect(src.start).toHaveBeenCalledWith(expectedAudioTime, 0);
    });

    // 4. No event escaped to the event bus.
    expect(mockEventBus.emit).not.toHaveBeenCalled();
    // 5. MIDI schedulers were never touched.
    expect(noopMidiScheduler.schedule).not.toHaveBeenCalled();
  });

  it('skips audio-stem events with no registered stem (no source created, no MIDI scheduler invoked)', () => {
    // Register only "bass" — "drums" should fall through with no source.
    audioPlayerScheduler.setStem(
      'bass',
      createMockAudioBuffer(),
      createMockGainNode(),
    );
    router.setTransportStartTime(0);

    router.emitEvent(
      'audio-drums',
      {
        type: 'audio-stem',
        position: '0:0:0',
        data: { stemKey: 'drums' },
      },
      1.0,
    );

    // No source created (no buffer registered) — scheduler returns false.
    // EventRouter's emitToEventBus has no case for 'audio-*' so the event
    // is silently dropped on the legacy fallback path. The important
    // contract is "no MIDI scheduler is tricked into firing".
    expect(createdSources).toHaveLength(0);
    expect(noopMidiScheduler.schedule).not.toHaveBeenCalled();
  });
});
