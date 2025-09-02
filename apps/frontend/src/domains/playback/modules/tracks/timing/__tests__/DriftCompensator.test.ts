import { describe, it, expect, beforeEach } from 'vitest';
import { DriftCompensator } from '../DriftCompensator';
import type { TrackTimingState } from '../types';

describe('DriftCompensator', () => {
  let compensator: DriftCompensator;
  let mockTimingState: TrackTimingState;
  
  beforeEach(() => {
    compensator = new DriftCompensator(1.0, 10, 48000);
    
    mockTimingState = {
      trackId: 'test-track',
      lastScheduledTime: 0,
      lastAudioWorkletTime: 0,
      driftMeasurement: 0,
      driftHistory: [],
      compensationOffset: 0,
      priority: 50,
      isActive: true,
      errorCount: 0,
    };
  });
  
  describe('Drift Measurement', () => {
    it('should measure positive drift', () => {
      const drift = compensator.measureDrift(1.0, 1.001);
      expect(drift).toBeCloseTo(1.0); // 1ms drift
    });
    
    it('should measure negative drift', () => {
      const drift = compensator.measureDrift(1.0, 0.999);
      expect(drift).toBeCloseTo(-1.0); // -1ms drift
    });
    
    it('should measure zero drift', () => {
      const drift = compensator.measureDrift(1.0, 1.0);
      expect(drift).toBe(0);
    });
  });
  
  describe('Drift History', () => {
    it('should update drift history', () => {
      compensator.updateDriftHistory(mockTimingState, 0.5);
      
      expect(mockTimingState.driftMeasurement).toBe(0.5);
      expect(mockTimingState.driftHistory).toEqual([0.5]);
    });
    
    it('should maintain history size', () => {
      // Add 12 measurements (exceeds history size of 10)
      for (let i = 0; i < 12; i++) {
        compensator.updateDriftHistory(mockTimingState, i * 0.1);
      }
      
      expect(mockTimingState.driftHistory.length).toBe(10);
      expect(mockTimingState.driftHistory[0]).toBeCloseTo(0.2); // First two removed
      expect(mockTimingState.driftHistory[9]).toBeCloseTo(1.1); // Last one kept
    });
  });
  
  describe('Average Drift Calculation', () => {
    it('should calculate average of empty history', () => {
      const avg = compensator.calculateAverageDrift([]);
      expect(avg).toBe(0);
    });
    
    it('should calculate average drift', () => {
      const history = [1.0, 2.0, 3.0, 4.0, 5.0];
      const avg = compensator.calculateAverageDrift(history);
      expect(avg).toBe(3.0);
    });
    
    it('should handle negative values', () => {
      const history = [-1.0, 1.0, -1.0, 1.0];
      const avg = compensator.calculateAverageDrift(history);
      expect(avg).toBe(0);
    });
  });
  
  describe('Drift Variance and Stability', () => {
    it('should calculate zero variance for constant drift', () => {
      const history = [1.0, 1.0, 1.0, 1.0];
      const variance = compensator.calculateDriftVariance(history);
      expect(variance).toBe(0);
    });
    
    it('should calculate variance for varying drift', () => {
      const history = [0, 2, 0, 2];
      const variance = compensator.calculateDriftVariance(history);
      expect(variance).toBeCloseTo(1.0);
    });
    
    it('should calculate 100% stability for no variance', () => {
      const history = [0.5, 0.5, 0.5];
      const stability = compensator.calculateStability(history);
      expect(stability).toBe(100);
    });
    
    it('should calculate reduced stability for high variance', () => {
      const history = [0, 5, -5, 10, -10];
      const stability = compensator.calculateStability(history);
      expect(stability).toBeLessThan(50);
    });
  });
  
  describe('Tolerance Checking', () => {
    it('should accept drift within tolerance', () => {
      expect(compensator.isDriftWithinTolerance(0.5)).toBe(true);
      expect(compensator.isDriftWithinTolerance(-0.5)).toBe(true);
      expect(compensator.isDriftWithinTolerance(1.0)).toBe(true);
    });
    
    it('should reject drift outside tolerance', () => {
      expect(compensator.isDriftWithinTolerance(1.1)).toBe(false);
      expect(compensator.isDriftWithinTolerance(-1.1)).toBe(false);
    });
  });
  
  describe('Sample Accuracy', () => {
    it('should be sample-accurate for small drift', () => {
      // Less than 1 sample at 48kHz (< 0.021ms)
      expect(compensator.isSampleAccurate(0.02)).toBe(true);
    });
    
    it('should not be sample-accurate for large drift', () => {
      // More than 1 sample
      expect(compensator.isSampleAccurate(0.025)).toBe(false);
      expect(compensator.isSampleAccurate(1.0)).toBe(false);
    });
  });
  
  describe('Compensation Calculation', () => {
    it('should calculate zero compensation for empty history', () => {
      const compensation = compensator.calculateCompensation(mockTimingState);
      expect(compensation).toBe(0);
    });
    
    it('should calculate negative compensation for positive drift', () => {
      mockTimingState.driftHistory = [1.0, 1.0, 1.0];
      const compensation = compensator.calculateCompensation(mockTimingState);
      expect(compensation).toBe(-1.0);
    });
    
    it('should calculate positive compensation for negative drift', () => {
      mockTimingState.driftHistory = [-2.0, -2.0, -2.0];
      const compensation = compensator.calculateCompensation(mockTimingState);
      expect(compensation).toBe(2.0);
    });
  });
  
  describe('Compensation Application', () => {
    it('should apply positive compensation', () => {
      const compensated = compensator.applyCompensation(1.0, 5.0);
      expect(compensated).toBeCloseTo(1.005); // 1.0 + 5ms
    });
    
    it('should apply negative compensation', () => {
      const compensated = compensator.applyCompensation(1.0, -3.0);
      expect(compensated).toBeCloseTo(0.997); // 1.0 - 3ms
    });
  });
  
  describe('Drift Pattern Analysis', () => {
    it('should detect no anomaly in stable drift', () => {
      const history = [0.5, 0.4, 0.5, 0.6, 0.5];
      const analysis = compensator.analyzeDriftPattern(history);
      expect(analysis.hasAnomaly).toBe(false);
    });
    
    it('should detect sudden jump', () => {
      const history = [0.5, 0.4, 0.5, 5.0, 0.5];
      const analysis = compensator.analyzeDriftPattern(history);
      expect(analysis.hasAnomaly).toBe(true);
      expect(analysis.anomalyType).toBe('sudden_jump');
    });
    
    it('should detect increasing drift', () => {
      const history = [0.1, 0.5, 1.0, 2.0, 3.0, 4.0];
      const analysis = compensator.analyzeDriftPattern(history);
      expect(analysis.hasAnomaly).toBe(true);
      expect(analysis.anomalyType).toBe('increasing_drift');
    });
    
    it('should detect oscillation', () => {
      const history = [1.0, -1.0, 1.0, -1.0, 1.0, -1.0];
      const analysis = compensator.analyzeDriftPattern(history);
      expect(analysis.hasAnomaly).toBe(true);
      expect(analysis.anomalyType).toBe('oscillation');
    });
  });
  
  describe('Sample Conversion', () => {
    it('should convert drift to samples', () => {
      const samples = compensator.driftToSamples(1.0);
      expect(samples).toBe(48); // 1ms at 48kHz = 48 samples
    });
    
    it('should get maximum drift in samples', () => {
      const maxSamples = compensator.getMaxDriftSamples();
      expect(maxSamples).toBe(48); // 1ms tolerance at 48kHz
    });
  });
});