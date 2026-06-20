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
   *  turns buffer-relative onset times into absolute engine-clock times. */
  startedAtCtxTime: number;
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

  const startedAtCtxTime = ctx.currentTime;
  recorder.start();

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

  return { ctx, startedAtCtxTime, stop, dispose };
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
