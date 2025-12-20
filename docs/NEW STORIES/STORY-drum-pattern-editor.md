# STORY: Drum Pattern Editor

## Story Overview

| Field | Value |
|-------|-------|
| **Story ID** | DRUM-EDITOR-001 |
| **Title** | Grid-Based Drum Pattern Editor with Playback Preview |
| **Epic** | Music Creation Tools |
| **Priority** | HIGH |
| **Status** | IN PROGRESS |
| **Created** | 2024-12-12 |
| **Author** | Claude Code Analysis |

## Problem Statement

BassNotion needs a way to create, edit, and preview drum patterns for exercises.

**Original Problems (2024-12-12):**
- MIDI files can be uploaded and parsed, but there's no visual editing capability
- ~~The existing `DrumPatternEditor` is a list-based admin tool, not a proper drum machine UI~~ **RESOLVED: V1 removed, V2 grid editor implemented**
- Users cannot create patterns from scratch or fine-tune imported MIDI patterns
- No way to preview drum patterns in isolation before saving to exercises
- Drum patterns are not reusable across exercises (no pattern library)
- ~~Playback integration is only 40% complete (missing glue code)~~ **RESOLVED: PlaybackEngine.setDrumBuffers() implemented**

## Timeline Summary (Revised - Sequential, High-Risk First)

**Approach:** Option A - Sequential phases, high-risk items first to uncover blockers early.

| Order | Phase | Effort | Risk | Notes |
|-------|-------|--------|------|-------|
| 1 | **Phase 0**: Git Commit + Prerequisites | 3-4 days | 🔴 HIGH | Baseline commit, 90 samples (18 drums × 5 velocities), fix 5 hardcoded paths |
| 2 | **Phase 7 Spike**: Playback Investigation | 1-2 days | 🔴 HIGH | Verify glue code works BEFORE building UI |
| 3 | **Phase 1**: Core Grid Editor | 3-4 days | 🟢 LOW | 18-lane grid UI |
| 4 | **Phase 2**: Playback Preview | 2-3 days | 🟡 MEDIUM | Use `playDrumHit()` for preview |
| 5 | **Phase 3**: Velocity & Selection | 2 days | 🟢 LOW | Standard UI work |
| 6 | **Phase 4**: Grid Controls & Drag | 2 days | 🟢 LOW | Standard UI work |
| 7 | **Phase 5**: Backend & Database | 2.5-3 days | 🟢 LOW | Infrastructure exists! |
| 8 | **Phase 6**: Pattern Library UI | 2-3 days | 🟢 LOW | Browse/search patterns |
| 9 | **Phase 7 Full**: Playback Integration | 2-3 days | 🟡 MEDIUM | Reduced risk after spike |
| 10 | **Phase 8**: Polish & UX | 2-3 days | 🟢 LOW | Undo/redo, keyboard shortcuts |

**REVISED TOTAL**: ~22-28 days

**Phase Chain Dependencies:**
```
Phase 0 ──→ Phase 7 Spike ──→ Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
                                                                      │
                                                                      ↓
                                            Phase 5 ──→ Phase 6 ──→ Phase 7 Full ──→ Phase 8
```

**BLOCKING GATES:**
- ✅ Phase 0 complete → samples exist, paths fixed
- ✅ Phase 7 Spike complete → playback glue verified working
- ✅ Phase 2 complete → preview functional in editor
- ✅ Phase 7 Full complete → end-to-end exercise playback works

---

## Scope Clarification

