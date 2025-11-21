# Professional Bass Guitar Instrument Architecture

## Overview

This document outlines the architecture for a professional-grade bass guitar virtual instrument with advanced articulation support, multi-velocity sampling, and realistic playback features.

**Key Innovation**: Admin-defined articulation matrix during MIDI upload, seamlessly integrated with existing fretboard visualizer and sheet music player.

## Core Design Principles

1. **String-Aware Sampling**: Organize samples by bass string (E, A, D, G) to preserve authentic timbral characteristics
2. **Admin Articulation Matrix**: Manual articulation definition during MIDI upload via intuitive UI
3. **Pre-Recorded Articulation Samples**: Real recorded hammer-ons, pull-offs, and slides for maximum realism
4. **Round-Robin Variation**: Natural variation through multiple sample takes (3x per note)
5. **Multi-Technique Support**: Normal fingerstyle, slap, and muted techniques with 5 velocity layers each
6. **Integration with Existing System**: Leverages current MIDI parser → Supabase JSONB → Fretboard/Sheet Music workflow
7. **Sample-Accurate Prescheduling**: Articulation samples blend seamlessly with absolute tick timing

## Admin Workflow - Articulation Matrix Interface

### Current System (Existing)

Your system already has this workflow for bass MIDI:

1. **Upload MIDI** → Stored in Supabase temp storage
2. **Parse MIDI** → `/api/v1/midi/parse` returns `measures[]` with `MidiNoteEvent[]`
3. **Set Anchors** → Admin sets anchor positions per measure
4. **Convert to Fretboard** → `/api/v1/midi/convert` returns `GeneratedExerciseNote[]`
5. **Save to Database** → Exercise saved with fretboard positions in JSONB
6. **Display** → Fretboard visualizer + Sheet music player render the notes

### New Enhancement - Articulation Matrix Step

We insert a **new step** between "Parse MIDI" and "Set Anchors":

```
1. Upload MIDI
2. Parse MIDI → Get measures with notes
3. ✨ ARTICULATION MATRIX ✨ ← NEW STEP
   - Admin sees all notes in table/grid format
   - Admin marks articulations for each note
   - Admin defines transitions (hammer-on E2→F#2, slide-up D2→G2, etc.)
4. Set Anchors
5. Convert to Fretboard (now includes articulation metadata)
6. Save to Database
7. Display (with articulation indicators)
```

### Articulation Matrix UI Design

The admin sees a **note-by-note editor** after parsing:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Bass MIDI Articulation Editor - "Come Together Exercise"          │
├─────────────────────────────────────────────────────────────────────┤
│  Measure 1                                           BPM: 95  4/4   │
├───┬──────┬──────┬────────┬──────────┬─────────────────────────────┤
│ # │ Note │ Time │ Velocity│ Technique│ Articulation                │
├───┼──────┼──────┼────────┼──────────┼─────────────────────────────┤
│ 1 │ E2   │ 0:0:0│   80   │ [Normal▼]│ [Normal     ▼]              │
│ 2 │ F#2  │ 0:0:1│   70   │ [Normal▼]│ [Hammer-On from E2▼]  ← !  │
│ 3 │ A2   │ 0:1:0│   85   │ [Normal▼]│ [Normal     ▼]              │
│ 4 │ A2   │ 0:1:2│   30   │ [Normal▼]│ [Ghost Note ▼]              │
│ 5 │ D2   │ 0:2:0│   90   │ [Slap  ▼]│ [Normal     ▼]              │
│ 6 │ G2   │ 0:2:2│   88   │ [Slap  ▼]│ [Slide-Up from D2▼]  ← !   │
└───┴──────┴──────┴────────┴──────────┴─────────────────────────────┘

Technique Options: Normal | Slap | Muted
Articulation Options:
  - Normal
  - Ghost Note
  - Accent
  - Hammer-On (from: [dropdown of previous notes on same string])
  - Pull-Off (from: [dropdown])
  - Slide-Up (from: [dropdown])
  - Slide-Down (from: [dropdown])
  - Bend
  - Trill (between: [note dropdown])

[Auto-Detect Suggestions] [Save Articulations] [Preview Audio]
```

### Data Structure Enhancement

We extend your existing `GeneratedExerciseNote` with articulation metadata:

```typescript
export const BassArticulationSchema = z.object({
  /** Articulation type */
  type: z.enum([
    'normal',
    'ghost-note',
    'accent',
    'hammer-on',
    'pull-off',
    'slide-up',
    'slide-down',
    'bend',
    'trill'
  ]),

  /** Source note for transitions (e.g., "E2" in E2→F#2 hammer-on) */
  fromNote: z.string().optional(),

  /** Target note for transitions (e.g., "F#2" in E2→F#2 hammer-on) */
  toNote: z.string().optional(),

  /**
   * DEPRECATED: transitionOffset no longer used with pre-recorded samples
   * Kept for backward compatibility
   */
  transitionOffset: z.number().optional(),

  /**
   * Crossfade duration for blending to sustained note (in seconds)
   * Only used when articulation sample is shorter than note duration
   */
  crossfadeDuration: z.number().optional(),
});

export const GeneratedBassNoteSchema = GeneratedExerciseNoteSchema.extend({
  /** Bass playing technique */
  technique: z.enum(['normal', 'slap', 'muted']).default('normal'),

  /** Articulation metadata */
  articulation: BassArticulationSchema.default({ type: 'normal' }),
});

export type GeneratedBassNote = z.infer<typeof GeneratedBassNoteSchema>;
```

### Backend Service - BassMapperService

New service similar to `FretboardMapperService` and `HarmonyMapperService`:

```typescript
// apps/backend/src/domains/exercises/services/bass-mapper.service.ts

@Injectable()
export class BassMapperService {
  /**
   * Convert parsed MIDI to bass notes with articulations
   * Called after admin defines articulations in UI
   */
  async convertMidiToBass(
    measures: ParsedMeasure[],
    anchors: MeasureAnchor[],
    articulationMatrix: ArticulationMatrixEntry[],
    bassType: '4' | '5' | '6' = '4',
    correlationId?: string
  ): Promise<{
    notes: GeneratedBassNote[];
    playability: PlayabilityMetrics;
  }> {
    // 1. Convert to fretboard positions (using existing algorithm)
    const fretboardResult = await this.fretboardMapperService.convertMidiToFretboard(
      measures,
      anchors,
      bassType,
      correlationId
    );

    // 2. Enrich with articulation metadata from admin's matrix
    const bassNotes = fretboardResult.notes.map((note, index) => {
      const articulationEntry = articulationMatrix.find(
        entry => entry.noteIndex === index || entry.noteId === note.id
      );

      return {
        ...note,
        technique: articulationEntry?.technique || 'normal',
        articulation: articulationEntry?.articulation || { type: 'normal' }
      };
    });

    return {
      notes: bassNotes,
      playability: fretboardResult.playability
    };
  }

