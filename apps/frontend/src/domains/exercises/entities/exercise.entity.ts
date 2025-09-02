import { ExerciseId } from '../value-objects/exercise-id';
import { Difficulty } from '../value-objects/difficulty';

// Note type for frontend usage
export interface ExerciseNote {
  id: string;
  timestamp: number;
  string: number;
  fret: number;
  duration: number;
  note: string;
  color: string;
  techniques?: string[];
  position?: number;
}

export interface ExerciseProps {
  id: ExerciseId;
  title: string;
  description: string;
  difficulty: Difficulty;
  duration: number; // in seconds
  bpm: number;
  key: string;
  notes: ExerciseNote[];
  tags: string[];
  isActive: boolean;
  midiFilePath?: string;
  originalFilename?: string;
  fileSize?: number;
  uploadedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Exercise {
  private constructor(private readonly _props: ExerciseProps) {
    Object.freeze(this);
  }

  static create(
    props: Omit<ExerciseProps, 'createdAt' | 'updatedAt'>
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

  get bpm(): number {
    return this._props.bpm;
  }

  get key(): string {
    return this._props.key;
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
    return this._props.difficulty.isBeginnerFriendly() && this._props.bpm <= 120;
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
    return Exercise.reconstitute({
      id: ExerciseId.create(dto.id),
      title: dto.title,
      description: dto.description,
      difficulty: Difficulty.create(dto.difficulty),
      duration: dto.duration,
      bpm: dto.bpm,
      key: dto.key,
      notes: dto.notes || [],
      tags: dto.tags || [],
      isActive: dto.is_active ?? true,
      midiFilePath: dto.midi_file_path,
      originalFilename: dto.original_filename,
      fileSize: dto.file_size,
      uploadedAt: dto.uploaded_at ? new Date(dto.uploaded_at) : undefined,
      createdBy: dto.created_by,
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
    });
  }

  // Method to convert to API request format
  toDTO(): any {
    return {
      id: this._props.id.value,
      title: this._props.title,
      description: this._props.description,
      difficulty: this._props.difficulty.value,
      duration: this._props.duration,
      bpm: this._props.bpm,
      key: this._props.key,
      notes: this._props.notes,
      tags: this._props.tags,
      is_active: this._props.isActive,
      midi_file_path: this._props.midiFilePath,
      original_filename: this._props.originalFilename,
      file_size: this._props.fileSize,
      uploaded_at: this._props.uploadedAt?.toISOString(),
      created_by: this._props.createdBy,
      created_at: this._props.createdAt.toISOString(),
      updated_at: this._props.updatedAt.toISOString(),
    };
  }
}