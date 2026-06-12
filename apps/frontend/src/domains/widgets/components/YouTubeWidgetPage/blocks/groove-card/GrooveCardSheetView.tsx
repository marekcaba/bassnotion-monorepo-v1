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
  /** The groove card's read-head phase in [0,1), or null when not streaming.
   *  Sampled on a RAF loop to advance the score's playhead. */
  getAudioPhase?: () => number | null;
}

export function GrooveCardSheetView({
  notes,
  timeSignature = DEFAULT_TIME_SIGNATURE,
  bpm,
  lengthBars,
  isPlaying,
  getAudioPhase,
}: GrooveCardSheetViewProps) {
  const [position, setPosition] = useState<TransportPosition>({
    bars: 0,
    beats: 0,
    sixteenths: 0,
    ticks: 0,
  });

  // Advance the score playhead from the groove's own phase while playing.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying || !getAudioPhase) return;
    const beatsPerBar = timeSignature.numerator || 4;
    const tick = () => {
      const phase = getAudioPhase();
      if (phase != null) {
        setPosition(phaseToTransportPosition(phase, lengthBars, beatsPerBar));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, getAudioPhase, lengthBars, timeSignature.numerator]);

  if (!notes || notes.length === 0) {
    return (
      <div className="flex h-[150px] flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] text-center">
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
    <div className="overflow-hidden rounded-lg bg-white">
      <SheetMusicDisplay
        notes={notes}
        bpm={bpm}
        timeSignature={timeSignature}
        totalBars={lengthBars}
        isPlaying={isPlaying}
        currentPosition={position}
      />
    </div>
  );
}
