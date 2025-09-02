/**
 * Transport Feature Flag Test
 * Verifies that the modular transport can be enabled/disabled via feature flags
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedTransport } from '../../../services/core/UnifiedTransport.js';
import { EventBus } from '../../../services/core/EventBus.js';
import { AudioEngine } from '../../../services/core/AudioEngine.js';
import { Transport } from '../core/Transport.js';
import { TransportWithEventBus } from '../core/TransportWithEventBus.js';

// Mock the feature flags module
vi.mock('../../../config/featureFlags', () => ({
  isModularTransportEnabled: vi.fn(),
  logTransportMigrationEvent: vi.fn(),
  getAudioArchitectureFlags: vi.fn(() => ({
    USE_MODULAR_TRANSPORT: false,
    DEBUG_TRANSPORT_MIGRATION: false,
    COMPARE_TRANSPORT_PERFORMANCE: false,
  })),
  AUDIO_ARCHITECTURE_FLAGS: {
    USE_MODULAR_TRANSPORT: false,
    DEBUG_TRANSPORT_MIGRATION: false,
    COMPARE_TRANSPORT_PERFORMANCE: false,
  },
}));

// Import after mocking
import { isModularTransportEnabled, logTransportMigrationEvent } from '../../../config/featureFlags.js';

describe('Transport Feature Flag Integration', () => {
  let eventBus: EventBus;
  let audioEngine: AudioEngine;
  let unifiedTransport: UnifiedTransport;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create dependencies
    eventBus = new EventBus();
    audioEngine = new AudioEngine(eventBus);
    
    // Reset singleton
    UnifiedTransport['instance'] = null;
  });

  afterEach(() => {
    // Clean up
    UnifiedTransport['instance'] = null;
  });

  describe('when modular transport is disabled', () => {
    beforeEach(() => {
      vi.mocked(isModularTransportEnabled).mockReturnValue(false);
      unifiedTransport = UnifiedTransport.getInstance(eventBus, audioEngine);
    });

    it('should not create modular transport', () => {
      expect(unifiedTransport['delegator']).toBeNull();
    });

    it('should use legacy methods directly', async () => {
      const startLegacySpy = vi.spyOn(unifiedTransport as any, 'startLegacy');
      
      await unifiedTransport.start();
      
      expect(startLegacySpy).toHaveBeenCalled();
    });

    it('should not log migration events', async () => {
      await unifiedTransport.start();
      
      expect(logTransportMigrationEvent).not.toHaveBeenCalled();
    });
  });

  describe('when modular transport is enabled', () => {
    beforeEach(() => {
      vi.mocked(isModularTransportEnabled).mockReturnValue(true);
      unifiedTransport = UnifiedTransport.getInstance(eventBus, audioEngine);
    });

    it('should create modular transport delegator', () => {
      expect(unifiedTransport['delegator']).toBeDefined();
    });

    it('should log migration events', () => {
      expect(logTransportMigrationEvent).toHaveBeenCalledWith(
        'Creating modular transport',
        expect.any(Object)
      );
    });

    it('should delegate method calls to modular transport', async () => {
      const delegator = unifiedTransport['delegator'];
      const delegateAsyncSpy = vi.spyOn(delegator!, 'delegateAsync');
      
      await unifiedTransport.start();
      
      expect(delegateAsyncSpy).toHaveBeenCalledWith(
        'start',
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should fall back to legacy on modular transport error', async () => {
      // Force an error in modular transport
      const modularTransport = unifiedTransport['delegator']?.getModularTransport();
      if (modularTransport) {
        vi.spyOn(modularTransport, 'start').mockRejectedValue(new Error('Test error'));
      }
      
      const startLegacySpy = vi.spyOn(unifiedTransport as any, 'startLegacy');
      
      await unifiedTransport.start();
      
      expect(startLegacySpy).toHaveBeenCalled();
    });
  });

  describe('performance comparison mode', () => {
    beforeEach(() => {
      vi.mocked(isModularTransportEnabled).mockReturnValue(true);
      vi.mocked(getAudioArchitectureFlags).mockReturnValue({
        USE_MODULAR_TRANSPORT: true,
        DEBUG_TRANSPORT_MIGRATION: false,
        COMPARE_TRANSPORT_PERFORMANCE: true,
      } as any);
      
      unifiedTransport = UnifiedTransport.getInstance(eventBus, audioEngine);
    });

    it('should create performance comparator when enabled', () => {
      expect(unifiedTransport['performanceComparator']).toBeDefined();
    });
  });

  describe('runtime flag changes', () => {
    it('should respect flag changes on new instance creation', () => {
      // Start with disabled
      vi.mocked(isModularTransportEnabled).mockReturnValue(false);
      let transport = UnifiedTransport.getInstance(eventBus, audioEngine);
      expect(transport['delegator']).toBeNull();
      
      // Reset singleton
      UnifiedTransport['instance'] = null;
      
      // Enable and create new instance
      vi.mocked(isModularTransportEnabled).mockReturnValue(true);
      transport = UnifiedTransport.getInstance(eventBus, audioEngine);
      expect(transport['delegator']).toBeDefined();
    });
  });

  describe('delegated method behavior', () => {
    beforeEach(() => {
      vi.mocked(isModularTransportEnabled).mockReturnValue(true);
      unifiedTransport = UnifiedTransport.getInstance(eventBus, audioEngine);
    });

    it('should delegate getState correctly', () => {
      const modularTransport = unifiedTransport['delegator']?.getModularTransport();
      if (modularTransport) {
        vi.spyOn(modularTransport, 'getState').mockReturnValue('playing');
      }
      
      const state = unifiedTransport.getState();
      
      expect(state).toBe('playing');
    });

    it('should delegate setTempo correctly', () => {
      const modularTransport = unifiedTransport['delegator']?.getModularTransport();
      const setTempoSpy = modularTransport ? vi.spyOn(modularTransport, 'setTempo') : null;
      
      unifiedTransport.setTempo(140);
      
      expect(setTempoSpy).toHaveBeenCalledWith(140);
    });
  });
});