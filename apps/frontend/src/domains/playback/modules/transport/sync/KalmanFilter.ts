/**
 * KalmanFilter - Mathematical filter for optimal state estimation
 *
 * Used for predicting and compensating timing drift in audio applications.
 * Provides optimal estimates in the presence of noisy measurements.
 *
 * Based on the discrete Kalman filter equations:
 * - Prediction: x̂(k|k-1) = A·x̂(k-1|k-1) + B·u(k)
 * - Update: x̂(k|k) = x̂(k|k-1) + K(k)·[z(k) - C·x̂(k|k-1)]
 */

export interface KalmanFilterConfig {
  R: number; // Measurement noise covariance
  Q: number; // Process noise covariance
  A: number; // State transition matrix
  B: number; // Control input matrix
  C: number; // Measurement matrix
  x: number; // Initial state estimate
  P: number; // Initial error covariance
}

export class KalmanFilter {
  private R: number; // Measurement noise covariance
  private Q: number; // Process noise covariance
  private A: number; // State transition matrix
  private B: number; // Control input matrix (unused in our case)
  private C: number; // Measurement matrix
  private x: number; // Current state estimate
  private P: number; // Current error covariance
  private K: number; // Kalman gain

  // History for analysis
  private history: {
    measurements: number[];
    estimates: number[];
    gains: number[];
    covariances: number[];
  };

  constructor(config: KalmanFilterConfig) {
    this.R = config.R;
    this.Q = config.Q;
    this.A = config.A;
    this.B = config.B;
    this.C = config.C;
    this.x = config.x;
    this.P = config.P;
    this.K = 0;

    this.history = {
      measurements: [],
      estimates: [],
      gains: [],
      covariances: [],
    };
  }

  /**
   * Process a new measurement and return the filtered estimate
   */
  filter(measurement: number, controlInput = 0): number {
    // Store measurement
    this.history.measurements.push(measurement);

    // Prediction step (a priori estimates)
    const xPredicted = this.A * this.x + this.B * controlInput;
    const PPredicted = this.A * this.P * this.A + this.Q;

    // Calculate Kalman gain
    const denominator = this.C * PPredicted * this.C + this.R;
    this.K = (PPredicted * this.C) / denominator;

    // Update step (a posteriori estimates)
    const innovation = measurement - this.C * xPredicted;
    this.x = xPredicted + this.K * innovation;
    this.P = (1 - this.K * this.C) * PPredicted;

    // Store history
    this.history.estimates.push(this.x);
    this.history.gains.push(this.K);
    this.history.covariances.push(this.P);

    // Limit history size
    if (this.history.measurements.length > 1000) {
      this.history.measurements.shift();
      this.history.estimates.shift();
      this.history.gains.shift();
      this.history.covariances.shift();
    }

    return this.x;
  }

  /**
   * Get the current state estimate
   */
  getCurrentEstimate(): number {
    return this.x;
  }

  /**
   * Get the current error covariance
   */
  getCurrentCovariance(): number {
    return this.P;
  }

  /**
   * Get the current Kalman gain
   */
  getCurrentGain(): number {
    return this.K;
  }

  /**
   * Reset the filter to initial state
   */
  reset(initialState?: number, initialCovariance?: number): void {
    this.x = initialState ?? 0;
    this.P = initialCovariance ?? 1;
    this.K = 0;

    this.history = {
      measurements: [],
      estimates: [],
      gains: [],
      covariances: [],
    };
  }

  /**
   * Update filter parameters (for adaptive filtering)
   */
  updateParameters(params: Partial<KalmanFilterConfig>): void {
    if (params.R !== undefined) this.R = params.R;
    if (params.Q !== undefined) this.Q = params.Q;
    if (params.A !== undefined) this.A = params.A;
    if (params.B !== undefined) this.B = params.B;
    if (params.C !== undefined) this.C = params.C;
  }

  /**
   * Get filter statistics
   */
  getStatistics(): {
    meanEstimate: number;
    varianceEstimate: number;
    meanGain: number;
    convergenceRate: number;
  } {
    const estimates = this.history.estimates;
    const gains = this.history.gains;

    if (estimates.length === 0) {
      return {
        meanEstimate: 0,
        varianceEstimate: 0,
        meanGain: 0,
        convergenceRate: 0,
      };
    }

    // Calculate mean estimate
    const meanEstimate =
      estimates.reduce((sum, val) => sum + val, 0) / estimates.length;

    // Calculate variance of estimates
    const varianceEstimate =
      estimates.reduce((sum, val) => {
        const diff = val - meanEstimate;
        return sum + diff * diff;
      }, 0) / estimates.length;

    // Calculate mean gain
    const meanGain = gains.reduce((sum, val) => sum + val, 0) / gains.length;

    // Calculate convergence rate (how quickly gain decreases)
    let convergenceRate = 0;
    if (gains.length > 10) {
      const recentGains = gains.slice(-10);
      const firstGain = recentGains[0];
      const lastGain = recentGains[recentGains.length - 1];
      convergenceRate = (firstGain - lastGain) / firstGain;
    }

    return {
      meanEstimate,
      varianceEstimate,
      meanGain,
      convergenceRate,
    };
  }

  /**
   * Get filter history for analysis
   */
  getHistory(): typeof this.history {
    return {
      measurements: [...this.history.measurements],
      estimates: [...this.history.estimates],
      gains: [...this.history.gains],
      covariances: [...this.history.covariances],
    };
  }
}

/**
 * Factory function for common Kalman filter configurations
 */
export class KalmanFilterFactory {
  /**
   * Create a filter for clock drift estimation
   */
  static createDriftFilter(): KalmanFilter {
    return new KalmanFilter({
      R: 0.01, // Measurement noise (timing jitter)
      Q: 0.00001, // Process noise (drift changes slowly)
      A: 1, // Drift carries forward
      B: 0, // No control input
      C: 1, // Direct measurement
      x: 0, // Start with no drift
      P: 1, // Initial uncertainty
    });
  }

  /**
   * Create a filter for position tracking
   */
  static createPositionFilter(): KalmanFilter {
    return new KalmanFilter({
      R: 0.1, // Higher measurement noise
      Q: 0.001, // Position can change more
      A: 1, // Position carries forward
      B: 1, // Control input affects position
      C: 1, // Direct measurement
      x: 0, // Start at beginning
      P: 10, // Higher initial uncertainty
    });
  }

  /**
   * Create a filter for tempo tracking
   */
  static createTempoFilter(): KalmanFilter {
    return new KalmanFilter({
      R: 0.5, // Tempo measurements can be noisy
      Q: 0.0001, // Tempo changes very slowly
      A: 1, // Tempo carries forward
      B: 0, // No control input
      C: 1, // Direct measurement
      x: 120, // Start at 120 BPM
      P: 100, // High initial uncertainty
    });
  }
}
