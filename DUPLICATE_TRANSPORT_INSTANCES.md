# Duplicate Transport/Clock Instances - Fighting Clocks Analysis

## EXECUTIVE SUMMARY

**Potential "Fighting Clocks" Issues Found:**

- Multiple position update intervals can coexist if Transport.start() is called multiple times
- Multiple useTransport() hooks subscribe independently to transport events
- Clock instances are created per Transport instance, not shared globally
- Position update callbacks can accumulate if cleanup is incomplete
- No global singleton enforcement at Transport/Clock level

---

## CRITICAL FINDINGS

### 1. **Position Update Interval - Potential Race Condition**

**File**: `/apps/frontend/src/domains/playback/modules/transport/core/Transport.ts` (lines 508-599)

**Issue**:

```typescript
// Line 517-535
private startPositionUpdates(): void {
  if (this.positionUpdateInterval !== null) {
    console.warn('🔄 [POSITION DEBUG] Interval already exists, early return!');
    return;  // ✅ GOOD - prevents duplicate intervals
  }

  this.positionUpdateInterval = window.setInterval(update, scheduleIntervalMs);
}

// Line 589-599
private stopPositionUpdates(): void {
  if (this.positionUpdateInterval !== null) {
    window.clearInterval(this.positionUpdateInterval);
    this.positionUpdateInterval = null;  // ✅ GOOD - explicit cleanup
  }
}
```

**Analysis**:

- ✅ Transport has guards against duplicate intervals within same instance
- ❌ Problem: If multiple Transport instances exist, each has its own interval
- ❌ Interval fires at fixed `scheduleInterval` - can drift relative to system clock
- ⚠️ If start() is called twice on same Transport without stop(), the second call returns early (line 133-140)

---

### 2. **Transport Instantiation - Singleton Pattern Issues**

**File**: `/apps/frontend/src/domains/playback/modules/transport/core/TransportController.ts` (lines 95-116)

**Issue**:

```typescript
// TransportController - implements singleton
static getInstance(eventBus, audioEngine, config): TransportController {
  if (!TransportController.instance) {
    TransportController.instance = new TransportController(eventBus, audioEngine, config);
  }
  return TransportController.instance;  // ✅ GOOD - singleton enforced
}

// But inside TransportController constructor (line 77):
this.transport = new Transport(config);  // ⚠️ Creates fresh Transport each time!
```

**Analysis**:

- ✅ TransportController is singleton
- ⚠️ Transport instance is created FRESH each time (not singleton)
- If TransportController.getInstance() is called multiple times, Transport is reused
- But if Transport is instantiated directly elsewhere, duplicates are possible

---

### 3. **Clock Instance - Created Per Transport**

**File**: `/apps/frontend/src/domains/playback/modules/transport/core/Transport.ts` (lines 68-72)

```typescript
constructor(config: Partial<TransportConfig> = {}) {
  // Create components
  this.clock = new Clock({
    useAudioWorklet: this.config.enableAudioWorklet,
    driftCompensation: this.config.driftCompensation,
  });
  this.timeline = new Timeline();
}
```

**Issue**:

- Each Transport gets its own Clock instance
- Clock maintains its own internal state and timing
- Multiple clocks can run simultaneously, each with slightly different drift compensation

---

### 4. **useTransport Hook - Independent Subscriptions**

**File**: `/apps/frontend/src/domains/playback/hooks/useTransport.ts` (lines 215-288)

```typescript
useEffect(() => {
  if (!eventBusRef.current) return;

  // Each useTransport hook subscribes INDEPENDENTLY to transport events
  const unsubscribeStart = eventBus.on('transport:start', handleStart);
  const unsubscribeStop = eventBus.on('transport:stop', handleStop);
  const unsubscribePause = eventBus.on('transport:pause', handlePause);
  const unsubscribePosition = eventBus.on(
    'transport:position-updated',
    handlePositionUpdate,
  );
  // ... more subscriptions ...

  return () => {
    // Each hook unsubscribes on unmount
    unsubscribeStart();
    unsubscribeStop();
    // ... more unsubscribes ...
  };
}, [servicesReady, ...handlers]);
```

