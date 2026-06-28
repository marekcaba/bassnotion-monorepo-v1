/**
 * captureBassInput — mic capture lifecycle for the timing-mirror spike (Step 3).
 *
 * getUserMedia (raw: AGC/NS/EC OFF — they destroy a bass signal) → MediaStreamSource
 * on the ENGINE's AudioContext (so the recording shares the groove clock) →
 * MediaRecorder → decode to a mono Float32Array for offline onset detection.
 *
 * AudioContext-lifecycle landmines this module handles (from the spike audit/probes;
 * see docs/TIMING_MIRROR_SPIKE_PLAN.md §6 + the audiocontext-global-unification history):
 *   - Source the context from WindowRegistry.getAudioContext() AT capture time —
 *     never `new AudioContext()` (a private context measures a DIFFERENT clock than
 *     the audible groove → onset-vs-beat math meaningless), never cache it across
 *     play sessions.
 *   - A MediaStreamSource is bound to ONE context for life. The engine can close()
 *     its context (ErrorRecovery / teardown). Subscribe to onGlobalStateChange and
 *     tear down on 'closed' — a node on a dead context silently produces nothing.
 *   - context.close() does NOT stop MediaStream tracks. We MUST call track.stop()
 *     ourselves on teardown or the OS mic indicator (and the input) leak across an
 *     engine restart.
 *
 * Browser/mic-dependent → verified live in-app, not unit-tested (unlike the pure
 * clock-bridge + onset modules). The decode helper is split out so it stays testable.
 */

import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { AudioContextManager } from '@/domains/playback/modules/audio-engine/core/AudioContextManager.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('captureBassInput');

/** Raw-signal constraints. The triad MUST be off — echo cancellation / AGC /
 *  noise suppression each mangle a bass DI signal. Verbatim from the proven
 *  capture path (docs/dev-tools/recording-latency). */
const RAW_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  autoGainControl: false,
  noiseSuppression: false,
  channelCount: 1,
};

export interface BassCapture {
  /** The engine AudioContext the capture is bound to (the groove clock). */
  ctx: AudioContext;
  /** audioContext.currentTime at the moment recording started — the offset that
   *  turns buffer-relative onset times into absolute engine-clock times.
   *  ALREADY latency-compensated: see inputLatencySec. A note plucked at real
   *  ctx-time T lands in the recorded buffer at offset (T − startedAtCtxTime),
   *  because we PULLED this anchor BACK by inputLatencySec so the file's sample-0
   *  maps to the real moment the audio entered the interface, not the later moment
   *  the recorder received it. */
  startedAtCtxTime: number;
  /** The input round-trip latency (seconds) we subtracted from the start anchor —
   *  the interface→OS→browser-capture delay that the recorded file carries but the
   *  player can't HEAR (they monitor zero-latency through the interface). This is
   *  what made every detected onset land LATE vs the (latency-free) reference. */
  inputLatencySec: number;
  /** Stop recording and return the captured mono samples + the engine sample rate.
   *  Resolves with null if nothing was captured. */
  stop: () => Promise<{ signal: Float32Array; sampleRate: number } | null>;
  /** Tear down WITHOUT returning audio (release mic + nodes). Idempotent. */
  dispose: () => void;
}

/**
 * Begin capturing bass input on the engine's AudioContext. Call this from inside
 * a user gesture (the same one that resumed the context / granted permission).
 *
 * @param onContextLost called if the engine context closes mid-capture (the panel
 *        should surface "recording interrupted — context restarted" and let the
 *        user re-arm). The capture is auto-disposed before this fires.
 */
