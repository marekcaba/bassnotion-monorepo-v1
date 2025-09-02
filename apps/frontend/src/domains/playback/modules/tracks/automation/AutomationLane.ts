/**
 * AutomationLane - Manages automation data for a single parameter
 * 
 * Features:
 * - Automation points with curves
 * - Real-time value calculation
 * - Recording and editing
 * - Snap to grid
 * - Touch/latch/write modes
 */

import type { 
  TrackAutomation,
  AutomationPoint,
  AutomationCurveType,
} from '../../../types/track.js';
import type { MusicalPosition } from '../../../types/pattern.js';
import { EventBus } from '../../../services/core/EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('AutomationLane');

export type AutomationMode = 'read' | 'write' | 'touch' | 'latch' | 'off';

export interface AutomationLaneConfig {
  parameter: string;
  trackId: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  step?: number;
  displayName?: string;
  unit?: string;
}

export interface AutomationRecordingState {
  isRecording: boolean;
  mode: AutomationMode;
  lastValue: number;
  lastPosition: MusicalPosition;
  touchStarted?: number;
}

export class AutomationLane implements TrackAutomation {
  public readonly parameter: string;
  public readonly trackId: string;
  public points: AutomationPoint[] = [];
  public enabled: boolean = true;
  public curveType: AutomationCurveType = 'linear';
  
  // Configuration
  private config: Required<AutomationLaneConfig>;
  private recordingState: AutomationRecordingState;
  private eventBus?: EventBus;
  
  // Performance optimization
  private sortedPoints: AutomationPoint[] = [];
  private isDirty: boolean = true;

  constructor(config: AutomationLaneConfig, eventBus?: EventBus) {
    this.parameter = config.parameter;
    this.trackId = config.trackId;
    this.eventBus = eventBus;
    
    this.config = {
      ...config,
      step: config.step ?? 0.01,
      displayName: config.displayName ?? config.parameter,
      unit: config.unit ?? '',
    };
    
    this.recordingState = {
      isRecording: false,
      mode: 'read',
      lastValue: config.defaultValue,
      lastPosition: { bars: 0, beats: 0, sixteenths: 0 },
    };
  }

  /**
   * Add automation point
   */
  addPoint(position: MusicalPosition, value: number, curve?: AutomationCurveType): void {
    const clampedValue = this.clampValue(value);
    const point: AutomationPoint = {
      position: { ...position },
      value: clampedValue,
      curve: curve ?? this.curveType,
    };
    
    // Remove existing point at same position
    this.removePointAt(position);
    
    // Add new point
    this.points.push(point);
    this.isDirty = true;
    
    this.emitChange('pointAdded', point);
  }

  /**
   * Remove automation point
   */
  removePoint(index: number): void {
    if (index < 0 || index >= this.points.length) {
      return;
    }
    
    const removed = this.points.splice(index, 1)[0];
    this.isDirty = true;
    
    this.emitChange('pointRemoved', removed);
  }

  /**
   * Remove point at position
   */
  removePointAt(position: MusicalPosition): boolean {
    const index = this.findPointIndex(position);
    if (index !== -1) {
      this.removePoint(index);
      return true;
    }
    return false;
  }

  /**
   * Update point value
   */
  updatePoint(index: number, value: number, curve?: AutomationCurveType): void {
    if (index < 0 || index >= this.points.length) {
      return;
    }
    
    const point = this.points[index];
    point.value = this.clampValue(value);
    if (curve !== undefined) {
      point.curve = curve;
    }
    
    this.isDirty = true;
    this.emitChange('pointUpdated', point);
  }

  /**
   * Move point to new position
   */
  movePoint(index: number, newPosition: MusicalPosition): void {
    if (index < 0 || index >= this.points.length) {
      return;
    }
    
    const point = this.points[index];
    
    // Check if position is already occupied
    if (this.findPointIndex(newPosition) !== -1) {
      logger.warn('Position already has a point');
      return;
    }
    
    point.position = { ...newPosition };
    this.isDirty = true;
    
    this.emitChange('pointMoved', point);
  }

