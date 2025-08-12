# AudioContext Initialization Fix - Implementation Plan

## Problem Summary

The application is experiencing AudioContext initialization errors due to browser autoplay policies. The root cause is that Tone.js is being imported statically in multiple files, causing the AudioContext to be created before any user interaction.

### Current Issues:
1. **AudioContext Warning**: "The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture"
2. **First Beat Stutter**: Multiple loops firing at position 0:0:0 due to timing issues
3. **TypeError**: "Cannot read properties of null (reading 'context')" when Tone is not loaded yet

## Root Cause Analysis

### Static Import Chain:
```
HarmonyWidget.tsx
  → imports ChordInstrumentProcessor.ts (statically)
    → imports SalamanderVelocitySampler.ts (statically)
      → imports Tone.js (statically) ❌ AudioContext created here!
```

This happens even before the user clicks any button, violating browser autoplay policies.

## Solution Architecture

### 1. Dynamic Loading Strategy

Convert all static Tone.js imports to dynamic imports that only load when needed:

```typescript
// Instead of:
import * as Tone from 'tone';

// Use:
let Tone: any = null;
async function ensureToneLoaded(): Promise<void> {
  if (!Tone) {
    Tone = await import('tone');
  }
}
```

### 2. Lazy Initialization Pattern

All audio components should follow this pattern:

```typescript
class AudioComponent {
  private toneLoaded = false;
  
  async initialize(): Promise<void> {
    await this.ensureToneLoaded();
    // Now safe to use Tone.js
  }
  
  private async ensureToneLoaded(): Promise<void> {
    if (!this.toneLoaded) {
      await loadTone(); // Centralized loader
      this.toneLoaded = true;
    }
  }
}
```

## Implementation Steps

### Phase 1: Core Infrastructure (Priority: High)

1. **Create Centralized Tone Loader** ✅
   - File: `ToneProvider.tsx` (already exists)
   - Provides dynamic Tone.js loading
   - Manages AudioContext lifecycle

2. **Update CorePlaybackEngine** ✅
   - Already uses dynamic loading
   - Handles AudioContext initialization on user gesture

### Phase 2: Fix Critical Sampler Files (Priority: High)

These files need immediate conversion to dynamic imports:

#### Audio Samplers (causing immediate errors):
- [ ] `SalamanderVelocitySampler.ts`
- [ ] `WurlitzerVelocitySampler.ts`
- [ ] `RhodesVelocitySampler.ts`
- [ ] `TheSawSampler.ts`
- [ ] `LongPadSampler.ts`

#### Instrument Processors:
- [ ] `ChordInstrumentProcessor.ts` (partially done)
- [ ] `BassInstrumentProcessor.ts`
- [ ] `DrumInstrumentProcessor.ts`
- [ ] `MetronomeInstrumentProcessor.ts`

### Phase 3: Widget Updates (Priority: Medium)

Update widgets to use dynamic imports:

- [x] `HarmonyWidget.tsx` (partially done)
- [x] `DrummerWidget.tsx` (partially done)
- [ ] `BassLineWidget.tsx`
- [ ] `MetronomeWidget.tsx`

### Phase 4: Service Layer (Priority: Medium)

Convert service files with static Tone imports:

- [ ] `AudioContextManager.ts`
- [ ] `MixingConsole.ts`
- [ ] `PrecisionSynchronizationEngine.ts`
- [ ] `TranspositionController.ts`
- [ ] `IntelligentTempoController.ts`
- [ ] `LoopController.ts`

### Phase 5: Plugin System (Priority: Low)

Update remaining plugin files:

- [ ] `BassProcessor.ts`
- [ ] `DrumProcessor.ts`
- [ ] `SyncProcessor.ts`
- [ ] `MusicalContextAnalyzer.ts`
- [ ] `N8nAssetPipelineProcessor.ts`

## Code Patterns

### Pattern 1: Dynamic Import in Class

```typescript
// SalamanderVelocitySampler.ts
let Tone: any = null;

export class SalamanderVelocitySampler {
  private async ensureToneLoaded(): Promise<void> {
    if (!Tone) {
      const ToneModule = await import('tone');
      Tone = ToneModule;
      console.log('🎵 Tone.js loaded dynamically');
    }
  }

  async initialize(): Promise<void> {
    await this.ensureToneLoaded();
    
    // Now safe to use Tone
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
  }
}
```

### Pattern 2: Type-Safe Dynamic Loading

```typescript
// types/ToneTypes.ts
export interface ToneModule {
  start(): Promise<void>;
  context: AudioContext;
  Transport: any;
  Sampler: any;
  // ... other Tone types
}

// In component:
let Tone: ToneModule | null = null;
```

### Pattern 3: Widget Integration

```typescript
// In widget component
const { Tone, isReady } = useTone(); // From ToneProvider

useEffect(() => {
  if (!isReady || !Tone) return;
  
  // Now safe to create audio nodes
  const sampler = new Tone.Sampler();
}, [isReady, Tone]);
```

## Testing Strategy

### 1. Unit Tests
- Mock dynamic imports in tests
- Verify lazy loading behavior
- Test error handling when Tone is not loaded

### 2. Integration Tests
- Test user gesture requirement
- Verify no AudioContext until user interaction
- Test audio playback after initialization

### 3. Manual Testing Checklist
- [ ] Open page in incognito mode
- [ ] Verify no console errors on page load
- [ ] Click "Initialize" button
- [ ] Verify AudioContext starts without errors
- [ ] Test audio playback
- [ ] Test all widgets

## Migration Checklist

For each file being migrated:

1. [ ] Remove static `import * as Tone from 'tone'`
2. [ ] Add `let Tone: any = null;` at module level
3. [ ] Create `ensureToneLoaded()` function
4. [ ] Update all Tone usage to be after initialization
5. [ ] Update TypeScript types to handle null Tone
6. [ ] Test the component
7. [ ] Update any dependent files

## Success Criteria

1. **No AudioContext warnings** on page load
2. **No TypeErrors** related to null Tone access
3. **Audio starts cleanly** after user gesture
4. **No first beat stutter**
5. **All widgets play synchronized**

## Rollback Plan

If issues arise:
1. The changes are isolated per file
2. Can revert individual files without affecting others
3. ToneProvider acts as fallback for components still using it

## Timeline Estimate

- Phase 1: Complete ✅
- Phase 2: 2-3 hours (critical for fixing current errors)
- Phase 3: 1-2 hours
- Phase 4: 2-3 hours
- Phase 5: 2 hours

**Total: 7-10 hours of work**

## Next Steps

1. Start with `SalamanderVelocitySampler.ts` as it's causing the immediate error
2. Test after each file conversion
3. Update this document with progress

---

## Progress Tracking

### Completed:
- [x] ToneProvider with dynamic loading
- [x] CorePlaybackEngine using dynamic imports
- [x] ChordTypes.ts created for type separation
- [x] Basic widget updates for timing

### In Progress:
- [ ] SalamanderVelocitySampler.ts conversion

### Blocked:
- None currently

### Notes:
- The 100ms delay added to widget loops is a temporary fix
- Long-term solution requires completing all phases above