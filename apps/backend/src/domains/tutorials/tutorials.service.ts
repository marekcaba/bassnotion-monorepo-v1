import {
  Injectable,
  NotFoundException,
  Inject,
  BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import type {
  Tutorial as TutorialContract,
  TutorialSummary } from '@bassnotion/contracts';
import type { IResultTutorialRepository } from './repositories/result-tutorial.repository.js';
import { TutorialId } from './value-objects/tutorial-id.vo.js';
import { TutorialSlug } from './value-objects/tutorial-slug.vo.js';
import { Tutorial } from './entities/tutorial.entity.js';

@Injectable()
export class TutorialsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject('IResultTutorialRepository')
    private readonly tutorialRepository: IResultTutorialRepository,
  ) {}

  async findAll(): Promise<{ tutorials: TutorialSummary[]; total: number }> {
    // Using repository pattern
    const result = await this.tutorialRepository.findAll({
      page: 1,
      limit: 100 });

    if (!result.ok) {
      throw new Error(`Failed to fetch tutorials: ${result.error?.message}`);
    }

    // Get exercise counts separately (this could be optimized with a custom query)
    const { data: tutorialCounts, error } = await this.supabaseService
      .getClient()
      .rpc('get_tutorials_with_exercise_count');

    if (!error && tutorialCounts) {
      // Map counts to tutorials
      const countsMap = new Map(
        tutorialCounts.map((tc: any) => [tc.id, tc.exercise_count]),
      );

      const tutorialsWithCounts: TutorialSummary[] = result.value.items.map(
        (tutorial) => ({
          id: tutorial.id.value,
          slug: tutorial.slug.value,
          title: tutorial.title,
          artist: tutorial.authorName,
          youtube_url: tutorial.youtubeId,
          youtube_id: tutorial.youtubeId,
          difficulty: tutorial.level as
            | 'beginner'
            | 'intermediate'
            | 'advanced',
          duration: tutorial.duration?.toString(),
          description: tutorial.description,
          headline: undefined,
          concepts: tutorial.tags,
          thumbnail: tutorial.thumbnailUrl,
          rating: undefined,
          exercise_count: (countsMap.get(tutorial.id.value) as number) || 0,
          is_active: tutorial.isActive,
          created_at: tutorial.createdAt.toISOString(),
          updated_at: tutorial.updatedAt.toISOString() }),
      );

      return {
        tutorials: tutorialsWithCounts,
        total: result.value.total };
    }

    // Fallback without exercise counts
    const tutorials: TutorialSummary[] = result.value.items.map((tutorial) => ({
      id: tutorial.id.value,
      slug: tutorial.slug.value,
      title: tutorial.title,
      artist: tutorial.authorName,
      youtube_url: tutorial.youtubeId,
      youtube_id: tutorial.youtubeId,
      difficulty: tutorial.level as 'beginner' | 'intermediate' | 'advanced',
      duration: tutorial.duration?.toString(),
      description: tutorial.description,
      headline: undefined,
      concepts: tutorial.tags,
      thumbnail: tutorial.thumbnailUrl,
      rating: undefined,
      exercise_count: 0,
      is_active: tutorial.isActive,
      created_at: tutorial.createdAt.toISOString(),
      updated_at: tutorial.updatedAt.toISOString() }));

    return {
      tutorials,
      total: result.value.total };
  }

  async findBySlug(slug: string): Promise<TutorialContract> {
    try {
      const tutorialSlug = TutorialSlug.create(slug);
      const result = await this.tutorialRepository.findBySlug(tutorialSlug);

      if (!result.ok) {
        throw new Error(`Failed to find tutorial: ${result.error?.message}`);
      }

      if (!result.value || !result.value.isActive) {
        throw new NotFoundException(`Tutorial with slug "${slug}" not found`);
      }

      return this.mapToContract(result.value);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error as Error;
      }
      // Handle slug validation errors from TutorialSlug.create()
      if (error instanceof Error && error.message.includes('slug')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async findExercisesByTutorialSlug(slug: string): Promise<{
    tutorial: TutorialContract;
    exercises: any[]; // Using any[] to avoid type conflicts for now
  }> {
    // First get the tutorial
    const tutorial = await this.findBySlug(slug);

    // Then get the exercises for this tutorial
    // NOTE: Using exercises table directly instead of exercises_with_runtime view
    // because the view doesn't include MIDI URL columns yet
    const { data: exercises, error: exercisesError } =
      await this.supabaseService
        .getClient()
        .from('exercises')
        .select(
          `
        id,
        title,
        description,
        difficulty,
        duration,
        bpm,
        key,
        tutorial_id,
        created_at,
        updated_at,
        is_active,
        chord_progression,
        notes,
        total_bars,
        time_signature,
        tempo,
        drummer_midi_url,
        bassline_midi_url,
        harmony_midi_url,
        metronome_midi_url,
        drum_pattern,
        harmony_notes,
        harmony_control_changes,
        harmony_instrument
      `,
        )
        .eq('tutorial_id', tutorial.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

    if (exercisesError) {
      throw new Error(`Failed to fetch exercises: ${exercisesError.message}`);
    }

    return {
      tutorial,
      exercises: exercises || [] };
  }

  async findById(id: string): Promise<TutorialContract> {
    try {
      const tutorialId = TutorialId.create(id);
      const result = await this.tutorialRepository.findById(tutorialId);

      if (!result.ok) {
        throw new Error(`Failed to find tutorial: ${result.error?.message}`);
      }

      if (!result.value || !result.value.isActive) {
        throw new NotFoundException(`Tutorial with id "${id}" not found`);
      }

      return this.mapToContract(result.value);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error as Error;
      }
      throw new BadRequestException(`Invalid id format: ${id}`);
    }
  }

  // Temporary method to fix exercise-tutorial relationships
  async fixExerciseLinks(): Promise<{ message: string; results: any[] }> {
    const results = [];

    // Blues Scale Mastery -> Billie Jean
    const billieJeanTutorial = await this.findBySlug('billie-jean');
    const { data: bluesExercise, error: bluesError } =
      await this.supabaseService
        .getClient()
        .from('exercises')
        .update({ tutorial_id: billieJeanTutorial.id })
        .eq('title', 'Blues Scale Mastery')
        .select();

    if (bluesError) {
      results.push({
        exercise: 'Blues Scale Mastery',
        error: bluesError.message });
    } else {
      results.push({
        exercise: 'Blues Scale Mastery',
        success: true,
        updated: bluesExercise });
    }

    return {
      message: 'Exercise-tutorial relationships updated',
      results };
  }

  private mapToContract(tutorial: Tutorial): TutorialContract {
    return {
      id: tutorial.id.value,
      slug: tutorial.slug.value,
      title: tutorial.title,
      artist: tutorial.authorName, // Map authorName to artist
      difficulty: tutorial.level as 'beginner' | 'intermediate' | 'advanced', // Map level to difficulty
      description: tutorial.description,
      youtube_url: tutorial.youtubeId, // Map youtubeId to youtube_url
      duration: tutorial.duration?.toString(),
      thumbnail: tutorial.thumbnailUrl,
      is_active: tutorial.isActive,
      created_at: tutorial.createdAt.toISOString(),
      updated_at: tutorial.updatedAt.toISOString(),
      // Optional fields
      headline: undefined,
      concepts: tutorial.tags,
      rating: undefined,
      // Creator fields for YouTube attribution
      creator_name: tutorial.creatorName,
      creator_channel_url: tutorial.creatorChannelUrl,
      creator_avatar_url: tutorial.creatorAvatarUrl,
      creator_subscriber_count: tutorial.creatorSubscriberCount,
    };
  }
}
