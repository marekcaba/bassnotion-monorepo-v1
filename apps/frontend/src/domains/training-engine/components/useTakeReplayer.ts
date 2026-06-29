'use client';

/**
 * useTakeReplayer — play a submitted take "in context": the recorded bass clip + the BACKING that
 * was sounding under it while recording (the metronome click + any stems — a drone pad, a drum
 * loop, …), rebuilt from the take's PlaybackContext (backingLayers + preRollSec).
 *
 * NO UI engine. This is audio-only — it doesn't mount the 3D fretboard, the Scales tool, or the
 * scale sequencer. It owns its OWN short-lived AudioContext, fetches the clip + the stem files +
 * the platform's real metronome SAMPLES, starts everything aligned to the recorded grid, and loops
 * the backing under the clip. Stop tears it all down.
 *
 * REPRODUCE THE EXPERIENCE EXACTLY — the student heard a FULL count-in (countInBeats), then the
 * exercise. Replay reproduces THAT: a full rebuilt count-in, then the bass on the downbeat. The
 * recording itself is ragged at the head — getUserMedia can arm the recorder a beat or two late,
 * so the clip's beat-0 sits `preRollSec` into the clip and the captured count-in is partial. That
 * head is NOT the count-in we play; we use `preRollSec` only to TRIM the clip to its true beat-0,
 * then place that on the count-in's end. Nothing is time-stretched or repositioned — the bass
 * lands on the downbeat exactly as it was played.
 *
 * ROBUST BY DESIGN: it reads a generic BackingLayer[] — a 'stem' is any looped file, a 'click' is
 * the metronome by params (rebuilt from the REAL Click_Low2/High2.mp3 samples). A future station
 * just stores different layers; this player needs no change. A stem/sample that 404s is skipped.
 */

import React from 'react';
import type { BackingLayer } from '@bassnotion/contracts';
import { getLogger } from '@/utils/logger.js';
import {
  CLICK_LOW_URL,
  CLICK_HIGH_URL,
  loadBuffer,
  scheduleTakePlayback,
} from './takePlaybackSchedule';

const logger = getLogger('useTakeReplayer');

interface ActivePlayback {
  ctx: AudioContext;
  sources: AudioBufferSourceNode[];
  teardown: () => void;
}

export type ReplayStatus = 'idle' | 'loading' | 'playing';

export interface UseTakeReplayer {
  status: ReplayStatus;
  /** Start in-context playback (clip + backing). No-op if already playing. */
  play: () => Promise<void>;
  /** Stop + tear down. */
  stop: () => void;
}

/**
 * @param audioUrl   the take's recorded bass clip (a signed URL), or null if unavailable.
 * @param backing    the backing layers that were sounding under it (click + stems), or null.
 * @param preRollSec seconds of clip before the take's beat 0 (the count-in pre-roll). Default 0.
 */
export function useTakeReplayer(
  audioUrl: string | null,
  backing: BackingLayer[] | null | undefined,
  preRollSec?: number | null,
): UseTakeReplayer {
  const [status, setStatus] = React.useState<ReplayStatus>('idle');
  const activeRef = React.useRef<ActivePlayback | null>(null);

  const stop = React.useCallback(() => {
    activeRef.current?.teardown();
    activeRef.current = null;
    setStatus('idle');
  }, []);

  // Tear down on unmount (navigating away mid-play must not leak audio).
  React.useEffect(() => () => stop(), [stop]);

  const play = React.useCallback(async () => {
    if (activeRef.current) return; // already playing
    if (!audioUrl) return;

    setStatus('loading');
    const ctx = new AudioContext();

    const clickLayer = (backing ?? []).find(
      (l): l is Extract<BackingLayer, { kind: 'click' }> => l.kind === 'click',
    );
    const stemLayers = (backing ?? []).filter(
      (l): l is Extract<BackingLayer, { kind: 'stem' }> => l.kind === 'stem',
    );

    // Load the clip (the spine), the stems, and — if there's a click layer — the real click
    // samples, all in parallel. Any miss → null (skipped), exactly like the recording was dry.
    const [clipBuffer, stemBuffers, clickLow, clickHigh] = await Promise.all([
      loadBuffer(ctx, audioUrl),
      Promise.all(
        stemLayers.map(async (l) => ({
          layer: l,
          buffer: await loadBuffer(ctx, l.url),
        })),
      ),
      clickLayer ? loadBuffer(ctx, CLICK_LOW_URL) : Promise.resolve(null),
      clickLayer ? loadBuffer(ctx, CLICK_HIGH_URL) : Promise.resolve(null),
    ]);

    if (!clipBuffer) {
      logger.warn('Take clip failed to load — nothing to replay');
      await ctx.close().catch(() => {});
      setStatus('idle');
      return;
    }

    // A stop request may have arrived during the awaits — bail cleanly.
    if (activeRef.current) {
      await ctx.close().catch(() => {});
      return;
    }

    // Schedule via the shared scheduler (scheduleTakePlayback): clip trimmed to its grid beat 0,
    // placed at the rebuilt count-in's downbeat, with the click + stems under it.
    const start = ctx.currentTime + 0.12; // lead so all sources arm before playback
    const { sources } = scheduleTakePlayback(ctx, start, {
      clipBuffer,
      stemBuffers,
      clickLayer,
      clickLow,
      clickHigh,
      preRollSec,
    });
    const clipSrc = sources[0]!; // the bass clip is always scheduled first

    const teardown = () => {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      }
      ctx.close().catch(() => {});
    };

    // When the clip finishes, auto-stop (return to idle) so the play button resets.
    clipSrc.onended = () => {
      if (activeRef.current?.ctx === ctx) {
        teardown();
        activeRef.current = null;
        setStatus('idle');
      }
    };

    activeRef.current = { ctx, sources, teardown };
    setStatus('playing');
  }, [audioUrl, backing, preRollSec]);

  return { status, play, stop };
}
