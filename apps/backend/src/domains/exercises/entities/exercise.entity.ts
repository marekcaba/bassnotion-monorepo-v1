import { ExerciseId } from '../value-objects/exercise-id.vo.js';
import { Difficulty } from '../value-objects/difficulty.vo.js';

// Temporary type until ExerciseNoteSchema includes position field
// The schema currently doesn't include position, but the ExerciseNote type requires it
interface ExerciseNoteBasic {
  id: string;
  timestamp: number;
  string: number;
  fret: number;
  duration: number;
  note: string;
  color: string;
  techniques?: any[];
  [key: string]: any; // Allow additional properties
}

export interface ExerciseProps {
  id: ExerciseId;
  tutorialId?: string; // UUID reference to tutorial
  title: string;
  description: string;
  difficulty: Difficulty;
  duration: number; // DEPRECATED: in seconds - use durationBeats
  durationBeats?: number; // Musical duration in beats
  totalBars?: number; // Total measures/bars
  bpm: number;
  key: string;
  timeSignature?: { numerator: number; denominator: number };
  notes: ExerciseNoteBasic[];
  tags: string[];
  isActive: boolean;
  // Legacy single MIDI file (kept for backward compatibility)
  midiFilePath?: string;
  originalFilename?: string;
  fileSize?: number;
  uploadedAt?: Date;
  // New separate MIDI files for each widget
  drummerMidiUrl?: string;
  basslineMidiUrl?: string;
  harmonyMidiUrl?: string;
  metronomeMidiUrl?: string;
  // Harmony instrument data (converted from MIDI)
  harmonyNotes?: any[]; // GeneratedHarmonyNote[] - using any to avoid circular imports
  harmonyControlChanges?: any[]; // HarmonyControlChange[] - MIDI control events (sustain, expression)
  harmonyInstrument?: 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad';
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Exercise {
  private constructor(private props: ExerciseProps) {}

  static create(
    props: Omit<ExerciseProps, 'createdAt' | 'updatedAt'>,
  ): Exercise {
    const now = new Date();
    return new Exercise({
      ...props,
      createdAt: now,
      updatedAt: now });
  }

  static reconstitute(props: ExerciseProps): Exercise {
    return new Exercise(props);
  }

  // Getters
  get id(): ExerciseId {
    return this.props.id;
  }

  get tutorialId(): string | undefined {
    return this.props.tutorialId;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  get difficulty(): Difficulty {
    return this.props.difficulty;
  }

  get duration(): number {
    return this.props.duration;
  }

  get durationBeats(): number | undefined {
    return this.props.durationBeats;
  }

  get totalBars(): number | undefined {
    return this.props.totalBars;
  }

  get bpm(): number {
    return this.props.bpm;
  }

  get key(): string {
    return this.props.key;
  }

  get timeSignature(): { numerator: number; denominator: number } | undefined {
    return this.props.timeSignature;
  }

  get notes(): ExerciseNoteBasic[] {
    return [...this.props.notes]; // Return a copy to maintain immutability
  }

  get tags(): string[] {
    return [...this.props.tags];
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get midiFilePath(): string | undefined {
    return this.props.midiFilePath;
  }

  get drummerMidiUrl(): string | undefined {
    return this.props.drummerMidiUrl;
  }

  get basslineMidiUrl(): string | undefined {
    return this.props.basslineMidiUrl;
  }

  get harmonyMidiUrl(): string | undefined {
    return this.props.harmonyMidiUrl;
  }

  get metronomeMidiUrl(): string | undefined {
    return this.props.metronomeMidiUrl;
  }

  get harmonyNotes(): any[] | undefined {
    return this.props.harmonyNotes ? [...this.props.harmonyNotes] : undefined;
  }

  get harmonyControlChanges(): any[] | undefined {
    return this.props.harmonyControlChanges ? [...this.props.harmonyControlChanges] : undefined;
  }

  get harmonyInstrument(): 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad' | undefined {
    return this.props.harmonyInstrument;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business logic methods
  canBePlayedByBeginner(): boolean {
    return this.props.difficulty.isBeginnerFriendly() && this.props.bpm <= 120;
  }

  getDurationInMinutes(): number {
    return Math.round((this.props.duration / 60) * 10) / 10;
  }

  hasTag(tag: string): boolean {
    return this.props.tags.includes(tag.toLowerCase());
  }

  isSlowTempo(): boolean {
    return this.props.bpm < 60;
  }

  isMediumTempo(): boolean {
    return this.props.bpm >= 60 && this.props.bpm <= 120;
  }

  isFastTempo(): boolean {
    return this.props.bpm > 120;
  }

  hasMidiFile(): boolean {
    return !!this.props.midiFilePath;
  }

  hasDrummerMidi(): boolean {
    return !!this.props.drummerMidiUrl;
  }

  hasBasslineMidi(): boolean {
    return !!this.props.basslineMidiUrl;
  }

  hasHarmonyMidi(): boolean {
    return !!this.props.harmonyMidiUrl;
  }

  hasMetronomeMidi(): boolean {
    return !!this.props.metronomeMidiUrl;
  }

  hasAnyMidiFile(): boolean {
    return this.hasMidiFile() || this.hasDrummerMidi() ||
           this.hasBasslineMidi() || this.hasHarmonyMidi() ||
           this.hasMetronomeMidi();
  }

  // Mutation methods
  updateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new Error('Title cannot be empty');
    }
    this.props.title = title.trim();
    this.markAsUpdated();
  }

  updateDescription(description: string): void {
    this.props.description = description.trim();
    this.markAsUpdated();
  }

  updateDifficulty(difficulty: Difficulty): void {
    this.props.difficulty = difficulty;
    this.markAsUpdated();
  }

  updateBpm(bpm: number): void {
    if (bpm < 20 || bpm > 300) {
      throw new Error('BPM must be between 20 and 300');
    }
    this.props.bpm = bpm;
    this.markAsUpdated();
  }

  addTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();
    if (normalizedTag && !this.props.tags.includes(normalizedTag)) {
      this.props.tags.push(normalizedTag);
      this.markAsUpdated();
    }
  }

