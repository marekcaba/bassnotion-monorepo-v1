# Fighting Clocks - Quick Reference Guide

## Files with Issues (Ranked by Severity)

### CRITICAL (HIGH SEVERITY)

#### 1. useTransport.ts - Per-Hook Throttling

**Path**: `/apps/frontend/src/domains/playback/hooks/useTransport.ts`
**Lines**: 190-209, 215-288
**Issue**: Each useTransport() call has independent throttle + subscription

```
Multiple widgets (TransportClock, BassLineWidget, DrummerWidget, HarmonyWidget)
→ Each calls useTransport()
→ Each has own lastPositionUpdateRef
→ Each throttles position updates independently
→ Different widgets see different positions at different times
= FIGHTING CLOCKS
```

#### 2. TransportClock.tsx - Multiple Component Instances

**Path**: `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/TransportClock.tsx`
**Lines**: 82-150, 36
**Issue**: Component tracks instances with global counter

```
Every mount increments globalInstanceCount
No proper decrement on unmount
Multiple TransportClock instances = multiple useTransport() calls
```

#### 3. TimingWorker.ts - Parallel Web Worker Loop

**Path**: `/apps/frontend/src/domains/playback/modules/transport/workers/TimingWorker.ts`
**Line**: 296
**Issue**: Web Worker maintains separate setInterval

```
Main thread: Transport.startPositionUpdates() [25ms interval]
Web Worker: TimingWorker.setInterval() [TIMING_UPDATE_INTERVAL]
Both firing asynchronously = stuttering/jitter
```

---

### MEDIUM (MEDIUM SEVERITY)

#### 4. Transport.ts - Position Update Interval

**Path**: `/apps/frontend/src/domains/playback/modules/transport/core/Transport.ts`
**Lines**: 508-599, 517, 572-574
**Issue**: Fixed 25ms interval can drift

```
- Independent from AudioContext.currentTime
- No adaptive adjustment to system clock
- Can accumulate timing error over time
```

#### 5. TransportController.ts - Position Callback Chain

**Path**: `/apps/frontend/src/domains/playback/modules/transport/core/TransportController.ts`
**Lines**: 656-693, 672, 688-692
**Issue**: Multiple transformation layers

```
Transport.startPositionUpdates()
  → onPositionUpdate callback
  → positionManager.updatePosition()
  → positionManager.getDisplayPosition()
  → eventBus.emit()
  → N × useTransport() hooks
Each layer introduces potential delay variation
```

#### 6. Transport.ts - Clock Per Instance

**Path**: `/apps/frontend/src/domains/playback/modules/transport/core/Transport.ts`
**Lines**: 68-72
**Issue**: No clock singleton

```
Each Transport creates: new Clock(...)
Each Clock.getAudioTime() slightly different
No unified timing source
```

#### 7. EventScheduler.ts - Parallel Timer Loops

**Path**: `/apps/frontend/src/domains/playback/modules/transport/scheduling/EventScheduler.ts`
**Lines**: 76-85
**Issue**: Two setInterval loops

```
scheduleTimer: window.setInterval() [scheduleInterval]
cleanupTimer: window.setInterval() [cleanupInterval]
Both independent from Transport position updates
```

#### 8. CoreServices.ts - EventBus Per Instance

**Path**: `/apps/frontend/src/domains/playback/services/core/CoreServices.ts`
**Lines**: 73
**Issue**: Fresh EventBus each time

```
If multiple CoreServices created → multiple EventBus instances
Subscribers on one bus won't see events from another
Parallel event streams
```

---

## Root Cause Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  FIGHTING CLOCKS ROOT CAUSE CHAIN                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Transport.startPositionUpdates() [Line 517]               │
│         ↓                                                    │
│  window.setInterval(..., 25ms) [Line 572]                  │
│         ↓                                                    │
│  Position callback fires [Line 563]                        │
│         ↓                                                    │
│  TransportController callback [Line 656]                   │
│         ↓                                                    │
│  eventBus.emit('transport:position-updated') [Line 688]    │
│         ↓                                                    │
│  Multiple useTransport() hooks receive event               │
│  ├─→ TransportClock.tsx [Line 36] - throttle A            │
│  ├─→ BassLineWidget.tsx - throttle B                       │
│  ├─→ DrummerWidget.tsx - throttle C                        │
│  ├─→ HarmonyWidget.tsx - throttle D                        │
│  └─→ GlobalControls.tsx - throttle E                       │
│         ↓                                                    │
│  Different components update at different times            │
│         ↓                                                    │
│  UI shows conflicting positions = "FIGHTING CLOCKS"        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Detection Checklist