  /**
   * Auto-suggest articulations based on MIDI patterns
   * (Optional helper - admin can accept/reject suggestions)
   */
  suggestArticulations(
    measures: ParsedMeasure[]
  ): ArticulationSuggestion[] {
    const suggestions: ArticulationSuggestion[] = [];

    for (const measure of measures) {
      for (let i = 0; i < measure.notes.length; i++) {
        const current = measure.notes[i];
        const previous = i > 0 ? measure.notes[i - 1] : null;

        // Ghost note suggestion (low velocity)
        if (current.velocity < 40) {
          suggestions.push({
            noteIndex: i,
            measureNumber: measure.measureNumber,
            suggestion: { type: 'ghost-note' },
            confidence: 0.9,
            reason: `Low velocity (${current.velocity}) indicates ghost note`
          });
        }

        // Hammer-on/pull-off suggestion (overlapping notes, small interval)
        if (previous) {
          const overlap = this.calculateOverlap(previous, current);
          const interval = Math.abs(current.pitch - previous.pitch);

          if (overlap > 0 && interval <= 4) {
            const type = current.pitch > previous.pitch ? 'hammer-on' : 'pull-off';
            suggestions.push({
              noteIndex: i,
              measureNumber: measure.measureNumber,
              suggestion: {
                type,
                fromNote: previous.name,
                transitionOffset: 0.125 // 16th note
              },
              confidence: 0.7,
              reason: `Overlapping notes with ${interval} semitone interval`
            });
          }
        }
      }
    }

    return suggestions;
  }
}
```

### Frontend Admin UI Component

```typescript
// apps/frontend/src/domains/admin/components/BassArticulationMatrix.tsx

interface BassArticulationMatrixProps {
  measures: ParsedMeasure[];
  onArticulationsComplete: (matrix: ArticulationMatrixEntry[]) => void;
}

