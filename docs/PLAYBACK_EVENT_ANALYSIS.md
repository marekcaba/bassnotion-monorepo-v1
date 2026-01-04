# Playback Event Propagation Analysis

**Date**: 2025-12-28
**Source**: /docs/console.md event logs
**Status**: Event flow is WORKING but fretboard/widgets NOT subscribing

## Timeline of Events

### Phase 1: Play Button Clicked (Line 4558)
```
4558: YouTubeWidgetPage.tsx:644 🎵 [YOUTUBE-WIDGET] handlePlayStateChange called: {isPlaying: true}
4559: YouTubeWidgetPage.tsx:653 🎵 [YOUTUBE-WIDGET] Called widgetState.togglePlayback() to set isPlaying=true
4560: Called onPlayStateChange(true) - widget state should update
4561: Called onPlayStateChange(true) - widget state should update
```

**Key Finding**: The widget state is updated immediately via `togglePlayback()`, setting `isPlaying=true` synchronously.

### Phase 2: Transport Starts (Line 4556-4562)
```
4556: [global-controls] 📝 🎵 [FLOW] transport.start() returned successfully
4557: GlobalControls.tsx:1535 🎵 [FLOW] transport.start() returned successfully {timestamp: 1766929695445}
4558: handlePlayStateChange called: {isPlaying: true}
4559: Called widgetState.togglePlayback() to set isPlaying=true
4560: Called onPlayStateChange(true) - widget state should update
4561: Called onPlayStateChange(true) - widget state should update
4562: ✅ Transport started successfully
```

**Key Finding**: `transport.start()` completes BEFORE `onPlayStateChange(true)` is called.

### Phase 3: PLAYBACK_STATE_SET Event Fires (Line 3496)
```
3495: [PlaybackEngine] 📝 State transition: ready → playing {instanceId: 'v1kn5muqq', forced: false}
3496: [LIFECYCLE] [PLAYBACK] PLAYBACK_STATE_SET +10437.7ms {state: 'playing', isRunning: true, emittedStartingEvent: true}
3497: [PLAYBACK-ENGINE START] 🔍 PHASE 3: About to schedule all regions {scheduledEventsSize: 0, scheduledIdsSize: 0, tracksCount: 5, shouldBothBeZero: false}
```

**Critical Observation**: `emittedStartingEvent: true` - The event WAS generated and emitted.

### Phase 4: Event Subscriptions Established (INITIAL)
```
1763: AudioEventRouter subscribed to EventBus trigger events {metronomeHandler: true, drumHandler: true, eventBusConnected: true, handlersCount: 8}
1848: useTransportPosition.ts:76 [useTransportPosition] Connected to EventBus, subscribing to position updates
1865: [transport] 🎵 [TransportContext] Setting up single EventBus subscription
1866: [transport] 🎵 [TransportContext] EventBus subscriptions established (8 total)
```

**Key Finding**: Only these components subscribe to EventBus:
- AudioEventRouter (for trigger events)
- useTransportPosition (for position updates)
- TransportContext (8 subscriptions total)

### Phase 5: Widget Subscribers FOUND (Line 4569, 4680)
```
3012: [bassline-widget] 📝 ✅ Bass widget subscribed to trigger events
4569: [bassline-widget] 📝 ✅ Bass widget subscribed to trigger events
4680: [bassline-widget] 📝 ✅ Bass widget subscribed to trigger events
```

**Key Finding**: Bass widget subscribes to trigger events.

### Phase 6: CRITICAL GAP - No Fretboard Subscription Logs
```
NO LOGS for:
- FretboardCard subscribing to any events
- useFretboardExercise listening to playback
- Fretboard position updates
- Fretboard isPlaying changes from EventBus
```

## Timeline Comparison: When Things Happen

| Event | Line | Timestamp | Component |
|-------|------|-----------|-----------|
| Play button click | 4558 | N/A | YouTubeWidgetPage |
| `widgetState.togglePlayback(true)` | 4559 | N/A | YouTubeWidgetPage |
| `transport.start()` returns | 4557 | ~10437ms | GlobalControls |
| `PLAYBACK_STATE_SET` fires | 3496 | +10437.7ms | PlaybackEngine |
| Position updates begin | 4601+ | ~11734ms+ | Transport |

## Critical Finding: MISSING EVENT LISTENER

**Question**: Where is FretboardCard subscribing to the `playback:starting` event?

**Answer from logs**: It doesn't appear to be subscribing at all.

### Evidence of Missing Subscription

1. **No "FretboardCard" or "useFretboardExercise" in subscription logs**
   - Audio widget: "✅ Bass widget subscribed to trigger events"
   - Harmony widget: "Setting up audio service listeners"
   - Metronome widget: Gets BPM changes
   - Fretboard: **NOTHING**

