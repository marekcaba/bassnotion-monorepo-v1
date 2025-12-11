# TODO-revert.md - Debugging Log

This file tracks temporary debugging changes that need to be reverted before story completion.

## Story 3.19: Logic Pro X-Grade Transport System

### Active Debug Changes

1. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`
   - **Change**: Added debug logging for AudioWorklet initialization
   - **Lines**: 472-474, 487-489
   - **Reason**: Investigating why AudioWorklet is not being used in browser
   - **Status**: FIXED - Changed from tone.context.rawContext to audioEngine.getContext()

2. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`
   - **Change**: Added debug logging for AudioWorklet timing updates and drift
   - **Lines**: 492-495 (AudioWorklet update logging), 650-653 (drift logging), 335-338 (clock sync filtering)
   - **Reason**: Verifying <1ms drift tolerance with AudioWorklet
   - **Status**: Active - Need to verify drift is under 1ms

3. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`
   - **Change**: Fixed AudioWorklet timing reset on resume
   - **Lines**: 1213-1214 (resumeImmediate), 1309-1310 (resumeAtQuantum)
   - **Reason**: Was resetting AudioWorklet timing values to 0 on resume, breaking continuous timing
   - **Status**: FIXED - Commented out the reset lines to maintain continuous timing

4. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`
   - **Change**: Added debug logging for position updates
   - **Lines**: 584-588 (handleTimingUpdate), 869 (updateMusicalPosition), 948 (start method)
   - **Reason**: Investigating why UI position shows 0:0:0
   - **Status**: Active - Debugging position display issue

5. **File**: `/apps/frontend/src/app/test-unified-transport/page.tsx`
   - **Change**: Added debug logging for UI position updates
   - **Lines**: 292-298
   - **Reason**: Checking what position data the UI is receiving
   - **Status**: Active - Debugging position display issue

6. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`
   - **Change**: Fixed AudioWorklet not processing - added output connection to audio graph
   - **Lines**: 479-491
   - **Reason**: AudioWorklet needs to be connected to destination to run process() method
   - **Status**: FIXED - AudioWorklet now processes audio and sends timing updates

7. **File**: `/apps/frontend/public/worklets/timing-processor.js`
   - **Change**: Added silence output and debug logging for process() calls
   - **Lines**: 45-54
   - **Reason**: Ensure AudioWorklet outputs silence and verify it's processing
   - **Status**: Active - Debugging if process() method is being called

8. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`
   - **Change**: Added silent oscillator to force audio graph processing
   - **Lines**: 493-501
   - **Reason**: AudioWorklet might not process without active audio in the graph
   - **Status**: Active - Testing if this forces AudioWorklet to process

9. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`
   - **Change**: Added debug logging for AudioWorklet state when sending start message
   - **Lines**: 973-978
   - **Reason**: Verify AudioWorklet node is properly connected when starting
   - **Status**: Active - Debugging AudioWorklet message passing

10. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Added reinitializeAudioWorklet() method and call it in start()
- **Lines**: 552-590 (method), 1003-1006 (call in start)
- **Reason**: AudioWorklet created while context suspended won't process - need to recreate after resume
- **Status**: SOLUTION - This should fix the AudioWorklet not processing issue

11. **File**: `/apps/frontend/src/domains/playback/providers/AudioProvider.tsx`

- **Change**: Added extensive debug logging for CoreServices initialization
- **Lines**: 99-152
- **Reason**: Debugging why window.\_\_coreServices is not being set
- **Status**: Active - Investigating initialization flow

12. **File**: `/apps/frontend/src/app/test-unified-transport/page.tsx`

- **Change**: Added debug logging for window.\_\_coreServices detection
- **Lines**: 167-180
- **Reason**: Tracking when/if CoreServices becomes available on window
- **Status**: Active - Debugging CoreServices availability

13. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Deferred AudioWorklet initialization to prevent blocking on suspended AudioContext
- **Lines**: 411-423
- **Reason**: UnifiedTransport init was blocking waiting for AudioContext resume
- **Status**: FIXED - CoreServices now initializes successfully

14. **File**: `/apps/frontend/public/worklets/timing-processor.js`

- **Change**: Prevent timing updates when transport is stopped
- **Lines**: 69-80
- **Reason**: AudioWorklet was sending updates continuously even when stopped
- **Status**: FIXED - No more infinite loop of updates when stopped

15. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Removed debug logging for skipped timing updates
- **Lines**: 658-660
- **Reason**: Was spamming console with "handleTimingUpdate skipped" messages
- **Status**: FIXED - Clean console output

16. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Fixed AudioWorklet message handler not being set up in reinitializeAudioWorklet
- **Lines**: 575-637
- **Reason**: AudioWorklet was not receiving messages after reinitialization
- **Status**: FIXED - AudioWorklet now properly receives start/stop/pause messages

17. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Added AudioWorklet module loading in reinitializeAudioWorklet
- **Lines**: 579-588
- **Reason**: AudioWorkletNode cannot be created without loading the processor module first
- **Status**: FIXED - Now loads timing-processor.js before creating AudioWorkletNode

18. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Changed default values for hardware clock sync and pause quantum
- **Lines**: 121 (pauseQuantum), 130 (useHardwareClock)
- **Reason**: Enable hardware clock sync by default and use 128n quantum for ultra-precise timing
- **Status**: CONFIGURATION - Hardware clock sync ON by default, 128n quantum for professional precision

19. **File**: `/apps/frontend/public/worklets/timing-processor.js`

- **Change**: Fixed AudioWorklet message handler setup
- **Lines**: 38-39 (constructor), 115 (handleMessage method)
- **Reason**: AudioWorklet processors must use port.onmessage, not a class method
- **Status**: FIXED - Messages now properly received by AudioWorklet processor

20. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Reduced debug logging frequency
- **Lines**: 793-796 (drift correction), 798-800 (drift tolerance), 520-523 & 613-616 (AudioWorklet updates)
- **Reason**: Too many console messages causing performance issues and clutter
- **Status**: CLEANUP - Only log significant events (>10ms drift, first update, every 1000th event)

21. **File**: `/apps/frontend/src/app/test-unified-transport/page.tsx`

- **Change**: Skip timing-update events in debug logging
- **Lines**: 240-243
- **Reason**: Timing updates fire hundreds of times per second causing console spam
- **Status**: CLEANUP - Other events still logged for debugging

22. **File**: `/apps/frontend/public/worklets/timing-processor.js`

- **Change**: Reduced process() debug logging
- **Lines**: 47-50
- **Reason**: Was logging first 5 process calls, now only logs the very first one
- **Status**: CLEANUP - Reduces console spam while still confirming processor starts

23. **File**: `/apps/frontend/public/worklets/timing-processor.js`

- **Change**: Fixed AudioWorklet time reference - now sends playback time instead of AudioContext time
- **Lines**: 75-85
- **Reason**: AudioWorklet was sending AudioContext's currentTime (~8 seconds since context creation) instead of playback position
- **Status**: FIXED - Now sends actual playback position (totalFrames / sampleRate)

24. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Fixed drift calculation to compare correct time references
- **Lines**: 765-807
- **Reason**: Was comparing AudioContext time against performance.now(), causing ~8000ms drift
- **Status**: FIXED - Now correctly compares transport time vs AudioWorklet playback time

25. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Further reduced drift logging frequency
- **Lines**: 789-796
- **Reason**: Console was flooded with drift correction messages (100s per second)
- **Status**: CLEANUP - Now only logs drift corrections >50ms and tolerance checks every 10000 events

26. **File**: `/apps/frontend/src/domains/playback/providers/AudioProvider.tsx`

- **Change**: Reduced initialization logging - removed 15+ console.log statements
- **Lines**: 73-141 (major cleanup)
- **Reason**: Duplicate initialization logs flooding console on every render
- **Status**: CLEANUP - Only keeping error logs and essential feature flag log (once)

27. **File**: `/apps/frontend/src/domains/playback/services/core/ServiceRegistry.ts`

- **Change**: Removed verbose initialization logging
- **Lines**: 145-176
- **Reason**: ServiceRegistry was logging every step of initialization process
- **Status**: CLEANUP - Removed 6 console.log statements, kept only error logging

28. **File**: `/apps/frontend/src/domains/playback/services/BackgroundSampleLoader.ts`

- **Change**: Removed extensive sample loading logs
- **Lines**: Multiple throughout file
- **Reason**: BackgroundSampleLoader was logging every step of sample loading
- **Status**: CLEANUP - Removed ~20 console.log statements including success messages, loading status, etc.

29. **File**: `/apps/frontend/src/app/test-unified-transport/page.tsx`

- **Change**: Removed debug console logging from test page
- **Lines**: Multiple throughout file
- **Reason**: Test page was logging excessive debug information
- **Status**: CLEANUP - Removed ~25 console.log statements from event handlers, button clicks, and service checks

30. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Fixed AudioWorklet drift calculation - use relative timing instead of absolute
- **Lines**: 147 (added audioWorkletStartOffset), 780-795 (drift calculation), 1104-1106 (start), 1167 (stop)
- **Reason**: AudioWorklet was comparing absolute times causing massive drift corrections
- **Status**: FIXED - Now tracks relative elapsed time from start, not absolute positions

31. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Reset transport position to 0 on stop
- **Lines**: 1145-1146
- **Reason**: Transport.stop() doesn't reset position, causing drift when restarting
- **Status**: FIXED - Now resets both position and seconds to 0 on stop

32. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Further console.log cleanup - removed AudioWorklet initialization logs
- **Lines**: 480, 510, 538, 799, 1204, 1343
- **Reason**: Reduce console noise even further
- **Status**: CLEANUP - Commented out verbose logging while keeping essential error logs

33. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Fixed audioWorkletStartOffset to always be 0 on fresh start
- **Lines**: 1100
- **Reason**: Was setting offset to tone.Transport.seconds which could be non-zero after stop
- **Status**: FIXED - Now always starts from 0 for fresh starts, preventing drift

34. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Simplified drift calculation - removed audioWorkletStartOffset
- **Lines**: 147 (removed property), 782 (simplified comparison), 1098, 1162
- **Reason**: Direct comparison of transportTime and audioWorkletTime is cleaner
- **Status**: FIXED - Both values are playback positions in seconds, no offset needed

35. **File**: `/apps/frontend/public/worklets/timing-processor.js`

- **Change**: Fixed undefined variable references in AudioWorklet
- **Lines**: 70, 81, 94, 109
- **Reason**: Changed currentTime references to contextTime to avoid variable name collision
- **Status**: FIXED - AudioWorklet now uses proper variable names

36. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Changed drift correction to direct synchronization
- **Lines**: 780-791
- **Reason**: Instead of incremental corrections, directly set Transport time to AudioWorklet time
- **Status**: FIXED - AudioWorklet is now the primary time source

37. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Restored audioWorkletStartTime to fix drift when reinitializing AudioWorklet
- **Lines**: 147 (property), 640 (reinit), 790 (drift calc), 1109 (start), 1171 (stop)
- **Reason**: AudioWorklet sends elapsed time from 0, but Transport.seconds may not be 0 when AudioWorklet starts
- **Status**: ROOT CAUSE FIXED - Now correctly tracks offset when AudioWorklet starts mid-playback

38. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Implemented AudioWorklet as master clock for web deployment
- **Lines**: 148-150 (new properties), 415-427 (preload module), 493-500 (check preload), 600-610 (reinit), 808-879 (master clock mode)
- **Reason**: Use AudioWorklet as single source of truth to eliminate drift between two independent clocks
- **Status**: FINAL SOLUTION - AudioWorklet drives Transport directly when available, fallback uses drift compensation

39. **File**: `/apps/frontend/src/domains/playback/services/core/UnifiedTransport.ts`

- **Change**: Fixed metrics calculation showing 0% stability
- **Lines**: 807-838 (track actual difference), 893-920 (proper metrics calc), 1021-1033 (fix update rate)
- **Reason**: Metrics were showing zeros because drift history was filled with zeros in master clock mode
- **Status**: FIXED - Now properly calculates stability based on samples within 1ms tolerance

### Reverted Changes

None

## Story 3.18.5: Audio Reliability & Technical Debt Elimination

### Active Debug Changes

None

### Reverted Changes

None
