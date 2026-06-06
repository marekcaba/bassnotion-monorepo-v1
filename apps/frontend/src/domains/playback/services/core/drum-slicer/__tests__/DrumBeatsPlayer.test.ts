import { describe, it, expect } from 'vitest';
import { DrumBeatsPlayer } from '../DrumBeatsPlayer.js';

const SR = 48000;

/** Minimal fake AudioBuffer over per-channel Float32Arrays. */
function makeBuffer(channels: Float32Array[], sampleRate = SR): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0]!.length,
    sampleRate,
    duration: channels[0]!.length / sampleRate,
    getChannelData: (c: number) => channels[c]!,
    copyToChannel: (src: Float32Array, c: number) => {
      channels[c]!.set(src.subarray(0, channels[c]!.length));
    },
  } as unknown as AudioBuffer;
}

/** Fake AudioContext: only createBuffer is exercised by the render paths under test. */
function makeCtx(): AudioContext {
  return {
    currentTime: 0,
    sampleRate: SR,
    createBuffer: (numCh: number, len: number, sampleRate: number) => {
      const chans: Float32Array[] = [];
      for (let c = 0; c < numCh; c++) chans.push(new Float32Array(len));
      return makeBuffer(chans, sampleRate);
    },
  } as unknown as AudioContext;
}

/** Build a one-bar loop: a sharp click at each of `onsets` (s), then a low sine
 *  decay tail so there's something to loop. Mono. */
function makeDrumLoop(durationSec: number, onsets: number[]): Float32Array {
  const n = Math.round(durationSec * SR);
  const x = new Float32Array(n);
  for (const t of onsets) {
    const i0 = Math.round(t * SR);
    for (let k = 0; k < 80 && i0 + k < n; k++) {
      // sharp attack click
      x[i0 + k]! += Math.exp(-k / 12) * (k === 0 ? 1 : (k % 2 ? 0.8 : -0.8));
    }
    // a short tonal decay tail after the click (the loopable sustain)
    for (let k = 80; k < SR * 0.12 && i0 + k < n; k++) {
      x[i0 + k]! += 0.25 * Math.exp(-(k - 80) / (SR * 0.05)) * Math.sin((2 * Math.PI * 180 * k) / SR);
    }
  }
  return x;
}

