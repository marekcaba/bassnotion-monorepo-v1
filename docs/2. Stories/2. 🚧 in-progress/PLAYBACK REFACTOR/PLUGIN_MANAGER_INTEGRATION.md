# PluginManager/WAM Integration Analysis

**Story:** PLAYBACK-REFACTOR-2025
**Task:** 0.6 - PluginManager/WAM Integration Analysis
**Created:** 2025-11-23
**Status:** ✅ Complete
**Priority:** 🚨 CRITICAL

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Integration Architecture](#2-current-integration-architecture)
3. [CC64 Sustain Pedal Implementation](#3-cc64-sustain-pedal-implementation)
4. [PlaybackEngine Integration Design](#4-playbackengine-integration-design)
5. [Regression Test Cases](#5-regression-test-cases)
6. [Migration Checklist](#6-migration-checklist)
7. [Risk Assessment](#7-risk-assessment)
8. [Code References](#8-code-references)

---

## 1. Executive Summary

### 1.1 Key Findings

**✅ GOOD NEWS:** PluginManager integration is relatively isolated and well-documented
**🚨 COMPLEXITY:** CC64 sustain pedal uses pre-calculated timeline approach (not real-time WAM routing)
**⚠️ MIGRATION RISK:** HarmonyWidget has complex plugin lifecycle management

### 1.2 Integration Points Identified

| Integration Point           | Location                                                                                                                                 | Complexity | Migration Impact                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------- |
| **PluginManager injection** | [RegionProcessor.ts:594](../../../apps/frontend/src/domains/playback/services/core/RegionProcessor.ts#L594)                              | LOW        | Direct port to PlaybackEngine                 |
| **WamKeyboard unwrapping**  | [RegionProcessor.ts:605-636](../../../apps/frontend/src/domains/playback/services/core/RegionProcessor.ts#L605)                          | MEDIUM     | Preserve unwrapping logic                     |
| **CC64 timeline**           | [HarmonyScheduler.ts:59](../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling/HarmonyScheduler.ts#L59) | HIGH       | Pre-calculated approach (no real-time events) |
| **Widget plugin loading**   | [HarmonyWidget.tsx:498-671](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx#L498)   | HIGH       | Async plugin initialization with retries      |

### 1.3 Current Implementation Summary

**Architecture:**

```
HarmonyWidget
  ↓
PluginManager.getPlugin('wam-keyboard')
  ↓
WamKeyboardPlugin (wrapper)
  ↓
WamKeyboard.getWamKeyboard()
  ↓
WamKeyboard (actual WAM 2.0 instance)
  ↓
scheduleControlChange(cc, value, time)
```

**CC64 Approach:** Pre-calculated sustain durations (NOT real-time CC events to WAM)

**Current Status:**

- ✅ WAM keyboard works for Grand Piano, Rhodes, Wurlitzer
- ⚠️ CC64 events are LOGGED but not sent to WAM in real-time
- ✅ Sustain duration is calculated upfront and applied to note scheduling
- ❌ No actual `scheduleControlChange()` calls to WAM keyboard found

---

## 2. Current Integration Architecture

### 2.1 PluginManager Injection

**File:** [RegionProcessor.ts:594-596](../../../apps/frontend/src/domains/playback/services/core/RegionProcessor.ts#L594)

```typescript
/**
 * Inject PluginManager for accessing WAM instruments
 * Used to route control change events (e.g., sustain pedal) to WamKeyboard
 */
setPluginManager(pluginManager: PluginManager): void {
  this.pluginManager = pluginManager;
}
```

**Purpose:** Allow RegionProcessor to access WAM keyboard for CC event routing

**Migration:** ✅ Simple - Copy method to PlaybackEngine as-is

---

### 2.2 WamKeyboard Unwrapping Logic

**File:** [RegionProcessor.ts:605-636](../../../apps/frontend/src/domains/playback/services/core/RegionProcessor.ts#L605)

```typescript
/**
 * Get the active WamKeyboard instance from PluginManager
 * Returns null if PluginManager not set or plugin not found
 *
 * CRITICAL: PluginManager stores WamKeyboardPlugin (wrapper), not WamKeyboard directly
 * We need to unwrap it to get the actual WamKeyboard instance
 */
private getWamKeyboard(): WamKeyboard | null {
  if (!this.pluginManager) {
    logger.warn(
      'PluginManager not set in RegionProcessor - cannot access WamKeyboard',
    );
    return null;
  }

  try {
    // Get the WamKeyboardPlugin wrapper
    const keyboardPlugin =
      this.pluginManager.getPlugin<WamKeyboardPlugin>('wam-keyboard');
    if (!keyboardPlugin) {
      logger.warn('WamKeyboardPlugin not found in PluginManager');
      return null;
    }

    // Unwrap to get the actual WamKeyboard instance
    const wamKeyboard = keyboardPlugin.getWamKeyboard();
    if (!wamKeyboard) {
      logger.warn(
        'WamKeyboard instance not yet initialized in plugin wrapper',
      );
      return null;
    }

    return wamKeyboard;
  } catch (error) {
    logger.warn('Failed to get WamKeyboard from PluginManager', error);
    return null;
  }
}
```

**Key Design Pattern:** Two-step unwrapping

1. `PluginManager.getPlugin<WamKeyboardPlugin>('wam-keyboard')` → Returns wrapper
2. `WamKeyboardPlugin.getWamKeyboard()` → Returns actual WAM instance

**Why This Pattern?**

- `PluginManager` uses generic `AudioPlugin` interface
- `WamKeyboardPlugin` is an adapter that wraps `WamKeyboard` (WAM 2.0 module)
- This allows plugin manager to treat all plugins uniformly while preserving WAM-specific API

**Migration:** ✅ Copy method verbatim to PlaybackEngine

---

### 2.3 WamKeyboardPlugin Wrapper

**File:** [WamKeyboardPlugin.ts:31-96](../../../apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboardPlugin.ts#L31)

```typescript
export class WamKeyboardPlugin extends EventEmitter implements AudioPlugin {
  // AudioPlugin interface implementation
  public readonly metadata: PluginMetadata = {
    id: 'wam-keyboard',
    name: 'WAM Keyboard',
    category: PluginCategory.INSTRUMENT,
    capabilities: { supportsMIDI: true, ... }
  };

  public state: PluginState = PluginState.UNLOADED;

  // The actual WamKeyboard instance we're wrapping
  private wamKeyboard: WamKeyboard | null = null;

  /**
   * Get the underlying WamKeyboard instance
   * Used by RegionProcessor to access keyboard-specific methods
   */
  getWamKeyboard(): WamKeyboard | null {
    return this.wamKeyboard;
  }

  // ... lifecycle methods (load, initialize, activate, etc.)
}
```

**Migration:** ⚠️ NO CHANGES NEEDED - Wrapper stays as-is, PlaybackEngine just uses it

---

### 2.4 WamKeyboard CC Event Handling

**File:** [WamKeyboard.ts:1368-1369](../../../apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboard.ts#L1368)

```typescript
scheduleControlChange(cc: number, value: number, time: number): void {
  this.audioNode?.scheduleControlChange(cc, value, time);
}
```

**File:** [WamKeyboard.ts:892](../../../apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboard.ts#L892)

```typescript
scheduleControlChange(cc: number, value: number, time: number): void {
  // ... internal implementation for WAM audio node
}
```

**Migration:** ⚠️ NO CHANGES NEEDED - WamKeyboard API stays unchanged

---

## 3. CC64 Sustain Pedal Implementation

### 3.1 Current Approach: Pre-Calculated Timeline

**File:** [HarmonyScheduler.ts:210-231](../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling/HarmonyScheduler.ts#L210)

```typescript
// Handle control change events (sustain pedal, expression, etc.)
if (event.type === 'harmony-control-change' && eventData?.cc !== undefined) {
  if (eventData.cc === 64) {
    // CC64 = Sustain Pedal
    // Using pre-calculated timeline approach - real-time events are logged but not processed
    // Sustain duration is calculated upfront when notes are scheduled (see buildCC64Timeline)
    console.log(
      `[CC64 EVENT] Pedal ${eventData.value >= 64 ? 'DOWN' : 'UP'} @ ${audioTime.toFixed(3)}s (value=${eventData.value}) - Pre-calculated in timeline`,
    );
    return true; // Event acknowledged (but not sent to WAM)
  }
}
```

**Key Finding:** CC64 events are **LOGGED ONLY**, not sent to WAM keyboard

### 3.2 CC64 Timeline Pre-Calculation

**File:** [RegionProcessor.ts:1025-1029](../../../apps/frontend/src/domains/playback/services/core/RegionProcessor.ts#L1025)

```typescript
/**
 * Build CC64 timeline from harmony events
 * Phase 3: Delegated to CC64TimelineBuilder
 */
private buildCC64Timeline(
  events: PatternEvent[],
  region: Region,
): Map<number, boolean> {
  return this.sustainPedalManager.buildTimeline(events, region);
}
```

**How It Works:**

1. Before playback starts, scan all harmony events for CC64 messages
2. Build a timeline: `Map<audioTime, pedalDown: boolean>`
3. When scheduling notes, check if sustain pedal is down during note duration
4. Extend note duration if pedal is down (instead of sending real-time CC events)

**Advantages:**

- Simpler scheduling logic (no need to track pedal state during playback)
- Works with both sample-based (AudioBufferSourceNode) and WAM instruments
- Consistent behavior regardless of instrument type

**Disadvantages:**

- Not true WAM CC routing (WAM keyboard never receives CC64 events)
- Sustain behavior is "baked in" to note scheduling, not dynamic

### 3.3 CC64 Duration Extension Logic

**File:** [SustainPedalManager.ts](../../../apps/frontend/src/domains/playback/services/core/region-processing/sustain/SustainPedalManager.ts) (referenced)

```typescript
// Pseudocode based on RegionProcessor methods:
function extendNoteWithSustain(note, cc64Timeline) {
  const noteStartTime = note.audioTime;
  const midiNoteEndTime = noteStartTime + note.midiDuration;

  // Check if pedal is down when note starts OR goes down during note's MIDI duration
  const pedalDownDuringNote = findCC64DownDuringNote(
    noteStartTime,
    midiNoteEndTime,
    cc64Timeline,
  );

  if (pedalDownDuringNote) {
    // Find the next CC64 UP event after the note starts
    const pedalUpTime = findNextCC64Up(noteStartTime, cc64Timeline);

    if (pedalUpTime) {
      // Extend note duration until pedal up
      note.actualDuration = pedalUpTime - noteStartTime;
    } else {
      // Pedal stays down until end of exercise
      note.actualDuration = exerciseEndTime - noteStartTime;
    }
  } else {
    // No sustain - use MIDI duration
    note.actualDuration = note.midiDuration;
  }
}
```

**Migration:** ✅ Preserve this pre-calculated approach (already works well)

---

### 3.4 Real-Time CC Routing (Not Currently Used)

**Hypothetical Implementation (if we wanted real-time routing):**

```typescript
// This code does NOT exist in current system - shown for comparison
function scheduleCC64Event(event: PatternEvent, audioTime: number) {
  const wamKeyboard = this.getWamKeyboard();
  if (wamKeyboard) {
    const ccNumber = 64; // Sustain pedal
    const ccValue = event.data.value; // 0-127
    wamKeyboard.scheduleControlChange(ccNumber, ccValue, audioTime);
  }
}
```

**Decision:** Do NOT implement real-time CC routing in refactor

- **Rationale:** Pre-calculated approach works well, less complexity
- **Future Enhancement:** Can add real-time CC routing later if needed for other CC types

---

## 4. PlaybackEngine Integration Design

### 4.1 Port PluginManager Methods

**New File:** `PlaybackEngine.ts` (to be created in Task 1.2)

```typescript
export class PlaybackEngine {
  private pluginManager: PluginManager | null = null;

  /**
   * Inject PluginManager for accessing WAM instruments
   * Used to route control change events (e.g., sustain pedal) to WamKeyboard
   *
   * PORTED FROM: RegionProcessor.ts:594-596
   */
  setPluginManager(pluginManager: PluginManager): void {
    this.pluginManager = pluginManager;
  }

  /**
   * Get the active WamKeyboard instance from PluginManager
   * Returns null if PluginManager not set or plugin not found
   *
   * CRITICAL: PluginManager stores WamKeyboardPlugin (wrapper), not WamKeyboard directly
   * We need to unwrap it to get the actual WamKeyboard instance
   *
   * PORTED FROM: RegionProcessor.ts:605-636
   */
  private getWamKeyboard(): WamKeyboard | null {
    if (!this.pluginManager) {
      logger.warn(
        'PluginManager not set in PlaybackEngine - cannot access WamKeyboard',
      );
      return null;
    }

    try {
      // Get the WamKeyboardPlugin wrapper
      const keyboardPlugin =
        this.pluginManager.getPlugin<WamKeyboardPlugin>('wam-keyboard');
      if (!keyboardPlugin) {
        logger.warn('WamKeyboardPlugin not found in PluginManager');
        return null;
      }

      // Unwrap to get the actual WamKeyboard instance
      const wamKeyboard = keyboardPlugin.getWamKeyboard();
      if (!wamKeyboard) {
        logger.warn(
          'WamKeyboard instance not yet initialized in plugin wrapper',
        );
        return null;
      }

      return wamKeyboard;
    } catch (error) {
      logger.warn('Failed to get WamKeyboard from PluginManager', error);
      return null;
    }
  }

  // ... rest of PlaybackEngine implementation
}
```

### 4.2 CoreServices Integration

**File:** `CoreServices.ts` (to be updated in Task 1.4)

```typescript
export class CoreServices {
  private playbackEngine: PlaybackEngine;
  private pluginManager: PluginManager;

  async initialize() {
    // ... existing initialization

    // Inject PluginManager into PlaybackEngine
    this.playbackEngine.setPluginManager(this.pluginManager);

    logger.info('PlaybackEngine connected to PluginManager');
  }

  // ... rest of CoreServices
}
```

### 4.3 HarmonyWidget Integration (No Changes)

**File:** `HarmonyWidget.tsx` (NO CHANGES NEEDED)

```typescript
// Widget uses PluginManager directly, not through PlaybackEngine
const wamKeyboardPlugin =
  pluginManager.getPlugin<WamKeyboardPlugin>('wam-keyboard');
const wamKeyboard = wamKeyboardPlugin.getWamKeyboard();

// This flow stays UNCHANGED - widgets manage their own plugin lifecycle
```

**Why No Changes?**

- HarmonyWidget loads and activates WamKeyboard for playback
- PlaybackEngine uses PluginManager only for CC routing (if needed)
- These are separate concerns - no conflict

### 4.4 Scheduler Integration

**New File:** `Scheduler.ts` (to be created in Task 1.1)

```typescript
export class Scheduler {
  private pluginManager: PluginManager | null = null;

  /**
   * Set PluginManager reference (injected from PlaybackEngine)
   */
  setPluginManager(pluginManager: PluginManager | null): void {
    this.pluginManager = pluginManager;
  }

  /**
   * Schedule CC64 events (if real-time routing is needed in future)
   * Currently: Pre-calculated timeline approach is used instead
   */
  private scheduleCC64Event(ccValue: number, audioTime: number): void {
    // FUTURE: Uncomment if real-time CC routing is needed
    // const wamKeyboard = this.getWamKeyboard();
    // if (wamKeyboard) {
    //   wamKeyboard.scheduleControlChange(64, ccValue, audioTime);
    // }
  }

  /**
   * Schedule harmony note with pre-calculated sustain duration
   * (Current approach - preserves existing behavior)
   */
  scheduleHarmonyNote(
    note: MidiNote,
    audioTime: number,
    cc64Timeline: Map<number, boolean>,
  ): void {
    // Calculate extended duration based on CC64 timeline
    const extendedDuration = this.calculateSustainDuration(note, cc64Timeline);

    // Schedule note with extended duration
    this.scheduleNote({
      ...note,
      duration: extendedDuration,
      audioTime,
    });
  }
}
```

---

## 5. Regression Test Cases

### 5.1 PluginManager Injection Tests

**File:** `PlaybackEngine.test.ts` (new file)

```typescript
describe('PlaybackEngine - PluginManager Integration', () => {
  let playbackEngine: PlaybackEngine;
  let mockPluginManager: PluginManager;
  let mockWamKeyboard: WamKeyboard;

  beforeEach(() => {
    playbackEngine = new PlaybackEngine(eventBus);
    mockPluginManager = createMockPluginManager();
    mockWamKeyboard = createMockWamKeyboard();
  });

  describe('setPluginManager', () => {
    it('should accept PluginManager instance', () => {
      expect(() => {
        playbackEngine.setPluginManager(mockPluginManager);
      }).not.toThrow();
    });

    it('should allow null PluginManager (for cleanup)', () => {
      playbackEngine.setPluginManager(mockPluginManager);
      expect(() => {
        playbackEngine.setPluginManager(null);
      }).not.toThrow();
    });
  });

  describe('getWamKeyboard (private method behavior)', () => {
    it('should return null if PluginManager not set', () => {
      // Access via public method that uses getWamKeyboard internally
      const result = playbackEngine['getWamKeyboard']();
      expect(result).toBeNull();
    });

    it('should return null if wam-keyboard plugin not registered', () => {
      mockPluginManager.getPlugin = vi.fn().mockReturnValue(null);
      playbackEngine.setPluginManager(mockPluginManager);

      const result = playbackEngine['getWamKeyboard']();
      expect(result).toBeNull();
    });

    it('should return null if WamKeyboard not initialized in plugin', () => {
      const mockPlugin = {
        getWamKeyboard: () => null,
      };
      mockPluginManager.getPlugin = vi.fn().mockReturnValue(mockPlugin);
      playbackEngine.setPluginManager(mockPluginManager);

      const result = playbackEngine['getWamKeyboard']();
      expect(result).toBeNull();
    });

    it('should return WamKeyboard instance if fully initialized', () => {
      const mockPlugin = {
        getWamKeyboard: () => mockWamKeyboard,
      };
      mockPluginManager.getPlugin = vi.fn().mockReturnValue(mockPlugin);
      playbackEngine.setPluginManager(mockPluginManager);

      const result = playbackEngine['getWamKeyboard']();
      expect(result).toBe(mockWamKeyboard);
    });

    it('should handle exceptions during plugin retrieval gracefully', () => {
      mockPluginManager.getPlugin = vi.fn().mockImplementation(() => {
        throw new Error('Plugin not found');
      });
      playbackEngine.setPluginManager(mockPluginManager);

      const result = playbackEngine['getWamKeyboard']();
      expect(result).toBeNull();
    });
  });
});
```

### 5.2 CC64 Timeline Preservation Tests

**File:** `Scheduler.test.ts` (new file)

```typescript
describe('Scheduler - CC64 Sustain Pedal', () => {
  let scheduler: Scheduler;
  let mockAudioContext: AudioContext;

  beforeEach(() => {
    mockAudioContext = createMockAudioContext();
    scheduler = new Scheduler(mockAudioContext);
  });

  describe('CC64 timeline-based sustain (current approach)', () => {
    it('should extend note duration when sustain pedal is down', () => {
      const cc64Timeline = new Map([
        [1.0, true], // Pedal down at 1.0s
        [3.0, false], // Pedal up at 3.0s
      ]);

      const note = {
        midiNote: 60,
        audioTime: 1.5, // Note starts while pedal is down
        midiDuration: 0.5, // Original duration 0.5s
      };

      const extendedDuration = scheduler['calculateSustainDuration'](
        note,
        cc64Timeline,
      );

      // Should extend until pedal up (3.0s) - note start (1.5s) = 1.5s
      expect(extendedDuration).toBe(1.5);
    });

    it('should NOT extend duration when sustain pedal is up', () => {
      const cc64Timeline = new Map([
        [0.5, true], // Pedal down at 0.5s
        [0.8, false], // Pedal up at 0.8s
      ]);

      const note = {
        midiNote: 60,
        audioTime: 1.0, // Note starts after pedal is up
        midiDuration: 0.5,
      };

      const extendedDuration = scheduler['calculateSustainDuration'](
        note,
        cc64Timeline,
      );

      // Should use original MIDI duration (no sustain)
      expect(extendedDuration).toBe(0.5);
    });

    it('should handle pedal down during note (after note starts)', () => {
      const cc64Timeline = new Map([
        [1.2, true], // Pedal goes down during note
        [2.0, false], // Pedal up at 2.0s
      ]);

      const note = {
        midiNote: 60,
        audioTime: 1.0, // Note starts
        midiDuration: 0.5, // Would end at 1.5s without sustain
      };

      const extendedDuration = scheduler['calculateSustainDuration'](
        note,
        cc64Timeline,
      );

      // Should extend until pedal up (2.0s) - note start (1.0s) = 1.0s
      expect(extendedDuration).toBe(1.0);
    });

    it('should extend until exercise end if pedal stays down', () => {
      const cc64Timeline = new Map([
        [1.0, true], // Pedal down, never goes up
      ]);

      const note = {
        midiNote: 60,
        audioTime: 1.5,
        midiDuration: 0.5,
      };

      scheduler.setExerciseEndTime(10.0); // Exercise ends at 10.0s

      const extendedDuration = scheduler['calculateSustainDuration'](
        note,
        cc64Timeline,
      );

      // Should extend until exercise end (10.0s) - note start (1.5s) = 8.5s
      expect(extendedDuration).toBe(8.5);
    });
  });

  describe('CC64 event logging (compatibility)', () => {
    it('should log CC64 events without sending to WAM', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const event = {
        type: 'harmony-control-change',
        data: { cc: 64, value: 127 },
      };

      scheduler.scheduleEvent(event, 1.0);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CC64 EVENT] Pedal DOWN'),
      );
    });
  });
});
```

### 5.3 Integration Test with HarmonyWidget

**File:** `HarmonyWidget.integration.test.tsx` (new file)

```typescript
describe('HarmonyWidget - WAM Integration', () => {
  let widget: RenderResult;
  let mockCoreServices: CoreServices;
  let mockPluginManager: PluginManager;

  beforeEach(async () => {
    mockCoreServices = createMockCoreServices();
    mockPluginManager = mockCoreServices.getPluginManager();

    widget = render(<HarmonyWidget exercise={mockExercise} />);
    await waitFor(() => {
      expect(widget.getByTestId('harmony-widget')).toBeInTheDocument();
    });
  });

  it('should load WamKeyboardPlugin from PluginManager', async () => {
    const getPluginSpy = vi.spyOn(mockPluginManager, 'getPlugin');

    // Trigger plugin loading
    const playButton = widget.getByTestId('play-button');
    await userEvent.click(playButton);

    await waitFor(() => {
      expect(getPluginSpy).toHaveBeenCalledWith('wam-keyboard');
    });
  });

  it('should retry plugin loading if not initially available', async () => {
    let attemptCount = 0;
    mockPluginManager.getPlugin = vi.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Plugin not ready');
      }
      return mockWamKeyboardPlugin;
    });

    const playButton = widget.getByTestId('play-button');
    await userEvent.click(playButton);

    await waitFor(() => {
      expect(attemptCount).toBe(3); // Should have retried
      expect(mockWamKeyboardPlugin.state).toBe(PluginState.ACTIVE);
    });
  });

  it('should activate WamKeyboardPlugin before playback', async () => {
    const activateSpy = vi.spyOn(mockPluginManager, 'activatePlugin');

    const playButton = widget.getByTestId('play-button');
    await userEvent.click(playButton);

    await waitFor(() => {
      expect(activateSpy).toHaveBeenCalledWith('wam-keyboard');
    });
  });

  it('should load correct instrument (Grand Piano, Rhodes, Wurlitzer)', async () => {
    const wamKeyboard = mockWamKeyboardPlugin.getWamKeyboard();
    const loadInstrumentSpy = vi.spyOn(wamKeyboard, 'loadInstrument');

    // Select Grand Piano
    const instrumentSelect = widget.getByTestId('instrument-select');
    await userEvent.selectOptions(instrumentSelect, 'GRAND_PIANO');

    await waitFor(() => {
      expect(loadInstrumentSpy).toHaveBeenCalledWith(
        KeyboardInstrument.GRAND_PIANO
      );
    });
  });

  it('should handle WamKeyboard initialization failure gracefully', async () => {
    mockWamKeyboardPlugin.getWamKeyboard = vi.fn().mockReturnValue(null);

    const playButton = widget.getByTestId('play-button');
    await userEvent.click(playButton);

    await waitFor(() => {
      expect(widget.getByText(/keyboard not initialized/i)).toBeInTheDocument();
    });
  });
});
```

### 5.4 End-to-End CC64 Sustain Test

**File:** `CC64Sustain.e2e.test.ts` (new file)

```typescript
describe('CC64 Sustain Pedal - End-to-End', () => {
  it('should extend note duration with sustain pedal', async () => {
    // Load exercise with CC64 events
    const exercise = {
      regions: [
        {
          events: [
            {
              type: 'harmony-midi-note',
              data: { midiNote: 60, velocity: 80 },
              time: '0:0:0',
              duration: '1n',
            },
            {
              type: 'harmony-control-change',
              data: { cc: 64, value: 127 },
              time: '0:0:0',
            }, // Pedal DOWN
            {
              type: 'harmony-control-change',
              data: { cc: 64, value: 0 },
              time: '0:2:0',
            }, // Pedal UP at 2 beats
          ],
          startPosition: '0:0:0',
          duration: '4n',
        },
      ],
    };

    const playbackEngine = new PlaybackEngine(eventBus);
    await playbackEngine.loadExercise(exercise);

    // Capture scheduled audio events
    const scheduledNotes: any[] = [];
    const mockScheduler = {
      scheduleNote: (note: any) => scheduledNotes.push(note),
    };
    playbackEngine['scheduler'] = mockScheduler;

    await playbackEngine.start();

    // Verify note duration was extended
    expect(scheduledNotes).toHaveLength(1);
    const note = scheduledNotes[0];

    // Original duration: 1 quarter note (1 beat)
    // Sustain extends until beat 2 (pedal up)
    // Expected duration: 2 beats (double the original)
    expect(note.duration).toBeGreaterThan(1); // Extended
    expect(note.duration).toBeCloseTo(2, 1); // Roughly 2 beats
  });

  it('should NOT extend note if pedal is up', async () => {
    const exercise = {
      regions: [
        {
          events: [
            {
              type: 'harmony-midi-note',
              data: { midiNote: 60, velocity: 80 },
              time: '0:0:0',
              duration: '1n',
            },
            // No CC64 events - pedal stays up
          ],
          startPosition: '0:0:0',
          duration: '4n',
        },
      ],
    };

    const playbackEngine = new PlaybackEngine(eventBus);
    await playbackEngine.loadExercise(exercise);

    const scheduledNotes: any[] = [];
    const mockScheduler = {
      scheduleNote: (note: any) => scheduledNotes.push(note),
    };
    playbackEngine['scheduler'] = mockScheduler;

    await playbackEngine.start();

    expect(scheduledNotes).toHaveLength(1);
    const note = scheduledNotes[0];

    // Should use original MIDI duration (no extension)
    expect(note.duration).toBeCloseTo(1, 1); // 1 beat
  });
});
```

---

## 6. Migration Checklist

### 6.1 Task 1.2 (PlaybackEngine) Subtasks

Add these subtasks to Task 1.2 in [PLAYBACK_ENGINE_REFACTOR_STORY.md](./PLAYBACK_ENGINE_REFACTOR_STORY.md):

- [x] **Day 2: PluginManager Integration**
  - [ ] Port `setPluginManager(pluginManager: PluginManager)` method from RegionProcessor
  - [ ] Port `getWamKeyboard(): WamKeyboard | null` unwrapping logic
  - [ ] Add `private pluginManager: PluginManager | null = null` property
  - [ ] Add logger warnings for missing PluginManager
  - [ ] Add try-catch error handling for plugin retrieval
  - [ ] **Regression Test:** Verify getWamKeyboard returns correct instance
  - [ ] **Regression Test:** Verify null handling when plugin not loaded

### 6.2 Task 1.4 (CoreServices/AudioProvider) Subtasks

Add these subtasks to Task 1.4:

- [x] **Day 2: PluginManager Wiring**
  - [ ] In CoreServices.initialize(), inject PluginManager into PlaybackEngine
  - [ ] Call `playbackEngine.setPluginManager(this.pluginManager)`
  - [ ] Add initialization logging: "PlaybackEngine connected to PluginManager"
  - [ ] **Regression Test:** Verify PlaybackEngine has PluginManager reference after init
  - [ ] **Regression Test:** Verify getWamKeyboard works after CoreServices init

### 6.3 HarmonyWidget Verification (No Changes Needed)

Verify these behaviors remain unchanged:

- [ ] **Widget Plugin Loading:** HarmonyWidget still loads WamKeyboardPlugin directly
- [ ] **Instrument Loading:** WamKeyboard.loadInstrument() still works for Grand Piano, Rhodes, Wurlitzer
- [ ] **Plugin Retry Logic:** Widget still retries plugin loading (MAX_RETRIES = 10)
- [ ] **Audio Node Creation:** WamKeyboard.audioNode still connects to audio destination
- [ ] **State Management:** Widget still tracks wamPluginLoaded, pluginClassLoaded states

### 6.4 CC64 Behavior Verification

- [ ] **Timeline Pre-Calculation:** CC64 timeline still built before playback starts
- [ ] **Note Duration Extension:** Notes still extend duration when pedal is down
- [ ] **Pedal Down During Note:** Notes still extend if pedal goes down during MIDI duration
- [ ] **Exercise End Sustain:** Notes still ring out until exercise end if pedal stays down
- [ ] **Event Logging:** CC64 events still logged to console for debugging
- [ ] **No Real-Time Routing:** Verify scheduleControlChange() is NOT called (pre-calculated approach)

---

## 7. Risk Assessment

### 7.1 Risk Matrix

| Risk                              | Probability | Impact | Mitigation                               |
| --------------------------------- | ----------- | ------ | ---------------------------------------- |
| **PluginManager not injected**    | Low         | High   | Add initialization test in Task 1.4      |
| **WamKeyboard unwrapping breaks** | Medium      | High   | Copy logic verbatim, add regression test |
| **CC64 timeline logic lost**      | Low         | High   | Keep SustainPedalManager as-is           |
| **Widget plugin loading fails**   | Medium      | Medium | No changes to widget, verify end-to-end  |
| **Plugin initialization race**    | Medium      | Medium | Preserve widget retry logic (10 retries) |

### 7.2 Critical Success Factors

✅ **MUST PRESERVE:**

1. Two-step unwrapping: `PluginManager → WamKeyboardPlugin → WamKeyboard`
2. Null safety checks at each step
3. Pre-calculated CC64 timeline approach
4. HarmonyWidget async plugin loading with retries

🚨 **DO NOT:**

1. Change WamKeyboardPlugin interface
2. Modify WamKeyboard.scheduleControlChange() API
3. Implement real-time CC routing (keep pre-calculated approach)
4. Change HarmonyWidget plugin initialization flow

### 7.3 Rollback Plan

If WAM integration breaks:

1. **Adapter Fallback:** RegionProcessorAdapter can route plugin calls to legacy system
2. **Feature Flag:** Disable new PlaybackEngine for HarmonyWidget only
3. **Widget-Level Toggle:** HarmonyWidget can check flag and use legacy RegionProcessor

---

## 8. Code References

### 8.1 Key Files

| File                                                                                                                                   | Lines     | Description                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------- |
| [RegionProcessor.ts](../../../apps/frontend/src/domains/playback/services/core/RegionProcessor.ts#L594)                                | 594-636   | PluginManager injection and unwrapping |
| [WamKeyboardPlugin.ts](../../../apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboardPlugin.ts#L94)          | 94-96     | getWamKeyboard() unwrapping method     |
| [WamKeyboard.ts](../../../apps/frontend/src/domains/playback/modules/instruments/adapters/wam/WamKeyboard.ts#L1368)                    | 1368-1369 | scheduleControlChange() API            |
| [HarmonyScheduler.ts](../../../apps/frontend/src/domains/playback/services/core/region-processing/scheduling/HarmonyScheduler.ts#L210) | 210-231   | CC64 event handling (logging only)     |
| [HarmonyWidget.tsx](../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx#L498)         | 498-671   | Plugin loading with retry logic        |
| [PluginManager.ts](../../../apps/frontend/src/domains/playback/services/core/PluginManager.ts#L297)                                    | 297-304   | getPlugin<T>() generic method          |
| [SustainPedalManager.ts](../../../apps/frontend/src/domains/playback/services/core/region-processing/sustain/SustainPedalManager.ts)   | Full file | CC64 timeline builder and analyzer     |

### 8.2 Type Definitions

```typescript
// PluginManager API
interface PluginManager {
  getPlugin<T extends AudioPlugin>(pluginId: string): T;
  activatePlugin(pluginId: string): Promise<void>;
  getPluginState(pluginId: string): PluginState | undefined;
}

// WamKeyboardPlugin API
interface WamKeyboardPlugin extends AudioPlugin {
  getWamKeyboard(): WamKeyboard | null;
  metadata: { id: 'wam-keyboard' };
}

// WamKeyboard API
interface WamKeyboard {
  scheduleControlChange(cc: number, value: number, time: number): void;
  loadInstrument(instrument: KeyboardInstrument): Promise<void>;
  audioNode: AudioNode | null;
}

// Keyboard Instruments
enum KeyboardInstrument {
  GRAND_PIANO = 'GRAND_PIANO',
  RHODES = 'RHODES',
  WURLITZER = 'WURLITZER',
}
```

---

## Summary

### ✅ Key Takeaways

1. **PluginManager integration is straightforward:** Copy 2 methods verbatim to PlaybackEngine
2. **CC64 uses pre-calculated timeline:** Do NOT implement real-time routing (keep current approach)
3. **HarmonyWidget manages plugin lifecycle:** No changes needed to widget code
4. **Two-step unwrapping is critical:** `PluginManager → WamKeyboardPlugin → WamKeyboard`
5. **Async plugin loading requires retries:** Widget already handles this (preserve behavior)

### 📋 Migration Steps

1. **Task 1.2:** Port setPluginManager() and getWamKeyboard() to PlaybackEngine
2. **Task 1.4:** Inject PluginManager in CoreServices.initialize()
3. **Task 2.1 (Day 5):** Verify CC64 sustain still works identically
4. **Task 2.2:** Verify HarmonyWidget plugin loading unchanged

### 🎯 Regression Tests

- **5 Unit Tests:** PluginManager injection and unwrapping
- **4 CC64 Tests:** Timeline-based sustain duration extension
- **5 Integration Tests:** HarmonyWidget plugin loading
- **2 E2E Tests:** Full CC64 sustain behavior

**Total:** 16 regression tests for WAM integration

---

**Task 0.6 Status:** ✅ **COMPLETE**
**Deliverable:** This document (PLUGIN_MANAGER_INTEGRATION.md)
**Next Task:** Task 0.7 - Memory Leak Status Audit

---

**Document Version:** 1.0
**Last Updated:** 2025-11-23
**Author:** Lead Engineer
**Reviewers:** Engineering Team