Watch for these signs of fighting clocks:

- [ ] Console shows multiple `[POSITION DEBUG]` logs per update
- [ ] Position jumps forward/backward erratically
- [ ] Clock displays show different times in different widgets
- [ ] "Maximum update depth exceeded" warnings appear
- [ ] useTransport() hook throttle debug logs at different rates
- [ ] TransportClock instance count > 1
- [ ] Multiple `window.setInterval` IDs in debugger

---

## Quick Fix Priority

1. **URGENT**: Consolidate useTransport() subscriptions
   - Remove per-hook throttling
   - Use single global throttle in TransportController
2. **HIGH**: Enforce Transport singleton
   - Ensure only one Transport instance exists
   - Verify TransportController.getInstance() used everywhere
3. **HIGH**: Kill Web Worker timing loop
   - Remove TimingWorker setInterval
   - Use single Transport position updates
4. **MEDIUM**: Consolidate Clock instances
   - Make Clock singleton if possible
   - Or centralize timing source
5. **MEDIUM**: Simplify event chain
   - Remove intermediate transformation layers
   - Emit final display position directly

---

## Console Debug Commands

```javascript
// Check for multiple Transport instances
window.__debug?.transportInstances?.length;

// Check for multiple EventBus instances
window.__debug?.eventBusInstances?.length;

// Monitor position update frequency
let posUpdateCount = 0;
window.addEventListener('transport-position-updated', () => posUpdateCount++);
setInterval(() => {
  console.log('Position updates/sec:', posUpdateCount);
  posUpdateCount = 0;
}, 1000);

// Detect clock jumps
let lastPos = 0;
window.addEventListener('transport-position-updated', (e) => {
  const newPos = e.detail?.position?.bars || 0;
  if (newPos < lastPos)
    console.warn('CLOCK JUMPED BACK:', lastPos, '→', newPos);
  lastPos = newPos;
});
```

---

## Files To Monitor During Fix

1. `/apps/frontend/src/domains/playback/modules/transport/core/Transport.ts`
   - startPositionUpdates() method
   - startPositionUpdates() method

2. `/apps/frontend/src/domains/playback/hooks/useTransport.ts`
   - useEffect subscriptions
   - handlePositionUpdate callback

3. `/apps/frontend/src/domains/playback/modules/transport/core/TransportController.ts`
   - setupEventListeners() method
   - Position emit logic

4. `/apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/TransportClock.tsx`
   - useTransport() call
   - Instance tracking

5. `/apps/frontend/src/domains/playback/modules/transport/workers/TimingWorker.ts`
   - Web Worker setInterval

---

## Test Case: Confirm Fighting Clocks Fixed

```typescript
// Test: All widgets show same position
test('All widgets receive synchronized position updates', async () => {
  const positions = {
    transportClock: null,
    bassWidget: null,
    drumWidget: null,
    harmonyWidget: null,
  };

  // Subscribe to position changes
  eventBus.on('transport:position-updated', (data) => {
    // All hooks should see SAME position
    positions.transportClock = data.position;
    positions.bassWidget = data.position;
    positions.drumWidget = data.position;
    positions.harmonyWidget = data.position;
  });

  await transport.start();
  await sleep(100);

  // All should be identical
  expect(positions.transportClock).toEqual(positions.bassWidget);
  expect(positions.bassWidget).toEqual(positions.drumWidget);
  expect(positions.drumWidget).toEqual(positions.harmonyWidget);
});
```

---

## References

- Main Analysis: `FIGHTING_CLOCKS_ANALYSIS.md`
- Detailed Report: `DUPLICATE_TRANSPORT_INSTANCES.md`
- Transport Code: `/apps/frontend/src/domains/playback/modules/transport/core/Transport.ts`
- Hook Code: `/apps/frontend/src/domains/playback/hooks/useTransport.ts`