describe('DrumBeatsPlayer', () => {
  it('detects multiple transients and builds one slice per onset', () => {
    const onsets = [0, 0.25, 0.5, 0.75];
    const data = makeDrumLoop(1.0, onsets);
    const player = new DrumBeatsPlayer(makeCtx(), makeBuffer([data]), {} as AudioNode, {
      loopDurationSeconds: 1.0,
    });
    const dbg = player.getDebugState();
    // Should find at least the 4 planted hits (origin always included).
    expect(dbg.sliceCount).toBeGreaterThanOrEqual(4);
    expect(dbg.onsetCount).toBeGreaterThanOrEqual(4);
    expect(dbg.ratio).toBe(1);
    expect(dbg.gapFillMode).toBe('loop-pingpong');
  });

  it('reports the engine defaults (pingpong gap fill, full transient envelope)', () => {
    const data = makeDrumLoop(1.0, [0, 0.5]);
    const player = new DrumBeatsPlayer(makeCtx(), makeBuffer([data]), {} as AudioNode, {
      loopDurationSeconds: 1.0,
    });
    const dbg = player.getDebugState();
    expect(dbg.gapFillMode).toBe('loop-pingpong');
    expect(dbg.transientEnvelope).toBe(1);
  });

  it('live setters change reported state', () => {
    const data = makeDrumLoop(1.0, [0, 0.5]);
    const player = new DrumBeatsPlayer(makeCtx(), makeBuffer([data]), {} as AudioNode, {
      loopDurationSeconds: 1.0,
    });
    player.setGapFillMode('gate');
    player.setTransientEnvelope(0.4);
    const dbg = player.getDebugState();
    expect(dbg.gapFillMode).toBe('gate');
    expect(dbg.transientEnvelope).toBeCloseTo(0.4, 5);
  });

  it('getNextDownbeat returns null when not playing', () => {
    const data = makeDrumLoop(1.0, [0, 0.5]);
    const player = new DrumBeatsPlayer(makeCtx(), makeBuffer([data]), {} as AudioNode, {
      loopDurationSeconds: 1.0,
    });
    expect(player.getNextDownbeat(0)).toBeNull();
  });

  it('clamps transient envelope to [0,1]', () => {
    const data = makeDrumLoop(1.0, [0, 0.5]);
    const player = new DrumBeatsPlayer(makeCtx(), makeBuffer([data]), {} as AudioNode, {
      loopDurationSeconds: 1.0,
    });
    player.setTransientEnvelope(5);
    expect(player.getDebugState().transientEnvelope).toBe(1);
    player.setTransientEnvelope(-2);
    expect(player.getDebugState().transientEnvelope).toBe(0);
  });

  it('handles a silent/degenerate buffer without throwing', () => {
    const data = new Float32Array(Math.round(0.5 * SR)); // all zeros
    expect(
      () =>
        new DrumBeatsPlayer(makeCtx(), makeBuffer([data]), {} as AudioNode, {
          loopDurationSeconds: 0.5,
        }),
    ).not.toThrow();
  });

  it('renderLoopBuffer reconstructs the original at ratio 1.0 (near-bit-exact)', () => {
    // Single-buffer architecture: rendering the whole loop at ratio 1.0 must reproduce
    // the source. Seam crossfades touch only a few ms at boundaries, so allow a small
    // tolerance; the body must match closely and the length must equal the loop.
    const onsets = [0, 0.13, 0.27, 0.41, 0.55, 0.7, 0.85];
    const data = makeDrumLoop(1.0, onsets);
    const player = new DrumBeatsPlayer(makeCtx(), makeBuffer([data]), {} as AudioNode, {
      loopDurationSeconds: 1.0,
    });
    const p = player as unknown as {
      renderLoopBuffer: (ratio: number) => AudioBuffer;
    };
    const buf = p.renderLoopBuffer(1.0);
    expect(buf.length).toBe(Math.round(1.0 * SR));
    const out = buf.getChannelData(0);
    // Most samples should match the source closely (crossfade regions are tiny).
    let close = 0;
    for (let i = 0; i < out.length; i++) {
      if (Math.abs(out[i]! - data[i]!) < 0.02) close++;
    }
    expect(close / out.length).toBeGreaterThan(0.9); // ≥90% within 0.02 of source
  });

  it('renderLoopBuffer at slow tempo does not introduce a hole vs the source gaps', () => {
    // A hole = the slow-tempo render is MORE silent than the source already was in the
    // same musical region. We compare the longest silence in the rendered (slowed) loop
    // against the source's own longest silence scaled by 1/ratio: gap-fill must not make
    // it worse. (The source's own dead air between hits is allowed to remain.)
    const onsets = [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84];
    const data = makeDrumLoop(1.0, onsets);
    const player = new DrumBeatsPlayer(makeCtx(), makeBuffer([data]), {} as AudioNode, {
      loopDurationSeconds: 1.0,
      gapFillMode: 'loop-forward',
    });
    const p = player as unknown as { renderLoopBuffer: (ratio: number) => AudioBuffer };
    const longestSilence = (x: Float32Array) => {
      let longest = 0;
      let run = 0;
      for (let i = 0; i < x.length; i++) {
        if (Math.abs(x[i]!) < 1e-4) longest = Math.max(longest, ++run);
        else run = 0;
      }
      return longest;
    };
    const ratio = 89 / 109;
    const buf = p.renderLoopBuffer(ratio);
    expect(buf.length).toBe(Math.round((1.0 / ratio) * SR));
    const srcSilence = longestSilence(data) / ratio; // source gap scaled to slow tempo
    const outSilence = longestSilence(buf.getChannelData(0));
    // The slowed render must not be MORE silent than the source's own (scaled) gap,
    // plus a small margin for the decay fade. If gap-fill left a hole this would blow up.
    expect(outSilence).toBeLessThan(srcSilence + Math.round(0.05 * SR));
  });

  it('renderLoopBuffer at slow tempo has NO large sample-step clicks at seams', () => {
    // The whole point of the single-buffer rewrite: every seam is an in-array crossfade,
    // so there are no inter-source discontinuities. The max single-sample step in the
    // rendered loop must stay within the source's own max step (×1.5 margin).
    const data = makeDrumLoop(1.0, [0, 0.13, 0.27, 0.41, 0.55, 0.7, 0.85]);
    const player = new DrumBeatsPlayer(makeCtx(), makeBuffer([data]), {} as AudioNode, {
      loopDurationSeconds: 1.0,
    });
    const p = player as unknown as { renderLoopBuffer: (ratio: number) => AudioBuffer };
    let srcMax = 0;
    for (let i = 1; i < data.length; i++) {
      srcMax = Math.max(srcMax, Math.abs(data[i]! - data[i - 1]!));
    }
    const out = p.renderLoopBuffer(89 / 109).getChannelData(0);
    let outMax = 0;
    for (let i = 1; i < out.length; i++) {
      outMax = Math.max(outMax, Math.abs(out[i]! - out[i - 1]!));
    }
    expect(outMax).toBeLessThanOrEqual(srcMax * 1.5 + 1e-6);
  });
});