  /**
   * Get value at position
   */
  getValueAt(position: MusicalPosition): number {
    if (!this.enabled || this.points.length === 0) {
      return this.config.defaultValue;
    }
    
    // Ensure points are sorted
    this.ensureSorted();
    
    // Find surrounding points
    let prevPoint: AutomationPoint | null = null;
    let nextPoint: AutomationPoint | null = null;
    
    for (let i = 0; i < this.sortedPoints.length; i++) {
      const point = this.sortedPoints[i];
      const comparison = this.comparePositions(position, point.position);
      
      if (comparison === 0) {
        // Exact match
        return point.value;
      } else if (comparison < 0) {
        // Position is before this point
        nextPoint = point;
        break;
      } else {
        // Position is after this point
        prevPoint = point;
      }
    }
    
    // Interpolate between points
    if (prevPoint && nextPoint) {
      return this.interpolate(position, prevPoint, nextPoint);
    } else if (prevPoint) {
      // After last point
      return prevPoint.value;
    } else if (nextPoint) {
      // Before first point
      return nextPoint.value;
    }
    
    return this.config.defaultValue;
  }

  /**
   * Set automation mode
   */
  setMode(mode: AutomationMode): void {
    const oldMode = this.recordingState.mode;
    this.recordingState.mode = mode;
    
    if (mode === 'off') {
      this.recordingState.isRecording = false;
    }
    
    this.eventBus?.emit('automation:modeChanged', {
      trackId: this.trackId,
      parameter: this.parameter,
      oldMode,
      newMode: mode,
    });
  }

  /**
   * Start recording
   */
  startRecording(position: MusicalPosition): void {
    if (this.recordingState.mode === 'off' || this.recordingState.mode === 'read') {
      return;
    }
    
    this.recordingState.isRecording = true;
    this.recordingState.lastPosition = { ...position };
    
    if (this.recordingState.mode === 'touch') {
      this.recordingState.touchStarted = Date.now();
    }
    
    logger.debug('Started recording automation', {
      parameter: this.parameter,
      mode: this.recordingState.mode,
    });
  }

  /**
   * Stop recording
   */
  stopRecording(): void {
    this.recordingState.isRecording = false;
    this.recordingState.touchStarted = undefined;
    
    logger.debug('Stopped recording automation', {
      parameter: this.parameter,
      pointCount: this.points.length,
    });
  }

  /**
   * Record value
   */
  recordValue(position: MusicalPosition, value: number): void {
    if (!this.recordingState.isRecording) {
      return;
    }
    
    const clampedValue = this.clampValue(value);
    
    // Handle different recording modes
    switch (this.recordingState.mode) {
      case 'write':
        // Always write
        this.addPoint(position, clampedValue);
        break;
        
      case 'touch':
        // Write while touching
        if (this.recordingState.touchStarted) {
          this.addPoint(position, clampedValue);
        }
        break;
        
      case 'latch':
        // Write after first value change
        if (Math.abs(clampedValue - this.recordingState.lastValue) > this.config.step) {
          this.addPoint(position, clampedValue);
        }
        break;
    }
    
    this.recordingState.lastValue = clampedValue;
    this.recordingState.lastPosition = { ...position };
  }

  /**
   * Clear all points
   */
  clear(): void {
    this.points = [];
    this.sortedPoints = [];
    this.isDirty = true;
    
    this.emitChange('cleared');
  }

  /**
   * Get points in range
   */
  getPointsInRange(start: MusicalPosition, end: MusicalPosition): AutomationPoint[] {
    this.ensureSorted();
    
    return this.sortedPoints.filter(point => {
      const afterStart = this.comparePositions(point.position, start) >= 0;
      const beforeEnd = this.comparePositions(point.position, end) <= 0;
      return afterStart && beforeEnd;
    });
  }

