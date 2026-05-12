export { getInitialAct } from './utils/getInitialAct.js';

/** Safely convert any value to a string */
export function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value);
  }
  return String(value);
}

/** Extract exercise ID as a plain string, handling value-object wrappers */
export function getExerciseId(exercise: { id: string | { value: string } }): string {
  return typeof exercise.id === 'object' && exercise.id !== null
    ? exercise.id.value
    : exercise.id;
}

/** Calculate duration in seconds from exercise note data */
export function calculateDuration(exercise: any): number {
  if (
    !exercise?.notes ||
    !Array.isArray(exercise.notes) ||
    exercise.notes.length === 0
  ) {
    return 0;
  }

  // Find the maximum timestamp + duration from all notes
  const maxEndTime = exercise.notes.reduce((max: number, note: any) => {
    // Validate and sanitize timestamp
    const timestamp =
      typeof note.timestamp === 'number' && isFinite(note.timestamp)
        ? note.timestamp
        : 0;

    // Validate and sanitize duration
    const duration_ms =
      typeof note.duration_ms === 'number' && isFinite(note.duration_ms)
        ? note.duration_ms
        : typeof note.duration === 'number' && isFinite(note.duration)
          ? note.duration
          : 500; // Default 500ms if no valid duration

    const endTime = timestamp + duration_ms;
    return Math.max(max, endTime);
  }, 0);

  // Convert to seconds if the value is in milliseconds (> 1000 suggests milliseconds)
  const result =
    maxEndTime > 1000 ? Math.floor(maxEndTime / 1000) : maxEndTime;

  // Ensure we never return NaN
  return isFinite(result) ? result : 0;
}
