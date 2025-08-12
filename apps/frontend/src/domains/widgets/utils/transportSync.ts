/**
 * Transport Synchronization Utilities
 * 
 * Ensures all widgets schedule their events at the same transport position
 * to maintain perfect synchronization across the application.
 */

import * as Tone from 'tone';

// Professional timing is now handled internally by UnifiedTransport
// No separate initialization needed - see deprecated timing files

export interface TransportSyncOptions {
  interval: string; // e.g., '1m', '4n', '8n'
  startOffset?: string; // e.g., '0:0:0', '0:1:0'
  callback: (time: number) => void;
}

/**
 * Schedule a repeating event that's synchronized with the global transport.
 * This ensures all widgets start at the same transport position, even if they
 * mount at different times.
 * 
 * @param options - Scheduling options
 * @returns Event ID that can be used to clear the scheduled event
 */
export function scheduleTransportSync(options: TransportSyncOptions): number {
  const { interval, startOffset = '0:0:0', callback } = options;
  
  // PERFORMANCE OPTIMIZATION: Trust Tone.Transport's internal scheduling
  // UnifiedTransport already handles professional timing with AudioWorklet
  // Complex alignment calculations add unnecessary overhead
  
  // Simply use Tone's built-in scheduling which already handles alignment
  return Tone.Transport.scheduleRepeat(callback, interval, startOffset);
}

/**
 * Get the current transport position in a standardized format
 */
export function getCurrentTransportPosition(): {
  bars: number;
  beats: number;
  sixteenths: number;
  seconds: number;
  position: string;
} {
  const position = Tone.Transport.position as string;
  const [bars, beats, sixteenths] = position.split(':').map(Number);
  
  return {
    bars,
    beats,
    sixteenths,
    seconds: Tone.Transport.seconds,
    position
  };
}

/**
 * Calculate the time offset needed to sync with the global transport
 */
export function getTransportSyncOffset(): number {
  if (Tone.Transport.state === 'stopped') {
    return 0;
  }
  
  // Get current position in seconds
  const currentSeconds = Tone.Transport.seconds;
  
  // Calculate how far we are into the current measure
  const bpm = Tone.Transport.bpm.value;
  const beatsPerMeasure = Array.isArray(Tone.Transport.timeSignature) 
    ? Tone.Transport.timeSignature[0] 
    : Tone.Transport.timeSignature;
  const secondsPerBeat = 60 / bpm;
  const secondsPerMeasure = secondsPerBeat * beatsPerMeasure;
  
  // Calculate offset to next measure boundary
  const measuresElapsed = Math.floor(currentSeconds / secondsPerMeasure);
  const nextMeasureTime = (measuresElapsed + 1) * secondsPerMeasure;
  const offsetToNextMeasure = nextMeasureTime - currentSeconds;
  
  return offsetToNextMeasure;
}

/**
 * Check if all scheduled events should be cleared and rescheduled
 * This is useful when the transport state changes significantly
 */
export function shouldRescheduleEvents(
  lastScheduleTime: number,
  lastTransportState: string
): boolean {
  const currentState = Tone.Transport.state;
  const currentTime = Tone.Transport.seconds;
  
  // Reschedule if transport was stopped and started again
  if (lastTransportState === 'stopped' && currentState === 'started') {
    return true;
  }
  
  // Reschedule if transport position was seeked significantly
  const timeDiff = Math.abs(currentTime - lastScheduleTime);
  if (timeDiff > 0.1 && currentState === 'started') {
    return true;
  }
  
  return false;
}