**Analysis**:

- ✅ EventBus correctly supports multiple subscribers
- ⚠️ However, each useTransport() hook maintains own state (position, tempo, timeSignature)
- ❌ Multiple widgets calling useTransport() will each independently process updates
- ⚠️ Position throttling (line 192-197) is PER-HOOK, not global

**Throttle Pattern (line 190-209)**:

```typescript
const handlePositionUpdate = useCallback(
  (data: { position: TransportPosition }) => {
    const now = Date.now();
    if (now - lastPositionUpdateRef.current < 33) {
      // 30fps max
      return; // ⚠️ Throttle is PER-HOOK instance!
    }
    lastPositionUpdateRef.current = now;
    setPosition(data.position);
  },
  [],
);
```

---

### 5. **Position Update Event Flow - Multiple Sources**

**File**: `/apps/frontend/src/domains/playback/modules/transport/core/TransportController.ts` (lines 656-693)

```typescript
private setupEventListeners(): void {
  // Listen to transport position updates
  this.transport.onPositionUpdate((seconds) => {
    if (this.state !== 'playing') {
      // ⚠️ Race condition: Stale callbacks fire when state is 'stopped'
      return;
    }

    this.positionManager.updatePosition(seconds);

    // Emit display position
    const displayPosition = this.positionManager.getDisplayPosition();
    this.eventBus.emit('transport:position-updated', {
      position: displayPosition,
      seconds,
      timestamp: performance.now(),
    });
  });
}
```

**Issues**:

- Transport position updates at ~25ms intervals (line 574 in Transport.ts)
- TransportController re-emits as EventBus 'transport:position-updated'
- Each useTransport() hook processes independently with own throttle
- No global position coalescing/batching

---

### 6. **Multiple EventBus Instances - Unlikely but Possible**

**File**: `/apps/frontend/src/domains/playback/services/core/CoreServices.ts` (lines 73, 88)

```typescript
// Line 73 - Each CoreServices instance creates new EventBus
this.eventBus = new EventBus();

// Line 88 - TransportSyncManager gets singleton
this.transportSyncManager = TransportSyncManager.getInstance();
```

**Analysis**:

- CoreServices creates fresh EventBus each time
- ✅ CoreServices itself is managed as singleton by AudioProvider
- But if multiple CoreServices instances created, multiple EventBus instances exist
- This would create parallel event streams

---

### 7. **Widget Component - Multiple useTransport Calls**

**File**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage.tsx`

**Potential Issue**:

```typescript
function YouTubeWidgetPageContent(...) {
  const widgetState = useWidgetPageState();
  const { emitGlobalEvent, syncState } = useSyncContext();
  // ... later in component tree ...
}

// Child components like BassLineWidget, DrummerWidget, etc. also call useTransport():
// - apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/BassLineWidget.tsx
// - apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget.tsx
// - apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx
```

**Analysis**:

- TransportClock component (line 4): `const transport = useTransport()`
- Each child widget also calls useTransport()
- Results in **N+1 independent subscriptions** to transport events
- Each maintains own position throttle, own state

---

### 8. **EventScheduler - Separate Position Update Loop**

**File**: `/apps/frontend/src/domains/playback/modules/transport/scheduling/EventScheduler.ts` (lines 76-85)

```typescript
start(): void {
  this.scheduleTimer = window.setInterval(
    () => this.scheduleEvents(),
    this.config.scheduleInterval,  // 25ms
  );

  this.cleanupTimer = window.setInterval(
    () => this.cleanupExpiredEvents(),
    this.config.cleanupInterval,
  );
}
```

**Issue**:

- EventScheduler runs its own setInterval loop
- Separate from Transport's position update loop
- Both running at different frequencies can cause jitter

---

## ROOT CAUSE: "Fighting Clocks" Mechanisms

### Race Condition Chain:

```
1. Transport.start() called
   ↓