**This is an ADMIN-ONLY tool** for content creators to:
1. Upload drum MIDI files and edit them visually
2. Create reusable drum patterns stored in a library
3. Categorize patterns by genre, difficulty, time signature
4. Preview patterns before saving
5. Attach patterns to exercises (**by COPY** - independent, won't change if source pattern is edited)

**NOT for end users** - they consume patterns through exercise playback

### Architecture Decisions (Confirmed 2024-12-12)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Pattern-Exercise Linking** | COPY (JSONB) | Simpler, no cascade issues, patterns independent |
| **Velocity Layers** | 5 layers (v1-v5) | Matches piano convention, numeric naming |
| **Disabled DrummerWidget MIDI** | INTENTIONAL | GlobalControls is responsible for loading - prevents race conditions |
| **Phase Order** | Sequential (Option A) | High-risk phases first, safer approach |

## User Stories

### US-1: Create Drum Pattern from Scratch
**As a** content creator
**I want to** click on a grid to place drum hits
**So that** I can create drum patterns without needing external MIDI software

**Acceptance Criteria:**
- [ ] Grid displays rows for each drum type (kick, snare, hi-hat, etc.)
- [ ] Grid displays columns for time divisions (16th notes by default)
- [ ] Clicking a cell toggles a drum hit on/off
- [ ] Default velocity is applied to new hits (100/127)
- [ ] Visual feedback shows which cells have hits (filled vs empty)

### US-2: Edit Imported MIDI Pattern
**As a** content creator
**I want to** visually edit a drum pattern imported from MIDI
**So that** I can fix mistakes or customize patterns for exercises

**Acceptance Criteria:**
- [ ] Imported MIDI patterns display correctly in the grid
- [ ] Can add new hits to imported patterns
- [ ] Can remove existing hits from imported patterns
- [ ] Can adjust velocity of individual hits
- [ ] Original MIDI timing precision (480 PPQ) is preserved

### US-3: Preview Pattern Playback
**As a** content creator
**I want to** hear the drum pattern while editing
**So that** I can verify it sounds correct before saving

**Acceptance Criteria:**
- [ ] Play button starts pattern playback
- [ ] Stop button stops playback immediately
- [ ] Loop toggle enables continuous looping
- [ ] Playhead indicator shows current position in grid
- [ ] Tempo can be adjusted for preview (40-300 BPM)

### US-4: Adjust Velocity
**As a** content creator
**I want to** control how hard each drum hit sounds
**So that** I can create dynamic, musical patterns

**Acceptance Criteria:**
- [ ] Velocity displayed visually (color intensity or cell height)
- [ ] Click+drag vertically adjusts velocity
- [ ] Velocity range: 1-127 (MIDI standard)
- [ ] Shift+click sets accent (velocity 127)
- [ ] Alt+click sets ghost note (velocity 40)

### US-5: Apply Swing/Shuffle
**As a** content creator
**I want to** add swing to straight patterns
**So that** I can create groovy, humanized beats

**Acceptance Criteria:**
- [ ] Swing slider (0-100%)
- [ ] Swing affects even-numbered 16th notes (pushes later)
- [ ] Preview reflects swing in real-time
- [ ] Swing value saved with pattern

### US-6: Grid Resolution Control
**As a** content creator
**I want to** change the grid resolution
**So that** I can work with different note values (8th, 16th, 32nd)

**Acceptance Criteria:**
- [ ] Resolution selector: 1/4, 1/8, 1/16, 1/32, triplets
- [ ] Grid visually updates to show selected resolution
- [ ] Existing hits remain at their original tick positions (480 PPQ preserved)
- [ ] Snap toggle for quantizing dragged/new hits to grid
- [ ] Horizontal scroll for patterns longer than viewport

### US-7: Pattern Library Management
**As a** content creator
**I want to** save patterns to a reusable library
**So that** I can use the same pattern across multiple exercises

**Acceptance Criteria:**
- [ ] Save pattern to library with name and metadata
- [ ] Categorize by: genre (rock, jazz, funk, latin), difficulty, time signature
- [ ] Add tags for searchability
- [ ] Browse/search existing patterns
- [ ] Select pattern from library when creating exercise (alternative to MIDI upload)

### US-8: Pattern-Exercise Linking
**As a** content creator
**I want to** attach a library pattern to an exercise
**So that** the exercise uses that drum pattern during playback

**Acceptance Criteria:**
- [ ] "Select from Library" button in ExerciseFormModal
- [ ] Pattern picker modal with search/filter
- [ ] Preview pattern before selecting
- [ ] Pattern linked by reference (updates propagate) OR copied (independent)

---

## Technical Architecture

### Investigation Findings (2024-12-12)

#### DrumInstrumentProcessor - REUSE AS PLAYBACK ENGINE ✅
**Location:** `apps/frontend/src/domains/playback/modules/instruments/implementations/drums/DrumInstrumentProcessor.ts`
**Status:** Production-ready, 1,579 lines, actively used

**Capabilities to leverage:**
- 18 drum pieces (kick, snare, hi-hats, toms, crashes, ride, clap, cowbell, etc.)
- Full General MIDI mapping (notes 35-70)
- `HumanizationEngine` - timing/velocity variation for natural feel
- `GrooveEngine` - swing styles (STRAIGHT, SWING_A/B/C, SHUFFLE, LATIN, FUNK)
- Hit types: NORMAL, GHOST (30%), ACCENT (130%), FLAM, ROLL
- Per-drum volume control via `DrumVolumeConfig`
- Methods: `triggerDrum()`, `playDrumHit()`, `playMidiEvent()`

**Integration:** Editor will wrap DrumInstrumentProcessor for preview playback.

#### ~~Existing DrumPatternEditor - REPLACE ENTIRELY~~ ✅ COMPLETED (2024-12-17)
**Old Location:** ~~`apps/frontend/src/domains/admin/components/DrumPatternEditor.tsx`~~ **DELETED**

**Status:** The old list-based V1 editor has been **removed** from the codebase.
**Replaced with:** `DrumPatternEditor/` - Grid-based drum machine UI with click-to-toggle

**Current integration pattern:**
```
ExerciseFormModal → Upload MIDI → convertDrummerMidi() → Open DrumPatternEditorModal
```

#### Playback Integration - ✅ COMPLETE (Phase 7)
**What exists:**
- ✅ `exercise.drummerMidiUrl` stored in database
- ✅ `DrumMapperService` converts MIDI → DrumHit[]
- ✅ `DrumScheduler` registered with EventRouter
- ✅ Region/pattern structure supports drum events
- ✅ `PlaybackEngine.setDrumBuffers()` method **IMPLEMENTED**
- ✅ Drum buffer loading wired up via CoreServices
- ✅ End-to-end exercise playback with drums **WORKING**

#### Drum Samples - INCOMPLETE ⚠️
**Currently in Supabase (3 samples):**
```
drums/hydrogen-kits/colombo-acoustic/kick-v1.wav
drums/hydrogen-kits/colombo-acoustic/snare-v1.wav
drums/hydrogen-kits/colombo-acoustic/hihat-v1.wav
```

**Required lanes (18 total - from DrumInstrumentProcessor):**
```typescript
// DrumPiece enum - canonical source
enum DrumPiece {
  KICK = 'kick',
  SNARE = 'snare',
  HIHAT_CLOSED = 'hihat_closed',
  HIHAT_OPEN = 'hihat_open',
  HIHAT_PEDAL = 'hihat_pedal',
  CRASH_1 = 'crash_1',
  CRASH_2 = 'crash_2',
  RIDE = 'ride',
  RIDE_BELL = 'ride_bell',
  TOM_1 = 'tom_1',        // High tom
  TOM_2 = 'tom_2',        // Mid tom
  TOM_3 = 'tom_3',        // Low/floor tom
  CLAP = 'clap',
  COWBELL = 'cowbell',
  TAMBOURINE = 'tambourine',
  SHAKER = 'shaker',
  SIDE_STICK = 'side_stick',
}
```

**Sample naming convention:** `{drum}/{drum}-v{1-5}.wav`
- Example: `kick/kick-v1.wav`, `kick/kick-v5.wav`
- 5 velocity layers per drum = **90 total sample files**

**Action:** Upload all samples to Supabase before editor development.

---

### Existing Infrastructure (Reuse)

#### Types & Contracts
```typescript
// libs/contracts/src/types/drum-pattern.ts
interface DrumHit {
  id: string;
  drum: MidiDrumType;
  velocity: number;        // 0-127
  position: MusicalPosition;
  durationTicks: number;
  midiNote: number;
}

type MidiDrumType =
  | 'kick' | 'snare' | 'snare_rimshot'
  | 'hihat' | 'hihat_closed' | 'hihat_open' | 'hihat_pedal'
  | 'crash' | 'ride' | 'ride_bell'
  | 'tom_low' | 'tom_mid' | 'tom_high' | 'floor_tom'
  | 'cowbell' | 'tambourine' | 'clap' | 'unknown';

// libs/contracts/src/types/musical-time.ts
interface MusicalPosition {
  measure: number;      // 0-based
  beat: number;         // 0-based within measure
  subdivision: number;  // 0-3 (16th note level)
  tick?: number;        // 0-479 (480 PPQ precision)
}
```

#### Backend Services
- `MidiParserService` - Parses uploaded MIDI files
- `DrumMapperService` - Converts MIDI notes to DrumHit[]
- `MidiController` - POST /api/v1/midi/parse endpoint

#### Audio System
- `DrumScheduler` - Schedules drum hits for playback
- `DrumInstrumentProcessor` - Full-featured playback engine (USE THIS)
- `WamDrummer` - 16-pad Web Audio sampler
- `DrumPreloadStrategy` - Loads drum samples (needs expansion)
- `GlobalSampleCache` - Caches audio buffers

#### UI Components
- shadcn Dialog, Select, Slider, Button
- VolumeKnob, PlaybackControls patterns

### New Components to Build

```
apps/frontend/src/domains/playback/components/DrumPatternEditor/
├── DrumPatternEditorModal.tsx      # Main modal container
├── DrumGrid.tsx                    # The clickable grid canvas
├── DrumLaneRow.tsx                 # Single instrument row
├── DrumCell.tsx                    # Individual clickable cell
├── DrumEditorTransport.tsx         # Play/Stop/Loop controls
├── GridToolbar.tsx                 # Zoom, snap, resolution
├── SwingControl.tsx                # Swing/shuffle slider
├── VelocityPanel.tsx               # Velocity editing panel
├── PatternLengthSelector.tsx       # 1/2/4/8 bar selector
├── hooks/
│   ├── useDrumEditorStore.ts       # Zustand store
│   ├── useDrumEditorPlayback.ts    # Preview audio logic
│   ├── useDrumGridInteraction.ts   # Mouse/touch handling
│   └── useSwingProcessor.ts        # Swing timing calculation
├── utils/
│   ├── gridPositionUtils.ts        # Position <-> grid cell conversion
│   ├── patternValidation.ts        # Pattern validation
│   └── midiExport.ts               # Export pattern as MIDI
└── types.ts                        # Editor-specific types
```

### State Management

```typescript
// useDrumEditorStore.ts
interface DrumEditorState {
  // Pattern Data
  pattern: DrumHit[];
  patternId: string | null;
  patternName: string;
  bars: number;               // 1, 2, 4, 8
  timeSignature: { numerator: number; denominator: number };

  // Grid Settings
  gridResolution: GridResolution;  // '1/4' | '1/8' | '1/16' | '1/32'
  snapEnabled: boolean;
  zoomLevel: number;          // 0.5 - 2.0

  // Groove Settings
  swingAmount: number;        // 0-100

  // Selection & Editing
  selectedHitIds: Set<string>;
  clipboard: DrumHit[];
  editMode: 'draw' | 'select' | 'velocity';

  // Playback Preview
  isPlaying: boolean;
  isLooping: boolean;
  previewTempo: number;
  currentPlayheadTick: number;

  // Lane Configuration
  lanes: DrumLaneConfig[];
  visibleLanes: MidiDrumType[];

  // History (Undo/Redo)
  history: DrumHit[][];
  historyIndex: number;

  // Actions
  addHit: (drum: MidiDrumType, position: MusicalPosition, velocity?: number) => void;
  removeHit: (hitId: string) => void;
  toggleHit: (drum: MidiDrumType, position: MusicalPosition) => void;
  updateHitVelocity: (hitId: string, velocity: number) => void;
  moveHit: (hitId: string, newPosition: MusicalPosition) => void;

  setSwing: (amount: number) => void;
  setGridResolution: (resolution: GridResolution) => void;
  setBars: (bars: number) => void;
  setTempo: (bpm: number) => void;

  selectHit: (hitId: string, addToSelection?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => void;

  copySelection: () => void;
  pasteClipboard: (position: MusicalPosition) => void;

  undo: () => void;
  redo: () => void;

  clearPattern: () => void;
  loadPattern: (pattern: DrumHit[], metadata?: PatternMetadata) => void;

  play: () => void;
  stop: () => void;
  toggleLoop: () => void;
}

interface DrumLaneConfig {
  drum: MidiDrumType;
  displayName: string;
  color: string;
  midiNote: number;
  volume: number;      // Per-lane volume
  muted: boolean;
  collapsed: boolean;
}

type GridResolution = '1/4' | '1/8' | '1/16' | '1/32';
```

### Playback Integration

```typescript
// useDrumEditorPlayback.ts
export function useDrumEditorPlayback() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const drumBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const { pattern, previewTempo, isLooping, swingAmount } = useDrumEditorStore();

  const loadSamples = useCallback(async () => {
    // Use existing DrumPreloadStrategy to load samples
    const strategy = new DrumPreloadStrategy();
    const result = await strategy.loadEssentialSamples();
    // Map loaded samples to drumBuffersRef
  }, []);

  const schedulePattern = useCallback((startTime: number) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const secondsPerBeat = 60 / previewTempo;

    pattern.forEach(hit => {
      // Convert MusicalPosition to seconds
      const hitTimeSeconds = positionToSeconds(hit.position, secondsPerBeat);

      // Apply swing to even 16th notes
      const swungTime = applySwing(hitTimeSeconds, hit.position, swingAmount);

      // Get buffer for drum type
      const buffer = drumBuffersRef.current.get(hit.drum);
      if (!buffer) return;

      // Create and schedule audio source
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = hit.velocity / 127;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.start(startTime + swungTime);
      scheduledSourcesRef.current.push(source);
    });
  }, [pattern, previewTempo, swingAmount]);

  const play = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    await loadSamples();
    schedulePattern(audioContextRef.current.currentTime);
  }, [loadSamples, schedulePattern]);

  const stop = useCallback(() => {
    scheduledSourcesRef.current.forEach(source => {
      try { source.stop(); } catch {}
    });
    scheduledSourcesRef.current = [];
  }, []);

  return { play, stop, loadSamples };
}
```

---

## UI Design

### Main Editor Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Drum Pattern Editor                                      [Save] [Cancel]│
├──────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ▶ Play  ⏹ Stop  🔁 Loop  │  BPM: [120]  │  Bars: [2▼]  │  4/4      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│  Grid: [16th▼]   Snap: [✓]   │   Swing: [━━━━●━━━━━] 25%   │  Zoom: [-][+]│
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│        │ 1       .       .       .   │ 2       .       .       .   │    │
│        │ 1 e & a 2 e & a 3 e & a 4 e │ 1 e & a 2 e & a 3 e & a 4 e │    │
│  ──────┼─────────────────────────────┼─────────────────────────────┼    │
│  🔴 Kick │[●]      [ ][ ][ ][●]      │[●]      [ ][ ][ ][●]      [ ]│ 🔊 │
│  🟠 Snare│[ ]      [ ][ ][ ][●]      │[ ]      [ ][ ][ ][●]      [ ]│ 🔊 │
│  🟡 HH-C │[●][ ][●][ ][●][ ][●][ ][●]│[●][ ][●][ ][●][ ][●][ ][●][ ]│ 🔊 │
│  🟢 HH-O │[ ]      [ ][ ][ ][ ]   [○]│[ ]      [ ][ ][ ][ ]   [○][ ]│ 🔊 │
│  🔵 Tom-H│[ ]      [ ][ ][ ][ ]      │[ ]      [ ][ ][ ][ ]      [ ]│ 🔊 │
│  🟣 Tom-M│[ ]      [ ][ ][ ][ ]      │[ ]      [ ][ ][ ][ ]      [ ]│ 🔊 │
│  ⚪ Tom-L│[ ]      [ ][ ][ ][ ]      │[ ]      [ ][ ][ ][ ]      [ ]│ 🔊 │
│  💛 Crash│[●]      [ ][ ][ ][ ]      │[ ]      [ ][ ][ ][ ]      [ ]│ 🔊 │
│  ──────┼─────────────────────────────┼─────────────────────────────┼    │
│                    ▲ Playhead                                            │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│  Selected: Kick @ 1.1   │  Velocity: [━━━━━━━●━━] 100   │  [Delete]      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Visual Design Notes

1. **Cell States:**
   - Empty: `[ ]` - Gray/transparent background
   - Hit (normal): `[●]` - Solid color based on drum type
   - Hit (ghost): `[○]` - Outline/dimmed color
   - Hit (accent): `[●]` - Bright/saturated color
   - Selected: Blue border highlight

2. **Velocity Visualization:**
   - Darker/taller cell = higher velocity
   - Or: Color intensity gradient
   - Visual range: 40 (ghost) → 100 (normal) → 127 (accent)

3. **Beat Markers:**
   - Bold lines on beat 1 of each bar
   - Medium lines on beats 2, 3, 4
   - Light lines on subdivisions

4. **Playhead:**
   - Vertical line that moves during playback
   - Color: Bright accent color (cyan/green)

---

## Data Flow

### Creating New Pattern

```
User clicks "New Pattern" button
         │
         ▼
DrumPatternEditorModal opens with empty state
         │
         ▼
User clicks cells in grid → toggleHit() action
         │
         ▼
useDrumEditorStore updates pattern[]
         │
         ▼
Grid re-renders with new hit displayed
         │
         ▼
User clicks Play → useDrumEditorPlayback.play()
         │
         ▼
Samples loaded (DrumPreloadStrategy)
         │
         ▼
Pattern scheduled to Web Audio API
         │
         ▼
User hears preview
         │
         ▼
User clicks Save → onSave(pattern) callback
         │
         ▼
Parent component saves to exercise.drum_pattern
```

### Importing from MIDI

```
User uploads MIDI file
         │
         ▼
MidiParserService extracts drum track
         │
         ▼
DrumMapperService converts to DrumHit[]
         │
         ▼
"Edit in Grid" button appears
         │
         ▼
Click opens DrumPatternEditorModal with loadPattern(hits)
         │
         ▼
Grid displays imported pattern
         │
         ▼
User edits as needed
         │
         ▼
User saves modified pattern
```

---

## Implementation Phases

### Phase 0: Git Baseline + Prerequisites
**Effort: 3-4 days** 🔴 HIGH RISK

**Objective:** Establish clean baseline and prepare all samples/infrastructure before any UI work.

#### Task 0.1: Git Baseline Commit
- [ ] **0.1.1** Create feature branch `feature/drum-pattern-editor`
- [ ] **0.1.2** Commit current codebase state with message: "chore: baseline before drum pattern editor"
- [ ] **0.1.3** Document current drum playback behavior in test notes

#### Task 0.2: Upload Drum Samples to Supabase
**Required:** 18 drums × 5 velocities = **90 sample files**

- [ ] **0.2.1** Prepare samples following naming convention: `{drum}/{drum}-v{1-5}.wav`
  ```
  kick/kick-v1.wav, kick/kick-v2.wav, ..., kick/kick-v5.wav
  snare/snare-v1.wav, snare/snare-v2.wav, ..., snare/snare-v5.wav
  ... (all 18 drums)
  ```
- [ ] **0.2.2** Upload to Supabase bucket: `audio-samples/drums/standard-kit/`
- [ ] **0.2.3** Verify all 90 files uploaded successfully
- [ ] **0.2.4** Test download URLs work from browser

#### Task 0.3: Create Drum Kit Manifest
- [ ] **0.3.1** Create `apps/frontend/src/domains/playback/data/drums/standard-kit.json`:
  ```json
  {
    "name": "Standard Kit",
    "version": "1.0.0",
    "pieces": {
      "kick": { "samples": ["v1", "v2", "v3", "v4", "v5"] },
      "snare": { "samples": ["v1", "v2", "v3", "v4", "v5"] },
      // ... all 18 drums
    },
    "velocityMapping": {
      "v1": { "min": 0, "max": 25 },
      "v2": { "min": 26, "max": 50 },
      "v3": { "min": 51, "max": 76 },
      "v4": { "min": 77, "max": 102 },
      "v5": { "min": 103, "max": 127 }
    }
  }
  ```
- [ ] **0.3.2** Add TypeScript types for drum kit manifest
- [ ] **0.3.3** Test manifest loads correctly

#### Task 0.4: Update Hardcoded Sample Paths (5 locations)
- [ ] **0.4.1** Update `DrumPreloadStrategy.ts` line 178:
  - FROM: `'drums/hydrogen-kits/colombo-acoustic'`
  - TO: `'drums/standard-kit'` (or configurable)
- [ ] **0.4.2** Update `WamDrummer.ts` line 740:
  - FROM: `'drums/hydrogen-kits/colombo-acoustic'`
  - TO: Use manifest-based loading
- [ ] **0.4.3** Update `InitialSamplePreloader.ts` line 1097
- [ ] **0.4.4** Update `InitialSamplePreloader.ts` line 1665
- [ ] **0.4.5** Update `InitialSamplePreloader.ts` essential drums list
- [ ] **0.4.6** Test each location individually after update

#### Task 0.5: Verify & Test
- [ ] **0.5.1** Run existing drum playback tests (if any)
- [ ] **0.5.2** Manually test: load exercise with drums → drums play correctly
- [ ] **0.5.3** Verify all 5 velocity layers trigger for each drum
- [ ] **0.5.4** Check browser console for 404s or loading errors
- [ ] **0.5.5** Commit: "feat(drums): add standard kit with 5 velocity layers"

**Definition of Done:**
- ✅ Feature branch created with baseline commit
- ✅ All 90 drum samples uploaded to Supabase
- ✅ Manifest JSON loads correctly
- ✅ All 5 hardcoded paths updated
- ✅ No regression in existing drum playback
- ✅ All velocities play correctly

---

### Phase 7 Spike: Playback Integration Investigation
**Effort: 1-2 days** 🔴 HIGH RISK - Do this BEFORE building UI

**Objective:** Verify the playback glue code works end-to-end BEFORE investing in UI development.

**Why do this early?**
- DrummerWidget MIDI loading was intentionally disabled (see investigation findings)
- GlobalControls is responsible for loading exercise data
- Unknown: Does `exercise.drum_pattern` JSONB actually get played?
- If playback doesn't work, we need to fix it before building the editor

#### Task 7S.1: Investigate Existing Drum Flow
- [ ] **7S.1.1** Read `GlobalControls.tsx` - find where drum data is loaded
- [ ] **7S.1.2** Read `ExerciseLoader.ts` - check `exercise.drummerMidiUrl` handling
- [ ] **7S.1.3** Trace data flow: exercise → regions → DrumScheduler
- [ ] **7S.1.4** Document findings in `docs/investigations/drum-playback-flow.md`

#### Task 7S.2: Create Minimal Test Exercise
- [ ] **7S.2.1** Create test exercise with hardcoded `drum_pattern` JSONB in database
- [ ] **7S.2.2** Load exercise in widget
- [ ] **7S.2.3** Press Play - do drums play?
- [ ] **7S.2.4** If NO: identify what's missing, document blockers

#### Task 7S.3: Verify DrumScheduler Integration
- [ ] **7S.3.1** Add console.log to DrumScheduler.processEvents()
- [ ] **7S.3.2** Verify scheduler receives drum events during playback
- [ ] **7S.3.3** Check timing accuracy of drum hits
- [ ] **7S.3.4** Remove debug logs after verification

#### Task 7S.4: Document & Decide
- [ ] **7S.4.1** If playback works: document the working flow, proceed to Phase 1
- [ ] **7S.4.2** If playback broken: create list of required fixes
- [ ] **7S.4.3** Estimate additional effort for fixes
- [ ] **7S.4.4** Update story with findings

**GATE DECISION:**
- ✅ **Playback works** → Proceed to Phase 1 (UI)
- ⚠️ **Minor fixes needed** → Fix first (add 1-2 days), then Phase 1
- 🛑 **Major issues** → Escalate, revise story scope

**Definition of Done:**
- ✅ Drum playback flow documented
- ✅ Test exercise plays drums correctly (or blockers identified)
- ✅ DrumScheduler verified receiving events
- ✅ Go/no-go decision made for Phase 1

---

### Phase 1: Core Grid Editor
**Effort: 3-4 days** 🟢 LOW RISK (validated)

**Objective:** Build the visual drum grid editor UI with 18 lanes.

**Prerequisites:** Phase 0 complete, Phase 7 Spike passed

#### Task 1.1: Scaffold New Editor Structure ✅ COMPLETE
- [x] **1.1.1** Create folder: `apps/frontend/src/domains/admin/components/DrumPatternEditor/` ✅
- [x] **1.1.2** Create `types.ts` with TypeScript interfaces ✅
- [x] **1.1.3** Create `constants.ts` with drum lane config (18 drums) ✅
- [x] **1.1.4** Study reference: `LoopGridStrip.tsx` for grid patterns ✅

#### Task 1.2: Implement Zustand Store ✅ COMPLETE
- [x] **1.2.1** Create `hooks/useDrumEditorStore.ts` ✅
- [x] **1.2.2** Define state: `pattern: DrumHit[]`, `selectedHits: Set<string>`, `resolution: GridResolution` ✅
- [x] **1.2.3** Add actions: `toggleHit()`, `setVelocity()`, `selectHit()`, `clearPattern()` ✅ (19 actions total)
- [x] **1.2.4** Add computed: `getHitsForCell()`, `getHitsForLane()` ✅ (8 selectors)
- [ ] **1.2.5** Test store with unit tests

#### Task 1.3: Build Grid Components ✅ COMPLETE
- [x] **1.3.1** Create `DrumGrid.tsx` - main container with SVG/Canvas ✅ (with pinch-zoom support)
- [x] **1.3.2** Create `DrumLaneRow.tsx` - one row per drum (18 rows) ✅
- [x] **1.3.3** Create `DrumCell.tsx` - clickable cell with hit visualization ✅ (with velocity opacity)
- [x] **1.3.4** Add beat/bar vertical markers (every 4 cells = beat) ✅
- [x] **1.3.5** Add horizontal scroll for patterns > 2 bars ✅
- [x] **1.3.6** Test click handling toggles hits correctly ✅

#### Task 1.4: Build Modal Container ✅ COMPLETE
- [x] **1.4.1** Create `DrumPatternEditorModal.tsx` using shadcn Dialog ✅
- [x] **1.4.2** Add header with title, close button ✅
- [x] **1.4.3** Add footer with Save/Cancel buttons ✅
- [x] **1.4.4** Wire `onSave(pattern: DrumHit[])` callback ✅
- [x] **1.4.5** Wire `onCancel()` callback ✅

#### Task 1.5: Integration with ExerciseFormModal ✅ COMPLETE
- [x] **1.5.1** Find existing trigger in `ExerciseFormModal.tsx` (lines 1481-1493) ✅
- [x] **1.5.2** Replace old editor trigger with new modal ✅ (V1 deleted 2024-12-17)
- [x] **1.5.3** Pass current `exercise.drum_pattern` as initial state ✅
- [x] **1.5.4** Save returns `DrumHit[]` to parent form ✅
- [x] **1.5.5** Test: open modal → edit → save → verify data persists ✅

#### Task 1.6: Verify & Commit
- [x] **1.6.1** Test all 18 drum lanes render correctly ✅
- [x] **1.6.2** Test click toggles work for all cells ✅
- [x] **1.6.3** Test save returns correct `DrumHit[]` format ✅
- [ ] **1.6.4** Commit: "feat(admin): add drum pattern grid editor UI"

**Definition of Done:**
- ✅ Grid UI renders 18 lanes
- ✅ Click cells to toggle hits on/off
- ✅ Modal opens from ExerciseFormModal
- ✅ Save returns `DrumHit[]` to parent

---

### Phase 2: Playback Preview
**Effort: 2-3 days** 🟡 MEDIUM RISK — **STATUS: 🟢 ~90% COMPLETE (audio implemented)**

**Objective:** Add audio preview to the grid editor (one-shot clicks + pattern playback).

**Prerequisites:** Phase 1 complete ✅

#### Task 2.1: Create Playback Hook ✅ COMPLETE
- [x] **2.1.1** Create `hooks/useDrumEditorPlayback.ts` ✅
- [x] **2.1.2** Initialize Web Audio API AudioContext on mount ✅ (lightweight approach, not DrumInstrumentProcessor)
- [x] **2.1.3** Load samples from Supabase (kick, snare, hihat) ✅
- [x] **2.1.4** Handle sample loading state (loading/ready/error) ✅
- [x] **2.1.5** Clean up AudioContext and sources on unmount ✅

#### Task 2.2: Implement One-Shot Preview (Click Cell) ✅ COMPLETE
- [x] **2.2.1** Add `previewHit(drum, velocity)` function to hook ✅
- [x] **2.2.2** Use Web Audio AudioBufferSourceNode for immediate playback ✅
- [x] **2.2.3** Wire to `DrumCell.onClick` via DrumGrid → DrumLaneRow prop chain ✅
- [x] **2.2.4** Test: click any cell → hear drum sound immediately ✅

#### Task 2.3: Implement Pattern Playback (Play Button) ✅ COMPLETE
- [x] **2.3.1** Add transport state: `isPlaying`, `currentTime`, `tempo` ✅ (UI state in store)
- [x] **2.3.2** Add `play()` function with Web Audio lookahead scheduling ✅
- [x] **2.3.3** Add `stop()` function to cancel scheduled events ✅
- [x] **2.3.4** Add `loop` mode that reschedules pattern at end ✅

#### Task 2.4: Add Playhead Animation ✅ COMPLETE
- [x] **2.4.1** Create `Playhead.tsx` component (vertical line) ✅ (integrated in DrumCell)
- [x] **2.4.2** Use `requestAnimationFrame` to update position ✅ (in useDrumEditorPlayback)
- [x] **2.4.3** Calculate tick position from `audioContext.currentTime` ✅ (synced via playheadTick)
- [x] **2.4.4** Show/hide based on `isPlaying` state ✅

#### Task 2.5: Add Transport Controls ✅ UI COMPLETE
- [x] **2.5.1** Add Play/Stop button to modal header ✅
- [x] **2.5.2** Add Loop toggle button ✅
- [x] **2.5.3** Add Tempo BPM slider (40-300 BPM) ✅
- [ ] **2.5.4** Display current position (bar:beat)

#### Task 2.6: Verify & Commit
- [ ] **2.6.1** Test: click cell → hear immediate sound
- [ ] **2.6.2** Test: click Play → hear pattern loop
- [ ] **2.6.3** Test: playhead moves in sync with audio
- [ ] **2.6.4** Test: tempo changes affect playback speed
- [ ] **2.6.5** Commit: "feat(admin): add drum pattern preview playback"

**API Reference:**
```typescript
// For IMMEDIATE one-shot preview (click on cell):
processor.playDrumHit({
  drum: hit.drum,
  velocity: hit.velocity / 127,
  time: 0,  // Play NOW
  type: DrumHitType.NORMAL
});

// For SCHEDULED pattern playback (Play button):
processor.triggerDrum({
  drum: hit.drum,
  velocity: hit.velocity / 127,
  time: absoluteAudioContextTime
});
```

**Definition of Done:**
- ✅ Click cell → hear immediate preview sound
- ✅ Click Play → hear pattern loop with scheduled playback
- ✅ Playhead moves across grid in sync
- ✅ Tempo control works

---

### Phase 3: Velocity & Selection
**Effort: 2 days** 🟢 LOW RISK — **STATUS: 🟡 PARTIAL (data layer + visualization done, UI controls missing)**

**Objective:** Add velocity control and multi-selection for editing hits.

**Prerequisites:** Phase 2 complete

#### Task 3.1: Velocity Visualization ✅ COMPLETE
- [x] **3.1.1** Update `DrumCell.tsx` to show velocity as color intensity ✅ (opacity 0.3-1.0)
- [x] **3.1.2** Define color scale: v1 (lightest) → v5 (darkest) ✅
- [x] **3.1.3** Alternative: show velocity as cell height within row ✅ (using opacity instead)
- [x] **3.1.4** Test: different velocities visually distinguishable ✅

#### Task 3.2: Velocity Editor Panel
- [ ] **3.2.1** Create `VelocityPanel.tsx` component (bottom of grid)
- [ ] **3.2.2** Add velocity slider (0-127)
- [x] **3.2.3** Add velocity presets buttons: Ghost (40), Normal (100), Accent (127) ✅ (constants defined)
- [ ] **3.2.4** Wire panel to update selected hit velocity
- [ ] **3.2.5** Re-preview hit when velocity changes

#### Task 3.3: Selection System 🟡 PARTIAL (store ready, UI missing)
- [x] **3.3.1** Add `selectedHits: Set<string>` to store (hit IDs) ✅ (as selectedHitIds[])
- [x] **3.3.2** Click cell → select single hit (show blue border) ✅ (visual + store action)
- [ ] **3.3.3** Shift+click → add to selection (multi-select)
- [ ] **3.3.4** Cmd/Ctrl+click → toggle selection
- [ ] **3.3.5** Click empty area → clear selection
- [x] **3.3.6** Delete/Backspace key → remove selected hits ✅ (store action exists)

#### Task 3.4: Bulk Operations 🟡 PARTIAL (store ready, UI missing)
- [x] **3.4.1** Apply velocity to all selected hits at once ✅ (store action)
- [x] **3.4.2** Delete all selected hits at once ✅ (deleteSelected in store)
- [ ] **3.4.3** Select all hits in a lane (click lane label)

#### Task 3.5: Verify & Commit
- [x] **3.5.1** Test: velocity changes are visible ✅
- [ ] **3.5.2** Test: multi-select works with shift+click
- [ ] **3.5.3** Test: delete key removes selected
- [ ] **3.5.4** Commit: "feat(admin): add velocity control and selection"

**Definition of Done:**
- ✅ Adjust velocity per hit via bottom panel
- ✅ Visual feedback shows velocity differences
- ✅ Multi-select with shift+click works
- ✅ Delete key removes selected hits

---

### Phase 4: Grid Controls & Drag
**Effort: 2 days** 🟢 LOW RISK — **STATUS: 🟡 PARTIAL (controls UI done, drag not implemented)**

**Objective:** Add grid resolution controls, drag-to-move, and pattern length options.

**Prerequisites:** Phase 3 complete

#### Task 4.1: Grid Resolution Controls ✅ COMPLETE
- [x] **4.1.1** Add resolution selector dropdown: 1/8, 1/16, 1/32, triplets ✅ (1/4, 1/8, 1/16, 1/32)
- [x] **4.1.2** Update grid cell width based on resolution ✅
- [x] **4.1.3** Update beat/bar markers for new resolution ✅
- [x] **4.1.4** Maintain existing hits when resolution changes ✅

#### Task 4.2: Snap Control ✅ COMPLETE
- [x] **4.2.1** Add snap toggle button (on/off) ✅ (snapEnabled in store)
- [x] **4.2.2** When ON: new hits snap to grid resolution ✅
- [x] **4.2.3** When OFF: preserve exact 480 PPQ tick values ✅
- [x] **4.2.4** Visual indicator shows snap state ✅

#### Task 4.3: Drag-to-Move Hits
- [ ] **4.3.1** Implement drag handler on `DrumCell`
- [ ] **4.3.2** Show ghost preview while dragging
- [ ] **4.3.3** When snap ON: round to nearest grid position
- [ ] **4.3.4** When snap OFF: preserve fractional tick position
- [ ] **4.3.5** Update store on drop

#### Task 4.4: Pattern Length Control ✅ COMPLETE
- [x] **4.4.1** Add length selector: 1, 2, 4, 8 bars ✅
- [x] **4.4.2** Update grid width for selected length ✅
- [x] **4.4.3** Add horizontal scroll for patterns > viewport width ✅
- [x] **4.4.4** Truncate/preserve hits when shortening pattern ✅

#### Task 4.5: Verify & Commit
- [x] **4.5.1** Test: resolution change updates grid visually ✅
- [ ] **4.5.2** Test: drag hit with snap ON snaps to grid
- [ ] **4.5.3** Test: drag hit with snap OFF preserves exact position
- [x] **4.5.4** Test: 8-bar pattern scrolls horizontally ✅
- [ ] **4.5.5** Commit: "feat(admin): add grid controls and drag functionality"

**Definition of Done:**
- ✅ Change grid resolution, see visual update
- ✅ Drag hits to new positions (snap or free)
- ✅ Pattern length up to 8 bars with scroll
- ✅ 480 PPQ precision preserved when snap OFF

---

### Phase 5: Database & Pattern Library Backend
**Effort: 2.5-3 days** 🟢 LOW RISK (infrastructure exists!)

**Objective:** Build backend API for pattern library CRUD operations.

**Prerequisites:** Phase 4 complete (UI can be built in parallel)

**Note:** Database migration already exists! `20250628000001_create_pattern_library.sql`

#### Task 5.1: Verify Existing Infrastructure
- [ ] **5.1.1** Review `pattern_library` table schema in migration
- [ ] **5.1.2** Verify JSONB column can store `DrumHit[]` format
- [ ] **5.1.3** Check existing indexes are sufficient
- [ ] **5.1.4** Document any schema adjustments needed

#### Task 5.2: Create Backend Module Structure
- [ ] **5.2.1** Create folder: `apps/backend/src/domains/drum-patterns/`
- [ ] **5.2.2** Create `drum-patterns.module.ts`
- [ ] **5.2.3** Register module in `app.module.ts`

#### Task 5.3: Create Entity & Repository
- [ ] **5.3.1** Create `entities/drum-pattern.entity.ts`
- [ ] **5.3.2** Map to `pattern_library` table
- [ ] **5.3.3** Create `drum-pattern.repository.ts` with:
  - `findById()`
  - `findAll(filters)`
  - `create()`
  - `update()`
  - `delete()`
- [ ] **5.3.4** Add search by genre, difficulty, time_signature

#### Task 5.4: Create Service Layer
- [ ] **5.4.1** Create `drum-pattern.service.ts`
- [ ] **5.4.2** Implement business logic for CRUD
- [ ] **5.4.3** Add validation for `DrumHit[]` format
- [ ] **5.4.4** Add slug generation from name

#### Task 5.5: Create Controller & DTOs
- [ ] **5.5.1** Create DTOs in `dto/` folder:
  - `create-drum-pattern.dto.ts`
  - `update-drum-pattern.dto.ts`
  - `drum-pattern-search.dto.ts`
- [ ] **5.5.2** Add Zod validation schemas
- [ ] **5.5.3** Create `drum-pattern.controller.ts`:
  - `GET /api/v1/drum-patterns` (list with filters)
  - `GET /api/v1/drum-patterns/:id`
  - `POST /api/v1/drum-patterns`
  - `PUT /api/v1/drum-patterns/:id`
  - `DELETE /api/v1/drum-patterns/:id`

#### Task 5.6: Verify & Commit
- [ ] **5.6.1** Test all CRUD endpoints via REST client
- [ ] **5.6.2** Test search/filter by genre, difficulty
- [ ] **5.6.3** Verify JSONB storage works correctly
- [ ] **5.6.4** Commit: "feat(backend): add drum pattern library API"

**Files to create:**
```
apps/backend/src/domains/drum-patterns/
├── drum-patterns.module.ts
├── drum-pattern.controller.ts
├── drum-pattern.service.ts
├── drum-pattern.repository.ts
├── entities/drum-pattern.entity.ts
└── dto/
    ├── create-drum-pattern.dto.ts
    ├── update-drum-pattern.dto.ts
    └── drum-pattern-search.dto.ts
```

**Definition of Done:**
- ✅ Full CRUD API for drum patterns
- ✅ Search/filter by genre, difficulty, time signature
- ✅ Works with existing `pattern_library` table

---

### Phase 6: Pattern Library UI
**Effort: 2-3 days** 🟢 LOW RISK

**Objective:** Build UI for saving patterns to library and selecting from library.

**Prerequisites:** Phase 5 complete (backend API ready)

#### Task 6.1: Create API Hook
- [ ] **6.1.1** Create `hooks/useDrumPatternLibrary.ts`
- [ ] **6.1.2** Implement `useQuery` for fetching patterns list
- [ ] **6.1.3** Implement `useMutation` for create/update/delete
- [ ] **6.1.4** Add search/filter parameters
- [ ] **6.1.5** Handle loading and error states

#### Task 6.2: Save to Library Dialog
- [ ] **6.2.1** Create `DrumPatternSaveDialog.tsx`
- [ ] **6.2.2** Add metadata form fields:
  - Name (required)
  - Genre (dropdown)
  - Difficulty (dropdown)
  - Time Signature (dropdown)
  - Tags (multi-select)
  - Description (textarea)
- [ ] **6.2.3** Validate required fields
- [ ] **6.2.4** Call API to save pattern
- [ ] **6.2.5** Show success/error feedback

#### Task 6.3: Pattern Library Picker
- [ ] **6.3.1** Create `DrumPatternLibraryPicker.tsx` modal
- [ ] **6.3.2** Add search input (searches name, tags)
- [ ] **6.3.3** Add filter dropdowns (genre, difficulty, time signature)
- [ ] **6.3.4** Display pattern cards with:
  - Name
  - Genre badge
  - Difficulty badge
  - Bar count
- [ ] **6.3.5** Click card → select pattern

#### Task 6.4: Preview in Picker
- [ ] **6.4.1** Add "Preview" button on pattern cards
- [ ] **6.4.2** Load samples and play pattern preview
- [ ] **6.4.3** Show mini-visualizer while playing
- [ ] **6.4.4** Stop preview when selecting different pattern

#### Task 6.5: Integration with ExerciseFormModal
- [ ] **6.5.1** Add "Select from Library" button to ExerciseFormModal
- [ ] **6.5.2** Open picker modal on click
- [ ] **6.5.3** On select: **COPY** pattern data to exercise (not reference)
- [ ] **6.5.4** Update form state with copied pattern
- [ ] **6.5.5** Test: select pattern → save exercise → verify data persists

#### Task 6.6: Verify & Commit
- [ ] **6.6.1** Test: save pattern to library with metadata
- [ ] **6.6.2** Test: search/filter finds correct patterns
- [ ] **6.6.3** Test: preview plays selected pattern
- [ ] **6.6.4** Test: select copies pattern to exercise (independent)
- [ ] **6.6.5** Commit: "feat(admin): add drum pattern library UI"

**Files to create:**
```
apps/frontend/src/domains/admin/components/
├── DrumPatternLibraryPicker.tsx
├── DrumPatternSaveDialog.tsx
└── hooks/useDrumPatternLibrary.ts
```

**Definition of Done:**
- ✅ Save patterns to library with metadata
- ✅ Browse/search library when creating exercise
- ✅ Preview patterns before selecting
- ✅ Select COPIES pattern (independent, not by reference)

---

### Phase 7 Full: Playback Integration Glue Code
**Effort: 2-3 days** 🟡 MEDIUM RISK (reduced by Phase 7 Spike)

**Objective:** Complete the exercise → drum playback integration for end-user experience.

**Prerequisites:** Phase 6 complete, Phase 7 Spike findings incorporated

**Note:** Most investigation done in Phase 7 Spike. This phase implements the fixes.

**Investigation Finding (2024-12-12):**
DrummerWidget MIDI loading was **intentionally disabled** with comment:
> "DrummerWidget should NOT load MIDI independently - GlobalControls is responsible for loading exercise data and adding regions to tracks. This prevents race conditions."

This is **correct architecture** - GlobalControls handles all exercise loading.

#### Task 7F.1: Implement PlaybackEngine.setDrumBuffers()
- [ ] **7F.1.1** Add `setDrumBuffers(buffers: Map<DrumPiece, AudioBuffer[]>)` method
- [ ] **7F.1.2** Follow pattern from existing `setHarmonyBuffers()` method
- [ ] **7F.1.3** Wire to DrumScheduler internal buffer storage
- [ ] **7F.1.4** Test: buffers are accessible during playback

#### Task 7F.2: Wire Drum Loading in GlobalControls
- [ ] **7F.2.1** Locate exercise loading code in GlobalControls
- [ ] **7F.2.2** Add drum pattern loading from `exercise.drum_pattern` JSONB
- [ ] **7F.2.3** Convert `DrumHit[]` to drum regions
- [ ] **7F.2.4** Add regions to DrumScheduler via EventRouter
- [ ] **7F.2.5** Test: exercise with drum_pattern creates drum regions

#### Task 7F.3: Verify DrumScheduler Receives Events
- [ ] **7F.3.1** Add temporary logging to DrumScheduler.processEvents()
- [ ] **7F.3.2** Play exercise with drum pattern
- [ ] **7F.3.3** Verify events arrive at correct times
- [ ] **7F.3.4** Verify correct drum/velocity values
- [ ] **7F.3.5** Remove temporary logging

#### Task 7F.4: Consolidate Type Definitions
- [ ] **7F.4.1** Compare `pattern.ts` (8 drums) with `drum-pattern.ts` (18 drums)
- [ ] **7F.4.2** Merge all drums into single canonical `DrumPiece` enum
- [ ] **7F.4.3** Update all imports to use consolidated type
- [ ] **7F.4.4** Delete deprecated type definitions
- [ ] **7F.4.5** Run typecheck: `pnpm nx run @bassnotion/contracts:typecheck`

#### Task 7F.5: End-to-End Testing
- [ ] **7F.5.1** Create test exercise with drum pattern in admin
- [ ] **7F.5.2** Load exercise in widget
- [ ] **7F.5.3** Press Play → verify drums play correctly
- [ ] **7F.5.4** Verify timing is accurate (no drift)
- [ ] **7F.5.5** Verify velocity differences audible

#### Task 7F.6: Verify & Commit
- [ ] **7F.6.1** Test: admin creates pattern → user hears drums
- [ ] **7F.6.2** Test: multiple drums play simultaneously
- [ ] **7F.6.3** Test: velocity layers work correctly
- [ ] **7F.6.4** Clean up any debug code
- [ ] **7F.6.5** Commit: "feat(playback): complete drum pattern integration"

**Files to modify:**
- `apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts`
- `apps/frontend/src/domains/widgets/components/.../GlobalControls.tsx`
- `libs/contracts/src/types/pattern.ts` (consolidate types)
- `libs/contracts/src/types/drum-pattern.ts` (keep as canonical)

**Definition of Done:**
- ✅ Exercise with drum_pattern plays drums during playback
- ✅ End-to-end: Admin creates pattern → User hears drums
- ✅ Type definitions consolidated (no duplicates)
- ✅ All 18 drums playable with 5 velocity layers

---

### Phase 8: Polish & UX
**Effort: 2-3 days** 🟢 LOW RISK

**Objective:** Add professional polish, keyboard shortcuts, and final UX improvements.

**Prerequisites:** Phase 7 Full complete

#### Task 8.1: Undo/Redo System
- [ ] **8.1.1** Add history stack to Zustand store
- [ ] **8.1.2** Record state after each edit action
- [ ] **8.1.3** Implement `undo()` action (pop history)
- [ ] **8.1.4** Implement `redo()` action (redo stack)
- [ ] **8.1.5** Add Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts
- [ ] **8.1.6** Add Undo/Redo buttons to toolbar

#### Task 8.2: Copy/Paste Selections
- [ ] **8.2.1** Copy selected hits to clipboard (internal state)
- [ ] **8.2.2** Paste at current playhead position
- [ ] **8.2.3** Offset paste positions if needed
- [ ] **8.2.4** Add Ctrl+C / Ctrl+V keyboard shortcuts

#### Task 8.3: Keyboard Shortcuts
- [ ] **8.3.1** Space = Play/Stop toggle
- [ ] **8.3.2** Delete/Backspace = Remove selected hits
- [ ] **8.3.3** Ctrl+A = Select all hits
- [ ] **8.3.4** Escape = Clear selection
- [ ] **8.3.5** Arrow keys = Move selection to adjacent cells
- [ ] **8.3.6** Add keyboard shortcuts help tooltip

#### Task 8.4: Lane Controls
- [ ] **8.4.1** Add Mute button per lane (grays out, skips in playback)
- [ ] **8.4.2** Add Solo button per lane (only plays that lane)
- [ ] **8.4.3** Add Volume slider per lane (0-100%)
- [ ] **8.4.4** Save mute/solo/volume state in session (not persisted)

#### Task 8.5: Loading States & Error Handling
- [ ] **8.5.1** Show loading spinner while samples load
- [ ] **8.5.2** Show error toast if sample loading fails
- [ ] **8.5.3** Disable Play button until samples ready
- [ ] **8.5.4** Show "Unsaved changes" warning on close

#### Task 8.6: Visual Polish
- [ ] **8.6.1** Add subtle animations for hit toggles
- [ ] **8.6.2** Add hover effects on cells
- [ ] **8.6.3** Improve focus/accessibility states
- [ ] **8.6.4** Add tooltips for all controls
- [ ] **8.6.5** Ensure consistent spacing and alignment

#### Task 8.7: Final Testing & Commit
- [ ] **8.7.1** Test all keyboard shortcuts work
- [ ] **8.7.2** Test undo/redo across multiple operations
- [ ] **8.7.3** Test mute/solo during playback
- [ ] **8.7.4** Test error handling with broken samples
- [ ] **8.7.5** Accessibility audit (keyboard navigation)
- [ ] **8.7.6** Commit: "feat(admin): polish drum pattern editor UX"

**Definition of Done:**
- ✅ Undo/redo works across all operations
- ✅ All keyboard shortcuts functional
- ✅ Mute/solo/volume controls work during preview
- ✅ Professional admin tool ready for content creation
- ✅ Accessible via keyboard navigation

---

## Database Changes

### Pattern Library Table (Required for US-7, US-8)

```sql
-- Reusable drum pattern library
CREATE TABLE drum_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metadata
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,

  -- Classification (matches exercise categorization patterns)
  genre VARCHAR(100),                -- 'rock', 'jazz', 'funk', 'latin', 'reggae'
  difficulty VARCHAR(50) NOT NULL DEFAULT 'intermediate',  -- 'beginner', 'intermediate', 'advanced'
  time_signature VARCHAR(10) NOT NULL DEFAULT '4/4',       -- '4/4', '3/4', '6/8'
  bars INTEGER NOT NULL DEFAULT 4,
  tempo_min INTEGER DEFAULT 60,      -- Suggested min BPM
  tempo_max INTEGER DEFAULT 180,     -- Suggested max BPM

  -- Pattern data
  drum_hits JSONB NOT NULL,          -- DrumHit[] - the actual pattern

  -- Storage (optional MIDI backup)
  midi_file_url VARCHAR(500),

  -- Tagging & Status
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Tracking
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for filtering
CREATE INDEX idx_drum_patterns_slug ON drum_patterns(slug);
CREATE INDEX idx_drum_patterns_genre ON drum_patterns(genre);
CREATE INDEX idx_drum_patterns_difficulty ON drum_patterns(difficulty);
CREATE INDEX idx_drum_patterns_time_signature ON drum_patterns(time_signature);
CREATE INDEX idx_drum_patterns_tags ON drum_patterns USING GIN(tags);
CREATE INDEX idx_drum_patterns_is_active ON drum_patterns(is_active);

-- Full-text search
ALTER TABLE drum_patterns ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(genre, ''))
  ) STORED;
CREATE INDEX idx_drum_patterns_search ON drum_patterns USING GIN(search_vector);
```

### Exercise Table Modification (Hybrid Approach)

```sql
-- Add reference to library patterns
ALTER TABLE exercises ADD COLUMN drum_pattern_id UUID REFERENCES drum_patterns(id);

-- Keep existing drum_pattern JSONB for custom/modified patterns
-- Logic: If drum_pattern_id set → use library pattern
--        If drum_pattern JSONB has data → use custom pattern
--        Exercise can "snapshot" a library pattern into JSONB if needed
```

### Supported Genres (from investigation)
```
rock, jazz, funk, latin, reggae, shuffle, bossa_nova, pop, r&b, metal, country
```

---

## API Changes

### Existing Endpoints (Reuse)
- `POST /api/v1/midi/parse` - Parse MIDI files
- `POST /api/v1/midi/convert-drums` - Convert MIDI to DrumHit[]
- `PUT /api/v1/exercises/:id` - Save exercise with drum_pattern

### New Endpoints: Pattern Library

```typescript
// CRUD for drum patterns
POST   /api/v1/drum-patterns              // Create new pattern
GET    /api/v1/drum-patterns              // List all (with pagination)
GET    /api/v1/drum-patterns/:id          // Get single pattern
PUT    /api/v1/drum-patterns/:id          // Update pattern
DELETE /api/v1/drum-patterns/:id          // Delete pattern

// Search & Filter
GET    /api/v1/drum-patterns/search?q=rock&genre=rock&difficulty=beginner&time_signature=4/4

// Slug-based lookup
GET    /api/v1/drum-patterns/slug/:slug   // Get pattern by slug
```

### Backend DTOs Needed

```typescript
// libs/contracts/src/dtos/drum-pattern.dto.ts
interface CreateDrumPatternDto {
  name: string;
  description?: string;
  genre?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  time_signature: string;
  bars: number;
  tempo_min?: number;
  tempo_max?: number;
  drum_hits: DrumHit[];
  tags?: string[];
}

interface DrumPatternResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  genre?: string;
  difficulty: string;
  time_signature: string;
  bars: number;
  tempo_min?: number;
  tempo_max?: number;
  drum_hits: DrumHit[];
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DrumPatternSearchDto {
  q?: string;           // Full-text search
  genre?: string;
  difficulty?: string;
  time_signature?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}
```

---

## Legacy Code Cleanup - ✅ COMPLETED (2024-12-17)

**Original Findings (2024-12-12):**
The investigation revealed 8+ active drum-related systems that needed consolidation.

### Files Deprecated/Removed
| File | Reason | Status |
|------|--------|--------|
| ~~`apps/frontend/src/domains/admin/components/DrumPatternEditor.tsx`~~ | List-based V1 editor | ✅ **DELETED** (2024-12-17) |
| Multiple drum sample loading approaches | Inconsistent | ⚠️ Consolidated into DrumPreloadStrategy |

### Type Definition Consolidation
| File | Drums Defined | Status |
|------|---------------|--------|
| `libs/contracts/src/types/pattern.ts` | 8 drums | ⚠️ Needs merge into drum-pattern.ts |
| `libs/contracts/src/types/drum-pattern.ts` | 18+ drums | ✅ Canonical source |

### Active Systems (Verified Working)
1. `DrumInstrumentProcessor` - 1,579 lines, production playback engine ✅
2. `DrumScheduler` - Registered with EventRouter ✅
3. `DrumPreloadStrategy` - Sample loading with configurable paths ✅
4. `WamDrummer` - 16-pad sampler (used by processor) ✅
5. `DrumMapperService` - MIDI → DrumHit[] conversion ✅
6. `InitialSamplePreloader` - Uses configurable paths ✅

### Cleanup Tasks Status
- [x] ~~Remove old `DrumPatternEditor.tsx` after new editor is working~~ **DONE 2024-12-17**
- [ ] Merge pattern.ts drum types into drum-pattern.ts
- [x] ~~Remove hardcoded sample paths (5 locations)~~ **DONE - Uses DEFAULT_KIT_PATH**
- [x] ~~Add deprecation comments to files being phased out~~ **N/A - V1 deleted**

---

## Testing Strategy

### Unit Tests

```typescript
// gridPositionUtils.test.ts
describe('gridPositionUtils', () => {
  it('converts MusicalPosition to grid cell index', () => {});
  it('converts grid cell to MusicalPosition', () => {});
  it('handles different grid resolutions', () => {});
  it('applies snap-to-grid correctly', () => {});
});

// useSwingProcessor.test.ts
describe('useSwingProcessor', () => {
  it('applies 0% swing (no change)', () => {});
  it('applies 50% swing correctly', () => {});
  it('only affects even 16th notes', () => {});
});

// useDrumEditorStore.test.ts
describe('useDrumEditorStore', () => {
  it('adds hit at correct position', () => {});
  it('removes hit by id', () => {});
  it('toggles hit on/off', () => {});
  it('updates velocity', () => {});
  it('handles undo/redo', () => {});
});
```

### Integration Tests

```typescript
// DrumPatternEditor.integration.test.ts
describe('DrumPatternEditor', () => {
  it('loads pattern and displays in grid', () => {});
  it('click adds hit and updates store', () => {});
  it('preview plays correct sounds', () => {});
  it('save returns updated pattern', () => {});
});
```

### E2E Tests

```typescript
// drum-editor.e2e.spec.ts
describe('Drum Pattern Editor', () => {
  it('creates new pattern from scratch', () => {});
  it('imports MIDI and edits in grid', () => {});
  it('plays preview with loop', () => {});
  it('saves pattern to exercise', () => {});
});
```

---

## Risks & Mitigations

### Original Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Audio latency in preview | Medium | Medium | Use Web Audio API scheduling, not setTimeout |
| Grid performance with many hits | Low | Low | Use virtualization if >1000 hits |
| Mobile touch interaction | Medium | Medium | Add touch event handlers, larger hit targets |
| Browser AudioContext restrictions | High | High | Require user gesture before playing |
| Sample loading slow | Medium | Medium | Show loading indicator, use cached samples |

### NEW Risks from Validation (2024-12-12)

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Phase 0 underestimated** | HIGH | HIGH | Budget 3-4 days, not 1-2. Upload all samples BEFORE Phase 1 |
| **5 hardcoded paths** | HIGH | HIGH | Update all 5 simultaneously, test each location |
| **GlobalControls drum disabled** | HIGH | MEDIUM | Investigate WHY before Phase 7 - may reveal blocking issue |
| **Type mismatch (8 vs 18 drums)** | MEDIUM | HIGH | Consolidate types BEFORE Phase 1 to avoid integration issues |
| **ExerciseLoader unknown API** | MEDIUM | MEDIUM | Spike investigation in Phase 7, document findings |
| **Two sample loading systems** | MEDIUM | MEDIUM | Keep both in sync until consolidation sprint |
| **Current editor 2,104 lines** | LOW | HIGH | Incremental refactor, don't try to replace everything at once |

### Critical Path Dependencies
```
Phase 0 (samples) → Phase 1 (grid) → Phase 2 (preview)
                                          ↓
Phase 5 (backend) → Phase 6 (library UI) → Phase 7 (glue)
```

**BLOCKING**: Phase 2 cannot start without Phase 0 (samples must exist)
**BLOCKING**: Phase 7 may uncover issues that affect Phase 2 approach

---

## Success Metrics

1. **Functional:** Pattern created in editor plays correctly in exercise playback
2. **Performance:** Grid renders 500+ hits at 60fps
3. **UX:** User can create basic 2-bar pattern in <60 seconds
4. **Audio:** Preview latency <50ms from click to sound
5. **Accuracy:** 480 PPQ precision maintained through edit/save cycle

---

## Dependencies

### Must Have Before Starting
- [ ] Drum samples uploaded to Supabase (kick, snare, hihat, toms, crash, ride)
- [ ] `DrumPreloadStrategy` working and tested
- [ ] `DrumScheduler` verified for exercise playback

### External Dependencies
- shadcn/ui components (Dialog, Select, Slider, Button)
- Zustand (state management)
- Web Audio API (browser native)

---

## Open Questions

1. **Q:** Should we support MIDI export from the editor?
   **A:** Nice-to-have for Phase 7, not MVP

2. **Q:** Should patterns be shareable between exercises?
   **A:** Future feature (Pattern Library), not MVP

3. **Q:** Support for custom drum samples per exercise?
   **A:** Out of scope for this story, create separate story

4. **Q:** Support for triplet/shuffle grid modes?
   **A:** Swing covers most use cases, triplet grid can be Phase 7

---

## References

- [DrumPatternEditor](../apps/frontend/src/domains/admin/components/DrumPatternEditor/) - Current grid-based editor
- [DrumHit Types](../libs/contracts/src/types/drum-pattern.ts)
- [DrumScheduler](../apps/frontend/src/domains/playback/services/core/region-processing/scheduling/)
- [DrumPreloadStrategy](../apps/frontend/src/domains/playback/modules/preloading/strategies/DrumPreloadStrategy.ts)
- [Musical Time Constants](../libs/contracts/src/types/musical-time.ts)
- [Drum Kit Manifest](../apps/frontend/src/domains/playback/data/drums/standard-kit.json) - Sample configuration

---

## Appendix A: Keyboard Shortcuts (Phase 7)

| Key | Action |
|-----|--------|
| `Space` | Play/Stop |
| `L` | Toggle Loop |
| `Delete` / `Backspace` | Delete selected |
| `Ctrl/Cmd + A` | Select all |
| `Ctrl/Cmd + C` | Copy selection |
| `Ctrl/Cmd + V` | Paste |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `1` | Set velocity: Ghost (40) |
| `2` | Set velocity: Soft (70) |
| `3` | Set velocity: Normal (100) |
| `4` | Set velocity: Accent (127) |
| `+` / `=` | Zoom in |
| `-` | Zoom out |

---

## Appendix B: Drum Color Palette

```typescript
const DRUM_EDITOR_COLORS = {
  kick: '#EF4444',      // Red
  snare: '#F97316',     // Orange
  hihat: '#EAB308',     // Yellow
  hihat_open: '#84CC16', // Lime
  tom_high: '#22C55E',  // Green
  tom_mid: '#14B8A6',   // Teal
  tom_low: '#3B82F6',   // Blue
  floor_tom: '#6366F1', // Indigo
  crash: '#A855F7',     // Purple
  ride: '#EC4899',      // Pink
  cowbell: '#78716C',   // Stone
};
```

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2024-12-12 | Claude Code | Initial story creation |
| 2024-12-12 | Claude Code | Added investigation findings: DrumInstrumentProcessor (reuse), playback integration (40% complete), sample status |
| 2024-12-12 | Claude Code | Added US-7 (Pattern Library) and US-8 (Pattern-Exercise Linking) |
| 2024-12-12 | Claude Code | Expanded to 9 phases including Phase 0 (Prerequisites) and Phase 5-7 (Backend/Library/Glue) |
| 2024-12-12 | Claude Code | Added full database schema for drum_patterns table with indexes |
| 2024-12-12 | Claude Code | Added API endpoints and DTOs for pattern library |
| 2024-12-12 | Claude Code | **VALIDATION ROUND**: Deployed 6 investigation agents to validate all phases |
| 2024-12-12 | Claude Code | **Phase 0 revised**: 3-4 days (was 1-2), found 5 hardcoded paths, only 3 samples exist |
| 2024-12-12 | Claude Code | **Phase 1 validated**: 3-4 days realistic, props stable, reusable patterns exist |
| 2024-12-12 | Claude Code | **Phase 2 clarified**: Use `playDrumHit()` for preview, `triggerDrum()` for scheduled playback |
| 2024-12-12 | Claude Code | **Phase 5 reduced**: 2.5-3 days (was 3-4), database migration already exists! |
| 2024-12-12 | Claude Code | **Phase 7 increased**: 3-4 days (was 2-3), missing glue code, disabled GlobalControls |
| 2024-12-12 | Claude Code | Added Legacy Code Cleanup section with 8+ active systems identified |
| 2024-12-12 | Claude Code | Added NEW Risks from Validation section with critical path dependencies |
| 2024-12-12 | Claude Code | Added Timeline Summary with revised estimates (22-28 days total) |
| 2024-12-12 | Claude Code | **ARCHITECTURE DECISIONS**: Confirmed COPY approach (not reference) for pattern-exercise linking |
| 2024-12-12 | Claude Code | **DRUMS EXPANDED**: 14 → 18 lanes (full DrumPiece enum from DrumInstrumentProcessor) |
| 2024-12-12 | Claude Code | **VELOCITY LAYERS**: 5 layers (v1-v5) matching piano convention, 90 total samples |
| 2024-12-12 | Claude Code | **INVESTIGATION RESOLVED**: GlobalControls drum loading disabled intentionally (correct architecture) |
| 2024-12-12 | Claude Code | **PHASE RESTRUCTURE**: Added Phase 7 Spike (1-2 days) for early risk mitigation |
| 2024-12-12 | Claude Code | **ALL PHASES UPDATED**: Added detailed task lists with subtasks (0.x.x format) for all 10 phases |
| 2024-12-12 | Claude Code | **PHASE ORDER**: Sequential chain - Phase 0 → 7 Spike → 1 → 2 → 3 → 4 → 5 → 6 → 7 Full → 8 |
| 2024-12-12 | Claude Code | **GIT BASELINE**: Added Task 0.1 for feature branch and baseline commit |
| 2024-12-17 | Claude Code | **V1 EDITOR REMOVED**: Deleted DrumPatternEditor.tsx (V1 list-based editor) |
| 2024-12-17 | Claude Code | **IMPLEMENTATION STATUS UPDATE**: Phase 0 ✅, Phase 1 ✅, Phase 7 ✅ complete. Phase 2-3 partial (UI only, no audio). |
| 2024-12-17 | Claude Code | **DOCS UPDATED**: Updated references, removed V1 mentions, marked completed tasks |
| 2024-12-17 | Claude Code | **DETAILED TASK AUDIT**: Marked individual subtasks complete in Phases 1-4. Phase 1: 100%, Phase 2: ~30% (UI only), Phase 3: ~60% (data+viz), Phase 4: ~75% (no drag) |
