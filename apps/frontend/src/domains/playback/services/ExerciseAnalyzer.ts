/**
 * ExerciseAnalyzer - Analyzes exercise MIDI data to determine exact audio requirements
 *
 * This service parses MIDI files from exercises and determines:
 * - Which specific MIDI notes are played
 * - Which velocity layers are needed (based on actual MIDI velocities)
 * - Total memory requirements
 *
 * Used by FAANG solution to enable exercise-specific smart preloading,
 * loading only the samples needed rather than entire instrument libraries.
 *
 * IMPORTANT: We don't parse chord symbols - we extract actual MIDI notes
 * from the uploaded MIDI files, which already contain all the note data.
 */

import { getLogger } from '@/utils/logger.js';
import type { Exercise } from '@/domains/exercises/entities/exercise.entity.js';
import { Midi } from '@tonejs/midi';

const logger = getLogger('ExerciseAnalyzer');

export interface ExerciseAudioRequirements {
  harmony: {
    notes: string[]; // e.g., ['D4', 'F#4', 'A4', 'C#4'] - extracted from MIDI
    velocityLayers: string[]; // e.g., ['v10'] or ['v8', 'v10', 'v12']
    bufferCount: number;
  };
  bass: {
    notes: string[]; // e.g., ['D2', 'A2', 'G2'] - extracted from MIDI
    articulations: string[]; // e.g., ['normal', 'slap']
    bufferCount: number;
  };
  totalMemoryMB: number;
}

export class ExerciseAnalyzer {
  /**
   * Analyze an exercise to determine exact audio buffer requirements
   * This is the main entry point for exercise analysis
   */
  async analyzeExercise(
    exercise: Exercise,
  ): Promise<ExerciseAudioRequirements> {
    logger.info(`Analyzing exercise: ${exercise.title}`);

    // Parse MIDI files to extract actual notes
    const harmonyNotes = new Set<string>();
    const bassNotes = new Set<string>();
    const harmonyVelocities: number[] = [];
    const bassVelocities: number[] = [];

    // Parse harmony MIDI if available
    if (exercise.hasHarmonyMidi() && exercise.harmonyMidiUrl) {
      try {
        const harmonyMidi = await this.fetchAndParseMidi(
          exercise.harmonyMidiUrl,
        );
        this.extractNotesFromMidi(harmonyMidi, harmonyNotes, harmonyVelocities);
      } catch (error) {
        logger.error('Failed to parse harmony MIDI', error);
      }
    }

    // Parse bass MIDI if available
    if (exercise.hasBasslineMidi() && exercise.basslineMidiUrl) {
      try {
        const bassMidi = await this.fetchAndParseMidi(exercise.basslineMidiUrl);
        this.extractNotesFromMidi(bassMidi, bassNotes, bassVelocities);
      } catch (error) {
        logger.error('Failed to parse bass MIDI', error);
      }
    }

    // Fallback: use fretboard notes for bass if no MIDI
    if (bassNotes.size === 0 && exercise.notes && exercise.notes.length > 0) {
      exercise.notes.forEach((note) => {
        bassNotes.add(note.note);
        bassVelocities.push(0.7); // Default velocity
      });
    }

    const harmonyRequirements = this.analyzeHarmony(
      harmonyNotes,
      harmonyVelocities,
    );
    const bassRequirements = this.analyzeBass(bassNotes, bassVelocities);

    const totalMemoryMB = this.estimateMemory(
      harmonyRequirements.bufferCount,
      bassRequirements.bufferCount,
    );

    const requirements: ExerciseAudioRequirements = {
      harmony: harmonyRequirements,
      bass: bassRequirements,
      totalMemoryMB,
    };

    logger.info('📊 Exercise audio requirements:', {
      harmonyNotes: requirements.harmony.notes.length,
      harmonyLayers: requirements.harmony.velocityLayers.length,
      harmonyBuffers: requirements.harmony.bufferCount,
      bassNotes: requirements.bass.notes.length,
      bassArticulations: requirements.bass.articulations.length,
      bassBuffers: requirements.bass.bufferCount,
      totalMemoryMB: requirements.totalMemoryMB.toFixed(2),
    });

    return requirements;
  }

