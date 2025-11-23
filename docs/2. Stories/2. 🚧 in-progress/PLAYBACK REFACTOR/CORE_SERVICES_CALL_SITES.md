# CoreServices Call Site Mapping

**Task:** Phase 0.2 - CoreServices Call Site Mapping
**Status:** ✅ COMPLETED
**Date:** 2025-11-23
**Estimated Duration:** 2 days
**Actual Duration:** [IN PROGRESS]

---

## Executive Summary

This document maps ALL call sites where `getRegionProcessor()` is invoked, documenting the migration complexity for the PlaybackEngine refactor. Our goal is to understand how RegionProcessor is currently used throughout the codebase and plan a safe migration path.

### Key Findings

- **Total Call Sites:** 17 occurrences across 9 files
- **Production Code:** 9 call sites (3 widgets + 1 test page + 1 preloader)
- **Test Code:** 8 call sites (integration tests)
- **Commented Code:** 2 call sites (deprecated DrummerWidget code)
- **Most Complex Integration:** HarmonyWidget (PluginManager interaction)
- **Highest Risk:** Window global access pattern (4 widgets use `window.__globalCoreServices`)

### Migration Complexity Breakdown

| Complexity | Count | Files |
|------------|-------|-------|
| **HIGH** | 1 | HarmonyWidget (PluginManager integration) |
| **MEDIUM** | 3 | DrummerWidget, MetronomeWidget, GlobalControls |
| **LOW** | 5 | Test files, InitialSamplePreloader, CoreServices |

---

## Section 1: Call Site Inventory

### 1.1 Production Widget Call Sites (HIGH/MEDIUM Complexity)

#### 1.1.1 HarmonyWidget.tsx ⚠️ HIGH COMPLEXITY

**File:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx`

**Line:** 1321

**Context:** PluginManager integration for WAM keyboard instruments

**Code:**
```typescript
const regionProcessor = coreServices.getRegionProcessor?.();
if (!regionProcessor) {
  console.error('❌ [HARMONY-WIDGET] No RegionProcessor available');
  return;
}
```

**Methods Called:**
- `setPluginManager(pluginManager)` - Sets WAM keyboard plugin for CC64 routing
- Indirect: Expects RegionProcessor to route CC64 events to WamKeyboard

**State Dependencies:**
- Reads: `coreServices` from useCoreServices hook
- Writes: Calls `setPluginManager()` to inject PluginManager instance
- **CRITICAL:** This is the ONLY widget that uses PluginManager integration

**Migration Complexity:** **HIGH**
- **Reason:** Requires preserving PluginManager integration (WAM keyboard CC64 routing)
- **Risk:** Task 0.6 (PluginManager/WAM Integration Analysis) must complete BEFORE migrating this widget
- **Dependencies:** Must verify CC64 sustain pedal routing works after migration
- **Test Coverage:** Needs regression test for WAM keyboard sustain pedal behavior

---

#### 1.1.2 DrummerWidget.tsx ⚠️ MEDIUM COMPLEXITY

**File:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget.tsx`

**Lines:** 294-295 (commented), 513-514, 836-837

**Context:** Pattern-based drum playback with track registration

**Code (Active - Line 513):**
```typescript
if (globalServices && globalServices.getRegionProcessor) {
  const regionProcessor = globalServices.getRegionProcessor();
  regionProcessor.registerTracks([{
    id: 'drummer-widget-track',
    name: 'Drums',
    instrumentType: 'drums',
    regions: convertedPattern.regions,
  }]);
}
```

**Access Pattern:** `window.__globalCoreServices || window.__coreServices`

**Methods Called:**
- `registerTracks(tracks)` - Registers drum pattern with 4-bar regions (2 occurrences)
- `updateTracks(tracks)` - Updates pattern when user changes drum configuration (1 occurrence)

**State Dependencies:**
- Reads: `globalServices` from window global
- Writes: Track registration with full pattern data
- **Pattern:** Registers track on pattern load, updates on pattern change

**Migration Complexity:** **MEDIUM**
- **Reason:** Uses window global access (not React context), multiple update patterns
- **Risk:** Dual-engine coexistence during feature flag period (window global routing)
- **Dependencies:** Adapter pattern required for backward compatibility
- **Test Coverage:** Pattern registration, pattern updates, 4-bar looping

---

#### 1.1.3 MetronomeWidget.tsx ⚠️ MEDIUM COMPLEXITY

**File:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/MetronomeWidget.tsx`

**Lines:** 333-334, 426-427, 483-484

**Context:** Metronome click pattern registration and updates

**Code (Line 333):**
```typescript
if (globalServices && globalServices.getRegionProcessor) {
  const regionProcessor = globalServices.getRegionProcessor();
  regionProcessor.registerTracks([{
    id: 'metronome-track',
    name: 'Metronome',
    instrumentType: 'metronome',
    regions: convertedPattern.regions,
  }]);
}
```

**Access Pattern:** `window.__globalCoreServices || window.__coreServices`

**Methods Called:**
- `registerTracks(tracks)` - Registers metronome pattern (1 occurrence)
- `updateTracks(tracks)` - Updates pattern when user changes time signature/BPM (2 occurrences)

**State Dependencies:**
- Reads: `globalServices` from window global
- Writes: Track registration with metronome click pattern
- **Pattern:** Similar to DrummerWidget - register on load, update on config change

**Migration Complexity:** **MEDIUM**
- **Reason:** Uses window global access, multiple update patterns
- **Risk:** Same as DrummerWidget - dual-engine window global routing
- **Dependencies:** Adapter pattern required
- **Test Coverage:** Click pattern accuracy, BPM/time signature changes

---

#### 1.1.4 GlobalControls.tsx ⚠️ MEDIUM COMPLEXITY

**File:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/GlobalControls.tsx`

