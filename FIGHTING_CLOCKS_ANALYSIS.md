# Fighting Clocks - Duplicate Transport/Clock Instances Detection Report

## SEARCH RESULTS SUMMARY

### Found 6 Major Issues Causing "Fighting Clocks" Behavior

---

## 1. MULTIPLE POSITION UPDATE INTERVALS

### Location: `/apps/frontend/src/domains/playback/modules/transport/core/Transport.ts`

**Lines 508-599**: Private position update loop management

```typescript
// ISSUE: Position updates at fixed 25ms intervals
// Lines 572-574:
this.positionUpdateInterval = window.setInterval(
  update,
  this.config.scheduleInterval * 1000, // 25ms default
);
```

**Problem**:

- Position interval fires independently from system timing
- Can drift relative to AudioContext.currentTime
- Creates timing jitter when multiple callbacks fire

**Specific Lines**:

- Line 517: `startPositionUpdates()` - creates interval
- Line 527: Guard check (prevents duplicate within same Transport)
- Line 572-574: `window.setInterval()` - creates separate timing loop
- Line 589-592: `stopPositionUpdates()` - cleanup logic

---

## 2. INDEPENDENT EVENBUS SUBSCRIPTIONS

### Location: `/apps/frontend/src/domains/playback/hooks/useTransport.ts`

**Lines 215-288**: Each useTransport() hook subscribes independently

```typescript
// PROBLEM: Multiple subscriptions to same events
// Lines 237-256:
const unsubscribeStart = eventBus.on('transport:start', handleStart);
const unsubscribeStop = eventBus.on('transport:stop', handleStop);
const unsubscribePause = eventBus.on('transport:pause', handlePause);
const unsubscribeResume = eventBus.on('transport:resume', handleResume);
const unsubscribeTempo = eventBus.on(
  'transport:tempo-change',
  handleTempoChange,
);
const unsubscribeTimeSignature = eventBus.on(
  'transport:time-signature-change',
  handleTimeSignatureChange,
);
const unsubscribePosition = eventBus.on(
  'transport:position-updated',
  handlePositionUpdate,
);
const unsubscribeLoop = eventBus.on('transport:loop-change', handleLoopToggle);
```

**Fighting Clock Cause**:

- Lines 190-209: Each hook has own throttle logic
- Line 194: `if (now - lastPositionUpdateRef.current < 33)` - throttle PER-HOOK
- Different widgets receive position at different times
- Results in desynchronized UI updates

**Widget Usage**:

- TransportClock.tsx line 4: `const transport = useTransport()`
- BassLineWidget.tsx: Likely calls useTransport()
- DrummerWidget.tsx: Likely calls useTransport()
- HarmonyWidget.tsx: Likely calls useTransport()
- GlobalControls.tsx: Likely calls useTransport()

**Result**: N+1 independent subscriptions = N+1 different throttle points!

---

## 3. TRANSPORT INSTANCES - PER-TRANSPORT CLOCK

### Location: `/apps/frontend/src/domains/playback/modules/transport/core/Transport.ts`

**Lines 68-72**: Each Transport creates its own Clock

```typescript
constructor(config: Partial<TransportConfig> = {}) {
  // Create components
  this.clock = new Clock({
    useAudioWorklet: this.config.enableAudioWorklet,
    driftCompensation: this.config.driftCompensation,
  });
  this.timeline = new Timeline();
  this.scheduler = new Scheduler({...});
}
```

**Problem**:

- No clock singleton
- Each Transport instance has separate Clock
- Clock.getAudioTime() calls return slightly different values due to measurement jitter
- Multiple clocks can drift independently

---

## 4. POSITION UPDATE CALLBACK CHAINING

### Location: `/apps/frontend/src/domains/playback/modules/transport/core/TransportController.ts`

**Lines 656-693**: TransportController re-emits position updates

```typescript
private setupEventListeners(): void {
  // Listen to transport position updates
  this.transport.onPositionUpdate((seconds) => {
    // Line 659-665: State check race condition
    if (this.state !== 'playing') {
      return;  // ⚠️ Stale callback fires AFTER state changes
    }

    // Line 672: Update position manager
    this.positionManager.updatePosition(seconds);

    // Line 688-692: Re-emit to EventBus
    const displayPosition = this.positionManager.getDisplayPosition();
    this.eventBus.emit('transport:position-updated', {
      position: displayPosition,
      seconds,
      timestamp: performance.now(),
    });
  });
}
```

