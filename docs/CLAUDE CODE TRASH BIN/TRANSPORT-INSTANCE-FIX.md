# Transport Instance Mismatch Fix

## Problem
The console logs show that widgets are accessing a different Transport instance than the one managed by CorePlaybackEngine:
- CorePlaybackEngine creates Transport with ID: `transport-1753443699842-hws97qf0x`
- Widgets accessing `Tone.Transport` get instance with ID: `no-id`
- This causes state mismatches where Transport shows as 'stopped' even during playback

## Root Cause
When CorePlaybackEngine initializes, it gets a reference to `Tone.Transport` but this might not be the same instance that widgets access later when they import Tone.js directly. This can happen due to:
1. Module loading order
2. Multiple Tone.js instances
3. Context isolation

## Current Behavior
- Widgets show: `Transport.state=stopped` even when playing
- Transport IDs don't match between provider and direct access
- State updates aren't synchronized properly

## Solution Options

### Option 1: Force Single Transport Instance (Recommended)
Ensure all parts of the application use the exact same Transport instance by:
1. Having CorePlaybackEngine set a global reference
2. Creating a singleton Transport accessor
3. Ensuring widgets always use the provider's Transport

### Option 2: Transport State Synchronization
Keep multiple Transport instances but synchronize their states through the UnifiedTransportController.

### Option 3: Direct Tone.Transport Usage
Since widgets already work correctly with `Tone.Transport` directly, ensure CorePlaybackEngine also uses the same global instance instead of caching a potentially different reference.

## Temporary Workaround
The system is currently working despite the ID mismatch because:
- Audio scheduling still functions correctly
- The UnifiedTransportController manages actual playback state
- Widgets use syncIsPlaying for state determination

## Action Items
1. Investigate why multiple Transport instances exist
2. Ensure single Transport instance across the application
3. Add Transport instance validation during initialization
4. Consider removing Transport ID assignment if using global instance