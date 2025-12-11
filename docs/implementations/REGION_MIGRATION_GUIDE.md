# Region Migration Guide

## Story 3.22: Professional DAW Sequencer

This guide helps developers migrate from the old pattern-based widget system to the new region-based approach.

## Quick Migration Path

### 1. Update Your Widget to Use useTrack Hook

```typescript
// OLD
const { registerPattern } = usePatternRegistration({
  widgetId: 'drums-main',
  widgetType: 'drums',
});

// NEW
const { track, createRegionFromPattern, migratePatternToRegion } = useTrack({
  trackId: 'drums-main',
  name: 'Main Drums',
  type: 'drums',
});
```

### 2. For Backward Compatibility (Quick Fix)

If you need to maintain exact same behavior:

```typescript
// In your widget's useEffect
useEffect(() => {
  if (track && pattern) {
    // This creates an infinitely looping region (same as old system)
    migratePatternToRegion('widget-id', pattern);
  }
}, [track, pattern]);
```

### 3. For New Features (Recommended)

Take advantage of the region system:

```typescript
// Create regions with specific timing
const region = createRegionFromPattern(pattern, {
  name: 'Verse Pattern',
  startPosition: '4:0:0', // Start at bar 4
  duration: '8:0:0', // Play for 8 bars
  loopCount: 2, // Loop twice (not infinite!)
});

// Create song arrangements
const createSongStructure = () => {
  createRegionFromPattern(introPattern, {
    name: 'Intro',
    startPosition: '0:0:0',
    duration: '4:0:0',
    loopCount: 1,
  });

  createRegionFromPattern(versePattern, {
    name: 'Verse',
    startPosition: '4:0:0',
    duration: '8:0:0',
    loopCount: 1,
  });

  // ... more regions
};
```

## Key Differences

### Old System (Pattern-Based)

- Patterns play in infinite loops
- One pattern per widget
- No timeline concept
- Direct widget-to-transport coupling

### New System (Region-Based)

- Regions have start/end positions
- Multiple regions per track
- Timeline-based arrangement
- Decoupled through Track system
- Professional DAW-like workflow

## Region Properties

```typescript
interface Region {
  id: string;
  trackId: string;
  name: string;
  startPosition: MusicalPosition; // "bar:beat:sixteenth"
  duration: MusicalPosition;
  pattern?: Pattern; // Your existing pattern
  midiEvents?: MidiEvent[]; // Future: direct MIDI
  loopCount: number; // 0 = infinite, n = loop n times
  muted: boolean;
  // ... more properties
}
```

## Migration Checklist

- [ ] Replace `usePatternRegistration` with `useTrack`
- [ ] Convert pattern registration to region creation
- [ ] Update UI to show regions (optional)
- [ ] Test playback behavior
- [ ] Consider adding timeline features

## Examples

See `/apps/frontend/src/domains/widgets/examples/DrummerWidgetMigration.tsx` for complete examples.

## Benefits of Migration

1. **Timeline Composition**: Build complete songs, not just loops
2. **Multiple Patterns**: Use different patterns at different times
3. **Precise Control**: Start/stop at exact positions
4. **Professional Workflow**: Like Logic Pro or Ableton Live
5. **Future Features**: MIDI editing, audio clips, automation

## Need Help?

- Check the example widget for working code
- Review the useTrack hook documentation
- Look at Track and Region type definitions
