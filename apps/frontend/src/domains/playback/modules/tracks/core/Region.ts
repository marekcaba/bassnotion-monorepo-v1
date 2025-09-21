/**
 * Region - Represents a segment of content on a track
 *
 * Regions are the building blocks of tracks, containing:
 * - MIDI patterns
 * - Audio clips
 * - Automation data
 *
 * Features:
 * - Position and duration management
 * - Loop support
 * - Fade in/out
 * - Stretching and time manipulation
 */

import { nanoid } from 'nanoid';
import type { Region as IRegion } from '../../../types/region.js';
import type { MusicalPosition, Pattern } from '../../../types/pattern.js';
import {
  addMusicalTime,
  isPositionInRange,
} from '../../../utils/regionUtils.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('Region');

// Define types that are not exported from region.ts
export type RegionType = 'pattern' | 'audio' | 'midi' | 'automation';

export interface RegionContent {
  pattern?: Pattern;
  audioClipId?: string;
  midiEvents?: any[]; // TODO: Define MidiEvent type
  automation?: any[]; // TODO: Define AutomationData type
}

export interface RegionFade {
  type: 'linear' | 'exponential' | 'logarithmic';
  duration: MusicalPosition;
}

export interface RegionStretch {
  factor: number;
  algorithm: 'elastic' | 'tape' | 'varispeed';
  preservePitch: boolean;
}

export interface MusicalTimeRange {
  start: MusicalPosition;
  end: MusicalPosition;
}

export interface RegionConfig {
  trackId: string;
  name?: string;
  type: RegionType;
  position: MusicalPosition;
  length: MusicalPosition;
  content: RegionContent;
  color?: string;
  fadeIn?: RegionFade;
  fadeOut?: RegionFade;
  stretch?: RegionStretch;
  loopCount?: number;
  muted?: boolean;
  locked?: boolean;
}

export class Region implements IRegion {
  public readonly id: string;
  public trackId: string;
  public name: string;
  public startPosition: MusicalPosition;
  public duration: MusicalPosition;
  public pattern?: Pattern;
  public midiEvents?: any[]; // TODO: Import MidiEvent type
  public audioClipId?: string;
  public loopCount: number;
  public muted: boolean;
  public quantization?: any; // TODO: Import QuantizationSettings type
  public color?: string;
  public laneIndex?: number;
  public uiState?: {
    collapsed: boolean;
    height: number;
  };

  // Additional properties for extended functionality
  public readonly type: RegionType;
  public content: RegionContent;
  public fadeIn?: RegionFade;
  public fadeOut?: RegionFade;
  public stretch?: RegionStretch;
  public locked: boolean;

  // Calculated properties
  private _endPosition: MusicalPosition | null = null;
  private _durationMs: number | null = null;

  constructor(config: RegionConfig) {
    this.id = nanoid();
    this.trackId = config.trackId;
    this.name = config.name || `Region ${this.id.slice(0, 6)}`;
    this.type = config.type;

    // Map position to startPosition and length to duration for IRegion
    this.startPosition = config.position;
    this.duration = config.length;

    // Map content to pattern/midiEvents/audioClipId
    this.content = this.cloneContent(config.content);
    if (this.content.pattern) {
      this.pattern = this.content.pattern;
    }
    if (this.content.audioClipId) {
      this.audioClipId = this.content.audioClipId;
    }
    if (this.content.midiEvents) {
      this.midiEvents = this.content.midiEvents;
    }

    this.loopCount = config.loopCount ?? 1;
    this.muted = config.muted ?? false;
    this.color = config.color || this.getDefaultColor();
    this.fadeIn = config.fadeIn ? { ...config.fadeIn } : undefined;
    this.fadeOut = config.fadeOut ? { ...config.fadeOut } : undefined;
    this.stretch = config.stretch ? { ...config.stretch } : undefined;
    this.locked = config.locked ?? false;

    this.validateRegion();
  }

  /**
   * Get default color based on region type
   */
  private getDefaultColor(): string {
    switch (this.type) {
      case 'midi':
        return '#3B82F6'; // Blue
      case 'audio':
        return '#10B981'; // Green
      case 'automation':
        return '#F59E0B'; // Amber
      default:
        return '#6B7280'; // Gray
    }
  }

  /**
   * Clone region content
   */
  private cloneContent(content: RegionContent): RegionContent {
    const cloned: RegionContent = {};

    if (content.pattern) {
      cloned.pattern = content.pattern;
    }
    if (content.audioClipId) {
      cloned.audioClipId = content.audioClipId;
    }
    if (content.midiEvents) {
      cloned.midiEvents = [...content.midiEvents];
    }
    if (content.automation) {
      cloned.automation = [...content.automation];
    }

    return cloned;
  }