export async function startBassCapture(
  onContextLost?: () => void,
): Promise<BassCapture> {
  const ctx = WindowRegistry.getAudioContext();
  if (!ctx || ctx.state === 'closed') {
    throw new Error(
      'No live engine AudioContext — press the card ▶ Play once so the engine boots its context, then arm.',
    );
  }
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: RAW_AUDIO_CONSTRAINTS,
  });

  // Bind the source to THIS context. The context can close DURING the awaited
  // getUserMedia above (a real race), so re-read state fresh. TS narrows ctx.state
  // from the earlier guards and won't reset across the await, so read it through a
  // helper that returns the un-narrowed runtime value.
  if (readState(ctx) === 'closed') {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('Engine context closed while opening the mic — re-arm.');
  }

  const source = ctx.createMediaStreamSource(stream);
  const recorder = new MediaRecorder(stream);

  // INPUT-LATENCY compensation — the fix for "my transients show up late even
  // though I played spot-on". The recorded file carries the input round-trip
  // delay (interface buffer → OS → browser capture graph). The player NEVER hears
  // this: they monitor zero-latency through the interface, so bass + backing are
  // in sync in their phones. But that delay shifts every captured sample LATER in
  // real time than `ctx.currentTime` at recorder.start() assumes → every detected
  // onset lands late vs the latency-free reference. We measure it and PULL the
  // start anchor back by it, so the buffer's sample-0 maps to the real moment the
  // audio entered the rig.
  //
  //   inputLatency ≈ ctx.baseLatency (the capture-graph processing buffer)
  //                + the device's own input latency (track.getSettings().latency,
  //                  seconds — present on Chromium for many interfaces).
  // Both are best-effort: absent values default to 0 and we fall back to the
  // per-take gross-offset calibration that already runs downstream.
  const inputLatencySec = measureInputLatency(ctx, stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  let disposed = false;
  let unsubscribe: (() => void) | undefined;

  const releaseNodes = () => {
    try {
      source.disconnect();
    } catch {
      /* already disconnected */
    }
    // close() does NOT stop tracks — do it explicitly or the mic indicator leaks.
    stream.getTracks().forEach((t) => t.stop());
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe?.();
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    releaseNodes();
  };

  // If the engine closes its context mid-capture, the source is dead — tear down
  // and notify. (Only react to 'closed'; 'suspended'/'running' are normal.)
  unsubscribe = AudioContextManager.onGlobalStateChange((state) => {
    if (state === 'closed' && !disposed) {
      logger.warn('Engine context closed mid-capture — disposing capture');
      dispose();
      onContextLost?.();
    }
  });

  // Pull the anchor BACK by the input latency so buffer-time 0 = the real moment
  // the audio entered the interface (not the later moment the recorder saw it).
  const startedAtCtxTime = ctx.currentTime - inputLatencySec;
  recorder.start();
  logger.info('Bass capture armed', {
    inputLatencyMs: Math.round(inputLatencySec * 1000),
    baseLatencyMs: Math.round((ctx.baseLatency ?? 0) * 1000),
  });

  const stop = (): Promise<{ signal: Float32Array; sampleRate: number } | null> =>
    new Promise((resolve) => {
      if (disposed || recorder.state === 'inactive') {
        dispose();
        resolve(null);
        return;
      }
      recorder.onstop = async () => {
        try {
          if (chunks.length === 0) {
            resolve(null);
            return;
          }
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const arrayBuf = await blob.arrayBuffer();
          // Decode on the SAME ctx (matches its sample rate). If the ctx died
          // between stop() and decode, fall back gracefully.
          if (readState(ctx) === 'closed') {
            resolve(null);
            return;
          }
          const audioBuf = await ctx.decodeAudioData(arrayBuf);
          resolve({
            signal: toMono(audioBuf),
            sampleRate: audioBuf.sampleRate,
          });
        } catch (err) {
          logger.error('Failed to decode captured take', err);
          resolve(null);
        } finally {
          dispose();
        }
      };
      recorder.stop();
    });

  return { ctx, startedAtCtxTime, inputLatencySec, stop, dispose };
}

/**
 * Best-effort input round-trip latency (seconds) for a capture: the delay between
 * audio entering the interface and the recorder/graph receiving it. We subtract
 * this from the start anchor so detected onsets land on the real play-time, not
 * `latency` later.
 *
 *   ctx.baseLatency            — the AudioContext's own processing buffer (output
 *                                side, but it's the graph's block latency and the
 *                                closest proxy the spec gives us for the capture
 *                                graph; typically ~3–12ms).
 *   track.getSettings().latency — the input DEVICE's latency in SECONDS (Media
 *                                Track spec; Chromium reports it for many real
 *                                interfaces — a Clarett commonly ~20–40ms). This
 *                                is the big one and the part that varies by rig.
 *
 * Anything unavailable contributes 0; the downstream per-take gross-offset
 * calibration still mops up whatever this can't measure, so over/under-shoot here
 * degrades gracefully rather than breaking the score.
 */
function measureInputLatency(ctx: AudioContext, stream: MediaStream): number {
  const base = typeof ctx.baseLatency === 'number' ? ctx.baseLatency : 0;
  let deviceLatency = 0;
  try {
    const track = stream.getAudioTracks()[0];
    // `latency` is in SECONDS per the MediaTrackSettings spec; not in the TS lib's
    // MediaTrackSettings type yet, so read it through a widened view.
    const settings = track?.getSettings() as
      | (MediaTrackSettings & { latency?: number })
      | undefined;
    if (settings && typeof settings.latency === 'number' && settings.latency > 0) {
      deviceLatency = settings.latency;
    }
  } catch {
    /* getSettings unsupported — fall back to baseLatency only */
  }
  return base + deviceLatency;
}

/** Read ctx.state as a runtime value WITHOUT TS's control-flow narrowing. Earlier
 *  `=== 'closed'` guards make TS believe state can never be 'closed' again, but it
 *  can change across an awaited boundary (the engine may close the context). This
 *  returns the live value so post-await re-checks aren't compiled away. */
function readState(ctx: AudioContext): AudioContextState {
  return (ctx as { state: AudioContextState }).state;
}

/** Downmix an AudioBuffer to a single mono Float32Array (average of channels). */
export function toMono(buffer: AudioBuffer): Float32Array {
  const ch = buffer.numberOfChannels;
  if (ch === 1) return buffer.getChannelData(0).slice();
  const len = buffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) out[i]! += data[i]! / ch;
  }
  return out;
}