// ── LIVE NUDGE (varispeed-during-drag, re-render-on-settle) ────────────────────
describe('DrumBeatsPlayer — live tempo nudge', () => {
  // Track playbackRate automation + how many sources/buffers were created, so we can
  // prove a DRAG varispeeds the existing source (no rebuild) and SETTLE re-renders.
  let createdBuffers: number;
  let createdSources: number;
  type RateParam = {
    value: number;
    setValueAtTime: (v: number, t: number) => void;
    setTargetAtTime: (v: number, t: number, tc: number) => void;
    linearRampToValueAtTime: (v: number, t: number) => void;
    cancelScheduledValues: (t: number) => void;
    _target?: number;
  };
  const sources: { rate: RateParam; stopped: boolean }[] = [];

  function liveCtx(): AudioContext {
    createdBuffers = 0;
    createdSources = 0;
    sources.length = 0;
    const mkParam = (v: number): RateParam => {
      const p: RateParam = {
        value: v,
        setValueAtTime(val: number) {
          this.value = val;
        },
        setTargetAtTime(val: number) {
          this._target = val; // where the varispeed is heading
        },
        linearRampToValueAtTime(val: number) {
          this.value = val;
        },
        cancelScheduledValues() {},
      };
      return p;
    };
    return {
      currentTime: 0,
      sampleRate: SR,
      createBuffer: (numCh: number, len: number, sampleRate: number) => {
        createdBuffers++;
        const chans: Float32Array[] = [];
        for (let c = 0; c < numCh; c++) chans.push(new Float32Array(len));
        return makeBuffer(chans, sampleRate);
      },
      createBufferSource: () => {
        createdSources++;
        const rate = mkParam(1);
        const entry = { rate, stopped: false };
        sources.push(entry);
        return {
          buffer: null,
          loop: false,
          playbackRate: rate,
          connect() {},
          start() {},
          stop() {
            entry.stopped = true;
          },
          addEventListener() {},
        } as unknown as AudioBufferSourceNode;
      },
      createGain: () =>
        ({
          gain: mkParam(1),
          connect() {},
          disconnect() {},
        }) as unknown as GainNode,
    } as unknown as AudioContext;
  }

  it('a DRAG varispeeds the live source (no rebuild per tick)', () => {
    const data = makeDrumLoop(1.0, [0, 0.25, 0.5, 0.75]);
    const player = new DrumBeatsPlayer(liveCtx(), makeBuffer([data]), {} as AudioNode, {
      loopDurationSeconds: 1.0,
    });
    player.start(0);
    const buffersAfterStart = createdBuffers;
    const sourcesAfterStart = createdSources;
    // Simulate a drag: many setRatio calls in quick succession (no settle between).
    for (let i = 1; i <= 15; i++) player.setRatio(1 - i * 0.012); // 1.0 → ~0.82
    // NO new buffers/sources during the drag — it's pure playbackRate automation.
    expect(createdBuffers).toBe(buffersAfterStart);
    expect(createdSources).toBe(sourcesAfterStart);
    // The live source's playbackRate is heading toward renderedRatio/finalRatio.
    const finalRatio = 1 - 15 * 0.012;
    const liveRate = sources[sources.length - 1]!.rate;
    const expected = 1 / finalRatio; // renderedRatio (1.0) / finalRatio
    expect(liveRate._target ?? liveRate.value).toBeCloseTo(expected, 2);
    player.stop(); // cancel the pending settle timer so it can't bleed into other tests
  });

  it('SETTLE re-renders pitch-correct and crossfades in a new source', async () => {
    const data = makeDrumLoop(1.0, [0, 0.25, 0.5, 0.75]);
    const player = new DrumBeatsPlayer(liveCtx(), makeBuffer([data]), {} as AudioNode, {
      loopDurationSeconds: 1.0,
    });
    player.start(0);
    const buffersAfterStart = createdBuffers;
    const sourcesAfterStart = createdSources;
    for (let i = 1; i <= 10; i++) player.setRatio(1 - i * 0.018);
    // During the drag: no rebuild.
    expect(createdBuffers).toBe(buffersAfterStart);
    // Wait past the settle debounce (130ms).
    await new Promise((r) => setTimeout(r, 200));
    // Settle fired: exactly ONE new buffer rendered + ONE new source crossfaded in.
    expect(createdBuffers).toBe(buffersAfterStart + 1);
    expect(createdSources).toBe(sourcesAfterStart + 1);
    // The new (settled) source plays at rate 1.0 (pitch-correct render).
    const settledSrc = sources[sources.length - 1]!.rate;
    expect(settledSrc.value).toBeCloseTo(1, 5);
    player.stop();
  });
});