export function BassArticulationMatrix({ measures, onArticulationsComplete }: Props) {
  const [matrix, setMatrix] = useState<ArticulationMatrixEntry[]>([]);
  const [suggestions, setSuggestions] = useState<ArticulationSuggestion[]>([]);

  // Auto-suggest articulations on mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      const result = await apiClient.post('/api/v1/midi/suggest-articulations', {
        measures
      });
      setSuggestions(result.suggestions);
    };
    fetchSuggestions();
  }, [measures]);

  const updateArticulation = (noteIndex: number, articulation: BassArticulation) => {
    setMatrix(prev => {
      const existing = prev.find(e => e.noteIndex === noteIndex);
      if (existing) {
        return prev.map(e => e.noteIndex === noteIndex ? { ...e, articulation } : e);
      } else {
        return [...prev, { noteIndex, articulation, technique: 'normal' }];
      }
    });
  };

  return (
    <div className="bass-articulation-matrix">
      <h2>Bass Articulation Editor</h2>

      {/* Auto-suggestions panel */}
      {suggestions.length > 0 && (
        <SuggestionsPanel
          suggestions={suggestions}
          onAccept={(suggestion) => {
            updateArticulation(suggestion.noteIndex, suggestion.suggestion);
          }}
        />
      )}

      {/* Note table */}
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Note</th>
            <th>Time</th>
            <th>Velocity</th>
            <th>Technique</th>
            <th>Articulation</th>
            <th>From Note</th>
          </tr>
        </thead>
        <tbody>
          {measures.flatMap((measure, mIdx) =>
            measure.notes.map((note, nIdx) => {
              const noteIndex = /* calculate global index */;
              const entry = matrix.find(e => e.noteIndex === noteIndex);

              return (
                <tr key={`${mIdx}-${nIdx}`}>
                  <td>{noteIndex + 1}</td>
                  <td>{note.name}</td>
                  <td>{note.position?.toString()}</td>
                  <td>{note.velocity}</td>
                  <td>
                    <TechniqueSelector
                      value={entry?.technique || 'normal'}
                      onChange={(technique) => {
                        setMatrix(prev => /* update technique */);
                      }}
                    />
                  </td>
                  <td>
                    <ArticulationSelector
                      value={entry?.articulation.type || 'normal'}
                      onChange={(type) => {
                        updateArticulation(noteIndex, { type });
                      }}
                    />
                  </td>
                  <td>
                    {(entry?.articulation.type === 'hammer-on' ||
                      entry?.articulation.type === 'pull-off' ||
                      entry?.articulation.type === 'slide-up' ||
                      entry?.articulation.type === 'slide-down') && (
                      <FromNoteSelector
                        currentNote={note}
                        previousNotes={/* notes before this one */}
                        value={entry.articulation.fromNote}
                        onChange={(fromNote) => {
                          updateArticulation(noteIndex, {
                            ...entry.articulation,
                            fromNote
                          });
                        }}
                      />
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <button onClick={() => onArticulationsComplete(matrix)}>
        Save Articulations & Continue
      </button>
    </div>
  );
}
```

### Complete Workflow Integration

```typescript
// apps/frontend/src/domains/admin/pages/BassExerciseUpload.tsx

export function BassExerciseUploadPage() {
  const [step, setStep] = useState<'upload' | 'parse' | 'articulate' | 'anchors' | 'save'>('upload');
  const [midiUrl, setMidiUrl] = useState<string>('');
  const [parsedMeasures, setParsedMeasures] = useState<ParsedMeasure[]>([]);
  const [articulationMatrix, setArticulationMatrix] = useState<ArticulationMatrixEntry[]>([]);
  const [anchors, setAnchors] = useState<MeasureAnchor[]>([]);

  // Step 1: Upload MIDI
  const handleUpload = async (file: File) => {
    const uploadResult = await uploadToSupabase(file);
    setMidiUrl(uploadResult.publicUrl);
    setStep('parse');
  };

  // Step 2: Parse MIDI
  const handleParse = async () => {
    const result = await apiClient.post('/api/v1/midi/parse', {
      midiUrl,
      bpm: 95,
      timeSignature: { numerator: 4, denominator: 4 },
      totalBars: 4
    });
    setParsedMeasures(result.measures);
    setStep('articulate'); // NEW STEP
  };

  // Step 3: Define Articulations (NEW)
  const handleArticulationsComplete = (matrix: ArticulationMatrixEntry[]) => {
    setArticulationMatrix(matrix);
    setStep('anchors');
  };

  // Step 4: Set Anchors
  const handleAnchorsComplete = (anchors: MeasureAnchor[]) => {
    setAnchors(anchors);
    setStep('save');
  };

  // Step 5: Convert & Save
  const handleSave = async () => {
    // Convert to bass notes with articulations
    const conversionResult = await apiClient.post('/api/v1/midi/convert-bass', {
      measures: parsedMeasures,
      anchors,
      articulationMatrix,
      bassType: '4'
    });

    // Save exercise with bass notes
    await apiClient.post('/api/v1/exercises', {
      name: 'Come Together',
      bassNotes: conversionResult.notes,
      // ... other fields
    });
  };

  return (
    <div>
      {step === 'upload' && <MidiUploader onUpload={handleUpload} />}
      {step === 'parse' && <ParseButton onParse={handleParse} />}
      {step === 'articulate' && (
        <BassArticulationMatrix
          measures={parsedMeasures}
          onArticulationsComplete={handleArticulationsComplete}
        />
      )}
      {step === 'anchors' && (
        <AnchorEditor
          measures={parsedMeasures}
          onComplete={handleAnchorsComplete}
        />
      )}
      {step === 'save' && <SaveButton onSave={handleSave} />}
    </div>
  );
}
```

## Architecture Components

### 1. BassVelocitySampler (Main Class)

The primary interface following the WurlitzerVelocitySampler pattern.

**Responsibilities:**
- Load and manage bass sample library from JSON config
- Coordinate between technique manager, articulation engine, and noise engine
- Provide high-level playback API
- Handle sustain pedal (CC64) and expression controls

**Key Methods:**
```typescript
async initialize(requiredNotes?: string[], techniques?: string[]): Promise<void>
async triggerAttackRelease(note: string, duration: any, time?: any, velocity?: number): Promise<void>
async triggerAttack(note: string, time?: any, velocity?: number): Promise<void>
triggerRelease(note: string, time?: any): void
async triggerWithArticulation(event: BassPlaybackEvent): Promise<void>
setSustain(value: number, time?: any): void
setTechnique(technique: 'normal' | 'slap' | 'muted'): void
```

### 2. Articulation Playback Engine

**Note**: Articulation **detection** is handled by admin in the UI (see "Admin Workflow" section above). This engine is responsible for **playing back** the articulations defined by the admin.

Reads articulation metadata from saved bass notes and renders appropriate transitions.

**Responsibilities:**
- Read `articulation` metadata from `GeneratedBassNote`
- Trigger appropriate sample combinations for each articulation type
- Handle crossfading between notes for transitions (hammer-ons, slides, etc.)
- Coordinate with noise engine for articulation-specific sounds

```typescript
class ArticulationPlaybackEngine {
  private techniqueManager: BassTechniqueManager;
  private noiseEngine: BassNoiseEngine;
  private articulationSamples: Map<string, AudioBuffer[]> = new Map();

  /**
   * Play a bass note with its defined articulation
   */
  async playNoteWithArticulation(
    bassNote: GeneratedBassNote,
    time: number
  ): Promise<void> {
    const articulation = bassNote.articulation;

    switch (articulation.type) {
      case 'normal':
        // Standard note playback
        await this.playStandardNote(bassNote, time);
        break;

      case 'ghost-note':
        // Play with reduced velocity + ghost noise
        await this.playStandardNote({ ...bassNote, velocity: 30 }, time);
        this.noiseEngine.triggerNoise('ghost-note', 0.5, time);
        break;

      case 'hammer-on':
      case 'pull-off':
      case 'slide-up':
      case 'slide-down':
        // Play transition with crossfade
        if (articulation.fromNote) {
          await this.playTransition(
            articulation.type,
            articulation.fromNote,
            bassNote.note,
            time,
            bassNote.technique
          );
        }
        break;

      case 'accent':
        // Play with boosted velocity
        await this.playStandardNote(
          { ...bassNote, velocity: Math.min(bassNote.velocity * 1.3, 127) },
          time
        );
        break;
    }
  }

  private async playStandardNote(
    note: GeneratedBassNote,
    time: number
  ): Promise<void> {
    const { sampler } = this.techniqueManager.getNextSample(
      note.note,
      note.technique,
      note.velocity
    );

    sampler.triggerAttackRelease(note.note, '4n', time, note.velocity / 127);
  }

  private async playTransition(
    type: 'hammer-on' | 'pull-off' | 'slide-up' | 'slide-down',
    fromNote: string,
    toNote: string,
    time: number,
    technique: string
  ): Promise<void> {
    // See ArticulationEngine implementation below for crossfade logic
    // This delegates to the crossfading algorithm
  }
}
```

### 3. BassTechniqueManager

Manages multi-technique sample loading with round-robin variation and velocity layer selection.

**Features:**
- **3 Techniques**: normal (fingerstyle), slap, muted
- **5 Velocity Layers per technique**: v1 (pp), v2 (p), v3 (mp), v4 (mf), v5 (f)
- **3 Round-Robin variations per note**: RR1, RR2, RR3
- **String-specific samples**: Organized by E, A, D, G strings

**Sample Organization:**
```
bass-samples/
├── normal/                    # Standard fingerstyle notes
│   ├── E-string/
│   │   ├── v1/
│   │   │   ├── E1_RR1.mp3    # Regular note attack
│   │   │   ├── E1_RR2.mp3
│   │   │   ├── E1_RR3.mp3
│   │   │   └── ... (F1, Fs1, G1, Gs1, A1)
│   │   ├── v2/ ... v5/
│   ├── A-string/ ... D-string/ ... G-string/
│
├── slap/                      # Slap technique (same structure)
│   └── [E/A/D/G-string] → [v1-v5] → [notes × 3 RR]
│
├── muted/                     # Muted technique (same structure)
│   └── [E/A/D/G-string] → [v1-v5] → [notes × 3 RR]
│
└── articulations/             # 🎯 Pre-recorded articulation samples
    ├── hammer-on/
    │   ├── E1-F1.mp3         # Hammer-on from E1 to F1
    │   ├── E1-Fs1.mp3        # Hammer-on from E1 to F#1
    │   ├── E1-G1.mp3         # Hammer-on from E1 to G1
    │   ├── E1-Gs1.mp3        # 1-4 semitone intervals
    │   └── ... (~600 samples total)
    │
    ├── pull-off/
    │   ├── F1-E1.mp3         # Pull-off from F1 to E1
    │   ├── Fs1-E1.mp3
    │   └── ... (~600 samples total)
    │
    ├── slide-up/
    │   ├── E1-G1.mp3         # Slide up from E1 to G1
    │   ├── E1-A1.mp3
    │   └── ... (~200 samples total)
    │
    └── slide-down/
        ├── G1-E1.mp3
        └── ... (~200 samples total)
```

**Sample Count Estimation:**
- **Core notes**: 24 notes × 3 techniques × 5 layers × 3 RR = **1,080 samples**
- **Articulations**: ~1,600 pre-recorded transitions
- **Noises**: ~15 one-shot samples (ghost, slap, pop, fret noise)
- **Total**: ~**2,695 samples**

**Implementation:**
```typescript
class BassTechniqueManager {
  private samplers: Map<string, Tone.Sampler> = new Map();
  private roundRobinIndices: Map<string, number> = new Map();
  private readonly ROUND_ROBIN_COUNT = 3;

  // Velocity ranges for 5 layers
  private readonly VELOCITY_RANGES = [
    { min: 0,   max: 25,  layer: 'v1' },  // pp
    { min: 26,  max: 51,  layer: 'v2' },  // p
    { min: 52,  max: 76,  layer: 'v3' },  // mp
    { min: 77,  max: 102, layer: 'v4' },  // mf
    { min: 103, max: 127, layer: 'v5' }   // f
  ];

  async loadTechnique(
    technique: 'normal' | 'slap' | 'muted',
    layers: string[] = ['v1', 'v3', 'v5']
  ): Promise<void> {
    for (const layer of layers) {
      const samplerKey = `${technique}-${layer}`;
      const sampleUrls = await this.buildSampleMapping(technique, layer);

      const sampler = new Tone.Sampler({
        urls: sampleUrls,
        release: 0.2,
        attack: 0.01
      });

      this.samplers.set(samplerKey, sampler);
    }
  }

  getNextSample(
    note: string,
    technique: string,
    velocity: number
  ): { sampler: Tone.Sampler; roundRobin: number } {
    // 1. Determine velocity layer
    const layer = this.getVelocityLayer(velocity);
    const samplerKey = `${technique}-${layer}`;
    const sampler = this.samplers.get(samplerKey);

    if (!sampler) {
      throw new Error(`Sampler not loaded: ${samplerKey}`);
    }

    // 2. Get round-robin index
    const rrKey = `${note}-${technique}`;
    const currentRR = this.roundRobinIndices.get(rrKey) || 0;
    const nextRR = (currentRR + 1) % this.ROUND_ROBIN_COUNT;

    this.roundRobinIndices.set(rrKey, nextRR);

    return { sampler, roundRobin: currentRR };
  }

  private getVelocityLayer(velocity: number): string {
    const range = this.VELOCITY_RANGES.find(
      r => velocity >= r.min && velocity <= r.max
    );
    return range?.layer || 'v3';
  }

  private async buildSampleMapping(
    technique: string,
    layer: string
  ): Promise<Record<string, string>> {
    const mapping: Record<string, string> = {};
    const strings = ['E', 'A', 'D', 'G'];

    // String ranges and notes
    const stringConfigs = [
      { string: 'E', notes: ['E1', 'F1', 'Fs1', 'G1', 'Gs1', 'A1'] },
      { string: 'A', notes: ['A1', 'As1', 'B1', 'C2', 'Cs2', 'D2'] },
      { string: 'D', notes: ['D2', 'Ds2', 'E2', 'F2', 'Fs2', 'G2'] },
      { string: 'G', notes: ['G2', 'Gs2', 'A2', 'As2', 'B2', 'C3'] }
    ];

    for (const config of stringConfigs) {
      for (const note of config.notes) {
        // For now, use RR1 in Tone.js mapping (RR handled separately)
        const path = `${technique}/${config.string}-string/${layer}/${note}_RR1.mp3`;
        const url = await this.resolveUrl(path);

        // Convert 's' to '#' for Tone.js (Fs1 -> F#1)
        const toneNote = note.replace('s', '#');
        mapping[toneNote] = url;
      }
    }

    return mapping;
  }
}
```

### 4. ArticulationEngine

**Key Approach**: Uses **pre-recorded articulation samples** instead of synthesized crossfades. Each articulation sample contains the complete transition naturally performed (e.g., hammer-on from E2 to F#2 recorded in one take).

**CRITICAL TIMING RULE**: Since pre-recorded articulation samples CONTAIN the source note (e.g., E2→F#2 sample has both E2 and the transition to F#2), the sample MUST be scheduled at the **source note's time**, NOT the target note's time.

**Sample Structure Example (Hammer-On E2→F#2):**
```
Time:     0-125ms       125-175ms       175-300ms
Content:  [E2 Attack]   [Transition]    [F#2 Sustain]

Recording: Play E2 normally → After 16th note, hammer finger onto F# fret → Let F#2 sustain
```

**Responsibilities:**
- Load pre-recorded articulation samples (hammer-on, pull-off, slide transitions)
- Schedule articulation samples at **source note's time** (not target note's time)
- Optionally blend articulation samples with sustained notes for long durations
- Implement fallback hierarchy for missing samples (exact → interval match → pitch shift)

**Implementation:**
```typescript
class ArticulationEngine {
  private articulationBuffers: Map<string, AudioBuffer> = new Map();
  private articulationTimings = {
    'hammer-on': { offset: 0.125 },  // Start 16th note before target
    'pull-off': { offset: 0.125 },
    'slide-up': { offset: 0.25 },    // Start 8th note before target
    'slide-down': { offset: 0.25 },
  };

  /**
   * Load all pre-recorded articulation samples
   */
  async loadArticulations(): Promise<void> {
    const types = ['hammer-on', 'pull-off', 'slide-up', 'slide-down'];

    // Load all interval combinations for each type
    for (const type of types) {
      // Example: Load E1-F1, E1-Fs1, E1-G1, E1-Gs1, etc.
      const samples = await this.loadArticulationSamplesForType(type);

      for (const [key, buffer] of samples) {
        this.articulationBuffers.set(`${type}-${key}`, buffer);
      }
    }
  }

  /**
   * Schedule pre-recorded articulation sample
   * This is called during prescheduling phase
   *
   * CRITICAL: sourceNoteTime is the time of the FIRST note (e.g., E2 in E2→F#2 hammer-on)
   * The articulation sample starts at this time because it contains the source note attack
   */
  async scheduleArticulationSample(
    type: 'hammer-on' | 'pull-off' | 'slide-up' | 'slide-down',
    fromNote: string,
    toNote: string,
    sourceNoteTime: number,  // When the SOURCE note starts (e.g., E2 time in E2→F#2)
    velocity: number,
    totalDuration: number,   // Total duration from source to end of target
    secondsPerBeat: number
  ): Promise<void> {
    // 1. Get pre-recorded articulation sample
    const sampleKey = this.getArticulationKey(fromNote, toNote);
    const buffer = this.articulationBuffers.get(`${type}-${sampleKey}`);

    if (!buffer) {
      console.warn(`Articulation sample not found: ${type} ${fromNote}→${toNote}`);
      // Fallback: play notes separately
      await this.playNoteSeparately(fromNote, toNote, sourceNoteTime, velocity);
      return;
    }

    // 2. Play articulation sample at SOURCE note's time
    // Sample contains: [fromNote attack] → [transition] → [toNote sustain]
    const player = new Tone.Player(buffer).toDestination();
    player.volume.value = Tone.gainToDb(velocity / 127);
    player.start(sourceNoteTime);  // ← Starts at SOURCE note time

    // 3. Calculate if we need to add sustain after articulation
    const articulationDuration = buffer.duration;
    const sustainDuration = totalDuration - articulationDuration;

    // 4. If total duration extends beyond articulation sample, blend to sustained note
    if (sustainDuration > 0.05) {
      const sustainStartTime = sourceNoteTime + articulationDuration;

      // Play sustained target note with slight overlap for smooth blend
      await this.blendToSustainedNote(
        toNote,
        sustainStartTime - 0.02,  // Start 20ms before for crossfade
        sustainDuration + 0.02,
        velocity
      );
    }

    // 5. Auto-dispose when finished
    player.onstop = () => player.dispose();
  }

  /**
   * Fallback: Play notes separately when articulation sample is missing
   */
  private async playNoteSeparately(
    fromNote: string,
    toNote: string,
    startTime: number,
    velocity: number
  ): Promise<void> {
    // Play first note briefly
    const fromPlayer = this.techniqueManager.getNextSample(fromNote, 'normal', velocity);
    fromPlayer.start(startTime);
    fromPlayer.stop(startTime + 0.125); // Brief duration
    fromPlayer.volume.value = Tone.gainToDb(velocity / 127);

    // Play second note
    const toPlayer = this.techniqueManager.getNextSample(toNote, 'normal', velocity);
    toPlayer.start(startTime + 0.125);
    toPlayer.volume.value = Tone.gainToDb(velocity / 127);
  }

  /**
   * Blend articulation sample to sustained note for long notes
   */
  private async blendToSustainedNote(
    note: string,
    startTime: number,
    duration: number,
    velocity: number
  ): Promise<void> {
    // Get regular note sampler
    const { sampler } = this.techniqueManager.getNextSample(
      note,
      'normal',
      velocity
    );

    // Trigger with slight fade-in for smooth blend
    sampler.triggerAttackRelease(
      note,
      duration,
      startTime,
      velocity / 127
    );
  }

  /**
   * Get articulation sample key (e.g., "E1-Fs1")
   */
  private getArticulationKey(fromNote: string, toNote: string): string {
    // Convert note names to sample filenames (F# → Fs)
    const from = fromNote.replace('#', 's');
    const to = toNote.replace('#', 's');
    return `${from}-${to}`;
  }

  /**
   * Get articulation sample path for loading
   */
  private getArticulationPath(
    type: string,
    fromNote: string,
    toNote: string
  ): string {
    const key = this.getArticulationKey(fromNote, toNote);
    return `articulations/${type}/${key}.mp3`;
  }

  private getEqualPowerCrossfade(progress: number): [number, number] {
    const fadeOut = Math.cos(progress * Math.PI * 0.5);
    const fadeIn = Math.sin(progress * Math.PI * 0.5);
    return [fadeOut, fadeIn];
  }

  private getArticulationTiming(articulation: ArticulationType): {
    offset: number;      // When to start transition
    crossfade: number;   // Crossfade duration
  } {
    const timings = {
      'hammer-on':  { offset: 0.125, crossfade: 0.05 },  // 16th note
      'pull-off':   { offset: 0.125, crossfade: 0.05 },
      'slide-up':   { offset: 0.25,  crossfade: 0.1  },  // 8th note
      'slide-down': { offset: 0.25,  crossfade: 0.1  },
      'bend':       { offset: 0.0,   crossfade: 0.15 },
      'legato':     { offset: 0.0,   crossfade: 0.03 }
    };

    return timings[articulation] || { offset: 0, crossfade: 0.05 };
  }

  private triggerLegatoNote(
    sampler: Tone.Sampler,
    note: string,
    time: number,
    attackTime: number = 0
  ): void {
    // Create a custom envelope with no attack for legato
    const source = sampler.context.createBufferSource();
    const gain = sampler.context.createGain();

    // Set gain to 0 initially, then ramp up
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(1, time + attackTime);

    // Trigger without attack
    sampler.triggerAttack(note, time);
  }
}
```

### 5. BassNoiseEngine

Manages one-shot noise samples (ghost notes, slap/pop noises, fret noises).

**Implementation:**
```typescript
class BassNoiseEngine {
  private noiseBuffers: Map<string, AudioBuffer[]> = new Map();
  private destination: Tone.Gain;

  async loadNoises(): Promise<void> {
    const noiseTypes = [
      'ghost-note',
      'slap-noise',
      'pop-noise',
      'fret-noise',
      'release-noise',
      'string-buzz'
    ];

    for (const type of noiseTypes) {
      const buffers = await this.loadNoiseSamples(type);
      this.noiseBuffers.set(type, buffers);
    }
  }

  triggerNoise(
    type: string,
    velocity: number,
    time?: number
  ): void {
    const buffers = this.noiseBuffers.get(type);
    if (!buffers || buffers.length === 0) return;

    // Random variation for natural sound
    const buffer = buffers[Math.floor(Math.random() * buffers.length)];

    // Create one-shot player
    const player = new Tone.Player(buffer).toDestination();
    player.volume.value = Tone.gainToDb(velocity / 127);
    player.start(time || Tone.now());

    // Auto-dispose when finished
    player.onstop = () => player.dispose();
  }

  // Automatically trigger noise with certain articulations
  triggerArticulationNoise(
    articulation: ArticulationType,
    technique: 'normal' | 'slap' | 'muted',
    velocity: number,
    time?: number
  ): void {
    // Slap technique always has slap/pop noise
    if (technique === 'slap') {
      this.triggerNoise('slap-noise', velocity, time);

      // High velocity slaps have pop
      if (velocity > 80) {
        this.triggerNoise('pop-noise', velocity, time);
      }
    }

    // Ghost notes have special noise
    if (articulation === 'ghost-note') {
      this.triggerNoise('ghost-note', velocity, time);
    }

    // Slides have fret noise
    if (articulation === 'slide-up' || articulation === 'slide-down') {
      this.triggerNoise('fret-noise', velocity * 0.6, time);
    }
  }
}
```

## JSON Configuration Format

```json
{
  "name": "Professional Bass Guitar",
  "version": "1.0.0",
  "type": "bass-guitar",
  "storage": {
    "bucketName": "audio-samples",
    "bucketPath": "bass/professional-bass-v1",
    "localPath": "/samples/bass/"
  },
  "strings": [
    {
      "name": "E",
      "openNote": "E1",
      "midiRange": [28, 33],
      "notes": ["E1", "F1", "F#1", "G1", "G#1", "A1"]
    },
    {
      "name": "A",
      "openNote": "A1",
      "midiRange": [33, 38],
      "notes": ["A1", "A#1", "B1", "C2", "C#2", "D2"]
    },
    {
      "name": "D",
      "openNote": "D2",
      "midiRange": [38, 43],
      "notes": ["D2", "D#2", "E2", "F2", "F#2", "G2"]
    },
    {
      "name": "G",
      "openNote": "G2",
      "midiRange": [43, 48],
      "notes": ["G2", "G#2", "A2", "A#2", "B2", "C3"]
    }
  ],
  "techniques": {
    "normal": {
      "name": "Fingerstyle",
      "velocityLayers": ["v1", "v2", "v3", "v4", "v5"],
      "roundRobinCount": 3,
      "defaultLayers": ["v1", "v3", "v5"]
    },
    "slap": {
      "name": "Slap",
      "velocityLayers": ["v1", "v2", "v3", "v4", "v5"],
      "roundRobinCount": 3,
      "defaultLayers": ["v3", "v5"]
    },
    "muted": {
      "name": "Muted",
      "velocityLayers": ["v1", "v2", "v3", "v4", "v5"],
      "roundRobinCount": 3,
      "defaultLayers": ["v2", "v4"]
    }
  },
  "velocityRanges": [
    { "min": 0,   "max": 25,  "layer": "v1", "dynamic": "pp" },
    { "min": 26,  "max": 51,  "layer": "v2", "dynamic": "p" },
    { "min": 52,  "max": 76,  "layer": "v3", "dynamic": "mp" },
    { "min": 77,  "max": 102, "layer": "v4", "dynamic": "mf" },
    { "min": 103, "max": 127, "layer": "v5", "dynamic": "f" }
  ],
  "articulations": {
    "hammer-on": {
      "crossfadeTime": 0.05,
      "offset": 0.125,
      "samples": ["hammer-on_1.mp3", "hammer-on_2.mp3", "hammer-on_3.mp3"]
    },
    "pull-off": {
      "crossfadeTime": 0.05,
      "offset": 0.125,
      "samples": ["pull-off_1.mp3", "pull-off_2.mp3", "pull-off_3.mp3"]
    },
    "slide-up": {
      "crossfadeTime": 0.1,
      "offset": 0.25,
      "samples": ["slide-up_1.mp3", "slide-up_2.mp3"]
    },
    "slide-down": {
      "crossfadeTime": 0.1,
      "offset": 0.25,
      "samples": ["slide-down_1.mp3", "slide-down_2.mp3"]
    }
  },
  "noises": {
    "ghost-note": {
      "samples": ["ghost_1.mp3", "ghost_2.mp3", "ghost_3.mp3"],
      "velocityRange": [0, 40]
    },
    "slap-noise": {
      "samples": ["slap-noise_1.mp3", "slap-noise_2.mp3"],
      "triggerWith": "slap"
    },
    "pop-noise": {
      "samples": ["pop_1.mp3", "pop_2.mp3"],
      "triggerWith": "slap",
      "minVelocity": 80
    },
    "fret-noise": {
      "samples": ["fret_1.mp3", "fret_2.mp3", "fret_3.mp3"],
      "triggerWith": ["slide-up", "slide-down"]
    }
  },
  "samplerConfig": {
    "attack": 0.01,
    "release": 0.2,
    "curve": "exponential"
  },
  "effects": {
    "compression": {
      "enabled": true,
      "threshold": -18,
      "ratio": 3,
      "attack": 0.003,
      "release": 0.1
    },
    "eq": {
      "enabled": true,
      "bass": 0.6,
      "mid": 0.5,
      "treble": 0.4
    }
  }
}
```

## Usage Examples

### Example 1: Simple Note Playback
```typescript
const bass = new BassVelocitySampler();
await bass.initialize();

// Play normal fingerstyle note
bass.triggerAttackRelease('E2', '4n', Tone.now(), 80);
```

### Example 2: Slap Technique
```typescript
// Switch to slap technique
bass.setTechnique('slap');
bass.triggerAttackRelease('E2', '8n', Tone.now(), 100);
// Automatically triggers slap-noise and pop-noise
```

### Example 3: Hammer-On Articulation
```typescript
const event: BassPlaybackEvent = {
  note: 'E2',
  octave: 2,
  velocity: 80,
  articulation: 'hammer-on',
  fromNote: 'E2',
  toNote: 'F#2',
  time: Tone.now()
};

bass.triggerWithArticulation(event);
// Smoothly transitions from E2 to F#2 with hammer-on sample
```

### Example 4: MIDI Sequence with Auto-Detection
```typescript
const notes = [
  { note: 'E2', time: 0, duration: 0.5, velocity: 80 },
  { note: 'F#2', time: 0.125, duration: 0.375, velocity: 70 }, // Overlaps - hammer-on detected
  { note: 'G2', time: 0.5, duration: 0.5, velocity: 85 },
  { note: 'D2', time: 1.0, duration: 0.3, velocity: 30 }  // Low velocity - ghost note
];

for (const note of notes) {
  bass.triggerSmartNote(note); // Auto-detects articulations
}
```

## Integration with Prescheduling System

### Complete Example: "Come Together" Bassline with Articulations

```typescript
// Input: Bass notes from database with articulation metadata
const bassNotes: GeneratedBassNote[] = [
  {
    note: 'E2',
    ticks: 0,           // Absolute position
    durationTicks: 240,
    velocity: 85,
    technique: 'normal',
    articulation: { type: 'normal' }
  },
  {
    note: 'F#2',
    ticks: 60,          // Absolute position: 60 ticks (16th note after E2)
    durationTicks: 180,
    velocity: 70,
    technique: 'normal',
    articulation: {
      type: 'hammer-on',
      fromNote: 'E2',
      transitionOffset: 0.125  // Start 16th note before
    }
  },
  {
    note: 'A2',
    ticks: 240,         // Absolute position: 240 ticks (quarter note)
    durationTicks: 120,
    velocity: 30,
    technique: 'normal',
    articulation: { type: 'ghost-note' }
  },
  {
    note: 'G2',
    ticks: 480,         // Absolute position: 480 ticks (1 beat)
    durationTicks: 240,
    velocity: 80,
    technique: 'slap',
    articulation: { type: 'normal' }
  }
];

// Prescheduling in RegionProcessor (CORRECTED with context-aware scheduling)
async scheduleBassRegion(bassNotes: GeneratedBassNote[], startTime: number) {
  const secondsPerTick = 0.5 / 480; // 120 BPM, 480 PPQ = 0.5s per beat
  const secondsPerBeat = 0.5;

  // Track which notes have been scheduled (to avoid double-scheduling with articulations)
  const scheduledIndices = new Set<number>();

  for (let i = 0; i < bassNotes.length; i++) {
    const note = bassNotes[i];

    // Skip if already scheduled as part of an articulation
    if (scheduledIndices.has(i)) continue;

    const audioTime = startTime + (note.ticks * secondsPerTick);

    // Check articulation type
    if (note.articulation.type === 'normal') {
      // Simple note: use technique manager
      const { sampler } = this.techniqueManager.getNextSample(
        note.note,
        note.technique,
        note.velocity
      );
      sampler.triggerAttackRelease(
        note.note,
        note.durationTicks * secondsPerTick,
        audioTime,
        note.velocity / 127
      );

    } else if (this.isTransitionArticulation(note.articulation.type)) {
      // Find the previous note (source note)
      const prevNoteIndex = this.findPreviousNoteIndex(bassNotes, i, note.articulation.fromNote);

      if (prevNoteIndex === -1) {
        console.warn(`Previous note ${note.articulation.fromNote} not found for articulation`);
        // Fallback: play as normal note
        await this.scheduleNormalNote(note, audioTime, secondsPerTick);
        continue;
      }

      const prevNote = bassNotes[prevNoteIndex];
      const prevAudioTime = startTime + (prevNote.ticks * secondsPerTick);

      // Calculate total duration from source note to end of target note
      const totalDuration = (note.ticks - prevNote.ticks + note.durationTicks) * secondsPerTick;

      // Schedule articulation sample at SOURCE note's time
      await this.articulationEngine.scheduleArticulationSample(
        note.articulation.type,
        prevNote.note,      // fromNote
        note.note,          // toNote
        prevAudioTime,      // ← Schedule at PREVIOUS note's time
        note.velocity,
        totalDuration,
        secondsPerBeat
      );

      // Mark both notes as scheduled
      scheduledIndices.add(prevNoteIndex);
      scheduledIndices.add(i);

    } else if (note.articulation.type === 'ghost-note') {
      // Ghost note: play with reduced velocity + noise
      const { sampler } = this.techniqueManager.getNextSample(
        note.note,
        note.technique,
        30  // Low velocity
      );
      sampler.triggerAttackRelease(note.note, note.durationTicks * secondsPerTick, audioTime, 0.24);
      this.noiseEngine.triggerNoise('ghost-note', 0.5, audioTime);

    } else if (note.articulation.type === 'accent') {
      // Accent: boost velocity
      const boostedVelocity = Math.min(note.velocity * 1.3, 127);
      const { sampler } = this.techniqueManager.getNextSample(
        note.note,
        note.technique,
        boostedVelocity
      );
      sampler.triggerAttackRelease(
        note.note,
        note.durationTicks * secondsPerTick,
        audioTime,
        boostedVelocity / 127
      );
    }
  }
}

// Helper to find previous note by note name
private findPreviousNoteIndex(
  notes: GeneratedBassNote[],
  currentIndex: number,
  fromNote: string
): number {
  // Search backwards for matching note
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (notes[i].note === fromNote) {
      return i;
    }
  }
  return -1;
}

isTransitionArticulation(type: string): boolean {
  return ['hammer-on', 'pull-off', 'slide-up', 'slide-down'].includes(type);
}
```

### Timing Breakdown for Hammer-On Example

**CORRECTED TIMING MODEL** (using source note time):

```
Given: BPM 120, 480 PPQ → 0.5s per beat, 0.001041667s per tick

Note #1: E2 at tick 0 (SKIP - included in hammer-on sample)
  NOT scheduled separately

Note #2: F#2 at tick 60 with hammer-on from E2
  F#2 audioTime = 60 × 0.001041667 = 0.0625s
  E2 audioTime = 0 × 0.001041667 = 0.0s (source note)

  ArticulationEngine schedules:
  1. Hammer-on sample (E2→F#2) starts at: 0.0s (E2's time, NOT F#2's time)
     Sample contains: [E2 attack (0-125ms) | Transition (125-175ms) | F#2 (175-300ms)]
  2. Total duration needed: (F#2_ticks - E2_ticks + F#2_duration) × secondsPerTick
     = (60 + 180) × 0.001041667 = 0.25s
  3. Sample duration: 0.15s (150ms)
  4. Remaining duration: 0.25 - 0.15 = 0.1s
  5. Blend to sustained F#2 at: 0.15s - 0.02s = 0.13s (20ms overlap)

Note #3: A2 ghost note at tick 240
  audioTime = 240 × 0.001041667 = 0.25s
  schedules: A2 with velocity 30 + ghost-note noise

Note #4: G2 slap at tick 480
  audioTime = 480 × 0.001041667 = 0.5s
  schedules: G2 from slap technique + slap-noise
```

**Key Insight**: When processing Note #2 (F#2 with hammer-on from E2), we must:
1. Find the previous note (E2) to get its time
2. Schedule the articulation sample at E2's time (0.0s), NOT F#2's time (0.0625s)
3. Mark E2 as "already scheduled" to avoid double-scheduling

## Performance Considerations

1. **Preloading Strategy**:
   - Load default layers (v1, v3, v5) for normal technique first (~45 MB)
   - Lazy-load slap/muted techniques on demand (~30 MB each)
   - Preload articulation samples used in exercise (~10-20 MB)
   - Smart loading: Initial load ~65 MB, full load ~225 MB

2. **Memory Management**:
   - Each technique + layer ≈ 15 MB
   - Total for all layers ≈ 225 MB (3 techniques × 5 layers × 15 MB)
   - Articulation samples ≈ 50 MB (1,600 samples × ~30 KB each)
   - **Peak memory: ~275 MB** (reasonable for modern browsers)

3. **CPU Optimization**:
   - Pre-recorded samples = **zero CPU for crossfading** (vs synthesized)
   - Round-robin uses modulo arithmetic (O(1))
   - Prescheduling is single-pass (no two-pass needed with pre-recorded)
   - Articulation lookup is O(1) HashMap access

## Critical Implementation Notes

### ✅ Key Architectural Decisions

1. **Full Transition Samples Only** (NOT transition-only samples)
   - Each sample contains: [Source note plucked | Transition | Destination note with unique timbre | Sustain]
   - Example: `E2-Fs2_hammeron.mp3` = complete performance from E2 pluck through hammered F#2 sustain
   - **Why:** Destination note's unique timbre (hammered vs plucked) must be preserved

2. **Dynamic Truncation + Crossfade** for consecutive articulations
   - Full samples are truncated when next articulation follows quickly
   - Equal-power crossfade blends overlapping timbres smoothly
   - **Why:** Maintains authentic timbres while allowing rapid articulation sequences

3. **Source Note Timing** (CRITICAL)
   - Articulation samples MUST be scheduled at the SOURCE note's time
   - NOT at the target note's time
   - Example: E2→F#2 hammer-on starts at E2's time (tick 0), not F#2's time (tick 60)
   - **Why:** Full transition samples contain the source note attack

4. **Round-Robin with Tone.Player Arrays**
   - ❌ Do NOT use Tone.Sampler (doesn't support multiple samples per note)
   - ✅ Use arrays of Tone.Player for round-robin selection
   - Each note has 3 Player instances (RR1, RR2, RR3)
   - **Why:** Tone.Sampler only supports single URL per note

5. **Admin-Defined Articulations**
   - Articulation detection is MANUAL via admin UI (new step in MIDI upload workflow)
   - Auto-suggestions are optional helpers (accept/reject)
   - Final decision always controlled by admin
   - **Why:** Articulation nuances require human musical judgment

### 📊 Sample Library Size

**Practical Starting Library:**
- Core notes: 1,080 samples (24 notes × 3 techniques × 5 layers × 3 RR)
- Articulations: ~400 samples (common intervals 1-4 semitones)
- Noises: ~17 samples (ghost, slap, pop, fret noise, etc.)
- **Total: ~1,497 samples** (~150-200 MB)

**Future Full Library:**
- Articulations: ~1,600 samples (all intervals up to octave)
- **Total: ~2,697 samples** (~275 MB)

### 🎯 Implementation Order

1. **Phase 1: Core Infrastructure**
   - Update BassArticulation schema with `toNote` field ✅
   - Implement BassTechniqueManager with Player pools
   - Create sample URL resolution system

2. **Phase 2: Articulation System**
   - Implement ArticulationEngine with correct timing model
   - Add fallback hierarchy for missing samples
   - Test with real articulation samples

3. **Phase 3: Admin UI**
   - Create BassArticulationMatrix component
   - Integrate into MIDI upload workflow
   - Add auto-suggestion system

4. **Phase 4: Integration**
   - Update RegionProcessor with context-aware scheduling
   - Implement previous note tracking
   - Add double-scheduling prevention

5. **Phase 5: Testing**
   - Unit tests for timing calculations
   - Integration test with full bassline
   - Performance testing with full library

### ⚠️ Critical Pitfalls to Avoid

#### 1. **Phase Cancellation in Crossfades**
```typescript
// ❌ WRONG: Linear crossfade causes phase cancellation
const fadeOut = 1 - progress;
const fadeIn = progress;

// ✅ CORRECT: Equal-power crossfade (cosine/sine curves)
const fadeOut = Math.cos(progress * Math.PI * 0.5);
const fadeIn = Math.sin(progress * Math.PI * 0.5);
```
**Why**: Linear crossfades cause -3dB dip in the middle. Equal-power maintains constant perceived volume.

#### 2. **Memory Explosion from Not Disposing Players**
```typescript
// ❌ WRONG: Player never disposed
const player = new Tone.Player(buffer).toDestination();
player.start(time);

// ✅ CORRECT: Dispose after playback ends
player.onstop = () => player.dispose();
```
**Why**: Each Player holds AudioBuffer in memory. Without disposal, memory usage grows unbounded.

#### 3. **Crossfade Timing Errors**
```typescript
// ❌ WRONG: Crossfade at articulation END
const crossfadeStart = sourceTime + articulationDuration;

// ✅ CORRECT: Crossfade BEFORE articulation ends (20ms overlap)
const crossfadeStart = sourceTime + articulationDuration - 0.02;
const sustainStart = crossfadeStart;  // Sustain starts during overlap
```
**Why**: Crossfade must start before articulation sample ends to blend smoothly.

#### 4. **Missing Fallback Logic**
```typescript
// ❌ WRONG: Fails silently when sample missing
const buffer = this.articulationBuffers.get(`${type}-${sampleKey}`);
player.buffer = buffer;  // Crashes if buffer is undefined

// ✅ CORRECT: Fallback hierarchy
if (!buffer) {
  // Try interval-based sample with pitch shift
  const intervalBuffer = this.findIntervalMatch(fromNote, toNote);
  if (intervalBuffer) {
    return this.playWithPitchShift(intervalBuffer, semitoneShift, time);
  }
  // Final fallback: play notes separately
  await this.playNoteSeparately(fromNote, toNote, time, velocity);
  return;
}
```
**Why**: Complete articulation library (~1,600 samples) is not practical initially. Fallbacks ensure graceful degradation.

#### 5. **Incorrect Sample Naming Conventions**
```typescript
// ❌ WRONG: Inconsistent naming breaks lookups
'E2-F#2_hammeron.mp3'  // Sharp symbol
'E2-Gb2_hammeron.mp3'  // Flat symbol - same pitch!

// ✅ CORRECT: Normalize to sharps with 's' suffix
'E2-Fs2_hammeron.mp3'
'E2-Fs2_pulloff.mp3'
'E2-Fs2_slide.mp3'
```
**Why**: Sample lookup uses string concatenation. Inconsistent naming causes failures.

#### 6. **Not Preventing Double-Scheduling**
```typescript
// ❌ WRONG: Both source and target notes scheduled
for (const note of bassNotes) {
  if (note.articulation.type === 'hammer-on') {
    scheduleArticulation(note);  // Schedules E2→F#2 sample
  }
  scheduleNormalNote(note);  // Also schedules E2 separately!
}

// ✅ CORRECT: Track scheduled notes
const scheduledIndices = new Set<number>();
for (let i = 0; i < bassNotes.length; i++) {
  if (scheduledIndices.has(i)) continue;

  if (isArticulation) {
    scheduleArticulation(prevNote, currentNote);
    scheduledIndices.add(prevNoteIndex);
    scheduledIndices.add(i);
  }
}
```
**Why**: Articulation sample already contains source note attack. Scheduling source note separately causes double-playback.

#### 7. **Missing `previousNote` Context**
```typescript
// ❌ WRONG: No way to find source note during scheduling
const note = bassNotes[i];
if (note.articulation.type === 'hammer-on') {
  // How do we know E2→F#2 should start at E2's time?
  scheduleArticulation(note.ticks, note.note);  // WRONG!
}

// ✅ CORRECT: Search backwards for fromNote
const prevNoteIndex = bassNotes.findLastIndex((n, idx) =>
  idx < i && n.note === note.articulation.fromNote
);
const prevNote = bassNotes[prevNoteIndex];
const sourceTime = startTime + (prevNote.ticks * secondsPerTick);
scheduleArticulation(sourceTime, prevNote.note, note.note);
```
**Why**: Articulation samples need source note's timing, not target note's timing.

#### 8. **Tempo-Unaware Crossfade Durations**
```typescript
// ❌ WRONG: Fixed 20ms crossfade at all tempos
const crossfadeDuration = 0.02;  // Always 20ms

// ✅ CORRECT: Musical duration (e.g., 1/64th note)
const crossfadeDuration = secondsPerBeat / 16;  // 1/64th note
// At 120 BPM: 31.25ms
// At 200 BPM: 18.75ms
```
**Why**: Fixed durations feel wrong at extreme tempos. Musical durations scale naturally.

### ✅ Implementation Checklist

#### **Before You Code**
- [ ] Understand that articulation samples are FULL transitions (source attack → transition → destination sustain)
- [ ] Remember: schedule at SOURCE note's time, not target note's time
- [ ] Know that Tone.Sampler doesn't support round-robin (use Player arrays instead)
- [ ] Plan for graceful fallbacks when articulation samples are missing

#### **Data Structure Setup**
- [ ] Add `toNote` field to BassArticulation interface
- [ ] Create ArticulationMatrixEntry type for admin workflow
- [ ] Ensure GeneratedBassNote includes articulation metadata
- [ ] Update Zod schemas for validation

#### **Core Components**
- [ ] **BassTechniqueManager**: Load samples into Player pools (not Sampler)
- [ ] **ArticulationEngine**: Schedule articulation samples with correct timing
- [ ] **SampleCacheService**: Prioritized loading for current exercise
- [ ] **FallbackHandler**: Interval matching + pitch shift logic

#### **Admin UI Integration**
- [ ] Create BassArticulationMatrix component (table view)
- [ ] Add articulation type dropdowns per note
- [ ] Implement "from note" selection for transitions
- [ ] Add auto-suggestion display (accept/reject)
- [ ] Insert into MIDI workflow: Parse → **Articulation Matrix** → Set Anchors → Convert

#### **Scheduling Logic**
- [ ] Implement `scheduledIndices` Set to prevent double-scheduling
- [ ] Add `findPreviousNoteIndex()` helper to locate source notes
- [ ] Calculate total duration: (target.ticks - source.ticks + target.durationTicks) × secondsPerTick
- [ ] Schedule articulation sample at source note's audioTime
- [ ] Mark both source and target indices as scheduled

#### **Crossfading & Blending**
- [ ] Use equal-power crossfade curves (cosine/sine, not linear)
- [ ] Calculate crossfade start: articulationEnd - overlapDuration
- [ ] Make crossfade durations tempo-aware (musical units, not fixed ms)
- [ ] Blend to sustained note if remaining duration > 50ms

#### **Memory Management**
- [ ] Dispose Players after playback: `player.onstop = () => player.dispose()`
- [ ] Implement sample unloading for unused exercises
- [ ] Monitor memory usage in production

#### **Testing Strategy**
- [ ] Unit test: Source note timing calculation
- [ ] Unit test: Equal-power crossfade curves
- [ ] Integration test: Full bassline with mixed articulations
- [ ] Edge case: Consecutive articulations (E2→F#2 hammer-on, F#2→G2 slide)
- [ ] Edge case: Missing articulation sample (verify fallback)
- [ ] Performance test: Load time with full library

### ✅ Quick Reference: Timing Model

```
Given: E2 at tick 0, F#2 at tick 60 (hammer-on from E2)

WRONG:
  Schedule articulation at F#2's time (0.0625s)

CORRECT:
  1. Find E2 (source note) at tick 0
  2. Calculate E2's audioTime = 0.0s
  3. Schedule articulation sample at 0.0s
  4. Mark both E2 and F#2 as scheduled
  5. Sample plays: E2 → transition → F#2
```

---

## Document Status

**Last Updated**: 2025-11-16
**Version**: 2.0 (Post-Investigation Update)
**Status**: ✅ Architecture Complete - Ready for Implementation

**Key Corrections Applied**:
- ✅ Source note timing model (not target note timing)
- ✅ Pre-recorded full samples (not synthesized crossfades)
- ✅ Admin articulation matrix workflow (not auto-detection primary)
- ✅ Round-robin with Player arrays (not Tone.Sampler)
- ✅ Context-aware scheduling with double-scheduling prevention
- ✅ Equal-power crossfade curves
- ✅ Tempo-aware crossfade durations
- ✅ Complete pitfall documentation
