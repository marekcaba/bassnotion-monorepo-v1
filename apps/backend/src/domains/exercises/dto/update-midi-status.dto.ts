import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateMidiStatusDto {
  @IsBoolean()
  @IsOptional()
  has_metronome_midi?: boolean;

  @IsBoolean()
  @IsOptional()
  has_drums_midi?: boolean;

  @IsBoolean()
  @IsOptional()
  has_bass_midi?: boolean;

  @IsBoolean()
  @IsOptional()
  has_harmony_midi?: boolean;
}