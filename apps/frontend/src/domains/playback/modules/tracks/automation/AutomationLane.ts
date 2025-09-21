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

import type { TrackAutomation, AutomationPoint } from '../../../types/track.js';

type AutomationCurveType = 'linear' | 'exponential' | 'step';
import {
  EventBus,
  createStructuredLogger,
  type MusicalPosition,
} from '../../shared/index.js';

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
  public enabled = true;
  public curveType: AutomationCurveType = 'linear';
  public mode: 'read' | 'write' | 'touch' | 'latch' | 'off' = 'read';

  // Configuration
  private config: Required<AutomationLaneConfig>;
  private recordingState: AutomationRecordingState;
  private eventBus?: EventBus;

  // Performance optimization
  private sortedPoints: AutomationPoint[] = [];
  private isDirty = true;

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
      lastPosition: '0:0:0',
    };
  }

  /**
   * Add automation point
   */
  addPoint(
    position: MusicalPosition,
    value: number,
    curve?: AutomationCurveType,
  ): void {
    const clampedValue = this.clampValue(value);
    const point: AutomationPoint = {
      position: position,
      value: clampedValue,
    };

    // Add curve property if provided
    if (curve) {
      (point as any).curve = curve;
    }

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
    if (point) {
      point.value = this.clampValue(value);
      // Add curve property if provided
      if (curve) {
        (point as any).curve = curve;
      }
      this.isDirty = true;
      this.emitChange('pointUpdated', point);
    }
  }

  /**
   * Move point to new position
   */
  movePoint(index: number, newPosition: MusicalPosition): void {
    if (index < 0 || index >= this.points.length) {
      return;
    }

    const point = this.points[index];
    if (!point) {
      return;
    }

    // Check if position is already occupied
    if (this.findPointIndex(newPosition) !== -1) {
      logger.warn('Position already has a point');
      return;
    }

    point.position = newPosition;
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
      if (!point) continue;

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
    if (
      this.recordingState.mode === 'off' ||
      this.recordingState.mode === 'read'
    ) {
      return;
    }

    this.recordingState.isRecording = true;
    this.recordingState.lastPosition = position;

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
        if (
          Math.abs(clampedValue - this.recordingState.lastValue) >
          this.config.step
        ) {
          this.addPoint(position, clampedValue);
        }
        break;
    }

    this.recordingState.lastValue = clampedValue;
    this.recordingState.lastPosition = position;
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
  getPointsInRange(
    start: MusicalPosition,
    end: MusicalPosition,
  ): AutomationPoint[] {
    this.ensureSorted();

    return this.sortedPoints.filter((point) => {
      const afterStart = this.comparePositions(point.position, start) >= 0;
      const beforeEnd = this.comparePositions(point.position, end) <= 0;
      return afterStart && beforeEnd;
    });
  }

  /**
   * Simplify automation (reduce point count)
   */
  simplify(_tolerance = 0.01): void {
    if (this.points.length < 3) {
      return;
    }

    this.ensureSorted();

    const firstPoint = this.sortedPoints[0];
    if (!firstPoint) return;
    const simplified: AutomationPoint[] = [firstPoint];
    let anchor = 0;

    for (let i = 2; i < this.sortedPoints.length; i++) {
      const maxDistance = this.getMaxDistance(anchor, i, _tolerance);

      if (maxDistance > _tolerance) {
        const pointToPush = this.sortedPoints[i - 1];
        if (pointToPush) {
          simplified.push(pointToPush);
        }
        anchor = i - 1;
      }
    }

    // Always keep last point
    const lastPoint = this.sortedPoints[this.sortedPoints.length - 1];
    if (lastPoint) {
      simplified.push(lastPoint);
    }

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
      this.comparePositions(a.position, b.position),
    );

    this.isDirty = false;
  }

  /**
   * Compare musical positions
   */
  private comparePositions(a: MusicalPosition, b: MusicalPosition): number {
    // Handle both string and object formats
    let aBars = 0,
      aBeats = 0,
      aSixteenths = 0;
    let bBars = 0,
      bBeats = 0,
      bSixteenths = 0;

    if (typeof a === 'string') {
      [aBars = 0, aBeats = 0, aSixteenths = 0] = a.split(':').map(Number);
    } else if (typeof a === 'object' && a !== null) {
      aBars = (a as any).bars || 0;
      aBeats = (a as any).beats || 0;
      aSixteenths = (a as any).sixteenths || 0;
    }

    if (typeof b === 'string') {
      [bBars = 0, bBeats = 0, bSixteenths = 0] = b.split(':').map(Number);
    } else if (typeof b === 'object' && b !== null) {
      bBars = (b as any).bars || 0;
      bBeats = (b as any).beats || 0;
      bSixteenths = (b as any).sixteenths || 0;
    }

    const totalA = aBars * 16 + aBeats * 4 + aSixteenths;
    const totalB = bBars * 16 + bBeats * 4 + bSixteenths;
    return totalA - totalB;
  }

  /**
   * Find point index at position
   */
  private findPointIndex(position: MusicalPosition): number {
    return this.points.findIndex(
      (p) => this.comparePositions(p.position, position) === 0,
    );
  }

  /**
   * Interpolate between points
   */
  private interpolate(
    position: MusicalPosition,
    prev: AutomationPoint,
    next: AutomationPoint,
  ): number {
    // Handle both string and object formats
    let prevBars = 0,
      prevBeats = 0,
      prevSixteenths = 0;
    let nextBars = 0,
      nextBeats = 0,
      nextSixteenths = 0;
    let posBars = 0,
      posBeats = 0,
      posSixteenths = 0;

    if (typeof prev.position === 'string') {
      [prevBars = 0, prevBeats = 0, prevSixteenths = 0] = prev.position
        .split(':')
        .map(Number);
    } else if (typeof prev.position === 'object' && prev.position !== null) {
      prevBars = (prev.position as any).bars || 0;
      prevBeats = (prev.position as any).beats || 0;
      prevSixteenths = (prev.position as any).sixteenths || 0;
    }

    if (typeof next.position === 'string') {
      [nextBars = 0, nextBeats = 0, nextSixteenths = 0] = next.position
        .split(':')
        .map(Number);
    } else if (typeof next.position === 'object' && next.position !== null) {
      nextBars = (next.position as any).bars || 0;
      nextBeats = (next.position as any).beats || 0;
      nextSixteenths = (next.position as any).sixteenths || 0;
    }

    if (typeof position === 'string') {
      [posBars = 0, posBeats = 0, posSixteenths = 0] = position
        .split(':')
        .map(Number);
    } else if (typeof position === 'object' && position !== null) {
      posBars = (position as any).bars || 0;
      posBeats = (position as any).beats || 0;
      posSixteenths = (position as any).sixteenths || 0;
    }

    const prevTotal = prevBars * 16 + prevBeats * 4 + prevSixteenths;
    const nextTotal = nextBars * 16 + nextBeats * 4 + nextSixteenths;
    const posTotal = posBars * 16 + posBeats * 4 + posSixteenths;

    const ratio = (posTotal - prevTotal) / (nextTotal - prevTotal);

    // Check if the previous point has a specific curve type
    const curveType = (prev as any).curve || this.curveType;

    switch (curveType) {
      case 'linear': {
        return prev.value + (next.value - prev.value) * ratio;
      }

      case 'exponential': {
        // Exponential interpolation
        if (prev.value === 0 || next.value === 0) {
          // Fall back to linear if dealing with zero
          return prev.value + (next.value - prev.value) * ratio;
        }
        const logPrev = Math.log(prev.value);
        const logNext = Math.log(next.value);
        return Math.exp(logPrev + (logNext - logPrev) * ratio);
      }

      case 'step': {
        // Step - hold previous value until next point
        return prev.value;
      }

      case 'curve': {
        // S-curve (smoothstep) interpolation
        const smoothRatio = ratio * ratio * (3 - 2 * ratio);
        return prev.value + (next.value - prev.value) * smoothRatio;
      }

      default:
        return prev.value;
    }
  }

  /**
   * Get max distance for simplification
   */
  private getMaxDistance(
    start: number,
    end: number,
    _tolerance: number,
  ): number {
    if (end - start < 2) {
      return 0;
    }

    const startPoint = this.sortedPoints[start];
    const endPoint = this.sortedPoints[end];
    if (!startPoint || !endPoint) {
      return 0;
    }
    let maxDistance = 0;

    for (let i = start + 1; i < end; i++) {
      const point = this.sortedPoints[i];
      if (!point) continue;
      const interpolated = this.interpolate(
        point.position,
        startPoint,
        endPoint,
      );
      const distance = Math.abs(point.value - interpolated);
      maxDistance = Math.max(maxDistance, distance);
    }

    return maxDistance;
  }

  /**
   * Clamp value to valid range
   */
  private clampValue(value: number): number {
    return Math.max(
      this.config.minValue,
      Math.min(this.config.maxValue, value),
    );
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
      points: this.points.map((p) => ({
        position: p.position,
        value: p.value,
      })),
      mode: this.mode,
      enabled: this.enabled,
      curveType: this.curveType,
    };
  }
}