2. **No "playback:starting" event logs**
   - The event is clearly emitted (`emittedStartingEvent: true`)
   - But there's NO log showing any component received it
   - Other events like `position:update` are visible in logs

3. **FretboardCard relies on React prop `isPlaying`**
   - FretboardCard receives `isPlaying` as a prop from YouTubeWidgetPage
   - When `widgetState.togglePlayback()` is called, it updates the state
   - React re-renders FretboardCard with new `isPlaying={true}` prop
   - **But this happens AFTER position initialization**

## The Timing Problem Visualized

```
Timeline (in milliseconds):
0ms        │ Play button clicked
           │
1ms        │ widgetState.togglePlayback(true)  [STATE UPDATE - SYNC]
           │ └─ React queues re-render
           │
2ms        │ transport.start() called
           │ └─ Returns quickly (async scheduling happens later)
           │
10437ms    │ PLAYBACK_STATE_SET event fires
           │ └─ emittedStartingEvent: true
           │ └─ But no logs of FretboardCard receiving this
           │
10438ms    │ SCHEDULE_ALL_REGIONS_START
           │
11734ms    │ Position updates actually begin from Transport
           │
UNKNOWN    │ React re-renders FretboardCard with isPlaying=true
           │ └─ But by this time, position already ~1300ms ahead!
           └─ FRETBOARD MISSES THE ZERO-POSITION INITIALIZATION
```

## Root Cause Analysis

### Problem 1: FretboardCard Not Subscribing to EventBus
- **Location**: `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard.tsx`
- **Issue**: FretboardCard relies ONLY on React props (`isPlaying`)
- **Missing**: EventBus subscription to `playback:starting` event
- **Evidence**: No "FretboardCard" or "FretboardExercise" logs showing event subscriptions

### Problem 2: Position Not Reset Before Fretboard Renders
- **Location**: Transport position state initialization
- **Issue**: Position updates start BEFORE FretboardCard is aware playback started
- **Evidence**: Position updates at ~11734ms, but FretboardCard re-render timing unknown

### Problem 3: Race Condition Between State Update and EventBus Event
- `widgetState.togglePlayback(true)` happens synchronously
- `PLAYBACK_STATE_SET` event fires much later (~10437ms)
- FretboardCard render might happen BEFORE or AFTER event, creating uncertainty

## What Should Happen

```typescript
// CORRECT flow:
1. Play button clicked
2. Emit playback:starting event IMMEDIATELY
3. FretboardCard subscribes to playback:starting
4. When event fires:
   - Position resets to 0:0:0
   - isPlaying=true
   - Visual position = 0
5. Position updates begin
6. FretboardCard shows correct visual position from beat 1

// CURRENT flow:
1. Play button clicked
2. widgetState.togglePlayback(true) sets isPlaying=true
3. React schedules re-render (but timing unknown)
4. Much later: PLAYBACK_STATE_SET event fires
5. Position updates begin
6. FretboardCard might render AFTER position already advanced
7. Result: Fretboard shows position ~1300ms ahead
```

## Solutions to Investigate

### Option 1: Subscribe FretboardCard to EventBus (RECOMMENDED)
```typescript
// In useFretboardExercise.ts or FretboardCard.tsx
useEffect(() => {
  const unsubscribe = eventBus.on('playback:starting', () => {
    // Reset fretboard visual position to 0:0:0
    setVisualPosition({ measure: 0, beat: 0, tick: 0 });
    setIsPlaying(true);
    console.log('[FRETBOARD] Received playback:starting event');
  });

  return unsubscribe;
}, []);
```

### Option 2: Reset Transport Position Synchronously
```typescript
// In GlobalControls.tsx before transport.start()
await transport.seek('1:1:0');
await transport.start();
```

### Option 3: Add Position Guard in FretboardCard
```typescript
// Prevent fretboard from showing position until isPlaying is true
if (!isPlaying) {
  return <FretboardSkeleton />;
}
return <Fretboard position={position} />;
```

## Verification Checklist

- [ ] Check if FretboardCard/useFretboardExercise has EventBus subscription
- [ ] Check transport position at the moment FretboardCard receives `isPlaying=true`
- [ ] Check if position is actually reset to 0:0:0 before visual update
- [ ] Check timing of FretboardCard re-render vs position update events
- [ ] Check if `playback:starting` event is being emitted but not logged

## Conclusion

**The `playback:starting` event IS being emitted** (`emittedStartingEvent: true` at line 3496), but:

1. **FretboardCard is NOT subscribing to it** (no subscription logs found)
2. **FretboardCard relies only on React props** from YouTubeWidgetPage
3. **The timing between prop update and position initialization is misaligned**
4. **Result**: Fretboard shows ~1300ms of playback before it realizes it should start

**Next Step**: Add EventBus subscription to FretboardCard to receive the `playback:starting` event and reset visual position immediately, rather than waiting for React prop updates.
