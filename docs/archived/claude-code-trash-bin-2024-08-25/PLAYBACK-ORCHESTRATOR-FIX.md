# PlaybackOrchestrator Fix Summary

## Problem
When clicking the play button, the console was flooded with millions of "__globalCoreServices not available on window" messages, causing the browser to freeze.

## Root Cause
1. `PlaybackOrchestrator` has two stub classes (`CorePlaybackEngine` and `MusicalTimeEngine`) that try to access `window.__globalCoreServices`
2. The `usePlaybackOrchestrator` hook sets up an interval that calls `getSyncState()` every 100ms
3. `getSyncState()` calls `musicalTimeEngine.getState()` which repeatedly tries to get the transport controller
4. Each attempt logs the "not available" message, creating thousands of logs per second

## Fixes Applied

### 1. Rate-limited logging in stub classes
- Added `hasLoggedMissingServices` flag to both `CorePlaybackEngine` and `MusicalTimeEngine`
- Only log the "not available" message once instead of repeatedly

### 2. Added caching for transport controller
- Added `cachedTransport` property to cache the UnifiedTransport once found
- Prevents repeated lookups when services are available

### 3. Improved play() method to wait for services
- Changed the play() method to wait up to 1 second for CoreServices to become available
- Prevents immediate failure when services are still initializing

### 4. Changed error logging to warnings for non-critical methods
- pause() and stop() now use console.warn instead of console.error
- These operations failing is less critical than play failing

### 5. Updated usePlaybackOrchestrator to wait for CoreServices
- Added a check to wait for `window.__globalCoreServices` before initializing the orchestrator
- Waits up to 3 seconds for services to be available

## Result
- No more console spam when clicking play
- Graceful handling of the case where CoreServices isn't ready yet
- Play button will wait for services to be available before starting playback