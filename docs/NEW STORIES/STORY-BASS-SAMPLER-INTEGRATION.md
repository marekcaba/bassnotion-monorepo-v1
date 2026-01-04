# STORY: Bass Sampler Integration

## Overview

Implement a professional bass guitar sampler using real recorded samples, integrated with the existing playback infrastructure. The sampler will play bass samples synchronized with the fretboard visualizer, Wurlitzer, DrummerWidget, and metronome.

## Status

- **Created**: 2024-12-22
- **Status**: Complete
- **Priority**: High
- **Phases Completed**: 1, 2, 3, 4, 5
- **Remaining**: None (ready for testing)

## Background

### Current State
- MIDI-to-fretboard conversion is **complete and working** (backend `fretboard-mapper.service.ts`)
- Samples are converted to OGG format (32kHz, Vorbis Q2) and uploaded to Supabase
- Existing playback infrastructure supports drums, harmony, metronome, and voice cues
- `BassScheduler` exists but uses synthesized bass, not samples

### Existing Bass Infrastructure
- **BassScheduler** (`InstrumentSchedulers.ts`) - exists but has empty `eventTypeToBufferKey`, needs MIDI note mapping
- **BassPreloadStrategy.ts** - already extracts notes from MIDI for smart loading (extend, don't recreate)
- **BassSynthEngine.ts** - provides Tone.js synthesis fallback (keep for offline/error scenarios)
- **basslineNoteExtractor.ts** - FAANG smart loading utility, fully implemented
- **GlobalSampleCache** - dual-layer caching (memory + IndexedDB), ready to use

### Sample Library
- **Location**: Supabase bucket `audio-samples/Bass/BassMods/`
- **Format**: OGG Vorbis, 32kHz, Quality 2
- **Total**: 110 samples (22 notes × 5 strings)
- **Strings**: B, E, A, D, G (5-string bass)
- **Velocity**: f (forte) - single velocity layer
- **Technique**: finger style

### Sample URL Pattern
```
https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/
  Bass/BassMods/Fingers-f/{String}%20string/{Note}{Octave}_f_finger_{String}string.ogg

Example:
  .../Fingers-f/A%20string/A1_f_finger_Astring.ogg
```

### Sample Naming Convention
```
{Note}{Octave}_{velocity}_{technique}_{String}string.ogg

Components:
- Note: C, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B (s = sharp)
- Octave: 0-4
- Velocity: f (forte)
- Technique: finger
- String: B, E, A, D, G
```

## User Flow

```
1. Upload MIDI File
   └─> Backend parses MIDI, extracts bass track

2. Convert to Fretboard Array
   └─> fretboard-mapper.service.ts assigns string/fret positions
   └─> Uses playability scoring (prefer middle strings, lower frets)
   └─> Output: ExerciseNote[] with string, fret, note, position

3. Save Converted Data
   └─> Store in exercise entity (notes array)
   └─> Optional: Store basslineMidiUrl for re-parsing

4. Load Exercise
   └─> Extract unique notes from exercise (FAANG smart loading)
   └─> Check GlobalSampleCache for already-loaded samples
   └─> Load only missing samples from Supabase
   └─> Build sample map: MIDI note → AudioBuffer

5. Schedule & Play
   └─> Create bass region with pattern events
   └─> BassScheduler routes events to BassSampleEngine
   └─> Samples play synchronized with Transport
   └─> Fretboard visualizer highlights current note

6. Clear on Exercise Change
   └─> Cancel scheduled bass events
   └─> Keep loaded samples in cache (for reuse)
   └─> Load new exercise samples
```

## Technical Architecture

### New Components

```
apps/frontend/src/domains/playback/
├── modules/instruments/
│   └── implementations/bass-sampler/
│       ├── BassSamplerEngine.ts       # Core sampler (like DrumSampleEngine)
│       ├── BassSampleManifest.ts      # Sample URL generation
│       ├── BassSampleLoader.ts        # Async loading with caching
│       └── types.ts                   # Type definitions
├── data/bass/
│   └── bass-sampler-manifest.json     # Sample metadata
└── modules/preloading/strategies/
    └── BassPreloadStrategy.ts         # EXISTING - extend for sample loading
```

### Integration Points

1. **PlaybackEngine.ts**
   - Add `setBassBuffers(buffers, destination)` method
   - Route bass events to BassSamplerEngine

2. **BassScheduler (InstrumentSchedulers.ts)**
   - Map MIDI notes to sample keys
   - Support string-specific samples (same note, different timbre)

3. **ExerciseLoader.ts**
   - Extract bass notes for smart loading
   - Build sample requirements list

4. **FretboardCard / BassLineWidget**
   - Sync visualization with playback
   - Highlight active notes

### Data Structures

```typescript
// Sample manifest for bass
interface BassSamplerManifest {
  name: string;
  version: string;
  baseUrl: string;
  technique: 'finger' | 'pick' | 'slap';
  velocity: 'f' | 'mf' | 'p';
  strings: BassSamplerString[];
}

interface BassSamplerString {
  name: 'B' | 'E' | 'A' | 'D' | 'G';
  openNote: string;        // e.g., "B0", "E1"
  openMidiNote: number;    // e.g., 23, 28
  samples: BassSample[];
}

interface BassSample {
  note: string;            // "Cs2"
  midiNote: number;        // 37
  fret: number;            // calculated from open string
  url: string;             // full Supabase URL
}

// Runtime sample map - keyed by MIDI note number
type BassSampleMap = Map<number, AudioBuffer>;
// Key format: MIDI note number (e.g., 40 for E2, 45 for A2)
// For string-specific samples, use compound key: "{midiNote}_{string}" e.g., "40_E"

// Exercise note (existing)
interface ExerciseNote {
  id: string;
  string: number;          // 1-5 (B=1, E=2, A=3, D=4, G=5)
  fret: number;
  note: string;            // "E2", "A1", etc.
  position: MusicalPosition;
  duration?: string;
  velocity?: number;
  techniques?: string[];
}

// Bass event structure for PatternEvent
interface BassEventData {
  note: string;            // Note name: "E2", "A1", etc.
  string: number;          // String number: 1-5
  fret: number;            // Fret position: 0-24
  midiNote: number;        // MIDI pitch: 23-67 (B0-E4)
}

// PatternEvent for bass
interface BassPatternEvent {
  type: 'bass-note';
  position: string;        // Musical position: "0:0:0"
  velocity?: number;       // 0-127
  duration?: string;       // "8n", "4n", etc.
  data: BassEventData;
}
```

## Implementation Phases

### Phase 1: Core Infrastructure ✅
**Goal**: BassSamplerEngine plays samples on demand

Tasks:
- [x] Create `BassSamplerManifest.ts` - generate URLs from note/string
- [x] Create `BassSampleLoader.ts` - load samples with caching
- [x] Create `BassSamplerEngine.ts` - Tone.js Player-based playback
- [x] Create `bass-sampler-manifest.json` - metadata for all 110 samples
- [x] Add types for bass sampler

### Phase 2: PlaybackEngine Integration ✅
**Goal**: Bass samples play during exercise playback

Tasks:
- [x] Add `setBassBuffers()` to PlaybackEngine (follow `setDrumBuffers()` pattern)
- [x] Update `BassScheduler` to use sample buffers with MIDI note keys
- [x] Configure `eventTypeToBufferKey` mapping: MIDI note number → buffer key
- [x] Add dynamic buffer lookup from `event.data.midiNote` in scheduler
- [x] Define bass event structure: `{ note, string, fret, midiNote }` in PatternEvent.data
- [x] Handle note duration (sample length vs. scheduled duration)
- [x] Test with single exercise

### Phase 3: Smart Loading (FAANG) ✅
**Goal**: Only load samples needed for current exercise

Tasks:
- [x] Extend existing `BassPreloadStrategy.ts` to load actual samples (not just metadata)
- [x] Use `basslineNoteExtractor.ts` to get unique MIDI notes from exercise
- [x] Integrate with `GlobalSampleCache` for dual-layer caching (memory + IndexedDB)
- [x] Add loading progress indicator
- [x] Implement parallel loading with concurrency limit (max 4 concurrent fetches)

### Phase 4: Widget Integration ✅
**Goal**: Fretboard visualizer syncs with bass playback

Tasks:
- [x] Update `BassLineWidget` to use sampler
- [x] Sync note highlighting with playback
- [x] Handle exercise changes (clear scheduled events)
- [x] Add visual feedback for currently playing note

### Phase 5: Polish & Optimization ✅
**Goal**: Production-ready bass sampler

Tasks:
- [x] Add volume/pan controls
- [x] Implement release/decay for natural sound (ADSR envelope)
- [x] Add round-robin support (when multiple samples per note)
- [x] Memory management (LRU eviction, unload unused samples)
- [x] Performance profiling (memory stats API)

## Sample Inventory

### String Ranges

| String | Open Note | MIDI | Fret Range | Notes |
|--------|-----------|------|------------|-------|
| B      | B0        | 23   | 0-21       | B0-Gs2 |
| E      | E1        | 28   | 0-21       | E1-Cs3 |
| A      | A1        | 33   | 0-21       | A1-Fs3 |
| D      | D2        | 38   | 0-21       | D2-As3 |
| G      | G2        | 43   | 0-21       | G2-E4 |

### Note-to-Sample Mapping

```typescript
// MIDI note to sample URL
function getSampleUrl(midiNote: number, string: string): string {
  const baseUrl = 'https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples';
  const noteName = midiNoteToName(midiNote); // e.g., 40 -> "E1"
  const sharpName = noteName.replace('#', 's'); // e.g., "C#2" -> "Cs2"

  return `${baseUrl}/Bass/BassMods/Fingers-f/${string}%20string/${sharpName}_f_finger_${string}string.ogg`;
}
```

### Buffer Key Convention

**Decision**: Use MIDI note numbers as buffer keys for simplicity and direct lookup.

```typescript
// Buffer key format: MIDI note number as string
const bufferKey = String(midiNote); // "40", "45", etc.

// BassScheduler buffer lookup
getBufferForEvent(event: PatternEvent): AudioBuffer | null {
  const midiNote = event.data?.midiNote;
  if (midiNote !== undefined) {
    return this.buffers.get(String(midiNote));
  }
  return null;
}

// Example buffer map after loading
{
  "23": AudioBuffer,  // B0
  "28": AudioBuffer,  // E1
  "33": AudioBuffer,  // A1
  "40": AudioBuffer,  // E2
  "45": AudioBuffer,  // A2
  // ... etc
}
```

**Why MIDI notes instead of note names?**
- Direct numeric lookup (no string parsing)
- Matches MIDI data from exercises
- Unambiguous (no enharmonic confusion: C# vs Db)
- Easy range validation (23-67 for 5-string bass)

## Existing Code to Leverage

### From DrumSampleEngine Pattern
```typescript
// apps/frontend/src/domains/playback/modules/instruments/components/drums/DrumSampleEngine.ts
class DrumSampleEngine {
  private samplers: Map<string, Sampler>;

  async loadKit(kit: DrumKit): Promise<void>
  triggerSample(type: string, velocity: number, time: number): void
}
```

### From BassScheduler
```typescript
// apps/frontend/src/domains/playback/services/core/region-processing/scheduling/InstrumentSchedulers.ts
export class BassScheduler extends SimpleInstrumentScheduler {
  eventTypeToBufferKey: Record<string, string>;
}
```

### From basslineNoteExtractor
```typescript
// apps/frontend/src/domains/playback/utils/basslineNoteExtractor.ts
export async function extractNotesFromBasslineMidi(midiUrl: string): Promise<string[]>
export function groupNotesByString(notes: string[]): Record<string, string[]>
```

## Testing Strategy

### Unit Tests
- BassSamplerManifest URL generation
- MIDI note to sample key mapping
- Sample loading and caching

### Integration Tests
- PlaybackEngine with bass samples
- Exercise loading with smart sample loading
- Widget synchronization

### Manual Testing
- Audio quality verification
- Timing accuracy (no latency/drift)
- Memory usage with multiple exercises
- Cross-browser compatibility

## Success Criteria

1. **Functional**
   - Bass samples play in sync with Transport
   - Correct sample plays for each note/string combination
   - Samples cached and reused across exercises
   - Clean handoff when changing exercises

2. **Performance**
   - Initial load < 3 seconds for typical exercise
   - No audio dropouts during playback
   - Memory usage stable (no leaks)

3. **Quality**
   - Audio sounds natural (proper attack/release)
   - Visual sync with fretboard (< 50ms latency)
   - Volume balanced with other instruments

## Dependencies

- Tone.js (existing)
- Supabase storage (existing)
- GlobalSampleCache (existing)
- PlaybackEngine (existing)
- FretboardVisualizer (existing)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Sample loading too slow | Progressive loading, show progress |
| Memory usage too high | Implement LRU cache, unload unused |
| Timing drift | Use Tone.js Transport scheduling |
| Audio quality issues | Test across browsers, adjust compression |

## Design Decisions

1. **Buffer key format**: Use MIDI note numbers as strings ("40", "45", etc.)
   - Direct numeric lookup, no parsing needed
   - Unambiguous (no enharmonic issues)

2. **Event data structure**: `{ note, string, fret, midiNote }`
   - Full context available for visualization sync
   - midiNote used for buffer lookup

3. **Preload strategy**: Extend existing `BassPreloadStrategy.ts`
   - Don't create new file, reuse existing infrastructure

## Open Questions

1. Should we support string-specific samples when same note exists on multiple strings?
   - **Proposal**: Yes, use string info from ExerciseNote for authentic timbre
   - **Implementation**: Use compound key "{midiNote}_{string}" when string-specific needed

2. How to handle notes outside sampled range?
   - **Proposal**: Pitch-shift nearest sample (Tone.js supports this)

3. Should we pre-load common notes (E1, A1, etc.)?
   - **Proposal**: Yes, Phase 3 can include "common notes" warm-up

## References

### Core Implementation Patterns
- [DrumSampleEngine.ts](../apps/frontend/src/domains/playback/modules/instruments/components/drums/DrumSampleEngine.ts) - Primary pattern to follow
- [DrumPreloadStrategy.ts](../apps/frontend/src/domains/playback/modules/preloading/strategies/DrumPreloadStrategy.ts) - Preloading pattern
- [standard-kit.json](../apps/frontend/src/domains/playback/data/drums/standard-kit.json) - Manifest format reference

### Existing Bass Infrastructure
- [BassScheduler in InstrumentSchedulers.ts](../apps/frontend/src/domains/playback/services/core/region-processing/scheduling/InstrumentSchedulers.ts) - Scheduler to configure
- [BassPreloadStrategy.ts](../apps/frontend/src/domains/playback/modules/preloading/strategies/BassPreloadStrategy.ts) - Extend for sample loading
- [BassSynthEngine.ts](../apps/frontend/src/domains/playback/modules/instruments/components/bass/BassSynthEngine.ts) - Synthesis fallback
- [basslineNoteExtractor.ts](../apps/frontend/src/domains/playback/utils/basslineNoteExtractor.ts) - MIDI note extraction

### Integration Points
- [PlaybackEngine.ts](../apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts) - Add setBassBuffers() here
- [SimpleInstrumentScheduler.ts](../apps/frontend/src/domains/playback/services/core/region-processing/scheduling/SimpleInstrumentScheduler.ts) - Base scheduler class
- [EventRouter.ts](../apps/frontend/src/domains/playback/services/core/region-processing/event-routing/EventRouter.ts) - Routes to BassScheduler
- [GlobalSampleCache.ts](../apps/frontend/src/domains/playback/modules/storage/cache/GlobalSampleCache.ts) - Caching infrastructure

### Backend
- [fretboard-mapper.service.ts](../apps/backend/src/domains/exercises/services/fretboard-mapper.service.ts) - MIDI to fretboard conversion
