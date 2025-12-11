# Transport Synchronization Fixes

## Problem

Widgets were not properly synchronized with the global transport. When stopping and restarting playback:

- Harmony widget would sometimes start at the 3rd chord instead of the 1st
- Metronome would sometimes start on the offbeat
- Widgets were using local counters instead of transport position

## Root Cause

Each widget was maintaining its own counter/index that incremented independently of the transport position. This caused desynchronization when stopping and restarting.

## Solution

Modified all widgets to calculate their current state based on the global transport position instead of maintaining local counters.

### Changes Made:

1. **HarmonyWidget** (`apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget.tsx`)
   - Removed local `chordIndex` counter
   - Now calculates chord index from `Tone.Transport.position`
   - Uses transport bar number to determine which chord to play
   - Starts loop aligned to measure boundary with `@1m`

2. **EnhancedMetronomeWidget** (`apps/frontend/src/app/test-transport/EnhancedMetronomeWidget.tsx`)
   - Removed local `beatCount` counter
   - Calculates beat from transport position's beat component
   - Starts loop aligned to quarter note grid with `@4n`

3. **DrummerWidget** (`apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget.tsx`)
   - Removed local `currentSubdivision` counter
   - Calculates subdivision from transport position components
   - Starts loop aligned to 8th note grid with `@8n`

4. **CorePlaybackEngine** (`apps/frontend/src/domains/playback/services/CorePlaybackEngine.ts`)
   - Enhanced `executeStopOperation` to cancel all scheduled events
   - Ensures transport position resets to 0 on stop

### Key Implementation Details:

```typescript
// Example: Calculate position from transport
const positionParts = Tone.Transport.position.toString().split(':');
const currentBar = parseInt(positionParts[0]) || 0;
const currentBeat = parseInt(positionParts[1]) || 0;
const currentSixteenth = parseInt(positionParts[2]) || 0;

// For harmony (per bar):
const chordIndex = currentBar % progression.length;

// For metronome (per beat):
const beatIndex = currentBeat % beats;

// For drums (per 8th note):
const currentSubdivision =
  (currentBeat * 2 + Math.floor(currentSixteenth / 8)) % 8;
```

### Benefits:

- All widgets now stay perfectly synchronized with the global transport
- Stopping and restarting always begins from the correct position
- No more drift or desynchronization between widgets
- Clean restart behavior with proper event cancellation

## Testing

Navigate to http://localhost:3001/test-transport and:

1. Start all widgets
2. Let them play for a few bars
3. Stop the transport
4. Start again - all widgets should start from beat/bar 1 in perfect sync
