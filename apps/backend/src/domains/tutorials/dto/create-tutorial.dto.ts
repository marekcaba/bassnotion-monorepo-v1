import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsEnum,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export enum TutorialDifficulty {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export class CreateTutorialDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @IsString()
  @IsOptional()
  youtube_id?: string;

  @IsNumber()
  @Min(0)
  @Max(7200) // Max 2 hours
  @IsOptional()
  duration?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  author_name!: string;

  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @IsEnum(TutorialDifficulty)
  difficulty!: TutorialDifficulty;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsString()
  @IsOptional()
  core_concept_description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  core_concept_points?: string[];

  @IsOptional()
  teaching_takeaway?: any; // JSON object for teaching takeaway data

  @IsString()
  @IsOptional()
  created_by?: string; // User ID who created the tutorial

  @IsString()
  @IsOptional()
  creator_name?: string; // YouTube channel/creator name

  @IsString()
  @IsOptional()
  creator_channel_url?: string; // YouTube channel URL

  @IsString()
  @IsOptional()
  creator_avatar_url?: string; // YouTube channel avatar URL

  @IsNumber()
  @IsOptional()
  creator_subscriber_count?: number; // YouTube channel subscriber count

  @IsArray()
  @IsOptional()
  blocks?: any[]; // Modular tutorial blocks (JSONB)
}
