import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max } from 'class-validator';

export enum FileUploadType {
  MUSICXML = 'musicxml',
  MIDI = 'midi' }

export class FileUploadDto {
  @IsEnum(FileUploadType)
  fileType!: FileUploadType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';

  @IsOptional()
  @IsBoolean()
  autoDetectDifficulty?: boolean;

  @IsOptional()
  @IsBoolean()
  createExercise?: boolean;

  @IsOptional()
  @IsBoolean()
  storeFile?: boolean;
}

export class MusicXMLUploadConfigDto {
  @IsOptional()
  @IsString()
  targetInstrument?: 'bass' | 'guitar' | 'auto';

  @IsOptional()
  @IsBoolean()
  includeTablature?: boolean;

  @IsOptional()
  @IsBoolean()
  convertArticulations?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(6)
  stringCount?: number;
}

export class MIDIUploadConfigDto {
  @IsOptional()
  @IsString()
  targetFormat?: 'exercise' | 'bass_track' | 'full_analysis';

  @IsOptional()
  @IsBoolean()
  autoSelectBass?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(23)
  @Max(127)
  bassNoteRangeMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(23)
  @Max(127)
  bassNoteRangeMax?: number;

  @IsOptional()
  @IsString()
  quantization?: 'none' | 'eighth' | 'sixteenth' | 'thirty_second';

  @IsOptional()
  @IsString()
  bassTuning?: 'standard4' | 'standard5' | 'dropD';
}

export class FileUploadResponseDto {
  success!: boolean;
  message!: string;

  // File processing results
  originalFileName!: string;
  fileSize!: number;
  processingTimeMs!: number;

  // Parsing results
  parsingResult?: {
    format: string;
    trackCount?: number;
    durationSeconds?: number;
    notesFound: number;
    bassTrackFound: boolean;
    confidence?: number;
  };

  // Exercise creation results
  exercise?: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    noteCount: number;
    bpm: number;
    key: string;
    timeSignature: string;
  };

  // Warnings and errors
  warnings!: string[];
  errors!: string[];

  // Processing stats
  conversionStats?: {
    originalNotes: number;
    convertedNotes: number;
    droppedNotes: number;
    quantizedNotes: number;
  };
}

export class FileUploadErrorDto {
  success!: false;
  error!: string;
  errorCode!: string;
  details?: any;
  originalFileName?: string;
  fileSize?: number;
}