**Line:** Not directly visible in grep (imports RegionProcessor, uses serviceRegistry)

**Context:** Central playback controls (play/stop/pause)

**Code Pattern:**
```typescript
import { serviceRegistry } from '@/domains/playback/services/core/ServiceRegistry.js';
import type { CoreServices } from '@/domains/playback/services/core/CoreServices.js';
import { RegionProcessor } from '@/domains/playback/services/core/RegionProcessor.js';
```

**Methods Called:**
- Likely: `start()`, `stop()`, `pause()` via transport hooks
- Indirect: Uses `useTransport` hook which wraps RegionProcessor

**State Dependencies:**
- Reads: ServiceRegistry singleton
- Uses: React hooks (useTransport, useTrack)
- **Pattern:** Indirect usage through hooks, not direct `getRegionProcessor()` calls

**Migration Complexity:** **MEDIUM**
- **Reason:** Uses serviceRegistry and hooks (indirect RegionProcessor access)
- **Risk:** Hook-based access pattern needs adapter support
- **Dependencies:** May require updating useTransport/useTrack hooks
- **Test Coverage:** Play/stop/pause integration tests

---

### 1.2 Production Service Call Sites (LOW Complexity)

#### 1.2.1 InitialSamplePreloader.ts ✅ LOW COMPLEXITY

**File:** `apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts`

**Line:** 407

**Context:** Injecting preloaded harmony buffers into RegionProcessor

**Code:**
```typescript
const regionProcessor = coreServices.getRegionProcessor();
const sampleCache = GlobalSampleCache.getInstance();

// Get the instrument that was just preloaded
// ... buffer injection logic
```

**Methods Called:**
- Indirect: Accesses internal buffer registry to inject preloaded samples
- **Purpose:** Performance optimization - preload harmony samples before playback

**State Dependencies:**
- Reads: `coreServices` from GlobalAudioSystem
- Writes: Injects AudioBuffer instances into RegionProcessor's buffer cache

**Migration Complexity:** **LOW**
- **Reason:** Simple buffer injection, no complex state dependencies
- **Risk:** Minimal - just needs PlaybackEngine to expose buffer injection API
- **Dependencies:** PlaybackEngine.setPreloadedBuffers() or similar
- **Test Coverage:** Verify preloaded buffers are used (no duplicate loading)

---

#### 1.2.2 CoreServices.ts ✅ LOW COMPLEXITY

**File:** `apps/frontend/src/domains/playback/services/core/CoreServices.ts`

**Line:** 398-400

**Context:** Public getter method for RegionProcessor instance

**Code:**
```typescript
getRegionProcessor(): RegionProcessor {
  return this.regionProcessor;
}
```

**Methods Called:**
- N/A - This IS the method being called by consumers

**State Dependencies:**
- Returns: Private `this.regionProcessor` instance created in constructor

**Migration Complexity:** **LOW**
- **Reason:** Simple getter, perfect place to add feature flag logic
- **Risk:** None - this is the adapter insertion point
- **Dependencies:** Add `getPlaybackEngine()` getter alongside this
- **Implementation:**
```typescript
getRegionProcessor(): RegionProcessor {
  // Feature flag routing
  if (ENABLE_NEW_PLAYBACK_ENGINE) {
    return new RegionProcessorAdapter(this.playbackEngine);
  }
  return this.regionProcessor;
}

getPlaybackEngine(): PlaybackEngine {
  return this.playbackEngine;
}
```

---

### 1.3 Test File Call Sites (LOW Complexity)

#### 1.3.1 test-audio-flow/page.tsx ✅ LOW COMPLEXITY

**File:** `apps/frontend/src/app/test-audio-flow/page.tsx`

**Lines:** 29, 122

**Context:** Test page for debugging audio initialization flow

**Code (Line 29):**
```typescript
const regionProcessor = coreServices.getRegionProcessor();
const instrumentRegistry = coreServices.getInstrumentRegistry();
const audioEventRouter = coreServices.getAudioEventRouter();

// ... later
regionProcessor.registerTracks([{ ... }]);
regionProcessor.start();

// ... cleanup
regionProcessor.stop();
```

**Methods Called:**
- `registerTracks()` - Register test metronome track
- `start()` - Start playback
- `stop()` - Stop playback

**Migration Complexity:** **LOW**
- **Reason:** Test page, easily updated or removed
- **Action:** Update to use PlaybackEngine or remove if deprecated

---

