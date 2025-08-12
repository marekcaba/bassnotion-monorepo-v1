# Smart Loading Solution for Supabase Samples

## Summary
The buffer errors occur because:
1. SalamanderVelocitySampler loads ALL 88 keys by default in `initialize()`
2. Loading from Supabase takes 20-40 seconds for all samples
3. The exercise only needs ~9 notes (C4, E4, G4, F4, A4, C5, G4, B4, D5)
4. We should ONLY load the samples needed for the exercise

## Implementation Needed

### 1. Pass Exercise Context Early
```typescript
// In HarmonyWidget
const processor = new ChordInstrumentProcessor();
// Pass exercise before setPreset
processor.setExerciseContext(syncProps.exercise);
await processor.setPreset(ChordPreset.PIANO);
```

### 2. Smart Initialize in SalamanderVelocitySampler
```typescript
// Instead of loading all 88 keys
async initialize(requiredNotes?: string[]): Promise<void> {
  if (requiredNotes) {
    // Only load specific notes
    const velocityLayers = ['v8', 'v10', 'v12'];
    for (const layer of velocityLayers) {
      const urls = requiredNotes.reduce((acc, note) => {
        acc[note] = `${note}.mp3`;
        return acc;
      }, {});
      
      const sampler = new Tone.Sampler({
        urls,
        baseUrl: `${this.supabaseUrl}/Keyboards/salamander/${layer}/`,
      });
      
      await sampler.loaded;
      this.samplers.set(layer, sampler);
    }
  } else {
    // Fallback to full loading
    await this.loadCommonLayers();
  }
}
```

### 3. Benefits
- Load time reduced from 30s to 3-5s
- Only ~27 samples instead of 1,408
- No buffer errors because samples are loaded before playback

## Why Previous Services Had This
The deleted services like:
- `AssetManager.ts` - Managed smart loading
- `MIDIAssetOrchestrator.ts` - Coordinated exercise-based loading
- `ResourceManager.ts` - Cached and reused samples

Had sophisticated systems to:
1. Analyze exercise requirements
2. Preload only needed samples
3. Cache for reuse
4. Handle loading states

## Recommendation
Instead of loading all samples, implement exercise-aware loading that:
1. Extracts notes from exercise
2. Loads only those samples
3. Shows loading progress
4. Caches loaded samples