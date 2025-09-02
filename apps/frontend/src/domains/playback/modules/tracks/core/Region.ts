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
import type { 
  Region as IRegion,
  RegionType,
  RegionContent,
  RegionFade,
  RegionStretch,
  MusicalTimeRange,
} from '../../../types/region.js';
import type { MusicalPosition, Pattern } from '../../../types/pattern.js';
import { 
  compareMusicalPositions,
  addMusicalTime,
  isPositionInRange,
  getRegionDuration,
} from '../../../utils/regionUtils.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('Region');

export interface RegionConfig {
  name?: string;
  type: RegionType;
  position: MusicalPosition;
  length: MusicalPosition;
  content: RegionContent;
  color?: string;
  fadeIn?: RegionFade;
  fadeOut?: RegionFade;
  stretch?: RegionStretch;
  loop?: boolean;
  muted?: boolean;
  locked?: boolean;
}

export class Region implements IRegion {
  public readonly id: string;
  public name: string;
  public readonly type: RegionType;
  public position: MusicalPosition;
  public length: MusicalPosition;
  public content: RegionContent;
  public color: string;
  public fadeIn?: RegionFade;
  public fadeOut?: RegionFade;
  public stretch?: RegionStretch;
  public loop: boolean;
  public muted: boolean;
  public locked: boolean;

  // Calculated properties
  private _endPosition: MusicalPosition | null = null;
  private _durationMs: number | null = null;

  constructor(config: RegionConfig) {
    this.id = nanoid();
    this.name = config.name || `Region ${this.id.slice(0, 6)}`;
    this.type = config.type;
    this.position = { ...config.position };
    this.length = { ...config.length };
    this.content = this.cloneContent(config.content);
    this.color = config.color || this.getDefaultColor();
    this.fadeIn = config.fadeIn ? { ...config.fadeIn } : undefined;
    this.fadeOut = config.fadeOut ? { ...config.fadeOut } : undefined;
    this.stretch = config.stretch ? { ...config.stretch } : undefined;
    this.loop = config.loop ?? false;
    this.muted = config.muted ?? false;
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
    switch (content.type) {
      case 'pattern':
        return {
          type: 'pattern',
          patternId: content.patternId,
          pattern: content.pattern ? this.clonePattern(content.pattern) : undefined,
        };
      case 'audio':
        return {
          type: 'audio',
          clipId: content.clipId,
          url: content.url,
          duration: content.duration,
          startOffset: content.startOffset,
        };
      case 'automation':
        return {
          type: 'automation',
          parameter: content.parameter,
          points: content.points.map(p => ({ ...p })),
          curveType: content.curveType,
        };
      default:
        throw new Error(`Unknown content type: ${(content as any).type}`);
    }
  }

  /**
   * Clone pattern
   */
  private clonePattern(pattern: Pattern): Pattern {
    return {
      ...pattern,
      events: pattern.events.map(e => ({ ...e })),
    };
  }

  /**
   * Validate region configuration
   */
  private validateRegion(): void {
    // Validate position
    if (this.position.bar < 0 || this.position.beat < 0 || this.position.tick < 0) {
      throw new Error('Invalid region position: negative values not allowed');
    }

    // Validate length
    if (this.length.bar < 0 || 
        (this.length.bar === 0 && this.length.beat === 0 && this.length.tick === 0)) {
      throw new Error('Invalid region length: must be greater than zero');
    }

    // Validate content type matches region type
    if (this.type === 'midi' && this.content.type !== 'pattern') {
      throw new Error('MIDI region must have pattern content');
    }
    if (this.type === 'audio' && this.content.type !== 'audio') {
      throw new Error('Audio region must have audio content');
    }
    if (this.type === 'automation' && this.content.type !== 'automation') {
      throw new Error('Automation region must have automation content');
    }

    // Validate fades
    if (this.fadeIn && this.fadeIn.duration < 0) {
      throw new Error('Invalid fade in duration');
    }
    if (this.fadeOut && this.fadeOut.duration < 0) {
      throw new Error('Invalid fade out duration');
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
      this._endPosition = addMusicalTime(this.position, this.length);
    }
    return this._endPosition;
  }

