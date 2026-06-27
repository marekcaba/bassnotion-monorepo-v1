'use client';

/**
 * ScaleFretboardWindow — the Scales tool's main-window view: the production 3D
 * fretboard (Ring3DOverlayCanvas) showing the selected scale, lit up in time when
 * playing. Drops into the GrooveCardShell's `waveform` slot in place of the waveform.
 *
 * The active-note highlight is driven by the global AtomicPlaybackClock (proven in
 * the spike), which the groove-card transport already starts — so this just needs
 * the generated scale + isPlaying + tempo; it rides the same clock as the audio.
 */

import React from 'react';
import { Ring3DOverlayCanvas } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/overlays/Ring3DOverlayCanvas';
import { DEFAULT_RING_CONFIG } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/overlays/RingOverlayConfig';
import type { PitchClass, ScaleType, StringCount } from './scaleGenerator';
import { buildNoteUniverse, selectBox } from './noteUniverse';
import {
  getFretboardOverlayConfig,
  FRETBOARD_CANVAS_HEIGHT,
  FRETBOARD_WINDOW,
} from './fretboardViewConfig';
import {
  // FretboardCalibrationPanel,  // ← uncomment (+ the mount below) to re-calibrate
  CALIBRATION_ENABLED,
  type FretboardCalibrationValues,
} from './FretboardCalibrationPanel';

export interface ScaleFretboardWindowProps {
  root: PitchClass;
  scaleType: ScaleType;
  stringCount: StringCount;
  maxFrets: number;
  isPlaying: boolean;
  tempo: number;
  /** What to show: a box POSITION number (1 = root box), or 'whole' for the entire
   *  scale across the neck. Default 1. */
  view?: number | 'whole';
  /** Admin-authored box shapes to preview (the editor's LIVE draft), overriding the
   *  in-code seed. Absent in the player — it uses the seed/server blueprint. */
  blueprintOverride?: { positions: { positionNumber: number; startFretOffset: number; span: number }[] };
}

