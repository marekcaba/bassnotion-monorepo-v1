/**
 * AutomationController - Manages all automation for a track
 *
 * Coordinates multiple automation lanes and provides:
 * - Parameter registration
 * - Global automation controls
 * - Snapshot management
 * - Automation playback
 */

import { AutomationLane, AutomationMode } from './AutomationLane.js';
import type { TrackAutomation } from '../../../types/track.js';
import type { MusicalPosition } from '../../../types/pattern.js';
import { EventBus, createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('AutomationController');

export interface AutomationParameter {
  name: string;
  displayName: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  step: number;
  unit: string;
  category: 'mixer' | 'effect' | 'instrument' | 'custom';
}

export interface AutomationSnapshot {
  timestamp: number;
  name: string;
  parameters: Map<string, TrackAutomation>;
}

export interface AutomationControllerConfig {
  trackId: string;
  enableRecording?: boolean;
  maxSnapshots?: number;
}

export class AutomationController {
  private trackId: string;
  private lanes = new Map<string, AutomationLane>();
  private parameters = new Map<string, AutomationParameter>();
  private snapshots = new Map<string, AutomationSnapshot>();
  private config: Required<AutomationControllerConfig>;
  private eventBus?: EventBus;

  // Global state
  private globalMode: AutomationMode = 'read';
  private isPlaying = false;
  private currentPosition: MusicalPosition = '0:0:0';

  constructor(config: AutomationControllerConfig, eventBus?: EventBus) {
    this.trackId = config.trackId;
    this.eventBus = eventBus;

    this.config = {
      trackId: config.trackId,
      enableRecording: config.enableRecording ?? true,
      maxSnapshots: config.maxSnapshots ?? 32,
    };

    this.registerDefaultParameters();
  }

  /**
   * Register default mixer parameters
   */
  private registerDefaultParameters(): void {
    // Mixer parameters
    this.registerParameter({
      name: 'volume',
      displayName: 'Volume',
      defaultValue: 0.75,
      minValue: 0,
      maxValue: 1,
      step: 0.01,
      unit: '',
      category: 'mixer',
    });

    this.registerParameter({
      name: 'pan',
      displayName: 'Pan',
      defaultValue: 0,
      minValue: -1,
      maxValue: 1,
      step: 0.01,
      unit: '',
      category: 'mixer',
    });

    // Send levels
    for (let i = 1; i <= 4; i++) {
      this.registerParameter({
        name: `send${i}`,
        displayName: `Send ${i}`,
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        step: 0.01,
        unit: '',
        category: 'mixer',
      });
    }
  }

  /**
   * Register automation parameter
   */
  registerParameter(param: AutomationParameter): void {
    if (this.parameters.has(param.name)) {
      logger.warn('Parameter already registered', { name: param.name });
      return;
    }

    this.parameters.set(param.name, param);

    // Create lane if automation exists
    if (!this.lanes.has(param.name)) {
      const lane = new AutomationLane(
        {
          parameter: param.name,
          trackId: this.trackId,
          defaultValue: param.defaultValue,
          minValue: param.minValue,
          maxValue: param.maxValue,
          step: param.step,
          displayName: param.displayName,
          unit: param.unit,
        },
        this.eventBus,
      );

      this.lanes.set(param.name, lane);
    }

    logger.debug('Parameter registered', {
      trackId: this.trackId,
      parameter: param.name,
    });
  }

  /**
   * Get or create automation lane
   */
  getLane(parameter: string): AutomationLane | undefined {
    return this.lanes.get(parameter);
  }

  /**
   * Create automation lane
   */
  createLane(parameter: string): AutomationLane {
    const param = this.parameters.get(parameter);
    if (!param) {
      throw new Error(`Parameter not registered: ${parameter}`);
    }

    const existingLane = this.lanes.get(parameter);
    if (existingLane) {
      return existingLane;
    }

    const lane = new AutomationLane(
      {
        parameter: param.name,
        trackId: this.trackId,
        defaultValue: param.defaultValue,
        minValue: param.minValue,
        maxValue: param.maxValue,
        step: param.step,
        displayName: param.displayName,
        unit: param.unit,
      },
      this.eventBus,
    );

    this.lanes.set(parameter, lane);

    this.eventBus?.emit('automation:laneCreated', {
      trackId: this.trackId,
      parameter,
    });

    return lane;
  }

  /**
   * Delete automation lane
   */
  deleteLane(parameter: string): void {
    const lane = this.lanes.get(parameter);
    if (!lane) {
      return;
    }

    lane.clear();
    this.lanes.delete(parameter);

    this.eventBus?.emit('automation:laneDeleted', {
      trackId: this.trackId,
      parameter,
    });
  }

  /**
   * Set global automation mode
   */
  setGlobalMode(mode: AutomationMode): void {
    this.globalMode = mode;

    // Apply to all lanes
    this.lanes.forEach((lane) => {
      lane.setMode(mode);
    });

    logger.info('Global automation mode set', {
      trackId: this.trackId,
      mode,
    });
  }

  /**
   * Set mode for specific parameter
   */
  setParameterMode(parameter: string, mode: AutomationMode): void {
    const lane = this.lanes.get(parameter);
    if (lane) {
      lane.setMode(mode);
    }
  }

  /**
   * Start playback
   */
  startPlayback(position: MusicalPosition): void {
    this.isPlaying = true;
    this.currentPosition = position;

    // Start recording if in write/touch/latch mode
    if (
      this.config.enableRecording &&
      this.globalMode !== 'read' &&
      this.globalMode !== 'off'
    ) {
      this.lanes.forEach((lane) => {
        if (lane.enabled) {
          lane.startRecording(position);
        }
      });
    }
  }

  /**
   * Stop playback
   */
  stopPlayback(): void {
    this.isPlaying = false;

    // Stop recording
    this.lanes.forEach((lane) => {
      lane.stopRecording();
    });
  }

  /**
   * Update position during playback
   */
  updatePosition(position: MusicalPosition): void {
    this.currentPosition = position;
  }

  /**
   * Get all automation values at position
   */
  getValuesAt(position: MusicalPosition): Map<string, number> {
    const values = new Map<string, number>();

    this.lanes.forEach((lane, parameter) => {
      if (lane.enabled) {
        values.set(parameter, lane.getValueAt(position));
      } else {
        const param = this.parameters.get(parameter);
        if (param) {
          values.set(parameter, param.defaultValue);
        }
      }
    });

    return values;
  }

  /**
   * Record automation value
   */
  recordValue(
    parameter: string,
    value: number,
    position?: MusicalPosition,
  ): void {
    const lane = this.lanes.get(parameter);
    if (!lane || !lane.enabled) {
      return;
    }

    const pos = position || this.currentPosition;
    lane.recordValue(pos, value);
  }

  /**
   * Create automation snapshot
   */
  createSnapshot(name: string): string {
    if (this.snapshots.size >= this.config.maxSnapshots) {
      // Remove oldest snapshot
      const oldest = Array.from(this.snapshots.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp,
      )[0];
      if (oldest) {
        this.snapshots.delete(oldest[0]);
      }
    }

    const snapshotId = `snapshot-${Date.now()}`;
    const snapshot: AutomationSnapshot = {
      timestamp: Date.now(),
      name,
      parameters: new Map(),
    };

    // Copy all lane data
    this.lanes.forEach((lane, parameter) => {
      snapshot.parameters.set(parameter, lane.toJSON());
    });

    this.snapshots.set(snapshotId, snapshot);

    logger.info('Automation snapshot created', {
      trackId: this.trackId,
      snapshotId,
      name,
    });

    return snapshotId;
  }

  /**
   * Recall automation snapshot
   */
  recallSnapshot(snapshotId: string): void {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    // Clear existing automation
    this.lanes.forEach((lane) => lane.clear());

    // Restore from snapshot
    snapshot.parameters.forEach((automation, parameter) => {
      let lane = this.lanes.get(parameter);

      if (!lane) {
        // Create lane if it doesn't exist
        const param = this.parameters.get(parameter);
        if (param) {
          lane = this.createLane(parameter);
        }
      }

      if (lane) {
        // Restore points
        automation.points.forEach((point) => {
          lane.addPoint(point.position, point.value);
        });

        lane.enabled = true; // Default to enabled
        lane.curveType = automation.curveType;
      }
    });

    logger.info('Automation snapshot recalled', {
      trackId: this.trackId,
      snapshotId,
      name: snapshot.name,
    });
  }

  /**
   * Clear all automation
   */
  clearAll(): void {
    this.lanes.forEach((lane) => lane.clear());

    this.eventBus?.emit('automation:clearedAll', {
      trackId: this.trackId,
    });
  }

  /**
   * Get all lanes
   */
  getAllLanes(): Map<string, AutomationLane> {
    return new Map(this.lanes);
  }

  /**
   * Get all parameters
   */
  getAllParameters(): Map<string, AutomationParameter> {
    return new Map(this.parameters);
  }

  /**
   * Get automation summary
   */
  getSummary(): {
    laneCount: number;
    activeLanes: number;
    totalPoints: number;
    mode: AutomationMode;
    isRecording: boolean;
  } {
    let activeLanes = 0;
    let totalPoints = 0;

    this.lanes.forEach((lane) => {
      if (lane.enabled && lane.points.length > 0) {
        activeLanes++;
        totalPoints += lane.points.length;
      }
    });

    return {
      laneCount: this.lanes.size,
      activeLanes,
      totalPoints,
      mode: this.globalMode,
      isRecording:
        this.isPlaying &&
        this.globalMode !== 'read' &&
        this.globalMode !== 'off',
    };
  }

  /**
   * Export all automation
   */
  export(): TrackAutomation[] {
    const automation: TrackAutomation[] = [];

    this.lanes.forEach((lane) => {
      if (lane.points.length > 0) {
        automation.push(lane.toJSON());
      }
    });

    return automation;
  }

  /**
   * Import automation
   */
  import(automation: TrackAutomation[]): void {
    // Clear existing
    this.clearAll();

    // Import each lane
    automation.forEach((data) => {
      let lane = this.lanes.get(data.parameter);

      if (!lane) {
        // Try to create lane if parameter is registered
        const param = this.parameters.get(data.parameter);
        if (param) {
          lane = this.createLane(data.parameter);
        }
      }

      if (lane) {
        data.points.forEach((point) => {
          lane.addPoint(point.position, point.value);
        });

        lane.enabled = true; // Default to enabled
        lane.curveType = data.curveType;
      }
    });

    logger.info('Automation imported', {
      trackId: this.trackId,
      laneCount: automation.length,
    });
  }

  /**
   * Dispose
   */
  dispose(): void {
    this.lanes.clear();
    this.parameters.clear();
    this.snapshots.clear();
  }
}
