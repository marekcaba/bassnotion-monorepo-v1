import type { Region, MidiEvent, QuantizationSettings } from '../types/region.js';
import type { MusicalPosition } from '../types/pattern.js';
import { parseMusicalPosition, toMusicalPosition } from '../types/pattern.js';
import { nanoid } from 'nanoid';

/**
 * Create a new region with default values
 */
export function createRegion(params: {
  trackId: string;
  name?: string;
  startPosition?: MusicalPosition;
  duration?: MusicalPosition;
  pattern?: any; // Using any to avoid circular dependency
}): Region {
  return {
    id: nanoid(),
    trackId: params.trackId,
    name: params.name || 'New Region',
    startPosition: params.startPosition || '0:0:0',
    duration: params.duration || '1:0:0',
    pattern: params.pattern,
    loopCount: 0, // Infinite by default
    muted: false,
    color: generateRegionColor(),
    laneIndex: 0
  };
}

/**
 * Validate region properties
 */
export function validateRegion(region: Region): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!region.id) {
    errors.push('Region must have an ID');
  }

  if (!region.trackId) {
    errors.push('Region must have a track ID');
  }

  if (!region.name || region.name.trim().length === 0) {
    errors.push('Region must have a name');
  }

  if (!isValidMusicalPosition(region.startPosition)) {
    errors.push('Invalid start position format');
  }

  if (!isValidMusicalPosition(region.duration)) {
    errors.push('Invalid duration format');
  }

  if (region.loopCount < 0) {
    errors.push('Loop count must be non-negative');
  }

  if (!region.pattern && !region.midiEvents && !region.audioClipId) {
    errors.push('Region must have content (pattern, MIDI events, or audio clip)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Add two musical positions together
 */
export function addMusicalTime(pos1: MusicalPosition, pos2: MusicalPosition): MusicalPosition {
  const p1 = parseMusicalPosition(pos1);
  const p2 = parseMusicalPosition(pos2);

  let sixteenths = p1.sixteenth + p2.sixteenth;
  let beats = p1.beat + p2.beat;
  let bars = p1.bar + p2.bar;

  // Handle overflow
  while (sixteenths >= 4) {
    beats += 1;
    sixteenths -= 4;
  }

  while (beats >= 4) {
    bars += 1;
    beats -= 4;
  }

  return toMusicalPosition(bars, beats, sixteenths);
}

/**
 * Subtract two musical positions
 */
export function subtractMusicalTime(pos1: MusicalPosition, pos2: MusicalPosition): MusicalPosition {
  const p1 = parseMusicalPosition(pos1);
  const p2 = parseMusicalPosition(pos2);

  // Convert to total sixteenths for easier calculation
  const totalSixteenths1 = p1.bar * 16 + p1.beat * 4 + p1.sixteenth;
  const totalSixteenths2 = p2.bar * 16 + p2.beat * 4 + p2.sixteenth;
  
  const difference = totalSixteenths1 - totalSixteenths2;
  
  if (difference < 0) {
    return '0:0:0'; // Can't have negative time
  }

  const bars = Math.floor(difference / 16);
  const remainingSixteenths = difference % 16;
  const beats = Math.floor(remainingSixteenths / 4);
  const sixteenths = remainingSixteenths % 4;

  return toMusicalPosition(bars, beats, sixteenths);
}

/**
 * Compare two musical positions
 */
export function compareMusicalPositions(pos1: MusicalPosition, pos2: MusicalPosition): number {
  const p1 = parseMusicalPosition(pos1);
  const p2 = parseMusicalPosition(pos2);

  const total1 = p1.bar * 16 + p1.beat * 4 + p1.sixteenth;
  const total2 = p2.bar * 16 + p2.beat * 4 + p2.sixteenth;

  return total1 - total2;
}

/**
 * Check if a position is within a range
 */
export function isPositionInRange(
  position: MusicalPosition,
  rangeStart: MusicalPosition,
  rangeEnd: MusicalPosition
): boolean {
  return compareMusicalPositions(position, rangeStart) >= 0 &&
         compareMusicalPositions(position, rangeEnd) < 0;
}

/**
 * Calculate the end position of a region
 */
export function getRegionEndPosition(region: Region): MusicalPosition {
  if (region.loopCount === 0) {
    // Infinite loop - return a very large number
    return '9999:0:0';
  }
  
  const loopCount = Math.max(1, region.loopCount);
  let endPosition = region.startPosition;
  
  // Add duration for each loop iteration
  for (let i = 0; i < loopCount; i++) {
    endPosition = addMusicalTime(endPosition, region.duration);
  }
  
  return endPosition;
}

/**
 * Check if two regions overlap in time
 */
export function doRegionsOverlap(region1: Region, region2: Region): boolean {
  const end1 = getRegionEndPosition(region1);
  const end2 = getRegionEndPosition(region2);

  return !(compareMusicalPositions(end1, region2.startPosition) <= 0 ||
           compareMusicalPositions(end2, region1.startPosition) <= 0);
}

/**
 * Generate a random color for a region
 */
function generateRegionColor(): string {
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#F97316', // Orange
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Validate musical position format
 */
function isValidMusicalPosition(position: MusicalPosition): boolean {
  const parts = position.split(':');
  if (parts.length !== 3) return false;
  
  const [bar, beat, sixteenth] = parts.map(Number);
  
  return !isNaN(bar) && bar >= 0 &&
         !isNaN(beat) && beat >= 0 && beat < 4 &&
         !isNaN(sixteenth) && sixteenth >= 0 && sixteenth < 4;
}

/**
 * Convert seconds to musical position based on tempo and time signature
 */
export function secondsToMusicalPosition(
  seconds: number,
  tempo: number = 120,
  timeSignature: { numerator: number; denominator: number } = { numerator: 4, denominator: 4 }
): MusicalPosition {
  const beatsPerSecond = tempo / 60;
  const totalBeats = seconds * beatsPerSecond;
  
  const beatsPerBar = timeSignature.numerator;
  const bars = Math.floor(totalBeats / beatsPerBar);
  const remainingBeats = totalBeats % beatsPerBar;
  const beat = Math.floor(remainingBeats);
  const sixteenth = Math.floor((remainingBeats - beat) * 4);

  return toMusicalPosition(bars, beat, sixteenth);
}

/**
 * Convert musical position to seconds based on tempo and time signature
 */
export function musicalPositionToSeconds(
  position: MusicalPosition,
  tempo: number = 120,
  timeSignature: { numerator: number; denominator: number } = { numerator: 4, denominator: 4 }
): number {
  const parsed = parseMusicalPosition(position);
  const beatsPerBar = timeSignature.numerator;
  
  const totalBeats = parsed.bar * beatsPerBar + parsed.beat + (parsed.sixteenth / 4);
  const beatsPerSecond = tempo / 60;
  
  return totalBeats / beatsPerSecond;
}

/**
 * Create a default quantization settings object
 */
export function createDefaultQuantization(): QuantizationSettings {
  return {
    enabled: false,
    gridSize: '1/16',
    strength: 1.0,
    swing: 0
  };
}

/**
 * Quantize a musical position to the nearest grid point
 */
export function quantizePosition(
  position: MusicalPosition,
  settings: QuantizationSettings
): MusicalPosition {
  if (!settings.enabled) return position;

  const parsed = parseMusicalPosition(position);
  const totalSixteenths = parsed.bar * 16 + parsed.beat * 4 + parsed.sixteenth;

  // Calculate grid size in sixteenths
  let gridSixteenths: number;
  switch (settings.gridSize) {
    case '1/4': gridSixteenths = 4; break;
    case '1/8': gridSixteenths = 2; break;
    case '1/16': gridSixteenths = 1; break;
    case '1/32': gridSixteenths = 0.5; break;
    case 'triplet': gridSixteenths = 16 / 3; break;
    default: gridSixteenths = 1;
  }

  // Find nearest grid point
  const quantizedSixteenths = Math.round(totalSixteenths / gridSixteenths) * gridSixteenths;
  
  // Apply strength (interpolate between original and quantized)
  const finalSixteenths = totalSixteenths + (quantizedSixteenths - totalSixteenths) * settings.strength;

  // Convert back to musical position
  const bars = Math.floor(finalSixteenths / 16);
  const remainingSixteenths = Math.round(finalSixteenths % 16);
  const beats = Math.floor(remainingSixteenths / 4);
  const sixteenths = remainingSixteenths % 4;

  return toMusicalPosition(bars, beats, sixteenths);
}

/**
 * Sort regions by start position
 */
export function sortRegionsByPosition(regions: Region[]): Region[] {
  return [...regions].sort((a, b) => compareMusicalPositions(a.startPosition, b.startPosition));
}

/**
 * Find regions that overlap with a given time range
 */
export function findRegionsInRange(
  regions: Region[],
  startPos: MusicalPosition,
  endPos: MusicalPosition
): Region[] {
  return regions.filter(region => {
    const regionEnd = getRegionEndPosition(region);
    // A region is in range if:
    // 1. It starts before the range ends AND
    // 2. It ends at or after the range starts
    return compareMusicalPositions(region.startPosition, endPos) < 0 &&
           compareMusicalPositions(regionEnd, startPos) >= 0;
  });
}