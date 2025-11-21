/**
 * DriftPredictor - Predicts and compensates for timing drift
 *
 * Uses Kalman filtering to predict future drift based on historical measurements.
 * This allows the system to proactively compensate for drift before it becomes audible.
 */

import { KalmanFilter, KalmanFilterFactory } from './KalmanFilter.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('DriftPredictor');

export interface DriftMeasurement {
  timestamp: number; // When the measurement was taken (ms)
  expectedTime: number; // What time we expected (ms)
  actualTime: number; // What time we measured (ms)
  drift: number; // actualTime - expectedTime (ms)
}

export interface DriftPrediction {
  currentDrift: number; // Current estimated drift (ms)
  predictedDrift: number; // Predicted future drift (ms)
  confidence: number; // Confidence in prediction (0-1)
  trend: 'stable' | 'increasing' | 'decreasing';
  rate: number; // Rate of drift change (ms/s)
}

export class DriftPredictor {
  private kalmanFilter: KalmanFilter;
  private measurements: DriftMeasurement[] = [];
  private maxHistorySize = 100;

  // Drift tracking
  private lastMeasurementTime = 0;
  private driftVelocity = 0; // Rate of drift change
  private driftAcceleration = 0; // Rate of velocity change
  private lastResetTime = 0; // Track when reset was called to suppress warnings

  // Configuration
  private readonly driftThreshold: number; // ms
  private readonly velocityWindow: number; // Number of samples for velocity calculation

  constructor(
    config: {
      driftThreshold?: number;
      measurementNoise?: number;
      processNoise?: number;
    } = {},
  ) {
    this.driftThreshold = config.driftThreshold ?? 1.0;
    this.velocityWindow = 5;

    // Create Kalman filter with custom or default parameters
    this.kalmanFilter =
      config.measurementNoise && config.processNoise
        ? new KalmanFilter({
            R: config.measurementNoise,
            Q: config.processNoise,
            A: 1,
            B: 0,
            C: 1,
            x: 0,
            P: 1,
          })
        : KalmanFilterFactory.createDriftFilter();

    logger.info('DriftPredictor initialized', {
      driftThreshold: this.driftThreshold,
      measurementNoise: config.measurementNoise,
      processNoise: config.processNoise,
    });
  }

  /**
   * Add a new drift measurement
   */
  addMeasurement(measurement: DriftMeasurement): void {
    // Store measurement
    this.measurements.push(measurement);

    // Limit history size
    if (this.measurements.length > this.maxHistorySize) {
      this.measurements.shift();
    }

    // Update Kalman filter
    const filteredDrift = this.kalmanFilter.filter(measurement.drift);

    // Calculate velocity if we have enough measurements
    if (this.measurements.length >= 2) {
      const timeDelta = measurement.timestamp - this.lastMeasurementTime;
      if (timeDelta > 0) {
        const newVelocity =
          (measurement.drift - filteredDrift) / (timeDelta / 1000);

        // Update acceleration
        if (this.lastMeasurementTime > 0) {
          this.driftAcceleration =
            (newVelocity - this.driftVelocity) / (timeDelta / 1000);
        }

        this.driftVelocity = newVelocity;
      }
    }

    this.lastMeasurementTime = measurement.timestamp;

    // Log significant drift (suppress for 500ms after reset to avoid transition noise)
    const timeSinceReset = performance.now() - this.lastResetTime;
    const isInTransitionPeriod = this.lastResetTime > 0 && timeSinceReset < 500;

    // Changed to debug level - 1ms drift is actually excellent, no need to warn
    if (Math.abs(measurement.drift) > this.driftThreshold && !isInTransitionPeriod) {
      logger.debug('Drift detected', {
        drift: measurement.drift.toFixed(3),
        filtered: filteredDrift.toFixed(3),
        velocity: this.driftVelocity.toFixed(3),
      });
    }
  }

