/**
 * ConfigurationCoordinator Tests
 *
 * Tests configuration synchronization across modules
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigurationCoordinator } from '../ConfigurationCoordinator.js';

// Mock logger
vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('ConfigurationCoordinator', () => {
  let coordinator: ConfigurationCoordinator;
  let mockCountdownManager: any;
  let mockScheduleCache: any;
  let mockCC64TimelineBuilder: any;
  let mockTracks: Map<string, any>;

  beforeEach(() => {
    coordinator = new ConfigurationCoordinator('test-instance');

    mockCountdownManager = {
      enableCountdown: vi.fn(),
      disableCountdown: vi.fn(),
      getCountdownOffsetBeats: vi.fn(() => 4),
      addCountdownRegion: vi.fn(),
      addVoiceCountdownRegion: vi.fn(),
    };

    mockScheduleCache = {
      setCountdownOffsetBeats: vi.fn(),
    };

    mockCC64TimelineBuilder = {
      setCountdownConfig: vi.fn(),
    };

    mockTracks = new Map();
  });

  // ============================================================================
  // ENABLE COUNTDOWN TESTS
  // ============================================================================

  describe('enableCountdown', () => {
    it('should enable countdown in countdown manager', () => {
      const timeSignature = { numerator: 4, denominator: 4 };

      coordinator.enableCountdown(
        timeSignature,
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(mockCountdownManager.enableCountdown).toHaveBeenCalledWith(timeSignature);
    });

    it('should sync countdown offset to schedule cache', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      mockCountdownManager.getCountdownOffsetBeats.mockReturnValue(4);

      coordinator.enableCountdown(
        timeSignature,
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(mockScheduleCache.setCountdownOffsetBeats).toHaveBeenCalledWith(4);
    });

    it('should sync countdown config to CC64 timeline builder', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      mockCountdownManager.getCountdownOffsetBeats.mockReturnValue(4);

      coordinator.enableCountdown(
        timeSignature,
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(mockCC64TimelineBuilder.setCountdownConfig).toHaveBeenCalledWith(4, true);
    });

    it('should return countdown offset beats', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      mockCountdownManager.getCountdownOffsetBeats.mockReturnValue(4);

      const result = coordinator.enableCountdown(
        timeSignature,
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(result).toBe(4);
    });

    it('should handle different time signatures', () => {
      const timeSignature34 = { numerator: 3, denominator: 4 };
      mockCountdownManager.getCountdownOffsetBeats.mockReturnValue(3);

      const result = coordinator.enableCountdown(
        timeSignature34,
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(result).toBe(3);
      expect(mockScheduleCache.setCountdownOffsetBeats).toHaveBeenCalledWith(3);
      expect(mockCC64TimelineBuilder.setCountdownConfig).toHaveBeenCalledWith(3, true);
    });

    it('should sync all modules in correct order', () => {
      const timeSignature = { numerator: 4, denominator: 4 };
      const callOrder: string[] = [];

      mockCountdownManager.enableCountdown.mockImplementation(() => {
        callOrder.push('countdown');
      });
      mockCountdownManager.getCountdownOffsetBeats.mockImplementation(() => {
        callOrder.push('getOffset');
        return 4;
      });
      mockScheduleCache.setCountdownOffsetBeats.mockImplementation(() => {
        callOrder.push('cache');
      });
      mockCC64TimelineBuilder.setCountdownConfig.mockImplementation(() => {
        callOrder.push('cc64');
      });

      coordinator.enableCountdown(
        timeSignature,
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(callOrder).toEqual(['countdown', 'getOffset', 'cache', 'cc64']);
    });
  });

  // ============================================================================
  // DISABLE COUNTDOWN TESTS
  // ============================================================================

  describe('disableCountdown', () => {
    it('should disable countdown in countdown manager', () => {
      coordinator.disableCountdown(
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(mockCountdownManager.disableCountdown).toHaveBeenCalled();
    });

    it('should reset countdown offset in schedule cache', () => {
      coordinator.disableCountdown(
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(mockScheduleCache.setCountdownOffsetBeats).toHaveBeenCalledWith(0);
    });

    it('should reset countdown config in CC64 timeline builder', () => {
      coordinator.disableCountdown(
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(mockCC64TimelineBuilder.setCountdownConfig).toHaveBeenCalledWith(0, false);
    });

    it('should sync all modules in correct order', () => {
      const callOrder: string[] = [];

      mockCountdownManager.disableCountdown.mockImplementation(() => {
        callOrder.push('countdown');
      });
      mockScheduleCache.setCountdownOffsetBeats.mockImplementation(() => {
        callOrder.push('cache');
      });
      mockCC64TimelineBuilder.setCountdownConfig.mockImplementation(() => {
        callOrder.push('cc64');
      });

      coordinator.disableCountdown(
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(callOrder).toEqual(['countdown', 'cache', 'cc64']);
    });
  });

  // ============================================================================
  // COUNTDOWN REGION TESTS
  // ============================================================================

  describe('addCountdownRegion', () => {
    it('should delegate to countdown manager', () => {
      const timeSignature = { numerator: 4, denominator: 4 };

      coordinator.addCountdownRegion(
        timeSignature,
        mockTracks,
        mockCountdownManager,
      );

      expect(mockCountdownManager.addCountdownRegion).toHaveBeenCalledWith(
        mockTracks,
        timeSignature,
      );
    });

    it('should handle different time signatures', () => {
      const timeSignature = { numerator: 3, denominator: 4 };

      coordinator.addCountdownRegion(
        timeSignature,
        mockTracks,
        mockCountdownManager,
      );

      expect(mockCountdownManager.addCountdownRegion).toHaveBeenCalledWith(
        mockTracks,
        timeSignature,
      );
    });
  });

  // ============================================================================
  // VOICE COUNTDOWN REGION TESTS
  // ============================================================================

  describe('addVoiceCountdownRegion', () => {
    it('should delegate to countdown manager', () => {
      const timeSignature = { numerator: 4, denominator: 4 };

      coordinator.addVoiceCountdownRegion(
        timeSignature,
        mockTracks,
        mockCountdownManager,
      );

      expect(mockCountdownManager.addVoiceCountdownRegion).toHaveBeenCalledWith(
        mockTracks,
        timeSignature,
      );
    });

    it('should handle different time signatures', () => {
      const timeSignature = { numerator: 3, denominator: 4 };

      coordinator.addVoiceCountdownRegion(
        timeSignature,
        mockTracks,
        mockCountdownManager,
      );

      expect(mockCountdownManager.addVoiceCountdownRegion).toHaveBeenCalledWith(
        mockTracks,
        timeSignature,
      );
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration scenarios', () => {
    it('should handle enable-disable cycle correctly', () => {
      const timeSignature = { numerator: 4, denominator: 4 };

      // Enable countdown
      coordinator.enableCountdown(
        timeSignature,
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(mockCountdownManager.enableCountdown).toHaveBeenCalledWith(timeSignature);
      expect(mockScheduleCache.setCountdownOffsetBeats).toHaveBeenCalledWith(4);
      expect(mockCC64TimelineBuilder.setCountdownConfig).toHaveBeenCalledWith(4, true);

      // Clear mocks
      vi.clearAllMocks();

      // Disable countdown
      coordinator.disableCountdown(
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(mockCountdownManager.disableCountdown).toHaveBeenCalled();
      expect(mockScheduleCache.setCountdownOffsetBeats).toHaveBeenCalledWith(0);
      expect(mockCC64TimelineBuilder.setCountdownConfig).toHaveBeenCalledWith(0, false);
    });

    it('should handle complete countdown setup workflow', () => {
      const timeSignature = { numerator: 4, denominator: 4 };

      // 1. Enable countdown
      const offsetBeats = coordinator.enableCountdown(
        timeSignature,
        mockCountdownManager,
        mockScheduleCache,
        mockCC64TimelineBuilder,
      );

      expect(offsetBeats).toBe(4);

      // 2. Add metronome countdown region
      coordinator.addCountdownRegion(
        timeSignature,
        mockTracks,
        mockCountdownManager,
      );

      // 3. Add voice cue countdown region
      coordinator.addVoiceCountdownRegion(
        timeSignature,
        mockTracks,
        mockCountdownManager,
      );

      // Verify all calls happened
      expect(mockCountdownManager.enableCountdown).toHaveBeenCalled();
      expect(mockCountdownManager.addCountdownRegion).toHaveBeenCalled();
      expect(mockCountdownManager.addVoiceCountdownRegion).toHaveBeenCalled();
      expect(mockScheduleCache.setCountdownOffsetBeats).toHaveBeenCalledWith(4);
      expect(mockCC64TimelineBuilder.setCountdownConfig).toHaveBeenCalledWith(4, true);
    });
  });
});