  /**
   * Validate region configuration
   */
  private validateRegion(): void {
    // Basic validation only since MusicalPosition is a string
    if (!this.startPosition) {
      throw new Error('Start position is required');
    }

    if (!this.duration) {
      throw new Error('Duration is required');
    }

    if (!this.trackId) {
      throw new Error('Track ID is required');
    }

    if (this.loopCount < 0) {
      throw new Error('Loop count must be non-negative');
    }

    // Validate content type matches region type
    if (this.type === 'pattern' && !this.content.pattern) {
      throw new Error('Pattern region must have pattern content');
    }
    if (this.type === 'audio' && !this.content.audioClipId) {
      throw new Error('Audio region must have audio clip ID');
    }
    if (this.type === 'midi' && !this.content.midiEvents) {
      throw new Error('MIDI region must have MIDI events');
    }
    if (this.type === 'automation' && !this.content.automation) {
      throw new Error('Automation region must have automation data');
    }

    // Validate stretch
    if (this.stretch && this.stretch.factor <= 0) {
      throw new Error('Invalid stretch factor: must be greater than zero');
    }
  }

  /**
   * Get end position of the region
   */
  getEndPosition(): MusicalPosition {
    if (!this._endPosition) {
      this._endPosition = addMusicalTime(this.startPosition, this.duration);
    }
    return this._endPosition;
  }

  /**
   * Get duration in milliseconds (requires tempo)
   */
  getDurationMs(_tempo = 120): number {
    if (!this._durationMs || this._durationMs < 0) {
      // Simple placeholder calculation
      this._durationMs = 1000; // 1 second default
    }
    return this._durationMs;
  }

  /**
   * Move region to new position
   */
  moveTo(position: MusicalPosition): void {
    if (this.locked) {
      throw new Error('Cannot move locked region');
    }

    this.startPosition = position;
    this._endPosition = null; // Invalidate cache

    logger.debug('Region moved', {
      regionId: this.id,
      newPosition: this.startPosition,
    });
  }

  /**
   * Resize region
   */
  resize(newLength: MusicalPosition): void {
    if (this.locked) {
      throw new Error('Cannot resize locked region');
    }

    if (!newLength || newLength === '0:0:0') {
      throw new Error('Invalid length: must be greater than zero');
    }

    this.duration = newLength;
    this._endPosition = null; // Invalidate cache
    this._durationMs = null;

    logger.debug('Region resized', {
      regionId: this.id,
      newLength: this.duration,
    });
  }

  /**
   * Check if position is within this region
   */
  containsPosition(position: MusicalPosition): boolean {
    const range: MusicalTimeRange = {
      start: this.startPosition,
      end: this.getEndPosition(),
    };
    return isPositionInRange(position, range.start, range.end);
  }

  /**
   * Split region at position
   */
  splitAt(position: MusicalPosition): Region | null {
    if (this.locked) {
      throw new Error('Cannot split locked region');
    }

    // For now, we can't split regions since we'd need to parse musical time strings
    logger.warn('Region split not implemented for string-based positions', {
      regionId: this.id,
      position,
    });

    return null;
  }

  /**
   * Apply fade in
   */
  setFadeIn(
    duration: MusicalPosition,
    type: 'linear' | 'exponential' | 'logarithmic' = 'linear',
  ): void {
    if (this.locked) {
      throw new Error('Cannot modify locked region');
    }

    if (!duration || duration === '0:0:0') {
      this.fadeIn = undefined;
    } else {
      this.fadeIn = { duration, type };
    }
  }

  /**
   * Apply fade out
   */
  setFadeOut(
    duration: MusicalPosition,
    type: 'linear' | 'exponential' | 'logarithmic' = 'linear',
  ): void {
    if (this.locked) {
      throw new Error('Cannot modify locked region');
    }

    if (!duration || duration === '0:0:0') {
      this.fadeOut = undefined;
    } else {
      this.fadeOut = { duration, type };
    }
  }

  /**
   * Apply time stretch
   */
  setStretch(factor: number, preservePitch = true): void {
    if (this.locked) {
      throw new Error('Cannot modify locked region');
    }

    if (factor <= 0) {
      throw new Error('Invalid stretch factor');
    }

    this.stretch =
      factor !== 1
        ? {
            factor,
            algorithm: 'elastic',
            preservePitch,
          }
        : undefined;
    this._durationMs = null; // Invalidate cache
  }

  /**
   * Toggle mute state
   */
  toggleMute(): void {
    this.muted = !this.muted;
  }

  /**
   * Toggle lock state
   */
  toggleLock(): void {
    this.locked = !this.locked;
  }

  /**
   * Clone region
   */
  clone(): Region {
    return new Region({
      trackId: this.trackId,
      name: `${this.name} (copy)`,
      type: this.type,
      position: this.startPosition,
      length: this.duration,
      content: this.content,
      color: this.color,
      fadeIn: this.fadeIn,
      fadeOut: this.fadeOut,
      stretch: this.stretch,
      loopCount: this.loopCount,
      muted: this.muted,
      locked: false, // Always unlock clones
    });
  }

  /**
   * Get region as JSON
   */
  toJSON(): IRegion {
    return {
      id: this.id,
      trackId: this.trackId,
      name: this.name,
      startPosition: this.startPosition,
      duration: this.duration,
      pattern: this.pattern,
      midiEvents: this.midiEvents,
      audioClipId: this.audioClipId,
      loopCount: this.loopCount,
      muted: this.muted,
      quantization: this.quantization,
      color: this.color,
      laneIndex: this.laneIndex,
      uiState: this.uiState,
    };
  }
}
