import { ExerciseId } from '../value-objects/exercise-id.vo';
import { Difficulty } from '../value-objects/difficulty.vo';
import type {
  DrumHit,
  GeneratedHarmonyNote,
  HarmonyInstrumentType,
  HarmonyControlChange,
  FretboardViewConfig,
} from '@bassnotion/contracts';
import { isVerboseDebugEnabled } from '@/config/debug';

// Finger index type for bass fingering (fretting hand)
export type FingerIndex = 1 | 2 | 3 | 4 | 'O'; // 1=index, 2=middle, 3=ring, 4=pinky, O=open string

// Note type for frontend usage
export interface ExerciseNote {
  id: string;
  // Fretboard position
  string: number;
  fret: number;
  note: string;
  color: string;
  techniques?: string[];

  // Musical timing
  position?: {
    measure: number;
    beat: number;
    subdivision: number;
  };
  noteDuration?: string; // 'quarter', 'eighth', etc.
  durationTicks?: number; // Duration in ticks at 480 PPQ

  // Fingering
  finger_index?: FingerIndex; // Which finger plays this note
}

export interface ExerciseProps {
  id: ExerciseId;
  tutorialId?: string; // UUID reference to tutorial
  title: string;
  description: string;
  difficulty: Difficulty;
  duration: number; // DEPRECATED: in seconds - use duration_beats
  duration_beats?: number; // Musical duration in beats
  total_bars?: number; // Total measures/bars
  bpm: number;
  key: string;
  timeSignature?: { numerator: number; denominator: number };
  notes: ExerciseNote[];
  tags: string[];
  isActive: boolean;
  // Legacy single MIDI file
  midiFilePath?: string;
  originalFilename?: string;
  fileSize?: number;
  uploadedAt?: Date;
  // New separate MIDI files for each widget
  drummerMidiUrl?: string;
  basslineMidiUrl?: string;
  harmonyMidiUrl?: string;
  metronomeMidiUrl?: string;
  // Pre-converted patterns (avoids re-parsing MIDI on client)
  drumPattern?: DrumHit[];
  harmonyNotes?: GeneratedHarmonyNote[]; // Pre-converted harmony notes
  harmonyControlChanges?: HarmonyControlChange[]; // MIDI control events (sustain, expression)
  harmonyInstrument?: HarmonyInstrumentType; // Default harmony instrument
  // Fretboard display configuration
  fretboardViewConfig?: FretboardViewConfig;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Exercise {
  private constructor(private readonly _props: ExerciseProps) {
    Object.freeze(this);
  }

  static create(
    props: Omit<ExerciseProps, 'createdAt' | 'updatedAt'>,
  ): Exercise {
    const now = new Date();
    return new Exercise({
      ...props,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ExerciseProps): Exercise {
    return new Exercise(props);
  }

  // Getters
  get id(): ExerciseId {
    return this._props.id;
  }

  get tutorialId(): string | undefined {
    return this._props.tutorialId;
  }

  get title(): string {
    return this._props.title;
  }

  get description(): string {
    return this._props.description;
  }

  get difficulty(): Difficulty {
    return this._props.difficulty;
  }

  get duration(): number {
    return this._props.duration;
  }

  get duration_beats(): number | undefined {
    return this._props.duration_beats;
  }

  get total_bars(): number | undefined {
    return this._props.total_bars;
  }

  get bpm(): number {
    return this._props.bpm;
  }

  get key(): string {
    return this._props.key;
  }

  get timeSignature(): { numerator: number; denominator: number } | undefined {
    return this._props.timeSignature;
  }

  get notes(): ExerciseNote[] {
    return [...this._props.notes]; // Return a copy to maintain immutability
  }

  get tags(): string[] {
    return [...this._props.tags];
  }

  get isActive(): boolean {
    return this._props.isActive;
  }

  get midiFilePath(): string | undefined {
    return this._props.midiFilePath;
  }

  get originalFilename(): string | undefined {
    return this._props.originalFilename;
  }

  get fileSize(): number | undefined {
    return this._props.fileSize;
  }

  get uploadedAt(): Date | undefined {
    return this._props.uploadedAt;
  }

  get drummerMidiUrl(): string | undefined {
    return this._props.drummerMidiUrl;
  }

  get basslineMidiUrl(): string | undefined {
    return this._props.basslineMidiUrl;
  }

  get harmonyMidiUrl(): string | undefined {
    return this._props.harmonyMidiUrl;
  }

  get metronomeMidiUrl(): string | undefined {
    return this._props.metronomeMidiUrl;
  }

  get drumPattern(): DrumHit[] | undefined {
    return this._props.drumPattern;
  }

  get harmonyNotes(): GeneratedHarmonyNote[] | undefined {
    return this._props.harmonyNotes;
  }

  get harmonyControlChanges(): HarmonyControlChange[] | undefined {
    return this._props.harmonyControlChanges;
  }

  get harmonyInstrument(): HarmonyInstrumentType | undefined {
    return this._props.harmonyInstrument;
  }

  get fretboardViewConfig(): FretboardViewConfig | undefined {
    return this._props.fretboardViewConfig;
  }

  get createdBy(): string | undefined {
    return this._props.createdBy;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  // Business logic methods
  canBePlayedByBeginner(): boolean {
    return (
      this._props.difficulty.isBeginnerFriendly() && this._props.bpm <= 120
    );
  }

  getDurationInMinutes(): number {
    return Math.round((this._props.duration / 60) * 10) / 10;
  }

  hasTag(tag: string): boolean {
    return this._props.tags.includes(tag.toLowerCase());
  }

  isSlowTempo(): boolean {
    return this._props.bpm < 60;
  }

  isMediumTempo(): boolean {
    return this._props.bpm >= 60 && this._props.bpm <= 120;
  }

  isFastTempo(): boolean {
    return this._props.bpm > 120;
  }

  hasMidiFile(): boolean {
    return !!this._props.midiFilePath;
  }

  hasDrummerMidi(): boolean {
    return !!this._props.drummerMidiUrl;
  }

  hasBasslineMidi(): boolean {
    return !!this._props.basslineMidiUrl;
  }

  hasHarmonyMidi(): boolean {
    return !!this._props.harmonyMidiUrl;
  }

  hasMetronomeMidi(): boolean {
    return !!this._props.metronomeMidiUrl;
  }

  hasAnyMidiFile(): boolean {
    return (
      this.hasMidiFile() ||
      this.hasDrummerMidi() ||
      this.hasBasslineMidi() ||
      this.hasHarmonyMidi() ||
      this.hasMetronomeMidi()
    );
  }

  hasNotes(): boolean {
    return this._props.notes.length > 0;
  }

  getNoteCount(): number {
    return this._props.notes.length;
  }

  getTempoCategory(): 'slow' | 'medium' | 'fast' {
    if (this.isSlowTempo()) return 'slow';
    if (this.isMediumTempo()) return 'medium';
    return 'fast';
  }

  isComplete(): boolean {
    return !!(
      this._props.title &&
      this._props.description &&
      this._props.difficulty &&
      this._props.bpm &&
      this._props.duration &&
      this._props.notes.length > 0
    );
  }

  // Factory method for creating from API response
  static fromDTO(dto: any): Exercise {
    // CRITICAL DEBUG: Log the entire DTO to see what backend is sending
    if (isVerboseDebugEnabled()) {
      console.log('🔍 [EXERCISE-DTO] Received DTO from backend:', {
        title: dto.title,
        id: dto.id,
        harmony_instrument: dto.harmony_instrument,
        harmonyInstrument: dto.harmonyInstrument, // Check if camelCase version exists
        hasHarmonyMidiUrl: !!dto.harmony_midi_url,
        hasHarmonyNotes: !!dto.harmony_notes,
        harmonyNotesCount: dto.harmony_notes?.length || 0,
        allKeys: Object.keys(dto),
      });

      // TEMPORARY DEBUG: Log harmony_notes mapping
      if (
        dto.harmony_midi_url ||
        dto.harmony_notes ||
        dto.harmony_control_changes
      ) {
        console.log('🔍 Exercise.fromDTO - Harmony data:', {
          title: dto.title,
          hasHarmonyMidiUrl: !!dto.harmony_midi_url,
          hasHarmonyNotes: !!dto.harmony_notes,
          harmonyNotesCount: dto.harmony_notes?.length || 0,
          hasHarmonyControlChanges: !!dto.harmony_control_changes,
          harmonyControlChangesCount: dto.harmony_control_changes?.length || 0,
          harmonyInstrument: dto.harmony_instrument,
          firstHarmonyNote: dto.harmony_notes?.[0],
          firstControlChange: dto.harmony_control_changes?.[0],
        });
      }
    }

    const exercise = Exercise.reconstitute({
      id: ExerciseId.create(dto.id),
      tutorialId: dto.tutorial_id,
      title: dto.title,
      description: dto.description,
      difficulty: Difficulty.fromString(dto.difficulty),
      duration: dto.duration,
      duration_beats: dto.duration_beats || dto.durationBeats, // Support both snake_case and camelCase
      total_bars: dto.total_bars || dto.totalBars, // Support both snake_case and camelCase
      bpm: dto.bpm,
      key: dto.key,
      timeSignature: dto.time_signature || dto.timeSignature, // Support both snake_case and camelCase
      notes: dto.notes || [],
      tags: dto.tags || [],
      isActive: dto.is_active ?? true,
      midiFilePath: dto.midi_file_path,
      originalFilename: dto.original_filename,
      fileSize: dto.file_size,
      uploadedAt: dto.uploaded_at ? new Date(dto.uploaded_at) : undefined,
      drummerMidiUrl: dto.drummer_midi_url,
      basslineMidiUrl: dto.bassline_midi_url,
      harmonyMidiUrl: dto.harmony_midi_url,
      metronomeMidiUrl: dto.metronome_midi_url,
      drumPattern: dto.drum_pattern,
      harmonyNotes: dto.harmony_notes,
      harmonyControlChanges: dto.harmony_control_changes,
      harmonyInstrument: dto.harmony_instrument,
      fretboardViewConfig: dto.fretboard_view_config,
      createdBy: dto.created_by,
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
    });

    // CRITICAL DEBUG: Verify the exercise entity has the field after creation
    if (isVerboseDebugEnabled()) {
      console.log('🔍 [EXERCISE-ENTITY] Created entity:', {
        title: exercise.title,
        harmonyInstrument: exercise.harmonyInstrument,
        harmonyInstrumentFromProps: exercise._props?.harmonyInstrument,
        propsKeys: Object.keys(exercise._props || {}),
      });
    }

    return exercise;
  }

  // Method to convert to API request format
  toDTO(): any {
    return {
      id: this._props.id.value,
      tutorial_id: this._props.tutorialId,
      title: this._props.title,
      description: this._props.description,
      difficulty: this._props.difficulty.value,
      duration: this._props.duration,
      duration_beats: this._props.duration_beats,
      total_bars: this._props.total_bars,
      time_signature: this._props.timeSignature,
      bpm: this._props.bpm,
      key: this._props.key,
      notes: this._props.notes,
      tags: this._props.tags,
      is_active: this._props.isActive,
      midi_file_path: this._props.midiFilePath,
      original_filename: this._props.originalFilename,
      file_size: this._props.fileSize,
      uploaded_at: this._props.uploadedAt?.toISOString(),
      drummer_midi_url: this._props.drummerMidiUrl,
      bassline_midi_url: this._props.basslineMidiUrl,
      harmony_midi_url: this._props.harmonyMidiUrl,
      metronome_midi_url: this._props.metronomeMidiUrl,
      drum_pattern: this._props.drumPattern,
      harmony_notes: this._props.harmonyNotes,
      harmony_control_changes: this._props.harmonyControlChanges,
      harmony_instrument: this._props.harmonyInstrument,
      fretboard_view_config: this._props.fretboardViewConfig,
      created_by: this._props.createdBy,
      created_at: this._props.createdAt.toISOString(),
      updated_at: this._props.updatedAt.toISOString(),
    };
  }
}
