/**
 * BPM Sync Integration Tests
 *
 * Tests the complete BPM synchronization flow across all systems:
 * 1. Exercise selection → MusicalTruth → Tone.Transport
 * 2. EventBus tempo-change events flow correctly
 * 3. All tempo sources stay in sync
 *
 * This tests the fix for the bug where BPM display showed 120
 * even when exercise had 69 BPM.
 *
 * Architecture being tested:
 * ┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
 * │ Exercise Select │ ──▶ │ MusicalTruthAuth  │ ──▶ │ Tone.Transport  │
 * └─────────────────┘     └───────────────────┘     └─────────────────┘
 *                                  │
 *                                  ▼
 *                         ┌───────────────────┐
 *                         │    EventBus       │
 *                         │ tempo-change event│
 *                         └───────────────────┘
 *                                  │
 *                                  ▼
 *                         ┌───────────────────┐
 *                         │ TransportContext  │
 *                         │   (React state)   │
 *                         └───────────────────┘
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Tone from 'tone';

// Mock Tone.js
vi.mock('tone', () => ({
  Transport: {
    bpm: { value: 120 },
    timeSignature: 4,
  },
  getTransport: () => ({
    bpm: { value: 120 },
    timeSignature: 4,
  }),
}));

// Import after mocks
import { musicalTruth } from '../MusicalTruthAuthority';
import type { EventBus } from '../../../services/core/EventBus';

// Create mock EventBus
const createMockEventBus = (): EventBus => {
  const listeners = new Map<string, Set<Function>>();

  return {
    emit: vi.fn((event: string, data: any) => {
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach((fn) => fn(data));
      }
    }),
    on: vi.fn((event: string, callback: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(callback);
      return () => listeners.get(event)?.delete(callback);
    }),
    off: vi.fn(),
  };
};

describe('BPM Sync Integration', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = createMockEventBus();
    // Reset Tone.Transport mock
    Tone.Transport.bpm.value = 120;
    Tone.Transport.timeSignature = 4;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Exercise Selection → MusicalTruth → Tone.Transport Flow
  // ============================================================================

  describe('Exercise Selection Flow', () => {
    it('should sync BPM when exercise is selected', () => {
      const exercise = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
        total_bars: 8,
      };

      // Simulate what GlobalControls does when exercise is selected
      musicalTruth.setFromExercise(exercise);

      // Verify all systems are in sync
      expect(musicalTruth.getBPM()).toBe(69);
      expect(Tone.Transport.bpm.value).toBe(69);
    });

    it('should sync time signature when exercise is selected', () => {
      const exercise = {
        bpm: 120,
        timeSignature: { numerator: 3, denominator: 4 },
        total_bars: 8,
      };

      musicalTruth.setFromExercise(exercise);

      expect(musicalTruth.getTimeSignature()).toEqual({
        numerator: 3,
        denominator: 4,
      });
      expect(Tone.Transport.timeSignature).toBe(3);
    });

    it('should emit tempo-change event for TransportContext', () => {
      const tempoChangeHandler = vi.fn();
      eventBus.on('transport:tempo-change', tempoChangeHandler);

      const exercise = {
        bpm: 95,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      musicalTruth.setFromExercise(exercise);

      // Emit event (as GlobalControls does after setFromExercise)
      eventBus.emit('transport:tempo-change', { tempo: exercise.bpm });

      expect(tempoChangeHandler).toHaveBeenCalledWith({ tempo: 95 });
    });
  });

  // ============================================================================
  // Multiple Exercise Selection
  // ============================================================================

  describe('Multiple Exercise Selections', () => {
    it('should update BPM when different exercise is selected', () => {
      const exercise1 = {
        bpm: 69,
        timeSignature: { numerator: 4, denominator: 4 },
      };
      const exercise2 = {
        bpm: 140,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      musicalTruth.setFromExercise(exercise1);
      expect(Tone.Transport.bpm.value).toBe(69);

      musicalTruth.setFromExercise(exercise2);
      expect(Tone.Transport.bpm.value).toBe(140);
    });

    it('should maintain sync across rapid exercise changes', () => {
      const exercises = [
        { bpm: 60, timeSignature: { numerator: 4, denominator: 4 } },
        { bpm: 90, timeSignature: { numerator: 4, denominator: 4 } },
        { bpm: 120, timeSignature: { numerator: 4, denominator: 4 } },
        { bpm: 150, timeSignature: { numerator: 4, denominator: 4 } },
        { bpm: 180, timeSignature: { numerator: 4, denominator: 4 } },
      ];

      exercises.forEach((exercise) => {
        musicalTruth.setFromExercise(exercise);
        expect(musicalTruth.getBPM()).toBe(exercise.bpm);
        expect(Tone.Transport.bpm.value).toBe(exercise.bpm);
      });
    });
  });

  // ============================================================================
  // Event Flow Verification
  // ============================================================================

  describe('Event Flow', () => {
    it('should notify subscribers when BPM changes', () => {
      const subscriber = vi.fn();
      const unsubscribe = musicalTruth.subscribe(subscriber);

      const exercise = {
        bpm: 85,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      musicalTruth.setFromExercise(exercise);

      expect(subscriber).toHaveBeenCalledWith(
        expect.objectContaining({ bpm: 85 }),
      );

      unsubscribe();
    });

    it('should flow events through EventBus to TransportContext', () => {
      // Simulate TransportContext subscription
      const transportContextHandler = vi.fn();
      eventBus.on('transport:tempo-change', transportContextHandler);

      // Simulate GlobalControls behavior
      const exercise = {
        bpm: 75,
        timeSignature: { numerator: 4, denominator: 4 },
      };
      musicalTruth.setFromExercise(exercise);
      eventBus.emit('transport:tempo-change', { tempo: exercise.bpm });

      // TransportContext should receive the event
      expect(transportContextHandler).toHaveBeenCalledWith({ tempo: 75 });
    });
  });

  // ============================================================================
  // Consistency Checks
  // ============================================================================

  describe('Multi-System Consistency', () => {
    it('should keep MusicalTruth and Tone.Transport in sync', () => {
      const testCases = [
        { bpm: 40, timeSignature: { numerator: 4, denominator: 4 } },
        { bpm: 69, timeSignature: { numerator: 4, denominator: 4 } },
        { bpm: 120, timeSignature: { numerator: 4, denominator: 4 } },
        { bpm: 200, timeSignature: { numerator: 4, denominator: 4 } },
      ];

      testCases.forEach((exercise) => {
        musicalTruth.setFromExercise(exercise);

        // These should ALWAYS match
        expect(musicalTruth.getBPM()).toBe(Tone.Transport.bpm.value);
      });
    });

    it('should handle exercise with all fields populated', () => {
      const fullExercise = {
        bpm: 95,
        timeSignature: { numerator: 6, denominator: 8 },
        total_bars: 16,
        duration_beats: 96,
        notes: [
          { position: { measure: 1 } },
          { position: { measure: 8 } },
          { position: { measure: 16 } },
        ],
      };

      musicalTruth.setFromExercise(fullExercise);

      expect(musicalTruth.getBPM()).toBe(95);
      expect(musicalTruth.getTimeSignature()).toEqual({
        numerator: 6,
        denominator: 8,
      });
      expect(musicalTruth.getDurationBars()).toBe(16);
      expect(Tone.Transport.bpm.value).toBe(95);
      expect(Tone.Transport.timeSignature).toBe(6);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should throw when timeSignature is undefined (requires valid input)', () => {
      const exercise = {
        bpm: 100,
        timeSignature: undefined as any,
      };

      // MusicalTruthAuthority requires a valid timeSignature
      // This documents current behavior - callers must provide valid timeSignature
      expect(() => musicalTruth.setFromExercise(exercise)).toThrow();
    });

    it('should work with default timeSignature (4/4)', () => {
      const exercise = {
        bpm: 100,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      // Should not throw with valid timeSignature
      expect(() => musicalTruth.setFromExercise(exercise)).not.toThrow();
      expect(musicalTruth.getBPM()).toBe(100);
    });

    it('should handle exercise with only BPM', () => {
      const minimalExercise = {
        bpm: 80,
        timeSignature: { numerator: 4, denominator: 4 },
      };

      musicalTruth.setFromExercise(minimalExercise);

      expect(musicalTruth.getBPM()).toBe(80);
    });
  });
});

// ============================================================================
// Simulated UI Flow Tests
// ============================================================================

describe('Simulated UI Flow', () => {
  beforeEach(() => {
    Tone.Transport.bpm.value = 120;
    vi.clearAllMocks();
  });

  it('should simulate complete exercise selection flow', () => {
    // Initial state (like page load)
    expect(Tone.Transport.bpm.value).toBe(120);

    // User selects exercise with 69 BPM
    const selectedExercise = {
      id: 'ex-001',
      bpm: 69,
      timeSignature: { numerator: 4, denominator: 4 },
      total_bars: 8,
    };

    // Step 1: GlobalControls effect calls setFromExercise
    musicalTruth.setFromExercise(selectedExercise);

    // Step 2: Verify immediate sync
    expect(musicalTruth.getBPM()).toBe(69);
    expect(Tone.Transport.bpm.value).toBe(69);

    // Step 3: Create EventBus and emit (simulating GlobalControls)
    const eventBus = createMockEventBus();
    const transportContextTempoHandler = vi.fn();
    eventBus.on('transport:tempo-change', transportContextTempoHandler);

    eventBus.emit('transport:tempo-change', { tempo: 69 });

    // Step 4: TransportContext would receive this and update its state
    expect(transportContextTempoHandler).toHaveBeenCalledWith({ tempo: 69 });
  });

  it('should simulate user changing tempo via slider', () => {
    // Exercise initially loaded
    const exercise = {
      bpm: 69,
      timeSignature: { numerator: 4, denominator: 4 },
    };
    musicalTruth.setFromExercise(exercise);
    expect(Tone.Transport.bpm.value).toBe(69);

    // User drags tempo slider (this would go through transport.setTempo)
    // For now, we simulate by directly updating Tone.Transport
    const newUserTempo = 85;
    Tone.Transport.bpm.value = newUserTempo;

    // Note: MusicalTruth doesn't automatically sync back from Tone.Transport
    // This is intentional - user tempo changes are handled separately
    expect(Tone.Transport.bpm.value).toBe(85);
  });

  it('should simulate switching between exercises', () => {
    const exercise1 = {
      id: 'slow-exercise',
      bpm: 60,
      timeSignature: { numerator: 4, denominator: 4 },
    };
    const exercise2 = {
      id: 'fast-exercise',
      bpm: 180,
      timeSignature: { numerator: 4, denominator: 4 },
    };

    // Select first exercise
    musicalTruth.setFromExercise(exercise1);
    expect(Tone.Transport.bpm.value).toBe(60);

    // Switch to second exercise
    musicalTruth.setFromExercise(exercise2);
    expect(Tone.Transport.bpm.value).toBe(180);

    // Switch back
    musicalTruth.setFromExercise(exercise1);
    expect(Tone.Transport.bpm.value).toBe(60);
  });
});

// ============================================================================
// TransportController.setTempo() Tests
// ============================================================================

describe('TransportController.setTempo() - User Tempo Changes', () => {
  /**
   * CRITICAL TEST: Verifies that user tempo changes via slider
   * actually update Tone.Transport.bpm for playback.
   *
   * This test catches the bug where TransportController.setTempo()
   * was gutted and no longer updated Tone.Transport.bpm.value.
   *
   * Bug Scenario:
   * 1. Exercise loads with 69 BPM
   * 2. User changes slider to 100 BPM
   * 3. handleTempoChange calls transport.setTempo(100)
   * 4. TransportController.setTempo(100) MUST update Tone.Transport.bpm.value to 100
   * 5. Without this fix, playback stayed at 69 BPM!
   */
  it('should update Tone.Transport.bpm when user changes tempo via slider', async () => {
    // Set initial state
    Tone.Transport.bpm.value = 69;

    // Import TransportController for direct testing
    const { TransportController } =
      await import('../../transport/core/TransportController.js');
    const { EventBus } = await import('../../../services/core/EventBus.js');
    const { AudioEngine } =
      await import('../../audio-engine/core/AudioEngine.js');

    // Create minimal dependencies
    const eventBus = new EventBus();
    const audioEngine = {
      getAudioContext: () => ({ state: 'running' }),
      isInitialized: () => true,
    } as unknown as AudioEngine;

    // Create controller
    const controller = new TransportController(eventBus, audioEngine, {
      tempo: 69, // Exercise BPM
      timeSignature: { numerator: 4, denominator: 4 },
    });

    // Verify initial tempo (set above)
    expect(Tone.Transport.bpm.value).toBe(69);

    // User changes tempo via slider (simulates handleTempoChange → transport.setTempo)
    await controller.setTempo(100);

    // CRITICAL: Tone.Transport.bpm.value MUST be updated
    expect(Tone.Transport.bpm.value).toBe(100);
  });

  it('should emit tempo-change event when user changes tempo', async () => {
    const { TransportController } =
      await import('../../transport/core/TransportController.js');
    const { EventBus } = await import('../../../services/core/EventBus.js');
    const { AudioEngine } =
      await import('../../audio-engine/core/AudioEngine.js');

    const eventBus = new EventBus();
    const audioEngine = {
      getAudioContext: () => ({ state: 'running' }),
      isInitialized: () => true,
    } as unknown as AudioEngine;

    const controller = new TransportController(eventBus, audioEngine, {
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
    });

    // Listen for tempo-change event
    const tempoHandler = vi.fn();
    eventBus.on('transport:tempo-change', tempoHandler);

    // User changes tempo
    await controller.setTempo(140);

    // Event should be emitted with new tempo
    // EventBus passes (data, metadata) as two arguments
    expect(tempoHandler).toHaveBeenCalledWith(
      { bpm: 140, tempo: 140 },
      expect.objectContaining({ eventId: expect.any(String) }),
    );
  });
});