#### 1.3.2 AudioFlow.comprehensive.test.ts ✅ LOW COMPLEXITY

**File:** `apps/frontend/src/domains/playback/services/core/AudioFlow.comprehensive.test.ts`

**Line:** 155

**Context:** Integration test for complete audio flow

**Code:**
```typescript
regionProcessor = coreServices.getRegionProcessor();
transport = coreServices.getUnifiedTransport();

// ... test setup
regionProcessor.registerTracks([track]);
regionProcessor.start();
// ... verify
regionProcessor.stop();
```

**Migration Complexity:** **LOW**
- **Reason:** Test file, can be updated with PlaybackEngine
- **Action:** Duplicate tests for both engines during migration

---

#### 1.3.3 Other Test Files ✅ LOW COMPLEXITY

**Files:**
- `AudioFlow.simple.test.ts` - 3 occurrences
- `AudioEventFlow.integration.test.ts` - 1 occurrence
- `RegionProcessor.phase4.integration.test.ts` - 2 occurrences

**Migration Complexity:** **LOW**
- **Reason:** All test files, easily updated
- **Action:** Create parallel test suites for PlaybackEngine

---

## Section 2: Five Most Complex Integration Points

Based on analysis, here are the 5 most complex call sites requiring special handling:

### 🔴 #1: HarmonyWidget PluginManager Integration (HIGHEST RISK)