2. startPositionUpdates() creates interval (every 25ms)
   ↓
3. Position callback fired → TransportController → EventBus emit
   ↓
4. useTransport() hook receives 'transport:position-updated'
   ↓
5. Each useTransport() instance processes independently:
   - Own throttle logic
   - Own state update
   - Own re-render

6. Parallel Clock.getAudioTime() calls may return slightly different values
   ↓
7. Multiple position displays showing conflicting times
```

### Multiple Sources of Truth for Position:

1. **Transport.timeline** - Internal musical position
2. **Clock** - AudioContext-based timing
3. **TransportController.positionManager** - Countdown-adjusted display position
4. **Tone.Transport.seconds** - Tone.js internal time
5. **Multiple useTransport() hooks** - Cached local state

Each can drift independently!

---

## EVIDENCE OF FIGHTING CLOCKS

### Console Debug Logs Show:

```typescript
// In Transport.ts line 524, 528, 551, 582:
console.log('🔄 [POSITION DEBUG] startPositionUpdates() called');
console.log('🔄 [POSITION DEBUG] Position update calculation');
console.log('🔄 [POSITION DEBUG] Position update interval CREATED');

// In TransportController.ts line 680:
console.log('🎯 [COUNTDOWN DEBUG] Position transformation', {
  rawSeconds,
  rawPosition,
  displayPosition,
  countdownBeats,
});

// In useTransport.ts - multiple event subscriptions:
logger.debug('useTransport: EventBus instance ID:', ebusId);
logger.debug(
  'useTransport: Received transport:position-updated event:',
  position,
);
```

These logs show position updates flowing through multiple independent channels.

---

## SPECIFIC FILE LOCATIONS WITH ISSUES

| File                   | Line             | Issue                                             | Severity |
| ---------------------- | ---------------- | ------------------------------------------------- | -------- |
| Transport.ts           | 508-599          | Position interval management (OK within instance) | MEDIUM   |
| TransportController.ts | 77, 656-693      | Fresh Transport + custom position callback        | MEDIUM   |
| useTransport.ts        | 190-209, 215-288 | Independent subscriptions + per-hook throttle     | HIGH     |
| TransportClock.tsx     | 82-150           | Multiple instances with own intervals             | HIGH     |
| Transport.ts           | 170-175          | startPositionUpdates() called during start()      | MEDIUM   |
| EventScheduler.ts      | 76-85            | Separate interval loop from position updates      | MEDIUM   |
| TimingWorker.ts        | 296              | Web Worker also maintains setInterval             | HIGH     |
| CoreServices.ts        | 73               | Fresh EventBus per instance                       | MEDIUM   |

---

## FIGHTING CLOCKS SYMPTOMS

### Classic Symptom Pattern:

```
Time 0:00:00 → 0:00:05 → 0:00:10 → 0:00:03 → 0:00:12 → 0:00:08
                        ↑ JUMP BACK    ↑ JUMP FWD   ↑ JUMP BACK
```

### Root Causes:

1. Multiple position sources updating at different rates
2. Throttling at different granularities
3. Countdown offset applied multiple times
4. EventBus emissions batched differently per subscriber

---

## RECOMMENDATIONS

### IMMEDIATE FIXES:

1. **Add global position state** - Single source of truth in TransportController
2. **Batch EventBus emissions** - Emit position once per interval, not per Transport update
3. **Enforce single useTransport subscription** - Use context or shared ref, not multiple hooks
4. **Add position validation** - Detect and reject out-of-order position updates

### ARCHITECTURAL CHANGES:

1. **Singleton Clock** - Not per Transport, but globally shared
2. **Centralize throttling** - In TransportController, not in useTransport hooks
3. **Remove parallel timing** - One position update loop, not EventScheduler + Transport
4. **Add drift detection** - Warn when multiple position sources disagree