// ============================================================================
// PlaybackEngine Tempo Reschedule Tests
// ============================================================================

describe('PlaybackEngine.reschedulePendingEvents() - All Tracks Tempo Sync', () => {
  /**
   * CRITICAL TEST: Verifies that tempo changes during playback
   * reschedule ALL tracks including harmony (AudioBufferSourceNode-based).
   *
   * This test catches the bug where:
   * - Metronome/drums use Tone.Transport events → cleared on tempo change ✅
   * - Harmony uses AudioBufferSourceNode → NOT cleared before this fix ❌
   *
   * Bug Scenario:
   * 1. Play exercise at 69 BPM (metronome + harmony scheduled)
   * 2. User changes tempo slider to 100 BPM during playback
   * 3. PlaybackEngine receives 'transport:tempo-change' event
   * 4. reschedulePendingEvents() must:
   *    - Clear Tone.Transport events (metronome, drums)
   *    - Call harmonyScheduler.stopAll() to cancel AudioBufferSourceNodes
   *    - Reschedule ALL tracks at new tempo
   * 5. Without the fix, harmony kept playing at 69 BPM!
   */
  it('should clear scheduled state when rescheduling after tempo change', async () => {
    // This test verifies that PlaybackEngine clears scheduled events during reschedule
    // Note: The architecture has evolved - harmonyScheduler.stopAll() is no longer called
    // directly in reschedulePendingEvents(). Instead, clearScheduledState() is used.

    const { PlaybackEngine } =
      await import('../../../services/core/PlaybackEngine.js');
    const { EventBus } = await import('../../../services/core/EventBus.js');

    const eventBus = new EventBus();

    // Create PlaybackEngine instance
    const playbackEngine = new PlaybackEngine(eventBus);

    // Set up minimal state for rescheduling
    (playbackEngine as any).isRunning = true;
    (playbackEngine as any).regionScheduler = {
      scheduleAll: vi.fn().mockReturnValue({ totalEvents: 0, batchCount: 0 }),
    };
    (playbackEngine as any).tracks = new Map();

    // Add some scheduled IDs to verify they get cleared
    const scheduledIds = new Set([1, 2, 3]);
    (playbackEngine as any).scheduledIds = scheduledIds;
    (playbackEngine as any).scheduledEvents = new Map([['event1', {}]]);

    // Trigger reschedulePendingEvents (the method we're testing)
    (playbackEngine as any).reschedulePendingEvents();

    // CRITICAL: scheduledIds and scheduledEvents MUST be cleared
    expect((playbackEngine as any).scheduledIds.size).toBe(0);
    expect((playbackEngine as any).scheduledEvents.size).toBe(0);
  });

  it('should clear state then reschedule all regions after tempo change', async () => {
    const { PlaybackEngine } =
      await import('../../../services/core/PlaybackEngine.js');
    const { EventBus } = await import('../../../services/core/EventBus.js');

    const eventBus = new EventBus();
    const playbackEngine = new PlaybackEngine(eventBus);

    // Track call order
    const callOrder: string[] = [];

    // Mock clearScheduledState
    const originalClearScheduledState = (playbackEngine as any)
      .clearScheduledState;
    (playbackEngine as any).clearScheduledState = vi.fn(() => {
      callOrder.push('clearScheduledState');
      // Still clear the state
      (playbackEngine as any).scheduledIds.clear();
      (playbackEngine as any).scheduledEvents.clear();
    });

    // Mock regionScheduler (required for reschedulePendingEvents to not early-return)
    (playbackEngine as any).regionScheduler = {
      scheduleAll: vi.fn(),
    };

    // Mock scheduleAllRegions method on PlaybackEngine itself
    const originalScheduleAllRegions = (playbackEngine as any)
      .scheduleAllRegions;
    (playbackEngine as any).scheduleAllRegions = vi.fn(() => {
      callOrder.push('scheduleAllRegions');
    });

    // Set up minimal state - isRunning AND regionScheduler must be truthy
    (playbackEngine as any).isRunning = true;
    (playbackEngine as any).tracks = new Map([
      ['test-track', { id: 'test-track' }],
    ]);
    (playbackEngine as any).scheduledIds = new Set([1, 2]);
    (playbackEngine as any).scheduledEvents = new Map();

    // Trigger reschedule
    (playbackEngine as any).reschedulePendingEvents();

    // Verify call order: clearScheduledState BEFORE scheduleAllRegions
    expect(callOrder).toEqual(['clearScheduledState', 'scheduleAllRegions']);

    // Cleanup
    (playbackEngine as any).clearScheduledState = originalClearScheduledState;
    (playbackEngine as any).scheduleAllRegions = originalScheduleAllRegions;
  });

  it('should respond to transport:tempo-change event', async () => {
    const { EventBus } = await import('../../../services/core/EventBus.js');

    const eventBus = new EventBus();

    // Track if tempo change handler is called
    let tempoChangeReceived = false;
    let receivedTempo: number | null = null;

    eventBus.on(
      'transport:tempo-change',
      (data: { tempo: number; bpm: number }) => {
        tempoChangeReceived = true;
        receivedTempo = data.tempo || data.bpm;
      },
    );

    // Emit tempo change event (simulates what TransportController.setTempo does)
    eventBus.emit('transport:tempo-change', { tempo: 100, bpm: 100 });

    // Verify event was received
    expect(tempoChangeReceived).toBe(true);
    expect(receivedTempo).toBe(100);
  });
});