**Chain**: Transport interval → onPositionUpdate callback → EventBus emit → N×useTransport() hooks

**Problem**: Multiple transformation layers, each with potential timing differences

---

## 5. EVENBUS PER CORESERVICES INSTANCE

### Location: `/apps/frontend/src/domains/playback/services/core/CoreServices.ts`

**Lines 73, 88**: CoreServices creates fresh EventBus

```typescript
constructor(config: CoreServicesConfig = {}) {
  // Line 73: Fresh EventBus per CoreServices
  this.eventBus = new EventBus();

  // Line 74: AudioEngine created fresh
  this.audioEngine = new AudioEngine(this.eventBus, {...});

  // Line 78-87: Transport adapter created fresh
  this.unifiedTransport = TransportAdapter.getInstance(
    this.eventBus,
    this.audioEngine,
    {...},
  );

  // Line 88: TransportSyncManager gets singleton
  this.transportSyncManager = TransportSyncManager.getInstance();
}
```

**Problem**:

- If multiple CoreServices instances exist, multiple EventBus instances
- Each EventBus has separate subscriber lists
- Events don't propagate across instances

---

## 6. PARALLEL TIMING LOOPS

### Location: `/apps/frontend/src/domains/playback/modules/transport/scheduling/EventScheduler.ts`

**Lines 76-85**: EventScheduler maintains separate timing loop

```typescript
start(): void {
  // Schedule events at 25ms intervals
  this.scheduleTimer = window.setInterval(
    () => this.scheduleEvents(),
    this.config.scheduleInterval,  // 25ms
  );

  // Cleanup at different interval
  this.cleanupTimer = window.setInterval(
    () => this.cleanupExpiredEvents(),
    this.config.cleanupInterval,
  );
}
```

**Problem**:

- Two separate setInterval loops in EventScheduler
- Transport also runs setInterval (position updates)
- Three independent timing sources (Clock, EventScheduler, Transport intervals)
- Clock.startSync() at line 104 in Transport.ts adds fourth timing source
- Each can drift independently

---

## 7. TRANSPORTING CLOCK COMPONENT - MULTIPLE INSTANCES

### Location: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/TransportClock.tsx`

**Lines 82-150**: Multiple TransportClock instances can coexist

```typescript
let globalAudioContextInterval: NodeJS.Timeout | null = null;
let globalInstanceCount = 0;

export function TransportClock({...}: TransportClockProps) {
  const { correlationId, logger } = useCorrelation('TransportClock');

  // Line 82-90: Instance tracking
  useEffect(() => {
    const instanceId = Math.random().toString(36).substr(2, 9);
    globalInstanceCount++;
    const currentInstanceCount = globalInstanceCount;

    logger.info(`Instance ${currentInstanceCount} mounting - total: ${globalInstanceCount}`);
  });
}
```

**Problem**:

- Component can mount multiple times
- Each instance has global state tracking
- Instance count increments but never decrements properly
- Multiple TransportClock instances = multiple useTransport() subscriptions

---

## 8. TIMING WORKER - WEB WORKER SETINTERVAL

### Location: `/apps/frontend/src/domains/playback/modules/transport/workers/TimingWorker.ts`

**Line 296**: Web Worker maintains separate setInterval

```typescript
// Line 296: Fallback updates with interval
this.intervalId = self.setInterval(() => {
  if (this.isPlaying && !this.isPaused) {
    this.sendTimingUpdate();
  }
}, TIMING_UPDATE_INTERVAL);
```

**Problem**:

- Web Worker runs independent timing loop
- Separate from main thread Transport.startPositionUpdates()
- Can cause stuttering when both fire asynchronously

---

## SMOKING GUN: THE FIGHTING CLOCKS CYCLE

### Call Stack Showing Multiple Sources:

```
1. Transport.startPositionUpdates() [line 517]
   ↓ every 25ms

2. window.setInterval() [line 572]
   ↓ fires callback

3. this.positionUpdateCallback(relativeTime) [line 563]
   ↓ calls TransportController's callback

4. TransportController.setupEventListeners() [line 656]
   ↓ emits

5. this.eventBus.emit('transport:position-updated') [line 688]
   ↓ broadcasts to all subscribers

6. useTransport() hook [line 249]
   ↓ handlePositionUpdate() called

7. throttle check (per-hook) [line 194]
   ↓ setPosition() if not throttled

8. React re-render
   ↓

9. TransportClock also calls useTransport() [line 36]
   ↓ different throttle point

10. useTransport() in BassLineWidget [if present]
    ↓ another throttle point

11. useTransport() in DrummerWidget [if present]
    ↓ another throttle point

... N MORE SUBSCRIPTIONS ...

RESULT: Position updates arrive at different times
→ UI components show different positions
→ "Fighting clocks" effect
```

---

## EXACT DUPLICATE INSTANCES POSSIBLE

### Scenario: Transport.start() called twice

```typescript
// File: Transport.ts line 120-185
async start(): Promise<void> {
  // Line 133-140: Guard for duplicate start
  if (this.state === 'playing') {
    logger.warn('Transport already playing, early return!');
    return;  // ✅ PREVENTS second start()
  }

  // So Transport prevents duplicate start...
  // BUT what if start() is called on TWO DIFFERENT Transport instances?
  // That's not prevented!
}
```

### Possible Multiple Instances:

```typescript
// Scenario 1: Direct Transport instantiation
const transport1 = new Transport(); // Instance 1
transport1.start(); // Interval 1 created

const transport2 = new Transport(); // Instance 2
transport2.start(); // Interval 2 created

// Now TWO position update intervals running!

// Scenario 2: Multiple CoreServices
const cs1 = new CoreServices(); // EventBus 1, Transport 1
const cs2 = new CoreServices(); // EventBus 2, Transport 2

// Different event streams!
```

---

## DETECTION EVIDENCE IN CONSOLE LOGS

These console.log statements show the fighting clocks:

```typescript
// Transport.ts line 524
console.log('🔄 [POSITION DEBUG] startPositionUpdates() called', debugInfo);

// Transport.ts line 528
console.log('🔄 [POSITION DEBUG] Interval already exists, early return!');

// Transport.ts line 551
console.log('🔄 [POSITION DEBUG] Position update calculation', {
  currentTime,
  transportStartTime,
  relativeTime,
});

// Transport.ts line 582
console.log(
  '🔄 [POSITION DEBUG] Position update interval CREATED',
  createdInfo,
);

// TransportController.ts line 680
console.log('🎯 [COUNTDOWN DEBUG] Position transformation', {
  rawSeconds,
  rawPosition,
  displayPosition,
  countdownBeats,
});
```

When you see multiple [POSITION DEBUG] and [COUNTDOWN DEBUG] logs from different sources, that's the fighting clocks!

---

## SUMMARY TABLE

| #   | Issue                   | File                   | Lines   | Type           | Severity |
| --- | ----------------------- | ---------------------- | ------- | -------------- | -------- |
| 1   | Position interval drift | Transport.ts           | 508-599 | Timer leak     | MEDIUM   |
| 2   | Per-hook throttling     | useTransport.ts        | 190-209 | Design flaw    | HIGH     |
| 3   | Multiple EventBus subs  | useTransport.ts        | 215-288 | Design flaw    | HIGH     |
| 4   | Clock not singleton     | Transport.ts           | 68-72   | Architecture   | MEDIUM   |
| 5   | Position callback chain | TransportController.ts | 656-693 | Race condition | MEDIUM   |
| 6   | EventBus per instance   | CoreServices.ts        | 73      | Architecture   | MEDIUM   |
| 7   | Parallel timing loops   | EventScheduler.ts      | 76-85   | Timer leak     | MEDIUM   |
| 8   | Multiple TransportClock | TransportClock.tsx     | 82-150  | Component leak | HIGH     |
| 9   | Web Worker interval     | TimingWorker.ts        | 296     | Timer leak     | HIGH     |

---

## NEXT STEPS

1. Check for console.log output showing multiple position sources
2. Add position validation to detect jumps/reversals
3. Consolidate to single position update source
4. Enforce singleton pattern on Transport and Clock
5. Centralize EventBus throttling
