import { IsArray, IsEnum, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Valid harmony instrument types
 */
export enum HarmonyInstrumentType {
  GRANDPIANO = 'grandpiano',
  RHODES = 'rhodes',
  WURLITZER = 'wurlitzer',
  PAD = 'pad',
}

/**
 * Parsed MIDI measure (comes from MidiParserService)
 */
export interface ParsedMeasure {
  measureNumber: number;
  startTime: number;
  endTime: number;
  notes: Array<{
    pitch: number;
    velocity: number;
    name: string;
    time: number;
    duration: number;
    position: {
      measure: number;
      beat: number;
      subdivision: number;
      tick: number;
    };
    noteDuration: string;
    durationTicks: number;
  }>;
}

/**
 * DTO for converting harmony MIDI to note data
 */
export class ConvertHarmonyMidiDto {
  /**
   * Parsed MIDI measures (from /api/v1/midi/parse)
   */
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => Object)
  measures!: ParsedMeasure[];

  /**
   * Instrument type to use for velocity layer calculation
   */
  @IsEnum(HarmonyInstrumentType)
  @IsNotEmpty()
  instrumentType!: HarmonyInstrumentType;

  /**
   * Optional MIDI control change events (sustain pedal, expression, etc.)
   */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Object)
  controlChanges?: Array<{
    cc: number;
    value: number;
    position: {
      measure: number;
      beat: number;
      subdivision: number;
      tick: number;
    };
    ticks: number;
  }>;
}