  /**
   * Simplify automation (reduce point count)
   */
  simplify(tolerance: number = 0.01): void {
    if (this.points.length < 3) {
      return;
    }
    
    this.ensureSorted();
    
    const simplified: AutomationPoint[] = [this.sortedPoints[0]];
    let anchor = 0;
    
    for (let i = 2; i < this.sortedPoints.length; i++) {
      const maxDistance = this.getMaxDistance(anchor, i, tolerance);
      
      if (maxDistance > tolerance) {
        simplified.push(this.sortedPoints[i - 1]);
        anchor = i - 1;
      }
    }
    
    // Always keep last point
    simplified.push(this.sortedPoints[this.sortedPoints.length - 1]);
    
    const removed = this.points.length - simplified.length;
    this.points = simplified;
    this.isDirty = true;
    
    logger.info('Automation simplified', {
      parameter: this.parameter,
      removed,
      remaining: this.points.length,
    });
  }

  /**
   * Ensure points are sorted
   */
  private ensureSorted(): void {
    if (!this.isDirty) {
      return;
    }
    
    this.sortedPoints = [...this.points].sort((a, b) => 
      this.comparePositions(a.position, b.position)
    );
    
    this.isDirty = false;
  }

  /**
   * Compare musical positions
   */
  private comparePositions(a: MusicalPosition, b: MusicalPosition): number {
    const totalA = a.bars * 16 + a.beats * 4 + a.sixteenths;
    const totalB = b.bars * 16 + b.beats * 4 + b.sixteenths;
    return totalA - totalB;
  }

  /**
   * Find point index at position
   */
  private findPointIndex(position: MusicalPosition): number {
    return this.points.findIndex(p => 
      this.comparePositions(p.position, position) === 0
    );
  }

  /**
   * Interpolate between points
   */
  private interpolate(
    position: MusicalPosition,
    prev: AutomationPoint,
    next: AutomationPoint
  ): number {
    const prevTotal = prev.position.bars * 16 + prev.position.beats * 4 + prev.position.sixteenths;
    const nextTotal = next.position.bars * 16 + next.position.beats * 4 + next.position.sixteenths;
    const posTotal = position.bars * 16 + position.beats * 4 + position.sixteenths;
    
    const ratio = (posTotal - prevTotal) / (nextTotal - prevTotal);
    
    switch (prev.curve || this.curveType) {
      case 'linear':
        return prev.value + (next.value - prev.value) * ratio;
        
      case 'exponential':
        // Exponential interpolation
        if (prev.value === 0 || next.value === 0) {
          // Fall back to linear if dealing with zero
          return prev.value + (next.value - prev.value) * ratio;
        }
        const logPrev = Math.log(prev.value);
        const logNext = Math.log(next.value);
        return Math.exp(logPrev + (logNext - logPrev) * ratio);
        
      case 'step':
        // Step - hold previous value until next point
        return prev.value;
        
      case 'curve':
        // S-curve interpolation
        const t = ratio;
        const curve = t * t * (3 - 2 * t); // Smoothstep
        return prev.value + (next.value - prev.value) * curve;
        
      default:
        return prev.value;
    }
  }

  /**
   * Get max distance for simplification
   */
  private getMaxDistance(start: number, end: number, tolerance: number): number {
    if (end - start < 2) {
      return 0;
    }
    
    const startPoint = this.sortedPoints[start];
    const endPoint = this.sortedPoints[end];
    let maxDistance = 0;
    
    for (let i = start + 1; i < end; i++) {
      const point = this.sortedPoints[i];
      const interpolated = this.interpolate(point.position, startPoint, endPoint);
      const distance = Math.abs(point.value - interpolated);
      maxDistance = Math.max(maxDistance, distance);
    }
    
    return maxDistance;
  }

  /**
   * Clamp value to valid range
   */
  private clampValue(value: number): number {
    return Math.max(this.config.minValue, Math.min(this.config.maxValue, value));
  }

  /**
   * Emit change event
   */
  private emitChange(type: string, data?: any): void {
    this.eventBus?.emit('automation:changed', {
      trackId: this.trackId,
      parameter: this.parameter,
      type,
      data,
      pointCount: this.points.length,
    });
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<AutomationLaneConfig> {
    return { ...this.config };
  }

  /**
   * Export to JSON
   */
  toJSON(): TrackAutomation {
    return {
      parameter: this.parameter,
      points: this.points.map(p => ({
        position: { ...p.position },
        value: p.value,
        curve: p.curve,
      })),
      enabled: this.enabled,
      curveType: this.curveType,
    };
  }
}