export function ScaleFretboardWindow({
  root,
  scaleType,
  stringCount,
  maxFrets,
  isPlaying,
  tempo,
  view = 1,
  blueprintOverride,
}: ScaleFretboardWindowProps) {
  // Build the full note universe for the user's neck, then show either ONE box position
  // (a real fingering across the strings) or the WHOLE scale. Each note → one beat (the
  // play-along sequence steps through it).
  const { exerciseNotes, rootPositions } = React.useMemo(() => {
    const fretboard = { stringCount, maxFrets };
    const universe = buildNoteUniverse(fretboard, root, scaleType);
    const shown =
      view === 'whole'
        ? universe
        : selectBox(
            universe,
            fretboard,
            root,
            scaleType,
            view,
            blueprintOverride,
          );
    return {
      exerciseNotes: shown.map((n, i) => ({
        string: n.string,
        fret: n.fret,
        duration: '4n',
        position: { measure: Math.floor(i / 4) + 1, beat: (i % 4) + 1 },
      })),
      // Root notes (string+fret) so the canvas can paint them a DARKER green — the scale's
      // home note stands out from the rest of the shape.
      rootPositions: shown
        .filter((n) => n.isRoot)
        .map((n) => ({ string: n.string, fret: n.fret })),
    };
  }, [root, scaleType, stringCount, maxFrets, view, blueprintOverride]);

  // Enable the ring overlay (DEFAULT has enabled:false) so the active-note highlight
  // shows; the dots themselves come from exerciseNotes.
  const ringConfig = React.useMemo(
    () => ({ ...DEFAULT_RING_CONFIG, enabled: true }),
    [],
  );

  // Same calibrated scene config + sizing as the tutorial fretboard, so the
  // proportions match (string-count-dependent sceneX included).
  const baseConfig = React.useMemo(
    () => getFretboardOverlayConfig(stringCount),
    [stringCount],
  );

  // DEV calibration: live overrides for the centering/fade params, seeded from the
  // base config. When CALIBRATION_ENABLED, the panel adjusts these live; otherwise
  // the base config is used as-is.
  // `setCal` unused while the panel is commented out; restore on re-calibration.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [cal, setCal] = React.useState<FretboardCalibrationValues>(() => ({
    sceneX: baseConfig.sceneX,
    offsetX: baseConfig.offsetX,
    tiltAxisOffsetX: baseConfig.tiltAxisOffsetX,
    contentScale: baseConfig.contentScale,
    contentScaleX: baseConfig.contentScaleX,
    leftFadeZone: baseConfig.leftFadeZone,
    rightFadeZone: baseConfig.rightFadeZone,
    viewportWidth: FRETBOARD_WINDOW.viewportWidth,
    windowHeight: FRETBOARD_CANVAS_HEIGHT,
  }));

  // Scene config (inside the canvas): base, with live calibration overrides when on.
  const overlay3DConfig = React.useMemo(() => {
    if (!CALIBRATION_ENABLED) return baseConfig;
    // Only the scene fields go to the overlay (window fields are applied to the div).
    const {
      sceneX,
      offsetX,
      tiltAxisOffsetX,
      contentScale,
      contentScaleX,
      leftFadeZone,
      rightFadeZone,
    } = cal;
    return {
      ...baseConfig,
      sceneX,
      offsetX,
      tiltAxisOffsetX,
      contentScale,
      contentScaleX,
      leftFadeZone,
      rightFadeZone,
    };
  }, [baseConfig, cal]);

  // PRIMARY WINDOW WIDTH = the inner canvas width (the thing whose right edge hard-cuts
  // the fretboard). Widening it moves the right cut RIGHT → more frets visible. The
  // content is centered on viewportWidth, so widening alone shifts it right; we cancel
  // that by pulling sceneX left by half the extra width → LEFT EDGE STAYS ANCHORED,
  // right edge extends. The outer box grows to fit so the wider canvas isn't clipped.
  const viewportWidth = CALIBRATION_ENABLED
    ? cal.viewportWidth
    : FRETBOARD_WINDOW.viewportWidth;
  const height = CALIBRATION_ENABLED
    ? cal.windowHeight
    : FRETBOARD_CANVAS_HEIGHT;
  // The canvas renders `viewportWidth` px wide (wider than the 580 base to show more
  // frets). We DON'T grow the outer box past 100% — doing so makes it wider than the
  // centered max-w card, and the page's `justify-center` then splits the overflow both
  // ways, shoving the left edge off-screen (the nut clips). Instead the box stays 100%
  // and the wider canvas overflows symmetrically (overflow:visible), so the scene stays
  // centered in the card. No sceneX anchor-pull needed — centering is symmetric now.
  const anchoredConfig = overlay3DConfig;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: 'transparent',
        overflow: 'visible',
      }}
    >
      {/* DEV calibration panel — commented out (values baked into fretboardViewConfig.ts).
          To re-calibrate: uncomment this + the import above, and set
          NEXT_PUBLIC_FRETBOARD_CALIBRATION=true in .env.local. (Panel is draggable.) */}
      {/* <FretboardCalibrationPanel values={cal} onChange={setCal} /> */}
      <Ring3DOverlayCanvas
        exerciseNotes={exerciseNotes}
        currentTime={0}
        isPlaying={isPlaying}
        config={ringConfig}
        stringCount={stringCount}
        maxFrets={maxFrets}
        tempo={tempo}
        overlay3DConfig={anchoredConfig}
        viewportWidthOverride={viewportWidth}
        // Light the WHOLE scale at once (the scale shape), not a moving lookahead
        // window — the active note still emphasizes as the sequence plays.
        showAllNotes
        // Root notes paint a DARKER green so the scale's home note stands out.
        rootPositions={rootPositions}
      />
    </div>
  );
}
