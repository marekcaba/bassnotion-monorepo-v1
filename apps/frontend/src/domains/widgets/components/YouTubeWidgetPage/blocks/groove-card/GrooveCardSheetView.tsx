'use client';

/**
 * GrooveCardSheetView — the bass-clef sheet-music alternative to the groove
 * card's waveform. Fills the SAME window slot; the header toggle switches
 * between them.
 *
 * It wraps the shared {@link SheetMusicDisplay} (OSMD-based, fully prop-driven —
 * no global TransportContext coupling) and feeds it the groove card's OWN
 * playback position: a RAF loop samples `getAudioPhase()` while playing and
 * converts it to a TransportPosition via {@link phaseToTransportPosition}, so
 * the score's playhead follows the same clock as the waveform.
 *
 * Empty state: when the groove has no authored notation, it shows a "no
 * notation yet" placeholder instead of an empty score (the toggle still works).
 */

import { useEffect, useRef, useState } from 'react';
import type { ExerciseNote, TimeSignature } from '@bassnotion/contracts';
import { Music4 } from 'lucide-react';
import { SheetMusicDisplay } from '@/domains/widgets/components/SheetMusic';
import type { TransportPosition } from '@/domains/widgets/components/SheetMusic/utils/positionMapBuilder';
import { phaseToTransportPosition } from './grooveSheetPosition';

const DEFAULT_TIME_SIGNATURE: TimeSignature = {
  numerator: 4,
  denominator: 4,
};

// Match the waveform slot's TOTAL height so toggling between the waveform and the
// sheet keeps the card's window the same height. The waveform is a flex column of:
//   canvas h-32 (128px) + gap-1 (4px) + bar-number ruler h-3 (12px) = 144px.
// The sheet has no ruler, so it just fills the full 144px.
const SHEET_HEIGHT_PX = 144;

export interface GrooveCardSheetViewProps {
  /** Pre-parsed bass-line notes (from the groove's bassNotation), or undefined
   *  when none has been authored → empty state. */
  notes?: ExerciseNote[];
  /** Time signature of the notation (defaults to 4/4). */
  timeSignature?: TimeSignature;
  /** Display tempo (the groove's original BPM). */
  bpm: number;
  /** Loop length in bars (for the phase → position conversion). */
  lengthBars: number;
  /** Whether the groove is currently playing (drives the score's cursor). */
  isPlaying: boolean;
  /** True during the 4-beat count-in (before the loop actually starts). The
   *  read-head phase is parked near the loop end during this window, so we hold
   *  the score playhead at the start until the count-in finishes. */
  isCountingIn?: boolean;
  /** The groove card's read-head phase in [0,1), or null when not streaming.
   *  Sampled on a RAF loop to advance the score's playhead. */
  getAudioPhase?: () => number | null;
}

const START_POSITION: TransportPosition = {
  bars: 0,
  beats: 1, // 1-indexed downbeat (SheetMusicDisplay convention)
  sixteenths: 0,
  ticks: 0,
};

export function GrooveCardSheetView({
  notes,
  timeSignature = DEFAULT_TIME_SIGNATURE,
  bpm,
  lengthBars,
  isPlaying,
  isCountingIn = false,
  getAudioPhase,
}: GrooveCardSheetViewProps) {
  const [position, setPosition] = useState<TransportPosition>(START_POSITION);

  // Advance the score playhead from the groove's own phase while playing.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    // While counting in (or not playing), the read-head phase is parked near the
    // loop END — driving the score off that would jump it to the end. Hold the
    // playhead at the start and don't sample phase until the count-in finishes.
    if (!isPlaying || isCountingIn || !getAudioPhase) {
      setPosition(START_POSITION);
      return;
    }
    const beatsPerBar = timeSignature.numerator || 4;

    // Brief post-count-in wrap guard: even after the count-in, the latency-
    // compensated phase can still report ≈0.9+ for the first frame or two at the
    // loop origin. While the phase is in that wrapped-near-end zone (> 0.5) AND
    // we've only just started, park at the start; release once it climbs from 0.
    let released = false;
    const tick = () => {
      const raw = getAudioPhase();
      if (raw != null) {
        if (!released) {
          if (raw > 0.5) {
            // still wrapped near the end → hold at the start
            setPosition(START_POSITION);
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          released = true; // phase has come round to the start; track from here
        }
        setPosition(phaseToTransportPosition(raw, lengthBars, beatsPerBar));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [
    isPlaying,
    isCountingIn,
    getAudioPhase,
    lengthBars,
    timeSignature.numerator,
  ]);

  if (!notes || notes.length === 0) {
    // Match the waveform slot's total height (h-36 = 144px) so toggling between
    // the two views doesn't change the card's window height.
    return (
      <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] text-center">
        <Music4 className="h-6 w-6 text-white/25" aria-hidden />
        <p className="text-xs text-white/40">No bass notation yet</p>
        <p className="text-[10px] text-white/25">
          Import a MusicXML / MIDI score in the editor to show the bass line
          here.
        </p>
      </div>
    );
  }

  return (
    // Fixed height matching the waveform slot (canvas + gap + ruler = h-36/144px)
    // so the toggle between waveform and sheet keeps the card window the SAME height.
    <div className="h-36 overflow-hidden rounded-lg bg-white">
      <SheetMusicDisplay
        notes={notes}
        bpm={bpm}
        timeSignature={timeSignature}
        totalBars={lengthBars}
        isPlaying={isPlaying}
        currentPosition={position}
        height={SHEET_HEIGHT_PX}
      />
    </div>
  );
}