  /**
   * Get duration in milliseconds (requires tempo)
   */
  getDurationMs(tempo: number = 120): number {
    if (!this._durationMs || this._durationMs < 0) {
      this._durationMs = getRegionDuration(this, tempo);
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

    this.position = { ...position };
    this._endPosition = null; // Invalidate cache
    
    logger.debug('Region moved', {
      regionId: this.id,
      newPosition: this.position,
    });
  }

  /**
   * Resize region
   */
  resize(newLength: MusicalPosition): void {
    if (this.locked) {
      throw new Error('Cannot resize locked region');
    }

    if (newLength.bar < 0 || 
        (newLength.bar === 0 && newLength.beat === 0 && newLength.tick === 0)) {
      throw new Error('Invalid length: must be greater than zero');
    }

    this.length = { ...newLength };
    this._endPosition = null; // Invalidate cache
    this._durationMs = null;
    
    logger.debug('Region resized', {
      regionId: this.id,
      newLength: this.length,
    });
  }

  /**
   * Check if position is within this region
   */
  containsPosition(position: MusicalPosition): boolean {
    const range: MusicalTimeRange = {
      start: this.position,
      end: this.getEndPosition(),
    };
    return isPositionInRange(position, range);
  }

  /**
   * Split region at position
   */
  splitAt(position: MusicalPosition): Region | null {
    if (this.locked) {
      throw new Error('Cannot split locked region');
    }

    if (!this.containsPosition(position)) {
      return null;
    }

    // Calculate lengths for both parts
    const firstLength = {
      bar: position.bar - this.position.bar,
      beat: position.beat - this.position.beat,
      tick: position.tick - this.position.tick,
    };

    // Normalize negative values
    if (firstLength.tick < 0) {
      firstLength.tick += 480;
      firstLength.beat -= 1;
    }
    if (firstLength.beat < 0) {
      firstLength.beat += 4; // Assuming 4/4 time
      firstLength.bar -= 1;
    }

    const secondLength = {
      bar: this.length.bar - firstLength.bar,
      beat: this.length.beat - firstLength.beat,
      tick: this.length.tick - firstLength.tick,
    };

    // Create new region for second part
    const secondRegion = new Region({
      name: `${this.name} (2)`,
      type: this.type,
      position: position,
      length: secondLength,
      content: this.cloneContent(this.content),
      color: this.color,
      fadeIn: this.fadeIn,
      fadeOut: this.fadeOut,
      stretch: this.stretch,
      loop: this.loop,
      muted: this.muted,
      locked: false,
    });

    // Update this region to be the first part
    this.resize(firstLength);
    this.name = `${this.name} (1)`;

    logger.info('Region split', {
      originalId: this.id,
      newId: secondRegion.id,
      splitPosition: position,
    });

    return secondRegion;
  }

  /**
   * Apply fade in
   */
  setFadeIn(duration: number, curve: 'linear' | 'exponential' = 'linear'): void {
    if (this.locked) {
      throw new Error('Cannot modify locked region');
    }

    if (duration < 0) {
      throw new Error('Invalid fade duration');
    }

    this.fadeIn = duration > 0 ? { duration, curve } : undefined;
  }

  /**
   * Apply fade out
   */
  setFadeOut(duration: number, curve: 'linear' | 'exponential' = 'linear'): void {
    if (this.locked) {
      throw new Error('Cannot modify locked region');
    }

    if (duration < 0) {
      throw new Error('Invalid fade duration');
    }

    this.fadeOut = duration > 0 ? { duration, curve } : undefined;
  }

  /**
   * Apply time stretch
   */
  setStretch(factor: number, preservePitch: boolean = true): void {
    if (this.locked) {
      throw new Error('Cannot modify locked region');
    }

    if (factor <= 0) {
      throw new Error('Invalid stretch factor');
    }

    this.stretch = factor !== 1 ? { factor, preservePitch } : undefined;
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
      name: `${this.name} (copy)`,
      type: this.type,
      position: this.position,
      length: this.length,
      content: this.content,
      color: this.color,
      fadeIn: this.fadeIn,
      fadeOut: this.fadeOut,
      stretch: this.stretch,
      loop: this.loop,
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
      name: this.name,
      type: this.type,
      position: { ...this.position },
      length: { ...this.length },
      content: this.cloneContent(this.content),
      color: this.color,
      fadeIn: this.fadeIn ? { ...this.fadeIn } : undefined,
      fadeOut: this.fadeOut ? { ...this.fadeOut } : undefined,
      stretch: this.stretch ? { ...this.stretch } : undefined,
      loop: this.loop,
      muted: this.muted,
      locked: this.locked,
    };
  }
}