import { IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { DrumHit, MidiDrumType } from '@bassnotion/contracts';

/**
 * Request DTO for converting drummer MIDI to drum pattern
 */
export class ConvertDrumMidiRequestDto {
  @IsString()
  exerciseId!: string;

  @IsString()
  drummerMidiUrl!: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

/**
 * Position in musical time
 */
export class MusicalPositionDto {
  @IsNumber()
  measure!: number;

  @IsNumber()
  beat!: number;

  @IsNumber()
  subdivision!: number;
}

/**
 * Single drum hit
 */
export class DrumHitDto {
  @IsString()
  id!: string;

  @IsString()
  drum!: MidiDrumType;

  @IsNumber()
  velocity!: number;

  @ValidateNested()
  @Type(() => MusicalPositionDto)
  position!: MusicalPositionDto;

  @IsNumber()
  durationTicks!: number;

  @IsNumber()
  midiNote!: number;
}

/**
 * Drum pattern statistics
 */
export class DrumPatternStatsDto {
  @IsNumber()
  totalHits!: number;

  @IsNumber()
  uniqueDrums!: number;

  @IsNumber()
  unknownCount!: number;

  @IsNumber()
  measureCount!: number;

  drumCounts!: Record<MidiDrumType, number>;
}

/**
 * Response DTO for drum MIDI conversion
 */
export class ConvertDrumMidiResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DrumHitDto)
  drumPattern!: DrumHit[];

  @ValidateNested()
  @Type(() => DrumPatternStatsDto)
  stats!: DrumPatternStatsDto;

  @IsArray()
  warnings!: string[];

  @IsOptional()
  @IsString()
  message?: string;
}

/**
 * Request DTO for updating drum pattern after admin review
 */
export class UpdateDrumPatternDto {
  @IsString()
  exerciseId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DrumHitDto)
  drumPattern!: DrumHit[];

  @IsOptional()
  @IsString()
  correlationId?: string;
}