  removeTag(tag: string): void {
    const normalizedTag = tag.toLowerCase().trim();
    const index = this.props.tags.indexOf(normalizedTag);
    if (index > -1) {
      this.props.tags.splice(index, 1);
      this.markAsUpdated();
    }
  }

  activate(): void {
    this.props.isActive = true;
    this.markAsUpdated();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.markAsUpdated();
  }

  private markAsUpdated(): void {
    this.props.updatedAt = new Date();
  }

  // Conversion method for persistence
  toPersistence(): any {
    return {
      id: this.props.id.value,
      tutorial_id: this.props.tutorialId,
      title: this.props.title,
      description: this.props.description,
      difficulty: this.props.difficulty.value,
      duration: this.props.duration,
      duration_beats: this.props.durationBeats,
      total_bars: this.props.totalBars,
      bpm: this.props.bpm,
      key: this.props.key,
      time_signature: this.props.timeSignature,
      notes: this.props.notes,
      tags: this.props.tags,
      is_active: this.props.isActive,
      midi_file_path: this.props.midiFilePath,
      original_filename: this.props.originalFilename,
      file_size: this.props.fileSize,
      uploaded_at: this.props.uploadedAt?.toISOString(),
      drummer_midi_url: this.props.drummerMidiUrl,
      bassline_midi_url: this.props.basslineMidiUrl,
      harmony_midi_url: this.props.harmonyMidiUrl,
      metronome_midi_url: this.props.metronomeMidiUrl,
      harmony_notes: this.props.harmonyNotes,
      harmony_control_changes: this.props.harmonyControlChanges,
      harmony_instrument: this.props.harmonyInstrument,
      created_by: this.props.createdBy,
      created_at: this.props.createdAt.toISOString(),
      updated_at: this.props.updatedAt.toISOString() };
  }
}