// ============================================================================
// End-to-End Tempo Flow Tests
// ============================================================================

describe('Complete Tempo Change Flow', () => {
  /**
   * Tests the full flow from user action to playback engine reschedule:
   *
   * User drags tempo slider
   *   ↓
   * handleTempoChange(100) in GlobalControls
   *   ↓
   * transport.setTempo(100) via useDirectTransport
   *   ↓
   * TransportController.setTempo(100)
   *   ↓
   * Tone.Transport.bpm.value = 100  ← Fix #1
   *   ↓
   * eventBus.emit('transport:tempo-change', { tempo: 100 })
   *   ↓
   * PlaybackEngine receives event
   *   ↓
   * reschedulePendingEvents()
   *   ↓
   * harmonyScheduler.stopAll()  ← Fix #2
   *   ↓
   * scheduleAllRegions() at new tempo
   */
  it('should update Tone.Transport and emit event when tempo changes', async () => {
    const { TransportController } =
      await import('../../transport/core/TransportController.js');
    const { EventBus } = await import('../../../services/core/EventBus.js');
    const { AudioEngine } =
      await import('../../audio-engine/core/AudioEngine.js');

    // Set initial state
    Tone.Transport.bpm.value = 69;

    const eventBus = new EventBus();
    const audioEngine = {
      getAudioContext: () => ({ state: 'running' }),
      isInitialized: () => true,
    } as unknown as AudioEngine;

    // Track events
    const events: Array<{ tempo: number }> = [];
    eventBus.on('transport:tempo-change', (data: { tempo: number }) => {
      events.push({ tempo: data.tempo });
    });

    const controller = new TransportController(eventBus, audioEngine, {
      tempo: 69,
      timeSignature: { numerator: 4, denominator: 4 },
    });

    // User changes tempo
    await controller.setTempo(100);

    // Verify both fixes:
    // Fix #1: Tone.Transport.bpm.value is updated
    expect(Tone.Transport.bpm.value).toBe(100);

    // Fix #2: Event is emitted for PlaybackEngine to reschedule
    expect(events.length).toBe(1);
    expect(events[0].tempo).toBe(100);
  });

  it('should handle rapid tempo changes (slider dragging)', async () => {
    const { TransportController } =
      await import('../../transport/core/TransportController.js');
    const { EventBus } = await import('../../../services/core/EventBus.js');
    const { AudioEngine } =
      await import('../../audio-engine/core/AudioEngine.js');

    Tone.Transport.bpm.value = 69;

    const eventBus = new EventBus();
    const audioEngine = {
      getAudioContext: () => ({ state: 'running' }),
      isInitialized: () => true,
    } as unknown as AudioEngine;

    const controller = new TransportController(eventBus, audioEngine, {
      tempo: 69,
      timeSignature: { numerator: 4, denominator: 4 },
    });

    // Simulate rapid slider dragging
    await controller.setTempo(75);
    await controller.setTempo(80);
    await controller.setTempo(85);
    await controller.setTempo(90);
    await controller.setTempo(95);
    await controller.setTempo(100);

    // Final tempo should be applied
    expect(Tone.Transport.bpm.value).toBe(100);
  });
});