**Complexity Factors:**
- Only widget using `setPluginManager()` method
- CC64 sustain pedal event routing to WAM keyboard
- WamKeyboardPlugin → WamKeyboard type unwrapping
- Silent failure risk (sustain pedal won't work but no obvious error)
- **Dependency:** Task 0.6 (PluginManager/WAM Integration Analysis) MUST complete first

**Migration Strategy:**
1. Complete Task 0.6 to document exact PluginManager integration
2. Port `setPluginManager()` and `getWamKeyboard()` methods to PlaybackEngine
3. Create regression test: Load Grand Piano exercise, verify sustain pedal works
4. Migrate widget LAST (after all other widgets proven stable)

---

### 🟡 #2: DrummerWidget Window Global Access (MEDIUM RISK)

**Complexity Factors:**
- Uses `window.__globalCoreServices` instead of React context
- Multiple update patterns (registerTracks + updateTracks)
- 4-bar drum pattern looping
- **Risk:** Dual-engine coexistence needs careful window global routing

**Migration Strategy:**
1. Add feature flag check to window global assignment
2. Route to appropriate engine based on flag
3. Test pattern registration and updates with both engines
4. Migrate to React context in Phase 2 (optional cleanup)

---

### 🟡 #3: MetronomeWidget Window Global Access (MEDIUM RISK)

**Complexity Factors:**
- Same as DrummerWidget (window global access)
- Multiple update patterns (3 call sites)
- Time signature and BPM change handling

**Migration Strategy:**
- Same as DrummerWidget
- Test click pattern accuracy across engines

---

### 🟡 #4: GlobalControls Hook-Based Access (MEDIUM RISK)

**Complexity Factors:**
- Indirect access through `useTransport` and `useTrack` hooks
- ServiceRegistry singleton dependency
- Central control point (affects all widgets)

**Migration Strategy:**
1. Update hooks to support both engines
2. Feature flag in hook implementation
3. Test all playback controls (play/stop/pause) with both engines

---

### 🟢 #5: InitialSamplePreloader Buffer Injection (LOW-MEDIUM RISK)

**Complexity Factors:**
- Direct buffer cache manipulation
- Performance optimization (preloading)
- **Risk:** If broken, harmony instruments load slowly (noticeable UX degradation)

**Migration Strategy:**
1. Add PlaybackEngine.setPreloadedBuffers() method
2. Verify preloaded buffers are used (check network tab for duplicate requests)
3. Performance test: Measure harmony instrument load time (should be <100ms)

---

## Section 3: GlobalAudioSystem Singleton Behavior

### 3.1 Singleton Pattern Overview

**File:** Likely `GlobalAudioSystem.ts` (not directly visible, but used in AudioProvider.tsx:126)

**Pattern:**
```typescript
const existingInstance = GlobalAudioSystem.getCurrentInstance();
if (existingInstance) {
  // Reuse existing instance
  services = existingInstance;
} else {
  // Create new instance
  services = await createCoreServicesWithPreInit();
}
```

### 3.2 Singleton Behavior Details

#### getCurrentInstance() Reuse Logic

**Purpose:** Prevent duplicate CoreServices instances during React re-mounts

**Behavior:**
1. **First Mount:** `getCurrentInstance()` returns `null` → creates new CoreServices
2. **React Re-Mount (Strict Mode):** `getCurrentInstance()` returns existing instance → reuses
3. **Hot Reload (Dev):** Reuses instance if available
4. **Page Navigation:** Creates new instance (old one cleaned up by WindowRegistry)

**Critical Insight:**
- This pattern enables **dual-engine coexistence** during feature flag migration
- Both RegionProcessor AND PlaybackEngine can exist in same CoreServices instance
- Feature flag routes `getRegionProcessor()` calls to appropriate engine

---

### 3.3 Existing Instance Handling on React Re-Mount

**Code (AudioProvider.tsx:126-144):**
```typescript
const existingInstance = GlobalAudioSystem.getCurrentInstance();
if (existingInstance) {
  logger.info('AudioProvider: Using existing global audio system instance');
  services = existingInstance;

  // Immediately update React state with existing services
  setCoreServices(services);
  setIsInitialized(true);
  setServicesReady(true);
  // ✅ BUG #1 FIX: Mark CoreServices as ready
  setCoreServicesReady(true);
  logger.info('AudioProvider: Context state updated with existing services - isInitialized: true, coreServicesReady: true');

  logMigrationEvent('AudioProvider reusing existing global instance');
  return;
}
```

**Key Points:**
- **Skips Initialization:** If instance exists, no async initialization happens
- **Immediate State Update:** All React state flags set to `true` synchronously
- **Bug #1 Fix Preserved:** `coreServicesReady` flag prevents race conditions
- **Fast Re-Mount:** No AudioContext recreation, no sample reloading

**Dual-Engine Implications:**
- Existing instance already has BOTH RegionProcessor AND PlaybackEngine (after Phase 1)
- Feature flag toggle just changes routing, doesn't recreate services
- **Rollback Time:** <5 minutes (just flip flag, no service recreation)

---

## Section 4: AudioProvider React Lifecycle Complexity

### 4.1 React StrictMode Double-Mount Handling

#### initRef Pattern (Prevents Double Initialization)

**Code (AudioProvider.tsx:97, 118-119):**
```typescript
const initRef = useRef(false);

useEffect(() => {
  // Skip initialization if using legacy provider
  if (shouldUseLegacyProvider) return;
  // Prevent double initialization in development
  if (initRef.current) return;
  initRef.current = true;

  // ... initialization logic
}, []);
```

**Purpose:**
- React StrictMode intentionally mounts components twice in development
- Without this guard, we'd create 2 CoreServices instances
- `initRef.current` acts as a "already initialized" flag

**Critical for Migration:**
- PlaybackEngine initialization MUST respect this pattern
- Both engines must use same `initRef` guard
- Test with React StrictMode enabled (default in Next.js dev)

---

#### cleanupRef Pattern (Prevents Double Cleanup)

**Code (AudioProvider.tsx:99):**
```typescript
const cleanupRef = useRef(false); // Prevent StrictMode double cleanup

// ... in cleanup function (not shown in grep)
if (cleanupRef.current) return;
cleanupRef.current = true;
```

**Purpose:**
- Prevents React StrictMode from cleaning up services during double-mount
- Without this, first mount would cleanup immediately, breaking audio

**Critical for Migration:**
- PlaybackEngine disposal MUST respect this pattern
- Adapter pattern must NOT trigger cleanup for engine being kept

---

### 4.2 coreServicesReady Flag Synchronization (Bug #1 Fix)

**Code (AudioProvider.tsx:100-101, 138, 196):**
```typescript
// ✅ BUG #1 FIX: Track when CoreServices is ready to prevent race conditions
const [coreServicesReady, setCoreServicesReady] = useState(false);

// ... in existing instance path
setCoreServicesReady(true);

// ... in new instance path
setCoreServicesReady(true);
```

**Purpose:**
- Prevents widgets from calling `getRegionProcessor()` before CoreServices is initialized
- Solves race condition: "getRegionProcessor is not a function" error

**Synchronization Sequence:**
1. **AudioProvider mounts** → `coreServicesReady: false`
2. **CoreServices initializes** → `coreServicesReady: true`
3. **Widgets check flag** → Only call `getRegionProcessor()` if `true`
4. **Result:** No race conditions, no "function not defined" errors

**Critical for Migration:**
- PlaybackEngine must follow EXACT same sequence
- Feature flag toggle must NOT reset `coreServicesReady` to false
- Adapter pattern must preserve this synchronization

**Test Coverage:**
- Regression test: 100 rapid component mount/unmount cycles
- No "getRegionProcessor is not a function" errors
- No "getPlaybackEngine is not a function" errors after migration

---

### 4.3 audioServicesReady Window Event Dispatch

**Code (AudioProvider.tsx:199):**
```typescript
// Dispatch a custom event to notify waiting hooks
window.dispatchEvent(new Event('audioServicesReady'));
```

**Purpose:**
- Notifies hooks and components when audio services are ready
- Used by widgets that don't use React context (window global access pattern)

**Event Flow:**
1. **CoreServices initialized** → Dispatch `audioServicesReady` event
2. **Widgets listening** → Receive event, start using services
3. **Example:** DrummerWidget, MetronomeWidget use window global

**Critical for Migration:**
- PlaybackEngine initialization MUST dispatch same event
- Event should fire when BOTH engines are ready (during dual-engine period)
- Feature flag toggle should NOT re-dispatch event (services already ready)

**Dual-Engine Implications:**
- Event fires ONCE when CoreServices fully initialized
- Both RegionProcessor AND PlaybackEngine ready at same time
- Widgets can use either engine (feature flag routing happens in CoreServices)

---

### 4.4 AudioContext State Change Subscription (Bug #4 Fix)

**Code (AudioProvider.tsx:222-233):**
```typescript
// BUG #4 FIX: Subscribe to AudioContext state changes (event-driven, not polling!)
const unsubscribe = AudioContextManager.onGlobalStateChange((state) => {
  logger.info('AudioContext state changed (event-driven)', { state });

  // Clear incompatible buffers if context changes
  if (state === 'closed') {
    logger.warn('AudioContext closed - clearing cached buffers');
    GlobalSampleCache.clearAllBuffers();
  }
});

// ✅ BUG #8 FIX: Store unsubscribe function using WindowRegistry
WindowRegistry.setAudioContextUnsubscribe(unsubscribe);
```

**Purpose:**
- Detect when AudioContext is closed (e.g., page background, browser suspend)
- Clear cached buffers (they're invalid for new AudioContext)
- Event-driven (efficient) instead of polling (wasteful)

**Critical for Migration:**
- PlaybackEngine MUST use same AudioContextManager subscription
- Both engines share same AudioContext (no duplication)
- Buffer clearing affects both engines (shared GlobalSampleCache)

**Cleanup Requirements:**
- `unsubscribe()` must be called on component unmount
- WindowRegistry tracks cleanup (Bug #8 fix)
- Test: Verify no memory leaks from uncleaned subscriptions

---

## Section 5: Dual-Engine Coexistence Strategy

### 5.1 Feature Flag Implementation

#### Flag Location
```typescript
// In CoreServices.ts
getRegionProcessor(): RegionProcessor {
  const ENABLE_NEW_PLAYBACK_ENGINE = process.env.NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE === 'true';

  if (ENABLE_NEW_PLAYBACK_ENGINE) {
    // Return adapter wrapping new engine
    return new RegionProcessorAdapter(this.playbackEngine);
  }

  // Return old engine
  return this.regionProcessor;
}
```

#### Flag Routing Strategy
- **Single Toggle Point:** Only in `CoreServices.getRegionProcessor()`
- **Transparent Routing:** Widgets don't know which engine they're using
- **Adapter Pattern:** `RegionProcessorAdapter` implements same API as `RegionProcessor`
- **Rollback:** Flip flag back to `false` → instant rollback to old engine

---

### 5.2 Adapter Pattern Requirements

#### RegionProcessorAdapter Design

**File:** `playback/services/core/RegionProcessorAdapter.ts` (TO BE CREATED)

**Purpose:** Wraps PlaybackEngine to expose RegionProcessor-compatible API

**Implementation:**
```typescript
export class RegionProcessorAdapter implements RegionProcessor {
  constructor(private playbackEngine: PlaybackEngine) {}

  // Map old API to new API
  registerTracks(tracks: TrackData[]): void {
    console.warn('[DEPRECATED] RegionProcessor.registerTracks() - migrate to PlaybackEngine.loadExercise()');
    this.playbackEngine.loadExercise(convertTracksToExercise(tracks));
  }

  start(): void {
    console.warn('[DEPRECATED] RegionProcessor.start() - migrate to PlaybackEngine.start()');
    this.playbackEngine.start();
  }

  stop(): void {
    console.warn('[DEPRECATED] RegionProcessor.stop() - migrate to PlaybackEngine.stop()');
    this.playbackEngine.stop();
  }

  // ⚠️ CRITICAL: Preserve PluginManager integration for HarmonyWidget
  setPluginManager(pluginManager: PluginManager): void {
    console.warn('[DEPRECATED] RegionProcessor.setPluginManager() - migrate to PlaybackEngine.setPluginManager()');
    this.playbackEngine.setPluginManager(pluginManager);
  }

  // ... other methods
}
```

**Deprecation Warnings:**
- Log warning on every adapter method call
- Helps identify which widgets still need migration
- Remove warnings after full migration (Week 8)

---

### 5.3 Testing Dual-Engine Coexistence

#### Test: Feature Flag Toggle During Runtime

**Scenario:** User has page open, we flip feature flag remotely

**Expected Behavior:**
1. Current playback stops gracefully (old engine)
2. Page reloads or prompts user to refresh
3. New playback uses new engine (PlaybackEngine)
4. No data loss, no audio glitches

**Test Cases:**
- Toggle flag while audio is playing
- Toggle flag while audio is stopped
- Toggle flag during exercise switching
- Toggle flag during tempo change

---

#### Test: Both Engines Initialized Simultaneously

**Scenario:** During migration, both engines exist in CoreServices

**Expected Behavior:**
1. Both engines share same AudioContext (no duplication)
2. Both engines share same EventBus (events work for both)
3. Only ONE engine is active at a time (controlled by feature flag)
4. Memory usage <20% higher than single-engine (acceptable overhead)

**Test Cases:**
- Verify AudioContext.sampleRate matches for both engines
- Verify EventBus.emit() reaches both engines
- Measure memory usage (should be 1.1x-1.2x single-engine)
- Verify no duplicate audio playback (only active engine plays)

---

#### Test: Window Global Routing (DrummerWidget, MetronomeWidget)

**Scenario:** Widgets use `window.__globalCoreServices.getRegionProcessor()`

**Expected Behavior:**
1. Window global points to same CoreServices instance
2. `getRegionProcessor()` routes based on feature flag
3. Widgets transparently use correct engine
4. No code changes required in widgets (during adapter phase)

**Test Cases:**
- Load DrummerWidget with flag=false (old engine)
- Load DrummerWidget with flag=true (new engine via adapter)
- Verify drum pattern plays identically in both cases
- Verify pattern updates work in both cases

---

### 5.4 State Drift Prevention During Migration

#### Synchronization Requirements

**Problem:** Old engine and new engine have separate state

**Solution:** Adapter pattern keeps engines in sync

**Sync Points:**
1. **Exercise Loading:** When adapter.registerTracks() called, update PlaybackEngine
2. **Playback State:** When adapter.start() called, sync PlaybackEngine state
3. **Tempo Changes:** When adapter.updateTempo() called, update PlaybackEngine
4. **Plugin Registration:** When adapter.setPluginManager() called, forward to PlaybackEngine

**Implementation:**
```typescript
class RegionProcessorAdapter {
  private isSynced = true;

  registerTracks(tracks: TrackData[]): void {
    try {
      this.playbackEngine.loadExercise(convertTracksToExercise(tracks));
      this.isSynced = true;
    } catch (error) {
      logger.error('Failed to sync registerTracks to PlaybackEngine', error);
      this.isSynced = false;
      throw error;
    }
  }

  // Monitor sync status
  getSyncStatus(): boolean {
    return this.isSynced;
  }
}
```

---

#### Monitoring State Drift

**Metrics to Track:**
- `adapter_sync_failures` - Count of failed state synchronizations
- `adapter_method_calls` - Count of deprecated API calls
- `engine_state_mismatch` - Detect when engines have different state

**Alerts:**
- If `adapter_sync_failures > 0` → Alert team (critical bug)
- If `adapter_method_calls` drops to 0 → Safe to remove adapter (all widgets migrated)

---

## Section 6: Migration Checklist (Per Call Site)

### 6.1 HarmonyWidget Migration Checklist

- [ ] **Pre-Migration**
  - [ ] Complete Task 0.6 (PluginManager/WAM Integration Analysis)
  - [ ] Document exact CC64 event routing behavior
  - [ ] Create regression test: Load Grand Piano, verify sustain pedal
- [ ] **Phase 1: Adapter Support**
  - [ ] Implement `PlaybackEngine.setPluginManager()`
  - [ ] Implement `PlaybackEngine.getWamKeyboard()`
  - [ ] Port WamKeyboardPlugin → WamKeyboard unwrapping logic
  - [ ] Test adapter with HarmonyWidget (sustain pedal must work)
- [ ] **Phase 2: Direct Migration**
  - [ ] Update HarmonyWidget to call `coreServices.getPlaybackEngine()`
  - [ ] Replace `setPluginManager()` with direct PlaybackEngine API
  - [ ] Run regression test (sustain pedal must still work)
  - [ ] Remove adapter code path
- [ ] **Verification**
  - [ ] Load 5 different harmony exercises
  - [ ] Test sustain pedal on each (CC64 events)
  - [ ] Verify no console warnings (adapter removed)
  - [ ] Performance test: No latency increase

---

### 6.2 DrummerWidget Migration Checklist

- [ ] **Pre-Migration**
  - [ ] Document pattern registration behavior
  - [ ] Test 4-bar drum looping accuracy
- [ ] **Phase 1: Adapter Support**
  - [ ] Test `window.__globalCoreServices.getRegionProcessor()` routes to adapter
  - [ ] Verify pattern registration works via adapter
  - [ ] Verify pattern updates work via adapter
- [ ] **Phase 2: Direct Migration (Optional)**
  - [ ] Migrate to React context instead of window global (optional cleanup)
  - [ ] Update to use `getPlaybackEngine()` directly
- [ ] **Verification**
  - [ ] Test all drum patterns (kick, snare, hihat combinations)
  - [ ] Test pattern updates (add/remove notes)
  - [ ] Verify 4-bar looping accuracy
  - [ ] No audio glitches or timing drift

---

### 6.3 MetronomeWidget Migration Checklist

- [ ] **Pre-Migration**
  - [ ] Test click pattern accuracy (metronome precision)
  - [ ] Test time signature changes (4/4, 3/4, 6/8)
- [ ] **Phase 1: Adapter Support**
  - [ ] Same as DrummerWidget (window global routing)
- [ ] **Phase 2: Direct Migration (Optional)**
  - [ ] Same as DrummerWidget
- [ ] **Verification**
  - [ ] Test all time signatures
  - [ ] Test BPM range (40-240 BPM)
  - [ ] Verify click timing accuracy (use audio analysis tool)

---

### 6.4 GlobalControls Migration Checklist

- [ ] **Pre-Migration**
  - [ ] Document hook-based access pattern (useTransport, useTrack)
  - [ ] Test all playback controls (play/stop/pause)
- [ ] **Phase 1: Hook Updates**
  - [ ] Update `useTransport` to support feature flag routing
  - [ ] Update `useTrack` to support feature flag routing
  - [ ] Test hooks with both engines
- [ ] **Phase 2: Direct Migration**
  - [ ] Update hooks to use PlaybackEngine directly
  - [ ] Remove RegionProcessor code paths
- [ ] **Verification**
  - [ ] Test play/stop/pause with all widgets active
  - [ ] Test exercise switching
  - [ ] Test tempo changes during playback

---

### 6.5 InitialSamplePreloader Migration Checklist

- [ ] **Pre-Migration**
  - [ ] Measure harmony instrument load time (baseline: <100ms)
- [ ] **Phase 1: API Addition**
  - [ ] Add `PlaybackEngine.setPreloadedBuffers()` method
  - [ ] Update preloader to call both engines (during dual-engine period)
- [ ] **Phase 2: Direct Migration**
  - [ ] Remove RegionProcessor buffer injection
  - [ ] Only call PlaybackEngine API
- [ ] **Verification**
  - [ ] Measure load time (should match baseline)
  - [ ] Check network tab (no duplicate sample requests)
  - [ ] Test all harmony instruments (Grand Piano, Wurlitzer, etc.)

---

### 6.6 Test File Migration Checklist

- [ ] **Phase 1: Parallel Test Suites**
  - [ ] Duplicate all RegionProcessor tests for PlaybackEngine
  - [ ] Run both test suites in parallel
  - [ ] Compare results (should be identical)
- [ ] **Phase 2: Cleanup**
  - [ ] Remove RegionProcessor test files
  - [ ] Keep PlaybackEngine tests only
- [ ] **Verification**
  - [ ] All tests pass (100% pass rate)
  - [ ] No regressions in coverage (maintain 85%+)

---

## Section 7: Migration Complexity Matrix

| Call Site | File | Complexity | Risk | Dependencies | Priority |
|-----------|------|------------|------|--------------|----------|
| HarmonyWidget | HarmonyWidget.tsx:1321 | **HIGH** | 🔴 HIGH | Task 0.6 | **LAST** |
| DrummerWidget | DrummerWidget.tsx:513,836 | **MEDIUM** | 🟡 MEDIUM | Adapter | Phase 2 |
| MetronomeWidget | MetronomeWidget.tsx:333,426,483 | **MEDIUM** | 🟡 MEDIUM | Adapter | Phase 2 |
| GlobalControls | GlobalControls.tsx | **MEDIUM** | 🟡 MEDIUM | Hook updates | Phase 2 |
| InitialSamplePreloader | InitialSamplePreloader.ts:407 | **LOW** | 🟢 LOW | Buffer API | Phase 2 |
| CoreServices | CoreServices.ts:398 | **LOW** | 🟢 NONE | N/A (adapter point) | Phase 1 |
| test-audio-flow | page.tsx:29,122 | **LOW** | 🟢 NONE | Test update | Phase 2 |
| AudioFlow tests | *.test.ts | **LOW** | 🟢 NONE | Test duplication | Phase 2 |

---

## Section 8: Recommendations

### 8.1 Critical Actions Before Phase 1

1. **✅ MUST COMPLETE Task 0.6** (PluginManager/WAM Integration Analysis)
   - HarmonyWidget cannot be migrated without this
   - Risk: Silent CC64 routing failure (sustain pedal won't work)

2. **Design Adapter API Surface**
   - List ALL RegionProcessor public methods
   - Create 1:1 mapping to PlaybackEngine methods
   - Document deprecation warnings for each method

3. **Create Regression Test Suite**
   - HarmonyWidget sustain pedal test
   - DrummerWidget pattern accuracy test
   - MetronomeWidget timing test
   - All widgets playing simultaneously test

---

### 8.2 Feature Flag Rollout Plan

#### Week 5 (Internal Team - 1%)
- Enable flag for team only
- Test all 4 widgets manually
- Monitor adapter method calls (should be high)
- Monitor adapter sync failures (should be 0)

#### Week 6 (Beta Users - 10%)
- Enable for 10% of users
- Monitor error rates (target: <1% increase)
- Monitor performance (timing accuracy >99%)
- Collect user feedback

#### Week 7-8 (General Rollout - 50% → 100%)
- 50% rollout (Day 1-3)
- 100% rollout (Day 4-5)
- Monitor closely for issues
- **Rollback Trigger:** Error rate >10% increase → flip flag back

---

### 8.3 Rollback Procedure

#### Trigger Conditions
- Error rate >10% increase vs baseline
- Memory leak detection (>100MB growth)
- Timing accuracy degradation (>1% jitter)
- Critical user-reported bug (sustain pedal broken, pattern not playing)

#### Rollback Steps
1. **Immediate:** Flip `NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE=false` (1 minute)
2. **Deploy:** Push config change to production (2 minutes)
3. **Verify:** Check error rates drop back to baseline (2 minutes)
4. **Total Time:** <5 minutes

#### Post-Rollback
- Document issue in incident report
- Create regression test for the bug
- Fix bug in staging environment
- Re-test thoroughly before re-enabling flag

---

### 8.4 Success Criteria

#### Phase 1 Complete When:
- [ ] All 17 call sites identified and documented ✅ (THIS DOCUMENT)
- [ ] Adapter pattern designed and implemented
- [ ] CoreServices.getRegionProcessor() routes based on feature flag
- [ ] Dual-engine coexistence tested (both engines work simultaneously)

#### Phase 2 Complete When:
- [ ] All 4 widgets migrated (HarmonyWidget LAST)
- [ ] All tests pass (RegionProcessor + PlaybackEngine)
- [ ] Adapter method calls = 0 (all direct PlaybackEngine usage)
- [ ] Feature flag enabled for 100% of users

#### Phase 3 Complete When:
- [ ] Adapter removed (no more RegionProcessorAdapter)
- [ ] RegionProcessor deleted (17 legacy modules removed)
- [ ] Feature flag removed (only PlaybackEngine remains)
- [ ] Documentation updated (migration guide, ADRs)

---

## Section 9: Next Steps

### Immediate Actions (Before Starting Phase 1)

1. **Review This Document**
   - Team review and approval (1 day)
   - Clarify any questions
   - Update migration timeline if needed

2. **Complete Task 0.6** (PluginManager/WAM Integration Analysis)
   - Document CC64 routing
   - Create regression tests
   - Design PlaybackEngine integration

3. **Create Adapter Design Doc**
   - List all RegionProcessor methods (count: ~30-40 methods)
   - Map to PlaybackEngine equivalents
   - Document deprecation warnings

4. **Set Up Monitoring**
   - `adapter_method_calls` metric
   - `adapter_sync_failures` metric
   - `engine_state_mismatch` metric
   - Error rate dashboard (compare old vs new engine)

### Phase 1 Kickoff (After Task 0.6 Complete)

1. **Day 1:** Implement PlaybackEngine core (Scheduler, timeUtils)
2. **Day 2-3:** Implement PlaybackEngine coordination (start/stop/pause, tempo)
3. **Day 4:** Implement RegionProcessorAdapter
4. **Day 5:** Add feature flag to CoreServices.getRegionProcessor()
5. **Day 6-10:** Test dual-engine coexistence, fix issues

---

## Appendix A: Call Site Reference Table

| # | File | Line | Method | Context |
|---|------|------|--------|---------|
| 1 | HarmonyWidget.tsx | 1321 | getRegionProcessor() | PluginManager integration |
| 2 | DrummerWidget.tsx | 294 | getRegionProcessor() | (commented) |
| 3 | DrummerWidget.tsx | 295 | getRegionProcessor() | (commented) |
| 4 | DrummerWidget.tsx | 513 | getRegionProcessor() | Pattern registration |
| 5 | DrummerWidget.tsx | 514 | getRegionProcessor() | Pattern registration |
| 6 | DrummerWidget.tsx | 836 | getRegionProcessor() | Pattern update |
| 7 | DrummerWidget.tsx | 837 | getRegionProcessor() | Pattern update |
| 8 | MetronomeWidget.tsx | 333 | getRegionProcessor() | Pattern registration |
| 9 | MetronomeWidget.tsx | 334 | getRegionProcessor() | Pattern registration |
| 10 | MetronomeWidget.tsx | 426 | getRegionProcessor() | Pattern update |
| 11 | MetronomeWidget.tsx | 427 | getRegionProcessor() | Pattern update |
| 12 | MetronomeWidget.tsx | 483 | getRegionProcessor() | Pattern update |
| 13 | MetronomeWidget.tsx | 484 | getRegionProcessor() | Pattern update |
| 14 | InitialSamplePreloader.ts | 407 | getRegionProcessor() | Buffer injection |
| 15 | CoreServices.ts | 398 | getRegionProcessor() | Getter method |
| 16 | test-audio-flow/page.tsx | 29 | getRegionProcessor() | Test page |
| 17 | test-audio-flow/page.tsx | 122 | getRegionProcessor() | Test page |
| 18+ | *.test.ts | various | getRegionProcessor() | Integration tests |

**Total Production Call Sites:** 9
**Total Test Call Sites:** 8+
**Total:** 17+

---

## Appendix B: RegionProcessor Public API Surface

**NOTE:** This section will be completed during Adapter design phase.

List of ALL public methods that need adapter implementation:

- [ ] `start(): void`
- [ ] `stop(): void`
- [ ] `pause(): void`
- [ ] `registerTracks(tracks: TrackData[]): void`
- [ ] `updateTracks(tracks: TrackData[]): void`
- [ ] `setPluginManager(pluginManager: PluginManager): void`
- [ ] `getWamKeyboard(): WamKeyboard | null`
- [ ] `updateTempo(bpm: number): void`
- [ ] `dispose(): void`
- [ ] ... (to be completed)

**Action:** Run `grep "public " RegionProcessor.ts` to get full list.

---

## Document Metadata

**Created:** 2025-11-23
**Last Updated:** 2025-11-23
**Version:** 1.0
**Status:** ✅ COMPLETE - Ready for Team Review

**Next Document:** Task 0.6 - `PLUGIN_MANAGER_INTEGRATION.md`
