import * as THREE from 'three';
import { ExerciseNote } from '../types/fretboard';
import { calculateNotePosition } from './fretboardGeometry';

// Note positioning and timing utilities

// Calculate note position based on current time and note timing
export function calculateNoteDisplayPosition(
  note: ExerciseNote,
  currentTime: number,
  bpm: number,
  lookaheadTime = 4000, // 4 seconds lookahead in milliseconds
): THREE.Vector3 | null {
  const timeDifference = note.timestamp - currentTime;

  // Don't render notes that are too far in the future or past
  if (timeDifference > lookaheadTime || timeDifference < -1000) {
    return null;
  }

  // Get base position on fretboard
  const basePosition = calculateNotePosition(note.string, note.fret);

  // For Guitar Hero style, notes move along Z-axis (toward player)
  // Calculate movement based on timing
  const noteSpeed = 100; // mm per second (adjustable)
  const timeToPlay = timeDifference / 1000; // Convert to seconds
  const zOffset = timeToPlay * noteSpeed;

  return new THREE.Vector3(
    basePosition.x, // String position (left-right)
    basePosition.y, // Height above fretboard
    basePosition.z + zOffset, // Move toward player over time
  );
}

// Determine note state based on timing
export type NoteState = 'upcoming' | 'current' | 'played' | 'hidden';

export function getNoteState(
  note: ExerciseNote,
  currentTime: number,
  tolerance = 100, // milliseconds tolerance for "current"
): NoteState {
  const timeDifference = note.timestamp - currentTime;

  if (timeDifference < -tolerance - note.duration) {
    return 'played';
  } else if (timeDifference <= tolerance && timeDifference >= -tolerance) {
    return 'current';
  } else if (timeDifference > tolerance) {
    return 'upcoming';
  } else {
    return 'hidden';
  }
}

// Get notes that should be visible at current time
export function getVisibleNotes(
  notes: ExerciseNote[],
  currentTime: number,
  lookaheadTime = 4000,
  lookbackTime = 1000,
): ExerciseNote[] {
  return notes.filter((note) => {
    const timeDifference = note.timestamp - currentTime;
    return timeDifference <= lookaheadTime && timeDifference >= -lookbackTime;
  });
}

// Sort notes by timing for rendering order
export function sortNotesByTiming(notes: ExerciseNote[]): ExerciseNote[] {
  return [...notes].sort((a, b) => a.timestamp - b.timestamp);
}

// Get the next N upcoming notes from current time
export function getUpcomingNotes(
  notes: ExerciseNote[],
  currentTime: number,
  count = 4,
): ExerciseNote[] {
  return notes
    .filter((note) => note.timestamp > currentTime)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, count);
}

// Get current note (within tolerance)
export function getCurrentNote(
  notes: ExerciseNote[],
  currentTime: number,
  tolerance = 100,
): ExerciseNote | null {
  return (
    notes.find((note) => {
      const timeDifference = Math.abs(note.timestamp - currentTime);
      return timeDifference <= tolerance;
    }) || null
  );
}

// Calculate note priority for rendering (closer notes have higher priority)
export function calculateNotePriority(
  note: ExerciseNote,
  currentTime: number,
): number {
  const timeDifference = Math.abs(note.timestamp - currentTime);
  return 1 / (timeDifference + 1); // Inverse relationship with time difference
}

// Calculate play strip position (the "judgment line" in Guitar Hero style)
export function calculatePlayStripPosition(
  fretboardLength: number,
  playStripOffset = 0.7, // 70% down the fretboard toward player
): number {
  return -fretboardLength * playStripOffset;
}

// Check if note is within play strip area
export function isNoteInPlayStrip(
  notePosition: THREE.Vector3,
  playStripZ: number,
  stripWidth = 20, // mm
): boolean {
  return Math.abs(notePosition.z - playStripZ) <= stripWidth / 2;
}

// Calculate note scale based on distance (perspective effect)
export function calculateNoteScale(
  notePosition: THREE.Vector3,
  cameraPosition: THREE.Vector3,
  baseScale = 1.0,
  scaleRange = 0.3,
): number {
  const distance = notePosition.distanceTo(cameraPosition);
  const normalizedDistance = Math.min(distance / 1000, 1); // Normalize to 0-1
  return baseScale + scaleRange * (1 - normalizedDistance);
}

// Convert BPM to milliseconds per beat
export function bpmToMillisPerBeat(bpm: number): number {
  return 60000 / bpm; // 60,000 ms per minute / beats per minute
}

// Convert musical time to milliseconds
export function musicalTimeToMs(
  bar: number,
  beat: number,
  subdivision: number,
  bpm: number,
  timeSignature: [number, number] = [4, 4],
): number {
  const millisecondsPerBeat = bpmToMillisPerBeat(bpm);
  const beatsPerBar = timeSignature[0];

  const totalBeats =
    (bar - 1) * beatsPerBar + (beat - 1) + subdivision / timeSignature[1];
  return totalBeats * millisecondsPerBeat;
}

// Convert milliseconds to musical time
export function msToMusicalTime(
  milliseconds: number,
  bpm: number,
  timeSignature: [number, number] = [4, 4],
): { bar: number; beat: number; subdivision: number } {
  const millisecondsPerBeat = bpmToMillisPerBeat(bpm);
  const beatsPerBar = timeSignature[0];

  const totalBeats = milliseconds / millisecondsPerBeat;
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beatInBar = totalBeats % beatsPerBar;
  const beat = Math.floor(beatInBar) + 1;
  const subdivision = (beatInBar % 1) * timeSignature[1];

  return { bar, beat, subdivision };
}