  /**
   * Predict drift at a future time
   */
  predict(futureTimeMs = 100): DriftPrediction {
    const currentDrift = this.kalmanFilter.getCurrentEstimate();
    const stats = this.kalmanFilter.getStatistics();

    // Calculate predicted drift using current drift and velocity
    const timeDelta = futureTimeMs / 1000; // Convert to seconds
    const predictedDrift =
      currentDrift +
      this.driftVelocity * timeDelta +
      0.5 * this.driftAcceleration * timeDelta * timeDelta;

    // Calculate confidence based on filter convergence and variance
    const variance = stats.varianceEstimate;
    const convergence = stats.convergenceRate;
    const confidence = Math.max(
      0,
      Math.min(1, (1 - variance / 10) * 0.5 + convergence * 0.5),
    );

    // Determine trend
    let trend: 'stable' | 'increasing' | 'decreasing' = 'stable';
    if (Math.abs(this.driftVelocity) < 0.01) {
      trend = 'stable';
    } else if (this.driftVelocity > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return {
      currentDrift,
      predictedDrift,
      confidence,
      trend,
      rate: this.driftVelocity,
    };
  }

  /**
   * Get compensation value for current drift
   */
  getCompensation(): number {
    // Return negative of current drift estimate to compensate
    return -this.kalmanFilter.getCurrentEstimate();
  }

  /**
   * Get predictive compensation for future time
   */
  getPredictiveCompensation(lookAheadMs = 100): number {
    const prediction = this.predict(lookAheadMs);
    // Return negative of predicted drift to compensate
    return -prediction.predictedDrift;
  }

  /**
   * Analyze drift patterns
   */
  analyzeDriftPattern(): {
    meanDrift: number;
    maxDrift: number;
    driftStability: number;
    periodicPattern: boolean;
    period?: number;
  } {
    if (this.measurements.length < 10) {
      return {
        meanDrift: 0,
        maxDrift: 0,
        driftStability: 0,
        periodicPattern: false,
      };
    }

    const drifts = this.measurements.map((m) => m.drift);

    // Calculate basic statistics
    const meanDrift = drifts.reduce((sum, d) => sum + d, 0) / drifts.length;
    const maxDrift = Math.max(...drifts.map(Math.abs));

    // Calculate stability (inverse of variance)
    const variance =
      drifts.reduce((sum, d) => {
        const diff = d - meanDrift;
        return sum + diff * diff;
      }, 0) / drifts.length;
    const driftStability = 1 / (1 + variance);

    // Detect periodic patterns using autocorrelation
    const { isperiodic, period } = this.detectPeriodicity(drifts);

    return {
      meanDrift,
      maxDrift,
      driftStability,
      periodicPattern: isperiodic,
      period,
    };
  }

  /**
   * Detect periodic patterns in drift using autocorrelation
   */
  private detectPeriodicity(drifts: number[]): {
    isperiodic: boolean;
    period?: number;
  } {
    if (drifts.length < 20) {
      return { isperiodic: false };
    }

    // Simple autocorrelation for period detection
    const maxLag = Math.floor(drifts.length / 2);
    let maxCorrelation = 0;
    let bestPeriod = 0;

    for (let lag = 2; lag < maxLag; lag++) {
      let correlation = 0;
      let count = 0;

      for (let i = 0; i < drifts.length - lag; i++) {
        correlation += drifts[i] * drifts[i + lag];
        count++;
      }

      correlation /= count;

      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = lag;
      }
    }

    // Threshold for detecting periodicity
    const threshold = 0.5;
    const isperiodic = maxCorrelation > threshold;

    return {
      isperiodic,
      period: isperiodic ? bestPeriod : undefined,
    };
  }

  /**
   * Reset the predictor
   */
  reset(): void {
    this.kalmanFilter.reset();
    this.measurements = [];
    this.lastMeasurementTime = 0;
    this.driftVelocity = 0;
    this.driftAcceleration = 0;
    this.lastResetTime = performance.now(); // Track reset time to suppress transition warnings

    logger.info('DriftPredictor reset');
  }

  /**
   * Mark start of transition period to suppress warnings
   */
  startTransition(): void {
    this.lastResetTime = performance.now();
    logger.debug('Transition period started - warnings suppressed for 500ms');
  }

  /**
   * Get current statistics
   */
  getStatistics(): {
    measurementCount: number;
    currentDrift: number;
    driftVelocity: number;
    driftAcceleration: number;
    kalmanStats: ReturnType<KalmanFilter['getStatistics']>;
  } {
    return {
      measurementCount: this.measurements.length,
      currentDrift: this.kalmanFilter.getCurrentEstimate(),
      driftVelocity: this.driftVelocity,
      driftAcceleration: this.driftAcceleration,
      kalmanStats: this.kalmanFilter.getStatistics(),
    };
  }

  /**
   * Adjust filter parameters based on conditions
   */
  adaptFilterParameters(conditions: {
    highLatency?: boolean;
    unstableNetwork?: boolean;
    cpuStress?: boolean;
  }): void {
    let R = 0.01; // Default measurement noise
    let Q = 0.00001; // Default process noise

    if (conditions.highLatency) {
      R *= 2; // More measurement noise expected
    }

    if (conditions.unstableNetwork) {
      R *= 1.5;
      Q *= 2; // Process can change more rapidly
    }

    if (conditions.cpuStress) {
      R *= 1.5; // Timing measurements less reliable
    }

    this.kalmanFilter.updateParameters({ R, Q });

    logger.info('Filter parameters adapted', {
      conditions,
      R,
      Q,
    });
  }
}
