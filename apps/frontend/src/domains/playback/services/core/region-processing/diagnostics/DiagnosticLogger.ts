/**
 * DiagnosticLogger - CC64 diagnostic tables and MIDI utilities
 *
 * Provides diagnostic logging for:
 * - CC64 sustain pedal timeline visualization
 * - Note extension calculations
 * - MIDI note name conversion
 */

// Helper to get Tone from window (must be initialized before DiagnosticLogger is used)
function getTone(): NonNullable<typeof window.Tone> {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error(
    'DiagnosticLogger: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}

export class DiagnosticLogger {
  private instanceId: string;
  private transportStartTime = 0;
  private countdownEnabled = false;
  private countdownOffsetBeats = 0;
  private currentCC64Timeline: Map<number, boolean>;
  private parsePosition: (position: string) => number;
  private findCC64DownDuringNote: (
    noteStart: number,
    noteEnd: number,
    timeline: Map<number, boolean>,
  ) => number | null;
  private findNextCC64Up: (
    fromTime: number,
    timeline: Map<number, boolean>,
  ) => number | null;

  constructor(
    instanceId: string,
    currentCC64Timeline: Map<number, boolean>,
    parsePosition: (position: string) => number,
    findCC64DownDuringNote: (
      noteStart: number,
      noteEnd: number,
      timeline: Map<number, boolean>,
    ) => number | null,
    findNextCC64Up: (
      fromTime: number,
      timeline: Map<number, boolean>,
    ) => number | null,
  ) {
    this.instanceId = instanceId;
    this.currentCC64Timeline = currentCC64Timeline;
    this.parsePosition = parsePosition;
    this.findCC64DownDuringNote = findCC64DownDuringNote;
    this.findNextCC64Up = findNextCC64Up;
  }

  /**
   * Set transport start time for audio time calculations
   */
  setTransportStartTime(time: number): void {
    this.transportStartTime = time;
  }

  /**
   * Set countdown configuration
   */
  setCountdown(enabled: boolean, offsetBeats: number): void {
    this.countdownEnabled = enabled;
    this.countdownOffsetBeats = offsetBeats;
  }

  /**
   * Convert MIDI note number to note name (e.g., 60 → "C4")
   */
  midiNoteToName(midiNote: number): string {
    const noteNames = [
      'C',
      'Cs',
      'D',
      'Ds',
      'E',
      'F',
      'Fs',
      'G',
      'Gs',
      'A',
      'As',
      'B',
    ];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = midiNote % 12;
    return noteNames[noteIndex] + octave;
  }

  /**
   * CC64 COMPREHENSIVE DIAGNOSTIC TABLE
   * Shows exact numbers from database and how CC64 extends each note
   */
  logCC64DiagnosticTable(
    sortedEvents: any[],
    region: { id: string; startTime: number; skipCountdownOffset?: boolean },
  ): void {
    // eslint-disable-next-line no-console
    console.log('\n' + '='.repeat(120));
    // eslint-disable-next-line no-console
    console.log('CC64 SUSTAIN PEDAL DIAGNOSTIC - SHOWING EXACT CALCULATIONS');
    // eslint-disable-next-line no-console
    console.log('='.repeat(120));

    // Extract harmony notes with their MIDI durations
    const harmonyNotes: Array<{
      noteName: string;
      audioTime: number;
      midiDuration: number;
      midiEndTime: number;
    }> = [];

    // Get Tone once for all calculations in this method
    const Tone = getTone();

    let noteIndex = 0;
    sortedEvents.forEach((event) => {
      if (event.data?.midiNote !== undefined) {
        // 🚨 CRITICAL FIX: Use absolute ticks for note timing (same as CC64 events)
        let eventTime: number;
        if (event.data?.ticks !== undefined) {
          // Use absolute ticks if available (new method)
          // 🚨 CRITICAL FIX: Use original MIDI file BPM, not current transport BPM
          const originalBpm =
            event.data?.originalBpm || Tone.getTransport().bpm.value;
          const secondsPerBeat = 60 / originalBpm;
          const ticksPerBeat = 480; // PPQ standard
          eventTime = (event.data.ticks / ticksPerBeat) * secondsPerBeat;
        } else {
          // Fallback to position parsing (old method)
          eventTime = this.parsePosition(event.position);
        }

        const offsetTime =
          this.countdownEnabled && !region.skipCountdownOffset
            ? this.countdownOffsetBeats * (60 / Tone.getTransport().bpm.value)
            : 0;
        const absoluteTime = region.startTime + eventTime + offsetTime;
        const audioTime = this.transportStartTime + absoluteTime;

        // DIAGNOSTIC: Log note 9 calculation in CC64 table
        if (noteIndex === 8) {
          // eslint-disable-next-line no-console
          console.log('[CC64 TABLE] Note 9 calculation:', {
            ticks: event.data.ticks,
            eventTime,
            offsetTime,
            'region.startTime': region.startTime,
            absoluteTime,
            'this.transportStartTime': this.transportStartTime,
            audioTime,
            noteName: this.midiNoteToName(event.data.midiNote - 12),
          });
        }
        noteIndex++;

        // Parse MIDI note to note name (apply same -12 octave shift as in playback)
        const midiNote = event.data.midiNote - 12;
        const noteName = this.midiNoteToName(midiNote);

        // Duration is already in seconds (not Tone.js position format)
        const duration =
          typeof event.duration === 'number' ? event.duration : 0.5;

        harmonyNotes.push({
          noteName,
          audioTime,
          midiDuration: duration,
          midiEndTime: audioTime + duration,
        });
      }
    });

    if (harmonyNotes.length === 0) {
      // eslint-disable-next-line no-console
      console.log('⚠️  No harmony notes found in region');
      return;
    }

    // CC64 SUSTAIN PEDAL DIAGNOSTIC - SHOWING EXACT CALCULATIONS
    // eslint-disable-next-line no-console
    console.log('='.repeat(120));
    // eslint-disable-next-line no-console
    console.log(
      `\n📊 Analyzing ${harmonyNotes.length} harmony notes with CC64 timeline\n`,
    );

    // Table header
    // eslint-disable-next-line no-console
    console.log(
      '┌─────┬──────────┬───────────┬──────────────┬──────────────┬────────────────┬─────────────────┬──────────────┬──────────────┐',
    );
    // eslint-disable-next-line no-console
    console.log(
      '│ #   │ Note     │ Start (s) │ MIDI Dur (s) │ MIDI End (s) │ Pedal Down (s) │ Pedal Up (s)    │ Final Dur(s) │ Extension(s) │',
    );
    // eslint-disable-next-line no-console
    console.log(
      '├─────┼──────────┼───────────┼──────────────┼──────────────┼────────────────┼─────────────────┼──────────────┼──────────────┤',
    );

    let extendedCount = 0;
    let totalExtension = 0;

    harmonyNotes.forEach((note, index) => {
      // Apply CC64 logic (same as in scheduleHarmonyMidiNoteDirect)
      let actualDuration = note.midiDuration;
      let pedalDownTime: number | null = null;
      let pedalUpTime: number | null = null;
      let extension = 0;

      if (this.currentCC64Timeline.size > 0) {
        pedalDownTime = this.findCC64DownDuringNote(
          note.audioTime,
          note.midiEndTime,
          this.currentCC64Timeline,
        );

        if (pedalDownTime !== null) {
          pedalUpTime = this.findNextCC64Up(
            pedalDownTime,
            this.currentCC64Timeline,
          );

          if (pedalUpTime !== null && pedalUpTime > note.midiEndTime) {
            // Pedal extends the note
            actualDuration = pedalUpTime - note.audioTime;
            extension = actualDuration - note.midiDuration;
            extendedCount++;
            totalExtension += extension;
          }
        }
      }

      // Format table row
      const num = String(index + 1).padStart(3);
      const noteName = note.noteName.padEnd(8);
      const start = note.audioTime.toFixed(3).padStart(9);
      const midiDur = note.midiDuration.toFixed(3).padStart(12);
      const midiEnd = note.midiEndTime.toFixed(3).padStart(12);
      const pedalDown = (
        pedalDownTime !== null ? pedalDownTime.toFixed(3) : 'N/A'
      ).padStart(14);
      const pedalUp = (
        pedalUpTime !== null ? pedalUpTime.toFixed(3) : 'N/A'
      ).padStart(15);
      const finalDur = actualDuration.toFixed(3).padStart(12);
      const ext = (extension > 0 ? `+${extension.toFixed(3)}` : '-').padStart(
        12,
      );

      // eslint-disable-next-line no-console
      console.log(
        `│ ${num} │ ${noteName} │ ${start} │ ${midiDur} │ ${midiEnd} │ ${pedalDown} │ ${pedalUp} │ ${finalDur} │ ${ext} │`,
      );
    });

    // eslint-disable-next-line no-console
    console.log(
      '└─────┴──────────┴───────────┴──────────────┴──────────────┴────────────────┴─────────────────┴──────────────┴──────────────┘',
    );

    // Summary statistics
    // eslint-disable-next-line no-console
    console.log(
      `\n📈 SUMMARY: ${extendedCount}/${harmonyNotes.length} notes extended by CC64 (${((extendedCount / harmonyNotes.length) * 100).toFixed(1)}%)`,
    );
    if (extendedCount > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `   Average extension: ${(totalExtension / extendedCount).toFixed(3)}s | Total added: ${totalExtension.toFixed(3)}s`,
      );
    }
    // eslint-disable-next-line no-console
    console.log('\n' + '='.repeat(120) + '\n');
  }
}
