import { IsString, IsOptional, IsUrl } from 'class-validator';

export class UpdateExerciseMidiDto {
  @IsString()
  @IsOptional()
  @IsUrl()
  drummer_midi_url?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  bassline_midi_url?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  harmony_midi_url?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  metronome_midi_url?: string;
}
