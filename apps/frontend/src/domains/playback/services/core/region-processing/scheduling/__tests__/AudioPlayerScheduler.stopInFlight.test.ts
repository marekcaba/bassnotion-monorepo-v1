/**
 * AudioPlayerScheduler — setStem `stopInFlight` option (LAUNCH-02.5c).
 *
 * The seamless-routing-change path added for the pitch-shift work needs
 * setStem to update its stems map WITHOUT killing the currently-playing
 * source. Without `stopInFlight: false`, every routing toggle would
 * kill drums + click via the 5ms click-free ramp and they would not
 * recover until the next iter boundary (or longer for drums, which
 * aren't rearmed at all by the pitch-shift path).
 *
 * Verifies:
 *   - default behaviour (no option, or { stopInFlight: true }): stopStem
 *     IS called when replacing a stem
 *   - { stopInFlight: false }: stopStem is NOT called; the stems map IS
 *     updated; in-flight sources keep playing
 *   - the `input` parameter still defaults to `gain` when omitted (the
 *     pre-existing contract)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioPlayerScheduler } from '../AudioPlayerScheduler.js';

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
  const gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  return {
    gain,
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
    onended: null as
      | ((this: AudioBufferSourceNode, ev: Event) => unknown)
      | null,
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

describe('AudioPlayerScheduler — setStem stopInFlight option', () => {
  let scheduler: AudioPlayerScheduler;
  let audioContext: AudioContext;

  beforeEach(() => {
    scheduler = new AudioPlayerScheduler('test-instance');
    audioContext = createMockAudioContext();
    scheduler.setAudioContext(audioContext);
  });

  it('default behaviour: setStem REPLACES the stem entry AND stops in-flight sources via stopStem', () => {
    const buf1 = createMockAudioBuffer();
    const gain1 = createMockGainNode();
    scheduler.setStem('bass', buf1, gain1);

    // Schedule a source so there's an in-flight source to stop.
    const result = scheduler.schedule(
      {
        position: '0:0',
        type: 'audio',
        data: { stemKey: 'bass' },
      } as unknown as Parameters<typeof scheduler.schedule>[0],
      0.1,
      0,
    );
    expect(result).toBe(true);

    // Replace the stem — by default, stopStem should fire.
    const buf2 = createMockAudioBuffer();
    const gain2 = createMockGainNode();
    scheduler.setStem('bass', buf2, gain2);

    // The first gain's linearRampToValueAtTime should have been called
    // (that's stopStem's click-free ramp).
    const gain1Param = (
      gain1 as unknown as {
        gain: { linearRampToValueAtTime: ReturnType<typeof vi.fn> };
      }
    ).gain;
    expect(gain1Param.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('{ stopInFlight: true } explicit: same as default — stops in-flight sources', () => {
    const buf1 = createMockAudioBuffer();
    const gain1 = createMockGainNode();
    scheduler.setStem('bass', buf1, gain1);

    scheduler.schedule(
      {
        position: '0:0',
        type: 'audio',
        data: { stemKey: 'bass' },
      } as unknown as Parameters<typeof scheduler.schedule>[0],
      0.1,
      0,
    );

    const buf2 = createMockAudioBuffer();
    const gain2 = createMockGainNode();
    scheduler.setStem('bass', buf2, gain2, undefined, { stopInFlight: true });

    const gain1Param = (
      gain1 as unknown as {
        gain: { linearRampToValueAtTime: ReturnType<typeof vi.fn> };
      }
    ).gain;
    expect(gain1Param.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('{ stopInFlight: false }: REPLACES the stem entry but does NOT stop in-flight sources', () => {
    const buf1 = createMockAudioBuffer();
    const gain1 = createMockGainNode();
    scheduler.setStem('bass', buf1, gain1);

    scheduler.schedule(
      {
        position: '0:0',
        type: 'audio',
        data: { stemKey: 'bass' },
      } as unknown as Parameters<typeof scheduler.schedule>[0],
      0.1,
      0,
    );

    const buf2 = createMockAudioBuffer();
    const gain2 = createMockGainNode();
    scheduler.setStem('bass', buf2, gain2, undefined, { stopInFlight: false });

    // gain1's click-free ramp should NOT have fired.
    const gain1Param = (
      gain1 as unknown as {
        gain: { linearRampToValueAtTime: ReturnType<typeof vi.fn> };
      }
    ).gain;
    expect(gain1Param.linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it('{ stopInFlight: false } updates the stems map: a NEW schedule() call uses the new buffer + gain', () => {
    const buf1 = createMockAudioBuffer();
    const gain1 = createMockGainNode();
    scheduler.setStem('bass', buf1, gain1);

    const buf2 = createMockAudioBuffer();
    const gain2 = createMockGainNode();
    scheduler.setStem('bass', buf2, gain2, undefined, { stopInFlight: false });

    // Subsequent schedule should use the new buffer.
    scheduler.schedule(
      {
        position: '0:0',
        type: 'audio',
        data: { stemKey: 'bass' },
      } as unknown as Parameters<typeof scheduler.schedule>[0],
      0.1,
      0,
    );

    // The source returned by createBufferSource should have buffer === buf2.
    const createMock = (
      audioContext as unknown as {
        createBufferSource: ReturnType<typeof vi.fn>;
      }
    ).createBufferSource;
    const lastSource =
      createMock.mock.results[createMock.mock.results.length - 1]?.value;
    expect(lastSource?.buffer).toBe(buf2);
  });

  it('{ stopInFlight: false } + input parameter: the new input is used by subsequent connects', () => {
    const buf1 = createMockAudioBuffer();
    const gain1 = createMockGainNode();
    scheduler.setStem('bass', buf1, gain1);

    const buf2 = createMockAudioBuffer();
    const gain2 = createMockGainNode();
    const newInput = createMockGainNode(); // stand in for a SoundTouchNode
    scheduler.setStem('bass', buf2, gain2, newInput as unknown as AudioNode, {
      stopInFlight: false,
    });

    scheduler.schedule(
      {
        position: '0:0',
        type: 'audio',
        data: { stemKey: 'bass' },
      } as unknown as Parameters<typeof scheduler.schedule>[0],
      0.1,
      0,
    );

    const createMock = (
      audioContext as unknown as {
        createBufferSource: ReturnType<typeof vi.fn>;
      }
    ).createBufferSource;
    const lastSource =
      createMock.mock.results[createMock.mock.results.length - 1]?.value;
    // source.connect should have been called with the NEW input (not gain2).
    expect(lastSource?.connect).toHaveBeenCalledWith(newInput);
  });

  it('first setStem call (no prior entry): stopInFlight option is irrelevant — no source to stop', () => {
    const buf = createMockAudioBuffer();
    const gain = createMockGainNode();
    // Calling on a fresh scheduler — no prior stem registered.
    expect(() => {
      scheduler.setStem('bass', buf, gain, undefined, { stopInFlight: false });
    }).not.toThrow();
    expect(() => {
      scheduler.setStem('drums', buf, gain, undefined, { stopInFlight: true });
    }).not.toThrow();
  });

  it('input parameter still defaults to gain when omitted (pre-existing contract)', () => {
    const buf = createMockAudioBuffer();
    const gain = createMockGainNode();
    scheduler.setStem('bass', buf, gain); // no input arg

    scheduler.schedule(
      {
        position: '0:0',
        type: 'audio',
        data: { stemKey: 'bass' },
      } as unknown as Parameters<typeof scheduler.schedule>[0],
      0.1,
      0,
    );

    const createMock = (
      audioContext as unknown as {
        createBufferSource: ReturnType<typeof vi.fn>;
      }
    ).createBufferSource;
    const lastSource =
      createMock.mock.results[createMock.mock.results.length - 1]?.value;
    // source.connect should be called with gain (the default for input).
    expect(lastSource?.connect).toHaveBeenCalledWith(gain);
  });
});