  /**
   * Fetch and parse a MIDI file from URL
   */
  private async fetchAndParseMidi(url: string): Promise<Midi> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return new Midi(arrayBuffer);
  }

  /**
   * Extract unique notes and velocities from MIDI file
   */
  private extractNotesFromMidi(
    midi: Midi,
    noteSet: Set<string>,
    velocities: number[],
  ): void {
    midi.tracks.forEach((track) => {
      track.notes.forEach((note) => {
        // Convert MIDI note number to note name (e.g., 60 → 'C4')
        const noteName = this.midiNumberToNoteName(note.midi);
        noteSet.add(noteName);
        // MIDI velocity is 0-127, normalize to 0-1
        velocities.push(note.velocity);
      });
    });
  }

  /**
   * Convert MIDI note number to note name with octave
   * Example: 60 → 'C4', 61 → 'Cs4' (Salamander notation)
   */
  private midiNumberToNoteName(midiNumber: number): string {
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
    const octave = Math.floor(midiNumber / 12) - 1;
    const noteIndex = midiNumber % 12;
    return noteNames[noteIndex] + octave;
  }

  /**
   * Determine which velocity layers are needed based on velocity range
   * Salamander piano has 16 layers (v1-v16), but we can use just 1-3 for most exercises
   */
  determineVelocityLayers(velocities: number[]): string[] {
    if (velocities.length === 0) {
      return ['v10']; // Default to medium velocity
    }

    const minVel = Math.min(...velocities);
    const maxVel = Math.max(...velocities);
    const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const range = maxVel - minVel;

    // If velocity range is narrow (<= 0.25), use single layer
    if (range <= 0.25) {
      if (avgVel < 0.4) return ['v6']; // Soft
      if (avgVel < 0.7) return ['v10']; // Medium
      return ['v14']; // Loud
    }

    // If range is medium (<= 0.45), use 2 layers
    if (range <= 0.45) {
      if (avgVel < 0.5) return ['v6', 'v10']; // Soft to medium
      return ['v10', 'v14']; // Medium to loud
    }

    // Wide range, use 3 layers
    return ['v6', 'v10', 'v14']; // Soft, medium, loud
  }

  /**
   * Estimate total memory usage in MB
   */
  private estimateMemory(
    harmonyBufferCount: number,
    bassBufferCount: number,
  ): number {
    const harmonyMB = (harmonyBufferCount * 100) / 1024; // ~100KB per piano sample
    const bassMB = (bassBufferCount * 50) / 1024; // ~50KB per bass sample
    return harmonyMB + bassMB;
  }

  /**
   * Analyze harmony requirements from extracted MIDI notes
   */
  private analyzeHarmony(
    harmonyNotes: Set<string>,
    velocities: number[],
  ): {
    notes: string[];
    velocityLayers: string[];
    bufferCount: number;
  } {
    // If no harmony data, return empty requirements
    if (harmonyNotes.size === 0) {
      return {
        notes: [],
        velocityLayers: [],
        bufferCount: 0,
      };
    }

    const notes = Array.from(harmonyNotes);
    const layers = this.determineVelocityLayers(velocities);

    return {
      notes,
      velocityLayers: layers,
      bufferCount: notes.length * layers.length,
    };
  }

  /**
   * Analyze bass requirements
   */
  private analyzeBass(
    bassNotes: Set<string>,
    velocities: number[],
  ): {
    notes: string[];
    articulations: string[];
    bufferCount: number;
  } {
    // For now, we only support 'normal' articulation
    // Can extend to 'slap', 'pop', 'mute' later
    const articulations = ['normal'];

    // If no bass notes, return empty requirements
    if (bassNotes.size === 0) {
      return {
        notes: [],
        articulations,
        bufferCount: 0,
      };
    }

    const notes = Array.from(bassNotes);

    return {
      notes,
      articulations,
      bufferCount: notes.length * articulations.length,
    };
  }
}

// Export singleton instance
export const exerciseAnalyzer = new ExerciseAnalyzer();
